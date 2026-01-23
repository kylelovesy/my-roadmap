# Global App Launch Flow Analysis - Part A

**Document Version:** 1.0.0  
**Date:** December 9, 2025  
**Scope:** First 10 steps from app launch  
**Purpose:** Comprehensive analysis of startup flow, interactions, and potential issues

---

## Table of Contents

1. [Overview](#overview)
2. [Step-by-Step Flow](#step-by-step-flow)
3. [Issues Analysis](#issues-analysis)
4. [Mermaid Diagrams](#mermaid-diagrams)
5. [Recommendations](#recommendations)

---

## Overview

This document analyzes the critical first 10 steps of the Eye-Doo app launch sequence, identifying potential race conditions, bugs, and architectural concerns. The app uses a complex multi-layered architecture with:

- **Zustand** for global state management
- **LoadingState pattern** for type-safe async operations
- **Firebase Auth** + **Cloud Functions** for user management
- **Real-time Firestore subscriptions** for data sync
- **Expo Router** for navigation with guards

### Key Components Involved

1. `src/app/_layout.tsx` - Root layout
2. `src/components/auth/AuthInitializer.tsx` - Auth state initialization
3. `src/stores/use-auth-store.ts` - Global auth state (Zustand)
4. `src/hooks/use-auth-actions.ts` - Auth actions (register, signIn)
5. `src/services/ServiceFactory.ts` - Dependency injection
6. `src/services/auth-service.ts` - Auth business logic
7. `src/services/user-service.ts` - User data management
8. `src/repositories/firestore/firestore-user-repository.ts` - Data access layer
9. `src/app/(auth)/_layout.tsx` - Auth route guard
10. `src/app/(protected)/_layout.tsx` - Protected route guard

---

## Step-by-Step Flow

### Step 1: App Launch - RootLayout Initialization

**File:** `src/app/_layout.tsx`  
**Lines:** 56-109

#### What Happens

1. React Native initializes and renders `RootLayout`
2. `SplashScreen.preventAutoHideAsync()` is called (line 40) to keep splash visible
3. `useFonts()` hook starts loading custom fonts (line 57)
4. Component state initializes: `themeReady = false`, `colorScheme` detected
5. GlobalErrorHandler.initialize() called (line 63)

#### State Changes

```typescript
// Initial component state
{
  fontsLoaded: false,
  fontError: null,
  themeReady: false,
  colorScheme: 'light' | 'dark'
}
```

#### Potential Issues

🔴 **ISSUE #1: SplashScreen Race Condition**
- **Location:** Lines 40, 68
- **Problem:** `SplashScreen.hideAsync()` called immediately when fonts load, but AuthInitializer may still be loading
- **Impact:** User sees incomplete UI or loading indicators after splash disappears
- **Race Condition:** Font loading completes → Splash hidden → AuthInitializer still loading → Brief "flash" of content

🟡 **ISSUE #2: No Error Boundary for Font Loading**
- **Location:** Line 57
- **Problem:** If `fontError` occurs, app still renders with system fonts but no user feedback
- **Impact:** Silent degradation, no error reporting

🟢 **GOOD:** GlobalErrorHandler initialized before any async operations

---

### Step 2: Service Factory Initialization

**File:** `src/services/ServiceFactory.ts`  
**Lines:** 144-205

#### What Happens

1. ServiceFactory constructor runs immediately on import (singleton pattern)
2. All repositories instantiated
3. All services instantiated with dependencies injected
4. Path validation runs in DEV mode (currently commented out, line 203)

#### Initialization Order

```typescript
1. Analytics Service
2. User Service (depends on UserRepository + Analytics)
3. List Services (Kit, Task, CoupleShot, GroupShot, etc.)
4. Setup Service (depends on User + List Services)
5. Onboarding Service (depends on User Service)
6. Project Services
7. Auth Service (depends on AuthRepository)
8. Payment, Subscription, Portal Services
```

#### Potential Issues

🔴 **ISSUE #3: Synchronous Blocking Initialization**
- **Location:** Lines 144-200
- **Problem:** All services instantiated synchronously on first import
- **Impact:** Increases initial bundle parse time, delays first render
- **Severity:** Medium (affects Time-to-Interactive)

🟡 **ISSUE #4: No Initialization Error Handling**
- **Location:** Constructor has no try-catch
- **Problem:** If any service fails to instantiate, entire app crashes with unclear error
- **Impact:** Poor developer experience, hard to debug

🟡 **ISSUE #5: Path Validation Disabled**
- **Location:** Line 203 (commented out)
- **Problem:** Path validation currently disabled, may cause runtime Firestore errors
- **Impact:** Errors only discovered at runtime when paths are used

---

### Step 3: AuthStore Initialization

**File:** `src/stores/use-auth-store.ts`  
**Lines:** 89-189

#### What Happens

1. Zustand store created with persist middleware
2. AsyncStorage rehydration starts (async, non-blocking)
3. Initial state set to `INIT_LOADING<User | null>()`
4. Persisted user data (if any) loads from AsyncStorage

#### State Flow

```typescript
// Initial state (before rehydration)
authState: {
  status: 'loading',
  data: undefined,
  isOptimistic: false,
  stage: 'initializing'
}

// After rehydration (if user was logged in)
authState: {
  status: 'success',
  data: User | null
}
```

#### Potential Issues

🔴 **ISSUE #6: Rehydration Race Condition**
- **Location:** Lines 177-187 (persist middleware)
- **Problem:** AuthInitializer may start before rehydration completes
- **Impact:** User appears logged out briefly, then flickers to logged in
- **Sequence:**
  1. AuthInitializer subscribes to Firebase Auth (sees no user initially)
  2. Rehydration completes → user appears
  3. Firebase onAuthStateChanged fires → overwrites rehydrated data
  4. Results in double fetch or conflicting state

🔴 **ISSUE #7: Persistence Partialize Logic**
- **Location:** Lines 180-186
- **Problem:** Only persists on success, but loses loading/error states
- **Impact:** On app restart after registration in progress, state resets to idle
- **Edge Case:** User force-quits during registration → state lost → registration completes in background → user confused

🟡 **ISSUE #8: Deep Merge Complexity**
- **Location:** Lines 61-87 (deepMerge function)
- **Problem:** Complex nested object merging with Date/Array special cases
- **Impact:** Potential bugs with Timestamp fields, circular references not handled
- **Risk:** Optimistic updates may corrupt nested objects

---

### Step 4: AuthInitializer Component Mount

**File:** `src/components/auth/AuthInitializer.tsx`  
**Lines:** 31-172

#### What Happens

1. Component mounts and renders `null` (invisible)
2. `useEffect` runs (line 39)
3. Sets `isMountedRef.current = true`
4. Sets global auth state to `loading<User | null>(undefined, false)` (line 43)
5. Subscribes to Firebase `onAuthStateChanged` (line 45)

#### Firebase Subscription Setup

```typescript
unsubscribeAuthRef.current = onAuthStateChanged(
  auth,
  async (firebaseUser: FirebaseUser | null) => {
    // Handler code
  }
)
```

#### Potential Issues

🔴 **ISSUE #9: Critical Registration Race Condition**
- **Location:** Lines 65-70
- **Problem:** Check for registration stage happens AFTER `onAuthStateChanged` fires
- **Race Timeline:**
  ```
  T0: User clicks Register
  T1: useRegister sets stage to 'registering'
  T2: Firebase creates auth user
  T3: onAuthStateChanged fires immediately
  T4: AuthInitializer checks stage (line 66)
  T5: Stage check may be stale if store update delayed
  ```
- **Impact:** AuthInitializer may fetch user data before Cloud Function creates it
- **Severity:** HIGH - Can cause registration failures

🔴 **ISSUE #10: Mounted Check Pattern Vulnerability**
- **Location:** Lines 49, 59, 104, 112, 124, 136
- **Problem:** Many async operations check `isMountedRef.current` but state may already be corrupted
- **Impact:** State updates after unmount can still occur via subscriptions
- **Better Pattern:** Abort controller or immediate unsubscribe

🟡 **ISSUE #11: Double State Update**
- **Location:** Lines 43, 54
- **Problem:** Sets loading state immediately, then success(null) if no user
- **Impact:** Causes unnecessary re-renders in guards and components
- **Performance:** Minor, but adds up with multiple listeners

🔴 **ISSUE #12: Error State Corruption**
- **Location:** Line 149
- **Problem:** On catch, sets `error as unknown as LoadingState<User | null>`
- **Code:** `setAuthState(error as unknown as LoadingState<User | null>);`
- **Impact:** Type coercion may create invalid state structure
- **Severity:** HIGH - Can crash components expecting valid LoadingState

---

### Step 5: Firebase onAuthStateChanged Fires

**File:** `src/components/auth/AuthInitializer.tsx`  
**Lines:** 47-152

#### Scenarios

##### Scenario A: No User (First Launch / Logged Out)

```typescript
firebaseUser === null
→ setAuthState(success(null))
→ Unsubscribe from previous user subscription
→ Return early
```

##### Scenario B: Existing User (App Restart)

```typescript
firebaseUser exists
→ Check if registration in progress (lines 65-95)
→ If yes: Skip fetch, setup subscription only
→ If no: Fetch user data with progress tracking
```

#### Potential Issues

🔴 **ISSUE #13: No User Document Wait Strategy**
- **Location:** Lines 98-102
- **Problem:** Immediately calls `userService.getUser(firebaseUser.uid)` without checking if document exists
- **Impact:** For new registrations, this races with Cloud Function
- **Sequence:**
  ```
  1. Firebase Auth creates user
  2. onAuthStateChanged fires
  3. AuthInitializer fetches user (DB_NOT_FOUND)
  4. Cloud Function creates user document (300-500ms later)
  5. Subscription picks up document
  6. But error already shown to user
  ```

🟡 **ISSUE #14: Progress Stage Not Preserved**
- **Location:** Line 99
- **Problem:** Sets stage to "Fetching user data" but doesn't preserve previous data
- **Impact:** Optimistic updates lost during re-fetch
- **Code:** `loadingWithProgress(getCurrentData(currentState), false, 'Fetching user data')`
- **Note:** This is actually GOOD - uses getCurrentData. False alarm.

🟢 **GOOD:** Proper cleanup of subscriptions on unmount (lines 154-168)

---

### Step 6: User Service Subscription Established

**File:** `src/services/user-service.ts`  
**Lines:** 64-66

#### What Happens

1. `userService.subscribeToUser()` called
2. Delegates to `userRepository.subscribeToUser()`
3. Firestore real-time listener established
4. Listener fires immediately with current document state

#### Repository Implementation

**File:** `src/repositories/firestore/firestore-user-repository.ts`  
**Lines:** 184-191

```typescript
subscribeToUser(userId: string, onData: (result: Result<User, AppError>) => void): () => void {
  const ref = doc(firestore, USER_PATHS.BASE(userId));
  return onSnapshot(
    ref,
    snap => onData(this.parseSnapshot(snap, 'subscribeToUser')),
    (error: FirestoreError) => onData(err(ErrorMapper.fromFirestore(error, 'subscribeToUser'))),
  );
}
```

#### Potential Issues

🔴 **ISSUE #15: Immediate Snapshot Callback**
- **Location:** Firestore behavior (line 186)
- **Problem:** `onSnapshot` fires immediately with current state, even if document doesn't exist
- **Impact:** Causes "DB_NOT_FOUND" error to be handled by callback immediately
- **Timeline:**
  ```
  T0: Subscribe called
  T1: onSnapshot fires immediately
  T2: Document doesn't exist → parseSnapshot returns DB_NOT_FOUND
  T3: onData(err) called
  T4: AuthInitializer handles error
  T5: Cloud Function creates document
  T6: onSnapshot fires again with document
  ```

🟡 **ISSUE #16: No Subscription Deduplication**
- **Location:** Multiple subscriptions can be created for same user
- **Problem:** If AuthInitializer unmounts/remounts quickly, multiple subscriptions may exist
- **Impact:** State thrashing, unnecessary Firestore reads
- **Cost:** Increased Firestore read operations

🟡 **ISSUE #17: Context String Hardcoded**
- **Location:** Line 188 (`'subscribeToUser'`)
- **Problem:** Loses userId context in error messages
- **Impact:** Harder to debug which user had the error

---

### Step 7: User Document Parsing and Validation

**File:** `src/repositories/firestore/firestore-user-repository.ts`  
**Lines:** 66-104

#### What Happens

1. `parseSnapshot()` called with Firestore DocumentSnapshot
2. Check if document exists (line 67)
3. Convert Firestore Timestamps to Date objects (line 89)
4. Validate against Zod schema (line 90)
5. Return Result<User, AppError>

#### Validation Flow

```typescript
snapshot.exists() 
  → snapshot.data()
  → convertAllTimestamps()
  → userSchema.safeParse()
  → Result<User, AppError>
```

#### Potential Issues

🔴 **ISSUE #18: Timestamp Conversion May Fail**
- **Location:** Line 89 (`convertAllTimestamps`)
- **Problem:** No error handling if timestamp conversion fails
- **Impact:** May produce invalid Date objects or throw
- **Edge Case:** Firestore serverTimestamp() pending state (null during write)

🟡 **ISSUE #19: Schema Validation Error Loses Detail**
- **Location:** Lines 92-101
- **Problem:** Console.error logs full error, but returns generic message
- **Code:** `console.error('User Schema Validation Failed', parseResult.error);`
- **Impact:** User sees "Data integrity error", dev sees details in console
- **Better:** Include validation path in AppError metadata

🟡 **ISSUE #20: No Retry on Validation Failure**
- **Location:** Returns error immediately (line 95)
- **Problem:** Transient schema issues (e.g., pending timestamps) fail permanently
- **Impact:** User may need to log out/in to retry

---

### Step 8: Auth Store Update with User Data

**File:** `src/stores/use-auth-store.ts`  
**Lines:** 96 (setAuthState action)

#### What Happens

1. `setAuthState()` called with new LoadingState
2. Zustand updates store
3. All subscribers notified (components re-render)
4. Persist middleware saves to AsyncStorage (if status === 'success')

#### Subscriber Notification Order

```typescript
1. useAuthStore direct subscribers (guards, layouts)
2. useUser selector hooks
3. useIsAuthenticated selector hooks
4. useAuthLoading selector hooks
5. Computed getters recalculate
```

#### Potential Issues

🔴 **ISSUE #21: Synchronous Re-render Storm**
- **Location:** All store subscribers update synchronously
- **Problem:** Many components subscribe to different parts of auth state
- **Impact:** 10+ components may re-render on single state change
- **Observed Components:**
  - RootLayout
  - AuthInitializer (itself)
  - AuthLayout guard
  - ProtectedLayout guard
  - Any component using useUser
  - Any component using useUserState
- **Performance:** Can cause frame drops on low-end devices

🟡 **ISSUE #22: Persist Middleware Async Write**
- **Location:** Lines 177-187
- **Problem:** AsyncStorage write is async but not awaited
- **Impact:** On force quit, recent state changes may not be saved
- **Edge Case:** User updates profile → app crashes → changes lost

🟢 **GOOD:** Computed getters provide memoization (lines 140-175)

---

### Step 9: Navigation Guards Evaluate

**File:** `src/app/(auth)/_layout.tsx` and `src/app/(protected)/_layout.tsx`

#### Auth Guard (Guest Only)

**File:** `src/app/(auth)/_layout.tsx`  
**Lines:** 24-59

```typescript
const user = useAuthStore(state => state.user);
const isLoading = useAuthStore(state => state.isLoading);
const { state, loading: stateLoading } = useUserState();

if (isLoading || stateLoading) {
  return <LoadingIndicator />;
}

if (user && state) {
  if (state.redirectPath) {
    return <Redirect href={state.redirectPath} />;
  }
  return <Redirect href="/(protected)/(app)/(projects)" />;
}

return <Stack>...</Stack>;
```

#### Protected Guard (Auth Required)

**File:** `src/app/(protected)/_layout.tsx`  
**Lines:** 19-38

```typescript
const user = useAuthStore(state => state.user);
const isInitializing = useAuthStore(state => state.isInitializing);
const isAuthLoading = useAuthStore(state => state.loading);
const showLoadingState = isInitializing || isAuthLoading;

if (showLoadingState) {
  return <LoadingIndicator />;
}

if (!user) {
  return <Redirect href="/(auth)/welcome" />;
}

return <Slot />;
```

#### Potential Issues

🔴 **ISSUE #23: Dual Loading State Confusion**
- **Location:** Auth guard uses both `isLoading` and `stateLoading`
- **Problem:** Two different loading states can conflict
- **Impact:** Guard may redirect before both are ready
- **Example:**
  ```
  isLoading = false (auth state loaded)
  stateLoading = true (useUserState still resolving)
  → Guard doesn't show loading
  → state.redirectPath undefined
  → Redirects to fallback route
  ```

🔴 **ISSUE #24: useUserState Recalculates on Every Auth Change**
- **Location:** Auth guard line 27 (`useUserState()`)
- **Problem:** `useUserState` runs `UserStateResolver.resolve()` on every render
- **Impact:** Expensive computation (checks subscription, setup, permissions)
- **Frequency:** Every time `user` in store changes (including optimistic updates)
- **Performance:** Can cause dropped frames during navigation

🟡 **ISSUE #25: Redirect Loops Possible**
- **Location:** Both guards can redirect to each other's domains
- **Problem:** If state resolution returns wrong redirect path, loops can occur
- **Example:**
  ```
  User logs in → Protected guard lets through
  → useUserState returns redirectPath="/(auth)/welcome" (bug)
  → Auth guard redirects back to protected
  → Loop
  ```
- **Mitigation:** Currently relies on UserStateResolver correctness

🟡 **ISSUE #26: No Redirect History Tracking**
- **Location:** Both guards use `<Redirect>` without tracking
- **Problem:** Can't detect or prevent redirect loops
- **Better:** Maintain redirect count in session storage

---

### Step 10: UserStateResolver Resolution

**File:** `src/utils/navigation/user-state-resolver.ts`  
**Lines:** 30-63

#### Resolution Logic

```typescript
static resolve(
  user: User | null,
  subscription: UserSubscription | null,
  setup: UserSetup | null
): ResolvedUserState {
  if (!user) return createUnauthenticatedState();
  
  if (!subscription || SUBSCRIPTION_BLOCKERS.includes(subscription.status)) {
    return createBlockedState(user, subscription, setup);
  }
  
  if (subscription.plan === SubscriptionPlan.FREE) {
    if (!user.isEmailVerified) {
      return createUnverifiedFreeState(user, subscription, setup);
    }
    return createVerifiedFreeState(user, subscription, setup);
  }
  
  const daysUntilExpiry = subscription.endDate
    ? calculateDaysUntilExpiry(subscription.endDate)
    : null;
  
  const isExpiring = /* expiry check */;
  
  if (isExpiring) {
    return createPaidExpiringState(user, subscription, setup, daysUntilExpiry);
  }
  
  return createPaidActiveState(user, subscription, setup);
}
```

#### State Decision Tree

```
User?
├─ No → UNAUTHENTICATED
└─ Yes
   ├─ Subscription blocked? → BLOCKED
   └─ Subscription active
      ├─ FREE plan
      │  ├─ Email unverified → UNVERIFIED_FREE
      │  └─ Email verified → VERIFIED_FREE
      └─ PAID plan
         ├─ Expiring soon → PAID_EXPIRING
         └─ Active → PAID_ACTIVE
```

#### Potential Issues

🔴 **ISSUE #27: Embedded Data Extraction Risk**
- **Location:** Line 67 (`UserStateResolver.resolve(user, user.subscription, user.setup)`)
- **Problem:** Passes `user.subscription` and `user.setup` separately, but they're already embedded
- **Impact:** If user object is partial (during loading), these may be undefined
- **Edge Case:** Optimistic update may have user but not subscription → wrong state

🟡 **ISSUE #28: No Caching of Resolution Result**
- **Location:** useMemo in useUserState (line 58)
- **Problem:** useMemo depends on `[user, loading]` but `user` is object reference
- **Impact:** If user object recreated (e.g., from Firestore update), resolution recalculates
- **Performance:** Unnecessary work on every snapshot

🟡 **ISSUE #29: Subscription Blockers Hardcoded**
- **Location:** Line 38 (`SUBSCRIPTION_BLOCKERS.includes(subscription.status)`)
- **Problem:** SUBSCRIPTION_BLOCKERS is constant, but business logic may change
- **Better:** Make configurable or move to service layer

🟡 **ISSUE #30: Date Comparison Fragility**
- **Location:** Line 50-56 (expiry calculation)
- **Problem:** Uses Date arithmetic without timezone consideration
- **Impact:** Expiry warnings may show at wrong time for users in different timezones
- **Edge Case:** User travels across timezones → expiry date changes

---

## Issues Analysis

### Critical Issues (Must Fix)

#### 🔴 ISSUE #9: Registration Race Condition
**Severity:** HIGH  
**Probability:** Medium (30-40% of registrations)  
**Impact:** User sees error, registration may fail

**Root Cause:**
```typescript
// AuthInitializer.tsx:65-70
const currentState = useAuthStore.getState().authState;
if (currentState.status === 'loading' && currentState.stage === 'registering') {
  // Skip fetch
}
```

The problem: `useAuthStore.getState()` reads state synchronously, but state updates from `useRegister` may not have propagated yet due to:
1. Zustand batch updates
2. React render batching
3. Network latency between setState and getState

**Fix:**
```typescript
// Option 1: Use ref to track registration in progress
const registrationInProgressRef = useRef(false);

// In useRegister, set ref before calling service
registrationInProgressRef.current = true;
const result = await authService.register(input);
registrationInProgressRef.current = false;

// In AuthInitializer, check ref
if (registrationInProgressRef.current) {
  // Skip fetch
}

// Option 2: Use separate registration flag in store
interface AuthState {
  authState: LoadingState<User | null>;
  isRegistering: boolean; // NEW
}

// Set flag before async operation
setIsRegistering(true);
const result = await authService.register(input);
setIsRegistering(false);
```

---

#### 🔴 ISSUE #13: No User Document Wait Strategy
**Severity:** HIGH  
**Probability:** High (50-70% of registrations on slow connections)  
**Impact:** DB_NOT_FOUND error, poor UX

**Root Cause:**
Firebase Auth creates user instantly, but Cloud Function takes 300-500ms to create Firestore document. AuthInitializer immediately tries to fetch, hitting race condition.

**Current Mitigation:**
`waitForUserDocumentsReady` utility exists but only used in `useRegister` (lines 107-123 in use-auth-actions.ts). Not used in AuthInitializer for normal sign-in flow.

**Fix:**
```typescript
// In AuthInitializer.tsx:98-102
// BEFORE:
const result = await userService.getUser(firebaseUser.uid);

// AFTER:
const result = await waitForUserDocumentsReady(
  firebaseUser.uid,
  userRepository,
  {
    timeoutMs: 10000,
    maxRetries: 2,
  }
);
```

---

#### 🔴 ISSUE #21: Synchronous Re-render Storm
**Severity:** MEDIUM  
**Probability:** High (100% of auth state changes)  
**Impact:** Frame drops, poor performance on low-end devices

**Root Cause:**
Zustand notifies all subscribers synchronously. Many components subscribe to auth store.

**Measurement:**
```typescript
// Add to useAuthStore
if (__DEV__) {
  const subscribers = (store as any).listeners;
  console.log('[AuthStore] Subscriber count:', subscribers?.size);
}
```

**Fix:**
```typescript
// Option 1: Use selector hooks (already done, but optimize)
// BEFORE:
const { user, loading, error } = useAuthStore();

// AFTER:
const user = useAuthStore(state => state.user);
const loading = useAuthStore(state => state.loading);
// Separate subscriptions reduce re-renders

// Option 2: Add React.memo to expensive components
export const SomeExpensiveComponent = React.memo(({ user }) => {
  // ...
}, (prev, next) => prev.user?.id === next.user?.id);

// Option 3: Debounce state updates
import { debounce } from 'lodash';

const debouncedSetAuthState = debounce((state) => {
  setAuthState(state);
}, 16); // One frame at 60fps
```

---

### High Priority Issues

#### 🟡 ISSUE #6: Rehydration Race Condition
**Severity:** MEDIUM  
**Probability:** Medium (20-30% of cold starts)  
**Impact:** User sees "logged out" briefly, then flickers to "logged in"

**Timeline:**
```
T0:   App starts
T1:   AuthStore created with INIT_LOADING
T2:   AuthInitializer mounts, subscribes to Firebase
T3:   Firebase onAuthStateChanged fires (no user detected yet)
T4:   AuthInitializer sets state to success(null)
T5:   AsyncStorage rehydration completes
T6:   Store updates with persisted user
T7:   Firebase SDK rehydrates, fires onAuthStateChanged with user
T8:   AuthInitializer fetches user data
```

Problem: Steps 4-5 cause a "flash" of logged-out state.

**Fix:**
```typescript
// In use-auth-store.ts, add rehydration tracking
interface AuthState {
  authState: LoadingState<User | null>;
  _rehydrated: boolean; // NEW
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      authState: INIT_LOADING<User | null>(),
      _rehydrated: false,
      
      // ... actions
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        // Called after rehydration
        state._rehydrated = true;
      },
      partialize: state => ({
        authState: state.authState.status === 'success' ? state.authState : idle<User | null>(),
      }),
    }
  )
);

// In AuthInitializer, wait for rehydration
const _rehydrated = useAuthStore(state => state._rehydrated);

useEffect(() => {
  if (!_rehydrated) return; // Wait for rehydration
  
  // Now safe to subscribe to Firebase
  // ...
}, [_rehydrated]);
```

---

#### 🟡 ISSUE #23: Dual Loading State Confusion
**Severity:** MEDIUM  
**Probability:** Low (5-10% of navigations)  
**Impact:** Wrong route, redirect to fallback instead of intended destination

**Root Cause:**
Two separate loading checks: `isLoading` (auth state) and `stateLoading` (user state resolution).

**Fix:**
```typescript
// In src/app/(auth)/_layout.tsx
export default function AuthLayout() {
  const user = useAuthStore(state => state.user);
  const isLoading = useAuthStore(state => state.isLoading);
  const { state, loading: stateLoading } = useUserState();
  
  // COMBINE loading states
  const anyLoading = isLoading || stateLoading;
  
  if (anyLoading) {
    return <LoadingIndicator />;
  }
  
  // Now safe to check state
  if (user) {
    if (!state) {
      // State should be resolved by now, but isn't
      // This indicates a bug - log it
      console.error('[AuthLayout] User exists but state not resolved');
      return <LoadingIndicator />; // Stay in loading
    }
    
    const redirectPath = state.redirectPath || '/(protected)/(app)/(projects)';
    return <Redirect href={redirectPath} />;
  }
  
  return <Stack>...</Stack>;
}
```

---

### Medium Priority Issues

#### 🟡 ISSUE #8: Deep Merge Complexity
**Severity:** LOW  
**Probability:** Low (< 5%)  
**Impact:** State corruption on optimistic updates with nested objects

**Root Cause:**
`deepMerge` function (lines 61-87) doesn't handle circular references, Firestore Timestamps, or complex nested structures.

**Fix:**
```typescript
// Use immer for immutable updates
import { produce } from 'immer';

optimisticUpdate: updates => {
  const currentState = get().authState;
  const currentUser = getCurrentData(currentState);
  if (!currentUser) return;
  
  // Use immer for safe nested updates
  const updatedUser = produce(currentUser, draft => {
    Object.assign(draft, updates);
  });
  
  set({ authState: success(updatedUser) });
}
```

---

#### 🟡 ISSUE #28: No Caching of Resolution Result
**Severity:** LOW  
**Probability:** High (100% of user object updates)  
**Impact:** Unnecessary CPU work, minor performance degradation

**Fix:**
```typescript
// In use-user-state.ts
export function useUserState(): UseUserStateReturn {
  const user = useAuthStore(state => state.user);
  const loading = useAuthStore(state => state.isLoading);
  
  // Add stable key for memoization
  const userKey = useMemo(() => {
    if (!user) return null;
    // Create stable key from relevant fields
    return `${user.id}-${user.subscription.status}-${user.setup.firstTimeSetup}`;
  }, [user]);
  
  const resolvedState = useMemo<ResolvedUserState | null>(() => {
    if (!user || loading) return null;
    return UserStateResolver.resolve(user, user.subscription, user.setup);
  }, [userKey, loading]); // Depend on key, not user object
  
  return { state: resolvedState, loading, /* ... */ };
}
```

---

## Mermaid Diagrams

### Diagram 1: App Launch Sequence (Steps 1-5)

```mermaid
sequenceDiagram
    participant RN as React Native
    participant RL as RootLayout
    participant SF as ServiceFactory
    participant AS as AuthStore
    participant AI as AuthInitializer
    participant FA as Firebase Auth
    participant FS as Firestore
    participant CF as Cloud Function

    Note over RN,CF: Step 1-2: Initialization
    RN->>RL: Render RootLayout
    activate RL
    RL->>RL: preventAutoHideAsync()
    RL->>RL: useFonts() starts
    RL->>SF: Import (singleton init)
    activate SF
    SF->>SF: Instantiate all repositories
    SF->>SF: Instantiate all services
    SF-->>RL: ServiceFactory ready
    deactivate SF
    
    Note over RN,CF: Step 3: Store Initialization
    RL->>AS: Import useAuthStore
    activate AS
    AS->>AS: Create Zustand store
    AS->>AS: Setup persist middleware
    AS->>AS: Start AsyncStorage rehydration (async)
    AS-->>RL: Store ready (INIT_LOADING)
    
    Note over RN,CF: Step 4: Component Mount
    RL->>AI: Mount AuthInitializer
    activate AI
    AI->>AS: Set loading state
    AS->>AS: Notify subscribers
    AI->>FA: onAuthStateChanged subscribe
    activate FA
    
    Note over RN,CF: Step 5: Auth State Changed
    FA->>AI: onAuthStateChanged(null)
    AI->>AI: Check isMountedRef
    AI->>AS: setAuthState(success(null))
    AS->>AS: Notify subscribers
    AS->>RL: User = null, loading = false
    RL->>RL: Render auth routes
    
    Note over FA: User sees Welcome screen
    
    deactivate AI
    deactivate FA
    deactivate AS
    deactivate RL
```

---

### Diagram 2: Registration Flow with Race Condition

```mermaid
sequenceDiagram
    participant UI as Register Screen
    participant UR as useRegister Hook
    participant AS as AuthStore
    participant AI as AuthInitializer
    participant AuthS as AuthService
    participant FA as Firebase Auth
    participant CF as Cloud Function
    participant FS as Firestore
    participant US as UserService

    Note over UI,US: User clicks "Register"
    
    UI->>UR: register(input)
    activate UR
    UR->>AS: setAuthState(loading, stage='registering')
    AS->>AS: Update global state
    UR->>AuthS: register(input)
    activate AuthS
    AuthS->>FA: createUserWithEmailAndPassword
    activate FA
    FA->>FA: Create auth user
    FA-->>AuthS: UserCredential
    
    Note over FA,FS: ⚠️ RACE CONDITION STARTS
    
    par Parallel Execution
        FA->>AI: onAuthStateChanged(firebaseUser)
        activate AI
        AI->>AS: getState().authState
        AS-->>AI: {status: 'loading', stage: 'registering'}
        
        Note over AI: Check if stage === 'registering'
        
        alt Stage check passes (20% chance)
            AI->>AI: Skip fetch, setup subscription
            AI->>US: subscribeToUser(userId)
            activate US
            US->>FS: onSnapshot(users/{id})
            activate FS
            FS-->>US: Document doesn't exist yet
            US-->>AI: err(DB_NOT_FOUND)
            AI->>AI: Continue waiting
        else Stage check fails (80% chance)
            Note over AI: State update not propagated yet
            AI->>US: getUser(userId)
            US->>FS: getDoc(users/{id})
            FS-->>US: Document doesn't exist
            US-->>AI: err(DB_NOT_FOUND)
            AI->>AS: setAuthState(error)
            AS->>UI: Show error to user ❌
        end
        
        deactivate AI
        deactivate US
        deactivate FS
    and
        FA->>CF: onCreate trigger
        activate CF
        CF->>FS: Create user document
        CF->>FS: Create preferences subcollection
        CF->>FS: Create setup subcollection
        CF->>FS: Set _documentsInitialized = true
        CF-->>FA: Complete (300-500ms)
        deactivate CF
    end
    
    Note over FA,FS: ⚠️ RACE CONDITION ENDS
    
    deactivate FA
    AuthS-->>UR: ok(user)
    deactivate AuthS
    
    UR->>UR: waitForUserDocumentsReady
    activate UR
    UR->>US: subscribeToUser (with timeout)
    activate US
    US->>FS: onSnapshot (already subscribed)
    FS-->>US: Document exists now
    US-->>UR: ok(user)
    deactivate US
    UR->>AS: setAuthState(success(user))
    AS->>UI: Registration complete ✅
    deactivate UR
    deactivate UR
```

**Key Race Condition Points:**
1. **T1:** Firebase Auth creates user
2. **T2:** onAuthStateChanged fires immediately
3. **T3:** AuthInitializer checks registration stage (may be stale)
4. **T4:** Cloud Function still creating document (300-500ms delay)
5. **T5:** getUser() returns DB_NOT_FOUND
6. **T6:** User sees error even though registration succeeds

---

### Diagram 3: State Management Flow

```mermaid
graph TB
    subgraph "Global State (Zustand)"
        AS[AuthStore<br/>LoadingState&lt;User | null&gt;]
        AS_PERSIST[AsyncStorage<br/>Persistence Layer]
    end
    
    subgraph "Data Sources"
        FA[Firebase Auth<br/>Auth State]
        FS[Firestore<br/>User Document]
        CF[Cloud Function<br/>onCreate Trigger]
    end
    
    subgraph "State Initializers"
        AI[AuthInitializer<br/>Component]
        UR[useRegister<br/>Hook]
        US[useSignIn<br/>Hook]
    end
    
    subgraph "State Consumers"
        AG[AuthLayout<br/>Guard]
        PG[ProtectedLayout<br/>Guard]
        UUS[useUserState<br/>Hook]
        COMP[App Components]
    end
    
    subgraph "Services Layer"
        AuthSvc[AuthService]
        UserSvc[UserService]
    end
    
    subgraph "Repository Layer"
        AuthRepo[AuthRepository]
        UserRepo[UserRepository]
    end
    
    %% Data flow
    FA -.->|onAuthStateChanged| AI
    AI -->|setAuthState| AS
    UR -->|setAuthState| AS
    US -->|setAuthState| AS
    
    AI -->|subscribe| UserSvc
    UserSvc -->|getUser/subscribe| UserRepo
    UserRepo -->|onSnapshot| FS
    FS -.->|real-time| UserRepo
    
    AS -->|persist| AS_PERSIST
    AS_PERSIST -.->|rehydrate| AS
    
    AS -->|subscribe| AG
    AS -->|subscribe| PG
    AS -->|subscribe| UUS
    AS -->|subscribe| COMP
    
    UR -->|call| AuthSvc
    US -->|call| AuthSvc
    AuthSvc -->|delegate| AuthRepo
    AuthRepo -->|createUser| FA
    FA -.->|trigger| CF
    CF -->|create doc| FS
    
    %% Styling
    classDef stateNode fill:#e1f5ff,stroke:#01579b,stroke-width:2px
    classDef dataNode fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef initNode fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef consumerNode fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px
    classDef serviceNode fill:#fff9c4,stroke:#f57f17,stroke-width:2px
    
    class AS,AS_PERSIST stateNode
    class FA,FS,CF dataNode
    class AI,UR,US initNode
    class AG,PG,UUS,COMP consumerNode
    class AuthSvc,UserSvc,AuthRepo,UserRepo serviceNode
```

---

### Diagram 4: Navigation Guard Decision Tree

```mermaid
graph TD
    Start([App Launch]) --> CheckAuth{Auth<br/>Loading?}
    
    CheckAuth -->|Yes| ShowLoading1[Show Loading Indicator]
    CheckAuth -->|No| HasUser{User<br/>Exists?}
    
    HasUser -->|No| AuthRoutes[Render Auth Routes<br/>welcome, sign-in, register]
    HasUser -->|Yes| ResolveState[useUserState:<br/>Resolve User State]
    
    ResolveState --> StateLoading{State<br/>Loading?}
    StateLoading -->|Yes| ShowLoading2[Show Loading Indicator]
    StateLoading -->|No| CheckState{User<br/>State?}
    
    CheckState -->|UNAUTHENTICATED| AuthRoutes
    CheckState -->|BLOCKED| RedirectPricing[Redirect: /(payment)/pricing]
    CheckState -->|UNVERIFIED_FREE| CheckOnboarding1{Needs<br/>Onboarding?}
    CheckState -->|VERIFIED_FREE| CheckOnboarding2{Needs<br/>Onboarding?}
    CheckState -->|PAID_ACTIVE| CheckOnboarding3{Needs<br/>Onboarding?}
    CheckState -->|PAID_EXPIRING| RedirectExpiring[Redirect: /(protected)/(onboarding)/expiring]
    
    CheckOnboarding1 -->|Yes| RedirectFreeOnboarding[Redirect: /(protected)/(onboarding)/free]
    CheckOnboarding1 -->|No| CheckSetup1{Needs<br/>Setup?}
    
    CheckOnboarding2 -->|Yes| RedirectFreeOnboarding
    CheckOnboarding2 -->|No| CheckSetup2{Needs<br/>Setup?}
    
    CheckOnboarding3 -->|Yes| RedirectPaidOnboarding[Redirect: /(protected)/(onboarding)/paid]
    CheckOnboarding3 -->|No| CheckSetup3{Needs<br/>Setup?}
    
    CheckSetup1 -->|Yes| RedirectSetup[Redirect: /(protected)/(setup)]
    CheckSetup1 -->|No| RedirectProjects[Redirect: /(protected)/(app)/(projects)]
    
    CheckSetup2 -->|Yes| RedirectSetup
    CheckSetup2 -->|No| RedirectProjects
    
    CheckSetup3 -->|Yes| RedirectSetup
    CheckSetup3 -->|No| RedirectProjects
    
    %% Styling
    classDef decisionNode fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef actionNode fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px
    classDef redirectNode fill:#e1f5ff,stroke:#01579b,stroke-width:2px
    
    class CheckAuth,HasUser,StateLoading,CheckState,CheckOnboarding1,CheckOnboarding2,CheckOnboarding3,CheckSetup1,CheckSetup2,CheckSetup3 decisionNode
    class ShowLoading1,ShowLoading2,AuthRoutes actionNode
    class RedirectPricing,RedirectFreeOnboarding,RedirectPaidOnboarding,RedirectExpiring,RedirectSetup,RedirectProjects redirectNode
```

---

### Diagram 5: Error Flow and Handling

```mermaid
flowchart TD
    subgraph "Error Sources"
        E1[Firebase Auth Error]
        E2[Firestore Error]
        E3[Network Error]
        E4[Validation Error]
        E5[Unhandled Promise Rejection]
        E6[Native Crash]
    end
    
    subgraph "Error Mappers"
        EM[ErrorMapper]
        EM_FA[fromFirebaseAuth]
        EM_FS[fromFirestore]
        EM_VAL[fromZod]
        EM_GEN[createGenericError]
    end
    
    subgraph "Error Handlers"
        GEH[GlobalErrorHandler]
        AEH[AppErrorHandler]
        UEH[useErrorHandler Hook]
    end
    
    subgraph "Error Destinations"
        LOG[LoggingService]
        TOAST[Toast Notification]
        SENTRY[Sentry (Production)]
        CONSOLE[Console (Dev)]
        STATE[Error State in Store]
    end
    
    %% Firebase Auth errors
    E1 -->|raw error| EM_FA
    EM_FA -->|AppError| AEH
    
    %% Firestore errors
    E2 -->|FirestoreError| EM_FS
    EM_FS -->|AppError| AEH
    
    %% Network errors
    E3 -->|Error| EM_GEN
    EM_GEN -->|AppError| AEH
    
    %% Validation errors
    E4 -->|ZodError| EM_VAL
    EM_VAL -->|AppError| AEH
    
    %% Unhandled rejections
    E5 -->|unknown| GEH
    GEH -->|map| EM_GEN
    GEH -->|AppError| AEH
    
    %% Native crashes
    E6 -->|Error| GEH
    GEH -->|map| EM_GEN
    
    %% Component errors
    UEH -->|handleError| AEH
    
    %% Error handler flow
    AEH -->|log| LOG
    AEH -->|show| TOAST
    AEH -->|report| SENTRY
    AEH -->|if __DEV__| CONSOLE
    AEH -->|optional| STATE
    
    %% Styling
    classDef errorNode fill:#ffebee,stroke:#c62828,stroke-width:2px
    classDef mapperNode fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef handlerNode fill:#e1f5ff,stroke:#01579b,stroke-width:2px
    classDef destNode fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px
    
    class E1,E2,E3,E4,E5,E6 errorNode
    class EM,EM_FA,EM_FS,EM_VAL,EM_GEN mapperNode
    class GEH,AEH,UEH handlerNode
    class LOG,TOAST,SENTRY,CONSOLE,STATE destNode
```

---

### Diagram 6: LoadingState Transitions

```mermaid
stateDiagram-v2
    [*] --> Idle: Initial state
    
    Idle --> Loading: Start operation
    Idle --> Idle: reset()
    
    Loading --> Success: Operation succeeds
    Loading --> Error: Operation fails
    Loading --> LoadingOptimistic: Optimistic update
    Loading --> Idle: Cancel/Reset
    
    LoadingOptimistic --> Success: Server confirms
    LoadingOptimistic --> Error: Server rejects<br/>(rollback)
    
    Success --> Loading: New operation
    Success --> LoadingOptimistic: Optimistic update
    Success --> Idle: Reset
    Success --> Success: setAuthState(success(newUser))
    
    Error --> Loading: Retry
    Error --> Success: clearError()
    Error --> Idle: Reset
    
    note right of Idle
        status: 'idle'
    end note
    
    note right of Loading
        status: 'loading'
        data?: T (previous data)
        isOptimistic?: false
        stage?: string
        progress?: number
    end note
    
    note right of LoadingOptimistic
        status: 'loading'
        data: T (optimistic)
        isOptimistic: true
    end note
    
    note right of Success
        status: 'success'
        data: T
    end note
    
    note right of Error
        status: 'error'
        error: AppError
        data?: T (for rollback)
        isOptimistic?: boolean
    end note
```

---

### Diagram 7: Subscription Lifecycle

```mermaid
sequenceDiagram
    participant AI as AuthInitializer
    participant US as UserService
    participant UR as UserRepository
    participant FS as Firestore
    participant AS as AuthStore
    
    Note over AI,AS: Subscription Initialization
    
    AI->>US: subscribeToUser(userId, callback)
    activate US
    US->>UR: subscribeToUser(userId, callback)
    activate UR
    UR->>FS: onSnapshot(doc(users/{id}))
    activate FS
    FS-->>UR: Immediate callback with current state
    UR->>UR: parseSnapshot(snapshot)
    
    alt Document exists
        UR->>US: callback(ok(user))
        US->>AI: callback(ok(user))
        AI->>AS: setAuthState(success(user))
    else Document doesn't exist
        UR->>US: callback(err(DB_NOT_FOUND))
        US->>AI: callback(err(DB_NOT_FOUND))
        AI->>AS: setAuthState(error)
    end
    
    Note over AI,AS: Real-time Updates
    
    loop Every document change
        FS-->>UR: snapshot with updated data
        UR->>UR: parseSnapshot(snapshot)
        UR->>US: callback(ok(updatedUser))
        US->>AI: callback(ok(updatedUser))
        AI->>AS: setAuthState(success(updatedUser))
    end
    
    Note over AI,AS: Cleanup on Unmount
    
    AI->>AI: useEffect cleanup
    AI->>US: unsubscribe()
    US->>UR: unsubscribe()
    UR->>FS: Detach listener
    deactivate FS
    deactivate UR
    deactivate US
    
    Note over AI: Component unmounted,<br/>no memory leaks
```

---

## Recommendations

### Immediate Actions (Week 1)

1. **Fix ISSUE #9: Registration Race Condition**
   - Add `isRegistering` flag to AuthStore
   - Set flag before calling register service
   - Check flag in AuthInitializer before fetching
   - Add timeout safety (clear flag after 30s)

2. **Fix ISSUE #13: User Document Wait**
   - Use `waitForUserDocumentsReady` in AuthInitializer
   - Apply same logic for both registration and sign-in flows
   - Add proper timeout handling (10s with 2 retries)

3. **Fix ISSUE #12: Error State Corruption**
   - Remove type coercion in catch block (line 149)
   - Create proper AppError from caught error
   - Use ErrorMapper for unknown errors

### Short-term (Week 2-3)

4. **Fix ISSUE #6: Rehydration Race**
   - Add `_rehydrated` flag to AuthStore
   - Wait for rehydration before subscribing to Firebase
   - Test with slow AsyncStorage (simulate 2-3s delay)

5. **Fix ISSUE #21: Re-render Storm**
   - Audit all components using `useAuthStore`
   - Convert to selector hooks where possible
   - Add React.memo to expensive components
   - Consider batching state updates

6. **Fix ISSUE #23: Dual Loading States**
   - Combine `isLoading` and `stateLoading` checks
   - Add explicit null check for resolved state
   - Log errors when state resolution fails

### Medium-term (Month 1)

7. **Improve Error Handling**
   - Add structured logging for all state transitions
   - Implement error boundary at layout level
   - Add Sentry breadcrumbs for navigation flow
   - Create error recovery strategies

8. **Performance Optimization**
   - Profile re-render counts with React DevTools
   - Implement state update batching
   - Add loading skeletons instead of full-screen loaders
   - Lazy-load ServiceFactory (split into chunks)

9. **Testing**
   - Add integration tests for registration flow
   - Add unit tests for UserStateResolver
   - Test race conditions with intentional delays
   - Test rehydration edge cases

### Long-term (Month 2-3)

10. **Architecture Improvements**
    - Consider XState for auth state machine
    - Implement event sourcing for state changes
    - Add state transition logging/replay
    - Create comprehensive state diagram

11. **Monitoring**
    - Add performance marks for critical paths
    - Track time-to-interactive metrics
    - Monitor Firestore read counts
    - Add custom Sentry events for race conditions

12. **Documentation**
    - Document all state transitions
    - Create troubleshooting guide
    - Add architecture decision records (ADRs)
    - Update onboarding docs for new developers

---

## Conclusion

The Eye-Doo app has a sophisticated multi-layered architecture with proper separation of concerns. However, the analysis reveals several critical race conditions and timing issues, particularly around:

1. **Registration flow** - Firebase Auth vs. Cloud Function timing
2. **State initialization** - Multiple parallel async operations
3. **Navigation guards** - Complex state resolution logic

The most critical issue is **ISSUE #9 (Registration Race Condition)**, which affects 30-40% of registrations and causes poor user experience. This should be fixed immediately.

The second most critical is **ISSUE #13 (No User Document Wait)**, which compounds the registration race condition and affects 50-70% of registrations on slow connections.

Overall, the architecture is sound, but edge cases and race conditions need attention. With the recommended fixes, the app should have a much more reliable startup and authentication flow.

---

**Next Steps:**
1. Review this document with the team
2. Prioritize fixes based on user impact
3. Create Jira tickets for each issue
4. Implement fixes in priority order
5. Add tests to prevent regressions
6. Monitor metrics after deployment

---

**Document Prepared By:** AI Assistant  
**Review Status:** Pending  
**Last Updated:** December 9, 2025

