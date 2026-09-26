# PAAIPE Mobile App

React and TypeScript member/agent app with TanStack Start and Capacitor shells for iOS and Android.

- Linode: application data and media (`api.paaipe.org`, `media.paaipe.org`).
- Firebase: users/authentication and event registrations (Cloud Firestore, named database `paaipe`).
- Netlify: the separate web portal's hosting.

## Development

Install Node.js and Bun, then:

```sh
git clone https://github.com/Upupapp/PAAIPE-Mobile-APP.git
cd PAAIPE-Mobile-APP
bun install --frozen-lockfile
bun run dev
```

The PAAIPE Firebase web config is public (protected by Firestore security rules,
not secrecy) and ships as defaults in `src/lib/firebase.ts`, so the app runs
without any setup. To point at a different Firebase project or API, copy
`.env.example` to `.env.local` and override the `VITE_*` values.

Local environment files, signing material, test credentials, build outputs and temporary review folders are excluded from Git.

## Validation and native builds

```sh
bunx tsc --noEmit
bun test tests/p0-contracts.test.ts
bun run build
bun run cap:copy
```

Use `bun run cap:sync` when native dependencies change, then `bun run cap:ios` or `bun run cap:android` to open the native project. App store submission is separate from publishing this repository.

## Current scope

The app includes the Teresa-style member screens and P0 membership, API contract, content-accuracy and error-state improvements. Cross-surface parity still depends on Linode endpoint deployment and migrating legacy web data calls.

See [member portal parity](docs/MEMBER-PORTAL-PARITY.md) and [P0 implementation status](docs/P0-DATA-CONTRACTS.md). Earlier baseline/store/design-handoff documents are historical implementation notes; temporary local review artifacts referenced in them are not shipped in this repository.

This project originated in Lovable. Follow [AGENTS.md](AGENTS.md) and preserve published Git history.
