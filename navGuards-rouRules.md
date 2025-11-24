# Navigation Guard & Routing Rules Analysis Report

**Date:** 2025-01-XX  
**File Analyzed:** `src/hooks/use-navigation-guard.ts` (lines 145-489)  
**Related Files:** `src/constants/navigation.ts`, `src/domain/navigation/navigation.schema.ts`

---

## Executive Summary

The `use-navigation-guard.ts` hook implements a centralized navigation routing system that evaluates user state, subscription status, and setup configuration to determine the appropriate route. The implementation follows most project standards but has a few areas for improvement.

### Overall Assessment

✅ **Strengths:**

- Proper use of `LoadingState<T>` pattern
- Correct error handling with `Result<T, AppError>` pattern
- Good use of error context building
- Proper cleanup on unmount
- No direct Firestore interactions (all through services)
- Retry logic with exponential backoff
- Prevents duplicate navigation attempts

⚠️ **Areas for Improvement:**

- Error context string conversion inconsistency
- Business logic condition check could be extracted
- Some error handling could be more specific
- Missing JSDoc for some internal functions

---

## Code Compliance Analysis

### ✅ Compliant Areas

#### 1. **LoadingState Pattern** ✅

```typescript
const [state, setState] = useState<LoadingState<NavigationState | null>>(idle());
```

- Correctly uses `LoadingState<T>` instead of separate loading/error states
- Proper state transitions: `idle()` → `loading()` → `success()` / `errorState()`

#### 2. **Error Handling** ✅

- All async operations return `Result<T, AppError>`
- Proper error context building with `ErrorContextBuilder.fromHook()`
- Errors are mapped using `ErrorMapper.createGenericError()`
- Error handling doesn't throw exceptions

#### 3. **Cleanup & Lifecycle** ✅

```typescript
useEffect(() => {
  return () => {
    isMountedRef.current = false;
  };
}, []);
```

- Proper cleanup on unmount
- Uses `isMountedRef` to prevent state updates after unmount

#### 4. **No Business Logic in Hook** ✅

- Business logic (trial list population) is delegated to `onboardingService.ensureTrialUserLists()`
- Hook only orchestrates service calls

#### 5. **No Direct Firestore Access** ✅

- All data access through services (`userSubscription`, `userSetup`)
- Follows ports & adapters architecture

#### 6. **Retry Logic** ✅

```typescript
withRetry(() => userSubscription.getByUserId(user.id), {
  maxAttempts: 5,
  delayMs: 500,
  exponential: true,
});
```

- Uses existing `withRetry` utility
- Proper exponential backoff configuration

### ⚠️ Areas Needing Improvement

#### 1. **Error Context String Conversion** ⚠️

**Current Implementation:**

```typescript
ErrorMapper.createGenericError(
  ErrorCode.NAVIGATION_ERROR,
  `Failed to execute routing rule action: ${rule.name}`,
  'Navigation error occurred',
  ErrorContextBuilder.toString(context), // ⚠️ Converting to string
  error,
  false,
);
```

**Issue:** While `ErrorMapper.createGenericError` accepts a string for context, the pattern in the codebase is inconsistent. Some places use `ErrorContextBuilder.toString()`, others pass the context object directly to `handleError()`.

**Recommendation:** This is acceptable since `ErrorMapper.createGenericError` requires a string. However, ensure consistency:

- Use `ErrorContextBuilder.toString(context)` when creating errors with `ErrorMapper.createGenericError`
- Pass context object directly to `handleError(context)` (which is already done correctly)

#### 2. **Business Logic Condition Check** ⚠️

**Current Implementation (lines 338-345):**

```typescript
if (
  subscription.plan === 'FREE' &&
  subscription.status === 'ACTIVE' &&
  subscription.isTrial === true &&
  user.isEmailVerified === true &&
  setup.firstTimeSetup === true
) {
  // Auto-populate trial user lists
}
```

**Issue:** The condition check duplicates logic that exists in `onboardingService.ensureTrialUserLists()`. The service already checks these conditions internally.

**Recommendation:** Consider removing the condition check and always calling `ensureTrialUserLists()` in the background. The service will return early if conditions aren't met. This reduces duplication and centralizes the business logic.

**Improved Version:**

```typescript
// Always attempt to ensure trial lists (service handles condition checking)
services.onboarding
  .ensureTrialUserLists(user.id, subscription, user, setup)
  .then(result => {
    if (result.success && __DEV__) {
      console.log('✅ Trial user lists auto-populated');
    } else if (!result.success && __DEV__) {
      console.warn('⚠️ Failed to auto-populate trial user lists:', result.error.userMessage);
    }
  })
  .catch(err => {
    if (__DEV__) {
      console.error('❌ Error auto-populating trial user lists:', err);
    }
  });
```

#### 3. **Error Handling Specificity** ⚠️

**Current Implementation (lines 191-213):**

```typescript
catch (error) {
  const context = ErrorContextBuilder.fromHook(
    'useNavigationGuard',
    'evaluateRoutingRules',
    user.id,
  );
  const appError =
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    'userMessage' in error
      ? (error as AppError)
      : ErrorMapper.createGenericError(
          ErrorCode.NAVIGATION_ERROR,
          `Failed to execute routing rule action: ${rule.name}`,
          'Navigation error occurred',
          ErrorContextBuilder.toString(context),
          error,
          false,
        );
  handleError(appError, context);
  onError?.(appError);
}
```

**Issue:** The error type checking could use a utility function for consistency.

**Recommendation:** Consider using `ErrorMapper.fromUnknown()` if available, or create a type guard:

```typescript
private static isAppError(error: unknown): error is AppError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    'userMessage' in error &&
    'timestamp' in error
  );
}
```

#### 4. **Missing JSDoc for Internal Functions** ⚠️

**Current:** `buildNavigationState()` and `evaluateRoutingRules()` have JSDoc, but `handleNavigation()` could have more detailed documentation.

**Recommendation:** Add comprehensive JSDoc explaining the navigation flow, retry logic, and fallback behavior.

---

## Navigation State Breakdown

### NavigationState Schema

The `NavigationState` type represents the current navigation context based on route segments:

```typescript
interface NavigationState {
  inAuthGroup: boolean; // User is in (auth) group
  inOnboardingGroup: boolean; // User is in (onboarding) group
  inSetupGroup: boolean; // User is in (setup) group
  inPaymentGroup: boolean; // User is in (payment) group
  inSubscriptionGroup: boolean; // User is in (subscription) group
  inProjects: boolean; // User is in (projects) group
  inDashboard: boolean; // User is in (dashboard) group
  inEmailVerification: boolean; // User is on email verification screen
  inAppGroup: boolean; // User is in any app group (computed)
  inMainApp: boolean; // User is in projects or dashboard (computed)
}
```

### State Building Logic

**Function:** `buildNavigationState()` (lines 116-143)

**Purpose:** Analyzes current route segments to determine which navigation group the user is in.

**Logic:**

1. Extracts first and second route segments
2. Sets boolean flags for each navigation group
3. Computes `inAppGroup` (not in auth/onboarding/setup/payment/subscription)
4. Computes `inMainApp` (in projects or dashboard)

**Dependencies:**

- `segments` from `useSegments()` hook
- Route segment naming convention: `(groupName)/routeName`

**Example States:**

| Route                            | inAuthGroup | inOnboardingGroup | inSetupGroup | inProjects | inDashboard |
| -------------------------------- | ----------- | ----------------- | ------------ | ---------- | ----------- |
| `/(auth)/welcome`                | ✅          | ❌                | ❌           | ❌         | ❌          |
| `/(onboarding)/freeSubscription` | ❌          | ✅                | ❌           | ❌         | ❌          |
| `/(setup)/kit`                   | ❌          | ❌                | ✅           | ❌         | ❌          |
| `/(projects)`                    | ❌          | ❌                | ❌           | ✅         | ❌          |
| `/(dashboard)/(home)`            | ❌          | ❌                | ❌           | ❌         | ✅          |

---

## Routing Rules Detailed Breakdown

The routing system uses a priority-based rule evaluation system. Rules are sorted by priority (highest first) and the first matching rule determines the target route.

### Rule Evaluation Flow

1. **Sort Rules by Priority** (line 155)

   ```typescript
   const sortedRules = [...ROUTING_RULES].sort((a, b) => b.priority - a.priority);
   ```

2. **Evaluate Each Rule** (lines 157-166)
   - Passes 6 parameters to condition function:
     - `user: BaseUser | null`
     - `subscription: UserSubscription | null`
     - `setup: UserSetup | null`
     - `sessionFlags: SessionFlags`
     - `currentRoute: string`
     - `activeProjectId: string | null`

3. **Execute onMatch Callback** (lines 170-214)
   - If rule matches and has `onMatch` callback:
     - Sync: Returns `Partial<SessionFlags>` → Updates session flags
     - Async: Returns `Promise<void>` → Executes service calls

4. **Return Target Route** (lines 220-223)
   - Returns route and optional params
   - Navigation guard uses this to navigate

---

### Routing Rules (Priority Order)

#### 1. **Email Verification Required** (Priority: 101)

**ID:** `email-verification`  
**Target Route:** `NavigationRoute.VERIFY_EMAIL`

**Condition:**

```typescript
!!user &&
  !user.isEmailVerified &&
  !(setup?.skippedEmailVerification === true) &&
  currentRoute !== NavigationRoute.VERIFY_EMAIL;
```

**Triggers:**

- User exists
- Email not verified
- User hasn't skipped verification
- Not already on verification screen (prevents loop)

**Purpose:** Blocks all navigation for unverified users unless they've explicitly skipped verification.

**Session Flags:** None

**Dependencies:**

- `user.isEmailVerified`
- `setup.skippedEmailVerification`

**Result:** Redirects to email verification screen

---

#### 2. **Payment Email Verification Gate** (Priority: 100)

**ID:** `payment-verification-gate`  
**Target Route:** `NavigationRoute.VERIFY_EMAIL`

**Condition:**

```typescript
!!user && !user.isEmailVerified && currentRoute.startsWith('/(payment)');
```

**Triggers:**

- User exists
- Email not verified
- User attempts to access payment routes

**Purpose:** Catches users who skipped verification (bypassing rule 101) but now try to access payment features. Payment requires email verification.

**Session Flags:** None

**Dependencies:**

- `user.isEmailVerified`
- Current route path

**Result:** Redirects to email verification screen

---

#### 3. **No Plan Pricing** (Priority: 99)

**ID:** `no-plan-pricing`  
**Target Route:** `NavigationRoute.SUBSCRIPTION_PRICING`

**Condition:**

```typescript
!!user &&
  !!subscription &&
  (subscription.plan === SubscriptionPlan.NONE ||
    subscription.status === SubscriptionStatus.NONE) &&
  !!setup &&
  setup.firstTimeSetup === true;
```

**Triggers:**

- User exists
- Subscription exists
- Plan is NONE or status is NONE
- First time setup (new user)

**Purpose:** Forces users with no plan to select one during initial setup.

**Session Flags:** None

**Dependencies:**

- `subscription.plan`
- `subscription.status`
- `setup.firstTimeSetup`

**Result:** Redirects to subscription pricing screen

---

#### 4. **Newly Registered Pricing** (Priority: 98)

**ID:** `newly-registered-pricing`  
**Target Route:** `NavigationRoute.SUBSCRIPTION_PRICING`

**Condition:**

```typescript
!!user &&
  !!subscription &&
  subscription.status === SubscriptionStatus.INACTIVE &&
  !!setup &&
  setup.firstTimeSetup === true;
```

**Triggers:**

- User exists
- Subscription exists
- Subscription status is INACTIVE
- First time setup

**Purpose:** Routes newly registered users (with inactive subscription) to pricing to select a plan.

**Session Flags:** None

**Dependencies:**

- `subscription.status`
- `setup.firstTimeSetup`

**Result:** Redirects to subscription pricing screen

---

#### 5. **Subscription Expiry Warning** (Priority: 90)

**ID:** `subscription-expiry-warning`  
**Target Route:** `NavigationRoute.ONBOARDING_EXPIRING`

**Condition:**

```typescript
!!user &&
  !!subscription &&
  subscription.plan !== SubscriptionPlan.FREE &&
  subscription.autoRenew === false &&
  !!subscription.endDate &&
  !sessionFlags.hasSeenExpiryWarning &&
  isExpiringDay(subscription.endDate);
```

**Triggers:**

- User exists
- Subscription exists
- Not on FREE plan
- Auto-renew is disabled
- End date exists
- User hasn't seen warning this session
- Today is an expiring day (14, 10, 5, 3, or 1 days before expiry)

**Purpose:** Shows subscription expiry warning on specific days before expiration.

**Session Flags:**

- `onMatch`: Sets `hasSeenExpiryWarning: true` (prevents showing again this session)

**Dependencies:**

- `subscription.plan`
- `subscription.autoRenew`
- `subscription.endDate`
- `sessionFlags.hasSeenExpiryWarning`
- `isExpiringDay()` utility function

**Result:** Shows expiry warning screen, sets session flag

---

#### 6. **Inactive Subscription** (Priority: 80)

**ID:** `inactive-subscription`  
**Target Route:** `NavigationRoute.PAYMENT_INDEX`

**Condition:**

```typescript
!!subscription && subscription.status === SubscriptionStatus.INACTIVE;
```

**Triggers:**

- Subscription exists
- Subscription status is INACTIVE

**Purpose:** Routes users with inactive subscriptions to payment screen.

**Session Flags:** None

**Dependencies:**

- `subscription.status`

**Result:** Redirects to payment screen

---

#### 7. **Past Due Subscription** (Priority: 75)

**ID:** `past-due-subscription`  
**Target Route:** `NavigationRoute.PAYMENT_INDEX` (with `mode: 'update'` param)

**Condition:**

```typescript
!!subscription && subscription.status === SubscriptionStatus.PAST_DUE;
```

**Triggers:**

- Subscription exists
- Subscription status is PAST_DUE

**Purpose:** Routes users with past due subscriptions to payment update screen.

**Session Flags:** None

**Dependencies:**

- `subscription.status`

**Params:** `{ mode: 'update' }`

**Result:** Redirects to payment screen with update mode

---

#### 8. **Cancelled Subscription** (Priority: 70)

**ID:** `cancelled-subscription`  
**Target Route:** `NavigationRoute.SUBSCRIPTION_GATE`

**Condition:**

```typescript
!!subscription && subscription.status === SubscriptionStatus.CANCELLED;
```

**Triggers:**

- Subscription exists
- Subscription status is CANCELLED

**Purpose:** Routes users with cancelled subscriptions to subscription gate (reactivation screen).

**Session Flags:** None

**Dependencies:**

- `subscription.status`

**Result:** Redirects to subscription gate screen

---

#### 9. **Free User Welcome** (Priority: 65)

**ID:** `free-plan-onboarding`  
**Target Route:** `NavigationRoute.ONBOARDING_FREE`

**Condition:**

```typescript
!!user &&
  !!subscription &&
  subscription.plan === SubscriptionPlan.FREE &&
  !sessionFlags.hasSeenFreeWelcome;
```

**Triggers:**

- User exists
- Subscription exists
- Plan is FREE
- User hasn't seen free welcome this session

**Purpose:** Shows free user welcome onboarding every app launch (session-based).

**Session Flags:**

- `onMatch`: Sets `hasSeenFreeWelcome: true` (prevents showing again this session)

**Dependencies:**

- `subscription.plan`
- `sessionFlags.hasSeenFreeWelcome`

**Result:** Shows free onboarding screen, sets session flag

---

#### 10. **Active Onboarding (Paid)** (Priority: 62)

**ID:** `active-onboarding`  
**Target Route:** `NavigationRoute.ONBOARDING_PAID`

**Condition:**

```typescript
!!subscription &&
  subscription.status === SubscriptionStatus.ACTIVE &&
  (subscription.plan === SubscriptionPlan.BASIC ||
    subscription.plan === SubscriptionPlan.PRO ||
    subscription.plan === SubscriptionPlan.STUDIO) &&
  !!setup &&
  setup.showOnboarding === true &&
  currentRoute !== NavigationRoute.SUBSCRIPTION_PRICING &&
  !currentRoute.startsWith('/(payment)');
```

**Triggers:**

- Subscription exists
- Subscription status is ACTIVE
- Plan is BASIC, PRO, or STUDIO (not FREE)
- Setup shows onboarding
- Not on pricing or payment routes (allows navigation to these)

**Purpose:** Shows paid onboarding for active paid users (before setup wizard).

**Session Flags:** None

**Dependencies:**

- `subscription.status`
- `subscription.plan`
- `setup.showOnboarding`
- Current route

**Result:** Shows paid onboarding screen

**Note:** Priority 62 ensures this runs BEFORE setup wizard (priority 60)

---

#### 11. **Active First Time Setup** (Priority: 60)

**ID:** `active-first-time-setup`  
**Target Route:** `NavigationRoute.SETUP_INDEX`

**Condition:**

```typescript
!!user &&
  user.isEmailVerified &&
  !!subscription &&
  subscription.status === SubscriptionStatus.ACTIVE &&
  !!setup &&
  setup.firstTimeSetup === true;
```

**Triggers:**

- User exists
- Email is verified (explicit check)
- Subscription exists
- Subscription status is ACTIVE
- Setup indicates first time setup

**Purpose:** Routes verified users with active subscriptions through setup wizard.

**Session Flags:** None

**Dependencies:**

- `user.isEmailVerified`
- `subscription.status`
- `setup.firstTimeSetup`

**Result:** Redirects to setup wizard

**Note:** Only runs for verified users (Req #14)

---

#### 12. **Dashboard Project Guard** (Priority: 50)

**ID:** `dashboard-project-guard`  
**Target Route:** `NavigationRoute.PROJECTS_INDEX`

**Condition:**

```typescript
currentRoute.startsWith('/(dashboard)') && !activeProjectId;
```

**Triggers:**

- User attempts to access dashboard routes
- No active project selected

**Purpose:** Prevents access to dashboard sub-pages without a selected project.

**Session Flags:** None

**Dependencies:**

- Current route path
- `activeProjectId` from Zustand store

**Result:** Redirects to projects index (to select a project)

---

#### 13. **Trialing Onboarding** (Priority: 50)

**ID:** `trialing-onboarding`  
**Target Route:** `NavigationRoute.ONBOARDING_FREE`

**Condition:**

```typescript
!!subscription &&
  subscription.isTrial === true &&
  subscription.status === SubscriptionStatus.ACTIVE &&
  !!setup &&
  setup.showOnboarding === true &&
  currentRoute !== NavigationRoute.SUBSCRIPTION_PRICING &&
  !currentRoute.startsWith('/(payment)');
```

**Triggers:**

- Subscription exists
- Subscription is trial (`isTrial === true`)
- Subscription status is ACTIVE
- Setup shows onboarding
- Not on pricing or payment routes

**Purpose:** Shows free onboarding for trialing users.

**Session Flags:** None

**Dependencies:**

- `subscription.isTrial`
- `subscription.status`
- `setup.showOnboarding`
- Current route

**Result:** Shows free onboarding screen

---

#### 14. **Default Projects** (Priority: 10)

**ID:** `default-projects`  
**Target Route:** `NavigationRoute.PROJECTS_INDEX`

**Condition:**

```typescript
true; // Always matches
```

**Triggers:** Always (catch-all)

**Purpose:** Default route for fully onboarded, verified, active users who don't match any other rules.

**Session Flags:** None

**Dependencies:** None

**Result:** Redirects to projects index

---

## Navigation Flow Diagram

```
User Authentication State
│
├─ No User → Welcome Screen
│
└─ User Exists
   │
   ├─ Fetch Subscription & Setup Data
   │  ├─ Error → Fallback to Projects
   │  └─ Success → Evaluate Rules
   │
   └─ Rule Evaluation (Priority Order)
      │
      ├─ Priority 101: Email Verification
      │  └─ Not Verified → Verify Email Screen
      │
      ├─ Priority 100: Payment Verification Gate
      │  └─ Payment Route + Not Verified → Verify Email Screen
      │
      ├─ Priority 99: No Plan Pricing
      │  └─ No Plan + First Time → Pricing Screen
      │
      ├─ Priority 98: Newly Registered Pricing
      │  └─ INACTIVE + First Time → Pricing Screen
      │
      ├─ Priority 90: Subscription Expiry Warning
      │  └─ Expiring Soon + Not Seen → Expiry Warning Screen
      │
      ├─ Priority 80: Inactive Subscription
      │  └─ INACTIVE → Payment Screen
      │
      ├─ Priority 75: Past Due Subscription
      │  └─ PAST_DUE → Payment Screen (Update Mode)
      │
      ├─ Priority 70: Cancelled Subscription
      │  └─ CANCELLED → Subscription Gate
      │
      ├─ Priority 65: Free User Welcome
      │  └─ FREE + Not Seen → Free Onboarding
      │
      ├─ Priority 62: Active Onboarding (Paid)
      │  └─ ACTIVE + Paid + Show Onboarding → Paid Onboarding
      │
      ├─ Priority 60: Active First Time Setup
      │  └─ ACTIVE + Verified + First Time → Setup Wizard
      │
      ├─ Priority 50: Dashboard Project Guard
      │  └─ Dashboard + No Project → Projects Index
      │
      ├─ Priority 50: Trialing Onboarding
      │  └─ Trial + Show Onboarding → Free Onboarding
      │
      └─ Priority 10: Default
         └─ Always → Projects Index
```

---

## Session Flags System

### Purpose

Session flags provide transient state that resets on app reload, enabling "every launch" behavior for certain onboarding screens.

### SessionFlags Interface

```typescript
interface SessionFlags {
  hasSeenFreeWelcome: boolean; // Free user welcome shown this session
  hasSeenExpiryWarning: boolean; // Expiry warning shown this session
}
```

### Default Values

```typescript
const defaultSessionFlags: SessionFlags = {
  hasSeenFreeWelcome: false,
  hasSeenExpiryWarning: false,
};
```

### Flag Updates

**Sync Updates (lines 175-183):**

```typescript
if (result && typeof result === 'object' && !('then' in result)) {
  sessionFlagsRef.current = {
    ...sessionFlagsRef.current,
    ...(result as Partial<SessionFlags>),
  };
}
```

**Rules Using Session Flags:**

1. **Free User Welcome** (Priority 65)
   - Sets `hasSeenFreeWelcome: true` on match
   - Prevents showing again this session

2. **Subscription Expiry Warning** (Priority 90)
   - Sets `hasSeenExpiryWarning: true` on match
   - Prevents showing again this session

### Flag Lifecycle

- **Initialization:** Set to `defaultSessionFlags` on hook mount
- **Updates:** Modified by rule `onMatch` callbacks
- **Persistence:** Not persisted (in-memory only)
- **Reset:** Resets on app reload/restart

---

## Error Handling Flow

### Error Sources

1. **Rule onMatch Callback Errors** (lines 191-213)
   - Catches errors from rule `onMatch` callbacks
   - Maps to `AppError` if not already
   - Handles via `handleError()` and `onError` callback

2. **Data Fetch Errors** (lines 306-333)
   - Subscription or setup fetch failures after retries
   - Falls back to projects index
   - Handles via `handleError()` and `onError` callback

3. **Navigation Errors** (lines 435-470)
   - Catches unexpected errors in navigation flow
   - Falls back to projects index
   - Handles via `handleError()` and `onError` callback

### Error Context

All errors include context:

```typescript
const context = ErrorContextBuilder.fromHook(
  'useNavigationGuard',
  'methodName',
  user?.id, // Always includes userId when available
);
```

### Error Mapping

Errors are mapped using:

```typescript
ErrorMapper.createGenericError(
  ErrorCode.NAVIGATION_ERROR,
  'Technical message',
  'User-friendly message',
  ErrorContextBuilder.toString(context),
  originalError,
  false, // retryable
);
```

---

## Retry Logic

### Implementation

**Subscription Fetch:**

```typescript
withRetry(() => userSubscription.getByUserId(user.id), {
  maxAttempts: 5,
  delayMs: 500,
  exponential: true,
  onRetry: (attempt, error) => {
    if (__DEV__) {
      console.log(`⏳ Retry ${attempt}/5 fetching subscription: ${error.userMessage}`);
    }
  },
});
```

**Setup Fetch:**

```typescript
withRetry(() => userSetup.getByUserId(user.id), {
  maxAttempts: 5,
  delayMs: 500,
  exponential: true,
  onRetry: (attempt, error) => {
    if (__DEV__) {
      console.log(`⏳ Retry ${attempt}/5 fetching setup: ${error.userMessage}`);
    }
  },
});
```

### Retry Strategy

- **Max Attempts:** 5
- **Initial Delay:** 500ms
- **Backoff:** Exponential (500ms, 1000ms, 2000ms, 4000ms, 8000ms)
- **Parallel Execution:** Both fetches run in parallel with `Promise.all()`

### Failure Handling

If retries fail:

1. Error is logged via `handleError()`
2. `onError` callback is invoked
3. Falls back to projects index (if not already there)
4. Navigation state is set to success (to prevent blocking)

---

## Duplicate Prevention

### Navigation Attempt Flag

**Purpose:** Prevents infinite navigation loops and duplicate navigation attempts.

**Implementation:**

```typescript
const navigationAttemptedRef = useRef(false);

// Set when navigation is attempted
navigationAttemptedRef.current = true;

// Reset after delay (500ms)
setTimeout(() => {
  navigationAttemptedRef.current = false;
}, 500);
```

**Usage:**

1. **Prevents Duplicate Navigation** (line 258)

   ```typescript
   if (navigationAttemptedRef.current) {
     return;
   }
   ```

2. **Prevents Duplicate Fetches** (line 240)

   ```typescript
   if (isFetchingRef.current) {
     return;
   }
   ```

3. **Reset on Target Groups** (lines 510-521)
   ```typescript
   useEffect(() => {
     const navState = buildNavigationState();
     if (
       navState.inAuthGroup ||
       navState.inOnboardingGroup ||
       navState.inSetupGroup ||
       navState.inProjects ||
       navState.inDashboard
     ) {
       navigationAttemptedRef.current = false;
     }
   }, [segments, buildNavigationState]);
   ```

### Fetch Flag

**Purpose:** Prevents concurrent data fetches.

**Implementation:**

```typescript
const isFetchingRef = useRef(false);

// Set at start of fetch
isFetchingRef.current = true;

// Reset in finally block
finally {
  isFetchingRef.current = false;
}
```

---

## Special Cases

### 1. Payment Group Exception

**Lines 262-269:**

```typescript
if (navState.inPaymentGroup) {
  if (__DEV__) {
    console.log('✅ User in payment flow - allowing to stay');
  }
  setState(success(navState));
  return;
}
```

**Purpose:** Allows users to stay in payment flow without redirecting them away. Payment flow has its own navigation logic.

### 2. Unauthenticated Users

**Lines 247-255:**

```typescript
if (!user) {
  if (!navState.inAuthGroup && !navigationAttemptedRef.current) {
    navigationAttemptedRef.current = true;
    router.push(NavigationRoute.WELCOME);
  }
  return;
}
```

**Purpose:** Immediately routes unauthenticated users to welcome screen without fetching subscription/setup data.

### 3. Trial List Auto-Population

**Lines 338-371:**

```typescript
if (
  subscription.plan === 'FREE' &&
  subscription.status === 'ACTIVE' &&
  subscription.isTrial === true &&
  user.isEmailVerified === true &&
  setup.firstTimeSetup === true
) {
  // Call ensureTrialUserLists in background (don't block navigation)
  services.onboarding.ensureTrialUserLists(...)
}
```

**Purpose:** Auto-populates trial user lists in the background without blocking navigation. Runs asynchronously and doesn't affect navigation flow.

---

## Recommendations

### 1. **Extract Business Logic Condition** ✅

**Current:** Condition check duplicates service logic  
**Recommendation:** Remove condition check, always call service (service handles early return)

### 2. **Improve Error Type Checking** ✅

**Current:** Manual type checking  
**Recommendation:** Use type guard utility or `ErrorMapper.fromUnknown()`

### 3. **Add Comprehensive JSDoc** ✅

**Current:** Some functions lack detailed documentation  
**Recommendation:** Add JSDoc explaining flow, retry logic, and fallback behavior

### 4. **Consider Route Group Validation** 💡

**Enhancement:** Validate that target route group matches expected group to prevent misconfigurations.

### 5. **Add Metrics/Logging** 💡

**Enhancement:** Log rule matches and navigation decisions for debugging and analytics.

---

## Testing Considerations

### Unit Tests Needed

1. **buildNavigationState()**
   - Test all route segment combinations
   - Verify computed flags (`inAppGroup`, `inMainApp`)

2. **evaluateRoutingRules()**
   - Test each rule condition
   - Test priority ordering
   - Test session flag updates
   - Test onMatch callbacks (sync and async)

3. **handleNavigation()**
   - Test unauthenticated flow
   - Test payment group exception
   - Test retry logic
   - Test error fallback
   - Test duplicate prevention

4. **Integration Tests**
   - Test full navigation flow
   - Test rule priority conflicts
   - Test session flag persistence
   - Test error recovery

---

## Conclusion

The `use-navigation-guard.ts` hook is well-implemented and follows most project standards. The priority-based routing system is flexible and maintainable. Minor improvements in error handling and documentation would enhance the codebase further.

**Overall Grade: A-**

**Key Strengths:**

- Clean architecture compliance
- Proper error handling
- Good separation of concerns
- Effective duplicate prevention

**Areas for Improvement:**

- Extract duplicated business logic
- Enhance error type checking
- Add comprehensive documentation

---

## Appendix: Related Files

- `src/constants/navigation.ts` - Routing rules and route definitions
- `src/domain/navigation/navigation.schema.ts` - Navigation schemas and types
- `src/services/onboarding-service.ts` - Trial list population service
- `src/services/user-subscription-service.ts` - Subscription data service
- `src/services/user-setup-service.ts` - Setup data service
- `src/utils/error-recovery.ts` - Retry utility
- `src/utils/error-context-builder.ts` - Error context builder
- `src/utils/error-mapper.ts` - Error mapper utility
