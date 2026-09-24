import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { CheckCircle2, Loader2, ArrowRight, ShieldCheck, CreditCard } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  useCreateSplashAdReservation,
  type SplashAdReservationReceipt,
} from "@workspace/api-client-react";
import {
  DEFAULT_RESERVE_OFFER_KEY,
  formatReserveAmount,
  getReserveOffer,
  RESERVE_OFFERS,
  type ReserveOfferKey,
} from "@/lib/reserve-offers";

const reserveSchema = z.object({
  brandName: z.string().trim().min(2, "Brand name is required").max(160, "Brand name is too long"),
  email: z.string().trim().email("Valid email required").min(3).max(320),
  websiteUrl: z.string().trim().url("Must be a valid URL").optional().or(z.literal('')),
  buyerPath: z.enum(["auto_buy", "private_distribution"]),
  offer: z.enum(["hold-190", "reserve-490"]),
  termsAccepted: z.boolean().refine((value) => value === true, {
    message: "Accept the draft terms before any charge.",
  }),
});

type ReserveFormValues = z.infer<typeof reserveSchema>;

export function SplashAdReservationDialog({
  open,
  onOpenChange,
  selectedFormat,
  defaultOffer = DEFAULT_RESERVE_OFFER_KEY,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedFormat?: string;
  defaultOffer?: ReserveOfferKey;
}) {
  const [isError, setIsError] = useState(false);
  const [successReceipt, setSuccessReceipt] = useState<(SplashAdReservationReceipt & { lockedAmountCents?: number }) | null>(null);

  const { mutateAsync: reserveSeat, isPending } = useCreateSplashAdReservation();

  const form = useForm<ReserveFormValues>({
    resolver: zodResolver(reserveSchema),
    defaultValues: {
      brandName: "",
      email: "",
      websiteUrl: "",
      buyerPath:
        selectedFormat === "Auto-buy" ? "auto_buy" : "private_distribution",
      offer: defaultOffer,
      termsAccepted: false,
    },
  });

  const selectedOfferKey = form.watch("offer") as ReserveOfferKey;
  const selectedOffer = getReserveOffer(selectedOfferKey);
  const formattedPrice = formatReserveAmount(selectedOffer.amountCents);

  useEffect(() => {
    if (open) {
      form.reset({
        brandName: "",
        email: "",
        websiteUrl: "",
        buyerPath:
          selectedFormat === "Auto-buy" ? "auto_buy" : "private_distribution",
        offer: defaultOffer,
        termsAccepted: false,
      });
      setIsError(false);
      setSuccessReceipt(null);
    }
  }, [defaultOffer, form, open, selectedFormat]);

  async function onSubmit(values: ReserveFormValues) {
    setIsError(false);
    const offerDetails = getReserveOffer(values.offer as ReserveOfferKey);
    try {
      const receipt = await reserveSeat({
        data: {
          brandName: values.brandName,
          email: values.email,
          websiteUrl: values.websiteUrl || undefined,
          buyerPath: values.buyerPath,
          expectedAmountCents: offerDetails.amountCents,
          expectedCurrency: "usd",
          offer: values.offer
        }
      });

      if (receipt.checkoutUrl) {
        window.location.href = receipt.checkoutUrl;
      } else {
        setSuccessReceipt({ ...receipt, lockedAmountCents: offerDetails.amountCents });
      }
    } catch {
      setIsError(true);
    }
  }

  const lockedFormattedPrice = successReceipt?.lockedAmountCents
    ? formatReserveAmount(successReceipt.lockedAmountCents)
    : formattedPrice;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-x-hidden overflow-y-auto rounded-none border border-border bg-background p-0 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:max-w-[500px]" data-testid="dialog-splash-reservation">
        <AnimatePresence mode="wait">
          {successReceipt ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-10 flex flex-col items-center text-center bg-background"
            >
              <div className="size-16 bg-accent/20 rounded-full flex items-center justify-center mb-6 border border-accent/30">
                <CheckCircle2 className="size-8 text-accent" />
              </div>
              <h3 className="text-3xl font-display tracking-tight mb-3 text-foreground">Seat reserved</h3>
              <p className="text-muted-foreground mb-8 max-w-sm leading-relaxed text-sm">
                Your reservation is saved. Payment is still required; contact Birch Reserve to complete the secure {lockedFormattedPrice} USD checkout.
              </p>

              <div className="w-full border border-border bg-secondary/20 p-5 text-left space-y-4 mb-8">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 size-5 text-accent shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">
                      Birch Reserve media credit
                    </p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Your payment is applied 100% toward future media and gives you priority access to available placements before broader release.
                    </p>
                  </div>
                </div>
              </div>

              <Button onClick={() => onOpenChange(false)} className="w-full mt-2 rounded-none h-12 bg-foreground text-background hover:bg-secondary hover:text-foreground border border-transparent hover:border-border transition-colors font-medium">
                Close
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col h-full"
            >
              <div className="relative border-b border-border bg-foreground text-background p-8 pb-8">
                <div className="absolute top-0 left-0 w-full h-1 bg-accent" />
                <div className="flex items-center gap-3 mb-6">
                  <div className="size-10 bg-background flex items-center justify-center">
                    <ShieldCheck className="size-5 text-foreground" />
                  </div>
                  <div className="text-xs font-bold uppercase tracking-widest text-background/80">
                    Birch Reserve Media Network
                  </div>
                </div>
                <DialogTitle className="mb-3 font-display text-4xl tracking-tight text-background">
                  Reach customers when attention is earned.
                </DialogTitle>
                <DialogDescription className="text-sm text-background/70 leading-relaxed max-w-sm">
                  {selectedFormat
                    ? `Secure priority access to ${selectedFormat} placements across high-intent customer moments created by leading recovery and wellness brands.`
                    : `Reach high-intent customers after purchase, inside member experiences, and throughout trusted digital care journeys operated by leading recovery and wellness brands.`}
                </DialogDescription>
              </div>

              {isError && (
                <div className="p-4 border-b border-destructive/30 bg-destructive/10 text-destructive text-xs font-medium flex items-center gap-3">
                  <div className="size-2 bg-destructive animate-pulse rounded-full" />
                  Issue processing request. Please try again.
                </div>
              )}

              <div className="flex-1 bg-background p-6 sm:p-8">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="offer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium text-foreground">Select Offer</FormLabel>
                          <FormControl>
                            <div className="grid gap-2">
                              {RESERVE_OFFERS.map((offer) => {
                                const isSelected = field.value === offer.key;
                                const amount = formatReserveAmount(offer.amountCents);
                                return (
                                  <Button
                                    key={offer.key}
                                    type="button"
                                    variant="outline"
                                    onClick={() => field.onChange(offer.key)}
                                    className={`h-auto rounded-none px-4 py-3 text-left w-full justify-start items-start flex-col gap-1 ${isSelected ? "border-accent bg-accent/15" : "border-border bg-card"}`}
                                  >
                                    <div className="flex items-center justify-between w-full">
                                      <span className="font-semibold">{offer.name}</span>
                                      <span className="font-display text-accent-foreground">{amount}</span>
                                    </div>
                                    <span className="text-[10px] font-normal text-muted-foreground whitespace-normal">
                                      100% media credit · {offer.description}
                                    </span>
                                  </Button>
                                );
                              })}
                            </div>
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="buyerPath"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium text-foreground">How do you want to buy?</FormLabel>
                          <FormControl>
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => field.onChange("auto_buy")}
                                className={`h-auto min-h-14 rounded-none px-3 py-3 text-left text-xs ${field.value === "auto_buy" ? "border-accent bg-accent/15" : "border-border bg-card"}`}
                              >
                                Direct reserve
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => field.onChange("private_distribution")}
                                className={`h-auto min-h-14 rounded-none px-3 py-3 text-left text-xs ${field.value === "private_distribution" ? "border-accent bg-accent/15" : "border-border bg-card"}`}
                              >
                                Managed distribution
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="brandName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium text-foreground">Brand Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Acme Recovery" {...field} className="rounded-none border-border bg-card h-12 px-4 shadow-sm text-foreground focus-visible:ring-accent" />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium text-foreground">Work Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="you@example.com" {...field} className="rounded-none border-border bg-card h-12 px-4 shadow-sm text-foreground focus-visible:ring-accent" />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="websiteUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium text-foreground">Website (Optional)</FormLabel>
                          <FormControl>
                            <Input type="url" placeholder="https://" {...field} className="rounded-none border-border bg-card h-12 px-4 shadow-sm text-foreground focus-visible:ring-accent" />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />

                    <div className="border-y border-border py-4 text-xs leading-relaxed text-muted-foreground">
                      <p><strong className="text-foreground">Credit, not a flight.</strong> Nothing runs until an insertion order names the surface.</p>
                      <p className="mt-1">Draft terms apply until counsel stamps them.</p>
                    </div>

                    <FormField
                      control={form.control}
                      name="termsAccepted"
                      render={({ field }) => (
                        <FormItem>
                          <label className="flex items-start gap-3 text-xs leading-relaxed text-muted-foreground">
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={field.value === true}
                              onChange={(event) => field.onChange(event.target.checked)}
                              data-testid="checkbox-reserve-terms"
                            />
                            <span>
                              I agree to the draft <a className="underline" href="/terms">terms</a> before any charge.
                            </span>
                          </label>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />

                    <div className="pt-2 flex flex-col gap-3">
                      <Button type="submit" disabled={isPending} className="w-full rounded-none bg-accent text-accent-foreground hover:bg-foreground hover:text-background h-14 text-base font-medium transition-colors">
                        {isPending ? (
                          <><Loader2 className="mr-2 size-5 animate-spin" /> Processing</>
                        ) : (
                          <>{selectedOffer.key === "hold-190" ? "Hold a category for 7 days — $190" : "Lock the seat — $490 USD"} <CreditCard className="ml-2 size-5" /></>
                        )}
                      </Button>
                      <div className="text-center text-[11px] text-muted-foreground mt-2">
                        {formattedPrice} one-time payment USD
                      </div>
                    </div>

                  </form>
                </Form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
