# Loading State Standards & Implementation Guide

**Version:** 1.0.0  
**Last Updated:** December 2025  
**Author:** Kyle Lovesy

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Concepts](#core-concepts)
4. [Loading State Handling by Layer](#loading-state-handling-by-layer)
5. [Implementation Guides](#implementation-guides)
6. [Code Examples](#code-examples)
7. [Best Practices](#best-practices)
8. [Reference Tables](#reference-tables)
9. [Troubleshooting](#troubleshooting)

---

## Overview

The Eye-Doo application uses a **comprehensive, type-safe loading state management system** based on discriminated unions. This system ensures:

- ✅ **Type-safe state management** - TypeScript enforces proper state handling
- ✅ **Consistent state structure** - All loading states follow `LoadingState<T>` pattern
- ✅ **Optimistic updates** - Support for instant UI feedback
- ✅ **Progress tracking** - Stage and progress indicators for multi-step operations
- ✅ **Error integration** - Seamless integration with error handling system
- ✅ **Centralized utilities** - Helper functions and hooks reduce boilerplate
- ✅ **Standardized initialization** - Consistent patterns across all hooks

### Key Principles

1. **Always use LoadingState** - Never use separate boolean flags for loading/error
2. **Always use initialization helpers** - Use `INIT_IDLE()`, `INIT_LOADING()`, etc.
3. **Always use utility functions** - Use type guards and extractors from `loading-state.ts`
4. **Always use useLoadingState hook** - Extract values consistently in components
5. **Always check isMounted** - Prevent state updates after unmount
6. **Always preserve data on error** - Use `getCurrentData()` for rollback

---

## Architecture

### Loading State Flow Diagram

```
┌─────────────────┐
│   Component     │
│   (UI Layer)    │
│                 │
│ Uses:           │
│ - LoadingState  │
│   Display       │
│ - Screen        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│      Hook       │
│  (State Layer)  │
│                 │
│ Uses:           │
│ - LoadingState  │
│ - useLoadingState│
│ - INIT_* helpers│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Service      │
│ (Business Logic)│
│                 │
│ Returns:        │
│ - Result<T, E>  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Repository    │
│  (Data Access)  │
│                 │
│ Returns:        │
│ - Result<T, E>  │
└─────────────────┘
```

### Loading State Lifecycle

```
1. Initialize State
   │
   ├─► INIT_IDLE() (user action required)
   ├─► INIT_LOADING() (app initialization)
   ├─► INIT_AUTO_FETCH() (auto-fetch on mount)
   └─► INIT_COMBINED() (multiple options)
   │
   ▼
2. Operation Starts
   │
   ├─► loading() (basic loading)
   ├─► loading(data, true) (optimistic update)
   └─► loadingWithProgress(data, false, stage, progress) (with progress)
   │
   ▼
3. Operation Completes
   │
   ├─► success(data) (operation succeeded)
   └─► error(appError, previousData) (operation failed)
   │
   ▼
4. UI Updates
   │
   ├─► LoadingStateDisplay (automatic rendering)
   ├─► useLoadingState (extract values)
   └─► Screen component (normalized display)
```

---

## Core Concepts

### 1. LoadingState Type

All loading states in the application use the `LoadingState<T>` discriminated union:

```typescript
type LoadingState<T> =
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

**Key Features:**

- **Type-safe** - TypeScript narrows types based on `status` discriminator
- **Data preservation** - Can hold data in loading/error states (for optimistic updates)
- **Progress tracking** - Supports stage descriptions and progress percentages
- **Error integration** - Error states include `AppError` for consistent error handling

### 2. State Creators

Create loading states using helper functions:

```typescript
// Idle state - no operation started
const idleState = idle<Data>();

// Basic loading state
const loadingState = loading<Data>();

// Loading with existing data (optimistic update)
const optimisticState = loading<Data>(currentData, true);

// Loading with progress tracking
const progressState = loadingWithProgress<Data>(
  currentData,
  false,
  'Uploading files',
  45, // 45% complete
);

// Success state
const successState = success<Data>(data);

// Error state (with rollback data)
const errorState = error<Data>(appError, previousData, true);
```

### 3. Type Guards

Safely check and narrow loading state types:

```typescript
import {
  isIdle,
  isLoading,
  isSuccess,
  hasError,
  hasData,
  isOptimistic,
  isInitialLoading,
  isOptimisticLoading,
} from '@/utils/loading-state';

// Type guards
if (isIdle(state)) {
  // TypeScript knows: state.status === 'idle'
}

if (isLoading(state)) {
  // TypeScript knows: state.status === 'loading'
  // Can access: state.data, state.stage, state.progress, state.isOptimistic
}

if (isSuccess(state)) {
  // TypeScript knows: state.status === 'success'
  // Can access: state.data
}

if (hasError(state)) {
  // TypeScript knows: state.status === 'error'
  // Can access: state.error, state.data, state.isOptimistic
}

// Utility checks
if (hasData(state)) {
  // State has data (success, or loading/error with data)
}

if (isOptimistic(state)) {
  // State is an optimistic update
}

if (isInitialLoading(state)) {
  // State is loading but not optimistic (initial load)
}

if (isOptimisticLoading(state)) {
  // State is loading with optimistic update
}
```

### 4. Data Extractors

Extract values from loading states:

```typescript
import {
  getData,
  getError,
  getCurrentData,
  getStage,
  getProgress,
  canRetry,
} from '@/utils/loading-state';

// Extract data (returns undefined if not available)
const data = getData(state);

// Extract error (returns undefined if not available)
const error = getError(state);

// Get current data (from success, loading, or error states)
const currentData = getCurrentData(state);

// Get operation stage (if loading)
const stage = getStage(state);

// Get progress percentage (if loading)
const progress = getProgress(state);

// Check if operation can be retried
const retryable = canRetry(state);
```

### 5. Initialization Helpers

Standardize loading state initialization:

```typescript
import {
  INIT_IDLE,
  INIT_LOADING,
  INIT_AUTO_FETCH,
  INIT_REALTIME,
  INIT_COMBINED,
} from '@/utils/loading-state-initialization';

// IDLE - User action required
const [state, setState] = useState<LoadingState<Data | null>>(INIT_IDLE());

// LOADING - App/component initializing
authState: INIT_LOADING<User | null>();

// AUTO_FETCH - Will fetch automatically
const [state, setState] = useState<LoadingState<Data | null>>(INIT_AUTO_FETCH(options.autoFetch));

// REALTIME - Will subscribe to realtime updates
const [state, setState] = useState<LoadingState<Data | null>>(
  INIT_REALTIME(options.enableRealtime),
);

// COMBINED - Multiple initialization options
const [state, setState] = useState<LoadingState<Data | null>>(
  INIT_COMBINED(options.autoFetch, options.enableRealtime),
);
```

### 6. useLoadingState Hook

Extract common values from LoadingState:

```typescript
import { useLoadingState } from '@/hooks/use-loading-state';

function MyComponent() {
  const { state } = useFeature();
  const { data, loading, error, stage, progress, isOptimistic, canRetry } = useLoadingState(state);

  // Use extracted values
  if (loading) {
    return <LoadingIndicator stage={stage} progress={progress} />;
  }
  if (error) {
    return <ErrorDisplay error={error} onRetry={canRetry ? handleRetry : undefined} />;
  }
  return <Content data={data} />;
}
```

**Returns:**

- `data` - Current data (from success or previous state)
- `loading` - Boolean indicating if loading
- `error` - Error if state is error, null otherwise
- `stage` - Operation stage string (if loading)
- `progress` - Progress percentage (if loading)
- `isOptimistic` - Boolean indicating optimistic update
- `canRetry` - Boolean indicating if error is retryable
- `state` - Full LoadingState for advanced use cases

### 7. LoadingStateDisplay Component

Automatically render UI based on LoadingState:

```typescript
import { LoadingStateDisplay } from '@/components/common/loading-state-display';

function FeatureScreen() {
  const { state, refresh } = useFeature();

  return (
    <LoadingStateDisplay state={state} onRetry={refresh}>
      {(data) => <FeatureContent data={data} />}
    </LoadingStateDisplay>
  );
}
```

**Features:**

- Handles all LoadingState variants automatically
- Shows `LoadingIndicator` for loading states
- Shows `ErrorDisplay` for error states
- Renders children for success states
- Supports optimistic updates (shows content + indicator)

### 8. State Transformers

Transform and combine loading states:

```typescript
import { fromResult, mapLoadingState, combineLoadingStates } from '@/utils/loading-state';

// Convert Result to LoadingState
const state = fromResult(result, previousData);

// Map LoadingState to another type
const mappedState = mapLoadingState(state, data => transform(data));

// Combine multiple LoadingStates
const combinedState = combineLoadingStates([state1, state2, state3]);
```

---

## Loading State Handling by Layer

### Hook Layer

**Responsibility:** State management, operation coordination

**Pattern:**

```typescript
export function useFeature(params: Params, options: UseFeatureOptions = {}): UseFeatureResult {
  // 1. Initialize state using helpers
  const [state, setState] = useState<LoadingState<Data | null>>(INIT_AUTO_FETCH(options.autoFetch));
  const { handleError } = useErrorHandler();
  const isMountedRef = useRef(true);

  // 2. Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 3. Perform action
  const performAction = useCallback(
    async (input: Input): Promise<boolean> => {
      // Preserve current data for optimistic updates
      const currentData = getCurrentData(state);
      setState(loading(currentData));

      const result = await SomeService.someMethod(input);

      if (!isMountedRef.current) return false;

      if (result.success) {
        setState(success(result.value));
        options.onSuccess?.(result.value);
        return true;
      } else {
        // Preserve data for rollback
        setState(error(result.error, currentData));
        handleError(
          result.error,
          ErrorContextBuilder.fromHook('useFeature', 'performAction', userId),
        );
        options.onError?.(result.error);
        return false;
      }
    },
    [handleError, options, state],
  );

  // 4. Extract values using hook
  const { data, loading: isLoading, error: currentError } = useLoadingState(state);

  // 5. Clear error helper
  const clearError = useCallback(() => {
    if (state.status === 'error') {
      setState(success(state.data || null));
    }
  }, [state]);

  return {
    data,
    loading: isLoading,
    error: currentError,
    state,
    performAction,
    clearError,
  };
}
```

**Key Points:**

- ✅ Always use initialization helpers (`INIT_IDLE()`, `INIT_AUTO_FETCH()`, etc.)
- ✅ Always use `useLoadingState` hook for value extraction
- ✅ Always check `isMountedRef` before updating state
- ✅ Always preserve data using `getCurrentData()` for rollback
- ✅ Always use `fromResult()` to convert Result to LoadingState

### Component Layer

**Responsibility:** UI rendering, user interaction

**Pattern 1: Using LoadingStateDisplay (Recommended)**

```typescript
export default function FeatureScreen() {
  const { state, refresh } = useFeature();

  return (
    <Screen scrollable={true} testID="feature-screen">
      <LoadingStateDisplay state={state} onRetry={refresh}>
        {(data) => <FeatureContent data={data} />}
      </LoadingStateDisplay>
    </Screen>
  );
}
```

**Pattern 2: Using Screen Component (Backward Compatible)**

```typescript
export default function FeatureScreen() {
  const { state, refresh } = useFeature();

  return (
    <Screen
      loading={state} // Can pass LoadingState directly
      error={state.status === 'error' ? state.error : null}
      onRetry={refresh}
      scrollable={true}
      testID="feature-screen"
    >
      {state.status === 'success' && <FeatureContent data={state.data} />}
    </Screen>
  );
}
```

**Pattern 3: Manual Extraction (Advanced)**

```typescript
export default function FeatureScreen() {
  const { state } = useFeature();
  const { data, loading, error, stage, progress } = useLoadingState(state);

  if (loading) {
    return <LoadingIndicator stage={stage} progress={progress} />;
  }
  if (error) {
    return <ErrorDisplay error={error} onRetry={refresh} />;
  }
  return <FeatureContent data={data} />;
}
```

**Key Points:**

- ✅ Prefer `LoadingStateDisplay` for automatic handling
- ✅ Use `Screen` component for consistent layout
- ✅ Use `useLoadingState` hook to extract values
- ✅ Don't manually check `state.status` unless necessary

---

## Implementation Guides

### Guide 1: Creating a New Hook with LoadingState

**Step 1:** Import required utilities

```typescript
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  LoadingState,
  loading,
  success,
  error as errorState,
  getCurrentData,
  fromResult,
} from '@/utils/loading-state';
import { INIT_IDLE, INIT_AUTO_FETCH } from '@/utils/loading-state-initialization';
import { useLoadingState } from '@/hooks/use-loading-state';
import { useErrorHandler } from '@/hooks/use-error-handler';
import { ErrorContextBuilder } from '@/utils/error/error-context-builder';
```

**Step 2:** Set up state with initialization helper

```typescript
export function useFeature(options: UseFeatureOptions = {}): UseFeatureResult {
  const { autoFetch = false, onSuccess, onError } = options;

  const [state, setState] = useState<LoadingState<Data | null>>(
    INIT_AUTO_FETCH(autoFetch)
  );
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
    const currentData = getCurrentData(state);
    setState(loading(currentData));

    const result = await SomeService.someMethod(input);

    if (!isMountedRef.current) return false;

    // Convert Result to LoadingState
    setState(fromResult(result, currentData));

    if (result.success) {
      options.onSuccess?.(result.value);
      return true;
    } else {
      handleError(
        result.error,
        ErrorContextBuilder.fromHook('useFeature', 'performAction', userId),
      );
      options.onError?.(result.error);
      return false;
    }
  },
  [handleError, options, state],
);
```

**Step 4:** Extract values and return

```typescript
  const { data, loading: isLoading, error: currentError } = useLoadingState(state);

  const clearError = useCallback(() => {
    if (state.status === 'error') {
      setState(success(state.data || null));
    }
  }, [state]);

  return {
    data,
    loading: isLoading,
    error: currentError,
    state,
    performAction,
    clearError,
  };
}
```

### Guide 2: Adding Optimistic Updates

**Step 1:** Capture current data before update

```typescript
const updateItem = useCallback(
  async (updates: ItemUpdate): Promise<boolean> => {
    const currentData = getCurrentData(state);
    if (!currentData) return false;

    // Create optimistic update
    const optimisticData = { ...currentData, ...updates };

    // Apply optimistic update immediately
    setState(success(optimisticData));

    // Call service
    const result = await service.updateItem(updates);

    if (!isMountedRef.current) return false;

    if (result.success) {
      // Refresh from server to get final state
      await fetchItem();
      return true;
    } else {
      // Rollback on error
      setState(error(result.error, currentData, true));
      handleError(result.error, ErrorContextBuilder.fromHook('useItem', 'updateItem'));
      return false;
    }
  },
  [state, service, fetchItem, handleError],
);
```

### Guide 3: Adding Progress Tracking

**Step 1:** Update state with progress during operation

```typescript
const uploadFile = useCallback(
  async (file: File): Promise<boolean> => {
    setState(loadingWithProgress(undefined, false, 'Preparing upload', 0));

    // Simulate progress updates
    setState(loadingWithProgress(undefined, false, 'Uploading', 25));
    await uploadChunk1();

    setState(loadingWithProgress(undefined, false, 'Uploading', 50));
    await uploadChunk2();

    setState(loadingWithProgress(undefined, false, 'Finalizing', 75));
    await finalizeUpload();

    const result = await service.completeUpload();

    if (!isMountedRef.current) return false;

    if (result.success) {
      setState(success(result.value));
      return true;
    } else {
      setState(error(result.error));
      return false;
    }
  },
  [service],
);
```

### Guide 4: Using LoadingStateDisplay in Components

**Step 1:** Import component

```typescript
import { LoadingStateDisplay } from '@/components/common/loading-state-display';
```

**Step 2:** Use with render prop

```typescript
export default function FeatureScreen() {
  const { state, refresh } = useFeature();

  return (
    <Screen scrollable={true}>
      <LoadingStateDisplay
        state={state}
        onRetry={refresh}
        showOptimisticContent={true}
      >
        {(data) => (
          <View>
            <FeatureHeader data={data} />
            <FeatureContent data={data} />
          </View>
        )}
      </LoadingStateDisplay>
    </Screen>
  );
}
```

---

## Code Examples

### Example 1: Basic Hook with LoadingState

```typescript
export function useUserProfile(userId: string | null): UseUserProfileResult {
  const [state, setState] = useState<LoadingState<User | null>>(INIT_IDLE());
  const { handleError } = useErrorHandler();
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setState(idle());
      return;
    }

    setState(loading());

    const result = await userService.getProfile(userId);

    if (!isMountedRef.current) return;

    setState(fromResult(result));

    if (!result.success) {
      handleError(
        result.error,
        ErrorContextBuilder.fromHook('useUserProfile', 'fetchProfile', userId),
      );
    }
  }, [userId, handleError]);

  const { data, loading: isLoading, error: currentError } = useLoadingState(state);

  return {
    profile: data,
    loading: isLoading,
    error: currentError,
    state,
    fetchProfile,
  };
}
```

### Example 2: Hook with Optimistic Updates

```typescript
export function useProjectList(userId: string): UseProjectListResult {
  const [state, setState] = useState<LoadingState<Project[] | null>>(INIT_IDLE());
  const { handleError } = useErrorHandler();
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const addProject = useCallback(
    async (input: ProjectInput): Promise<boolean> => {
      const currentList = getCurrentData(state);
      if (!currentList) return false;

      // Create optimistic project
      const optimisticProject: Project = {
        id: generateUUID(),
        ...input,
        createdAt: new Date(),
      };

      // Apply optimistic update
      const optimisticList = [...currentList, optimisticProject];
      setState(success(optimisticList));

      // Call service
      const result = await projectService.createProject(userId, input);

      if (!isMountedRef.current) return false;

      if (result.success) {
        // Refresh from server
        await fetchProjects();
        return true;
      } else {
        // Rollback on error
        setState(error(result.error, currentList, true));
        handleError(
          result.error,
          ErrorContextBuilder.fromHook('useProjectList', 'addProject', userId),
        );
        return false;
      }
    },
    [userId, state, handleError],
  );

  const { data, loading, error } = useLoadingState(state);

  return {
    projects: data,
    loading,
    error,
    state,
    addProject,
  };
}
```

### Example 3: Hook with Progress Tracking

```typescript
export function useFileUpload(): UseFileUploadResult {
  const [state, setState] = useState<LoadingState<File | null>>(INIT_IDLE());
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const uploadFile = useCallback(async (file: File): Promise<boolean> => {
    setState(loadingWithProgress(undefined, false, 'Initializing', 0));

    try {
      // Step 1: Validate
      setState(loadingWithProgress(undefined, false, 'Validating', 10));
      await validateFile(file);

      // Step 2: Upload
      setState(loadingWithProgress(undefined, false, 'Uploading', 30));
      const uploadResult = await uploadFileChunks(file, progress => {
        if (isMountedRef.current) {
          setState(loadingWithProgress(undefined, false, 'Uploading', 30 + progress * 0.6));
        }
      });

      // Step 3: Finalize
      setState(loadingWithProgress(undefined, false, 'Finalizing', 90));
      const result = await fileService.finalizeUpload(uploadResult.id);

      if (!isMountedRef.current) return false;

      if (result.success) {
        setState(success(result.value));
        return true;
      } else {
        setState(error(result.error));
        return false;
      }
    } catch (error) {
      if (!isMountedRef.current) return false;
      const appError = ErrorMapper.toAppError(error, 'useFileUpload.uploadFile');
      setState(error(appError));
      return false;
    }
  }, []);

  const { data, loading, error, stage, progress } = useLoadingState(state);

  return {
    file: data,
    loading,
    error,
    stage,
    progress,
    state,
    uploadFile,
  };
}
```

### Example 4: Component Using LoadingStateDisplay

```typescript
export default function ProjectListScreen() {
  const { userId } = useAuth();
  const { state, refresh, addProject } = useProjectList(userId);

  return (
    <Screen scrollable={true} testID="project-list-screen">
      <LoadingStateDisplay state={state} onRetry={refresh}>
        {(projects) => (
          <>
            <ProjectListHeader />
            <ProjectList
              projects={projects || []}
              onAddProject={addProject}
            />
          </>
        )}
      </LoadingStateDisplay>
    </Screen>
  );
}
```

### Example 5: Store Using LoadingState

```typescript
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initialize with INIT_LOADING (app is initializing)
      authState: INIT_LOADING<User | null>(),

      setAuthState: authState => set({ authState }),

      optimisticUpdate: updates => {
        const currentState = get().authState;
        const currentUser = getCurrentData(currentState);
        if (!currentUser) return;

        const updatedUser = deepMerge(currentUser, updates);

        if (currentState.status === 'loading') {
          set({
            authState: loadingWithProgress(
              updatedUser,
              currentState.isOptimistic ?? false,
              currentState.stage,
              currentState.progress,
            ),
          });
        } else {
          set({ authState: success(updatedUser) });
        }
      },

      revertOptimisticUpdate: previousUser => {
        const currentState = get().authState;
        set({
          authState: error(getError(currentState) || createUnknownError(), previousUser, true),
        });
      },

      reset: () => set({ authState: INIT_IDLE<User | null>() }),

      // Computed getters
      get user() {
        const state = get().authState;
        return state.status === 'success' ? state.data : (getCurrentData(state) ?? null);
      },

      get isLoading() {
        return get().authState.status === 'loading';
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => {
        // Only persist success state
        const user = state.authState.status === 'success' ? state.authState.data : null;
        return {
          authState: user ? success(user) : INIT_IDLE<User | null>(),
        };
      },
    },
  ),
);
```

---

## Best Practices

### ✅ DO

1. **Always use LoadingState type**

   ```typescript
   // ✅ CORRECT
   const [state, setState] = useState<LoadingState<Data | null>>(INIT_IDLE());
   ```

2. **Always use initialization helpers**

   ```typescript
   // ✅ CORRECT
   const [state, setState] = useState<LoadingState<Data | null>>(
     INIT_AUTO_FETCH(options.autoFetch),
   );
   ```

3. **Always use useLoadingState hook**

   ```typescript
   // ✅ CORRECT
   const { data, loading, error } = useLoadingState(state);
   ```

4. **Always preserve data for rollback**

   ```typescript
   // ✅ CORRECT
   const currentData = getCurrentData(state);
   setState(loading(currentData));
   // ... on error
   setState(error(result.error, currentData));
   ```

5. **Always check isMounted before state updates**

   ```typescript
   // ✅ CORRECT
   if (!isMountedRef.current) return false;
   setState(success(data));
   ```

6. **Always use fromResult for conversions**

   ```typescript
   // ✅ CORRECT
   setState(fromResult(result, getCurrentData(state)));
   ```

7. **Always use LoadingStateDisplay when possible**
   ```typescript
   // ✅ CORRECT
   <LoadingStateDisplay state={state} onRetry={refresh}>
     {(data) => <Content data={data} />}
   </LoadingStateDisplay>
   ```

### ❌ DON'T

1. **Never use separate boolean flags**

   ```typescript
   // ❌ WRONG
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<Error | null>(null);
   const [data, setData] = useState<Data | null>(null);
   ```

2. **Never initialize without helpers**

   ```typescript
   // ❌ WRONG
   const [state, setState] = useState<LoadingState<Data | null>>(idle()); // Sometimes
   const [state, setState] = useState<LoadingState<Data | null>>(loading()); // Other times
   ```

3. **Never manually extract values**

   ```typescript
   // ❌ WRONG
   const data = state.status === 'success' ? state.data : null;
   const loading = state.status === 'loading';
   const error = state.status === 'error' ? state.error : null;
   ```

4. **Never update state after unmount**

   ```typescript
   // ❌ WRONG
   const result = await service.operation();
   setState(success(result.value)); // Could update after unmount!
   ```

5. **Never lose data on error**

   ```typescript
   // ❌ WRONG
   setState(error(result.error)); // Lost previous data!

   // ✅ CORRECT
   setState(error(result.error, getCurrentData(state)));
   ```

6. **Never use LoadingState for mutations**

   ```typescript
   // ❌ WRONG - Use MutationState for simple mutations
   const [state, setState] = useState<LoadingState<void>>(idle());

   // ✅ CORRECT - Use createMutationState() for simple mutations
   const mutation = createMutationState();
   ```

---

## Reference Tables

### LoadingState Status Values

| Status    | Description           | Has Data?   | Use Case                                    |
| --------- | --------------------- | ----------- | ------------------------------------------- |
| `idle`    | No operation started  | ❌ No       | Initial state, user hasn't triggered action |
| `loading` | Operation in progress | ✅ Optional | Fetching data, processing request           |
| `success` | Operation succeeded   | ✅ Yes      | Data loaded successfully                    |
| `error`   | Operation failed      | ✅ Optional | Error occurred (may have previous data)     |

### Initialization Helpers Reference

| Helper                                     | Parameters           | Returns                      | Use Case                        |
| ------------------------------------------ | -------------------- | ---------------------------- | ------------------------------- |
| `INIT_IDLE()`                              | None                 | `LoadingState<T>` in idle    | User action required            |
| `INIT_LOADING()`                           | None                 | `LoadingState<T>` in loading | App/component initializing      |
| `INIT_AUTO_FETCH(autoFetch)`               | `boolean`            | `LoadingState<T>`            | Hook with autoFetch option      |
| `INIT_REALTIME(enableRealtime)`            | `boolean`            | `LoadingState<T>`            | Hook with enableRealtime option |
| `INIT_COMBINED(autoFetch, enableRealtime)` | `boolean`, `boolean` | `LoadingState<T>`            | Hook with both options          |

### State Creator Functions Reference

| Function                                                       | Parameters                             | Returns           | Use Case                     |
| -------------------------------------------------------------- | -------------------------------------- | ----------------- | ---------------------------- |
| `idle()`                                                       | None                                   | `LoadingState<T>` | Create idle state            |
| `loading(data?, isOptimistic?)`                                | `T?`, `boolean?`                       | `LoadingState<T>` | Create loading state         |
| `loadingWithProgress(data?, isOptimistic?, stage?, progress?)` | `T?`, `boolean?`, `string?`, `number?` | `LoadingState<T>` | Create loading with progress |
| `success(data)`                                                | `T`                                    | `LoadingState<T>` | Create success state         |
| `error(error, data?, isOptimistic?)`                           | `AppError`, `T?`, `boolean?`           | `LoadingState<T>` | Create error state           |

### Type Guard Functions Reference

| Function                     | Returns   | Use Case                               |
| ---------------------------- | --------- | -------------------------------------- |
| `isIdle(state)`              | `boolean` | Check if state is idle                 |
| `isLoading(state)`           | `boolean` | Check if state is loading              |
| `isSuccess(state)`           | `boolean` | Check if state is success              |
| `hasError(state)`            | `boolean` | Check if state is error                |
| `hasData(state)`             | `boolean` | Check if state has data                |
| `isOptimistic(state)`        | `boolean` | Check if state is optimistic           |
| `isInitialLoading(state)`    | `boolean` | Check if initial load (not optimistic) |
| `isOptimisticLoading(state)` | `boolean` | Check if optimistic loading            |

### Data Extractor Functions Reference

| Function                | Returns                 | Use Case                                        |
| ----------------------- | ----------------------- | ----------------------------------------------- |
| `getData(state)`        | `T \| undefined`        | Extract data if available                       |
| `getError(state)`       | `AppError \| undefined` | Extract error if available                      |
| `getCurrentData(state)` | `T \| undefined`        | Get data from any state (success/loading/error) |
| `getStage(state)`       | `string \| undefined`   | Get operation stage (if loading)                |
| `getProgress(state)`    | `number \| undefined`   | Get progress percentage (if loading)            |
| `canRetry(state)`       | `boolean`               | Check if operation can be retried               |

### State Transformer Functions Reference

| Function                            | Parameters                    | Returns             | Use Case                       |
| ----------------------------------- | ----------------------------- | ------------------- | ------------------------------ |
| `fromResult(result, previousData?)` | `Result<T, AppError>`, `T?`   | `LoadingState<T>`   | Convert Result to LoadingState |
| `mapLoadingState(state, mapper)`    | `LoadingState<T>`, `(T) => U` | `LoadingState<U>`   | Transform data in LoadingState |
| `combineLoadingStates(states)`      | `LoadingState<T>[]`           | `LoadingState<T[]>` | Combine multiple LoadingStates |

### useLoadingState Hook Return Values

| Property       | Type                  | Description                                   |
| -------------- | --------------------- | --------------------------------------------- |
| `data`         | `T \| null`           | Current data (from success or previous state) |
| `loading`      | `boolean`             | Whether state is loading                      |
| `error`        | `AppError \| null`    | Error if state is error, null otherwise       |
| `stage`        | `string \| undefined` | Operation stage (if loading)                  |
| `progress`     | `number \| undefined` | Progress percentage (if loading)              |
| `isOptimistic` | `boolean`             | Whether state is optimistic update            |
| `canRetry`     | `boolean`             | Whether error is retryable                    |
| `state`        | `LoadingState<T>`     | Full LoadingState for advanced use cases      |

---

## Troubleshooting

### Common Issues

#### Issue 1: Type errors with LoadingState

**Symptoms:** TypeScript errors about accessing properties on LoadingState

**Solution:**

- Use type guards: `if (isLoading(state)) { state.stage }`
- Use extractor functions: `getStage(state)` instead of `state.stage`
- Use `useLoadingState` hook for consistent extraction

#### Issue 2: State updates after unmount

**Symptoms:** React warnings about state updates on unmounted components

**Solution:**

- Always check `isMountedRef.current` before updating state
- Use cleanup in `useEffect` to set `isMountedRef.current = false`

```typescript
const isMountedRef = useRef(true);

useEffect(() => {
  return () => {
    isMountedRef.current = false;
  };
}, []);

// In async operations
if (!isMountedRef.current) return false;
setState(success(data));
```

#### Issue 3: Lost data on error

**Symptoms:** Previous data disappears when error occurs

**Solution:**

- Always preserve data using `getCurrentData()` before operations
- Pass previous data to `error()` function

```typescript
// ✅ CORRECT
const currentData = getCurrentData(state);
setState(loading(currentData));
// ... on error
setState(error(result.error, currentData));
```

#### Issue 4: Inconsistent initialization

**Symptoms:** Different hooks initialize differently

**Solution:**

- Always use initialization helpers (`INIT_IDLE()`, `INIT_AUTO_FETCH()`, etc.)
- Follow the decision matrix in initialization patterns

#### Issue 5: Optimistic updates not showing

**Symptoms:** Optimistic updates don't appear in UI

**Solution:**

- Ensure `isOptimistic: true` is set when creating loading state
- Use `LoadingStateDisplay` with `showOptimisticContent={true}`
- Check that data is included in optimistic state

```typescript
// ✅ CORRECT
setState(loading(optimisticData, true)); // isOptimistic = true
```

#### Issue 6: Progress not displaying

**Symptoms:** Progress bar or stage text not showing

**Solution:**

- Use `loadingWithProgress()` instead of `loading()`
- Pass `showProgress={true}` to `LoadingIndicator`
- Ensure progress value is between 0-100

```typescript
// ✅ CORRECT
setState(loadingWithProgress(data, false, 'Uploading', 45));
<LoadingIndicator progress={progress} showProgress={true} />
```

---

## Quick Reference Checklist

When implementing loading states, verify:

- [ ] Using `LoadingState<T>` type (not separate boolean flags)
- [ ] Using initialization helpers (`INIT_IDLE()`, `INIT_AUTO_FETCH()`, etc.)
- [ ] Using `useLoadingState` hook for value extraction
- [ ] Checking `isMountedRef` before state updates
- [ ] Preserving data using `getCurrentData()` for rollback
- [ ] Using `fromResult()` to convert Result to LoadingState
- [ ] Using `LoadingStateDisplay` component when possible
- [ ] Using type guards for safe property access
- [ ] Cleaning up subscriptions on unmount
- [ ] Using `loadingWithProgress()` for multi-step operations

---

## Additional Resources

- **LoadingState Utilities:** `src/utils/loading-state.ts`
- **Initialization Helpers:** `src/utils/loading-state-initialization.ts`
- **useLoadingState Hook:** `src/hooks/use-loading-state.ts`
- **LoadingStateDisplay Component:** `src/components/common/loading-state-display.tsx`
- **LoadingIndicator Component:** `src/components/common/loading-indicator.tsx`
- **Screen Component:** `src/components/common/screen.tsx`
- **Error Handling Standards:** `standards-error-handling.md`

---

## Decision Matrix

### When to Use Which Initialization Pattern

| Scenario              | Initial State              | Helper                                     | Example              |
| --------------------- | -------------------------- | ------------------------------------------ | -------------------- |
| User action required  | `idle`                     | `INIT_IDLE()`                              | Form submission hook |
| App initialization    | `loading`                  | `INIT_LOADING()`                           | Auth store           |
| Auto-fetch on mount   | `loading` (if autoFetch)   | `INIT_AUTO_FETCH(autoFetch)`               | Data fetching hook   |
| Realtime subscription | `loading` (if enabled)     | `INIT_REALTIME(enableRealtime)`            | List with realtime   |
| Multiple options      | `loading` (if any enabled) | `INIT_COMBINED(autoFetch, enableRealtime)` | Complex hook         |

### When to Use Which Component

| Scenario          | Component             | Reason                  |
| ----------------- | --------------------- | ----------------------- |
| Simple screen     | `LoadingStateDisplay` | Automatic handling      |
| Complex layout    | `Screen` + manual     | More control            |
| Inline loading    | `LoadingIndicator`    | Small loading indicator |
| Full screen error | `ErrorDisplay`        | Error with retry        |

### When to Use Optimistic Updates

| Scenario                  | Use Optimistic? | Reason                   |
| ------------------------- | --------------- | ------------------------ |
| Fast operations (< 500ms) | ✅ Yes          | Instant feedback         |
| Slow operations (> 2s)    | ✅ Yes          | Better UX                |
| Critical operations       | ❌ No           | Wait for confirmation    |
| Network operations        | ✅ Yes          | Handle rollback on error |

---

**Document Version:** 1.0.0  
**Last Updated:** December 2025  
**Maintained By:** Development Team
