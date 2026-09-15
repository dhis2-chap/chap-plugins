# CHAP · Outbreak Alerts

<!--
WIDGET CONTRACT — keep this section accurate; it is what humans and AI agents
read to understand the widget without reading the code.
-->

## What it shows

A ranked table of the org units in a CHAP prediction, ordered by how far their
forecast rises above **their own endemic threshold**: red when the predicted
median crosses it, "possible" when only the 90th percentile does. Each row is
the worst period of the forecast window for that org unit, with the predicted
cases, the multiple of the threshold they represent, and the threshold itself.
A decision-maker view rather than a chart.

Ranking on the multiple rather than on raw case counts is the point of a
per-org-unit threshold — a small district 3× over its baseline outranks a big
one that is merely busy. An org unit with too little history gets no threshold
and says so, rather than being silently reported as safe.

Thresholds come from CHAP's threshold endpoint using the **same strategies and
defaults as the modeling app** (seasonal mean + 2σ by default, or the WHO
endemic-channel percentile band), computed from the prediction's own dataset
history — so the table agrees with the outbreak map and with the modeling app's
prediction charts.

The widget follows the most recently created prediction by default and checks
for a newer one every five minutes. Configure a specific `predictionId` to pin
it to that prediction instead.

## Config schema (`src/config.ts`)

| field          | type                | meaning                                         |
| -------------- | ------------------- | ----------------------------------------------- |
| `version`      | `1`                 | config schema version                           |
| `widget`       | literal             | widget discriminator                            |
| `title`        | `string?`           | dashboard item title override                   |
| `predictionId` | `number?`           | pinned prediction; unset follows latest         |
| `threshold`    | discriminated union | endemic-threshold strategy + params (see below) |

`threshold` is `ThresholdParamsSchema` from `@chap-widgets/shared`, shared with
outbreak-map and mirroring the modeling app's `ThresholdParams`:

| strategy       | fields                                                                | default             |
| -------------- | --------------------------------------------------------------------- | ------------------- |
| `'seasonal'`   | `stdMultiplier: number` — σ above the seasonal mean                   | `2`                 |
| `'percentile'` | `quantile: [lower, upper]` fractions, `baselineYears: number \| null` | `[0.25, 0.75]`, `5` |

Only the **upper** line is the alert threshold; the lower one is kept so the
params match the modeling app's endemic-channel band one-for-one.

## CHAP endpoints used

- `GET /v1/crud/predictions` — prediction dropdown, latest-prediction resolution, and the prediction's dataset
- `GET /v1/analytics/prediction-entry/{predictionId}?quantiles=0.5,0.9` — forecasts for **all** org units
- `POST /v1/analytics/thresholds` — one endemic threshold per (org unit, period) from the prediction's dataset history

## Files

- `src/Plugin.tsx` — dashboard entrypoint: providers + `WidgetShell` wiring (rarely needs edits)
- `src/config.ts` — zod config schema
- `src/ConfigForm.tsx` — edit-mode form (prediction + threshold strategy)
- `src/alerts.ts` — pure ranking of forecasts against their thresholds (unit-tested)
- `src/WidgetView.tsx` — view-mode ranked alert table
- `src/App.tsx` — standalone dev harness for `pnpm start` (not shown on dashboards)

The threshold strategy picker itself is `ThresholdParamsFields` from
`@chap-widgets/shared`, shared with outbreak-map.

## Commands

```sh
pnpm --filter @chap-widgets/outbreak-alerts start    # dev server against localhost:8090
pnpm deploy:local outbreak-alerts                     # build + install on the local instance
```
