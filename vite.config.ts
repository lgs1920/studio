import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), cesium(),
        {
            name: 'markdown-loader',
            transform(code, id) {
                if (id.slice(-3) === '.md') {
                    return `export default ${JSON.stringify(code)};`
                }
            },
        },],
    define: {
        global: {},
    },
    build: {
        target: 'esnext'
    },
    resolve: {
        alias: [

            {
                find: '@Utils',
                replacement: Bun.fileURLToPath(new URL('./src/Utils', import.meta.url))
            },
            {
                find: '@Editor',
                replacement: Bun.fileURLToPath(new URL('./src/components/TracksEditor', import.meta.url))
            },
            {
                find: '@Components',
                replacement: Bun.fileURLToPath(new URL('./src/components', import.meta.url))
            },
            {
                find: '@Core',
                replacement: Bun.fileURLToPath(new URL('./src/core', import.meta.url))
            },
        ]
    }
})