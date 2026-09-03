#!/usr/bin/env node
/**
 * Scaffold a new dashboard widget from widgets/_template.
 *
 * Usage: pnpm new-widget <kebab-case-name>
 * Example: pnpm new-widget outbreak-alerts
 *
 * Copies widgets/_template to widgets/<name>, substitutes the widget name in
 * package.json / d2.config.js / source files, and runs pnpm install.
 */
import { execFileSync } from 'node:child_process'
import {
    cpSync,
    existsSync,
    readdirSync,
    readFileSync,
    statSync,
    writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..'
)
const templateDir = path.join(repoRoot, 'widgets', '_template')

const name = process.argv[2]
if (!name || !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) {
    console.error(
        'Usage: pnpm new-widget <kebab-case-name>   e.g. pnpm new-widget outbreak-alerts'
    )
    process.exit(1)
}

const targetDir = path.join(repoRoot, 'widgets', name)
if (existsSync(targetDir)) {
    console.error(`new-widget: widgets/${name} already exists`)
    process.exit(1)
}

const titleName = name
    .split('-')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ')

// Never copy generated/installed artifacts
const EXCLUDED = new Set(['node_modules', 'build', '.d2', 'i18n'])

cpSync(templateDir, targetDir, {
    recursive: true,
    filter: (source) =>
        !EXCLUDED.has(path.basename(source)) &&
        !source.includes(`${path.sep}src${path.sep}locales`),
})

// Order matters: longest placeholder first
const REPLACEMENTS = [
    ['chap-widget-template', `chap-widget-${name}`],
    ['@chap-widgets/template', `@chap-widgets/${name}`],
    ['CHAP · Template', `CHAP · ${titleName}`],
    ['Template widget', `${titleName} widget`],
    ['deploy:local template', `deploy:local ${name}`],
]

const substituteInTree = (dir) => {
    for (const entry of readdirSync(dir)) {
        const entryPath = path.join(dir, entry)
        if (statSync(entryPath).isDirectory()) {
            substituteInTree(entryPath)
            continue
        }
        let content = readFileSync(entryPath, 'utf8')
        for (const [from, to] of REPLACEMENTS) {
            content = content.replaceAll(from, to)
        }
        writeFileSync(entryPath, content)
    }
}
substituteInTree(targetDir)

execFileSync('pnpm', ['install'], { cwd: repoRoot, stdio: 'inherit' })

console.log(`
✅ Created widgets/${name}

Next steps:
  1. Describe the widget's contract in widgets/${name}/README.md
  2. Define the config schema in widgets/${name}/src/config.ts
  3. Implement widgets/${name}/src/ConfigForm.tsx and src/WidgetView.tsx
  4. Develop:  pnpm --filter @chap-widgets/${name} start
  5. Check:    pnpm verify
  6. Deploy:   pnpm deploy:local ${name}
`)
