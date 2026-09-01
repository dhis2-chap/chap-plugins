# Dashboard seeding for chap-widgets

**Date:** 2026-09-01
**Status:** Approved (phase 1: seed push/pull; phase 2: board harness, designed later)

## Problem

Adding widgets to a dashboard is manual: deploy, open the dashboard, add each
item, drag it into place, configure it. There is no way to reproduce a
well-arranged dashboard on another instance (local → demo/play), and newly
created widgets don't appear anywhere until someone adds them by hand.

## Solution overview

A committed seed file, `dashboard.seed.json`, is the source of truth for one
seed-owned dashboard ("CHAP Widgets"). A script pushes it to any instance
(creating/replacing the dashboard, its item layout, and each item's widget
config) and pulls the live dashboard back into the file. The real DHIS2
dashboard is the layout editor: arrange and configure there, pull, commit,
and CI reproduces it on the demo instance. Phase 2 adds a local all-widgets
board harness on top of the same seed format.

### Key mechanism: stable dashboard-item UIDs

Widget config lives at `dataStore/chap-widgets/<dashboardItemId>`
(`packages/shared/src/config/useDashboardItemConfig.ts`). The seed
pre-generates a valid DHIS2 UID per item and supplies it when creating
dashboard items. Stable ids mean:

- the seed can carry layout **and** config in one file,
- the same ids (and therefore the same datastore entries) work on every
  instance the seed is pushed to,
- the phase-2 harness can share config storage with the real dashboard.

## Seed file format

`dashboard.seed.json` at the repo root, committed:

```json
{
    "dashboard": { "name": "CHAP Widgets", "code": "CHAP_WIDGETS" },
    "items": [
        {
            "id": "cwPredChar1",
            "widget": "prediction-chart",
            "layout": { "x": 0, "y": 0, "w": 29, "h": 24 },
            "config": {
                "version": 1,
                "widget": "chap-widget-prediction-chart",
                "predictionId": 3,
                "orgUnitId": "O6uvpzGd5pu"
            }
        }
    ]
}
```

- `id`: 11-char DHIS2 UID (`[A-Za-z][A-Za-z0-9]{10}`), generated once when
  the item first enters the seed, then never changed.
- `widget`: directory name under `widgets/`; maps to app key
  `chap-widget-<name>` for the `type: APP` dashboard item.
- `layout`: Dashboard app grid units (60-column grid). Defaults for
  auto-added items: `w: 20, h: 20`, placed on the next free row.
- `config`: the exact JSON stored in the datastore for this item, or `null`
  (renders as "not configured"; rule 5 guarantees this never crashes).

## Push — `pnpm seed:local` / `pnpm seed:demo`

`scripts/seed.mjs <local|demo|url> [--pull]`, reusing `deploy.mjs`'s target
resolution (local = `http://localhost:8090` admin/district; demo =
`$DHIS2_DEMO_URL` + `$D2_USERNAME`/`$D2_PASSWORD`; explicit URL supported).

1. **Auto-add**: scan `widgets/*` (excluding `_template`, same filter as
   deploy.mjs). Any widget with no seed entry is appended with a fresh UID,
   default layout on the next free row, `config: null`, and the seed file is
   rewritten. This is how new widgets automatically join the dashboard — no
   hook in `new-widget.mjs` needed.
2. **Upsert dashboard by code** `CHAP_WIDGETS`:
   `GET /api/dashboards.json?filter=code:eq:CHAP_WIDGETS`. If absent, `POST`;
   if present, `PUT`, replacing `dashboardItems` entirely with the seeded
   items (`{ id, type: "APP", appKey, x, y, w, h }`). Sharing: public read,
   so demo visitors can view it.
3. **Write configs**: for each item with non-null config, create-or-update
   `dataStore/chap-widgets/<id>` (POST on 404, PUT otherwise).

Semantics:

- Idempotent — pushing twice converges to the same state.
- **Push overwrites the live seed-owned dashboard** (layout and configs).
  Manual changes made on it are lost unless pulled first. The existing
  "Test" dashboard (`OHOPHFFLD2N`) is never touched; it remains the manual
  sandbox.
- Fails fast with a clear message on unreachable instance / bad credentials;
  per-item config write failures are reported in a summary (same style as
  deploy.mjs) and exit non-zero.

## Pull — `pnpm seed:pull [local|demo|url]` (default: local)

The inverse. Read the live dashboard by code with
`dashboardItems[id,type,appKey,x,y,w,h]`, read each item's datastore entry,
and rewrite `dashboard.seed.json`:

- Item ids from the live dashboard are preserved into the seed.
- Items whose `appKey` doesn't match a `chap-widget-<name>` directory under
  `widgets/` are warned about and skipped (the seed stays widgets-only).
- Missing datastore entries become `config: null`.
- Output is deterministically ordered/formatted so diffs are reviewable.

Workflow: arrange + configure on the real local dashboard → `pnpm seed:pull`
→ review the git diff → commit → CI pushes the identical dashboard to demo.

## Seed validation

`seed.mjs` structurally validates the file before acting (object shape, UID
pattern, unique ids, unique widget names, integer layout values within the
60-column grid) and exits with a pointed error message on violations. No
runtime dependency needed — plain checks in the script, consistent with the
other dependency-free `scripts/*.mjs`.

## CI

In `.github/workflows/ci.yml`, deploy-demo job: run `pnpm seed:demo`
immediately after `pnpm deploy:demo` (under the same `DHIS2_DEMO_URL` guard).
Every merge to main deploys all widgets and refreshes the demo dashboard,
including newly added widgets.

## Verification (phase 1 acceptance)

No script test infra exists; verification is a live round-trip against
localhost:8090:

1. `pnpm seed:local` — dashboard "CHAP Widgets" exists with all widgets
   placed and configured items rendering data (browser check).
2. Nudge one item's position/size in dashboard edit mode, save.
3. `pnpm seed:pull` — the git diff shows exactly that nudge.
4. `pnpm seed:local` again, then `pnpm seed:pull` — no diff (convergence).

## Known limitations / future work

- **Per-instance config values**: configs reference CHAP data ids
  (`predictionId`, backtest ids…) that may differ between local and demo
  chap-core. Phase 1 ships one config per item; if this bites, add optional
  per-target overrides (`configOverrides: { demo: {...} }`) later.
- **Phase 2 — board harness** (own design round after phase 1 is verified):
  `apps/board`, a d2 app that globs every widget's `Plugin.tsx`, renders
  them with `react-grid-layout` using the Dashboard app's grid constants,
  seeded from `dashboard.seed.json` with the same item ids (configs saved
  there are the real configs), and writes drag/resize results back into the
  seed file via a small Vite dev-middleware endpoint.
- **No cleanup on removal**: removing an item from the seed leaves its
  `dataStore/chap-widgets/<id>` entry behind on instances it was pushed to
  (no cleanup yet).
