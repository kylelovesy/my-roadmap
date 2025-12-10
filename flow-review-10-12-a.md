# Flow Review 10-12 — (a) Global Flow

## Scope
- App bootstrap (`_layout.tsx`), auth initialization (`AuthInitializer`), route guards, subscription plan loading, and feature gating.

## Current Flow (as-built)
- Root layout loads fonts, initializes the global error handler, and kicks off `subscriptionService.loadAllPlans()` in a non-blocking effect before rendering stacks.
- `AuthInitializer` subscribes to Firebase Auth, waits for user docs, fetches the user, and pushes auth state into `use-auth-store`.
- `(auth)/_layout` redirects authenticated users away; `(protected)/_layout` blocks unauthenticated access.
- Plan data is read from the in-memory cache (`subscriptionService`) via `use-subscription-plans`; feature gating uses `use-feature-access`.

## Findings
- **Critical – Splash/auth race:** The splash gate checks for `authState.stage === 'initializing'`, but `AuthInitializer` sets loading with no stage, so the splash can hide before auth settles, causing flashes and guard races.

```63:68:src/app/_layout.tsx
const isAuthInitializing = useAuthStore(state => {
  const authState = state.authState;
  return authState.status === 'loading' && authState.stage === 'initializing';
});
```

```46:48:src/components/auth/AuthInitializer.tsx
// Set initial loading state
setAuthState(loading<null>(undefined, false));
```

- **Major – Plan data cache only:** `useSubscriptionPlans` only reads `subscription.getPlanData(plan)` (cache) and still returns `success` when the cache is empty; no Firestore fetch, no retry, no surfaced error, so pricing/features can be empty or stale without signalling.

```129:164:src/hooks/use-subscription-plans.ts
const planData = subscription.getPlanData(plan);
...
return {
  plan,
  planData,
  pricing: { monthly: pricingInfo.monthly, annual: pricingInfo.annual, trialDays: pricingInfo.trialDays },
  ...
};
...
setState(success(plans));
```

- **Major – Feature gating broken globally:** `useFeatureAccess` reads `state.user` from the auth store, but the store only exposes `authState`; this returns `undefined`, so all feature checks are effectively disabled.

```1:10:src/hooks/use-feature-access.ts
import { useAuthStore } from '@/stores/use-auth-store';
...
const user = useAuthStore(state => state.user);
const plan = user?.subscription?.plan;
```

- **Major – Pricing display inaccurate for all plans:** The pricing cards always render `plan.pricing.monthly` even when the annual cycle is selected, so values shown to the user do not match the chosen billing cycle.

```173:220:src/app/(protected)/(payment)/pricing.tsx
const price = getPriceDisplay(plan.plan as SubscriptionPlan, selectedCycle);
...
<StandardAppText variant="headlineSmall">
  {plan.pricing.monthly}
</StandardAppText>
<StandardAppText variant="bodyLarge">
  /{selectedCycle === BillingCycle.MONTHLY ? 'month' : 'year'}
</StandardAppText>
```

- **Minor – Toggle copy mismatch:** The cycle toggle labels “Annually” but triggers `BillingCycle.MONTHLY`, which is confusing and can compound the pricing display issue.

```142:170:src/app/(protected)/(payment)/pricing.tsx
<TouchableOpacity
  ... 
  onPress={() => handleCycleChange(BillingCycle.MONTHLY)}
>
  <StandardAppText ...>
    Annually
  </StandardAppText>
```

## Recommendations
- Set an explicit stage (e.g., `'initializing'`) when `AuthInitializer` starts and align Root/Protected layouts to that stage to keep the splash and guards in sync.
- Update `useSubscriptionPlans` to fetch when the cache is empty or stale (call `subscription.loadAllPlans()` with retries) and expose a `LoadingState` with surfaced errors.
- Fix `useFeatureAccess` to use `useUser()`/`getUser()` from the auth store and return a proper `LoadingState<FeatureAccess | null>` so plan gates actually execute.
- Correct pricing UI: drive the displayed price from `getPriceDisplay(plan.plan, selectedCycle)` and fix the toggle label/handler pairing.
- Add regression tests around auth init + splash gating and around pricing plan rendering with both monthly and annual cycles.

## Mermaid Diagram
```mermaid
flowchart TD
  A[RootLayout mount] --> B[AuthInitializer sets authState]
  B --> C[onAuthStateChanged -> waitForUserDocumentsReady -> userService.getUser]
  C --> D[Auth store authState success]
  D --> E[(auth)/_layout guest guard]
  D --> F[(protected)/_layout auth guard]
  A --> G[subscriptionService.loadAllPlans (non-blocking)]
  G --> H[useSubscriptionPlans read cache]
  H --> I[Pricing/FeatureAccess render]
```

