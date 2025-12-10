# Error Handling Standards & Implementation Guide

**Version:** 2.0.0  
**Last Updated:** December 2025  
**Author:** Kyle Lovesy

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Concepts](#core-concepts)
4. [Error Handling by Layer](#error-handling-by-layer)
5. [Implementation Guides](#implementation-guides)
6. [Code Examples](#code-examples)
7. [Best Practices](#best-practices)
8. [Reference Tables](#reference-tables)
9. [Troubleshooting](#troubleshooting)

---

## Overview

The Eye-Doo application uses a **comprehensive, type-safe error handling system** based on the **Result Pattern** (Railway-Oriented Programming). This system ensures:

- ✅ **No thrown errors** - All async operations return `Result<T, AppError>`
- ✅ **Type-safe error handling** - TypeScript enforces error handling
- ✅ **Consistent error structure** - All errors follow `AppError` interface
- ✅ **User-friendly messages** - Separate technical and user-facing messages
- ✅ **Centralized handling** - Single entry point for logging and UI notifications
- ✅ **Context tracking** - Full error context for debugging
- ✅ **Recovery strategies** - Built-in retry, timeout, and circuit breaker patterns

### Key Principles

1. **Never throw errors** - Always return `Result<T, AppError>`
2. **Always map errors** - Use `ErrorMapper` to convert external errors
3. **Always provide context** - Use `ErrorContextBuilder` for error tracking
4. **Always handle errors** - Use `AppErrorHandler` for side effects (logging, toasts)
5. **Always use appropriate error codes** - Reference `ErrorCode` enum

---

## Architecture

### Error Flow Diagram

```
┌─────────────────┐
│   Component     │
│   (UI Layer)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│      Hook       │
│  (State Layer)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Service      │
│ (Business Logic)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Repository    │
│  (Data Access)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   External API  │
│  (Firebase/etc)  │
└─────────────────┘
```

### Error Handling Flow

```
1. Error Occurs (External API, Validation, etc.)
   │
   ▼
2. Map to AppError (ErrorMapper)
   │
   ▼
3. Return Result<Data, AppError>
   │
   ▼
4. Handle in Hook/Service (useErrorHandler)
   │
   ▼
5. AppErrorHandler.handle()
   │
   ├─► LoggingService.error() (Logs error)
   └─► useUIStore.showToast() (Shows user notification)
```

---

## Core Concepts

### 1. AppError Interface

All errors in the application implement the `AppError` interface:

```typescript
interface AppError {
  readonly code: ErrorCode; // Unique error code
  readonly message: string; // Technical message (for logging)
  readonly userMessage: string; // User-friendly message (for UI)
  readonly context?: string; // Where error occurred
  readonly retryable: boolean; // Can user retry?
  readonly originalError?: unknown; // Original error object
  readonly timestamp: Date; // When error occurred
}
```

### 2. Result Pattern

All async operations return `Result<T, AppError>`:

```typescript
type Result<T, E = AppError> = Ok<T> | Err<E>;

interface Ok<T> {
  readonly success: true;
  readonly value: T;
}

interface Err<E> {
  readonly success: false;
  readonly error: E;
}
```

**Usage:**

```typescript
// Create success result
const success = ok(data);

// Create error result
const failure = err(appError);

// Check result
if (result.success) {
  // TypeScript knows result.value exists
  console.log(result.value);
} else {
  // TypeScript knows result.error exists
  console.error(result.error);
}
```

### 3. ErrorMapper

Converts any error type to `AppError`:

```typescript
// Type guard
ErrorMapper.isAppError(error): boolean

// Convert any error to AppError
ErrorMapper.toAppError(error, context): AppError

// Domain-specific mappers
ErrorMapper.fromFirebaseAuth(error, context): AuthError
ErrorMapper.fromFirestore(error, context): FirestoreError
ErrorMapper.fromZod(error, context): ValidationError
ErrorMapper.fromNetwork(error, context): NetworkError

// Create generic error
ErrorMapper.createGenericError(
  code: ErrorCode,
  message: string,
  userMessage: string,
  context?: string,
  originalError?: unknown,
  retryable?: boolean
): AppError

// Create aggregated error (for batch operations)
ErrorMapper.createAggregatedError(
  code: ErrorCode,
  message: string,
  userMessage: string,
  context: string,
  failures: Array<{ operation: string; error: AppError }>,
  successCount?: number
): AggregatedError
```

### 4. ErrorContextBuilder

Builds consistent error context for tracking:

```typescript
// From service
ErrorContextBuilder.fromService(
  serviceName: string,
  method: string,
  userId?: string,
  projectId?: string,
  metadata?: Record<string, unknown>
): LogContext

// From repository
ErrorContextBuilder.fromRepository(
  repoName: string,
  method: string,
  userId?: string,
  projectId?: string,
  metadata?: Record<string, unknown>
): LogContext

// From hook
ErrorContextBuilder.fromHook(
  hookName: string,
  method: string,
  userId?: string,
  projectId?: string,
  metadata?: Record<string, unknown>
): LogContext

// From component
ErrorContextBuilder.fromComponent(
  componentName: string,
  action: string,
  userId?: string,
  projectId?: string,
  metadata?: Record<string, unknown>
): LogContext
```

### 5. AppErrorHandler

Centralized error handling (logging + UI notifications):

```typescript
AppErrorHandler.handle(
  error: AppError,
  context?: string | LogContext,
  retryAction?: () => void
): void
```

**What it does:**

1. Logs error via `LoggingService.error()`
2. Shows toast notification via `useUIStore.showToast()`
3. Deduplicates toasts (prevents spam)
4. Supports retry actions for retryable errors

### 6. ErrorClassifier

Categorizes errors by severity:

```typescript
ErrorClassifier.classify(error): ErrorCategory

interface ErrorCategory {
  severity: 'critical' | 'non-critical' | 'recoverable';
  canRecover: boolean;
  shouldShowFullScreen: boolean;
  requiresUserAction: boolean;
}
```

---

## Error Handling by Layer

### Repository Layer

**Responsibility:** Data access, error mapping, sanitization

**Pattern:**

```typescript
async methodName(params: Params): Promise<Result<Data, AppError>> {
  const context = ErrorContextBuilder.fromRepository(
    this.context,
    'methodName',
    userId,
    projectId
  );

  try {
    // 1. Sanitize input
    const sanitized = this.sanitizeInput(params);

    // 2. Validate (optional at repo level)
    const validationResult = validateWithSchema(schema, sanitized, context);
    if (!validationResult.success) {
      return err(validationResult.error);
    }

    // 3. Firestore/external operation
    const docRef = doc(firestore, 'collection', id);
    await setDoc(docRef, this.toFirestoreDoc(validationResult.value));

    // 4. Fetch result (if needed)
    const snapshot = await getDoc(docRef);
    return this.parseSnapshot(snapshot, context);
  } catch (error) {
    // 5. Map external error to AppError
    return err(ErrorMapper.fromFirestore(error, context));
  }
}
```

**Key Points:**

- ✅ Always sanitize inputs first
- ✅ Always map external errors using `ErrorMapper`
- ✅ Always provide context with `ErrorContextBuilder`
- ✅ Never throw errors
- ✅ Always return `Result<T, AppError>`

### Service Layer

**Responsibility:** Business logic, validation, orchestration

**Pattern:**

```typescript
async methodName(params: Params): Promise<Result<Data, AppError>> {
  const context = ErrorContextBuilder.fromService(
    'ServiceName',
    'methodName',
    userId,
    projectId,
    { metadata: 'values' }
  );

  // 1. Validate input (if needed)
  const validationResult = validateWithSchema(schema, params, context);
  if (!validationResult.success) {
    return err(validationResult.error);
  }

  // 2. Perform business logic checks
  if (someBusinessRule) {
    return err(ErrorMapper.createGenericError(
      ErrorCode.VALIDATION_FAILED,
      'Business rule violation',
      'User-friendly message',
      context
    ));
  }

  // 3. Delegate to repository
  return await this.repository.operation(validationResult.value);
}
```

**Key Points:**

- ✅ Always validate inputs at service layer
- ✅ Perform business logic checks
- ✅ Delegate to repository (don't access Firestore directly)
- ✅ Always provide context with userId/projectId when available

### Hook Layer

**Responsibility:** State management, error handling, UI coordination

**Pattern:**

```typescript
export function useFeature(params: Params, options: UseFeatureOptions = {}): UseFeatureResult {
  const [state, setState] = useState<LoadingState<Data | null>>(idle());
  const { handleError } = useErrorHandler();
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const performAction = useCallback(
    async (input: Input): Promise<boolean> => {
      setState(loading());

      const result = await SomeService.someMethod(input);

      if (!isMountedRef.current) return false;

      if (result.success) {
        setState(success(result.value));
        options.onSuccess?.(result.value);
        return true;
      } else {
        setState(errorState(result.error));
        handleError(
          result.error,
          ErrorContextBuilder.fromHook('useFeature', 'performAction', userId),
        );
        options.onError?.(result.error);
        return false;
      }
    },
    [handleError, options],
  );

  const clearError = useCallback(() => {
    if (state.status === 'error') {
      setState(success(state.data || null));
    }
  }, [state]);

  return {
    data: state.status === 'success' ? state.data : null,
    loading: state.status === 'loading',
    error: state.status === 'error' ? state.error : null,
    state,
    performAction,
    clearError,
  };
}
```

**Key Points:**

- ✅ Use `LoadingState<T>` for state management
- ✅ Use `useErrorHandler` hook for error handling
- ✅ Always check `isMountedRef` before updating state
- ✅ Always provide context with `ErrorContextBuilder.fromHook()`
- ✅ Cleanup subscriptions on unmount

### Component Layer

**Responsibility:** UI rendering, user interaction

**Pattern:**

```typescript
export default function FeatureScreen() {
  const router = useRouter();
  const { data, loading, error, performAction, clearError } = useFeature();

  return (
    <ScreenWrapper
      loading={loading}
      error={error}
      onRetry={clearError}
      scrollable={true}
      testID="feature-screen"
    >
      <FeatureForm onSubmit={performAction} loading={loading} />
    </ScreenWrapper>
  );
}
```

**Key Points:**

- ✅ Use `ScreenWrapper` for consistent error/loading display
- ✅ Pass `error` and `onRetry` to `ScreenWrapper`
- ✅ Don't manually handle errors in components (let hooks handle it)

---

## Implementation Guides

### Guide 1: Adding Error Handling to a New Repository Method

**Step 1:** Import required utilities

```typescript
import { Result, ok, err } from '@/domain/common/result';
import { AppError } from '@/domain/common/errors';
import { ErrorMapper } from '@/utils/error/error-mapper';
import { ErrorContextBuilder } from '@/utils/error/error-context-builder';
```

**Step 2:** Create method signature

```typescript
async createUser(payload: UserCreate): Promise<Result<User, AppError>> {
  // Implementation
}
```

**Step 3:** Build error context

```typescript
const context = ErrorContextBuilder.fromRepository(
  this.context,
  'createUser',
  payload.userId, // Include if available
  undefined, // projectId if available
  { operation: 'create-user' }, // Optional metadata
);
```

**Step 4:** Sanitize and validate

```typescript
const sanitized = this.sanitizeUserCreate(payload);
const validationResult = validateWithSchema(userCreateSchema, sanitized, context);
if (!validationResult.success) {
  return err(validationResult.error);
}
```

**Step 5:** Perform operation with error mapping

```typescript
try {
  const docRef = await addDoc(
    collection(firestore, 'users'),
    this.toFirestoreDoc(validationResult.value),
  );
  const snapshot = await getDoc(docRef);
  return this.parseSnapshot(snapshot, context);
} catch (error) {
  return err(ErrorMapper.fromFirestore(error, context));
}
```

### Guide 2: Adding Error Handling to a New Service Method

**Step 1:** Import required utilities

```typescript
import { Result, ok, err } from '@/domain/common/result';
import { AppError } from '@/domain/common/errors';
import { ErrorMapper } from '@/utils/error/error-mapper';
import { ErrorContextBuilder } from '@/utils/error/error-context-builder';
```

**Step 2:** Create method signature

```typescript
async createProject(userId: string, input: ProjectInput): Promise<Result<Project, AppError>> {
  // Implementation
}
```

**Step 3:** Build error context

```typescript
const context = ErrorContextBuilder.fromService(
  'ProjectService',
  'createProject',
  userId, // Always include userId if available
  undefined, // projectId if available
  { operation: 'create-project' },
);
```

**Step 4:** Validate input

```typescript
const validationResult = validateWithSchema(projectInputSchema, input, context);
if (!validationResult.success) {
  return err(validationResult.error);
}
```

**Step 5:** Perform business logic checks

```typescript
// Check if user can create project
const canCreateResult = await this.checkUserCanCreateProject(userId);
if (!canCreateResult.success) {
  return err(canCreateResult.error);
}
```

**Step 6:** Delegate to repository

```typescript
return await this.repository.create(userId, validationResult.value);
```

### Guide 3: Adding Error Handling to a New Hook

**Step 1:** Import required utilities

```typescript
import { useState, useCallback, useRef, useEffect } from 'react';
import { LoadingState, loading, success, error as errorState, idle } from '@/utils/loading-state';
import { useErrorHandler } from '@/hooks/use-error-handler';
import { ErrorContextBuilder } from '@/utils/error/error-context-builder';
```

**Step 2:** Set up state and error handler

```typescript
export function useFeature(params: Params, options: UseFeatureOptions = {}): UseFeatureResult {
  const [state, setState] = useState<LoadingState<Data | null>>(idle());
  const { handleError } = useErrorHandler();
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
```

**Step 3:** Create action method

```typescript
const performAction = useCallback(
  async (input: Input): Promise<boolean> => {
    setState(loading());

    const result = await SomeService.someMethod(input);

    if (!isMountedRef.current) return false;

    if (result.success) {
      setState(success(result.value));
      options.onSuccess?.(result.value);
      return true;
    } else {
      setState(errorState(result.error));
      handleError(
        result.error,
        ErrorContextBuilder.fromHook('useFeature', 'performAction', userId),
      );
      options.onError?.(result.error);
      return false;
    }
  },
  [handleError, options],
);
```

**Step 4:** Add clearError method

```typescript
const clearError = useCallback(() => {
  if (state.status === 'error') {
    setState(success(state.data || null));
  }
}, [state]);
```

### Guide 4: Handling Aggregated Errors (Batch Operations)

When multiple operations can fail (e.g., initializing multiple subcollections):

```typescript
// 1. Execute operations in parallel
const results = await Promise.all([
  this.initializeKitList(userId, projectId),
  this.initializeTaskList(userId, projectId),
  this.initializeTimeline(projectId),
]);

// 2. Collect failures
const failures = results
  .map((result, index) => ({ result, index }))
  .filter(({ result }) => !result.success)
  .map(({ result, index }) => ({
    operation: ['kit', 'task', 'timeline'][index],
    error: result.error,
  }));

// 3. Return aggregated error if any failures
if (failures.length > 0) {
  return err(
    ErrorMapper.createAggregatedError(
      ErrorCode.DB_WRITE_ERROR,
      `Failed to initialize ${failures.length} subcollection(s)`,
      'Project created but some features may not be available.',
      context,
      failures,
      results.length - failures.length, // successCount
    ),
  );
}

// 4. All succeeded
return ok(projectResult.value);
```

---

## Code Examples

### Example 1: Repository Method with Error Handling

```typescript
async updateProfile(
  userId: string,
  payload: UserUpdate
): Promise<Result<void, AppError>> {
  const context = ErrorContextBuilder.fromRepository(
    this.context,
    'updateProfile',
    userId,
    undefined,
    { field: 'profile' }
  );

  try {
    // 1. Sanitize
    const sanitized = this.sanitizeUserUpdate(payload);

    // 2. Validate
    const validationResult = validateWithSchema(userUpdateSchema, sanitized, context);
    if (!validationResult.success) {
      return err(validationResult.error);
    }

    // 3. Firestore operation
    const docRef = doc(firestore, 'users', userId);
    await updateDoc(docRef, {
      ...this.toFirestoreDoc(validationResult.value),
      updatedAt: serverTimestamp(),
    });

    return ok(undefined);
  } catch (error) {
    return err(ErrorMapper.fromFirestore(error, context));
  }
}
```

### Example 2: Service Method with Business Logic

```typescript
async updateTimeline(
  projectId: string,
  updates: TimelineUpdate
): Promise<Result<void, AppError>> {
  const context = ErrorContextBuilder.fromService(
    'TimelineService',
    'updateTimeline',
    undefined,
    projectId
  );

  // 1. Validate
  const validationResult = validateWithSchema(timelineUpdateSchema, updates, context);
  if (!validationResult.success) {
    return err(validationResult.error);
  }

  // 2. Business logic: Check if finalized
  const timelineResult = await this.repository.get(projectId);
  if (!timelineResult.success) {
    return err(timelineResult.error);
  }

  if (timelineResult.value.config.finalized) {
    return err(
      ErrorMapper.createGenericError(
        ErrorCode.VALIDATION_FAILED,
        'Timeline finalized',
        'Timeline is finalized and cannot be edited.',
        context,
        undefined,
        false
      )
    );
  }

  // 3. Delegate to repository
  return await this.repository.update(projectId, validationResult.value);
}
```

### Example 3: Hook with Optimistic Updates

```typescript
const updateProfile = useCallback(
  async (updates: UserUpdate): Promise<boolean> => {
    if (!userId || !currentProfile) return false;

    // 1. Create optimistic update
    const optimisticProfile = {
      ...currentProfile,
      ...updates,
    };

    // 2. Apply optimistic update immediately
    setState(success(optimisticProfile));

    // 3. Call service
    const result = await userService.updateProfile(userId, updates);

    if (!isMountedRef.current) return false;

    if (result.success) {
      // 4. Refresh from server to get final state
      await getUserProfile();
      return true;
    } else {
      // 5. Rollback on error
      setState(success(currentProfile));
      handleError(
        result.error,
        ErrorContextBuilder.fromHook('useUserProfile', 'updateProfile', userId),
      );
      return false;
    }
  },
  [userId, currentProfile, userService, getUserProfile, handleError],
);
```

### Example 4: Error Recovery with Retry

```typescript
import { withRetry } from '@/utils/error/error-recovery';

async syncData(): Promise<Result<void, AppError>> {
  return await withRetry(
    async () => {
      const result = await this.repository.sync();
      return result;
    },
    {
      maxAttempts: 3,
      delayMs: 1000,
      exponential: true,
      onRetry: (attempt, error) => {
        LoggingService.log(`Retry attempt ${attempt}`, {
          component: 'DataService',
          method: 'syncData',
          metadata: { errorCode: error.code },
        });
      },
    }
  );
}
```

### Example 5: Handling Validation Errors in Forms

```typescript
const handleSubmit = async () => {
  // Validate all fields
  const result = inputSchema.safeParse(formData);

  if (!result.success) {
    // Map Zod errors to ValidationError
    const validationError = ErrorMapper.fromZod(
      result.error,
      ErrorContextBuilder.fromComponent('FeatureForm', 'handleSubmit', userId),
    );

    // Set field errors for form display
    setFieldErrors(validationError.fieldErrors);

    // Handle error (logs and shows toast)
    handleError(validationError, ErrorContextBuilder.fromComponent('FeatureForm', 'handleSubmit'));

    return;
  }

  // Submit
  const success = await onSubmit(result.data);
  if (success) {
    setFormData(initialValues);
    setFieldErrors({});
  }
};
```

---

## Best Practices

### ✅ DO

1. **Always use Result Pattern**

   ```typescript
   // ✅ CORRECT
   async function operation(): Promise<Result<Data, AppError>> {
     try {
       const data = await fetchData();
       return ok(data);
     } catch (error) {
       return err(ErrorMapper.fromFirestore(error, context));
     }
   }
   ```

2. **Always provide error context**

   ```typescript
   // ✅ CORRECT
   const context = ErrorContextBuilder.fromService(
     'AuthService',
     'signUp',
     userId, // Include when available
     projectId, // Include when available
   );
   ```

3. **Always map external errors**

   ```typescript
   // ✅ CORRECT
   catch (error) {
     return err(ErrorMapper.fromFirestore(error, context));
   }
   ```

4. **Always handle errors in hooks**

   ```typescript
   // ✅ CORRECT
   if (!result.success) {
     handleError(result.error, ErrorContextBuilder.fromHook('useFeature', 'performAction', userId));
     return false;
   }
   ```

5. **Always check isMounted before state updates**
   ```typescript
   // ✅ CORRECT
   if (!isMountedRef.current) return false;
   setState(success(data));
   ```

### ❌ DON'T

1. **Never throw errors**

   ```typescript
   // ❌ WRONG
   async function operation(): Promise<Data> {
     throw new Error('Something went wrong');
   }
   ```

2. **Never skip error context**

   ```typescript
   // ❌ WRONG
   return err(new AppError('Failed'));
   ```

3. **Never return raw errors**

   ```typescript
   // ❌ WRONG
   catch (error) {
     return err(error as AppError);
   }
   ```

4. **Never skip error handling**

   ```typescript
   // ❌ WRONG
   const result = await service.operation();
   // Missing error handling!
   ```

5. **Never update state after unmount**
   ```typescript
   // ❌ WRONG
   const result = await service.operation();
   setState(success(result.value)); // Could update after unmount!
   ```

---

## Reference Tables

### Error Code Categories

| Category       | Prefix  | Example                    | Use Case                             |
| -------------- | ------- | -------------------------- | ------------------------------------ |
| Authentication | `AUTH_` | `AUTH_INVALID_CREDENTIALS` | Login, registration, auth operations |
| Database       | `DB_`   | `DB_NOT_FOUND`             | Firestore operations                 |
| Network        | `NET_`  | `NETWORK_TIMEOUT`          | API calls, network issues            |
| Validation     | `VAL_`  | `VALIDATION_FAILED`        | Input validation                     |
| Subscription   | `SUB_`  | `SUBSCRIPTION_EXPIRED`     | Payment, subscription operations     |
| Location       | `LOC_`  | `LOCATION_API_ERROR`       | Maps, geocoding                      |
| Storage        | `FIRE_` | `FIREBASE_STORAGE_ERROR`   | File uploads                         |
| Permission     | `PERM_` | `PERMISSION_DENIED`        | Permission requests                  |
| Generic        | `UNK_`  | `UNKNOWN_ERROR`            | Unhandled errors                     |

### Error Severity Classification

| Severity     | Description               | Full Screen? | Can Recover? | Example Codes                                  |
| ------------ | ------------------------- | ------------ | ------------ | ---------------------------------------------- |
| Critical     | Blocks core functionality | ✅ Yes       | ❌ No        | `AUTH_SESSION_EXPIRED`, `SUBSCRIPTION_EXPIRED` |
| Non-Critical | Doesn't block core flow   | ❌ No        | ✅ Yes       | `LIST_NOT_FOUND`, `DB_NOT_FOUND`               |
| Recoverable  | Can retry operation       | ❌ No        | ✅ Yes       | Network errors, timeouts                       |

### ErrorMapper Methods Reference

| Method                    | Input                                                              | Output            | Use Case                 |
| ------------------------- | ------------------------------------------------------------------ | ----------------- | ------------------------ |
| `isAppError()`            | `unknown`                                                          | `boolean`         | Type guard check         |
| `toAppError()`            | `unknown`, `string`                                                | `AppError`        | Convert any error        |
| `fromFirebaseAuth()`      | `unknown`, `string`                                                | `AuthError`       | Firebase Auth errors     |
| `fromFirestore()`         | `unknown`, `string`                                                | `FirestoreError`  | Firestore errors         |
| `fromZod()`               | `ZodError`, `string`                                               | `ValidationError` | Zod validation errors    |
| `fromNetwork()`           | `unknown`, `string`                                                | `NetworkError`    | Network/API errors       |
| `createGenericError()`    | `ErrorCode`, `string`, `string`, `string?`, `unknown?`, `boolean?` | `AppError`        | Create custom error      |
| `createAggregatedError()` | `ErrorCode`, `string`, `string`, `string`, `Array`, `number?`      | `AggregatedError` | Batch operation failures |

### ErrorContextBuilder Methods Reference

| Method             | Parameters                                                      | Returns      | Use Case                            |
| ------------------ | --------------------------------------------------------------- | ------------ | ----------------------------------- |
| `fromService()`    | `serviceName`, `method`, `userId?`, `projectId?`, `metadata?`   | `LogContext` | Service layer errors                |
| `fromRepository()` | `repoName`, `method`, `userId?`, `projectId?`, `metadata?`      | `LogContext` | Repository layer errors             |
| `fromHook()`       | `hookName`, `method`, `userId?`, `projectId?`, `metadata?`      | `LogContext` | Hook layer errors                   |
| `fromComponent()`  | `componentName`, `action`, `userId?`, `projectId?`, `metadata?` | `LogContext` | Component layer errors              |
| `withUserId()`     | `context`, `userId`                                             | `LogContext` | Enrich existing context             |
| `withProjectId()`  | `context`, `projectId`                                          | `LogContext` | Enrich existing context             |
| `withMetadata()`   | `context`, `metadata`                                           | `LogContext` | Add metadata to context             |
| `toString()`       | `context`                                                       | `string`     | Convert to string (backward compat) |
| `fromString()`     | `contextString`                                                 | `LogContext` | Parse from string (backward compat) |

### Error Recovery Utilities

| Utility          | Purpose                          | Options                                            |
| ---------------- | -------------------------------- | -------------------------------------------------- |
| `withRetry()`    | Retry failed operations          | `maxAttempts`, `delayMs`, `exponential`, `onRetry` |
| `withFallback()` | Provide default value on failure | `fallbackValue`                                    |
| `withTimeout()`  | Cancel operation after timeout   | `timeoutMs`                                        |
| `CircuitBreaker` | Prevent cascading failures       | `failureThreshold`, `resetTimeoutMs`               |
| `Bulkhead`       | Limit concurrent operations      | `maxConcurrency`                                   |
| `pollForValue()` | Poll until value is available    | `timeoutMs`, `pollIntervalMs`                      |

---

## Troubleshooting

### Common Issues

#### Issue 1: Error not showing in UI

**Symptoms:** Error is logged but no toast appears

**Solution:**

- Check if error is being handled via `AppErrorHandler.handle()`
- Verify toast deduplication isn't blocking (check `TOAST_DEDUP_WINDOW`)
- Ensure `useUIStore` is properly initialized

#### Issue 2: Type errors with Result pattern

**Symptoms:** TypeScript errors about `result.value` or `result.error`

**Solution:**

- Use type guards: `if (result.success) { result.value }`
- Or use `isOk(result)` / `isErr(result)` helpers

#### Issue 3: Errors not being logged

**Symptoms:** Errors occur but don't appear in logs

**Solution:**

- Verify `ErrorContextBuilder` is used correctly
- Check that `LoggingService` is initialized
- Ensure context includes `component` and `method`

#### Issue 4: State updates after unmount

**Symptoms:** React warnings about state updates on unmounted components

**Solution:**

- Always check `isMountedRef.current` before updating state
- Use cleanup in `useEffect` to set `isMountedRef.current = false`

#### Issue 5: Aggregated errors not displaying correctly

**Symptoms:** Batch operation failures not showing all errors

**Solution:**

- Use `ErrorMapper.createAggregatedError()` for batch operations
- Ensure all failures are collected with operation names
- Check `AppErrorHandler.handleAggregatedError()` is being called

---

## Quick Reference Checklist

When implementing error handling, verify:

- [ ] All async methods return `Result<T, AppError>`
- [ ] All external errors are mapped using `ErrorMapper`
- [ ] All errors have context via `ErrorContextBuilder`
- [ ] All errors are handled via `AppErrorHandler.handle()` in hooks
- [ ] All state updates check `isMountedRef` before updating
- [ ] All subscriptions have cleanup functions
- [ ] All validation errors use `ErrorMapper.fromZod()`
- [ ] All batch operations use `ErrorMapper.createAggregatedError()`
- [ ] All error codes are from `ErrorCode` enum
- [ ] All user-facing messages are in `userMessage` field

---

## Additional Resources

- **Error Code Registry:** `src/constants/error-code-registry.ts`
- **Error Domain Types:** `src/domain/common/errors.ts`
- **Result Pattern:** `src/domain/common/result.ts`
- **Error Mapper:** `src/utils/error/error-mapper.ts`
- **Error Context Builder:** `src/utils/error/error-context-builder.ts`
- **Error Handler Service:** `src/services/error-handler-service.ts`
- **Error Recovery:** `src/utils/error/error-recovery.ts`
- **Error Classifier:** `src/utils/error/error-classifier.ts`
- **Error Boundary:** `src/components/common/error-boundary.tsx`

---

**Document Version:** 2.0.0  
**Last Updated:** December 2025  
**Maintained By:** Development Team

```

This document covers:

1. Overview and architecture
2. Core concepts (AppError, Result, ErrorMapper, etc.)
3. Layer-by-layer implementation patterns
4. Step-by-step guides
5. Code examples
6. Best practices (DO/DON'T)
7. Reference tables
8. Troubleshooting

Use it as the standard reference for error handling across the codebase.
```
