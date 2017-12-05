# splitwise

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
  sw.getGroup({ group_id: group_id }),
  sw.getExpenses({ group_id: group_id }),
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

## API Reference

### `const sw = Splitwise({...})`

This is the entry point to the package. All of the other methods are in the form of properties of `sw`.

[Click here](#methods) to view the list of available methods.

#### Parameters

| name | required? | notes |
|-|-|-|
| `consumerKey` | **yes** | Obtained by registering your application |
| `consumerSecret` | **yes** | Obtained by registering your application |
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
 - [`sw.getCurrencies()`](http://dev.splitwise.com/dokuwiki/doku.php?id=get_currencies)
 - [`sw.getCategories()`](http://dev.splitwise.com/dokuwiki/doku.php?id=get_categories)
 - [`sw.parseSentence()`](http://dev.splitwise.com/dokuwiki/doku.php?id=parse_sentence)
 - [`sw.getCurrentUser()`](http://dev.splitwise.com/dokuwiki/doku.php?id=get_current_user)
 - [`sw.getUser()`](http://dev.splitwise.com/dokuwiki/doku.php?id=get_user)
 - [`sw.updateUser()`](http://dev.splitwise.com/dokuwiki/doku.php?id=update_user)
 - [`sw.getGroups()`](http://dev.splitwise.com/dokuwiki/doku.php?id=get_groups)
 - [`sw.getGroup()`](http://dev.splitwise.com/dokuwiki/doku.php?id=get_group)
 - [`sw.createGroup()`](http://dev.splitwise.com/dokuwiki/doku.php?id=create_group)
 - [`sw.deleteGroup()`](http://dev.splitwise.com/dokuwiki/doku.php?id=delete_group)
 - [`sw.addUserToGroup()`](http://dev.splitwise.com/dokuwiki/doku.php?id=add_user_to_group)
 - [`sw.removeUserFromGroup()`](http://dev.splitwise.com/dokuwiki/doku.php?id=remove_user_from_group)
 - [`sw.getExpenses()`](http://dev.splitwise.com/dokuwiki/doku.php?id=get_expenses)
 - [`sw.getExpense()`](http://dev.splitwise.com/dokuwiki/doku.php?id=get_expense)
 - [`sw.createExpense()`](http://dev.splitwise.com/dokuwiki/doku.php?id=create_expense)
 - [`sw.updateExpense()`](http://dev.splitwise.com/dokuwiki/doku.php?id=update_expense)
 - [`sw.deleteExpense()`](http://dev.splitwise.com/dokuwiki/doku.php?id=delete_expense)
 - [`sw.getFriends()`](http://dev.splitwise.com/dokuwiki/doku.php?id=get_friends)
 - [`sw.getFriend()`](http://dev.splitwise.com/dokuwiki/doku.php?id=get_friend)
 - [`sw.createFriend()`](http://dev.splitwise.com/dokuwiki/doku.php?id=create_friend)
 - [`sw.createFriends()`](http://dev.splitwise.com/dokuwiki/doku.php?id=create_friends)
 - [`sw.deleteFriend()`](http://dev.splitwise.com/dokuwiki/doku.php?id=delete_friend)
 - [`sw.getNotifications()`](http://dev.splitwise.com/dokuwiki/doku.php?id=get_notifications)
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

Here is a potential alternative to this package: https://github.com/Dean177/splitwise-node

## License

[MIT](https://github.com/keriwarr/splitwise/blob/master/LICENSE)
