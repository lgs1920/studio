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
