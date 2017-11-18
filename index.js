const { OAuth2 } = require('oauth')
const querystring = require('querystring')
const promisify = require('es6-promisify')
const R = require('ramda')

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
  TEST: {
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
  DELETE_FRIEND: {
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

const splitwisifyParameters = R.compose(convertBooleans, unnestParameters)

const LOG_LEVELS = {
  INFO: 'Info',
  ERROR: 'Error'
}

class Splitwise {
  constructor ({
    consumerKey,
    consumerSecret,
    groupID,
    userID,
    expenseID,
    friendID,
    logger
  }) {
    this.consumerKey = consumerKey
    this.consumerSecret = consumerSecret
    this.groupID = groupID
    this.userID = userID
    this.expenseID = expenseID
    this.friendID = friendID
    this.logger = logger ? ({ level = LOG_LEVELS.INFO, message }) => {
      if (level === LOG_LEVELS.INFO && logger.info) {
        logger.info(message)
      } else if (level === LOG_LEVELS.ERROR && logger.error) {
        logger.error(message)
      } else {
        logger(`${level}: ${message}`)
      }
    } : () => { }

    if (!this.consumerKey || !this.consumerSecret) {
      const message = 'both a consumer key, and a consumer secret must be provided'
      this.logger({ level: LOG_LEVELS.ERROR, message })
      throw new Error(message)
    }

    this.oauth2 = new OAuth2(
      consumerKey,
      consumerSecret,
      'https://secure.splitwise.com/',
      null,
      'oauth/token',
      null
    )

    this.getOAuthAccessToken = promisify(
      this.oauth2.getOAuthAccessToken.bind(this.oauth2, '', {
        grant_type: 'client_credentials'
      })
    )

    this.oAuthGet = promisify(this.oauth2.get.bind(this.oauth2))

    // eslint-disable-next-line no-underscore-dangle
    this.oAuthRequest = promisify(this.oauth2._request.bind(this.oauth2))

    this.logger({message: 'making request for access token'})
    this.tokenPromise = this.getOAuthAccessToken().then(token => {
      this.logger({message: 'successfully aquired access token'})
      return token
    }).catch(error => {
      console.log(error, error.data, error.data.error)
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
      this.logger({ level: LOG_LEVELS.ERROR, message })
      return Promise.reject(new Error(message))
    })

    R.values(METHODS).forEach(method => {
      this[method.methodName] = this.methodWrapper(method)
    })
  }

  oAuthRequestWrapper (url, verb, postData, token) {
    if (!url) {
      const message = 'oAuthRequestWrapper - a URL must be provided'
      this.logger({level: LOG_LEVELS.ERROR, message})
      return Promise.reject(new Error(message))
    }
    if (!METHOD_VERBS[verb]) {
      const message = 'oAuthRequestWrapper - unknown http verb'
      this.logger({level: LOG_LEVELS.ERROR, message})
      return Promise.reject(new Error(message))
    }
    if (!token) {
      const message = 'oAuthRequestWrapper - a token must be provided'
      this.logger({level: LOG_LEVELS.ERROR, message})
      return Promise.reject(new Error(message))
    }

    return this.oAuthRequest(
      verb,
      url,
      {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: this.oauth2.buildAuthHeader(token)
      },
      querystring.stringify(postData),
      null
    )
  }

  splitwiseRequest (endpoint) {
    if (!endpoint) {
      const message = 'splitwiseRequest - an endpoint must be specified'
      this.logger({level: LOG_LEVELS.ERROR, message})
      return Promise.reject(new Error(message))
    }

    return token =>
      this.oAuthGet(`${API_URL}${endpoint}`, token).then(JSON.parse)
  }

  splitwiseRequestWithData (endpoint, verb, data) {
    if (!endpoint) {
      const message = 'splitwiseRequestWithData - an endpoint must be specified'
      this.logger({level: LOG_LEVELS.ERROR, message})
      return Promise.reject(new Error(message))
    }
    if (!data) {
      const message = 'splitwiseRequestWithData - data must be provided'
      this.logger({level: LOG_LEVELS.ERROR, message})
      return Promise.reject(new Error(message))
    }

    return token =>
      this.oAuthRequestWrapper(
        `${API_URL}${endpoint}`,
        verb,
        splitwisifyParameters(data),
        token
      ).then(JSON.parse)
  }

  methodWrapper ({
    verb,
    endpoint,
    propName,
    methodName,
    idParamName,
    paramNames = []
  }) {
    if (!endpoint) {
      const message = 'methodWrapper - an endpoint must be specified'
      this.logger({level: LOG_LEVELS.ERROR, message})
      throw new Error(message)
    }
    if (!METHOD_VERBS[verb]) {
      const message = 'methodWrapper - unknown http verb'
      this.logger({level: LOG_LEVELS.ERROR, message})
      throw new Error(message)
    }
    if (!methodName) {
      const message = 'methodWrapper - a method name must be provided'
      this.logger({level: LOG_LEVELS.ERROR, message})
      throw new Error(message)
    }

    const wrapped = (params = {}, callback) => {
      let id = ''
      if (idParamName) {
        id = params.id || params[idParamName] || this[idParamName]
        if (!id) {
          const message = `${methodName} - must provide id parameter`
          const error = new Error(message)
          this.logger({level: LOG_LEVELS.ERROR, message})
          if (callback) callback(error, null)
          return Promise.reject(error)
        }
      }

      let url = `${endpoint}/${id}`
      let resultPromise = this.tokenPromise

      resultPromise.then(() => {
        this.logger({message: `${methodName} - making request`})
      })

      if (verb === METHOD_VERBS.GET) {
        const queryParams = querystring.stringify(R.pick(paramNames, params))

        if (queryParams) {
          url = `${url}?${queryParams}`
        }

        resultPromise = resultPromise.then(this.splitwiseRequest(url))
      } else {
        resultPromise = resultPromise.then(
          this.splitwiseRequestWithData(
            url,
            verb,
            R.pick(paramNames, params)
          )
        )
      }

      resultPromise.then(() => {
        this.logger({message: `${methodName} - successfully made request`})
      })

      if (propName) {
        resultPromise = resultPromise.then(val => R.propOr(val, propName, val))
      }

      resultPromise = resultPromise.catch(error => {
        const reason = (error && error.message) || error || 'something went wrong'
        const message = `${methodName} - ${reason}`
        this.logger({ level: LOG_LEVELS.ERROR, message })
        return Promise.reject(error)
      })

      if (callback) {
        resultPromise.then(
          result => {
            callback(null, result)
            return result
          },
          error => {
            callback(error, null)
            return Promise.reject(error)
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

  createDebt ({ from, to, amount, description, groupID }) {
    return this.createExpense({
      description,
      groupID: groupID || this.groupID,
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

exports.default = Splitwise
exports.Splitwise = Splitwise
