# Boardroom

Boardroom is a private browser table for a small group of friends. Someone will open a room, share a short code, and everyone else will join from their own screen. The server will be the referee. This repository is the foundation: the home page, the design system, and a shelf of nine games.

No game is playable yet. Battleship is first, and its rules are not written. Multiplayer rooms are not wired up. There is no account system and no database.

## Milestone

| Milestone | Status |
| --- | --- |
| 1. Foundation: home page, catalog, design system, this guide | In this repository |
| 2. Private rooms over Socket.IO | Not started |
| 3. Battleship rules | Not started |
| 4. Battleship table | Not started |
| 5. Disconnects, rematch, and the awkward paths | Not started |
| 6. Deployment | Not started. No host is chosen |

The host of a room is a player. The game has to keep running if that person closes their browser. Rejoining a seat will require a server-issued token. A player id on its own will not be enough. Both rules are specified in [docs/adding-a-game.md](docs/adding-a-game.md) and are not implemented yet, because there is no room to rejoin.

## Run it locally

You need Node.js 22 or newer.

```bash
npm install
npm run dev
```

The site is served at [http://localhost:5174](http://localhost:5174). It follows the system light or dark theme until you pick one. No environment variables are required. There is no `.env` file in this milestone.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the Vite dev server on port 5174 |
| `npm run test` | Runs the catalog tests in `shared` |
| `npm run typecheck` | Typechecks `shared` and `client` |
| `npm run lint` | Lints the client |
| `npm run build` | Typechecks the shared package and builds the client into `dist/` |
| `npm run preview` | Serves the production build on port 4174 |

## Project layout

```text
client/     React, TypeScript, Vite, Tailwind, shadcn/ui
shared/     Catalog, player-count helpers, and the GameEngine contract
docs/       How to add a game, including the host and token rules
```

The server package is intentionally absent. Express and Socket.IO arrive with rooms, in milestone 2. Game engines will live there, not in React. Framer Motion is also waiting for the game table. The home page does not need it.

`shared` is TypeScript source. The client imports it through the `@boardroom/shared` workspace. There is no separate build step for that package.

## Shelf

All nine games render as coming soon:

Battleship, UNO, Poker (Texas Hold'em), Monopoly, Risk, Catan, Ticket to Ride, Wingspan, and Splendor.

To add another game, or to make one of these playable, follow [docs/adding-a-game.md](docs/adding-a-game.md). Artwork on the shelf is original. Do not drop in a publisher's board, logo, or rule text.

## Deployment

`npm run build` writes the static site to `dist/`. `vercel.json` tells a host to serve that folder. The multiplayer process is still undecided, and this repo does not assume a paid host. When rooms exist, the host has to stay awake, because game state will live in memory. A host that sleeps will wipe those rooms.

## Known issues

`npm audit` reports advisories in Vitest 3 and in the shadcn package that supplies the Tailwind layer. They sit in the test runner and the component toolchain, not in the page itself. Installing Vitest 4, which is the likely fix for the test-runner items, currently crashes npm in this environment, so the suite stays on Vitest 3.2.

Lint exits cleanly, with one warning from the generated `button.tsx`: it exports `buttonVariants` next to the component. That file comes from shadcn and was left as generated.

## Stack

React, TypeScript, Vite, Tailwind CSS, shadcn/ui, and Lucide on the client. Vitest for the shared catalog. The agreed server stack, when rooms start, is Node, TypeScript, Express, and Socket.IO, with game state in memory.
