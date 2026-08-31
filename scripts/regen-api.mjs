#!/usr/bin/env node
/**
 * Regenerate the CHAP OpenAPI client in packages/shared/src/chap-api from a
 * running chap-core server's OpenAPI spec.
 *
 * Usage: pnpm regen-api [spec-url]      (default: http://localhost:8000/openapi.json)
 *
 * scripts/chap-api-request.ts is copied verbatim to chap-api/core/request.ts
 * by the generator (--request). It adds a p-queue throttle because the DHIS2
 * Route API returns 503 under concurrent load. Same setup as chap-frontend's
 * packages/ui "generate" script.
 */
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..'
)
const specUrl = process.argv[2] ?? 'http://localhost:8000/openapi.json'

execFileSync(
    'pnpm',
    [
        'dlx',
        'openapi-typescript-codegen@0.29.0',
        '--input',
        specUrl,
        '--output',
        path.join(repoRoot, 'packages/shared/src/chap-api'),
        '--request',
        path.join(repoRoot, 'scripts/chap-api-request.ts'),
    ],
    { cwd: repoRoot, stdio: 'inherit' }
)

console.log(
    '✅ Regenerated packages/shared/src/chap-api — run `pnpm verify` to confirm widgets still compile'
)
