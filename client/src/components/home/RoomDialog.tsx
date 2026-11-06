import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { RoomIntent } from "@/components/home/shelfDialog";
import { saveSession } from "@/lib/session";
import { request } from "@/lib/socket";
import { ROOM_CODE_ALPHABET } from "@boardroom/shared";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";

interface RoomDialogProps {
  intent: RoomIntent;
  onOpenChange: (open: boolean) => void;
}

export function RoomDialog({ intent, onOpenChange }: RoomDialogProps) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const creating = intent === "create";

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 20) {
      setError("Use a name between 2 and 20 characters.");
      return;
    }
    const roomCode = code.trim().toUpperCase();
    if (!creating && !new RegExp(`^[${ROOM_CODE_ALPHABET}]{5}$`).test(roomCode)) {
      setError("Enter the 5-character room code.");
      return;
    }
    setPending(true);
    setError(null);
    const ack = creating
      ? await request("room:create", { name: trimmed })
      : await request("room:join", { code: roomCode, name: trimmed });
    setPending(false);
    if (!ack.ok || !ack.session) {
      setError(ack.ok ? "The room did not open." : ack.message);
      return;
    }
    saveSession(ack.session);
    onOpenChange(false);
    navigate(`/room/${ack.session.code}`);
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="text-base sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl leading-snug">
            {creating ? "Open a room" : "Join a room"}
          </DialogTitle>
          <DialogDescription className="text-base leading-relaxed text-muted-foreground">
            {creating
              ? "You will be a player at this table. Battleship starts when a second person sits down and you start the match."
              : "Type the code your friend sent, then pick the name on your seat."}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit}>
          {creating ? null : (
            <label className="grid gap-2 text-base font-medium">
              Room code
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                maxLength={5}
                required
                data-testid="join-code"
                placeholder="ABCDE"
              />
            </label>
          )}
          <label className="grid gap-2 text-base font-medium">
            Your name
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={20}
              required
              autoComplete="nickname"
              data-testid={creating ? "create-name" : "join-name"}
              placeholder="Ada"
            />
          </label>
          {error ? (
            <p role="alert" className="text-base text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="h-11 text-base" disabled={pending} data-testid={creating ? "create-submit" : "join-submit"}>
            {pending ? "Connecting…" : creating ? "Open the room" : "Sit down"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
