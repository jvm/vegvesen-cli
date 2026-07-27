# ADR 0004: reviewed anonymous mutations only

Status: accepted

Only individually approved anonymous Fiks operations may mutate remote state. They require local/schema validation, meaningful dry-run with zero network calls, and explicit confirmation or `--yes`. No automatic retry occurs without verified upstream idempotency.
