# Critical Bugs, Race Conditions & Issues Report

## Executive Summary

This report consolidates all critical bugs, race conditions, error handling issues, and state inconsistencies identified across the global flow, sign-in flow, and register flow in the Eye-Doo application. These issues can cause app crashes, infinite loading states, authentication failures, and poor user experience.

## Severity Classification

- 🚨 **CRITICAL**: Causes app crashes, data loss, or permanent stuck states
- 🔥 **HIGH**: Causes authentication failures or significant UX issues
- ⚠️ **MEDIUM**: Causes minor UX issues or inconsistent states
- ℹ️ **LOW**: Code quality issues or minor inconsistencies

---

## CRITICAL ISSUES

### 1. 🚨 Registration Race Condition (AuthInitializer vs useRegister)

**Location**: `src/components/auth/AuthInitializer.tsx`, `src/hooks/use-auth-actions.ts`

**Problem**:

```typescript
// In useRegister
setRegistering(true); // Set before async operations
// ... async registration logic ...
setRegistering(false); // Cleared after completion

// In AuthInitializer
if (isRegistering) {
  // Skip data fetch during registration
  return; // Never runs again if flag gets stuck
}
```

**Impact**:

- If `useRegister` unmounts or errors before clearing `isRegistering`, AuthInitializer never runs
- User stuck in permanent loading state
- App becomes unresponsive after registration

**Root Cause**: Manual flag management is error-prone with no timeout or fallback mechanism.

**Fix Required**:

```typescript
// Use timeout-based flag management
setRegistering(true);
const timeoutId = setTimeout(() => setRegistering(false), 30000); // 30s timeout

try {
  // Registration logic
  clearTimeout(timeoutId);
  setRegistering(false);
} catch (error) {
  clearTimeout(timeoutId);
  setRegistering(false);
  throw error;
}
```

### 2. 🚨 Font Loading Race Condition

**Location**: `src/app/_layout.tsx`

**Problem**:

```typescript
const [fontsLoaded, fontError] = useFonts(fontAssets);
const colorScheme = useColorScheme(); // Theme depends on this

if (!fontsLoaded && !fontError) {
  return null; // Still loading
}

// Render with theme based on colorScheme, but fonts may not be ready
```

**Impact**:

- Theme colors applied before fonts load
- Layout shifts when fonts finally load
- Poor visual experience

**Root Cause**: Theme initialization doesn't wait for fonts.

**Fix Required**:

```typescript
// Initialize theme after fonts load
useEffect(() => {
  if (fontsLoaded) {
    const colorScheme = useColorScheme();
    setTheme(colorScheme === 'dark' ? AppDarkTheme : AppLightTheme);
  }
}, [fontsLoaded]);

if (!fontsLoaded && !fontError) {
  return <LoadingIndicator message="Loading fonts..." />;
}
```

### 3. 🚨 Auth User Cleanup Failures

**Location**: `src/repositories/firestore/firestore-auth-repository.ts`

**Problem**:

```typescript
// After registration failure
await this.cleanupAuthUser(userCredential, contextString);

// cleanupAuthUser implementation
await userCredential.user.delete(); // Can fail silently
```

**Impact**:

- Orphaned Firebase Auth accounts
- User can't re-register with same email
- Manual cleanup required by admin

**Root Cause**: No error handling or retry logic for cleanup operations.

**Fix Required**:

```typescript
private async cleanupAuthUser(userCredential: UserCredential, context: string): Promise<void> {
  try {
    await userCredential.user.delete();
  } catch (cleanupError) {
    // Log but don't throw - cleanup failure shouldn't block error reporting
    LoggingService.error('Failed to cleanup auth user after registration failure', {
      component: 'AuthRepository',
      method: 'cleanupAuthUser',
      userId: userCredential.user.uid,
      error: cleanupError,
    });
  }
}
```

### 4. 🚨 Double Loading State Management

**Location**: Multiple files across auth flows

**Problem**:
Three conflicting loading states:

- `useSignIn.localLoading`
- `useAuthStore.loading`
- `useAuthStore.isInitializing`

**Impact**:

- Inconsistent loading UI
- Race conditions between state updates
- Components show wrong loading states

**Root Cause**: No centralized loading state management.

---

## HIGH PRIORITY ISSUES

### 5. 🔥 Sign-In Persistence Failure Handling

**Location**: `src/repositories/firestore/firestore-auth-repository.ts`

**Problem**:

```typescript
try {
  await setPersistence(auth, persistence); // Fails on React Native
} catch (persistenceError) {
  // Continue with sign-in - WRONG!
}
```

**Impact**:

- Persistence setting fails silently on React Native
- User gets wrong session behavior
- No fallback persistence strategy

**Fix Required**:

```typescript
// Check platform before setting persistence
if (Platform.OS === 'web') {
  try {
    await setPersistence(auth, persistence);
  } catch (error) {
    LoggingService.warn('Failed to set web persistence', { error });
    // Continue - web persistence is already configured
  }
}
// React Native persistence is set at app initialization
```

### 6. 🔥 Email Verification Status Synchronization

**Location**: Multiple files

**Problem**:
Email verification status exists in:

- Firebase Auth (`user.emailVerified`)
- Firestore user document
- Repository in-memory cache
- Component local state

**Impact**:

- Status gets out of sync between systems
- User sees incorrect verification state
- Manual refresh required

**Fix Required**: Single source of truth with sync mechanism.

### 7. 🔥 Cloud Function Timeout Handling

**Location**: `src/repositories/firestore/firestore-auth-repository.ts`

**Problem**:

```typescript
const waitResult = await waitForUserDocumentsReady(userId, userRepository, {
  timeoutMs: 15000, // 15 seconds - hardcoded
});
```

**Impact**:

- Slow networks cause registration failures
- No retry mechanism
- User stuck with partial registration

**Fix Required**:

```typescript
const waitResult = await waitForUserDocumentsReady(userId, userRepository, {
  timeoutMs: 15000,
  maxRetries: 2,
  retryDelayMs: 2000,
});
```

### 8. 🔥 Loading State Race Conditions

**Location**: `src/hooks/use-auth-actions.ts`

**Problem**:

```typescript
setLocalLoading(true);
setLoading(true); // Global loading

// Async operation

setLocalLoading(false);
setLoading(false); // AuthInitializer might set loading again
```

**Impact**:

- AuthInitializer starts loading after hook clears it
- UI flashes between loading states
- Inconsistent user experience

---

## MEDIUM PRIORITY ISSUES

### 9. ⚠️ Silent Subscription Plan Loading Failures

**Location**: `src/app/_layout.tsx`

**Problem**:

```typescript
try {
  await serviceFactory.subscription.loadAllPlans();
} catch (error) {
  if (__DEV__) {
    console.warn('[RootLayout] Failed to load subscription plans', error);
  }
  // Continue silently in production
}
```

**Impact**:

- App runs without subscription data
- Pricing screen shows no plans
- Payment processing fails

**Fix Required**: Add error handling and retry logic.

### 10. ⚠️ Non-Functional Social Login UI

**Location**: `src/app/(auth)/register.tsx`

**Problem**:

```typescript
<StandardAppButton
  mode="outlined"
  icon="google"
  onPress={() => {
    /* Handle Google Sign-in - NOT IMPLEMENTED */
  }}
>
  Sign up with Google
</StandardAppButton>
```

**Impact**:

- Users expect social login to work
- Clicking buttons does nothing
- Poor user experience

**Fix Required**: Either implement social login or remove the buttons.

### 11. ⚠️ Email Verification Routing Race Condition

**Location**: `src/app/(auth)/register.tsx`

**Problem**:

```typescript
if (success) {
  const user = useAuthStore.getState().user; // Not reactive
  if (!user?.isEmailVerified) {
    router.replace('/(auth)/email-verification');
  }
}
```

**Impact**:

- Uses non-reactive state access
- Routes before user data is fully loaded
- Could route to wrong screen

**Fix Required**: Use reactive state and loading checks.

### 12. ⚠️ Inconsistent Error Context Building

**Location**: Multiple files

**Problem**:
Mix of error context patterns:

```typescript
// Some places
const context = ErrorContextBuilder.fromService('Service', 'method');
const contextString = ErrorContextBuilder.toString(context);

// Other places
const context = 'Service.method';
```

**Impact**:

- Inconsistent error logging
- Hard to trace errors
- Poor debugging experience

---

## LOW PRIORITY ISSUES

### 13. ℹ️ Double Data Fetching

**Location**: Sign-in and registration flows

**Problem**:
User data fetched twice:

- Once in repository after auth operation
- Once in AuthInitializer

**Impact**:

- Unnecessary Firestore reads
- Performance overhead
- Potential data inconsistency

### 14. ℹ️ Missing Progress Feedback

**Location**: Long-running operations (registration, document creation)

**Problem**:
No progress indication during:

- Cloud Function document creation
- Email verification sending
- Subscription activation

**Impact**:

- User sees loading spinner with no feedback
- Appears like the app is frozen
- Poor user experience

### 15. ℹ️ Hardcoded Timeouts

**Location**: Multiple timeout values scattered throughout code

**Problem**:

```typescript
timeoutMs: 15000; // Hardcoded in multiple places
```

**Impact**:

- Inconsistent timeout values
- Hard to configure
- No environment-specific tuning

---

## STATE MANAGEMENT ISSUES

### 16. Complex Loading State Management

**Current State**:

- `isInitializing` (app launch)
- `isRegistering` (registration in progress)
- `loading` (general operations)
- `localLoading` (hook-specific)

**Problems**:

- Conflicting states
- Race conditions
- Hard to debug

**Recommended**: Single state machine

```typescript
type AppLoadingState =
  | 'initializing'
  | 'signing-in'
  | 'registering'
  | 'fetching-user-data'
  | 'ready'
  | 'error';
```

### 17. Auth Store vs User State Inconsistency

**Problem**:
Two sources of truth:

- `useAuthStore()` - Raw user object
- `useUserState()` - Resolved state with permissions

**Impact**:

- Components check both states
- Potential sync issues
- Complex conditional logic

---

## ERROR HANDLING ISSUES

### 18. Silent Failures in Production

**Pattern**:

```typescript
try {
  // Operation
} catch (error) {
  if (__DEV__) {
    console.error('Error:', error);
  }
  // Continue silently
}
```

**Impact**:

- Errors hidden from production users
- No error recovery
- Hard to diagnose issues

### 19. Inconsistent Error Mapping

**Problem**:

- Some errors mapped through `ErrorMapper.fromFirebaseAuth()`
- Others mapped through `ErrorMapper.createGenericError()`
- Inconsistent error codes and messages

### 20. Missing Retry Logic

**Problem**:

- No automatic retries for network failures
- No exponential backoff
- User must manually retry

---

## SECURITY ISSUES

### 21. Rate Limiting Bypass Potential

**Location**: Rate limiting implementation

**Problem**:
Rate limiting based on email only, can be bypassed by:

- Using different email formats
- Using plus addressing (+tag@gmail.com)

**Fix Required**: Normalize email addresses for rate limiting.

### 22. Verification Email Status Tracking

**Problem**:
Email verification status tracked in memory only:

```typescript
this.verificationEmailStatus = new Map();
```

**Impact**:

- Lost on app restart
- Not persisted
- Unreliable status tracking

---

## PERFORMANCE ISSUES

### 23. Unnecessary Re-renders

**Problem**:
Multiple state updates trigger re-renders:

- Loading state changes
- Auth state changes
- User data updates

**Impact**:

- Poor performance on low-end devices
- Battery drain
- UI jank

### 24. Multiple Firestore Reads

**Problem**:
Same data fetched multiple times in same flow:

- Repository fetches after auth
- AuthInitializer fetches again
- Components fetch for display

**Fix Required**: Implement caching or single fetch with sharing.

---

## RECOMMENDED FIX PRIORITIES

### Immediate (Blockers)

1. Fix registration race condition
2. Fix font loading race condition
3. Fix auth user cleanup failures
4. Consolidate loading states

### High Priority (User Experience)

5. Fix persistence failure handling
6. Add progress feedback for long operations
7. Implement proper error recovery
8. Fix email verification routing

### Medium Priority (Code Quality)

9. Remove non-functional social login UI
10. Standardize error context building
11. Add retry logic for network operations
12. Implement single state machine

### Low Priority (Optimization)

13. Add caching for Firestore reads
14. Standardize timeout values
15. Add comprehensive logging
16. Performance optimizations

---

## TESTING REQUIREMENTS

### Critical Path Tests Needed

- Registration race condition scenarios
- Network failure recovery
- Auth state synchronization
- Loading state consistency
- Error boundary coverage

### Integration Tests Needed

- Full registration flow
- Sign-in with various persistence settings
- Email verification flow
- Subscription upgrade flow

### E2E Tests Needed

- Complete user onboarding journey
- Error recovery scenarios
- Cross-platform compatibility

---

## CONCLUSION

The Eye-Doo authentication system has solid architectural foundations but contains multiple critical bugs and race conditions that can severely impact user experience. The most serious issues involve state management race conditions that can cause permanent app lockups and authentication failures.

**Immediate Action Required**:

1. Fix the registration race condition (CRITICAL)
2. Implement proper loading state management (CRITICAL)
3. Add error recovery mechanisms (HIGH)
4. Fix auth state synchronization issues (HIGH)

The codebase shows good separation of concerns and error handling patterns, but needs significant work on timing-dependent operations and state consistency.
