# CHAP · Outbreak Alerts

<!--
WIDGET CONTRACT — keep this section accurate; it is what humans and AI agents
read to understand the widget without reading the code.
-->

## What it shows

A ranked table of the org units in a CHAP prediction, ordered by their peak
forecasted case count, with an alert status per org unit: red when the
predicted median crosses the configured threshold, "possible" when only the
90th percentile crosses it. A decision-maker view rather than a chart.

## Config schema (`src/config.ts`)

| field          | type      | meaning                                  |
| -------------- | --------- | ---------------------------------------- |
| `version`      | `1`       | config schema version                    |
| `widget`       | literal   | widget discriminator                     |
| `title`        | `string?` | dashboard item title override            |
| `predictionId` | `number`  | CHAP prediction to rank org units from   |
| `threshold`    | `number`  | predicted-cases level that raises alerts |

## CHAP endpoints used

- `GET /v1/crud/predictions` — prediction dropdown in the config form
- `GET /v1/analytics/prediction-entry/{predictionId}?quantiles=0.5,0.9` — forecasts for **all** org units

## Files

- `src/Plugin.tsx` — dashboard entrypoint: providers + `WidgetShell` wiring (rarely needs edits)
- `src/config.ts` — zod config schema
- `src/ConfigForm.tsx` — edit-mode form (prediction + threshold)
- `src/WidgetView.tsx` — view-mode ranked alert table
- `src/App.tsx` — standalone dev harness for `pnpm start` (not shown on dashboards)

## Commands

```sh
pnpm --filter @chap-widgets/outbreak-alerts start    # dev server against localhost:8090
pnpm deploy:local outbreak-alerts                     # build + install on the local instance
```
