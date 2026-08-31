# CHAP · Evaluation Compare

<!--
WIDGET CONTRACT — keep this section accurate; it is what humans and AI agents
read to understand the widget without reading the code.
-->

## What it shows

Model skill at a glance: for one backtest (evaluation), one org unit, and one
train/test split period, the predicted median and 50%/80% interval bands
overlaid with what actually happened. The dashboard equivalent of the
modeling app's evaluation comparison plot.

## Config schema (`src/config.ts`)

| field         | type      | meaning                                          |
| ------------- | --------- | ------------------------------------------------ |
| `version`     | `1`       | config schema version                            |
| `widget`      | literal   | widget discriminator                             |
| `title`       | `string?` | dashboard item title override                    |
| `backtestId`  | `number`  | CHAP backtest (evaluation) to plot               |
| `orgUnitId`   | `string`  | org unit to plot                                 |
| `orgUnitName` | `string?` | display-name snapshot taken at config time       |
| `splitPeriod` | `string?` | split to plot; unset = the backtest's last split |

## CHAP endpoints used

- `GET /v1/crud/backtests` — backtest dropdown in the config form
- `GET /v1/crud/backtests/{backtestId}` — backtest metadata (name, splitPeriods)
- `GET /v1/analytics/evaluation-entry?backtestId=…&quantiles=…&splitPeriod=…&orgUnits=…` — predicted quantiles
- `GET /v1/analytics/actual-cases/{backtestId}?orgUnits=…` — observed cases

## Files

- `src/Plugin.tsx` — dashboard entrypoint: providers + `WidgetShell` wiring (rarely needs edits)
- `src/config.ts` — zod config schema
- `src/ConfigForm.tsx` — edit-mode form (backtest + org unit + split pickers)
- `src/WidgetView.tsx` — view-mode comparison chart
- `src/App.tsx` — standalone dev harness for `pnpm start` (not shown on dashboards)

## Commands

```sh
pnpm --filter @chap-widgets/evaluation-compare start    # dev server against localhost:8090
pnpm deploy:local evaluation-compare                     # build + install on the local instance
```
