# Tessera

[![npm](https://img.shields.io/npm/v/@tessera-protocol/sdk)](https://www.npmjs.com/package/@tessera-protocol/sdk)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](./LICENSE)

Tessera is an open protocol for human and agent identity: it anchors a privacy-preserving human credential to real-world verification, lets people delegate scoped wallets to AI agents, and gives platforms an open verification path built on zero-knowledge proofs and standard cryptography.

## Install

```bash
npm install @tessera-protocol/sdk
```

## OpenClaw Milestone

Tessera Guard now works live in OpenClaw for `exec`.

- no credential -> blocked
- valid `exec.shell` credential -> allowed
- revoked credential -> blocked again

Demo artifacts live in [`openclaw-guard-plugin/demo/`](./openclaw-guard-plugin/demo/).

## Four-Layer Architecture

- Anchor: establishes root trust from bank KYC and other real-world verification methods.
- Credential: issues a portable human credential with no name, email, or PII revealed to verifiers.
- Delegation: lets humans create scoped, time-limited, revocable wallets for AI agents.
- Verification: lets platforms verify issuer trust, group membership, nullifier reuse, and delegation scope.

## Links

- [Whitepaper](./docs/whitepaper.pdf)
- [Landing page](./docs/index.html)
- [Protocol spec](./spec/v0.1/tessera-spec.md)
- [Contributing guide](./CONTRIBUTING.md)

## Repository

- `spec/`: protocol specification drafts
- `packages/sdk/`: reference SDK published as `@tessera-protocol/sdk`
- `apps/web/`: web and Capacitor demo app
- `docs/`: landing page and whitepaper assets

## License

Apache 2.0. See [LICENSE](./LICENSE).
