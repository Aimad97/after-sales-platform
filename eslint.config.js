import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: ['node_modules/**', 'public/build/**', 'vendor/**'],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['resources/js/**/*.{js,ts,tsx}'],
        languageOptions: {
            globals: globals.browser,
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            ...reactHooks.configs.flat.recommended.rules,
            // React Hook Form subscriptions are safe here; the optional React Compiler is not enabled.
            'react-hooks/incompatible-library': 'off',
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            'no-console': 'error',
            // Laravel/Vite supports colocated schemas and components without enforcing refresh boundaries.
            'react-refresh/only-export-components': 'off',
        },
    },
    {
        files: ['vite.config.js', 'eslint.config.js', 'prettier.config.js'],
        languageOptions: {
            globals: globals.node,
        },
    },
    prettier,
);
