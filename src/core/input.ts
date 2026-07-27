import { resolve } from 'node:path';
import { CliError, EXIT, usageError } from '../contracts/error.js';
import type { Runtime } from '../runtime.js';

export async function readJsonInput(runtime: Runtime, input: string | undefined, field = 'body'): Promise<unknown> {
  if (!input) throw usageError(`--${field} is required`, `Pass --${field} @PATH or --${field} - for explicit stdin`, field);
  let text: string;
  try {
    if (input === '-') text = await readStdin(runtime);
    else if (input.startsWith('@') && input.length > 1) text = runtime.fs.readFileSync(resolve(runtime.cwd, input.slice(1)), 'utf8');
    else throw usageError(`--${field} must use @PATH or -`, `Pass --${field} @request.json or --${field} -`, field);
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError({ code: 'INPUT_IO_FAILED', message: `Could not read --${field} input`, exitCode: EXIT.io, retryable: false, field, hint: `Check the file path and permissions, or pass --${field} -` }, { cause: error });
  }
  try { return JSON.parse(text); }
  catch (error) { throw new CliError({ code: 'INVALID_JSON_INPUT', message: `--${field} input is not valid JSON`, exitCode: EXIT.usage, retryable: false, field, hint: 'Validate the JSON document and retry' }, { cause: error }); }
}

async function readStdin(runtime: Runtime): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of runtime.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  return Buffer.concat(chunks).toString('utf8');
}
