# Dashboard Seeding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A committed `dashboard.seed.json` plus a `scripts/seed.mjs` push/pull script that reproduces a fully laid-out, fully configured "CHAP Widgets" dashboard on any DHIS2 instance, auto-including new widgets, wired into CI.

**Architecture:** Pure seed logic (validation, UID generation, auto-add placement, pull merging, stable serialization) lives in `scripts/lib/seed-core.mjs`, unit-tested with Node's built-in test runner. `scripts/seed.mjs` is the thin CLI + DHIS2 API layer (global `fetch`, basic auth). Target resolution and widget discovery are extracted from `deploy.mjs` into shared lib modules. The keystone: each seed item carries a stable, pre-generated DHIS2 UID used as the dashboard item id, so `dataStore/chap-widgets/<id>` config entries travel with the seed to every instance.

**Tech Stack:** Node 22 (`node:test`, `node:assert/strict`, global `fetch`, `node:crypto`), zero new dependencies. DHIS2 Web API: `/api/dashboards`, `/api/dataStore`.

**Spec:** `docs/superpowers/specs/2026-09-01-dashboard-seed-design.md`

## Global Constraints

- No new runtime dependencies for scripts — `scripts/*.mjs` stay dependency-free, Node 22+.
- Code style must pass `pnpm verify` (tsc, eslint, prettier, build). Scripts style matches `deploy.mjs`: no semicolons, single quotes, 4-space indent, `(arg) =>` arrow parens.
- Datastore namespace is exactly `chap-widgets` (must match `DATASTORE_NAMESPACE` in `packages/shared/src/config/useDashboardItemConfig.ts`).
- Dashboard identity: name `CHAP Widgets`, code `CHAP_WIDGETS`. Grid: 60 columns; default new-item size 20×20.
- DHIS2 UIDs: `/^[A-Za-z][A-Za-z0-9]{10}$/` (11 chars, letter first).
- App key for widget `<name>` is `chap-widget-<name>` (from each widget's `d2.config.js` `name`).
- Git: commit after every task, **in Edvin's name only — never add a `Co-Authored-By` trailer, never push**. Plain imperative commit messages (repo does not use conventional commits).
- The local verification instance is `http://localhost:8090` (admin/district) with the four widgets (`prediction-chart`, `evaluation-compare`, `outbreak-alerts`, `model-status`) deployed.

---

### Task 1: Shared script lib (`targets.mjs`, `widgets.mjs`) + test runner wiring

Extract target resolution and widget discovery out of `deploy.mjs` so `seed.mjs` (Tasks 5–6) can reuse them, and wire `node --test` into the repo's verify pipeline.

**Files:**
- Create: `scripts/lib/targets.mjs`
- Create: `scripts/lib/widgets.mjs`
- Test: `scripts/lib/targets.test.mjs`
- Modify: `scripts/deploy.mjs` (use the new lib, behavior unchanged)
- Modify: `package.json` (add `test` script, extend `verify`)

**Interfaces:**
- Consumes: nothing (first task).
- Produces:
  - `resolveTarget(target: string, env = process.env) → { url, username, password }` — throws `Error` for `demo` without `DHIS2_DEMO_URL`; `username`/`password` may be `undefined` for `demo`/url targets (callers check).
  - `discoverWidgets(widgetsDir: string) → string[]` — directory names under `widgets/` that contain a `d2.config.js`, excluding `_template`.

- [ ] **Step 1: Write the failing test**

Create `scripts/lib/targets.test.mjs`:

```js
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveTarget } from './targets.mjs'

test('local target defaults to localhost:8090 with admin/district', () => {
    assert.deepEqual(resolveTarget('local', {}), {
        url: 'http://localhost:8090',
        username: 'admin',
        password: 'district',
    })
})

test('local target honors DHIS2_LOCAL_URL and D2_* overrides', () => {
    assert.deepEqual(
        resolveTarget('local', {
            DHIS2_LOCAL_URL: 'http://localhost:9999',
            D2_USERNAME: 'user',
            D2_PASSWORD: 'pass',
        }),
        { url: 'http://localhost:9999', username: 'user', password: 'pass' }
    )
})

test('demo target requires DHIS2_DEMO_URL', () => {
    assert.throws(() => resolveTarget('demo', {}), /DHIS2_DEMO_URL/)
})

test('demo target uses DHIS2_DEMO_URL and D2_* credentials', () => {
    assert.deepEqual(
        resolveTarget('demo', {
            DHIS2_DEMO_URL: 'https://demo.example',
            D2_USERNAME: 'user',
            D2_PASSWORD: 'pass',
        }),
        { url: 'https://demo.example', username: 'user', password: 'pass' }
    )
})

test('any other target is treated as an explicit URL', () => {
    assert.deepEqual(
        resolveTarget('https://x.example', {
            D2_USERNAME: 'user',
            D2_PASSWORD: 'pass',
        }),
        { url: 'https://x.example', username: 'user', password: 'pass' }
    )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/`
Expected: FAIL — cannot find module `scripts/lib/targets.mjs`.

- [ ] **Step 3: Implement `scripts/lib/targets.mjs`**

```js
/**
 * Resolve a deploy/seed target (local | demo | explicit URL) to a DHIS2
 * base URL plus credentials:
 *   local — $DHIS2_LOCAL_URL (default http://localhost:8090), admin/district
 *   demo  — $DHIS2_DEMO_URL (required), $D2_USERNAME/$D2_PASSWORD
 *   url   — the URL as-is, $D2_USERNAME/$D2_PASSWORD
 * username/password may come back undefined for demo/url targets — callers
 * decide how to fail.
 */
export const resolveTarget = (target, env = process.env) => {
    if (target === 'local') {
        return {
            url: env.DHIS2_LOCAL_URL ?? 'http://localhost:8090',
            username: env.D2_USERNAME ?? 'admin',
            password: env.D2_PASSWORD ?? 'district',
        }
    }
    if (target === 'demo') {
        if (!env.DHIS2_DEMO_URL) {
            throw new Error('target demo: DHIS2_DEMO_URL is not set')
        }
        return {
            url: env.DHIS2_DEMO_URL,
            username: env.D2_USERNAME,
            password: env.D2_PASSWORD,
        }
    }
    return {
        url: target,
        username: env.D2_USERNAME,
        password: env.D2_PASSWORD,
    }
}
```

And `scripts/lib/widgets.mjs`:

```js
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'

/**
 * Directory names under widgets/ that are real widgets: not _template, and
 * containing a d2.config.js. Same filter deploy and seed both rely on.
 */
export const discoverWidgets = (widgetsDir) =>
    readdirSync(widgetsDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name !== '_template')
        .filter((entry) =>
            existsSync(path.join(widgetsDir, entry.name, 'd2.config.js'))
        )
        .map((entry) => entry.name)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/`
Expected: 5 passing tests.

- [ ] **Step 5: Refactor `deploy.mjs` to use the lib (behavior unchanged)**

In `scripts/deploy.mjs`:
- Add imports after the existing ones:

```js
import { resolveTarget } from './lib/targets.mjs'
import { discoverWidgets } from './lib/widgets.mjs'
```

- Delete the inline `const resolveTarget = () => { … }` function (lines 37–62) and replace its call site with:

```js
let resolved
try {
    resolved = resolveTarget(target)
} catch (error) {
    console.error(`deploy ${target}: ${error.message}`)
    process.exit(1)
}
const { url, username, password } = resolved
```

- Replace the inline `allWidgets` computation (`readdirSync(widgetsDir…).map(…)`) with:

```js
const allWidgets = discoverWidgets(widgetsDir)
```

- Remove the now-unused `existsSync`/`readdirSync` imports from `deploy.mjs` (it still uses `path` and `execFileSync`).

- [ ] **Step 6: Wire tests into the verify pipeline**

In root `package.json` scripts, add a `test` script and extend `verify`:

```json
"test": "node --test scripts/",
"verify": "pnpm run tsc:check && pnpm run lint && pnpm run test && pnpm run build"
```

- [ ] **Step 7: Verify everything still works**

Run: `pnpm verify`
Expected: tsc, eslint/prettier, node tests, and all widget builds pass. If prettier complains about the new files, run `pnpm format` and re-run.

Then confirm deploy still resolves targets: `node scripts/deploy.mjs` (no args)
Expected: usage error, exit 1 (unchanged behavior).

- [ ] **Step 8: Commit**

```bash
git add scripts/lib/targets.mjs scripts/lib/widgets.mjs scripts/lib/targets.test.mjs scripts/deploy.mjs package.json
git commit -m "Extract shared script lib (target resolution, widget discovery) and wire node --test into verify"
```

---

### Task 2: seed-core — UIDs, app-key mapping, seed validation

**Files:**
- Create: `scripts/lib/seed-core.mjs`
- Test: `scripts/lib/seed-core.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces (all named exports of `scripts/lib/seed-core.mjs`):
  - `GRID_COLUMNS = 60`, `DEFAULT_ITEM_SIZE = { w: 20, h: 20 }`, `DEFAULT_DASHBOARD = { name: 'CHAP Widgets', code: 'CHAP_WIDGETS' }`, `UID_RE`
  - `generateUid() → string` (valid DHIS2 UID)
  - `widgetAppKey(widget: string) → string` (`chap-widget-<name>`)
  - `appKeyToWidget(appKey: string|undefined) → string|null`
  - `validateSeed(seed) → void` — throws `Error` starting with `dashboard.seed.json:` on any violation.
- Seed shape (used by every later task): `{ dashboard: { name, code }, items: [{ id, widget, layout: { x, y, w, h }, config: object|null }] }`.

- [ ] **Step 1: Write the failing tests**

Create `scripts/lib/seed-core.test.mjs`:

```js
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
    UID_RE,
    appKeyToWidget,
    generateUid,
    validateSeed,
    widgetAppKey,
} from './seed-core.mjs'

const validSeed = () => ({
    dashboard: { name: 'CHAP Widgets', code: 'CHAP_WIDGETS' },
    items: [
        {
            id: 'a1234567890',
            widget: 'prediction-chart',
            layout: { x: 0, y: 0, w: 29, h: 24 },
            config: { version: 1 },
        },
        {
            id: 'b1234567890',
            widget: 'model-status',
            layout: { x: 30, y: 0, w: 30, h: 24 },
            config: null,
        },
    ],
})

test('generateUid produces distinct valid DHIS2 UIDs', () => {
    const uids = new Set(
        Array.from({ length: 100 }, () => generateUid())
    )
    assert.equal(uids.size, 100)
    for (const uid of uids) {
        assert.match(uid, UID_RE)
    }
})

test('widgetAppKey and appKeyToWidget round-trip', () => {
    assert.equal(widgetAppKey('prediction-chart'), 'chap-widget-prediction-chart')
    assert.equal(appKeyToWidget('chap-widget-prediction-chart'), 'prediction-chart')
    assert.equal(appKeyToWidget('line-listing'), null)
    assert.equal(appKeyToWidget(undefined), null)
})

test('validateSeed accepts a valid seed', () => {
    assert.doesNotThrow(() => validateSeed(validSeed()))
})

test('validateSeed rejects bad shapes with pointed messages', () => {
    assert.throws(() => validateSeed(null), /root must be an object/)

    const noName = validSeed()
    noName.dashboard.name = ''
    assert.throws(() => validateSeed(noName), /dashboard\.name/)

    const badUid = validSeed()
    badUid.items[0].id = 'not-a-uid'
    assert.throws(() => validateSeed(badUid), /items\[0\]\.id/)

    const dupId = validSeed()
    dupId.items[1].id = dupId.items[0].id
    assert.throws(() => validateSeed(dupId), /duplicated/)

    const dupWidget = validSeed()
    dupWidget.items[1].widget = dupWidget.items[0].widget
    assert.throws(() => validateSeed(dupWidget), /duplicated/)

    const overflow = validSeed()
    overflow.items[0].layout = { x: 50, y: 0, w: 20, h: 10 }
    assert.throws(() => validateSeed(overflow), /60-column grid/)

    const fractional = validSeed()
    fractional.items[0].layout.y = 1.5
    assert.throws(() => validateSeed(fractional), /layout\.y/)

    const arrayConfig = validSeed()
    arrayConfig.items[0].config = []
    assert.throws(() => validateSeed(arrayConfig), /config/)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/`
Expected: FAIL — cannot find module `scripts/lib/seed-core.mjs` (Task 1 tests still pass).

- [ ] **Step 3: Implement the first slice of `scripts/lib/seed-core.mjs`**

```js
import { randomBytes } from 'node:crypto'

/**
 * Pure logic for dashboard.seed.json — no filesystem, no network — so it is
 * unit-testable with node:test. Seed shape:
 * {
 *     dashboard: { name, code },
 *     items: [{ id, widget, layout: { x, y, w, h }, config: object|null }]
 * }
 * `id` is the DHIS2 dashboard-item UID and doubles as the datastore key
 * (dataStore/chap-widgets/<id>), which is what lets one seed file carry both
 * layout and per-item widget config to any instance.
 */
export const GRID_COLUMNS = 60
export const DEFAULT_ITEM_SIZE = { w: 20, h: 20 }
export const DEFAULT_DASHBOARD = { name: 'CHAP Widgets', code: 'CHAP_WIDGETS' }

export const UID_RE = /^[A-Za-z][A-Za-z0-9]{10}$/

const UID_LETTERS =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const UID_CHARS = `${UID_LETTERS}0123456789`

export const generateUid = () => {
    const bytes = randomBytes(11)
    let uid = UID_LETTERS[bytes[0] % UID_LETTERS.length]
    for (let index = 1; index < 11; index++) {
        uid += UID_CHARS[bytes[index] % UID_CHARS.length]
    }
    return uid
}

const APP_KEY_PREFIX = 'chap-widget-'

export const widgetAppKey = (widget) => `${APP_KEY_PREFIX}${widget}`

export const appKeyToWidget = (appKey) =>
    typeof appKey === 'string' && appKey.startsWith(APP_KEY_PREFIX)
        ? appKey.slice(APP_KEY_PREFIX.length)
        : null

const WIDGET_NAME_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

const fail = (message) => {
    throw new Error(`dashboard.seed.json: ${message}`)
}

export const validateSeed = (seed) => {
    if (typeof seed !== 'object' || seed === null || Array.isArray(seed)) {
        fail('root must be an object')
    }
    const { dashboard, items } = seed
    if (!dashboard || typeof dashboard !== 'object') {
        fail('dashboard must be an object')
    }
    if (typeof dashboard.name !== 'string' || dashboard.name.length === 0) {
        fail('dashboard.name must be a non-empty string')
    }
    if (typeof dashboard.code !== 'string' || dashboard.code.length === 0) {
        fail('dashboard.code must be a non-empty string')
    }
    if (!Array.isArray(items)) {
        fail('items must be an array')
    }
    const seenIds = new Set()
    const seenWidgets = new Set()
    items.forEach((item, index) => {
        const at = `items[${index}]`
        if (!UID_RE.test(item?.id ?? '')) {
            fail(`${at}.id must be an 11-character DHIS2 UID`)
        }
        if (seenIds.has(item.id)) {
            fail(`${at}.id "${item.id}" is duplicated`)
        }
        seenIds.add(item.id)
        if (
            typeof item.widget !== 'string' ||
            !WIDGET_NAME_RE.test(item.widget)
        ) {
            fail(`${at}.widget must be a kebab-case widget directory name`)
        }
        if (seenWidgets.has(item.widget)) {
            fail(`${at}.widget "${item.widget}" is duplicated`)
        }
        seenWidgets.add(item.widget)
        const layout = item.layout ?? {}
        for (const key of ['x', 'y', 'w', 'h']) {
            if (!Number.isInteger(layout[key])) {
                fail(`${at}.layout.${key} must be an integer`)
            }
        }
        if (layout.x < 0 || layout.w < 1 || layout.x + layout.w > GRID_COLUMNS) {
            fail(`${at}.layout must fit the ${GRID_COLUMNS}-column grid`)
        }
        if (layout.y < 0 || layout.h < 1) {
            fail(`${at}.layout.y must be ≥ 0 and layout.h ≥ 1`)
        }
        if (
            item.config !== null &&
            (typeof item.config !== 'object' || Array.isArray(item.config))
        ) {
            fail(`${at}.config must be an object or null`)
        }
    })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/`
Expected: all tests pass (Task 1's five plus this task's four).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/seed-core.mjs scripts/lib/seed-core.test.mjs
git commit -m "Add seed-core: UID generation, app-key mapping, seed validation"
```

---

### Task 3: seed-core — auto-add, dashboard payload items, stable serialization

**Files:**
- Modify: `scripts/lib/seed-core.mjs` (append functions)
- Test: `scripts/lib/seed-core.test.mjs` (append tests)

**Interfaces:**
- Consumes: `generateUid`, `widgetAppKey`, `GRID_COLUMNS`, `DEFAULT_ITEM_SIZE` from Task 2.
- Produces:
  - `autoAddWidgets(seed, allWidgets: string[]) → { seed, added: string[] }` — appends missing widgets (alphabetical), 3-per-row below existing items, `config: null`; returns the input seed untouched when nothing is missing.
  - `sortItems(items) → items` — new array sorted by `(layout.y, layout.x, widget)`.
  - `buildDashboardItems(seed) → [{ id, type: 'APP', appKey, x, y, w, h }]`
  - `serializeSeed(seed) → string` — sorted items, 4-space-indented JSON, trailing newline (prettier-clean).

- [ ] **Step 1: Write the failing tests**

Append to `scripts/lib/seed-core.test.mjs` (extend the import from `./seed-core.mjs` with `autoAddWidgets`, `buildDashboardItems`, `serializeSeed`, `sortItems`):

```js
test('autoAddWidgets appends missing widgets below existing items, 3 per row', () => {
    const seed = validSeed() // items end at y+h = 24
    const { seed: next, added } = autoAddWidgets(seed, [
        'prediction-chart',
        'model-status',
        'outbreak-alerts',
        'evaluation-compare',
        'a-fourth-widget',
        'z-fifth-widget',
    ])
    assert.deepEqual(added, [
        'a-fourth-widget',
        'evaluation-compare',
        'outbreak-alerts',
        'z-fifth-widget',
    ])
    const layouts = next.items
        .slice(2)
        .map((item) => [item.widget, item.layout])
    assert.deepEqual(layouts, [
        ['a-fourth-widget', { x: 0, y: 24, w: 20, h: 20 }],
        ['evaluation-compare', { x: 20, y: 24, w: 20, h: 20 }],
        ['outbreak-alerts', { x: 40, y: 24, w: 20, h: 20 }],
        ['z-fifth-widget', { x: 0, y: 44, w: 20, h: 20 }],
    ])
    for (const item of next.items.slice(2)) {
        assert.match(item.id, UID_RE)
        assert.equal(item.config, null)
    }
    validateSeed(next)
})

test('autoAddWidgets is a no-op when every widget is present', () => {
    const seed = validSeed()
    const { seed: next, added } = autoAddWidgets(seed, [
        'prediction-chart',
        'model-status',
    ])
    assert.equal(next, seed)
    assert.deepEqual(added, [])
})

test('buildDashboardItems maps seed items to APP dashboard items', () => {
    assert.deepEqual(buildDashboardItems(validSeed())[0], {
        id: 'a1234567890',
        type: 'APP',
        appKey: 'chap-widget-prediction-chart',
        x: 0,
        y: 0,
        w: 29,
        h: 24,
    })
})

test('serializeSeed sorts items by y, x and ends with a newline', () => {
    const seed = validSeed()
    seed.items.reverse()
    const output = serializeSeed(seed)
    assert.ok(output.endsWith('}\n'))
    const parsed = JSON.parse(output)
    assert.deepEqual(
        parsed.items.map((item) => item.widget),
        ['prediction-chart', 'model-status']
    )
    assert.deepEqual(sortItems(seed.items), parsed.items)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/`
Expected: FAIL — `autoAddWidgets` (etc.) is not exported.

- [ ] **Step 3: Implement (append to `scripts/lib/seed-core.mjs`)**

```js
/**
 * Append any widget missing from the seed on rows below the existing items,
 * DEFAULT_ITEM_SIZE each, three per row, config null (renders as "not
 * configured"). This is how new widgets automatically join the dashboard.
 */
export const autoAddWidgets = (seed, allWidgets) => {
    const present = new Set(seed.items.map((item) => item.widget))
    const missing = allWidgets
        .filter((widget) => !present.has(widget))
        .sort()
    if (missing.length === 0) {
        return { seed, added: [] }
    }
    const { w, h } = DEFAULT_ITEM_SIZE
    const perRow = Math.floor(GRID_COLUMNS / w)
    const nextY = seed.items.reduce(
        (max, item) => Math.max(max, item.layout.y + item.layout.h),
        0
    )
    const addedItems = missing.map((widget, index) => ({
        id: generateUid(),
        widget,
        layout: {
            x: (index % perRow) * w,
            y: nextY + Math.floor(index / perRow) * h,
            w,
            h,
        },
        config: null,
    }))
    return {
        seed: { ...seed, items: [...seed.items, ...addedItems] },
        added: missing,
    }
}

export const sortItems = (items) =>
    [...items].sort(
        (a, b) =>
            a.layout.y - b.layout.y ||
            a.layout.x - b.layout.x ||
            a.widget.localeCompare(b.widget)
    )

export const buildDashboardItems = (seed) =>
    seed.items.map((item) => ({
        id: item.id,
        type: 'APP',
        appKey: widgetAppKey(item.widget),
        x: item.layout.x,
        y: item.layout.y,
        w: item.layout.w,
        h: item.layout.h,
    }))

export const serializeSeed = (seed) =>
    `${JSON.stringify(
        { dashboard: seed.dashboard, items: sortItems(seed.items) },
        null,
        4
    )}\n`
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/seed-core.mjs scripts/lib/seed-core.test.mjs
git commit -m "Add seed-core auto-add placement, dashboard item mapping, stable serialization"
```

---

### Task 4: seed-core — merge a pulled live dashboard into a seed

**Files:**
- Modify: `scripts/lib/seed-core.mjs` (append one function)
- Test: `scripts/lib/seed-core.test.mjs` (append tests)

**Interfaces:**
- Consumes: `appKeyToWidget`, `sortItems` from Tasks 2–3.
- Produces:
  - `mergePulledDashboard({ seed, dashboard, configs, knownWidgets }) → { seed, skipped: string[] }` where `dashboard` is the live API object (`{ name, dashboardItems: [{ id, type, appKey, x, y, w, h }] }`), `configs` maps item id → stored config object, `knownWidgets` is `discoverWidgets()` output. Live name is adopted; `seed.dashboard.code` is kept (it is the lookup key); non-widget items are skipped and reported.

- [ ] **Step 1: Write the failing tests**

Append to `scripts/lib/seed-core.test.mjs` (extend the import with `mergePulledDashboard`):

```js
test('mergePulledDashboard converts live items, keeps code, adopts live name', () => {
    const { seed, skipped } = mergePulledDashboard({
        seed: validSeed(),
        dashboard: {
            name: 'CHAP Widgets (renamed)',
            dashboardItems: [
                {
                    id: 'c1234567890',
                    type: 'APP',
                    appKey: 'chap-widget-outbreak-alerts',
                    x: 0,
                    y: 10,
                    w: 20,
                    h: 20,
                },
                {
                    id: 'd1234567890',
                    type: 'APP',
                    appKey: 'chap-widget-model-status',
                    x: 0,
                    y: 0,
                    w: 20,
                    h: 10,
                },
                { id: 'e1234567890', type: 'VISUALIZATION' },
                {
                    id: 'f1234567890',
                    type: 'APP',
                    appKey: 'line-listing',
                    x: 20,
                    y: 0,
                    w: 20,
                    h: 10,
                },
            ],
        },
        configs: { d1234567890: { version: 1, jobLimit: 10 } },
        knownWidgets: ['outbreak-alerts', 'model-status'],
    })
    assert.equal(seed.dashboard.name, 'CHAP Widgets (renamed)')
    assert.equal(seed.dashboard.code, 'CHAP_WIDGETS')
    assert.deepEqual(skipped, ['VISUALIZATION', 'line-listing'])
    assert.deepEqual(seed.items, [
        {
            id: 'd1234567890',
            widget: 'model-status',
            layout: { x: 0, y: 0, w: 20, h: 10 },
            config: { version: 1, jobLimit: 10 },
        },
        {
            id: 'c1234567890',
            widget: 'outbreak-alerts',
            layout: { x: 0, y: 10, w: 20, h: 20 },
            config: null,
        },
    ])
    validateSeed(seed)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/`
Expected: FAIL — `mergePulledDashboard` is not exported.

- [ ] **Step 3: Implement (append to `scripts/lib/seed-core.mjs`)**

```js
/**
 * Rebuild the seed from a live dashboard: item ids and layout come from the
 * instance, configs from the datastore (missing → null). Items that are not
 * chap widgets are skipped and reported so the seed stays widgets-only. The
 * seed's code is preserved (it is the upsert key); the live name is adopted.
 */
export const mergePulledDashboard = ({
    seed,
    dashboard,
    configs,
    knownWidgets,
}) => {
    const skipped = []
    const items = []
    for (const item of dashboard.dashboardItems ?? []) {
        const widget = item.type === 'APP' ? appKeyToWidget(item.appKey) : null
        if (!widget || !knownWidgets.includes(widget)) {
            skipped.push(item.appKey ?? item.type)
            continue
        }
        items.push({
            id: item.id,
            widget,
            layout: { x: item.x, y: item.y, w: item.w, h: item.h },
            config: configs[item.id] ?? null,
        })
    }
    return {
        seed: {
            dashboard: {
                name: dashboard.name,
                code: seed.dashboard.code,
            },
            items: sortItems(items),
        },
        skipped,
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/seed-core.mjs scripts/lib/seed-core.test.mjs
git commit -m "Add seed-core merge of pulled live dashboards"
```

---

### Task 5: `scripts/seed.mjs` push mode + pnpm scripts

The CLI and DHIS2 API layer. After this task `pnpm seed:local` works end to end (create/update dashboard + write configs), bootstrapping `dashboard.seed.json` on first run.

**Files:**
- Create: `scripts/seed.mjs`
- Modify: `package.json` (three scripts)

**Interfaces:**
- Consumes: everything produced by Tasks 1–4 (`resolveTarget`, `discoverWidgets`, seed-core exports).
- Produces: CLI `node scripts/seed.mjs [local|demo|url] [--pull]` (pull wired in Task 6 — this task exits with a "pull not implemented yet" error for `--pull`); pnpm scripts `seed:local`, `seed:demo`, `seed:pull`; the repo-root file `dashboard.seed.json` (created on first push).

- [ ] **Step 1: Implement `scripts/seed.mjs`**

```js
#!/usr/bin/env node
/**
 * Seed the "CHAP Widgets" dashboard on a DHIS2 instance from
 * dashboard.seed.json — or pull the live dashboard back into the file.
 * Spec: docs/superpowers/specs/2026-09-01-dashboard-seed-design.md
 *
 * Usage:
 *   node scripts/seed.mjs [local|demo|url]           # push (default: local)
 *   node scripts/seed.mjs --pull [local|demo|url]    # pull layout + configs
 *
 * Push REPLACES the seed-owned dashboard (found by dashboard.code) — its
 * layout and every item's datastore config. It never touches other
 * dashboards. New widgets under widgets/ are auto-appended to the seed.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
    DEFAULT_DASHBOARD,
    autoAddWidgets,
    buildDashboardItems,
    serializeSeed,
    validateSeed,
} from './lib/seed-core.mjs'
import { resolveTarget } from './lib/targets.mjs'
import { discoverWidgets } from './lib/widgets.mjs'

// Must match DATASTORE_NAMESPACE in
// packages/shared/src/config/useDashboardItemConfig.ts
const DATASTORE_NAMESPACE = 'chap-widgets'

const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..'
)
const seedPath = path.join(repoRoot, 'dashboard.seed.json')
const widgetsDir = path.join(repoRoot, 'widgets')

const args = process.argv.slice(2)
const pullMode = args.includes('--pull')
const [target = 'local'] = args.filter((arg) => !arg.startsWith('--'))

let resolved
try {
    resolved = resolveTarget(target)
} catch (error) {
    console.error(`seed ${target}: ${error.message}`)
    process.exit(1)
}
const { url, username, password } = resolved
if (!username || !password) {
    console.error('seed: set D2_USERNAME and D2_PASSWORD for the target instance')
    process.exit(1)
}

const api = (pathname, { method = 'GET', body } = {}) =>
    fetch(`${url}/api/${pathname}`, {
        method,
        headers: {
            Authorization: `Basic ${Buffer.from(
                `${username}:${password}`
            ).toString('base64')}`,
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    })

const apiJson = async (pathname, options = {}) => {
    const response = await api(pathname, options)
    if (!response.ok) {
        const text = await response.text()
        throw new Error(
            `${options.method ?? 'GET'} /api/${pathname} → ${response.status}: ${text.slice(0, 500)}`
        )
    }
    return response.json()
}

const loadSeed = () => {
    if (!existsSync(seedPath)) {
        return { dashboard: { ...DEFAULT_DASHBOARD }, items: [] }
    }
    return JSON.parse(readFileSync(seedPath, 'utf8'))
}

const findDashboardId = async (code) => {
    const data = await apiJson(
        `dashboards.json?filter=code:eq:${code}&fields=id`
    )
    return data.dashboards?.[0]?.id ?? null
}

// POST creates the datastore key; on conflict (key exists) fall back to PUT.
const upsertConfig = async (itemId, config) => {
    const resource = `dataStore/${DATASTORE_NAMESPACE}/${itemId}`
    const created = await api(resource, { method: 'POST', body: config })
    if (created.ok) {
        return
    }
    const updated = await api(resource, { method: 'PUT', body: config })
    if (!updated.ok) {
        const text = await updated.text()
        throw new Error(`PUT /api/${resource} → ${updated.status}: ${text.slice(0, 300)}`)
    }
}

const push = async () => {
    const { seed, added } = autoAddWidgets(
        loadSeed(),
        discoverWidgets(widgetsDir)
    )
    validateSeed(seed)
    writeFileSync(seedPath, serializeSeed(seed))
    if (added.length > 0) {
        console.log(`▸ Added to dashboard.seed.json: ${added.join(', ')}`)
    }

    const payload = {
        name: seed.dashboard.name,
        code: seed.dashboard.code,
        sharing: { public: 'r-------' },
        dashboardItems: buildDashboardItems(seed),
    }
    const existingId = await findDashboardId(seed.dashboard.code)
    if (existingId) {
        await apiJson(`dashboards/${existingId}`, {
            method: 'PUT',
            body: { ...payload, id: existingId },
        })
        console.log(`▸ Updated dashboard "${seed.dashboard.name}" (${existingId}) on ${url}`)
    } else {
        await apiJson('dashboards', { method: 'POST', body: payload })
        console.log(`▸ Created dashboard "${seed.dashboard.name}" on ${url}`)
    }

    const results = []
    for (const item of seed.items) {
        if (item.config === null) {
            results.push({ widget: item.widget, status: 'no config (renders as unconfigured)' })
            continue
        }
        try {
            await upsertConfig(item.id, item.config)
            results.push({ widget: item.widget, status: 'config written' })
        } catch (error) {
            results.push({ widget: item.widget, status: `FAILED: ${error.message}` })
        }
    }
    console.log('\nSeed summary:')
    for (const { widget, status } of results) {
        console.log(`  ${status.startsWith('FAILED') ? '❌' : '✅'} ${widget} — ${status}`)
    }
    if (results.some(({ status }) => status.startsWith('FAILED'))) {
        process.exit(1)
    }
}

const pull = async () => {
    console.error('seed: --pull is not implemented yet')
    process.exit(1)
}

const main = pullMode ? pull : push
main().catch((error) => {
    console.error(`seed: ${error.message}`)
    process.exit(1)
})
```

- [ ] **Step 2: Add the pnpm scripts**

In root `package.json` scripts (next to `deploy:local`/`deploy:demo`):

```json
"seed:local": "node scripts/seed.mjs local",
"seed:demo": "node scripts/seed.mjs demo",
"seed:pull": "node scripts/seed.mjs --pull"
```

(`pnpm seed:pull demo` appends `demo` as the positional target; with no extra arg the target defaults to `local`.)

- [ ] **Step 3: Static checks**

Run: `node --test scripts/` then `pnpm lint`
Expected: tests pass; lint/prettier clean (run `pnpm format` if prettier objects).

- [ ] **Step 4: Live smoke test against the local instance**

Precondition: local DHIS2 at http://localhost:8090 with the widgets installed. Check with:

```bash
curl -sf -u admin:district 'http://localhost:8090/api/apps' | grep -o '"key":"chap-widget-[a-z-]*"' | sort -u
```

Expected: four distinct `chap-widget-*` keys. If the apps are missing, run `pnpm deploy:local` first.

Then run: `pnpm seed:local`
Expected: `dashboard.seed.json` is created at the repo root with all four widgets auto-added (`config: null`, 3 per row: three at y=0, one at y=20); output reports the dashboard created and four "no config" lines; exit 0.

Verify on the instance:

```bash
curl -sf -u admin:district 'http://localhost:8090/api/dashboards.json?filter=code:eq:CHAP_WIDGETS&fields=id,name,dashboardItems[id,type,appKey,x,y,w,h]'
```

Expected: one dashboard named "CHAP Widgets" with 4 `APP` items whose `appKey`/x/y/w/h match `dashboard.seed.json` exactly.

Then run `pnpm seed:local` again.
Expected: "Updated dashboard" path, no new items in the seed file, exit 0 (idempotent).

- [ ] **Step 5: Commit**

```bash
git add scripts/seed.mjs package.json dashboard.seed.json
git commit -m "Add seed script push mode: upsert CHAP Widgets dashboard + item configs from dashboard.seed.json"
```

---

### Task 6: pull mode

**Files:**
- Modify: `scripts/seed.mjs` (replace the `pull` stub)

**Interfaces:**
- Consumes: `mergePulledDashboard`, `serializeSeed`, `validateSeed`, `DEFAULT_DASHBOARD` (already imported or added to the seed-core import), plus `api`/`apiJson`/`loadSeed` from Task 5.
- Produces: working `pnpm seed:pull [local|demo|url]` that rewrites `dashboard.seed.json` from the live dashboard.

- [ ] **Step 1: Implement pull (replace the stub in `scripts/seed.mjs`)**

Add `mergePulledDashboard` to the `./lib/seed-core.mjs` import, then:

```js
const pull = async () => {
    const seed = loadSeed()
    const code = seed.dashboard?.code ?? DEFAULT_DASHBOARD.code
    const data = await apiJson(
        `dashboards.json?filter=code:eq:${code}&fields=id,name,code,dashboardItems[id,type,appKey,x,y,w,h]`
    )
    const dashboard = data.dashboards?.[0]
    if (!dashboard) {
        console.error(
            `seed pull: no dashboard with code ${code} on ${url} — push first (pnpm seed:${target === 'local' ? 'local' : 'demo'})`
        )
        process.exit(1)
    }

    const configs = {}
    for (const item of dashboard.dashboardItems ?? []) {
        const response = await api(`dataStore/${DATASTORE_NAMESPACE}/${item.id}`)
        if (response.ok) {
            configs[item.id] = await response.json()
        } else if (response.status !== 404) {
            const text = await response.text()
            throw new Error(
                `GET dataStore/${DATASTORE_NAMESPACE}/${item.id} → ${response.status}: ${text.slice(0, 300)}`
            )
        }
    }

    const { seed: next, skipped } = mergePulledDashboard({
        seed,
        dashboard,
        configs,
        knownWidgets: discoverWidgets(widgetsDir),
    })
    validateSeed(next)
    writeFileSync(seedPath, serializeSeed(next))
    for (const label of skipped) {
        console.warn(`▸ Skipped non-widget dashboard item: ${label}`)
    }
    console.log(
        `✅ Pulled ${next.items.length} item(s) from "${dashboard.name}" (${url}) into dashboard.seed.json`
    )
}
```

Note: if someone placed the same widget twice on the live dashboard, `validateSeed` rejects the pull with a pointed duplicate-widget error — that is intentional (the seed holds one item per widget).

- [ ] **Step 2: Static checks**

Run: `node --test scripts/` then `pnpm lint`
Expected: pass.

- [ ] **Step 3: Live convergence check**

```bash
pnpm seed:local && pnpm seed:pull && git diff --exit-code dashboard.seed.json
```

Expected: exit 0 — push → pull produces no diff (the round-trip converges).

- [ ] **Step 4: Live nudge check (layout changes flow back)**

Fetch the dashboard, change one item's `x` via the API, pull, and inspect the diff:

```bash
DASH=$(curl -sf -u admin:district 'http://localhost:8090/api/dashboards.json?filter=code:eq:CHAP_WIDGETS&fields=id,name,code,sharing,dashboardItems[id,type,appKey,x,y,w,h]' | node -e 'let s="";process.stdin.on("data",(c)=>s+=c).on("end",()=>{const d=JSON.parse(s).dashboards[0];d.dashboardItems[0].x+=1;console.log(JSON.stringify(d))})')
curl -sf -u admin:district -X PUT -H 'Content-Type: application/json' -d "$DASH" "http://localhost:8090/api/dashboards/$(node -e "console.log(JSON.parse(process.argv[1]).id)" "$DASH")" > /dev/null
pnpm seed:pull
git diff dashboard.seed.json
```

Expected: the diff shows exactly one `"x"` value changed by +1, nothing else. Then restore:

```bash
git checkout dashboard.seed.json && pnpm seed:local
```

- [ ] **Step 5: Commit**

```bash
git add scripts/seed.mjs
git commit -m "Add seed pull mode: capture live dashboard layout and configs into dashboard.seed.json"
```

---

### Task 7: CI step + documentation

**Files:**
- Modify: `.github/workflows/ci.yml` (one step in the deploy-demo job)
- Modify: `CLAUDE.md` (commands + repo map + rules)
- Modify: `README.md` (mention the seed workflow where dashboards/deploys are described)

**Interfaces:**
- Consumes: `pnpm seed:demo` from Task 5.
- Produces: demo dashboard refreshed on every push to main; docs of record updated.

- [ ] **Step 1: Add the CI step**

In `.github/workflows/ci.yml`, deploy-demo job, insert between the "Deploy all widgets to the demo instance" step and the "Demo deploy skipped" step:

```yaml
            - name: Seed the demo dashboard
              if: vars.DHIS2_DEMO_URL != ''
              env:
                  DHIS2_DEMO_URL: ${{ vars.DHIS2_DEMO_URL }}
                  D2_USERNAME: ${{ secrets.DHIS2_DEMO_USERNAME }}
                  D2_PASSWORD: ${{ secrets.DHIS2_DEMO_PASSWORD }}
              run: pnpm seed:demo
```

(Widgets must be installed before the dashboard references their app keys — hence after the deploy step.)

- [ ] **Step 2: Update CLAUDE.md**

- Commands block — add after the deploy lines:

```
pnpm seed:local | pnpm seed:demo    # push dashboard.seed.json → seed-owned "CHAP Widgets" dashboard (layout + item configs); auto-appends new widgets
pnpm seed:pull [local|demo|url]     # pull the live "CHAP Widgets" dashboard back into dashboard.seed.json
```

- Repo map — add a line: `dashboard.seed.json     Source of truth for the seed-owned "CHAP Widgets" dashboard (layout + per-item config, stable item UIDs)`.
- The rules — add rule 7: seed semantics (push overwrites the seed-owned dashboard only; the "Test" dashboard `OHOPHFFLD2N` stays a manual sandbox; the workflow for layout changes is arrange on the real dashboard → `pnpm seed:pull` → commit).
- Local dev loop — mention that `pnpm seed:local` sets up the "CHAP Widgets" dashboard in one command.
- Also note in CI description that main pushes run `seed:demo` after `deploy:demo`.

- [ ] **Step 3: Update README.md**

In the quick-start/deploy section, add the one-command dashboard setup (`pnpm seed:local`) and the pull-commit-push-to-demo workflow, 3–6 lines in the existing tone.

- [ ] **Step 4: Verify**

Run: `pnpm lint` (prettier covers YAML/MD)
Expected: clean. CI behavior itself is exercised on the next push to main (currently skipped until demo secrets are set — same guard as deploy).

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml CLAUDE.md README.md
git commit -m "Seed the demo dashboard from CI and document the seed workflow"
```

---

### Task 8: End-to-end acceptance round-trip (spec's verification section)

No new code — this executes the spec's acceptance checklist against localhost:8090 and leaves the repo with a real, configured seed committed.

**Files:**
- Modify: `dashboard.seed.json` (captured configs via pull)

**Interfaces:**
- Consumes: `pnpm seed:local`, `pnpm seed:pull` (Tasks 5–6).
- Produces: a committed seed with at least one configured widget; verified convergence.

- [ ] **Step 1: Full verify + fresh push**

```bash
pnpm verify && pnpm seed:local
```

Expected: verify green; push reports success for all four widgets.

- [ ] **Step 2: Browser check — dashboard renders**

Open `http://localhost:8090/dhis-web-dashboard/#/` (log in admin/district), navigate to the "CHAP Widgets" dashboard. Using browser automation (playwright/chrome-devtools MCP): use a tall viewport (e.g. 1400×2400) — the Dashboard app lazy-mounts items only when scrolled into view. Expected: all four items present at the seeded positions, each showing its "not configured" card (no crashes, no error boundaries).

- [ ] **Step 3: Configure one widget through the real UI, pull, inspect**

In dashboard edit mode, configure the `model-status` item (it needs no CHAP data selections beyond defaults — set the job limit and save), switch to view mode, confirm it renders data. Then:

```bash
pnpm seed:pull
git diff dashboard.seed.json
```

Expected: the diff shows exactly that item's `config` going from `null` to the saved config object (schema fields per `widgets/model-status/src/config.ts`). If the dashboard item was also moved/resized during editing, those layout changes appear too — that is correct pull behavior.

- [ ] **Step 4: Convergence**

```bash
pnpm seed:local && pnpm seed:pull && git diff --exit-code dashboard.seed.json
```

Expected: exit 0.

- [ ] **Step 5: Commit the captured seed**

```bash
git add dashboard.seed.json
git commit -m "Capture configured CHAP Widgets dashboard layout in the seed"
```

- [ ] **Step 6: Report**

Summarize for the user: what was verified (create, update, pull, convergence, browser render), the known limitation (config ids are instance-specific until per-target overrides exist), and that phase 2 (the board harness) is next and needs its own short design round. Do not push anything.
