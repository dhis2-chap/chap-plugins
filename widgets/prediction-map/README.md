# CHAP · Prediction Map

<!--
WIDGET CONTRACT — keep this section accurate; it is what humans and AI agents
read to understand the widget without reading the code.
-->

## What it shows

A MapLibre GL choropleth of a CHAP prediction: every org unit in the
prediction colored by its median predicted case count, with a period stepper
to flip through the forecasted periods and a hover popup showing the median
and 80% prediction interval. By default it follows the **latest** prediction
(most recent `created`), so the dashboard item always shows the last run —
a specific prediction can be pinned instead.

Class breaks are quantile-based over the medians of _all_ forecast periods,
so colors stay comparable while stepping through periods. Org units without
geometry in DHIS2 are omitted; org units without a value for the shown
period render in the "No data" gray.

When all predicted org units share a geometry-bearing ancestor, the map draws
that ancestor as a neutral geographic context and fits the viewport to it. A
partial-country prediction therefore stays visibly located within its country
instead of being presented as an isolated cluster. The ancestor's DHIS2
`displayName` is shown on the map.

## Config schema (`src/config.ts`)

| field          | type                       | meaning                                              |
| -------------- | -------------------------- | ---------------------------------------------------- |
| `version`      | `1`                        | config schema version                                |
| `widget`       | literal                    | widget discriminator                                 |
| `title`        | `string?`                  | dashboard item title override                        |
| `predictionId` | `'latest' \| number`       | `'latest'` follows the newest run; a number pins one |
| `showBasemap`  | `boolean` (default `true`) | OpenStreetMap raster tiles under the choropleth      |

`predictionId` is `PredictionSelectionSchema` from `@chap-widgets/shared`, the
same field every prediction-backed widget uses.

## CHAP endpoints used

- `GET /v1/crud/predictions` — prediction dropdown in the config form + resolving `predictionId` in the view
- `GET /v1/analytics/prediction-entry/{predictionId}?quantiles=0.1,0.25,0.5,0.75,0.9` — forecast quantiles for all org units

Org unit geometry comes from the DHIS2 metadata API
(`organisationUnits?fields=id,displayName,geometry,ancestors[…]` via
`useOrgUnitGeometryContext` in `@chap-widgets/shared`), not from CHAP.

## Files

- `src/Plugin.tsx` — dashboard entrypoint: providers + `WidgetShell` wiring (rarely needs edits)
- `src/config.ts` — zod config schema
- `src/ConfigForm.tsx` — edit-mode form (prediction picker, basemap toggle)
- `src/WidgetView.tsx` — view-mode MapLibre choropleth (map, scale, legend, period stepper)
- `src/App.tsx` — standalone dev harness for `pnpm start` (not shown on dashboards)

## Commands

```sh
pnpm --filter @chap-widgets/prediction-map start    # dev server against localhost:8090
pnpm deploy:local prediction-map                    # build + install on the local instance
```
