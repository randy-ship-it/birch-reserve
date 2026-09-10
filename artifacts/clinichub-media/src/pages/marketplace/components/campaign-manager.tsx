import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCreateMarketplaceCampaign, useListMarketplaceCampaigns, getListMarketplaceCampaignsQueryKey } from '@workspace/api-client-react';
import { Plus, Target, Lock, Loader2 } from 'lucide-react';
import { MarketplaceCampaign, MarketplaceCampaignInputCurrency } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

const httpsUrl = z.string().url().min(8).max(2048).refine((value) => value.startsWith('https://'), {
  message: 'Use a secure HTTPS URL',
});

const campaignSchema = z.object({
  name: z.string().min(2).max(120),
  category: z.string().min(2).max(60),
  creativeUrl: httpsUrl,
  creativeText: z.string().max(1000).optional(),
  destinationUrl: httpsUrl,
  width: z.coerce.number().min(1).max(5000),
  height: z.coerce.number().min(1).max(5000),
  bidCpmCents: z.coerce.number().min(1).max(100000),
  budgetCents: z.coerce.number().min(100).max(100000000),
  currency: z.enum(['usd', 'cad']),
  startsAt: z.string(),
  endsAt: z.string(),
}).refine((value) => value.endsAt > value.startsAt, {
  message: 'End date must follow start date',
  path: ['endsAt'],
});

interface CampaignManagerProps {
  advertiserId: string;
  partnerKey: string;
  advertiserStatus: string;
}

export function CampaignManager({ advertiserId, partnerKey, advertiserStatus }: CampaignManagerProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, isError } = useListMarketplaceCampaigns(
    { advertiserId },
    {
      query: {
        enabled: !!advertiserId,
        queryKey: getListMarketplaceCampaignsQueryKey({ advertiserId }),
        refetchInterval: 15000,
      },
      request: {
        headers: {
          'x-marketplace-partner-key': partnerKey
        }
      }
    }
  );
  const serverCampaigns = data as MarketplaceCampaign[] | undefined;

  const createCampaign = useCreateMarketplaceCampaign({
    request: {
      headers: {
        'x-marketplace-partner-key': partnerKey
      }
    }
  });
  const isApproved = advertiserStatus === 'approved';

  const form = useForm<z.infer<typeof campaignSchema>>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      name: '',
      category: 'health',
      creativeUrl: '',
      creativeText: '',
      destinationUrl: '',
      width: 728,
      height: 90,
      bidCpmCents: 1500,
      budgetCents: 50000,
      currency: 'usd',
      startsAt: new Date().toISOString().split('T')[0],
      endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    },
  });

  const onSubmit = (values: z.infer<typeof campaignSchema>) => {
    createCampaign.mutate({
      data: {
        advertiserId,
        name: values.name,
        category: values.category,
        creativeUrl: values.creativeUrl,
        creativeText: values.creativeText || undefined,
        destinationUrl: values.destinationUrl,
        width: values.width,
        height: values.height,
        bidCpmCents: values.bidCpmCents,
        budgetCents: values.budgetCents,
        currency: values.currency as MarketplaceCampaignInputCurrency,
        startsAt: new Date(`${values.startsAt}T00:00:00.000Z`).toISOString(),
        endsAt: new Date(`${values.endsAt}T23:59:59.999Z`).toISOString(),
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMarketplaceCampaignsQueryKey({ advertiserId }) });
        setOpen(false);
        form.reset();
        toast({ title: 'Campaign submitted', description: 'Your campaign is now pending review.' });
      },
      onError: () => {
        toast({ variant: 'destructive', title: 'Failed to submit campaign', description: 'Check your details and try again.' });
      }
    });
  };

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-start justify-between pb-4">
        <div>
          <CardTitle className="font-display text-xl">Campaigns</CardTitle>
          <CardDescription className="font-medium mt-1">Submit creatives for controlled review and activation.</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="font-bold tracking-wide" disabled={!isApproved} data-testid="btn-add-campaign">
              {isApproved ? (
                <><Plus className="size-4 mr-2" /> New Campaign</>
              ) : (
                <><Lock className="size-4 mr-2" /> Pending Approval</>
              )}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Submit Campaign</DialogTitle>
              <DialogDescription className="font-medium">
                Campaigns are manually reviewed before they can be approved for delivery.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">Campaign Name</FormLabel>
                      <FormControl><Input placeholder="Q3 Acquisition" {...field} data-testid="input-campaign-name" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="category" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">Category</FormLabel>
                      <FormControl><Input placeholder="dental" {...field} data-testid="input-campaign-category" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="creativeUrl" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">Creative Asset URL</FormLabel>
                      <FormControl><Input placeholder="https://..." {...field} data-testid="input-campaign-creative" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="destinationUrl" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">Destination URL</FormLabel>
                      <FormControl><Input placeholder="https://..." {...field} data-testid="input-campaign-dest" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="creativeText" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold">Creative Text (optional)</FormLabel>
                    <FormControl><Textarea placeholder="Alt text or copy for native placements" {...field} className="resize-none" data-testid="input-campaign-text" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="width" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">Width (px)</FormLabel>
                      <FormControl><Input type="number" {...field} data-testid="input-campaign-width" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="height" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">Height (px)</FormLabel>
                      <FormControl><Input type="number" {...field} data-testid="input-campaign-height" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <FormField control={form.control} name="bidCpmCents" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">Bid CPM (Cents)</FormLabel>
                      <FormControl><Input type="number" {...field} data-testid="input-campaign-cpm" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="budgetCents" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">Total Budget</FormLabel>
                      <FormControl><Input type="number" {...field} data-testid="input-campaign-budget" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="currency" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">Currency</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-campaign-currency"><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="usd">USD</SelectItem>
                          <SelectItem value="cad">CAD</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="startsAt" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">Start Date</FormLabel>
                      <FormControl><Input type="date" {...field} data-testid="input-campaign-start" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="endsAt" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">End Date</FormLabel>
                      <FormControl><Input type="date" {...field} data-testid="input-campaign-end" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <Button
                  type="submit"
                  className="w-full font-bold tracking-wide mt-4"
                  disabled={createCampaign.isPending}
                  data-testid="btn-submit-campaign"
                >
                  {createCampaign.isPending ? 'Submitting...' : 'Submit Campaign'}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isError ? (
          <div className="py-10 text-center border border-destructive/30 bg-destructive/5 rounded-lg" data-testid="status-campaigns-error">
            <p className="font-bold text-destructive">Campaigns could not be refreshed.</p>
            <p className="text-sm text-muted-foreground mt-1">Check the saved advertiser key and try again.</p>
          </div>
        ) : isLoading && (!serverCampaigns || serverCampaigns.length === 0) ? (
          <div className="py-12 flex flex-col items-center justify-center text-center bg-muted/30 border border-dashed border-border rounded-lg">
            <Loader2 className="size-6 animate-spin text-primary mb-3" />
            <p className="text-sm font-medium text-muted-foreground max-w-sm">
              Loading campaigns...
            </p>
          </div>
        ) : !serverCampaigns || serverCampaigns.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center bg-muted/30 border border-dashed border-border rounded-lg">
            <div className="p-3 bg-muted rounded-full mb-3 text-muted-foreground">
              <Target className="size-6" />
            </div>
            <h4 className="font-bold text-foreground mb-1">No campaigns yet</h4>
            <p className="text-sm font-medium text-muted-foreground max-w-sm">
              {isApproved ? 'Submit your first creative campaign for review.' : 'You must be approved by the network before submitting campaigns.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {serverCampaigns.map((c) => (
              <div key={c.id} className="p-5 border border-border rounded-lg bg-card" data-testid={`campaign-card-${c.id}`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-display font-bold text-lg mb-1">{c.name}</h4>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground font-medium">
                      <div className="flex items-center gap-1.5 text-foreground">
                        <div className={`size-2 rounded-full ${c.status === 'approved' ? 'bg-green-500' : c.status === 'submitted' ? 'bg-yellow-500' : 'bg-muted-foreground'}`} />
                        <span className="capitalize" data-testid={`status-campaign-${c.id}`}>{c.status}</span>
                      </div>
                      <span>•</span>
                      <span>{c.width}x{c.height}px</span>
                      <span>•</span>
                      <span>Bid: {(c.bidCpmCents / 100).toFixed(2)} {c.currency.toUpperCase()}</span>
                      <span>•</span>
                      <span>Budget: ${(c.budgetCents / 100).toLocaleString()}</span>
                    </div>
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
