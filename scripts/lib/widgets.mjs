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
