import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useCreateMarketplaceAdvertiser, useGetMarketplaceAdvertiser, getGetMarketplaceAdvertiserQueryKey } from '@workspace/api-client-react';
import { useLocalStorage, useSessionStorage } from '@/hooks/use-local-storage';
import { CopyPanel } from './copy-panel';
import { CampaignManager } from './campaign-manager';
import { BriefcaseBusiness, Loader2 } from 'lucide-react';
import { MarketplaceAdvertiser, MarketplaceAdvertiserAccess } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';

const advertiserSchema = z.object({
  name: z.string().min(2).max(120),
});

export function AdvertiserView() {
  const [storedAdvertiser, setStoredAdvertiser] = useLocalStorage<MarketplaceAdvertiser | null>('marketplace_advertiser_profile', null);
  const [partnerKey, setPartnerKey] = useSessionStorage<string | null>('marketplace_advertiser_partner_key', null);
  const [reconnectKey, setReconnectKey] = useState('');
  const createAdvertiser = useCreateMarketplaceAdvertiser();
  const { toast } = useToast();

  useEffect(() => {
    const legacy = window.localStorage.getItem('marketplace_advertiser');
    if (!legacy) return;
    try {
      const parsed = JSON.parse(legacy) as MarketplaceAdvertiserAccess;
      const { partnerKey: legacyKey, ...profile } = parsed;
      setStoredAdvertiser(profile);
      setPartnerKey(legacyKey);
    } catch {
      // Discard malformed legacy state rather than retaining credentials.
    } finally {
      window.localStorage.removeItem('marketplace_advertiser');
    }
  }, [setPartnerKey, setStoredAdvertiser]);

  const { data: advertiser, isLoading, isError } = useGetMarketplaceAdvertiser(storedAdvertiser?.id ?? '', {
    query: {
      enabled: !!storedAdvertiser?.id && !!partnerKey,
      queryKey: getGetMarketplaceAdvertiserQueryKey(storedAdvertiser?.id ?? ''),
      refetchInterval: 15000,
    },
    request: {
      headers: {
        'x-marketplace-partner-key': partnerKey ?? ''
      }
    }
  });

  const form = useForm<z.infer<typeof advertiserSchema>>({
    resolver: zodResolver(advertiserSchema),
    defaultValues: { name: '' },
  });

  const onSubmit = (values: z.infer<typeof advertiserSchema>) => {
    createAdvertiser.mutate({ data: { name: values.name } }, {
      onSuccess: (data) => {
        const { partnerKey: createdKey, ...profile } = data;
        setStoredAdvertiser(profile);
        setPartnerKey(createdKey);
        toast({ title: 'Enrollment successful', description: 'Your advertiser account has been created.' });
      },
      onError: () => {
        toast({ variant: 'destructive', title: 'Enrollment failed', description: 'Please try again later.' });
      }
    });
  };

  const currentAdvertiser = advertiser || storedAdvertiser;

  if (storedAdvertiser && !partnerKey) {
    return (
      <Card className="border-border max-w-2xl">
        <CardHeader>
          <CardTitle className="font-display text-2xl">Reconnect Advertiser Access</CardTitle>
          <CardDescription>
            Enter the partner key you saved for {storedAdvertiser.name}. Keys are kept only for this browser tab.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="password"
            value={reconnectKey}
            onChange={(event) => setReconnectKey(event.target.value)}
            placeholder="Partner key"
            data-testid="input-advertiser-reconnect-key"
          />
          <div className="flex gap-3">
            <Button
              onClick={() => setPartnerKey(reconnectKey.trim())}
              disabled={!reconnectKey.trim()}
              data-testid="btn-reconnect-advertiser"
            >
              Reconnect
            </Button>
            <Button variant="outline" onClick={() => setStoredAdvertiser(null)} data-testid="btn-forget-advertiser">
              Forget this advertiser
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (storedAdvertiser) {
    if (isLoading && !advertiser) {
      return (
        <Card className="border-border animate-in fade-in max-w-2xl">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center">
            <Loader2 className="size-8 animate-spin text-primary mb-4" />
            <p className="font-medium text-muted-foreground">Loading advertiser status...</p>
          </CardContent>
        </Card>
      );
    }
    if (isError) {
      return (
        <Card className="border-border border-destructive/50 max-w-2xl">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center">
            <p className="font-bold text-destructive mb-2">Failed to load advertiser</p>
            <p className="text-sm font-medium text-muted-foreground mb-4">Your partner key may be invalid or the service is down.</p>
            <Button variant="outline" onClick={() => { setPartnerKey(null); setStoredAdvertiser(null); }} data-testid="btn-clear-stored-advertiser">Clear stored advertiser</Button>
          </CardContent>
        </Card>
      );
    }

    if (currentAdvertiser) {
      return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="border-border">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 text-primary rounded-md">
                  <BriefcaseBusiness className="size-5" />
                </div>
                <div>
                  <CardTitle className="font-display text-xl">Advertiser Enrolled</CardTitle>
                  <CardDescription className="font-medium mt-1">You are currently enrolled as a brand advertiser.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">Brand Name</p>
                  <p className="font-medium">{currentAdvertiser.name}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">Status</p>
                  <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary capitalize tracking-wide" data-testid="status-advertiser">
                    {currentAdvertiser.status}
                  </div>
                </div>
              </div>

              <CopyPanel
                id="adv_partner_key"
                label="Partner Key"
                value={partnerKey ?? ''}
                description="Used to authenticate as this advertiser. Include in the x-marketplace-partner-key header."
              />
            </CardContent>
          </Card>

          <CampaignManager advertiserId={currentAdvertiser.id} partnerKey={partnerKey ?? ''} advertiserStatus={currentAdvertiser.status} />
        </div>
      );
    }
  }

  return (
    <Card className="border-border animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl">
      <CardHeader>
        <CardTitle className="font-display text-2xl">Enroll as an Advertiser</CardTitle>
        <CardDescription className="font-medium text-base">
          Join Birch Reserve to access exclusive, high-trust media properties. Subject to approval.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-bold">Brand Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Starlight Health" {...field} className="h-11" data-testid="input-advertiser-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              size="lg"
              className="w-full font-bold tracking-wide"
              disabled={createAdvertiser.isPending}
              data-testid="btn-enroll-advertiser"
            >
              {createAdvertiser.isPending ? 'Submitting...' : 'Submit Enrollment Request'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
