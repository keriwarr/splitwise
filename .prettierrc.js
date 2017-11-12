module.exports = {
  singleQuote: true,
  trailingComma: 'all',
  overrides: [
    {
      files: '.prettierrc',
      options: { parser: 'json' },
    },
  ],
};
