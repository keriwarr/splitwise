const { OAuth2 } = require('oauth');
const Splitwise = require('../src');

jest.mock('oauth');

beforeEach(() => {
  // Clear all instances and calls to constructor and all methods:
  OAuth2.mockClear();
});

test('creates splitwise compatible parameters', () => {
  // Show that mockClear() is working:
  expect(OAuth2).not.toHaveBeenCalled();

  Splitwise({
    consumerKey: 'your key here',
    consumerSecret: 'your secret here',
  });
  // Constructor should have been called again:
  expect(OAuth2).toHaveBeenCalledTimes(1);

  // mock.instances is available with automatic mocks:
  const mockOAuthInstance = OAuth2.mock.instances[0];
  const mockGetOAuthAccessToken = mockOAuthInstance.getOAuthAccessToken;
  // Equivalent to above check:
  expect(mockGetOAuthAccessToken).toHaveBeenCalledTimes(1);
});
