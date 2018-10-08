const { OAuth2 } = require('oauth');
const Splitwise = require('../src');
const R = require('../src/ramda.js');

jest.mock('oauth');

beforeEach(() => {
  OAuth2.mockClear();
});

test('creates splitwise compatible parameters', () => {
  expect(OAuth2).not.toHaveBeenCalled();

  Splitwise({
    consumerKey: 'your key here',
    consumerSecret: 'your secret here',
  });

  expect(OAuth2).toHaveBeenCalledTimes(1);

  const mockOAuthInstance = OAuth2.mock.instances[0];
  const mockGetOAuthAccessToken = mockOAuthInstance.getOAuthAccessToken;

  expect(mockGetOAuthAccessToken).toHaveBeenCalledTimes(1);
});

test('calls the provided logger', () => {
  const mockLogger = jest.fn();

  // ref: https://github.com/facebook/jest/issues/6329
  const mockWrapper = (...args) => mockLogger(args);

  Splitwise({
    consumerKey: 'your key here',
    consumerSecret: 'your secret here',
    logger: mockWrapper,
  });

  expect(mockLogger).toHaveBeenCalledTimes(1);
});
