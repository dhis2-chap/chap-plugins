#!/usr/bin/env node
/**
 * Build and deploy dashboard widgets to a DHIS2 instance.
 *
 * Usage:
 *   node scripts/deploy.mjs local  [widget…]   # http://localhost:8090, admin/district
 *   node scripts/deploy.mjs demo   [widget…]   # $DHIS2_DEMO_URL, $D2_USERNAME/$D2_PASSWORD
 *   node scripts/deploy.mjs <url>  [widget…]   # explicit URL, $D2_USERNAME/$D2_PASSWORD
 *
 * With no widget names, every widget under widgets/ (except _template) is
 * built and deployed. Names are directory names, e.g. `prediction-chart`.
 * Pass --no-build to deploy existing build/bundle zips without rebuilding.
 * A widget counts as deployed when the app is installed on the instance:
 * d2-app-scripts also exits non-zero when only its post-upload launch-URL
 * smoke test failed, so failures are re-checked against /api/apps.
 * Pass --dashboard <name> to additionally create/overwrite a personal copy
 * of the seed dashboard named <name> (all widgets, seed layout + configs)
 * after a fully successful deploy — see scripts/seed.mjs.
 */
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchInstalledAppKeys } from './lib/apps.mjs'
import { parseDashboardFlag } from './lib/args.mjs'
import { widgetAppKey } from './lib/seed-core.mjs'
import { resolveTarget } from './lib/targets.mjs'
import { discoverWidgets } from './lib/widgets.mjs'

const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..'
)
const widgetsDir = path.join(repoRoot, 'widgets')

let dashboardName = null
let restArgs
try {
    ;({ name: dashboardName, rest: restArgs } = parseDashboardFlag(
        process.argv.slice(2)
    ))
} catch (error) {
    console.error(`deploy: ${error.message}`)
    process.exit(1)
}
const skipBuild = restArgs.includes('--no-build')
const positional = restArgs.filter((arg) => !arg.startsWith('--'))
const [target, ...requestedWidgets] = positional

if (!target) {
    console.error(
        'Usage: node scripts/deploy.mjs <local|demo|url> [widget…] [--no-build] [--dashboard <name>]'
    )
    process.exit(1)
}

let resolved
try {
    resolved = resolveTarget(target)
} catch (error) {
    console.error(`deploy ${target}: ${error.message}`)
    process.exit(1)
}
const { url, username, password } = resolved
if (!username || !password) {
    console.error(
        'deploy: set D2_USERNAME and D2_PASSWORD for the target instance'
    )
    process.exit(1)
}

const allWidgets = discoverWidgets(widgetsDir)

const widgets = requestedWidgets.length > 0 ? requestedWidgets : allWidgets
const unknown = widgets.filter((name) => !allWidgets.includes(name))
if (unknown.length > 0) {
    console.error(
        `deploy: unknown widget(s): ${unknown.join(', ')}. Available: ${allWidgets.join(', ')}`
    )
    process.exit(1)
}

const run = (command, commandArgs, cwd) =>
    execFileSync(command, commandArgs, {
        cwd,
        stdio: 'inherit',
        env: { ...process.env, CI: 'true' },
    })

/**
 * d2-app-scripts exits non-zero both when the upload failed and when only
 * its post-upload launch-URL smoke test did — instances that redirect
 * /api/apps/<key>/ to a login page (dropping basic auth across a scheme
 * change) fail that check with the app installed and working. Ask the app
 * store which one happened.
 */
const confirmInstalled = async (widget) => {
    let keys
    try {
        keys = await fetchInstalledAppKeys({ url, username, password })
    } catch (error) {
        return {
            ok: false,
            note: `upload failed (could not reach /api/apps: ${error.message})`,
        }
    }
    return keys.has(widgetAppKey(widget))
        ? { ok: true, note: 'installed (launch-URL check failed)' }
        : { ok: false, note: 'upload failed (app not installed)' }
}

const results = []
for (const widget of widgets) {
    const widgetDir = path.join(widgetsDir, widget)
    try {
        if (!skipBuild) {
            console.log(`\n▸ Building ${widget}…`)
            run('pnpm', ['run', 'build'], widgetDir)
        }
        console.log(`\n▸ Deploying ${widget} → ${url}`)
        run(
            'pnpm',
            [
                'exec',
                'd2-app-scripts',
                'deploy',
                url,
                '--username',
                username,
                '--password',
                password,
            ],
            widgetDir
        )
        results.push({ widget, ok: true })
    } catch {
        results.push({ widget, ...(await confirmInstalled(widget)) })
    }
}

console.log('\nDeploy summary:')
for (const { widget, ok, note } of results) {
    console.log(`  ${ok ? '✅' : '❌'} ${widget}${note ? ` — ${note}` : ''}`)
}

if (results.some((result) => !result.ok)) {
    if (dashboardName !== null) {
        console.error(
            `deploy: skipping dashboard "${dashboardName}" — not every widget deployed`
        )
    }
    process.exit(1)
}

if (dashboardName !== null) {
    console.log(`\n▸ Seeding dashboard "${dashboardName}" on ${url}`)
    try {
        run(
            'node',
            [
                path.join(repoRoot, 'scripts', 'seed.mjs'),
                target,
                '--dashboard',
                dashboardName,
            ],
            repoRoot
        )
    } catch {
        process.exit(1)
    }
}
