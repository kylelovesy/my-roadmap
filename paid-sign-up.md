# Paid Account Sign-Up Flow Documentation

## Overview

This document maps out the complete process of a new user signing up for a **paid account** (PRO or STUDIO plan) in the Eye-Doo application. It covers all screens, interactions, data flow, state management, navigation, and triggers involved in the sign-up process.

---

## Table of Contents

1. [High-Level Flow](#high-level-flow)
2. [Screen Navigation Flow](#screen-navigation-flow)
3. [Data Flow Architecture](#data-flow-architecture)
4. [Component Interaction Flow](#component-interaction-flow)
5. [State Management Flow](#state-management-flow)
6. [Payment Processing Flow](#payment-processing-flow)
7. [Subscription Activation Flow](#subscription-activation-flow)
8. [Error Handling Flow](#error-handling-flow)
9. [Analytics Tracking Flow](#analytics-tracking-flow)
10. [Detailed Component Breakdown](#detailed-component-breakdown)

---

## High-Level Flow

```mermaid
flowchart TD
    A[User Opens App] --> B{Authenticated?}
    B -->|No| C[Sign Up Screen]
    B -->|Yes| D[Flow Router]

    C --> E[Fill Sign Up Form]
    E --> F[Select PRO/STUDIO Plan]
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
    W -->|Yes| Y{Subscription Status?}

    Y -->|INACTIVE| Z[Payment Screen]
    Y -->|ACTIVE| AA{Setup Complete?}
    Y -->|TRIALING| BB[Onboarding Screen]

    Z --> CC[Enter Card Details]
    CC --> DD[Create Payment Intent]
    DD --> EE[Confirm Payment with Stripe]

    EE -->|Success| FF[Activate Subscription]
    EE -->|Failed| GG[Show Payment Error]

    FF --> HH[Update Subscription Status: ACTIVE]
    HH --> II{First Time Setup?}

    II -->|Yes| JJ[Setup Screen]
    II -->|No| KK{Onboarding Needed?}

    KK -->|Yes| LL[Paid Onboarding Screen]
    KK -->|No| MM[Projects Screen]

    LL --> NN[Complete Onboarding]
    NN --> MM

    JJ --> OO[Complete Setup]
    OO --> MM

    style C fill:#e1f5ff
    style Z fill:#fff4e1
    style FF fill:#e8f5e9
    style MM fill:#f3e5f5
```

---

## Screen Navigation Flow

```mermaid
stateDiagram-v2
    [*] --> SignUpScreen: User opens app (not authenticated)

    SignUpScreen --> SignUpScreen: Fill form fields
    SignUpScreen --> SignUpScreen: View plan details modal
    SignUpScreen --> SignInScreen: Click "Already have account?"

    SignUpScreen --> SignInScreen: Sign up successful
    SignUpScreen --> SignUpScreen: Sign up error (show error)

    SignInScreen --> FlowRouter: Sign in successful

    FlowRouter --> VerifyEmailScreen: Email not verified
    FlowRouter --> PaymentScreen: Subscription INACTIVE
    FlowRouter --> SetupScreen: Subscription ACTIVE + firstTimeSetup=true
    FlowRouter --> PaidOnboardingScreen: Subscription ACTIVE + showOnboarding=true
    FlowRouter --> ProjectsScreen: All complete

    VerifyEmailScreen --> FlowRouter: Email verified

    PaymentScreen --> PaymentScreen: Enter card details
    PaymentScreen --> PaymentScreen: Payment processing
    PaymentScreen --> SetupScreen: Payment successful
    PaymentScreen --> PaymentScreen: Payment failed (show error)

    SetupScreen --> FlowRouter: Setup complete

    PaidOnboardingScreen --> FlowRouter: Onboarding complete

    ProjectsScreen --> [*]

    note right of SignUpScreen
        Fields:
        - displayName
        - email
        - password
        - confirmPassword
        - subscriptionPlan (PRO/STUDIO)
        - acceptTerms
        - acceptPrivacy
        - acceptMarketing (optional)
    end note

    note right of PaymentScreen
        States:
        - loading: Loading subscription
        - processing: Processing payment
        - cardComplete: Card details valid
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
    participant AuthStore
    participant UIStore
    participant AnalyticsService

    User->>SignUpScreen: Opens app
    SignUpScreen->>AuthenticationForm: Renders form
    AuthenticationForm->>useUnifiedForm: Initializes form with schema

    User->>AuthenticationForm: Fills form fields
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

## Payment Processing Flow

```mermaid
sequenceDiagram
    participant User
    participant SignInScreen
    participant FlowRouter
    participant PaymentScreen
    participant PaymentService
    participant Stripe
    participant UserSubscriptionService
    participant Firestore

    User->>SignInScreen: Signs in
    SignInScreen->>FlowRouter: Navigate after sign in

    FlowRouter->>FlowRouter: Check subscription status
    FlowRouter->>FlowRouter: subscription.status = INACTIVE
    FlowRouter->>PaymentScreen: Navigate to payment

    PaymentScreen->>PaymentScreen: Load subscription (getByUserId)
    PaymentScreen->>User: Display payment form

    User->>PaymentScreen: Enter card details
    PaymentScreen->>PaymentScreen: setCardComplete(true)

    User->>PaymentScreen: Click "Pay" button
    PaymentScreen->>PaymentScreen: setProcessing(true)
    PaymentScreen->>PaymentService: createPaymentIntent(userId, plan, billingCycle)

    PaymentService->>PaymentService: Validate userId
    PaymentService->>PaymentService: Validate interval
    PaymentService->>PaymentService: Calculate price
    PaymentService->>PaymentService: Track payment initiated (analytics)
    PaymentService->>PaymentService: Call backend API (/api/create-payment-intent)

    PaymentService-->>PaymentScreen: ok({ clientSecret })

    PaymentScreen->>Stripe: confirmPayment(clientSecret)
    Stripe->>Stripe: Process payment
    Stripe-->>PaymentScreen: { error, paymentIntent }

    alt Payment Failed
        PaymentScreen->>PaymentScreen: setProcessing(false)
        PaymentScreen->>UIStore: showToast(error)
        PaymentScreen->>User: Display error message
    else Payment Succeeded
        PaymentScreen->>UserSubscriptionService: activateSubscription(userId, subscriptionId, paymentIntent.id, billingCycle)

        UserSubscriptionService->>UserSubscriptionService: Validate inputs
        UserSubscriptionService->>UserSubscriptionService: Get current subscription
        UserSubscriptionService->>UserSubscriptionService: Calculate dates
        UserSubscriptionService->>Firestore: Update subscription document

        Firestore-->>UserSubscriptionService: Success
        UserSubscriptionService-->>PaymentScreen: ok(updatedSubscription)

        PaymentScreen->>UIStore: showToast(success)
        PaymentScreen->>PaymentScreen: router.replace('/(setup)')
    end
```

### Payment Screen States

```mermaid
stateDiagram-v2
    [*] --> Loading: Screen mounts

    Loading --> Ready: Subscription loaded
    Loading --> Error: Failed to load

    Ready --> EnteringCard: User starts entering card
    EnteringCard --> CardComplete: Card details valid
    EnteringCard --> CardIncomplete: Card details invalid

    CardComplete --> Processing: User clicks Pay
    CardIncomplete --> EnteringCard: User continues typing

    Processing --> Success: Payment succeeded
    Processing --> Failed: Payment failed

    Success --> SetupScreen: Navigate to setup
    Failed --> Ready: Show error, allow retry

    Error --> Ready: Retry loading

    note right of Ready
        States:
        - subscription: UserSubscription | null
        - loading: false
        - processing: false
        - cardComplete: false
    end note

    note right of Processing
        States:
        - processing: true
        - cardComplete: true
        - Button disabled
    end note
```

---

## Subscription Activation Flow

```mermaid
flowchart TD
    A[Payment Succeeded] --> B[activateSubscription Called]

    B --> C[Validate userId]
    C --> D[Validate subscriptionId]
    D --> E[Validate billingCycle]
    E --> F[Validate transactionId]

    F --> G[Get Current Subscription]
    G --> H{Subscription Found?}

    H -->|No| I[Return Error: NOT_FOUND]
    H -->|Yes| J[Calculate Next Billing Date]

    J --> K[Calculate Subscription End Date]
    K --> L[Prepare Update Payload]

    L --> M[Update Subscription Document]
    M --> N[Set status: ACTIVE]
    N --> O[Set isActive: true]
    O --> P[Set transactionId]
    P --> Q[Set billingCycle]
    Q --> R[Set nextBillingDate]
    R --> S[Set subscriptionEndDate]
    S --> T[Set activatedAt: now]

    T --> U[Update Firestore]
    U --> V{Update Success?}

    V -->|No| W[Return Error]
    V -->|Yes| X[Track Analytics: Subscription Activated]
    X --> Y[Return Success]

    Y --> Z[Navigate to Setup Screen]

    style A fill:#e1f5ff
    style M fill:#fff4e1
    style Y fill:#e8f5e9
    style Z fill:#f3e5f5
```

### Subscription Update Payload

```typescript
interface SubscriptionUpdate {
  status: SubscriptionStatus.ACTIVE;
  isActive: true;
  transactionId: string; // Payment intent ID from Stripe
  billingCycle: PaymentInterval; // MONTHLY or ANNUALLY
  nextBillingDate: Date; // Calculated based on billingCycle
  subscriptionEndDate: Date; // Calculated based on billingCycle
  activatedAt: Date; // Current timestamp
  updatedAt: Date; // Current timestamp
}
```

---

## Error Handling Flow

```mermaid
flowchart TD
    A[Operation Starts] --> B{Operation Type}

    B -->|Sign Up| C[Rate Limit Check]
    B -->|Payment| D[Payment Validation]
    B -->|Subscription| E[Subscription Validation]

    C -->|Blocked| F[Return AUTH_TOO_MANY_REQUESTS]
    C -->|Allowed| G[Validate Input]

    G -->|Invalid| H[Return VALIDATION_FAILED]
    G -->|Valid| I[Execute Operation]

    D -->|Invalid| J[Return VALIDATION_FAILED]
    D -->|Valid| K[Process Payment]

    E -->|Invalid| L[Return VALIDATION_FAILED]
    E -->|Valid| M[Update Subscription]

    I -->|Firebase Auth Error| N[Map to AppError]
    I -->|Firestore Error| O[Map to AppError]
    I -->|Network Error| P[Map to AppError]
    I -->|Success| Q[Return Success]

    K -->|Stripe Error| R[Return Payment Error]
    K -->|Success| S[Activate Subscription]

    M -->|Firestore Error| T[Return DB Error]
    M -->|Success| U[Return Success]

    F --> V[Error Handler]
    H --> V
    J --> V
    L --> V
    N --> V
    O --> V
    P --> V
    R --> V
    T --> V

    V --> W[ErrorContextBuilder]
    W --> X[ErrorMapper]
    X --> Y[AppErrorHandler]

    Y --> Z[Show Toast]
    Y --> AA[Log Error]
    Y --> AB[Track Analytics]

    Q --> AC[Success Handler]
    S --> AC
    U --> AC

    AC --> AD[Update State]
    AC --> AE[Show Success Toast]
    AC --> AF[Navigate Next Screen]

    style F fill:#ffebee
    style H fill:#ffebee
    style J fill:#ffebee
    style L fill:#ffebee
    style N fill:#ffebee
    style O fill:#ffebee
    style P fill:#ffebee
    style R fill:#ffebee
    style T fill:#ffebee
    style Q fill:#e8f5e9
    style S fill:#e8f5e9
    style U fill:#e8f5e9
```

### Error Types & Handling

| Error Type             | Code                        | User Message                                     | Action                          |
| ---------------------- | --------------------------- | ------------------------------------------------ | ------------------------------- |
| Rate Limit Exceeded    | `AUTH_TOO_MANY_REQUESTS`    | "Too many attempts. Try again in X minutes."     | Block further attempts          |
| Validation Failed      | `VALIDATION_FAILED`         | Field-specific error messages                    | Show field errors               |
| Email Already Exists   | `AUTH_EMAIL_ALREADY_IN_USE` | "This email is already registered."              | Suggest sign in                 |
| Weak Password          | `AUTH_WEAK_PASSWORD`        | "Password is too weak."                          | Show password requirements      |
| Network Error          | `NETWORK_ERROR`             | "Connection failed. Please check your internet." | Allow retry                     |
| Payment Failed         | `PAYMENT_FAILED`            | Error message from Stripe                        | Allow retry with different card |
| Subscription Not Found | `DB_NOT_FOUND`              | "Subscription not found."                        | Navigate to pricing             |

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

    User->>SignUpScreen: Submits form
    SignUpScreen->>SignUpScreen: Sign up successful
    SignUpScreen->>AnalyticsService: trackSignUpCompleted(userId, params)

    AnalyticsService->>AnalyticsService: Build base params
    AnalyticsService->>AnalyticsService: Add user-specific params
    AnalyticsService->>FirebaseAnalytics: logEvent('sign_up_completed')
    AnalyticsService->>FirebaseAnalytics: setUserProperty('subscription_plan', plan)
    AnalyticsService->>FirebaseAnalytics: setUserProperty('registration_date', date)

    User->>PaymentScreen: Enters payment screen
    PaymentScreen->>AnalyticsService: trackPaymentInitiated(plan, interval, userId)
    AnalyticsService->>FirebaseAnalytics: logEvent('payment_initiated')

    User->>PaymentScreen: Payment succeeds
    PaymentScreen->>AnalyticsService: trackPaymentSuccess(plan, interval, amount, userId)
    AnalyticsService->>FirebaseAnalytics: logEvent('payment_success')
    AnalyticsService->>FirebaseAnalytics: setUserProperty('subscription_status', 'ACTIVE')
    AnalyticsService->>FirebaseAnalytics: setUserProperty('last_payment_date', date)
```

### Analytics Events Tracked

| Event                    | When                        | Parameters                                                |
| ------------------------ | --------------------------- | --------------------------------------------------------- |
| `sign_up_started`        | User opens sign up screen   | `session_id`, `platform`, `app_version`                   |
| `sign_up_completed`      | Sign up successful          | `user_id`, `method`, `user_type`, `subscription_plan`     |
| `payment_initiated`      | User clicks Pay button      | `user_id`, `plan`, `interval`, `amount`                   |
| `payment_success`        | Payment confirmed           | `user_id`, `plan`, `interval`, `amount`, `transaction_id` |
| `payment_failed`         | Payment fails               | `user_id`, `plan`, `interval`, `error_message`            |
| `subscription_activated` | Subscription status updated | `user_id`, `plan`, `status`, `billing_cycle`              |

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

### 6. PaymentScreen Component

**File**: `src/app/(payment)/index.tsx`

**State**:

```typescript
const [subscription, setSubscription] = useState<UserSubscription | null>(null);
const [loading, setLoading] = useState(true);
const [processing, setProcessing] = useState(false);
const [cardComplete, setCardComplete] = useState(false);
```

**Flow**:

1. **Load Subscription**: `userSubscription.getByUserId(userId)`
2. **Display Form**: Show plan details and card input
3. **Card Input**: Stripe `CardField` component
4. **Payment**:
   - Create payment intent
   - Confirm with Stripe
   - Activate subscription on success
   - Navigate to setup

**Navigation**:

- Success: `router.replace('/(setup)')`
- Update Mode: `router.back()`

---

### 7. PaymentService

**File**: `src/services/payment-service.ts`

**Method**: `createPaymentIntent(userId, plan, interval, promoCode?): Promise<Result<{clientSecret}, AppError>>`

**Steps**:

1. Validate userId
2. Validate interval
3. Validate promo code (if provided)
4. Calculate price with discount
5. Track analytics: `trackPaymentInitiated()`
6. Call backend API: `/api/create-payment-intent`
7. Return client secret

---

### 8. UserSubscriptionService

**File**: `src/services/user-subscription-service.ts`

**Method**: `activateSubscription(userId, subscriptionId, transactionId, billingCycle): Promise<Result<UserSubscription, AppError>>`

**Steps**:

1. Validate all inputs
2. Get current subscription
3. Calculate `nextBillingDate`
4. Calculate `subscriptionEndDate`
5. Update subscription document:
   - `status: ACTIVE`
   - `isActive: true`
   - `transactionId`
   - `billingCycle`
   - `nextBillingDate`
   - `subscriptionEndDate`
   - `activatedAt`
6. Track analytics
7. Return updated subscription

---

## Data Structures

### SignUpInput

```typescript
interface SignUpInput {
  displayName: string; // Min 1, max 100 chars
  email: string; // Valid email format
  password: string; // Min 8 chars, letters + numbers
  confirmPassword: string; // Must match password
  subscriptionPlan: SubscriptionPlan; // PRO | STUDIO
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
  selectedSubscriptionPlan: SubscriptionPlan; // PRO or STUDIO
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

### UserSubscription (After Payment)

```typescript
interface UserSubscription {
  id: string;
  userId: string;
  plan: SubscriptionPlan; // PRO or STUDIO
  status: SubscriptionStatus.ACTIVE;
  isActive: true;
  billingCycle: PaymentInterval; // MONTHLY or ANNUALLY
  transactionId: string; // Stripe payment intent ID
  nextBillingDate: Date; // Calculated
  subscriptionEndDate: Date; // Calculated
  activatedAt: Date; // Current timestamp
  // ... other fields
}
```

---

## Navigation Path Summary

```
1. App Start (not authenticated)
   → /(auth)/signUp

2. Sign Up Success
   → /(auth)/signIn

3. Sign In Success
   → /(flow-router)

4. Flow Router Logic:
   - Email not verified → /(auth)/verify-email
   - Subscription INACTIVE → /(payment)
   - Subscription ACTIVE + firstTimeSetup → /(setup)
   - Subscription ACTIVE + showOnboarding → /(onboarding)/paid
   - All complete → /(projects)

5. Payment Success
   → /(setup)

6. Setup Complete
   → /(flow-router) → /(projects) (or onboarding if needed)

7. Paid Onboarding Complete
   → /(flow-router) → /(projects)
```

---

## Key Differences: Paid vs Free Sign-Up

| Aspect                  | Free Sign-Up       | Paid Sign-Up                    |
| ----------------------- | ------------------ | ------------------------------- |
| **Plan Selection**      | FREE               | PRO or STUDIO                   |
| **After Sign Up**       | Direct to sign in  | Direct to sign in (same)        |
| **After Sign In**       | Skip to projects   | Payment required                |
| **Payment Flow**        | Not required       | Required (Stripe)               |
| **Subscription Status** | ACTIVE immediately | INACTIVE → ACTIVE after payment |
| **Onboarding**          | Skipped            | Short paid onboarding           |
| **Setup**               | Skipped            | Required after payment          |
| **Trial Period**        | No trial           | No trial (immediate payment)    |

---

## Summary

The paid sign-up flow involves:

1. **Sign Up**: User fills form, selects PRO/STUDIO plan, submits
2. **Account Creation**: Firebase Auth user + Base User document created
3. **Sign In**: User signs in with new credentials
4. **Payment**: User enters card details, payment processed via Stripe
5. **Subscription Activation**: Subscription status updated to ACTIVE
6. **Setup**: User completes first-time setup
7. **Onboarding**: Short paid onboarding (optional)
8. **Projects**: User reaches main app

The entire flow is tracked with analytics, handles errors gracefully, and follows the Result pattern for all async operations.
