const { OAuth2 } = require('oauth');
const querystring = require('querystring');
const { promisify } = require('util');
const R = require('ramda');

const API_URL = 'https://secure.splitwise.com/api/v3.0/';

const ENDPOINTS = {
  GET_CURRENCIES: 'get_currencies/',
  GET_CATEGORIES: 'get_categories/',
  GET_CURRENT_USER: 'get_current_user/',
  GET_USER: 'get_user/',
  GET_GROUPS: 'get_groups/',
  GET_GROUP: 'get_group/',
  GET_EXPENSES: 'get_expenses/',
  GET_EXPENSE: 'get_expense/',
  GET_FRIENDS: 'get_friends/',
  GET_FRIEND: 'get_friend/',
  GET_NOTIFICATIONS: 'get_notifications/',
};

// TODO: move these strings into separate object
const PROPS = {
  [ENDPOINTS.GET_CURRENCIES]: 'currencies',
  [ENDPOINTS.GET_CATEGORIES]: 'categories',
  [ENDPOINTS.GET_CURRENT_USER]: 'user',
  [ENDPOINTS.GET_USER]: 'user',
  [ENDPOINTS.GET_GROUPS]: 'groups',
  [ENDPOINTS.GET_GROUP]: 'group',
  [ENDPOINTS.GET_EXPENSES]: 'expenses',
  [ENDPOINTS.GET_EXPENSE]: 'expense',
  [ENDPOINTS.GET_FRIENDS]: 'friends',
  [ENDPOINTS.GET_FRIEND]: 'friend',
  [ENDPOINTS.GET_NOTIFICATIONS]: 'notifications',
};

const convertBooleans = R.map(val => {
  if (val === true) return 1;
  if (val === false) return 0;
  return val;
});

const unnestParameters = params => {
  const type = R.type(params);
  if (type !== 'Array' && type !== 'Object') {
    return params;
  }

  const pairs = Object.entries(params);

  const recursedPairs = pairs.map(([key, value]) => [key, unnestParameters(value)]);

  const flattenedPairs = recursedPairs.map(([key, value]) => R.type(value) === 'Object' ? R.compose(
    R.fromPairs,
    R.map(([subKey, subValue]) => [`${key}__${subKey}`, subValue]),
    R.toPairs,
  )(value) : {[key]: value});

  return R.mergeAll(flattenedPairs);
}

const splitwisifyParameters = R.compose(convertBooleans, unnestParameters);


// const createWager = ({ makerID, takerID, makerStake, takerStake, description, makerName }) =>
//   oAuthPost(
//     `${splitwiseAPIURL}${splitwiseCreateExpenseEndpoint}`, {
//       payment: false,
//       cost: makerStake + takerStake,
//       description: description,
//       group_id: process.env.SPLITWISE_GROUP_ID,
//       details: `${pledgeHeader}\nCreated by ${makerName} at ${new Date().toISOString()}`,
//       currency_code: 'PYG',
//       users__0__user_id: process.env.SPLITWISE_SPECIAL_USER_ID,
//       users__0__owed_share: makerStake + takerStake,
//       users__1__user_id: makerID,
//       users__1__paid_share: takerStake,
//       users__2__user_id: takerID,
//       users__2__paid_share: makerStake,
//     }).then(console.log);

/**
 *
 */
class Splitwise {
  constructor({ consumerKey, consumerSecret, groupID, userID, expenseID, friendID }) {
    this.consumerKey = consumerKey;
    this.consumerSecret = consumerSecret;
    this.groupID = groupID;
    this.userID = userID;
    this.expenseID = expenseID;
    this.friendID = friendID;

    this.oauth2 = new OAuth2(
      consumerKey,
      consumerSecret,
      'https://secure.splitwise.com/',
      null,
      'oauth/token',
      null,
    );

    this.getOAuthAccessToken = promisify(
      this.oauth2.getOAuthAccessToken.bind(
        this.oauth2, '', { grant_type: 'client_credentials' },
      ),
    );

    this.oAuthGet = promisify(this.oauth2.get.bind(this.oauth2));

    this.oAuthRequest = promisify(this.oauth2._request.bind(this.oauth2));

    this.tokenPromise = this.getOAuthAccessToken();

    this.getCurrencies = this.getWrapper(
      ENDPOINTS.GET_CURRENCIES,
      PROPS[ENDPOINTS.GET_CURRENCIES],
      'getCurrencies',
    );

    this.getCategories = this.getWrapper(
      ENDPOINTS.GET_CATEGORIES,
      PROPS[ENDPOINTS.GET_CATEGORIES],
      'getCategories',
    );

    this.getCurrentUser = this.getWrapper(
      ENDPOINTS.GET_CURRENT_USER,
      PROPS[ENDPOINTS.GET_CURRENT_USER],
      'getCurrentUser',
    );

    this.getUser = this.getWrapper(
      ENDPOINTS.GET_USER,
      PROPS[ENDPOINTS.GET_USER],
      'getUser',
      'userID',
    );

    this.getGroups = this.getWrapper(
      ENDPOINTS.GET_GROUPS,
      PROPS[ENDPOINTS.GET_GROUPS],
      'getGroups',
    );

    this.getGroup = this.getWrapper(
      ENDPOINTS.GET_GROUP,
      PROPS[ENDPOINTS.GET_GROUP],
      'getGroup',
      'groupID',
    );

    this.getExpenses = this.getWrapper(
      ENDPOINTS.GET_EXPENSES,
      PROPS[ENDPOINTS.GET_EXPENSES],
      'getExpenses',
    );

    this.getExpense = this.getWrapper(
      ENDPOINTS.GET_EXPENSE,
      PROPS[ENDPOINTS.GET_EXPENSE],
      'getExpense',
      'expenseID',
    );

    this.getFriends = this.getWrapper(
      ENDPOINTS.GET_FRIENDS,
      PROPS[ENDPOINTS.GET_FRIENDS],
      'getFriends',
    );

    this.getFriend = this.getWrapper(
      ENDPOINTS.GET_FRIEND,
      PROPS[ENDPOINTS.GET_FRIEND],
      'getFriend',
      'friendID',
    );

    this.getNotifications = this.getWrapper(
      ENDPOINTS.GET_NOTIFICATIONS,
      PROPS[ENDPOINTS.GET_NOTIFICATIONS],
      'getNotifications',
    );
  }

  oAuthPost(url, postData, token) {
    return oAuthRequest(
      'POST', url, {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: oauth2.buildAuthHeader(token)
      }, querystring.stringify(postData), null,
    ).then(JSON.parse)
  }

  splitwiseGet(endpoint) {
    return token => this.oAuthGet(
      `${API_URL}${endpoint}`,
      token
    ).then(JSON.parse);
  }

  splitwisePost(endpoint, postData) {
    return token => this.oAuthPost(
      `${API_URL}${endpoint}`,
      splitwisifyParameters(postData),
      token
    ).then(JSON.parse);
  }

  getWrapper(endpoint, prop, methodName, paramName) {
    // if (!endpoint) ...
    const wrapped = (params = {}, callback) => {
      let id = '';
      if (paramName) {
        id = params[paramName] || this[paramName];
        if (!id) {
          if (callback) callback(`must provide parameter "${paramName}"`, null);
          return Promise.reject(`must provide parameter "${paramName}"`);
        }
      }

      let resultPromise = this.tokenPromise
        .then(this.splitwiseGet(`${endpoint}${id}`));

      if (prop) {
        resultPromise = resultPromise.then(R.prop(prop));
      }

      if (callback) {
        resultPromise.then(
          result => callback(null, result),
          error => callback(error, null),
        );
      }
      return resultPromise;
    };

    Object.defineProperty(wrapped, 'name', {value: methodName, writable: false});
    return wrapped;
  }
};

exports.Splitwise = Splitwise;
exports.default = Splitwise;
