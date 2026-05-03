/**
 * Parameter conversion utilities for the Splitwise API.
 *
 * The SDK accepts camelCase params (idiomatic JS) and converts them to the
 * snake_case + double-underscore-flattened format the Splitwise API expects.
 */

// ---------------------------------------------------------------------------
// String case conversion
// ---------------------------------------------------------------------------

/**
 * Converts a camelCase or PascalCase string to snake_case.
 * Already-snake_case strings pass through unchanged.
 */
export function toSnakeCase(str: string): string {
  return str
    // Insert underscore between a lowercase/digit and an uppercase letter
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    // Insert underscore between consecutive uppercase letters followed by lowercase
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

/**
 * Converts a snake_case string to camelCase.
 * Already-camelCase strings pass through unchanged.
 */
export function toCamelCase(str: string): string {
  return str.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

// ---------------------------------------------------------------------------
// Recursive key conversion
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}

/**
 * Recursively converts all object keys from camelCase to snake_case.
 * Primitives, null, undefined, Dates, and arrays of primitives pass through.
 */
export function keysToSnakeCase(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(keysToSnakeCase);
  }

  if (!isPlainObject(obj)) {
    return obj;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[toSnakeCase(key)] = keysToSnakeCase(value);
  }
  return result;
}

/**
 * Recursively converts all object keys from snake_case to camelCase.
 * Primitives, null, undefined, Dates, and arrays of primitives pass through.
 */
export function keysToCamelCase(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(keysToCamelCase);
  }

  if (!isPlainObject(obj)) {
    return obj;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[toCamelCase(key)] = keysToCamelCase(value);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Parameter flattening for the Splitwise API
// ---------------------------------------------------------------------------

type FlatValue = string | number | boolean;

/**
 * Flattens nested objects/arrays into Splitwise's double-underscore notation
 * and converts booleans to 0/1 integers. All keys are converted to snake_case.
 *
 * Example:
 *   { users: [{ userId: 1, paidShare: "10" }] }
 *   → { "users__0__user_id": 1, "users__0__paid_share": "10" }
 */
export function flattenParams(
  obj: Record<string, unknown>,
): Record<string, FlatValue> {
  const result: Record<string, FlatValue> = {};

  function walk(value: unknown, prefix: string): void {
    if (value === null || value === undefined) {
      return;
    }

    if (typeof value === 'boolean') {
      result[prefix] = value ? 1 : 0;
      return;
    }

    if (typeof value === 'string' || typeof value === 'number') {
      result[prefix] = value;
      return;
    }

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        walk(value[i], `${prefix}__${i}`);
      }
      return;
    }

    if (isPlainObject(value)) {
      for (const [key, child] of Object.entries(value)) {
        const snakeKey = toSnakeCase(key);
        walk(child, prefix ? `${prefix}__${snakeKey}` : snakeKey);
      }
      return;
    }
  }

  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = toSnakeCase(key);

    if (
      value === null ||
      value === undefined
    ) {
      continue;
    }

    if (typeof value === 'boolean') {
      result[snakeKey] = value ? 1 : 0;
    } else if (typeof value === 'string' || typeof value === 'number') {
      result[snakeKey] = value;
    } else {
      // Arrays or nested objects — recurse with the top-level key as prefix
      walk(value, snakeKey);
    }
  }

  return result;
}
