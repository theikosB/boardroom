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
    title: "Open a room",
    body: "You get a short code. One friend types that code, picks a display name, and sits down with you. You are a player. Closing your browser does not shut the table down.",
  };
}

function joinRoomCopy(): DialogCopy {
  return {
    title: "You'll need a code from a friend",
    body: "Type the code they sent and choose the name on your seat. Coming back after a refresh takes a private token stored in this browser. A display name or a player id is not enough to reclaim a seat.",
  };
}

function gameCopy(game: GameCatalogEntry): DialogCopy {
  return {
    title: `${game.name} is still on the shelf`,
    body: `${game.name} is listed so you can see what is coming. Its rules are not implemented. Battleship, UNO, and Poker are the games you can play now.`,
  };
}
