const R = require('./ramda.js');

const isString = R.is(String);
const isArray = R.is(Array);
const isObject = R.is(Object);
const isArrayOrObject = R.anyPass([isArray, isObject]);

const convertBooleans = R.map((val) => {
  if (val === true) return 1;
  if (val === false) return 0;
  return val;
});

const unnestParameters = (params) => {
  if (!isArrayOrObject(params)) {
    return params;
  }

  const recursedPairs = R.compose(
    R.toPairs,
    R.map(unnestParameters)
  )(params);

  const flattenedPairs = recursedPairs.map(
    ([key, value]) => (isObject(value)
      ? R.compose(
        R.fromPairs,
        R.map(([subKey, subValue]) => [`${key}__${subKey}`, subValue]),
        R.toPairs
      )(value)
      : { [key]: value })
  );

  return R.mergeAll(flattenedPairs);
};

const splitwisifyParameters = R.compose(
  convertBooleans,
  unnestParameters
);

const getSplitwiseErrors = (error) => {
  if (!error) {
    return [];
  }
  if (isString(error)) {
    try {
      return getSplitwiseErrors(JSON.parse(error));
    } catch (e) {
      return [error];
    }
  }

  return R.flatten([error.message, error.error, error.data, R.values(error.errors)])
    .filter(e => !!e)
    .map(getSplitwiseErrors);
};

module.exports.isString = isString;
module.exports.splitwisifyParameters = splitwisifyParameters;
module.exports.getSplitwiseErrors = getSplitwiseErrors;
