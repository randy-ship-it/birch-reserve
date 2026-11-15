import { Link } from 'wouter';

export default function NotFound() {
  return (
    <div className="flex min-h-[80vh] w-full items-center justify-center bg-background text-foreground">
      <div className="mx-6 flex w-full max-w-md flex-col items-center border border-foreground/15 bg-background p-10 text-center">
        <h1 className="font-display text-3xl tracking-tight text-foreground">
          Page not found
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          That page is not on Birch Reserve.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex h-12 items-center justify-center bg-foreground px-8 font-semibold text-background transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
