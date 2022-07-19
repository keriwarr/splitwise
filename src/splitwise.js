const { OAuth2 } = require('oauth');
const querystring = require('querystring');
const { promisify } = require('es6-promisify');
const validate = require('validate.js');

const R = require('./ramda.js');
const { LOG_LEVELS, getLogger } = require('./logger.js');
const { splitwisifyParameters, getSplitwiseErrors } = require('./utils.js');
const {
  METHOD_VERBS, PROP_NAMES, ID_PARAM_NAMES, API_URL,
} = require('./constants.js');

const METHODS = {
  TEST: {
    endpoint: 'test',
    methodName: 'test',
    verb: METHOD_VERBS.GET,
  },
  GET_CURRENCIES: {
    endpoint: 'get_currencies',
    methodName: 'getCurrencies',
    verb: METHOD_VERBS.GET,
    propName: PROP_NAMES.CURRENCIES,
  },
  GET_CATEGORIES: {
    endpoint: 'get_categories',
    methodName: 'getCategories',
    verb: METHOD_VERBS.GET,
    propName: PROP_NAMES.CATEGORIES,
  },
  PARSE_SENTENCE: {
    endpoint: 'parse_sentence',
    methodName: 'parseSentence',
    verb: METHOD_VERBS.POST,
    paramNames: ['input', 'group_id', 'friend_id', 'autosave'],
  },
  GET_CURRENT_USER: {
    endpoint: 'get_current_user',
    methodName: 'getCurrentUser',
    verb: METHOD_VERBS.GET,
    propName: PROP_NAMES.USER,
  },
  GET_USER: {
    endpoint: 'get_user',
    methodName: 'getUser',
    verb: METHOD_VERBS.GET,
    propName: PROP_NAMES.USER,
    idParamName: ID_PARAM_NAMES.USER,
  },
  UPDATE_USER: {
    endpoint: 'update_user',
    methodName: 'updateUser',
    verb: METHOD_VERBS.PUT,
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
    verb: METHOD_VERBS.GET,
    propName: PROP_NAMES.GROUPS,
  },
  GET_GROUP: {
    endpoint: 'get_group',
    methodName: 'getGroup',
    verb: METHOD_VERBS.GET,
    propName: PROP_NAMES.GROUP,
    idParamName: ID_PARAM_NAMES.GROUP,
  },
  CREATE_GROUP: {
    endpoint: 'create_group',
    methodName: 'createGroup',
    verb: METHOD_VERBS.POST,
    propName: PROP_NAMES.GROUP,
    paramNames: ['name', 'group_type', 'country_code', 'users'],
  },
  DELETE_GROUP: {
    endpoint: 'delete_group',
    methodName: 'deleteGroup',
    verb: METHOD_VERBS.POST,
    propName: PROP_NAMES.SUCCESS,
    idParamName: PROP_NAMES.GROUP,
  },
  ADD_USER_TO_GROUP: {
    endpoint: 'add_user_to_group',
    methodName: 'addUserToGroup',
    verb: METHOD_VERBS.POST,
    propName: PROP_NAMES.SUCCESS,
    paramNames: ['group_id', 'user_id', 'first_name', 'last_name', 'email'],
  },
  REMOVE_USER_FROM_GROUP: {
    endpoint: 'remove_user_from_group',
    methodName: 'removeUserFromGroup',
    verb: METHOD_VERBS.POST,
    propName: PROP_NAMES.SUCCESS,
    paramNames: ['user_id', 'group_id'],
  },
  GET_EXPENSES: {
    endpoint: 'get_expenses',
    methodName: 'getExpenses',
    verb: METHOD_VERBS.GET,
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
      'visible',
    ],
  },
  GET_EXPENSE: {
    endpoint: 'get_expense',
    methodName: 'getExpense',
    verb: METHOD_VERBS.GET,
    propName: PROP_NAMES.EXPENSE,
    idParamName: ID_PARAM_NAMES.EXPENSE,
  },
  CREATE_EXPENSE: {
    endpoint: 'create_expense',
    methodName: 'createExpense',
    verb: METHOD_VERBS.POST,
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
      'split_equally'
    ],
  },
  UPDATE_EXPENSE: {
    endpoint: 'update_expense',
    methodName: 'updateExpense',
    verb: METHOD_VERBS.POST,
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
    verb: METHOD_VERBS.POST,
    propName: PROP_NAMES.SUCCESS,
    idParamName: ID_PARAM_NAMES.EXPENSE,
  },
  GET_FRIENDS: {
    endpoint: 'get_friends',
    methodName: 'getFriends',
    verb: METHOD_VERBS.GET,
    propName: PROP_NAMES.FRIENDS,
  },
  GET_FRIEND: {
    endpoint: 'get_friend',
    methodName: 'getFriend',
    verb: METHOD_VERBS.GET,
    propName: PROP_NAMES.FRIEND,
    idParamName: ID_PARAM_NAMES.FRIEND,
  },
  CREATE_FRIEND: {
    endpoint: 'create_friend',
    methodName: 'createFriend',
    verb: METHOD_VERBS.POST,
    propName: PROP_NAMES.FRIENDS,
    paramNames: ['user_email', 'user_first_name', 'user_last_name'],
  },
  CREATE_FRIENDS: {
    endpoint: 'create_friends',
    methodName: 'createFriends',
    verb: METHOD_VERBS.POST,
    propName: PROP_NAMES.FRIENDS,
    paramNames: ['friends'],
  },
  DELETE_FRIEND: {
    endpoint: 'delete_friend',
    methodName: 'deleteFriend',
    verb: METHOD_VERBS.DELETE,
    propName: PROP_NAMES.SUCCESS,
    idParamName: ID_PARAM_NAMES.FRIEND,
  },
  GET_NOTIFICATIONS: {
    endpoint: 'get_notifications',
    methodName: 'getNotifications',
    verb: METHOD_VERBS.GET,
    propName: PROP_NAMES.NOTIFICATIONS,
    paramNames: ['updated_after', 'limit'],
  },
  GET_MAIN_DATA: {
    endpoint: 'get_main_data',
    methodName: 'getMainData',
    verb: METHOD_VERBS.GET,
    paramNames: ['no_expenses', 'limit', 'cachebust'],
  },
};

/**
 * Consistently handles error scenarios
 * @param {Object} options - `fail` consumes arguments via an options object
 * @param {string} options.context - The context in which the error occured
 * @param {string} options.message - A description of the error
 * @param {Function} options.callback - Will be called with the error as it's first argument
 * @param {Function} options.logger - Will be called with a message and the ERROR log level
 * @param {boolean} options.shouldThrow - Rather than returning a promise, will throw an error
 * @returns {Promise.<Error>} A promise that has been rejected with an Error
 */
const fail = ({
  context, message, callback, logger, shouldThrow,
} = {}) => {
  const contextPrefix = context ? `${context} - ` : '';
  const errorMessage = `${contextPrefix}${message}`;
  if (logger) {
    logger({ level: LOG_LEVELS.ERROR, message: errorMessage });
  }
  const error = new Error(errorMessage);
  if (shouldThrow) {
    throw error;
  }
  if (callback) {
    callback(error, null);
  }
  return Promise.reject(error);
};

/**
 * @param {Function} logger - The logger provided by getLogger
 * @param {Object} oauth2 - An instance of OAuth2
 * @returns {Function} A method which can make oauth requests
 */
const getOAuthRequestWrapper = (logger, oauth2) => {
  // eslint-disable-next-line no-underscore-dangle
  const oAuthRequest = promisify(oauth2._request.bind(oauth2));
  const oAuthRequestWrapperFail = message => fail({
    logger,
    message,
    context: 'oAuthRequestWrapper',
  });

  /**
   * Make an oauth request
   * @param {string} url - The endpoint to send a request to
   * @param {string} verb - Which http verb to use
   * @param {Object} data - The data to be sent along with the request
   * @param {string} accessToken - The oauth access token
   * @returns {Promise} The data from the endpoint
   */
  const oAuthRequestWrapper = (url, verb, data, accessToken) => {
    if (!url) {
      return oAuthRequestWrapperFail('a URL must be provided');
    }
    if (!accessToken) {
      return oAuthRequestWrapperFail('an access token must be provided');
    }

    return oAuthRequest(
      verb,
      url,
      {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: oauth2.buildAuthHeader(accessToken),
      },
      querystring.stringify(data),
      null
    );
  };

  return oAuthRequestWrapper;
};

/**
 * @param {Function} logger - The logger provided by getLogger
 * @param {Object} oauth2 - An instance of OAuth2
 * @returns A method for making requests to Splitwise
 */
const getSplitwiseRequest = (logger, oauth2) => {
  const oAuthGet = promisify(oauth2.get.bind(oauth2));
  const splitwiseRequestFail = message => fail({
    logger,
    message,
    context: 'splitwiseRequest',
  });

  /**
   * Make a request to splitwise
   * @param {string} endpoint - The endpoint to send a request to
   * @returns {Promise} The data returned from Splitwise
   */
  const splitwiseRequest = (endpoint) => {
    if (!endpoint) {
      return splitwiseRequestFail('an endpoint must be specified');
    }

    return accessToken => oAuthGet(`${API_URL}${endpoint}`, accessToken).then(JSON.parse);
  };

  return splitwiseRequest;
};

/**
 * @param {Function} logger - The logger provided by getLogger
 * @param {Object} oauth2 - An instance of OAuth2
 * @returns {Function} A method for making requests with data to Splitwise
 */
const getSplitwiseRequestWithData = (logger, oauth2) => {
  const oAuthRequestWrapper = getOAuthRequestWrapper(logger, oauth2);
  const splitwiseRequestWithDataFail = message => fail({
    logger,
    message,
    context: 'splitwiseRequestWithData',
  });

  /**
   * Make a request with data to Splitwise
   * @param {string} endpoint - The endpoint to send a request to
   * @param {string} verb - Which http verb to use
   * @param {Object} data - The data to be sent along with the request
   * @returns {Promise} The data returned from Splitwise
   */
  const splitwiseRequestWithData = (endpoint, verb, data) => {
    if (!endpoint) {
      return splitwiseRequestWithDataFail('an endpoint must be specified');
    }
    if (!data) {
      return splitwiseRequestWithDataFail('data must be provided');
    }

    return accessToken => oAuthRequestWrapper(
      `${API_URL}${endpoint}`,
      verb,
      splitwisifyParameters(data), // un-nest data, and convert bools into numbers
      accessToken
    ).then(JSON.parse);
  };

  return splitwiseRequestWithData;
};

/**
 * Returns a promise for a Splitwise access token
 * @param {Function} logger - The logger provided by getLogger
 * @param {Object} oauth2 - An instance of OAuth2
 * @returns {Promise.<string>} A Splitwise access token
 */
const getAccessTokenPromise = (logger, oauth2) => {
  const getOAuthAccessToken = promisify(oauth2.getOAuthAccessToken.bind(oauth2));

  const accessTokenPromise = getOAuthAccessToken('', { grant_type: 'client_credentials' });

  accessTokenPromise.then(
    () => {
      logger({ message: 'successfully aquired access token' });
    },
    () => {}
  );

  const handledAccessToken = accessTokenPromise.catch((error) => {
    const data = (() => {
      try {
        return JSON.parse(error.data);
      } catch (e) {
        return null;
      }
    })();
    const reason = (() => {
      if (data && data.error === 'invalid_client') {
        return 'your credentials are incorrect';
      }
      if (error && error.statusCode >= 400 && error.statusCode < 500) {
        return 'client error';
      }
      if (error && error.statusCode >= 500 && error.statusCode < 600) {
        return 'server error';
      }
      return 'unknown error';
    })();

    return fail({ logger, message: `authentication failed - ${reason}` });
  });

  return handledAccessToken;
};

const getDefaultId = (defaultIDs, idType) => {
  switch (idType) {
    case 'group_id':
      return defaultIDs.group_id;
    case 'user_id':
      return defaultIDs.user_id;
    case 'expense_id':
      return defaultIDs.expense_id;
    case 'friend_id':
      return defaultIDs.friend_id;
    default:
      return null;
  }
};

/**
 * @param {Function} logger - The logger provided by getLogger
 * @param {Promise.<string>} accessTokenPromise - A promise for a Splitwise access token
 * @param {Object} defaultIDs - A map of IDs to use by default if one is not provided
 * @param {Object} oauth2 - An instance of OAuth2
 * @returns {Function} A method for generating methods for interacting with Splitwise
 */
const getEndpointMethodGenerator = (logger, accessTokenPromise, defaultIDs, oauth2) => {
  const splitwiseRequest = getSplitwiseRequest(logger, oauth2);
  const splitwiseRequestWithData = getSplitwiseRequestWithData(logger, oauth2);
  const endpointMethodGeneratorFail = message => fail({
    logger,
    message,
    shouldThrow: true,
    context: 'endpointMethodGenerator',
  });

  /**
   * @param {string} verb - Which http verb to use
   * @param {string} endpoint - Which Splitwise endpoint to use
   * @param {string} propName - The key under which the return value is nested
   * @param {string} methodName - The returned method will have this name bound to it
   * @param {string} idParamName - The name of the default ID to use
   * @param {string[]} paramNames - The names of the parameters to expect
   * @param {Object} constraints - validate.js constraints on the params
   * @returns {Function} A method for interacting with a Splitwise endpoint
   */
  const endpointMethodGenerator = ({
    verb,
    endpoint,
    propName,
    methodName,
    idParamName,
    paramNames = [],
    constraints = {},
  }) => {
    if (!endpoint) {
      endpointMethodGeneratorFail('an endpoint must be specified');
    }
    if (!methodName) {
      endpointMethodGeneratorFail('a method name must be provided');
    }
    const wrappedFail = ({ message, callback }) => fail({
      logger,
      message,
      callback,
      context: methodName,
    });
    const augmentedConstraints = (() => {
      if (idParamName) {
        return R.assoc('id', { presence: { allowEmpty: false } }, constraints);
      }
      return constraints;
    })();
    const makeErrorMessage = (errors) => {
      if (errors.length === 0) {
        return '';
      }
      if (errors.length === 1) {
        return `${methodName} - ${errors[0]}`;
      }
      return errors.reduce(
        (messageSoFar, nextError) => `${messageSoFar}\n - ${nextError}`,
        `${methodName}:`
      );
    };

    /**
     * Makes a call to a specific Splitwise endpoint
     * @param {Object} params - Arguments to be passed to the endpoint
     * @param {Function} callback - Will be called with the error as the first arg,
     *                              and the results as the second
     * @returns {Promise} An error or the response from the endpoint
     */
    const wrapped = (params = {}, callback) => {
      const id = (idParamName && (String(params.id) || String(getDefaultId(defaultIDs, idParamName)))) || '';
      const augmentedParams = R.assoc('id', id, params);

      // Ensure the provided params are valid
      const allErrors = validate(augmentedParams, augmentedConstraints, { fullMessages: false });
      if (allErrors) {
        const flattenedErrors = R.flatten(
          R.toPairs(allErrors).map(([argument, errors]) => errors.map(error => `\`${argument}\` ${error}`))
        );

        const message = makeErrorMessage(flattenedErrors);
        return wrappedFail({ message, callback });
      }

      let url = `${endpoint}/${id}`;
      // Get the access token
      let resultPromise = accessTokenPromise;

      resultPromise.then(
        () => {
          logger({ message: `${methodName} - making request` });
        },
        () => {}
      );

      // Make the request
      if (verb === METHOD_VERBS.GET) {
        const queryParams = querystring.stringify(R.pick(paramNames, params));

        if (queryParams) {
          url = `${url}?${queryParams}`;
        }

        resultPromise = resultPromise.then(splitwiseRequest(url));
      } else {
        resultPromise = resultPromise.then(
          splitwiseRequestWithData(url, verb, R.pick(paramNames, params))
        );
      }

      // Handle any errors
      resultPromise = resultPromise.then(
        (result) => {
          const errors = getSplitwiseErrors(R.pick(['error', 'errors'], result));
          const message = makeErrorMessage(errors) || (result.success === false && 'request was unsuccessful');
          if (message) {
            return wrappedFail({ message, callback });
          }
          logger({ message: `${methodName} - successfully made request` });
          return result;
        },
        (error) => {
          const errors = getSplitwiseErrors(error);
          const message = makeErrorMessage(errors) || 'request was unsuccessful';
          return wrappedFail({ message, callback });
        }
      );

      // Return data, not nested within an object
      if (propName) {
        resultPromise = resultPromise.then(val => R.propOr(val, propName, val));
      }

      // Annoying edge case
      if (endpoint === 'create_expense') {
        resultPromise = resultPromise.then(val => val[0]);
      }

      // Call the callback if it's given
      if (callback) {
        resultPromise.then(
          (result) => {
            callback(null, result);
          },
          (error) => {
            callback(error, null);
          }
        );
      }

      return resultPromise;
    };

    // Assign the method's name far the sake of stack traces
    Object.defineProperty(wrapped, 'name', {
      value: methodName,
      writable: false,
    });
    return wrapped;
  };

  return endpointMethodGenerator;
};

/**
 * @class
 */
class Splitwise {
  constructor(options = {}) {
    const { consumerKey, consumerSecret, accessToken } = options;
    const defaultIDs = {
      groupID: options.group_id,
      userID: options.user_id,
      expenseID: options.expense_id,
      friendID: options.friend_id,
    };
    const logger = getLogger(options.logger, options.logLevel);

    if (!consumerKey || !consumerSecret) {
      const message = 'both a consumer key, and a consumer secret must be provided';
      logger({ level: LOG_LEVELS.ERROR, message });
      throw new Error(message);
    }

    const oauth2 = new OAuth2(
      consumerKey,
      consumerSecret,
      'https://secure.splitwise.com/',
      null,
      'oauth/token',
      null
    );

    const accessTokenPromise = (() => {
      if (accessToken) {
        logger({ message: 'using provided access token' });
        return Promise.resolve(accessToken);
      }
      logger({ message: 'making request for access token' });
      return getAccessTokenPromise(logger, oauth2);
    })();

    const generateEndpointMethod = getEndpointMethodGenerator(
      logger,
      accessTokenPromise,
      defaultIDs,
      oauth2
    );

    // Each of the provided methods is generated from an element in METHODS
    // and added as an instance method
    R.values(METHODS).forEach((method) => {
      this[method.methodName] = generateEndpointMethod(method);
    });

    this.getAccessToken = () => accessTokenPromise;
  }

  // Bonus utility method for easily making transactions from one person to one person
  createDebt({
    from,
    to,
    amount,
    description,
    group_id, // eslint-disable-line camelcase
  } = {}) {
    return this.createExpense({
      description,
      group_id,
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

/**
 * We don't want a class to be visible in the public API, so it's hidden in this factory method
 */
module.exports = opts => new Splitwise(opts);
