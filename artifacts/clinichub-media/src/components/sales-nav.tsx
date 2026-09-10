import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';

export function SalesNav() {
  const [location] = useLocation();
  return (
    <div className="flex border-t border-white/10">
      <div className="flex gap-6">
        <Link 
          href="/sales/advertiser-requests" 
          className={cn(
            "border-b-2 py-4 text-sm font-medium transition-colors", 
            location === '/sales/advertiser-requests' ? "border-[#8fd6a5] text-[#8fd6a5]" : "border-transparent text-[#70818b] hover:text-[#f4f0e8]"
          )}
          data-testid="nav-advertiser-requests"
        >
          Queue
        </Link>
        <Link 
          href="/sales/team" 
          className={cn(
            "border-b-2 py-4 text-sm font-medium transition-colors", 
            location === '/sales/team' ? "border-[#8fd6a5] text-[#8fd6a5]" : "border-transparent text-[#70818b] hover:text-[#f4f0e8]"
          )}
          data-testid="nav-team-access"
        >
          Team roster
        </Link>
      </div>
    </div>
  );
}
