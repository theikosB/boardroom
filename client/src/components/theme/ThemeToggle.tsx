import { Button } from "@/components/ui/button";
import {
  applyTheme,
  readThemeChoice,
  systemPrefersDark,
  type ThemeChoice,
} from "@/lib/theme";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useEffect, useState } from "react";

const NEXT_CHOICE: Record<ThemeChoice, ThemeChoice> = {
  system: "light",
  light: "dark",
  dark: "system",
};

const LABEL: Record<ThemeChoice, string> = {
  system: "Using the system theme. Switch to light.",
  light: "Using the light theme. Switch to dark.",
  dark: "Using the dark theme. Switch to the system theme.",
};

export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>(() => readThemeChoice());

  useEffect(() => {
    if (choice !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const followSystem = () => {
      applyTheme("system");
      setChoice("system");
    };
    media.addEventListener("change", followSystem);
    return () => media.removeEventListener("change", followSystem);
  }, [choice]);

  const Icon = choice === "system" ? MonitorIcon : choice === "light" ? SunIcon : MoonIcon;

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="size-11"
      aria-label={LABEL[choice]}
      title={LABEL[choice]}
      onClick={() => {
        const next = NEXT_CHOICE[choice];
        applyTheme(next);
        setChoice(next);
      }}
    >
      <Icon />
      <span className="sr-only">
        {choice === "system"
          ? `System theme, currently ${systemPrefersDark() ? "dark" : "light"}`
          : `${choice} theme`}
      </span>
    </Button>
  );
}
