export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*', 'src/**/*', 'scripts/**/*', 'appwrite-functions/**/*.ts'],
  },
  {
    files: ['appwrite-functions/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'off',
    },
  },
];
