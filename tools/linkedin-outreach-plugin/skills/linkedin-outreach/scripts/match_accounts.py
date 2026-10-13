#!/usr/bin/env python3
"""Match LinkedIn connections against a Salesforce account export.

Deterministic and conservative: only clean name matches are "prospect";
anything fuzzy, missing, or on a non-prospect account type is "unsure" so a
human reviews it.

Usage:
  python3 match_accounts.py --accounts accounts.csv --connections connections.json \
      [--cutoff 2026-08-01] [--log outreach-log.csv] > matches.json

connections.json: list of objects with keys
  name, headline, company (optional), title (optional),
  connected_on (YYYY-MM-DD, optional), profile_url (optional)

LinkedIn's own Connections.csv export is also accepted (detected by its
"First Name" header).
"""
import argparse
import csv
import io
import json
import re
import sys
import unicodedata
from datetime import datetime

SUFFIXES = {
    "inc", "incorporated", "llc", "ltd", "limited", "corp", "corporation", "co", "company",
    "plc", "lp", "llp", "ulc", "gmbh", "sa", "ag", "nv", "bv", "the", "ltee", "holdings",
    "holding", "group", "enterprises",
}
# Single-word names too generic to match by containment alone.
GENERIC = {
    "canada", "services", "solutions", "systems", "technologies", "technology", "international",
    "global", "energy", "partners", "consulting", "capital", "management", "financial", "digital",
    "health", "industries", "manufacturing", "logistics", "media", "foods", "apex", "summit",
    "north", "american", "national", "first", "united", "premier", "pacific", "atlantic",
}
NOT_PROSPECT_TYPES = {"customer", "competitor", "business partner", "reseller", "service", "other"}
CREDENTIALS = re.compile(r"\b(MBA|CPA|CMA|CFA|PMP|PhD|CGA|CA|P\.?Eng|CIA|CISA|CSCP|Jr\.?|Sr\.?)\b\.?")


def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFKD", s or "") if not unicodedata.combining(c))


def clean_name(raw):
    s = re.sub(r"[\U0001F000-\U0001FFFF☀-➿]", "", raw or "")
    s = re.split(r",|\(|\||–| - ", s)[0]
    return re.sub(r"\s+", " ", CREDENTIALS.sub("", s)).strip()


def person_key(raw):
    parts = re.sub(r"[^a-z\s'-]", " ", strip_accents(clean_name(raw)).lower())
    parts = re.sub(r"['-]", "", parts).split()
    if not parts:
        return ""
    return parts[0] if len(parts) == 1 else f"{parts[0]} {parts[-1]}"


def tokens(s):
    t = strip_accents(s).lower().replace("&", " and ").replace("'", "").replace("’", "")
    t = re.sub(r"[^a-z0-9]+", " ", t).split()
    kept = [w for w in t if w not in SUFFIXES]
    return kept or t


def domain_root(website):
    host = re.sub(r"^https?://", "", (website or "").lower())
    host = re.sub(r"^www\.", "", host).split("/")[0]
    return re.sub(r"[^a-z0-9]", "", host.split(".")[0]) if host else ""


def dice(a, b):
    if len(a) < 2 or len(b) < 2:
        return 0.0
    def grams(s):
        out = {}
        for i in range(len(s) - 1):
            out[s[i:i + 2]] = out.get(s[i:i + 2], 0) + 1
        return out
    A, B = grams(a), grams(b)
    inter = sum(min(v, B.get(k, 0)) for k, v in A.items())
    return 2 * inter / (len(a) - 1 + len(b) - 1)


def contains_phrase(hay, needle):
    return f" {' '.join(needle)} " in f" {' '.join(hay)} "


def distinctive(tok):
    if len(tok) >= 2:
        return len("".join(tok)) >= 5
    return len(tok[0]) >= 5 and tok[0] not in GENERIC and not tok[0].isdigit()


def parse_date(raw):
    s = re.sub(r"(?i)^connected on\s*", "", (raw or "").strip())
    for fmt in ("%Y-%m-%d", "%B %d, %Y", "%b %d, %Y", "%d %b %Y", "%d %B %Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(s.replace("Sept ", "Sep "), fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return ""


def read_text(path):
    raw = open(path, "rb").read()
    try:
        return raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        return raw.decode("cp1252")  # Salesforce exports are often Windows-1252


def load_accounts(path):
    rows = csv.DictReader(io.StringIO(read_text(path)))
    index = []
    for r in rows:
        name = r.get("Account Name") or r.get("Company") or r.get("Name") or ""
        if not name:
            continue
        tok = tokens(name)
        compact = "".join(tok)
        if re.match(r"^\d{5,}", compact):  # numbered companies can't be matched from LinkedIn text
            continue
        index.append({
            "account": {
                "name": name, "type": r.get("Type", ""), "active": r.get("Active Customer", ""),
                "vertical": r.get("Vertical", ""), "sub_vertical": r.get("Sub-Vertical", ""),
                "city": r.get("Billing City", ""), "state": r.get("Billing State/Province (text only)", ""),
                "website": r.get("Website", ""), "employees": r.get("Employees", ""),
            },
            "tok": tok, "key": " ".join(tok), "compact": compact, "domain": domain_root(r.get("Website", "")),
        })
    return index


def score_company(company, index):
    tok = tokens(company)
    if not tok:
        return None
    key, compact = " ".join(tok), "".join(tok)
    best = None

    def consider(e, score, how):
        nonlocal best
        if best is None or score > best[1]:
            best = (e, score, how)

    for e in index:
        if e["key"] == key or e["compact"] == compact:
            consider(e, 1.0, "exact name")
        elif e["domain"] and len(e["domain"]) >= 4 and e["domain"] == compact:
            # CRM websites are sometimes wrong, so require the first word to agree too.
            consider(e, 0.95 if e["tok"][0] == tok[0] else 0.8, f"website domain {e['domain']}")
        elif distinctive(e["tok"]) and contains_phrase(tok, e["tok"]):
            consider(e, 0.8, f'"{company}" contains account name')
        elif distinctive(tok) and contains_phrase(e["tok"], tok):
            consider(e, 0.75, f'account name contains "{company}"')
        else:
            d = dice(compact, e["compact"])
            if d >= 0.88 and len(compact) >= 5:
                consider(e, 0.7, f"similar spelling ({round(d * 100)}%)")
    return best


def companies_from_headline(headline):
    explicit, weak = [], []
    for p in [p.strip() for p in re.split(r"\s*[|•·]\s*|\s+-\s+|\s+–\s+", headline or "") if p.strip()]:
        m = re.search(r"(?i)(?:\bat\b|@)\s+(.+)$", p)
        if m:
            explicit.append(m.group(1).rstrip(",.;").strip())
        else:
            weak.append(p)
    return explicit, weak


def classify(person, index):
    explicit, weak = companies_from_headline(person.get("headline") or person.get("title") or "")
    strong = ([person["company"]] if person.get("company") else []) + explicit
    best = None
    for c in strong:
        r = score_company(c, index)
        if r and (best is None or r[1] > best[1]):
            best = (*r, c)
    if best is None or best[1] < 0.9:
        for c in weak:
            tok = tokens(c)
            for e in index:
                if distinctive(e["tok"]) and len(e["key"]) >= 6 and contains_phrase(tok, e["tok"]):
                    if best is None or 0.65 > best[1]:
                        best = (e, 0.65, f'headline mentions "{e["account"]["name"]}"', c)

    company = strong[0] if strong else ""
    if best is None or best[1] < 0.65:
        if company:
            return {"status": "not_prospect", "company": company, "reason": f'"{company}" is not on the account list'}
        return {"status": "unsure", "company": "", "reason": "Could not tell their company from the headline; check the profile"}

    e, score, how, matched_company = best
    a = e["account"]
    out = {"company": matched_company, "account": a, "match_how": how, "score": score}
    if a["active"] == "1" or a["type"].lower() in NOT_PROSPECT_TYPES:
        label = "an active customer" if a["active"] == "1" else a["type"]
        return {**out, "status": "unsure", "reason": f"Matches {a['name']}, but the account is marked {label}"}
    if score >= 0.9:
        return {**out, "status": "prospect", "reason": f"Matches account {a['name']} ({how})"}
    return {**out, "status": "unsure", "reason": f'Possible match: "{matched_company}" ~ {a["name"]} ({how}); confirm'}


def load_connections(path):
    text = read_text(path)
    if text.lstrip().startswith("["):
        return json.loads(text)
    # LinkedIn Connections.csv: skip the "Notes:" preamble before the header row.
    lines = text.splitlines()
    start = next((i for i, l in enumerate(lines) if l.startswith("First Name")), 0)
    out = []
    for r in csv.DictReader(io.StringIO("\n".join(lines[start:]))):
        out.append({
            "name": f"{r.get('First Name', '')} {r.get('Last Name', '')}".strip(),
            "company": r.get("Company", ""), "title": r.get("Position", ""),
            "headline": r.get("Position", ""), "profile_url": r.get("URL", ""),
            "email": r.get("Email Address", ""), "connected_on": parse_date(r.get("Connected On", "")),
        })
    return out


def load_log(path):
    if not path:
        return {}
    try:
        rows = csv.DictReader(io.StringIO(read_text(path)))
    except FileNotFoundError:
        return {}
    return {person_key(r.get("name", "")): r for r in rows if r.get("name")}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--accounts", required=True)
    ap.add_argument("--connections", required=True)
    ap.add_argument("--cutoff", default="")
    ap.add_argument("--log", default="", help="outreach-log.csv from earlier runs")
    args = ap.parse_args()

    index = load_accounts(args.accounts)
    log = load_log(args.log)
    results, seen = [], set()
    for p in load_connections(args.connections):
        p["name"] = clean_name(p.get("name", ""))
        key = person_key(p["name"])
        if not key or key in seen:
            continue
        seen.add(key)
        p["connected_on"] = parse_date(p.get("connected_on", "")) or p.get("connected_on", "")
        if args.cutoff and p["connected_on"] and p["connected_on"] < args.cutoff:
            continue
        r = {"key": key, "person": p, **classify(p, index)}
        if key in log:
            r["already_logged"] = log[key]
        results.append(r)

    order = {"prospect": 0, "unsure": 1, "not_prospect": 2}
    results.sort(key=lambda r: order[r["status"]])
    counts = {s: sum(1 for r in results if r["status"] == s) for s in order}
    json.dump({"accounts_indexed": len(index), "counts": counts, "results": results}, sys.stdout, indent=1)


if __name__ == "__main__":
    main()
