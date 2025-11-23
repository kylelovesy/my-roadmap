# User Journey: Welcome Screen to Projects Screen

This document maps all possible user paths from the welcome screen (`src/app/(auth)/welcome.tsx`) to the projects screen (`src/app/(projects)/index.tsx`), including component-level flowcharts, data lineage, infrastructure, and interaction sequences.

## Overview

The Eye-Doo app follows a complex authentication and onboarding flow with multiple routing guards that determine user progression based on authentication status, email verification, subscription state, and setup completion.

## Main User Paths

### Path 1: New User Registration Flow
```
Welcome → Register → Email Verification → Pricing → Onboarding → Setup → Projects
```

### Path 2: Existing User Sign-In Flow
```
Welcome → Sign In → [Various Routes Based on State] → Projects
```

### Path 3: Trial User Flow
```
Welcome → Register/Sign In → Trial Onboarding → Setup → Projects
```

## Component-Level Architecture

### Core Components Involved

```mermaid
graph TB
    A[WelcomeScreen] --> B[RegisterScreen]
    A --> C[SignInScreen]
    B --> D[EmailVerificationScreen]
    C --> D
    D --> E[SubscriptionGate]
    D --> F[PricingScreen]
    E --> G[FreeOnboarding]
    E --> H[PaidOnboarding]
    F --> H
    H --> I[SetupWizard]
    G --> I
    I --> J[ProjectsScreen]
    J --> K[Dashboard]
```

## Data Flow and Infrastructure

### Authentication Infrastructure

```mermaid
graph TD
    A[Firebase Auth] --> B[AuthInitializer]
    B --> C[AuthStore]
    C --> D[NavigationGuard]
    D --> E[RoutingRules]

    F[FirebaseUser] --> G[AuthService]
    G --> H[BaseUser Repository]
    H --> I[Firestore]

    J[UserSubscription] --> K[UserSubscriptionService]
    K --> L[UserSubscriptionRepository]
    L --> I

    M[UserSetup] --> N[UserSetupService]
    N --> O[UserSetupRepository]
    O --> I
```

### Service Layer Architecture

```mermaid
classDiagram
    class ServiceFactory {
        +auth: AuthService
        +userManagement: UserManagementService
        +userSubscription: UserSubscriptionService
        +userSetup: UserSetupService
        +onboarding: OnboardingService
    }

    class AuthService {
        +register(payload): Result~User, AppError~
        +signIn(payload): Result~User, AppError~
        +getProfile(): Result~User, AppError~
        +signOut(): Result~void, AppError~
    }

    class UserManagementService {
        +getUserComplete(id): Result~UserWithSubcollections, AppError~
    }

    ServiceFactory --> AuthService
    ServiceFactory --> UserManagementService
    ServiceFactory --> UserSubscriptionService
    ServiceFactory --> UserSetupService
```

## Detailed Sequence Diagrams

### New User Registration Sequence

```mermaid
sequenceDiagram
    participant U as User
    participant W as WelcomeScreen
    participant R as RegisterScreen
    participant RH as useRegister Hook
    participant AS as AuthService
    participant AR as AuthRepository
    participant FB as Firebase Auth
    participant UM as UserManagementService
    participant EV as EmailVerificationScreen
    participant NG as NavigationGuard

    U->>W: Tap "Create Account"
    W->>R: Navigate to register
    U->>R: Fill registration form
    R->>RH: Call register(input)
    RH->>AS: register(input)
    AS->>AR: createUser(input)
    AR->>FB: createUserWithEmailAndPassword
    FB-->>AR: FirebaseUser
    AR-->>AS: Result<User>
    AS-->>RH: Result<User>
    RH->>UM: Wait for user documents
    UM-->>RH: Documents ready
    RH-->>R: Success callback
    R->>EV: Navigate (email not verified)
    EV->>U: Show verification screen

    Note over U,EV: User verifies email via email link
    U->>FB: Click verification link
    FB-->>NG: Auth state changes
    NG->>NG: Evaluate routing rules
    NG->>Pricing: Navigate (new user needs plan)
```

### Sign-In Sequence

```mermaid
sequenceDiagram
    participant U as User
    participant W as WelcomeScreen
    participant SI as SignInScreen
    participant SIH as useSignIn Hook
    participant AS as AuthService
    participant AR as AuthRepository
    participant FB as Firebase Auth
    participant NG as NavigationGuard
    participant US as UserSubscriptionService
    participant USetup as UserSetupService

    U->>W: Tap "Sign In"
    W->>SI: Navigate to sign-in
    U->>SI: Fill sign-in form
    SI->>SIH: Call signIn(input)
    SIH->>AS: signIn(input)
    AS->>AR: signIn(input)
    AR->>FB: signInWithEmailAndPassword
    FB-->>AR: FirebaseUser
    AR-->>AS: Result<User>
    AS-->>SIH: Result<User>
    SIH-->>SI: Success callback
    SI->>AuthStore: setUser(user)

    AuthStore-->>NG: User state changed
    NG->>US: Fetch subscription
    NG->>USetup: Fetch setup
    US-->>NG: Subscription data
    USetup-->>NG: Setup data
    NG->>NG: Evaluate routing rules
    NG->>TargetScreen: Navigate based on rules
```

## Routing Rules Engine

### Priority-Based Routing System

```mermaid
flowchart TD
    A[User Authenticates] --> B{Navigation Guard Activated}
    B --> C[Fetch User Data]
    C --> D[Evaluate Routing Rules]

    D --> E{Priority 101: Email Verification}
    E -->|Required| F[Navigate to EmailVerification]
    E -->|Not Required| G{Priority 100: Payment Verification}

    G -->|Required| H[Navigate to EmailVerification]
    G -->|Not Required| I{Priority 99: No Plan}

    I -->|No Plan| J[Navigate to Pricing]
    I -->|Has Plan| K{Priority 98: Newly Registered}

    K -->|New User| L[Navigate to Pricing]
    K -->|Existing| M{Priority 90: Expiry Warning}

    M -->|Expiring Soon| N[Navigate to ExpiringSubscription]
    M -->|Not Expiring| O{Priority 80: Inactive Subscription}

    O -->|Inactive| P[Navigate to Payment]
    O -->|Active| Q{Priority 75: Past Due}

    Q -->|Past Due| R[Navigate to Payment]
    Q -->|Current| S{Priority 70: Cancelled}

    S -->|Cancelled| T[Navigate to SubscriptionGate]
    S -->|Active| U{Priority 65: Free Plan Onboarding}

    U -->|First Time| V[Navigate to FreeOnboarding]
    U -->|Already Seen| W{Priority 62: Paid Onboarding}

    W -->|Show Onboarding| X[Navigate to PaidOnboarding]
    W -->|Skip Onboarding| Y{Priority 60: Setup Required}

    Y -->|First Time Setup| Z[Navigate to SetupWizard]
    Y -->|Setup Complete| AA{Priority 50: Dashboard Guard}

    AA -->|No Project Selected| BB[Navigate to Projects]
    AA -->|Project Selected| CC{Priority 10: Default}

    CC --> DD[Navigate to Projects]
```

### Routing Rule Conditions

```mermaid
stateDiagram-v2
    [*] --> Authenticated: User logged in
    Authenticated --> EmailVerified: user.isEmailVerified === true
    Authenticated --> EmailNotVerified: user.isEmailVerified === false

    EmailNotVerified --> VerifyEmail: Always redirect

    EmailVerified --> HasPlan: subscription exists
    EmailVerified --> NoPlan: subscription === null

    NoPlan --> Pricing: Always redirect

    HasPlan --> PlanActive: subscription.status === ACTIVE
    HasPlan --> PlanInactive: subscription.status !== ACTIVE

    PlanInactive --> Payment: Redirect to payment

    PlanActive --> FirstTimeSetup: setup.firstTimeSetup === true
    PlanActive --> SetupComplete: setup.firstTimeSetup === false

    FirstTimeSetup --> ShowOnboarding: setup.showOnboarding === true
    FirstTimeSetup --> SkipOnboarding: setup.showOnboarding === false

    ShowOnboarding --> FreeOnboarding: subscription.plan === FREE
    ShowOnboarding --> PaidOnboarding: subscription.plan !== FREE

    FreeOnboarding --> SetupWizard: After completion
    PaidOnboarding --> SetupWizard: After completion

    SetupWizard --> Projects: After completion

    SetupComplete --> DashboardGuard: Check project selection
    DashboardGuard --> Projects: No project selected
    DashboardGuard --> Dashboard: Project selected
```

## Hook and Component Interactions

### Authentication Hooks Flow

```mermaid
graph LR
    A[WelcomeScreen] --> B[useRouter.push]
    B --> C[RegisterScreen]
    C --> D[useRegister]
    D --> E[AuthService.register]
    E --> F[AuthRepository.create]
    F --> G[Firebase.createUser]

    H[SignInScreen] --> I[useSignIn]
    I --> J[AuthService.signIn]
    J --> K[AuthRepository.signIn]
    K --> L[Firebase.signInWithEmailAndPassword]
```

### State Management Flow

```mermaid
stateDiagram-v2
    [*] --> Unauthenticated
    Unauthenticated --> Authenticating: useRegister/useSignIn called
    Authenticating --> Authenticated: Success
    Authenticating --> AuthError: Failure
    AuthError --> Unauthenticated: Clear error

    Authenticated --> ProfileLoading: AuthInitializer fetches profile
    ProfileLoading --> ProfileLoaded: Success
    ProfileLoading --> ProfileError: Failure

    ProfileLoaded --> NavigationEvaluating: NavigationGuard evaluates rules
    NavigationEvaluating --> Routing: Navigate to appropriate screen
    Routing --> [*]: Screen rendered
```

## Data Lineage and Dependencies

### User Data Structure

```mermaid
classDiagram
    class BaseUser {
        +id: string
        +email: string
        +displayName: string
        +isEmailVerified: boolean
        +createdAt: Timestamp
        +updatedAt: Timestamp
    }

    class UserSubscription {
        +id: string
        +userId: string
        +plan: SubscriptionPlan
        +status: SubscriptionStatus
        +isTrial: boolean
        +startDate: Timestamp
        +endDate: Timestamp
        +autoRenew: boolean
    }

    class UserSetup {
        +id: string
        +userId: string
        +firstTimeSetup: boolean
        +showOnboarding: boolean
        +skippedEmailVerification: boolean
    }

    class UserWithSubcollections {
        +BaseUser
        +profile?: UserProfile
        +preferences?: UserPreferences
        +customizations?: UserCustomizations
        +subscription?: UserSubscription
        +setup?: UserSetup
        +projects?: Project[]
        +kitList?: KitItem[]
        +taskList?: TaskItem[]
        +coupleShotList?: ShotListItem[]
        +groupShotList?: ShotListItem[]
    }

    BaseUser --> UserWithSubcollections
    UserSubscription --> UserWithSubcollections
    UserSetup --> UserWithSubcollections
```

### Repository Pattern Implementation

```mermaid
classDiagram
    class IAuthRepository {
        +signUp(input): Promise~Result~User, AppError~~
        +signIn(input): Promise~Result~User, AppError~~
        +signOut(): Promise~Result~void, AppError~~
        +getProfile(): Promise~Result~User, AppError~~
    }

    class FirestoreAuthRepository {
        +signUp(input): Promise~Result~User, AppError~~
        +signIn(input): Promise~Result~User, AppError~~
        +signOut(): Promise~Result~void, AppError~~
        +getProfile(): Promise~Result~User, AppError~~
    }

    class CachedFirestoreAuthRepository {
        +delegate: FirestoreAuthRepository
        +cache: Map~string, CacheEntry~
        +getProfile(): Promise~Result~User, AppError~~
    }

    IAuthRepository <|.. FirestoreAuthRepository
    IAuthRepository <|.. CachedFirestoreAuthRepository
    FirestoreAuthRepository <-- CachedFirestoreAuthRepository
```

## Error Handling and Recovery

### Error Flow Architecture

```mermaid
graph TD
    A[User Action] --> B[Component/Hook]
    B --> C[Service Method]
    C --> D[Repository Method]
    D --> E[Firestore Operation]

    E -->|Success| F[Return Result.ok(data)]
    E -->|Error| G[ErrorMapper.fromFirestore]

    G --> H[AppError with context]
    H --> I[Result.err(error)]
    I --> J[Error boundary/Global handler]

    J --> K{Error Type}
    K -->|Recoverable| L[Show retry option]
    K -->|Fatal| M[Show error screen]
    K -->|Auth| N[Redirect to sign-in]
```

## Infrastructure Components

### Service Context and Dependency Injection

```mermaid
graph TD
    A[Root Layout] --> B[ServiceContext.Provider]
    B --> C[ServiceFactory]
    C --> D[AuthService]
    C --> E[UserManagementService]
    C --> F[UserSubscriptionService]
    C --> G[UserSetupService]
    C --> H[OnboardingService]

    I[Components] --> J[useServices hook]
    J --> C

    D --> K[AuthRepository]
    E --> L[UserRepository]
    F --> M[UserSubscriptionRepository]
    G --> N[UserSetupRepository]
    H --> O[OnboardingRepository]

    K --> P[Firestore]
    L --> P
    M --> P
    N --> P
    O --> P
```

### Navigation State Management

```mermaid
stateDiagram-v2
    [*] --> Initializing: App starts
    Initializing --> AuthChecking: AuthInitializer
    AuthChecking --> Unauthenticated: No user
    AuthChecking --> Authenticated: User found

    Authenticated --> DataFetching: NavigationGuard
    DataFetching --> RulesEvaluating: Check routing rules
    RulesEvaluating --> Navigating: Route determined
    Navigating --> ScreenRendered: Component mounted

    Unauthenticated --> WelcomeScreen: Default route
    ScreenRendered --> [*]: User interaction

    note right of DataFetching
        Fetches subscription & setup data
        with retry logic and exponential backoff
    end note
```

## Key Component Interactions

### Screen Wrapper Pattern

```mermaid
graph LR
    A[Screen Component] --> B[ScreenWrapper]
    B --> C{Loading State}
    C -->|Loading| D[LoadingSpinner]
    C -->|Error| E[ErrorMessage + Retry]
    C -->|Success| F[Screen Content]

    G[Hook] --> H[LoadingState Management]
    H --> I[useState<LoadingState<T>>]
    I --> J[loading/success/error states]
    J --> B
```

### Form Component Pattern

```mermaid
graph TD
    A[Form Component] --> B[useUnifiedForm]
    B --> C[Zod Schema Validation]
    B --> D[Field State Management]
    B --> E[Error Handling]

    F[User Input] --> G[handleChange]
    G --> H[Clear field errors]
    G --> I[Update form state]

    J[Form Submit] --> K[Validate all fields]
    K --> L{Zod validation}
    L -->|Valid| M[Call onSubmit]
    L -->|Invalid| N[Set field errors]
    M --> O[Handle success/error]
```

## Performance Optimizations

### Loading State Management

```mermaid
stateDiagram-v2
    [*] --> idle
    idle --> loading: Start async operation
    loading --> success: Operation succeeded
    loading --> error: Operation failed

    success --> loading: Refresh/retry
    error --> loading: Retry
    error --> idle: Clear error

    note right of loading
        Prevents multiple concurrent operations
        Shows appropriate UI feedback
    end note
```

### Optimistic Updates Pattern

```mermaid
sequenceDiagram
    participant U as User
    participant C as Component
    participant H as Hook
    participant S as Service
    participant R as Repository
    participant DB as Database

    U->>C: User action (e.g., update profile)
    C->>H: Call update function
    H->>H: Apply optimistic update to local state
    C->>C: UI updates immediately
    H->>S: Call service method
    S->>R: Call repository method
    R->>DB: Update database
    DB-->>R: Success
    R-->>S: Success
    S-->>H: Success
    H->>H: No rollback needed

    Note over H: If error occurs, rollback optimistic update
```

## Security Considerations

### Authentication Guards

```mermaid
graph TD
    A[Route Access] --> B{Authentication Check}
    B -->|Unauthenticated| C[Redirect to Welcome]
    B -->|Authenticated| D{Email Verification}

    D -->|Not Verified| E[Redirect to EmailVerification]
    D -->|Verified| F{Subscription Status}

    F -->|Inactive| G[Redirect to Payment]
    F -->|Active| H{Setup Complete}

    H -->|Not Complete| I[Redirect to Setup]
    H -->|Complete| J{Project Selected}

    J -->|No Project| K[Redirect to Projects]
    J -->|Project Selected| L[Allow Dashboard Access]
```

### Data Sanitization Pipeline

```mermaid
graph LR
    A[User Input] --> B[Component Validation]
    B --> C[Hook Processing]
    C --> D[Service Business Logic]
    D --> E[Repository Sanitization]
    E --> F[Zod Runtime Validation]
    F --> G[Firestore Write]

    H[Read Data] --> I[Repository Parsing]
    I --> J[Service Validation]
    J --> K[Component Display]
```

## Testing Strategy

### Test Coverage Areas

```mermaid
graph TD
    A[Unit Tests] --> B[Hooks]
    A --> C[Services]
    A --> D[Repositories]
    A --> E[Utilities]

    F[Integration Tests] --> G[Authentication Flow]
    F --> H[Navigation Flow]
    F --> I[Onboarding Flow]

    J[E2E Tests] --> K[User Registration]
    J --> L[User Sign In]
    J --> M[Complete Onboarding]
    J --> N[Project Creation]

    O[Test Utilities] --> P[Mock Services]
    O --> Q[Test Data Factories]
    O --> R[Firebase Emulators]
```

## Monitoring and Analytics

### User Journey Tracking

```mermaid
sequenceDiagram
    participant U as User
    participant A as Analytics
    participant S as Screen
    participant H as Hook
    participant E as Event

    U->>S: Navigate to screen
    S->>A: trackScreenView
    A->>A: Log screen view event

    U->>H: Perform action
    H->>A: trackEvent
    A->>A: Log custom event

    E->>A: Error occurs
    A->>A: Log error event

    Note over A: Events include:
    Note over A: - Screen views
    Note over A: - Button clicks
    Note over A: - Form submissions
    Note over A: - Navigation events
    Note over A: - Error events
```

This comprehensive mapping shows the complete user journey from welcome screen to projects screen, including all possible paths, component interactions, data flows, and infrastructure components involved in the Eye-Doo application.
