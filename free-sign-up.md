# Free Account Sign-Up Flow Documentation

## Overview

This document maps out the complete process of a new user signing up for a **free account** (FREE plan) in the Eye-Doo application. It covers all screens, interactions, data flow, state management, navigation, and triggers involved in the sign-up process.

---

## Table of Contents

1. [High-Level Flow](#high-level-flow)
2. [Screen Navigation Flow](#screen-navigation-flow)
3. [Data Flow Architecture](#data-flow-architecture)
4. [Component Interaction Flow](#component-interaction-flow)
5. [State Management Flow](#state-management-flow)
6. [Free Plan Routing Logic](#free-plan-routing-logic)
7. [Error Handling Flow](#error-handling-flow)
8. [Analytics Tracking Flow](#analytics-tracking-flow)
9. [Detailed Component Breakdown](#detailed-component-breakdown)

---

## High-Level Flow

```mermaid
flowchart TD
    A[User Opens App] --> B{Authenticated?}
    B -->|No| C[Sign Up Screen]
    B -->|Yes| D[Flow Router]
    
    C --> E[Fill Sign Up Form]
    E --> F[Select FREE Plan]
    F --> G[Accept Terms & Privacy]
    G --> H[Submit Form]
    
    H --> I[Rate Limit Check]
    I -->|Blocked| J[Show Error: Too Many Attempts]
    I -->|Allowed| K[Validate Input]
    
    K -->|Invalid| L[Show Field Errors]
    K -->|Valid| M[Create Firebase Auth User]
    
    M -->|Success| N[Create Base User Document]
    M -->|Error| O[Show Auth Error]
    
    N -->|Success| P[Send Verification Email]
    N -->|Error| Q[Cleanup Auth User]
    
    P --> R[Store User in Auth Store]
    R --> S[Show Success Toast]
    S --> T[Navigate to Sign In]
    
    T --> U[User Signs In]
    U --> V[Flow Router Checks Status]
    
    V --> W{Email Verified?}
    W -->|No| X[Verify Email Screen]
    W -->|Yes| Y{Subscription Plan?}
    
    Y -->|FREE| Z[Skip Onboarding]
    Y -->|PRO/STUDIO| AA[Payment/Setup Flow]
    
    Z --> BB[Mark Onboarding Complete]
    BB --> CC[Projects Screen]
    
    X --> DD[User Verifies Email]
    DD --> V
    
    style C fill:#e1f5ff
    style F fill:#fff4e1
    style Z fill:#e8f5e9
    style CC fill:#f3e5f5
```

---

## Screen Navigation Flow

```mermaid
stateDiagram-v2
    [*] --> SignUpScreen: User opens app (not authenticated)
    
    SignUpScreen --> SignUpScreen: Fill form fields
    SignUpScreen --> SignUpScreen: View plan details modal
    SignUpScreen --> SignUpScreen: Select FREE plan
    SignUpScreen --> SignInScreen: Click "Already have account?"
    
    SignUpScreen --> SignInScreen: Sign up successful
    SignUpScreen --> SignUpScreen: Sign up error (show error)
    
    SignInScreen --> FlowRouter: Sign in successful
    
    FlowRouter --> VerifyEmailScreen: Email not verified
    FlowRouter --> ProjectsScreen: FREE plan (skip everything)
    FlowRouter --> PaymentScreen: PRO/STUDIO + INACTIVE
    FlowRouter --> SetupScreen: PRO/STUDIO + ACTIVE + firstTimeSetup
    FlowRouter --> OnboardingScreen: PRO/STUDIO + showOnboarding
    
    VerifyEmailScreen --> FlowRouter: Email verified
    
    ProjectsScreen --> [*]
    
    note right of SignUpScreen
        Fields:
        - displayName
        - email
        - password
        - confirmPassword
        - subscriptionPlan (FREE)
        - acceptTerms
        - acceptPrivacy
        - acceptMarketing (optional)
    end note
    
    note right of FlowRouter
        FREE Plan Logic:
        - Check subscription.plan === FREE
        - Call userSetup.skipOnboarding()
        - Navigate directly to projects
        - No payment, setup, or onboarding
    end note
```

---

## Data Flow Architecture

```mermaid
sequenceDiagram
    participant User
    participant SignUpScreen
    participant AuthenticationForm
    participant useSignUp Hook
    participant AuthService
    participant AuthRepository
    participant FirebaseAuth
    participant BaseUserRepository
    participant Firestore
    participant CloudFunction
    participant UserSubscriptionRepository
    participant AuthStore
    participant UIStore
    participant AnalyticsService
    
    User->>SignUpScreen: Opens app
    SignUpScreen->>AuthenticationForm: Renders form
    AuthenticationForm->>useUnifiedForm: Initializes form with schema
    
    User->>AuthenticationForm: Fills form (selects FREE plan)
    AuthenticationForm->>useUnifiedForm: Updates form state
    useUnifiedForm->>AuthenticationForm: Validates on change
    
    User->>AuthenticationForm: Submits form
    AuthenticationForm->>SignUpScreen: handleSignUp(data)
    SignUpScreen->>useSignUp: signUp(payload)
    
    useSignUp->>useSignUp: setState(loading())
    useSignUp->>AuthService: signUp(payload)
    
    AuthService->>AuthService: Check rate limit
    AuthService->>AuthService: Validate with Zod schema
    
    alt Rate Limit Exceeded
        AuthService-->>useSignUp: err(TOO_MANY_REQUESTS)
        useSignUp-->>SignUpScreen: error state
        SignUpScreen-->>User: Show error toast
    else Validation Failed
        AuthService-->>useSignUp: err(VALIDATION_FAILED)
        useSignUp-->>SignUpScreen: error state
        SignUpScreen-->>User: Show field errors
    else Valid
        AuthService->>AuthRepository: signUp(validatedPayload)
        
        AuthRepository->>AuthRepository: Sanitize email
        AuthRepository->>FirebaseAuth: createUserWithEmailAndPassword()
        
        FirebaseAuth-->>AuthRepository: UserCredential
        
        AuthRepository->>FirebaseAuth: sendEmailVerification()
        FirebaseAuth-->>AuthRepository: Email sent status
        
        AuthRepository->>BaseUserRepository: create(userId, baseUserData)
        BaseUserRepository->>Firestore: setDoc(users/{userId}, data)
        Firestore-->>BaseUserRepository: Success
        
        BaseUserRepository-->>AuthRepository: ok(BaseUser)
        AuthRepository-->>AuthService: ok(BaseUser)
        
        Note over FirebaseAuth,CloudFunction: Cloud Function Triggered
        FirebaseAuth->>CloudFunction: onUserCreated trigger
        CloudFunction->>UserSubscriptionRepository: Create subscription (plan: FREE)
        CloudFunction->>Firestore: Create subscription document
        CloudFunction->>Firestore: Create other subcollections
        
        AuthService->>AuthService: Reset rate limiter
        AuthService->>AuthService: Check verification email status
        AuthService-->>useSignUp: ok(BaseUser)
        
        useSignUp->>useSignUp: setState(success(user))
        useSignUp->>SignUpScreen: onSuccess(user)
        
        SignUpScreen->>AuthStore: setAuthUser(user)
        SignUpScreen->>UIStore: showToast(success)
        SignUpScreen->>AnalyticsService: trackSignUpCompleted()
        SignUpScreen->>SignUpScreen: router.replace('/(auth)/signIn')
    end
```

---

## Component Interaction Flow

```mermaid
graph TB
    subgraph "Sign Up Screen Component"
        A[SignUpScreen] --> B[Screen Wrapper]
        A --> C[AuthenticationForm]
        A --> D[PlanDetailsModal]
        A --> E[StandardAppButton - View Plans]
        A --> F[StandardAppButton - Sign In Link]
    end
    
    subgraph "Authentication Form Component"
        C --> G[FormRenderer]
        C --> H[StandardAppButton - Submit]
        G --> I[FormField Components]
    end
    
    subgraph "Form Fields"
        I --> J[TextInput - displayName]
        I --> K[TextInput - email]
        I --> L[TextInput - password]
        I --> M[TextInput - confirmPassword]
        I --> N[SegmentedControl - subscriptionPlan]
        I --> O[Checkbox - acceptTerms]
        I --> P[Checkbox - acceptPrivacy]
        I --> Q[Checkbox - acceptMarketing]
    end
    
    subgraph "Hooks & State"
        A --> R[useSignUp Hook]
        A --> S[useAuthStore]
        A --> T[useUIStore]
        A --> U[useRouter]
        C --> V[useUnifiedForm]
        V --> W[react-hook-form]
        V --> X[zodResolver]
    end
    
    subgraph "Services"
        R --> Y[AuthService]
        Y --> Z[AuthRepository]
        Z --> AA[FirebaseAuth]
        Z --> AB[BaseUserRepository]
    end
    
    J --> V
    K --> V
    L --> V
    M --> V
    N --> V
    O --> V
    P --> V
    Q --> V
    
    V --> W
    W --> X
    X --> CC[signUpInputSchema]
    
    H --> V
    V --> R
    R --> Y
    
    style A fill:#e1f5ff
    style C fill:#fff4e1
    style R fill:#e8f5e9
    style Y fill:#f3e5f5
```

---

## State Management Flow

```mermaid
stateDiagram-v2
    [*] --> Idle: Initial render
    
    Idle --> Loading: User submits form
    
    Loading --> Success: Sign up successful
    Loading --> Error: Sign up failed
    
    Success --> Idle: Clear success state
    Error --> Idle: User clears error
    
    note right of Idle
        State: idle()
        Data: null
        Loading: false
        Error: null
    end note
    
    note right of Loading
        State: loading()
        Data: null
        Loading: true
        Error: null
    end note
    
    note right of Success
        State: success(user)
        Data: BaseUser
        Loading: false
        Error: null
        Actions:
        - setAuthUser(user)
        - showToast(success)
        - navigate to signIn
    end note
    
    note right of Error
        State: error(error)
        Data: null
        Loading: false
        Error: AppError
        Actions:
        - handleError(error)
        - show error in Screen
    end note
```

### State Properties

#### useSignUp Hook State

```typescript
interface UseSignUpResult {
  loading: boolean; // true when signUp is in progress
  error: AppError | null; // error object if signUp failed
  state: LoadingState<BaseUser | null>; // full state object
  signUp: (payload: SignUpInput) => Promise<boolean>;
  clearError: () => void; // clears error state
}
```

#### SignUpScreen Component State

```typescript
// Local state
const [showPlanModal, setShowPlanModal] = useState(false);
const formRef = useRef<ReturnType<typeof useUnifiedForm<SignUpInput>> | null>(null);

// From hooks
const { loading, error, clearError, signUp } = useSignUp({...});
const setAuthUser = useAuthStore(state => state.setUser);
const showToast = useUIStore(state => state.showToast);
```

#### Form State (react-hook-form)

```typescript
interface FormState {
  values: SignUpInput;
  errors: FieldErrors<SignUpInput>;
  touchedFields: Partial<Record<keyof SignUpInput, boolean>>;
  isValid: boolean;
  isDirty: boolean;
  isSubmitting: boolean;
}
```

---

## Free Plan Routing Logic

```mermaid
sequenceDiagram
    participant User
    participant SignInScreen
    participant FlowRouter
    participant UserSubscriptionService
    participant UserSetupService
    participant Firestore
    participant ProjectsScreen
    
    User->>SignInScreen: Signs in
    SignInScreen->>FlowRouter: Navigate after sign in
    
    FlowRouter->>FlowRouter: Check email verification
    FlowRouter->>FlowRouter: user.isEmailVerified = true
    
    FlowRouter->>UserSubscriptionService: getByUserId(userId)
    UserSubscriptionService->>Firestore: Query subscription
    Firestore-->>UserSubscriptionService: subscription (plan: FREE)
    UserSubscriptionService-->>FlowRouter: ok(subscription)
    
    FlowRouter->>FlowRouter: Check subscription.plan === FREE
    
    FlowRouter->>UserSetupService: getByUserId(userId)
    UserSetupService->>Firestore: Query setup
    Firestore-->>UserSetupService: setup document
    UserSetupService-->>FlowRouter: ok(setup)
    
    FlowRouter->>FlowRouter: Check setup.showOnboarding
    
    alt showOnboarding === true
        FlowRouter->>UserSetupService: skipOnboarding(userId)
        UserSetupService->>Firestore: Update setup document
        Note over UserSetupService,Firestore: Set showOnboarding: false<br/>Set firstTimeSetup: false
        Firestore-->>UserSetupService: Success
        UserSetupService-->>FlowRouter: ok()
    end
    
    FlowRouter->>ProjectsScreen: router.replace('/(projects)')
    
    Note over FlowRouter,ProjectsScreen: FREE users skip:
    - Payment flow
    - Setup flow
    - Onboarding flow
    - Direct to projects
```

### Flow Router Decision Tree

```mermaid
flowchart TD
    A[Flow Router Starts] --> B{User Authenticated?}
    B -->|No| C[Navigate to Sign In]
    B -->|Yes| D{Email Verified?}
    
    D -->|No| E[Navigate to Verify Email]
    D -->|Yes| F[Get Subscription]
    
    F --> G{Subscription Found?}
    G -->|No| H[Navigate to Projects]
    G -->|Yes| I{Plan Type?}
    
    I -->|FREE| J[Get Setup Status]
    I -->|PRO/STUDIO| K{Subscription Status?}
    
    J --> L{showOnboarding?}
    L -->|Yes| M[skipOnboarding]
    L -->|No| N[Skip]
    
    M --> O[Navigate to Projects]
    N --> O
    
    K -->|INACTIVE| P[Navigate to Payment]
    K -->|ACTIVE| Q{firstTimeSetup?}
    K -->|TRIALING| R{showOnboarding?}
    
    Q -->|Yes| S[Navigate to Setup]
    Q -->|No| T{showOnboarding?}
    
    R -->|Yes| U[Navigate to Trial Onboarding]
    R -->|No| O
    
    T -->|Yes| V[Navigate to Paid Onboarding]
    T -->|No| O
    
    style I fill:#fff4e1
    style J fill:#e8f5e9
    style O fill:#f3e5f5
```

---

## Error Handling Flow

```mermaid
flowchart TD
    A[Operation Starts] --> B{Operation Type}
    
    B -->|Sign Up| C[Rate Limit Check]
    B -->|Routing| D[Subscription Check]
    
    C -->|Blocked| E[Return AUTH_TOO_MANY_REQUESTS]
    C -->|Allowed| F[Validate Input]
    
    F -->|Invalid| G[Return VALIDATION_FAILED]
    F -->|Valid| H[Execute Operation]
    
    D -->|Not Found| I[Return DB_NOT_FOUND]
    D -->|Found| J[Continue Routing]
    
    H -->|Firebase Auth Error| K[Map to AppError]
    H -->|Firestore Error| L[Map to AppError]
    H -->|Network Error| M[Map to AppError]
    H -->|Success| N[Return Success]
    
    E --> O[Error Handler]
    G --> O
    I --> O
    K --> O
    L --> O
    M --> O
    
    O --> P[ErrorContextBuilder]
    P --> Q[ErrorMapper]
    Q --> R[AppErrorHandler]
    
    R --> S[Show Toast]
    R --> T[Log Error]
    R --> U[Track Analytics]
    
    N --> V[Success Handler]
    J --> V
    
    V --> W[Update State]
    V --> X[Show Success Toast]
    V --> Y[Navigate Next Screen]
    
    style E fill:#ffebee
    style G fill:#ffebee
    style I fill:#ffebee
    style K fill:#ffebee
    style L fill:#ffebee
    style M fill:#ffebee
    style N fill:#e8f5e9
    style J fill:#e8f5e9
```

### Error Types & Handling

| Error Type             | Code                        | User Message                                     | Action                          |
| ---------------------- | --------------------------- | ------------------------------------------------ | ------------------------------- |
| Rate Limit Exceeded    | `AUTH_TOO_MANY_REQUESTS`    | "Too many attempts. Try again in X minutes."     | Block further attempts          |
| Validation Failed      | `VALIDATION_FAILED`         | Field-specific error messages                    | Show field errors               |
| Email Already Exists   | `AUTH_EMAIL_ALREADY_IN_USE` | "This email is already registered."              | Suggest sign in                 |
| Weak Password          | `AUTH_WEAK_PASSWORD`        | "Password is too weak."                          | Show password requirements      |
| Network Error          | `NETWORK_ERROR`             | "Connection failed. Please check your internet." | Allow retry                     |
| Subscription Not Found | `DB_NOT_FOUND`              | "Subscription not found."                        | Navigate to projects (fallback) |

---

## Analytics Tracking Flow

```mermaid
sequenceDiagram
    participant User
    participant SignUpScreen
    participant AnalyticsService
    participant FirebaseAnalytics
    
    User->>SignUpScreen: Opens sign up screen
    SignUpScreen->>AnalyticsService: trackSignUpStarted(params)
    AnalyticsService->>FirebaseAnalytics: logEvent('sign_up_started')
    
    User->>SignUpScreen: Submits form (FREE plan)
    SignUpScreen->>SignUpScreen: Sign up successful
    SignUpScreen->>AnalyticsService: trackSignUpCompleted(userId, params)
    
    AnalyticsService->>AnalyticsService: Build base params
    AnalyticsService->>AnalyticsService: Add user-specific params
    AnalyticsService->>FirebaseAnalytics: logEvent('sign_up_completed')
    AnalyticsService->>FirebaseAnalytics: setUserProperty('subscription_plan', 'FREE')
    AnalyticsService->>FirebaseAnalytics: setUserProperty('registration_date', date)
    
    User->>FlowRouter: Signs in
    FlowRouter->>FlowRouter: Detects FREE plan
    FlowRouter->>AnalyticsService: trackEvent('free_user_activated')
    AnalyticsService->>FirebaseAnalytics: logEvent('free_user_activated')
```

### Analytics Events Tracked

| Event                | When                        | Parameters                                            |
| -------------------- | --------------------------- | ----------------------------------------------------- |
| `sign_up_started`    | User opens sign up screen   | `session_id`, `platform`, `app_version`               |
| `sign_up_completed`  | Sign up successful          | `user_id`, `method`, `user_type`, `subscription_plan` |
| `free_user_activated` | FREE user reaches projects  | `user_id`, `plan`, `skipped_onboarding`                |

---

## Detailed Component Breakdown

### 1. SignUpScreen Component

**File**: `src/app/(auth)/signUp.tsx`

**Props**: None (Screen component)

**State**:

```typescript
const [showPlanModal, setShowPlanModal] = useState(false);
const formRef = useRef<ReturnType<typeof useUnifiedForm<SignUpInput>> | null>(null);
```

**Hooks Used**:

- `useSignUp()` - Sign up operation
- `useAuthStore()` - Global auth state
- `useUIStore()` - Toast notifications
- `useRouter()` - Navigation
- `useAppStyles()` - Styling

**Key Functions**:

```typescript
handleSignUp(data: SignUpInput): Promise<boolean>
  - Calls signUp hook
  - Returns success/failure

handleFormReady(form): void
  - Stores form reference
  - Allows external form control

handlePlanSelect(plan: SubscriptionPlan): void
  - Updates form value for subscriptionPlan
  - Triggers validation
```

**Navigation**:

- Success: `router.replace('/(auth)/signIn')`
- Error: Stays on screen, shows error
- Link: `router.replace('/(auth)/signIn')` (already have account)

---

### 2. AuthenticationForm Component

**File**: `src/components/auth/AuthenticationForm.tsx`

**Props**:

```typescript
interface AuthenticationFormProps {
  mode: 'signUp' | 'signIn' | 'reset-password' | ...;
  onSubmit: (data: SignUpInput) => Promise<boolean>;
  loading?: boolean;
  onFormReady?: (form) => void;
}
```

**Internal State**:

- Managed by `useUnifiedForm` hook
- React Hook Form state
- Zod validation state

**Key Features**:

- Dynamic form rendering based on mode
- Real-time validation
- Field-level error display
- Submit button disabled when invalid/loading

---

### 3. useSignUp Hook

**File**: `src/hooks/use-sign-up.ts`

**Options**:

```typescript
interface UseSignUpOptions {
  onSuccess?: (user: BaseUser) => void;
  onError?: (error: AppError) => void;
}
```

**Returns**:

```typescript
interface UseSignUpResult {
  loading: boolean;
  error: AppError | null;
  state: LoadingState<BaseUser | null>;
  signUp: (payload: SignUpInput) => Promise<boolean>;
  clearError: () => void;
}
```

**Flow**:

1. `signUp()` called with payload
2. Set state to `loading()`
3. Call `AuthService.signUp()`
4. On success: `setState(success(user))`, call `onSuccess`
5. On error: `setState(error(error))`, call `onError`, handle error

---

### 4. AuthService

**File**: `src/services/auth-service.ts`

**Method**: `signUp(payload: SignUpInput): Promise<Result<BaseUser, AppError>>`

**Steps**:

1. **Rate Limiting**: Check `signUpRateLimiter.canAttempt()`
2. **Validation**: Validate with `signUpInputSchema`
3. **Repository Call**: Delegate to `authRepository.signUp()`
4. **Post-Processing**:
   - Reset rate limiter on success
   - Check verification email status
   - Show warning toast if email failed

---

### 5. AuthRepository

**File**: `src/repositories/firestore/firestore-auth-repository.ts`

**Method**: `signUp(payload: SignUpInput): Promise<Result<BaseUser, AppError>>`

**Steps**:

1. **Sanitize**: Sanitize email with `sanitizeEmail()`
2. **Create Auth User**: `createUserWithEmailAndPassword()`
3. **Send Verification**: `sendEmailVerification()` (non-blocking)
4. **Create Base User**: Call `baseUserRepository.create()`
5. **Return**: Return `BaseUser` or error

**Error Handling**:

- If base user creation fails, auth user cleanup handled by Cloud Function
- Verification email failure doesn't fail sign up

---

### 6. FlowRouter Component

**File**: `src/app/(flow-router)/index.tsx`

**State**:

```typescript
const [routing, setRouting] = useState(true);
```

**Flow**:

1. **Check Authentication**: If no user, navigate to sign in
2. **Check Email Verification**: If not verified, navigate to verify email
3. **Get Subscription**: Fetch user subscription
4. **Get Setup**: Fetch user setup status
5. **Route Based on Plan**:
   - **FREE Plan**: Skip onboarding, navigate to projects
   - **Paid Plans**: Continue with payment/setup/onboarding flow

**FREE Plan Logic**:

```typescript
if (subscription.plan === SubscriptionPlan.FREE) {
  if (setup.showOnboarding) {
    // Skip onboarding for FREE users
    await userSetup.skipOnboarding(user.id);
  }
  router.replace('/(projects)');
  return;
}
```

---

### 7. UserSetupService

**File**: `src/services/user-setup-service.ts`

**Method**: `skipOnboarding(userId: string): Promise<Result<void, AppError>>`

**Steps**:

1. Validate userId
2. Get current setup document
3. Update setup document:
   - `showOnboarding: false`
   - `firstTimeSetup: false`
4. Return success

---

## Data Structures

### SignUpInput

```typescript
interface SignUpInput {
  displayName: string; // Min 1, max 100 chars
  email: string; // Valid email format
  password: string; // Min 8 chars, letters + numbers
  confirmPassword: string; // Must match password
  subscriptionPlan: SubscriptionPlan; // FREE
  acceptTerms: boolean; // Must be true
  acceptPrivacy: boolean; // Must be true
  acceptMarketing?: boolean; // Optional
}
```

### BaseUser (Created)

```typescript
interface BaseUser {
  id: string; // Firebase Auth UID
  email: string; // Sanitized email
  displayName: string; // From input
  phone: null; // Set to null
  selectedSubscriptionPlan: SubscriptionPlan; // FREE
  role: UserRole.USER;
  isEmailVerified: false; // Set to false initially
  isActive: true;
  isBanned: false;
  hasCustomizations: false;
  lastLoginAt: null;
  deletedAt: null;
  createdAt: Date; // Server timestamp
  updatedAt: null;
}
```

### UserSubscription (Created by Cloud Function)

```typescript
interface UserSubscription {
  id: string; // Generated by Firestore
  userId: string;
  plan: SubscriptionPlan; // FREE
  status: SubscriptionStatus.INACTIVE; // Default for FREE
  isActive: false; // Default for FREE
  autoRenew: false;
  billingCycle: PaymentInterval.NONE; // No billing for FREE
  startDate: Date; // Current timestamp
  endDate: null;
  trialEndsAt: null; // No trial for FREE
  canceledAt: null;
  lastPaymentDate: null; // No payments for FREE
  nextBillingDate: null; // No billing for FREE
  transactionId: '';
  receipt: '';
  createdAt: Date; // Server timestamp
  updatedAt: null;
}
```

### UserSetup (After skipOnboarding)

```typescript
interface UserSetup {
  id: string;
  userId: string;
  showOnboarding: false; // Set to false
  firstTimeSetup: false; // Set to false
  // ... other fields
}
```

---

## Navigation Path Summary

```
1. App Start (not authenticated)
   → /(auth)/signUp

2. Sign Up Success (FREE plan)
   → /(auth)/signIn

3. Sign In Success
   → /(flow-router)

4. Flow Router Logic for FREE:
   - Email not verified → /(auth)/verify-email
   - Email verified + FREE plan → Skip onboarding → /(projects)

5. FREE users skip:
   - Payment flow
   - Setup flow
   - Onboarding flow
   - Direct to projects
```

---

## Key Differences: Free vs Paid Sign-Up

| Aspect                  | Free Sign-Up              | Paid Sign-Up                    |
| ----------------------- | ------------------------- | ------------------------------- |
| **Plan Selection**      | FREE                      | PRO or STUDIO                   |
| **After Sign Up**       | Direct to sign in         | Direct to sign in (same)        |
| **After Sign In**       | Direct to projects        | Payment required                |
| **Payment Flow**        | Not required              | Required (Stripe)               |
| **Subscription Status** | INACTIVE (default)        | INACTIVE → ACTIVE after payment |
| **Onboarding**          | Skipped automatically     | Short paid onboarding           |
| **Setup**               | Skipped automatically     | Required after payment          |
| **Trial Period**        | No trial                  | Trial available (PRO/STUDIO)    |
| **Billing Cycle**       | NONE                      | MONTHLY or ANNUALLY             |
| **Routing Logic**       | Skip all flows            | Payment → Setup → Onboarding    |

---

## Cloud Function Integration

### onUserCreated Trigger

When a user signs up, Firebase Cloud Function `onUserCreated` is automatically triggered:

```typescript
export const onUserCreated = functions.auth.user().onCreate(async (user) => {
  const uid = user.uid;
  const firestore = admin.firestore();
  
  // 1. Read selected plan from metadata (if available)
  let selectedPlan = SubscriptionPlan.FREE;
  
  // 2. Create subscription with correct plan
  const subData = defaultUserSubscription(uid);
  subData.plan = selectedPlan; // FREE for free users
  
  // For FREE plan:
  // - status: INACTIVE (default)
  // - isActive: false (default)
  // - billingCycle: NONE (default)
  // - No trial period
  
  // 3. Create all user documents:
  // - Base user (already created by client)
  // - Subscription subcollection
  // - Profile subcollection
  // - Preferences subcollection
  // - Customizations subcollection
  // - Setup subcollection
  // - Projects subcollection
});
```

**Key Points for FREE Users**:

- Subscription is created with `plan: FREE`
- `status: INACTIVE` (but user can still use app)
- `isActive: false` (but user can still use app)
- `billingCycle: NONE` (no billing)
- No trial period
- All subcollections created with defaults

---

## Summary

The free sign-up flow involves:

1. **Sign Up**: User fills form, selects FREE plan, submits
2. **Account Creation**: Firebase Auth user + Base User document created
3. **Cloud Function**: Automatically creates subscription and all subcollections
4. **Sign In**: User signs in with new credentials
5. **Flow Router**: Detects FREE plan, skips onboarding automatically
6. **Projects**: User reaches main app immediately

**Key Simplifications for FREE Users**:

- ✅ No payment processing
- ✅ No subscription activation
- ✅ No setup flow
- ✅ No onboarding flow
- ✅ Direct access to projects
- ✅ Automatic onboarding skip

The entire flow is tracked with analytics, handles errors gracefully, and follows the Result pattern for all async operations. FREE users get immediate access to the app with minimal friction.

