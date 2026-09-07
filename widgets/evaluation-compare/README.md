# CHAP · Evaluation Compare

<!--
WIDGET CONTRACT — keep this section accurate; it is what humans and AI agents
read to understand the widget without reading the code.
-->

## What it shows

Model skill at a glance: for one backtest (evaluation) and one org unit, the
predicted median and 50%/80% interval bands overlaid with what actually
happened. The dashboard equivalent of the modeling app's evaluation comparison
plot.

A slider under the chart walks the forecast window along the series, one
train/test split at a time, so you can watch each forecast land against the
observed cases. Every split is fetched in one request and sliced client-side,
so dragging costs no round-trips. The scrub position is view state only — it
starts at `splitPeriod` and is never written back to the datastore, since
dashboard viewers don't own the item's config. The y-axis is pinned across all
splits so only the data moves while scrubbing. The slider is hidden when the
backtest has just one split.

## Config schema (`src/config.ts`)

| field         | type      | meaning                                            |
| ------------- | --------- | -------------------------------------------------- |
| `version`     | `1`       | config schema version                              |
| `widget`      | literal   | widget discriminator                               |
| `title`       | `string?` | dashboard item title override                      |
| `backtestId`  | `number`  | CHAP backtest (evaluation) to plot                 |
| `orgUnitId`   | `string`  | org unit to plot                                   |
| `orgUnitName` | `string?` | display-name snapshot taken at config time         |
| `splitPeriod` | `string?` | split the slider starts on; unset = the last split |

## CHAP endpoints used

- `GET /v1/crud/backtests` — backtest dropdown in the config form
- `GET /v1/crud/backtests/{backtestId}` — backtest metadata (name, splitPeriods)
- `GET /v1/analytics/evaluation-entry?backtestId=…&quantiles=…&orgUnits=…` — predicted quantiles for **every** split (no `splitPeriod` filter, so the slider needs no refetch)
- `GET /v1/analytics/actual-cases/{backtestId}?orgUnits=…` — observed cases

## Files

- `src/Plugin.tsx` — dashboard entrypoint: providers + `WidgetShell` wiring (rarely needs edits)
- `src/config.ts` — zod config schema
- `src/ConfigForm.tsx` — edit-mode form (backtest + org unit + split pickers)
- `src/WidgetView.tsx` — view-mode comparison chart + split scrubbing
- `src/SplitPeriodSlider.tsx` — the forecast-window slider under the chart
- `src/App.tsx` — standalone dev harness for `pnpm start` (not shown on dashboards)

## Commands

```sh
pnpm --filter @chap-widgets/evaluation-compare start    # dev server against localhost:8090
pnpm deploy:local evaluation-compare                     # build + install on the local instance
```
