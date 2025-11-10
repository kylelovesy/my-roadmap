# Loading States, Toast Notifications, and Error Handling in Eye-Doo App

## Overview
This document explains how loading states, toast notifications, and error handling are implemented throughout the Eye-Doo React Native application, with detailed examples and code snippets.

## 1. Loading States

### LoadingState Type Definition

The app uses a unified `LoadingState<T>` type instead of separate boolean flags for type safety and consistency:

```typescript
export type LoadingState<T> =
  | { status: 'idle' }
  | {
      status: 'loading';
      data?: T;
      isOptimistic?: boolean;
      stage?: string;
      progress?: number;
    }
  | { status: 'success'; data: T }
  | {
      status: 'error';
      error: AppError;
      data?: T;
      isOptimistic?: boolean;
    };
```

### Hook Implementation Example

Here's how hooks implement LoadingState management:

```typescript
const [state, setState] = useState<LoadingState<UserProfile | null>>(
  autoFetch ? loading() : idle(),
);
const { handleError } = useErrorHandler();
const isMountedRef = useRef(true);

const fetchProfile = useCallback(async () => {
  if (!userId) {
    setState(idle());
    return;
  }

  setState(prevState => loading(getCurrentData(prevState)));

  const result = profileId
    ? await service.get(userId, profileId)
    : await service.getByUserId(userId);

  if (!isMountedRef.current) return;

  if (result.success) {
    setState(success(result.value));
  } else {
    setState(prevState => errorState(result.error, getCurrentData(prevState)));
    handleError(
      result.error,
      ErrorContextBuilder.fromHook('useUserProfile', 'fetchProfile', userId),
    );
  }
}, [userId, profileId, service, handleError]);
```

### Progress Tracking for Multi-Step Operations

For complex operations, the system supports progress tracking:

```typescript
export function loadingWithProgress<T>(
  data?: T,
  isOptimistic = false,
  stage?: string,
  progress?: number,
): LoadingState<T> {
  return {
    status: 'loading',
    data,
    isOptimistic,
    stage,
    progress: progress !== undefined ? Math.max(0, Math.min(100, progress)) : undefined,
  };
}
```

Example usage for multi-step operations:

```typescript
// Show progress for multi-step operations
setState(loadingWithProgress(undefined, false, 'validating', 10));
setState(loadingWithProgress(undefined, false, 'creating', 50));
setState(loadingWithProgress(undefined, false, 'initializing', 80));
setState(success(result));
```

## 2. Toast Notifications

### Toast System Architecture

Toasts are managed through a Zustand store and displayed via a Toast component:

```typescript
interface UIStore {
  toasts: ToastConfig[];
  showToast: (config: ToastConfig) => void;
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;
}

export const useUIStore = create<UIStore>(set => ({
  toasts: [],

  showToast: (config: ToastConfig) => {
    const id = config.id || `toast-${Date.now()}-${Math.random()}`;
    const toast: ToastConfig = {
      ...config,
      id,
      duration: config.duration ?? 5000, // Default 5 seconds
    };

    set(state => ({
      toasts: [...state.toasts, toast],
    }));

    // Auto-dismiss after duration
    if (toast.duration && toast.duration > 0) {
      setTimeout(() => {
        useUIStore.getState().dismissToast(id);
      }, toast.duration);
    }
  },

  dismissToast: (id: string) => {
    set(state => ({
      toasts: state.toasts.filter(toast => toast.id !== id),
    }));
  },

  clearAllToasts: () => {
    set({ toasts: [] });
  },
}));
```

### Toast Configuration Types

```typescript
export interface ToastConfig {
  /** Optional unique identifier (auto-generated if not provided) */
  id?: string;

  /** Optional title displayed above the message */
  title?: string;

  /** Main message text displayed in the toast */
  message: string;

  /** Toast type determining colors and icon */
  type: 'success' | 'error' | 'warning' | 'info';

  /** Duration in milliseconds before auto-dismiss (default: 5000) */
  duration?: number;

  /** Optional action button configuration */
  action?: ToastAction;

  /** Optional details array for aggregated errors (expandable details) */
  details?: string[];
}
```

### Error Handler Integration

The `AppErrorHandler` automatically shows toasts for errors with deduplication:

```typescript
static handle(error: AppError, context?: string | LogContext, retryAction?: () => void): void {
  // ... logging code ...

  // 2. Create toast key for deduplication
  const toastKey = `${error.code}-${error.userMessage}`;
  const now = Date.now();
  const lastShown = this.toastHistory.get(toastKey);

  // Skip if shown recently (deduplication)
  if (lastShown && now - lastShown < this.TOAST_DEDUP_WINDOW) {
    return;
  }

  this.toastHistory.set(toastKey, now);

  // 3. Display a user-friendly toast message with retry support
  const toastConfig = {
    title: 'Error',
    message: error.userMessage,
    type: 'error' as const,
    action:
      error.retryable && retryAction
        ? {
            label: 'Retry',
            onPress: retryAction,
          }
        : undefined,
  };

  useUIStore.getState().showToast(toastConfig);
}
```

## 3. Error Handling

### Error Handling Flow

1. Errors are caught and mapped to `AppError`
2. Errors are logged via `LoggingService`
3. Toasts are shown via `AppErrorHandler`
4. Errors are displayed in UI components

### Error Mapping Examples

```typescript
static fromFirestore(error: unknown, context: string): FirestoreError {
  let message = 'An unknown Firestore error occurred';
  let userMessage = 'A database error occurred. Please try again.';
  let code = ErrorCode.DB_NETWORK_ERROR;
  let retryable = true;

  if (error instanceof Error) {
    message = error.message;

    // Map common Firebase errors
    if (message.includes('permission-denied')) {
      code = ErrorCode.DB_PERMISSION_DENIED;
      userMessage = 'You do not have permission to perform this action.';
      retryable = false;
    } else if (message.includes('not-found')) {
      code = ErrorCode.DB_NOT_FOUND;
      userMessage = 'The requested data was not found.';
      retryable = false;
    } else if (message.includes('unavailable')) {
      code = ErrorCode.DB_NETWORK_ERROR;
      userMessage = 'Service temporarily unavailable. Please try again.';
      retryable = true;
    }
  }

  return new FirestoreError(
    code,
    `Firestore Error: ${message}`,
    userMessage,
    context,
    error,
    retryable,
  );
}
```

### Hook Error Handling Pattern

```typescript
export function useErrorHandler() {
  const handleError = useCallback(
    (error: AppError, context?: string | LogContext, retryAction?: () => void) => {
      AppErrorHandler.handle(error, context, retryAction);
    },
    [],
  );

  return { handleError };
}
```

Usage in hooks:

```typescript
} else {
  setState(prevState => errorState(result.error, getCurrentData(prevState)));
  handleError(
    result.error,
    ErrorContextBuilder.fromHook('useUserProfile', 'fetchProfile', userId),
  );
}
```

### Screen-Level Error Display

The `ScreenWrapper` component handles errors at the screen level:

```typescript
export const ScreenWrapper: React.FC<ScreenWrapperProps> = ({
  children,
  loading = false,
  error = null,
  onRetry,
  onRefresh,
  scrollable = true,
  safeArea = true,
  testID,
}) => {
  // ... setup code ...

  const content = (
    <>
      {loading && <LoadingIndicator />}

      {error && !loading && <ErrorDisplay error={error} onRetry={onRetry} />}

      {!loading && !error && children}
    </>
  );
```

### Error Display Component

```typescript
export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, onRetry, testID }) => {
  const { theme, typography, spacing, borderRadius } = useAppStyles();

  return (
    <View style={styles.container} testID={testID}>
      <MaterialCommunityIcons
        name="alert-circle"
        size={64}
        color={theme.colors.error}
        style={styles.icon}
      />

      <Text
        style={[
          typography.titleLarge,
          { color: theme.colors.onBackground, textAlign: 'center', marginBottom: spacing.md },
        ]}
      >
        Something went wrong
      </Text>

      <Text
        style={[
          typography.bodyLarge,
          { color: theme.colors.onSurfaceVariant, textAlign: 'center', marginBottom: spacing.xl },
        ]}
      >
        {error.userMessage}
      </Text>

      {error.retryable && onRetry && (
        <TouchableOpacity
          style={[
            styles.retryButton,
            {
              backgroundColor: theme.colors.primary,
              borderRadius: borderRadius.sm,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.lg,
            },
          ]}
          onPress={onRetry}
        >
          <Text style={[typography.bodyMedium, { color: theme.colors.onPrimary }]}>Try Again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};
```

## Complete Example: Sign Up Flow

Here's how all three systems work together:

```typescript
// 1. Hook manages LoadingState
const { signUp, loading, error, user } = useSignUp({
  onSuccess: (user) => {
    // Success toast shown automatically
    router.push('/(app)/home');
  },
});

// 2. Screen uses ScreenWrapper
<ScreenWrapper
  loading={loading}
  error={error}
  onRetry={() => signUp(formData)}
  scrollable
  safeArea
>
  <SignUpForm onSubmit={signUp} loading={loading} />
</ScreenWrapper>

// 3. Inside the hook:
// - Sets loading state: setState(loading())
// - On error: setState(errorState(result.error))
// - Calls handleError() which:
//   - Logs the error
//   - Shows toast notification
//   - ScreenWrapper displays ErrorDisplay component
```

## Key Features

### Loading States
- **Type Safety**: Unified `LoadingState<T>` type instead of separate booleans
- **Optimistic Updates**: Support for showing updated data before server confirmation
- **Progress Tracking**: Multi-step operations can show progress (0-100%)
- **Data Preservation**: Previous data preserved during loading/error states

### Toast Notifications
- **Deduplication**: Prevents duplicate toasts within time windows
- **Auto-dismiss**: Toasts automatically disappear after configurable duration
- **Retry Actions**: Retry buttons for retryable errors
- **Multiple Types**: success, error, warning, info with appropriate styling
- **Expandable Details**: Support for detailed error information

### Error Handling
- **Centralized**: `AppErrorHandler` manages all error processing
- **Structured Logging**: Errors logged with context for debugging
- **User-Friendly Messages**: Technical errors mapped to user-understandable messages
- **Retry Support**: Automatic retry button for retryable operations
- **Aggregated Errors**: Multiple failures combined into single error display

## Architecture Benefits

- **Consistency**: All screens use the same patterns for loading, errors, and notifications
- **Type Safety**: TypeScript ensures correct usage of loading states
- **User Experience**: Immediate feedback, clear error messages, retry options
- **Debugging**: Structured error logging with context
- **Maintainability**: Centralized error handling and toast management

This system ensures that users always know what's happening, can retry failed operations, and developers get detailed error information for debugging.
