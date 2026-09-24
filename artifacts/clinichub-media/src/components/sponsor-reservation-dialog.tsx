import { useEffect, useRef, useState } from "react";
import { HoneypotField, withFormGuards } from "@/lib/form-guards";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateSponsorReservation } from "@workspace/api-client-react";
import { Loader2, CheckCircle2, ShieldCheck, ArrowRight, ArrowLeft } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import type { SponsorReservationReceipt } from "@workspace/api-client-react";

const sponsorSchema = z.object({
  packageType: z.enum(['brand', 'retail', 'other', 'clinic', 'physio', 'test_pilot']),
  accessRoute: z.enum(['open_market', 'ecosystem_contributor', 'test_pilot']),
  buyerName: z.string().trim().min(2, "Name is required").max(120),
  buyerEmail: z.string().trim().email("Valid email required").min(3).max(320),
  companyName: z.string().trim().min(2, "Company is required").max(160),
  companyWebsite: z.string().trim().url("Valid URL required (https://...)").min(8).max(2048),
  requestedCategory: z.string().trim().min(2, "Category is required").max(80),
  requestedHubName: z.string().max(160).optional(),
  advertisingObjective: z.enum(['brand_awareness', 'product_discovery', 'product_purchase', 'service_booking', 'other'], {
    required_error: "Please select an objective",
  }),
  preferredPlacement: z.enum(['post_checkout', 'recovery_plan', 'booking_confirmation', 'member_hub', 'guidance_needed'], {
    required_error: "Please select a preferred placement",
  }),
  investmentRange: z.enum(['under_5k', '5k_to_10k', '10k_to_25k', '25k_plus', 'exploring'], {
    required_error: "Please select an investment range",
  }),
  launchTimeline: z.enum(['within_30_days', '30_to_60_days', '60_plus_days', 'flexible'], {
    required_error: "Please select a launch timeline",
  }),
  creativeStatus: z.enum(['creative_ready', 'needs_support', 'exploring'], {
    required_error: "Please select a creative status",
  }),
  additionalNotes: z.string().max(1000).optional(),
  termsAccepted: z.boolean().refine(val => val === true, {
    message: "You must accept the terms of the reservation.",
  }),
  marketingConsent: z.boolean().default(false),
});

type SponsorFormValues = z.infer<typeof sponsorSchema>;
type SponsorAccessRoute = SponsorFormValues["accessRoute"];

interface SponsorReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPackage?: "brand" | "retail" | "other" | "clinic" | "physio" | "test_pilot";
  defaultAccessRoute?: SponsorAccessRoute;
}

const OBJECTIVES = [
  { value: "brand_awareness", label: "Brand Awareness" },
  { value: "product_discovery", label: "Product Discovery" },
  { value: "product_purchase", label: "Direct Purchase / Conversion" },
  { value: "service_booking", label: "Service Booking" },
  { value: "other", label: "Other" }
];

const PLACEMENTS = [
  { value: "post_checkout", label: "Post-Checkout Confirmation" },
  { value: "recovery_plan", label: "Digital Recovery Plan" },
  { value: "booking_confirmation", label: "Booking Confirmation" },
  { value: "member_hub", label: "Member Hub Dashboard" },
  { value: "guidance_needed", label: "Not sure / Seeking guidance" }
];

const INVESTMENTS = [
  { value: "under_5k", label: "Under $5k" },
  { value: "5k_to_10k", label: "$5k - $10k" },
  { value: "10k_to_25k", label: "$10k - $25k" },
  { value: "25k_plus", label: "$25k+" },
  { value: "exploring", label: "Exploring options" }
];

const TIMELINES = [
  { value: "within_30_days", label: "Within 30 days" },
  { value: "30_to_60_days", label: "30-60 days" },
  { value: "60_plus_days", label: "60+ days" },
  { value: "flexible", label: "Flexible" }
];

const CREATIVE_STATUSES = [
  { value: "creative_ready", label: "Creative is ready" },
  { value: "needs_support", label: "Need creative support" },
  { value: "exploring", label: "Just exploring" }
];

export function SponsorReservationDialog({
  open,
  onOpenChange,
  defaultPackage = "brand",
  defaultAccessRoute = "open_market",
}: SponsorReservationDialogProps) {
  const { mutate: createReservation, isPending, isError, reset: resetMutation } = useCreateSponsorReservation();
  const honeypotRef = useRef<HTMLInputElement>(null);
  const [successReceipt, setSuccessReceipt] = useState<SponsorReservationReceipt | null>(null);
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  const form = useForm<SponsorFormValues>({
    resolver: zodResolver(sponsorSchema),
    defaultValues: {
      packageType: defaultPackage,
      accessRoute: defaultAccessRoute,
      buyerName: "",
      buyerEmail: "",
      companyName: "",
      companyWebsite: "",
      requestedCategory: "",
      requestedHubName: "",
      additionalNotes: "",
      termsAccepted: false,
      marketingConsent: false,
    },
  });

  const selectedPackage = form.watch("packageType");
  const isTestPilot = selectedPackage === "test_pilot";
  const accessRoute = form.watch("accessRoute");
  const isContributorRoute = accessRoute === "ecosystem_contributor";

  useEffect(() => {
    if (open) {
      form.reset({
        packageType: defaultPackage,
        accessRoute: defaultAccessRoute,
        buyerName: "",
        buyerEmail: "",
        companyName: "",
        companyWebsite: "",
        requestedCategory: "",
        requestedHubName: "",
        additionalNotes: "",
        termsAccepted: false,
        marketingConsent: false,
      });
      resetMutation();
      setSuccessReceipt(null);
      setStep(1);
    }
  }, [open, defaultPackage, defaultAccessRoute, form, resetMutation]);

  const handleNextStep = async () => {
    let fieldsToValidate: any[] = [];
    if (step === 1) fieldsToValidate = ['buyerName', 'buyerEmail', 'companyName', 'companyWebsite', 'requestedCategory'];
    if (step === 2) fieldsToValidate = ['packageType', 'accessRoute', 'advertisingObjective', 'preferredPlacement'];
    if (step === 3) fieldsToValidate = ['investmentRange', 'launchTimeline', 'creativeStatus'];

    const isValid = await form.trigger(fieldsToValidate as any);
    if (isValid) {
      setStep((s) => Math.min(s + 1, totalSteps));
    }
  };

  const handlePrevStep = () => {
    setStep((s) => Math.max(s - 1, 1));
  };

  function onSubmit(values: SponsorFormValues) {
    const { requestedHubName: rawRequestedHubName, additionalNotes: rawAdditionalNotes, ...requiredValues } = values;
    const requestedHubName = rawRequestedHubName?.trim();
    const additionalNotes = rawAdditionalNotes?.trim();

    createReservation(
      {
        data: withFormGuards(
          {
            ...requiredValues,
            ...(requestedHubName ? { requestedHubName } : {}),
            ...(additionalNotes ? { additionalNotes } : {}),
          },
          honeypotRef,
        ),
      },
      {
        onSuccess: (receipt) => {
          setSuccessReceipt(receipt);
        },
        onError: (err) => {
          console.error("Reservation error:", err);
        }
      }
    );
  }

  const slideVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, x: -20, transition: { duration: 0.2 } },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden rounded-none border border-border shadow-2xl bg-background" data-testid="dialog-sponsor-reservation">

        <AnimatePresence mode="wait">
          {!successReceipt ? (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col h-full max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-8 pb-6 border-b border-border bg-card relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-accent" />
                <div className="flex justify-between items-start mb-4">
                  <div className="size-12 bg-secondary flex items-center justify-center border border-border">
                    <ShieldCheck className="size-6 text-foreground" />
                  </div>
                  <div className="flex gap-1.5 pt-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1.5 w-8 rounded-none transition-colors duration-300 ${
                          i <= step ? "bg-accent" : "bg-secondary border border-border"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <DialogTitle className="font-display text-4xl text-foreground tracking-tight italic mb-2">
                  {isTestPilot ? "Test Pilot Request" : "Pre-Buy Reservation"}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground leading-relaxed max-w-md">
                  {isTestPilot
                    ? "CAD $10k Test Pilot held until 2nd approved surface live. Request only."
                    : isContributorRoute
                      ? "Contributor route for an indicative CAD $5k request. Eligibility is verified manually before first-review status applies. No payment or placement is created today."
                      : "Open-market route for an indicative CAD $5k request. No payment or placement is created today."}
                </DialogDescription>
              </div>

              {isError && (
                <div className="p-4 border-b border-destructive/30 bg-destructive/10 text-destructive text-xs font-medium flex items-center gap-3">
                  <div className="size-2 bg-destructive animate-pulse" />
                  Issue processing request. Please try again.
                </div>
              )}

              {/* Form Content */}
              <div className="flex-1 overflow-y-auto hide-scrollbar p-8 bg-background">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="relative space-y-6">
                    <HoneypotField inputRef={honeypotRef} idSuffix="sponsor" />

                    <AnimatePresence mode="wait">
                      {step === 1 && (
                        <motion.div
                          key="step1"
                          variants={slideVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          className="space-y-5"
                        >
                          <div className="mb-6">
                            <h3 className="text-lg font-display text-foreground">1. Identity & Brand</h3>
                            <p className="text-xs text-muted-foreground">Who is requesting placement?</p>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="buyerName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-medium text-foreground">Your Name</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Jane Doe" {...field} className="rounded-none border-border bg-card h-12 px-4 shadow-sm text-foreground focus-visible:ring-accent" data-testid="input-waitlist-name" />
                                  </FormControl>
                                  <FormMessage className="text-xs" />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="buyerEmail"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-medium text-foreground">Work Email</FormLabel>
                                  <FormControl>
                                    <Input placeholder="jane@company.com" {...field} className="rounded-none border-border bg-card h-12 px-4 shadow-sm text-foreground focus-visible:ring-accent" data-testid="input-waitlist-email" />
                                  </FormControl>
                                  <FormMessage className="text-xs" />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="companyName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-medium text-foreground">Company</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Company Name" {...field} className="rounded-none border-border bg-card h-12 px-4 shadow-sm text-foreground focus-visible:ring-accent" data-testid="input-waitlist-company" />
                                  </FormControl>
                                  <FormMessage className="text-xs" />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="companyWebsite"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-medium text-foreground">Website</FormLabel>
                                  <FormControl>
                                    <Input required placeholder="https://..." {...field} className="rounded-none border-border bg-card h-12 px-4 shadow-sm text-foreground focus-visible:ring-accent" data-testid="input-sponsor-website" />
                                  </FormControl>
                                  <FormMessage className="text-xs" />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={form.control}
                            name="requestedCategory"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium text-foreground">Brand Category</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g. Sleep Supplements, Recovery Devices" {...field} className="rounded-none border-border bg-card h-12 px-4 shadow-sm text-foreground focus-visible:ring-accent" data-testid="input-waitlist-category" />
                                </FormControl>
                                <FormMessage className="text-xs" />
                              </FormItem>
                            )}
                          />
                        </motion.div>
                      )}

                      {step === 2 && (
                        <motion.div
                          key="step2"
                          variants={slideVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          className="space-y-5"
                        >
                          <div className="mb-6">
                            <h3 className="text-lg font-display text-foreground">2. Campaign Direction</h3>
                            <p className="text-xs text-muted-foreground">What are you trying to achieve?</p>
                          </div>

                          {isTestPilot ? (
                            <div className="space-y-2">
                              <div className="text-xs font-medium text-foreground">Request Type</div>
                              <div className="flex h-12 items-center border border-border bg-card px-4 text-sm text-foreground">
                                Test Pilot
                              </div>
                            </div>
                          ) : (
                            <FormField
                              control={form.control}
                              name="packageType"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-medium text-foreground">Buyer Type</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                                    <FormControl>
                                      <SelectTrigger className="rounded-none border-border bg-card h-12 px-4 shadow-sm text-foreground focus:ring-accent" data-testid="select-waitlist-business-size">
                                        <SelectValue placeholder="Select type" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="rounded-none shadow-lg border-border bg-card">
                                      <SelectItem value="brand" className="text-sm">Brand / Manufacturer</SelectItem>
                                      <SelectItem value="retail" className="text-sm">Retailer / Commerce</SelectItem>
                                      <SelectItem value="other" className="text-sm">Agency / Other</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage className="text-xs" />
                                </FormItem>
                              )}
                            />
                          )}

                          <FormField
                            control={form.control}
                            name="advertisingObjective"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium text-foreground">Primary Objective</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value ?? ""}>
                                  <FormControl>
                                    <SelectTrigger className="rounded-none border-border bg-card h-12 px-4 shadow-sm text-foreground focus:ring-accent" data-testid="select-advertising-objective">
                                      <SelectValue placeholder="Select objective" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent className="rounded-none shadow-lg border-border bg-card">
                                    {OBJECTIVES.map((obj) => (
                                      <SelectItem key={obj.value} value={obj.value} className="text-sm">{obj.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage className="text-xs" />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="preferredPlacement"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium text-foreground">Preferred Placement</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value ?? ""}>
                                  <FormControl>
                                    <SelectTrigger className="rounded-none border-border bg-card h-12 px-4 shadow-sm text-foreground focus:ring-accent" data-testid="select-preferred-placement">
                                      <SelectValue placeholder="Select placement" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent className="rounded-none shadow-lg border-border bg-card">
                                    {PLACEMENTS.map((pl) => (
                                      <SelectItem key={pl.value} value={pl.value} className="text-sm">{pl.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage className="text-xs" />
                              </FormItem>
                            )}
                          />
                        </motion.div>
                      )}

                      {step === 3 && (
                        <motion.div
                          key="step3"
                          variants={slideVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          className="space-y-5"
                        >
                          <div className="mb-6">
                            <h3 className="text-lg font-display text-foreground">3. Planning & Logistics</h3>
                            <p className="text-xs text-muted-foreground">Timeline and budget context for the review.</p>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="investmentRange"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-medium text-foreground">Investment Range</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                                    <FormControl>
                                      <SelectTrigger className="rounded-none border-border bg-card h-12 px-4 shadow-sm text-foreground focus:ring-accent" data-testid="select-investment-range">
                                        <SelectValue placeholder="Select range" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="rounded-none shadow-lg border-border bg-card">
                                      {INVESTMENTS.map((inv) => (
                                        <SelectItem key={inv.value} value={inv.value} className="text-sm">{inv.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage className="text-xs" />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="launchTimeline"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-medium text-foreground">Launch Timeline</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                                    <FormControl>
                                      <SelectTrigger className="rounded-none border-border bg-card h-12 px-4 shadow-sm text-foreground focus:ring-accent" data-testid="select-launch-timeline">
                                        <SelectValue placeholder="Select timeline" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="rounded-none shadow-lg border-border bg-card">
                                      {TIMELINES.map((time) => (
                                        <SelectItem key={time.value} value={time.value} className="text-sm">{time.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage className="text-xs" />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={form.control}
                            name="creativeStatus"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium text-foreground">Creative Status</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value ?? ""}>
                                  <FormControl>
                                    <SelectTrigger className="rounded-none border-border bg-card h-12 px-4 shadow-sm text-foreground focus:ring-accent" data-testid="select-creative-status">
                                      <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent className="rounded-none shadow-lg border-border bg-card">
                                    {CREATIVE_STATUSES.map((status) => (
                                      <SelectItem key={status.value} value={status.value} className="text-sm">{status.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage className="text-xs" />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="requestedHubName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium text-foreground flex justify-between">
                                  Desired Hub <span className="text-muted-foreground font-normal">(Optional)</span>
                                </FormLabel>
                                <FormControl>
                                  <Input placeholder="Specific host name or network..." {...field} className="rounded-none border-border bg-card h-12 px-4 shadow-sm text-foreground focus-visible:ring-accent" data-testid="input-waitlist-hub" />
                                </FormControl>
                                <FormMessage className="text-xs" />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="additionalNotes"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium text-foreground flex justify-between">
                                  Context <span className="text-muted-foreground font-normal">(Optional)</span>
                                </FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="Any additional notes for the host review..."
                                    className="rounded-none border-border bg-card shadow-sm text-foreground min-h-[80px] resize-none focus-visible:ring-accent"
                                    {...field}
                                    data-testid="textarea-additional-notes"
                                  />
                                </FormControl>
                                <FormMessage className="text-xs" />
                              </FormItem>
                            )}
                          />
                        </motion.div>
                      )}

                      {step === 4 && (
                        <motion.div
                          key="step4"
                          variants={slideVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          className="space-y-5"
                        >
                          <div className="mb-6">
                            <h3 className="text-lg font-display text-foreground">4. Final Review</h3>
                            <p className="text-xs text-muted-foreground">Acknowledge commercial terms to submit.</p>
                          </div>

                          <div className="border border-border bg-secondary p-5 mb-6">
                            <h4 className="font-medium text-sm mb-2">Request Summary</h4>
                            <div className="space-y-2 text-xs text-muted-foreground">
                              <div className="flex justify-between"><span>Company:</span> <span className="text-foreground">{form.getValues('companyName') || '-'}</span></div>
                               <div className="flex justify-between gap-4"><span>Access route:</span> <span className="text-foreground text-right">{isContributorRoute ? "Contributor — verification pending" : isTestPilot ? "Held test pilot" : "Open market"}</span></div>
                              <div className="flex justify-between"><span>Objective:</span> <span className="text-foreground">{OBJECTIVES.find(o => o.value === form.getValues('advertisingObjective'))?.label || '-'}</span></div>
                              <div className="flex justify-between"><span>Placement:</span> <span className="text-foreground">{PLACEMENTS.find(p => p.value === form.getValues('preferredPlacement'))?.label || '-'}</span></div>
                              <div className="flex justify-between"><span>Investment:</span> <span className="text-foreground">{INVESTMENTS.find(i => i.value === form.getValues('investmentRange'))?.label || '-'}</span></div>
                            </div>
                          </div>

                          <FormField
                            control={form.control}
                            name="termsAccepted"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-4 space-y-0 border border-border p-5 bg-card">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    className="mt-0.5 rounded-none border-border data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground data-[state=checked]:border-accent"
                                    data-testid="checkbox-terms-accepted"
                                  />
                                </FormControl>
                                <div className="space-y-2 leading-none">
                                  <FormLabel className="text-sm font-medium text-foreground cursor-pointer">
                                    Acknowledge Request Terms
                                  </FormLabel>
                                  <FormDescription className="text-xs text-muted-foreground leading-relaxed">
                                    {isTestPilot
                                      ? "CAD $10k Test Pilot is held and request-only. No payment or placement created today."
                                     : isContributorRoute
                                       ? "Contributor eligibility will be verified manually before first-review status applies. No payment or placement is created today. Host approval applies."
                                       : "Open-market request for review of an indicative CAD $5k package. No payment or placement is created today. Host approval applies."}
                                  </FormDescription>
                                </div>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="marketingConsent"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-4 space-y-0 p-2">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    className="mt-0.5 rounded-none border-border data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground data-[state=checked]:border-accent"
                                    data-testid="checkbox-marketing-consent"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-xs font-medium cursor-pointer text-muted-foreground">
                                    Receive marketplace updates (optional)
                                  </FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>

                  </form>
                </Form>
              </div>

              {/* Footer Actions */}
              <div className="p-6 border-t border-border bg-card flex justify-between items-center mt-auto">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    if (step === 1) onOpenChange(false);
                    else handlePrevStep();
                  }}
                  className="rounded-none font-medium hover:bg-secondary text-foreground h-12 px-6"
                  data-testid="button-cancel-sponsor"
                >
                  {step === 1 ? "Cancel" : <><ArrowLeft className="mr-2 size-4" /> Back</>}
                </Button>

                {step < totalSteps ? (
                  <Button
                    type="button"
                    onClick={handleNextStep}
                    data-testid="button-next-step"
                    className="rounded-none bg-foreground text-background hover:bg-accent hover:text-accent-foreground transition-colors h-12 px-8"
                  >
                    Next <ArrowRight className="ml-2 size-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={form.handleSubmit(onSubmit)}
                    disabled={isPending}
                    className="rounded-none bg-accent text-accent-foreground hover:bg-foreground hover:text-background transition-colors h-12 px-8"
                    data-testid="button-submit-sponsor"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="mr-2 size-5 animate-spin" />
                        Processing
                      </>
                    ) : (
                      "Submit Request"
                    )}
                  </Button>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-12 flex flex-col items-center justify-center text-center min-h-[500px] bg-background"
            >
              <div className="size-20 bg-secondary border border-border flex items-center justify-center mb-8 relative">
                <div className="absolute inset-0 bg-accent/10 animate-pulse" />
                <CheckCircle2 className="size-10 text-accent relative z-10" />
              </div>

              <h2 className="font-display text-4xl text-foreground italic tracking-tight mb-4">
                Request Received
              </h2>

              <p className="text-base text-muted-foreground mb-10 max-w-sm mx-auto leading-relaxed">
                   {isTestPilot
                    ? "Held Test Pilot request received. No payment/placement created."
                    : "Sponsor request received for review. No payment or placement created today."}
              </p>

              <div className="border border-border bg-card p-8 w-full max-w-sm relative shadow-sm">
                 <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3">Secure Reference</p>
                 <div className="text-2xl font-display text-foreground tracking-widest">
                    {successReceipt.reservationId.slice(0, 8).toUpperCase()}
                 </div>
              </div>

              <Button
                onClick={() => onOpenChange(false)}
                variant="outline"
                className="mt-12 rounded-none border-border text-foreground hover:bg-secondary h-12 px-12 transition-colors font-medium"
              >
                Close
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
