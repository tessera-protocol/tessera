## Tessera Web App

Client-side demo wallet for Tessera Guard.

This app demonstrates the credential side of the system:

- a human root credential
- scoped agent delegation
- revocation and activity history
- a mobile-shaped UI for issuing agent authority

It is a demo app, not the core product surface. The core product is Tessera Guard, which enforces execution-time authorization in runtimes and tool gateways.

## Getting Started

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The app auto-initializes demo state in the browser on first load and persists it in `localStorage`.

## Security Notes

⚠️ Demo only.

This app stores browser state in `localStorage`, including demo private keys used for credential issuance and agent delegation.

That means the current implementation is vulnerable to:

- any XSS running on the same origin
- browser extensions with page access
- local browser profile compromise

In production, private keys must not live in `localStorage`. Use:

- Web Crypto API with non-extractable `CryptoKey` objects
- platform secure storage such as iOS Keychain or Android Keystore
- issuer-managed signing or hardware-backed key custody where appropriate
