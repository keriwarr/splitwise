# splitwise

A JavaScript SDK for the [Splitwise API](http://dev.splitwise.com/).

## Quickstart

### Step 1: Register your Application

You will need a consumer key and a consumer secret from Splitwise to use this module. Get them here: https://secure.splitwise.com/oauth_clients.

### Step 2: Install

This module works with Node.js, version `6` or newer. To install, run:

```shell
 $ yarn add splitwise
```
OR
```shell
 $ npm install --save splitwise
```

### Step 3: Basic Example

```javascript
const Splitwise = require('splitwise')
const sw = new Splitwise({
  consumerKey: 'your key here',
  consumerSecret: 'your secret here'
})

sw.getCurrentUser().then(console.log)
```

## Non-trivial Example

In this example, we create a new expense from the current user, to the first listed user in the given group, with the same description as the first given expense.

```javascript
const Splitwise = require('splitwise')
const sw = new Splitwise({
  consumerKey: 'your key here',
  consumerSecret: 'your secret here'
})
const groupID = '12345678'

Promise.all([
  sw.getGroup({ groupID: groupID }),
  sw.getExpenses({ groupID: groupID }),
  sw.getCurrentUser()
]).then(([group, expenses, me]) => sw.createDebt({
  from: group.members[0].id,
  to: me.id,
  groupID: groupID,
  description: expenses[0].description,
  amount: 100
}))
```

## Documentation

In order to know which parameters must or can be passed into various methods, please refer to the original API documentation: http://dev.splitwise.com/dokuwiki/doku.php.

### `new Splitwise(options)`

To the constructor, you must pass in a `consumerKey` and a `consumerSecret`.

You may optionally pass in the following parameters: `groupID`, `userID`, `expenseID`, and `friendID`. They will be used by default for basic CRUD operations if you do not specify an ID. For example:

```javascript
const sw = new Splitwise({
  // ...
  groupID: '12345678',
});

sw.getGroup().then(console.log);
```

### Wrapper Methods

For any of the API methods documented on Splitwise's website, you can use it by calling the camelcase named version of the endpoint on the splitwise object (i.e. `remove_user_from_group` becomes `sw.removeUserFromGroup()`).

For some group methods such as `getGroup` you must pass in a groupID:

```javascript
sw.getGroup({ groupID: '12345678' }).then();
```

For some expense methods, user methods, and friend methods, you must do the same.

Splitwise makes some important notes about their API that booleans and nested parameters don't work. You don't need to worry about this. Instead of calling:

```javascript
sw.createExpense({
  users__0__user_id: '23456789',
  users__1__users_id: '34567890',
  payment: 0
})
```
You make simply do:
```javascript
sw.createExpense({
  users: [
    { user_id: '23456789' },
    { user_id: '34567890' }
  ],
  payment: false
})
```

And on that note...

### `sw.createDebt()`

The params that must be passed into the `create_expense` endpoint are a little obtuse, so there is provided this helper method which can be used as follows:

```javascript
sw.createDebt({
  from: '23456789',
  to: '34567890',
  amount: 100,
  description: 'yay!'
})
```

## Notes

Here is an alternative to this package: https://github.com/Dean177/splitwise-node

This package came about after I wrote a [blog post](https://keri.warr.ca/2017/10/30/using-the-splitwise-api-from-node/) about using this API.

## License

[MIT](https://github.com/keriwarr/splitwise/blob/master/LICENSE)
