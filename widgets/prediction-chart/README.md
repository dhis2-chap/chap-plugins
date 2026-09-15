# CHAP · Prediction Chart

<!--
WIDGET CONTRACT — keep this section accurate; it is what humans and AI agents
read to understand the widget without reading the code.
-->

## What it shows

A prediction fan chart for one org unit: recent observed cases, the CHAP
model's median forecast, and its 50%/80% prediction interval bands. The
dashboard equivalent of the modeling app's prediction result view.

With `predictionId: 'latest'` the widget renders whichever prediction CHAP ran
most recently and re-checks every five minutes, so a dashboard left open picks
up new runs on its own. Pin it to an id to hold it on one prediction.

## Config schema (`src/config.ts`)

| field          | type                 | meaning                                              |
| -------------- | -------------------- | ---------------------------------------------------- |
| `version`      | `1`                  | config schema version                                |
| `widget`       | literal              | widget discriminator                                 |
| `title`        | `string?`            | dashboard item title override                        |
| `predictionId` | `'latest' \| number` | `'latest'` follows the newest run; a number pins one |
| `orgUnitId`    | `string`             | org unit to plot                                     |
| `orgUnitName`  | `string?`            | display-name snapshot taken at config time           |

`predictionId` is `PredictionSelectionSchema` from `@chap-widgets/shared`, the
same field every prediction-backed widget uses.

## CHAP endpoints used

- `GET /v1/crud/predictions` — prediction dropdown, and resolving `predictionId` to the run's name + dataset
- `GET /v1/analytics/prediction-entry/{predictionId}?quantiles=0.1,0.25,0.5,0.75,0.9` — forecast quantiles
- `GET /v1/analytics/actual-cases/{datasetId}?isDatasetId=true` — observed case history

## Files

- `src/Plugin.tsx` — dashboard entrypoint: providers + `WidgetShell` wiring (rarely needs edits)
- `src/config.ts` — zod config schema
- `src/ConfigForm.tsx` — edit-mode form (prediction + org unit pickers)
- `src/WidgetView.tsx` — view-mode fan chart
- `src/App.tsx` — standalone dev harness for `pnpm start` (not shown on dashboards)

## Commands

```sh
pnpm --filter @chap-widgets/prediction-chart start    # dev server against localhost:8090
pnpm deploy:local prediction-chart                     # build + install on the local instance
```
