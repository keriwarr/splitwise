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

/**
 * True only for plain Object or Object.create(null) instances. Built-in
 * classes (Date, Blob, URL, Map, Set, etc.) intentionally return false so
 * the recursive helpers don't try to walk into them and replace them with
 * `{}` (Object.entries returns [] for most built-ins, which would silently
 * destroy the value).
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

/**
 * Recursively converts all object keys from camelCase to snake_case.
 * Plain objects and arrays are walked; everything else (primitives,
 * Date, Blob, URL, Map, Set, custom classes, etc.) passes through
 * untouched so the caller / JSON.stringify can handle them.
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
 * Plain objects and arrays are walked; everything else passes through.
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

/**
 * Result entry from flattening — most values become a primitive plus their
 * key. Blobs are kept as-is because they need to ride a multipart payload
 * (the caller is responsible for building the FormData).
 */
export type FlatValue = string | number | boolean | Blob;

/**
 * Flattens nested objects/arrays into Splitwise's double-underscore notation
 * and converts booleans to 0/1 integers. All keys are converted to snake_case.
 *
 * Notable conversions:
 *   - Date → ISO string (otherwise Date has no enumerable own properties and
 *     would silently disappear)
 *   - Blob/File → preserved as-is so multipart construction can pick them up
 *     (the caller must check for Blob values before form-urlencoding)
 *   - URL → string form
 *   - Anything else non-plain-object that has a sensible `toString()` is
 *     stringified rather than silently dropped
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

    if (value instanceof Date) {
      result[prefix] = value.toISOString();
      return;
    }

    if (value instanceof Blob) {
      result[prefix] = value;
      return;
    }

    if (typeof URL !== 'undefined' && value instanceof URL) {
      result[prefix] = value.toString();
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

    // Fallback: anything else (BigInt, custom class, etc.) gets stringified
    // rather than silently dropped. Better a "[object Foo]" in the request
    // than a missing field that's hard to diagnose.
    result[prefix] = String(value);
  }

  for (const [key, value] of Object.entries(obj)) {
    walk(value, toSnakeCase(key));
  }

  return result;
}
