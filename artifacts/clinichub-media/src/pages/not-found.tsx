import { AlertCircle } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-[80vh] w-full flex items-center justify-center bg-background text-foreground">
      <div className="w-full max-w-md mx-6 border border-white/10 bg-card p-12 flex flex-col items-center text-center">
        <AlertCircle className="size-12 text-destructive mb-6" />
        <h1 className="text-3xl font-display font-bold uppercase tracking-tighter mb-4 text-white">
          Signal Lost
        </h1>
        <p className="text-sm font-mono text-muted-foreground mb-10 leading-relaxed uppercase tracking-widest">
          The requested surface could not be located in the reserve.
        </p>
        <Link href="/">
          <Button variant="outline" className="rounded-none border-white/20 text-white hover:bg-white hover:text-background font-display font-bold uppercase tracking-widest px-8 h-12">
            Return to Hub
          </Button>
        </Link>
      </div>
    </div>
  );
}