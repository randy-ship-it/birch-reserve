import { useEffect } from 'react';
import { useListEditorialArticles } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { ChevronRight, ExternalLink } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function Insights() {
  const { data: articles, isLoading, isError } = useListEditorialArticles();

  useEffect(() => {
    document.title = 'Insights | Birch Reserve';
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (description) {
      description.content = 'Evidence-led advertising publication and insights for health, wellness, and retail.';
    }
  }, []);

  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border bg-secondary/20">
        <div className="container mx-auto px-6 py-20 md:py-28">
          <div className="max-w-3xl">
            <h1 className="font-display text-5xl tracking-tight text-foreground md:text-7xl">
              Insights & Evidence
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
              Measured, evidence-led reporting on health, wellness, and trusted retail contexts. Public readings from the Birch Reserve editorial desk.
            </p>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-6 py-16 md:py-24">
        {isLoading ? (
          <div className="grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-background p-8 md:p-10 flex flex-col h-full">
                <Skeleton className="h-4 w-24 mb-6" />
                <Skeleton className="h-8 w-full mb-3" />
                <Skeleton className="h-8 w-2/3 mb-4" />
                <Skeleton className="h-20 w-full mb-8" />
                <Skeleton className="h-4 w-32 mt-auto" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">Unable to load insights at this time.</p>
          </div>
        ) : articles && articles.length > 0 ? (
          <div className="grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <Link 
                key={article.slug} 
                href={`/insights/${article.slug}`}
                className="group flex flex-col bg-background p-8 md:p-10 transition-colors hover:bg-secondary/10"
              >
                <div className="mb-6 flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  <span>{article.topic}</span>
                  <span>{formatter.format(new Date(article.publishedAt))}</span>
                </div>
                <h2 className="mb-4 font-display text-3xl tracking-tight text-foreground">
                  {article.title}
                </h2>
                <p className="mb-8 leading-relaxed text-muted-foreground">
                  {article.summary}
                </p>
                <div className="mt-auto flex items-center font-medium text-accent-foreground group-hover:text-accent transition-colors">
                  <span className="text-sm">Read article</span>
                  <ChevronRight className="ml-2 size-4" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 border border-border bg-secondary/5">
            <h3 className="font-display text-2xl mb-2">No insights published yet</h3>
            <p className="text-muted-foreground">Check back soon for our first evidence-led report.</p>
          </div>
        )}
      </section>
    </div>
  );
}
