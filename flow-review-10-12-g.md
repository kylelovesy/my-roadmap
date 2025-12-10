# Flow Review 10-12 — (g) STUDIO Plan Flow

## Scope
- STUDIO plan selection, payment navigation, plan data loading, and feature gating.

## Current Flow
- Pricing screen uses `useSubscriptionPlans` (cache-only) to render plans. Selecting STUDIO sets `selectedPlan`; “Proceed to Payment” navigates to `NavigationRoute.PAYMENT` with the selected cycle.
- Feature access is expected via `useFeatureAccess`, built from cached plan data.

## Findings
- **Major – Plan data not fetched on cache miss:** `useSubscriptionPlans` reads cache only and still returns `success` when `planData` is `null`, so STUDIO-specific limits/features are unavailable and no error is shown.

```129:164:src/hooks/use-subscription-plans.ts
const planData = subscription.getPlanData(plan);
...
setState(success(plans));
```

- **Major – Feature gating broken:** `useFeatureAccess` references `state.user` (not present in auth store), preventing STUDIO feature checks from running.

```1:10:src/hooks/use-feature-access.ts
const user = useAuthStore(state => state.user);
const plan = user?.subscription?.plan;
```

- **Major – Pricing UI incorrect:** Cards render `plan.pricing.monthly` even on annual selection, and the toggle label fires the monthly handler. STUDIO’s annual vs monthly pricing shown to users is inaccurate.

```142:170:src/app/(protected)/(payment)/pricing.tsx
... onPress={() => handleCycleChange(BillingCycle.MONTHLY)} ...>Annually</StandardAppText>
```

```173:220:src/app/(protected)/(payment)/pricing.tsx
<StandardAppText variant="headlineSmall">
  {plan.pricing.monthly}
</StandardAppText>
...
/{selectedCycle === BillingCycle.MONTHLY ? 'month' : 'year'}
```

- **Minor – No LoadingState surface:** Pricing uses booleans for `loading`/`error`, limiting retry/visibility if STUDIO plan data is delayed.

## Recommendations
- Enhance `useSubscriptionPlans` to fetch from Firestore on cache miss with retries and return a `LoadingState`, so STUDIO data availability is explicit and recoverable.
- Fix `useFeatureAccess` to select user via `useUser`/`getUser` and emit `FeatureAccess` once plan data loads; add automated checks for STUDIO-only capabilities (e.g., higher limits, advanced portal sync).
- Correct the billing toggle and price rendering using `getPriceDisplay(plan.plan, selectedCycle)` to show the accurate STUDIO monthly/annual price.
- Propagate `LoadingState` through Pricing UI to align with loading-state standards and allow retry UX.

## Mermaid Diagram
```mermaid
flowchart TD
  A[Select STUDIO plan] --> B[useSubscriptionPlans (cache read)]
  B --> C[handleSubscribe -> Payment route]
  C --> D[Payment with STUDIO + cycle]
  B --> E[useFeatureAccess (fails: store.user missing)]
  E --> F[STUDIO feature gating skipped]
```

