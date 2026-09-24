import { useSearch, Link } from "wouter";
import {
  getGetSponsorReservationStatusQueryKey,
  useGetSponsorReservationStatus,
} from "@workspace/api-client-react";
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { birchOrderPresentation } from "@/lib/birch-order-status";
import { formatReserveAmount } from "@/lib/reserve-offers";
import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";

type BirchReserveOrder = {
  order_id: string;
  sku: string;
  status: "reserved" | "paid" | "creative_in" | "live" | "completed" | "recycled";
  amountCents: number;
  currency: string;
  format: string | null;
  payment_status: "paid" | "not_paid";
  paid_at: string | null;
};

export default function Success() {
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const token = searchParams.get("token");
  const orderId = searchParams.get("order");
  const sessionId = searchParams.get("session_id");
  const orderQuery = useQuery({
    queryKey: ["birch-reserve-order", orderId, sessionId],
    enabled: Boolean(orderId),
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.status === "reserved" &&
      query.state.data.payment_status === "not_paid"
        ? 2_000
        : false,
    queryFn: async (): Promise<BirchReserveOrder> => {
      const query = sessionId
        ? {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ session_id: sessionId }),
          }
        : undefined;
      const response = await fetch(
        `/v1/orders/${encodeURIComponent(orderId ?? "")}${sessionId ? "/confirm" : ""}`,
        query,
      );
      if (!response.ok) throw new Error("Unable to retrieve order.");
      return response.json() as Promise<BirchReserveOrder>;
    },
  });
  // Analytics: one checkout_success per paid order (no-op without analytics config).
  const successTracked = useRef(false);
  const paidOrder = orderQuery.data?.payment_status === "paid" ? orderQuery.data : null;
  useEffect(() => {
    if (!paidOrder || successTracked.current) return;
    successTracked.current = true;
    track("checkout_success", { offer: paidOrder.sku === "hold-190" ? "hold" : "reserve" });
  }, [paidOrder]);
  const { data, isLoading, isError } = useGetSponsorReservationStatus(
    { token: token || "" },
    {
      query: {
        queryKey: getGetSponsorReservationStatusQueryKey({ token: token || "" }),
        enabled: Boolean(token),
        retry: false,
      },
    },
  );

  if (orderId) {
    if (orderQuery.isLoading) {
      return (
        <StatusShell
          icon={<Loader2 className="size-12 text-primary animate-spin" />}
          title="Confirming Payment"
          description="Retrieving your Birch Reserve order..."
        />
      );
    }

    if (orderQuery.isError || !orderQuery.data) {
      return (
        <StatusShell
          icon={<AlertCircle className="size-12 text-destructive" />}
          title="Order Not Found"
          description="This Birch Reserve order reference is invalid or unavailable."
        />
      );
    }

    const order = orderQuery.data;
    const presentation = birchOrderPresentation(order);
    const formattedAmount = formatReserveAmount(
      order.amountCents,
      order.currency.toUpperCase(),
    );
    const isConfirming = presentation.kind === "confirming";
    const isExpired = presentation.kind === "expired";
    return (
      <div className="min-h-[85vh] bg-background py-32 px-6 flex items-center justify-center">
        <div className="container mx-auto flex flex-col items-center">
          <div className="bg-card border border-border p-12 text-center max-w-2xl w-full relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-accent" />
            <div className="size-20 bg-secondary border border-border rounded-full flex items-center justify-center mx-auto mb-8">
              {isConfirming ? (
                <Loader2 className="size-10 text-primary animate-spin" />
              ) : isExpired ? (
                <AlertCircle className="size-10 text-destructive" />
              ) : presentation.kind === "paid_recycled" ? (
                <ShieldCheck className="size-10 text-accent" />
              ) : (
                <CheckCircle2 className="size-10 text-accent" />
              )}
            </div>
            <h1 className="text-4xl md:text-5xl font-display tracking-tight mb-6 text-foreground italic">
              {presentation.title}
            </h1>
            <p className="text-sm text-muted-foreground mb-8 leading-relaxed max-w-md mx-auto">
              {presentation.description}
            </p>
            <div className="border border-border bg-secondary p-6 text-left space-y-3">
              <p><strong>Order:</strong> {order.order_id}</p>
              <p><strong>Amount:</strong> {formattedAmount} {order.currency.toUpperCase()}</p>
              <p><strong>Payment:</strong> {order.payment_status === "paid" ? "Paid" : "Not recorded"}</p>
              {order.paid_at ? <p><strong>Paid at:</strong> {new Date(order.paid_at).toLocaleString()}</p> : null}
              <p><strong>Media credit:</strong> 100% of {formattedAmount}</p>
              <p><strong>Format:</strong> {order.format?.replaceAll("_", " ") ?? "To be coordinated"}</p>
            </div>
            <a
              className="mt-8 inline-flex h-12 items-center border border-border px-8 text-sm font-medium hover:bg-secondary"
              href={`/v1/orders/${encodeURIComponent(order.order_id)}/io.json`}
            >
              View insertion order JSON
            </a>
            <a
              className="mt-4 block text-sm font-medium text-foreground underline underline-offset-4 hover:text-accent"
              href="/kit"
              data-testid="link-success-media-kit"
            >
              See the media kit
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <StatusShell
        icon={<AlertCircle className="size-12 text-destructive" />}
        title="Missing Token"
        description="No secure request token was provided in the URL."
      />
    );
  }

  if (isLoading) {
    return (
      <StatusShell
        icon={<Loader2 className="size-12 text-primary animate-spin" />}
        title="Locating Request"
        description="Retrieving your secure sponsor request status..."
      />
    );
  }

  if (isError || !data) {
    return (
      <StatusShell
        icon={<AlertCircle className="size-12 text-destructive" />}
        title="Invalid Request"
        description="This request token is invalid, missing, or expired."
      />
    );
  }

  return (
    <div className="min-h-[85vh] bg-background py-32 px-6 flex items-center justify-center">
      <div className="container mx-auto flex flex-col items-center">
        <div className="bg-card border border-border p-12 text-center max-w-2xl w-full relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 w-full h-1 bg-accent" />

          <div className="size-20 bg-secondary border border-border rounded-full flex items-center justify-center mx-auto mb-8 relative z-10">
            <CheckCircle2 className="size-10 text-accent" />
          </div>

          <h1 className="text-4xl md:text-5xl font-display tracking-tight mb-6 text-foreground italic">
            Request Secured
          </h1>

          <p className="text-sm text-muted-foreground mb-10 leading-relaxed max-w-md mx-auto">
            Your request is waiting for private commercial and host review.
            No payment, inventory reservation, or placement has been created.
          </p>

          <div className="border border-border bg-secondary p-6 flex flex-col items-center">
            <p className="text-xs text-muted-foreground mb-3">
              Secure Reference
            </p>
            <div className="text-lg font-medium text-foreground tracking-widest">
              {data.reservationId.slice(0, 8).toUpperCase()}
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center gap-4 text-center">
          <a
            href="/kit"
            className="text-sm font-medium text-foreground underline underline-offset-4 hover:text-accent"
            data-testid="link-success-media-kit"
          >
            See the media kit
          </a>
          <Link href="/">
            <Button variant="outline" className="rounded-none border-border text-foreground hover:bg-secondary px-8 h-12">
              Return to Hub
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatusShell({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center bg-background text-foreground">
      <div className="w-full max-w-md border border-border bg-card p-12 flex flex-col items-center">
        <div className="mb-8">{icon}</div>
        <h1 className="text-4xl font-display tracking-tight mb-4 text-foreground italic">{title}</h1>
        <p className="text-sm text-muted-foreground mb-10 leading-relaxed">{description}</p>
        <Link href="/">
          <Button variant="outline" className="rounded-none border-border text-foreground hover:bg-secondary px-8 h-12">Return Home</Button>
        </Link>
      </div>
    </div>
  );
}