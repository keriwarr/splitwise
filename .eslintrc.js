module.exports = {
  extends: ['airbnb-base', 'prettier'],
  plugins: ['prettier'],
  rules: {
    'prettier/prettier': 'error',
    'max-len': ['error', { code: 80, ignoreUrls: true }],
  },
};
