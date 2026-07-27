# Vegvesen CLI implementation plan

_Status: implementation in progress_  
_Research baseline: 26–27 July 2026_  
_Implementation status last verified: 27 July 2026 at commit `9622490`_  
_Target: a production-quality Node.js CLI exposing the full anonymously accessible public API surface operated by Statens vegvesen._

## 0. Implementation status ledger

This ledger records demonstrated repository state. It does not mark work complete merely because a command exists.

Status meanings:

- **COMPLETE** — implemented and the stated acceptance evidence exists.
- **PARTIAL** — useful implementation exists, but one or more acceptance requirements remain.
- **BLOCKED** — implementation is intentionally gated by current upstream evidence.
- **EXCLUDED** — reviewed as outside anonymous-only v1.
- **NOT STARTED** — no meaningful implementation exists.

### 0.1 Current verified baseline

| Measure | Current evidence |
|---|---|
| CLI commands | 131 entries generated from `src/registry.ts` into `COMMANDS.md` |
| Product coverage | 16 units and 126 operation records checked by `scripts/check-coverage.mjs` |
| Offline tests | 28 passing Node tests, including real executable process tests |
| Executed documentation | 19 README examples run against fixture services |
| GraphQL | 8 persisted Trafikkdata queries validated against checked-in introspection |
| Package | Packed, installed, and executed outside the checkout on Node 20/22/24 probes; research introspection excluded from tarball |
| Live evidence | `docs/attestations/2026-07-27-phases-3-4.md` and `docs/attestations/2026-07-27-phases-5-7.md` |
| Security | ESLint security rules, Semgrep, CodeQL workflow, Betterleaks, actionlint, zizmor, OpenSSF Scorecard, production audit, input/body limits, XML hardening, seeded redaction tests |
| Repository policy | Private vulnerability reporting and Dependabot security updates enabled; strict protected `main` checks enabled |
| Release | OIDC/provenance workflow implemented, but npm trusted publishing is not configured and the package is not published |

### 0.2 Phase summary

| Phase | State | Implemented | Remaining before phase acceptance is complete |
|---|---|---|---|
| 0 — scope/specification | **PARTIAL** | Scope/CLI ADRs, anonymous boundary, manifest, source hashes, overlay schema, health gates, coverage files | Derive exhaustive operation units from every upstream contract; add missing generation-quality source metadata/overlays; resolve stale operation exclusions |
| 1 — foundation | **PARTIAL** | TypeScript/Commander executable, nested help, schemas, config, doctor, output/errors, prompt policy, package probe | Full PTY and mixed-stream matrix; explicit SIGINT/SIGTERM process tests |
| 2 — transport/simple reads | **COMPLETE** | HTTP policy, retries/timeouts, redirect/origin controls, config, artifact writer, Catalog, Parking, NVDB catalog/areas/status REST | Continue regression coverage as adapters evolve |
| 3 — NVDB core | **PARTIAL** | Objects, versions, changes, statistics, links, segments, nodes, positions, routes, monitor, cursors, streams | `/uberiket`; exhaustive operation derivation; explicit fresh-read agreement tests; remove stale grouped-statistics exclusions |
| 4 — Routing/Trafikkdata | **PARTIAL** | All 9 profiles, matrix, 2 road-feature reads, validated persisted GraphQL queries, partial-result behavior | Dedicated matrix/road-feature process fixtures; exact raw GeoJSON fixture; re-attest anonymous policy immediately before release |
| 5 — OGC/TN-ITS/export | **PARTIAL** | Legacy and modern OGC commands, axis handling, next-link traversal, TN-ITS, NVDB CSV/SOSI exports, native streaming | Live independent WFS semantic check; repeated-next-link fixture; interrupted large-stream cleanup test; Tiles/DGGS remain blocked |
| 6 — lifecycle/mutations | **PARTIAL** | Report generation/job/wait/download, bounded live report lifecycle, Fiks anonymous reads/create/attachments with dry-run/confirmation | Status WebSocket contract; Stedfesting health gate; complete report-family classification; job/watch signal tests |
| 7 — generated/release | **PARTIAL** | Constrained generated registry, generated docs, completion, Node matrix, security/release workflows, package minimization | Expand generated registry beyond 3 advanced operations; fixture every mapping; clean-context agent evaluations; configure npm trusted publishing; observe first remote CI/security run |

### 0.3 Definition-of-done checklist

This maps directly to Section 2.

1. **PARTIAL** — every currently declared unit has a disposition, but units are not yet exhaustively generated from all upstream operations and several exclusions are stale.
2. **COMPLETE** — service metadata distinguishes stable, caution, dynamic, excluded, experimental, and blocked surfaces.
3. **COMPLETE for supported commands** — structured output and stdout/stderr separation are implemented and process-tested.
4. **COMPLETE** — explicit machine modes and detached stdin do not prompt or hang.
5. **PARTIAL** — bounded defaults and explicit `--all` exist; OGC multi-page/loop fixtures and broader per-command paging proofs remain.
6. **COMPLETE for implemented artifacts** — streamed atomic writes, overwrite protection, binary-TTY guard, size, and SHA-256 receipts exist.
7. **PARTIAL** — mutation, report job, retry, anonymous-access, and partial-result contracts exist; Status WebSocket and full signal lifecycle remain.
8. **PARTIAL** — source drift, GraphQL validation, docs generation, and coverage checks exist; full client/operation regeneration and overlay target validation do not.
9. **PARTIAL** — representative offline process and live product tests exist, but not one fixture for every one of the 131 mappings.
10. **PARTIAL** — local installed-package and Node 20/22/24 probes pass; the new remote matrix has not run and npm publication is not configured.

### 0.4 Acceptance checklist by phase

#### Phase 0

- **COMPLETE** — every product named in Section 4 appears in `specs/manifest.json` and `coverage.json`.
- **COMPLETE** — public status is owner-reviewed rather than inferred solely from missing OpenAPI security.
- **COMPLETE** — credentials/login are absent and known authenticated/admin operations are excluded.
- **PARTIAL** — deterministic digest checking covers captured sources, but not every source/product listed in Phase 0.

#### Phase 1

- **COMPLETE** — help/version and strict invalid-usage process behavior pass.
- **COMPLETE** — detached stdin cannot hang and machine stdout/stderr parse cleanly.
- **PARTIAL** — prompt policy is implemented, but machine mode under real full/mixed PTYs lacks automated coverage.
- **COMPLETE** — npm tarball installs and executes outside the checkout.

#### Phase 2

- **COMPLETE** — fixtures cover methods, encoding, mandatory headers, retry, timeout, cross-origin redirect refusal, and absent authorization/cookies.
- **COMPLETE** — CKAN empty/search/paging behavior is bounded and explicit.
- **COMPLETE** — Parking uses the Atlas origin and shared native artifact writer.
- **COMPLETE** — NVDB requests centrally send `X-Client`.
- **COMPLETE** — credential-like config/header input is rejected and seeded redaction tests prevent sensitive-value leakage.

#### Phase 3

- **PARTIAL** — curated V4 operations are mapped; `/uberiket` and exact long-tail coverage remain excluded/deferred.
- **PARTIAL** — opaque cursor/all-page fixtures prove ordered traversal without duplicates; explicit repeated-cursor and server-capped-page negative fixtures remain.
- **PARTIAL** — large NVDB route bodies select reviewed read-only POST semantics in code, but the POST mapping lacks a dedicated process fixture.
- **PARTIAL** — NDJSON is tagged and backpressure-aware; a dedicated mid-stream failure process fixture remains.
- **PARTIAL** — no explicit fresh-read agreement fixture exists for every applicable operation result.

#### Phase 4

- **COMPLETE** — every route profile has an offline process fixture and anonymous live smoke evidence.
- **COMPLETE** — 401/403/429 are actionable and no fixed quota is claimed.
- **PARTIAL** — matrix and road-feature POSTs are classified read-only and safely retryable in code, but lack dedicated process/retry fixtures.
- **COMPLETE** — all persisted queries validate against the pinned schema.
- **COMPLETE** — HTTP 200 GraphQL request/partial errors follow exit `7`/`9` contracts and `--allow-partial` behavior.

#### Phase 5

- **PARTIAL** — live WMS PNG passed an independent file check; WFS semantic validation is fixture-only.
- **PARTIAL** — next-link traversal and loop detection exist, but no multi-page repeated-link fixture proves gaps/duplicates behavior.
- **COMPLETE** — collection/style counts remain runtime discovery data rather than fixed enums.
- **PARTIAL** — WMS 1.3 EPSG:4326 axis logic exists; explicit resolved-axis diagnostics/tests remain limited.
- **PARTIAL** — TN-ITS ordering logic and the 180-day retention caveat are represented; a multi-update oldest-to-newest fixture remains.
- **PARTIAL** — native backpressure, checksums, atomic writes, and cleanup exist; interrupted large-file process coverage remains.

#### Phase 6

- **PARTIAL** — one bounded real report completed through start/poll/download; not every public report family is classified and tested.
- **PARTIAL** — report IDs are resumable and starts are not retried; explicit SIGINT/SIGTERM wait tests remain.
- **NOT STARTED** — Status WebSocket reconnect, malformed-frame, event-tag, and signal tests await a verifiable public contract.
- **BLOCKED** — Stedfesting remains gated by the obsolete upstream dependency path.
- **COMPLETE** — Fiks dry-run and missing confirmation make zero network calls.
- **COMPLETE** — Fiks mutations are not retried and ambiguous timeout behavior is tested.
- **COMPLETE** — automated live CI executes no production Fiks mutation.

#### Phase 7

- **PARTIAL** — `api operation list/describe/call` exists for a constrained reviewed registry, currently only 3 advanced operations.
- **PARTIAL** — process fixtures cover representative generated operations, not every upstream operation mapping.
- **COMPLETE** — command reference and README examples are registry/generated or executed against fixtures.
- **COMPLETE** — shell completion exists after the grammar freeze point.
- **PARTIAL** — audits, Node matrix, package provenance workflow, branch protection, and release gates are implemented but have not run remotely.
- **PARTIAL** — hosts/specs were re-attested during implementation; final immediate pre-release re-attestation remains.
- **PARTIAL** — coverage has no undeclared record within its current manual inventory, but exhaustive upstream-derived coverage is not proven.
- **COMPLETE** — no reviewed access-required/admin/paid operation appears in public help or generated registry.
- **PARTIAL** — supported products have broad live attestations; Fiks deliberately has no live mutation and some dynamic families have representative rather than exhaustive smoke evidence.
- **COMPLETE** — installed CLI works outside the source tree with shipped runtime assets/docs.
- **NOT STARTED** — clean-context agent evaluations have not been run.
- **COMPLETE locally** — package excludes research introspection and test endpoint overrides; first registry publication remains pending.

### 0.5 Known stale records and immediate follow-up

Before declaring 1.0 complete:

- Update the OGC coverage reason that still says runtime discovery is “planned for Phase 5”; it is implemented.
- Remove or reclassify grouped NVDB statistics exclusions now covered by `specs/public-operations.json`.
- Decide and implement/exclude the exact NVDB catalog property relationship, additional Status reads/statistics, and `/uberiket` operations.
- Derive coverage from pinned contracts instead of treating the manually curated operation file as exhaustive evidence.
- Run the first protected GitHub PR and verify all required check context names.
- Configure npm trusted publishing before creating the first release tag.

## 1. Decision record

The approved first-version scope is **anonymous-only public access**:

- Include only operations that can be exercised without an account, API key, Basic credentials, bearer authorization, or organization-specific approval.
- Do not implement credential ingestion, login, token refresh, protected-data access, or authenticated live tests in the first version.
- If an endpoint currently believed anonymous returns an access requirement, mark that operation unavailable and update the coverage manifest; do not add credential support implicitly.
- Exclude registration-required, restricted, paid, provider-only, partner, and administrative workflows from the generated registry and curated command tree.
- Keep unhealthy OGC Tiles/DGGS and degraded NVDB Stedfesting behind explicit health gates. Do not claim support until representative anonymous requests pass.

This boundary is based on verified anonymous production behavior and documented public intent—not merely an absent OpenAPI security declaration.

## 2. Goal and definition of done

Build one `vegvesen` executable that works predictably for humans, scripts, CI, and coding agents across REST, GraphQL, OGC, XML, file-download, job, and stream APIs.

The implementation is complete when:

1. Every in-scope product and protocol-specific coverage unit defined in Section 8.3 has exactly one coverage disposition:
   - stable curated command;
   - generated advanced operation command;
   - dynamic protocol command, such as an OGC collection discovered at runtime; or
   - reviewed exclusion with reason and promotion gate.
2. Anonymous, degraded, experimental, and excluded surfaces are clearly distinguished in help and machine-readable service metadata.
3. Every data command offers deterministic structured output; stdout never contains prompts, progress, warnings, or errors.
4. Missing input never causes a non-interactive process to prompt or hang.
5. Pagination is bounded by default and explicit when unbounded traversal is requested.
6. Files are streamed safely, checksum-reported, and never emitted as binary to an interactive terminal by accident.
7. Mutations, jobs, streams, retries, anonymous-access failures, and partial results have explicit contracts.
8. Checked-in specifications, overlays, generated code, help, schemas, and operation coverage cannot drift silently.
9. Offline process tests cover every command mapping; current live smoke tests attest each supported upstream product.
10. `npm pack` installs and runs from outside the source tree on Node.js 20 and supported newer releases.

## 3. Current repository state

The repository is a minimal ESM scaffold:

- `bin/vegvesen.js` manually handles help, version, and one unknown-argument branch.
- `package.json` requires Node.js 20+, but publishes only `bin`; any new runtime under `src` would currently be missing from the npm package.
- `test/cli.test.js` has three useful subprocess tests for help, version, and unknown input.
- `docs/research/public-apis.md` provides the initial API inventory and current endpoint cautions.
- There is no command framework, HTTP layer, config model, structured output, generated client, or release pipeline yet.

Preserve the executable name, `-h`/`--help`, `-v`/`--version`, ESM, Node.js 20 minimum, and process-boundary test style. Other scaffold behavior may change before 1.0; notably, invalid usage should move from exit `1` to exit `2`.

## 4. Scope and coverage matrix

### 4.1 In-scope products

| Product | Access | Protocol | Required coverage | Main gate or caveat |
|---|---|---|---|---|
| Dataportalen | Anonymous | CKAN Action JSON | Package/dataset/data-service discovery; package/resource reads; tags, groups, organizations, status | Resource URLs are metadata and may be stale; unknown maximum page size/rate |
| NVDB API Les V4 | Anonymous responses only | REST JSON | Datakatalog, areas, road objects, versions, changes, statistics, road network, nodes, positions, routes, monitor | Send mandatory `X-Client`; exclude any authorization-only operation/data; never fall back to V3; preserve opaque cursors |
| NVDB TN-ITS Export | Anonymous | REST plus GML files | Four data families, snapshot discovery/download, ordered daily updates | 180-day update retention; exclude admin paths found in combined specs |
| Trafikkdata | Anonymous | GraphQL POST | Stations, volumes, AADT, indices, road categories, areas, quality/coverage | Capture full introspection; HTTP 200 may contain GraphQL errors |
| Route Planning V3 `/open/` | Currently anonymous | REST, GeoJSON, JSON | Matrix, two road-feature operations, all nine route profiles | Anonymous access conflicts with stale credential/2,500-day metadata; handle 401/403/429 without promising quota |
| Parking Register read API | Anonymous | REST JSON plus attachments | Providers, active providers, areas, versions, sign plans, assessments | Use Atlas host from current OpenAPI, never obsolete catalog URL |
| Fiksvegdata public surface | Verified anonymous subset only | REST JSON and multipart | Only anonymously verified issue create/list/get and approved attachment reads/writes | Real mutation; live spec uses `/api/v1/feilmelding` and integer IDs; classify each operation manually |
| Legacy OGC | Anonymous | WMS/WFS XML/KVP | Capabilities, maps, feature info, feature types, feature retrieval for five official families | Capability-driven versions, formats, CRS, and axis order |
| Modern OGC | Anonymous reads | OGC API Features, Maps, Styles | Landing, conformance, API definition, collections/styles, items, maps, metadata | Dynamic collection counts; no style writes; Tiles/DGGS excluded until healthy |
| NVDB Export | Anonymous | REST streamed CSV/SOSI | Road-object and segmented-network exports | Confirm canonical `nvdb-eksport-x` host; validate SOSI bounds |
| NVDB Reports | Anonymous operations only after live verification | REST report requests and files; polling where verified | Public report families, support metadata, and verified download/lifecycle operations | Exclude any access-controlled/admin/stats/purge/update operation; probe each family before choosing synchronous artifact or job UX |
| NVDB Status | Anonymous reads | REST JSON and WebSocket | Current status, dependencies, messages, watch | Exclude admin, feedback, and subscription mutations until separately approved |
| NVDB Stedfesting | Anonymous but degraded | REST JSON and async jobs | Position, route, synchronous attach, async attach/status/result | Block supported release until position, route, sync, and async smoke tests pass |

### 4.2 Explicit first-version exclusions

| Surface | Disposition |
|---|---|
| Any operation requiring registration, credentials, access approval, or organization-specific roles | Excluded from v1; no command, credential code, generated operation, or authenticated live test |
| Provider, partner, administrative, paid, or protected-data workflows | Excluded from v1 even when visible in a public specification |
| OGC Tiles / DGGS | Experimental discovery only; promotion requires successful collection discovery and representative anonymous retrieval |

These exclusions are release boundaries, not pending implementation tasks. Adding authenticated access requires a separately approved future plan.

## 5. Public CLI contract

### 5.1 Grammar

Use predictable noun/verb paths:

```text
vegvesen <namespace> <resource> <verb> [arguments] [options]
vegvesen help [namespace [resource [verb]]]
vegvesen --help
vegvesen --version
```

Rules:

- Use English command names and exact upstream identifiers as values.
- Use singular resource names consistently: `object list`, `provider get`, `dataset search`.
- Never accept command-prefix abbreviations or fuzzy corrections.
- Reject unknown commands, flags, duplicate conflicting options, and trailing arguments before network or file effects.
- Give every option a canonical long name. Short aliases are limited to conventional `-h`, `-v`, and `-o` where unambiguous.
- Common behavior flags are registered at root and leaf levels. Canonical examples place them after the leaf command; equivalent root placement remains accepted and tested.
- `--no-input` suppresses every prompt. Explicit JSON/NDJSON/raw mode also implies no prompts.
- File/body input uses `@PATH` or `-` for stdin. Missing input never implicitly reads stdin.

### 5.2 Common options

```text
--format auto|json|ndjson|table|csv|raw
--json                         Alias for --format json
--schema-version 1
--output PATH|-
--receipt-format auto|json|text|none  Receipt for --output PATH only
--overwrite                     Artifact commands only
--allow-terminal-binary         Explicit binary-to-TTY override
--config-profile NAME
--timeout DURATION
--retries COUNT
--no-input
--quiet
--verbose
--color auto|always|never
--error-format auto|text|json
--page-size COUNT              List commands only
--limit COUNT                  List commands only; default 100 unless --all
--cursor VALUE                 Where supported
--all                          Suppresses default limit; requires ndjson or one-field raw
--field PATH                   Repeatable output projection
```

`--format` controls the result payload written to stdout or `--output`. `--receipt-format` independently controls the artifact descriptor emitted on stdout after a successful `--output PATH`. Service-native formats use distinct names such as `--artifact-format csv|sosi`, `--media-type image/png`, or `--accept application/geo+json`; they must never overload global `--format` semantics.

### 5.3 Foundation and introspection commands

```text
vegvesen version [--json]
vegvesen doctor
vegvesen service list
vegvesen service get SERVICE
vegvesen schema command [COMMAND_PATH...]
vegvesen schema output COMMAND_PATH...
vegvesen config path
vegvesen config show
vegvesen config validate
vegvesen config set KEY VALUE       # allowlisted non-sensitive keys only
vegvesen config unset KEY
```

`version --json` returns CLI version, supported machine-schema versions, Node version, and API manifest digest. `doctor` reports config validity, anonymous endpoint reachability, and health gates without offering login or credential setup.

### 5.4 Curated command tree

```text
vegvesen catalog package search|get
vegvesen catalog resource get
vegvesen catalog group list|get
vegvesen catalog organization list|get
vegvesen catalog tag list|get
vegvesen catalog status get

vegvesen nvdb catalog version
vegvesen nvdb catalog type list|get|history
vegvesen nvdb catalog property get|categories
vegvesen nvdb catalog product-spec get
vegvesen nvdb catalog category list
vegvesen nvdb catalog unit list
vegvesen nvdb area county|municipality|road-authority|national-route|contract|address list
vegvesen nvdb object list|get|versions|changes|statistics
vegvesen nvdb network link list|get|changes
vegvesen nvdb network segment list|get|statistics
vegvesen nvdb network node list|get
vegvesen nvdb network position locate
vegvesen nvdb network road-position locate|batch
vegvesen nvdb network route calculate
vegvesen nvdb monitor change-set get
vegvesen nvdb export object
vegvesen nvdb export network
vegvesen nvdb report family list
vegvesen nvdb report generate
# Add only for report families proven asynchronous in Phase 6:
vegvesen nvdb report job get|wait
vegvesen nvdb report artifact download
vegvesen nvdb status current
vegvesen nvdb status dependency list
vegvesen nvdb status message list|get
vegvesen nvdb status watch
vegvesen nvdb georeference position
vegvesen nvdb georeference route
vegvesen nvdb georeference attach
vegvesen nvdb georeference job get|wait|result

vegvesen tnits type list
vegvesen tnits snapshot list|download
vegvesen tnits update list|download

vegvesen traffic station list|get
vegvesen traffic volume hourly|daily|length-class
vegvesen traffic aadt get
vegvesen traffic index station|area|published
vegvesen traffic quality get
vegvesen traffic coverage get
vegvesen traffic reference road-category|area list

vegvesen route calculate
vegvesen route matrix
vegvesen route road-feature query

vegvesen parking provider list|get|active
vegvesen parking area list|get|version
vegvesen parking sign-plan get
vegvesen parking assessment get

vegvesen fiks issue list|get|create
vegvesen fiks attachment get|add

vegvesen ogc wms capabilities|map|feature-info
vegvesen ogc wfs capabilities|describe|feature
vegvesen ogc feature landing|conformance|api
vegvesen ogc feature collection list|get
vegvesen ogc feature queryable list
vegvesen ogc feature item list|get
vegvesen ogc map landing|conformance|api
vegvesen ogc map collection list|get
vegvesen ogc map style list
vegvesen ogc map render
vegvesen ogc style landing|conformance|api|list|get|metadata
```

Important mappings:

- `route calculate --profile` accepts exactly `best`, `tourist`, `bike`, `normal-transport`, `special-transport`, `timber-transport`, `modular-vehicle`, `bk-12-100`, and `bk-12-65`, mapped to the current V3 paths.
- Route stops use repeated `--stop X,Y`; coordinate system is always explicit or has a documented default.
- Traffic volume queries expose vehicle-length classes, quality, and coverage through explicit commands and fields; table output may summarize them, while JSON preserves the full persisted-query result.
- The five official anonymous OGC family aliases are `vegvar_1_0`, `norstoy_1_0`, `nvdb_2_0`, `rapportweb_1_0`, and `datex_3_1`. The final name is an anonymous OGC layer family, not a credentialed pull service. Literal runtime-discovered families/collections remain valid.
- OGC `list` commands discover resources; `get` commands require exact collection/style/feature IDs. OGC collection IDs are never compiled as an exhaustive enum.
- Fiks commands are anonymous-only in this approved scope. They expose no login, authorization source, or authenticated alternative.
- Report job commands are generated only for families whose Phase 6 probes prove an anonymous asynchronous lifecycle; synchronous families return an artifact directly from `report generate`.

### 5.5 Generated full-coverage path

Curated commands should cover common workflows, but upstream breadth must not require hundreds of hand-written commands. Add a constrained operation registry:

```text
vegvesen api service list
vegvesen api operation list SERVICE [--tag TAG]
vegvesen api operation describe SERVICE OPERATION_ID
vegvesen api operation call SERVICE OPERATION_ID \
  [--param NAME=VALUE ...] [--body @PATH|-]
```

Requirements:

- Only operations reviewed and live-verified as `public-anonymous` are emitted.
- The registry is not an arbitrary URL proxy. Host, method, path, parameter locations/types, media types, anonymous-access policy, retry class, and effect class come from pinned metadata plus reviewed overlays.
- Mutating operations retain the same dry-run, confirmation, and retry rules as curated commands.
- GraphQL uses checked-in persisted queries. Arbitrary Trafikkdata documents are deferred until query-cost and support policy are understood.
- Dynamic OGC resources use generic OGC commands, not generated per-collection commands.
- Operation IDs and upstream-native payloads are spec-versioned; the generic command grammar and CLI-owned envelope remain stable.

### 5.6 Example invocations

```sh
# Bounded machine-readable catalog search
vegvesen catalog package search \
  --query "trafikk" \
  --type dataservice \
  --limit 25 \
  --format json \
  --no-input

# NVDB road objects with deterministic paging
vegvesen nvdb object list 105 \
  --municipality 0301 \
  --page-size 50 \
  --limit 100 \
  --format json

# Explicit all-pages stream
vegvesen nvdb object list 105 \
  --all \
  --format ndjson \
  > objects.ndjson

# Route GeoJSON saved without presentation transformation
vegvesen route calculate \
  --profile best \
  --stop 10.7522,59.9139 \
  --stop 10.3951,63.4305 \
  --output route.geojson \
  --format raw \
  --receipt-format json

# Capability-driven map render
vegvesen ogc wms map \
  --family vegvar_1_0 \
  --layer LAYER_NAME \
  --bbox MINX,MINY,MAXX,MAXY \
  --crs EPSG:25833 \
  --width 1200 \
  --height 800 \
  --media-type image/png \
  --output weather.png

# Preview then submit an anonymous issue
vegvesen fiks issue create --body @issue.json --dry-run --format json
vegvesen fiks issue create --body @issue.json --yes --format json
```

## 6. Shared behavior contracts

### 6.1 Command classes

| Class | Commands | Required safeguards |
|---|---|---|
| Bounded query | Catalog, NVDB reads, Traffic, Route, Parking, OGC metadata/features | Default limits, filters, explicit empty success, deterministic order where upstream supports it |
| File-producing query | TN-ITS, NVDB Export, Parking attachments, OGC maps | Streamed writes, content-type checks, checksum, overwrite protection, binary-TTY guard |
| Mutation | Anonymous Fiks issue/attachment creation | Validate before request, meaningful dry-run, human confirmation or machine `--yes`, no automatic retry without idempotency |
| Long-running job | Reports and async Stedfesting where proven | Durable job ID, status, bounded wait, timeout, resumable polling, no implicit remote cancel on SIGINT |
| Stream | NVDB NDJSON, OGC all-pages output, Status WebSocket | Explicit opt-in, tagged NDJSON, reconnect/bounds, signal behavior |
| Setup/config | Non-sensitive config and endpoint readiness | No credential fields or login flow; non-interactive failure; inspectable source precedence |

No destructive remote operation is in the approved public scope. Admin deletes, purges, write APIs, and style mutations must remain absent even if a live specification exposes them.

### 6.2 Output

stdout contains only requested result data or artifact bytes. stderr contains prompts, progress, warnings, deprecations, diagnostics, and errors.

`--format json` emits one UTF-8 JSON document with a trailing newline:

```json
{
  "schema_version": 1,
  "command": "nvdb object list",
  "source": {
    "service": "nvdb-vegobjekter",
    "spec_digest": "sha256:..."
  },
  "data": [],
  "meta": {
    "count": 0,
    "has_more": false,
    "next_cursor": null,
    "partial": false
  }
}
```

Contract boundaries:

- CLI-owned envelope keys, normalized curated fields, error codes, record tags, and types are versioned.
- Raw/generated operation payloads remain upstream-spec-versioned and are identified by `spec_digest`.
- `--format raw` writes the exact successful upstream body after transport decoding rules to the selected payload destination. With `--output PATH`, the body goes to the file and stdout is reserved for the separately encoded receipt.
- `auto` selects table/text on a TTY and JSON off-TTY. TTY state changes presentation only, never target, scope, effects, or pagination.
- `--json` also selects JSON errors unless `--error-format text` is explicit.
- Empty list success uses the same envelope with `data: []` and `count: 0`; it is never blank.
- Table truncation is explicit and reports original size plus the exact `--field`, `--format raw`, or `--output` path for full data.
- `--field` projections use documented field paths. One projected field plus `--format raw` produces a newline-delimited bare-value stream suitable for `xargs`.

NDJSON wire form:

```json
{"type":"item","data":{"id":"..."}}
{"type":"summary","meta":{"count":1,"complete":true,"has_more":false}}
```

On mid-stream failure, emit a final summary with `complete:false` when possible, write the structured error to stderr, and exit `9`. Never append an untagged control object.

GraphQL responses containing both `data` and `errors` set `meta.partial=true` and exit `9` by default. `--allow-partial` may return `0` while preserving errors in the documented result.

### 6.3 Errors and exit status

Machine errors are one JSON document on stderr:

```json
{
  "schema_version": 1,
  "error": {
    "code": "UPSTREAM_RATE_LIMITED",
    "message": "Route service rate limit reached",
    "service": "route",
    "http_status": 429,
    "request_id": "...",
    "retryable": true,
    "retry_after_seconds": 30,
    "hint": "Retry after 30 seconds"
  }
}
```

Stable exit categories:

| Exit | Meaning |
|---:|---|
| 0 | Success, including successful dry-run |
| 1 | Unclassified internal failure |
| 2 | Usage or local validation error |
| 3 | Configuration, permission, or unexpected access-required failure |
| 4 | Resource not found |
| 5 | Conflict, failed precondition, or refused confirmation |
| 6 | Rate limit or retryable upstream unavailability |
| 7 | Invalid/unexpected upstream response or protocol failure |
| 8 | Local network failure or timeout |
| 9 | Partial result |
| 10 | Local artifact/config I/O failure |
| 130 | Interrupted by SIGINT |
| 143 | Terminated by SIGTERM |

Errors must name the invalid field or identifier when safe, list valid values where bounded, provide one repair hint, and mark retryability. Hide stack traces unless `--verbose`; verbose output still passes through redaction.

### 6.4 Validation, retries, and effects

- Validate all flags, bodies, coordinates, CRS values, dates, mutually exclusive choices, and output paths before any network mutation or file replacement.
- Retry only idempotent reads and explicitly classified read-only POST operations.
- Retry 429, 502, 503, 504, and transient connection resets with bounded exponential backoff and jitter; honor `Retry-After`.
- Do not retry Fiks creation or attachment mutation automatically unless the upstream contract later provides a verified idempotency key.
- A timeout after an ambiguous mutation reports `outcome_unknown`, any returned correlation ID, and a recovery command.
- `--yes` acknowledges a mutation confirmation. `--overwrite` overrides only the existing-local-file safety check; it never acknowledges a remote mutation.
- Fiks `--dry-run` performs local and schema validation, resolves the target endpoint, shows a redacted request plan, makes no remote request, and exits `0`.
- Machine mode never prompts. Missing `--yes` fails promptly before opening a request body stream or network connection.

### 6.5 Pagination and scale

All list/search commands expose:

- `--page-size`: upstream request size;
- `--limit`: total CLI output ceiling, implicitly `100` when `--all` is absent;
- `--cursor`: exact resume point where supported;
- `--all`: explicit traversal until exhaustion; it suppresses the implicit default limit and is mutually exclusive with an explicit `--limit`.

Adapter rules:

- NVDB: preserve opaque `start`; tolerate server-capped `antall`.
- CKAN: use `rows` plus numeric `start`, stopping at `result.count`.
- OGC Features: follow advertised `rel=next` links verbatim; use `startIndex` only as provider fallback.
- GraphQL: use cursors only where captured schema declares them.
- Detect repeated cursors/links and fail with a protocol error.
- Preserve filters across every page.
- `--all` requires NDJSON or one-field raw output. Reject `--all --limit N` and unbounded buffered JSON with a correct alternative.
- Never treat the observed 300/360/90 OGC collection/style counts as fixed tests or enums.

### 6.6 Jobs and watches

Normalized job state:

```text
queued | running | succeeded | failed | cancelled | expired
```

- Start returns a durable service/job ID immediately.
- `--no-wait` is always prompt; `--wait --timeout DURATION` is bounded.
- `job get` is one-shot and cheap.
- SIGINT exits `130`; SIGTERM exits `143`. Both stop local wait/watch, clean only CLI-created temporary artifacts, and do not cancel remote work.
- Status watch emits tagged NDJSON events only when explicitly requested.
- WebSocket reconnect uses bounded backoff and surfaces gaps/reconnects as tagged control events, not fabricated status.
- Do not force synchronous NVDB Export into a job abstraction.

### 6.7 Artifacts

Represent saved results with this descriptor inside the normal JSON receipt envelope's `data` field:

```json
{
  "path": "/absolute/path/file.csv",
  "media_type": "text/csv",
  "size_bytes": 1234,
  "sha256": "...",
  "source": "nvdb-export"
}
```

Payload and receipt are separate channels:

| Result class | Destination | Payload behavior | stdout after success |
|---|---|---|---|
| Normalized data | omitted or `--output -` | Selected `--format` is written to stdout | Payload only; no receipt |
| Normalized data | `--output PATH` | Selected `--format` is written atomically to file | Receipt only |
| Native artifact | `--output PATH` | Exact upstream bytes selected by service-specific artifact/media option are written atomically | Receipt only |
| Native artifact | `--output -` | Exact upstream bytes are written to stdout | Bytes only; no receipt |

Receipt rules:

- `--receipt-format auto` is the default for `--output PATH`: concise text on a TTY, normal schema-versioned JSON envelope off-TTY.
- `--receipt-format json|text` is explicit and deterministic; `none` suppresses the receipt. `--quiet` does not suppress it.
- Receipt encoding is independent from payload `--format`. Therefore `--format raw --output PATH --receipt-format json` saves the exact upstream body and emits a JSON descriptor, never the body, on stdout.
- `--receipt-format` is invalid when output is stdout.
- Native artifact commands accept only `--format auto|raw`; `auto` resolves to raw/native. Reject table, JSON, NDJSON, and transformed CSV for native artifacts; choose native CSV through `--artifact-format csv` instead.

Implementation rules:

- Stream to a same-directory temporary file, close/fsync, then atomically rename.
- Refuse overwrite unless `--overwrite` is explicit.
- Remove only CLI-created temporary files after failure/interruption.
- Sanitize `Content-Disposition` filenames against traversal and control characters.
- Preserve native CSV, SOSI, GML, XML, PDF, image, XLSX, DOCX, ZIP, and GeoPackage bytes.
- Compute SHA-256 while streaming.
- Enforce the destination matrix before opening the upstream response or target file.
- Binary native bytes require a non-TTY unless `--allow-terminal-binary` is explicit.
- Inspect error media types; a requested image/file may return JSON or XML service exceptions.
- Resume only when the server proves range support. Do not simulate unsafe resume.

### 6.8 Configuration, anonymous-only access, and privacy

Configuration precedence:

```text
command flag > environment > selected profile > user config > built-in default
```

Use `$XDG_CONFIG_HOME/vegvesen/config.json` on Unix-like systems, with a platform-appropriate fallback. Do not load project-local config implicitly. Schema-version the file, use atomic writes and user-only permissions, allow only non-sensitive keys, and reject unknown or credential-like keys with a migration hint.

First-version access boundary:

- Provide no login command, credential environment variables, secret files, token refresh, custom authorization headers, or authenticated profiles.
- Never send `Authorization`, API-key, cookie, or URL-userinfo credentials. `X-Client` is an NVDB client identifier, not authorization.
- If an upstream operation returns 401/403 or requests registration, return exit `3` with code `ACCESS_NOT_AVAILABLE_IN_V1`, mark its service/operation unhealthy in the next manifest review, and provide no credential workaround.
- Base-URL overrides are unauthenticated test/development endpoints only.

Environment contract:

```text
VEGVESEN_CONFIG
VEGVESEN_PROFILE
VEGVESEN_FORMAT
VEGVESEN_X_CLIENT
VEGVESEN_<SERVICE>_BASE_URL       # unauthenticated test/development override
```

Privacy and endpoint rules:

- Restrict requests to canonical manifest origins or explicit unauthenticated test overrides; never accept URL userinfo or arbitrary header injection.
- Redact cookies, URL userinfo, unexpected authorization headers echoed by an upstream service, and request bodies/identifiers marked sensitive from output, errors, and debug logs.
- Do not cache Fiks issue bodies, attachment contents, or other user-supplied personal data by default.
- Centralize NVDB `X-Client`; default to a stable `vegvesen-cli/<version>` identity and allow a validated organization/client suffix.
- `doctor` reports anonymous reachability and returns `registration_required` without offering credential setup.

## 7. Architecture

### 7.1 Technology choices

Adopt TypeScript with strict `NodeNext` ESM compilation to `dist/`:

- Keep `bin/vegvesen.js` as a tiny shebang launcher importing `dist/main.js`.
- Use native Node.js `fetch`, Web Streams, `AbortSignal`, filesystem, crypto, and `node:test`.
- Use a mature declarative parser rather than expanding a custom parser.
- Generate types and operation metadata, not terminal UX or transport policy.
- Keep domain/service logic independent from rendering and process globals.

Implementation-time dependency pins must be registry-verified and locked. Verified compatible candidates as of the research date include:

- `commander` 14.x for Node.js 20; do not adopt Commander 15 while retaining the current Node floor because v15 requires Node.js 22.12+;
- `zod` 4.x for runtime config/input/normalized-envelope validation;
- `fast-xml-parser` 5.x for bounded WMS/WFS capability and optional XML parsing;
- `ws` 8.x for Status WebSocket support on Node.js 20;
- `openapi-typescript` 7.x and `graphql` 16.x as generation/validation dependencies;
- TypeScript plus the existing Node test runner.

Avoid Axios and a TUI/Ink dependency. XML/GML parsing remains bounded; native large responses stay streaming.

### 7.2 Layering

```text
bin/vegvesen.js
  -> src/main.ts                    process adapter, final output/exit
  -> src/cli.ts                     parser and dispatch
  -> src/registry.ts                declarative command metadata
  -> src/commands/**                stable user operations
  -> src/services/**                product/protocol adapters
  -> src/core/**                    HTTP, retry, paging, jobs, files
  -> src/generated/**               generated types/validators/descriptors
```

Commands return values, `Artifact`, `Job`, or typed errors. They never print. Only the process adapter writes stdout/stderr.

Inject runtime dependencies (`fetch`, clock, sleep, random, environment, filesystem, TTY state, signals, stdout/stderr) so deterministic tests do not patch globals.

### 7.3 Target file tree

```text
bin/
  vegvesen.js
src/
  main.ts
  cli.ts
  registry.ts
  runtime.ts
  contracts/
    artifact.ts
    config.ts
    error.ts
    exit.ts
    job.ts
    output.ts
    pagination.ts
  core/
    artifact-writer.ts
    config-store.ts
    content-type.ts
    http.ts
    pager.ts
    redact.ts
    retry.ts
    wait.ts
  commands/
    api/
    catalog/
    nvdb/
    tnits/
    traffic/
    route/
    parking/
    fiks/
    ogc/
  services/
    rest/
    graphql/
    ogc/
    xml/
    websocket/
    catalog/
    nvdb/
    tnits/
    traffic/
    route/
    parking/
    fiks/
  generated/
specs/
  manifest.json
  upstream/
  overlays/
  graphql/
  ogc/
schemas/
  command.schema.json
  error.schema.json
  output.schema.json
scripts/
  fetch-specs.ts
  generate.ts
  check-spec-drift.ts
  check-coverage.ts
  check-examples.ts
test/
  unit/
  commands/
  process/
  contracts/
  fixtures/
  live/
```

`package.json.files` must include `bin`, `dist`, and runtime schemas/manifests. Add a `prepack` build and test the actual tarball contents.

## 8. Specification and generation supply chain

### 8.1 Manifest

Create one manifest record per product/sub-spec with:

- service ID and title;
- official source URL;
- canonical production origin;
- specification kind/version;
- retrieval timestamp and SHA-256;
- license/provenance and redistribution decision;
- access tier;
- health state;
- anonymous-access evidence and last verification time;
- owner-reviewed overlay path.

Access tiers:

```text
public-anonymous
requires-access
restricted
admin
paid
experimental
upstream-degraded
```

Check specification redistribution rights before committing raw snapshots. If rights are unclear, commit generated metadata/types plus URL/digest and permitted fixtures rather than assuming redistribution permission.

### 8.2 Raw specifications and overlays

- Fetch to a temporary directory, validate, hash, and update snapshots only through an explicit review command.
- Never depend on live network during ordinary build, test, or package.
- Keep raw upstream files immutable.
- Put corrections and policy in overlays: canonical server, operation name, CLI alias, access class, effect class, retry safety, pagination, artifact/job semantics, sensitive fields, and health gate.
- Every overlay must cite evidence and fail generation if its target operation disappears.
- Missing security metadata never automatically means `public-anonymous`.

Special handling:

- Normalize Routing Swagger 2 to generation input while retaining its raw source.
- Capture full Trafikkdata introspection, validate persisted queries, and generate per-query types.
- Parse WMS/WFS capabilities at runtime; keep only official family aliases and representative fixtures.
- Traverse modern OGC links rather than hard-coding collection paths.
- Preserve the TN-ITS type registry and representative GML fixtures without generating a huge object model.

### 8.3 Coverage gate

Coverage is measured with explicit, protocol-specific units so a non-OpenAPI product cannot appear complete vacuously:

- OpenAPI/Swagger: HTTP method + normalized path + operation ID + spec digest.
- CKAN: each approved Action API action name.
- GraphQL: each approved root field and each persisted query/variable contract that exposes it; nested data families such as length classes, quality, and coverage remain named units.
- WMS/WFS: each supported protocol operation per official family; runtime layer/type instances are discovery data, not separate release units.
- Modern OGC: each supported link relation/operation template for Features, Maps, and Styles; runtime collection/style instances are discovery data.
- TN-ITS: each public HTTP operation plus each of the four data-family enum paths exercised through it.
- WebSocket: channel handshake, each documented event/control type, reconnect behavior, and terminal signal behavior.
- Jobs/artifacts: start, status, wait, result/download, expiry/failure, and signal behavior for each service that actually implements them.

`scripts/check-coverage.ts` produces `coverage.json`. Every in-scope coverage unit must map to exactly one:

```text
curated-command
generated-operation
dynamic-protocol
excluded-with-reviewed-reason
blocked-by-health-gate
```

Fail CI when:

- a coverage unit is unclassified;
- a `requires-access`, restricted, or admin operation enters the public registry;
- a curated mapping references a removed operation or schema field;
- generated files differ from a clean regeneration;
- an in-scope coverage unit lacks a process fixture test;
- an exclusion lacks rationale, evidence, owner, and review date.

Scheduled drift CI fetches current specs and reports operation, server, security, schema, enum, and media-type changes. It never silently regenerates or releases them.

## 9. Implementation phases

Each phase should end in a small imperative commit, green tests, and an updated coverage report. Do not batch all phases into one commit.

### Phase 0 — freeze scope and source contracts

**Goal:** establish evidence and operation classification before runtime work.

Work:

- Add `docs/design/scope.md` from Section 4.
- Add `docs/design/cli-contract.md` from Sections 5–6.
- Record ADRs for TypeScript, parser, machine envelope, default TTY presentation, anonymous-only access, and public mutation boundary.
- Create `specs/manifest.json`, overlay schema, protocol-specific coverage-unit schema, fetch/hash/drift scripts, and initial `coverage.json`.
- Capture generation-quality NVDB sub-specs, Routing, Parking, Fiks, TN-ITS public spec, Reports, Status, Stedfesting, and full Trafikkdata introspection.
- Verify canonical hosts and specification redistribution rights.
- Mark Stedfesting, Tiles, and DGGS with explicit health gates; classify every access-required operation as excluded from v1.

Acceptance:

- No in-scope product is missing from manifest.
- No operation is public solely because OpenAPI omitted `security`.
- All known access-required, admin, and restricted operations are excluded, and no v1 command/config/environment key accepts credentials.
- Spec fetch/check runs deterministically and reports digests.

### Phase 1 — executable and dual-mode foundation

**Goal:** replace the scaffold parser without adding network commands.

Work:

- Add TypeScript/build configuration and verified dependency pins.
- Convert `bin/vegvesen.js` into the published launcher.
- Implement `main(argv, runtime)`, command registry, strict parsing, nested help, `version`, `service`, `schema`, `config`, and `doctor` skeletons.
- Implement output selection, JSON/NDJSON serializers, typed errors/exits, TTY/color policy, redaction, and prompt policy.
- Update npm package allowlist, `prepack`, lint/typecheck/test scripts.
- Generate help and command schema from the same registry.

Acceptance:

- Existing help/version tests still pass with intentional snapshots updated.
- Unknown commands/options/trailing args exit `2` before effects.
- Detached stdin cannot hang.
- JSON success/error streams parse and contain no ANSI/prose.
- Machine mode under a PTY never prompts.
- `npm pack` tarball installs and executes outside the checkout.

### Phase 2 — HTTP, config, and simple anonymous reads

**Goal:** prove shared transport against low-risk services.

Work:

- Implement native-fetch HTTP client, canonical-origin allowlisting, unauthenticated test overrides, timeouts, retries, `Retry-After`, request IDs, and content-type handling.
- Implement non-sensitive config precedence and reject credential-like keys, URL userinfo, and arbitrary authorization headers.
- Implement the shared artifact writer, checksum, atomic replacement, `--overwrite`, and binary-TTY controls before any attachment command.
- Implement CKAN Catalog.
- Implement Parking Register reads and attachment downloads.
- Implement NVDB Datakatalog and Områder, centrally enforcing `X-Client`.
- Implement NVDB Status REST reads, without watch or mutations.

Acceptance:

- Local fixture server verifies exact methods, URL/query encoding, headers, retries, timeouts, redirects, canonical origins, and absence of authorization headers.
- CKAN empty/search/page behavior is explicit and bounded.
- Parking uses only current Atlas origin and preserves attachment bytes through the shared atomic writer and descriptor contract.
- Every NVDB request includes valid `X-Client`.
- No request sends authorization headers; sensitive request content is absent from captured output, errors, and debug logs.

### Phase 3 — anonymous NVDB core, cursors, and CLI streams

**Goal:** cover primary road-data operations.

Work:

- Implement Vegobjekter, Vegnett, nodes, positions, routes, changes, versions, and statistics.
- Add opaque cursor paging, total limits, `--all` NDJSON, one-field raw streams, and repeated-cursor protection.
- Add NVDB monitor read command.
- Add explicit V3 host/path rejection; never retry against V3.

Acceptance:

- Every anonymously verified NVDB V4 operation is mapped; every access-required operation is explicitly excluded from v1.
- Cursor fixtures prove no duplicates/gaps and tolerate server-capped page size.
- Large route requests choose POST according to mapped operation semantics.
- NDJSON streams are tagged, bounded-memory, and partial-failure aware.
- A fresh exact read agrees with any reported operation result where applicable.

### Phase 4 — Routing and Trafikkdata

**Goal:** cover GeoJSON route calculations and GraphQL traffic data.

Work:

- Implement all twelve Routing V3 operations, including nine profiles, matrix, and two road-feature queries.
- Validate repeated stops, SRS, profile-specific flags, and return-field enums from pinned spec.
- Preserve route GeoJSON unchanged in raw mode.
- Capture full Trafikkdata schema and write validated persisted queries for stations, hourly/daily volumes, vehicle-length classes, AADT, indices, categories, areas, quality, and coverage.
- Handle GraphQL transport errors, request errors, partial errors, and cursor paging separately.

Acceptance:

- Each route profile has one anonymous live smoke and one offline process fixture.
- 401/403/429 remain actionable; no fixed quota is claimed.
- Matrix and road-feature POSTs are classified read-only and safely retryable only where verified.
- Every persisted query validates against the pinned schema.
- HTTP 200 with GraphQL errors follows partial-result contract.

### Phase 5 — OGC, TN-ITS, and bulk exports

**Goal:** implement dynamic geospatial discovery and large native artifacts.

Work:

- Reuse and extend the Phase 2 artifact writer with OGC/TN-ITS/NVDB media-type negotiation and large-stream fixtures.
- Parse WMS/WFS capabilities for all five official families.
- Implement WMS map/feature info and WFS describe/feature commands.
- Implement OGC API Features, Maps, and Styles reads by following advertised links.
- Add bbox/CRS/axis-order validation and verbose resolved-axis diagnostics.
- Implement TN-ITS type/snapshot/update discovery and GML download/checkpoint flow.
- Implement NVDB object/network CSV/SOSI export.

Acceptance:

- Representative WMS image and WFS feature responses pass independent semantic checks.
- OGC Features next-link paging has no gaps/duplicates and detects loops.
- No fixed collection/style count appears in code or tests.
- WMS 1.3/EPSG:4326 axis order is never silently swapped.
- TN-ITS updates preserve oldest-to-newest order and expose the 180-day retention caveat.
- Large file tests prove backpressure, atomic replacement, checksum, and cleanup.

### Phase 6 — jobs, watches, degraded services, and anonymous mutation

**Goal:** add complex lifecycle behavior only after shared safety foundations exist.

Work:

- Probe each NVDB report family first with bounded, low-cost requests; record MIME, expiry, and whether that family is synchronous or exposes start/poll/download.
- Implement direct artifacts for synchronous families and job/status/wait/download commands only for families proven asynchronous.
- Capture Status WebSocket path/schema and implement explicit `watch` with reconnect events.
- Re-test Stedfesting position, route, sync attach, and async lifecycle. Implement only after health gate passes; otherwise keep service visible as degraded with repair/status information.
- Manually classify Fiks operations from live docs/spec and anonymous contract tests.
- Implement approved anonymous issue reads, dry-run/create, and attachments.

Acceptance:

- One bounded fast report and, where the API proves an async path, one bounded representative async report complete through the real lifecycle. Costly/large reports require separate manual approval.
- Job interruption returns resumable ID and does not cancel remotely.
- WebSocket tests cover reconnect, malformed frames, signals, and event tags.
- Stedfesting support status matches live evidence.
- Fiks dry-run makes zero network calls; detached stdin without `--yes` fails promptly.
- Exact Fiks mutation is not auto-retried and returns issue identity/recovery details.
- No production mutation runs in automated live CI.

### Phase 7 — generated operation access, documentation, and 1.0 hardening

**Goal:** close operation-level coverage gaps and ship a trustworthy public contract.

Work:

- Generate `api operation list/describe/call` from reviewed manifest and overlays.
- Add process fixtures for every operation mapping.
- Generate README command reference and examples from registry; parse or run every example.
- Add shell completion only after grammar freezes.
- Run dependency/license/security audit, supported Node matrix, clean npm install, and package provenance/release workflow.
- Re-attest hosts, anonymous access, rate-limit behavior, service health, and spec digests immediately before release.

Acceptance:

- `coverage.json` has no unapproved gap.
- No `requires-access`, restricted, admin, or paid operation appears in service help, schema, or generated registry.
- Every supported service has a current live smoke attestation.
- Installed CLI works from an unrelated directory with only shipped help/docs.
- Clean-context agent evaluations can discover and complete representative bounded tasks without source access.
- npm package contains all runtime assets and no research captures or test-only endpoint overrides.

## 10. Testing strategy

### 10.1 Test layers

1. **Unit tests:** parsers, validators, serializers, errors, redaction, config precedence, retry decisions, pagination, content types, CRS/axis handling.
2. **Command tests:** invoke `main` with injected runtime and fixture adapters.
3. **Process tests:** spawn the real shebang executable with detached stdin and separately captured stdout/stderr.
4. **Contract fixtures:** pinned representative upstream successes/errors for each operation and media family.
5. **Local integration tests:** real HTTP/WebSocket fixture server for transport, streaming, redirects, timeouts, retries, and signals.
6. **Package tests:** pack, install, and run outside source tree.
7. **Anonymous live smoke tests:** scheduled/manual, minimal, non-destructive, and never required for ordinary offline development.
8. **Clean-context agent evaluations:** use only installed help and distributed docs; record success, retries, turns, output volume, latency, and unsafe attempts.

### 10.2 Required process matrix

Test relevant commands across:

- TTY, non-TTY, detached stdin, TTY stdin with captured stdout, and piped stdin with TTY stdout;
- human default, JSON, NDJSON, raw, and native artifact modes;
- success, empty success, usage error, unexpected 401/403 access requirement, not found, rate limit, timeout, malformed upstream, and partial result;
- first mutation, dry-run, confirmation decline, exact retry, and ambiguous timeout;
- empty, one item, page boundary, over-limit, all-pages stream, and repeated cursor;
- immediate job, wait success/failure/expiry, timeout, reconnect, SIGINT, and SIGTERM;
- default config, explicit config profile, env override, custom unauthenticated test origin, rejected credential-like config, and rejected URL userinfo/header injection;
- color, `NO_COLOR=1`, `TERM=dumb`, and narrow terminal.

Use the skill-provided black-box harness for quick probes:

```sh
python3 /Users/jmocito/.pi/agent/skills/cli-for-agents-and-humans/scripts/probe_cli.py --help
```

Run its bundled tests before relying on it, then use it to check exit codes, stream separation, JSON/NDJSON validity, ANSI, detached stdin, and timeouts.

### 10.3 Non-negotiable release assertions

- Every help page is focused and every example parses/runs.
- Unknown input never causes a network call or side effect.
- Machine success stdout and machine error stderr always parse.
- No machine mode prompts, including full/mixed PTY cases.
- Dry-run and rejected input make no changes.
- Success agrees with a fresh read or verified artifact.
- Queries are bounded; explicit all-pages output is tagged and bounded-memory.
- Native files pass semantic validation with independent parsers/consumers where practical.
- Sensitive request bodies/identifiers and unexpected upstream header values never leak.
- Jobs and watches have bounded waits and documented signal behavior.
- Generated tree is clean and every in-scope operation is classified/tested.
- Installed executable works under Node.js 20 outside the repository.

## 11. Compatibility and evolution

- Preserve `vegvesen`, `--help`, `--version`, and Node.js 20 minimum.
- Treat command paths, long flags, exit categories, config precedence, machine schemas, NDJSON tags, pagination semantics, and examples as public API.
- `--version` remains a bare semantic version for shell compatibility; `version --json` is the machine preflight.
- `--schema-version 1` asserts supported machine schema. Unsupported versions fail before network access with an actionable error.
- Before 1.0, document any breaking grammar/schema change prominently; do not silently break already documented curated paths.
- After 1.0, additive commands/options/optional fields are minor. Removals, renames, type changes, exit changes, and default-output changes require a major release.
- Deprecate renamed commands/flags for at least two minor releases and 90 days. Emit replacement/deadline on stderr only.
- Support current and previous machine-schema major where practical.
- Pin each release to a specification manifest digest. Upstream drift does not silently alter a released CLI.
- Raw output follows the upstream contract and is explicitly outside normalized compatibility guarantees.
- Table layout/prose may evolve; scripts must use explicit JSON, NDJSON, CSV, or raw modes.

## 12. Known risks and implementation gates

| Risk | Mitigation / stop rule |
|---|---|
| Stale catalog URLs and metadata | Live official spec plus representative request wins; keep host in reviewed overlay |
| Missing security declaration mistaken for public access | Require product intent, eligibility evidence, manual operation class, and anonymous contract test |
| Routing access/quota contradiction | Use only `/open/`; handle 401/403/429; promise no quota; re-attest before release |
| Stedfesting currently calls obsolete internal path | Keep degraded; block supported release until all representative flows pass |
| OGC collections/formats/CRS drift | Discover capabilities/links at runtime; no exhaustive collection enums |
| Large XML/GML/reports/images | Raw streaming, backpressure, output-file requirement, checksums, bounded optional parsing |
| Fiks anonymous creation duplicates after timeout | No automatic retry; dry-run/confirmation; report unknown outcome and recovery identity |
| GraphQL HTTP 200 partial failure | Inspect `errors`; explicit partial schema and exit `9` |
| Unknown rate/page/file limits | Conservative local ceilings; server-directed retry; never document “unlimited” |
| Generated surface accidentally exposes admin operations | Access overlays plus coverage/public-registry negative tests |
| Sensitive request/header leakage through redirects, debug, or errors | Canonical-origin allowlisting, no authorization-header input, centralized redaction, seeded-sensitive-value tests |
| Spec redistribution uncertainty | Verify license; otherwise retain URL/digest/generated metadata rather than unapproved raw copies |
| Node.js 20 dependency incompatibility | Pin compatible majors; CI minimum-version job; do not upgrade Commander/GraphQL majors blindly |
| npm package omits runtime files | Publish `dist`/schemas/manifest and test installed tarball |

Open upstream questions that do not block foundation work:

- Canonical NVDB Export host and range/resume behavior.
- Complete Status WebSocket path and event schema.
- Per-family Reports sync/async behavior, expiration, limits, and MIME names.
- Trafikkdata maximum windows/pages/query complexity.
- Routing long-term anonymous policy and current quota.
- Numerical rate/size limits across most products.

Any unresolved question that changes access, privacy, effects, or compatibility blocks that product slice—not the shared foundation or already verified services.

## 13. First implementation milestone

Start with Phases 0–2 only. First reviewable release candidate should provide:

- strict nested CLI foundation;
- stable JSON/error/config contracts;
- service/schema/doctor discovery;
- shared HTTP/retry/redaction/artifact primitives;
- Catalog reads;
- Parking reads;
- NVDB Datakatalog/Områder with mandatory `X-Client`;
- NVDB Status REST reads;
- complete offline process tests and npm tarball test for those commands;
- initial operation manifest and coverage report for every later product.

Do not start broad generated commands, Fiks mutation, WebSocket watch, or report jobs before this foundation passes its release gates.

## 14. Research sources

Primary starting point: [`docs/research/public-apis.md`](docs/research/public-apis.md).

Key official contracts to pin during Phase 0:

- [Statens vegvesen Data and APIs hub](https://www.vegvesen.no/fag/teknologi/apne-data/)
- [Dataportalen CKAN API](https://dataut.vegvesen.no/api/3/action/package_search?rows=1000)
- [NVDB API Les V4](https://nvdbapiles.atlas.vegvesen.no/)
- [NVDB OpenAPI examples](https://github.com/nvdb-vegdata/nvdb-openapi-public)
- [TN-ITS Export](https://nvdb-tnits.atlas.vegvesen.no/)
- [Trafikkdata GraphQL](https://trafikkdata-api.atlas.vegvesen.no/)
- [Routing V3 OpenAPI](https://www.vegvesen.no/ws/no/vegvesen/ruteplan/routingservice_v3_0/open/routingService/swagger/v1/swagger.json)
- [Parking Register OpenAPI](https://parkreg-open.atlas.vegvesen.no/ws/docs/openapi)
- [Fiksvegdata OpenAPI](https://fiksvegdata-api.atlas.vegvesen.no/api-docs)
- [OGC layer catalog](https://www.vegvesen.no/fag/teknologi/apne-data/et-utvalg-apne-data/ogc-karttjenester/kartlag/)
- [OGC API Features](https://ogckart-sn1.atlas.vegvesen.no/ogc/features/v1/)
- [OGC API Maps](https://ogckart-sn1.atlas.vegvesen.no/ogc/maps/v1/)
- [OGC API Styles](https://ogckart-sn1.atlas.vegvesen.no/ogc/styles/v1/)
- [NVDB Export](https://nvdb-eksport-x.atlas.vegvesen.no/)
- [NVDB Reports](https://nvdbrapportapi.atlas.vegvesen.no/swagger-ui/)
- [NVDB Status](https://nvdbstatus-api.atlas.vegvesen.no/)
- [NVDB Stedfesting](https://nvdbstedfesting.atlas.vegvesen.no/)
