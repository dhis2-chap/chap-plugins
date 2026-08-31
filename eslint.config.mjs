import config from '@dhis2/config-eslint'
import { includeIgnoreFile } from '@eslint/compat'
import { defineConfig } from 'eslint/config'
import { fileURLToPath } from 'node:url'

const gitignorePath = fileURLToPath(new URL('.gitignore', import.meta.url))

export default defineConfig([
    includeIgnoreFile(gitignorePath, 'Imported .gitignore patterns'),
    {
        // Generated OpenAPI client — never lint, never edit by hand
        ignores: [
            'packages/shared/src/chap-api/**',
            'scripts/chap-api-request.ts',
        ],
    },
    {
        extends: [config],
        rules: {
            // TypeScript already validates named imports; the eslint import
            // resolver can't read @tanstack/react-query's package exports map
            'import/named': 'off',
        },
    },
])
