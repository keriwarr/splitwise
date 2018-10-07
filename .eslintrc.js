module.exports = {
  extends: [
    'airbnb-base',
    'plugin:node/recommended',
    'plugin:security/recommended',
  ],
  plugins: ['prettier', 'security'],
  parserOptions: {
    ecmaVersion: 6,
    sourceType: 'module',
    ecmaFeatures: {
      impliedStrict: true,
    },
  },
  env: {
    node: true,
    jest: true,
  },
  rules: {
    'comma-dangle': [
      'error',
      {
        arrays: 'always-multiline',
        objects: 'always-multiline',
        imports: 'always-multiline',
        exports: 'always-multiline',
        functions: 'never',
      },
    ],
  },
};
