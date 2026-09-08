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

## Layout

| Path | Purpose |
|---|---|
| `scripts/` | TypeScript fetcher (`npm run fetch`). `espn.ts` talks to ESPN, `derive.ts` normalizes, `fetch.ts` orchestrates. |
| `data/raw/<season>/league.json` | Verbatim ESPN payload, all views. Source of truth for future stats. Never hand-edit. |
| `data/derived/<season>.json` | Compact per-season shape the UI reads (`src/types/derived.ts`). |
| `data/derived/index.json` | Season list, champions, league name, last-updated stamp. |
| `src/` | Vite + React + TypeScript app. Pages: Standings, Matchups, History. |
| `config/league.json` | League id and first season. |
| `.github/workflows/refresh.yml` | Fetch, commit, build, deploy. |
| `.github/workflows/keepalive.yml` | Monthly stamp so GitHub never disables the schedule. |

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
npm run fetch -- --players       # also capture the full player universe (large)
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
**Settings > Secrets and variables > Actions** as `ESPN_S2` and `ESPN_SWID`.

`espn_s2` expires roughly yearly. When it does, the scheduled run fails on the current season, GitHub
emails you, and the last good site stays live. Re-copy the cookie and update the secret.

## GitHub setup (one time)

1. Create a **public** repo named `fantasy-stats` (free Pages requires public).
2. Push this folder to `main`.
3. **Settings > Secrets and variables > Actions**: add `ESPN_S2` and `ESPN_SWID`.
4. **Settings > Pages**: Source = **GitHub Actions**.
5. **Settings > Actions > General**: Workflow permissions = **Read and write** (the bot pushes data).
6. **Actions** tab: run "Refresh data and deploy" once by hand. The site appears at
   `https://<user>.github.io/fantasy-stats/`.

## ESPN API notes

- Base: `https://lm-api-reads.fantasy.espn.com/apis/v3/games/flb/seasons/{year}/segments/0/leagues/{id}`
- Views requested: `mSettings mTeam mRoster mMatchup mMatchupScore mStandings mDraftDetail mTransactions2`
- Visibility is per season **and per endpoint**. Seasons before your account joined return 401 on the
  `seasons/` endpoint but 200 on `leagueHistory/{id}?seasonId={year}` (which returns an array). The
  fetcher tries both.
- This is a head-to-head **categories** league. Matchup results live in `cumulativeScore.wins/losses/ties`
  (categories won), not `totalPoints`, and team records are category tallies.
- Stat, position, and pro-team id maps in `scripts/constants.ts` come from
  [cwendt94/espn-api](https://github.com/cwendt94/espn-api).
