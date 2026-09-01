# chap-widgets

A playground of DHIS2 **dashboard widgets** for [CHAP](https://github.com/dhis2-chap):
small dashboard plugins that put CHAP predictions, evaluations, and system
status directly on DHIS2 dashboards.

Each widget under `widgets/` is a full DHIS2 app with a `DASHBOARD` plugin
entrypoint. They all share one structure (copied from `widgets/_template`)
and one shared package (`packages/shared`) that is bundled into each
widget's zip at build time — so every widget can be installed on an instance
individually or in bulk.

## Widgets

| widget               | shows                                                                      |
| -------------------- | -------------------------------------------------------------------------- |
| `prediction-chart`   | Forecast fan chart (median + 50%/80% intervals + actuals) for one org unit |
| `evaluation-compare` | Backtest: predicted intervals vs observed actuals for one split            |
| `outbreak-alerts`    | Org units ranked by peak forecast, flagged against a threshold             |
| `model-status`       | Recent CHAP jobs, configured models, chap-core version                     |

## Quick start

```sh
pnpm install
pnpm verify                 # typecheck + lint + build all widgets
pnpm deploy:local           # build + install every widget on http://localhost:8090 (admin/district)
pnpm deploy:local model-status   # …or just one
```

Then open the Dashboard app, edit a dashboard, and add items — the widgets
appear in the item picker as **CHAP · <Name>**. Configure the item while the
dashboard is in edit mode; the config is stored per dashboard item.

Or skip the manual setup: `pnpm seed:local` pushes `dashboard.seed.json` to
create/update a ready-made "CHAP Widgets" dashboard with every widget already
laid out and configured. To change its layout, arrange it on the real
dashboard, run `pnpm seed:pull` to capture that back into
`dashboard.seed.json`, then commit and push — the next CI run reproduces it
on the demo instance.

For layout work there's also a local board: `pnpm board` renders every
widget on one drag/resize grid straight from source (no deploy needed) and
autosaves the arrangement — plus each widget's live config — back into
`dashboard.seed.json`.

Widgets fetch data from chap-core through the instance's DHIS2 route
(`/api/routes/chap/run`), which the CHAP Modeling App's settings create. If
the route or backend is missing, widgets show a friendly notice instead.

## Creating a new widget

```sh
pnpm new-widget my-widget
```

This copies `widgets/_template` (a working widget) and renames everything.
Implement three files: `src/config.ts` (zod config schema),
`src/ConfigForm.tsx` (dashboard edit mode), `src/WidgetView.tsx` (view mode).
See `CLAUDE.md` for the full conventions and each widget's `README.md` for
its contract.

## Deployment

- **Local**: `pnpm deploy:local [name…]` → `http://localhost:8090`.
- **Demo**: every push to `main` builds and deploys **all** widgets to the
  demo instance via GitHub Actions. Set the repository variable
  `DHIS2_DEMO_URL` and the secrets `DHIS2_DEMO_USERNAME` /
  `DHIS2_DEMO_PASSWORD` to enable it; until then the deploy step skips with
  a notice. Manually: `DHIS2_DEMO_URL=… D2_USERNAME=… D2_PASSWORD=… pnpm deploy:demo`.
