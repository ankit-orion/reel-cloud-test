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

## Putting the server online

Friends outside your Wi-Fi need the server on a public host. Any host that runs Node 22.18+ and
allows WebSockets will do:

- Deploy the repository (the server imports `shared/`), with start command
  `npm start --prefix server` after `npm install --prefix server`.
- Set `PORT` if the host requires it, and set `DATA_DIR` to a folder on a **persistent disk**.
  Player records are a SQLite file in that folder; on a host with a temporary filesystem they are
  lost on every restart.
- Serve it over HTTPS, then build the app with `EXPO_PUBLIC_SERVER_URL=https://your-host`.

Before a public launch, add rate limiting to `POST /api/register` and a filter for offensive
names; neither exists yet. A player is tied to the device that registered it (a secret token kept
on the device), so reinstalling the app starts a new player; adding a real sign-in would fix that.
Live rooms are held in memory: restarting the server ends matches in progress without scoring them.

## Tests

```bash
npm test               # rules, tier scale, name rules, sprite data
npm run test:server    # server: matches, scoring, leaderboard, forfeits, reconnects
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
| `server/`     | HTTP + WebSocket server with SQLite storage                                |

The font is Press Start 2P (SIL Open Font License). All sprites are original and live in
`src/pixel/sprites.ts`.
