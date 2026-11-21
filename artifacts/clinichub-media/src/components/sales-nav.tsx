import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';

export function SalesNav() {
  const [location] = useLocation();
  return (
    <div className="flex border-t border-[#d9ddd2]">
      <div className="flex gap-6">
        <Link 
          href="/sales/advertiser-requests" 
          className={cn(
            "border-b-2 py-4 text-sm font-medium transition-colors", 
            location === '/sales/advertiser-requests' ? "border-[#071A39] text-[#0b6b43]" : "border-transparent text-[#566476] hover:text-[#071A39]"
          )}
          data-testid="nav-advertiser-requests"
        >
          Queue
        </Link>
        <Link 
          href="/sales/team" 
          className={cn(
            "border-b-2 py-4 text-sm font-medium transition-colors", 
            location === '/sales/team' ? "border-[#071A39] text-[#0b6b43]" : "border-transparent text-[#566476] hover:text-[#071A39]"
          )}
          data-testid="nav-team-access"
        >
          Team roster
        </Link>
      </div>
    </div>
  );
}
