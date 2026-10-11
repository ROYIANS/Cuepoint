import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import sonar from 'eslint-plugin-sonarjs';
import {fileURLToPath} from 'node:url';
export default [{
  files: ['src/**/*.ts', 'renderer/**/*.ts'],
  languageOptions: {parser: tseslint.parser, parserOptions: {project: ['./tsconfig.json'], tsconfigRootDir: fileURLToPath(new URL('.', import.meta.url))}},
  plugins: {'@typescript-eslint': tseslint.plugin, sonarjs: sonar},
  rules: {
    ...js.configs.recommended.rules,
    ...tseslint.configs.recommendedTypeChecked.reduce((r, c) => ({...r, ...c.rules}), {}),
    'no-undef': 'off', 'no-unused-vars': 'off', '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/switch-exhaustiveness-check': 'error',
    '@typescript-eslint/only-throw-error': ['error', {allowThrowingAny: false, allowThrowingUnknown: false, allowRethrowing: true}],
    'sonarjs/no-duplicated-branches': 'error', 'sonarjs/no-identical-conditions': 'error',
    complexity: ['warn', 20], 'max-depth': ['warn', 4], 'sonarjs/cognitive-complexity': ['warn', 20]
  }
}];
