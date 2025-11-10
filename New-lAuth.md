# Authentication System - Complete Architecture & Flow Analysis

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Complete Flow Diagrams](#complete-flow-diagrams)
4. [Data Structures & Schemas](#data-structures--schemas)
5. [Validation & Sanitization Flow](#validation--sanitization-flow)
6. [Error Handling System](#error-handling-system)
7. [Loading States & UI Management](#loading-states--ui-management)
8. [File Structure & Dependencies](#file-structure--dependencies)
9. [Issues & Potential Pitfalls](#issues--potential-pitfalls)
10. [Simple Explanation](#simple-explanation)

---

## Executive Summary

The Eye-Doo authentication system follows a **Ports & Adapters (Hexagonal) Architecture** with strict separation of concerns:

- **Presentation Layer**: React Native screens and components
- **Application Layer**: Services (business logic, validation, rate limiting)
- **Domain Layer**: Schemas, types, and business rules
- **Infrastructure Layer**: Firebase Auth, Firestore repositories

**Key Features:**

- ✅ Result pattern for error handling (no exceptions)
- ✅ Rate limiting on all auth operations
- ✅ Multi-layer validation (client-side Zod + service-level)
- ✅ Sanitization at repository level
- ✅ Centralized error mapping
- ✅ Zustand store for global auth state
- ✅ Firebase Auth state synchronization

---

## Architecture Overview

```mermaid
graph TB
    subgraph "Presentation Layer"
        A[Auth Screens] --> B[AuthenticationForm]
        B --> C[FormRenderer]
        C --> D[useUnifiedForm Hook]
    end

    subgraph "Application Layer"
        E[AuthService] --> F[Rate Limiter]
        E --> G[Validation Helpers]
        E --> H[IAuthRepository Port]
    end

    subgraph "Domain Layer"
        I[Auth Schemas] --> J[Zod Validation]
        K[BaseUser Schema] --> L[User Types]
    end

    subgraph "Infrastructure Layer"
        M[FirestoreAuthRepository] --> N[Firebase Auth]
        M --> O[BaseUserRepository]
        O --> P[Firestore]
    end

    subgraph "State Management"
        Q[useAuthStore] --> R[Zustand Store]
        S[AuthInitializer] --> Q
        S --> T[onAuthStateChanged]
    end

    A --> E
    D --> I
    E --> I
    H --> M
    Q --> E
    T --> N
```

---

## Complete Flow Diagrams

### Sign Up Flow

```mermaid
sequenceDiagram
    participant User
    participant Screen as SignUpScreen
    participant Form as AuthenticationForm
    participant Hook as useUnifiedForm
    participant Service as AuthService
    participant RateLimit as RateLimiter
    participant Validator as ValidationHelper
    participant Repo as FirestoreAuthRepository
    participant Firebase as Firebase Auth
    participant BaseUserRepo as BaseUserRepository
    participant Store as useAuthStore
    participant Router as Expo Router

    User->>Screen: Enter credentials & submit
    Screen->>Screen: setLoading(true)
    Screen->>Form: onSubmit(data)
    Form->>Hook: form.handleSubmit()
    Hook->>Hook: Zod validation (client-side)
    alt Validation fails
        Hook-->>Form: Show field errors
        Form-->>User: Display errors
    else Validation passes
        Hook->>Screen: handleSignUp(data)
        Screen->>Service: auth.signUp(payload)

        Service->>RateLimit: Check signUpRateLimiter
        alt Rate limited
            RateLimit-->>Service: Blocked
            Service-->>Screen: Error (AUTH_TOO_MANY_REQUESTS)
            Screen-->>User: Show rate limit error
        else Not rate limited
            Service->>Validator: validateWithSchema(signUpInputSchema)
            alt Validation fails
                Validator-->>Service: ValidationError
                Service-->>Screen: Error
                Screen-->>User: Show validation error
            else Validation passes
                Service->>Repo: signUp(validatedPayload)

                Repo->>Repo: sanitizeEmail(email)
                alt Email invalid
                    Repo-->>Service: Error (AUTH_INVALID_CREDENTIALS)
                    Service-->>Screen: Error
                    Screen-->>User: Show error
                else Email valid
                    Repo->>Firebase: createUserWithEmailAndPassword()
                    alt Firebase error
                        Firebase-->>Repo: AuthError
                        Repo->>Repo: ErrorMapper.fromFirebaseAuth()
                        Repo-->>Service: AuthError
                        Service-->>Screen: Error
                        Screen-->>User: Show error
                    else Firebase success
                        Firebase-->>Repo: UserCredential
                        Repo->>Firebase: sendEmailVerification() [async, non-blocking]
                        Repo->>BaseUserRepo: create(userId, baseUserData)
                        alt User doc creation fails
                            BaseUserRepo-->>Repo: Error
                            Repo->>Repo: Log warning (Cloud Function will cleanup)
                            Repo-->>Service: Error
                            Service-->>Screen: Error
                            Screen-->>User: Show error
                        else User doc created
                            BaseUserRepo-->>Repo: BaseUser
                            Repo-->>Service: BaseUser
                            Service->>RateLimit: Reset rate limiter
                            Service-->>Screen: Success (BaseUser)
                            Screen->>Store: setAuthUser(user)
                            Screen->>Screen: setLoading(false)
                            Screen->>Router: router.replace('/(app)/(home)')
                            Router-->>User: Navigate to app
                        end
                    end
                end
            end
        end
    end
```

### Sign In Flow

```mermaid
sequenceDiagram
    participant User
    participant Screen as SignInScreen
    participant Form as AuthenticationForm
    participant Service as AuthService
    participant RateLimit as RateLimiter
    participant Repo as FirestoreAuthRepository
    participant Firebase as Firebase Auth
    participant BaseUserRepo as BaseUserRepository
    participant Store as useAuthStore
    participant Router as Expo Router

    User->>Screen: Enter email & password
    Screen->>Form: Submit
    Form->>Screen: handleSignIn(data)
    Screen->>Screen: setLoading(true)
    Screen->>Service: auth.signIn(payload)

    Service->>RateLimit: Check signInRateLimiter
    alt Rate limited
        RateLimit-->>Service: Blocked
        Service-->>Screen: Error (AUTH_TOO_MANY_REQUESTS)
        Screen-->>User: Show rate limit message
    else Not rate limited
        Service->>Service: validateWithSchema(signInInputSchema)
        alt Validation fails
            Service-->>Screen: ValidationError
            Screen-->>User: Show validation error
        else Validation passes
            Service->>Repo: signIn(validatedPayload)

            Repo->>Repo: sanitizeEmail(email)
            Repo->>Firebase: signInWithEmailAndPassword()
            alt Auth fails
                Firebase-->>Repo: AuthError
                Repo->>Repo: ErrorMapper.fromFirebaseAuth()
                Repo-->>Service: AuthError
                Service-->>Screen: Error
                Screen-->>User: Show error
            else Auth succeeds
                Firebase-->>Repo: UserCredential
                Repo->>BaseUserRepo: getById(userId)
                alt User not found
                    BaseUserRepo-->>Repo: Error
                    Repo-->>Service: AuthError
                    Service-->>Screen: Error
                    Screen-->>User: Show error
                else User found
                    BaseUserRepo-->>Repo: BaseUser
                    Repo->>BaseUserRepo: updateLastLogin(userId) [async, non-blocking]
                    Repo-->>Service: BaseUser
                    Service->>RateLimit: Reset rate limiter
                    Service-->>Screen: Success (BaseUser)
                    Screen->>Store: setAuthUser(user)
                    Screen->>Screen: setLoading(false)
                    Screen->>Router: router.replace('/(app)/(home)')
                    Router-->>User: Navigate to app
                end
            end
        end
    end
```

### Authentication Initialization Flow

```mermaid
sequenceDiagram
    participant App as RootLayout
    participant Init as AuthInitializer
    participant Store as useAuthStore
    participant Service as AuthService
    participant Firebase as Firebase Auth
    participant Listener as onAuthStateChanged

    App->>Init: Mount AuthInitializer
    Init->>Store: initialize(authService)
    Store->>Store: set({ loading: true })
    Store->>Service: getProfile()
    Service->>Service: authRepository.getProfile()
    alt User authenticated
        Service-->>Store: BaseUser
        Store->>Store: set({ user, isAuthenticated: true, loading: false })
    else Not authenticated
        Service-->>Store: Error
        Store->>Store: set({ user: null, isAuthenticated: false, loading: false })
    end

    Init->>Firebase: onAuthStateChanged(listener)
    Firebase-->>Listener: Auth state change
    alt User signed in
        Listener->>Service: getProfile()
        Service-->>Listener: BaseUser
        Listener->>Store: setUser(user)
    else User signed out
        Listener->>Store: setUser(null)
    else Auth error
        Listener->>Listener: ErrorMapper.createGenericError()
        Listener->>Listener: handleError()
        Listener->>Store: setUser(null)
    end

    Init->>Init: Return cleanup function
    Note over Init: Cleanup on unmount
```

### Password Reset Flow

```mermaid
sequenceDiagram
    participant User
    participant Screen as ResetPasswordScreen
    participant Service as AuthService
    participant RateLimit as RateLimiter
    participant Repo as FirestoreAuthRepository
    participant Firebase as Firebase Auth
    participant Email as Email Service
    participant Router as Expo Router

    User->>Screen: Enter email
    Screen->>Service: auth.passwordReset(payload)

    Service->>RateLimit: Check passwordResetRateLimiter
    alt Rate limited
        RateLimit-->>Service: Blocked
        Service-->>Screen: Error
    else Not rate limited
        Service->>Service: validateWithSchema(passwordResetInputSchema)
        Service->>Repo: passwordReset(validatedPayload)
        Repo->>Repo: sanitizeEmail(email)
        Repo->>Firebase: sendPasswordResetEmail()
        alt Success
            Firebase-->>Repo: Success
            Repo-->>Service: Success
            Service-->>Screen: Success
            Screen->>Router: router.back()
        else Error
            Firebase-->>Repo: AuthError
            Repo->>Repo: ErrorMapper.fromFirebaseAuth()
            Repo-->>Service: AuthError
            Service-->>Screen: Error
            Screen-->>User: Show error
        end
    end
```

---

## Data Structures & Schemas

### Input Schemas

```mermaid
graph LR
    A[SignUpInput] --> B[email: string]
    A --> C[password: string]
    A --> D[confirmPassword: string]
    A --> E[displayName: string]
    A --> F[subscriptionPlan: SubscriptionPlan]
    A --> G[acceptTerms: boolean]
    A --> H[acceptPrivacy: boolean]
    A --> I[acceptMarketing?: boolean]

    J[SignInInput] --> K[email: string]
    J --> L[password: string]
    J --> M[rememberMe?: boolean]

    N[PasswordResetInput] --> O[email: string]

    P[PasswordResetConfirm] --> Q[token: string]
    P --> R[password: string]
    P --> S[confirmPassword: string]
```

### BaseUser Schema

```mermaid
graph TB
    A[BaseUser] --> B[id: string]
    A --> C[email: string]
    A --> D[displayName: string]
    A --> E[phone: string]
    A --> F[role: UserRole]
    A --> G[isEmailVerified: boolean]
    A --> H[isActive: boolean]
    A --> I[isBanned: boolean]
    A --> J[hasCustomizations: boolean]
    A --> K[lastLoginAt: Date]
    A --> L[deletedAt: Date]
    A --> M[createdAt: Date]
    A --> N[updatedAt: Date]
```

### Validation Flow

```mermaid
graph TB
    A[User Input] --> B[Client-Side Validation]
    B --> C[Zod Schema Validation]
    C --> D{Valid?}
    D -->|No| E[Show Field Errors]
    D -->|Yes| F[Submit to Service]
    F --> G[Service Validation]
    G --> H[validateWithSchema]
    H --> I{Valid?}
    I -->|No| J[Return ValidationError]
    I -->|Yes| K[Repository Sanitization]
    K --> L[sanitizeEmail]
    K --> M[sanitizeString]
    L --> N[Firebase Auth]
    M --> N
```

---

## Validation & Sanitization Flow

### Multi-Layer Validation

```mermaid
graph TB
    subgraph "Layer 1: Client-Side (Form)"
        A[User Input] --> B[react-hook-form]
        B --> C[Zod Schema]
        C --> D{Valid?}
        D -->|No| E[Field Errors]
        D -->|Yes| F[Form Submit]
    end

    subgraph "Layer 2: Service Layer"
        F --> G[AuthService]
        G --> H[validateWithSchema]
        H --> I[Zod Schema]
        I --> J{Valid?}
        J -->|No| K[ValidationError]
        J -->|Yes| L[Rate Limiter Check]
    end

    subgraph "Layer 3: Repository Layer"
        L --> M[FirestoreAuthRepository]
        M --> N[sanitizeEmail]
        M --> O[sanitizeString]
        N --> P{Valid?}
        O --> P
        P -->|No| Q[Error: Invalid Format]
        P -->|Yes| R[Firebase Auth]
    end

    E --> A
    K --> F
    Q --> L
```

### Sanitization Functions

```typescript
// Email Sanitization
sanitizeEmail(email: string | null | undefined): string | null
  - Trims whitespace
  - Converts to lowercase
  - Validates basic email format (regex)
  - Returns null if invalid

// String Sanitization
sanitizeString(value: string | null | undefined): string | undefined
  - Trims whitespace
  - Returns undefined if empty
```

---

## Error Handling System

### Error Flow Architecture

```mermaid
graph TB
    A[Error Occurs] --> B{Error Type}

    B -->|Firebase Auth| C[ErrorMapper.fromFirebaseAuth]
    B -->|Firestore| D[ErrorMapper.fromFirestore]
    B -->|Zod Validation| E[ErrorMapper.fromZod]
    B -->|Generic| F[ErrorMapper.createGenericError]

    C --> G[AuthError]
    D --> H[FirestoreError]
    E --> I[ValidationError]
    F --> J[AppError]

    G --> K[Result&lt;T, AppError&gt;]
    H --> K
    I --> K
    J --> K

    K --> L[Service Layer]
    L --> M[Screen Component]
    M --> N[useErrorHandler]
    N --> O[AppErrorHandler.handle]
    O --> P[Toast/Modal Display]
```

### Error Types

```mermaid
graph LR
    A[AppError Base] --> B[AuthError]
    A --> C[FirestoreError]
    A --> D[NetworkError]
    A --> E[ValidationError]
    A --> F[AggregatedError]

    B --> G[AUTH_INVALID_CREDENTIALS]
    B --> H[AUTH_USER_NOT_FOUND]
    B --> I[AUTH_EMAIL_IN_USE]
    B --> J[AUTH_TOO_MANY_REQUESTS]
    B --> K[AUTH_SESSION_EXPIRED]

    C --> L[DB_NOT_FOUND]
    C --> M[DB_PERMISSION_DENIED]
    C --> N[DB_NETWORK_ERROR]

    E --> O[Field-specific errors]
    E --> P[Schema validation errors]
```

### Error Context Building

```mermaid
graph TB
    A[ErrorContextBuilder] --> B[fromService]
    A --> C[fromRepository]
    A --> D[fromHook]
    A --> E[fromComponent]

    B --> F[Service Name]
    B --> G[Method Name]
    B --> H[userId?]
    B --> I[projectId?]
    B --> J[metadata?]

    F --> K[Context String]
    G --> K
    H --> K
    I --> K
    J --> K

    K --> L[Error Object]
```

---

## Loading States & UI Management

### Loading State Flow

```mermaid
stateDiagram-v2
    [*] --> Idle: Initial
    Idle --> Loading: User submits form
    Loading --> Success: Operation succeeds
    Loading --> Error: Operation fails
    Success --> [*]: Navigate away
    Error --> Idle: User retries
    Error --> [*]: User cancels
```

### Loading State Management

```mermaid
graph TB
    subgraph "Screen Level"
        A[SignInScreen] --> B[useState loading]
        B --> C[setLoading true/false]
    end

    subgraph "Store Level"
        D[useAuthStore] --> E[loading: boolean]
        E --> F[initialize action]
        F --> G[set loading: true]
        G --> H[getProfile]
        H --> I[set loading: false]
    end

    subgraph "Form Level"
        J[AuthenticationForm] --> K[loading prop]
        K --> L[Disable submit button]
        K --> M[Show loading indicator]
    end

    A --> D
    A --> J
```

### UI Component Hierarchy

```mermaid
graph TB
    A[RootLayout] --> B[ServiceContext.Provider]
    B --> C[PaperProvider]
    C --> D[AuthInitializer]
    D --> E[Stack Navigator]
    E --> F[IndexScreen]
    F --> G{isAuthenticated?}
    G -->|Yes| H[OnboardingScreen]
    G -->|No| I[SignInScreen]
    I --> J[ScreenWrapper]
    J --> K[AuthenticationForm]
    K --> L[FormRenderer]
    L --> M[Form Fields]
```

---

## File Structure & Dependencies

### Complete File Map

```mermaid
graph TB
    subgraph "Screens"
        A[app/index.tsx]
        B[app/_layout.tsx]
        C[app/(auth)/signIn.tsx]
        D[app/(auth)/signUp.tsx]
        E[app/(auth)/resetPassword.tsx]
        F[app/(auth)/resetPasswordConfirm.tsx]
    end

    subgraph "Components"
        G[components/auth/AuthInitializer.tsx]
        H[components/auth/AuthenticationForm.tsx]
        I[components/forms/core/FormRenderer.tsx]
        J[components/common/screen/ScreenWrapper.tsx]
    end

    subgraph "Services"
        K[services/auth-service.ts]
        L[services/ServiceFactory.ts]
        M[services/error-handler-service.ts]
    end

    subgraph "Repositories"
        N[repositories/i-auth-repository.ts]
        O[repositories/firestore/firestore-auth-repository.ts]
        P[repositories/firestore/firestore-base-user-repository.ts]
    end

    subgraph "Domain"
        Q[domain/user/auth.schema.ts]
        R[domain/user/user.schema.ts]
        S[domain/common/errors.ts]
        T[domain/common/result.ts]
    end

    subgraph "Hooks"
        U[hooks/use-unified-form.ts]
        V[hooks/use-error-handler.ts]
        W[hooks/use-app-styles.ts]
    end

    subgraph "Stores"
        X[stores/use-auth-store.ts]
    end

    subgraph "Utils"
        Y[utils/validation-helpers.ts]
        Z[utils/sanitization-helpers.ts]
        AA[utils/error-mapper.ts]
        AB[utils/rate-limiter.ts]
        AC[utils/error-context-builder.ts]
    end

    subgraph "Constants"
        AD[constants/theme.ts]
        AE[constants/typography.ts]
        AF[constants/styles/auth.styles.ts]
        AG[constants/error-code-registry.ts]
    end

    C --> H
    D --> H
    E --> H
    F --> H
    H --> U
    H --> I
    C --> K
    D --> K
    E --> K
    F --> K
    K --> N
    N --> O
    O --> P
    K --> Q
    O --> Q
    G --> X
    G --> K
    B --> G
    A --> X
```

### Dependency Graph

```mermaid
graph LR
    A[Screens] --> B[Components]
    B --> C[Hooks]
    C --> D[Services]
    D --> E[Repositories]
    E --> F[Firebase]

    A --> G[Stores]
    G --> D

    C --> H[Utils]
    D --> H
    E --> H

    B --> I[Constants]
    C --> I

    D --> J[Domain]
    E --> J
```

---

## Issues & Potential Pitfalls

### 🔴 Critical Issues

1. **Missing ScreenWrapper Component**
   - **Location**: Referenced in screens but file not found
   - **Impact**: Screens may fail to render
   - **Fix**: Create `src/components/common/screen/ScreenWrapper.tsx` or update imports

2. **Auth State Race Condition**
   - **Issue**: `AuthInitializer` calls `initialize()` and sets up `onAuthStateChanged` simultaneously
   - **Impact**: User might be fetched twice, causing race conditions
   - **Fix**: Ensure `initialize()` completes before setting up listener, or debounce

3. **Rate Limiter Memory Leak**
   - **Issue**: Rate limiter uses in-memory Map, never cleans up old entries
   - **Impact**: Memory usage grows over time
   - **Fix**: Implement periodic cleanup of expired entries

4. **Error in resetPasswordConfirm**
   - **Issue**: Line 85 uses `useUIStore.getState()` inside component (should use hook)
   - **Impact**: May cause React hooks violations
   - **Fix**: Use `const showToast = useUIStore(state => state.showToast)`

### 🟡 Potential Issues

1. **No Optimistic Updates for Auth**
   - **Current**: All auth operations wait for server response
   - **Impact**: Slower perceived performance
   - **Note**: This is intentional for auth (security > speed)

2. **Email Verification Non-Blocking**
   - **Issue**: `sendEmailVerification()` is called but errors are silently caught
   - **Impact**: User might not know if verification email failed
   - **Fix**: Log error but don't fail signup, show warning toast

3. **Password Reset Token Handling**
   - **Issue**: Token comes from URL params, no validation of format
   - **Impact**: Invalid tokens might cause confusing errors
   - **Fix**: Validate token format before submission

4. **Remember Me Not Implemented**
   - **Issue**: `rememberMe` field in SignInInput but not used
   - **Impact**: Feature exists in schema but doesn't work
   - **Fix**: Implement Firebase Auth persistence settings

5. **Cloud Function Dependency**
   - **Issue**: Signup relies on Cloud Function to cleanup orphaned auth accounts
   - **Impact**: If Cloud Function fails, orphaned accounts remain
   - **Fix**: Add client-side retry or manual cleanup endpoint

### 🟢 Minor Issues

1. **Type Safety in Form Handler**
   - **Issue**: `handleReset` uses type assertion `as Omit<PasswordResetConfirm, 'token'>`
   - **Impact**: Runtime errors possible if form data doesn't match
   - **Fix**: Add runtime type guard

2. **Error Context Inconsistency**
   - **Issue**: Some places use `ErrorContextBuilder.fromHook`, others use `fromComponent`
   - **Impact**: Error tracking less accurate
   - **Fix**: Standardize context building

3. **Loading State Duplication**
   - **Issue**: Both screen-level `useState` and store-level `loading` state
   - **Impact**: Potential state sync issues
   - **Fix**: Use single source of truth (prefer store)

4. **Missing Error Recovery**
   - **Issue**: No retry mechanism for transient errors
   - **Impact**: Users must manually retry
   - **Fix**: Add retry button/automatic retry for retryable errors

---

## Simple Explanation

### How Authentication Works (In Simple Terms)

Think of the authentication system like a **secure building with multiple checkpoints**:

1. **The Front Door (Form)**:
   - User enters email and password
   - Form checks if fields are filled correctly (client-side validation)
   - If something's wrong, shows error immediately

2. **The Security Desk (Service Layer)**:
   - Checks if user has tried too many times (rate limiting)
   - Validates the data format is correct
   - If everything looks good, sends to the repository

3. **The ID Check (Repository Layer)**:
   - Cleans up the email (removes spaces, makes lowercase)
   - Sends credentials to Firebase (the actual security system)
   - If Firebase says "OK", creates a user profile in the database

4. **The Welcome Desk (Store)**:
   - Once authenticated, saves user info in app memory (Zustand store)
   - This lets the app know "this person is logged in"

5. **The Watchtower (AuthInitializer)**:
   - Constantly watches Firebase to see if user signs out
   - If user signs out elsewhere, automatically updates the app
   - If user signs in elsewhere, automatically updates the app

### Data Flow (Like a Package Delivery)

```
User Input → Form Validation → Service Validation → Repository Sanitization → Firebase Auth → Database → Store → UI Update
```

Each step checks the "package" (user data) and either:

- ✅ **Passes it along** if everything is correct
- ❌ **Returns it with an error** if something's wrong

### Error Handling (Like a Help Desk)

When something goes wrong:

1. **Error is caught** at the layer where it happened
2. **Error is wrapped** in a standard format (AppError)
3. **Error is passed up** through the layers
4. **Error is displayed** to the user in a friendly way (toast/modal)
5. **Error is logged** for developers to debug

### Security Features

- **Rate Limiting**: Prevents brute force attacks (too many login attempts)
- **Input Sanitization**: Removes dangerous characters and formats data correctly
- **Multi-Layer Validation**: Checks data at multiple points
- **Error Context**: Tracks where errors happened for debugging
- **No Exceptions**: Uses Result pattern (always returns success or error, never throws)

### What Happens When You Sign Up

1. Enter your info in the form
2. Form validates (passwords match, email format, etc.)
3. Service checks rate limits (not too many signups)
4. Service validates data again
5. Repository sanitizes email (cleans it up)
6. Firebase creates your account
7. Database creates your user profile
8. Store saves your info
9. App navigates to the main screen

### What Happens When You Sign In

1. Enter email and password
2. Form validates
3. Service checks rate limits
4. Service validates
5. Repository sanitizes email
6. Firebase checks your credentials
7. If correct, fetches your user profile
8. Updates last login time
9. Store saves your info
10. App navigates to main screen

### Potential Problems

1. **Race Conditions**: If two things happen at the same time, might cause conflicts
2. **Memory Leaks**: Rate limiter never cleans up old data (grows over time)
3. **Missing Components**: Some files referenced but don't exist
4. **Type Safety**: Some places use type assertions that could fail at runtime

### Recommendations

1. ✅ **Fix missing ScreenWrapper** component
2. ✅ **Add cleanup** to rate limiter
3. ✅ **Fix useUIStore** usage in resetPasswordConfirm
4. ✅ **Implement rememberMe** feature or remove from schema
5. ✅ **Add error recovery** mechanisms
6. ✅ **Standardize error context** building
7. ✅ **Add retry logic** for transient errors

---

## Summary

The authentication system is **well-architected** with clear separation of concerns, comprehensive error handling, and security features. However, there are some **implementation issues** that need attention:

- Missing components
- Potential race conditions
- Memory leaks in rate limiter
- Inconsistent error context usage
- Unused features (rememberMe)

The system follows **best practices** for:

- ✅ Ports & Adapters architecture
- ✅ Result pattern (no exceptions)
- ✅ Multi-layer validation
- ✅ Centralized error handling
- ✅ Type safety with TypeScript and Zod

With the fixes mentioned above, this would be a **production-ready** authentication system.
