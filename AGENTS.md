This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## How this project is laid out

- `App.tsx` picks the screen from a small piece of state; there is no router. A live friend match
  (`room` from `useRoom`) takes over the screen whenever one is in progress.
- `src/pixel/` is the pixel-art kit: sprites are text grids in `sprites.ts`, drawn by `Sprite.tsx`;
  `ui.tsx` has the text, button, panel and input used everywhere. Build new UI from these.
- `src/game/` is the match screen (`Arena.tsx`) and its two drivers: `CpuGame.tsx` (local, random
  opponent) and `OnlineGame.tsx` (plays back what the server decides).
- `src/net/` talks to the server: `api.ts` (HTTP), `useSession.ts` (this device's player),
  `useRoom.ts` (the WebSocket).
- `shared/` is imported by both the app and the server: rules, the score/tier scale, and the wire
  protocol. The server runs these files directly with Node's type stripping, so no enums, and
  imports between shared files need the `.ts` extension.
- `server/` is a separate Node package (own `package.json`). It is the only place score changes.

Run `npm test`, `npm run test:server` and `npm run typecheck` before declaring a task done.

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
