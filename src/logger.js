'use script';

const R = require('./ramda.js');
const { isString, isFunction } = require('./utils.js');

const LOG_LEVELS = {
  ERROR: 'error',
  INFO: 'info',
};

const LOG_LEVEL_NAMES = R.values(LOG_LEVELS);

const DEFAULT_LOG_LEVEL = LOG_LEVELS.INFO;

const getLevelRank = (level) => {
  switch (level) {
    case LOG_LEVELS.ERROR:
      return 0;
    case LOG_LEVELS.INFO:
      return 1;
    default:
      return 2;
  }
};

const getLoggerMethod = (logger, level) => {
  if (!logger) {
    return () => {};
  }

  const loggerProperty = (() => {
    switch (level) {
      case LOG_LEVELS.ERROR:
        return logger.error;
      case LOG_LEVELS.INFO:
        return logger.info;
      default:
        return null;
    }
  })();

  if (isFunction(loggerProperty)) {
    return loggerProperty;
  }

  if (isFunction(logger)) {
    return message => logger(`${level}: ${message}`);
  }

  return () => {};
};

const getLogLevel = (providedThreshold) => {
  if (!isString(providedThreshold)) {
    return DEFAULT_LOG_LEVEL;
  }
  const threshold = R.find(
    levelName => levelName.toLowerCase() === providedThreshold.toLowerCase(),
    LOG_LEVEL_NAMES
  );

  return threshold || DEFAULT_LOG_LEVEL;
};

const getLogger = (logger, providedLevel) => {
  const thresholdLevel = getLogLevel(providedLevel);

  return ({ level = LOG_LEVELS.INFO, message }) => {
    const loggerMethod = getLoggerMethod(logger, level);
    if (loggerMethod && getLevelRank(level) <= getLevelRank(thresholdLevel)) {
      loggerMethod(message);
    }
  };
};

module.exports.LOG_LEVELS = LOG_LEVELS;
module.exports.getLogger = getLogger;
