const { getLogger, LOG_LEVELS } = require('../src/logger.js');

const errorMessage = 'error message!';

// ref: https://github.com/facebook/jest/issues/6329
const makeWrappedMockLogger = mockLogger => (...args) => mockLogger(args);

describe('getLogger', () => {
  test('returns a function', () => {
    expect(getLogger()).toBeInstanceOf(Function);
  });

  test('uses an error log level', () => {
    const mockLogger = jest.fn();
    const wrappedMockLogger = makeWrappedMockLogger(mockLogger);

    const logger = getLogger(wrappedMockLogger, LOG_LEVELS.ERROR);

    logger({ level: LOG_LEVELS.INFO, message: errorMessage });
    expect(mockLogger).not.toHaveBeenCalled();

    logger({ level: LOG_LEVELS.ERROR, message: errorMessage });
    expect(mockLogger).toHaveBeenCalledTimes(1);
    expect(mockLogger).toHaveBeenLastCalledWith([`${LOG_LEVELS.ERROR}: ${errorMessage}`]);
  });

  test('uses an info log level', () => {
    const mockLogger = jest.fn();
    const wrappedMockLogger = makeWrappedMockLogger(mockLogger);

    const logger = getLogger(wrappedMockLogger, LOG_LEVELS.INFO);

    logger({ level: LOG_LEVELS.INFO, message: errorMessage });
    expect(mockLogger).toHaveBeenCalledTimes(1);
    expect(mockLogger).toHaveBeenLastCalledWith([`${LOG_LEVELS.INFO}: ${errorMessage}`]);

    logger({ level: LOG_LEVELS.ERROR, message: errorMessage });
    expect(mockLogger).toHaveBeenCalledTimes(2);
    expect(mockLogger).toHaveBeenLastCalledWith([`${LOG_LEVELS.ERROR}: ${errorMessage}`]);
  });

  test('uses a default log level', () => {
    const mockLogger = jest.fn();
    const wrappedMockLogger = makeWrappedMockLogger(mockLogger);

    const logger = getLogger(wrappedMockLogger, 'invalid');

    logger({ level: LOG_LEVELS.ERROR, message: errorMessage });
    expect(mockLogger).toHaveBeenCalledTimes(1);
    expect(mockLogger).toHaveBeenLastCalledWith([`${LOG_LEVELS.ERROR}: ${errorMessage}`]);
  });

  test('uses provided info and error level loggers', () => {
    const mockInfoLogger = jest.fn();
    const mockErrorLogger = jest.fn();

    const mockLoggers = {
      info: makeWrappedMockLogger(mockInfoLogger),
      error: makeWrappedMockLogger(mockErrorLogger),
    };

    const logger = getLogger(mockLoggers, LOG_LEVELS.INFO);

    logger({ level: LOG_LEVELS.ERROR, message: errorMessage });
    expect(mockErrorLogger).toHaveBeenCalledTimes(1);
    expect(mockErrorLogger).toHaveBeenLastCalledWith([`${errorMessage}`]);
    expect(mockInfoLogger).not.toHaveBeenCalled();

    logger({ level: LOG_LEVELS.INFO, message: errorMessage });
    expect(mockErrorLogger).toHaveBeenCalledTimes(1);
    expect(mockInfoLogger).toHaveBeenCalledTimes(1);
    expect(mockInfoLogger).toHaveBeenLastCalledWith([`${errorMessage}`]);
  });

  test('still returns a function even in this weird edge case', () => {
    const logger = getLogger({});
    expect(logger).toBeInstanceOf(Function);
    logger({ level: LOG_LEVELS.ERROR, message: errorMessage });
  });

  test('does not log messages with invalid levels', () => {
    const mockLogger = jest.fn();
    const wrappedMockLogger = makeWrappedMockLogger(mockLogger);

    const logger = getLogger(wrappedMockLogger, LOG_LEVELS.INFO);

    logger({ level: 'invalid', message: errorMessage });
    expect(mockLogger).not.toHaveBeenCalled();

    logger({ level: LOG_LEVELS.ERROR, message: errorMessage });
    expect(mockLogger).toHaveBeenCalledTimes(1);
    expect(mockLogger).toHaveBeenLastCalledWith([`${LOG_LEVELS.ERROR}: ${errorMessage}`]);

    logger({ level: 'invalid', message: errorMessage });
    expect(mockLogger).toHaveBeenCalledTimes(1);
  });
});
