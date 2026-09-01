# Board Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `apps/board` — a local-only d2 app rendering every widget's `Plugin.tsx` from source on one react-grid-layout page, autosaving drag/resize (plus each item's live datastore config) back into `dashboard.seed.json`.

**Architecture:** A new pnpm workspace package `apps/board` built like a widget (d2-app-scripts + `viteConfigExtensions`). A Vite dev-middleware plugin serves `GET/PUT /__board/seed`, reusing `scripts/lib/{seed-core,widgets,targets}.mjs`; two new pure transforms in `seed-core.mjs` carry the seed rewriting and are unit-tested. The React app fetches the seed, renders one grid item per seed entry with the Dashboard app's exact grid constants, and lazily mounts each widget's glob-imported Plugin with its real seed item id, so config reads/writes hit the real `dataStore/chap-widgets/<id>` entries.

**Tech Stack:** pnpm workspace, @dhis2/cli-app-scripts 12.11.1 (Vite 5), React 18, react-grid-layout 1.4, node:test.

**Spec:** `docs/superpowers/specs/2026-09-01-board-harness-design.md`

## Global Constraints

- Grid constants mirror dhis2/dashboard-app `src/modules/gridUtil.js` exactly: 60 columns, rowHeight 16px, margin [4, 4], containerPadding [0, 0], compactType 'vertical', minH 4, maxH 34, maxW 59.
- The board is never built or deployed: no `build` script in its package.json (root `build` filters `./widgets/**`; `deploy.mjs` only scans `widgets/`).
- Never edit `packages/shared/src/chap-api/` (generated).
- Formatting/lint must pass repo-wide: run `pnpm lint` (eslint + prettier check) before every commit; fix with `pnpm format`.
- Commits are authored by Edvin's git identity only — **no Co-Authored-By trailer**, never push.
- Node tests run via root `pnpm test` (`node --test 'scripts/**/*.test.mjs'` — the glob form; `node --test <dir>` breaks on Node 24).

---

### Task 1: Pure seed transforms `applyBoardLayout` + `applyCapturedConfigs`

**Files:**
- Modify: `scripts/lib/seed-core.mjs` (append after `mergePulledDashboard`)
- Test: `scripts/lib/seed-core.test.mjs` (append; match existing `test()`/`assert` style)

**Interfaces:**
- Consumes: existing seed shape `{ dashboard, items: [{ id, widget, layout: {x,y,w,h}, config }] }`.
- Produces: `applyBoardLayout(seed, layouts)` where `layouts` is `[{ id, x, y, w, h }]` → new seed (throws `Error('board layout: unknown item id "<id>"')` on unknown id; unmentioned items unchanged; input not mutated). `applyCapturedConfigs(seed, configs)` where `configs` maps item id → object | null | undefined (undefined/absent = capture failed → keep previous config) → new seed. Task 3's middleware imports both.

- [ ] **Step 1: Write the failing tests**

Append to `scripts/lib/seed-core.test.mjs` (add `applyBoardLayout`, `applyCapturedConfigs` to the import list at the top; `validSeed()` already exists in the file):

```js
test('applyBoardLayout applies layouts by item id', () => {
    const result = applyBoardLayout(validSeed(), [
        { id: 'a1234567890', x: 5, y: 10, w: 25, h: 12 },
        { id: 'b1234567890', x: 30, y: 10, w: 20, h: 12 },
    ])
    assert.deepEqual(result.items[0].layout, { x: 5, y: 10, w: 25, h: 12 })
    assert.deepEqual(result.items[1].layout, { x: 30, y: 10, w: 20, h: 12 })
    assert.deepEqual(result.items[0].config, { version: 1 })
})

test('applyBoardLayout leaves unmentioned items unchanged', () => {
    const result = applyBoardLayout(validSeed(), [
        { id: 'b1234567890', x: 0, y: 40, w: 15, h: 8 },
    ])
    assert.deepEqual(result.items[0].layout, { x: 0, y: 0, w: 29, h: 24 })
    assert.deepEqual(result.items[1].layout, { x: 0, y: 40, w: 15, h: 8 })
})

test('applyBoardLayout rejects unknown item ids', () => {
    assert.throws(
        () =>
            applyBoardLayout(validSeed(), [
                { id: 'Zzzzzzzzzz9', x: 0, y: 0, w: 10, h: 10 },
            ]),
        /unknown item id "Zzzzzzzzzz9"/
    )
})

test('applyBoardLayout does not mutate its input', () => {
    const seed = validSeed()
    applyBoardLayout(seed, [{ id: 'a1234567890', x: 5, y: 5, w: 10, h: 10 }])
    assert.deepEqual(seed, validSeed())
})

test('applyCapturedConfigs sets objects and keeps failed captures', () => {
    const seed = validSeed()
    seed.items[1].config = { version: 2 }
    const result = applyCapturedConfigs(seed, {
        a1234567890: { version: 9, jobLimit: 5 },
        // b1234567890 absent → capture failed → previous config kept
    })
    assert.deepEqual(result.items[0].config, { version: 9, jobLimit: 5 })
    assert.deepEqual(result.items[1].config, { version: 2 })
})

test('applyCapturedConfigs writes null for missing datastore entries', () => {
    const result = applyCapturedConfigs(validSeed(), { a1234567890: null })
    assert.equal(result.items[0].config, null)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — `applyBoardLayout` / `applyCapturedConfigs` not exported.

- [ ] **Step 3: Implement in `scripts/lib/seed-core.mjs`**

Append after `mergePulledDashboard`:

```js
/**
 * Apply board drag/resize results to seed items. `layouts` entries are
 * { id, x, y, w, h } in grid units; items not mentioned keep their layout.
 * Unknown ids are an error — the board can only move existing items.
 */
export const applyBoardLayout = (seed, layouts) => {
    const itemIds = new Set(seed.items.map((item) => item.id))
    for (const layout of layouts) {
        if (!itemIds.has(layout.id)) {
            throw new Error(`board layout: unknown item id "${layout.id}"`)
        }
    }
    const layoutById = new Map(layouts.map((layout) => [layout.id, layout]))
    return {
        ...seed,
        items: seed.items.map((item) => {
            const next = layoutById.get(item.id)
            return next
                ? {
                      ...item,
                      layout: { x: next.x, y: next.y, w: next.w, h: next.h },
                  }
                : item
        }),
    }
}

/**
 * Merge configs captured from the datastore into the seed. `configs` maps
 * item id → object (stored config), null (no datastore entry), or
 * undefined/absent (capture failed — the previous seed config is kept).
 */
export const applyCapturedConfigs = (seed, configs) => ({
    ...seed,
    items: seed.items.map((item) =>
        configs[item.id] === undefined
            ? item
            : { ...item, config: configs[item.id] }
    ),
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS (all existing + 6 new).

- [ ] **Step 5: Lint and commit**

```bash
pnpm lint
git add scripts/lib/seed-core.mjs scripts/lib/seed-core.test.mjs
git commit -m "Add board seed transforms: applyBoardLayout, applyCapturedConfigs"
```

---

### Task 2: `apps/board` package scaffold + workspace wiring

**Files:**
- Modify: `pnpm-workspace.yaml` (packages list)
- Modify: `package.json` (root — add `board` script)
- Create: `apps/board/package.json`, `apps/board/d2.config.js`, `apps/board/tsconfig.json`, `apps/board/vite.config.mts`, `apps/board/src/Globals.d.ts`, `apps/board/src/vite-env.d.ts`, `apps/board/src/App.tsx`, `apps/board/src/App.module.css`

**Interfaces:**
- Produces: a starting/tsc-checkable d2 app; `apps/board/vite.config.mts` is where Task 3 registers `boardSeedPlugin()`; `src/App.tsx` is replaced by Task 4.

- [ ] **Step 1: Workspace + root script**

`pnpm-workspace.yaml` — add `apps/*` to `packages`:

```yaml
packages:
    - packages/*
    - widgets/*
    - apps/*
```

Root `package.json` — add to `scripts` (after `new-widget`):

```json
"board": "pnpm --filter @chap-widgets/board start",
```

- [ ] **Step 2: Package files**

`apps/board/package.json` (template's deps, minus highcharts — plugins resolve their own deps from their widget's node_modules — plus react-grid-layout; **no build script**):

```json
{
    "name": "@chap-widgets/board",
    "version": "1.0.0",
    "description": "Dev-only board harness — every widget's Plugin on one react-grid-layout page, autosaving layout + configs into dashboard.seed.json",
    "license": "BSD-3-Clause",
    "private": true,
    "scripts": {
        "start": "d2-app-scripts start",
        "tsc:check": "tsc --noEmit"
    },
    "dependencies": {
        "@chap-widgets/shared": "workspace:*",
        "@dhis2/app-runtime": "^3.14.6",
        "@dhis2/d2-i18n": "^1.2.0",
        "@dhis2/ui": "^10.13.0",
        "react": "^18.3.1",
        "react-dom": "^18.3.1",
        "react-grid-layout": "^1.4.4"
    },
    "devDependencies": {
        "@dhis2/cli-app-scripts": "12.11.1",
        "@types/node": "^22.18.0",
        "@types/react": "^18.3.12",
        "@types/react-dom": "^18.3.1",
        "@types/react-grid-layout": "^1.3.5",
        "typescript": "^5.9.3",
        "vite": "^5.4.21"
    }
}
```

`apps/board/d2.config.js` (no `pluginType` — the board is never a dashboard item):

```js
/** @type {import('@dhis2/cli-app-scripts').D2Config} */
const config = {
    type: 'app',
    name: 'chap-board',
    title: 'CHAP · Board',
    minDHIS2Version: '2.40',

    entryPoints: {
        app: './src/App.tsx',
    },

    viteConfigExtensions: './vite.config.mts',
}

module.exports = config
```

`apps/board/tsconfig.json` (same shape as `widgets/_template/tsconfig.json`):

```json
{
    "extends": "../../tsconfig.base.json",
    "compilerOptions": {
        "baseUrl": ".",
        "paths": {
            "@/*": ["src/*"]
        }
    },
    "include": ["src"],
    "exclude": ["node_modules", "build"]
}
```

`apps/board/vite.config.mts` (`__dirname` works here — Vite's config loader shims it, the template relies on the same; `dedupe` keeps one React/app-runtime instance across board + glob-imported widget sources):

```ts
import path from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
    server: {
        fs: {
            // Widget + shared sources are imported from across the workspace
            allow: [path.resolve(__dirname, '../..')],
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
        // One instance of these across board + glob-imported widget sources
        dedupe: [
            'react',
            'react-dom',
            '@dhis2/app-runtime',
            '@dhis2/ui',
            '@tanstack/react-query',
        ],
    },
    clearScreen: false,
})
```

`apps/board/src/Globals.d.ts`:

```ts
declare module '*.module.css'
declare module '@dhis2/d2-i18n'
```

`apps/board/src/vite-env.d.ts` (types `import.meta.glob` for Task 5):

```ts
/// <reference types="vite/client" />
```

`apps/board/src/App.tsx` (placeholder until Task 4):

```tsx
import React from 'react'
import styles from './App.module.css'

const App = () => <div className={styles.app}>Board harness scaffold</div>

export default App
```

`apps/board/src/App.module.css`:

```css
.app {
    padding: 8px 16px;
}
```

- [ ] **Step 3: Install and verify**

```bash
pnpm install
pnpm --filter @chap-widgets/board tsc:check
pnpm verify
```

Expected: install links the new package; both commands pass (root `build` untouched — it filters `./widgets/**`).

- [ ] **Step 4: Lint and commit**

```bash
pnpm lint
git add pnpm-workspace.yaml package.json pnpm-lock.yaml apps/board
git commit -m "Scaffold apps/board dev harness package"
```

---

### Task 3: Vite dev middleware — `GET/PUT /__board/seed`

**Files:**
- Create: `apps/board/vite-plugin-seed.mts`
- Modify: `apps/board/vite.config.mts` (register the plugin)

**Interfaces:**
- Consumes: `validateSeed`, `autoAddWidgets`, `applyBoardLayout`, `applyCapturedConfigs`, `serializeSeed` from `scripts/lib/seed-core.mjs`; `discoverWidgets(widgetsDir)` from `scripts/lib/widgets.mjs`; `resolveTarget('local')` from `scripts/lib/targets.mjs`.
- Produces: `GET /__board/seed` → `{ seed }` (after auto-adding missing widgets, persisting if any were added); `PUT /__board/seed` body `{ layouts: [{ id, x, y, w, h }] }` → `{ seed, warnings: string[] }`; errors → status 400/405 with `{ error }`. Task 4's `boardApi.ts` is the client.

- [ ] **Step 1: Write the plugin**

`apps/board/vite-plugin-seed.mts` (outside `tsconfig.json`'s `include: ["src"]`, so the untyped `.mjs` imports don't need declarations):

```ts
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'
import {
    applyBoardLayout,
    applyCapturedConfigs,
    autoAddWidgets,
    serializeSeed,
    validateSeed,
    // eslint-disable-next-line import/no-relative-packages -- dev middleware reuses the seed script logic
} from '../../scripts/lib/seed-core.mjs'
// eslint-disable-next-line import/no-relative-packages -- dev middleware reuses the seed script logic
import { resolveTarget } from '../../scripts/lib/targets.mjs'
// eslint-disable-next-line import/no-relative-packages -- dev middleware reuses the seed script logic
import { discoverWidgets } from '../../scripts/lib/widgets.mjs'

const repoRoot = path.resolve(__dirname, '../..')
const seedPath = path.join(repoRoot, 'dashboard.seed.json')
const widgetsDir = path.join(repoRoot, 'widgets')

const loadSeed = () => {
    const seed = JSON.parse(readFileSync(seedPath, 'utf8'))
    validateSeed(seed)
    return seed
}

const writeSeed = (seed: unknown) => {
    validateSeed(seed)
    writeFileSync(seedPath, serializeSeed(seed))
}

const readBody = (req: NodeJS.ReadableStream): Promise<string> =>
    new Promise((resolve, reject) => {
        let body = ''
        req.on('data', (chunk) => (body += chunk))
        req.on('end', () => resolve(body))
        req.on('error', reject)
    })

/**
 * GET dataStore/chap-widgets/<id> for every item on the local instance.
 * 200 → the stored config, 404 → null, anything else → the id is left out
 * (applyCapturedConfigs then keeps the previous seed config) + a warning.
 */
const captureConfigs = async (seed: { items: { id: string; widget: string }[] }) => {
    const { url, username, password } = resolveTarget('local')
    const authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
    const configs: Record<string, unknown> = {}
    const warnings: string[] = []
    for (const item of seed.items) {
        try {
            const response = await fetch(
                `${url}/api/dataStore/chap-widgets/${item.id}`,
                { headers: { authorization } }
            )
            if (response.status === 404) {
                configs[item.id] = null
            } else if (response.ok) {
                configs[item.id] = await response.json()
            } else {
                warnings.push(
                    `${item.widget}: config capture got HTTP ${response.status}; kept the previous seed config`
                )
            }
        } catch (error) {
            warnings.push(
                `${item.widget}: config capture failed (${(error as Error).message}); kept the previous seed config`
            )
        }
    }
    return { configs, warnings }
}

const sendJson = (
    res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (b: string) => void },
    status: number,
    payload: unknown
) => {
    res.statusCode = status
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(payload))
}

export const boardSeedPlugin = (): Plugin => ({
    name: 'chap-board-seed',
    configureServer(server) {
        server.middlewares.use('/__board/seed', (req, res) => {
            void (async () => {
                if (req.method === 'GET') {
                    let seed = loadSeed()
                    const { seed: next, added } = autoAddWidgets(
                        seed,
                        discoverWidgets(widgetsDir)
                    )
                    if (added.length > 0) {
                        writeSeed(next)
                        seed = next
                    }
                    sendJson(res, 200, { seed })
                } else if (req.method === 'PUT') {
                    const { layouts } = JSON.parse(await readBody(req))
                    let seed = applyBoardLayout(loadSeed(), layouts)
                    const { configs, warnings } = await captureConfigs(seed)
                    seed = applyCapturedConfigs(seed, configs)
                    writeSeed(seed)
                    sendJson(res, 200, { seed, warnings })
                } else {
                    sendJson(res, 405, {
                        error: `method ${req.method} not allowed`,
                    })
                }
            })().catch((error: Error) => {
                sendJson(res, 400, { error: error.message })
            })
        })
    },
})
```

(If eslint doesn't flag the cross-package relative imports, drop the three disable comments rather than keeping dead ones.)

- [ ] **Step 2: Register it**

In `apps/board/vite.config.mts`, add the import and `plugins` entry:

```ts
import { boardSeedPlugin } from './vite-plugin-seed.mts'
```

and inside `defineConfig({ … })`, first key:

```ts
    plugins: [boardSeedPlugin()],
```

- [ ] **Step 3: Verify against a running dev server**

```bash
pnpm board   # in background; wait for "ready" — first boot generates i18n/ + src/locales/
curl -s http://localhost:3000/__board/seed | head -c 400
curl -s -X PUT http://localhost:3000/__board/seed \
  -H 'content-type: application/json' \
  -d '{"layouts":[{"id":"pY1eUz7jXOH","x":0,"y":0,"w":21,"h":20}]}'
git diff dashboard.seed.json
curl -s -X PUT http://localhost:3000/__board/seed \
  -H 'content-type: application/json' \
  -d '{"layouts":[{"id":"badId123456","x":0,"y":0,"w":5,"h":5}]}'
```

Expected: GET returns the seed JSON; first PUT returns `{ seed, warnings }` and the diff shows `w: 20 → 21` on evaluation-compare (plus any config fields captured from the live datastore — with local DHIS2 running, model-status keeps its config); second PUT returns 400 `{"error":"board layout: unknown item id …"}` and the file is unchanged. Then restore: `git checkout dashboard.seed.json`. If DHIS2 is not running, warnings list every item and configs stay as they were — layout still saves.

- [ ] **Step 4: Lint and commit**

```bash
pnpm lint
git add apps/board
git commit -m "Serve GET/PUT /__board/seed from board dev middleware"
```

(Include the generated `apps/board/i18n/` and `apps/board/src/locales/` from the first start in this commit — same files every widget commits.)

---

### Task 4: Board UI — grid, autosave, top bar (placeholder item bodies)

**Files:**
- Create: `apps/board/src/boardApi.ts`, `apps/board/src/gridConstants.ts`, `apps/board/src/TopBar.tsx`, `apps/board/src/TopBar.module.css`, `apps/board/src/Board.tsx`
- Modify: `apps/board/src/App.tsx`, `apps/board/src/App.module.css`

**Interfaces:**
- Consumes: Task 3's endpoints.
- Produces: `boardApi.ts` exports `type ItemLayout = { id: string; x: number; y: number; w: number; h: number }`, `type SeedItem = { id: string; widget: string; layout: { x; y; w; h: number }; config: Record<string, unknown> | null }`, `type Seed = { dashboard: { name: string; code: string }; items: SeedItem[] }`, `fetchSeed(): Promise<Seed>`, `saveLayouts(layouts: ItemLayout[]): Promise<{ seed: Seed; warnings: string[] }>`. `Board.tsx` renders a `renderItem(item: SeedItem) => ReactNode` placeholder that Task 5 replaces with `BoardItem`. Grid items carry literal class hooks `board-drag-handle` (drag) and `board-no-drag` (cancel) used by Task 5's header.

- [ ] **Step 1: Write the modules**

`apps/board/src/boardApi.ts`:

```ts
/** Client for the board's Vite dev-middleware seed endpoints. */

export type ItemLayout = {
    id: string
    x: number
    y: number
    w: number
    h: number
}

export type SeedItem = {
    id: string
    widget: string
    layout: { x: number; y: number; w: number; h: number }
    config: Record<string, unknown> | null
}

export type Seed = {
    dashboard: { name: string; code: string }
    items: SeedItem[]
}

const request = async (init?: RequestInit) => {
    const response = await fetch('/__board/seed', init)
    const body = await response.json()
    if (!response.ok) {
        throw new Error(body.error ?? `HTTP ${response.status}`)
    }
    return body
}

export const fetchSeed = async (): Promise<Seed> => (await request()).seed

export const saveLayouts = (
    layouts: ItemLayout[]
): Promise<{ seed: Seed; warnings: string[] }> =>
    request({
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ layouts }),
    })
```

`apps/board/src/gridConstants.ts`:

```ts
/**
 * Mirrors dhis2/dashboard-app src/modules/gridUtil.js so the board matches
 * the real Dashboard app's geometry exactly.
 */
export const GRID_COLUMNS = 60
export const GRID_ROW_HEIGHT_PX = 16
export const MARGIN_PX: [number, number] = [4, 4]
export const GRID_PADDING_PX: [number, number] = [0, 0]
export const GRID_COMPACT_TYPE = 'vertical' as const
export const MIN_ITEM_GRID_HEIGHT = 4
export const MAX_ITEM_GRID_HEIGHT = 34
export const MAX_ITEM_GRID_WIDTH = 59
```

`apps/board/src/TopBar.tsx`:

```tsx
import { Button } from '@dhis2/ui'
import React from 'react'
import styles from './TopBar.module.css'

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'failed'

const STATUS_LABEL: Record<SaveStatus, string> = {
    saved: 'Seed saved ✓',
    dirty: 'Unsaved changes…',
    saving: 'Saving…',
    failed: 'Save failed — see the browser console',
}

export const TopBar = ({
    name,
    status,
    warnings,
    onSync,
}: {
    name: string
    status: SaveStatus
    warnings: string[]
    onSync: () => void
}) => (
    <div className={styles.bar}>
        <h1 className={styles.name}>{name} — board</h1>
        <span className={status === 'failed' ? styles.failed : styles.status}>
            {STATUS_LABEL[status]}
        </span>
        {warnings.map((warning) => (
            <span key={warning} className={styles.warning}>
                ⚠ {warning}
            </span>
        ))}
        <Button small onClick={onSync}>
            Sync seed
        </Button>
    </div>
)
```

`apps/board/src/TopBar.module.css`:

```css
.bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    padding: 8px 4px;
}

.name {
    margin: 0;
    font-size: 16px;
}

.status {
    color: var(--colors-grey600);
    font-size: 13px;
}

.failed {
    color: var(--colors-red600);
    font-size: 13px;
}

.warning {
    color: var(--colors-yellow800);
    font-size: 13px;
}
```

`apps/board/src/Board.tsx` — the seed's items never change while the board runs (add/remove is not board UI), so the item set renders once and RGL owns positions; autosave diffs against the last saved state because RGL also fires `onLayoutChange` on mount and compaction:

```tsx
import React, { useRef, useState } from 'react'
import RGL, { WidthProvider, type Layout } from 'react-grid-layout'
import { saveLayouts, type ItemLayout, type Seed, type SeedItem } from './boardApi'
import {
    GRID_COLUMNS,
    GRID_COMPACT_TYPE,
    GRID_PADDING_PX,
    GRID_ROW_HEIGHT_PX,
    MARGIN_PX,
    MAX_ITEM_GRID_HEIGHT,
    MAX_ITEM_GRID_WIDTH,
    MIN_ITEM_GRID_HEIGHT,
} from './gridConstants'
import { TopBar, type SaveStatus } from './TopBar'

const GridLayout = WidthProvider(RGL)

const AUTOSAVE_DELAY_MS = 800

const toItemLayouts = (layout: Layout[]): ItemLayout[] =>
    [...layout]
        .sort((a, b) => a.i.localeCompare(b.i))
        .map(({ i, x, y, w, h }) => ({ id: i, x, y, w, h }))

export const Board = ({
    initialSeed,
    renderItem,
}: {
    initialSeed: Seed
    renderItem: (item: SeedItem) => React.ReactNode
}) => {
    const [status, setStatus] = useState<SaveStatus>('saved')
    const [warnings, setWarnings] = useState<string[]>([])

    const gridLayout: Layout[] = initialSeed.items.map((item) => ({
        i: item.id,
        x: item.layout.x,
        y: item.layout.y,
        w: item.layout.w,
        h: item.layout.h,
        minH: MIN_ITEM_GRID_HEIGHT,
        maxH: MAX_ITEM_GRID_HEIGHT,
        maxW: MAX_ITEM_GRID_WIDTH,
    }))

    const currentRef = useRef<ItemLayout[]>(toItemLayouts(gridLayout))
    const lastSavedRef = useRef(JSON.stringify(currentRef.current))
    const timerRef = useRef<number | undefined>(undefined)

    const save = async (layouts: ItemLayout[]) => {
        window.clearTimeout(timerRef.current)
        setStatus('saving')
        try {
            const result = await saveLayouts(layouts)
            lastSavedRef.current = JSON.stringify(layouts)
            setWarnings(result.warnings)
            setStatus('saved')
        } catch (error) {
            console.error('board: saving the seed failed', error)
            setStatus('failed')
        }
    }

    const handleLayoutChange = (layout: Layout[]) => {
        const layouts = toItemLayouts(layout)
        currentRef.current = layouts
        if (JSON.stringify(layouts) === lastSavedRef.current) {
            return
        }
        setStatus('dirty')
        window.clearTimeout(timerRef.current)
        timerRef.current = window.setTimeout(
            () => void save(layouts),
            AUTOSAVE_DELAY_MS
        )
    }

    return (
        <>
            <TopBar
                name={initialSeed.dashboard.name}
                status={status}
                warnings={warnings}
                onSync={() => void save(currentRef.current)}
            />
            <GridLayout
                cols={GRID_COLUMNS}
                rowHeight={GRID_ROW_HEIGHT_PX}
                margin={MARGIN_PX}
                containerPadding={GRID_PADDING_PX}
                compactType={GRID_COMPACT_TYPE}
                layout={gridLayout}
                onLayoutChange={handleLayoutChange}
                draggableHandle=".board-drag-handle"
                draggableCancel=".board-no-drag"
            >
                {initialSeed.items.map((item) => (
                    <div key={item.id}>{renderItem(item)}</div>
                ))}
            </GridLayout>
        </>
    )
}
```

`apps/board/src/App.tsx` (replace the scaffold; the placeholder `renderItem` is swapped for `BoardItem` in Task 5):

```tsx
import { CssReset, CssVariables } from '@dhis2/ui'
import React, { useEffect, useState } from 'react'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import styles from './App.module.css'
import { fetchSeed, type Seed } from './boardApi'
import { Board } from './Board'

const App = () => {
    const [seed, setSeed] = useState<Seed | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchSeed().then(setSeed, (loadError: Error) =>
            setError(loadError.message)
        )
    }, [])

    return (
        <div className={styles.app}>
            <CssReset />
            <CssVariables theme spacers colors elevations />
            {error ? (
                <p className={styles.error}>{error}</p>
            ) : seed ? (
                <Board
                    initialSeed={seed}
                    renderItem={(item) => (
                        <div className={styles.placeholderItem}>
                            <div className="board-drag-handle">
                                {item.widget}
                            </div>
                        </div>
                    )}
                />
            ) : (
                <p>Loading dashboard.seed.json…</p>
            )}
        </div>
    )
}

export default App
```

`apps/board/src/App.module.css` (replace):

```css
.app {
    padding: 8px 16px;
}

.error {
    padding: 16px;
    color: var(--colors-red600);
}

.placeholderItem {
    height: 100%;
    background: var(--colors-grey200);
    border-radius: 4px;
    padding: 8px;
    cursor: grab;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @chap-widgets/board tsc:check`
Expected: PASS.

- [ ] **Step 3: Verify live**

Start `pnpm board`, log in (localhost:8090, admin/district), and check in the browser:
- All four seed items render as grey placeholder cards in the seeded 2×2 arrangement.
- Drag one card → top bar cycles dirty → saving → saved; `git diff dashboard.seed.json` shows the move.
- "Sync seed" with nothing changed → saved (idempotent diff).
- Restore: `git checkout dashboard.seed.json`.

- [ ] **Step 4: Lint and commit**

```bash
pnpm lint
git add apps/board
git commit -m "Render the seed on a react-grid-layout board with autosave"
```

---

### Task 5: Mount the real widget Plugins per item

**Files:**
- Create: `apps/board/src/plugins.ts`, `apps/board/src/BoardItem.tsx`, `apps/board/src/BoardItem.module.css`
- Modify: `apps/board/src/App.tsx` (swap placeholder `renderItem` for `BoardItem`), `apps/board/src/App.module.css` (drop `.placeholderItem`)

**Interfaces:**
- Consumes: `SeedItem` from `boardApi.ts`; `DashboardPluginProps` from `@chap-widgets/shared`; class hooks `board-drag-handle` / `board-no-drag` from Task 4's grid.
- Produces: `pluginComponents: Record<string, LazyExoticComponent<ComponentType<DashboardPluginProps>>>` keyed by widget directory name; `BoardItem({ item }: { item: SeedItem })`.

- [ ] **Step 1: Write the modules**

`apps/board/src/plugins.ts`:

```ts
import type { DashboardPluginProps } from '@chap-widgets/shared'
import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

/**
 * Every widget's Plugin, imported from source — this glob is what makes the
 * board render live widget code with no deploy step in the loop.
 */
const modules = import.meta.glob<{
    default: ComponentType<DashboardPluginProps>
}>(['../../../widgets/*/src/Plugin.tsx', '!**/_template/**'])

const widgetFromPath = (modulePath: string) =>
    modulePath.match(/\/widgets\/([^/]+)\/src\/Plugin\.tsx$/)?.[1] ??
    modulePath

export const pluginComponents: Record<
    string,
    LazyExoticComponent<ComponentType<DashboardPluginProps>>
> = Object.fromEntries(
    Object.entries(modules).map(([modulePath, loader]) => [
        widgetFromPath(modulePath),
        lazy(loader),
    ])
)
```

`apps/board/src/BoardItem.tsx` (the header is the drag handle; the mode toggle sits in a `board-no-drag` span so clicking it never starts a drag; the plugin reports its title through `setDashboardItemDetails`, exactly as on a real dashboard):

```tsx
import type { DashboardPluginProps } from '@chap-widgets/shared'
import { Button, ButtonStrip } from '@dhis2/ui'
import React, { Suspense, useCallback, useState } from 'react'
import { type SeedItem } from './boardApi'
import styles from './BoardItem.module.css'
import { pluginComponents } from './plugins'

export const BoardItem = ({ item }: { item: SeedItem }) => {
    const [mode, setMode] = useState<'view' | 'edit'>('view')
    const [title, setTitle] = useState<string | null>(null)
    const Plugin = pluginComponents[item.widget]

    const setDashboardItemDetails = useCallback<
        NonNullable<DashboardPluginProps['setDashboardItemDetails']>
    >((details) => setTitle(details.itemTitle ?? null), [])

    return (
        <div className={styles.item}>
            <div className={`${styles.header} board-drag-handle`}>
                <span className={styles.title}>{title ?? item.widget}</span>
                <span className="board-no-drag">
                    <ButtonStrip>
                        <Button
                            small
                            toggled={mode === 'view'}
                            onClick={() => setMode('view')}
                        >
                            View
                        </Button>
                        <Button
                            small
                            toggled={mode === 'edit'}
                            onClick={() => setMode('edit')}
                        >
                            Edit
                        </Button>
                    </ButtonStrip>
                </span>
            </div>
            <div className={styles.body}>
                {Plugin ? (
                    <Suspense
                        fallback={
                            <p className={styles.placeholder}>
                                Loading {item.widget}…
                            </p>
                        }
                    >
                        <Plugin
                            dashboardItemId={item.id}
                            dashboardMode={mode}
                            dashboardItemFilters={{}}
                            setDashboardItemDetails={setDashboardItemDetails}
                        />
                    </Suspense>
                ) : (
                    <p className={styles.placeholder}>
                        No widget source for “{item.widget}” under widgets/.
                    </p>
                )}
            </div>
        </div>
    )
}
```

`apps/board/src/BoardItem.module.css`:

```css
.item {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background: var(--colors-white);
    border: 1px solid var(--colors-grey300);
    border-radius: 4px;
}

.header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 4px 8px;
    background: var(--colors-grey100);
    border-bottom: 1px solid var(--colors-grey300);
    cursor: grab;
}

.title {
    overflow: hidden;
    font-size: 13px;
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.body {
    flex: 1;
    overflow: auto;
}

.placeholder {
    padding: 16px;
    color: var(--colors-grey600);
}
```

In `apps/board/src/App.tsx`, add `import { BoardItem } from './BoardItem'` and replace the placeholder `renderItem` with:

```tsx
renderItem={(item) => <BoardItem item={item} />}
```

Remove `.placeholderItem` from `App.module.css`.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @chap-widgets/board tsc:check`
Expected: PASS.

- [ ] **Step 3: Verify live** (needs localhost:8090 with the chap route + chap-core up)

Start `pnpm board`, log in, and check:
- All four widgets render their real Plugins; model-status (configured in the seed/datastore) shows job data; unconfigured widgets show "Widget not configured".
- Item headers show real titles (e.g. model-status's configured title) once loaded.
- Toggle one widget to Edit → its ConfigForm appears; save a config → the alert fires; toggle back to View → data renders.
- "Sync seed" → `git diff dashboard.seed.json` now contains the config saved in the previous step (config capture).
- Drag/resize still works via the header; widget content (scrolling, buttons) doesn't trigger drags.
- Decide with Edvin whether to keep or revert the captured config diff; `git checkout dashboard.seed.json` reverts.

- [ ] **Step 4: Lint and commit**

```bash
pnpm lint
git add apps/board
git commit -m "Mount every widget's Plugin on the board with per-item mode toggle"
```

---

### Task 6: Docs + full verification + acceptance

**Files:**
- Modify: `CLAUDE.md` (repo map, commands, local dev loop, rule 7)
- Modify: `README.md` (quick start)

**Interfaces:**
- Consumes: everything above, complete.

- [ ] **Step 1: CLAUDE.md**

Repo map — after the `widgets/<name>/` line, add:

```
apps/board/             Dev-only board harness: every widget's Plugin on one react-grid-layout page; drag/resize + live configs autosave into dashboard.seed.json (never built/deployed)
```

Commands block — after the `pnpm new-widget` line, add:

```sh
pnpm board                          # all-widgets board harness (localhost:3000) — layout + config edits autosave into dashboard.seed.json
```

Rule 7 — replace the final sentence ("To change the layout: …") with:

```
To change the layout: arrange/configure it on the real dashboard and
`pnpm seed:pull`, **or** use `pnpm board` (which autosaves layout and
captures live configs into the seed directly) — then commit the diff.
```

Local dev loop section — after the paragraph about `pnpm --filter … start`, add:

```
`pnpm board` serves every widget's Plugin from source on one
react-grid-layout page (item ids and configs shared with the real "CHAP
Widgets" dashboard); drags/resizes and a "Sync seed" button write
dashboard.seed.json directly — the fastest layout/config loop, no deploy.
```

- [ ] **Step 2: README.md**

After the `pnpm seed:local` paragraph in Quick start, add:

```markdown
For layout work there's also a local board: `pnpm board` renders every
widget on one drag/resize grid straight from source (no deploy needed) and
autosaves the arrangement — plus each widget's live config — back into
`dashboard.seed.json`.
```

- [ ] **Step 3: Full verification**

```bash
pnpm verify
```

Expected: typecheck (incl. board), lint, all node tests, and every widget build pass.

- [ ] **Step 4: Acceptance round-trip** (spec's live acceptance, needs localhost:8090)

1. `pnpm board` → arrange items into a deliberately new layout; wait for "Seed saved ✓".
2. `git diff dashboard.seed.json` shows the arrangement; `pnpm seed:local` → the real "CHAP Widgets" dashboard shows the same arrangement.
3. `pnpm seed:pull` → no unexpected diff (convergence with the pushed layout).
4. Keep or revert the layout diff per Edvin's preference (revert with `git checkout dashboard.seed.json` + `pnpm seed:local`).

- [ ] **Step 5: Lint and commit**

```bash
pnpm lint
git add CLAUDE.md README.md
git commit -m "Document the board harness dev loop"
```
