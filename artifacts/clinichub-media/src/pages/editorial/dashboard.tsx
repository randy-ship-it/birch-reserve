import { useEffect, useState } from 'react';
import { EditorialLayout } from '@/components/editorial-layout';
import { useListEditorialGenerationJobs, useListEditorialDrafts, getListEditorialGenerationJobsQueryKey, getListEditorialDraftsQueryKey } from '@workspace/api-client-react';
import { Clock, FileEdit, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'wouter';

import { isAccessError } from '@/lib/access-utils';
import { EditorialAccessDenied } from '@/components/editorial-access-denied';

export default function EditorialDashboard() {
  const [accessDeniedStatus, setAccessDeniedStatus] = useState<number | null>(null);

  const { data: jobs, isLoading: isLoadingJobs, error: jobsError } = useListEditorialGenerationJobs({
    query: {
      queryKey: getListEditorialGenerationJobsQueryKey(),
      enabled: accessDeniedStatus === null,
      refetchInterval: 1000 * 60 * 5,
      refetchOnWindowFocus: true
    }
  });
  const { data: drafts, isLoading: isLoadingDrafts, error: draftsError } = useListEditorialDrafts({
    query: {
      queryKey: getListEditorialDraftsQueryKey(),
      enabled: accessDeniedStatus === null,
      refetchInterval: 1000 * 60 * 5,
      refetchOnWindowFocus: true
    }
  });

  useEffect(() => {
    document.title = 'Editorial Dashboard | Birch Reserve';
  }, []);

  useEffect(() => {
    const accessError = [jobsError, draftsError].find(isAccessError);
    if (accessError) setAccessDeniedStatus(accessError.status);
  }, [jobsError, draftsError]);

  const currentAccessError = [jobsError, draftsError].find(isAccessError);
  const deniedStatus = accessDeniedStatus ?? currentAccessError?.status;

  if (deniedStatus) {
    return <EditorialAccessDenied errorStatus={deniedStatus} />;
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

  return (
    <EditorialLayout>
      <div className="flex-1 overflow-auto bg-background p-6 md:p-10">
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <h1 className="font-display text-4xl mb-2">Dashboard</h1>
            <p className="text-muted-foreground">Overview of editorial activity and generation jobs.</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="rounded-none border-border shadow-none bg-secondary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium uppercase tracking-widest text-muted-foreground flex items-center">
                  <FileEdit className="mr-2 size-4 text-accent" />
                  Active Drafts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-display">{isLoadingDrafts ? '-' : drafts?.length || 0}</div>
              </CardContent>
            </Card>

            <Card className="rounded-none border-border shadow-none bg-secondary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium uppercase tracking-widest text-muted-foreground flex items-center">
                  <Sparkles className="mr-2 size-4 text-accent" />
                  Generation Jobs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-display">{isLoadingJobs ? '-' : jobs?.length || 0}</div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
              <h2 className="text-lg font-medium flex items-center border-b border-border pb-2">
                <Sparkles className="mr-2 size-4" /> AI Generation Jobs
              </h2>
              {isLoadingJobs ? (
                <div className="text-sm text-muted-foreground py-4">Loading jobs...</div>
              ) : jobs && jobs.length > 0 ? (
                <div className="border border-border divide-y divide-border">
                  {jobs.slice(0, 10).map(job => (
                    <div key={job.id} className="p-4 flex flex-col gap-1">
                      <div className="flex justify-between items-start">
                        <span className="font-medium text-sm truncate pr-4">{job.topic}</span>
                        <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border ${
                          job.status === 'completed' ? 'border-accent/30 text-accent bg-accent/10' :
                          job.status === 'failed' ? 'border-destructive/30 text-destructive bg-destructive/10' :
                          'border-muted text-muted-foreground'
                        }`}>
                          {job.status}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-muted-foreground mt-2">
                        <span>{formatter.format(new Date(job.createdAt))}</span>
                        {job.articleId && (
                          <Link href={`/editorial/drafts/${job.articleId}`} className="text-accent hover:underline">
                            View Draft
                          </Link>
                        )}
                      </div>
                      {job.errorCode && (
                        <div className="text-xs text-destructive mt-1 bg-destructive/10 p-2 border border-destructive/20">
                          Error: {job.errorCode}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground py-8 text-center border border-border bg-secondary/5">
                  No recent generation jobs.
                </div>
              )}
          </div>
        </div>
      </div>
    </EditorialLayout>
  );
}
