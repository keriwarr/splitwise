# splitwise

A JavaScript wrapper library/SDK for the [Splitwise API](http://http://dev.splitwise.com/).

Created by [Keri Warr](https://keri.warr.ca) because he 💖s Splitwise.

## Usage

This package can be used with Node with version at least `8`.

## Quickstart

### Step 1:

Register your splitwise application [here](https://secure.splitwise.com/oauth_clients) to get a client key and a client secret.

### Step 2:

```shell
 $ npm install --save splitwise
```

### Step 3:

```javascript
const { Splitwise } = require('splitwise');
const sw = new Splitwise({
  clientKey: 'your key here',
  clientSecret: 'your secret here',
});

sw.getCurrentUser().then(console.log);
```

## Non-trivial example

In this example, we create a new expense from the current user, to the first listed user in the given group, with the same description as the first given expense.

```javascript
const { Splitwise } = require('splitwise');
const sw = new Splitwise({
  consumerKey: 'your key here',
  consumerSecret: 'your secret here',
});
const groupID = '12345678';

Promise.all([
  sw.getGroup({ groupID: groupID }),
  sw.getExpenses({ groupID: groupID }),
  sw.getCurrentUser(),
]).then(([group, expenses, me]) => sw.createDebt({
  from: group.members[0].id,
  to: me.id,
  groupID: groupID,
  description: expenses[0].description,
  amount: 100,
}));
```

## Documentation

In order to know which parameters must or can be passed in to various methods, please refer to the original API documentation: http://dev.splitwise.com/dokuwiki/doku.php.

### `new Splitwise(options)`

To the constructor you must pass in a `consumerKey` and a `consumerSecret`.

You may optionally pass in the following parameters: `groupID`, `userID`, `expenseID`, and `friendID`. They will be used by default for basic CRUD operations if you do not specify an ID. For example:

```javascript
const sw = new Splitwise({
  ...
  groupID: '12345678',
});

sw.getGroup().then(console.log);
```

### Wrapper methods

For any of the API methods documented on Splitwise's website, you can use it by calling the camelcase named version of the endpiont on the splitwise object (i.e. `remove_user_from_group` becomes `sw.removeUserFromGroup()`).

For some group methods such as `getGroup` you must pass in a groupID:

```javascript
sw.getGroup({ groupID: '12345678' }).then(...);
```

For some expense methods, user methods, and friend methods, you must do the same.

Splitwise makes some important notes about their API that booleans, and nested parameters don't work. You don't need to worry about this. Instead of calling:

```javascript
sw.createExpense({
  users__0__user_id: '23456789',
  users__1__users_id: '34567890',
  payment: 0,
});
```
You make simply do:
```javascript
sw.createExpense({
  users: [
    { user_id: '23456789' },
    { user_id: '34567890' },
  ],
  payment: false,
});
```

And on that note...

### `sw.createDebt()`

The params that must be passed in to the `create_expense` endpoint are a little obtuse, so there is provided this hepler method which can be used as follows:

```javascript
sw.createDebt({
  from: '23456789',
  to: '34567890',
  amount: 100,
  description: 'yay!',
});
```

## Notes

This package came about after I wrote a [blog post](https://keri.warr.ca/2017/10/30/using-the-splitwise-api-from-node/) about using this API.

## License

This package is MIT licensed.
