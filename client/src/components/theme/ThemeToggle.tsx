import { Button } from "@/components/ui/button";
import { applyTheme, currentTheme, type Theme } from "@/lib/theme";
import { MoonIcon, SunIcon } from "lucide-react";
import { useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => currentTheme());
  const nextTheme: Theme = theme === "dark" ? "light" : "dark";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="size-11"
      aria-label={nextTheme === "light" ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => {
        applyTheme(nextTheme);
        setTheme(nextTheme);
      }}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}
