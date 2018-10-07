'use script';

const R = require('./ramda.js');
const { isString } = require('./utils.js');

const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  VERBOSE: 'verbose',
  DEBUG: 'debug',
  SILLY: 'silly',
};

const LOG_LEVEL_NAMES = R.values(LOG_LEVELS);

const getLevelRank = (level) => {
  switch (level) {
    case LOG_LEVELS.ERROR:
      return 0;
    case LOG_LEVELS.WARN:
      return 1;
    case LOG_LEVELS.INFO:
      return 2;
    case LOG_LEVELS.VERBOSE:
      return 3;
    case LOG_LEVELS.DEBUG:
      return 4;
    case LOG_LEVELS.SILLY:
      return 5;
    default:
      return 0;
  }
};

const getLoggerMethod = (logger, level) => {
  const loggerProperty = (() => {
    switch (level) {
      case LOG_LEVELS.ERROR:
        return logger.error;
      case LOG_LEVELS.WARN:
        return logger.warn;
      case LOG_LEVELS.INFO:
        return logger.info;
      case LOG_LEVELS.VERBOSE:
        return logger.verbose;
      case LOG_LEVELS.DEBUG:
        return logger.debug;
      case LOG_LEVELS.SILLY:
        return logger.silly;
      default:
        return null;
    }
  })();

  if (loggerProperty) {
    return loggerProperty;
  }

  return message => logger(`${level}: ${message}`);
};

const getLogThreshold = (providedThreshold) => {
  if (!isString(providedThreshold)) {
    return LOG_LEVELS.INFO;
  }
  const threshold = R.find(
    levelName => levelName.toLowerCase() === providedThreshold.toLowerCase(),
    LOG_LEVEL_NAMES
  );

  return threshold || LOG_LEVELS.INFO;
};

const getLogger = (logger, providedLevel) => {
  if (!logger) {
    return () => {};
  }
  const thresholdLevel = getLogThreshold(providedLevel);

  return ({ level = LOG_LEVELS.INFO, message }) => {
    if (getLoggerMethod(level) && getLevelRank(level) >= getLevelRank(thresholdLevel)) {
      getLoggerMethod(level)(message);
    }
  };
};

module.exports.LOG_LEVELS = LOG_LEVELS;
module.exports.getLogger = getLogger;
