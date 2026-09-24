import { useEffect, useRef, useState } from "react";
import { HoneypotField, withFormGuards } from "@/lib/form-guards";
import { track } from "@/lib/analytics";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateCommercialInquiry } from "@workspace/api-client-react";
import { Loader2, CheckCircle2, Building, Mail, Link2, Factory, AlignLeft, Globe, Briefcase } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import type { CommercialInquiryReceipt } from "@workspace/api-client-react";

const inquirySchema = z.object({
  inquiryType: z.enum(['branded_hub', 'fulfillment']),
  name: z.string().trim().min(2, "Name is required").max(120),
  email: z.string().trim().email("Valid email required").min(3).max(320),
  company: z.string().trim().min(2, "Company is required").max(160),
  website: z.string().trim().url("Valid URL required (https://...)").min(8).max(2048),
  category: z.string().trim().min(2, "Category is required").max(120),
  coverageRegion: z.enum(['canada', 'united_states', 'canada_and_united_states', 'other']),
  details: z.string().trim().min(10, "Please provide more detail").max(2000),
  transactionConsent: z.boolean().refine(val => val === true, {
    message: "You must authorize Birch Reserve to contact you.",
  }),
  marketingConsent: z.boolean().default(false),
});

type InquiryFormValues = z.infer<typeof inquirySchema>;

interface CommercialInquiryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultInquiryType?: "branded_hub" | "fulfillment";
}

export function CommercialInquiryDialog({ open, onOpenChange, defaultInquiryType = "branded_hub" }: CommercialInquiryDialogProps) {
  const { mutate: createInquiry, isPending, isError, reset: resetMutation } = useCreateCommercialInquiry();
  const honeypotRef = useRef<HTMLInputElement>(null);
  const [successReceipt, setSuccessReceipt] = useState<CommercialInquiryReceipt | null>(null);

  const form = useForm<InquiryFormValues>({
    resolver: zodResolver(inquirySchema),
    defaultValues: {
      inquiryType: defaultInquiryType,
      name: "",
      email: "",
      company: "",
      website: "",
      category: "",
      coverageRegion: "canada",
      details: "",
      transactionConsent: false,
      marketingConsent: false,
    },
  });

  const selectedType = form.watch("inquiryType");
  const selectedRegion = form.watch("coverageRegion");

  useEffect(() => {
    if (open) {
      form.reset({
        inquiryType: defaultInquiryType,
        name: "",
        email: "",
        company: "",
        website: "",
        category: "",
        coverageRegion: "canada",
        details: "",
        transactionConsent: false,
        marketingConsent: false,
      });
      resetMutation();
      setSuccessReceipt(null);
    }
  }, [open, defaultInquiryType, form, resetMutation]);

  function onSubmit(values: InquiryFormValues) {
    createInquiry(
      { data: withFormGuards(values, honeypotRef) },
      {
        onSuccess: (receipt) => {
          track("intake_submit", { source: "commercial_inquiry" });
          setSuccessReceipt(receipt);
        },
        onError: (err) => {
          console.error("Inquiry error:", err);
        }
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden rounded-none border border-border shadow-2xl bg-card" data-testid="dialog-commercial-inquiry">
        <div className="absolute top-0 left-0 w-full h-1 bg-primary" />

        <AnimatePresence mode="wait">
          {!successReceipt ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
              className="p-8 md:p-10 max-h-[85vh] overflow-y-auto hide-scrollbar"
            >
              <DialogHeader className="mb-8">
                <div className="size-12 bg-secondary flex items-center justify-center mb-5 border border-border">
                  <Briefcase className="size-6 text-foreground" />
                </div>
                <DialogTitle className="font-display text-3xl text-foreground italic tracking-tight">
                  Commercial Inquiry
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  {selectedType === "branded_hub"
                    ? "Request private review for a branded clinic hub. No payment collected."
                    : "Request details on fulfillment coordination. No payment collected."}
                </DialogDescription>
              </DialogHeader>

              {isError && (
                <div className="mb-6 p-4 border border-destructive/30 bg-destructive/10 text-destructive text-xs font-medium flex items-center gap-3">
                  <div className="size-2 bg-destructive animate-pulse" />
                  Issue processing request.
                </div>
              )}

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="relative space-y-5">
                  <HoneypotField inputRef={honeypotRef} idSuffix="commercial" />
                  <FormField
                    control={form.control}
                    name="inquiryType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-foreground">Inquiry Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="rounded-none border-border bg-background h-12 px-4 shadow-sm text-foreground">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-none shadow-lg border-border bg-card">
                            <SelectItem value="branded_hub" className="text-sm">Branded Clinic Hub</SelectItem>
                            <SelectItem value="fulfillment" className="text-sm">Fulfillment Coverage</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium text-foreground">Your Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Jane Doe" {...field} className="rounded-none border-border bg-background h-12 px-4 shadow-sm text-foreground" data-testid="input-commercial-name" />
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
                          <FormLabel className="text-xs font-medium text-foreground flex items-center gap-2">
                            Work Email
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="jane@company.com" {...field} className="rounded-none border-border bg-background h-12 px-4 shadow-sm text-foreground" data-testid="input-commercial-email" />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="company"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium text-foreground flex items-center gap-2">
                            Company
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="Company Name" {...field} className="rounded-none border-border bg-background h-12 px-4 shadow-sm text-foreground" data-testid="input-commercial-company" />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="website"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium text-foreground flex items-center gap-2">
                            Website
                          </FormLabel>
                          <FormControl>
                            <Input required placeholder="https://..." {...field} className="rounded-none border-border bg-background h-12 px-4 shadow-sm text-foreground" data-testid="input-commercial-website" />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium text-foreground flex items-center gap-2">
                            Industry / Category
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Wellness" {...field} className="rounded-none border-border bg-background h-12 px-4 shadow-sm text-foreground" data-testid="input-commercial-category" />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="coverageRegion"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium text-foreground flex items-center gap-2">
                            Target Region
                          </FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="rounded-none border-border bg-background h-12 px-4 shadow-sm text-foreground">
                                <SelectValue placeholder="Select region" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="rounded-none shadow-lg border-border bg-card">
                              <SelectItem value="canada" className="text-sm">Canada</SelectItem>
                              <SelectItem value="united_states" className="text-sm">United States</SelectItem>
                              <SelectItem value="canada_and_united_states" className="text-sm">Canada & US</SelectItem>
                              <SelectItem value="other" className="text-sm">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="details"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-foreground flex items-center gap-2">
                          Inquiry Details
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe setup and scale..."
                            {...field}
                            className="min-h-[100px] rounded-none border-border bg-background px-4 py-3 shadow-sm resize-y text-sm text-foreground"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  <div className="pt-6 border-t border-border">
                    <FormField
                      control={form.control}
                      name="transactionConsent"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-4 space-y-0 border border-border p-4 bg-secondary mb-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="mt-0.5 rounded-none border-border data-[state=checked]:bg-primary"
                               data-testid="checkbox-commercial-transaction-consent"
                            />
                          </FormControl>
                          <div className="space-y-2 leading-none">
                            <FormLabel className="text-sm font-medium text-foreground cursor-pointer">
                              Acknowledge Terms
                            </FormLabel>
                            <FormDescription className="text-xs text-muted-foreground leading-relaxed">
                              I authorize contact regarding this inquiry. No placement or payment obligation created.
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
                              className="mt-0.5 rounded-none border-border data-[state=checked]:bg-primary"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-xs font-medium cursor-pointer text-muted-foreground">
                              Receive marketplace updates (opt)
                            </FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="pt-6 flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => onOpenChange(false)}
                      className="rounded-none font-medium hover:bg-secondary text-foreground h-12 px-6"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isPending}
                      className="rounded-none bg-primary text-primary-foreground hover:opacity-90 h-12 px-8"
                       data-testid="button-submit-commercial-inquiry"
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="mr-2 size-5 animate-spin" />
                          Submitting
                        </>
                      ) : (
                        "Submit Inquiry"
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-10 flex flex-col items-center justify-center text-center min-h-[450px]"
            >
              <div className="size-16 bg-secondary border border-border flex items-center justify-center mb-8">
                <CheckCircle2 className="size-8 text-foreground" />
              </div>

              <h2 className="font-display text-3xl text-foreground italic tracking-tight mb-4">
                Inquiry Logged
              </h2>

              <p className="text-sm text-muted-foreground mb-8 max-w-sm mx-auto leading-relaxed">
                 We've received your commercial inquiry for review.
              </p>

              <div className="border border-border bg-secondary p-6 w-full max-w-sm relative">
                 <p className="text-xs text-muted-foreground mb-3">Reference</p>
                 <div className="text-lg text-foreground font-medium tracking-widest">
                    {successReceipt.requestId.slice(0, 8).toUpperCase()}
                 </div>
              </div>

              <Button
                onClick={() => onOpenChange(false)}
                variant="outline"
                className="mt-10 rounded-none border-border text-foreground hover:bg-secondary h-12 px-10"
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