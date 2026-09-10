import { useEffect, useState } from 'react';
import { EditorialLayout } from '@/components/editorial-layout';
import { useListEditorialDrafts, useCreateEditorialDraft, useGenerateEditorialDraft, useListEditorialSources } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { getListEditorialDraftsQueryKey, getListEditorialSourcesQueryKey } from '@workspace/api-client-react';
import { FileEdit, Plus, Sparkles } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

import { isAccessError } from '@/lib/access-utils';
import { EditorialAccessDenied } from '@/components/editorial-access-denied';

export default function EditorialDrafts() {
  const [accessDeniedStatus, setAccessDeniedStatus] = useState<number | null>(null);
  const { data: drafts, isLoading, error: draftsError } = useListEditorialDrafts({
    query: {
      queryKey: getListEditorialDraftsQueryKey(),
      enabled: accessDeniedStatus === null,
      refetchInterval: 1000 * 60 * 5,
      refetchOnWindowFocus: true
    }
  });
  const queryClient = useQueryClient();

  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: sources } = useListEditorialSources({
    query: {
      queryKey: getListEditorialSourcesQueryKey(),
      enabled: accessDeniedStatus === null,
    },
  });
  const approvedSources = (sources || []).filter(s => s.approvedAt !== null);

  useEffect(() => {
    document.title = 'Drafts | Editorial Desk';
  }, []);

  useEffect(() => {
    if (isAccessError(draftsError)) setAccessDeniedStatus(draftsError.status);
  }, [draftsError]);

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');
  const [topic, setTopic] = useState('');
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const createDraft = useCreateEditorialDraft({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListEditorialDraftsQueryKey() });
        toast({ title: 'Draft created successfully' });
        setIsDialogOpen(false);
        setLocation(`/editorial/drafts/${data.id}`);
        setTitle('');
        setSummary('');
        setBody('');
        setSelectedSourceIds([]);
        setErrorMsg('');
      },
      onError: () => {
        toast({ title: 'Failed to create draft', variant: 'destructive' });
      }
    }
  });

  const generateDraft = useGenerateEditorialDraft({
    mutation: {
      onSuccess: () => {
        toast({ title: 'Generation job started', description: 'Check the dashboard for status' });
        setIsAiDialogOpen(false);
        setTopic('');
        setSelectedSourceIds([]);
        setErrorMsg('');
      },
      onError: () => {
        toast({ title: 'Failed to start generation', variant: 'destructive' });
      }
    }
  });

  const deniedStatus = accessDeniedStatus ?? (isAccessError(draftsError) ? draftsError.status : null);

  if (deniedStatus) {
    return <EditorialAccessDenied errorStatus={deniedStatus} />;
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (title.length < 12) return setErrorMsg('Headline must be at least 12 characters.');
    if (summary.length < 30) return setErrorMsg('Summary must be at least 30 characters.');
    if (body.length < 200) return setErrorMsg('Body copy must be at least 200 characters.');
    if (selectedSourceIds.length === 0 || selectedSourceIds.length > 12) {
      return setErrorMsg('You must select between 1 and 12 approved sources.');
    }

    createDraft.mutate({
      data: { title, summary, body, sourceIds: selectedSourceIds }
    });
  };

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (topic.length < 10) return setErrorMsg('Topic must be at least 10 characters.');
    if (selectedSourceIds.length === 0 || selectedSourceIds.length > 12) {
      return setErrorMsg('You must select between 1 and 12 approved sources.');
    }

    generateDraft.mutate({
      data: { 
        topic, 
        sourceIds: selectedSourceIds,
        idempotencyKey: crypto.randomUUID()
      }
    });
  };

  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <EditorialLayout>
      <div className="flex-1 overflow-auto bg-background p-6 md:p-10 flex flex-col">
        <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col">
          <div className="flex justify-between items-end mb-8 border-b border-border pb-6">
            <div>
              <h1 className="font-display text-4xl mb-2">Drafts</h1>
              <p className="text-muted-foreground">Manage and edit your working articles.</p>
            </div>
            
            <div className="flex gap-4">
              <Dialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="rounded-none border-border">
                    <Sparkles className="mr-2 size-4" /> AI Draft
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-none border-border sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle className="font-display text-2xl">Generate AI Draft</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleGenerate} className="space-y-6 pt-4">
                    {errorMsg && <div className="text-sm text-destructive bg-destructive/10 p-3 border border-destructive/20">{errorMsg}</div>}
                    <div className="space-y-2">
                      <Label htmlFor="ai-topic">Topic / Angle (min 10 chars)</Label>
                      <Input 
                        id="ai-topic" 
                        value={topic} 
                        onChange={e => setTopic(e.target.value)} 
                        placeholder="e.g. Clinical efficacy of red light therapy" 
                        required 
                        className="rounded-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Source Material (1-12 required)</Label>
                      <div className="max-h-48 overflow-auto border border-border p-2 space-y-2">
                        {approvedSources.length === 0 ? (
                          <div className="text-xs text-muted-foreground p-2">No approved sources available. Add and approve sources first.</div>
                        ) : (
                          approvedSources.map(source => (
                            <label key={source.id} className="flex items-start gap-2 text-sm cursor-pointer hover:bg-secondary/10 p-2 border border-transparent hover:border-border transition-colors">
                              <input 
                                type="checkbox" 
                                className="mt-1"
                                checked={selectedSourceIds.includes(source.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedSourceIds([...selectedSourceIds, source.id]);
                                  } else {
                                    setSelectedSourceIds(selectedSourceIds.filter(id => id !== source.id));
                                  }
                                }}
                              />
                              <div className="flex-1 truncate">
                                <span className="font-medium">{source.title}</span>
                                <div className="text-xs text-muted-foreground truncate">{source.publisher}</div>
                              </div>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                    <Button type="submit" disabled={generateDraft.isPending || selectedSourceIds.length === 0} className="w-full rounded-none">
                      {generateDraft.isPending ? 'Starting...' : 'Start Generation'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-none bg-foreground text-background hover:bg-foreground/90">
                    <Plus className="mr-2 size-4" /> New Draft
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-none border-border sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle className="font-display text-2xl">Create New Draft</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreate} className="space-y-6 pt-4">
                    {errorMsg && <div className="text-sm text-destructive bg-destructive/10 p-3 border border-destructive/20">{errorMsg}</div>}
                    <div className="space-y-2">
                      <Label htmlFor="title">Headline (min 12 chars)</Label>
                      <Input 
                        id="title" 
                        value={title} 
                        onChange={e => setTitle(e.target.value)} 
                        placeholder="Enter headline..." 
                        required 
                        className="rounded-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="topic">Topic</Label>
                      <Input 
                        id="topic" 
                        value={topic} 
                        onChange={e => setTopic(e.target.value)} 
                        placeholder="e.g. Health Science" 
                        required 
                        className="rounded-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="summary">Summary (min 30 chars)</Label>
                      <Textarea 
                        id="summary" 
                        value={summary} 
                        onChange={e => setSummary(e.target.value)} 
                        placeholder="Brief abstract..." 
                        required 
                        className="rounded-none resize-none h-20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="body">Initial Draft Body (min 200 chars)</Label>
                      <Textarea 
                        id="body" 
                        value={body} 
                        onChange={e => setBody(e.target.value)} 
                        placeholder="Start writing..." 
                        required 
                        className="rounded-none resize-none h-32"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Source Material (1-12 required)</Label>
                      <div className="max-h-48 overflow-auto border border-border p-2 space-y-2">
                        {approvedSources.length === 0 ? (
                          <div className="text-xs text-muted-foreground p-2">No approved sources available.</div>
                        ) : (
                          approvedSources.map(source => (
                            <label key={source.id} className="flex items-start gap-2 text-sm cursor-pointer hover:bg-secondary/10 p-2 border border-transparent hover:border-border transition-colors">
                              <input 
                                type="checkbox" 
                                className="mt-1"
                                checked={selectedSourceIds.includes(source.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedSourceIds([...selectedSourceIds, source.id]);
                                  } else {
                                    setSelectedSourceIds(selectedSourceIds.filter(id => id !== source.id));
                                  }
                                }}
                              />
                              <div className="flex-1 truncate">
                                <span className="font-medium">{source.title}</span>
                                <div className="text-xs text-muted-foreground truncate">{source.publisher}</div>
                              </div>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                    <Button type="submit" disabled={createDraft.isPending || selectedSourceIds.length === 0} className="w-full rounded-none">
                      {createDraft.isPending ? 'Creating...' : 'Create Draft'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-20 text-muted-foreground animate-pulse">Loading drafts...</div>
          ) : drafts && drafts.length > 0 ? (
            <div className="grid gap-px border border-border bg-border">
              {drafts.map(draft => (
                <div key={draft.id} className="bg-background p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-secondary/5 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      <span>{draft.topic}</span>
                      <span className="w-1 h-1 rounded-full bg-border"></span>
                      <span>{draft.status}</span>
                    </div>
                    <h3 className="font-display text-2xl truncate mb-2">{draft.title}</h3>
                    <p className="text-sm text-muted-foreground truncate">{draft.summary}</p>
                  </div>
                  
                  <div className="flex items-center gap-6 flex-shrink-0">
                    <div className="text-xs text-muted-foreground text-right">
                      <div>Updated</div>
                      <div className="font-medium text-foreground">{formatter.format(new Date(draft.updatedAt || draft.createdAt || Date.now()))}</div>
                    </div>
                    <Link href={`/editorial/drafts/${draft.id}`}>
                      <Button variant="outline" className="rounded-none border-border">
                        <FileEdit className="mr-2 size-4" /> Edit
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 border border-border bg-secondary/5">
              <FileEdit className="size-12 text-muted-foreground mb-4" />
              <h3 className="font-display text-2xl mb-2">No drafts found</h3>
              <p className="text-muted-foreground max-w-sm">Create a new manual draft or start an AI generation job to begin writing.</p>
            </div>
          )}
        </div>
      </div>
    </EditorialLayout>
  );
}
