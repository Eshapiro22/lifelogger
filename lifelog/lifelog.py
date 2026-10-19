#!/usr/bin/env python3
"""Extract time spent on 7268 Amhurst Way from a Mac: Voice Memos + Chrome history.

Runs locally. Nothing is uploaded anywhere. Output is CSV you paste into the
time-log Google Sheet.

  python3 lifelog.py voice  --since 2026-08-01 [--transcribe]
  python3 lifelog.py chrome --since 2026-08-01
  python3 lifelog.py merge  out-personal/ out-work/      # combine machines

Terminal needs Full Disk Access (System Settings > Privacy & Security) to read
the Voice Memos and Chrome databases.
"""
import argparse
import csv
import glob
import json
import os
import re
import shutil
import socket
import sqlite3
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
HOME = Path.home()

VOICE_DIRS = [
    HOME / "Library/Group Containers/group.com.apple.VoiceMemos.shared/Recordings",
    HOME / "Library/Application Support/com.apple.voicememos/Recordings",
]
CHROME_ROOT = HOME / "Library/Application Support/Google/Chrome"
AUDIO_EXT = {".m4a", ".qta", ".caf", ".wav"}

APPLE_EPOCH = datetime(2001, 1, 1, tzinfo=timezone.utc)
CHROME_EPOCH_OFFSET = 11644473600  # seconds between 1601-01-01 and 1970-01-01

SESSION_GAP = timedelta(minutes=10)  # browser visits closer than this form one session
MAX_VISIT = timedelta(minutes=10)    # cap a single page's dwell time

FIELDS = ["date_local", "start_local", "end_local", "minutes", "source", "machine",
          "classification", "description", "evidence", "confidence"]


# ---------- classification ----------

def load_keywords(path):
    with open(path) as f:
        kw = json.load(f)
    def rx(terms):
        return [re.compile(r"(?<![a-z0-9])" + re.escape(t.lower()) + r"(?![a-z0-9])") for t in terms]
    return {k: rx(v) for k, v in kw.items() if not k.startswith("_")}


def classify(text, kw):
    """Return (label, matched terms). Labels: house, work, review, other."""
    t = (text or "").lower()
    strong = [r.pattern for r in kw["house_strong"] if r.search(t)]
    weak = [r.pattern for r in kw["house_weak"] if r.search(t)]
    work = [r.pattern for r in kw["work"] if r.search(t)]
    hits = [_plain(p) for p in strong + weak + work]
    # Only a property-specific term proves it's Amhurst; generic STR words
    # (pool, airbnb, mortgage) also match research on other deals.
    if strong:
        return ("review" if work else "house"), hits
    if work:
        return "work", hits
    if weak:
        return "review", hits
    return "other", hits


def _plain(pattern):
    return re.sub(r"\(\?<?!\[a-z0-9\]\)", "", pattern).replace("\\", "")


# ---------- helpers ----------

def parse_since(s):
    return datetime.strptime(s, "%Y-%m-%d").astimezone()


def copy_db(path):
    """SQLite files are locked while the app runs; work on a copy."""
    tmp = Path(tempfile.mkdtemp(prefix="lifelog-"))
    dst = tmp / Path(path).name
    shutil.copy2(path, dst)
    for suffix in ("-wal", "-shm"):
        if os.path.exists(str(path) + suffix):
            shutil.copy2(str(path) + suffix, str(dst) + suffix)
    return dst


def row(start, end, source, label, description, evidence, confidence):
    start, end = start.astimezone(), end.astimezone()
    return {
        "date_local": start.strftime("%Y-%m-%d"),
        "start_local": start.strftime("%H:%M"),
        "end_local": end.strftime("%H:%M"),
        "minutes": max(1, round((end - start).total_seconds() / 60)),
        "source": source,
        "machine": socket.gethostname(),
        "classification": label,
        "description": description,
        "evidence": evidence,
        "confidence": confidence,
    }


def write_csv(rows, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(sorted(rows, key=lambda r: (r["date_local"], r["start_local"])))
    counts = {}
    for r in rows:
        counts[r["classification"]] = counts.get(r["classification"], 0) + 1
    print(f"wrote {len(rows)} rows to {path}  {counts}")


# ---------- voice memos ----------

def audio_duration(path):
    """Seconds, via macOS's built-in afinfo. None if unknown."""
    try:
        out = subprocess.run(["afinfo", str(path)], capture_output=True, text=True, timeout=30).stdout
    except (OSError, subprocess.TimeoutExpired):
        return None
    m = re.search(r"estimated duration:\s*([\d.]+)", out)
    return float(m.group(1)) if m else None


def memos_from_db(folder):
    db = folder / "CloudRecordings.db"
    if not db.exists():
        return None
    con = sqlite3.connect(copy_db(db))
    cols = {r[1] for r in con.execute("PRAGMA table_info(ZCLOUDRECORDING)")}
    if not cols:
        return None
    title_col = next((c for c in ("ZCUSTOMLABEL", "ZENCRYPTEDTITLE", "ZCUSTOMLABELFORSORTING") if c in cols), None)
    q = f"SELECT ZDATE, ZDURATION, ZPATH, {title_col or 'NULL'} FROM ZCLOUDRECORDING"
    memos = []
    for zdate, dur, zpath, title in con.execute(q):
        if zdate is None:
            continue
        audio = folder / zpath if zpath else None
        memos.append({
            "start": APPLE_EPOCH + timedelta(seconds=zdate),
            "duration": dur,
            "path": audio if audio and audio.exists() else None,
            "title": title or (Path(zpath).stem if zpath else ""),
        })
    return memos


def recorded_at(path):
    """(start, how). Exported memos get a new file date, so prefer the
    recording date embedded in the audio, then Spotlight, then mtime."""
    try:
        out = subprocess.run(["ffprobe", "-v", "quiet", "-show_entries", "format_tags=creation_time",
                              "-of", "default=nw=1:nk=1", str(path)],
                             capture_output=True, text=True, timeout=30).stdout.strip()
        if out:
            return datetime.fromisoformat(out.replace("Z", "+00:00")), "embedded"
    except (OSError, subprocess.TimeoutExpired, ValueError):
        pass
    try:
        out = subprocess.run(["mdls", "-raw", "-name", "kMDItemContentCreationDate", str(path)],
                             capture_output=True, text=True, timeout=30).stdout.strip()
        if out and out != "(null)":
            return datetime.strptime(out, "%Y-%m-%d %H:%M:%S %z"), "spotlight"
    except (OSError, subprocess.TimeoutExpired, ValueError):
        pass
    return datetime.fromtimestamp(path.stat().st_mtime, timezone.utc), "file date"


def memos_from_files(folder):
    memos = []
    for p in folder.iterdir():
        if p.suffix.lower() in AUDIO_EXT:
            start, how = recorded_at(p)
            memos.append({
                "start": start,
                "date_source": how,
                "duration": audio_duration(p),
                "path": p,
                "title": p.stem,
            })
    return memos


def load_whisper(model_name):
    try:
        import whisper  # pip install openai-whisper  (also needs ffmpeg)
    except ImportError:
        sys.exit("--transcribe needs openai-whisper: pip3 install openai-whisper && brew install ffmpeg")
    print(f"loading whisper model '{model_name}' (first run downloads it)...")
    return whisper.load_model(model_name)


def cmd_voice(args, kw):
    folders = [Path(args.dir).expanduser()] if args.dir else [d for d in VOICE_DIRS if d.exists()]
    if not folders or not folders[0].is_dir():
        sys.exit("No Voice Memos folder found. Grant Terminal Full Disk Access, and check "
                 "Voice Memos > Settings that iCloud sync is on so iPhone memos land on this Mac.")
    since = parse_since(args.since)
    model = load_whisper(args.model) if args.transcribe else None
    rows = []
    for folder in folders:
        memos = None if args.dir else memos_from_db(folder)
        method = "database"
        if memos is None:
            memos, method = memos_from_files(folder), "file dates"
        print(f"{folder}: {len(memos)} memos ({method})")
        for m in memos:
            if m["start"] < since:
                continue
            dur = m["duration"] or (audio_duration(m["path"]) if m["path"] else None) or 60
            text = m["title"]
            transcript = ""
            if model and m["path"]:
                try:
                    transcript = model.transcribe(str(m["path"]), fp16=False)["text"].strip()
                except Exception as e:  # unsupported codec, corrupt file
                    print(f"  could not transcribe {m['path'].name}: {e}")
            label, hits = classify(f"{text} {transcript}", kw)
            # Never write work-memo contents to disk; title + label only.
            desc = f"Voice memo: {m['title']}"
            if transcript and label in ("house", "review"):
                desc += f" | {transcript[:400]}"
            if hits:
                desc += f" [matched: {', '.join(sorted(set(hits)))}]"
            conf = "high (recording length)" if transcript else "medium (title only, verify)"
            if m.get("date_source") == "file date":
                conf += "; DATE UNVERIFIED (export date), check against Voice Memos list"
            rows.append(row(m["start"], m["start"] + timedelta(seconds=dur), "Voice memo",
                            label, desc, str(m["path"] or ""), conf))
    write_csv(rows, Path(args.out) / "voice_memos.csv")


# ---------- chrome ----------

def chrome_visits(since):
    since_chrome = int((since.timestamp() + CHROME_EPOCH_OFFSET) * 1_000_000)
    for hist in glob.glob(str(CHROME_ROOT / "*" / "History")):
        profile = Path(hist).parent.name
        con = sqlite3.connect(copy_db(hist))
        q = """SELECT v.visit_time, v.visit_duration, u.url, u.title
               FROM visits v JOIN urls u ON u.id = v.url
               WHERE v.visit_time >= ? ORDER BY v.visit_time"""
        n = 0
        for vt, vd, url, title in con.execute(q, (since_chrome,)):
            n += 1
            yield {
                "time": datetime.fromtimestamp(vt / 1_000_000 - CHROME_EPOCH_OFFSET, timezone.utc),
                "dwell": timedelta(microseconds=vd or 0),
                "url": url,
                "title": title or "",
                "profile": profile,
            }
        print(f"Chrome profile '{profile}': {n} visits since {since.date()}")


def cmd_chrome(args, kw):
    if not CHROME_ROOT.exists():
        sys.exit(f"Chrome not found at {CHROME_ROOT}")
    since = parse_since(args.since)
    domains = [d.pattern for d in kw["house_domains"]]
    hits = []
    for v in chrome_visits(since):
        # Chrome keeps only the latest title per URL, so the Gmail inbox URL
        # carries whatever email was last open. Email is logged from Gmail anyway.
        if "mail.google.com" in v["url"]:
            continue
        label, _ = classify(f"{v['title']} {v['url']}", kw)
        if label == "other" and any(_plain(d) in v["url"].lower() for d in domains):
            label = "house"
        if label in ("house", "review"):
            v["label"] = label
            hits.append(v)

    # Group nearby visits into sessions so time = active research window.
    rows, session = [], []
    def flush():
        if not session:
            return
        start = session[0]["time"]
        end = max(s["time"] + min(s["dwell"], MAX_VISIT) for s in session)
        end = max(end, start + timedelta(minutes=1))
        label = "house" if any(s["label"] == "house" for s in session) else "review"
        titles = []
        for s in session:
            t = s["title"] or s["url"]
            if t not in titles:
                titles.append(t)
        desc = f"Browser research ({len(session)} pages): " + " | ".join(titles[:6])
        rows.append(row(start, end, f"Chrome ({session[0]['profile']})", label,
                        desc[:700], session[0]["url"], "medium (browser activity, verify)"))
        session.clear()
    for v in hits:
        if session and v["time"] - session[-1]["time"] > SESSION_GAP:
            flush()
        session.append(v)
    flush()
    write_csv(rows, Path(args.out) / "chrome_sessions.csv")


# ---------- merge ----------

def cmd_merge(args, kw):
    seen, rows = set(), []
    for d in args.dirs:
        for f in glob.glob(os.path.join(d, "*.csv")):
            with open(f, newline="") as fh:
                for r in csv.DictReader(fh):
                    key = (r["date_local"], r["start_local"], r["source"], r["evidence"])
                    if key not in seen:  # synced history can appear on both Macs
                        seen.add(key)
                        rows.append(r)
    rows = [r for r in rows if args.all or r["classification"] in ("house", "review")]
    write_csv(rows, Path(args.out) / "amhurst_mac_combined.csv")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--keywords", default=str(HERE / "keywords.json"))
    sub = p.add_subparsers(dest="cmd", required=True)
    for name in ("voice", "chrome"):
        s = sub.add_parser(name)
        s.add_argument("--since", default="2026-08-01")
        s.add_argument("--out", default=str(HERE / f"out-{socket.gethostname().split('.')[0]}"))
    sub.choices["voice"].add_argument("--transcribe", action="store_true",
                                      help="transcribe locally with Whisper (slow, more accurate)")
    sub.choices["voice"].add_argument("--dir", help="folder of memos exported from the Voice Memos app")
    sub.choices["voice"].add_argument("--model", default="base", help="whisper model: tiny/base/small/medium")
    m = sub.add_parser("merge")
    m.add_argument("dirs", nargs="+")
    m.add_argument("--out", default=str(HERE))
    m.add_argument("--all", action="store_true", help="keep work/other rows too")
    args = p.parse_args()
    kw = load_keywords(args.keywords)
    {"voice": cmd_voice, "chrome": cmd_chrome, "merge": cmd_merge}[args.cmd](args, kw)


if __name__ == "__main__":
    main()
