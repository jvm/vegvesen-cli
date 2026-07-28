# ADR 0003: anonymous-only v1

Status: accepted

No login, credentials, custom authorization headers, protected operations, or authenticated tests ship in v1. Public classification requires reviewed evidence and anonymous verification. Unexpected 401/403 returns `ACCESS_NOT_AVAILABLE_IN_V1`.
