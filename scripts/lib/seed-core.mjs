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
