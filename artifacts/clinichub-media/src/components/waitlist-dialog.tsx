import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useJoinPilotWaitlist } from "@workspace/api-client-react";
import { Loader2, CheckCircle2, Mail } from "lucide-react";

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
import { motion, AnimatePresence } from "framer-motion";

const updateSchema = z.object({
  email: z.string().email("Please enter a valid email address").min(3).max(320),
  marketingConsent: z.boolean().refine((value) => value === true, {
    message: "Consent is required.",
  }),
});

type UpdateFormValues = z.infer<typeof updateSchema>;

interface WaitlistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultInterest?: "insights" | "advertiser" | "brand-agency" | "host";
}

export function WaitlistDialog({ open, onOpenChange }: WaitlistDialogProps) {
  const { mutate: joinWaitlist, isPending, isError, isSuccess, data, reset: resetMutation } = useJoinPilotWaitlist();

  const form = useForm<UpdateFormValues>({
    resolver: zodResolver(updateSchema),
    defaultValues: {
      email: "",
      marketingConsent: false,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        email: "",
        marketingConsent: false,
      });
      resetMutation();
    }
  }, [open, form, resetMutation]);

  function onSubmit(values: UpdateFormValues) {
    const payload = {
      email: values.email,
      interestType: "insights" as const,
      marketingConsent: values.marketingConsent,
    };

    joinWaitlist(
      { data: payload },
      {
        onError: (err) => {
          console.error("Updates error:", err);
        }
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden rounded-none border border-border shadow-2xl bg-card" data-testid="dialog-waitlist-updates">
        <div className="absolute top-0 left-0 w-full h-1 bg-primary" />

        <AnimatePresence mode="wait">
          {!isSuccess ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
              className="p-8 md:p-10"
            >
              <DialogHeader className="mb-8">
                <div className="size-12 bg-secondary flex items-center justify-center mb-5 border border-border">
                  <Mail className="size-6 text-foreground" />
                </div>
                <DialogTitle className="font-display text-3xl text-foreground italic tracking-tight">
                  Network Updates
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  Performance insights and standard block availability announcements.
                </DialogDescription>
              </DialogHeader>

              {isError && (
                <div className="mb-6 p-4 border border-destructive/30 bg-destructive/10 text-destructive text-xs font-medium flex items-center gap-3">
                  <div className="size-2 bg-destructive animate-pulse" />
                  Issue processing request.
                </div>
              )}

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-foreground">
                          Email Address
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="you@company.com" {...field} className="rounded-none border-border bg-background h-12 px-4 shadow-sm text-foreground" data-testid="input-waitlist-email" />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="marketingConsent"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="mt-1 rounded-none border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                          />
                        </FormControl>
                        <div className="space-y-2 leading-none">
                          <FormLabel className="text-xs font-medium text-foreground cursor-pointer">
                            Receive Communications
                          </FormLabel>
                          <FormDescription className="text-xs text-muted-foreground leading-relaxed">
                            Updates on network performance. Unsubscribe any time.
                          </FormDescription>
                          <FormMessage className="text-xs" />
                        </div>
                      </FormItem>
                    )}
                  />

                  <div className="pt-6 flex justify-end gap-3 border-t border-border">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => onOpenChange(false)}
                      className="rounded-none font-medium hover:bg-secondary text-foreground h-12 px-6"
                      data-testid="button-cancel-waitlist"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isPending}
                      className="rounded-none bg-primary text-primary-foreground hover:opacity-90 h-12 px-8"
                      data-testid="button-submit-waitlist"
                    >
                      {isPending ? (
                        <Loader2 className="size-5 animate-spin" />
                      ) : (
                        "Subscribe"
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
              className="p-10 flex flex-col items-center justify-center text-center min-h-[400px]"
            >
              <div className="size-16 bg-secondary border border-border flex items-center justify-center mb-8">
                <CheckCircle2 className="size-8 text-foreground" />
              </div>

              <h2 className="font-display text-3xl text-foreground italic tracking-tight mb-4">
                 Subscribed
              </h2>

              <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
                You've been added to the secure updates list.
              </p>

              <div className="border border-border bg-secondary p-4 w-full max-w-[200px] mb-8 relative">
                 <p className="text-xs text-muted-foreground mb-2">Reference</p>
                 <div className="font-medium text-foreground tracking-widest" data-testid="text-request-reference">
                    {data.requestId.slice(0, 8).toUpperCase()}
                 </div>
              </div>

              <Button
                onClick={() => onOpenChange(false)}
                variant="outline"
                className="rounded-none border-border text-foreground hover:bg-secondary h-12 px-10"
                data-testid="button-close-waitlist-success"
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