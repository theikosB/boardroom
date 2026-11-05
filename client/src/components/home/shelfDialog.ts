import type { GameCatalogEntry } from "@boardroom/shared";

export type RoomIntent = "create" | "join";

export type ShelfDialog =
  | { kind: "room"; intent: RoomIntent }
  | { kind: "game"; game: GameCatalogEntry };

export interface DialogCopy {
  title: string;
  body: string;
}

export function dialogCopy(dialog: ShelfDialog): DialogCopy {
  if (dialog.kind === "room") {
    return dialog.intent === "create" ? createRoomCopy() : joinRoomCopy();
  }
  return gameCopy(dialog.game);
}

function createRoomCopy(): DialogCopy {
  return {
    title: "Rooms open next",
    body: "Creating a room will hand you a short code. Friends type that code on their own screens, pick a display name, and sit down with you. The person who opens the room is a player, the same as everyone else. Closing their browser will not shut the table down. This version does not open a live room yet.",
  };
}

function joinRoomCopy(): DialogCopy {
  return {
    title: "You'll need a code from a friend",
    body: "Joining will mean typing the code they sent and choosing the name on your seat. Coming back after a refresh takes a private token stored in your browser. A display name or a player id will not be enough to reclaim a seat. There is no room to join in this version.",
  };
}

function gameCopy(game: GameCatalogEntry): DialogCopy {
  if (game.id === "battleship") {
    return {
      title: "Battleship is first, and not open yet",
      body: "Two people, two private grids, and a referee that never shows you the other fleet. That is the first game we will make playable. The board itself is a later milestone, so this card is only a preview.",
    };
  }

  return {
    title: `${game.name} is still on the shelf`,
    body: `${game.name} is listed so you can see what is coming. Its rules are not implemented. Battleship is the first game we will open, and the others follow one at a time.`,
  };
}
