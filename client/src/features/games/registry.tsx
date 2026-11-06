import { BattleshipTable } from "@/features/games/battleship/BattleshipTable";
import { UnoTable } from "@/features/games/uno/UnoTable";
import type { BattleshipMove, GameUpdate, UnoMove } from "@boardroom/shared";

interface GameTableProps {
  update: GameUpdate;
  pending: boolean;
  winnerName: string | null;
  names: Record<string, string>;
  onMove: (move: BattleshipMove | UnoMove) => void;
}

export function GameTable({ update, pending, winnerName, names, onMove }: GameTableProps) {
  if (update.gameId === "uno") {
    return (
      <UnoTable
        view={update.view}
        pending={pending}
        winnerName={winnerName}
        names={names}
        onMove={onMove}
      />
    );
  }
  return (
    <BattleshipTable
      view={update.view}
      pending={pending}
      winnerName={winnerName}
      onMove={onMove}
    />
  );
}
