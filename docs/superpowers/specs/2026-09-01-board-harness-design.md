# Board harness (dashboard seeding phase 2)

**Date:** 2026-09-01
**Status:** Approved
**Builds on:** `2026-09-01-dashboard-seed-design.md` (phase 1, shipped)

## Problem

Iterating on widget layout and config means deploying, arranging items in the
real Dashboard app, and running `pnpm seed:pull` — a slow loop. The per-widget
`pnpm start` harness shows only one widget at a time with a throwaway item id,
so its saved configs never match the real dashboard. There is no way to see
every widget at once against live data, drag them into place, and have
`dashboard.seed.json` stay current.

## Solution overview

`apps/board` — a local-only d2 app that renders **every widget's `Plugin.tsx`
from source** on one `react-grid-layout` page using the Dashboard app's exact
grid constants. Items come from `dashboard.seed.json` and keep their seed ids,
so each plugin reads and writes the **real**
`dataStore/chap-widgets/<id>` entry — config edits in the board are
immediately live on the real "CHAP Widgets" dashboard and vice versa.
Drag/resize autosaves back into `dashboard.seed.json` through a small Vite
dev-middleware endpoint; each save also captures every item's current
datastore config into the seed, so after a board session the file is fully
current: review the diff, commit, and `pnpm seed:demo` reproduces it.

Decisions from the design round: **saves capture layout + configs** (not
layout only, which would leave the seed's config fields stale and make a later
`seed:pull` clobber board-made layout), and **saves are debounced autosaves**
(the seed is committed, so git is the undo).

## Components

### Workspace wiring

- Add `apps/*` to `pnpm-workspace.yaml` `packages`.
- `apps/board`: package `@chap-widgets/board`, private. Scripts: `start`
  (`d2-app-scripts start`), `tsc:check`. **No `build` script** — the board is
  a dev tool, never built or deployed (root `build` already filters
  `./widgets/**`; `deploy.mjs` discovers `widgets/` only).
- `d2.config.js`: `type: 'app'`, name `chap-board`, app entrypoint only (no
  `pluginType`), `viteConfigExtensions: './vite.config.mts'`.
- Root convenience script: `"board": "pnpm --filter @chap-widgets/board start"`.
- New deps in `apps/board`: `react-grid-layout` (+ `@types/react-grid-layout`),
  plus the same runtime deps the template carries (the glob-imported plugins
  resolve their imports through the board's module graph).
- `pnpm verify` covers the board via the recursive `tsc:check`, repo-wide
  lint, and the root test run.

### Vite dev middleware (`viteConfigExtensions` plugin)

A Vite plugin in `apps/board` registers two dev-server routes. It imports the
existing script libs (`scripts/lib/seed-core.mjs`, `widgets.mjs`,
`targets.mjs`) — plain ESM, fine from Node vite config context.

- **`GET /__board/seed`** — read + `validateSeed` the seed from the repo
  root, run `discoverWidgets` + `autoAddWidgets` (persisting the file if
  anything was added, same as push does), respond `{ seed }`. New widgets
  therefore appear on the board on next dev-server load with no extra step.
- **`PUT /__board/seed`** — body `{ layouts: [{ id, x, y, w, h }] }`.
    1. Apply layouts via a new pure `applyBoardLayout(seed, layouts)` in
       `seed-core.mjs` (unknown ids are an error).
    2. **Config capture**: for each item, `GET
dataStore/chap-widgets/<id>` against the `local` target
       (`resolveTarget('local')`, basic auth). 200 → that JSON becomes the
       item's seed config; 404 → `null`. Any other failure keeps the item's
       previous seed config and adds a warning to the response — a flaky
       instance must not block a layout save.
    3. `validateSeed`, `serializeSeed`, write `dashboard.seed.json`.
    4. Respond `{ seed, warnings }`.

Pure seed transforms (`applyBoardLayout`, config-merge helper if one falls
out) live in `scripts/lib/seed-core.mjs` with unit tests in
`seed-core.test.mjs`, covered by root `pnpm test`. The Vite plugin itself
stays a thin HTTP/fs/fetch shell, verified live.

### Board UI (`apps/board/src`)

- The d2 app shell provides login + `DataProvider` against
  `http://localhost:8090`, exactly like each widget's `pnpm start`. The seed
  endpoints are fetched from the dev-server origin with plain `fetch`.
- **Plugin discovery**: `import.meta.glob('../../../widgets/*/src/Plugin.tsx')`
  with `React.lazy` per module; widget name parsed from the path. The seed's
  items decide what renders; an item whose widget has no plugin module gets a
  placeholder card. Vite `server.fs.allow` opens the workspace root (same as
  the template's vite config).
- **Grid**: `react-grid-layout` `WidthProvider(GridLayout)` mirroring
  dashboard-app `src/modules/gridUtil.js`: 60 columns, `rowHeight` 16px,
  `margin [4, 4]`, `containerPadding [0, 0]`, `compactType 'vertical'`, item
  constraints `minH 4`, `maxH 34`, `maxW 59`. Constants live in one
  `gridConstants.ts` with a comment naming the dashboard-app source file.
- **Items**: each grid item has a small header bar — the RGL
  `draggableHandle`, so widget content stays fully interactive — showing the
  item title (fed by the plugin via `setDashboardItemDetails`, falling back
  to the widget name) and a per-item **view/edit toggle** that switches the
  `dashboardMode` prop passed to that plugin. Body renders the lazy Plugin in
  `Suspense` with `{ dashboardItemId: item.id, dashboardMode,
dashboardItemFilters: {} }`.
- **Autosave**: `onLayoutChange` → diff against the last-saved layout (RGL
  fires on mount and compaction, so no-op changes are dropped) → debounce
  (~800 ms) → `PUT /__board/seed`. A top bar shows the board title, a
  saved/saving/failed indicator, and a **"Sync seed"** button that forces a
  PUT with the current layout — the way to capture a config-only change
  (saving a ConfigForm doesn't move any item, so no autosave fires) without
  nudging an item.

## Data flow

```
boot:  seed file ──autoAddWidgets──▶ GET /__board/seed ──▶ RGL items ──▶ lazy Plugin(id, mode)
config: Plugin ⇄ dataStore/chap-widgets/<id> on localhost:8090 (shared with real dashboard)
save:  drag/resize ──debounce──▶ PUT /__board/seed
         layouts (browser) + configs (datastore GETs) ──▶ validate ──▶ dashboard.seed.json
commit → pnpm seed:demo reproduces the board state anywhere
```

## Error handling

- Seed file invalid at boot → `GET /__board/seed` returns the
  `validateSeed` message; the board renders it full-page instead of a grid.
- PUT with unknown item ids or layout that fails `validateSeed` → 400 with
  the message; the file is left untouched; the UI shows "save failed".
- Datastore unreachable during config capture → layout still saves, previous
  configs are kept, warnings surface in the top bar.
- DHIS2 down entirely → the app shell/login fails the same way widget
  `pnpm start` does; nothing board-specific to add.

## Testing

- `applyBoardLayout` (and any config-merge helper): unit tests in
  `scripts/lib/seed-core.test.mjs`, run by root `pnpm test` / `pnpm verify`.
- No React component test infra exists in the repo (widgets have none);
  parity kept — the UI is verified live.
- Live acceptance on localhost:8090:
    1. `pnpm board` → all four widgets render; model-status (configured in the
       seed) shows data.
    2. Drag + resize one item → `git diff dashboard.seed.json` shows exactly
       that layout change; `pnpm seed:local` then shows the same arrangement on
       the real dashboard.
    3. Configure a widget via its edit toggle → the real dashboard item shows
       the new config (shared datastore); "Sync seed" captures it into the
       seed file.
    4. `pnpm seed:pull` after a board save produces no layout surprises when
       the live dashboard was pushed from the same seed (convergence).
    5. `pnpm verify` green.

## Known limitations / future work

- **Local target only.** The board edits the seed and talks to
  `localhost:8090`; demo stays a push target.
- **No add/remove-item UI.** New widgets join via auto-add on boot; removing
  an item is a manual seed edit (and inherits phase 1's no-datastore-cleanup
  limitation).
- **Config capture rides saves.** Datastore changes reach the seed on the
  next autosave or "Sync seed" click; there is no datastore watcher.
- **Vertical compaction moves neighbours** — identical to the real Dashboard
  app, but a one-item nudge can therefore produce a multi-item seed diff.
