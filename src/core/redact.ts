const secretKey = /(authorization|cookie|password|secret|token|api.?key)/gi;
const bearer = /\b(?:Bearer|Basic|ApiKey)\s+[A-Za-z0-9._~+/=-]+/gi;
const urlUserinfo = /(https?:\/\/)[^\s/@:]+(?::[^\s/@]*)?@/gi;

export function redact(value: unknown): string {
  return String(value)
    .replace(bearer, '[REDACTED]')
    .replace(urlUserinfo, '$1[REDACTED]@')
    .replace(secretKey, '[REDACTED]');
}
