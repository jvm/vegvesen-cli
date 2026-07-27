import { resolve } from 'node:path';
import { CliError, EXIT, usageError } from '../contracts/error.js';
import type { Runtime } from '../runtime.js';

const MAX_JSON_INPUT_BYTES = 1024 * 1024;

export async function readJsonInput(runtime: Runtime, input: string | undefined, field = 'body'): Promise<unknown> {
  if (!input) throw usageError(`--${field} is required`, `Pass --${field} @PATH or --${field} - for explicit stdin`, field);
  let text: string;
  try {
    if (input === '-') text = await readStdin(runtime, field);
    else if (input.startsWith('@') && input.length > 1) {
      const path = resolve(runtime.cwd, input.slice(1));
      const stat = runtime.fs.statSync(path);
      if (!stat.isFile()) throw usageError(`--${field} input must be a regular file`, `Pass --${field} @request.json`, field);
      if (stat.size > MAX_JSON_INPUT_BYTES) throw inputTooLarge(field);
      text = runtime.fs.readFileSync(path, 'utf8');
    }
    else throw usageError(`--${field} must use @PATH or -`, `Pass --${field} @request.json or --${field} -`, field);
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError({ code: 'INPUT_IO_FAILED', message: `Could not read --${field} input`, exitCode: EXIT.io, retryable: false, field, hint: `Check the file path and permissions, or pass --${field} -` }, { cause: error });
  }
  try { return JSON.parse(text); }
  catch (error) { throw new CliError({ code: 'INVALID_JSON_INPUT', message: `--${field} input is not valid JSON`, exitCode: EXIT.usage, retryable: false, field, hint: 'Validate the JSON document and retry' }, { cause: error }); }
}

async function readStdin(runtime: Runtime, field: string): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of runtime.stdin) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    size += bytes.length;
    if (size > MAX_JSON_INPUT_BYTES) throw inputTooLarge(field);
    chunks.push(bytes);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function inputTooLarge(field: string): CliError { return new CliError({ code: 'INPUT_TOO_LARGE', message: `--${field} exceeds the ${MAX_JSON_INPUT_BYTES}-byte JSON input limit`, exitCode: EXIT.usage, retryable: false, field, hint: 'Reduce the JSON document or use a service-native artifact workflow' }); }
