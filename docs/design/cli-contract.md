# CLI contract

## Grammar

```text
vegvesen <namespace> <resource> <verb> [arguments] [options]
vegvesen help [command path...]
vegvesen --help
vegvesen --version
```

Commands use exact matching. Unknown commands, options, duplicate conflicting options, and trailing arguments fail with exit 2 before network or file effects. Machine formats and `--no-input` never prompt. Input reads stdin only when caller passes `-`.

## Output

stdout contains result data only. stderr contains errors, diagnostics, warnings, and prompts. `--format auto` chooses human text on TTY and JSON otherwise; explicit `json`, `ndjson`, `table`, `csv`, and `raw` are deterministic. The v1 renderer is intentionally unstyled in every color mode: `--color`, `NO_COLOR`, and `TERM=dumb` are compatibility controls and cannot introduce ANSI without dedicated PTY coverage.

JSON success:

```json
{"schema_version":1,"command":"catalog status get","source":{"service":"catalog","spec_digest":"sha256:..."},"data":{},"meta":{"count":1,"has_more":false,"next_cursor":null,"partial":false}}
```

NDJSON uses tagged `item` and `summary` records. Empty collection success returns `data: []` and `count: 0`. Schema version 1 covers CLI envelope, normalized fields, errors, and tags. Raw bodies remain upstream-versioned.

Machine errors are one JSON document on stderr. Stable exits: 0 success, 1 internal, 2 usage, 3 configuration/access, 4 not found, 5 conflict/refused confirmation, 6 retryable upstream/rate limit, 7 protocol, 8 network/timeout, 9 partial, 10 local I/O, 130 SIGINT, 143 SIGTERM.

## Queries and artifacts

List commands default to at most 100 results. `--all` requires NDJSON or one-field raw and cannot combine with `--limit`. Native artifacts stream to same-directory temporary files, compute SHA-256, fsync, atomically rename, and refuse overwrite without `--overwrite`. Binary output to TTY requires `--allow-terminal-binary`.

## Transport and access

Requests target canonical manifest origins or explicit unauthenticated development overrides. CLI never sends authorization, API-key, cookie, or URL-userinfo credentials. NVDB requests include validated `X-Client`. Read retries are bounded and honor `Retry-After`; non-idempotent operations do not retry automatically.

Configuration precedence: command flag, environment, selected profile, user config, built-in default. Config accepts non-sensitive allowlisted keys only and loads no project-local file.

## Compatibility

`--version` stays bare semantic version. `version --json` reports CLI, Node, schema support, and manifest digest. Commands, long options, exits, schemas, pagination, config precedence, and examples are public API. After 1.0, breaking changes require major release; deprecated names remain for two minor releases and at least 90 days.
