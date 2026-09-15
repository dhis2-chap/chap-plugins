# CHAP · Prediction Chart

<!--
WIDGET CONTRACT — keep this section accurate; it is what humans and AI agents
read to understand the widget without reading the code.
-->

## What it shows

A prediction fan chart for one org unit: recent observed cases, the CHAP
model's median forecast, and its 50%/80% prediction interval bands. The
dashboard equivalent of the modeling app's prediction result view.

The widget follows the most recently created prediction by default and checks
for a newer one every five minutes. Configure a specific `predictionId` to pin
it to that prediction instead.

## Config schema (`src/config.ts`)

| field          | type      | meaning                                      |
| -------------- | --------- | -------------------------------------------- |
| `version`      | `1`       | config schema version                        |
| `widget`       | literal   | widget discriminator                         |
| `title`        | `string?` | dashboard item title override                |
| `predictionId` | `number?` | pinned CHAP prediction; unset follows latest |
| `orgUnitId`    | `string`  | org unit to plot                             |
| `orgUnitName`  | `string?` | display-name snapshot taken at config time   |

## CHAP endpoints used

- `GET /v1/crud/predictions` — prediction dropdown and latest-prediction resolution
- `GET /v1/crud/predictions/{predictionId}` — prediction metadata (name, datasetId)
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
