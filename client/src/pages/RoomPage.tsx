import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { GameTable } from "@/features/games/registry";
import { clearSession, loadSession, saveSession } from "@/lib/session";
import { request, socket } from "@/lib/socket";
import {
  GAMES,
  ROOM_CODE_ALPHABET,
  type GameUpdate,
  type PublicRoom,
} from "@boardroom/shared";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";

export function RoomPage() {
  const params = useParams();
  const code = (params.code ?? "").toUpperCase();
  return <RoomSession key={code} code={code} />;
}

function RoomSession({ code }: { code: string }) {
  const navigate = useNavigate();
  const codeOk = new RegExp(`^[${ROOM_CODE_ALPHABET}]{5}$`).test(code);
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [game, setGame] = useState<GameUpdate | null>(null);
  const [connected, setConnected] = useState(socket.connected);
  const [youId, setYouId] = useState<string | null>(() => {
    const saved = loadSession();
    return saved && saved.code.toUpperCase() === code ? saved.playerId : null;
  });
  const [needsName, setNeedsName] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [closed, setClosed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmStart, setConfirmStart] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  useEffect(() => {
    if (!codeOk) return;
    function onState(next: PublicRoom) {
      if (next.code !== code) return;
      setRoom((current) => (!current || next.version >= current.version ? next : current));
    }
    function onView(update: GameUpdate) {
      setGame((current) => (!current || update.version >= current.version ? update : current));
    }
    function onClosed(payload: { code?: string }) {
      if (payload.code?.toUpperCase() === code) {
        clearSession();
        setClosed(true);
      }
    }
    let active = true;
    async function onConnect() {
      setConnected(true);
      const saved = loadSession();
      if (!saved || saved.code.toUpperCase() !== code) {
        if (active) setNeedsName(true);
        return;
      }
      const ack = await request("room:rejoin", {
        code: saved.code,
        playerId: saved.playerId,
        token: saved.token,
      });
      if (!active) return;
      if (!ack.ok || !ack.session) {
        clearSession();
        setNeedsName(true);
        setError(ack.ok ? "That seat could not be reclaimed." : ack.message);
        return;
      }
      saveSession(ack.session);
      setYouId(ack.session.playerId);
      setNeedsName(false);
      setError(null);
    }
    function onDisconnect() {
      setConnected(false);
    }
    socket.on("room:state", onState);
    socket.on("game:view", onView);
    socket.on("room:closed", onClosed);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    if (socket.connected) void onConnect();
    else socket.connect();
    return () => {
      active = false;
      socket.off("room:state", onState);
      socket.off("game:view", onView);
      socket.off("room:closed", onClosed);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [code, codeOk]);

  async function joinHere(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 20) {
      setError("Use a name between 2 and 20 characters.");
      return;
    }
    setPending(true);
    const ack = await request("room:join", { code, name: trimmed });
    setPending(false);
    if (!ack.ok || !ack.session) {
      setError(ack.ok ? "The room did not open." : ack.message);
      return;
    }
    saveSession(ack.session);
    setYouId(ack.session.playerId);
    setNeedsName(false);
    setError(null);
  }

  async function act(event: string, payload?: unknown) {
    setPending(true);
    setMoveError(null);
    const ack = await request(event, payload ?? {});
    setPending(false);
    if (!ack.ok) setMoveError(ack.message);
    return ack.ok;
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (!codeOk) {
    return (
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-4xl">That code does not look right</h1>
        <p className="mt-3 text-lg text-muted-foreground">Room codes are five characters. Ask for the code again.</p>
        <Link to="/" className="mt-6 inline-block text-base underline">
          Back to the shelf
        </Link>
      </main>
    );
  }

  const you = room?.players.find((player) => player.id === youId) ?? null;
  const table = game && room && game.gameId === room.gameId ? game : null;
  const winnerName = room?.players.find((player) => player.id === table?.view.winnerId)?.name ?? null;
  const chosen = GAMES.find((entry) => entry.id === room?.gameId);
  const playerCount = room?.players.length ?? 0;
  const canStart = Boolean(
    chosen && playerCount >= chosen.minPlayers && playerCount <= chosen.maxPlayers,
  );
  const someoneAway = room?.phase === "lobby" && room.players.some((player) => !player.ready);

  return (
    <main id="main" className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-base font-medium text-brass">{connected ? "Connected" : "Reconnecting…"}</p>
          <h1 className="mt-1 text-4xl sm:text-5xl" data-testid="room-code">
            {code}
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            {you ? `You are ${you.name}. ` : ""}
            Share this code with one friend. A refresh keeps your seat.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="h-11 px-4 text-base" onClick={() => void copyCode()} data-testid="copy-code">
            {copied ? "Copied" : "Copy code"}
          </Button>
          {you ? (
            <Button type="button" variant="outline" className="h-11 px-4 text-base" onClick={() => setConfirmLeave(true)}>
              Leave
            </Button>
          ) : null}
        </div>
      </div>

      {!closed && !needsName && !room ? (
        <p className="text-lg text-muted-foreground">Taking your seat…</p>
      ) : null}

      {closed ? (
        <p className="text-lg" role="status">
          This room has closed.{" "}
          <Link to="/" className="underline">
            Open another one.
          </Link>
        </p>
      ) : null}

      {needsName && !closed ? (
        <form className="grid max-w-md gap-4 rounded-2xl border bg-card p-5" onSubmit={joinHere}>
          <h2 className="text-2xl">Sit down</h2>
          <label className="grid gap-2 text-base font-medium">
            Your name
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={20}
              required
              data-testid="room-join-name"
            />
          </label>
          <Button type="submit" className="h-11 text-base" disabled={pending} data-testid="room-join-submit">
            {pending ? "Connecting…" : "Join this room"}
          </Button>
        </form>
      ) : null}

      {error ? (
        <p role="alert" className="text-base text-destructive">
          {error}
        </p>
      ) : null}

      {room && you ? (
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="text-2xl">Seats</h2>
          <ul className="mt-4 grid gap-3">
            {room.players.map((player) => (
              <li key={player.id} className="flex flex-wrap items-center gap-2 text-base" data-testid={`seat-${player.name}`}>
                <span className="font-medium">{player.name}</span>
                {player.isHost ? <span className="text-brass">Host</span> : null}
                {room.phase === "lobby" && player.ready ? <span>Ready</span> : null}
                {player.connected ? null : <span>Away</span>}
                {player.wantsRematch ? <span>Wants a rematch</span> : null}
                {you.isHost && room.phase === "lobby" && player.id !== you.id ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-9 px-2 text-base"
                    onClick={() => void act("room:kick", { playerId: player.id })}
                  >
                    Remove
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>

          {room.phase === "lobby" ? (
            <div className="mt-5 grid gap-4">
              <div>
                <p className="text-base text-muted-foreground">Game</p>
                {you.isHost ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {GAMES.filter((entry) => entry.availability === "playable").map((entry) => (
                      <Button
                        key={entry.id}
                        type="button"
                        variant={room.gameId === entry.id ? "default" : "outline"}
                        className="h-11 px-4 text-base"
                        data-testid={`pick-${entry.id}`}
                        disabled={pending}
                        onClick={() => void act("room:configure", { gameId: entry.id })}
                      >
                        {entry.name}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-2xl">{chosen?.name}</p>
                )}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 text-base"
                  data-testid="ready-toggle"
                  disabled={pending}
                  onClick={() => void act("room:ready", { ready: !you.ready })}
                >
                  {you.ready ? "Not ready yet" : "I'm ready"}
                </Button>
                {you.isHost ? (
                  <Button
                    type="button"
                    className="h-11 text-base"
                    data-testid="start-game"
                    disabled={pending || !canStart}
                    onClick={() => {
                      if (someoneAway) setConfirmStart(true);
                      else void act("room:start");
                    }}
                  >
                    {canStart ? `Start ${chosen?.name}` : playerCount < (chosen?.minPlayers ?? 2) ? "Waiting for another player" : `Too many players for ${chosen?.name}`}
                  </Button>
                ) : (
                  <p className="self-center text-base text-muted-foreground">The host starts {chosen?.name}.</p>
                )}
              </div>
            </div>
          ) : null}

          {room.phase === "playing" && you.isHost ? (
            <Button
              type="button"
              variant="outline"
              className="mt-5 h-11 text-base"
              disabled={pending}
              onClick={() => void act("room:end")}
            >
              End match
            </Button>
          ) : null}

          {room.phase === "finished" ? (
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              {you.isHost ? (
                <Button type="button" className="h-11 text-base" data-testid="rematch" disabled={pending} onClick={() => void act("room:restart")}>
                  Play again
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 text-base"
                  disabled={pending || you.wantsRematch}
                  onClick={() => void act("game:nudge", { kind: "rematch" })}
                >
                  {you.wantsRematch ? "Asked for a rematch" : "Ask for a rematch"}
                </Button>
              )}
            </div>
          ) : null}
        </section>
      ) : null}

      {moveError ? (
        <p role="alert" className="text-base text-destructive" data-testid="move-error">
          {moveError}
        </p>
      ) : null}

      {room && you && room.phase !== "lobby" && table ? (
        <GameTable
          update={table}
          pending={pending}
          winnerName={winnerName}
          names={Object.fromEntries(room.players.map((player) => [player.id, player.name]))}
          onMove={(move) => void act("game:move", move)}
        />
      ) : null}

      {room && you && room.phase !== "lobby" && !table ? (
        <p className="text-lg text-muted-foreground">Setting the table…</p>
      ) : null}

      <Dialog open={confirmStart} onOpenChange={setConfirmStart}>
        <DialogContent className="text-base sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl">Start with someone not ready?</DialogTitle>
            <DialogDescription className="text-base text-muted-foreground">
              Ready is a signal. You can still start the game.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" className="h-11 text-base" onClick={() => setConfirmStart(false)}>
              Wait
            </Button>
            <Button
              type="button"
              className="h-11 text-base"
              data-testid="confirm-start"
              onClick={() => {
                setConfirmStart(false);
                void act("room:start");
              }}
            >
              Start anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <DialogContent className="text-base sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl">Leave the table?</DialogTitle>
            <DialogDescription className="text-base text-muted-foreground">
              {room?.phase === "playing"
                ? "Leaving now forfeits the match. Closing the tab does not. A dropped connection waits for you."
                : "Your seat will be free for someone else."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" className="h-11 text-base" onClick={() => setConfirmLeave(false)}>
              Stay
            </Button>
            <Button
              type="button"
              className="h-11 text-base"
              data-testid="confirm-leave"
              onClick={() => {
                void (async () => {
                  const ok = await act("room:leave");
                  if (!ok) return;
                  clearSession();
                  navigate("/");
                })();
              }}
            >
              Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
