# CHAP · Model Status

<!--
WIDGET CONTRACT — keep this section accurate; it is what humans and AI agents
read to understand the widget without reading the code.
-->

## What it shows

An operational overview of the CHAP backend: the most recent jobs with their
status (auto-refreshing every 30s), plus the running chap-core version in the
footer. Useful on a demo/ops dashboard to see the system is alive.

A corner button opens the modeling app's **Jobs** page in a new tab — the full
version of this same list. It appears only when the modeling app is installed
on the instance.

## Config schema (`src/config.ts`)

| field      | type      | meaning                          |
| ---------- | --------- | -------------------------------- |
| `version`  | `1`       | config schema version            |
| `widget`   | literal   | widget discriminator             |
| `title`    | `string?` | dashboard item title override    |
| `jobLimit` | `number`  | how many recent jobs to list (8) |

## CHAP endpoints used

- `GET /v1/jobs` — recent jobs with status
- `GET /system/info` — chap-core version footer

## Files

- `src/Plugin.tsx` — dashboard entrypoint: providers + `WidgetShell` wiring (rarely needs edits)
- `src/config.ts` — zod config schema
- `src/ConfigForm.tsx` — edit-mode form (job limit)
- `src/WidgetView.tsx` — view-mode recent-jobs table
- `src/App.tsx` — standalone dev harness for `pnpm start` (not shown on dashboards)

## Commands

```sh
pnpm --filter @chap-widgets/model-status start    # dev server against localhost:8090
pnpm deploy:local model-status                     # build + install on the local instance
```
