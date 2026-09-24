import { Link, useSearch } from "wouter";
import {
  getGetSplashAdReservationStatusQueryKey,
  useCreateSplashAdCheckout,
  useGetSplashAdReservationStatus,
} from "@workspace/api-client-react";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Loader2,
  LockKeyhole,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatReserveAmount } from "@/lib/reserve-offers";
import { terminalSplashActivation } from "@/lib/splash-activation-status";

export default function SplashActivation() {
  const search = useSearch();
  const token = new URLSearchParams(search).get("token") ?? "";
  const wasCancelled = new URLSearchParams(search).get("cancelled") === "1";
  const { data, isLoading, isError } = useGetSplashAdReservationStatus(
    { token },
    {
      query: {
        queryKey: getGetSplashAdReservationStatusQueryKey({ token }),
        enabled: Boolean(token),
        retry: false,
        refetchInterval: (query) =>
          query.state.data?.paymentStatus === "checkout_created" &&
          query.state.data.status !== "expired" &&
          query.state.data.status !== "recycled"
            ? 5_000
            : false,
      },
    },
  );
  const checkout = useCreateSplashAdCheckout();

  if (!token) {
    return (
      <ActivationShell
        icon={<AlertCircle className="size-11 text-destructive" />}
        title="Missing activation link"
        description="Use the private link from your Birch Reserve follow-up email."
      />
    );
  }

  if (isLoading) {
    return (
      <ActivationShell
        icon={<Loader2 className="size-11 animate-spin text-accent" />}
        title="Opening private activation"
        description="Checking your approved Splash Ad request."
      />
    );
  }

  if (isError || !data) {
    return (
      <ActivationShell
        icon={<AlertCircle className="size-11 text-destructive" />}
        title="Activation link unavailable"
        description="This private link is invalid or no longer available. Contact Birch Reserve for assistance."
      />
    );
  }

  const openCheckout = () => {
    checkout.mutate(
      { data: { activationToken: token } },
      {
        onSuccess: ({ checkoutUrl }) => {
          window.location.assign(checkoutUrl);
        },
      },
    );
  };

  const terminal = terminalSplashActivation(data);
  if (terminal) {
    return (
      <ActivationShell
        icon={
          terminal.kind === "expired" ? (
            <AlertCircle className="size-11 text-destructive" />
          ) : (
            <CheckCircle2 className="size-11 text-accent" />
          )
        }
        title={terminal.title}
        description={terminal.description}
      />
    );
  }

  if (data.paymentStatus === "paid") {
    return (
      <ActivationShell
        icon={<CheckCircle2 className="size-11 text-accent" />}
        title="Payment received"
        description="Your Splash Ad payment has been confirmed. Creative handoff is now unlocked; Birch Reserve will send the secure creative-upload and launch-readiness instructions next."
      >
        <div className="mt-8 grid gap-3 text-left text-sm">
          <ReadinessStep complete label="Approval confirmed" />
          <ReadinessStep complete label="Payment confirmed" />
          <ReadinessStep label="Secure creative upload opens next" />
          <ReadinessStep label="Launch-readiness review" />
        </div>
      </ActivationShell>
    );
  }

  if (data.checkoutAvailable) {
    const currency = data.currency.toUpperCase();
    const formattedAmount = formatReserveAmount(data.amountCents, currency);

    return (
      <ActivationShell
        icon={<CreditCard className="size-11 text-accent" />}
        title="Approved for activation"
        description={`Your request passed private category review. Continue to Stripe’s secure checkout for the fixed ${currency} ${formattedAmount} ${data.offerName || 'Splash Ad'} offer. Payment confirms the commercial handoff; it does not guarantee a launch date until creative readiness is reviewed.`}
      >
        {wasCancelled && (
          <p className="mt-6 border border-border bg-secondary/50 p-3 text-sm text-muted-foreground">
            Checkout was cancelled. No payment was taken.
          </p>
        )}
        {checkout.isError && (
          <p className="mt-6 border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            Secure checkout is temporarily unavailable. Please try again or contact Birch Reserve.
          </p>
        )}
        <Button
          onClick={openCheckout}
          disabled={checkout.isPending}
          className="mt-8 h-12 w-full rounded-none bg-accent text-accent-foreground hover:bg-foreground hover:text-background"
        >
          {checkout.isPending ? (
            <><Loader2 className="mr-2 size-4 animate-spin" /> Opening secure checkout</>
          ) : (
            <><LockKeyhole className="mr-2 size-4" /> Pay {formattedAmount} {currency} securely</>
          )}
        </Button>
      </ActivationShell>
    );
  }

  if (data.status === "approved") {
    return (
      <ActivationShell
        icon={<CreditCard className="size-11 text-muted-foreground" />}
        title="Approval confirmed"
        description="Your request passed private category review. Birch Reserve will arrange the secure payment and creative-handoff path directly. No payment has been collected, inventory has not been reserved, and no placement is confirmed."
      />
    );
  }

  const pendingCopy =
    data.status === "rejected"
      ? "This request was not approved for this offer. No payment has been collected and no placement was created."
      : "Your request is still in private review. No payment has been collected, inventory has not been reserved, and no placement is confirmed.";
  return (
    <ActivationShell
      icon={<LockKeyhole className="size-11 text-muted-foreground" />}
      title={data.status === "rejected" ? "Request not approved" : "Review in progress"}
      description={pendingCopy}
    />
  );
}

function ReadinessStep({ complete = false, label }: { complete?: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3 border border-border bg-secondary/40 px-4 py-3">
      {complete ? <CheckCircle2 className="size-4 text-accent" /> : <UploadCloud className="size-4 text-muted-foreground" />}
      <span className={complete ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

function ActivationShell({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-h-[80vh] bg-background px-6 py-24 text-foreground">
      <div className="mx-auto flex w-full max-w-xl flex-col items-center border border-border bg-card p-10 text-center shadow-2xl">
        <div className="mb-7 flex size-20 items-center justify-center rounded-full border border-border bg-secondary">{icon}</div>
        <h1 className="font-display text-4xl italic tracking-tight">{title}</h1>
        <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{description}</p>
        {children}
        <a
          href="/kit"
          className="mt-7 text-sm font-medium text-foreground underline underline-offset-4 hover:text-accent"
          data-testid="link-activation-media-kit"
        >
          See the media kit
        </a>
        <Link href="/">
          <Button variant="outline" className="mt-9 h-11 rounded-none border-border px-6">Return to Birch Reserve</Button>
        </Link>
      </div>
    </div>
  );
}