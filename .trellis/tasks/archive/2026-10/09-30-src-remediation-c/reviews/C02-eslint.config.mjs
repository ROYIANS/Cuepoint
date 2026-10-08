import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
import sonar from 'eslint-plugin-sonarjs';
export default [
 {ignores:['src/routeTree.gen.ts','**/node_modules/**']},
 {files:['src/**/*.{ts,tsx}'],languageOptions:{parser:tseslint.parser,parserOptions:{project:['./tsconfig.app.json'],tsconfigRootDir:"/Users/xiaomengdao/WebstormProjects/aifenjing",ecmaFeatures:{jsx:true}}},plugins:{'@typescript-eslint':tseslint.plugin,'react-hooks':hooks,sonarjs:sonar},rules:{
 ...js.configs.recommended.rules,
 ...tseslint.configs.recommendedTypeChecked.reduce((a,c)=>({...a,...c.rules}),{}),
 'no-undef':'off','no-unused-vars':'off','@typescript-eslint/no-unused-vars':'off',
 'no-nested-ternary':'warn','complexity':['warn',20],'max-depth':['warn',4],
 '@typescript-eslint/switch-exhaustiveness-check':'error',
 'react-hooks/rules-of-hooks':'error','react-hooks/exhaustive-deps':'warn',
 'sonarjs/cognitive-complexity':['warn',20],
 'sonarjs/no-identical-functions':'warn','sonarjs/no-duplicated-branches':'warn'
 }}
];
