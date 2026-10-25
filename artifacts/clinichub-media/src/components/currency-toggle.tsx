import { CURRENCIES, useCurrency } from "@/lib/currency";

/** Visible USD/CAD switch. Always shown so nobody is stuck in the wrong currency. */
export function CurrencyToggle({ className = "" }: { className?: string }) {
  const { currency, setCurrency } = useCurrency();
  return (
    <div
      role="group"
      aria-label="Currency"
      data-testid="currency-toggle"
      className={`inline-flex items-center overflow-hidden rounded-md border border-border text-xs font-semibold ${className}`}
    >
      {CURRENCIES.map((c) => (
        <button
          key={c}
          type="button"
          aria-pressed={currency === c}
          data-testid={`currency-${c}`}
          onClick={() => setCurrency(c)}
          className={`px-2 py-1.5 transition-colors ${
            currency === c ? "bg-accent text-accent-foreground" : "bg-background text-foreground hover:bg-secondary"
          }`}
        >
          {c.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
