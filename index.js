const { OAuth2 } = require('oauth');
const querystring = require('querystring');
const { promisify } = require('util');
const R = require('ramda');

const API_URL = 'https://secure.splitwise.com/api/v3.0/';

const PROP_NAMES = {
  CURRENCIES: 'currencies',
  CATEGORIES: 'categories',
  USER: 'user',
  GROUPS: 'groups',
  GROUP: 'group',
  EXPENSES: 'expenses',
  EXPENSE: 'expense',
  FRIENDS: 'friends',
  FRIEND: 'friend',
  NOTIFICATIONS: 'notifications',
};

const ID_PARAM_NAMES = {
  USER: 'userID',
  GROUP: 'groupID',
  EXPENSE: 'expenseID',
  FRIEND: 'friendID',
};

const METHOD_TYPES = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
};

const METHODS = {
  GET_CURRENCIES: {
    endpoint: 'get_currencies',
    methodName: 'getCurrencies',
    method: METHOD_TYPES.GET,
    propName: PROP_NAMES.CURRENCIES,
  },
  GET_CATEGORIES: {
    endpoint: 'get_categories',
    methodName: 'getCategories',
    method: METHOD_TYPES.GET,
    propName: PROP_NAMES.CATEGORIES,
  },
  PARSE_SENTENCE: {
    endpoint: 'parse_sentence',
    methodName: 'parseSentence',
    method: METHOD_TYPES.POST,
    paramNames: ['input', 'group_id', 'friend_id', 'autosave'],
  },
  GET_CURRENT_USER: {
    endpoint: 'get_current_user',
    methodName: 'getCurrentUser',
    method: METHOD_TYPES.GET,
    propName: PROP_NAMES.USER,
  },
  GET_USER: {
    endpoint: 'get_user',
    methodName: 'getUser',
    method: METHOD_TYPES.GET,
    propName: PROP_NAMES.USER,
    idParamName: ID_PARAM_NAMES.USER,
  },
  UPDATE_USER: {
    endpoint: 'update_user',
    methodName: 'updateUser',
    method: METHOD_TYPES.PUT,
    propName: PROP_NAMES.USER,
    idParamName: ID_PARAM_NAMES.USER,
    paramNames: [
      'first_name',
      'last_name',
      'email',
      'password',
      'locale',
      'date_format',
      'default_currency',
      'default_group_id',
      'notification_settings',
    ],
  },
  GET_GROUPS: {
    endpoint: 'get_groups',
    methodName: 'getGroups',
    method: METHOD_TYPES.GET,
    propName: PROP_NAMES.GROUPS,
  },
  GET_GROUP: {
    endpoint: 'get_group',
    methodName: 'getGroup',
    method: METHOD_TYPES.GET,
    propName: PROP_NAMES.GROUP,
    idParamName: ID_PARAM_NAMES.GROUP,
  },
  CREATE_GROUP: {
    endpoint: 'create_group',
    methodName: 'createGroup',
    method: METHOD_TYPES.POST,
    propName: PROP_NAMES.GROUP,
    paramNames: ['name', 'group_type', 'country_code', 'users'],
  },
  DELETE_GROUP: {
    endpoint: 'delete_group',
    methodName: 'deleteGroup',
    method: METHOD_TYPES.POST,
    idParamName: PROP_NAMES.GROUP,
  },
  ADD_USER_TO_GROUP: {
    endpoint: 'add_user_to_group',
    methodName: 'addUserToGroup',
    method: METHOD_TYPES.POST,
    paramNames: ['group_id', 'user_id', 'first_name', 'last_name', 'email'],
  },
  REMOVE_USER_FROM_GROUP: {
    endpoint: 'remove_user_from_group',
    methodName: 'removeUserFromGroup',
    method: METHOD_TYPES.POST,
    paramNames: ['user_id', 'group_id'],
  },
  GET_EXPENSES: {
    endpoint: 'get_expenses',
    methodName: 'getExpenses',
    method: METHOD_TYPES.GET,
    propName: PROP_NAMES.EXPENSES,
    paramNames: [
      'group_id',
      'friendship_id',
      'dated_after',
      'dated_before',
      'updated_after',
      'updated_before',
      'limit',
      'offset',
    ],
  },
  GET_EXPENSE: {
    endpoint: 'get_expense',
    methodName: 'getExpense',
    method: METHOD_TYPES.GET,
    propName: PROP_NAMES.EXPENSE,
    idParamName: ID_PARAM_NAMES.EXPENSE,
  },
  CREATE_EXPENSE: {
    endpoint: 'create_expense',
    methodName: 'createExpense',
    method: METHOD_TYPES.POST,
    propName: PROP_NAMES.EXPENSES,
    paramNames: [
      'payment',
      'cost',
      'description',
      'group_id',
      'friendship_id',
      'details',
      'creation_method',
      'date',
      'repeat_interval',
      'currency_code',
      'category_id',
      'users',
    ],
  },
  UPDATE_EXPENSE: {
    endpoint: 'update_expense',
    methodName: 'updateExpense',
    method: METHOD_TYPES.POST,
    propName: PROP_NAMES.EXPENSES,
    idParamName: ID_PARAM_NAMES.EXPENSE,
    paramNames: [
      'group_id',
      'friendship_id',
      'expense_bundle_id',
      'description',
      'details',
      'payment',
      'cost',
      'date',
      'category_id',
      'users',
    ],
  },
  DELETE_EXPENSE: {
    endpoint: 'delete_expense',
    methodName: 'deleteExpense',
    method: METHOD_TYPES.POST,
    idParamName: ID_PARAM_NAMES.EXPENSE,
  },
  GET_FRIENDS: {
    endpoint: 'get_friends',
    methodName: 'getFriends',
    method: METHOD_TYPES.GET,
    propName: PROP_NAMES.FRIENDS,
  },
  GET_FRIEND: {
    endpoint: 'get_friend',
    methodName: 'getFriend',
    method: METHOD_TYPES.GET,
    propName: PROP_NAMES.FRIEND,
    idParamName: ID_PARAM_NAMES.FRIEND,
  },
  CREATE_FRIEND: {
    endpoint: 'create_friend',
    methodName: 'createFriend',
    method: METHOD_TYPES.POST,
    propName: PROP_NAMES.FRIENDS,
    paramNames: ['user_email', 'user_first_name', 'user_last_name'],
  },
  CREATE_FRIENDS: {
    endpoint: 'create_friends',
    methodName: 'createFriends',
    method: METHOD_TYPES.POST,
    propName: PROP_NAMES.FRIENDS,
    paramNames: ['friends'],
  },
  DELETE_FRIEND: {
    endpoint: 'delete_friend',
    methodName: 'deleteFriend',
    method: METHOD_TYPES.DELETE,
    idParamName: ID_PARAM_NAMES.FRIEND,
  },
  GET_NOTIFICATIONS: {
    endpoint: 'get_notifications',
    methodName: 'getNotifications',
    method: METHOD_TYPES.GET,
    propName: PROP_NAMES.NOTIFICATIONS,
    paramNames: ['updated_after', 'limit'],
  },
  GET_MAIN_DATA: {
    endpoint: 'get_main_data',
    methodName: 'getMainData',
    method: METHOD_TYPES.GET,
    paramNames: ['no_expenses', 'limit', 'cachebust'],
  },
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

  const recursedPairs = pairs.map(([key, value]) => [
    key,
    unnestParameters(value),
  ]);

  const flattenedPairs = recursedPairs.map(
    ([key, value]) =>
      R.type(value) === 'Object'
        ? R.compose(
            R.fromPairs,
            R.map(([subKey, subValue]) => [`${key}__${subKey}`, subValue]),
            R.toPairs,
          )(value)
        : { [key]: value },
  );

  return R.mergeAll(flattenedPairs);
};

const splitwisifyParameters = R.compose(convertBooleans, unnestParameters);

class Splitwise {
  constructor({
    consumerKey,
    consumerSecret,
    groupID,
    userID,
    expenseID,
    friendID,
  }) {
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
      this.oauth2.getOAuthAccessToken.bind(this.oauth2, '', {
        grant_type: 'client_credentials',
      }),
    );

    this.oAuthGet = promisify(this.oauth2.get.bind(this.oauth2));

    // eslint-disable-next-line no-underscore-dangle
    this.oAuthRequest = promisify(this.oauth2._request.bind(this.oauth2));

    this.tokenPromise = this.getOAuthAccessToken();

    Object.values(METHODS).forEach(method => {
      this[method.methodName] = this.methodWrapper(method);
    });
  }

  oAuthRequestWrapper(url, method, postData, token) {
    // if (method not in METHOD_TYPES) ...
    return this.oAuthRequest(
      method,
      url,
      {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: this.oauth2.buildAuthHeader(token),
      },
      querystring.stringify(postData),
      null,
    );
  }

  splitwiseRequest(endpoint) {
    return token =>
      this.oAuthGet(`${API_URL}${endpoint}`, token).then(JSON.parse);
  }

  splitwiseRequestWithData(endpoint, method, data) {
    return token =>
      this.oAuthRequestWrapper(
        `${API_URL}${endpoint}`,
        method,
        splitwisifyParameters(data),
        token,
      ).then(JSON.parse);
  }

  methodWrapper({
    method,
    endpoint,
    propName,
    methodName,
    idParamName,
    paramNames = [],
  }) {
    // if (!endpoint) ...
    // if (!method) ...
    // if (method !== 'GET' && paramNames.length > 0) ...
    const wrapped = (params = {}, callback) => {
      let id = '';
      if (idParamName) {
        id = params.id || params[idParamName] || this[idParamName];
        if (!id) {
          const error = new Error(`must provide id parameter`);
          if (callback) callback(error, null);
          return Promise.reject(error);
        }
      }

      let url = `${endpoint}/${id}`;
      let resultPromise;

      if (method === 'GET') {
        const queryParams = querystring.stringify(R.pick(paramNames, params));

        if (queryParams) {
          url = `${url}?${queryParams}`;
        }

        resultPromise = this.tokenPromise.then(this.splitwiseRequest(url));
      } else {
        resultPromise = this.tokenPromise.then(
          this.splitwiseRequestWithData(
            url,
            method,
            R.pick(paramNames, params),
          ),
        );
      }

      if (propName) {
        resultPromise = resultPromise.then(R.prop(propName));
      }

      if (callback) {
        resultPromise.then(
          result => callback(null, result),
          error => callback(error, null),
        );
      }
      return resultPromise;
    };

    Object.defineProperty(wrapped, 'name', {
      value: methodName,
      writable: false,
    });
    return wrapped;
  }

  createDebt({ from, to, amount, description, groupID }) {
    return this.createExpense({
      description,
      groupID,
      payment: false,
      cost: amount,
      users: [
        {
          user_id: from,
          paid_share: amount,
        },
        {
          user_id: to,
          owed_share: amount,
        },
      ],
    });
  }
}

exports.Splitwise = Splitwise;
exports.default = Splitwise;
