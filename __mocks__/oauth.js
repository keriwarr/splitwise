const oauth = jest.genMockFromModule('oauth');

// eslint-disable-next-line no-underscore-dangle
const _request = () => new Promise((resolve) => {
  process.nextTick(() => resolve({}));
});
const buildAuthHeader = () => '';
const get = () => new Promise((resolve) => {
  process.nextTick(() => resolve({}));
});
const getOAuthAccessToken = () => new Promise((resolve) => {
  process.nextTick(() => resolve({}));
});

// eslint-disable-next-line no-underscore-dangle
oauth._request = _request;
oauth.buildAuthHeader = buildAuthHeader;
oauth.get = get;
oauth.getOAuthAccessToken = getOAuthAccessToken;

module.exports = oauth;
