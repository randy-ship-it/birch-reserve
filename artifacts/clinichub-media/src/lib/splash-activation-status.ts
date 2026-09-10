type SplashActivationLifecycle = {
  status:
    | "pending_review"
    | "approved"
    | "payment_pending"
    | "paid"
    | "rejected"
    | "expired"
    | "recycled";
  paymentStatus:
    | "unpaid"
    | "checkout_creating"
    | "checkout_created"
    | "paid"
    | "failed"
    | "refunded";
};

export function terminalSplashActivation(
  reservation: SplashActivationLifecycle,
): { kind: "expired" | "paid_recycled"; title: string; description: string } | null {
  if (reservation.status === "expired") {
    return {
      kind: "expired",
      title: "Reservation expired",
      description:
        "No payment was recorded. This hold expired and its seat returned to Birch Reserve inventory.",
    };
  }
  if (reservation.status === "recycled") {
    return {
      kind: "paid_recycled",
      title: "Payment preserved — seat recycled",
      description:
        "Your payment remains recorded. The seat returned to inventory because creative was not received within 72 hours. Contact Birch Reserve to coordinate next steps.",
    };
  }
  return null;
}