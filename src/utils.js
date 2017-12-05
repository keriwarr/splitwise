module.exports = (function () {
  'use strict'

  const R = require('./ramda.js')

  const isString = R.is(String)
  const isArray = R.is(Array)
  const isObject = R.is(Object)
  const isArrayOrObject = R.anyPass([isArray, isObject])

  const mapToObject = R.curry((mapFn, array) => R.fromPairs(
    R.map(val => R.pair(val, mapFn(val)), array)
  ))

  const convertBooleans = R.map(val => {
    if (val === true) return 1
    if (val === false) return 0
    return val
  })

  const unnestParameters = params => {
    if (!isArrayOrObject(params)) {
      return params
    }

    const recursedPairs = R.compose(
      R.toPairs,
      R.map(unnestParameters)
    )(params)

    const flattenedPairs = recursedPairs.map(
      ([key, value]) =>
        isObject(value)
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
    if (isString(error)) {
      try {
        return getSplitwiseErrors(JSON.parse(error))
      } catch (e) {
        return [error]
      }
    }

    return R.flatten([
      error.message,
      error.error,
      error.data,
      R.values(error.errors)
    ]).filter(e => !!e).map(getSplitwiseErrors)
  }

  return {
    isString,
    mapToObject,
    splitwisifyParameters,
    getSplitwiseErrors
  }
}())
