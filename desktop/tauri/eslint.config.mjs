import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import {fileURLToPath} from 'node:url';
import hooks from 'eslint-plugin-react-hooks';
import sonar from 'eslint-plugin-sonarjs';

export default [
    {files: ['scripts/**/*.mjs'], rules: js.configs.recommended.rules,
        languageOptions: {globals: {process:'readonly',console:'readonly',URL:'readonly',Buffer:'readonly',setTimeout:'readonly',clearTimeout:'readonly',fetch:'readonly',AbortController:'readonly',AbortSignal:'readonly'}}},
    {files: ['scripts/**/*.ts', 'ui/**/*.{ts,tsx}'],
        languageOptions: {parser: tseslint.parser, parserOptions: {
            project: ['./tsconfig.json'], tsconfigRootDir: fileURLToPath(new URL('.', import.meta.url)),
        }},
        plugins: {'@typescript-eslint': tseslint.plugin, 'react-hooks': hooks, sonarjs: sonar},
        rules: {
            ...js.configs.recommended.rules,
            ...tseslint.configs.recommendedTypeChecked.reduce((rules, config) => ({...rules, ...config.rules}), {}),
            'no-undef': 'off', 'no-unused-vars': 'off',
            '@typescript-eslint/switch-exhaustiveness-check': 'error',
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'error',
            'sonarjs/no-duplicated-branches': 'error',
            'sonarjs/no-identical-conditions': 'error',
        },
    },
];
