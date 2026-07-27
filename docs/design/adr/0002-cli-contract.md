# ADR 0002: one semantic core, dual presentation

Status: accepted

Commands return values or typed errors and never print. Process adapter alone writes streams. Explicit machine mode is non-interactive and schema-versioned. TTY detection changes presentation only. Commander provides strict declarative parsing; command metadata drives discovery and schema output.
