import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import { ShieldAlert } from 'lucide-react';
import { Link } from 'wouter';
import {
  getListEditorialDraftsQueryKey,
  useListEditorialDrafts,
} from '@workspace/api-client-react';
import {
  EDITORIAL_ACCESS_DENIED_EVENT,
  isAccessError,
} from '@/lib/access-utils';
import { EditorialAccessDenied } from '@/components/editorial-access-denied';
import { useQueryClient } from '@tanstack/react-query';

export function EditorialAuthGuard({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const browserTestAuth = import.meta.env.VITE_BROWSER_TEST_AUTH === 'true';
  const authIsLoaded = browserTestAuth || isLoaded;
  const authIsSignedIn = browserTestAuth || Boolean(isSignedIn);
  const queryClient = useQueryClient();
  const [accessDeniedStatus, setAccessDeniedStatus] = useState<number | null>(null);
  const {
    error: accessError,
    isFetchedAfterMount,
  } = useListEditorialDrafts({
    query: {
      queryKey: getListEditorialDraftsQueryKey(),
      enabled: authIsLoaded && authIsSignedIn && accessDeniedStatus === null,
      refetchInterval: Number(
        import.meta.env.VITE_EDITORIAL_WATCHDOG_INTERVAL_MS ?? 30_000,
      ),
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
      retry: false,
    },
  });

  useEffect(() => {
    if (isAccessError(accessError)) {
      setAccessDeniedStatus(accessError.status);
    }
  }, [accessError]);

  useEffect(() => {
    const handleAccessDenied = (event: Event) => {
      const status = (event as CustomEvent<{ status?: number }>).detail?.status;
      if (status === 401 || status === 403) setAccessDeniedStatus(status);
    };
    window.addEventListener(EDITORIAL_ACCESS_DENIED_EVENT, handleAccessDenied);
    return () => {
      window.removeEventListener(EDITORIAL_ACCESS_DENIED_EVENT, handleAccessDenied);
    };
  }, []);

  useEffect(() => {
    if (accessDeniedStatus === null) return;

    const privateEditorialQuery = (query: { queryKey: readonly unknown[] }) => {
      const queryKey = query.queryKey[0];
      return (
        typeof queryKey === 'string' &&
        queryKey.startsWith('/api/editorial/admin')
      );
    };

    void queryClient
      .cancelQueries({ predicate: privateEditorialQuery })
      .then(() => {
        queryClient.removeQueries({ predicate: privateEditorialQuery });
      });
  }, [accessDeniedStatus, queryClient]);

  if (!authIsLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground animate-pulse">Loading desk...</span>
      </div>
    );
  }

  if (!authIsSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 py-16 text-foreground">
        <div className="w-full max-w-md border border-border bg-card p-7 shadow-xl md:p-10">
          <div className="mb-8 flex size-12 items-center justify-center border border-accent/30 bg-accent/10 text-accent">
            <ShieldAlert className="size-5" aria-hidden="true" />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
            Authorized staff only
          </p>
          <h1 className="mt-3 font-display text-3xl md:text-4xl">
            Editorial Desk
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Sign in with an authorized Birch Reserve staff account to access the editorial workspace.
          </p>
          <div className="mt-8">
            <Link href="/sign-in?redirect_url=/editorial" className="inline-flex h-11 w-full items-center justify-center bg-accent text-accent-foreground hover:bg-accent/90 font-medium transition-colors">
              Sign in to access
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const deniedStatus =
    accessDeniedStatus ?? (isAccessError(accessError) ? accessError.status : null);

  if (deniedStatus) {
    return <EditorialAccessDenied errorStatus={deniedStatus} />;
  }

  if (!isFetchedAfterMount) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="animate-pulse text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Verifying editorial access...
        </span>
      </div>
    );
  }

  return <>{children}</>;
}
