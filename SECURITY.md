# Security Policy

## Supported versions

Security fixes are provided for the latest released version.

## Reporting a vulnerability

Do not open a public issue for suspected vulnerabilities. Use GitHub private vulnerability reporting:

https://github.com/jvm/vegvesen-cli/security/advisories/new

Include the affected command/version, reproduction steps, impact, and suggested mitigation. Do not include personal Fiksvegdata issue content, attachments, unpublished report data, tokens, cookies, authorization headers, or other secrets.

Reports should be acknowledged within seven days. Remediation and coordinated disclosure timing depend on severity and reproducibility.

## Security model

Version 1 intentionally supports anonymous public APIs only. It accepts no credentials and must not send authorization headers or cookies. Unexpected access requirements fail closed with `ACCESS_NOT_AVAILABLE_IN_V1`.

The repository runs dependency auditing, secret scanning, ESLint security rules, Semgrep, CodeQL, GitHub Actions auditing, OpenSSF Scorecard, package installation tests, and specification drift checks.
