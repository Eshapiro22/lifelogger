# Matching connections to accounts by hand

Use these rules when the matching script can't run. They are the same rules the script
uses. The goal is to never call someone a prospect on a loose match.

## 1. Get each person's company

- Prefer an explicit company field: the Sales Nav "company" column or LinkedIn's Connections.csv.
- Otherwise, use the headline text after **"at"** or **"@"**: "CFO at HubSpot | Board Member" → "HubSpot".
  Stop at `|`, `•`, `,` or ` - `.
- No "at"/"@" in the headline (e.g. "Chief Financial Officer")? Open their profile and read
  the current Experience entry. If it's still unclear: **Review first**, "couldn't tell company".

## 2. Normalize names before comparing

Lowercase, strip accents, turn `&` into "and", and drop punctuation. Then drop these words:
inc, incorporated, llc, ltd, limited, corp, corporation, co, company, plc, lp, llp, ulc,
gmbh, sa, ag, the, ltee, holdings, holding, group, enterprises.

Skip numbered companies like "1057922 Ontario Inc". They can't be matched from LinkedIn.

## 3. Classify

| Situation | Result |
|---|---|
| Normalized names are identical ("Shopify" ↔ "Shopify Inc") | **Prospect** |
| The company equals the account's website domain root, and the first word agrees ("Lightspeed HQ" ↔ Lightspeed Commerce, lightspeedhq.com) | **Prospect** |
| The domain root matches but the first word differs | **Review first**: "possible match via website" |
| One name contains the other as whole words ("Accenture Federal Services" ↔ "Accenture"), and the shorter name is distinctive (5+ letters, not generic) | **Review first**: "possible match / subsidiary" |
| Spelling is nearly the same (one or two letters off) | **Review first**: "similar spelling" |
| No company found in the headline, but the headline mentions an account name | **Review first** |
| A match, but the account Type is Customer, Competitor, Business Partner, Reseller, Service or Other, or Active Customer = 1 | **Review first**: "account is marked <type>" |
| Company found, not on the list | **Not a prospect** |

Generic one-word names that never count as a match on their own: canada, services,
solutions, systems, technologies, technology, international, global, energy, partners,
consulting, capital, management, financial, digital, health, industries, manufacturing,
logistics, media, foods, north, american, national, first, united, premier, pacific, atlantic.

Watch for CRM data errors. For example, an account named "Avenai . Inc." has accenture.com
as its website. A domain-only hit like that is always **Review first**.
