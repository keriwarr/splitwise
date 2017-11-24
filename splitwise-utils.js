module.exports = (function () {
  'use strict'

  const R = require('./ramda.js')

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

  return {
    splitwisifyParameters,
    getSplitwiseErrors
  }
}())
