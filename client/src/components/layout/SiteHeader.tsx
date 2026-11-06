import { Mark } from "@/components/layout/Mark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Link } from "react-router";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <Mark />
          <span className="font-heading text-xl leading-none text-foreground">Boardroom</span>
        </Link>
        <nav className="ml-auto flex items-center gap-1 sm:gap-2" aria-label="Page">
          <Link
            to="/#how-it-works"
            className="hidden rounded-lg px-3 py-2 text-base text-muted-foreground hover:bg-muted hover:text-foreground sm:inline"
          >
            How it works
          </Link>
          <Link
            to="/#library"
            className="rounded-lg px-3 py-2 text-base text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Games
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
