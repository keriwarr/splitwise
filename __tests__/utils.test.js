const { splitwisifyParameters, getSplitwiseErrors } = require('../src/utils.js');

describe('splitwisifyParameters', () => {
  test('creates splitwise compatible parameters', () => {
    expect(
      splitwisifyParameters({
        users: [{ user_id: '23456789' }, { user_id: '34567890' }],
        payment: false,
        something_else: true,
      })
    ).toEqual({
      users__0__user_id: '23456789',
      users__1__user_id: '34567890',
      payment: 0,
      something_else: 1,
    });
  });
});

describe('getSplitwiseErrors', () => {
  const errorMessage = 'this is an error!';

  test('always returns an array', () => {
    expect(getSplitwiseErrors(null)).toBeInstanceOf(Array);
    expect(getSplitwiseErrors('')).toBeInstanceOf(Array);
    expect(getSplitwiseErrors(new Error(''))).toBeInstanceOf(Array);
    expect(getSplitwiseErrors([])).toBeInstanceOf(Array);
    expect(getSplitwiseErrors([new Error('')])).toBeInstanceOf(Array);
    expect(getSplitwiseErrors({ message: '', error: new Error('') })).toBeInstanceOf(Array);
  });

  test('parses json', () => {
    expect(getSplitwiseErrors(`{"error":"${errorMessage}"}`)).toEqual([errorMessage]);
  });

  test('parses json and flattens multiple errors', () => {
    const errors = getSplitwiseErrors(`{"message":"${errorMessage}1", "error":"${errorMessage}2"}`);
    expect(errors).toContain(`${errorMessage}1`);
    expect(errors).toContain(`${errorMessage}2`);
  });
});
