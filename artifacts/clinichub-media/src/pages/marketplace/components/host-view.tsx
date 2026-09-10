import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useCreateMarketplaceHost, useGetMarketplaceHost, getGetMarketplaceHostQueryKey } from '@workspace/api-client-react';
import { useLocalStorage, useSessionStorage } from '@/hooks/use-local-storage';
import { CopyPanel } from './copy-panel';
import { PlacementManager } from './placement-manager';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { MarketplaceHost, MarketplaceHostAccess } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';

const hostSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(120, "Name too long"),
});

export function HostView() {
  const [storedHost, setStoredHost] = useLocalStorage<MarketplaceHost | null>('marketplace_host_profile', null);
  const [partnerKey, setPartnerKey] = useSessionStorage<string | null>('marketplace_host_partner_key', null);
  const [reconnectKey, setReconnectKey] = useState('');
  const createHost = useCreateMarketplaceHost();
  const { toast } = useToast();

  useEffect(() => {
    const legacy = window.localStorage.getItem('marketplace_host');
    if (!legacy) return;
    try {
      const parsed = JSON.parse(legacy) as MarketplaceHostAccess;
      const { partnerKey: legacyKey, ...profile } = parsed;
      setStoredHost(profile);
      setPartnerKey(legacyKey);
    } catch {
      // Discard malformed legacy state rather than retaining credentials.
    } finally {
      window.localStorage.removeItem('marketplace_host');
    }
  }, [setPartnerKey, setStoredHost]);

  const { data: host, isLoading, isError } = useGetMarketplaceHost(storedHost?.id ?? '', {
    query: {
      enabled: !!storedHost?.id && !!partnerKey,
      queryKey: getGetMarketplaceHostQueryKey(storedHost?.id ?? ''),
      refetchInterval: 15000,
    },
    request: {
      headers: {
        'x-marketplace-partner-key': partnerKey ?? ''
      }
    }
  });

  const form = useForm<z.infer<typeof hostSchema>>({
    resolver: zodResolver(hostSchema),
    defaultValues: { name: '' },
  });

  const onSubmit = (values: z.infer<typeof hostSchema>) => {
    createHost.mutate({ data: { name: values.name } }, {
      onSuccess: (data) => {
        const { partnerKey: createdKey, ...profile } = data;
        setStoredHost(profile);
        setPartnerKey(createdKey);
        toast({ title: 'Enrollment successful', description: 'Your host account has been created.' });
      },
      onError: () => {
        toast({ variant: 'destructive', title: 'Enrollment failed', description: 'Please try again later.' });
      }
    });
  };

  const currentHost = host || storedHost;

  if (storedHost && !partnerKey) {
    return (
      <Card className="border-border max-w-2xl">
        <CardHeader>
          <CardTitle className="font-display text-2xl">Reconnect Host Access</CardTitle>
          <CardDescription>
            Enter the partner key you saved for {storedHost.name}. Keys are kept only for this browser tab.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="password"
            value={reconnectKey}
            onChange={(event) => setReconnectKey(event.target.value)}
            placeholder="Partner key"
            data-testid="input-host-reconnect-key"
          />
          <div className="flex gap-3">
            <Button
              onClick={() => setPartnerKey(reconnectKey.trim())}
              disabled={!reconnectKey.trim()}
              data-testid="btn-reconnect-host"
            >
              Reconnect
            </Button>
            <Button variant="outline" onClick={() => setStoredHost(null)} data-testid="btn-forget-host">
              Forget this host
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (storedHost) {
    if (isLoading && !host) {
      return (
        <Card className="border-border animate-in fade-in max-w-2xl">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center">
            <Loader2 className="size-8 animate-spin text-primary mb-4" />
            <p className="font-medium text-muted-foreground">Loading host status...</p>
          </CardContent>
        </Card>
      );
    }
    if (isError) {
      return (
        <Card className="border-border border-destructive/50 max-w-2xl">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center">
            <p className="font-bold text-destructive mb-2">Failed to load host</p>
            <p className="text-sm font-medium text-muted-foreground mb-4">Your partner key may be invalid or the service is down.</p>
            <Button variant="outline" onClick={() => { setPartnerKey(null); setStoredHost(null); }} data-testid="btn-clear-stored-host">Clear stored host</Button>
          </CardContent>
        </Card>
      );
    }

    if (currentHost) {
      return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="border-border">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 text-primary rounded-md">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <CardTitle className="font-display text-xl">Host Enrolled</CardTitle>
                  <CardDescription className="font-medium mt-1">You are currently enrolled as a publisher host.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">Host Name</p>
                  <p className="font-medium">{currentHost.name}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">Status</p>
                  <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary capitalize tracking-wide" data-testid="status-host">
                    {currentHost.status}
                  </div>
                </div>
              </div>

              <CopyPanel
                id="host_partner_key"
                label="Partner Key"
                value={partnerKey ?? ''}
                description="Used to authenticate as this host. Include in the x-marketplace-partner-key header."
              />
            </CardContent>
          </Card>

          <PlacementManager hostId={currentHost.id} partnerKey={partnerKey ?? ''} hostStatus={currentHost.status} />
        </div>
      );
    }
  }

  return (
    <Card className="border-border animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl">
      <CardHeader>
        <CardTitle className="font-display text-2xl">Enroll as a Host</CardTitle>
        <CardDescription className="font-medium text-base">
          Join Birch Reserve to monetize your health-adjacent media properties. Subject to approval.
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
                  <FormLabel className="font-bold">Organization Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Health Media" {...field} className="h-11" data-testid="input-host-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              size="lg"
              className="w-full font-bold tracking-wide"
              disabled={createHost.isPending}
              data-testid="btn-enroll-host"
            >
              {createHost.isPending ? 'Submitting...' : 'Submit Enrollment Request'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
