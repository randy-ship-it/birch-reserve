import { useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HostView } from './components/host-view';
import { AdvertiserView } from './components/advertiser-view';

export default function Marketplace() {
  useEffect(() => {
    document.title = 'Birch Reserve | Private Marketplace Workspace';
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = description?.content;
    if (description) {
      description.content = 'A controlled private media marketplace for approved hosts and brand-safe campaigns.';
    }
    return () => {
      document.title = 'Birch Reserve | Private Distribution Marketplace';
      if (description && previousDescription) description.content = previousDescription;
    };
  }, []);

  return (
    <div className="flex-1 w-full bg-background min-h-[90vh] text-foreground">
      <div className="border-b border-border bg-secondary/20">
        <div className="container mx-auto px-6 pt-24 pb-16 max-w-5xl">
          <div className="flex items-center gap-3 mb-8">
             <span className="font-medium text-muted-foreground tracking-widest uppercase text-xs">Birch Reserve Pilot</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-display tracking-tight text-foreground mb-6 italic">
            Partner Workspace.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
             Connects approved hosts with vetted buyers across controlled placements.
             Participation governed by explicit approvals. Not an open exchange.
          </p>
          <div className="mt-8 border-l border-border pl-4">
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed" data-testid="text-marketplace-privacy">
              Hosts opt in placement by placement. Delivery reporting is limited to campaign, placement, event, and timestamp identifiers—never patient or health data.
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12 max-w-5xl">
        <Tabs defaultValue="host" className="w-full">
          <TabsList className="mb-12 p-0 bg-transparent rounded-none inline-flex w-full md:w-auto h-12 border border-border">
            <TabsTrigger
              value="host"
              className="flex-1 md:w-48 font-medium text-sm rounded-none h-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground hover:bg-secondary transition-colors"
              data-testid="tab-host"
            >
              For Hosts
            </TabsTrigger>
            <div className="w-px h-full bg-border" />
            <TabsTrigger
              value="advertiser"
              className="flex-1 md:w-48 font-medium text-sm rounded-none h-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground hover:bg-secondary transition-colors"
              data-testid="tab-advertiser"
            >
              For Advertisers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="host" className="focus-visible:outline-none">
            <HostView />
          </TabsContent>
          <TabsContent value="advertiser" className="focus-visible:outline-none">
            <AdvertiserView />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
