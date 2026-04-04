# @tessera-protocol/sdk

Core SDK for Tessera Guard.

Tessera is an identity-and-authority layer for AI agents, with capability-based security as the core technical model. This package provides the credential, delegation, proof, and verification primitives behind Guard:

- identity and scoped delegated authority
- capability-oriented delegation
- runtime verification primitives
- revocation-aware checks

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

Current boundary:

- the SDK supports capability scope, expiry, delegation identity, proof generation, verification, and revocation-aware checks
- it does not itself determine whether an allowed payload is semantically benign or harmful

Repository:

- https://github.com/tessera-protocol/tessera
