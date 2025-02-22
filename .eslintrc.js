module.exports = {
  env: {
    node: true, // ✅ Enables Node.js global variables like `process` & `__dirname`
    es2021: true,
  },
  extends: [
    'eslint:recommended',
    'airbnb-base',
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  rules: {
    'no-console': 'off', // ✅ Allow `console.log`
    'no-undef': 'off', // ✅ Allow `process` & `__dirname`
    'no-unused-vars': 'warn', // ✅ Warn instead of error for unused variables
  },
};
