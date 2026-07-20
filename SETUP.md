# AO Member Guidebook, Auto-Sync Setup

This makes your guidebook's "this week" class programming update itself, straight from your Notion monthly programs, with no manual work after setup.

## What's in this folder
- `index.html`, the guidebook (the thing members open)
- `program.js`, this week's programming data (gets auto-updated)
- `scripts/sync-notion.mjs`, reads your Notion pages and rewrites `program.js`
- `.github/workflows/sync-program.yml`, runs the sync automatically every week

## How it works (plain English)
Once a week, a free GitHub robot reads your three Notion "Monthly Program" pages (AO Fit, AO Strength, AO Power), rebuilds `program.js`, and saves it. Netlify sees the change and republishes your site. Members always see the current week. If Notion can't be read for any reason, the robot stops and leaves the last good data in place, so the site never breaks.

---

## One-time setup (about 20 to 30 minutes)

### 1) Put these files in a GitHub repo
1. Create a free account at github.com if you don't have one.
2. Click **New repository**. Name it something like `ao-guidebook`. Private is fine. Create it.
3. Click **Add file → Upload files**, then drag in everything from this folder. Important: keep the folders, drag the `scripts` folder and the `.github` folder in too (GitHub keeps the structure). Commit.

### 2) Create a Notion integration (this is how the robot reads Notion)
1. Go to **notion.so/my-integrations → New integration**.
2. Name it `AO Guidebook Sync`, type **Internal**, and give it **Read content**.
3. Copy the **Internal Integration Secret** (a long string). Keep it private, treat it like a password.

### 3) Give that integration access to your 3 program pages
For each page below: open it in Notion → click the **•••** menu (top right) → **Connections** → add **AO Guidebook Sync**:
- AO Fit Monthly Program
- AO Strength Monthly Program
- AO Power Monthly Program

(Shortcut: if all three live under one parent page, you can add the connection to the parent once and the children inherit it.)

### 4) Store the token in GitHub (you enter it, I never see it)
1. In your repo: **Settings → Secrets and variables → Actions → New repository secret**.
2. Name it exactly `NOTION_TOKEN`. Paste the secret from step 2 as the value. Save.

### 5) Connect Netlify to the repo (keeps your current URL)
1. In Netlify, open your existing site → **Site configuration → Build & deploy → Continuous deployment → Link repository**.
2. Pick your GitHub repo, branch `main`. There's no build command; leave the build command blank and the publish directory as the root.
3. Done. From now on, any change in the repo auto-publishes to `aoclientguidebook.netlify.app`.

(If you'd rather start fresh: Netlify → **Add new site → Import an existing project → GitHub → your repo**. That gives a new URL.)

### 6) Test it
1. In GitHub, go to the **Actions** tab → **Sync AO program from Notion** → **Run workflow**.
2. Give it a minute. It should update `program.js`; Netlify then republishes in ~1 minute.
3. Open your site and tap a class under "This week, day by day" to confirm it matches Notion.

---

## Living with it
- It runs on its own every **Monday morning**. You can also run it any time (Actions → Run workflow) right after you rewrite a monthly program in Notion, so you don't have to wait for Monday.
- If a run shows red in the Actions tab, open it to see why (usually the integration lost access to a page, just re-add the connection).
- When I send you an updated `index.html` later, just upload it to the repo to replace the old one. Netlify republishes automatically. `program.js` is left alone.

## Good to know
- The 4-week phase order (Endurance → Hypertrophy → Power → Max Strength) and its start date live in `index.html` (currently Monday, July 13, 2026 = Endurance). If your cycle ever resets to a different week, tell me and I'll nudge that one date.
- Your Notion token lives only in GitHub's encrypted secrets. It is never in the website or the code.
