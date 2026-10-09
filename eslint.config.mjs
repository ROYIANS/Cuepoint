import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
import sonar from 'eslint-plugin-sonarjs';
import {fileURLToPath} from 'node:url';

export default [
    {ignores: ['src/routeTree.gen.ts', 'vendor/**', 'node_modules/**', 'dist/**', '.trellis/**']},
    {
        files: ['src/**/*.{ts,tsx}'],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {project: ['./tsconfig.app.json'], tsconfigRootDir: fileURLToPath(new URL('.', import.meta.url)), ecmaFeatures: {jsx: true}},
        },
        plugins: {'@typescript-eslint': tseslint.plugin, 'react-hooks': hooks, sonarjs: sonar},
        rules: {
            ...js.configs.recommended.rules,
            ...tseslint.configs.recommendedTypeChecked.reduce((rules, config) => ({...rules, ...config.rules}), {}),
            'no-undef': 'off',
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/switch-exhaustiveness-check': 'error',
            // TanStack redirects are thrown Responses, with a declared framework contract.
            '@typescript-eslint/only-throw-error': ['error', {allowThrowingAny: false, allowThrowingUnknown: false, allowRethrowing: true, allow: [{from: 'package', name: 'Redirect', package: '@tanstack/router-core'}]}],
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'error',
            'sonarjs/no-duplicated-branches': 'error',
            'sonarjs/no-identical-conditions': 'error',
            'sonarjs/no-identical-functions': 'warn',
            'no-nested-ternary': 'warn',
            complexity: ['warn', 20],
            'max-depth': ['warn', 4],
            'sonarjs/cognitive-complexity': ['warn', 20],
        },
    },
];
