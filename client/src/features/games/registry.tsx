import { BattleshipTable } from "@/features/games/battleship/BattleshipTable";
import type { BattleshipMove, BattleshipView, GameId } from "@boardroom/shared";

interface GameTableProps {
  gameId: GameId | null;
  view: BattleshipView;
  pending: boolean;
  winnerName: string | null;
  onMove: (move: BattleshipMove) => void;
}

export function GameTable({ gameId, view, pending, winnerName, onMove }: GameTableProps) {
  if (gameId === "battleship") {
    return <BattleshipTable view={view} pending={pending} winnerName={winnerName} onMove={onMove} />;
  }
  return <p className="text-base text-muted-foreground">This game is not open yet.</p>;
}
