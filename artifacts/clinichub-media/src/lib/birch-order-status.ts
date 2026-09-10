import { formatReserveAmount } from "./reserve-offers.ts";

export type BirchOrderLifecycle = {
  status: "reserved" | "paid" | "creative_in" | "live" | "completed" | "recycled";
  payment_status: "paid" | "not_paid";
  amountCents: number;
  currency: string;
};

export function birchOrderPresentation(order: BirchOrderLifecycle): {
  kind: "confirming" | "paid" | "paid_recycled" | "expired";
  title: string;
  description: string;
} {
  const currency = order.currency.toUpperCase();
  const formattedAmount = formatReserveAmount(order.amountCents, currency);

  if (order.status === "recycled" && order.payment_status === "paid") {
    return {
      kind: "paid_recycled",
      title: "Payment Preserved — Seat Recycled",
      description:
        `Your ${formattedAmount} ${currency} payment remains recorded. The seat returned to inventory because creative was not received within 72 hours. Contact Birch Reserve to coordinate next steps.`,
    };
  }
  if (order.status === "recycled") {
    return {
      kind: "expired",
      title: "Reservation Expired",
      description:
        "No payment was recorded. This hold expired and the seat returned to inventory.",
    };
  }
  if (order.payment_status === "paid") {
    return {
      kind: "paid",
      title: "Payment Confirmed",
      description:
        `Your ${formattedAmount} ${currency} Birch Reserve seat is paid. Upload creative within 72 hours so fulfillment can be coordinated.`,
    };
  }
  return {
    kind: "confirming",
    title: "Confirming Payment",
    description:
      "Your reservation is saved. Stripe confirmation can take a few seconds; this page updates automatically.",
  };
}