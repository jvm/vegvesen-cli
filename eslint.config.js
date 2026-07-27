import js from '@eslint/js';
import security from 'eslint-plugin-security';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  security.configs.recommended,
  {
    files: ['bin/**/*.js', 'src/**/*.ts', 'scripts/**/*.mjs', 'test/**/*.js', 'fixtures/**/*.mjs'],
    languageOptions: {
      globals: {
        Buffer: 'readonly',
        URL: 'readonly',
        AbortSignal: 'readonly',
        Blob: 'readonly',
        DOMException: 'readonly',
        FormData: 'readonly',
        Headers: 'readonly',
        Response: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly'
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      // Paths and regex fragments are constrained by command metadata or explicit validation.
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-non-literal-regexp': 'off',
      'security/detect-object-injection': 'off',
      'security/detect-unsafe-regex': 'off'
    }
  },
  {
    files: ['test/**/*.js'],
    rules: {
      'no-control-regex': 'off',
      'no-useless-escape': 'off'
    }
  }
);
