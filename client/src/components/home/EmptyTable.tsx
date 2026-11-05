export function EmptyTable() {
  return (
    <figure className="mx-auto w-full max-w-md">
      <div className="rounded-[1.75rem] border bg-card p-4 sm:p-5">
        <div className="relative aspect-[5/4] overflow-hidden rounded-[1.25rem] bg-felt text-on-felt">
          <div className="absolute inset-8 rounded-full border border-dashed border-on-felt/30" />
          <span className="absolute top-5 left-1/2 size-3 -translate-x-1/2 rounded-full bg-foam" />
          <span className="absolute bottom-12 left-1/2 size-3 -translate-x-1/2 rounded-full bg-brass" />
          <span className="absolute top-1/2 left-5 size-3 -translate-y-1/2 rounded-full bg-on-felt/80" />
          <span className="absolute top-1/2 right-5 size-3 -translate-y-1/2 rounded-full bg-on-felt/80" />
          <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 gap-2">
            <div className="h-16 w-11 -rotate-6 rounded-md bg-on-felt/90" />
            <div className="h-16 w-11 rotate-6 rounded-md bg-brass" />
          </div>
          <p className="absolute right-0 bottom-3 left-0 text-center text-sm text-on-felt/85">
            No room yet
          </p>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-sm leading-relaxed text-muted-foreground">
        A preview of the table. Nobody is seated, because rooms are not open yet.
      </figcaption>
    </figure>
  );
}
