import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateMarketplacePlacement, useListMarketplacePlacements, getListMarketplacePlacementsQueryKey } from '@workspace/api-client-react';
import { useSessionStorage } from '@/hooks/use-local-storage';
import { CopyPanel } from './copy-panel';
import { Plus, LayoutTemplate, Loader2 } from 'lucide-react';
import { MarketplacePlacement, MarketplacePlacementAccess, MarketplacePlacementInputCurrency } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

const placementSchema = z.object({
  name: z.string().min(2).max(120),
  floorCpmCents: z.coerce.number().min(1).max(100000),
  currency: z.enum(['usd', 'cad']),
  allowedCategories: z.string().min(2),
  width: z.coerce.number().min(1).max(5000),
  height: z.coerce.number().min(1).max(5000),
  vetoTerms: z.string().optional(),
  exclusivityHours: z.coerce.number().min(1).max(720).optional(),
});

interface PlacementManagerProps {
  hostId: string;
  partnerKey: string;
  hostStatus: string;
}

export function PlacementManager({ hostId, partnerKey, hostStatus }: PlacementManagerProps) {
  const [localPlacements, setLocalPlacements] = useSessionStorage<MarketplacePlacementAccess[]>('marketplace_placement_secrets', []);
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isApproved = hostStatus === 'approved';

  useEffect(() => {
    const legacy = window.localStorage.getItem('marketplace_placements');
    if (!legacy) return;
    try {
      const parsed = JSON.parse(legacy) as MarketplacePlacementAccess[];
      if (localPlacements.length === 0) setLocalPlacements(parsed);
    } catch {
      // Discard malformed legacy state rather than retaining credentials.
    } finally {
      window.localStorage.removeItem('marketplace_placements');
    }
  }, [localPlacements.length, setLocalPlacements]);

  const { data, isLoading, isError } = useListMarketplacePlacements(
    { hostId },
    {
      query: {
        enabled: !!hostId,
        queryKey: getListMarketplacePlacementsQueryKey({ hostId }),
        refetchInterval: 15000,
      },
      request: {
        headers: {
          'x-marketplace-partner-key': partnerKey
        }
      }
    }
  );
  const serverPlacements = data as MarketplacePlacement[] | undefined;

  const createPlacement = useCreateMarketplacePlacement({
    request: {
      headers: {
        'x-marketplace-partner-key': partnerKey
      }
    }
  });

  const form = useForm<z.infer<typeof placementSchema>>({
    resolver: zodResolver(placementSchema),
    defaultValues: {
      name: '',
      floorCpmCents: 1000,
      currency: 'usd',
      allowedCategories: 'health,wellness',
      width: 728,
      height: 90,
      vetoTerms: '',
      exclusivityHours: 24,
    },
  });

  const onSubmit = (values: z.infer<typeof placementSchema>) => {
    createPlacement.mutate({
      data: {
        hostId,
        name: values.name,
        floorCpmCents: values.floorCpmCents,
        currency: values.currency as MarketplacePlacementInputCurrency,
        allowedCategories: values.allowedCategories.split(',').map(s => s.trim()).filter(Boolean),
        width: values.width,
        height: values.height,
        vetoTerms: values.vetoTerms ? values.vetoTerms.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        exclusivityHours: values.exclusivityHours,
      }
    }, {
      onSuccess: (data) => {
        setLocalPlacements([...localPlacements, data]);
        queryClient.invalidateQueries({ queryKey: getListMarketplacePlacementsQueryKey({ hostId }) });
        setOpen(false);
        form.reset();
        toast({ title: 'Placement created', description: 'Your placement was successfully defined.' });
      },
      onError: (err) => {
        toast({ variant: 'destructive', title: 'Failed to create placement', description: 'Check your details and try again.' });
      }
    });
  };

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-start justify-between pb-4">
        <div>
          <CardTitle className="font-display text-xl">Approved Placements</CardTitle>
          <CardDescription className="font-medium mt-1">Define properties of media locations to accept campaigns.</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="font-bold tracking-wide" disabled={!isApproved} data-testid="btn-add-placement">
              <Plus className="size-4 mr-2" />
              {isApproved ? 'New Placement' : 'Pending Approval'}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Create Placement</DialogTitle>
              <DialogDescription className="font-medium">
                Define the requirements and constraints for a new media surface.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold">Placement Name</FormLabel>
                    <FormControl><Input placeholder="Homepage Leaderboard" {...field} data-testid="input-placement-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="floorCpmCents" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">Floor CPM (Cents)</FormLabel>
                      <FormControl><Input type="number" {...field} data-testid="input-placement-cpm" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="currency" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">Currency</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-placement-currency"><SelectValue /></SelectTrigger>
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
                  <FormField control={form.control} name="width" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">Width (px)</FormLabel>
                      <FormControl><Input type="number" {...field} data-testid="input-placement-width" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="height" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">Height (px)</FormLabel>
                      <FormControl><Input type="number" {...field} data-testid="input-placement-height" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="allowedCategories" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold">Allowed Categories (comma separated)</FormLabel>
                    <FormControl><Input placeholder="health, fitness, wellness" {...field} data-testid="input-placement-categories" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="vetoTerms" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold">Veto Terms (comma separated, optional)</FormLabel>
                    <FormControl><Input placeholder="competitor-brand" {...field} data-testid="input-placement-veto" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="exclusivityHours" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold">Category Exclusivity Window (hours)</FormLabel>
                    <FormControl><Input type="number" {...field} data-testid="input-placement-exclusivity" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <Button
                  type="submit"
                  className="w-full font-bold tracking-wide mt-4"
                  disabled={createPlacement.isPending}
                  data-testid="btn-submit-placement"
                >
                  {createPlacement.isPending ? 'Saving...' : 'Save Placement'}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isError ? (
          <div className="py-10 text-center border border-destructive/30 bg-destructive/5 rounded-lg" data-testid="status-placements-error">
            <p className="font-bold text-destructive">Placements could not be refreshed.</p>
            <p className="text-sm text-muted-foreground mt-1">Check the saved host key and try again.</p>
          </div>
        ) : isLoading && (!serverPlacements || serverPlacements.length === 0) ? (
          <div className="py-12 flex flex-col items-center justify-center text-center bg-muted/30 border border-dashed border-border rounded-lg">
            <Loader2 className="size-6 animate-spin text-primary mb-3" />
            <p className="text-sm font-medium text-muted-foreground max-w-sm">
              Loading placements...
            </p>
          </div>
        ) : !serverPlacements || serverPlacements.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center bg-muted/30 border border-dashed border-border rounded-lg">
            <div className="p-3 bg-muted rounded-full mb-3 text-muted-foreground">
              <LayoutTemplate className="size-6" />
            </div>
            <h4 className="font-bold text-foreground mb-1">No placements yet</h4>
            <p className="text-sm font-medium text-muted-foreground max-w-sm">
              Define the first media surface where approved campaigns can be delivered.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {serverPlacements.map((p) => {
              const secrets = localPlacements.find(lp => lp.id === p.id);
              return (
                <div key={p.id} className="p-5 border border-border rounded-lg bg-card" data-testid={`placement-card-${p.id}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-display font-bold text-lg">{p.name}</h4>
                      <div className="flex gap-3 text-sm text-muted-foreground font-medium mt-1">
                        <span>{p.width}x{p.height}px</span>
                        <span>•</span>
                        <span>{(p.floorCpmCents / 100).toFixed(2)} {p.currency.toUpperCase()} CPM</span>
                        <span>•</span>
                        <span className="capitalize" data-testid={`status-placement-${p.id}`}>{p.status}</span>
                      </div>
                    </div>
                  </div>

                  {secrets && (
                    <div className="grid md:grid-cols-2 gap-4">
                      <CopyPanel
                        id={`placement_key_${p.id}`}
                        label="Placement Key"
                        value={secrets.placementKey}
                        description="Used to request delivery for this specific placement."
                      />
                      <CopyPanel
                        id={`event_secret_${p.id}`}
                        label="Event Signing Secret"
                        value={secrets.eventSigningSecret}
                        description="Used to HMAC-sign aggregate delivery event bodies."
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
