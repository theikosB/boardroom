export function Mark() {
  return (
    <svg viewBox="0 0 32 32" className="size-9 shrink-0" aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <rect
        x="8"
        y="9"
        width="16"
        height="14"
        rx="2"
        className="stroke-primary-foreground"
        fill="none"
        strokeWidth="1.6"
      />
      <circle cx="13" cy="16" r="1.4" className="fill-primary-foreground" />
      <circle cx="19" cy="16" r="1.4" className="fill-primary-foreground" />
    </svg>
  );
}
