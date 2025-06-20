/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: vitest.config.ts
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-05-04
 * Last modified: 2025-05-04
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'url';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        include: ['**/__tests__/**/*.{js,jsx,ts,tsx}'],
        exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
    },
    resolve: {
        alias: {
            '@Utils': fileURLToPath(new URL('./src/Utils', import.meta.url)),
            '@Editor': fileURLToPath(new URL('./src/components/TracksEditor', import.meta.url)),
            '@Components': fileURLToPath(new URL('./src/components', import.meta.url)),
            '@Core': fileURLToPath(new URL('./src/core', import.meta.url)),
        },
    },
});