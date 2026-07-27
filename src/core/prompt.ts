import type { CommonOptions } from '../cli.js';
import { CliError, EXIT } from '../contracts/error.js';
import type { Runtime } from '../runtime.js';

export function assertPromptAllowed(runtime: Runtime, options: Pick<CommonOptions, 'format' | 'json' | 'noInput'>, missingField: string, hint: string): void {
  const machineMode = options.json === true || ['json', 'ndjson', 'csv', 'raw'].includes(options.format);
  if (options.noInput || machineMode || runtime.stdin.isTTY !== true) {
    throw new CliError({ code: 'MISSING_INPUT', message: `${missingField} is required in non-interactive mode`, exitCode: EXIT.usage, retryable: false, field: missingField, hint });
  }
}
