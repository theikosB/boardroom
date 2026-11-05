const STEPS = [
  {
    number: "1",
    title: "Open a room",
    body: "The host is one of the players. If they close the laptop, the table keeps the game. The server's only job is to referee.",
  },
  {
    number: "2",
    title: "Share the code",
    body: "Friends join from their own browsers with a display name. The code is the invitation. There is no public lobby.",
  },
  {
    number: "3",
    title: "Pick a game",
    body: "The host chooses from the shelf. Play starts when that game's rules are in the app. Right now every title is still coming soon.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24">
      <div className="max-w-2xl">
        <h2 className="text-3xl sm:text-4xl">How a night will work</h2>
        <p className="mt-3 text-lg text-muted-foreground">
          Three steps, once rooms are open. This page is the front door. The rooms come next.
        </p>
      </div>
      <ol className="mt-8 grid gap-4 md:grid-cols-3">
        {STEPS.map((step) => (
          <li key={step.number} className="rounded-2xl border bg-card p-5">
            <span className="grid size-10 place-items-center rounded-full bg-primary font-heading text-lg text-primary-foreground">
              {step.number}
            </span>
            <h3 className="mt-4 text-2xl">{step.title}</h3>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
