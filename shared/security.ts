const SECRET_FIELD = /(?:api[_-]?key|client[_-]?secret|bot[_-]?token|(?:^|[_-])token$|access[_-]?token|refresh[_-]?token|authorization|password|secret)/i;

/** Used for public config, exports and structured logs. Never returns credentials. */
export function publicSettings<T>(value: T, seen = new WeakSet<object>()): T {
  if (value && typeof value === 'object') {
    if (seen.has(value)) return '[Circular]' as unknown as T;
    seen.add(value);
  }
  if (Array.isArray(value)) return value.map(item => publicSettings(item, seen)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([key]) => !SECRET_FIELD.test(key))
      .map(([key, item]) => [key, publicSettings(item, seen)])) as T;
  }
  return value;
}

export function redactText(text: string): string {
  return text.replace(/([?&](?:key|access_token)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/AIza[\w-]+/g, '[REDACTED]')
    .replace(/(Bearer\s+)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/((?:api[_-]?key|token|secret|authorization|password)\s*[=:]\s*(?:Bearer\s+)?)[^\s,;]+/gi, '$1[REDACTED]');
}
