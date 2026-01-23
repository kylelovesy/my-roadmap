# Master Design Document & Technical Trace (v2.2)

## 1\. Architectural Overview

**Style:** Clean Architecture / Layered Architecture adapted for React Native (Expo).

The application strictly separates **Presentation** (UI), **Business Logic** (Services), **Data Access** (Repositories), and **State Management** (Stores).

### The Layer Hierarchy (Top to Bottom)

1.  **Presentation Layer (`src/app`, `src/components`)**:
    - **Screens:** Dumb components that receive data via Hooks.
    - **Layouts (`_layout.tsx`):** Acting as "Traffic Cops" (Guards) for Auth, Plan Selection, Payment, Onboarding, and Setup.
    - **Components:** Reusable UI elements using React Native Paper.
2.  **Application Layer (`src/hooks`)**:
    - Connects Stores/Services to the UI.
    - Handles local loading states and side effects.
3.  **Domain Layer (`src/domain`)**:
    - **Schemas:** Zod schemas for validation.
    - **Types:** TypeScript interfaces.
    - **Errors:** Centralized `AppError` and `Result` types.
4.  **Service Layer (`src/services`)**:
    - Contains business logic (e.g., "Calculate price," "Check promo code").
    - Orchestrates multiple repositories.
    - **Rule:** Never access Firestore directly here; use a Repository.
5.  **Repository Layer (`src/repositories`)**:
    - Direct interaction with Firestore/Storage/Functions.
    - Returns `Result<T, AppError>`.
6.  **Infrastructure (`src/config`, `lib/functions`)**:
    - Firebase configuration, Stripe setup.

---

## 2\. Directory Structure & Key Files

```text
src/
├── app/                  # Expo Router (Filesystem Routing)
│   ├── (auth)/           # Public: Login, Register
│   ├── (protected)/      # Private: Requires Auth
│   │   ├── (payment)/    # Pricing & Stripe (STEP 1)
│   │   ├── (onboarding)/ # Welcome/Tutorials (STEP 2)
│   │   ├── (setup)/      # Wedding Details Wizard (STEP 3 - Paid only)
│   │   ├── (app)/        # Main App (Projects, Dashboard)
│   │   └── _layout.tsx   # CORE AUTH GUARD
├── components/           # UI Components (Common & Feature specific)
│   ├── common/ui/        # StandardApp* components (Buttons, Text, etc.)
├── constants/            # Design tokens, Enums, Theme
├── domain/               # Zod Schemas & Types (Single source of truth)
├── hooks/                # Application Logic (useRegister, useUserState)
├── services/             # Business Logic (AuthService, PaymentService)
├── stores/               # Global State (useAuthStore - Zustand)
└── utils/                # Helpers (Error handling, Validation, Formatting)
```

---

## 3\. Core Coding Patterns (The Rules)

### A. The "Traffic Cop" Routing Logic

Route protection logic lives in `_layout.tsx` files. The app acts as a state machine:

- **Logic Location:** Route protection logic lives in `_layout.tsx` files, not in the screens themselves.
- **Logic:** `useUserState` resolves the user's status (`PermissionLevel`, `needsOnboarding`, `needsSetup`).
- **The Chain:** `RootLayout` $\rightarrow$ `AuthLayout` $\rightarrow$ `ProtectedLayout` $\rightarrow$ `AppLayout`.
- **Rule:** If a user needs to be redirected (e.g., Subscription expired), handle it in the `_layout.tsx` using `useUserState`.

### B. Data Fetching & State Management

- **Store:** Use **Zustand** (`useAuthStore`) for global user state, holds the _entire_ User object (Profile, Subscription, Setup flags).
- **Local Data:** Use Custom Hooks (e.g., `useKitList`) for fetching lists/project data.
- **Services:** Access Services via `useServices()` hook (Dependency Injection pattern).
- **Updates:** Use `optimisticUpdate` for instant UI feedback, then sync with backend.
- **Persistence:** `AsyncStorage` persists the session token.

### C. Error Handling (Result Pattern)

- **No Throwing:** Do not `throw` errors in Services/Repositories.
- **Result Pattern:** All async methods must return `Promise<Result<T, AppError>>`.
  - Use `ok(data)` for success.
  - Use `err(error)` for failures.
- **Handling:** UI Hooks check `result.success`. If `false`, pass `result.error` to `useErrorHandler`.

<!-- end list -->

```typescript
// Example Service Method
async doSomething(): Promise<Result<void, AppError>> {
  try {
    // ... logic
    return ok(undefined);
  } catch (e) {
    return err(ErrorMapper.toAppError(e));
  }
}
```

### D. Setup & Onboarding Logic

- **Setup Flow:** This is a dedicated Tab Navigator. Logic is centralized in `useSetupLogic.ts`.
- **Race Conditions:** Be extremely careful with "User Creation" vs. "Document Creation." Use `waitForUserDocumentsReady` when a user registers.

---

## 4\. Detailed Technical Traces (User Flows)

These traces map the user journey to specific files, functions, and state changes.

### Flow 1: New User - Free Plan (Unverified)

**Phase 1: Registration**

- **Screen:** `src/app/(auth)/register.tsx`
- **Action:** User submits form.
- **Trace:**
  1.  **Hook:** `useRegister()` calls `useAuthStore.setRegistering(true)` (Prevent race condition).
  2.  **Service:** `AuthService.register()` creates Firebase Auth credential.
  3.  **Wait:** `waitForUserDocumentsReady(userId)` polls Firestore (max 15s) for the Cloud Function to create the user document.
  4.  **Sync:** `UserService.getUser()` fetches full profile.
  5.  **Store:** `useAuthStore.setUser()` updates global state.
- **State Result:** `PermissionLevel.NONE` (Default for new users).

**Phase 2: Plan Selection (The Gate)**

- **Routing:** `(protected)/_layout.tsx` sees `PermissionLevel.NONE`. Redirects to `(payment)/pricing`.
- **Screen:** `src/app/(protected)/(payment)/pricing.tsx`.
- **Action:** User selects **"Free Plan"**.
- **Logic:** `handleSelectPlan` checks `user.isEmailVerified` (It is `false`).
- **UI:** Triggers `EmailVerificationModal`. User is **blocked** until verified or clicks "Check Again".

**Phase 3: Verification & Activation**

- **Action:** User verifies email link $\rightarrow$ Clicks "I've Verified".
- **Service:** `AuthService.checkEmailVerificationStatus()` updates backend `emailVerified: true`.
- **Service:** `UserService.updateSubscription({ plan: 'free' })`.
- **State Update:** `PermissionLevel` changes to `FREE`.
- **Routing:** `AppLayout` detects `needsOnboarding: true`. Redirects to `(onboarding)/free`.

**Phase 4: Onboarding**

- **Screen:** `src/app/(protected)/(onboarding)/free.tsx`.
- **Action:** User completes slides.
- **Service:** `UserService.updateSetup({ needsOnboarding: false })`.
- **Routing:** Redirects to `(app)/(projects)`.

---

### Flow 2: New User - Paid Plan (PRO)

**Phase 1: Registration**

- (Same as Flow 1). State is `PermissionLevel.NONE`.

**Phase 2: Payment Execution**

- **Routing:** Redirects to `(payment)/pricing`.
- **Action:** User selects **"Pro Plan"**.
- **File:** `src/services/payment-service.ts`.
- **Call:** `paymentService.initializeSubscription(priceId, ...)`.
  - **Backend:** Creates Stripe Customer & Subscription (status: `incomplete`).
- **UI:** `paymentService.presentPaymentSheet()` (Stripe Native UI).
- **Success:** Payment completes.
- **Critical State Sync:**
  - Stripe Webhook fires $\rightarrow$ Updates Firestore `users/{userId}`.
  - **Risk:** `useUserSubscription` hook must poll or listen for `subscription.status` to become `active`.
  - _Mitigation:_ Show a "Finalizing..." spinner until Firestore reflects the payment.

**Phase 3: Routing Cascade**

- **State Change:** `PermissionLevel` becomes `PAID`. `needsSetup` becomes `true`.
- **Routing:** `(onboarding)/layout` redirects to `(onboarding)/paid`.
- **Action:** User finishes onboarding. `needsOnboarding` $\rightarrow$ `false`.
- **Routing:** `(app)/layout` checks `needsSetup`. Redirects to `(setup)/index`.

**Phase 4: Setup Wizard (Paid Only)**

- **Screen:** `src/app/(protected)/(setup)/index.tsx`.
- **Context:** Wrapped in `SetupProvider`.
- **Hook:** `useSetupLogic.ts` initializes.
- **Action:** User configures Wedding Date, Kit, & Shot Lists.
- **Data Write:** `SetupService.processList` creates documents in `projects/{projectId}`.
- **Completion:** User taps "Finish". `needsSetup` $\rightarrow$ `false`.
- **Destination:** Redirects to `(app)/(projects)`.

---

### Flow 3: Existing User (Authenticated)

- **Trigger:** App Launch.
- **File:** `src/app/_layout.tsx`.
- **Trace:**
  1.  `AuthInitializer` mounts.
  2.  `useAuthStore` rehydrates token from `AsyncStorage`.
  3.  `AuthService.getProfile()` validates session.
- **Routing Logic (`useUserState`):**
  - Auth? ✅
  - Plan (Permission \> NONE)? ✅
  - Needs Onboarding? ❌
  - Needs Setup? ❌
- **Result:** User lands immediately on `(app)/(projects)`.

---

### Flow 4: Existing User (Plan Expiring)

- **Trigger:** App Launch.
- **State:** `subscription.status` = `past_due` or `expiring_soon`.
- **Routing:**
  - `AppLayout` checks `UserState`.
  - Resolved state is `PAID_EXPIRING`.
- **Redirect:** `(protected)/(onboarding)/_layout.tsx` intercepts. Redirects to `(onboarding)/expiring`.
- **Screen:** `src/app/(protected)/(onboarding)/expiring.tsx`.
- **Options:**
  - _Renew:_ Redirects to `(payment)/pricing`.
  - _Dismiss:_ Sets temporary flag (session-based) to ignore warning. Redirects to `(projects)`.

---

## 5\. UI/UX & Styling System

- **Library:** **React Native Paper (v5)**.
- **Theming:** Use `useAppStyles()` to access `theme.colors`, `typography`, and `spacing`.
- **Components:** **DO NOT** use raw React Native components (`Text`, `Button`, `View`) directly if a "Standard" wrapper exists.
  - Use `StandardAppText` instead of `Text`.
  - Use `StandardAppButton` instead of `Button`.
  - Use `StandardAppSurface` for cards/containers.
  - Use `Screen` wrapper for top-level Page components (handles Safe Area, Loading, Error states automatically).

### Styling Example:

```tsx
const { theme, spacing, typography } = useAppStyles();

return (
  <StandardAppSurface style={{ padding: spacing.md }}>
    <StandardAppText {...typography.headlineSmall} style={{ color: theme.colors.primary }}>
      Title
    </StandardAppText>
  </StandardAppSurface>
);
```

---

## 6\. Data & Schema Standards

- **Validation:** Use **Zod** for all data validation (`src/domain/...`).
- **Input/Output:** Repositories accept Zod-inferred types.
- **Sanitization:** Use `sanitize-firestore.js` (Cloud Functions) or utility helpers to clean data before writing to Firestore.
- **Ids:** Use `id-generator.ts` for creating unique IDs on the client side.

---

# 6\. Implementation Checklist (Vibe Coding Prompt)

When asking an AI to implement a new feature, copy/paste this checklist to ensure compliance:

> **Constraint Checklist for New Code:**
>
> 1.  **Architecture:** Does this follow the _Hook -\> Service -\> Repository_ pattern?
> 2.  **Architecture:** Are you using `Service` -\> `Repository` (Result Pattern)? No `throw` statements in services.
> 3.  **Error Handling:** Are you using the `Result<T, AppError>` pattern instead of try/catch?
> 4.  **Flow Compliance:** Does this logic respect the _Pricing before Onboarding_ flow?
> 5.  **Schema Check (DRY):** Did you search `src/domain` for an **existing Zod schema** before creating a new one? (e.g., `user.schema.ts`, `shared-schemas.ts`).
> 6.  **Utilities Check (DRY):** Did you search `src/utils` for **existing helper functions** (dates, validation, formatting) before writing a new one?
> 7.  **UI Consistency (DRY):** Are you using existing **`StandardApp*`** components (`src/components/common/ui`) and **`src/constants`** (design tokens, enums) instead of hardcoding styles or creating new primitives?
> 8.  **UI:** Are you using `StandardApp*` components and `useAppStyles`?
> 9.  **Routing:** If this is a new section, did you add a `_layout.tsx` guard?
> 10. **Validation:** Did you create a Zod schema in `src/domain`?
> 11. **State:** Are you updating the Zustand store atomically if global state changes?
> 12. **Files:** Did you place files in the correct `src/` directories?

---

# 7\. Known "Gotchas" to Avoid

1.  **Direct Firestore Access:** Never import `firebase/firestore` in a `.tsx` component.
2.  **Missing Stripe Keys:** Ensure `app.json` config is passed to `StripeProvider` in Root Layout.
3.  **Setup Race Conditions:** The Setup wizard (`useSetupLogic`) relies on checking multiple boolean flags (`userKitListCreated`, etc.). Always ensure flags are set _after_ the data is confirmed written.
4.  **Navigation Loops:** Be careful in `_layout.tsx` logic. If `PermissionLevel` is blocked, do not redirect to a route that also checks permission, or you will cause an infinite loop.
5.  **Registration Race Condition:**
    - **Risk:** `AuthService.register` succeeds, but `waitForUserDocumentsReady` times out.
    - **Fix:** Ensure `useRegister` handles the timeout gracefully.
6.  **Payment State Latency:**
    - **Risk:** Webhook hasn't updated Firestore when Stripe Sheet closes.
    - **Fix:** Poll `UserService.getUser()` in the UI before redirecting.
7.  **Setup Logic Flags:**
    - **Risk:** Flags like `userKitListCreated` set true before data is confirmed written.
    - **Fix:** Only update local flags/store _after_ `Promise.all` success.
8.  **Infinite Redirect Loops:**
    - **Risk:** `PermissionLevel.NONE` user hitting a generic Protected route.
    - **Fix:** `(payment)/pricing` must be accessible to `NONE` level users.
