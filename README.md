# Boardroom

Boardroom is a private browser table for a small group of friends. Someone opens a room, shares a five-character code, and one friend sits down from their own screen. The server is the referee. Battleship and UNO are the games you can play. The other eight games are on the shelf and are not playable yet.

There is no account system and no database. Rooms live in the memory of one Node process.

The host of a room is a player. Closing that browser does not end the match. Rejoining a seat takes a server-issued token stored in the browser. A player id on its own is not enough. Both rules are described in [docs/adding-a-game.md](docs/adding-a-game.md).

## Play Battleship

You need Node.js 22 or newer.

```bash
npm install
npm run dev
```

That starts the referee on port 4010 and the site on port 5174. Open [http://localhost:5174](http://localhost:5174) in two browsers.

1. In the first browser, choose **Create a room**, enter a name, and open the room.
2. Copy the five-character code.
3. In the second browser, choose **Join with a code**, enter that code and a name.
4. The host picks Battleship or UNO, then presses start. Ready is visible, and the host can start when someone is not ready.
5. Battleship is two players. Each person places five ships and confirms the fleet. Ships may touch, including corners. They cannot overlap. Turns alternate on a hit or a miss.
6. UNO is two to ten players. Match the color or the symbol and empty your hand. Every other hand stays hidden.

A refresh keeps your seat. Closing a tab waits two minutes and does not forfeit. **Leave** during a match does forfeit. After the two minutes, if the host is still away and the other player is connected, that other player becomes the host.

On the same Wi-Fi, the second device can open `http://<this-computer-ip>:5174`. The page and the socket stay on that one server.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the server on port 4010 and Vite on port 5174 |
| `npm run test` | Runs the catalog tests and the server tests |
| `npm run typecheck` | Typechecks `shared`, `server`, and `client` |
| `npm run lint` | Lints the client |
| `npm run build` | Typechecks the packages and builds the client into `dist/` |
| `npm run start` | Builds the client and serves it, with rooms, from port 4010 |
| `npm run preview` | Serves the static build on port 4174, without the room server |

## Project layout

```text
client/     React, TypeScript, Vite, Tailwind, shadcn/ui
server/     Express, Socket.IO, room rules, Battleship, UNO
shared/     Catalog, socket payloads, and the GameEngine contract
docs/       How to add a game
```

`shared` is TypeScript source. The client and the server import it through the `@boardroom/shared` workspace.

## Shelf

Battleship and UNO are playable. These stay coming soon:

Poker (Texas Hold'em), Monopoly, Risk, Catan, Ticket to Ride, Wingspan, Splendor, and Scotland Yard.

To add a game, follow [docs/adding-a-game.md](docs/adding-a-game.md). Artwork on the shelf is original.

## Deployment

`npm run build` writes the static site to `dist/`. `vercel.json` tells a static host to serve that folder. A static host cannot run the room server, so the published page can show the shelf and the forms, and a room will not open there until a Node process is running.

`npm start` serves the built site and the sockets from one process. Game state is in memory. A process that sleeps or restarts wipes the rooms. No paid host is assumed.

The site follows the system light or dark theme until you pick one. No environment variables are required.

## Known issues

`npm audit` reports advisories in Vitest 3 and in the shadcn package that supplies the Tailwind layer. They sit in the test runner and the component toolchain, not in the page itself. Installing Vitest 4 currently crashes npm in this environment, so the suite stays on Vitest 3.2.

Lint exits cleanly, with one warning from the generated `button.tsx`: it exports `buttonVariants` next to the component. That file comes from shadcn and was left as generated.

## Stack

React, TypeScript, Vite, Tailwind CSS, shadcn/ui, and Lucide on the client. Node, TypeScript, Express, and Socket.IO on the server. Zod checks the socket payloads. Vitest covers the catalog, the reconnect token, the room rules, and Battleship.
