import {defineConfig,loadEnv} from 'vite';
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
        target: 'esnext',
        chunkSizeWarningLimit:500000,
        //outDir:`dist-${Date.now()}`
        // rollupOptions: {
        //     output: {
        //         manualChunks(id: string) {
        //             if (id.indexOf('node_modules') !== -1) {
        //                 const basic = id.toString().split('node_modules/')[1];
        //                 const sub1 = basic.split('/')[0];
        //                 if (sub1 !== '.pnpm') {
        //                     return sub1.toString();
        //                 }
        //                 const name2 = basic.split('/')[1];
        //                 return name2.split('@')[name2[0] === '@' ? 1 : 0].toString();
        //             }
        //         }
        //     }
        // }

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