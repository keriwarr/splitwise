module.exports = (function () {
  'use strict'

  const { OAuth2 } = require('oauth')
  const querystring = require('querystring')
  const promisify = require('es6-promisify')
  const R = require('./ramda.js')

  const API_URL = 'https://secure.splitwise.com/api/v3.0/'

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
    NOTIFICATIONS: 'notifications'
  }

  const ID_PARAM_NAMES = {
    USER: 'userID',
    GROUP: 'groupID',
    EXPENSE: 'expenseID',
    FRIEND: 'friendID'
  }

  const METHOD_VERBS = {
    GET: 'GET',
    POST: 'POST',
    PUT: 'PUT',
    DELETE: 'DELETE'
  }

  const METHODS = {
    TEST: { // TODO: maybe just return a booL?
      endpoint: 'test',
      methodName: 'test',
      verb: METHOD_VERBS.GET
    },
    GET_CURRENCIES: {
      endpoint: 'get_currencies',
      methodName: 'getCurrencies',
      verb: METHOD_VERBS.GET,
      propName: PROP_NAMES.CURRENCIES
    },
    GET_CATEGORIES: {
      endpoint: 'get_categories',
      methodName: 'getCategories',
      verb: METHOD_VERBS.GET,
      propName: PROP_NAMES.CATEGORIES
    },
    PARSE_SENTENCE: {
      endpoint: 'parse_sentence',
      methodName: 'parseSentence',
      verb: METHOD_VERBS.POST,
      paramNames: ['input', 'group_id', 'friend_id', 'autosave']
    },
    GET_CURRENT_USER: {
      endpoint: 'get_current_user',
      methodName: 'getCurrentUser',
      verb: METHOD_VERBS.GET,
      propName: PROP_NAMES.USER
    },
    GET_USER: {
      endpoint: 'get_user',
      methodName: 'getUser',
      verb: METHOD_VERBS.GET,
      propName: PROP_NAMES.USER,
      idParamName: ID_PARAM_NAMES.USER
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
        'notification_settings'
      ]
    },
    GET_GROUPS: {
      endpoint: 'get_groups',
      methodName: 'getGroups',
      verb: METHOD_VERBS.GET,
      propName: PROP_NAMES.GROUPS
    },
    GET_GROUP: {
      endpoint: 'get_group',
      methodName: 'getGroup',
      verb: METHOD_VERBS.GET,
      propName: PROP_NAMES.GROUP,
      idParamName: ID_PARAM_NAMES.GROUP
    },
    CREATE_GROUP: {
      endpoint: 'create_group',
      methodName: 'createGroup',
      verb: METHOD_VERBS.POST,
      propName: PROP_NAMES.GROUP,
      paramNames: ['name', 'group_type', 'country_code', 'users']
    },
    DELETE_GROUP: {
      endpoint: 'delete_group',
      methodName: 'deleteGroup',
      verb: METHOD_VERBS.POST,
      idParamName: PROP_NAMES.GROUP
    },
    ADD_USER_TO_GROUP: {
      endpoint: 'add_user_to_group',
      methodName: 'addUserToGroup',
      verb: METHOD_VERBS.POST,
      paramNames: ['group_id', 'user_id', 'first_name', 'last_name', 'email']
    },
    REMOVE_USER_FROM_GROUP: {
      endpoint: 'remove_user_from_group',
      methodName: 'removeUserFromGroup',
      verb: METHOD_VERBS.POST,
      paramNames: ['user_id', 'group_id']
    },
    GET_EXPENSES: { // TODO: filter deleted, offer get deleted expenses method?
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
        'offset'
      ]
    },
    GET_EXPENSE: {
      endpoint: 'get_expense',
      methodName: 'getExpense',
      verb: METHOD_VERBS.GET,
      propName: PROP_NAMES.EXPENSE,
      idParamName: ID_PARAM_NAMES.EXPENSE
    },
    CREATE_EXPENSE: { // TODO: return first expense? (returns array of expenses)
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
        'users'
      ]
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
        'users'
      ]
    },
    DELETE_EXPENSE: {
      endpoint: 'delete_expense',
      methodName: 'deleteExpense',
      verb: METHOD_VERBS.POST,
      idParamName: ID_PARAM_NAMES.EXPENSE
    },
    GET_FRIENDS: {
      endpoint: 'get_friends',
      methodName: 'getFriends',
      verb: METHOD_VERBS.GET,
      propName: PROP_NAMES.FRIENDS
    },
    GET_FRIEND: {
      endpoint: 'get_friend',
      methodName: 'getFriend',
      verb: METHOD_VERBS.GET,
      propName: PROP_NAMES.FRIEND,
      idParamName: ID_PARAM_NAMES.FRIEND
    },
    CREATE_FRIEND: {
      endpoint: 'create_friend',
      methodName: 'createFriend',
      verb: METHOD_VERBS.POST,
      propName: PROP_NAMES.FRIENDS,
      paramNames: ['user_email', 'user_first_name', 'user_last_name']
    },
    CREATE_FRIENDS: {
      endpoint: 'create_friends',
      methodName: 'createFriends',
      verb: METHOD_VERBS.POST,
      propName: PROP_NAMES.FRIENDS,
      paramNames: ['friends']
    },
    DELETE_FRIEND: { // TODO: maybe return ['success'] ?
      endpoint: 'delete_friend',
      methodName: 'deleteFriend',
      verb: METHOD_VERBS.DELETE,
      idParamName: ID_PARAM_NAMES.FRIEND
    },
    GET_NOTIFICATIONS: {
      endpoint: 'get_notifications',
      methodName: 'getNotifications',
      verb: METHOD_VERBS.GET,
      propName: PROP_NAMES.NOTIFICATIONS,
      paramNames: ['updated_after', 'limit']
    },
    GET_MAIN_DATA: {
      endpoint: 'get_main_data',
      methodName: 'getMainData',
      verb: METHOD_VERBS.GET,
      paramNames: ['no_expenses', 'limit', 'cachebust']
    }
  }

  const LOG_LEVELS = {
    INFO: 'Info',
    ERROR: 'Error'
  }

  const convertBooleans = R.map(val => {
    if (val === true) return 1
    if (val === false) return 0
    return val
  })

  const unnestParameters = params => {
    const type = R.type(params)
    if (type !== 'Array' && type !== 'Object') {
      return params
    }

    const pairs = R.toPairs(params)

    const recursedPairs = pairs.map(([key, value]) => [
      key,
      unnestParameters(value)
    ])

    const flattenedPairs = recursedPairs.map(
      ([key, value]) =>
        R.type(value) === 'Object'
          ? R.compose(
            R.fromPairs,
            R.map(([subKey, subValue]) => [`${key}__${subKey}`, subValue]),
            R.toPairs
          )(value)
          : { [key]: value }
    )

    return R.mergeAll(flattenedPairs)
  }

  const splitwisifyParameters = R.compose(
    convertBooleans,
    unnestParameters
  )

  const getSplitwiseErrors = error => {
    if (!error) {
      return []
    }
    if (typeof error === 'string' || error instanceof String) {
      try {
        return getSplitwiseErrors(JSON.parse(error))
      } catch (e) {
        return [error]
      }
    }
    return [].concat.apply([],
      [error.message, error.error, error.data]
        .concat(
          error.errors ? (Array.isArray(error.errors)
            ? error.errors
            : [].concat.apply([], Object.keys(error.errors).map(k => error.errors[k]))) : []
        )
        .map(getSplitwiseErrors)
        .filter(e => !!e)
    )
  }

  const store = new WeakMap()

  const generateEndpointMethod = function generateEndpointMethod ({
    verb,
    endpoint,
    propName,
    methodName,
    idParamName,
    paramNames = []
  }) {
    const state = store.get(this)
    const { logger, tokenPromise, splitwiseRequest, splitwiseRequestWithData } = state

    if (!endpoint) {
      const message = 'methodWrapper - an endpoint must be specified'
      logger({ level: LOG_LEVELS.ERROR, message })
      throw new Error(message)
    }
    if (!METHOD_VERBS[verb]) {
      const message = 'methodWrapper - unknown http verb'
      logger({ level: LOG_LEVELS.ERROR, message })
      throw new Error(message)
    }
    if (!methodName) {
      const message = 'methodWrapper - a method name must be provided'
      logger({ level: LOG_LEVELS.ERROR, message })
      throw new Error(message)
    }

    const wrapped = (params = {}, callback) => {
      let id = ''
      if (idParamName) {
        id = params.id || params[idParamName] || state[idParamName]
        if (!id) {
          const message = `${methodName} - must provide id parameter`
          const error = new Error(message)
          logger({ level: LOG_LEVELS.ERROR, message })
          if (callback) callback(error, null)
          return Promise.reject(error)
        }
      }

      let url = `${endpoint}/${id}`
      let resultPromise = tokenPromise

      resultPromise.then(() => {
        logger({ message: `${methodName} - making request` })
      }, () => { })

      if (verb === METHOD_VERBS.GET) {
        const queryParams = querystring.stringify(R.pick(paramNames, params))

        if (queryParams) {
          url = `${url}?${queryParams}`
        }

        resultPromise = resultPromise.then(splitwiseRequest(url))
      } else {
        resultPromise = resultPromise.then(
          splitwiseRequestWithData(
            url,
            verb,
            R.pick(paramNames, params)
          )
        )
      }

      resultPromise = resultPromise.then(result => {
        const errors = getSplitwiseErrors(R.pick(['error', 'errors'], result))
        let message
        if (errors.length === 1) {
          message = `${methodName} - ${errors[0]}`
        } else if (errors.length > 1) {
          message = `${methodName}:`
          errors.forEach(e => { message += `\n - ${e}` })
        } else if (result.success === false || result.success === 'false') {
          message = `${methodName} - request was unsuccessful`
        }
        if (message) {
          logger({ level: LOG_LEVELS.ERROR, message })
          return Promise.reject(new Error(message))
        }
        logger({ message: `${methodName} - successfully made request` })
        return result
      }, error => {
        const errors = getSplitwiseErrors(error)
        let message = `${methodName} - request was unsuccessful`
        if (errors.length === 1) {
          message = `${methodName} - ${errors[0]}`
        } else if (errors.length > 1) {
          message = `${methodName}:`
          errors.forEach(e => { message += `\n - ${e}` })
        }
        logger({ level: LOG_LEVELS.ERROR, message })
        return Promise.reject(new Error(message))
      })

      if (propName) {
        resultPromise = resultPromise.then(val => R.propOr(val, propName, val))
      }

      if (callback) {
        resultPromise.then(
          result => {
            callback(null, result)
          },
          error => {
            callback(error, null)
          }
        )
      }

      return resultPromise
    }

    Object.defineProperty(wrapped, 'name', {
      value: methodName,
      writable: false
    })
    return wrapped
  }

  const oAuthRequestWrapper = function oAuthRequestWrapper (url, verb, postData, token) {
    const { logger, oAuthRequest, oauth2 } = store.get(this)

    if (!url) {
      const message = 'oAuthRequestWrapper - a URL must be provided'
      logger({ level: LOG_LEVELS.ERROR, message })
      return Promise.reject(new Error(message))
    }
    if (!METHOD_VERBS[verb]) {
      const message = 'oAuthRequestWrapper - unknown http verb'
      logger({ level: LOG_LEVELS.ERROR, message })
      return Promise.reject(new Error(message))
    }
    if (!token) {
      const message = 'oAuthRequestWrapper - a token must be provided'
      logger({ level: LOG_LEVELS.ERROR, message })
      return Promise.reject(new Error(message))
    }

    return oAuthRequest(
      verb,
      url,
      {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: oauth2.buildAuthHeader(token)
      },
      querystring.stringify(postData),
      null
    )
  }

  const splitwiseRequest = function splitwiseRequest (endpoint) {
    const { logger, oAuthGet } = store.get(this)

    if (!endpoint) {
      const message = 'splitwiseRequest - an endpoint must be specified'
      logger({ level: LOG_LEVELS.ERROR, message })
      return Promise.reject(new Error(message))
    }

    return token =>
      oAuthGet(`${API_URL}${endpoint}`, token).then(JSON.parse)
  }

  const splitwiseRequestWithData = function splitwiseRequestWithData (endpoint, verb, data) {
    const { logger, oAuthRequestWrapper } = store.get(this)

    if (!endpoint) {
      const message = 'splitwiseRequestWithData - an endpoint must be specified'
      logger({ level: LOG_LEVELS.ERROR, message })
      return Promise.reject(new Error(message))
    }
    if (!data) {
      const message = 'splitwiseRequestWithData - data must be provided'
      logger({ level: LOG_LEVELS.ERROR, message })
      return Promise.reject(new Error(message))
    }

    return token =>
      oAuthRequestWrapper(
        `${API_URL}${endpoint}`,
        verb,
        splitwisifyParameters(data),
        token
      ).then(JSON.parse)
  }

  const getTokenPromise = function getTokenPromise (logger, getOAuthAccessToken) {
    return getOAuthAccessToken().then(token => {
      logger({ message: 'successfully aquired access token' })
      return token
    }).catch(error => {
      const reason = (() => {
        let data
        if (error && error.data) {
          try {
            data = JSON.parse(error.data)
          } catch (e) { }
        }

        if (data && data.error === 'invalid_client') {
          return 'your credentials are incorrect'
        }
        if (error && error.statusCode >= 400 && error.statusCode < 500) {
          return 'client error'
        }
        if (error && error.statusCode >= 500 && error.statusCode < 600) {
          return 'server error'
        }
        return 'unknown error'
      })()
      const message = `authentication failed - ${reason}`
      logger({ level: LOG_LEVELS.ERROR, message })
      return Promise.reject(new Error(message))
    })
  }

  const getLogLevel = (logLevel) => {
    if (logLevel && logLevel.toLowerCase() === 'error') {
      return LOG_LEVELS.ERROR
    }
    return LOG_LEVELS.INFO
  }

  const getLoggerMethod = (logger, logLevel) => {
    if (!logger) {
      return () => { }
    }

    return ({ level = LOG_LEVELS.INFO, message }) => {
      if (level === LOG_LEVELS.INFO && logger.info && logLevel !== LOG_LEVELS.ERROR) {
        logger.info(message)
      } else if (level === LOG_LEVELS.ERROR && logger.error) {
        logger.error(message)
      } else if (level !== LOG_LEVELS.INFO || logLevel !== LOG_LEVELS.ERROR) {
        logger(`${level}: ${message}`)
      }
    }
  }

  class Splitwise {
    constructor ({
      consumerKey,
      consumerSecret,
      accessToken,
      groupID,
      userID,
      expenseID,
      friendID,
      logLevel,
      logger
    }) {
      const state = {}
      state.consumerKey = consumerKey
      state.consumerSecret = consumerSecret
      state.groupID = groupID
      state.userID = userID
      state.expenseID = expenseID
      state.friendID = friendID
      state.logLevel = getLogLevel(logLevel)
      state.logger = getLoggerMethod(logger, logLevel)

      if (!state.consumerKey || !state.consumerSecret) {
        const message = 'both a consumer key, and a consumer secret must be provided'
        state.logger({ level: LOG_LEVELS.ERROR, message })
        throw new Error(message)
      }

      state.oauth2 = new OAuth2(
        consumerKey,
        consumerSecret,
        'https://secure.splitwise.com/',
        null,
        'oauth/token',
        null
      )

      state.getOAuthAccessToken = promisify(
        state.oauth2.getOAuthAccessToken,
        { thisArg: state.oauth2 }
      ).bind(null, '', { grant_type: 'client_credentials' })

      state.oAuthGet = promisify(state.oauth2.get, { thisArg: state.oauth2 })

      // eslint-disable-next-line no-underscore-dangle
      state.oAuthRequest = promisify(state.oauth2._request, { thisArg: state.oauth2 })
      state.tokenPromise = (() => {
        if (accessToken) {
          state.logger({ message: 'using provided access token' })
          return Promise.result(accessToken)
        } else {
          state.logger({ message: 'making request for access token' })
          return getTokenPromise(state.logger, state.getOAuthAccessToken)
        }
      })()

      state.oAuthRequestWrapper = oAuthRequestWrapper.bind(this)
      state.splitwiseRequest = splitwiseRequest.bind(this)
      state.splitwiseRequestWithData = splitwiseRequestWithData.bind(this)

      store.set(this, state)

      R.values(METHODS).forEach(method => {
        this[method.methodName] = generateEndpointMethod.call(this, method)
      })
    }

    getAccessToken () {
      return store.get(this).tokenPromise
    }

    refreshAccessToken () {
      const state = store.get(this)

      state.tokenPromise = getTokenPromise(state.logger, state.getOAuthAccessToken)
      store.set(this, state)
      return state.tokenPromise
    }

    createDebt ({ from, to, amount, description, groupID }) {
      return this.createExpense({
        description,
        groupID,
        payment: false,
        cost: amount,
        users: [
          {
            user_id: from,
            paid_share: amount
          },
          {
            user_id: to,
            owed_share: amount
          }
        ]
      })
    }
  }

  return (opts) => new Splitwise(opts)
}())
