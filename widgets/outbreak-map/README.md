# CHAP · Outbreak Map

<!--
WIDGET CONTRACT — keep this section accurate; it is what humans and AI agents
read to understand the widget without reading the code.
-->

## What it shows

A MapLibre GL map of a CHAP prediction's org units colored by how far their
forecast sits **above the endemic threshold**: red where the predicted median
crosses the threshold, deepening with the multiple by which it does
(1–1.25×, 1.25–1.5×, 1.5–2×, 2–3×, ≥3×). Amber marks an org unit whose median
stays under but whose 90th percentile crosses — "possible" — and the greys are
off the red ramp entirely, so only a real exceedance reads as an alert. A
period stepper flips through the forecast window; the header counts the org
units above threshold in the shown period and names the threshold definition
in use.

Class breaks are **fixed multiples of the threshold**, not derived from the
data, so the legend means the same thing on every period, prediction and
dashboard. Because each org unit is compared against its own threshold, a
low-endemic district 3× over reads as urgently as a high-endemic one.

Thresholds come from CHAP's threshold endpoint using the **same strategies and
defaults as the modeling app** (seasonal mean + 2σ by default, or the WHO
endemic-channel percentile band), computed from the prediction's own dataset
history for exactly the periods and org units on the map. An org unit with too
little history gets no threshold and is drawn in the "no threshold" grey rather
than being silently reported as safe. By default the widget follows the
**latest** prediction (most recent `created`); a specific prediction can be
pinned instead.

Hovering an org unit gives its status, predicted cases with the multiple of the
threshold, the 80% prediction interval and the threshold value itself. Org units
without geometry in DHIS2 are omitted; when all predicted org units share a
geometry-bearing ancestor it is drawn as neutral context and the viewport fits
to it.

## Config schema (`src/config.ts`)

| field          | type                       | meaning                                              |
| -------------- | -------------------------- | ---------------------------------------------------- |
| `version`      | `1`                        | config schema version                                |
| `widget`       | literal                    | widget discriminator                                 |
| `title`        | `string?`                  | dashboard item title override                        |
| `predictionId` | `'latest' \| number`       | `'latest'` follows the newest run; a number pins one |
| `showBasemap`  | `boolean` (default `true`) | OpenStreetMap raster tiles under the choropleth      |
| `threshold`    | discriminated union        | endemic-threshold strategy + params (see below)      |

`threshold` is `ThresholdParamsSchema` from `@chap-widgets/shared`, shared with
outbreak-alerts and mirroring the modeling app's `ThresholdParams`, so identical
values produce identical thresholds in all three places:

| strategy       | fields                                                                | default             |
| -------------- | --------------------------------------------------------------------- | ------------------- |
| `'seasonal'`   | `stdMultiplier: number` — σ above the seasonal mean                   | `2`                 |
| `'percentile'` | `quantile: [lower, upper]` fractions, `baselineYears: number \| null` | `[0.25, 0.75]`, `5` |

Only the **upper** line is the alert threshold; the lower one is kept so the
params match the modeling app's endemic-channel band one-for-one. Which line is
upper is read from the params the response echoes back, never from the request.

## CHAP endpoints used

- `GET /v1/crud/predictions` — prediction dropdown in the config form + resolving `'latest'` in the view
- `GET /v1/analytics/prediction-entry/{predictionId}?quantiles=0.1,0.25,0.5,0.75,0.9` — forecast quantiles for all org units
- `POST /v1/analytics/thresholds` — one endemic threshold per (org unit, period) from the prediction's dataset history

Org unit geometry comes from the DHIS2 metadata API
(`organisationUnits?fields=id,displayName,geometry,ancestors[…]` via
`useOrgUnitGeometryContext` in `@chap-widgets/shared`), not from CHAP.

## Files

- `src/Plugin.tsx` — dashboard entrypoint: providers + `WidgetShell` wiring (rarely needs edits)
- `src/config.ts` — zod config schema
- `src/ConfigForm.tsx` — edit-mode form (prediction picker, threshold strategy + params, basemap toggle)
- `src/exceedance.ts` — pure classification of a forecast against its threshold (unit-tested)
- `src/WidgetView.tsx` — view-mode map (palette, legend, popup, period stepper)
- `src/App.tsx` — standalone dev harness for `pnpm start` (not shown on dashboards)

The map itself — layers, hover popup, viewport fitting — is
`ChoroplethMap` from `@chap-widgets/shared/maps`, shared with prediction-map.
The threshold strategy picker is `ThresholdParamsFields` from
`@chap-widgets/shared`, shared with outbreak-alerts.

## Commands

```sh
pnpm --filter @chap-widgets/outbreak-map start    # dev server against localhost:8090
pnpm deploy:local outbreak-map                    # build + install on the local instance
```
