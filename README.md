# Fantasy Stats

Stats site for the **Bangin' Trash Can Dynasty League** (ESPN fantasy baseball, league `1295435853`).
A scheduled GitHub Actions job pulls league data from ESPN's fantasy API, commits it as JSON, builds a
static React site, and deploys it to GitHub Pages. Everything runs on GitHub's free tier.

```
GitHub Actions (every 6h) --cookies from secrets--> ESPN API
        |  writes data/raw + data/derived, commits only if bytes changed
        v
   Vite build (data bundled) --> GitHub Pages
```

The league is private, so the browser can never call ESPN directly. The site only ever renders
committed JSON; freshness is the cron interval.

## What the site shows

| Page | Content |
|---|---|
| Standings | Manager-first standings per season with division badges, playoff cut line, final vs regular-season toggle |
| Matchups | Weekly scoreboard; click a matchup for the 12-category breakdown |
| Stats | Power ratings (z-scores), batting vs pitching, power over time, net record by division, rank-by-category heatmap, weekly xWins (actual vs expected, gained/lost, matchup differential, close categories), expected standings, strength of schedule, category totals, team-strength radar |
| History | Podium per season, all-time standings, results-by-season grid |
| Head-to-Head | Franchise × franchise category (or matchup) records; all / regular season / playoffs-only |
| Teams | Franchise pages: results by season, category strengths, rosters (any season) with acquisition + keeper origin, trades, head-to-head |
| Players | Search any player who passed through the league; timeline of drafts, keeps, adds, drops and expandable trades across seasons |

A **"Your team"** selector in the header highlights that franchise everywhere (stored in localStorage).
Franchise = ESPN team slot, so history is credited across manager changes.

## Layout

| Path | Purpose |
|---|---|
| `scripts/` | TypeScript fetcher (`npm run fetch`). `espn.ts` talks to ESPN, `derive.ts` normalizes a season, `crossSeason.ts` stitches franchises / keeper origins / player directory, `fetch.ts` orchestrates. |
| `data/raw/<season>/league.json` | Verbatim ESPN payload (settings, teams, rosters, schedule with per-category scores, draft). Never hand-edit. |
| `data/raw/<season>/transactions.json` | Deduped transaction archive built from ESPN player cards (adds, drops, trades). Completed seasons are archived once and reused. |
| `data/raw/players-extra.json` | Names for players who only appear as draft picks. |
| `data/derived/<season>.json` | Compact season shape the UI reads (`src/types/derived.ts`): teams, matchups with category results, rosters, draft, players. |
| `data/derived/<season>-tx.json` | Normalized transactions for the season. |
| `data/derived/league.json`, `players.json`, `index.json` | Franchise history, player directory, season index. |
| `src/` | Vite + React + TypeScript app. `src/lib/analytics.ts` holds the xWins / power-rating math. |
| `.github/workflows/refresh.yml` | Fetch, commit, build, deploy. `keepalive.yml` keeps the schedule alive in the off-season. |

## Local development

Requirements: Node 24+.

```powershell
npm install
Copy-Item .env.example .env   # then paste your cookies (see below)
npm run fetch:check           # dry run against ESPN, writes nothing
npm run fetch                 # writes data/raw and data/derived
npm run dev                   # http://localhost:5173
```

Other scripts:

```powershell
npm run fetch -- --season 2024   # one season
npm run fetch -- --tx            # re-capture transaction archives for completed seasons
npm run typecheck                # app + scripts
npm run build; npm run preview   # production build
```

### Corporate network note

If `npm run fetch` fails with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, a TLS-inspecting proxy is in the way.
Point Node at the corporate CA bundle before running:

```powershell
$env:NODE_EXTRA_CA_CERTS = "C:\Users\<you>\.corp-ca.pem"
```

This is a local-machine concern only; GitHub Actions needs nothing.

## ESPN cookies

ESPN's fantasy API is undocumented. Private leagues need two cookies from a logged-in browser session.

1. Log in at <https://fantasy.espn.com> in Chrome or Edge.
2. Press F12, open **Application**, then **Cookies**, then `https://fantasy.espn.com`.
3. Copy `espn_s2` exactly as shown (long, URL-encoded, contains `%2B` and `%3D`).
4. Copy `SWID` including the braces, e.g. `{BBECCE3D-8010-4140-92CE-C6B90341C46D}`.

Locally they go in `.env` (git-ignored). In GitHub they go in
**Settings > Secrets and variables > Actions** as repository secrets `ESPN_S2` and `ESPN_SWID`.

`espn_s2` expires roughly yearly. When it does, the scheduled run fails on the current season, GitHub
emails you, and the last good site stays live. Re-copy the cookie and update the secret.

## Stat definitions

- **Week** = ESPN matchup period. Analytics use completed regular-season weeks only.
- **Actual wins** = category wins + ½ ties.
- **xWins** for a week = for each category, the share of the other 11 teams you would have beaten with your totals (ties count half), summed over the 12 categories. An average week is 6.0.
- **Wins gained/lost** = actual − xWins. **Strength of schedule** = average weekly xWins of opponents faced.
- **Power rating** = Σ z-scores of season-to-date category totals (ERA/WHIP inverted); batting and pitching are the six-category sub-sums. Rate stats are rebuilt from cumulative components (H, AB, BB, HBP, SF, 2B, 3B, HR, outs, ER) for the week-by-week series.
- **Net record** = (category wins − losses) / 2.
- **Matchup differential** = Σ per-category (home − away) in that week's league standard deviations. **Close categories** = categories decided within 0.1 standard deviations (ties included).
- **Keeper since** = first season of the player's unbroken run on the franchise's end-of-season rosters; origin = how they joined that season.

## ESPN API notes

- Base: `https://lm-api-reads.fantasy.espn.com/apis/v3/games/flb/seasons/{year}/segments/0/leagues/{id}`
- Views requested: `mSettings mTeam mRoster mMatchup mMatchupScore mStandings mDraftDetail mTransactions2`
- Visibility is per season **and per endpoint**. Seasons before your account joined return 401 on the
  `seasons/` endpoint but 200 on `leagueHistory/{id}?seasonId={year}` (returns an array). The fetcher tries both.
- Full transaction history is **not** in the league payload (`mTransactions2` holds only recent moves). It comes from
  `view=kona_playercard` with `x-fantasy-filter: {"players":{"limit":3000,"offset":N,"sortPercOwned":...}}`, which returns
  each player's in-league transactions for that season. Works for past seasons on the `seasons/` path; the
  `leagueHistory/` path returns players but no transactions, so 2021 has drafts and final rosters only.
- Player names for drafted-then-dropped players come from `seasons/{year}/players?view=players_wl` with `filterIds`.
- Head-to-head **categories** league: matchup results live in `cumulativeScore.wins/losses/ties` and per-stat
  `scoreByStat` (which includes component stats like AB, H, OUTS), not `totalPoints`.
- Player `defaultPositionId` (1 SP, 2 C … 10 DH, 11 RP) uses a different numbering than lineup slot ids. Both maps are
  in `scripts/constants.ts` (from [cwendt94/espn-api](https://github.com/cwendt94/espn-api)).
