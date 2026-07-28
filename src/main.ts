import type { Writable } from 'node:stream';
import { CommanderError, InvalidArgumentError } from 'commander';
import { CliError, EXIT } from './contracts/error.js';
import type { CommandResult, ErrorFormat, OutputFormat } from './contracts/output.js';
import { commanderUsageError, parseCli } from './cli.js';
import { redact } from './core/redact.js';
import { renderResult, renderStreamRecord, writeError } from './core/output.js';
import { saveBytes, validateArtifactDestination } from './core/artifact-writer.js';
import { processRuntime, type Runtime } from './runtime.js';

export async function main(argv: string[], runtime: Runtime = processRuntime()): Promise<number> {
  const detected = detectPresentation(argv, runtime);
  try {
    const execution = await parseCli(argv, runtime);
    if (execution.helpOrVersion || execution.result === null) return 0;
    if (execution.result.nativeStream) {
      for await (const chunk of execution.result.nativeStream) if (!runtime.stdout.write(chunk)) await waitForDrain(runtime.stdout, runtime.signal);
      return execution.result.exitCode ?? 0;
    }
    if (execution.result.stream) {
      const format = execution.options.format === 'raw' ? 'raw' : 'ndjson';
      let items = 0;
      try {
        for await (const record of execution.result.stream) {
          if (record.type === 'item') items += 1;
          const chunk = renderStreamRecord(record, format, execution.options.field);
          if (chunk && !runtime.stdout.write(chunk)) await waitForDrain(runtime.stdout, runtime.signal);
        }
      } catch (error) {
        if (items === 0 || runtime.signal.aborted || !(error instanceof CliError)) throw error;
        throw new CliError({ ...error.details, exitCode: EXIT.partial }, { cause: error });
      }
      return execution.result.exitCode ?? 0;
    }
    const output = renderResult(execution.result, {
      format: execution.options.format,
      fields: execution.options.field,
      stdoutIsTTY: runtime.stdout.isTTY === true,
    });
    if (execution.result.outputHandled) {
      if (execution.options.output === '-') runtime.stdout.write(execution.result.raw ?? output);
      else if (execution.options.receiptFormat !== 'none') writeReceipt(runtime, execution.result, execution.result.data, execution.options.receiptFormat);
      return execution.result.exitCode ?? 0;
    }
    if (!execution.options.output || execution.options.output === '-') {
      runtime.stdout.write(output);
      return execution.result.exitCode ?? 0;
    }
    const path = validateArtifactDestination(runtime, execution.options.output, execution.options.overwrite === true, execution.options.allowTerminalBinary === true);
    const descriptor = await saveBytes(runtime, output, path, execution.result.source.service, mediaType(execution.options.format), execution.options.overwrite === true);
    if (execution.options.receiptFormat !== 'none') writeReceipt(runtime, execution.result, descriptor, execution.options.receiptFormat);
    return execution.result.exitCode ?? 0;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'EPIPE') return 0;
    const cliError = error instanceof CliError ? error : runtime.signal.aborted && runtime.signal.reason instanceof CliError ? runtime.signal.reason : normalizeError(error);
    writeError(runtime.stderr, cliError.details, detected.errorFormat, detected.machine, detected.verbose ? redact((error as Error)?.stack ?? error) : undefined);
    return cliError.details.exitCode;
  }
}

export function waitForDrain(stream: Writable, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      stream.removeListener('drain', onDrain);
      stream.removeListener('error', onError);
      signal.removeEventListener('abort', onAbort);
    };
    const onDrain = () => { cleanup(); resolve(); };
    const onError = (error: Error) => { cleanup(); reject(error); };
    const onAbort = () => { cleanup(); reject(signal.reason); };
    stream.once('drain', onDrain);
    stream.once('error', onError);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function normalizeError(error: unknown): CliError {
  if (error instanceof CliError) return error;
  if (error instanceof CommanderError || error instanceof InvalidArgumentError) return commanderUsageError(error);
  return new CliError({
    code: 'INTERNAL_ERROR',
    message: 'Unexpected internal failure',
    exitCode: EXIT.internal,
    retryable: false,
    hint: 'Retry with --verbose for a redacted diagnostic, then report the failure',
  }, { cause: error });
}

function detectPresentation(argv: string[], runtime: Runtime): { machine: boolean; errorFormat: ErrorFormat; verbose: boolean } {
  const format = optionValue(argv, '--format') as OutputFormat | undefined;
  const explicitError = optionValue(argv, '--error-format') as ErrorFormat | undefined;
  const machine = argv.includes('--json') || ['json', 'ndjson', 'csv', 'raw'].includes(format ?? '') || (!runtime.stdout.isTTY && format !== 'table');
  return { machine, errorFormat: explicitError ?? (argv.includes('--json') ? 'json' : 'auto'), verbose: argv.includes('--verbose') };
}

function writeReceipt(runtime: Runtime, result: CommandResult, descriptor: unknown, requested: 'auto' | 'json' | 'text' | 'none'): void {
  const format = requested === 'auto' ? (runtime.stdout.isTTY ? 'text' : 'json') : requested;
  if (format === 'text') {
    const item = descriptor as { path?: string; size_bytes?: number; sha256?: string };
    runtime.stdout.write(`Saved ${item.path ?? 'artifact'} (${item.size_bytes ?? 0} bytes, sha256 ${item.sha256 ?? 'unknown'})\n`);
    return;
  }
  const receiptBase = { ...result };
  delete receiptBase.raw;
  delete receiptBase.outputHandled;
  delete receiptBase.nativeStream;
  runtime.stdout.write(renderResult({ ...receiptBase, data: descriptor }, { format: 'json', fields: [], stdoutIsTTY: false }));
}

function mediaType(format: OutputFormat): string {
  if (format === 'csv') return 'text/csv';
  if (format === 'raw') return 'application/octet-stream';
  if (format === 'ndjson') return 'application/x-ndjson';
  if (format === 'table') return 'text/plain';
  return 'application/json';
}

function optionValue(argv: string[], name: string): string | undefined {
  const exact = argv.indexOf(name);
  if (exact >= 0) return argv[exact + 1];
  const prefix = `${name}=`;
  return argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}
