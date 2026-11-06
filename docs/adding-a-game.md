# Adding a game

Boardroom is a shelf of games on top of one room system. A new game should plug in without changing how people create a room, reconnect, or take turns at the table. This guide is the whole path. The server, the socket, Battleship, and UNO are in the repo. The other eight games are still catalog rows.

## Rules every game inherits

These are platform rules. A game does not get its own version of them.

### The host is a player

The host is the person who created the room, or the next connected player if that seat is gone. The Node process is the referee. It is never a player and never the host.

The match state will live in server memory. Closing the host's browser must not pause, reset, or end the game. A host who drops is disconnected, the same as any other player. While it is someone else's turn, play continues. While it is the missing player's turn, the table waits for them to reconnect. Host-only actions wait with them. After the reconnect grace expires, the host role passes to the next connected player. Explicitly leaving the room is different from a dropped connection, and a two-player game may then end by forfeit.

### Reconnection tokens

A player id is a public label. It must never be enough to reclaim a seat.

The server generates the token with Node's CSPRNG and stores only a hash:

```ts
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_BYTES = 32;

export function createReconnectToken(): { token: string; tokenHash: string } {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return { token, tokenHash: hashReconnectToken(token) };
}

export function hashReconnectToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

export function reconnectTokenMatches(token: string, tokenHash: string): boolean {
  const actual = Buffer.from(hashReconnectToken(token));
  const expected = Buffer.from(tokenHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
```

That module is `server/src/auth/reconnectToken.ts`. Do not put it in the client bundle, and do not log the raw token or the hash. The create and join replies return the raw token once. The browser keeps it in `localStorage`. Rejoin sends the room code, the player id, and the token together. The server hashes the presented token and compares it with `timingSafeEqual`. A mismatched token is rejected even when the player id is real.

### Hidden information

The engine's full state stays on the server. `getPlayerView` is the only game payload a browser may receive. Build one view per seated player and send it only on that player's socket. A lobby broadcast is for names, ready state, and the chosen game. It is never for cards, ships, or anything else a player should not see.

The client renders the view and submits an intended move. It does not apply the move as truth, and it does not decide the winner. `getOutcome` does that.

## Where the pieces go

| Piece | Path | Status |
| --- | --- | --- |
| Shelf entry | `shared/src/catalog.ts` | Exists |
| Engine contract | `shared/src/games/types.ts` | Exists |
| Rules | `server/src/games/<id>/engine.ts` | Battleship is the example |
| Rule tests | `server/src/games/<id>/engine.test.ts` | Same change as the engine |
| Room service | `server/src/rooms/service.ts` | Exists |
| Engine registration | `server/src/games/registry.ts` | Battleship is registered |
| Renderer | `client/src/features/games/<id>/` | Battleship is the example |
| Renderer registry | `client/src/features/games/registry.tsx` | Maps a game id to its React component |

The shared package holds types, the catalog, and later the socket payload schemas. It must not hold an engine. If the browser bundle imported the rules, a future bug could send the full state down with them.

Original artwork only. Draw a new SVG in `client/src/components/games/artwork.tsx`. Do not copy a publisher's board, logo, or rulebook text. The names on the shelf are the names the group already uses, and the site stays private.

## Checklist

1. Write down what each player is allowed to see, including what becomes visible at game over.
2. Add a catalog entry in `shared/src/catalog.ts`. Leave `availability` as `"coming-soon"`.
3. Add the id to the expected shelf list in `shared/src/catalog.test.ts`.
4. Define the state, the move, and the player view next to the engine. The state type stays on the server.
5. Implement `GameEngine` from `shared/src/games/types.ts`.
   - `createGame` builds the opening state from player ids the server already authenticated.
   - `validateMove` checks identity, turn order, and the rules. Return `{ ok: false, reason }` with a short reason that contains no hidden information.
   - `applyMove` runs only after validation and returns a new state.
   - `getPlayerView` returns only that player's view.
   - `getOutcome` returns the winner ids, or `null` while the game is still going.
6. Register the engine on the server. The room layer calls validate, then apply, then builds a view per player. The engine does not import Socket.IO.
7. Add a renderer. It receives the view and a function that sends a move. It has no copy of the engine.
8. Add tests before flipping the card to playable:
   - a legal move changes the state
   - an illegal move, including a move out of turn, leaves the state unchanged
   - the win condition matches the rules
   - `JSON.stringify` of each player's mid-game view does not contain another player's secrets
9. In the same change, set `availability` to `"playable"` and append the id to `PLAYABLE_GAME_IDS`. The catalog test fails if those two drift apart.
10. Run `npm run test`, `npm run typecheck`, and `npm run lint`.

Coming-soon cards are catalog rows. They do not get an empty engine file.

## Contract

```ts
interface GameEngine<TState, TMove, TView> {
  readonly id: GameId;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  createGame(playerIds: readonly string[]): TState;
  validateMove(state: TState, playerId: string, move: TMove):
    | { ok: true }
    | { ok: false; reason: string };
  applyMove(state: TState, playerId: string, move: TMove): TState;
  getPlayerView(state: TState, playerId: string): TView;
  getOutcome(state: TState): { winnerIds: readonly string[]; reason: string } | null;
}
```

The live interface is `GameEngine` in `shared/src/games/types.ts`. If this page and that file disagree, the file wins.
