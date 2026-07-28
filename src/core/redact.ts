const sensitiveName = String.raw`(?:authorization|proxy-authorization|cookie|set-cookie|password|secret|token|api[_-]?key|apikey|credential)`;
const authorizationScheme = /\b(?:Bearer|Basic|ApiKey)\s+[A-Za-z0-9._~+/=-]+/giu;
const urlUserinfo = /(https?:\/\/)[^\s/@:]+(?::[^\s/@]*)?@/giu;
const jsonValue = new RegExp(`("${sensitiveName}"\\s*:\\s*)(?:"(?:\\\\.|[^"\\\\])*"|[^,}\\s]+)`, 'giu');
const headerValue = new RegExp(`(^|[\\r\\n])(${sensitiveName}\\s*:\\s*)[^\\r\\n]*`, 'giu');
const assignmentValue = new RegExp(`\\b(${sensitiveName})(\\s*=\\s*)[^&\\s;,]+`, 'giu');
const queryValue = new RegExp(`([?&]${sensitiveName}=)[^&#\\s]*`, 'giu');

export function redact(value: unknown): string {
  return stringify(value)
    .replace(authorizationScheme, '[REDACTED]')
    .replace(urlUserinfo, '$1[REDACTED]@')
    .replace(jsonValue, '$1"[REDACTED]"')
    .replace(headerValue, '$1$2[REDACTED]')
    .replace(queryValue, '$1[REDACTED]')
    .replace(assignmentValue, '$1$2[REDACTED]');
}

function stringify(value: unknown): string {
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}
