import { useEffect, useState } from 'react';
import { EditorialLayout } from '@/components/editorial-layout';
import { useListEditorialSources, useListEditorialContext, useCreateEditorialSource, useCreateEditorialPublicContext, useApproveEditorialSource, getListEditorialSourcesQueryKey, getListEditorialContextQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Database, Link as LinkIcon, Plus, FileText, Globe, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

import { isAccessError } from '@/lib/access-utils';
import { EditorialAccessDenied } from '@/components/editorial-access-denied';

export default function EditorialSources() {
  const [accessDeniedStatus, setAccessDeniedStatus] = useState<number | null>(null);
  const { data: sources, isLoading: isLoadingSources, error: sourcesError } = useListEditorialSources({
    query: {
      queryKey: getListEditorialSourcesQueryKey(),
      enabled: accessDeniedStatus === null,
      refetchInterval: 1000 * 60 * 5,
      refetchOnWindowFocus: true
    }
  });
  const { data: contexts, isLoading: isLoadingContexts, error: contextsError } = useListEditorialContext({
    query: {
      queryKey: getListEditorialContextQueryKey(),
      enabled: accessDeniedStatus === null,
      refetchInterval: 1000 * 60 * 5,
      refetchOnWindowFocus: true
    }
  });
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isSourceDialogOpen, setIsSourceDialogOpen] = useState(false);
  const [isContextDialogOpen, setIsContextDialogOpen] = useState(false);
  
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourcePublisher, setSourcePublisher] = useState('');
  const [sourceExcerpt, setSourceExcerpt] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceType, setSourceType] = useState<'research' | 'government' | 'standards_body'>('research');
  const [evidenceType, setEvidenceType] = useState('');
  const [publicationDateLabel, setPublicationDateLabel] = useState('');
  const [relevance, setRelevance] = useState('');
  const [limitations, setLimitations] = useState('');
  const [sourceErrorMsg, setSourceErrorMsg] = useState('');

  const [contextName, setContextName] = useState('');
  const [contextContent, setContextContent] = useState('');

  const createSource = useCreateEditorialSource({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEditorialSourcesQueryKey() });
        toast({ title: 'Source added to evidence base' });
        setIsSourceDialogOpen(false);
        setSourceTitle('');
        setSourcePublisher('');
        setSourceExcerpt('');
        setSourceUrl('');
        setEvidenceType('');
        setPublicationDateLabel('');
        setRelevance('');
        setLimitations('');
        setSourceErrorMsg('');
      },
      onError: () => {
        toast({ title: 'Failed to add source', variant: 'destructive' });
      }
    }
  });

  const createContext = useCreateEditorialPublicContext({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEditorialContextQueryKey() });
        toast({ title: 'Public context added' });
        setIsContextDialogOpen(false);
        setContextName('');
        setContextContent('');
      },
      onError: () => {
        toast({ title: 'Failed to add context', variant: 'destructive' });
      }
    }
  });

  const approveSource = useApproveEditorialSource({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEditorialSourcesQueryKey() });
        toast({ title: 'Source approved' });
      },
      onError: () => {
        toast({ title: 'Failed to approve source', variant: 'destructive' });
      }
    }
  });

  const handleCreateSource = (e: React.FormEvent) => {
    e.preventDefault();
    setSourceErrorMsg('');
    if (relevance.length < 20) return setSourceErrorMsg('Relevance must be at least 20 characters.');
    if (limitations.length < 20) return setSourceErrorMsg('Limitations must be at least 20 characters.');
    if (sourceExcerpt.length < 40) return setSourceErrorMsg('Excerpt must be at least 40 characters.');
    
    createSource.mutate({
      data: {
        canonicalUrl: sourceUrl,
        publisher: sourcePublisher,
        title: sourceTitle,
        evidenceType: evidenceType || 'article',
        publicationDateLabel: publicationDateLabel || 'Unknown',
        relevance,
        limitations,
        excerpt: sourceExcerpt,
        sourceType,
      }
    });
  };

  const handleCreateContext = (e: React.FormEvent) => {
    e.preventDefault();
    createContext.mutate({
      data: {
        name: contextName,
        content: contextContent,
        approved: true,
      }
    });
  };

  useEffect(() => {
    document.title = 'Evidence Base | Editorial Desk';
  }, []);

  useEffect(() => {
    const accessError = [sourcesError, contextsError].find(isAccessError);
    if (accessError) setAccessDeniedStatus(accessError.status);
  }, [sourcesError, contextsError]);

  const currentAccessError = [sourcesError, contextsError].find(isAccessError);
  const deniedStatus = accessDeniedStatus ?? currentAccessError?.status;

  if (deniedStatus) {
    return <EditorialAccessDenied errorStatus={deniedStatus} />;
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <EditorialLayout>
      <div className="flex-1 overflow-auto bg-background p-6 md:p-10">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="flex justify-between items-end border-b border-border pb-6">
            <div>
              <h1 className="font-display text-4xl mb-2">Evidence Base</h1>
              <p className="text-muted-foreground">Manage verified sources and public context data.</p>
            </div>
            <div className="flex gap-4">
              <Dialog open={isContextDialogOpen} onOpenChange={setIsContextDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="rounded-none border-border">
                    <Plus className="mr-2 size-4" /> Add Context
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-none border-border sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle className="font-display text-2xl">Add Public Context</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateContext} className="space-y-6 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="context-name">Entity / Domain</Label>
                      <Input 
                        id="context-name" 
                        value={contextName} 
                        onChange={e => setContextName(e.target.value)} 
                        required 
                        className="rounded-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="context-content">Fact Statement</Label>
                      <Textarea 
                        id="context-content" 
                        value={contextContent} 
                        onChange={e => setContextContent(e.target.value)} 
                        required 
                        className="rounded-none resize-none h-32"
                      />
                    </div>
                    <Button type="submit" disabled={createContext.isPending} className="w-full rounded-none bg-foreground text-background hover:bg-foreground/90">
                      {createContext.isPending ? 'Adding...' : 'Add Context'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={isSourceDialogOpen} onOpenChange={setIsSourceDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-none bg-foreground text-background hover:bg-foreground/90">
                    <Plus className="mr-2 size-4" /> Add Source
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-none border-border sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle className="font-display text-2xl">Add New Source</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateSource} className="space-y-6 pt-4 max-h-[70vh] overflow-y-auto px-1">
                    {sourceErrorMsg && <div className="text-sm text-destructive bg-destructive/10 p-3 border border-destructive/20">{sourceErrorMsg}</div>}
                    <div className="space-y-2">
                      <Label htmlFor="title">Title / Headline</Label>
                      <Input id="title" value={sourceTitle} onChange={e => setSourceTitle(e.target.value)} required className="rounded-none" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="publisher">Publisher / Origin</Label>
                      <Input id="publisher" value={sourcePublisher} onChange={e => setSourcePublisher(e.target.value)} required className="rounded-none" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="url">Canonical URL</Label>
                      <Input id="url" type="url" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} required className="rounded-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="evidenceType">Evidence Type</Label>
                        <Input id="evidenceType" value={evidenceType} onChange={e => setEvidenceType(e.target.value)} required placeholder="e.g. Clinical Trial" className="rounded-none" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="publicationDateLabel">Date Label</Label>
                        <Input id="publicationDateLabel" value={publicationDateLabel} onChange={e => setPublicationDateLabel(e.target.value)} required placeholder="e.g. Oct 2023" className="rounded-none" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sourceType">Source Type</Label>
                      <select
                        id="sourceType"
                        value={sourceType}
                        onChange={(e) => setSourceType(e.target.value as any)}
                        className="w-full h-10 border border-border bg-background px-3 py-2 text-sm rounded-none"
                      >
                        <option value="research">Research</option>
                        <option value="government">Government</option>
                        <option value="standards_body">Standards Body</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="relevance">Relevance (min 20 chars)</Label>
                      <Textarea id="relevance" value={relevance} onChange={e => setRelevance(e.target.value)} required className="rounded-none resize-none h-16" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="limitations">Limitations (min 20 chars)</Label>
                      <Textarea id="limitations" value={limitations} onChange={e => setLimitations(e.target.value)} required className="rounded-none resize-none h-16" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="excerpt">Excerpt / Key Finding (min 40 chars)</Label>
                      <Textarea id="excerpt" value={sourceExcerpt} onChange={e => setSourceExcerpt(e.target.value)} required className="rounded-none resize-none h-24" />
                    </div>
                    <Button type="submit" disabled={createSource.isPending} className="w-full rounded-none">
                      {createSource.isPending ? 'Adding...' : 'Add Source'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Tabs defaultValue="sources" className="w-full">
            <TabsList className="bg-secondary/10 border border-border p-0 h-12 rounded-none mb-8">
              <TabsTrigger value="sources" className="rounded-none data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-b-accent h-full px-8 uppercase tracking-widest text-[10px] font-semibold">
                <FileText className="mr-2 size-3.5" /> Cited Sources
              </TabsTrigger>
              <TabsTrigger value="context" className="rounded-none data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-b-accent h-full px-8 uppercase tracking-widest text-[10px] font-semibold">
                <Globe className="mr-2 size-3.5" /> Public Context
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="sources" className="m-0 focus-visible:outline-none focus-visible:ring-0">
              {isLoadingSources ? (
                <div className="text-center py-12 text-muted-foreground">Loading sources...</div>
              ) : sources && sources.length > 0 ? (
                <div className="grid gap-4">
                  {sources.map(source => (
                    <div key={source.id} className="bg-background border border-border p-6 flex flex-col md:flex-row gap-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`text-[10px] uppercase tracking-wider font-semibold border px-2 py-0.5 ${
                            source.approvedAt 
                              ? 'border-accent/30 text-accent bg-accent/10' 
                              : 'border-muted text-muted-foreground bg-secondary/50'
                          }`}>
                            {source.approvedAt ? 'Approved' : 'Pending'}
                          </span>
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground border border-border px-2 py-0.5">
                            {source.evidenceType}
                          </span>
                          <span className="text-xs text-muted-foreground">{source.publisher}</span>
                        </div>
                        <h3 className="font-medium text-lg mb-2">{source.title}</h3>
                        <p className="text-sm text-foreground/80 italic border-l-2 border-accent pl-3 mb-4 line-clamp-2">
                          "{source.excerpt}"
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Pub: {source.publicationDateLabel}</span>
                          <span>Accessed: {formatter.format(new Date(source.accessedAt))}</span>
                          {source.canonicalUrl && (
                            <a href={source.canonicalUrl} target="_blank" rel="noopener noreferrer" className="flex items-center text-accent hover:underline">
                              <LinkIcon className="mr-1 size-3" /> View Source
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="md:w-64 flex flex-col gap-4">
                        <div className="bg-secondary/5 p-4 text-sm border border-border flex-1">
                          <div className="font-medium mb-1">Relevance</div>
                          <div className="text-muted-foreground mb-3">{source.relevance}</div>
                          <div className="font-medium mb-1">Limitations</div>
                          <div className="text-muted-foreground">{source.limitations}</div>
                        </div>
                        {!source.approvedAt && (
                          <Button 
                            className="w-full rounded-none bg-accent text-accent-foreground hover:bg-accent/90"
                            onClick={() => approveSource.mutate({ sourceId: source.id, data: {} })}
                            disabled={approveSource.isPending}
                          >
                            <CheckCircle2 className="size-4 mr-2" /> Approve Source
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 border border-border bg-secondary/5">
                  <Database className="size-10 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-display text-xl mb-2">No sources found</h3>
                  <p className="text-muted-foreground">Add verified sources to build the evidence base.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="context" className="m-0 focus-visible:outline-none focus-visible:ring-0">
              {isLoadingContexts ? (
                <div className="text-center py-12 text-muted-foreground">Loading context data...</div>
              ) : contexts && contexts.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-4">
                  {contexts.map(context => (
                    <div key={context.id} className="bg-background border border-border p-5">
                      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
                        {context.name}
                      </div>
                      <h3 className="font-medium mb-3">{context.content}</h3>
                      <div className="text-xs text-muted-foreground">
                        Verified: {context.approvedAt ? formatter.format(new Date(context.approvedAt)) : 'Pending'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 border border-border bg-secondary/5">
                  <Globe className="size-10 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-display text-xl mb-2">No public context found</h3>
                  <p className="text-muted-foreground">Store verified facts and entity data here.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </EditorialLayout>
  );
}
