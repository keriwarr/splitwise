# splitwise

[![Greenkeeper badge](https://badges.greenkeeper.io/keriwarr/splitwise.svg)](https://greenkeeper.io/) [![codecov](https://codecov.io/gh/keriwarr/splitwise/branch/master/graph/badge.svg)](https://codecov.io/gh/keriwarr/splitwise)

A JavaScript SDK for the [Splitwise API](http://dev.splitwise.com/).

## Quickstart

### Step 1: Register your Application

You will need a consumer key and a consumer secret from Splitwise to use this SDK. Get them here: https://secure.splitwise.com/oauth_clients.

### Step 2: Install

This module works with Node.js, version `6` or newer. To install, run:

```shell
 $ yarn add splitwise
```

### Step 3: Get the current user

```javascript
const Splitwise = require('splitwise')
const sw = Splitwise({
  consumerKey: 'your key here',
  consumerSecret: 'your secret here'
})

sw.getCurrentUser().then(console.log) // => { id: ... }
```

## Non-trivial Example

In this example, we create a new expense from the current user to the first listed user in the given group, with the same description as the first given expense.

```javascript
const Splitwise = require('splitwise')
const sw = Splitwise({
  consumerKey: 'your key here',
  consumerSecret: 'your secret here'
})
const group_id = '12345678'

Promise.all([
  sw.getGroup({ id: group_id }),
  sw.getExpenses({ id: group_id }),
  sw.getCurrentUser()
]).then(([group, expenses, me]) => sw.createDebt({
  from: group.members[0].id,
  to: me.id,
  group_id: group_id,
  description: expenses[0].description,
  amount: 100
})).then(
  console.log
).catch(
  console.error
)
```

## Using Authorisation code

#### We strongly recommend using this beacuse of higher level of security. Reference to working of [oauth2](https://oauth.net/getting-started/).

In this example, we create login using authorization code
1. Initialise the splitwise instance with `grant_type:authorization_code`. You will alse need a `redirect_uri` for this. This will be the same as the one you used while creating your app here https://secure.splitwise.com/oauth_clients.

```
const Splitwise = require('splitwise');
const sw = Splitwise({
  consumerKey: 'your key here',
  consumerSecret: 'your secret here',
  grant_type: 'authorization_code',
  redirect_uri: 'your redirect_uri'
});
```
2. Get the authorization url before calling any APIs using `getAuthorizationUrl()`.
```
const authUrl = sw.getAuthorizationUrl();
```
This url will contain a login page returned by splitwise. This url will also contain the `redirect_uri`. This should match with the one you used while registering your app. After the user logs in, splitwise will call your `callback` url that you mentioned while creating your app. This will contain a state and a code in the query params.  

3. Get the access token from the auth code using your callback API. Use the returned code and state to get the access token.
```
app.get('/callback', (req, res) => {
  return sw.getAccessToken(req.query.code, req.query.state)
    .then(accessToken => {
      return res.json({status: 200, accessToken});
    })
    .catch(err => {
      return res.json({status: 500, error: err});
    })
});
```

Now your access token is registered and it will be used while calling any APIs. You can call library APIs after this like the examples below.


## API Reference

### `const sw = Splitwise({...})`

This is the entry point to the package. All of the other methods are in the form of properties of `sw`.

[Click here](#methods) to view the list of available methods.

#### Parameters

| name | required? | notes |
|-|-|-|
| `consumerKey` | **yes** | Obtained by registering your application |
| `consumerSecret` | **yes** | Obtained by registering your application |
| `grant_type` | no | `authorization_code` or `client_credentials`(default) |
| `redirect_uri` | no | Required for `authorization_code`. |
| `accessToken` | no | Re-use an existing access token |
| `logger` | no | Will be called with info and error messages |
| `logLevel` | no | Set to `'error'` to only see error messages |
| `group_id` | no | See below |
| `user_id` | no | " |
| `expense_id` | no | " |
| `friend_id` | no | " |

The following parameters: `group_id`, `user_id`, `expense_id`, and `friend_id` can be passed in, to be used by default with all `get`/`update`/`delete` type operations. For example:

```javascript
const sw = Splitwise({
  // ...
  group_id: '12345678',
});

sw.getGroup({ id: '12345678' }).then(console.log);
// is equivalent to
sw.getGroup().then(console.log);
```

#### Logging

You can pass in a logging function to see useful debugging output. If the `logger` that is passed in has `info` or `error` properties, then `logger.info` and `logger.error` will be called with info and error messages respectively. Otherwise, `logger` will itself be called with a string as the first argument. Therefore, for debugging purposes, `console.log` is recommended.

If you only want to see logs in the case of an error, you can pass in `logLevel: 'error'`. e.g.:

```javascript
const sw = Splitwise({
  consumerKey: 'your key here',
  consumerSecret: 'your secret here',
  logger: console.log
})
// => Info: making request for access token
// ...
// => Info: successfully aquired access token
```
```javascript
const sw = Splitwise({
  consumerKey: 'your key here',
  consumerSecret: 'INCORRECT secret here',
  logger: console.log,
  logLevel: 'error'
})
// ...
// => Error: your credentials are incorrect
```
#### `sw.getAccessToken()`

When you call `Splitwise()`, an access token will automatically be fetched using your consumer credentials. If you wish to avoid this behaviour in order to save yourself a network round-trip, you may pass in your own `accessToken`. You can obtain a re-usable access token as follows:

```javascript
Splitwise({
  consumerKey: 'your key here',
  consumerSecret: 'your secret here'
}).getAccessToken().then(console.log) // => abcd1234...

// Now save the token somewhere (but don't check it into your VCS!)

const sw = Splitwise({
  consumerKey: 'your key here',
  consumerSecret: 'your secret here',
  accessToken: 'abcd1234...'
})
// do stuff with `sw`
```
### `sw.createDebt({...})`

The endpoint for creating debts is a little awkward to use. If you are in the common scenario of needing to create a simple debt between two individuals, this method will do just that.

```javascript
sw.createDebt({
  from: '23456789',
  to: '34567890',
  amount: 100,
  description: 'I am broke, please give me $100',
  group_id: '12345678' // optional
})
```

### Methods

All of the below methods should be called with an object of parameters as the first argument, and (if you must), a callback as the second argument. They all will return [Promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) which will be resolved if and only if the request was successful, and rejected otherwise. e.g.:

```javascript
sw.verbResource({
  id: '12345678',
  otherParam: 'foo'
} /*, callback */).then(
  data => doSomethingWithTheData(data)
).catch(
  error => handleTheError(error)
)
```

Without further ado, here is the list of all available methods. In order to see the specifics of which parameters should be passed in, and which data can be expected in response, please refer to the [official API documentation](http://dev.splitwise.com/), or click on the method in question.

 - [`sw.test()`](http://dev.splitwise.com/dokuwiki/doku.php?id=test)
 - [`sw.getCurrencies()`](https://dev.splitwise.com/#tag/other/paths/~1get_currencies/get)
 - [`sw.getCategories()`](https://dev.splitwise.com/#tag/other/paths/~1get_categories/get)
 - [`sw.parseSentence()`](https://dev.splitwise.com/#tag/other/paths/~1parse_sentence/post)
 - [`sw.getCurrentUser()`](https://dev.splitwise.com/#tag/users/paths/~1get_current_user/get)
 - [`sw.getUser()`](https://dev.splitwise.com/#tag/users/paths/~1get_user~1{id}/get)
 - [`sw.updateUser()`](https://dev.splitwise.com/#tag/users/paths/~1update_user~1{id}/post)
 - [`sw.getGroups()`](https://dev.splitwise.com/#tag/groups/paths/~1get_groups/get)
 - [`sw.getGroup()`](https://dev.splitwise.com/#tag/groups/paths/~1get_group~1{id}/get)
 - [`sw.createGroup()`](https://dev.splitwise.com/#tag/groups/paths/~1create_group/post)
 - [`sw.deleteGroup()`](https://dev.splitwise.com/#tag/groups/paths/~1delete_group~1{id}/post)
 - [`sw.addUserToGroup()`](https://dev.splitwise.com/#tag/groups/paths/~1add_user_to_group/post)
 - [`sw.removeUserFromGroup()`](https://dev.splitwise.com/#tag/groups/paths/~1remove_user_from_group/post)
 - [`sw.getExpenses()`](https://dev.splitwise.com/#tag/expenses/paths/~1get_expenses/get)
 - [`sw.getExpense()`](https://dev.splitwise.com/#tag/expenses/paths/~1get_expense~1{id}/get)
 - [`sw.createExpense()`](https://dev.splitwise.com/#tag/expenses/paths/~1create_expense/post)
 - [`sw.updateExpense()`](https://dev.splitwise.com/#tag/expenses/paths/~1update_expense~1{id}/post)
 - [`sw.deleteExpense()`](https://dev.splitwise.com/#tag/expenses/paths/~1delete_expense~1{id}/post)
 - [`sw.getFriends()`](https://dev.splitwise.com/#tag/friends/paths/~1get_friends/get)
 - [`sw.getFriend()`](https://dev.splitwise.com/#tag/friends/paths/~1get_friend~1{id}/get)
 - [`sw.createFriend()`](https://dev.splitwise.com/#tag/friends/paths/~1create_friend/post)
 - [`sw.createFriends()`](https://dev.splitwise.com/#tag/friends/paths/~1create_friends/post)
 - [`sw.deleteFriend()`](https://dev.splitwise.com/#tag/friends/paths/~1delete_friend~1{id}/post)
 - [`sw.getNotifications()`](https://dev.splitwise.com/#tag/notifications/paths/~1get_notifications/get)
 - `sw.getMainData()`

**NOTE**: Splitwise makes some important notes about their API that booleans and nested parameters don't work. You won't need to worry about this. That is, instead of calling:

```javascript
sw.createExpense({ // :'(
  users__0__user_id: '23456789',
  users__1__users_id: '34567890',
  payment: 0
})
```
You can instead do:
```javascript
sw.createExpense({
  users: [
    { user_id: '23456789' },
    { user_id: '34567890' }
  ],
  payment: false
})
```

## Notes

This SDK only enables accessing the user data of the developer (owner) of the application for the linked key/secret.  If you need a solution to enable users to access their own data for use in your app or service you will need to look elsewhere.

Here is a potential alternative to this package: https://github.com/Dean177/splitwise-node

## License

[MIT](https://github.com/keriwarr/splitwise/blob/master/LICENSE)
