# ADR 0001: strict TypeScript NodeNext ESM

Status: accepted

Compile strict TypeScript to `dist`; retain a tiny ESM launcher. The Node.js floor is 22.12 (raised from 20 on 17 November 2026: Node.js 20 reached end of life and Commander 15 requires 22.12). Native fetch, streams, crypto, filesystem, and node:test form runtime base. Runtime dependencies must support Node 22.12.
