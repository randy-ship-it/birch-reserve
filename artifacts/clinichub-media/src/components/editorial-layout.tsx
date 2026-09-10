import { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useUser, useClerk } from '@clerk/react';
import { LayoutDashboard, FileText, Settings, LogOut, FileEdit, Database, ShieldAlert, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function EditorialLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();

  const navItems = [
    { href: '/editorial', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/editorial/drafts', label: 'Drafts', icon: FileEdit },
    { href: '/editorial/sources', label: 'Evidence Base', icon: Database },
    { href: '/editorial/articles', label: 'Published', icon: BookOpen },
  ];

  return (
    <div className="flex min-h-screen bg-background text-foreground flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-r border-border bg-secondary/10 flex flex-col flex-shrink-0">
        <div className="p-6 border-b border-border flex items-center gap-3">
          <div className="size-8 bg-foreground rounded flex items-center justify-center text-background font-display text-lg italic">B</div>
          <div>
            <div className="font-medium text-sm">Editorial Desk</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Birch Reserve</div>
          </div>
        </div>
        
        <nav className="p-4 space-y-1 flex-grow">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== '/editorial' && location.startsWith(item.href));
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-accent/10 text-accent' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-border">
          <div className="px-3 py-2 mb-2">
            <p className="text-xs font-medium truncate">{user?.primaryEmailAddress?.emailAddress}</p>
            <p className="text-[10px] text-muted-foreground uppercase mt-1">Staff Editor</p>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => signOut({ redirectUrl: '/' })}
          >
            <LogOut className="size-4 mr-2" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col h-[100dvh]">
        {children}
      </main>
    </div>
  );
}
