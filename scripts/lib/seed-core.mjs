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

const UID_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
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
        if (
            layout.x < 0 ||
            layout.w < 1 ||
            layout.x + layout.w > GRID_COLUMNS
        ) {
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

/**
 * Append any widget missing from the seed on rows below the existing items,
 * DEFAULT_ITEM_SIZE each, three per row, config null (renders as "not
 * configured"). This is how new widgets automatically join the dashboard.
 */
export const autoAddWidgets = (seed, allWidgets) => {
    const present = new Set(seed.items.map((item) => item.widget))
    const missing = allWidgets.filter((widget) => !present.has(widget)).sort()
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
        width: item.layout.w,
        height: item.layout.h,
    }))

export const serializeSeed = (seed) =>
    `${JSON.stringify(
        { dashboard: seed.dashboard, items: sortItems(seed.items) },
        null,
        4
    )}\n`

/**
 * Rebuild the seed from a live dashboard: item ids and layout come from the
 * instance, configs from the datastore (missing → null). The live item's
 * DHIS2 `width`/`height` fields map to the seed's internal `w`/`h` layout
 * keys. Items that are not chap widgets are skipped and reported so the
 * seed stays widgets-only. `code` is the dashboard code to keep (it is the
 * upsert key, so it does not come from the live dashboard); the live name is
 * adopted. Takes `code` directly rather than a whole seed object — pull must
 * work even when the local seed file is missing or broken, so this function
 * has no other dependency on it.
 */
export const mergePulledDashboard = ({
    code,
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
            layout: { x: item.x, y: item.y, w: item.width, h: item.height },
            config: configs[item.id] ?? null,
        })
    }
    return {
        seed: {
            dashboard: { name: dashboard.name, code },
            items: sortItems(items),
        },
        skipped,
    }
}

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
