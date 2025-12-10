# Flow Review 10-12 — (d) FREE Plan Flow

## Scope
- FREE plan path from Pricing selection through navigation, plan data loading, and feature gating.

## Current Flow
- Pricing screen loads plans via `useSubscriptionPlans` (cache-driven), renders cards, and on “Proceed to Payment” calls `handleSubscribe`.
- `handleSubscribe` checks email verification, then routes to `NavigationRoute.PAYMENT` with the selected plan and cycle (no FREE-specific handling).
- Feature access is supposed to be provided by `useFeatureAccess`, backed by `subscriptionService` cache.

## Findings
- **Critical – FREE flows routed to payment:** No branch for the FREE plan; selecting FREE still navigates to the payment screen instead of activating or taking the user to onboarding, regressing the previous FREE activation path.

```106:121:src/app/(protected)/(payment)/pricing.tsx
const handleSubscribe = useCallback(() => {
  if (!user?.isEmailVerified) {
    setShowVerificationModal(true);
    return;
  }

  if (!selectedPlan) return;

  router.push({
    pathname: NavigationRoute.PAYMENT,
    params: {
      plan: selectedPlan,
      cycle: selectedCycle,
      promo: appliedPromo?.code,
    },
  });
}, [user, selectedPlan, selectedCycle, appliedPromo, router]);
```

- **Major – Plan data may be empty with no error:** `useSubscriptionPlans` only reads the cache; if the cache isn’t warm (or load failed), FREE plan metadata is returned as `null` with `success` status and no retry, so cards may render with placeholder data silently.

```129:191:src/hooks/use-subscription-plans.ts
const planData = subscription.getPlanData(plan);
...
setState(success(plans));
...
setState(errorState(appError, fallbackPlans));
```

- **Major – Feature gating broken:** `useFeatureAccess` reads `state.user` (non-existent), so FREE plan feature restrictions (limits, portal access) are never enforced.

```1:10:src/hooks/use-feature-access.ts
const user = useAuthStore(state => state.user);
const plan = user?.subscription?.plan;
```

- **Major – Pricing display mismatch:** Cards always display `plan.pricing.monthly` even when the annual toggle is selected; toggle label says “Annually” but toggles monthly, so FREE vs paid comparison is misleading.

```142:170:src/app/(protected)/(payment)/pricing.tsx
... onPress={() => handleCycleChange(BillingCycle.MONTHLY)} ...>Annually</StandardAppText>
```

```173:220:src/app/(protected)/(payment)/pricing.tsx
<StandardAppText variant="headlineSmall">
  {plan.pricing.monthly}
</StandardAppText>
<StandardAppText variant="bodyLarge">
  /{selectedCycle === BillingCycle.MONTHLY ? 'month' : 'year'}
</StandardAppText>
```

## Recommendations
- Reintroduce a FREE-specific branch: bypass payment, activate FREE subscription (or call the prior `updateSubscription` path), and route to the FREE onboarding/experience.
- In `useSubscriptionPlans`, fetch from Firestore when the cache is empty and surface a `LoadingState` with retries/errors so the UI can show a proper loading/error state.
- Fix `useFeatureAccess` to use `useUser`/`getUser` and return `FeatureAccess` once plan data is loaded; add enforcement for FREE limits (projects, portal, uploads).
- Correct the pricing toggle handler/label and render price via `getPriceDisplay(plan.plan, selectedCycle)` to avoid misleading comparisons.
- Add tests for FREE selection: (1) verifies navigation target (no payment), (2) enforces FREE limits through `FeatureAccess`, (3) pricing toggle displays “Free” consistently.

## Mermaid Diagram
```mermaid
flowchart TD
  A[Pricing Screen select FREE] --> B[useSubscriptionPlans (cache read)]
  B --> C[handleSubscribe]
  C --> D{Email verified?}
  D -->|No| E[EmailVerificationModal]
  D -->|Yes| F[Routes to PAYMENT (current impl)]
  %% Expected: F should go to FREE activation/onboarding instead of payment
  B --> G[useFeatureAccess (fails due to missing user selector)]
```

