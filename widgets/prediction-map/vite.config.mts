import path from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
    server: {
        fs: {
            // Allow serving @chap-widgets/shared source from the workspace root
            allow: [path.resolve(__dirname, '../..')],
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
    clearScreen: false,
})
