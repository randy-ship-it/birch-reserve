import { LockKeyhole, LogOut, ShieldAlert, XCircle } from 'lucide-react';
import { useClerk } from '@clerk/react';
import { Button } from '@/components/ui/button';

export function EditorialAccessDenied({ errorStatus }: { errorStatus?: number }) {
  const { signOut } = useClerk();
  const isExpired = errorStatus === 401;

  const handleSignOut = () => {
    signOut({ redirectUrl: '/' });
  };

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="w-full max-w-md border border-border bg-card p-7 shadow-xl md:p-10">
        <div className="mb-8 flex size-12 items-center justify-center border border-destructive/30 bg-destructive/10 text-destructive">
          {isExpired ? (
            <XCircle className="size-5" aria-hidden="true" />
          ) : (
            <LockKeyhole className="size-5" aria-hidden="true" />
          )}
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-destructive">
          {isExpired ? 'Session expired' : 'Access denied'}
        </p>
        <h1 className="mt-3 font-display text-3xl md:text-4xl">
          {isExpired ? 'Please sign in again' : 'Unauthorized'}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {isExpired
            ? 'Your secure session has expired. Please sign in again to access the editorial desk.'
            : 'Your account is not assigned an active editorial staff role. The workspace remains locked.'}
        </p>
        <Button
          type="button"
          onClick={handleSignOut}
          className="mt-8 h-11 w-full rounded-none bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          <LogOut className="mr-2 size-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}
