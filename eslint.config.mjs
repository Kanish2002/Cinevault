import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      '@next/next/no-img-element': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'playwright-report/**',
    'test-results/**',
    'node_modules/**',
    'public/sw.js',
    'next-env.d.ts',
  ]),
]);
