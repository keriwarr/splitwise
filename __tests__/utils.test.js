const { splitwisifyParameters } = require('../src/utils.js');

test('creates splitwise compatible parameters', () => {
  expect(
    splitwisifyParameters({
      users: [{ user_id: '23456789' }, { user_id: '34567890' }],
      payment: false,
    })
  ).toEqual({
    users__0__user_id: '23456789',
    users__1__user_id: '34567890',
    payment: 0,
  });
});
