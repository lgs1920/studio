/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: eslint.config.mjs
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-11
 * Last modified: 2026-04-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { fixupConfigRules } from '@eslint/compat'
import { FlatCompat }       from '@eslint/eslintrc'
import js                   from '@eslint/js'
import tsParser             from '@typescript-eslint/parser'
import reactPlugin          from 'eslint-plugin-react'
import reactRefresh         from 'eslint-plugin-react-refresh'
import globals              from 'globals'
import path                 from 'node:path'
import { fileURLToPath }    from 'node:url'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

const sourceFiles = ['**/*.{js,jsx,ts,tsx}']
const tsFiles = ['**/*.{ts,tsx}']
const sharedLanguageOptions = {
    ecmaVersion:   'latest',
    sourceType:    'module',
    parserOptions: {
        ecmaFeatures: {
            jsx: true,
        },
    },
    globals:       {
        ...globals.browser,
        lgs: false,
        __:  false,
    },
}
const sharedSettings = {
    react: {
        version: 'detect',
    },
}

export default [{
    ignores: ["**/dist", "**/.eslintrc.cjs"],
}, ...fixupConfigRules(compat.extends(
    "eslint:recommended",
    'plugin:react-hooks/recommended',
)).map(config => ({
    ...config,
    files: sourceFiles,
})), {
    files: sourceFiles,

    plugins: {
        react: reactPlugin,
        "react-refresh": reactRefresh,
    },

    languageOptions: sharedLanguageOptions,
    settings:        sharedSettings,

    rules: {
        'react/jsx-uses-vars': 'error',
        "react-refresh/only-export-components": ["warn", {
            allowConstantExport: true,
        }],
    },
}, ...fixupConfigRules(compat.extends(
    'plugin:@typescript-eslint/recommended',
)).map(config => ({
    ...config,
    files: tsFiles,
})), {
    files:           tsFiles,
    languageOptions: {
        ...sharedLanguageOptions,
        parser: tsParser,
    },
    settings:        sharedSettings,
}];
