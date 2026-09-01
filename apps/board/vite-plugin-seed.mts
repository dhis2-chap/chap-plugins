import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'
import {
    applyBoardLayout,
    applyCapturedConfigs,
    autoAddWidgets,
    serializeSeed,
    validateSeed,
} from '../../scripts/lib/seed-core.mjs'
import { resolveTarget } from '../../scripts/lib/targets.mjs'
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
const captureConfigs = async (seed: {
    items: { id: string; widget: string }[]
}) => {
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
    res: {
        statusCode: number
        setHeader: (k: string, v: string) => void
        end: (b: string) => void
    },
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
