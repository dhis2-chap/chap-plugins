import path from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
    server: {
        fs: {
            // Widget + shared sources are imported from across the workspace
            allow: [path.resolve(__dirname, '../..')],
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
        // One instance of these across board + glob-imported widget sources
        dedupe: [
            'react',
            'react-dom',
            '@dhis2/app-runtime',
            '@dhis2/ui',
            '@tanstack/react-query',
        ],
    },
    clearScreen: false,
})
