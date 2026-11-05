export type ThemeChoice = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "boardroom-theme";

export function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function readThemeChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // Private browsing can block storage. Fall through to the system theme.
  }
  return "system";
}

export function resolveTheme(choice: ThemeChoice, systemDark: boolean): ResolvedTheme {
  if (choice === "light" || choice === "dark") return choice;
  return systemDark ? "dark" : "light";
}

export function applyTheme(choice: ThemeChoice) {
  const resolved = resolveTheme(choice, systemPrefersDark());
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.style.colorScheme = resolved;
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // The theme still applies for this visit when storage is unavailable.
  }
  return resolved;
}
