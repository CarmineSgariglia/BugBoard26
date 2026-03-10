import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

const appImports = ['@app/*', '**/app/*']
const pagesImports = ['@pages/*', '**/pages/*']
const featureImports = ['@features/*', '**/features/*']
const widgetImports = ['@widgets/*', '**/widgets/*']

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    files: ['src/features/**/*.{ts,tsx}', 'src/widgets/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: appImports,
              message: 'Features and widgets must not import from the app layer.',
            },
            {
              group: pagesImports,
              message: 'Features and widgets must not import from the pages layer.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/pages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: appImports,
              message: 'Pages must not import from the app layer.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [...appImports, ...pagesImports, ...featureImports, ...widgetImports],
              message: 'Shared must remain independent from app, pages, features, and widgets.',
            },
          ],
        },
      ],
    },
  },
])

