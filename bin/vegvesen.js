#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

const help = `vegvesen-cli ${version}

A CLI for Norwegian Public Roads Administration services.

Usage:
  vegvesen [options]

Options:
  -h, --help     Show help
  -v, --version  Show version
`;

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
  process.stdout.write(help);
} else if (args.length === 1 && ['-v', '--version'].includes(args[0])) {
  process.stdout.write(`${version}\n`);
} else {
  process.stderr.write(`Unknown argument: ${args[0]}\nRun 'vegvesen --help' for usage.\n`);
  process.exitCode = 1;
}
