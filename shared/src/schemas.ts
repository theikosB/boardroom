import { z } from "zod";
import { ROOM_CODE_ALPHABET } from "./games/battleship.ts";

const codePattern = new RegExp(`^[${ROOM_CODE_ALPHABET}]{5}$`);

export const displayNameSchema = z.string().trim().min(2).max(20);

export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(codePattern, "Enter the 5-character room code.");

export const createRoomSchema = z.object({
  name: displayNameSchema,
});

export const joinRoomSchema = z.object({
  code: roomCodeSchema,
  name: displayNameSchema,
});

export const rejoinRoomSchema = z.object({
  code: roomCodeSchema,
  playerId: z.string().trim().min(8).max(80),
  token: z.string().trim().min(20).max(120),
});

export const readySchema = z.object({
  ready: z.boolean(),
});

export const kickSchema = z.object({
  playerId: z.string().trim().min(1),
});

export const configureSchema = z.object({
  gameId: z.enum(["battleship", "uno"]),
});

export const unoMoveSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("play"),
    cardId: z.string().trim().min(1).max(40),
    color: z.enum(["red", "yellow", "green", "blue"]).optional(),
  }),
  z.object({ type: z.literal("draw") }),
  z.object({ type: z.literal("pass") }),
  z.object({ type: z.literal("call-uno") }),
  z.object({
    type: z.literal("catch"),
    playerId: z.string().trim().min(1).max(80),
  }),
  z.object({
    type: z.literal("choose-color"),
    color: z.enum(["red", "yellow", "green", "blue"]),
  }),
]);

const shipKindSchema = z.enum([
  "carrier",
  "battleship",
  "cruiser",
  "submarine",
  "destroyer",
]);

export const battleshipMoveSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("place"),
    ships: z
      .array(
        z.object({
          kind: shipKindSchema,
          r: z.number().int().min(0).max(9),
          c: z.number().int().min(0).max(9),
          dir: z.enum(["horizontal", "vertical"]),
        }),
      )
      .length(5),
  }),
  z.object({
    type: z.literal("fire"),
    r: z.number().int().min(0).max(9),
    c: z.number().int().min(0).max(9),
  }),
]);

export const nudgeSchema = z.object({
  kind: z.literal("rematch"),
});
