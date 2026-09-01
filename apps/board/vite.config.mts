import path from 'node:path'
import { defineConfig } from 'vite'
import { boardSeedPlugin } from './vite-plugin-seed.mts'

export default defineConfig({
    plugins: [boardSeedPlugin()],
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
        // One instance of these across board + glob-imported widget sources.
        // Only packages apps/board itself depends on can go here: Vite's
        // dedupe forces resolution through the config root's own node_modules,
        // so listing a widget-only dependency (e.g. @tanstack/react-query,
        // which apps/board doesn't declare) makes it unresolvable for every
        // widget rather than deduped — pnpm's content-addressable store
        // already gives that one instance for free across each widget's own
        // node_modules symlink, without needing to be listed here.
        dedupe: ['react', 'react-dom', '@dhis2/app-runtime', '@dhis2/ui'],
    },
    clearScreen: false,
})
