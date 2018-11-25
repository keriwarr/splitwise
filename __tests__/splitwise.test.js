const { OAuth2 } = require('oauth');
const Splitwise = require('../src');

jest.mock('oauth');

describe('Splitwise', () => {
  beforeEach(() => {
    OAuth2.mockClear();
  });

  test('creates splitwise compatible parameters', () => {
    expect(OAuth2).not.toHaveBeenCalled();

    Splitwise({
      consumerKey: 'your key here',
      consumerSecret: 'your secret here',
    });

    const mockOAuthInstance = OAuth2.mock.instances[0];
    const mockGetOAuthAccessToken = mockOAuthInstance.getOAuthAccessToken;

    expect(OAuth2).toHaveBeenCalledTimes(1);
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

  test('throws without a consumer key or secret', () => {
    expect(() => Splitwise()).toThrow();
    expect(() => Splitwise({})).toThrow();
    expect(() => Splitwise({ consumerKey: 'foo' })).toThrow();
    expect(() => Splitwise({ consumerSecret: 'foo' })).toThrow();
  });

  test('does not fetch access token if provided', () => {
    Splitwise({
      consumerKey: 'your key here',
      consumerSecret: 'your secret here',
      accessToken: 'foo',
    });

    const mockOAuthInstance = OAuth2.mock.instances[0];
    const mockGetOAuthAccessToken = mockOAuthInstance.getOAuthAccessToken;

    expect(mockGetOAuthAccessToken).not.toHaveBeenCalled();
  });

  test('createDebt wraps createExpense', async () => {
    expect(OAuth2).not.toHaveBeenCalled();

    const sw = Splitwise({
      consumerKey: 'your key here',
      consumerSecret: 'your secret here',
      accessToken: 'foo',
    });

    const mockOAuthInstance = OAuth2.mock.instances[0];
    // eslint-disable-next-line no-underscore-dangle
    const mockOauthRequest = mockOAuthInstance.get;
    mockOauthRequest.mockImplementation((_, __, cb) => cb(null, '[]'));
    expect(mockOauthRequest).not.toHaveBeenCalled();

    await sw.getGroups();

    expect(OAuth2).toHaveBeenCalledTimes(1);
    expect(mockOauthRequest).toHaveBeenCalledTimes(1);
  });
});
