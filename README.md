# vegvesen-cli

Anonymous Node.js CLI for public Statens vegvesen services. Designed for deterministic use by people, scripts, CI, and coding agents.

Current milestone supports Dataportalen catalog reads, NVDB Datakatalog and Områder, Parking Register reads/attachments, NVDB Status reads, service discovery, schemas, doctor, and non-sensitive config. Other products remain classified in `coverage.json` but unavailable until later implementation phases pass their health and access gates.

## Requirements

- Node.js 20 or newer

## Install

```sh
npm install --global vegvesen-cli
vegvesen --help
```

## Examples

```sh
vegvesen version --json
vegvesen service list --format json --no-input
vegvesen doctor --live --timeout 5s --json

vegvesen catalog package search \
  --query trafikk \
  --limit 25 \
  --format json \
  --no-input

vegvesen nvdb area county list --limit 20 --format json
vegvesen parking provider active --format json

vegvesen parking sign-plan get 45538 \
  --output sign-plan.pdf \
  --receipt-format json \
  --no-input
```

Normal list queries default to `--limit 100`. Use `--all --format ndjson` for explicit complete traversal. `--cursor` and `--page-size` are accepted only by adapters with upstream paging; full-response endpoints provide local `--limit` plus an exact `--all` retrieval path. Machine formats never prompt. stdout contains result data only; diagnostics and machine errors use stderr.

Native artifacts require `--output PATH|-`, refuse existing paths unless `--overwrite` is explicit, stream through a same-directory temporary file, and return size plus SHA-256 receipt.

## Anonymous-only boundary

Version 1 accepts no credentials and sends no authorization headers or cookies. Unexpected HTTP 401/403 returns `ACCESS_NOT_AVAILABLE_IN_V1`; no login workaround exists. Base URL environment overrides are for unauthenticated development and tests only.

## Configuration

```sh
vegvesen config path --json
vegvesen config show --json
vegvesen config set retries 2 --json
```

Allowed keys: `format`, `timeout`, `retries`, `x_client`. Credential-like and unknown keys are rejected. Precedence: command flags, environment, selected profile, user config, built-in defaults.

## Development

```sh
npm install
npm test
npm run typecheck
npm run check:coverage
npm run check:examples
npm run test:package
```

See [`docs/design/cli-contract.md`](docs/design/cli-contract.md) for structured output, errors, pagination, artifact, access, and compatibility contracts.

## License

[MIT](LICENSE)
