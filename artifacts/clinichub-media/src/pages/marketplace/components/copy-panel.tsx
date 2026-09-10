import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Copy, AlertTriangle, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useLocalStorage } from '@/hooks/use-local-storage';

interface CopyPanelProps {
  id: string;
  label: string;
  value: string;
  description: string;
}

export function CopyPanel({ id, label, value, description }: CopyPanelProps) {
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useLocalStorage(`dismissed_secret_${id}`, false);

  if (dismissed) return null;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <div className="bg-muted border border-border rounded-lg p-5 mt-4 space-y-4 relative">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 size-6 rounded-md hover:bg-background/50 text-muted-foreground"
        onClick={() => setDismissed(true)}
        data-testid={`btn-dismiss-${id}`}
      >
        <X className="size-4" />
      </Button>
      <div className="pr-6">
        <h4 className="font-bold text-foreground text-sm">{label}</h4>
        <p className="text-xs text-muted-foreground font-medium mt-1">{description}</p>
      </div>

      <div className="flex items-center gap-2">
        <code className="flex-1 bg-background border border-border px-3 py-2 rounded font-mono text-sm overflow-hidden text-ellipsis whitespace-nowrap" data-testid={`code-${id}`}>
          {value}
        </code>
        <Button
          type="button"
          variant="secondary"
          className="shrink-0 font-bold"
          onClick={onCopy}
          data-testid={`btn-copy-${id}`}
        >
          {copied ? <Check className="size-4 mr-2" /> : <Copy className="size-4 mr-2" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>

      <Alert variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20 mt-2 py-3">
        <AlertTriangle className="size-4" />
        <AlertTitle className="text-sm font-bold">Store this securely</AlertTitle>
        <AlertDescription className="text-xs font-medium">
          This key will not be shown again. Please save it now, then dismiss this panel.
        </AlertDescription>
      </Alert>
    </div>
  );
}
