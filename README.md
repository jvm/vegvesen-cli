# vegvesen-cli

Anonymous Node.js CLI for public Statens vegvesen services. Designed for deterministic use by people, scripts, CI, and coding agents.

Supports Dataportalen; NVDB catalog, areas, road data, exports, reports, status, and streams; all Routing V3 profiles; Trafikkdata; Parking Register; TN-ITS; legacy and modern OGC; the reviewed anonymous Fiksvegdata subset; and constrained generated operation access. Stedfesting and OGC Tiles/DGGS remain health-gated. Status WebSocket remains excluded until its public event contract is verifiable.

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
vegvesen nvdb object list 105 --municipality 0301 --limit 20 --format json

vegvesen route calculate \
  --profile best \
  --stop 10.7522,59.9139 \
  --stop 10.7550,59.9150 \
  --input-srs EPSG:4326 \
  --output-srs EPSG:4326 \
  --return-field Geometry \
  --format json

vegvesen traffic aadt get \
  --station 97411V72313 \
  --year 2025 \
  --format json

vegvesen parking provider active --format json
vegvesen tnits snapshot list SpeedLimit --limit 5 --format json
vegvesen ogc wms capabilities --family nvdb_2_0 --format json
vegvesen ogc feature collection list --limit 5 --format json
vegvesen api operation list nvdb-core --format json

vegvesen nvdb export object 103 \
  --artifact-format csv \
  --municipality 5001 \
  --output objects.csv \
  --receipt-format json \
  --no-input

vegvesen parking sign-plan get 45538 \
  --output sign-plan.pdf \
  --receipt-format json \
  --no-input
```

Normal list queries default to `--limit 100`. Use `--all --format ndjson` for explicit complete traversal. `--cursor` and `--page-size` are accepted only by adapters with upstream paging; full-response endpoints provide local `--limit` plus an exact `--all` retrieval path. Machine formats never prompt. stdout contains result data only; diagnostics and machine errors use stderr.

Native artifacts require `--output PATH|-`, refuse existing paths unless `--overwrite` is explicit, stream through a same-directory temporary file, and return size plus SHA-256 receipt. Fiks mutations require either `--dry-run` or explicit `--yes`; they are never automatically retried.

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
npm run check:graphql
npm run check:examples
npm run test:package
```

See [`COMMANDS.md`](COMMANDS.md) for the generated command reference and [`docs/design/cli-contract.md`](docs/design/cli-contract.md) for structured output, errors, pagination, artifact, access, and compatibility contracts.

## License

[MIT](LICENSE)
