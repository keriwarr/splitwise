module.exports = (function () {
  'use script'

  const R = require('./ramda.js')
  const { isString, mapToObject } = require('./utils.js')

  const LOG_LEVELS = {
    INFO: 'Info',
    ERROR: 'Error'
  }

  const LOG_LEVEL_NAMES = R.values(LOG_LEVELS)

  const LEVEL_METHOD_NAMES = {
    [LOG_LEVELS.INFO]: 'info',
    [LOG_LEVELS.ERROR]: 'error'
  }

  const LEVEL_RANK = {
    [LOG_LEVELS.INFO]: 0,
    [LOG_LEVELS.ERROR]: 1
  }

  const getLogThreshold = (providedThreshold) => {
    if (!isString(providedThreshold)) {
      return LOG_LEVELS.INFO
    }
    const threshold = R.find(levelName => (
      levelName.toLowerCase() === providedThreshold.toLowerCase()
    ), LOG_LEVEL_NAMES)

    return threshold || LOG_LEVELS.INFO
  }

  const getLogger = (logger, providedLevel) => {
    if (!logger) {
      return () => { }
    }
    const thresholdLevel = getLogThreshold(providedLevel)
    const levelToMethodMapping = mapToObject(
      levelName => (
        logger[LEVEL_METHOD_NAMES[levelName]] ||
        (message => logger(`${levelName}: ${message}`))
      ),
      LOG_LEVEL_NAMES
    )

    return ({ level = LOG_LEVELS.INFO, message }) => {
      if (levelToMethodMapping[level] && LEVEL_RANK[level] >= LEVEL_RANK[thresholdLevel]) {
        levelToMethodMapping[level](message)
      }
    }
  }

  return { LOG_LEVELS, getLogger }
}())
