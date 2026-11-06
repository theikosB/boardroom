import type { SeatSession } from "@boardroom/shared";

const KEY = "boardroom-seat";

export function loadSession(): SeatSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const session = parsed as Partial<SeatSession>;
    if (!session.code || !session.playerId || !session.token || !session.name) return null;
    return {
      code: session.code,
      playerId: session.playerId,
      token: session.token,
      name: session.name,
    };
  } catch {
    return null;
  }
}

export function saveSession(session: SeatSession): void {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(KEY);
}
