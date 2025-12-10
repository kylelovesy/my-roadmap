# Flow Review 10-12 — (f) PRO Plan Flow

## Scope
- PRO plan selection through payment, plan data availability, and feature gating.

## Current Flow
- Pricing screen renders plans from `useSubscriptionPlans` (cache-only). Selecting PRO sets `selectedPlan` and “Proceed to Payment” routes to `NavigationRoute.PAYMENT` with the selected cycle.
- Feature entitlements should be enforced via `useFeatureAccess` once plan data is available.

## Findings
- **Major – Cache-only plan data:** `useSubscriptionPlans` does not fetch when cache is empty; `planData` can be `null` with `success` status, so PRO limits (e.g., unlimited projects, portal features) aren’t available and no error is shown.

```129:164:src/hooks/use-subscription-plans.ts
const planData = subscription.getPlanData(plan);
...
setState(success(plans));
```

- **Major – Feature gating broken:** `useFeatureAccess` selects `state.user` (nonexistent), so FeatureAccess never initializes and PRO feature checks are skipped.

```1:10:src/hooks/use-feature-access.ts
const user = useAuthStore(state => state.user);
const plan = user?.subscription?.plan;
```

- **Major – Pricing display mismatch:** Pricing cards always show `plan.pricing.monthly` even when annual is selected; the toggle label is inverted. PRO annual vs monthly pricing shown to the user is therefore incorrect.

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

- **Minor – No surfaced retry/loading state for PRO:** Pricing `Screen` receives booleans, limiting adherence to the LoadingState standard and making retries opaque if PRO plan data is delayed.

## Recommendations
- Make `useSubscriptionPlans` fetch from Firestore when cache is missing/stale and expose `LoadingState` + retries so PRO data availability is explicit.
- Fix `useFeatureAccess` to use `useUser`/`getUser` and return `FeatureAccess` once plan data loads; add automated checks for PRO unlocks (e.g., higher limits, portal sync).
- Correct the billing toggle and price rendering using `getPriceDisplay(plan.plan, selectedCycle)` so PRO monthly/annual pricing is accurate.
- Propagate a `LoadingState` into Pricing/FeatureComparison to match standards and enable retries.

## Mermaid Diagram
```mermaid
flowchart TD
  A[Select PRO plan] --> B[useSubscriptionPlans (cache read)]
  B --> C[handleSubscribe -> Payment route]
  C --> D[Payment with PRO + cycle]
  B --> E[useFeatureAccess (fails: store.user missing)]
  E --> F[PRO feature gating skipped]
```

