## Tessera Web App

Client-side Next.js + Capacitor shell for the Tessera demo app.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

The app auto-initializes a demo credential in the browser on first load and persists state in `localStorage`.

## Security Notes

⚠️ Demo only.

This app stores all browser state in `localStorage`, including private keys used for demo credential issuance and agent delegation.

That means the current implementation is vulnerable to:

- any XSS running on the same origin
- browser extensions with page access
- local browser profile compromise

In production, private keys must not live in `localStorage`. Use:

- Web Crypto API with non-extractable `CryptoKey` objects
- platform secure storage such as iOS Keychain or Android Keystore
- issuer-managed signing or hardware-backed key custody where appropriate

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
