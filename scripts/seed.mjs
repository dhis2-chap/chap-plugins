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
    mergePulledDashboard,
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
const seedFileName = path.basename(seedPath)
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
    console.error(
        'seed: set D2_USERNAME and D2_PASSWORD for the target instance'
    )
    process.exit(1)
}

const api = (pathname, { method = 'GET', body } = {}) =>
    fetch(`${url}/api/${pathname}`, {
        method,
        headers: {
            Authorization: `Basic ${Buffer.from(
                `${username}:${password}`
            ).toString('base64')}`,
            ...(body !== undefined
                ? { 'Content-Type': 'application/json' }
                : {}),
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

// Parse errors read like "dashboard.seed.json: invalid JSON — <reason>" so
// they're identifiable regardless of which caller hit them.
const parseSeedFile = (text) => {
    try {
        return JSON.parse(text)
    } catch (error) {
        throw new Error(`${seedFileName}: invalid JSON — ${error.message}`)
    }
}

// Strict: the file must exist-and-be-valid, or be absent (bootstrap
// default). Used by push, which is about to write real state from it.
const loadSeed = () => {
    if (!existsSync(seedPath)) {
        return { dashboard: { ...DEFAULT_DASHBOARD }, items: [] }
    }
    const seed = parseSeedFile(readFileSync(seedPath, 'utf8'))
    validateSeed(seed)
    return seed
}

// Lenient: pull is the repair tool for a broken seed, so it must not refuse
// to run just because the local file is missing, unparseable, or has no
// usable dashboard.code — it falls back to the default code in every case.
const readLocalDashboardCode = () => {
    if (!existsSync(seedPath)) {
        return DEFAULT_DASHBOARD.code
    }
    let seed
    try {
        seed = parseSeedFile(readFileSync(seedPath, 'utf8'))
    } catch {
        return DEFAULT_DASHBOARD.code
    }
    const code = seed?.dashboard?.code
    return typeof code === 'string' && code.length > 0
        ? code
        : DEFAULT_DASHBOARD.code
}

const findDashboardId = async (code) => {
    const data = await apiJson(
        `dashboards.json?filter=code:eq:${code}&fields=id`
    )
    return data.dashboards?.[0]?.id ?? null
}

// POST creates the datastore key; on conflict (409, key already exists)
// fall back to PUT. Any other non-ok status is a real failure — surface it
// instead of masking it behind a PUT attempt.
const upsertConfig = async (itemId, config) => {
    const resource = `dataStore/${DATASTORE_NAMESPACE}/${itemId}`
    const created = await api(resource, { method: 'POST', body: config })
    if (created.ok) {
        return
    }
    if (created.status !== 409) {
        const text = await created.text()
        throw new Error(
            `POST /api/${resource} → ${created.status}: ${text.slice(0, 300)}`
        )
    }
    const updated = await api(resource, { method: 'PUT', body: config })
    if (!updated.ok) {
        const text = await updated.text()
        throw new Error(
            `PUT /api/${resource} → ${updated.status}: ${text.slice(0, 300)}`
        )
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
        console.log(
            `▸ Updated dashboard "${seed.dashboard.name}" (${existingId}) on ${url}`
        )
    } else {
        await apiJson('dashboards', { method: 'POST', body: payload })
        console.log(`▸ Created dashboard "${seed.dashboard.name}" on ${url}`)
    }

    const results = []
    for (const item of seed.items) {
        if (item.config === null) {
            results.push({
                widget: item.widget,
                status: 'no config (renders as unconfigured)',
            })
            continue
        }
        try {
            await upsertConfig(item.id, item.config)
            results.push({ widget: item.widget, status: 'config written' })
        } catch (error) {
            results.push({
                widget: item.widget,
                status: `FAILED: ${error.message}`,
            })
        }
    }
    console.log('\nSeed summary:')
    for (const { widget, status } of results) {
        console.log(
            `  ${status.startsWith('FAILED') ? '❌' : '✅'} ${widget} — ${status}`
        )
    }
    if (results.some(({ status }) => status.startsWith('FAILED'))) {
        process.exit(1)
    }
}

const pull = async () => {
    const code = readLocalDashboardCode()
    const data = await apiJson(
        `dashboards.json?filter=code:eq:${code}&fields=id,name,code,dashboardItems[id,type,appKey,x,y,width,height]`
    )
    const dashboard = data.dashboards?.[0]
    if (!dashboard) {
        console.error(
            `seed pull: no dashboard with code ${code} on ${url} — push first (node scripts/seed.mjs ${target})`
        )
        process.exit(1)
    }

    const configs = {}
    for (const item of dashboard.dashboardItems ?? []) {
        const response = await api(
            `dataStore/${DATASTORE_NAMESPACE}/${item.id}`
        )
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
        code,
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

const main = pullMode ? pull : push
main().catch((error) => {
    let message = `seed: ${error.message}`
    if (error.cause) {
        const detail = error.cause.code ?? error.cause.message ?? error.cause
        message += ` (${detail}, ${url})`
    }
    console.error(message)
    process.exit(1)
})
