import { useEffect } from 'react';
import { useParams, Link } from 'wouter';
import { useGetEditorialArticle, useListEditorialArticles, getGetEditorialArticleQueryKey } from '@workspace/api-client-react';
import { ChevronLeft, FileText, Calendar, User, BookOpen, Quote } from 'lucide-react';
import { trackCta } from '@/lib/track-cta';
import { Skeleton } from '@/components/ui/skeleton';

export default function InsightArticle() {
  const params = useParams();
  const slug = params.slug || '';
  
  const { data: article, isLoading, isError } = useGetEditorialArticle(slug, {
    query: {
      enabled: !!slug,
      queryKey: getGetEditorialArticleQueryKey(slug)
    }
  });

  const { data: recentArticles } = useListEditorialArticles();

  useEffect(() => {
    if (article) {
      document.title = `${article.title} | Birch Reserve`;
      const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (description) {
        description.content = article.summary;
      }
      
      // Attempt to set Open Graph metadata dynamically (if tags exist)
      const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
      if (ogTitle) ogTitle.content = article.title;
      const ogDesc = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
      if (ogDesc) ogDesc.content = article.summary;
      
      // JSON-LD
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = 'article-json-ld';
      script.innerHTML = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: article.title,
        description: article.summary,
        author: {
          '@type': 'Person',
          name: article.authorName
        },
        datePublished: article.publishedAt,
        publisher: {
          '@type': 'Organization',
          name: 'Birch Reserve'
        }
      });
      document.head.appendChild(script);

      return () => {
        document.title = 'Birch Reserve';
        const oldScript = document.getElementById('article-json-ld');
        if (oldScript) oldScript.remove();
      };
    }
    return undefined;
  }, [article]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="container mx-auto px-6 py-20 max-w-4xl">
          <Skeleton className="h-6 w-32 mb-8" />
          <Skeleton className="h-16 w-3/4 mb-6" />
          <Skeleton className="h-6 w-1/2 mb-12" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !article) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center py-20">
        <FileText className="size-12 text-muted-foreground mb-6" />
        <h1 className="font-display text-4xl mb-4">Article Not Found</h1>
        <p className="text-muted-foreground mb-8">The insight you're looking for doesn't exist or has been removed.</p>
        <Link href="/insights" className="inline-flex items-center text-sm font-medium text-accent hover:text-accent-foreground transition-colors">
          <ChevronLeft className="mr-2 size-4" />
          Back to Insights
        </Link>
      </div>
    );
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const paragraphs = article.body.split('\n\n').filter(Boolean);
  
  const relatedArticles = (recentArticles || [])
    .filter(a => a.slug !== slug)
    .slice(0, 2);

  return (
    <article className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-secondary/10 pt-24 pb-16">
        <div className="container mx-auto px-6 max-w-3xl">
          <Link href="/insights" className="inline-flex items-center text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-accent transition-colors mb-12">
            <ChevronLeft className="mr-2 size-4" />
            Insights
          </Link>
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-widest text-accent mb-6">
            <span>{article.topic}</span>
          </div>
          <h1 className="font-display text-4xl md:text-6xl tracking-tight text-foreground leading-[1.1] mb-8">
            {article.title}
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed mb-10">
            {article.summary}
          </p>
          <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground border-t border-border pt-6">
            <div className="flex items-center">
              <User className="mr-2 size-4" />
              {article.authorName}
            </div>
            <div className="flex items-center">
              <Calendar className="mr-2 size-4" />
              {formatter.format(new Date(article.publishedAt))}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 max-w-3xl py-16 md:py-24">
        <div className="prose prose-lg dark:prose-invert max-w-none text-foreground prose-headings:font-display prose-headings:font-normal prose-a:text-accent hover:prose-a:text-accent-foreground prose-p:leading-relaxed">
          {paragraphs.map((p, i) => {
            // Check if it's a heading (starts with #)
            const headingMatch = p.match(/^(#{1,6})\s+(.+)/);
            if (headingMatch) {
              const level = headingMatch[1].length;
              const text = headingMatch[2];
              const Tag = `h${level}` as any;
              return <Tag key={i} className="mt-12 mb-6">{text}</Tag>;
            }
            return <p key={i} className="mb-6">{p}</p>;
          })}
        </div>

        {article.citations && article.citations.length > 0 && (
          <div className="mt-20 pt-10 border-t border-border">
            <h2 className="font-display text-2xl mb-8 flex items-center">
              <BookOpen className="mr-3 size-5 text-muted-foreground" />
              Source Notes & Citations
            </h2>
            <div className="space-y-6">
              {article.citations.map((citation, index) => (
                <div key={index} className="bg-secondary/20 p-6 border border-border text-sm">
                  <div className="flex items-start gap-4">
                    <span className="flex-shrink-0 flex items-center justify-center size-6 bg-background border border-border text-xs font-medium rounded-full">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-foreground mb-1">{citation.title}</p>
                      <p className="text-muted-foreground mb-3">{citation.publisher}</p>
                      <p className="italic text-foreground/80 border-l-2 border-border pl-4">"{citation.citationLabel}"</p>
                      {citation.canonicalUrl && (
                        <a href={citation.canonicalUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-3 text-accent hover:underline">
                          View source
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {relatedArticles.length > 0 && (
        <section className="border-t border-border bg-secondary/10 py-20">
          <div className="container mx-auto px-6 max-w-5xl">
            <h2 className="font-display text-3xl mb-10 text-center">Related Reading</h2>
            <div className="grid md:grid-cols-2 gap-px border border-border bg-border">
              {relatedArticles.map(related => (
                <Link 
                  key={related.slug}
                  href={`/insights/${related.slug}`}
                  onClick={() => trackCta("cta_insights_related")}
                  className="bg-background p-8 transition-colors hover:bg-secondary/10 flex flex-col"
                >
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                    {related.topic}
                  </span>
                  <h3 className="font-display text-2xl mb-3">{related.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-6 flex-grow">{related.summary}</p>
                  <span className="text-sm font-medium text-accent">Read article →</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </article>
  );
}
