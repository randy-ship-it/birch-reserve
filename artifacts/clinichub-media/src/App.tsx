import { type ReactNode, useEffect, useRef, useState } from 'react';
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
import Home from '@/pages/br/home';
import BrRates from '@/pages/br/rates';
import BrMatch from '@/pages/br/match';
import BrAdvertiseBrands from '@/pages/br/advertise-brands';
import BrAdvertiseLocal from '@/pages/br/advertise-local';
import BrPublishBrands from '@/pages/br/publish-brands';
import BrPublishStudios from '@/pages/br/publish-studios';
import BrHubs from '@/pages/br/hubs';
import BrMediaKit from '@/pages/br/media-kit';
import BrAgencies from '@/pages/br/agencies';
import BrMediaBuyers from '@/pages/br/media-buyers';
import BrBrandKit from '@/pages/br/brand-kit';
import BrKitReport from '@/pages/br/kit-report';
import BrIntake from '@/pages/br/intake';
import ShareEventsPage from '@/pages/sales/share-events';
import BrIntakePublisher from '@/pages/br/intake-publisher';
import BrIntakeSupplier from '@/pages/br/intake-supplier';
import BrIntakeSponsor from '@/pages/br/intake-sponsor';
import BrIntakeReport from '@/pages/br/intake-report';
import BrIntakeGtm from '@/pages/br/intake-gtm';
import BrGtmBot from '@/pages/br/gtm-bot';
import BrIntakeStreetTeam from '@/pages/br/intake-street-team';
import BrStreetTeam from '@/pages/br/street-team';
import BrAiBuyers from '@/pages/br/ai-buyers';
import BrAudiences from '@/pages/br/audiences';
import BrSampleProfile from '@/pages/br/sample-profile';
import BrForBrand from '@/pages/br/for-brand';
import SellAdsPage from '@/pages/sell-ads';
import Terms from '@/pages/terms';
import Privacy from '@/pages/privacy';
import SampleIo from '@/pages/sample-io';
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
  useAuth,
  SignIn,
  SignUp,
  useClerk,
} from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import TeamAccess from '@/pages/sales/team';
import VoiceDemo from '@/pages/sales/voice-demo';
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
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  // Intake tokens (Nov 21 2026): ink #071A39, paper #F9F8F6, lime #C8F55A, white rounded cards, serif headlines.
  variables: {
    colorPrimary: '#071A39',
    colorForeground: '#071A39',
    colorMutedForeground: '#566476',
    colorDanger: '#8a2b1f',
    colorBackground: '#ffffff',
    colorInput: '#ffffff',
    colorInputForeground: '#071A39',
    colorNeutral: '#071A39',
    fontFamily: 'var(--font-sans)',
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-white border border-[#d9ddd2] shadow-[0_8px_30px_rgba(7,26,57,.08)] w-[440px] max-w-full overflow-hidden rounded-3xl p-3 sm:p-7 md:p-10',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'font-display text-3xl text-[#071A39] md:text-4xl font-normal',
    headerSubtitle: 'text-sm text-[#566476]',
    formFieldLabel: 'text-xs font-semibold text-[#071A39]',
    formFieldInput: 'h-11 rounded-xl border-[#071A39]/20 bg-white text-[#071A39] focus-visible:ring-[#C8F55A]',
    formButtonPrimary: 'h-11 w-full rounded-full bg-[#071A39] text-white hover:bg-[#C8F55A] hover:text-[#071A39] transition-colors font-bold',
    footerActionText: 'text-sm text-[#566476]',
    footerActionLink: 'text-sm font-semibold text-[#071A39] underline underline-offset-2 hover:text-[#071A39]',
    socialButtonsBlockButton: 'h-11 rounded-full border border-[#071A39]/20 bg-white hover:bg-[#F9F8F6] text-[#071A39]',
    dividerLine: 'bg-[#071A39]/15',
    dividerText: 'text-xs text-[#566476]',
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-[#F9F8F6] px-6 py-16">
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
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-[#F9F8F6] px-6 py-16">
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

// How long the signed-out home waits for Clerk before rendering anyway.
const CLERK_HOME_GRACE_MS = 2500;

function HomeRedirect() {
  // Browser tests have no Clerk frontend. The public home is what they exercise.
  if (import.meta.env.VITE_BROWSER_TEST_AUTH === "true") {
    return <Home />;
  }
  return <ClerkHomeRedirect />;
}

function ClerkHomeRedirect() {
  const { isLoaded } = useAuth();
  const [graceOver, setGraceOver] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setGraceOver(true), CLERK_HOME_GRACE_MS);
    return () => window.clearTimeout(timer);
  }, []);

  // Clerk never finishes loading when its Frontend API rejects the host (for
  // example a *.vercel.app preview of the birchreserve.net production
  // instance) or the proxy is down. The public home must not stay blank.
  if (!isLoaded && graceOver) {
    return <Home />;
  }
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
        {/* Overhaul (Nov 12 2026): four paths + tools */}
        <Route path="/advertise/brands">
          <Layout><BrAdvertiseBrands /></Layout>
        </Route>
        <Route path="/advertise/local">
          <Layout><BrAdvertiseLocal /></Layout>
        </Route>
        <Route path="/publish/brands">
          <Layout><BrPublishBrands /></Layout>
        </Route>
        <Route path="/publish/studios">
          <Layout><BrPublishStudios /></Layout>
        </Route>
        <Route path="/publish">
          <Redirect to="/publish/brands" />
        </Route>
        <Route path="/rates">
          <Layout><BrRates /></Layout>
        </Route>
        <Route path="/match">
          <Layout><BrMatch /></Layout>
        </Route>
        <Route path="/hubs">
          <Layout><BrHubs /></Layout>
        </Route>
        <Route path="/media-kit">
          <Layout><BrMediaKit /></Layout>
        </Route>
        <Route path="/agencies">
          <Layout><BrAgencies /></Layout>
        </Route>
        <Route path="/brand-kit">
          <Layout><BrBrandKit /></Layout>
        </Route>
        <Route path="/kit/r/:token">
          <Layout><BrKitReport /></Layout>
        </Route>
        <Route path="/intake/publisher">
          <Layout><BrIntakePublisher /></Layout>
        </Route>
        <Route path="/intake/supplier">
          <Layout><BrIntakeSupplier /></Layout>
        </Route>
        <Route path="/intake/sponsor">
          <Layout><BrIntakeSponsor /></Layout>
        </Route>
        <Route path="/gtm-bot">
          <Layout><BrGtmBot /></Layout>
        </Route>
        <Route path="/intake/gtm">
          <Layout><BrIntakeGtm /></Layout>
        </Route>
        <Route path="/intake/street-team">
          <Layout><BrIntakeStreetTeam /></Layout>
        </Route>
        <Route path="/street-team">
          <Layout><BrStreetTeam /></Layout>
        </Route>
        <Route path="/intake/report">
          <Layout><BrIntakeReport /></Layout>
        </Route>
        <Route path="/intake">
          <Layout><BrIntake /></Layout>
        </Route>
        <Route path="/media-buyers">
          <Layout><BrMediaBuyers /></Layout>
        </Route>
        <Route path="/for/:slug">
          <Layout><BrForBrand /></Layout>
        </Route>
        <Route path="/audiences/sample-profile">
          <Layout><BrSampleProfile /></Layout>
        </Route>
        <Route path="/audiences">
          <Layout><BrAudiences /></Layout>
        </Route>
        <Route path="/buyers">
          <Layout><BrAiBuyers /></Layout>
        </Route>
        <Route path="/ai-buyers">
          <Layout><BrAiBuyers /></Layout>
        </Route>
        <Route path="/about">
          <Layout><About /></Layout>
        </Route>
        <Route path="/kit">
          <Redirect to="/media-kit" />
        </Route>
        <Route path="/sell-ads">
          <Layout><SellAdsPage /></Layout>
        </Route>
        <Route path="/sellads">
          <Redirect to="/sell-ads" />
        </Route>
        <Route path="/list-inventory">
          <Redirect to="/sell-ads" />
        </Route>
        <Route path="/buy-ads">
          <Redirect to="/advertise/brands" />
        </Route>
        <Route path="/buyads">
          <Redirect to="/advertise/brands" />
        </Route>
        <Route path="/terms">
          <Layout><Terms /></Layout>
        </Route>
        <Route path="/privacy">
          <Layout><Privacy /></Layout>
        </Route>
        <Route path="/sample-io">
          <Layout><SampleIo /></Layout>
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
        {/* Internal team page (Emma 7:21pm): signed-in team only; the public gets the 404. */}
        {/* Internal share + referral events (Nov 19 2026): signed-in team only; the API also checks sales access. */}
        <Route path="/sales/share-events">
          <Show when="signed-in">
            <Layout><ShareEventsPage /></Layout>
          </Show>
          <Show when="signed-out">
            <Layout><NotFound /></Layout>
          </Show>
        </Route>
        <Route path="/sales/voice-demo">
          <Show when="signed-in">
            <Layout><VoiceDemo /></Layout>
          </Show>
          <Show when="signed-out">
            <Layout><NotFound /></Layout>
          </Show>
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

// Pages opened at scalehealth.ca/intake/_m/<path> (checkout returns, receipts) route as /<path>: strip the mirror prefix.
const mirrorBase = typeof window !== "undefined" && /^\/intake\/_m(?:\/|$)/.test(window.location.pathname) ? "/intake/_m" : "";

function App() {
  return (
    <WouterRouter base={`${basePath}${mirrorBase}`}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
