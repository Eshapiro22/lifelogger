# lifelog: time spent on 7268 Amhurst Way

Pulls Voice Memos and Chrome history off a Mac, labels each item as
`house`, `work`, `review` (unsure) or `other`, and writes CSVs for the time-log
Google Sheet. Runs locally and nothing is uploaded. Work-memo transcripts are never
written to disk; only their title and the `work` label are kept.

## One-time setup (each Mac)

1. System Settings → Privacy & Security → **Full Disk Access** → enable **Terminal**.
2. On the iPhone and the Mac, Voice Memos → Settings → turn on **iCloud** so
   phone memos sync to the Mac. (Phone memos that never synced won't be found.)
3. Optional, for transcripts: `brew install ffmpeg && pip3 install openai-whisper`

## Run (each Mac)

```bash
cd lifelog
python3 lifelog.py voice  --since 2026-08-01 --transcribe   # drop --transcribe for titles only
python3 lifelog.py chrome --since 2026-08-01
```

Each run writes to `out-<computer-name>/`. Copy the work Mac's folder to the
personal Mac (or the other way), then:

```bash
python3 lifelog.py merge out-personal-mac out-work-mac
```

`amhurst_mac_combined.csv` keeps only `house` + `review` rows, with duplicates removed.
Paste it into the **Mac activity** tab of the sheet, then go through every `review` row.

## How time is estimated

- **Voice memo**: the recording length, which is exact.
- **Chrome**: Amhurst-related page visits less than 10 minutes apart become one
  session, from the first visit to the last visit plus its time on page (capped at 10 min).
  This is an estimate. Confirm it before relying on it.

Edit `keywords.json` to tune what counts as house vs work.
