# CHAP · Template

<!--
WIDGET CONTRACT — keep this section accurate; it is what humans and AI agents
read to understand the widget without reading the code.
-->

## What it shows

Template widget. Replace this with one or two sentences describing the
visualization and the decision it supports.

## Config schema (`src/config.ts`)

| field     | type      | meaning                       |
| --------- | --------- | ----------------------------- |
| `version` | `1`       | config schema version         |
| `widget`  | literal   | widget discriminator          |
| `title`   | `string?` | dashboard item title override |

## CHAP endpoints used

- `GET /system/info` (via `useChapSystemInfo`) — chap-core version shown in the view

## Files

- `src/Plugin.tsx` — dashboard entrypoint: providers + `WidgetShell` wiring (rarely needs edits)
- `src/config.ts` — zod config schema
- `src/ConfigForm.tsx` — edit-mode form
- `src/WidgetView.tsx` — view-mode visualization
- `src/App.tsx` — standalone dev harness for `pnpm start` (not shown on dashboards)

## Commands

```sh
pnpm --filter @chap-widgets/template start    # dev server against localhost:8090
pnpm deploy:local template                     # build + install on the local instance
```
