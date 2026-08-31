# chap-widgets

Playground monorepo of DHIS2 **dashboard plugins** ("widgets") that visualize
CHAP predictions. Every widget is an identical-structured DHIS2 app that
builds to its own self-contained zip and appears as a dashboard item.

## Repo map

```
packages/shared/        @chap-widgets/shared — source-only, bundled into each widget at build time
  src/chap-api/         GENERATED OpenAPI client for chap-core — NEVER edit by hand (pnpm regen-api)
  src/chap/             ChapProvider (points the client at /api/routes/chap/run) + ChapGuard (backend health gate)
  src/config/           useDashboardItemConfig — per-dashboard-item config in datastore ns `chap-widgets`
  src/plugin/           WidgetShell (edit/view/unconfigured state machine), DashboardPluginProps
  src/charts/           FanChart + quantile/period helpers
  src/dhis2/            useOrgUnitNames
widgets/_template/      The widget blueprint — `pnpm new-widget <name>` copies it
widgets/<name>/         One dashboard widget each; see the WIDGET CONTRACT in its README.md
scripts/                new-widget.mjs, deploy.mjs, regen-api.mjs
```

## Commands

```sh
pnpm new-widget <name>              # scaffold widgets/<name> from _template
pnpm verify                         # typecheck + lint + build everything — run before claiming success
pnpm --filter @chap-widgets/<name> start   # dev server for one widget
pnpm deploy:local [name…]           # build + install on http://localhost:8090 (admin/district)
pnpm deploy:demo  [name…]           # build + install on $DHIS2_DEMO_URL ($D2_USERNAME/$D2_PASSWORD)
pnpm regen-api [openapi-url]        # regenerate packages/shared/src/chap-api (default http://localhost:8000/openapi.json)
```

CI (`.github/workflows/ci.yml`) runs `pnpm verify` on PRs; pushes to `main`
additionally deploy every widget to the demo instance (repo variable
`DHIS2_DEMO_URL` + secrets `DHIS2_DEMO_USERNAME`/`DHIS2_DEMO_PASSWORD`;
skipped with a notice until those are set).

## The rules

1. **Every widget is a copy of `widgets/_template`** — same files, same
   structure. Create widgets with `pnpm new-widget`, never by hand-rolling a
   different layout. A widget's own logic lives in exactly three files:
   `src/config.ts` (zod schema), `src/ConfigForm.tsx` (edit mode),
   `src/WidgetView.tsx` (view mode). `src/Plugin.tsx` is wiring and rarely
   changes; `src/App.tsx` is the `pnpm start` dev harness.
2. **Never edit `packages/shared/src/chap-api/`** — it's generated. To update
   it, run `pnpm regen-api` against a running chap-core.
3. **Keep each widget's README WIDGET CONTRACT accurate** (what it shows,
   config schema, CHAP endpoints used). It's the spec of record.
4. **Data comes from the CHAP route API** (`{baseUrl}/api/routes/chap/run`)
   via the generated `*Service` classes inside TanStack Query. `ChapProvider`
   must wrap anything that calls them (the template already does);
   `ChapGuard` shows a friendly card when the route/backend is missing —
   don't add per-widget reachability handling.
5. **Widget config is per dashboard item**: one datastore entry
   `dataStore/chap-widgets/<dashboardItemId>`, validated by the widget's zod
   schema. Invalid/missing config renders as "not configured", never crashes.
6. **Shared code changes affect all widgets** — after touching
   `packages/shared`, run `pnpm verify` (it builds every widget, including
   the template).

## Local dev loop

The local DHIS2 instance is `http://localhost:8090` (admin/district), with
the chap route + chap-core expected to be running behind it. The "Test"
dashboard (id `OHOPHFFLD2N`) is where widgets are tried out: deploy with
`pnpm deploy:local <name>`, then add the widget as a dashboard item (they
show up in the item picker as "CHAP · <Name>"), configure it in dashboard
edit mode, save, and check view mode.

`pnpm --filter @chap-widgets/<name> start` serves the widget standalone with
a mode-toggle harness — good for iterating on forms/views without deploying,
but final verification happens on a real dashboard.

## DHIS2/CHAP specifics worth knowing

- Dashboard plugins receive `DashboardPluginProps` (`dashboardItemId`,
  `dashboardMode: 'view' | 'edit' | 'print'`, `setDashboardItemDetails`, …).
  `WidgetShell` handles all of that.
- The Route API 503s under concurrent load; the generated client has a
  p-queue throttle and `ChapProvider` installs the retry policy. Don't fight
  it with custom retries.
- Standard quantiles everywhere: `[0.1, 0.25, 0.5, 0.75, 0.9]`
  (`STANDARD_QUANTILES`). The fan chart maps 0.25/0.75 → 50% band,
  0.1/0.9 → 80% band.
- Prefer the kebab-case `getActualCasesAlias…` endpoint over the deprecated
  camelCase `getActualCases…`.
- Reference implementations live in the sibling repo
  `../chap-frontend` (`apps/uncertainty-dashboard-plugin`, `apps/modeling-app`).
