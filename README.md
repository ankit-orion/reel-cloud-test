# Rock Paper Scissors

A pixel-art rock paper scissors game for iOS and Android, built with Expo (React Native), plus the
small Node server that runs live matches between friends.

- **Play a friend** – create a room, share the 5-character code, and play live over a WebSocket.
- **Play the computer** – the computer throws uniformly at random every round.
- **Profile** – wins and losses against players and against the computer, shown separately.
- **Leaderboard** – ranked by score. Only matches against real players earn score.
- **Tiers** – Bronze to Legend, based on score.

Every match is first to 3 round wins.

## Score and tiers

Score only changes when a match against a real player ends: **+25** for a win, **−10** for a loss,
never below 0. Leaving a match, or staying disconnected for more than 30 seconds, counts as a loss.
Matches against the computer are saved to your profile and never touch score or the leaderboard.

| Tier     | Score  |
| -------- | ------ |
| Bronze   | 0+     |
| Silver   | 100+   |
| Gold     | 250+   |
| Platinum | 500+   |
| Diamond  | 1000+  |
| Legend   | 2000+  |

The scale lives in `shared/tiers.ts`.

## Run it

You need Node 22.18 or newer.

**1. Start the server**

```bash
cd server
npm install
npm start          # listens on port 8787, stores players in server/data/
```

**2. Start the app**

```bash
npm install
EXPO_PUBLIC_SERVER_URL=http://<your-computer's-LAN-IP>:8787 npx expo start
```

Scan the QR code with Expo Go on a phone that is on the same Wi-Fi. A phone cannot reach
`localhost` on your computer, which is why the server URL uses the computer's LAN address.
To try it in a browser instead, run `npm run web` (the default server URL, `http://localhost:8787`,
works there).

To play a friend match on your own, open the app on two devices (or a phone and a browser tab in a
private window) and register a different name on each.

### Changing the server from inside the app

The address above is only the one built into the app. The name-entry screen and the Profile screen
both have a **Game server** box where a player can type a different address (for example
`192.168.1.20:8787`); the app checks that a game server answers there before switching. This is
how an installed copy is pointed at your server without rebuilding it.

## Building an installable Android app (APK)

With the Android SDK and a JDK installed:

```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
# -> android/app/build/outputs/apk/release/app-release.apk
```

Set `EXPO_PUBLIC_SERVER_URL` for that build to bake in your server's address. The `android/` folder
is generated and not committed. This APK is signed with the debug key: fine for installing on your
own phones, but the Play Store needs your own signing key (`npx eas-cli@latest build` handles that).
The Android app allows plain `http://` so it can reach a server on your home network; use `https://`
for a server on the internet, since the player's sign-in token travels with every request.

## Putting the server online

Friends outside your Wi-Fi need the server on a public host. The repository is set up for
**Render's free plan** with player records in a **free Neon Postgres database**. Both can be set
up from a phone browser.

1. **Database** – create a free account and a project at [neon.com](https://neon.com), and copy the
   project's connection string (it starts with `postgresql://`). It contains the database password:
   paste it only into Render.
2. **Server** – at [render.com](https://render.com), sign in with GitHub and choose
   **New → Blueprint**, then pick this repository. Render reads `render.yaml`, asks for
   `DATABASE_URL` (paste the connection string), and deploys.
3. **App** – Render shows the server's address (`https://<name>.onrender.com`). Enter it in the
   app's **Game server** box, or build the app with `EXPO_PUBLIC_SERVER_URL` set to it.

What to expect on the free plan: the server sleeps after 15 minutes without activity and takes
about a minute to wake when someone next opens the app, so the first action after a quiet spell
can fail once with "try again in a minute". A match in progress keeps the server awake.

Why a separate database: a free Render service has no disk that survives a restart, and Render's
own free Postgres is deleted 30 days after creation.

Any other host that runs Node 22.18+ and allows WebSockets works too: install with
`npm ci --prefix server --omit=dev`, start with `npm start --prefix server`, and set `DATABASE_URL`.
Without `DATABASE_URL` the server keeps its own embedded database in `DATA_DIR` (default
`server/data/`), which is what local development uses and needs a disk that persists.

Before a public launch, add rate limiting to `POST /api/register` and a filter for offensive
names; neither exists yet. A player is tied to the device that registered it (a secret token kept
on the device), so reinstalling the app starts a new player; adding a real sign-in would fix that.
Live rooms are held in memory: restarting the server ends matches in progress without scoring them.

## Tests

```bash
npm test               # rules, tier scale, name rules, sprite data
npm run test:server    # server: matches, scoring, leaderboard, forfeits, reconnects
                       # (set TEST_DATABASE_URL to run them against a real Postgres server)
npm run typecheck
npx expo lint
```

## Layout

| Path          | What it is                                                                 |
| ------------- | -------------------------------------------------------------------------- |
| `App.tsx`     | Picks the current screen                                                   |
| `src/pixel/`  | Pixel-art sprites (text grids) and the UI kit built on them                |
| `src/game/`   | The match screen, and the computer and friend-match drivers                |
| `src/screens/`| Name entry, home, invite lobby, leaderboard, profile                       |
| `src/net/`    | HTTP client, the saved player, the WebSocket connection                    |
| `shared/`     | Rules, score/tier scale and wire protocol, used by both app and server     |
| `server/`     | HTTP + WebSocket server; player records in Postgres                        |

The font is Press Start 2P (SIL Open Font License). All sprites are original and live in
`src/pixel/sprites.ts`.
