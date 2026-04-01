# Contributing to Tessera

Thank you for your interest in Tessera. This project is in its earliest stages and we welcome contributions of all kinds — code, protocol design feedback, security review, documentation, and testing.

Tessera is currently focused on one narrow problem: execution-time authorization for sensitive AI agent actions. The first product surface is Tessera Guard.

## How to Contribute

### Reporting Issues

Open a [GitHub Issue](../../issues) for bugs, design questions, or feature suggestions. Please include enough context for us to understand and reproduce the problem.

### Proposing Changes

1. **Fork** the repository
2. **Create a branch** from `main` (`git checkout -b your-feature`)
3. **Make your changes** with clear commit messages
4. **Open a Pull Request** against `main` with a description of what you changed and why

For larger changes (new protocol features, architectural decisions), please open an issue first to discuss the approach before writing code.

### Protocol Spec Contributions

Changes to the protocol specification in `spec/` are held to a higher bar than code changes. Spec PRs should include a rationale section explaining the design decision and any alternatives considered.

## Development Setup

```bash
git clone https://github.com/tessera-protocol/tessera.git
cd tessera/packages/sdk
npm install
npm test
```

## Code Style

- TypeScript with strict mode enabled
- Use `npm run lint` before submitting
- Write tests for new functionality
- Keep dependencies minimal — every dependency is an attack surface for runtime authorization infrastructure

## Areas Where Help Is Needed

- **Agent runtimes** — Guard integrations for OpenClaw, MCP, coding agents, and gateways
- **Authorization policy design** — Scope matching, action classification, and revocation semantics
- **Security review** — Threat modelling and adversarial analysis for delegated agent authority
- **Issuer service** — Online verification, revocation, and runtime-facing policy endpoints
- **Developer docs** — Guides, tutorials, and integration examples for runtimes

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you agree to uphold it.

## Questions?

Open an issue or start a discussion. There are no stupid questions — identity and cryptography are hard, and we want this project to be approachable.
