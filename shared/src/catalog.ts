export const GAME_IDS = [
  "battleship",
  "uno",
  "poker",
  "monopoly",
  "risk",
  "catan",
  "ticket-to-ride",
  "wingspan",
  "splendor",
  "scotland-yard",
] as const;

export type GameId = (typeof GAME_IDS)[number];

export type GameDifficulty = "easy" | "medium" | "hard";

/** `playable` only after an engine, a renderer, and tests exist. */
export type GameAvailability = "coming-soon" | "playable";

export interface GameCatalogEntry {
  id: GameId;
  name: string;
  /** Optional variant line, shown under the name. */
  subtitle?: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  difficulty: GameDifficulty;
  availability: GameAvailability;
}

/**
 * Games whose rules, player view, renderer, and tests all exist.
 * The catalog test fails if a card says "playable" without an id here,
 * or the other way around.
 */
export const PLAYABLE_GAME_IDS = ["battleship", "uno"] as const satisfies readonly GameId[];

export type PlayableGameId = (typeof PLAYABLE_GAME_IDS)[number];

export const GAMES: readonly GameCatalogEntry[] = [
  {
    id: "battleship",
    name: "Battleship",
    description:
      "Two fleets on two private grids. You call a square, and the only answer you get back is miss, hit, or sunk.",
    minPlayers: 2,
    maxPlayers: 2,
    difficulty: "easy",
    availability: "playable",
  },
  {
    id: "uno",
    name: "UNO",
    description:
      "Match color or number and empty your hand. A few cards skip a player, reverse direction, or make someone draw.",
    minPlayers: 2,
    maxPlayers: 10,
    difficulty: "easy",
    availability: "playable",
  },
  {
    id: "poker",
    name: "Poker",
    subtitle: "Texas Hold'em",
    description:
      "Two hidden cards each, five shared cards, and betting with play chips. Nothing on this table is worth real money.",
    minPlayers: 2,
    maxPlayers: 8,
    difficulty: "medium",
    availability: "coming-soon",
  },
  {
    id: "monopoly",
    name: "Monopoly",
    description:
      "Buy streets, build them up, and try to be the last player who can still pay the rent.",
    minPlayers: 2,
    maxPlayers: 8,
    difficulty: "medium",
    availability: "coming-soon",
  },
  {
    id: "risk",
    name: "Risk",
    description:
      "Take territories, roll dice for the attacks, and hold a map that will not sit still.",
    minPlayers: 2,
    maxPlayers: 6,
    difficulty: "hard",
    availability: "coming-soon",
  },
  {
    id: "catan",
    name: "Catan",
    description:
      "Settle a board of hexes, trade with the people beside you, and race to ten points. The base game seats three or four.",
    minPlayers: 3,
    maxPlayers: 4,
    difficulty: "medium",
    availability: "coming-soon",
  },
  {
    id: "ticket-to-ride",
    name: "Ticket to Ride",
    description:
      "Claim train routes between cities and finish the tickets in your hand before someone else takes the track.",
    minPlayers: 2,
    maxPlayers: 5,
    difficulty: "medium",
    availability: "coming-soon",
  },
  {
    id: "wingspan",
    name: "Wingspan",
    description:
      "Play birds into a preserve and build a small engine that gets stronger each round.",
    minPlayers: 1,
    maxPlayers: 5,
    difficulty: "medium",
    availability: "coming-soon",
  },
  {
    id: "splendor",
    name: "Splendor",
    description:
      "Collect gems, buy cards, and race to fifteen points. Turns stay short and the table stays small.",
    minPlayers: 2,
    maxPlayers: 4,
    difficulty: "medium",
    availability: "coming-soon",
  },
  {
    id: "scotland-yard",
    name: "Scotland Yard",
    description:
      "One player slips through a city on buses, trains, and taxis. Everyone else follows the last known stop and tries to land on the same one.",
    minPlayers: 2,
    maxPlayers: 6,
    difficulty: "medium",
    availability: "coming-soon",
  },
];

const DIFFICULTY_LABEL: Record<GameDifficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export function getGame(id: string): GameCatalogEntry | undefined {
  return GAMES.find((game) => game.id === id);
}

export function formatPlayerCount(minPlayers: number, maxPlayers: number): string {
  if (minPlayers === maxPlayers) {
    return minPlayers === 1 ? "1 player" : `${minPlayers} players`;
  }
  return `${minPlayers}–${maxPlayers} players`;
}

export function formatDifficulty(difficulty: GameDifficulty): string {
  return DIFFICULTY_LABEL[difficulty];
}
