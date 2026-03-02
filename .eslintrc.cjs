/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: .eslintrc.cjs
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-06
 * Last modified: 2026-01-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
    "globals": {
      "lgs": false,
      "__":false
    },
  settings:    {
    'import/resolver': {
      alias: {
        map:        [
          ['@Utils', path.resolve(__dirname, './src/Utils')],
          ['@Editor', path.resolve(__dirname, './src/components/TracksEditor')],
          ['@Components', path.resolve(__dirname, './src/components')],
          ['@Core', path.resolve(__dirname, './src/core')],
        ],
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      },
    },
  },
}
