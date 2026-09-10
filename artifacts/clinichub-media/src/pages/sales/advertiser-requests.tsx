import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListAdvertiserIntakesQueryKey,
  useListAdvertiserIntakes,
  useUpdateAdvertiserIntakeReviewStatus,
  type AdvertiserIntakeQueueItem,
  type AdvertiserIntakeQueueItemReviewStatus,
} from '@workspace/api-client-react';
import {
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Filter,
  LockKeyhole,
  LogOut,
  Search,
  ShieldCheck,
  XCircle,
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
import { cn } from '@/lib/utils';
import { useAuth, useUser, useClerk } from '@clerk/react';
import { Link } from 'wouter';
import { SalesNav } from '@/components/sales-nav';

type QueueStatus = AdvertiserIntakeQueueItemReviewStatus;
type QueueStatusFilter = QueueStatus | 'all';

const STATUS_ORDER: Record<QueueStatus, number> = {
  new: 0,
  reviewed: 1,
  closed: 2,
};

const LABELS: Record<string, string> = {
  online_product: 'Online product',
  online_service: 'Online service',
  wellness_audience: 'Wellness audience',
  other: 'Other',
  interested: 'Interested now',
  learning: 'Learning first',
  not_now: 'Not now',
  individual: 'Individual',
  small_business: 'Small business',
  enterprise: 'Enterprise',
  local: 'Local',
  regional: 'Regional',
  national: 'National',
  international: 'International',
  performance: 'Performance',
  display: 'Display',
  both: 'Performance + display',
  guidance: 'Guidance requested',
  guide: 'Birch Guide',
  site_form: 'Site form',
};

const submittedAtFormatter = new Intl.DateTimeFormat('en-CA', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function label(value: string | null): string {
  if (!value) return 'Not provided';
  return LABELS[value] ?? value.replaceAll('_', ' ');
}

function isAccessError(error: unknown): error is { status: 401 | 403 } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error.status === 401 || error.status === 403)
  );
}

export default function AdvertiserRequests() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();

  const accessEpochRef = useRef(crypto.randomUUID());
  const pendingUpdateEpochsRef = useRef(new Map<string, string>());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<QueueStatusFilter>('all');
  const [mutationAccessError, setMutationAccessError] = useState<
    { status: 401 | 403 } | undefined
  >();

  const privateQueryBaseKey = useMemo(
    () => getListAdvertiserIntakesQueryKey(),
    [],
  );
  const privateQueryKey = useMemo(
    () => [...privateQueryBaseKey, user?.id ?? 'signed-out'],
    [privateQueryBaseKey, user?.id],
  );

  const clearPrivateState = () => {
    accessEpochRef.current = crypto.randomUUID();
    pendingUpdateEpochsRef.current.clear();
    updateStatus.reset();
    void queryClient
      .cancelQueries({ queryKey: privateQueryBaseKey })
      .finally(() => {
        queryClient.removeQueries({ queryKey: privateQueryBaseKey });
      });
    queryClient.removeQueries({ queryKey: privateQueryBaseKey });
  };

  const queue = useListAdvertiserIntakes({
    query: {
      enabled: isLoaded && isSignedIn,
      queryKey: privateQueryKey,
      staleTime: 0,
      gcTime: 0,
      retry: false, // Don't retry on 401/403
    },
  });

  const updateStatus = useUpdateAdvertiserIntakeReviewStatus({
    mutation: {
      gcTime: 0,
      onSuccess: (updated, variables) => {
        if (
          pendingUpdateEpochsRef.current.get(variables.intakeId) !==
          accessEpochRef.current
        ) {
          queryClient.removeQueries({ queryKey: privateQueryBaseKey });
          return;
        }
        queryClient.setQueryData<AdvertiserIntakeQueueItem[]>(
          privateQueryKey,
          (current) =>
            current?.map((item) =>
              item.id === updated.id
                ? {
                    ...item,
                    reviewStatus: updated.reviewStatus,
                    lastReviewedBy: updated.reviewedBy,
                    lastReviewedAt: updated.reviewedAt,
                  }
                : item,
            ),
        );
        toast({
          title: 'Request updated',
          description: `Marked the request as ${updated.reviewStatus}.`,
        });
      },
      onError: (error) => {
        if (isAccessError(error)) {
          setMutationAccessError({ status: error.status });
          clearPrivateState();
          return;
        }
        toast({
          title: 'Update failed',
          description: 'The review status was not changed. Recheck access and try again.',
          variant: 'destructive',
        });
      },
      onSettled: (_data, _error, variables) => {
        pendingUpdateEpochsRef.current.delete(variables.intakeId);
      },
    },
  });

  useEffect(() => {
    document.title = 'Birch Reserve | Sales Request Queue';
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = description?.content;
    if (description) {
      description.content = 'Private Birch Reserve advertising request queue for authorized sales staff.';
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
    accessEpochRef.current = crypto.randomUUID();
  }, [user?.id]);

  const requests = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    return [...(queue.data ?? [])]
      .sort(
        (left, right) =>
          STATUS_ORDER[left.reviewStatus] - STATUS_ORDER[right.reviewStatus] ||
          Date.parse(right.createdAt) - Date.parse(left.createdAt),
      )
      .filter((request) => {
        if (
          statusFilter !== 'all' &&
          request.reviewStatus !== statusFilter
        ) {
          return false;
        }
        if (!normalizedSearch) return true;

        return [
          request.email,
          request.visitorType,
          request.advertisingIntent,
          request.advertiserSize,
          request.operatingScope,
          request.adInterest,
          request.source,
        ].some((value) =>
          value?.toLowerCase().includes(normalizedSearch),
        );
      });
  }, [queue.data, searchQuery, statusFilter]);

  const statusCounts = useMemo(
    () => ({
      new: queue.data?.filter((item) => item.reviewStatus === 'new').length ?? 0,
      reviewed:
        queue.data?.filter((item) => item.reviewStatus === 'reviewed').length ??
        0,
      closed:
        queue.data?.filter((item) => item.reviewStatus === 'closed').length ??
        0,
    }),
    [queue.data],
  );

  const handleSignOut = () => {
    clearPrivateState();
    void signOut({
      redirectUrl: import.meta.env.BASE_URL.replace(/\/$/, '') || '/',
    });
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

  const accessError =
    mutationAccessError ??
    (queue.isError && isAccessError(queue.error)
      ? { status: queue.error.status }
      : undefined);

  const hasAccessError = Boolean(accessError);

  if (hasAccessError) {
    const isExpired = accessError?.status === 401;

    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-[#101c25] px-6 py-16 text-[#f4f0e8]">
        <div className="w-full max-w-md border border-white/10 bg-[#0b151c] p-7 shadow-2xl shadow-black/20 md:p-10">
          <div className="mb-8 flex size-12 items-center justify-center border border-[#e87979]/35 bg-[#e87979]/10 text-[#e87979]">
            <XCircle className="size-5" aria-hidden="true" />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#e87979]">
            {isExpired ? 'Session expired' : 'Sales access denied'}
          </p>
          <h1 className="mt-3 font-display text-3xl text-white md:text-4xl">
            {isExpired ? 'Please sign in again' : 'Account unauthorized'}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-[#9cabb4]">
            {isExpired
              ? 'Your secure session has expired. Please sign in again to access the queue.'
              : `Your current account (${user?.primaryEmailAddress?.emailAddress}) is not assigned an active sales role. The queue remains locked.`}
          </p>
          <Button
            type="button"
            onClick={handleSignOut}
            className="mt-8 h-11 w-full rounded-none bg-[#e87979] text-[#1c0909] hover:bg-[#ff8f8f]"
          >
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  if (queue.isPending) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-[#101c25] text-[#8fd6a5]">
        <span className="text-xs uppercase tracking-[0.2em] animate-pulse">Fetching queue...</span>
      </div>
    );
  }

  if (queue.isError) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-[#101c25] px-6 py-16 text-[#f4f0e8]">
        <div className="w-full max-w-md border border-white/10 bg-[#0b151c] p-7 md:p-10">
          <XCircle className="size-6 text-[#e87979]" aria-hidden="true" />
          <h1 className="mt-5 font-display text-3xl text-white">
            Queue unavailable
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#9cabb4]">
            The private queue could not be loaded. No contact details were
            retained by this page.
          </p>
          <Button
            type="button"
            onClick={() => void queue.refetch()}
            className="mt-7 h-11 w-full rounded-none bg-[#8fd6a5] text-[#07130d] hover:bg-[#a8e8b9]"
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-[calc(100dvh-4rem)] bg-[#101c25] text-[#f4f0e8]"
      data-testid="sales-advertiser-request-queue"
    >
      <section className="border-b border-white/10 bg-[#0b151c]">
        <div className="container mx-auto max-w-[1440px] px-6 pt-10 md:pt-14">
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end mb-8">
            <div className="max-w-2xl">
              <div className="mb-5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8fd6a5]">
                <ShieldCheck className="size-4" aria-hidden="true" />
                Private sales operations
              </div>
              <h1 className="font-display text-4xl tracking-tight text-white md:text-6xl">
                Advertising requests
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#aab7bf] md:text-base">
                Review contact details and bounded intake selections. Birch
                Guide questions and transcripts are never stored and cannot
                appear here.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <QueueMetric label="New" value={statusCounts.new} accent />
              <QueueMetric label="Reviewed" value={statusCounts.reviewed} />
              <QueueMetric label="Closed" value={statusCounts.closed} />
              <div className="flex flex-col gap-2">
                <span className="text-right text-[10px] uppercase tracking-[0.16em] text-[#70818b]">
                  {user?.primaryEmailAddress?.emailAddress}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSignOut}
                  className="h-10 rounded-none border-white/15 bg-transparent text-[#f4f0e8] hover:border-[#e87979] hover:bg-white/5 hover:text-[#e87979]"
                  data-testid="button-clear-sales-access"
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

      <section className="container mx-auto max-w-[1440px] px-6 py-8 md:py-10">
        <div className="mb-6 flex flex-col gap-3 md:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Search advertiser requests</span>
            <Search
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#788791]"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search email, intent, size, path, or source"
              className="h-11 rounded-none border-white/15 bg-[#14232d] pl-10 text-[#f4f0e8] placeholder:text-[#788791] focus-visible:ring-[#8fd6a5]"
              data-testid="input-search-advertiser-requests"
            />
          </label>
          <label className="relative min-w-56">
            <span className="sr-only">Filter by review status</span>
            <Filter
              className="absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-[#788791]"
              aria-hidden="true"
            />
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as QueueStatusFilter)
              }
              className="h-11 w-full appearance-none rounded-none border border-white/15 bg-[#14232d] pl-10 pr-9 text-sm text-[#f4f0e8] outline-none focus:border-[#8fd6a5] focus:ring-1 focus:ring-[#8fd6a5]"
              data-testid="select-advertiser-request-filter"
            >
              <option value="all">All statuses</option>
              <option value="new">New</option>
              <option value="reviewed">Reviewed</option>
              <option value="closed">Closed</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#788791]"
              aria-hidden="true"
            />
          </label>
        </div>

        <div className="border border-white/10 bg-[#0b151c]">
          <Table>
            <TableHeader className="bg-white/[0.035]">
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="h-12 px-5 text-[10px] uppercase tracking-[0.16em] text-[#82929c]">
                  Contact and submitted
                </TableHead>
                <TableHead className="h-12 px-5 text-[10px] uppercase tracking-[0.16em] text-[#82929c]">
                  Visitor and source
                </TableHead>
                <TableHead className="h-12 px-5 text-[10px] uppercase tracking-[0.16em] text-[#82929c]">
                  Intent and path
                </TableHead>
                <TableHead className="h-12 px-5 text-[10px] uppercase tracking-[0.16em] text-[#82929c]">
                  Size and scope
                </TableHead>
                <TableHead className="h-12 px-5 text-right text-[10px] uppercase tracking-[0.16em] text-[#82929c]">
                  Review status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow className="border-0 hover:bg-transparent">
                  <TableCell
                    colSpan={5}
                    className="h-44 px-5 text-center text-sm text-[#82929c]"
                  >
                    No requests match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((request) => (
                  <TableRow
                    key={request.id}
                    className="border-white/10 hover:bg-white/[0.025]"
                  >
                    <TableCell className="min-w-64 px-5 py-5 align-top">
                      <a
                        href={`mailto:${request.email}`}
                        className="font-medium text-white underline decoration-white/20 underline-offset-4 transition-colors hover:text-[#8fd6a5]"
                      >
                        {request.email}
                      </a>
                      <p className="mt-2 text-xs text-[#82929c]">
                        {submittedAtFormatter.format(
                          new Date(request.createdAt),
                        )}
                      </p>
                    </TableCell>
                    <TableCell className="min-w-44 px-5 py-5 align-top">
                      <p className="font-medium text-[#edf1ee]">
                        {label(request.visitorType)}
                      </p>
                      <p className="mt-2 text-xs text-[#82929c]">
                        {label(request.source)}
                      </p>
                    </TableCell>
                    <TableCell className="min-w-48 px-5 py-5 align-top">
                      <p className="font-medium text-[#edf1ee]">
                        {label(request.advertisingIntent)}
                      </p>
                      <p className="mt-2 text-xs text-[#82929c]">
                        {label(request.adInterest)}
                      </p>
                    </TableCell>
                    <TableCell className="min-w-44 px-5 py-5 align-top">
                      <p className="font-medium text-[#edf1ee]">
                        {label(request.advertiserSize)}
                      </p>
                      <p className="mt-2 text-xs text-[#82929c]">
                        {label(request.operatingScope)}
                      </p>
                    </TableCell>
                    <TableCell className="min-w-48 px-5 py-5 align-top">
                      <div className="flex flex-col items-end gap-2">
                        <StatusControl
                          request={request}
                          isUpdating={
                            updateStatus.isPending &&
                            updateStatus.variables?.intakeId === request.id
                          }
                          onChange={(reviewStatus) => {
                             const accessEpoch = accessEpochRef.current;
                             pendingUpdateEpochsRef.current.set(
                               request.id,
                               accessEpoch,
                             );
                            updateStatus.mutate({
                              intakeId: request.id,
                              data: { reviewStatus },
                             });
                          }}
                        />
                        {request.lastReviewedBy && request.lastReviewedAt ? (
                          <div className="text-right">
                            <p className="text-[10px] text-[#70818b] truncate max-w-40">
                              By {request.lastReviewedBy}
                            </p>
                            <p className="text-[10px] text-[#70818b]">
                              {submittedAtFormatter.format(new Date(request.lastReviewedAt))}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-[#70818b]">
          Private contact details are returned only after server-side access
          validation and are not cached by the API.
        </p>
      </section>
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
          Authorized staff only
        </p>
        <h1 className="mt-3 font-display text-3xl text-white md:text-4xl">
          Sales request queue
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-[#9cabb4]">
          Sign in with an authorized Birch Reserve sales account to review advertising requests and contact details.
        </p>
        <div className="mt-8">
          <Link href="/sign-in" className="inline-flex h-11 w-full items-center justify-center rounded-none bg-[#8fd6a5] text-[#07130d] hover:bg-[#a8e8b9] font-medium transition-colors" data-testid="button-unlock-sales-queue">
            Sign in to access
          </Link>
        </div>
      </div>
    </div>
  );
}

function QueueMetric({
  label: metricLabel,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="min-w-16">
      <div
        className={cn(
          'font-display text-3xl',
          accent ? 'text-[#8fd6a5]' : 'text-white',
        )}
      >
        {value}
      </div>
      <div className="mt-1 text-[9px] uppercase tracking-[0.16em] text-[#82929c]">
        {metricLabel}
      </div>
    </div>
  );
}

function StatusControl({
  request,
  isUpdating,
  onChange,
}: {
  request: AdvertiserIntakeQueueItem;
  isUpdating: boolean;
  onChange: (status: QueueStatus) => void;
}) {
  const Icon =
    request.reviewStatus === 'new'
      ? CircleDot
      : request.reviewStatus === 'reviewed'
        ? CheckCircle2
        : XCircle;

  return (
    <label
      className={cn(
        'relative inline-flex min-w-36 items-center gap-2 border px-3 py-2',
        request.reviewStatus === 'new' &&
          'border-[#8fd6a5]/30 bg-[#8fd6a5]/10 text-[#a8e8b9]',
        request.reviewStatus === 'reviewed' &&
          'border-[#9bbbea]/30 bg-[#9bbbea]/10 text-[#bfd2f0]',
        request.reviewStatus === 'closed' &&
          'border-white/10 bg-white/5 text-[#9cabb4]',
        isUpdating && 'opacity-60',
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <span className="text-xs font-medium">
        {isUpdating
          ? 'Updating…'
          : request.reviewStatus[0]!.toUpperCase() +
            request.reviewStatus.slice(1)}
      </span>
      <ChevronDown className="ml-auto size-3.5" aria-hidden="true" />
      <select
        aria-label={`Review status for ${request.email}`}
        value={request.reviewStatus}
        onChange={(event) => onChange(event.target.value as QueueStatus)}
        disabled={isUpdating}
        className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-wait"
        data-testid={`select-advertiser-request-status-${request.id}`}
      >
        <option value="new">New</option>
        <option value="reviewed">Reviewed</option>
        <option value="closed">Closed</option>
      </select>
    </label>
  );
}