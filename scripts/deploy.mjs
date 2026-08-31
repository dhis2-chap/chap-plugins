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
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..'
)
const widgetsDir = path.join(repoRoot, 'widgets')

const args = process.argv.slice(2)
const skipBuild = args.includes('--no-build')
const positional = args.filter((arg) => !arg.startsWith('--'))
const [target, ...requestedWidgets] = positional

if (!target) {
    console.error(
        'Usage: node scripts/deploy.mjs <local|demo|url> [widget…] [--no-build]'
    )
    process.exit(1)
}

const resolveTarget = () => {
    if (target === 'local') {
        return {
            url: process.env.DHIS2_LOCAL_URL ?? 'http://localhost:8090',
            username: process.env.D2_USERNAME ?? 'admin',
            password: process.env.D2_PASSWORD ?? 'district',
        }
    }
    if (target === 'demo') {
        const url = process.env.DHIS2_DEMO_URL
        if (!url) {
            console.error('deploy demo: DHIS2_DEMO_URL is not set')
            process.exit(1)
        }
        return {
            url,
            username: process.env.D2_USERNAME,
            password: process.env.D2_PASSWORD,
        }
    }
    return {
        url: target,
        username: process.env.D2_USERNAME,
        password: process.env.D2_PASSWORD,
    }
}

const { url, username, password } = resolveTarget()
if (!username || !password) {
    console.error(
        'deploy: set D2_USERNAME and D2_PASSWORD for the target instance'
    )
    process.exit(1)
}

const allWidgets = readdirSync(widgetsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== '_template')
    .filter((entry) =>
        existsSync(path.join(widgetsDir, entry.name, 'd2.config.js'))
    )
    .map((entry) => entry.name)

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
        results.push({ widget, ok: false })
    }
}

console.log('\nDeploy summary:')
for (const { widget, ok } of results) {
    console.log(`  ${ok ? '✅' : '❌'} ${widget}`)
}

if (results.some((result) => !result.ok)) {
    process.exit(1)
}
