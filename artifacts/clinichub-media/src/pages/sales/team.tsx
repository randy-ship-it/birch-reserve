import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListSalesStaffAccessQueryKey,
  useListSalesStaffAccess,
  useGrantSalesStaffAccess,
  useRevokeSalesStaffAccess,
  type SalesStaffAccessItem,
} from '@workspace/api-client-react';
import {
  LogOut,
  LockKeyhole,
  XCircle,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useUser, useClerk } from '@clerk/react';
import { Link } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SalesNav } from '@/components/sales-nav';

function isAccessError(error: unknown): error is { status: 401 | 403 } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error.status === 401 || error.status === 403)
  );
}

const grantSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  displayName: z.string().min(2, { message: "Name must be at least 2 characters." }).max(120),
});
type GrantFormValues = z.infer<typeof grantSchema>;

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export default function TeamAccess() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();

  const accessEpochRef = useRef(crypto.randomUUID());
  const pendingGrantEpochRef = useRef<string | null>(null);
  const pendingUpdateEpochsRef = useRef(new Map<string, string>());
  const [privateAccessEnabled, setPrivateAccessEnabled] = useState(true);
  const [mutationAccessError, setMutationAccessError] = useState<{ status: 401 | 403 } | undefined>();
  const [revokingItem, setRevokingItem] = useState<SalesStaffAccessItem | null>(null);

  const form = useForm<GrantFormValues>({
    resolver: zodResolver(grantSchema),
    defaultValues: { email: '', displayName: '' },
  });

  const privateQueryBaseKey = useMemo(() => getListSalesStaffAccessQueryKey(), []);
  const privateQueryKey = useMemo(() => [...privateQueryBaseKey, user?.id ?? 'signed-out'], [privateQueryBaseKey, user?.id]);

  const grantAccess = useGrantSalesStaffAccess({
    mutation: {
      gcTime: 0,
      onSuccess: (newItem) => {
        if (pendingGrantEpochRef.current !== accessEpochRef.current) {
          queryClient.removeQueries({ queryKey: privateQueryBaseKey });
          return;
        }
        queryClient.setQueryData<SalesStaffAccessItem[]>(
          privateQueryKey,
          (current) => {
            if (!current) return [newItem];
            const existingIndex = current.findIndex(
              (item) => item.id === newItem.id,
            );
            if (existingIndex === -1) return [newItem, ...current];
            return current.map((item) =>
              item.id === newItem.id ? newItem : item,
            );
          },
        );
        toast({ title: 'Access granted', description: `${newItem.displayName} can now access the sales workspace.` });
        form.reset();
      },
      onError: (error) => {
        if (isAccessError(error)) {
          setMutationAccessError({ status: error.status });
          clearPrivateState();
          return;
        }
        toast({
          title: 'Failed to grant access',
          description: 'The access could not be granted. Please check permissions.',
          variant: 'destructive',
        });
      },
      onSettled: () => {
        pendingGrantEpochRef.current = null;
      },
    },
  });

  const revokeAccess = useRevokeSalesStaffAccess({
    mutation: {
      gcTime: 0,
      onSuccess: (updatedItem, variables) => {
        if (pendingUpdateEpochsRef.current.get(variables.staffAccessId) !== accessEpochRef.current) {
          queryClient.removeQueries({ queryKey: privateQueryBaseKey });
          return;
        }
        queryClient.setQueryData<SalesStaffAccessItem[]>(
          privateQueryKey,
          (current) => current?.map(item => item.id === updatedItem.id ? updatedItem : item)
        );
        toast({ title: 'Access revoked', description: `${updatedItem.displayName} has been removed from the sales workspace.` });
      },
      onError: (error) => {
        if (isAccessError(error)) {
          setMutationAccessError({ status: error.status });
          clearPrivateState();
          return;
        }
        toast({
          title: 'Failed to revoke access',
          description: 'The access could not be revoked. Please check permissions.',
          variant: 'destructive',
        });
      },
      onSettled: (_data, _error, variables) => {
        pendingUpdateEpochsRef.current.delete(variables.staffAccessId);
        setRevokingItem(null);
      },
    },
  });

  const clearPrivateState = () => {
    setPrivateAccessEnabled(false);
    accessEpochRef.current = crypto.randomUUID();
    pendingGrantEpochRef.current = null;
    pendingUpdateEpochsRef.current.clear();
    setRevokingItem(null);
    form.reset();
    grantAccess.reset();
    revokeAccess.reset();
    void queryClient
      .cancelQueries({ queryKey: privateQueryBaseKey })
      .finally(() => {
        queryClient.removeQueries({ queryKey: privateQueryBaseKey });
      });
    queryClient.removeQueries({ queryKey: privateQueryBaseKey });
  };

  const roster = useListSalesStaffAccess({
    query: {
      enabled: isLoaded && isSignedIn && privateAccessEnabled,
      queryKey: privateQueryKey,
      staleTime: 0,
      gcTime: 0,
      retry: false,
    },
  });

  useEffect(() => {
    document.title = 'Birch Reserve | Team Access';
    const description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    const previousDescription = description?.content;
    if (description) {
      description.content =
        'Private Birch Reserve sales teammate access roster for authorized sales managers.';
    }
    return () => {
      document.title = 'Birch Reserve | Private Distribution Marketplace';
      if (description && previousDescription) {
        description.content = previousDescription;
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      accessEpochRef.current = crypto.randomUUID();
      void queryClient
        .cancelQueries({ queryKey: privateQueryBaseKey })
        .finally(() => {
          queryClient.removeQueries({ queryKey: privateQueryBaseKey });
        });
    };
  }, [privateQueryBaseKey, queryClient]);

  useEffect(() => {
    setMutationAccessError(undefined);
    setPrivateAccessEnabled(true);
    accessEpochRef.current = crypto.randomUUID();
    pendingGrantEpochRef.current = null;
    pendingUpdateEpochsRef.current.clear();
    setRevokingItem(null);
    form.reset();
  }, [form, user?.id]);

  useEffect(() => {
    if (!roster.isError || !isAccessError(roster.error)) {
      return;
    }
    setMutationAccessError({ status: roster.error.status });
    setPrivateAccessEnabled(false);
    accessEpochRef.current = crypto.randomUUID();
    pendingGrantEpochRef.current = null;
    pendingUpdateEpochsRef.current.clear();
    setRevokingItem(null);
    form.reset();
    void queryClient
      .cancelQueries({ queryKey: privateQueryBaseKey })
      .finally(() => {
        queryClient.removeQueries({ queryKey: privateQueryBaseKey });
      });
  }, [
    form,
    privateQueryBaseKey,
    queryClient,
    roster.error,
    roster.isError,
  ]);

  const items = useMemo(() => {
    return [...(roster.data ?? [])].sort(
      (a, b) => {
        if (a.accessStatus === 'active' && b.accessStatus !== 'active') return -1;
        if (a.accessStatus !== 'active' && b.accessStatus === 'active') return 1;
        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      }
    );
  }, [roster.data]);

  const activeCount = useMemo(() => items.filter(i => i.accessStatus === 'active').length, [items]);

  const handleSignOut = () => {
    clearPrivateState();
    void signOut({
      redirectUrl: import.meta.env.BASE_URL.replace(/\/$/, '') || '/',
    });
  };

  const onSubmit = (values: GrantFormValues) => {
    pendingGrantEpochRef.current = accessEpochRef.current;
    grantAccess.mutate({
      data: {
        email: values.email.trim(),
        displayName: values.displayName.trim(),
      },
    });
  };

  const handleRevoke = (item: SalesStaffAccessItem) => {
    const accessEpoch = accessEpochRef.current;
    pendingUpdateEpochsRef.current.set(item.id, accessEpoch);
    revokeAccess.mutate({ staffAccessId: item.id, data: { accessStatus: 'revoked' } });
  };

  if (!isLoaded) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-[#101c25] text-[#8fd6a5]">
        <span className="text-xs uppercase tracking-[0.2em] animate-pulse">Loading access...</span>
      </div>
    );
  }

  if (!isSignedIn) {
    return <SignedOutGate />;
  }

  const accessError = mutationAccessError ?? (roster.isError && isAccessError(roster.error) ? { status: roster.error.status } : undefined);
  if (accessError) {
    const isExpired = accessError.status === 401;
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-[#101c25] px-6 py-16 text-[#f4f0e8]">
        <div className="w-full max-w-md border border-white/10 bg-[#0b151c] p-7 shadow-2xl shadow-black/20 md:p-10">
          <div className="mb-8 flex size-12 items-center justify-center border border-[#e87979]/35 bg-[#e87979]/10 text-[#e87979]">
            <XCircle className="size-5" aria-hidden="true" />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#e87979]">
            {isExpired ? 'Session expired' : 'Manager access denied'}
          </p>
          <h1 className="mt-3 font-display text-3xl text-white md:text-4xl">
            {isExpired ? 'Please sign in again' : 'Account unauthorized'}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-[#9cabb4]">
            {isExpired
              ? 'Your secure session has expired. Please sign in again to access the roster.'
              : `Your current account (${user?.primaryEmailAddress?.emailAddress}) is not assigned an active manager role. The roster remains locked.`}
          </p>
          <Button
            type="button"
            onClick={handleSignOut}
            className="mt-8 h-11 w-full rounded-none bg-[#e87979] text-[#1c0909] hover:bg-[#ff8f8f]"
            data-testid="button-sign-out-manager-access-error"
          >
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  if (roster.isPending) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-[#101c25] text-[#8fd6a5]">
        <span className="text-xs uppercase tracking-[0.2em] animate-pulse">Fetching roster...</span>
      </div>
    );
  }

  if (roster.isError) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-[#101c25] px-6 py-16 text-[#f4f0e8]">
        <div className="w-full max-w-md border border-white/10 bg-[#0b151c] p-7 md:p-10">
          <XCircle className="size-6 text-[#e87979]" aria-hidden="true" />
          <h1 className="mt-5 font-display text-3xl text-white">Roster unavailable</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#9cabb4]">
            The private roster could not be loaded. No contact details were retained by this page.
          </p>
          <Button
            type="button"
            onClick={() => void roster.refetch()}
            className="mt-7 h-11 w-full rounded-none bg-[#8fd6a5] text-[#07130d] hover:bg-[#a8e8b9]"
              data-testid="button-retry-team-roster"
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[#101c25] text-[#f4f0e8]" data-testid="sales-team-roster">
      <section className="border-b border-white/10 bg-[#0b151c]">
        <div className="container mx-auto max-w-[1440px] px-6 pt-10 md:pt-14">
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end mb-8">
            <div className="max-w-2xl">
              <div className="mb-5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8fd6a5]">
                <Users className="size-4" aria-hidden="true" />
                Manager operations
              </div>
              <h1 className="font-display text-4xl tracking-tight text-white md:text-6xl">
                Team access
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#aab7bf] md:text-base">
                Manage authorized sales staff. Teammates must bind their assigned identity via Clerk before accessing the queue.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <div className="min-w-16">
                <div
                  className="font-display text-3xl text-[#8fd6a5]"
                  data-testid="metric-active-sales-staff"
                >
                  {activeCount}
                </div>
                <div className="mt-1 text-[9px] uppercase tracking-[0.16em] text-[#82929c]">Active</div>
              </div>
              <div className="min-w-16">
                <div
                  className="font-display text-3xl text-white"
                  data-testid="metric-total-sales-staff"
                >
                  {items.length}
                </div>
                <div className="mt-1 text-[9px] uppercase tracking-[0.16em] text-[#82929c]">Total</div>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-right text-[10px] uppercase tracking-[0.16em] text-[#70818b]">
                  {user?.primaryEmailAddress?.emailAddress}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSignOut}
                  className="h-10 rounded-none border-white/15 bg-transparent text-[#f4f0e8] hover:border-[#e87979] hover:bg-white/5 hover:text-[#e87979]"
                  data-testid="button-clear-manager-access"
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  Sign out
                </Button>
              </div>
            </div>
          </div>
          <SalesNav />
        </div>
      </section>

      <section className="container mx-auto max-w-[1440px] px-6 py-8 md:py-10 grid gap-8 lg:grid-cols-[1fr_320px] items-start">
        
        <div className="border border-white/10 bg-[#0b151c] order-2 lg:order-1">
          <Table>
            <TableHeader className="bg-white/[0.035]">
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="h-12 px-5 text-[10px] uppercase tracking-[0.16em] text-[#82929c]">Teammate</TableHead>
                <TableHead className="h-12 px-5 text-[10px] uppercase tracking-[0.16em] text-[#82929c]">Status & Identity</TableHead>
                <TableHead className="h-12 px-5 text-[10px] uppercase tracking-[0.16em] text-[#82929c]">Timeline</TableHead>
                <TableHead className="h-12 px-5 text-right text-[10px] uppercase tracking-[0.16em] text-[#82929c]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow className="border-0 hover:bg-transparent">
                  <TableCell colSpan={4} className="h-44 px-5 text-center text-sm text-[#82929c]">
                    No sales teammates configured.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow
                    key={item.id}
                    className="border-white/10 hover:bg-white/[0.025]"
                    data-testid={`row-sales-staff-${item.id}`}
                  >
                    <TableCell className="px-5 py-5 align-top">
                      <p className="font-medium text-white">{item.displayName}</p>
                      <p className="mt-2 text-xs text-[#82929c]">{item.email}</p>
                    </TableCell>
                    <TableCell className="px-5 py-5 align-top">
                      <div className="flex items-center gap-2">
                        {item.accessStatus === 'active' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8fd6a5]">
                            <CheckCircle2 className="size-3.5" aria-hidden="true" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#e87979]">
                            <XCircle className="size-3.5" aria-hidden="true" /> Revoked
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-[#82929c]">
                        {item.identityBound ? 'Identity bound' : 'Awaiting sign-in'}
                      </p>
                    </TableCell>
                    <TableCell className="px-5 py-5 align-top">
                      <p className="text-xs text-[#edf1ee]">
                        Granted {dateFormatter.format(new Date(item.createdAt))}
                      </p>
                      {item.accessStatus === 'revoked' && item.revokedAt && (
                        <p className="mt-2 text-xs text-[#e87979]">
                          Revoked {dateFormatter.format(new Date(item.revokedAt))}
                        </p>
                      )}
                      {item.lastChangedBy && item.lastChangedAt && (
                        <p
                          className="mt-2 max-w-48 text-[10px] text-[#70818b]"
                          data-testid={`text-last-access-change-${item.id}`}
                        >
                          By {item.lastChangedBy},{' '}
                          {dateFormatter.format(new Date(item.lastChangedAt))}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="px-5 py-5 align-top text-right">
                      {item.accessStatus === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-none border-white/15 bg-transparent text-[#e87979] hover:bg-[#e87979]/10 hover:text-[#ff8f8f] hover:border-[#e87979]/30"
                          onClick={() => setRevokingItem(item)}
                          disabled={revokeAccess.isPending && revokeAccess.variables?.staffAccessId === item.id}
                          data-testid={`button-revoke-${item.id}`}
                        >
                          Revoke
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="border border-white/10 bg-[#0b151c] p-6 order-1 lg:order-2">
          <h2 className="font-display text-2xl text-white mb-6">Grant Access</h2>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-[#c1cbd1]">Display Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g. Jane Doe" 
                        className="h-11 rounded-none border-white/15 bg-[#14232d] text-[#f4f0e8] focus-visible:ring-[#8fd6a5]"
                        data-testid="input-grant-name"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage className="text-[#e87979] text-xs" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-[#c1cbd1]">Email Address</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="jane@example.com" 
                        type="email"
                        className="h-11 rounded-none border-white/15 bg-[#14232d] text-[#f4f0e8] focus-visible:ring-[#8fd6a5]"
                        data-testid="input-grant-email"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage className="text-[#e87979] text-xs" />
                  </FormItem>
                )}
              />
              <Button 
                type="submit" 
                disabled={grantAccess.isPending}
                className="w-full h-11 rounded-none bg-[#8fd6a5] text-[#07130d] hover:bg-[#a8e8b9] font-medium mt-2"
                data-testid="button-grant-access"
              >
                {grantAccess.isPending ? 'Granting...' : 'Grant Access'}
              </Button>
            </form>
          </Form>
        </div>

      </section>

      <AlertDialog open={!!revokingItem} onOpenChange={(open) => !open && setRevokingItem(null)}>
        <AlertDialogContent className="bg-[#0b151c] border-white/10 text-[#f4f0e8] rounded-none sm:rounded-none p-0 overflow-hidden max-w-[400px]">
          <div className="p-6 md:p-8">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-display text-3xl text-white font-normal">Revoke access</AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-[#9cabb4] mt-3">
                Are you sure you want to revoke sales workspace access for <strong className="text-[#f4f0e8] font-medium">{revokingItem?.displayName}</strong>? 
                 Their next private request will be denied immediately.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-8 gap-3 sm:space-x-0">
              <AlertDialogCancel 
                className="h-11 rounded-none border border-white/15 bg-transparent hover:bg-white/5 text-[#f4f0e8] sm:mt-0 flex-1"
                data-testid="button-cancel-revoke"
                disabled={revokeAccess.isPending}
              >
                Cancel
              </AlertDialogCancel>
              <Button 
                variant="destructive" 
                className="h-11 rounded-none bg-[#e87979] text-[#1c0909] hover:bg-[#ff8f8f] flex-1 font-medium"
                data-testid="button-confirm-revoke"
                onClick={() => {
                  if (revokingItem) handleRevoke(revokingItem);
                }}
                disabled={revokeAccess.isPending}
              >
                {revokeAccess.isPending ? 'Revoking...' : 'Revoke access'}
              </Button>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SignedOutGate() {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-[#101c25] px-6 py-16 text-[#f4f0e8]">
      <div className="w-full max-w-md border border-white/10 bg-[#0b151c] p-7 shadow-2xl shadow-black/20 md:p-10">
        <div className="mb-8 flex size-12 items-center justify-center border border-[#8fd6a5]/35 bg-[#8fd6a5]/10 text-[#8fd6a5]">
          <LockKeyhole className="size-5" aria-hidden="true" />
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8fd6a5]">
          Authorized managers only
        </p>
        <h1 className="mt-3 font-display text-3xl text-white md:text-4xl">
          Team Access
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-[#9cabb4]">
          Sign in with an authorized Birch Reserve manager account to configure sales team access.
        </p>
        <div className="mt-8">
          <Link href="/sign-in" className="inline-flex h-11 w-full items-center justify-center rounded-none bg-[#8fd6a5] text-[#07130d] hover:bg-[#a8e8b9] font-medium transition-colors" data-testid="button-unlock-team-access">
            Sign in to access
          </Link>
        </div>
      </div>
    </div>
  );
}
