// Firestore rejects `undefined` at any nesting depth, so payloads built from
// form data (where optional fields surface as `undefined`) must be cleaned
// before they reach a write call.

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

export function stripUndefinedFields<T>(data: T): T {
  if (Array.isArray(data)) {
    return data.map(stripUndefinedFields) as unknown as T;
  }
  if (isPlainObject(data)) {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleaned[key] = stripUndefinedFields(value);
      }
    }
    return cleaned as T;
  }
  return data;
}
