# Version 1 scope

Vegvesen CLI exposes only anonymously callable public services operated by Statens vegvesen.

## Included products

- Dataportalen (CKAN)
- NVDB API Les V4
- NVDB TN-ITS Export
- Trafikkdata
- Route Planning V3 `/open/`
- Parking Register read API
- anonymously verified Fiksvegdata operations
- legacy and modern OGC reads
- NVDB Export, Reports, Status, and Stedfesting reads proven healthy

## Excluded

Credentials, login, protected data, provider/partner/admin operations, paid services, and arbitrary requests are outside v1. A 401 or 403 from an operation classified anonymous is an unavailable operation, not an invitation to add credentials.

OGC Tiles and DGGS are experimental. NVDB Stedfesting remains `upstream-degraded` until representative anonymous requests pass.

## Promotion gate

An operation enters public registry only after official-source review, anonymous production verification, effect/retry classification, fixture coverage, and owner-reviewed manifest entry. Missing OpenAPI security metadata is not proof of anonymous access.
