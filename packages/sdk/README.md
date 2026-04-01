# @tessera-protocol/sdk

Core SDK for Tessera Guard.

Tessera is the permission layer for AI agents. This package provides the credential, delegation, proof, and verification primitives behind Guard:

- human root credentials
- agent identity and scoped delegation
- execution-time verification
- nullifier and revocation-aware checks

Requirements:

- Node.js `>=22.5`

Install:

```bash
npm install @tessera-protocol/sdk
```

The main building blocks are:

- `generateIssuerKeypair()`
- `createIssuer()`
- `createDelegation()`
- `prove()`
- `createVerifier()`

Repository:

- https://github.com/tessera-protocol/tessera
