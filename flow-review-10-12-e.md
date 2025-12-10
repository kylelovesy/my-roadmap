# Flow Review 10-12 — (e) BASIC Plan Flow

## Scope
- BASIC plan selection from Pricing through payment navigation, plan data retrieval, and feature gating.

## Current Flow
- Pricing screen renders plans from `useSubscriptionPlans` (cache read), user selects BASIC, then `handleSubscribe` pushes to `NavigationRoute.PAYMENT` with the chosen billing cycle.
- Feature entitlements are intended to come from `useFeatureAccess` (plan data cache) once the user is authenticated.

## Findings
- **Major – Plan data not fetched when cache cold:** `useSubscriptionPlans` does not call Firestore when the cache is empty; it returns `success` with `planData: null`, so BASIC limits/features aren’t available and the UI still renders.

```129:164:src/hooks/use-subscription-plans.ts
const planData = subscription.getPlanData(plan);
...
setState(success(plans));
```

- **Major – Feature gating broken:** `useFeatureAccess` reads `state.user` (not in the auth store), so BASIC feature checks never run; limits on projects, portal, lists, etc., are unenforced.

```1:10:src/hooks/use-feature-access.ts
const user = useAuthStore(state => state.user);
const plan = user?.subscription?.plan;
```

- **Major – Pricing UI misaligned with cycle:** Price text always shows `plan.pricing.monthly` regardless of selected cycle, while the toggle label says “Annually” but triggers the monthly handler. Users may see the wrong BASIC price.

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

- **Minor – No plan-level loading/error surfaced:** The Pricing screen passes a boolean `loading`/`error` rather than a `LoadingState`, so retry handling and stage visibility are limited if BASIC plan data is delayed.

## Recommendations
- In `useSubscriptionPlans`, fall back to fetching from Firestore when cache misses occur; expose a `LoadingState` and retry/backoff to surface BASIC plan load failures.
- Fix `useFeatureAccess` to use `useUser`/`getUser` and construct `FeatureAccess` with loaded plan data; add checks around BASIC-specific limits (e.g., project counts, portal features).
- Correct the billing toggle handler/label and drive display values from `getPriceDisplay(plan.plan, selectedCycle)`; ensure the BASIC annual price renders when annual is selected.
- Consider passing a `LoadingState` into the Pricing `Screen` and `FeatureComparisonTable` to align with loading-state standards and enable retry.

## Mermaid Diagram
```mermaid
flowchart TD
  A[Select BASIC plan] --> B[useSubscriptionPlans (cache read only)]
  B --> C[handleSubscribe -> Payment route]
  C --> D[Payment flow (Stripe) with BASIC + cycle]
  B --> E[useFeatureAccess (fails: store.user missing)]
  E --> F[Feature checks skipped -> limits unenforced]
```

