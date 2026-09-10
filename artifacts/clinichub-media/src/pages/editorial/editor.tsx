import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'wouter';
import { EditorialLayout } from '@/components/editorial-layout';
import { useGetEditorialArticleDraft, useUpdateEditorialDraft, useSubmitEditorialArticleForReview, useApproveEditorialArticle, useRejectEditorialArticle, usePublishEditorialArticle, useArchiveEditorialArticle, useScheduleEditorialArticle, useListEditorialRevisions, useListEditorialArticleAuditEvents, useListEditorialSources, getGetEditorialArticleDraftQueryKey, getListEditorialRevisionsQueryKey, getListEditorialArticleAuditEventsQueryKey, getListEditorialSourcesQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Save, Send, AlertCircle, FileText, CheckCircle2, Archive, Calendar, History, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

import { isAccessError } from '@/lib/access-utils';
import { EditorialAccessDenied } from '@/components/editorial-access-denied';

export default function EditorialEditor() {
  const params = useParams();
  const id = params.id || '';
  const [accessDeniedStatus, setAccessDeniedStatus] = useState<number | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: draft, isLoading, isError, error: draftError } = useGetEditorialArticleDraft(id, {
    query: {
      enabled: !!id && accessDeniedStatus === null,
      queryKey: getGetEditorialArticleDraftQueryKey(id),
    }
  });

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');

  const { data: allSources } = useListEditorialSources({
    query: {
      queryKey: getListEditorialSourcesQueryKey(),
      enabled: accessDeniedStatus === null,
    },
  });
  const approvedSources = (allSources || []).filter(s => s.approvedAt !== null);

  const { data: revisions, isLoading: isLoadingRevisions } = useListEditorialRevisions(id, {
    query: { 
      enabled: !!id && accessDeniedStatus === null,
      queryKey: getListEditorialRevisionsQueryKey(id)
    }
  });

  const { data: auditEvents, isLoading: isLoadingAudit } = useListEditorialArticleAuditEvents(id, {
    query: { 
      enabled: !!id && accessDeniedStatus === null,
      queryKey: getListEditorialArticleAuditEventsQueryKey(id)
    }
  });

  const initializedForId = useRef<string | null>(null);
  const lastSaved = useRef({ title: '', summary: '', body: '', sourceIds: [] as string[] });

  // Init local state
  useEffect(() => {
    if (draft && initializedForId.current !== id) {
      initializedForId.current = id;
      setTitle(draft.title);
      setSummary(draft.summary);
      setBody(draft.body);
      const initialSourceIds = draft.citations?.map(c => c.id) || [];
      setSelectedSourceIds(initialSourceIds);
      lastSaved.current = { 
        title: draft.title, 
        summary: draft.summary, 
        body: draft.body,
        sourceIds: initialSourceIds
      };
    }
  }, [draft, id]);

  useEffect(() => {
    if (isAccessError(draftError)) setAccessDeniedStatus(draftError.status);
  }, [draftError]);

  const updateDraft = useUpdateEditorialDraft({
    mutation: {
      onSuccess: (data) => {
        // Update cache locally instead of invalidating to prevent refetch loop
        queryClient.setQueryData(getGetEditorialArticleDraftQueryKey(id), (old: any) => 
          old ? { ...old, ...data } : old
        );
      },
      onError: () => {
        toast({ title: 'Failed to auto-save draft', variant: 'destructive' });
      }
    }
  });

  const mutateFnRef = useRef(updateDraft.mutate);
  mutateFnRef.current = updateDraft.mutate;

  const saveDraft = useCallback((data: { title?: string, summary?: string, body?: string, sourceIds?: string[] }) => {
    mutateFnRef.current({ 
      articleId: id, 
      data 
    });
  }, [id]);

  // Debounced Auto-save
  useEffect(() => {
    if (initializedForId.current !== id) return;
    
    const timeout = setTimeout(() => {
      const currentData = { title, summary, body, sourceIds: selectedSourceIds };
      if (
        currentData.title !== lastSaved.current.title ||
        currentData.summary !== lastSaved.current.summary ||
        currentData.body !== lastSaved.current.body ||
        currentData.sourceIds.join(',') !== lastSaved.current.sourceIds.join(',')
      ) {
        saveDraft(currentData);
        lastSaved.current = currentData;
      }
    }, 2000);

    return () => clearTimeout(timeout);
  }, [title, summary, body, selectedSourceIds, id, saveDraft]);


  const submitDraft = useSubmitEditorialArticleForReview({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetEditorialArticleDraftQueryKey(id) });
        toast({ title: 'Draft submitted for review' });
      },
      onError: () => {
        toast({ title: 'Failed to submit draft', variant: 'destructive' });
      }
    }
  });

  const approveDraft = useApproveEditorialArticle({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetEditorialArticleDraftQueryKey(id) });
        toast({ title: 'Draft approved' });
      },
      onError: () => {
        toast({ title: 'Failed to approve draft', variant: 'destructive' });
      }
    }
  });

  const rejectDraft = useRejectEditorialArticle({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetEditorialArticleDraftQueryKey(id) });
        toast({ title: 'Draft rejected (revision requested)' });
      },
      onError: () => {
        toast({ title: 'Failed to reject draft', variant: 'destructive' });
      }
    }
  });

  const publishDraft = usePublishEditorialArticle({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetEditorialArticleDraftQueryKey(id) });
        toast({ title: 'Article published live!' });
      },
      onError: () => {
        toast({ title: 'Failed to publish article', variant: 'destructive' });
      }
    }
  });

  const archiveDraft = useArchiveEditorialArticle({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetEditorialArticleDraftQueryKey(id) });
        toast({ title: 'Article archived' });
      },
      onError: () => {
        toast({ title: 'Failed to archive article', variant: 'destructive' });
      }
    }
  });

  const scheduleDraft = useScheduleEditorialArticle({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetEditorialArticleDraftQueryKey(id) });
        toast({ title: 'Article scheduled' });
        setIsScheduleDialogOpen(false);
      },
      onError: () => {
        toast({ title: 'Failed to schedule article', variant: 'destructive' });
      }
    }
  });

  const deniedStatus = accessDeniedStatus ?? (isAccessError(draftError) ? draftError.status : null);

  if (deniedStatus) {
    return <EditorialAccessDenied errorStatus={deniedStatus} />;
  }

  const handleManualSave = () => {
    const currentData = { title, summary, body, sourceIds: selectedSourceIds };
    saveDraft(currentData);
    lastSaved.current = currentData;
    toast({ title: 'Draft saved' });
  };

  const handleSubmit = () => {
    submitDraft.mutate({ articleId: id });
  };

  if (isLoading) {
    return (
      <EditorialLayout>
        <div className="flex-1 flex items-center justify-center bg-background">
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground animate-pulse">Loading editor...</span>
        </div>
      </EditorialLayout>
    );
  }

  if (isError || !draft) {
    return (
      <EditorialLayout>
        <div className="flex-1 flex flex-col items-center justify-center p-10 bg-background text-center">
          <AlertCircle className="size-10 text-destructive mb-4" />
          <h2 className="font-display text-2xl mb-2">Draft not found</h2>
          <p className="text-muted-foreground mb-6">The draft you are trying to edit does not exist or you don't have access.</p>
          <Link href="/editorial/drafts">
            <Button variant="outline" className="rounded-none border-border">
              Back to Drafts
            </Button>
          </Link>
        </div>
      </EditorialLayout>
    );
  }

  const isReadOnly = draft.status !== 'draft' && draft.status !== 'revision_requested';

  return (
    <EditorialLayout>
      <div className="flex flex-col h-full bg-background">
        {/* Editor Header */}
        <header className="flex-shrink-0 border-b border-border bg-secondary/10 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/editorial/drafts" className="text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="size-5" />
            </Link>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">Editor</span>
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border ${
                  draft.status === 'draft' ? 'border-border text-foreground bg-secondary/50' :
                  draft.status === 'review' ? 'border-accent/30 text-accent bg-accent/10' :
                  'border-muted text-muted-foreground'
                }`}>
                  {draft.status.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="text-sm font-medium truncate max-w-[200px] sm:max-w-md">{draft.title}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground mr-2">
              {updateDraft.isPending ? 'Saving...' : 'All changes saved'}
            </span>
            {draft.status === 'draft' || draft.status === 'revision_requested' ? (
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="rounded-none border-border h-9" 
                  onClick={handleManualSave}
                  disabled={isReadOnly}
                >
                  <Save className="size-4 mr-2" /> Save
                </Button>
                <Button 
                  size="sm" 
                  className="rounded-none h-9 bg-foreground text-background hover:bg-foreground/90"
                  onClick={handleSubmit}
                  disabled={isReadOnly || submitDraft.isPending}
                >
                  {submitDraft.isPending ? 'Submitting...' : <><Send className="size-4 mr-2" /> Submit for Review</>}
                </Button>
              </>
            ) : draft.status === 'review' ? (
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="rounded-none border-destructive text-destructive hover:bg-destructive/10 h-9" 
                  onClick={() => rejectDraft.mutate({ articleId: id })}
                  disabled={rejectDraft.isPending}
                >
                  Reject
                </Button>
                <Button 
                  size="sm" 
                  className="rounded-none h-9 bg-accent text-accent-foreground hover:bg-accent/90"
                  onClick={() => approveDraft.mutate({ articleId: id })}
                  disabled={approveDraft.isPending}
                >
                  {approveDraft.isPending ? 'Approving...' : <><CheckCircle2 className="size-4 mr-2" /> Approve</>}
                </Button>
              </>
            ) : draft.status === 'approved' || draft.status === 'scheduled' ? (
              <>
                {draft.status === 'approved' && (
                  <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="rounded-none h-9 border-border"
                      >
                        <Calendar className="size-4 mr-2" /> Schedule
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-none border-border sm:max-w-[400px]">
                      <DialogHeader>
                        <DialogTitle className="font-display text-2xl">Schedule Publication</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Publication Date & Time</label>
                          <Input 
                            type="datetime-local" 
                            value={scheduleDate}
                            onChange={(e) => setScheduleDate(e.target.value)}
                            className="rounded-none"
                          />
                        </div>
                        <Button 
                          className="w-full rounded-none"
                          disabled={!scheduleDate || scheduleDraft.isPending}
                          onClick={() => {
                            if (scheduleDate) {
                              scheduleDraft.mutate({ 
                                articleId: id, 
                                data: { scheduledFor: new Date(scheduleDate).toISOString() } 
                              });
                            }
                          }}
                        >
                          {scheduleDraft.isPending ? 'Scheduling...' : 'Confirm Schedule'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
                <Button 
                  size="sm" 
                  className="rounded-none h-9 bg-accent text-accent-foreground hover:bg-accent/90"
                  onClick={() => publishDraft.mutate({ articleId: id })}
                  disabled={publishDraft.isPending}
                >
                  {publishDraft.isPending ? 'Publishing...' : 'Publish Live'}
                </Button>
              </>
            ) : null}
            <Button 
              size="sm" 
              variant="ghost"
              className="rounded-none h-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={() => archiveDraft.mutate({ articleId: id })}
              disabled={archiveDraft.isPending || draft.status === 'archived' || draft.status === 'scheduled'}
              title={draft.status === 'scheduled' ? 'Cannot archive scheduled article' : ''}
            >
              <Archive className="size-4 mr-2" /> Archive
            </Button>
          </div>
        </header>

        {/* Editor Workspace */}
        <div className="flex-1 overflow-hidden flex">
          <div className="flex-1 overflow-auto p-6 md:p-10">
            <div className="max-w-4xl mx-auto space-y-8">
              
              {isReadOnly && (
                <div className="bg-secondary/20 border border-border p-4 flex items-start gap-3">
                  <AlertCircle className="size-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium">Read-Only Mode</h4>
                    <p className="text-sm text-muted-foreground">This article is currently in '{draft.status.replace(/_/g, ' ')}' state and cannot be edited. Request a revision or wait for approval.</p>
                  </div>
                </div>
              )}

              {draft.reviewNotes && (
                <div className="bg-destructive/5 border border-destructive/20 p-4">
                  <h4 className="text-sm font-medium text-destructive mb-1">Review Notes</h4>
                  <p className="text-sm text-destructive/80">{draft.reviewNotes}</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Headline</label>
                <Textarea 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  className="rounded-none border-transparent hover:border-border focus-visible:ring-0 focus-visible:border-border bg-transparent px-0 font-display text-4xl md:text-5xl resize-none min-h-[100px] leading-[1.1]"
                  placeholder="Article Headline"
                  disabled={isReadOnly}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Summary</label>
                <Textarea 
                  value={summary} 
                  onChange={e => setSummary(e.target.value)} 
                  className="rounded-none border-transparent hover:border-border focus-visible:ring-0 focus-visible:border-border bg-transparent px-0 text-xl text-muted-foreground resize-none min-h-[120px] leading-relaxed"
                  placeholder="Brief summary or abstract..."
                  disabled={isReadOnly}
                />
              </div>

              <div className="space-y-2 pt-8 border-t border-border">
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Body Copy</label>
                <Textarea 
                  value={body} 
                  onChange={e => setBody(e.target.value)} 
                  className="rounded-none border-transparent hover:border-border focus-visible:ring-0 focus-visible:border-border bg-transparent px-0 font-sans text-base resize-none min-h-[500px] leading-relaxed"
                  placeholder="Start writing... Markdown headings and paragraphs are supported."
                  disabled={isReadOnly}
                />
              </div>
            </div>
          </div>

          {/* Sidebar / Evidence Panel */}
          <div className="w-80 border-l border-border bg-secondary/5 flex flex-col hidden lg:flex">
            <Tabs defaultValue="evidence" className="w-full flex-1 flex flex-col">
              <TabsList className="bg-secondary/10 border-b border-border p-0 h-12 rounded-none">
                <TabsTrigger value="evidence" className="flex-1 rounded-none data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-b-accent h-full text-[10px] uppercase tracking-widest font-semibold">
                  <FileText className="mr-2 size-3.5" /> Evidence
                </TabsTrigger>
                <TabsTrigger value="revisions" className="flex-1 rounded-none data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-b-accent h-full text-[10px] uppercase tracking-widest font-semibold">
                  <History className="mr-2 size-3.5" /> Revisions
                </TabsTrigger>
                <TabsTrigger value="activity" className="flex-1 rounded-none data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-b-accent h-full text-[10px] uppercase tracking-widest font-semibold">
                  <Activity className="mr-2 size-3.5" /> Activity
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-auto">
                <TabsContent value="evidence" className="m-0 p-4 focus-visible:outline-none flex flex-col h-full">
                  <div className="mb-4">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full rounded-none border-border" disabled={isReadOnly}>
                          <FileText className="mr-2 size-4" /> Manage Citations
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="rounded-none border-border sm:max-w-[600px]">
                        <DialogHeader>
                          <DialogTitle className="font-display text-2xl">Select Sources</DialogTitle>
                        </DialogHeader>
                        <div className="max-h-[50vh] overflow-auto border border-border p-2 space-y-2 mt-4">
                          {approvedSources.length === 0 ? (
                            <div className="text-xs text-muted-foreground p-2">No approved sources available in the evidence base.</div>
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
                                  disabled={isReadOnly}
                                />
                                <div className="flex-1">
                                  <span className="font-medium">{source.title}</span>
                                  <div className="text-xs text-muted-foreground">{source.publisher}</div>
                                </div>
                              </label>
                            ))
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  
                  <div className="flex-1 overflow-auto">
                    {draft.citations && draft.citations.length > 0 ? (
                      <div className="space-y-4">
                        {draft.citations.map((citation, i) => (
                          <div key={i} className="text-sm bg-background border border-border p-3">
                            <div className="font-medium mb-1 truncate">{citation.title}</div>
                            <div className="text-xs text-muted-foreground mb-2">{citation.publisher}</div>
                            <div className="text-xs italic text-foreground/80 pl-2 border-l-2 border-border line-clamp-3">
                              "{citation.excerpt}"
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground text-center py-8">
                        No sources attached to this draft yet.
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="revisions" className="m-0 p-4 focus-visible:outline-none">
                  {isLoadingRevisions ? (
                    <div className="text-sm text-muted-foreground text-center py-8">Loading revisions...</div>
                  ) : revisions && revisions.length > 0 ? (
                    <div className="space-y-4">
                      {revisions.map((rev) => (
                        <div key={rev.id} className="text-sm bg-background border border-border p-3">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium">Rev {rev.revisionNumber}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(rev.createdAt))}
                            </span>
                          </div>
                          <Button variant="outline" size="sm" className="w-full h-7 text-xs rounded-none border-border">
                            Restore
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground text-center py-8">
                      No revisions saved yet.
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="activity" className="m-0 p-4 focus-visible:outline-none">
                  {isLoadingAudit ? (
                    <div className="text-sm text-muted-foreground text-center py-8">Loading activity...</div>
                  ) : auditEvents && auditEvents.length > 0 ? (
                    <div className="relative border-l border-border ml-2 pl-4 space-y-6">
                      {auditEvents.map((event, i) => (
                        <div key={i} className="relative">
                          <div className="absolute -left-5 top-1.5 size-2 rounded-full bg-border" />
                          <div className="text-xs font-medium uppercase tracking-wider mb-1">
                            {event.action.replace(/_/g, ' ')}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(event.createdAt))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground text-center py-8">
                      No activity recorded yet.
                    </div>
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </div>
    </EditorialLayout>
  );
}
