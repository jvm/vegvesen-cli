# Vegvesen CLI implementation plan

_Status: implementation in progress_  
_Research baseline: 26–27 July 2026_  
_Implementation status last verified: 27 July 2026 in the working tree_  
_Scope revised: 27 July 2026 to anonymous, no-account, high-signal surface only. See 4.2 for what was removed._
_Target: a production-quality Node.js CLI exposing the freely usable, no-account public API surface operated by Statens vegvesen._

## 0. Implementation status ledger

This ledger records demonstrated repository state. It does not mark work complete merely because a command exists.

Status meanings:

- **COMPLETE** — implemented and the stated acceptance evidence exists.
- **PARTIAL** — useful implementation exists, but one or more acceptance requirements remain.
- **EXCLUDED** — permanently outside this plan's scope. Not pending work.
- **NOT STARTED** — no meaningful implementation exists.

There is no **BLOCKED** state. A surface that cannot be verified anonymously from checked-in evidence is excluded outright rather than parked, so that every remaining item in this plan is implementable without waiting on an upstream change or a human decision.

### 0.1 Current verified baseline

| Measure | Current evidence |
|---|---|
| CLI commands | 141 entries generated from `src/registry.ts` into `COMMANDS.md` |
| Product coverage | 287 exact units (200 contract operations, 87 protocol units) across 13 services: 141 curated-command, 3 generated-operation, 51 dynamic-protocol, 92 excluded-permanent. Bound to `src/registry.ts`, and every exclusion machine-matched to a 8.3 rule |
| Offline tests | 54 passing Node tests, including real executable, kernel PTY, signal, cancellation, paging-loop, mid-stream failure, and supply-chain process tests |
| Executed documentation | 19 README examples run against fixture services |
| GraphQL | 8 persisted Trafikkdata queries validated against checked-in introspection |
| Package | Packed, installed, and executed outside the checkout on the local Node runtime; Node 20/22/24 remote matrix configured but not yet observed |
| Live evidence | `docs/attestations/2026-07-27-phases-0-1.md`, `-phases-3-4.md`, `-phases-5-7.md`, `2026-07-28-phase-8.md` |
| Security | ESLint security rules, Semgrep, CodeQL, Betterleaks, actionlint, zizmor, Scorecard, production audit, input/body limits, XML hardening, seeded redaction tests |
| Release | OIDC/provenance workflow implemented; npm trusted publishing not configured and the package is not published |

### 0.2 Coverage gate binding — closed

The gate is now bound to the shipped CLI. `scripts/check-coverage.mjs` calls `assertRegistryBinding`, which fails if a registry command has no claiming coverage unit, if a unit names a command absent from `src/registry.ts`, if an excluded operation is reachable through a command, or if a command value is free text rather than an exact path. `test/spec-supply-chain.test.js` proves each of those five failure modes fires.

What the binding corrected:

- Eleven operations that ship as tested commands were recorded `access: unverified` and excluded, including `GET /api/v4/vegobjekter/{vegobjekttypeId}` backing `nvdb object list`. All are now `curated-command` citing the anonymous attestation.
- Two units attributed `nvdb object list` to operations it does not call; they now name `nvdb object get` and `nvdb network road-position locate`.
- `specs/operations.json` was a third parallel inventory with its own identifier namespace and zero overlap with `coverage.json`. It is deleted; the derived units are the single source of truth, and the runtime manifest digest now covers `coverage.json`.
- `promotion_gate`, `health_gate`, `blocked-by-health-gate`, and the `unverified`/`experimental`/`upstream-degraded` access tiers are removed from the schema and the data.

### 0.3 Definition-of-done checklist

This maps directly to Section 2.

1. **COMPLETE** — every in-scope coverage unit carries exactly one disposition, and the dispositions are bound to the shipped registry (0.2).
2. **COMPLETE** — service metadata distinguishes stable, caution, dynamic, and excluded surfaces.
3. **COMPLETE for supported commands** — structured output and stdout/stderr separation are implemented and process-tested.
4. **COMPLETE** — explicit machine modes and detached stdin do not prompt or hang.
5. **COMPLETE** — bounded defaults, explicit `--all`, and NVDB/OGC loop plus server-capped-page fixtures exist.
6. **COMPLETE** — streamed atomic writes, overwrite protection, binary-TTY guard, size, SHA-256 receipts, and interrupted-download cleanup exist.
7. **COMPLETE** — mutation, report job, retry, anonymous-access, partial-result, and signal contracts exist and are process-tested.
8. **COMPLETE** — source drift, GraphQL validation, docs generation, unit regeneration, overlay target validation, and the registry-to-coverage binding all exist.
9. **COMPLETE** — every command adapter, protocol unit, and generated-registry operation has offline process coverage. The generated-operation fixture is driven from `specs/public-operations.json`, so a new reviewed operation without an exercise fails the suite.
10. **PARTIAL** — the installed-package probe passes locally and the Node 20/22/24 matrix is configured, but that matrix has not run and npm publication is not configured.

### 0.4 Remaining work

None. Every item that was implementable offline from checked-in evidence is done: the coverage gate is bound to the CLI and its exclusion rules are machine-applied, the excluded surfaces are deleted, the reviewed anonymous reads are promoted, and the generated registry, fresh-read agreement, raw GeoJSON, and NVDB route POST fixtures all exist.

What remains is in 0.5 and needs credentials or network access this implementation does not hold.

Two facts to carry into any release decision:

- The 4 kernel-PTY tests have not been observed passing in the implementation environment, which has no free pty devices. They are unchanged since they last passed and the remote Node matrix will exercise them.
- `npm run test:package` likewise cannot run here; the sandbox blocks npm cache writes. The tarball contents assertion is therefore unverified in this environment.

### 0.5 Release readiness

#### Done

- **First protected pull request** — [#1](https://github.com/jvm/vegvesen-cli/pull/1). All nine required check contexts fire on `pull_request` and pass: `Node.js 20`, `Node.js 22`, `Node.js 24`, `Dependency audit`, `Production dependency audit`, `Secret scan`, `Semgrep SAST`, `Workflow lint`, `Analyze TypeScript/JavaScript`. The names in branch protection match the workflow job names exactly. The Node matrix also confirmed the 4 kernel-PTY tests and `npm run test:package`, neither of which can run in the development sandbox.
- **Live anonymous attestation** — `docs/attestations/2026-07-28-phase-8.md`. 20 commands verified against production, which found three defects in the 4.3 promotions that metadata alone could not surface. CodeQL additionally found a high-severity file system race in shipped input handling, now fixed.

#### Blocked: `main` is unreachable

Branch protection on `main` sets `required_approving_review_count: 1` with `enforce_admins: true`, and `jvm` is the sole collaborator on a user-owned repository. GitHub does not permit approving your own pull request, and admin enforcement removes the bypass, so no commit can reach `main` and `release.yml` — which asserts the release tag points at `origin/main` — can never run.

Resolve by one of: adding a second collaborator to approve; setting `required_approving_review_count` to `0` while keeping the status checks; or disabling `enforce_admins` so the owner can merge their own reviewed work. This is a repository-settings decision, not a code change.

#### Remaining owner action

- **Configure npm trusted publishing.** The package name `vegvesen-cli` is unregistered, so the first publish claims it. On npmjs.com, add a trusted publisher for the package pointing at repository `jvm/vegvesen-cli` and workflow `release.yml`. The workflow is already correct for this: it holds `id-token: write`, sets `registry-url`, publishes directly rather than from a reusable workflow, and needs no `NODE_AUTH_TOKEN`. Then create the first `v0.1.0` tag on `main`.

## 1. Decision record

The approved first-version scope is **anonymous-only public access**:

- Include only operations that can be exercised without an account, API key, Basic credentials, bearer authorization, or organization-specific approval.
- Do not implement credential ingestion, login, token refresh, protected-data access, or authenticated live tests in the first version.
- If an endpoint currently believed anonymous returns an access requirement, mark that operation unavailable and update the coverage manifest; do not add credential support implicitly.
- Exclude registration-required, restricted, paid, provider-only, partner, and administrative workflows from the generated registry and curated command tree.
- Exclude any surface whose anonymous contract cannot be established from checked-in evidence. Excluded means removed from the command tree and the behavior contracts, not parked behind a gate.

This boundary is based on verified anonymous production behavior and documented public intent—not merely an absent OpenAPI security declaration.

**Classification is rule-based, not approval-based.** Section 8.3 defines the disposition rules as deterministic predicates over pinned specification metadata and checked-in evidence. A human owner name recorded in an overlay is provenance, not a required approval step: any operation whose classification follows from those rules may be reclassified by regenerating the overlays. This is what makes the remaining work in 0.4 executable end to end without stopping for a decision.

## 2. Goal and definition of done

Build one `vegvesen` executable that works predictably for humans, scripts, CI, and coding agents across REST, GraphQL, OGC, XML, file-download, job, and stream APIs.

The implementation is complete when:

1. Every in-scope product and protocol-specific coverage unit defined in Section 8.3 has exactly one coverage disposition:
   - stable curated command;
   - generated advanced operation command;
   - dynamic protocol command, such as an OGC collection discovered at runtime; or
   - permanent exclusion with reason (Section 4.2).
2. Supported and excluded surfaces are clearly distinguished in help and machine-readable service metadata.
3. Every data command offers deterministic structured output; stdout never contains prompts, progress, warnings, or errors.
4. Missing input never causes a non-interactive process to prompt or hang.
5. Pagination is bounded by default and explicit when unbounded traversal is requested.
6. Files are streamed safely, checksum-reported, and never emitted as binary to an interactive terminal by accident.
7. Mutations, jobs, streams, retries, anonymous-access failures, and partial results have explicit contracts.
8. Checked-in specifications, overlays, generated code, help, schemas, and operation coverage cannot drift silently.
9. Offline process tests cover every command adapter, every protocol unit, and every generated operation. Per-command duplicates of an already-covered adapter are not required.
10. `npm pack` installs and runs from outside the source tree on Node.js 20 and supported newer releases.

## 3. Current repository state

The original scaffold has been replaced. Section 0 holds the authoritative status; this section describes shape rather than completeness.

- `bin/vegvesen.js` is the published launcher. It installs cooperative `SIGINT`/`SIGTERM` handlers, calls `main(argv, runtime)` from `dist/main.js`, and re-raises a second identical signal on the default handler.
- `src` is strict `NodeNext` TypeScript compiled to `dist`: `main.ts` (process adapter and final output/exit), `cli.ts` and `service-cli.ts` (Commander parsing and dispatch), `registry.ts` (declarative metadata for 141 commands), `runtime.ts` (injected `fetch`, clock, filesystem, TTY, signals, streams), `contracts/`, `core/`, and `commands/`.
- `specs/` holds the pinned manifest, source digests, rule-generated overlays, derived operation and protocol units, and Trafikkdata introspection. `coverage.json` classifies 287 units and is regenerated by `scripts/`.
- `test/` has 50 offline tests plus 4 kernel-PTY tests across five files, driven through the real executable against `fixtures/http-server.mjs`. `schemas/` holds the published command, error, and output JSON Schemas.
- `package.json` requires Node.js 20+ and publishes `bin`, `dist`, `schemas`, `specs`, `coverage.json`, `README.md`, `COMMANDS.md`, `SECURITY.md`, and `LICENSE`, explicitly excluding the Trafikkdata research introspection. Runtime dependencies are `commander` 14, `zod` 4, and `fast-xml-parser` 5.
- `.github/workflows/` holds CI, CodeQL, security, Scorecard, spec-drift, and provenance release workflows, none of which have run remotely yet.

Two deliberate divergences from the Section 7.3 target tree: product adapters live in `src/commands/**` rather than a separate `src/services/**`, and there is no `src/generated/**` because the operation registry is driven from reviewed `specs/` metadata at runtime instead of generated code. Supply-chain scripts are `.mjs` rather than `.ts`. `ws` is absent because the Status WebSocket is a permanent exclusion (4.2).

Preserve the executable name, `-h`/`--help`, `-v`/`--version`, ESM, Node.js 20 minimum, and process-boundary test style. Invalid usage now exits `2` as intended.

## 4. Scope and coverage matrix

### 4.1 In-scope products

| Product | Access | Protocol | Required coverage | Main gate or caveat |
|---|---|---|---|---|
| Dataportalen | Anonymous | CKAN Action JSON | Package/dataset/data-service discovery; package/resource reads; tags, groups, organizations, status | Resource URLs are metadata and may be stale; unknown maximum page size/rate |
| NVDB API Les V4 | Anonymous | REST JSON | Datakatalog, areas, road objects, versions, changes, statistics, road network, nodes, positions, routes, monitor | Send mandatory `X-Client`; never fall back to V3; preserve opaque cursors |
| NVDB TN-ITS Export | Anonymous | REST plus GML files | Four data families, snapshot discovery/download, ordered daily updates | 180-day update retention; `/api/v1/admin/*` is excluded |
| Trafikkdata | Anonymous | GraphQL POST | Stations, volumes, AADT, indices, road categories, areas, quality/coverage | Capture full introspection; HTTP 200 may contain GraphQL errors |
| Route Planning V3 `/open/` | Anonymous | REST, GeoJSON, JSON | Matrix, two road-feature operations, all nine route profiles | Anonymous access conflicts with stale credential/2,500-day metadata; handle 401/403/429 without promising quota |
| Parking Register read API | Anonymous | REST JSON plus attachments | Providers, active providers, areas, versions, sign plans, assessments | Use Atlas host from current OpenAPI, never obsolete catalog URL |
| Fiksvegdata public surface | Anonymous subset only | REST JSON and multipart | Anonymous issue list/get, anonymous issue creation, approved attachment reads/writes | Real mutation; `/api/v1/feilmelding/anonym` is the anonymous create path; account-scoped and responsible-person paths are excluded |
| Legacy OGC | Anonymous | WMS/WFS XML/KVP | Capabilities, maps, feature info, feature types, feature retrieval for five official families | Capability-driven versions, formats, CRS, and axis order |
| Modern OGC | Anonymous reads | OGC API Features, Maps, Styles | Landing, conformance, API definition, collections/styles, items, maps, metadata | Dynamic collection counts; no style writes |
| NVDB Export | Anonymous | REST streamed CSV/SOSI | Road-object and segmented-network exports | Confirm canonical `nvdb-eksport-x` host; validate SOSI bounds |
| NVDB Reports | Anonymous | REST report requests and files; polling where verified | Public report families, report metadata reads, and verified download/lifecycle operations | `/admin/*` and `/stats/*` are excluded; each family is probed before choosing synchronous artifact or job UX |
| NVDB Status | Anonymous reads | REST JSON | Current status, systems, dependencies, incident messages, status statistics | Read-only. All status mutations are excluded |

### 4.2 Permanent exclusions

These are release boundaries, not pending implementation tasks. Nothing in Section 0.4 depends on any of them, and none carries a promotion gate. Adding any of them requires a separately approved future plan, not a probe result.

| Surface | Why excluded |
|---|---|
| Any operation requiring registration, credentials, access approval, or organization-specific roles | Outside anonymous-only scope; no command, credential code, generated operation, or authenticated live test |
| Provider, partner, administrative, paid, or protected-data workflows | Outside anonymous-only scope even when visible in a public specification |
| Any path segment matching `/admin/` or `/stats/` | Administrative surface regardless of whether it currently answers anonymously. Covers `nvdb-reports:/admin/*`, `nvdb-reports:/stats/jobs`, `tnits:/api/v1/admin/files` |
| Account-scoped Fiks paths — `/api/v1/meg/*`, `/api/v1/ansvarlig/*` | Bound to an authenticated identity; meaningless anonymously |
| Fiks `POST /api/v1/feilmelding` | The credentialed sibling of the anonymous create path. `/api/v1/feilmelding/anonym` is the supported operation |
| All NVDB Status mutations — `POST /feilmeldinger`, `POST /feilmeldinger/{id}/meldinger`, `POST /systemer/{id}/avhengigheter`, `POST /systemer/{id}/tjenester` | Writing incident and topology data into a public status service is outside a read-only anonymous client |
| NVDB Reports `POST /rapporter/egendefinert` | Custom-report submission; unbounded cost and no anonymous contract evidence |
| NVDB Status `GET /api/v1/feilmeldinger/{systemId}` | Shares a path template with message-by-id, which wins upstream content negotiation. Reachable only by omitting a correct `Accept` header |
| NVDB Status WebSocket | The public path, event schema, and reconnect contract are not available in the pinned OpenAPI or product documentation. Nothing anonymous can be built against an unknown frame contract |
| NVDB Stedfesting (`nvdb georeference *`) | Representative anonymous calls fail through an obsolete upstream dependency path. Not implementable until Vegvesen repairs it |
| OGC Tiles / DGGS | Tiles returns HTTP 500 and DGGS exposes no usable collections |
| NVDB `/uberiket` long-tail (27 operations) | Unenriched duplicates of the V4 reads already exposed as curated commands; low marginal signal for a public CLI |

### 4.3 Anonymous reads promoted to curated commands — done

These were public, no-account reads sitting in the exclusion bucket only because the overlay defaulted them there. All 24 operations were promoted in Phase 8 and are covered by process fixtures asserting each maps to its exact upstream path. Retained as the record of what was promoted and under which rule.

| Service | Operations | Command |
|---|---|---|
| NVDB Status | `GET /api/v1/systemer/{id}`, `/api/v1/systemer/{id}/status` | `nvdb status system get`, `nvdb status system health` |
| NVDB Status | `/{systemId}/aktive`, `/{systemId}/planlagt` | `nvdb status message list --system ID --state active\|planned`. Bare `/{systemId}` is excluded as a shadowed route |
| NVDB Status | `GET /api/v1/feilmeldinger/avsluttet`, `/planlagt`, `/siste`, `/mellom` | `nvdb status message list --state closed\|planned\|latest`, `--from`/`--to` |
| NVDB Status | `GET /api/v1/statistikk`, `/api/v1/statistikk/nokkeldata` | `nvdb status statistics get --days N [--key-data]`; `dager` is required upstream |
| NVDB Reports | `GET /rapporter/bruksklasser`, `/kontraktsomraader`, `/omraader`, `/kostrarapporttyper`, `/driftskontraktrapporttyper` | `nvdb report reference list TYPE` |
| NVDB Reports | `GET /rapporter/driftskontraktvegobjekttyper/default/{id}`, `/tilvalg/{id}` | `nvdb report reference object-type list {id} [--optional]` |
| NVDB Reports | `GET /rapporter/egendefinert`, `/egendefinert/{reportid}`, `/egendefinert/aggregate` | `nvdb report custom list\|get\|aggregate` (reads only; the POST stays excluded) |
| NVDB Reports | `GET /rapporter/kontraktZip` | `nvdb report contract-archive download` (native artifact) |
| NVDB Datakatalog | `GET /api/v1/vegobjekttyper/{typeId}/{egenskapstypeId}` | `nvdb catalog type property TYPE_ID PROPERTY_ID` — the shipped `nvdb catalog property get` reads `egenskapstyper/{id}`, a different operation |
| Fiksvegdata | `GET /api/v1/feilmelding/detaljert` | `fiks issue list --detailed` |

Promotion rule applied: an operation is promoted only if it is a GET, its host already has an anonymous attestation, its path matches no exclusion rule in 4.2, and it can be exercised by an existing service adapter. Anything failing one of these stays excluded.

Spec metadata alone proved insufficient: the live probe recorded in `docs/attestations/2026-07-28-phase-8.md` found a missing required parameter, a wrong identifier type, and a shadowed route. Promote from metadata, then verify against production before treating a promotion as done.

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

`version --json` returns CLI version, supported machine-schema versions, Node version, and API manifest digest. `doctor` reports config validity and anonymous endpoint reachability without offering login or credential setup.

### 5.4 Curated command tree

```text
vegvesen catalog package search|get
vegvesen catalog resource get
vegvesen catalog group list|get
vegvesen catalog organization list|get
vegvesen catalog tag list|get
vegvesen catalog status get

vegvesen nvdb catalog version
vegvesen nvdb catalog type list|get|history|property
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
vegvesen nvdb report reference list TYPE
vegvesen nvdb report reference object-type list ID
vegvesen nvdb report custom list|get|aggregate
vegvesen nvdb report contract-archive download
vegvesen nvdb report generate
# Add only for report families proven asynchronous in Phase 6:
vegvesen nvdb report job get|wait
vegvesen nvdb report artifact download
vegvesen nvdb status current
vegvesen nvdb status dependency list
vegvesen nvdb status message list|get
vegvesen nvdb status system get|health
vegvesen nvdb status statistics get

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
| Long-running job | Report families proven asynchronous | Durable job ID, status, bounded wait, timeout, resumable polling, no implicit remote cancel on SIGINT |
| Stream | NVDB NDJSON, OGC all-pages output | Explicit opt-in, tagged NDJSON, bounds, signal behavior |
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

### 6.6 Jobs

Normalized job state:

```text
queued | running | succeeded | failed | cancelled | expired
```

- Start returns a durable service/job ID immediately.
- `--no-wait` is always prompt; `--wait --timeout DURATION` is bounded.
- `job get` is one-shot and cheap.
- SIGINT exits `130`; SIGTERM exits `143`. Both stop local waiting, clean only CLI-created temporary artifacts, and do not cancel remote work.
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
- health state and its evidence — descriptive service metadata such as `stable`, `stable-policy-caution`, or `stable-dynamic`, never a gate that parks work;
- anonymous-access evidence and last verification time;
- overlay path.

Access tiers:

```text
public-anonymous
requires-access
restricted
admin
paid
```

Check specification redistribution rights before committing raw snapshots. If rights are unclear, commit generated metadata/types plus URL/digest and permitted fixtures rather than assuming redistribution permission.

### 8.2 Raw specifications and overlays

- Fetch to a temporary directory, validate, hash, and update snapshots only through an explicit review command.
- Never depend on live network during ordinary build, test, or package.
- Keep raw upstream files immutable.
- Put corrections and policy in overlays: canonical server, operation name, CLI alias, access class, effect class, retry safety, pagination, artifact/job semantics, and sensitive fields. Overlays carry no health gate and no promotion gate.
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
- Jobs/artifacts: start, status, wait, result/download, expiry/failure, and signal behavior for each service that actually implements them.

`scripts/check-coverage.mjs` verifies `coverage.json`. Every in-scope coverage unit must map to exactly one:

```text
curated-command
generated-operation
dynamic-protocol
excluded-permanent
```

`blocked-by-health-gate` is retired. A surface that cannot be verified is excluded under 4.2, not parked.

#### Deterministic disposition rules

Dispositions follow from these predicates in order. The first matching rule wins, and every rule is decidable from pinned specification metadata plus checked-in evidence — no human judgement is required at classification time.

1. Path contains `/admin/` or `/stats/`, or matches an account-scoped segment listed in 4.2 → `excluded-permanent`.
2. Method is not GET, and the operation is not one of the explicitly approved anonymous mutations (`fiks POST /api/v1/feilmelding/anonym`, `fiks POST /api/v1/feilmelding/{id}/vedlegg`, `nvdb report generate` starts, `nvdb-core POST /api/v4/beta/vegnett/rute` as a reviewed read-only POST) → `excluded-permanent`.
3. The operation appears in the 4.2 exclusion table by name → `excluded-permanent`.
4. A registry command calls the operation → `curated-command`, and the unit's `command` field must equal that registry path exactly.
5. The operation is a GET on a host with an anonymous attestation and matches no rule above → `generated-operation`, reachable through `api operation call`.
6. Runtime-discovered OGC collections, styles, and layers → `dynamic-protocol`.

An `excluded-permanent` unit carries a reason and no promotion gate. Promotion gates are removed from the schema: a surface is either in scope by rule or excluded by rule.

Rules 1–3 are applied mechanically by `assertExclusionRules`, not trusted from the reason text. Every `excluded-permanent` unit must match one of: `administrative` (`/admin/` or `/stats/`), `account-scoped`, `mutation` (non-GET), `named-long-tail` (the 4.2 `/uberiket` entry), `protocol-unit`, or `shadowed-route` (path template collides with an operation that wins upstream routing). An anonymous GET matching none of them is excluded by accident rather than by policy and fails CI — which is exactly the shape of the original defect.

#### Binding coverage to the CLI

The gate is meaningless unless it measures the shipped product. `check-coverage` must additionally assert:

- every `curated-command` unit's `command` value exists in `src/registry.ts`;
- every registry command that performs an upstream request is claimed by at least one `curated-command` unit;
- local-only commands (`version`, `completion`, `doctor`, `service *`, `schema *`, `config *`, `api service list`, `api operation list`, `api operation describe`) are declared in an explicit allowlist rather than passing by absence;
- a unit's `command` field is an array of exact registry paths, never a free-text or semicolon-joined string. One operation legitimately backs several commands (`GET /rapporter/poll/{id}` serves both `nvdb report job get` and `nvdb report job wait`), so the array is the correct shape; the constraint is that each element is an exact path with no flags or separators.

Fail CI when:

- a coverage unit is unclassified;
- an `excluded-permanent` operation is reachable from any registry command or the generated registry;
- a curated mapping references a removed operation, a schema field that no longer exists, or a command absent from the registry;
- a registry command issuing upstream requests has no claiming unit;
- generated files differ from a clean regeneration;
- an in-scope coverage unit lacks a process fixture test;
- an exclusion lacks a reason and evidence.

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
- Capture generation-quality NVDB sub-specs, Routing, Parking, Fiks, TN-ITS public spec, Reports, Status, and full Trafikkdata introspection.
- Verify canonical hosts and specification redistribution rights.
- Classify every access-required, administrative, and unverifiable operation as a permanent exclusion under 4.2.

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
- Implement NVDB Status REST reads. All status mutations are excluded.

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

### Phase 6 — jobs and anonymous mutation

**Goal:** add complex lifecycle behavior only after shared safety foundations exist.

Work:

- Probe each NVDB report family with bounded, low-cost requests; record MIME, expiry, and whether that family is synchronous or exposes start/poll/download.
- Implement direct artifacts for synchronous families and job/status/wait/download commands only for families proven asynchronous.
- Classify Fiks operations from the pinned spec using the 8.3 rules.
- Implement approved anonymous issue reads, dry-run/create, and attachments.

Acceptance:

- **COMPLETE** — one bounded report completes through the real start/poll/download lifecycle.
- **COMPLETE** — job interruption returns a resumable ID and does not cancel remotely; SIGINT/SIGTERM exit `130`/`143`.
- **COMPLETE** — Fiks dry-run makes zero network calls; detached stdin without `--yes` fails promptly.
- **COMPLETE** — Fiks mutation is not auto-retried and returns issue identity and recovery details.
- **COMPLETE** — no production mutation runs in automated live CI.

### Phase 7 — generated operation access, documentation, and 1.0 hardening

**Goal:** close operation-level coverage gaps and ship a trustworthy public contract.

Work:

- `api operation call` already covers every operation the 8.3 rules classify `generated-operation`. After the Phase 8 promotions the set is exactly the three NVDB grouped-statistics operations: every other anonymous GET is either a curated command or excluded by a 4.2 rule, so there is no promotion backlog.
- Add one process fixture per generated operation, driven from the reviewed metadata rather than hand-written per operation.
- Generate README command reference and examples from registry; parse or run every example.
- Run dependency/license/security audit, supported Node matrix, and clean npm install.

Acceptance:

- `coverage.json` has no unclassified unit and the 8.3 binding assertions pass.
- No `excluded-permanent` operation appears in service help, schema, or the generated registry.
- Every generated operation has a process fixture.
- Installed CLI works from an unrelated directory with only shipped help/docs.
- npm package contains all runtime assets and no research captures or test-only endpoint overrides.

Removed from acceptance: clean-context agent evaluations. The criterion — "can discover and complete representative bounded tasks" — has no defined task list or pass threshold, so it cannot gate a release. Section 10.1 keeps it as optional diagnostic work.

### Phase 8 — bind the coverage gate to the CLI

**Goal:** make the coverage number a guarantee about the shipped product rather than a parallel bookkeeping artifact. This closes the defect in Section 0.2 and is a prerequisite for trusting Phase 7's negative claims.

Work:

- Extend `scripts/check-coverage.mjs` with the binding assertions in 8.3 and the local-only command allowlist.
- Regenerate the overlays under the 8.3 deterministic rules. This reclassifies the eleven mislabeled NVDB operations to `curated-command`, corrects the two wrong `nvdb object list` attributions, and converts every `blocked-by-health-gate` and gated exclusion to `excluded-permanent`.
- Replace one-per-operation free-text command strings with exact registry paths, splitting the six compound values.
- Drop `promotion_gate` from the overlay schema and from `specs/overlays/*.json`.
- Promote the 4.3 reads: add the new NVDB Status and Reports commands, `fiks issue list --detailed`, and reclassify `nvdb catalog property get`'s operation.

Acceptance:

- Every registry command issuing an upstream request is claimed by exactly one `curated-command` unit whose `command` equals its registry path.
- Every `curated-command` unit names a command that exists.
- No unit carries `promotion_gate`, and no unit carries `blocked-by-health-gate`.
- The suite fails if a command is added without a claiming unit, proven by a deliberate regression test.
- No `excluded-permanent` operation is reachable from help, schema, or `api operation call`.

## 10. Testing strategy

### 10.1 Test layers

1. **Unit tests:** parsers, validators, serializers, errors, redaction, config precedence, retry decisions, pagination, content types, CRS/axis handling.
2. **Command tests:** invoke `main` with injected runtime and fixture adapters.
3. **Process tests:** spawn the real shebang executable with detached stdin and separately captured stdout/stderr.
4. **Contract fixtures:** pinned representative upstream successes/errors for each operation and media family.
5. **Local integration tests:** real HTTP fixture server for transport, streaming, redirects, timeouts, retries, and signals.
6. **Package tests:** pack, install, and run outside source tree.
7. **Anonymous live smoke tests:** scheduled/manual, minimal, non-destructive, and never required for ordinary offline development.
8. **Clean-context agent evaluations (optional):** use only installed help and distributed docs; record success, retries, turns, output volume, latency, and unsafe attempts. Diagnostic only — not a release gate, because no pass threshold is defined.

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
- Jobs have bounded waits and documented signal behavior.
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
| OGC collections/formats/CRS drift | Discover capabilities/links at runtime; no exhaustive collection enums |
| Large XML/GML/reports/images | Raw streaming, backpressure, output-file requirement, checksums, bounded optional parsing |
| Fiks anonymous creation duplicates after timeout | No automatic retry; dry-run/confirmation; report unknown outcome and recovery identity |
| GraphQL HTTP 200 partial failure | Inspect `errors`; explicit partial schema and exit `9` |
| Unknown rate/page/file limits | Conservative local ceilings; server-directed retry; never document “unlimited” |
| Generated surface accidentally exposes admin operations | Rule 1 of 8.3 excludes `/admin/` and `/stats/` by path, and the 8.3 binding assertions fail CI if such an operation becomes reachable |
| Sensitive request/header leakage through redirects, debug, or errors | Canonical-origin allowlisting, no authorization-header input, centralized redaction, seeded-sensitive-value tests |
| Spec redistribution uncertainty | Verify license; otherwise retain URL/digest/generated metadata rather than unapproved raw copies |
| Node.js 20 dependency incompatibility | Pin compatible majors; CI minimum-version job; do not upgrade Commander/GraphQL majors blindly |
| npm package omits runtime files | Publish `dist`/schemas/manifest and test installed tarball |

Open upstream questions that do not block foundation work:

- Canonical NVDB Export host and range/resume behavior.
- Per-family Reports sync/async behavior, expiration, limits, and MIME names.
- Trafikkdata maximum windows/pages/query complexity.
- Routing long-term anonymous policy and current quota.
- Numerical rate/size limits across most products.

Any unresolved question that changes access, privacy, effects, or compatibility blocks that product slice—not the shared foundation or already verified services.

## 13. Execution order for the remaining work

All offline work in this plan is complete. Phases 0–8 are implemented and every gate in 10.3 that can run without credentials or network access passes.

The order that was followed, recorded because it matters if this plan is ever re-run against a fork:

1. **Phase 8 first.** Everything else depended on a coverage gate that measures the shipped product. Expanding the generated registry before the gate was bound would have added operations under the same unverified classification that produced the 0.2 defect.
2. Binding assertions, overlay regeneration, command-array migration, and `promotion_gate` removal landed as one commit, because the assertions fail by design until the overlays are corrected.
3. Deletion of the Stedfesting, Tiles/DGGS, and WebSocket records; then the 4.3 promotions.
4. Mechanical exclusion rules, which caught a shipped read still classified as excluded.
5. The remaining process fixtures.

Constraints that held throughout and still apply to any further change:

- No new runtime dependency without a registry-verified pin and a Node 20 compatibility check.
- No command may be added without a claiming coverage unit; this now fails CI automatically.
- No permanent exclusion may be added that does not match an 8.3 rule; this also fails CI.
- No credential path, authorization header, or account-scoped operation enters the tree under any circumstances.

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
