# Finding customer stories for the Trust line

The Trust line has to be real: a peer customer's outcome, ideally from the same industry
or with the same buyer persona. These stories come from the user's company content,
never from memory or guesswork.

## Where to search (in order)

1. **SharePoint / OneDrive** (Microsoft 365 connector). Try queries such as
   `case study <vertical>`, `customer story <vertical>`, `<persona> results`, `win wire`,
   and `reference customer`. Decks and one-pagers often hold the numbers.
2. **Glean**: the same queries. Glean also indexes Slack, Teams, and wikis, where win stories
   get posted. Prefer an official asset over a chat message when both exist.
3. **Highspot**: search for customer stories / case studies filtered by industry.
   Highspot content is usually approved for external use.
4. **The company's public website**: the customer stories or case studies page.
   Public stories are always safe to name.

Search only for the verticals and personas on today's *Ready* list. Stop once each one
has one or two good stories.

## What to record in `story-library.md`

One entry per story:

```markdown
## <Customer name or anonymized label>
- Vertical / sub-vertical: Manufacturing / Discrete
- Region & size: Ontario, ~1,200 employees
- Buyer persona: Finance (Controller, CFO)
- Problem: <one line, in the customer's words where possible>
- Outcome: <numbers exactly as written in the source>
- Can name publicly: yes (public website) | no / unclear → anonymize
- Source: <link> (found via SharePoint | Glean | Highspot | website, YYYY-MM-DD)
```

Rules:
- Copy numbers exactly. Don't round, combine, or extrapolate.
- If the sources disagree, use the most official one (website or Highspot over a
  chat message) and note the conflict.
- Unless the source is public (website) or clearly marked approved for external use,
  treat the customer as **not nameable**. Describe them anonymously instead, e.g.
  "a ~1,000-person Ontario manufacturer".
- Refresh the library weekly. Drop stories whose source link no longer opens.

## Picking a story for a prospect

1. Same vertical and same persona
2. Same vertical, different persona
3. Same persona, adjacent vertical
4. None: leave `[TRUST: no matching story found]` and tell the user which vertical
   or persona needs a story
