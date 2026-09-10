import { type ReactNode, useEffect, useRef } from 'react';
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Redirect,
  Router as WouterRouter,
} from 'wouter';
import { MotionConfig } from 'framer-motion';
import { Layout } from '@/components/layout';
import Home from '@/pages/home';
import About from '@/pages/about';
import Marketplace from '@/pages/marketplace';
import Success from '@/pages/success';
import SplashActivation from '@/pages/splash-activation';
import AdvertiserRequests from '@/pages/sales/advertiser-requests';
import Insights from '@/pages/insights';
import InsightArticle from '@/pages/insight-article';
import EditorialDashboard from '@/pages/editorial/dashboard';
import EditorialDrafts from '@/pages/editorial/drafts';
import EditorialSources from '@/pages/editorial/sources';
import EditorialEditor from '@/pages/editorial/editor';
import { EditorialAuthGuard } from '@/components/editorial-auth-guard';
import {
  ClerkProvider,
  Show,
  SignIn,
  SignUp,
  useClerk,
} from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { dark } from '@clerk/themes';
import TeamAccess from '@/pages/sales/team';
import { notifyEditorialAccessDenied } from '@/lib/access-utils';

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: dark,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#8fd6a5',
    colorForeground: '#f4f0e8',
    colorMutedForeground: '#9cabb4',
    colorDanger: '#e87979',
    colorBackground: '#0b151c',
    colorInput: '#14232d',
    colorInputForeground: '#f4f0e8',
    colorNeutral: 'rgba(255, 255, 255, 0.15)',
    fontFamily: 'var(--font-sans)',
    borderRadius: '0rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#0b151c] border border-white/10 shadow-2xl shadow-black/20 w-[440px] max-w-full overflow-hidden p-3 sm:p-7 md:p-10',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'font-display text-3xl text-white md:text-4xl font-normal',
    headerSubtitle: 'text-sm text-[#9cabb4]',
    formFieldLabel: 'text-xs font-medium text-[#c1cbd1]',
    formFieldInput: 'h-11 rounded-none border-white/15 bg-[#14232d] text-[#f4f0e8] focus-visible:ring-[#8fd6a5]',
    formButtonPrimary: 'h-11 w-full rounded-none bg-[#8fd6a5] text-[#07130d] hover:bg-[#a8e8b9] transition-colors font-medium',
    footerActionText: 'text-sm text-[#9cabb4]',
    footerActionLink: 'text-sm font-medium text-[#8fd6a5] hover:text-[#a8e8b9]',
    socialButtonsBlockButton: 'h-11 rounded-none border border-white/15 bg-transparent hover:bg-white/5 text-[#f4f0e8]',
    dividerLine: 'bg-white/15',
    dividerText: 'text-xs text-[#9cabb4]',
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-[#101c25] px-6 py-16">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        forceRedirectUrl={`${basePath}/sales/advertiser-requests`}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-[#101c25] px-6 py-16">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        forceRedirectUrl={`${basePath}/sales/advertiser-requests`}
      />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: notifyEditorialAccessDenied,
  }),
  mutationCache: new MutationCache({
    onError: notifyEditorialAccessDenied,
  }),
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

if (import.meta.env.VITE_BROWSER_TEST_AUTH === 'true') {
  Object.assign(window, {
    __BIRCH_EDITORIAL_QUERY_CACHE__: () =>
      queryClient
        .getQueryCache()
        .getAll()
        .filter((query) => {
          const root = query.queryKey[0];
          return (
            typeof root === 'string' &&
            root.startsWith('/api/editorial/admin')
          );
        })
        .map((query) => ({
          queryKey: query.queryKey,
          data: query.state.data,
          fetchStatus: query.state.fetchStatus,
        })),
  });
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/sales/advertiser-requests" />
      </Show>
      <Show when="signed-out">
        <Home />
      </Show>
    </>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        {/* Public Routes with Layout */}
        <Route path="/">
          <Layout><HomeRedirect /></Layout>
        </Route>
        <Route path="/about">
          <Layout><About /></Layout>
        </Route>
        <Route path="/marketplace">
          <Layout><Marketplace /></Layout>
        </Route>
        <Route path="/success">
          <Layout><Success /></Layout>
        </Route>
        <Route path="/splash/activation">
          <Layout><SplashActivation /></Layout>
        </Route>
        <Route path="/sales/advertiser-requests">
          <Layout><AdvertiserRequests /></Layout>
        </Route>
        <Route path="/sales/team">
          <Layout><TeamAccess /></Layout>
        </Route>
        <Route path="/insights">
          <Layout><Insights /></Layout>
        </Route>
        <Route path="/insights/:slug">
          <Layout><InsightArticle /></Layout>
        </Route>

        {/* Auth Routes */}
        <Route path="/sign-in/*?">
          <Layout><SignInPage /></Layout>
        </Route>
        <Route path="/sign-up/*?">
          <Layout><SignUpPage /></Layout>
        </Route>

        {/* Private Editorial Routes (No standard layout) */}
        <Route path="/editorial">
          <EditorialAuthGuard><EditorialDashboard /></EditorialAuthGuard>
        </Route>
        <Route path="/editorial/drafts">
          <EditorialAuthGuard><EditorialDrafts /></EditorialAuthGuard>
        </Route>
        <Route path="/editorial/drafts/:id">
          <EditorialAuthGuard><EditorialEditor /></EditorialAuthGuard>
        </Route>
        <Route path="/editorial/sources">
          <EditorialAuthGuard><EditorialSources /></EditorialAuthGuard>
        </Route>

        {/* 404 */}
        <Route>
          <Layout><NotFound /></Layout>
        </Route>
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: 'Birch Reserve',
            subtitle: 'Sign in to access your sales workspace',
          },
        },
        signUp: {
          start: {
            title: 'Create account',
            subtitle: 'Account creation does not grant sales access',
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <MotionConfig reducedMotion="user">
          <TooltipProvider>
            <Router />
            <Toaster />
          </TooltipProvider>
        </MotionConfig>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
