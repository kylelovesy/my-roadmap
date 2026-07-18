---
name: Auth Flow Critical Fixes
overview: Comprehensive plan to resolve critical bugs, race conditions, and UX issues in the authentication flows using EXISTING utilities and project patterns. This plan addresses 24+ issues across registration, sign-in, and global app initialization, organized in 4 phases by priority.
todos:
  - id: phase1-loading-state
    content: Migrate to LoadingState pattern in auth store, hooks, and components
    status: pending
  - id: phase1-timeout-failsafe
    content: Add timeout failsafe to registration flow with LoadingState
    status: pending
  - id: phase1-font-loading
    content: Fix font loading race condition with proper sequencing
    status: pending
  - id: phase1-cleanup-retry
    content: Use retryOperation helper for auth user cleanup
    status: pending
  - id: phase2-persistence
    content: Implement platform-specific auth persistence handling
    status: pending
  - id: phase2-email-verification
    content: Remove in-memory status map, use Firebase Auth as source of truth
    status: pending
  - id: phase2-progress-ui
    content: Add progress UI to registration screen using stage and progress
    status: pending
  - id: phase2-document-wait-retry
    content: Add retry logic to user document waiter using retryOperation
    status: pending
  - id: phase3-social-login
    content: Add Coming Soon state to social login buttons
    status: pending
  - id: phase3-error-context
    content: Standardize error context building across all files
    status: pending
  - id: phase3-double-fetch
    content: Simplify signIn to not fetch user data, let AuthInitializer handle it
    status: pending
  - id: phase4-caching
    content: Implement CachedUserRepository decorator pattern
    status: pending
  - id: phase4-memoization
    content: Optimize selectors with fine-grained subscriptions
    status: pending
  - id: phase4-logging
    content: Add comprehensive LoggingService calls at key points
    status: pending
  - id: phase4-rate-limit-security
    content: Add email normalization for rate limiting
    status: pending
---

# Authentication Flow Remediation Plan (Updated)

This plan addresses all critical bugs, race conditions, and issues identified in the analysis documents using **existing utilities and project patterns**. Work proceeds in 4 phases based on priority.

## Key Existing Utilities to Use

- **Loading State**: [`src/utils/loading-state.ts`](src/utils/loading-state.ts) - Type-safe `LoadingState<T>` with progress tracking
- **Retry Logic**: [`src/utils/retry-helper.ts`](src/utils/retry-helper.ts) - `retryOperation()`, `retryOnNetworkError()`
- **Error Recovery**: [`src/utils/error-recovery.ts`](src/utils/error-recovery.ts) - `withRetry()`, `withTimeout()`, `pollForValue()`
- **Error Handling**: Use `useErrorHandler` hook (per design document)
- **Result Helpers**: [`src/utils/result-helpers.ts`](src/utils/result-helpers.ts) - Wrappers for async operations
- **Timeouts**: [`src/constants/timeouts.ts`](src/constants/timeouts.ts) - Centralized timeout constants

---

## Phase 1: Critical Fixes (Blockers)

### 1.1 Replace Boolean Flags with LoadingState Pattern

**Problem**: Three conflicting loading states (`isInitializing`, `loading`, `isRegistering`) cause race conditions.

**Solution**: Use existing `LoadingState<T>` type from [`src/utils/loading-state.ts`](src/utils/loading-state.ts)

**Files to modify**:

- [`src/stores/use-auth-store.ts`](src/stores/use-auth-store.ts)
- [`src/components/auth/AuthInitializer.tsx`](src/components/auth/AuthInitializer.tsx)
- [`src/hooks/use-auth-actions.ts`](src/hooks/use-auth-actions.ts)

**Changes**:

1. Update [`src/stores/use-auth-store.ts`](src/stores/use-auth-store.ts):
```typescript
import { LoadingState, idle, loading, loadingWithProgress, success, error } from '@/utils/loading-state';

interface AuthState {
  // Replace: user, isAuthenticated, isInitializing, isRegistering, loading, error
  authState: LoadingState<User | null>;
  
  // Actions
  setAuthState: (state: LoadingState<User | null>) => void;
  
  // Convenience getters
  get user(): User | null;
  get isAuthenticated(): boolean;
  get isLoading(): boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      authState: loading<User | null>(undefined, false), // App initializing
      
      setAuthState: (authState) => set({ authState }),
      
      get user() {
        const state = get().authState;
        return state.status === 'success' ? state.data : null;
      },
      
      get isAuthenticated() {
        return get().user !== null;
      },
      
      get isLoading() {
        return get().authState.status === 'loading';
      },
      
      reset: () => set({ authState: idle() }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        authState: state.authState, // Persist entire LoadingState
      }),
    },
  ),
);

// Updated selector hooks
export const useUser = () => useAuthStore(state => state.user);
export const useIsAuthenticated = () => useAuthStore(state => state.isAuthenticated);
export const useAuthLoading = () => useAuthStore(state => state.isLoading);
```

2. Update [`src/components/auth/AuthInitializer.tsx`](src/components/auth/AuthInitializer.tsx):
```typescript
import { loading, loadingWithProgress, success, error, getCurrentData } from '@/utils/loading-state';

export function AuthInitializer() {
  const { setAuthState, authState } = useAuthStore();
  const { handleError } = useErrorHandler();
  
  useEffect(() => {
    isMountedRef.current = true;
    
    // Set initial loading state
    setAuthState(loading(null, false));
    
    unsubscribeAuthRef.current = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        if (!isMountedRef.current) return;
        
        if (!firebaseUser) {
          setAuthState(success(null));
          return;
        }
        
        // Check if registration in progress (check stage)
        if (authState.status === 'loading' && authState.stage === 'registering') {
          // Skip fetch - let useRegister handle it
          return;
        }
        
        // Fetch user data with progress
        setAuthState(loadingWithProgress(getCurrentData(authState), false, 'Fetching user data'));
        
        const result = await userService.getUser(firebaseUser.uid);
        
        if (!isMountedRef.current) return;
        
        if (result.success) {
          setAuthState(success(result.value));
          
          // Set up real-time subscription
          unsubscribeUserRef.current = userService.subscribe(
            firebaseUser.uid,
            (subscriptionResult) => {
              if (!isMountedRef.current) return;
              if (subscriptionResult.success) {
                setAuthState(success(subscriptionResult.value));
              }
            }
          );
        } else {
          setAuthState(error(result.error, null));
          handleError(result.error, ErrorContextBuilder.fromComponent(/*...*/));
        }
      }
    );
    
    return () => {
      isMountedRef.current = false;
      // cleanup subscriptions
    };
  }, []);
  
  return null;
}
```

3. Update [`src/hooks/use-auth-actions.ts`](src/hooks/use-auth-actions.ts):
```typescript
import { loading, loadingWithProgress, success, error, getCurrentData } from '@/utils/loading-state';

export function useRegister() {
  const { setAuthState, authState } = useAuthStore();
  const [localError, setLocalError] = useState<AppError | null>(null);
  const { handleError } = useErrorHandler();
  
  const register = useCallback(async (input: RegisterInput): Promise<boolean> => {
    setLocalError(null);
    
    // Set loading with 'registering' stage to prevent AuthInitializer conflicts
    setAuthState(loadingWithProgress(getCurrentData(authState), false, 'registering', 10));
    
    // Add timeout failsafe
    const timeoutId = setTimeout(() => {
      const currentState = useAuthStore.getState().authState;
      if (currentState.status === 'loading' && currentState.stage === 'registering') {
        console.error('[useRegister] Registration timeout - clearing stuck state');
        setAuthState(error(
          ErrorMapper.createGenericError(/*timeout error*/),
          getCurrentData(currentState)
        ));
      }
    }, TIMEOUT_CONSTANTS.USER_DOCUMENT_CHECK);
    
    try {
      // Step 1: Create auth user
      setAuthState(loadingWithProgress(null, false, 'creating-account', 30));
      const registerResult = await authService.register(input);
      
      if (!registerResult.success) {
        clearTimeout(timeoutId);
        setAuthState(error(registerResult.error, null));
        setLocalError(registerResult.error);
        handleError(registerResult.error, ErrorContextBuilder.fromHook('useRegister', 'register'));
        return false;
      }
      
      const userId = registerResult.value.id;
      
      // Step 2: Wait for Cloud Function
      setAuthState(loadingWithProgress(null, false, 'initializing-profile', 60));
      const waitResult = await waitForUserDocumentsReady(userId, userRepository, {
        timeoutMs: TIMEOUT_CONSTANTS.USER_DOCUMENT_CREATION,
      });
      
      if (!waitResult.success) {
        clearTimeout(timeoutId);
        setAuthState(error(waitResult.error, null));
        setLocalError(waitResult.error);
        handleError(waitResult.error, ErrorContextBuilder.fromHook('useRegister', 'waitForDocuments', userId));
        return false;
      }
      
      // Step 3: Fetch complete user data
      setAuthState(loadingWithProgress(null, false, 'complete', 90));
      const userResult = await userService.getUser(userId);
      
      if (!userResult.success) {
        clearTimeout(timeoutId);
        setAuthState(error(userResult.error, null));
        setLocalError(userResult.error);
        handleError(userResult.error, ErrorContextBuilder.fromHook('useRegister', 'getUser', userId));
        return false;
      }
      
      // Success!
      clearTimeout(timeoutId);
      setAuthState(success(userResult.value));
      return true;
    } catch (error) {
      clearTimeout(timeoutId);
      const appError = error as AppError;
      setAuthState(error(appError, null));
      setLocalError(appError);
      handleError(appError, ErrorContextBuilder.fromHook('useRegister', 'register'));
      return false;
    }
  }, [setAuthState, authState, handleError]);
  
  return {
    loading: authState.status === 'loading',
    stage: authState.status === 'loading' ? authState.stage : undefined,
    progress: authState.status === 'loading' ? authState.progress : undefined,
    error: localError,
    register,
  };
}

export function useSignIn() {
  const { setAuthState, authState } = useAuthStore();
  const [localError, setLocalError] = useState<AppError | null>(null);
  const { handleError } = useErrorHandler();
  
  const signIn = useCallback(async (input: SignInInput): Promise<boolean> => {
    setLocalError(null);
    setAuthState(loadingWithProgress(getCurrentData(authState), false, 'signing-in'));
    
    try {
      const result = await authService.signIn(input);
      
      if (!result.success) {
        setAuthState(error(result.error, getCurrentData(authState)));
        setLocalError(result.error);
        handleError(result.error, ErrorContextBuilder.fromHook('useSignIn', 'signIn'));
        return false;
      }
      
      // AuthInitializer will handle fetching user data
      // Keep loading state until AuthInitializer completes
      setAuthState(loadingWithProgress(null, false, 'fetching-user-data'));
      return true;
    } catch (error) {
      const appError = error as AppError;
      setAuthState(error(appError, getCurrentData(authState)));
      setLocalError(appError);
      handleError(appError, ErrorContextBuilder.fromHook('useSignIn', 'signIn'));
      return false;
    }
  }, [setAuthState, authState, handleError]);
  
  return {
    loading: authState.status === 'loading',
    stage: authState.status === 'loading' ? authState.stage : undefined,
    error: localError,
    signIn,
  };
}
```


### 1.2 Fix Font Loading Race Condition

**Problem**: Theme initializes before fonts load, causing layout shifts.

**Solution**: Wait for fonts before initializing theme

**Files to modify**:

- [`src/app/_layout.tsx`](src/app/_layout.tsx)

**Changes**:

```typescript
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const [themeReady, setThemeReady] = useState(false);
  const colorScheme = useColorScheme();
  
  useEffect(() => {
    // Initialize global error handler
    GlobalErrorHandler.initialize();
    
    // Initialize theme AFTER fonts load
    if (fontsLoaded || fontError) {
      setThemeReady(true);
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);
  
  useEffect(() => {
    // Load subscription plans (non-blocking, with retry)
    const loadPlansWithRetry = async () => {
      const result = await retryOperation(
        () => serviceFactory.subscription.loadAllPlans(),
        {
          maxAttempts: 3,
          initialDelayMs: 2000,
          exponentialBackoff: true,
          onRetry: (error, attempt, delay) => {
            LoggingService.warn(`Failed to load subscription plans (attempt ${attempt})`, {
              component: 'RootLayout',
              error: error.message,
              nextRetryIn: delay,
            });
          },
        }
      );
      
      if (!result.success) {
        LoggingService.error('Failed to load subscription plans after retries', {
          component: 'RootLayout',
          error: result.error,
        });
        // Continue - app works without plans, pricing screen will show error
      }
    };
    
    loadPlansWithRetry();
  }, []);
  
  // Don't render until fonts and theme are ready
  if (!themeReady) {
    return null;
  }
  
  const theme = colorScheme === 'dark' ? AppDarkTheme : AppLightTheme;
  
  return (
    <ErrorBoundary>
      {/* ... rest of layout */}
    </ErrorBoundary>
  );
}
```

### 1.3 Improve Auth User Cleanup with Retry

**Problem**: `cleanupAuthUser` can fail silently, leaving orphaned accounts.

**Solution**: Use existing retry helper

**Files to modify**:

- [`src/repositories/firestore/firestore-auth-repository.ts`](src/repositories/firestore/firestore-auth-repository.ts)

**Changes**:

```typescript
import { retryOperation } from '@/utils/retry-helper';

private async cleanupAuthUser(
  userCredential: UserCredential | null,
  context: string,
): Promise<Result<void, AuthError>> {
  if (!userCredential) return ok(undefined);
  
  // Use retry helper for cleanup
  const result = await retryOperation(
    async () => {
      try {
        await userCredential.user.delete();
        return ok(undefined);
      } catch (error) {
        return err(ErrorMapper.fromFirebaseAuth(error, context));
      }
    },
    {
      maxAttempts: 3,
      initialDelayMs: 1000,
      exponentialBackoff: false,
      onRetry: (error, attempt, delay) => {
        LoggingService.warn(`Auth cleanup attempt ${attempt} failed, retrying...`, {
          component: 'AuthRepository',
          method: 'cleanupAuthUser',
          userId: userCredential.user.uid,
          error: error.message,
          nextRetryIn: delay,
        });
      },
    }
  );
  
  if (result.success) {
    LoggingService.info('Successfully cleaned up auth user', {
      component: 'AuthRepository',
      userId: userCredential.user.uid,
    });
  } else {
    LoggingService.error('All cleanup attempts failed - Cloud Functions will handle', {
      component: 'AuthRepository',
      userId: userCredential.user.uid,
      error: result.error,
    });
  }
  
  // Always return ok - don't fail the operation if cleanup fails
  return ok(undefined);
}
```

---

## Phase 2: High Priority (UX Issues)

### 2.1 Fix Sign-In Persistence Handling

**Problem**: Persistence setting fails silently on React Native.

**Solution**: Platform-specific persistence handling

**Files to modify**:

- [`src/repositories/firestore/firestore-auth-repository.ts`](src/repositories/firestore/firestore-auth-repository.ts)

**Changes**:

```typescript
import { Platform } from 'react-native';

async signIn(payload: SignInInput): Promise<Result<User, AuthError>> {
  const context = ErrorContextBuilder.fromRepository(this.context, 'signIn');
  const contextString = ErrorContextBuilder.toString(context);
  
  try {
    const sanitizedEmail = sanitizeEmail(payload.email);
    if (!sanitizedEmail) {
      return err(ErrorMapper.createGenericError(/*...*/));
    }
    
    // Platform-specific persistence
    if (Platform.OS === 'web') {
      try {
        const persistence = payload.rememberMe 
          ? browserLocalPersistence 
          : browserSessionPersistence;
        await setPersistence(auth, persistence);
      } catch (error) {
        LoggingService.warn('Web persistence setting failed', {
          component: 'AuthRepository',
          method: 'signIn',
          error: error.message,
          rememberMe: payload.rememberMe,
        });
        // Continue - web persistence already configured at app level
      }
    }
    // React Native persistence is set in firebaseConfig.ts
    
    // Sign in
    const userCredential = await signInWithEmailAndPassword(
      auth,
      sanitizedEmail,
      payload.password
    );
    
    // Get user data
    const userResult = await this.userRepository.getById(userCredential.user.uid);
    
    if (userResult.success) {
      // Update last login (non-blocking)
      this.userRepository.updateLastLogin(userCredential.user.uid).catch(error => {
        LoggingService.warn('Failed to update last login', {
          component: 'AuthRepository',
          userId: userCredential.user.uid,
          error: error.message,
        });
      });
      
      return ok(userResult.value);
    } else {
      return err(userResult.error as AuthError);
    }
  } catch (error) {
    return err(ErrorMapper.fromFirebaseAuth(error, contextString));
  }
}
```

### 2.2 Centralize Email Verification Status

**Problem**: Verification status exists in multiple places, gets out of sync.

**Solution**: Use Firebase Auth as single source of truth, sync to Firestore

**Files to modify**:

- [`src/repositories/firestore/firestore-auth-repository.ts`](src/repositories/firestore/firestore-auth-repository.ts)

**Changes**:

```typescript
// Remove: private verificationEmailStatus = new Map<string, boolean>();
// Remove: wasVerificationEmailSent() method
// Remove: clearVerificationEmailStatus() method

async checkEmailVerificationStatus(syncToFirestore = true): Promise<Result<boolean, AuthError>> {
  const context = ErrorContextBuilder.fromRepository(this.context, 'checkEmailVerificationStatus');
  const contextString = ErrorContextBuilder.toString(context);
  
  const authCheck = this.ensureAuthenticated(contextString);
  if (!authCheck.success) return authCheck;
  
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return err(ErrorMapper.createGenericError(/*...*/));
    }
    
    // Reload to get fresh status from Firebase Auth (single source of truth)
    await currentUser.reload();
    const isVerified = currentUser.emailVerified;
    
    // ALWAYS sync to Firestore when verified
    if (isVerified && syncToFirestore) {
      const updateResult = await this.userRepository.updateEmailVerification(
        currentUser.uid,
        true
      );
      
      if (!updateResult.success) {
        LoggingService.error('Failed to sync email verification to Firestore', {
          component: 'AuthRepository',
          userId: currentUser.uid,
          error: updateResult.error,
        });
        // Continue - Auth is source of truth, Firestore sync failure doesn't matter
      }
    }
    
    return ok(isVerified);
  } catch (error) {
    return err(ErrorMapper.fromFirebaseAuth(error as AuthError, contextString));
  }
}
```

### 2.3 Add Progress Feedback for Registration

**Problem**: Users see generic loading with no feedback during long operations.

**Solution**: Use `loadingWithProgress()` with stage tracking (already implemented in 1.1)

**Files to modify**:

- [`src/app/(auth)/register.tsx`](src/app/\\(auth)/register.tsx)

**Changes**:

```typescript
export default function RegisterScreen() {
  const { register, loading, stage, progress, error } = useRegister();
  const router = useRouter();
  
  const progressMessages: Record<string, string> = {
    'registering': 'Starting registration...',
    'creating-account': 'Creating your account...',
    'initializing-profile': 'Setting up your profile...',
    'complete': 'Complete!',
  };
  
  const handleSubmit = async (data: RegisterInput) => {
    const success = await register(data);
    
    if (success) {
      // Use reactive user state
      const user = useAuthStore.getState().user;
      if (user && !user.isEmailVerified) {
        router.replace('/(auth)/email-verification');
      }
      // Otherwise AuthInitializer will handle routing
    }
  };
  
  return (
    <ScreenWrapper loading={loading}>
      {loading && stage && (
        <View style={styles.progressContainer}>
          <StandardAppText>{progressMessages[stage] || 'Processing...'}</StandardAppText>
          {progress !== undefined && (
            <ProgressBar progress={progress / 100} />
          )}
        </View>
      )}
      
      <AuthenticationForm 
        mode="register"
        onSubmit={handleSubmit} 
        disabled={loading}
        error={error}
      />
    </ScreenWrapper>
  );
}
```

### 2.4 Enhance Cloud Function Timeout Handling

**Problem**: Fixed 15s timeout, no retry mechanism.

**Solution**: Use existing retry helper with exponential backoff

**Files to modify**:

- [`src/utils/user-document-waiter.ts`](src/utils/user-document-waiter.ts)

**Changes**:

```typescript
import { retryOperation } from '@/utils/retry-helper';
import { TIMEOUT_CONSTANTS } from '@/constants/timeouts';

export interface WaitForUserDocumentsReadyOptions {
  timeoutMs?: number;
  maxRetries?: number;
}

export async function waitForUserDocumentsReady(
  userId: string,
  userRepository: IUserRepository,
  options: WaitForUserDocumentsReadyOptions = {},
): Promise<Result<User, AppError>> {
  const { 
    timeoutMs = TIMEOUT_CONSTANTS.USER_DOCUMENT_CREATION,
    maxRetries = 2,
  } = options;
  
  // Use retry helper for multiple attempts
  return await retryOperation(
    () => waitWithTimeoutInternal(userId, userRepository, timeoutMs),
    {
      maxAttempts: maxRetries + 1,
      initialDelayMs: 2000,
      exponentialBackoff: true,
      shouldRetry: (error) => error.retryable && error.code === ErrorCode.NETWORK_TIMEOUT,
      onRetry: (error, attempt, delay) => {
        LoggingService.warn(`Document wait attempt ${attempt} timed out, retrying...`, {
          component: 'userDocumentWaiter',
          userId,
          error: error.message,
          nextRetryIn: delay,
        });
      },
    }
  );
}

// Internal implementation (unchanged)
async function waitWithTimeoutInternal(
  userId: string,
  userRepository: IUserRepository,
  timeoutMs: number,
): Promise<Result<User, AppError>> {
  const context = ErrorContextBuilder.fromHook('userDocumentWaiter', 'waitWithTimeoutInternal', userId);
  const contextString = ErrorContextBuilder.toString(context);
  
  return new Promise<Result<User, AppError>>(resolve => {
    let resolved = false;
    let unsubscribe: (() => void) | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    
    const cleanup = () => {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };
    
    timeoutId = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      cleanup();
      
      const timeoutError = ErrorMapper.createGenericError(
        ErrorCode.NETWORK_TIMEOUT,
        'Timeout waiting for user documents',
        'User documents are taking longer than expected. Retrying...',
        contextString,
        undefined,
        true, // retryable
      );
      
      resolve(err(timeoutError));
    }, timeoutMs);
    
    unsubscribe = userRepository.subscribeToUser(userId, (result: Result<User, AppError>) => {
      if (resolved) return;
      
      if (!result.success) {
        if (result.error.code === ErrorCode.DB_NOT_FOUND) {
          // Continue waiting
          return;
        }
        
        resolved = true;
        cleanup();
        resolve(err(result.error));
        return;
      }
      
      const user = result.value;
      if (user._documentsInitialized === true) {
        resolved = true;
        cleanup();
        resolve(ok(user));
      }
    });
  });
}
```

### 2.5 Fix Email Verification Routing

**Problem**: Uses non-reactive state, routes before data fully loaded.

**Solution**: Use reactive state from store (already fixed in 1.1)

---

## Phase 3: Medium Priority (Code Quality)

### 3.1 Remove Non-Functional Social Login UI

**Problem**: Buttons present but not implemented, confuses users.

**Solution**: Add "Coming Soon" state with toast

**Files to modify**:

- [`src/components/auth/AuthenticationForm.tsx`](src/components/auth/AuthenticationForm.tsx)
- [`src/app/(auth)/register.tsx`](src/app/\\(auth)/register.tsx)

**Changes**:

```typescript
// In AuthenticationForm or register screen
import { ToastService } from '@/services/toast-service'; // Or use alert-helpers.ts

<StandardAppButton
  mode="outlined"
  icon="google"
  onPress={() => {
    // Use existing alert helper
    ToastService.info('Social login coming soon!');
  }}
  disabled={false}
>
  Sign up with Google (Coming Soon)
</StandardAppButton>

// Alternative: Remove buttons entirely by commenting out
```

### 3.2 Standardize Error Context Building

**Problem**: Mix of `ErrorContextBuilder.fromX()` and string contexts.

**Solution**: Use consistent pattern everywhere

**Changes**: Search and replace across all service/repository files:

```bash
# Find string contexts
grep -r "const context = '[A-Za-z]*\." src/services/ src/repositories/

# Replace with proper ErrorContextBuilder calls
# Example:
# const context = 'AuthService.signIn';
# Replace with:
# const context = ErrorContextBuilder.fromService('AuthService', 'signIn');
```

### 3.3 Eliminate Double Data Fetching

**Problem**: User data fetched in repository after sign-in, then again in AuthInitializer.

**Solution**: Repository only authenticates, AuthInitializer fetches data

**Files to modify**:

- [`src/repositories/firestore/firestore-auth-repository.ts`](src/repositories/firestore/firestore-auth-repository.ts)
- [`src/services/auth-service.ts`](src/services/auth-service.ts)

**Changes**:

```typescript
// In repository - simplify signIn to NOT fetch user data
async signIn(payload: SignInInput): Promise<Result<void, AuthError>> {
  const context = ErrorContextBuilder.fromRepository(this.context, 'signIn');
  const contextString = ErrorContextBuilder.toString(context);
  
  try {
    const sanitizedEmail = sanitizeEmail(payload.email);
    if (!sanitizedEmail) {
      return err(/*...*/);
    }
    
    // Platform-specific persistence
    // ... (same as before)
    
    // Just authenticate - don't fetch data
    const userCredential = await signInWithEmailAndPassword(
      auth,
      sanitizedEmail,
      payload.password
    );
    
    // Update last login (non-blocking)
    this.userRepository.updateLastLogin(userCredential.user.uid).catch(/*...*/);
    
    return ok(undefined); // No user data returned
  } catch (error) {
    return err(ErrorMapper.fromFirebaseAuth(error, contextString));
  }
}

// In service - update return type
async signIn(input: SignInInput): Promise<Result<void, AppError>> {
  const context = 'AuthService.signIn';
  
  // Rate limiting
  const rateKey = `signin-${input.email.toLowerCase()}`;
  if (!signInRateLimiter.canAttempt(rateKey)) {
    return err(/*...*/);
  }
  
  // Validation
  const validationResult = validateWithSchema(signInInputSchema, input, context);
  if (!validationResult.success) {
    return err(validationResult.error);
  }
  
  // Sign in (no user data returned)
  const result = await retryOnNetworkError(() => this.authRepository.signIn(input));
  
  if (result.success) {
    signInRateLimiter.reset(rateKey);
  }
  
  return result;
}
```

Update [`src/hooks/use-auth-actions.ts`](src/hooks/use-auth-actions.ts) useSignIn accordingly.

---

## Phase 4: Low Priority (Optimizations)

### 4.1 Implement Repository-Level Caching

**Problem**: Multiple Firestore reads for same data.

**Solution**: Add caching layer (decorator pattern)

**Files to create**:

- [`src/repositories/cached/cached-user-repository.ts`](src/repositories/cached/cached-user-repository.ts)

**Changes**:

```typescript
import { IUserRepository } from '@/repositories/i-user-repository';

export class CachedUserRepository implements IUserRepository {
  private cache = new Map<string, { user: User; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  constructor(private repository: IUserRepository) {}
  
  async getById(userId: string): Promise<Result<User, AppError>> {
    const now = Date.now();
    const cached = this.cache.get(userId);
    
    if (cached && now - cached.timestamp < this.CACHE_TTL) {
      return ok(cached.user);
    }
    
    const result = await this.repository.getById(userId);
    
    if (result.success) {
      this.cache.set(userId, { user: result.value, timestamp: now });
    }
    
    return result;
  }
  
  async update(userId: string, payload: UserUpdate): Promise<Result<void, AppError>> {
    const result = await this.repository.update(userId, payload);
    
    if (result.success) {
      this.cache.delete(userId); // Invalidate
    }
    
    return result;
  }
  
  // Implement other IUserRepository methods...
  // All write operations should invalidate cache
}
```

Update [`src/services/ServiceFactory.ts`](src/services/ServiceFactory.ts):

```typescript
const userRepository = new FirestoreUserRepository();
const cachedUserRepository = new CachedUserRepository(userRepository);
// Use cachedUserRepository instead of userRepository
```

### 4.2 Optimize Re-renders with Memoization

**Problem**: Unnecessary re-renders in auth components.

**Solution**: Use fine-grained selectors

**Files to modify**:

- [`src/hooks/use-user-state.ts`](src/hooks/use-user-state.ts)
- [`src/app/(auth)/_layout.tsx`](src/app/\\(auth)/_layout.tsx)

**Changes**:

```typescript
// Use fine-grained selectors
const user = useAuthStore(state => state.user);
const isLoading = useAuthStore(state => state.isLoading);
// Instead of:
const { user, isLoading } = useAuthStore();

// Memoize expensive computations
const resolvedState = useMemo(() => {
  if (!user) return null;
  return UserStateResolver.resolve(user, user.subscription, user.setup);
}, [user]); // Only recompute when user changes
```

### 4.3 Add Comprehensive Logging

**Problem**: Hard to debug issues in production.

**Solution**: Add structured logging at key points

**Files to modify**:

- All critical flow files

**Changes**:

```typescript
// Use existing LoggingService
import { LoggingService } from '@/services/logging-service';

// In registration flow
LoggingService.info('Registration started', {
  component: 'useRegister',
  method: 'register',
  metadata: { email: sanitizedEmail },
});

LoggingService.info('Registration auth created', {
  component: 'useRegister',
  method: 'register',
  userId: registerResult.value.id,
  metadata: { stage: 'creating-account' },
});
```

### 4.4 Security: Normalize Email for Rate Limiting

**Problem**: Rate limiting can be bypassed with email variants.

**Solution**: Normalize emails before rate limiting

**Files to modify**:

- [`src/services/auth-service.ts`](src/services/auth-service.ts)

**Changes**:

```typescript
// Add to sanitization-helpers.ts or inline
function normalizeEmailForRateLimit(email: string): string {
  const sanitized = sanitizeEmail(email);
  if (!sanitized) return email;
  
  const [local, domain] = sanitized.split('@');
  
  // Remove dots from Gmail addresses
  if (domain === 'gmail.com') {
    const normalized = local.replace(/\./g, '').split('+')[0];
    return `${normalized}@${domain}`;
  }
  
  // Remove plus addressing for other domains
  return sanitized.split('+')[0] + '@' + domain;
}

// Use in rate limiting:
const rateKey = `register-${normalizeEmailForRateLimit(input.email)}`;
```

---

## Testing Requirements

After implementing each phase, test:

### Phase 1 Tests

- [ ] Registration completes successfully
- [ ] Registration failure cleans up auth user
- [ ] LoadingState transitions correctly
- [ ] Progress shows during registration
- [ ] No stuck loading states after errors
- [ ] Font loading doesn't cause layout shifts
- [ ] Timeout failsafe prevents stuck states

### Phase 2 Tests

- [ ] Sign-in persistence works on web and mobile
- [ ] Email verification status syncs correctly
- [ ] Cloud Function timeout triggers retry
- [ ] Progress feedback shows during operations
- [ ] No double data fetching occurs

### Phase 3 Tests

- [ ] Social login shows "Coming Soon" message
- [ ] Error contexts are consistent
- [ ] Only one data fetch per sign-in

### Phase 4 Tests

- [ ] Caching reduces Firestore reads
- [ ] No unnecessary re-renders
- [ ] Logging captures all critical events
- [ ] Rate limiting cannot be bypassed

---

## Migration Strategy

1. **Create feature branch**: `fix/auth-flow-critical-issues`
2. **Implement Phase 1** (2-3 days)

   - Migrate to LoadingState pattern
   - Test thoroughly on both platforms
   - Deploy to staging

3. **Implement Phase 2** (2-3 days)

   - UX improvements
   - Test thoroughly
   - Deploy to staging

4. **Implement Phase 3** (1-2 days)

   - Code quality improvements
   - Deploy to staging

5. **Implement Phase 4** (1-2 days)

   - Performance optimizations
   - Deploy to production

---

## Success Metrics

- **Zero stuck loading states** in production
- **99%+ registration success rate**
- **< 100ms UI latency** with LoadingState pattern
- **Zero orphaned auth accounts**
- **100% consistent error context formatting**
- **50% reduction in Firestore reads** (Phase 4)
- **Proper progress feedback** during all long operations

---

## Rollback Plan

If critical issues arise:

1. Revert LoadingState migration (keep old boolean flags temporarily)
2. Keep timeout failsafes and retry logic
3. Roll back caching (Phase 4 only)
4. Monitor logs for issues