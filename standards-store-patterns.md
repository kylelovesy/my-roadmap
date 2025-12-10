# Store Patterns & Best Practices Guide

**Version:** 1.0.0  
**Last Updated:** December 2025  
**Author:** Kyle Lovesy

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Concepts](#core-concepts)
4. [Store Patterns by Use Case](#store-patterns-by-use-case)
5. [Implementation Guides](#implementation-guides)
6. [Code Examples](#code-examples)
7. [Best Practices](#best-practices)
8. [Reference Tables](#reference-tables)
9. [Troubleshooting](#troubleshooting)

---

## Overview

The Eye-Doo application uses **Zustand** for global state management with a **selector-based architecture** that ensures:

- ✅ **Optimal performance** - Components only re-render when their specific data changes
- ✅ **Type safety** - Full TypeScript support with proper inference
- ✅ **Reactive updates** - Components automatically update when store state changes
- ✅ **Separation of concerns** - Clear distinction between React and non-React code
- ✅ **Consistent patterns** - Standardized approach across all stores
- ✅ **LoadingState integration** - Seamless integration with loading state management

### Key Principles

1. **Always use selector hooks in components** - Never access store directly in React components
2. **Always use standalone getters in services** - Never use hooks outside React components
3. **Always subscribe to specific fields** - Never subscribe to entire store
4. **Always use getters in event handlers** - Use standalone getters for one-time reads
5. **Never create unnecessary getters** - Only create getters for complex logic extraction

---

## Architecture

### Store Access Flow Diagram

```
┌─────────────────┐
│   Component     │
│   (React)       │
│                 │
│ Uses:           │
│ - Selector Hooks│
│   (useUser)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Zustand Store │
│                 │
│ State:          │
│ - authState     │
│ - Actions       │
│ - Getters       │
└────────┬────────┘
         │
         ├─► Selector Hook (Reactive)
         │   const user = useUser()
         │
         └─► Standalone Getter (Imperative)
             const user = getUser()
```

### Store Structure Pattern

```
Store File Structure:
├── Types & Interfaces
├── Store Implementation
│   ├── State
│   ├── Actions
│   └── Internal Getters (for complex logic)
├── Selector Hooks (for React components)
└── Standalone Getters (for services/utils)
```

### State Update Flow

```
1. Action Triggered
   │
   ├─► In Component? → Use selector hook
   │   └─► const user = useUser()
   │
   ├─► In Service? → Use standalone getter
   │   └─► const user = getUser()
   │
   └─► In Event Handler? → Use standalone getter
       └─► const user = getUser()
   │
   ▼
2. Store Updates
   │
   ▼
3. Selector Hooks Re-evaluate
   │
   ▼
4. Components Re-render (only if value changed)
```

---

## Core Concepts

### 1. Selector Hooks (Reactive)

Selector hooks are **React hooks** that subscribe to specific store values. Components using these hooks will **automatically re-render** when the selected value changes.

```typescript
// ✅ CORRECT - Selector hook for components
export const useUser = () =>
  useAuthStore(state => getCurrentData(state.authState) ?? null);

// Usage in component
function MyComponent() {
  const user = useUser(); // Re-renders when user changes
  return <Text>{user?.name}</Text>;
}
```

**Key Features:**

- **Reactive** - Component re-renders when value changes
- **Type-safe** - Full TypeScript inference
- **Optimized** - Only re-renders when selected value changes
- **React-only** - Can only be used in React components

### 2. Standalone Getters (Imperative)

Standalone getters are **non-React functions** that read store state imperatively. They do **NOT** trigger re-renders and can be used anywhere (services, utilities, event handlers).

```typescript
// ✅ CORRECT - Standalone getter for non-React code
export const getUser = (): User | null => {
  return useAuthStore.getState().getUser();
};

// Usage in service
class UserService {
  async updateProfile() {
    const user = getUser(); // No re-render, just read value
    if (!user) throw new Error('Not authenticated');
    // ...
  }
}
```

**Key Features:**

- **Imperative** - One-time read, no subscription
- **Non-reactive** - Does not trigger re-renders
- **Universal** - Can be used anywhere (services, utils, handlers)
- **Performance** - No subscription overhead

### 3. Store Selectors

Zustand selectors are functions that extract specific values from store state. They enable fine-grained subscriptions.

```typescript
// ✅ CORRECT - Specific field selector
const user = useAuthStore(state => getCurrentData(state.authState) ?? null);

// ❌ WRONG - Entire store selector
const store = useAuthStore(); // Re-renders on ANY change!
```

**Performance Impact:**

- **Specific selector**: Re-renders only when selected value changes
- **Full store selector**: Re-renders on ANY store change (inefficient)

### 4. Internal Getters

Internal getters are methods on the store that extract complex logic. They should only be used by standalone getters, not directly in components.

```typescript
interface AuthState {
  authState: LoadingState<User | null>;

  // Internal getter (for complex logic only)
  getUser: () => User | null; // Extracts from LoadingState
}

// Used by standalone getter
export const getUser = (): User | null => {
  return useAuthStore.getState().getUser();
};
```

**When to Use:**

- ✅ Complex data extraction (e.g., from LoadingState)
- ✅ Computed values that require store access
- ❌ Simple field access (use selector hooks instead)

---

## Store Patterns by Use Case

### Pattern 1: Component Rendering

**Use Case:** Displaying store data in UI

**Pattern:** Use selector hooks

```typescript
// ✅ CORRECT
function MyComponent() {
  const user = useUser();
  const loading = useAuthLoading();
  const error = useAuthError();

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  return <Text>{user?.name}</Text>;
}

// ❌ WRONG - Direct store access
function MyComponent() {
  const store = useAuthStore();
  return <Text>{store.getUser()?.name}</Text>; // No reactivity!
}
```

### Pattern 2: Service/Utility Access

**Use Case:** Reading store state in services or utilities

**Pattern:** Use standalone getters

```typescript
// ✅ CORRECT
class UserService {
  async updateProfile() {
    const user = getUser(); // Standalone getter
    if (!user) {
      return err(ErrorMapper.createGenericError(...));
    }
    // ...
  }
}

// ❌ WRONG - Using hook in service
class UserService {
  async updateProfile() {
    const user = useUser(); // ERROR: Can't use hooks outside components!
  }
}
```

### Pattern 3: Event Handlers

**Use Case:** Reading store state in event handlers

**Pattern:** Use standalone getters (for one-time reads), selector hooks (for rendering)

```typescript
// ✅ CORRECT
function MyComponent() {
  const user = useUser(); // For rendering

  const handleClick = () => {
    const currentUser = getUser(); // For handler (one-time read)
    console.log('Clicked user:', currentUser?.name);
  };

  return (
    <View>
      <Text>{user?.name}</Text>
      <Button onPress={handleClick} />
    </View>
  );
}

// ❌ WRONG - Using hook in handler
function MyComponent() {
  const handleClick = () => {
    const user = useUser(); // ERROR: Hooks can't be called conditionally!
  };
}
```

### Pattern 4: Conditional Logic

**Use Case:** Checking store state for conditional logic

**Pattern:** Use selector hooks in components, standalone getters in services

```typescript
// ✅ CORRECT - In component
function MyComponent() {
  const isAuthenticated = useIsAuthenticated();

  if (!isAuthenticated) {
    return <LoginScreen />;
  }
  return <Dashboard />;
}

// ✅ CORRECT - In service
class AuthService {
  async protectedOperation() {
    if (!getIsAuthenticated()) {
      return err(ErrorMapper.createGenericError(...));
    }
    // ...
  }
}
```

### Pattern 5: Multiple Field Access

**Use Case:** Accessing multiple store values

**Pattern:** Use multiple selector hooks (each subscribes to specific field)

```typescript
// ✅ CORRECT - Multiple specific selectors
function MyComponent() {
  const user = useUser();
  const loading = useAuthLoading();
  const error = useAuthError();

  // Each hook only subscribes to its specific field
  // Component only re-renders when relevant fields change
}

// ❌ WRONG - Single full store selector
function MyComponent() {
  const store = useAuthStore();
  const user = store.getUser();
  const loading = store.authState.status === 'loading';
  // Re-renders on ANY store change!
}
```

---

## Implementation Guides

### Guide 1: Creating a New Store

**Step 1:** Define types and interfaces

```typescript
import { create } from 'zustand';
import {
  LoadingState,
  success,
  idle,
  loading,
  fromResult,
  getCurrentData,
} from '@/utils/loading-state';
import { INIT_IDLE } from '@/utils/loading-state-initialization';

interface FeatureState {
  // Primary state
  featureState: LoadingState<Data | null>;

  // Actions
  setFeatureState: (state: LoadingState<Data | null>) => void;
  reset: () => void;

  // Async actions
  fetchData: () => Promise<void>;

  // Internal getters (only for complex logic)
  getData: () => Data | null;
}
```

**Step 2:** Implement store

```typescript
export const useFeatureStore = create<FeatureState>((set, get) => ({
  // Initial state
  featureState: INIT_IDLE<Data | null>(),

  // Actions
  setFeatureState: state => set({ featureState: state }),

  reset: () => set({ featureState: idle<Data | null>() }),

  // Async actions with proper LoadingState handling
  fetchData: async () => {
    const currentData = getCurrentData(get().featureState);
    set({ featureState: loading(currentData) });

    const result = await featureService.getData();

    set({
      featureState: fromResult(result, currentData),
    });
  },

  // Internal getter (only if complex logic needed)
  getData: () => {
    const state = get().featureState;
    return getCurrentData(state) ?? null;
  },
}));
```

**Step 3:** Create selector hooks

```typescript
// Selector hooks (for React components)
export const useFeatureData = () =>
  useFeatureStore(state => getCurrentData(state.featureState) ?? null);

export const useFeatureLoading = () =>
  useFeatureStore(state => state.featureState.status === 'loading');

export const useFeatureError = () =>
  useFeatureStore(state =>
    state.featureState.status === 'error' ? state.featureState.error : null,
  );
```

**Step 4:** Create standalone getters (if needed)

```typescript
// Standalone getters (for services/utils)
export const getFeatureData = (): Data | null => {
  return useFeatureStore.getState().getData();
};
```

### Guide 2: Adding Selector Hooks to Existing Store

**Step 1:** Identify what values components need

```typescript
// Example: Auth store needs:
// - User data
// - Loading state
// - Error state
// - Authentication status
```

**Step 2:** Create selector hooks

```typescript
export const useUser = () => useAuthStore(state => getCurrentData(state.authState) ?? null);

export const useAuthLoading = () => useAuthStore(state => state.authState.status === 'loading');

export const useAuthError = () =>
  useAuthStore(state => (state.authState.status === 'error' ? state.authState.error : null));

export const useIsAuthenticated = () =>
  useAuthStore(state => getCurrentData(state.authState) !== null);
```

**Step 3:** Update components to use selector hooks

```typescript
// Before
function MyComponent() {
  const store = useAuthStore();
  const user = store.getUser();
  return <Text>{user?.name}</Text>;
}

// After
function MyComponent() {
  const user = useUser();
  return <Text>{user?.name}</Text>;
}
```

### Guide 3: Adding Standalone Getters

**Step 1:** Determine if getter is needed

```typescript
// Ask: Is this used in services/utils/event handlers?
// If yes, create standalone getter
// If no, use selector hook in component
```

**Step 2:** Create standalone getter

```typescript
// ✅ CORRECT - For services
export const getUser = (): User | null => {
  return useAuthStore.getState().getUser();
};

// Usage in service
class UserService {
  async updateProfile() {
    const user = getUser();
    if (!user) return err(...);
    // ...
  }
}
```

**Step 3:** Document usage

```typescript
/**
 * Get current user (imperative)
 * For use in services, utilities, event handlers
 * Does NOT trigger re-renders
 *
 * @example
 * class UserService {
 *   async updateProfile() {
 *     const user = getUser();
 *     if (!user) throw new Error('Not authenticated');
 *     // ...
 *   }
 * }
 */
export const getUser = (): User | null => {
  return useAuthStore.getState().getUser();
};
```

### Guide 4: Optimizing Store Subscriptions

**Step 1:** Identify unnecessary re-renders

```typescript
// ❌ WRONG - Re-renders on ANY store change
function MyComponent() {
  const store = useAuthStore();
  return <Text>{store.getUser()?.name}</Text>;
}
```

**Step 2:** Replace with specific selector

```typescript
// ✅ CORRECT - Only re-renders when user changes
function MyComponent() {
  const user = useUser();
  return <Text>{user?.name}</Text>;
}
```

**Step 3:** Use multiple specific selectors

```typescript
// ✅ CORRECT - Each subscribes to specific field
function MyComponent() {
  const user = useUser();
  const loading = useAuthLoading();
  const error = useAuthError();

  // Component only re-renders when user, loading, or error changes
}
```

---

## Code Examples

### Example 1: Complete Store Implementation

```typescript
/*---------------------------------------
File: src/stores/use-feature-store.ts
Description: Feature store with selector hooks and standalone getters
---------------------------------------*/

import { create } from 'zustand';
import { LoadingState, success, idle, getCurrentData } from '@/utils/loading-state';
import { INIT_IDLE } from '@/utils/loading-state-initialization';
import { Data } from '@/domain/feature/feature.schema';

// --- Types ---

interface FeatureState {
  // Primary state
  featureState: LoadingState<Data | null>;

  // Actions
  setFeatureState: (state: LoadingState<Data | null>) => void;
  reset: () => void;

  // Internal getter (for complex logic only)
  getData: () => Data | null;
}

// --- Store Implementation ---

export const useFeatureStore = create<FeatureState>((set, get) => ({
  // Initial state
  featureState: INIT_IDLE<Data | null>(),

  // Actions
  setFeatureState: state => set({ featureState: state }),

  reset: () => set({ featureState: idle<Data | null>() }),

  // Internal getter (only for complex logic)
  getData: () => {
    const state = get().featureState;
    return getCurrentData(state) ?? null;
  },
}));

// --- Selector Hooks (for React components) ---

/**
 * Get feature data (reactive)
 * Component re-renders when data changes
 */
export const useFeatureData = () =>
  useFeatureStore(state => getCurrentData(state.featureState) ?? null);

/**
 * Check if feature is loading (reactive)
 */
export const useFeatureLoading = () =>
  useFeatureStore(state => state.featureState.status === 'loading');

/**
 * Get feature error if present (reactive)
 */
export const useFeatureError = () =>
  useFeatureStore(state =>
    state.featureState.status === 'error' ? state.featureState.error : null,
  );

// --- Standalone Getters (for services/utils) ---

/**
 * Get feature data (imperative)
 * For use in services, utilities, event handlers
 * Does NOT trigger re-renders
 */
export const getFeatureData = (): Data | null => {
  return useFeatureStore.getState().getData();
};
```

### Example 2: Component Using Selector Hooks

```typescript
// ✅ CORRECT - Using selector hooks
export default function FeatureScreen() {
  const data = useFeatureData();
  const loading = useFeatureLoading();
  const error = useFeatureError();

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorDisplay error={error} />;
  return <FeatureContent data={data} />;
}

// ❌ WRONG - Direct store access
export default function FeatureScreen() {
  const store = useFeatureStore();
  const data = store.getData();
  // No reactivity - won't update when store changes!
  return <FeatureContent data={data} />;
}
```

### Example 3: Service Using Standalone Getters

```typescript
// ✅ CORRECT - Using standalone getter
class FeatureService {
  async updateFeature(updates: FeatureUpdate): Promise<Result<void, AppError>> {
    const currentData = getFeatureData(); // Standalone getter
    if (!currentData) {
      return err(ErrorMapper.createGenericError(...));
    }

    // Perform update
    return await this.repository.update(currentData.id, updates);
  }
}

// ❌ WRONG - Using hook in service
class FeatureService {
  async updateFeature(updates: FeatureUpdate): Promise<Result<void, AppError>> {
    const currentData = useFeatureData(); // ERROR: Can't use hooks outside components!
    // ...
  }
}
```

### Example 4: Event Handler Pattern

```typescript
// ✅ CORRECT - Selector hook for rendering, standalone getter for handler
function MyComponent() {
  const user = useUser(); // For rendering (reactive)

  const handleSubmit = async () => {
    const currentUser = getUser(); // For handler (one-time read)
    if (!currentUser) {
      showToast({ type: 'error', message: 'Not authenticated' });
      return;
    }

    await submitForm(currentUser.id);
  };

  return (
    <View>
      <Text>Welcome, {user?.name}</Text>
      <Button onPress={handleSubmit} title="Submit" />
    </View>
  );
}

// ❌ WRONG - Using hook in handler
function MyComponent() {
  const handleSubmit = async () => {
    const user = useUser(); // ERROR: Hooks can't be called conditionally!
    // ...
  };
}
```

### Example 5: Multiple Store Values

```typescript
// ✅ CORRECT - Multiple specific selectors
function Dashboard() {
  const user = useUser();
  const loading = useAuthLoading();
  const error = useAuthError();
  const toasts = useToasts();

  // Each hook subscribes to specific field
  // Component only re-renders when relevant fields change

  return (
    <View>
      {loading && <LoadingSpinner />}
      {error && <ErrorDisplay error={error} />}
      {user && <UserProfile user={user} />}
      <ToastList toasts={toasts} />
    </View>
  );
}

// ❌ WRONG - Full store subscription
function Dashboard() {
  const authStore = useAuthStore();
  const uiStore = useUIStore();

  // Re-renders on ANY change to either store!
  return (
    <View>
      <UserProfile user={authStore.getUser()} />
      <ToastList toasts={uiStore.toasts} />
    </View>
  );
}
```

---

## Best Practices

### ✅ DO

1. **Always use selector hooks in components**

   ```typescript
   // ✅ CORRECT
   function MyComponent() {
     const user = useUser();
     return <Text>{user?.name}</Text>;
   }
   ```

2. **Always use standalone getters in services**

   ```typescript
   // ✅ CORRECT
   class UserService {
     async updateProfile() {
       const user = getUser();
       if (!user) return err(...);
     }
   }
   ```

3. **Always subscribe to specific fields**

   ```typescript
   // ✅ CORRECT
   const user = useUser(); // Only subscribes to user
   const loading = useAuthLoading(); // Only subscribes to loading
   ```

4. **Always use getters in event handlers**

   ```typescript
   // ✅ CORRECT
   const handleClick = () => {
     const user = getUser(); // One-time read
   };
   ```

5. **Always create selector hooks for component access**

   ```typescript
   // ✅ CORRECT
   export const useUser = () => useAuthStore(state => getCurrentData(state.authState) ?? null);
   ```

6. **Always document standalone getters**

   ```typescript
   /**
    * Get current user (imperative)
    * For use in services, utilities, event handlers
    * Does NOT trigger re-renders
    */
   export const getUser = (): User | null => {
     return useAuthStore.getState().getUser();
   };
   ```

### ❌ DON'T

1. **Never use hooks outside React components**

   ```typescript
   // ❌ WRONG
   class UserService {
     async updateProfile() {
       const user = useUser(); // ERROR: Can't use hooks outside components!
     }
   }
   ```

2. **Never subscribe to entire store**

   ```typescript
   // ❌ WRONG
   function MyComponent() {
     const store = useAuthStore(); // Re-renders on ANY change!
     return <Text>{store.getUser()?.name}</Text>;
   }
   ```

3. **Never use standalone getters for rendering**

   ```typescript
   // ❌ WRONG
   function MyComponent() {
     const user = getUser(); // No reactivity!
     return <Text>{user?.name}</Text>; // Won't update when store changes
   }
   ```

4. **Never create unnecessary getters**

   ```typescript
   // ❌ WRONG - Unnecessary getters
   interface AuthState {
     user: User | null;
     getUser: () => User | null; // Unnecessary - use selector hook
     getLoading: () => boolean; // Unnecessary - use selector hook
     getUserEmail: () => string | null; // Unnecessary - use selector hook
   }

   // ✅ CORRECT - Only getter for complex logic
   interface AuthState {
     authState: LoadingState<User | null>;
     getUser: () => User | null; // Only if extracting from LoadingState
   }
   ```

5. **Never call hooks conditionally**

   ```typescript
   // ❌ WRONG
   const handleClick = () => {
     if (someCondition) {
       const user = useUser(); // ERROR: Hooks can't be called conditionally!
     }
   };
   ```

6. **Never use store.getState() directly in components**

   ```typescript
   // ❌ WRONG
   function MyComponent() {
     const user = useAuthStore.getState().getUser(); // No reactivity!
     return <Text>{user?.name}</Text>;
   }
   ```

---

## Reference Tables

### Store Access Patterns

| Use Case                      | Pattern                 | Example                                                    | Re-renders?                 |
| ----------------------------- | ----------------------- | ---------------------------------------------------------- | --------------------------- |
| Component rendering           | Selector hook           | `const user = useUser()`                                   | ✅ Yes (when value changes) |
| Service/utility               | Standalone getter       | `const user = getUser()`                                   | ❌ No                       |
| Event handler                 | Standalone getter       | `const user = getUser()`                                   | ❌ No                       |
| Conditional logic (component) | Selector hook           | `const isAuth = useIsAuthenticated()`                      | ✅ Yes                      |
| Conditional logic (service)   | Standalone getter       | `const isAuth = getIsAuthenticated()`                      | ❌ No                       |
| Multiple fields               | Multiple selector hooks | `const user = useUser(); const loading = useAuthLoading()` | ✅ Yes (when any changes)   |

### Performance Comparison

| Pattern                     | Re-renders                       | Performance | Use Case            |
| --------------------------- | -------------------------------- | ----------- | ------------------- |
| Specific selector           | Only when selected value changes | ⚡ Fast     | Component rendering |
| Multiple specific selectors | When any selected value changes  | ⚡ Fast     | Multiple fields     |
| Full store subscription     | On ANY store change              | 🐌 Slow     | ❌ Never use        |
| Standalone getter           | Never                            | ⚡ Fast     | Services, handlers  |

### When to Create What

| Scenario                          | Solution                            | Example                                  |
| --------------------------------- | ----------------------------------- | ---------------------------------------- |
| Component needs to display value  | Selector hook                       | `useUser()`                              |
| Service needs to read value       | Standalone getter                   | `getUser()`                              |
| Event handler needs one-time read | Standalone getter                   | `getUser()`                              |
| Complex data extraction           | Internal getter + standalone getter | `getUser()` (extracts from LoadingState) |
| Simple field access               | Selector hook only                  | `useAuthLoading()`                       |

### Store Structure Checklist

When creating a store, ensure:

- [ ] State is properly typed
- [ ] Actions are defined for state mutations
- [ ] Internal getters only for complex logic
- [ ] Selector hooks exported for component access
- [ ] Standalone getters exported for service access
- [ ] All hooks/getters are documented
- [ ] No unnecessary getters created

---

## Troubleshooting

### Common Issues

#### Issue 1: Component not updating when store changes

**Symptoms:** Component displays stale data, doesn't react to store updates

**Solution:**

- Ensure you're using selector hooks, not standalone getters
- Check that selector is subscribing to the correct field
- Verify store is actually updating (check with `useAuthStore.getState()`)

```typescript
// ❌ WRONG - No reactivity
function MyComponent() {
  const user = getUser(); // Standalone getter - no subscription!
  return <Text>{user?.name}</Text>;
}

// ✅ CORRECT - Reactive
function MyComponent() {
  const user = useUser(); // Selector hook - subscribes to changes
  return <Text>{user?.name}</Text>;
}
```

#### Issue 2: Too many re-renders

**Symptoms:** Component re-renders excessively, performance issues

**Solution:**

- Use specific selector hooks instead of full store subscription
- Split into multiple specific selectors if accessing multiple fields
- Use `useMemo` for expensive computations

```typescript
// ❌ WRONG - Re-renders on ANY store change
function MyComponent() {
  const store = useAuthStore();
  return <Text>{store.getUser()?.name}</Text>;
}

// ✅ CORRECT - Only re-renders when user changes
function MyComponent() {
  const user = useUser();
  return <Text>{user?.name}</Text>;
}
```

#### Issue 3: Hook called outside component

**Symptoms:** React error: "Hooks can only be called inside React components"

**Solution:**

- Use standalone getters in services/utilities
- Never call hooks in event handlers (use standalone getters)
- Never call hooks conditionally

```typescript
// ❌ WRONG - Hook in service
class UserService {
  async updateProfile() {
    const user = useUser(); // ERROR!
  }
}

// ✅ CORRECT - Standalone getter in service
class UserService {
  async updateProfile() {
    const user = getUser(); // OK!
  }
}
```

#### Issue 4: Stale closures in event handlers

**Symptoms:** Event handlers use old values, not current store state

**Solution:**

- Use standalone getters in event handlers (they read current state)
- Don't capture store values in closure

```typescript
// ❌ WRONG - Stale closure
function MyComponent() {
  const user = useUser(); // Captured in closure
  const handleClick = () => {
    console.log(user?.name); // May be stale!
  };
}

// ✅ CORRECT - Read current state
function MyComponent() {
  const user = useUser(); // For rendering
  const handleClick = () => {
    const currentUser = getUser(); // Always current
    console.log(currentUser?.name);
  };
}
```

#### Issue 5: Unnecessary getters created

**Symptoms:** Store has many getters that just return simple fields

**Solution:**

- Remove unnecessary getters
- Use selector hooks for simple field access
- Only create getters for complex logic extraction

```typescript
// ❌ WRONG - Unnecessary getters
interface AuthState {
  user: User | null;
  getUser: () => User | null; // Unnecessary
  getLoading: () => boolean; // Unnecessary
}

// ✅ CORRECT - Only getter for complex logic
interface AuthState {
  authState: LoadingState<User | null>;
  getUser: () => User | null; // Only if extracting from LoadingState
}

// Use selector hooks for simple access
export const useUser = () => useAuthStore(state => ...);
export const useAuthLoading = () => useAuthStore(state => ...);
```

---

## Quick Reference Checklist

When implementing store access, verify:

- [ ] Using selector hooks in React components
- [ ] Using standalone getters in services/utilities
- [ ] Using standalone getters in event handlers
- [ ] Subscribing to specific fields (not entire store)
- [ ] Not creating unnecessary getters
- [ ] Not calling hooks outside components
- [ ] Not calling hooks conditionally
- [ ] Documenting all selector hooks and getters
- [ ] Testing that components update when store changes
- [ ] Verifying performance (no excessive re-renders)

---

## Decision Tree

### Need to access store?

```
Need to access store?
│
├─ In React component?
│  │
│  ├─ For rendering? → Use selector hook
│  │  └─ const user = useUser()
│  │
│  └─ In event handler? → Use standalone getter
│     └─ const user = getUser()
│
└─ In service/utility?
   └─ Use standalone getter
      └─ const user = getUser()
```

### Creating a new store?

```
Creating new store?
│
├─ Define state and actions
│
├─ Create selector hooks (for components)
│  └─ export const useFeatureData = () => ...
│
└─ Create standalone getters (if needed for services)
   └─ export const getFeatureData = () => ...
```

### Component not updating?

```
Component not updating?
│
├─ Using selector hook? → Check selector logic
│  └─ Ensure selector returns correct value
│
├─ Using standalone getter? → Switch to selector hook
│  └─ const user = useUser() (not getUser())
│
└─ Store actually updating? → Check with getState()
   └─ console.log(useAuthStore.getState())
```

---

## Additional Resources

- **Auth Store:** `src/stores/use-auth-store.ts`
- **UI Store:** `src/stores/use-ui-store.ts`
- **Store Template:** `src/stores/store-template.ts`
- **Zustand Documentation:** https://zustand-demo.pmnd.rs/
- **Loading State Standards:** `standards/standards-loading-states.md`
- **Error Handling Standards:** `standards/standards-error-handling.md`

---

## Performance Comparison Example

### Scenario: 10 components watching auth state

**❌ Full Store Subscription:**

```typescript
// Each component subscribes to entire store
const store = useAuthStore();
const user = store.getUser();
const loading = store.authState.status === 'loading';
```

**Re-renders:** 10 components × EVERY state change = 100+ re-renders

**✅ Specific Selectors:**

```typescript
// Each component subscribes to specific fields
const user = useUser();
const loading = useAuthLoading();
```

**Re-renders:** Only components using 'user' when user changes = 10 re-renders

**Performance Improvement:** ~90% reduction in unnecessary re-renders

---

**Document Version:** 1.0.0  
**Last Updated:** December 2025  
**Maintained By:** Development Team
