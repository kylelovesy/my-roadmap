# Onboarding Module - Complete Flow Diagrams

This document provides comprehensive Mermaid diagrams detailing all onboarding flows, screens, components, states, triggers, and navigation paths.

## Table of Contents

1. [Overview - All Flows Combined](#overview---all-flows-combined)
2. [Flow A - Free User Onboarding](#flow-a---free-user-onboarding)
3. [Flow B1 - Basic Plan Onboarding](#flow-b1---basic-plan-onboarding)
4. [Flow B2 - Pro/Studio Plan Onboarding](#flow-b2---prostudio-plan-onboarding)
5. [Flow B3 - Expiring Subscription Warning](#flow-b3---expiring-subscription-warning)
6. [Navigation Flow - Before & After](#navigation-flow---before--after)
7. [Component Architecture](#component-architecture)
8. [State Management Flow](#state-management-flow)
9. [Trigger Conditions Reference](#trigger-conditions-reference)

---

## Overview - All Flows Combined

```mermaid
graph TB
    Start([User Authenticated]) --> NavGuard{Navigation Guard<br/>Evaluates Routing Rules}

    NavGuard -->|Priority 90| ExpiringCheck{Subscription Expiring?<br/>Days: 14,10,7,3,2,1<br/>autoRenew=false}
    NavGuard -->|Priority 65| FreeCheck{Plan = FREE<br/>!hasSeenFreeWelcome}
    NavGuard -->|Priority 62| ActiveCheck{Status = ACTIVE<br/>showOnboarding = true}
    NavGuard -->|Priority 50| TrialingCheck{Status = TRIALING<br/>showOnboarding = true}

    ExpiringCheck -->|Yes| FlowB3[Flow B3<br/>Expiring Subscription<br/>Screen]
    FreeCheck -->|Yes| FlowA[Flow A<br/>Free User<br/>Onboarding]
    ActiveCheck -->|Yes| PlanCheck{Plan Type?}
    TrialingCheck -->|Yes| FlowA

    PlanCheck -->|BASIC| FlowB1[Flow B1<br/>Basic Plan<br/>Onboarding]
    PlanCheck -->|PRO/STUDIO| FlowB2[Flow B2<br/>Pro/Studio Plan<br/>Onboarding]

    FlowA --> CompleteA[Complete Onboarding<br/>showOnboarding=false<br/>firstTimeSetup=true]
    FlowB1 --> CompleteB1[Complete Onboarding<br/>showOnboarding=false<br/>firstTimeSetup=true]
    FlowB2 --> CompleteB2[Complete Onboarding<br/>showOnboarding=false<br/>firstTimeSetup=true]
    FlowB3 --> CompleteB3[Complete Onboarding<br/>showOnboarding=false]

    CompleteA --> NavAfter[Navigate to<br/>PROJECTS_INDEX]
    CompleteB1 --> NavAfter
    CompleteB2 --> NavAfter
    CompleteB3 --> NavAfter

    NavAfter --> SetupCheck{firstTimeSetup<br/>= true?}
    SetupCheck -->|Yes| SetupWizard[Setup Wizard<br/>Priority 60]
    SetupCheck -->|No| Projects[Projects Index<br/>Priority 10]

    style FlowA fill:#e1f5ff
    style FlowB1 fill:#fff4e1
    style FlowB2 fill:#ffe1f5
    style FlowB3 fill:#ffe1e1
    style CompleteA fill:#d4edda
    style CompleteB1 fill:#d4edda
    style CompleteB2 fill:#d4edda
    style CompleteB3 fill:#d4edda
```

---

## Flow A - Free User Onboarding

```mermaid
graph TB
    Start([Navigation Guard<br/>Priority 65 Rule]) --> Condition{Check Conditions}

    Condition -->|Plan = FREE<br/>!hasSeenFreeWelcome| FreeScreen[freeSubscription.tsx<br/>OnboardingFreeScreen]

    FreeScreen --> LocalState[Local State:<br/>flowStep: 0 or 1<br/>slideStep: 0-3]

    LocalState -->|flowStep = 0| A1[DynamicSplash Component<br/>A1: Splash Screen]
    LocalState -->|flowStep = 1| A2[Slideshow Component<br/>A2: Feature Slideshow]

    A1 --> A1Content[Content:<br/>Title: 'Your Free Account is Ready!'<br/>Description: Core features message<br/>showAutoRenew: false]
    A1Content --> A1Buttons[Buttons:<br/>- Manage Subscription: Navigate to /account/subscription<br/>- Proceed: setFlowStep 1]

    A2 --> A2Content[Content:<br/>FREE_USER_SLIDES<br/>4 slides:<br/>1. Welcome to Eye-Doo<br/>2. Client Portals<br/>3. Smart Shot Lists<br/>4. Vendor Management]
    A2Content --> A2Controls[Controls:<br/>- Skip Button: Top Right<br/>- Back Button: Disabled on first slide<br/>- Next/Proceed Button<br/>- Progress Dots: 4 dots<br/>- Auto-play: 5s per slide]

    A1Buttons -->|Proceed| A2
    A2Controls -->|Next| A2Next[Increment slideStep<br/>Auto-advance after 5s]
    A2Controls -->|Back| A2Back[Decrement slideStep<br/>Min: 0]
    A2Controls -->|Skip/Finish| Complete[handleFinish Function]

    Complete --> Hook[useOnboarding Hook<br/>completeOnboarding]
    Hook --> Service[OnboardingService<br/>completeOnboarding]
    Service --> Firestore[Firestore Update:<br/>showOnboarding = false<br/>firstTimeSetup = true<br/>onboardingCompletedDate = now]

    Firestore --> Success{Success?}
    Success -->|Yes| ResetStore[Reset Store State<br/>resetFlow]
    Success -->|No| Error[Error State<br/>Display Error<br/>Allow Retry]

    ResetStore --> Navigate[Navigate to<br/>PROJECTS_INDEX]
    Navigate --> NavGuard2[Navigation Guard<br/>Re-evaluates]
    NavGuard2 -->|Priority 60| SetupRedirect[Redirect to<br/>SETUP_INDEX<br/>if firstTimeSetup=true]
    NavGuard2 -->|Priority 10| ProjectsScreen[Stay at<br/>PROJECTS_INDEX]

    Error --> Retry[Retry Button<br/>clearError + retry]
    Retry --> Complete

    style FreeScreen fill:#e1f5ff
    style A1 fill:#b3e5fc
    style A2 fill:#b3e5fc
    style Complete fill:#c8e6c9
    style Firestore fill:#fff9c4
    style SetupRedirect fill:#ffccbc
```

### Flow A - State Variables

| Variable                          | Location                     | Type             | Values               | Description                     |
| --------------------------------- | ---------------------------- | ---------------- | -------------------- | ------------------------------- |
| `flowStep`                        | Local (freeSubscription.tsx) | number           | 0, 1                 | 0 = A1 Splash, 1 = A2 Slideshow |
| `slideStep`                       | Local (freeSubscription.tsx) | number           | 0-3                  | Current slide index in A2       |
| `loading`                         | Hook (useOnboarding)         | boolean          | true/false           | Loading state from hook         |
| `error`                           | Hook (useOnboarding)         | AppError \| null | Error object or null | Error state from hook           |
| `subscription.plan`               | Firestore                    | SubscriptionPlan | FREE                 | Determines flow entry           |
| `sessionFlags.hasSeenFreeWelcome` | Session                      | boolean          | true/false           | Prevents repeat in same session |
| `setup.showOnboarding`            | Firestore                    | boolean          | true/false           | Must be true to enter flow      |
| `setup.firstTimeSetup`            | Firestore                    | boolean          | true/false           | Set to true on completion       |

---

## Flow B1 - Basic Plan Onboarding

```mermaid
graph TB
    Start([Navigation Guard<br/>Priority 62 Rule]) --> Condition{Check Conditions}

    Condition -->|Status = ACTIVE<br/>showOnboarding = true<br/>Plan = BASIC| PaidScreen[paidSubscription.tsx<br/>OnboardingPaidScreen]

    PaidScreen --> StoreState[Store State:<br/>flowBStep: 'B1'<br/>currentStep: 0-4]

    StoreState -->|flowBStep = 'B1'| B1Slideshow[Slideshow Component<br/>B1: Basic Plan Slideshow]

    B1Slideshow --> B1Content[Content:<br/>BASIC_PLAN_SLIDES<br/>5 slides:<br/>1. Basic: Create a Project<br/>2. Basic: Add a Client<br/>3. Basic: Your Timeline<br/>4. Basic: Add Notes<br/>5. Basic: All Set!]

    B1Content --> B1Controls[Controls:<br/>- Skip Button: Top Right<br/>- Back Button: Disabled on first slide<br/>- Next/Proceed Button<br/>- Progress Dots: 5 dots<br/>- Auto-play: 5s per slide]

    B1Controls -->|Next| B1Next[Store: nextStep<br/>Increment currentStep<br/>Auto-advance after 5s]
    B1Controls -->|Back| B1Back[Store: prevStep<br/>Decrement currentStep<br/>Min: 0]
    B1Controls -->|Skip/Finish| Complete[handleFinish Function]

    Complete --> Hook[useOnboarding Hook<br/>completeOnboarding]
    Hook --> Service[OnboardingService<br/>completeOnboarding]
    Service --> Firestore[Firestore Update:<br/>showOnboarding = false<br/>firstTimeSetup = true<br/>onboardingCompletedDate = now]

    Firestore --> Success{Success?}
    Success -->|Yes| ResetStore[Reset Store State<br/>resetFlow]
    Success -->|No| Error[Error State<br/>Display Error<br/>Allow Retry]

    ResetStore --> Navigate[Navigate to<br/>PROJECTS_INDEX]
    Navigate --> NavGuard2[Navigation Guard<br/>Re-evaluates]
    NavGuard2 -->|Priority 60| SetupRedirect[Redirect to<br/>SETUP_INDEX<br/>if firstTimeSetup=true]
    NavGuard2 -->|Priority 10| ProjectsScreen[Stay at<br/>PROJECTS_INDEX]

    Error --> Retry[Retry Button<br/>clearError + retry]
    Retry --> Complete

    style PaidScreen fill:#fff4e1
    style B1Slideshow fill:#ffe0b2
    style Complete fill:#c8e6c9
    style Firestore fill:#fff9c4
    style SetupRedirect fill:#ffccbc
```

### Flow B1 - State Variables

| Variable               | Location                   | Type                         | Values     | Description                |
| ---------------------- | -------------------------- | ---------------------------- | ---------- | -------------------------- |
| `flowBStep`            | Store (useOnboardingStore) | 'B1' \| 'B2' \| 'B3' \| null | 'B1'       | Determines which paid flow |
| `currentStep`          | Store (useOnboardingStore) | number                       | 0-4        | Current slide index        |
| `subscription.plan`    | Firestore                  | SubscriptionPlan             | BASIC      | Determines flow B1         |
| `subscription.status`  | Firestore                  | SubscriptionStatus           | ACTIVE     | Must be ACTIVE             |
| `setup.showOnboarding` | Firestore                  | boolean                      | true/false | Must be true to enter flow |
| `setup.firstTimeSetup` | Firestore                  | boolean                      | true/false | Set to true on completion  |

---

## Flow B2 - Pro/Studio Plan Onboarding

```mermaid
graph TB
    Start([Navigation Guard<br/>Priority 62 Rule]) --> Condition{Check Conditions}

    Condition -->|Status = ACTIVE<br/>showOnboarding = true<br/>Plan = PRO or STUDIO| PaidScreen[paidSubscription.tsx<br/>OnboardingPaidScreen]

    PaidScreen --> StoreState[Store State:<br/>flowBStep: 'B2'<br/>currentStep: 0-4]

    StoreState -->|flowBStep = 'B2'| B2Slideshow[Slideshow Component<br/>B2: Pro/Studio Plan Slideshow]

    B2Slideshow --> B2Content[Content:<br/>PRO_PLAN_SLIDES<br/>5 slides:<br/>1. Pro: Client Portals<br/>2. Pro: Smart Shot Lists<br/>3. Pro: Vendor Lists<br/>4. Pro: Custom Branding<br/>5. Pro: You're a Pro!]

    B2Content --> B2Controls[Controls:<br/>- Skip Button: Top Right<br/>- Back Button: Disabled on first slide<br/>- Next/Proceed Button<br/>- Progress Dots: 5 dots<br/>- Auto-play: 5s per slide]

    B2Controls -->|Next| B2Next[Store: nextStep<br/>Increment currentStep<br/>Auto-advance after 5s]
    B2Controls -->|Back| B2Back[Store: prevStep<br/>Decrement currentStep<br/>Min: 0]
    B2Controls -->|Skip/Finish| Complete[handleFinish Function]

    Complete --> Hook[useOnboarding Hook<br/>completeOnboarding]
    Hook --> Service[OnboardingService<br/>completeOnboarding]
    Service --> Firestore[Firestore Update:<br/>showOnboarding = false<br/>firstTimeSetup = true<br/>onboardingCompletedDate = now]

    Firestore --> Success{Success?}
    Success -->|Yes| ResetStore[Reset Store State<br/>resetFlow]
    Success -->|No| Error[Error State<br/>Display Error<br/>Allow Retry]

    ResetStore --> Navigate[Navigate to<br/>PROJECTS_INDEX]
    Navigate --> NavGuard2[Navigation Guard<br/>Re-evaluates]
    NavGuard2 -->|Priority 60| SetupRedirect[Redirect to<br/>SETUP_INDEX<br/>if firstTimeSetup=true]
    NavGuard2 -->|Priority 10| ProjectsScreen[Stay at<br/>PROJECTS_INDEX]

    Error --> Retry[Retry Button<br/>clearError + retry]
    Retry --> Complete

    style PaidScreen fill:#ffe1f5
    style B2Slideshow fill:#f8bbd0
    style Complete fill:#c8e6c9
    style Firestore fill:#fff9c4
    style SetupRedirect fill:#ffccbc
```

### Flow B2 - State Variables

| Variable               | Location                   | Type                         | Values      | Description                |
| ---------------------- | -------------------------- | ---------------------------- | ----------- | -------------------------- |
| `flowBStep`            | Store (useOnboardingStore) | 'B1' \| 'B2' \| 'B3' \| null | 'B2'        | Determines which paid flow |
| `currentStep`          | Store (useOnboardingStore) | number                       | 0-4         | Current slide index        |
| `subscription.plan`    | Firestore                  | SubscriptionPlan             | PRO, STUDIO | Determines flow B2         |
| `subscription.status`  | Firestore                  | SubscriptionStatus           | ACTIVE      | Must be ACTIVE             |
| `setup.showOnboarding` | Firestore                  | boolean                      | true/false  | Must be true to enter flow |
| `setup.firstTimeSetup` | Firestore                  | boolean                      | true/false  | Set to true on completion  |

---

## Flow B3 - Expiring Subscription Warning

```mermaid
graph TB
    Start([Navigation Guard<br/>Priority 90 Rule]) --> Condition{Check Conditions}

    Condition -->|Plan != FREE<br/>autoRenew = false<br/>endDate exists<br/>Days until expiry: 14,10,7,3,2,1<br/>!hasSeenExpiryWarning| ExpiringScreen[expiringSubscription.tsx<br/>OnboardingExpiringSubscriptionScreen]

    ExpiringScreen --> B3Splash[DynamicSplash Component<br/>B3: Expiry Warning Splash]

    B3Splash --> B3Content[Content:<br/>Title: 'Subscription Notice'<br/>Description: Expiry warning message<br/>showAutoRenew: true]

    B3Content --> B3Data[Dynamic Data Cards:<br/>- Trial Days Remaining: If trialEndsAt exists<br/>- Auto-Renew Status: 'On' or 'Off'<br/>- Promo Code: If available]

    B3Data --> B3Buttons[Buttons:<br/>- Manage Subscription: Navigate to /account/subscription<br/>- Proceed: handleFinish]

    B3Buttons -->|Proceed| Complete[handleFinish Function]
    B3Buttons -->|Manage Subscription| SubScreen[Navigate to<br/>/account/subscription]

    Complete --> Hook[useOnboarding Hook<br/>completeOnboarding]
    Hook --> Service[OnboardingService<br/>completeOnboarding]
    Service --> Firestore[Firestore Update:<br/>showOnboarding = false<br/>onboardingCompletedDate = now<br/>Note: firstTimeSetup unchanged]

    Firestore --> Success{Success?}
    Success -->|Yes| ResetStore[Reset Store State<br/>resetFlow]
    Success -->|No| Error[Error State<br/>Display Error<br/>Allow Retry]

    ResetStore --> SessionFlag[Set Session Flag:<br/>hasSeenExpiryWarning = true]
    SessionFlag --> Navigate[Navigate to<br/>PROJECTS_INDEX]
    Navigate --> NavGuard2[Navigation Guard<br/>Re-evaluates]
    NavGuard2 -->|Priority 10| ProjectsScreen[Stay at<br/>PROJECTS_INDEX<br/>No setup redirect]

    Error --> Retry[Retry Button<br/>clearError + retry]
    Retry --> Complete

    style ExpiringScreen fill:#ffe1e1
    style B3Splash fill:#ffcdd2
    style Complete fill:#c8e6c9
    style Firestore fill:#fff9c4
    style SessionFlag fill:#e1bee7
```

### Flow B3 - State Variables

| Variable                            | Location   | Type               | Values             | Description               |
| ----------------------------------- | ---------- | ------------------ | ------------------ | ------------------------- |
| `subscription.plan`                 | Firestore  | SubscriptionPlan   | BASIC, PRO, STUDIO | Must not be FREE          |
| `subscription.status`               | Firestore  | SubscriptionStatus | ACTIVE, TRIALING   | Active subscription       |
| `subscription.autoRenew`            | Firestore  | boolean            | false              | Must be false             |
| `subscription.endDate`              | Firestore  | Date               | Date object        | Required for expiry check |
| `subscription.trialEndsAt`          | Firestore  | Date \| null       | Date or null       | Displayed if exists       |
| `sessionFlags.hasSeenExpiryWarning` | Session    | boolean            | true/false         | Set to true on match      |
| `daysUntilExpiry`                   | Calculated | number             | 14,10,7,3,2,1      | Must match warning days   |

---

## Navigation Flow - Before & After

```mermaid
graph TB
    subgraph "Before Onboarding"
        BeforeStart([User Authenticated]) --> BeforeNav[Navigation Guard<br/>Evaluates Rules]
        BeforeNav --> BeforeCheck{Check User State}

        BeforeCheck -->|Plan = FREE<br/>!hasSeenFreeWelcome| BeforeFree[Route to<br/>ONBOARDING_FREE]
        BeforeCheck -->|Status = ACTIVE<br/>showOnboarding = true<br/>Plan = BASIC| BeforeBasic[Route to<br/>ONBOARDING_PAID<br/>flowBStep = 'B1']
        BeforeCheck -->|Status = ACTIVE<br/>showOnboarding = true<br/>Plan = PRO/STUDIO| BeforePro[Route to<br/>ONBOARDING_PAID<br/>flowBStep = 'B2']
        BeforeCheck -->|Expiring Soon<br/>autoRenew = false| BeforeExpiring[Route to<br/>ONBOARDING_EXPIRING]
    end

    subgraph "During Onboarding"
        DuringFree[freeSubscription.tsx] --> DuringFreeA1[A1: Splash]
        DuringFreeA1 --> DuringFreeA2[A2: Slideshow]

        DuringPaid[paidSubscription.tsx] --> DuringPaidB1{B1/B2/B3?}
        DuringPaidB1 -->|B1| DuringB1[B1: Basic Slideshow]
        DuringPaidB1 -->|B2| DuringB2[B2: Pro Slideshow]
        DuringPaidB1 -->|B3| DuringB3[B3: Expiry Splash]

        DuringExpiring[expiringSubscription.tsx] --> DuringB3
    end

    subgraph "After Onboarding"
        AfterComplete[Complete Onboarding] --> AfterUpdate[Firestore Update:<br/>showOnboarding = false<br/>firstTimeSetup = true]
        AfterUpdate --> AfterNav[Navigate to<br/>PROJECTS_INDEX]
        AfterNav --> AfterGuard[Navigation Guard<br/>Re-evaluates]
        AfterGuard --> AfterCheck{firstTimeSetup<br/>= true?}
        AfterCheck -->|Yes| AfterSetup[Redirect to<br/>SETUP_INDEX<br/>Priority 60]
        AfterCheck -->|No| AfterProjects[Stay at<br/>PROJECTS_INDEX<br/>Priority 10]
    end

    BeforeFree --> DuringFree
    BeforeBasic --> DuringPaid
    BeforePro --> DuringPaid
    BeforeExpiring --> DuringExpiring

    DuringFreeA2 --> AfterComplete
    DuringB1 --> AfterComplete
    DuringB2 --> AfterComplete
    DuringB3 --> AfterComplete

    style BeforeFree fill:#e1f5ff
    style BeforeBasic fill:#fff4e1
    style BeforePro fill:#ffe1f5
    style BeforeExpiring fill:#ffe1e1
    style AfterComplete fill:#c8e6c9
    style AfterSetup fill:#ffccbc
```

---

## Component Architecture

```mermaid
graph TB
    subgraph "Screen Components"
        FreeScreen[freeSubscription.tsx<br/>OnboardingFreeScreen]
        PaidScreen[paidSubscription.tsx<br/>OnboardingPaidScreen]
        ExpiringScreen[expiringSubscription.tsx<br/>OnboardingExpiringSubscriptionScreen]
    end

    subgraph "UI Components"
        DynamicSplash[DynamicSplash.tsx<br/>- Fetches subscription data<br/>- Displays trial days<br/>- Shows auto-renew status<br/>- Manage Subscription button<br/>- Proceed button]
        Slideshow[Slideshow.tsx<br/>- Auto-play timer<br/>- Progress dots<br/>- Next/Back buttons<br/>- Skip button<br/>- Sign Out button __DEV__]
        FeatureModal[FeatureOnboardingModal.tsx<br/>- Full-screen modal<br/>- Slideshow wrapper<br/>- Close button]
        Screen[Screen.tsx<br/>- Loading state<br/>- Error state<br/>- Retry handler]
    end

    subgraph "Hooks"
        UseOnboarding[use-onboarding.ts<br/>- completeOnboarding<br/>- generateDefaultData<br/>- LoadingState management<br/>- Error handling]
        UseUserSubscription[use-user-subscription.ts<br/>- Fetch subscription<br/>- Real-time updates]
        UseOnboardingStore[use-onboarding-store.ts<br/>- flowBStep<br/>- currentStep<br/>- nextStep/prevStep<br/>- resetFlow]
    end

    subgraph "Services"
        OnboardingService[onboarding-service.ts<br/>- completeOnboarding<br/>- generateDefaultData<br/>- markTutorialViewed]
        UserSubscriptionService[user-subscription-service.ts<br/>- getByUserId]
    end

    subgraph "Stores"
        AuthStore[use-auth-store.ts<br/>- user<br/>- loading]
        OnboardingStore[use-onboarding-store.ts<br/>- activeFlow<br/>- currentStep<br/>- flowBStep<br/>- featureModal]
    end

    FreeScreen --> DynamicSplash
    FreeScreen --> Slideshow
    FreeScreen --> Screen
    FreeScreen --> UseOnboarding
    FreeScreen --> OnboardingStore

    PaidScreen --> DynamicSplash
    PaidScreen --> Slideshow
    PaidScreen --> Screen
    PaidScreen --> UseOnboarding
    PaidScreen --> OnboardingStore

    ExpiringScreen --> DynamicSplash
    ExpiringScreen --> Screen
    ExpiringScreen --> UseOnboarding
    ExpiringScreen --> OnboardingStore

    DynamicSplash --> UseUserSubscription
    DynamicSplash --> AuthStore

    UseOnboarding --> OnboardingService
    UseUserSubscription --> UserSubscriptionService
    OnboardingService --> Firestore[(Firestore)]
    UserSubscriptionService --> Firestore

    style FreeScreen fill:#e1f5ff
    style PaidScreen fill:#fff4e1
    style ExpiringScreen fill:#ffe1e1
    style UseOnboarding fill:#c8e6c9
    style OnboardingStore fill:#fff9c4
```

---

## State Management Flow

```mermaid
graph TB
    subgraph "Firestore State"
        UserDoc[(User Document<br/>users/{userId})]
        SetupDoc[(UserSetup Document<br/>users/{userId}/setup/{setupId})]
        SubDoc[(UserSubscription Document<br/>users/{userId}/subscription/{subId})]
    end

    subgraph "Zustand Stores"
        AuthStore[use-auth-store<br/>- user: BaseUser<br/>- loading: boolean]
        OnboardingStore[use-onboarding-store<br/>- activeFlow: A or B or null<br/>- currentStep: number<br/>- flowBStep: B1 or B2 or B3 or null<br/>- featureModal: object]
    end

    subgraph "Local Component State"
        FreeLocal[freeSubscription.tsx<br/>- flowStep: 0 or 1<br/>- slideStep: 0-3]
        PaidLocal[paidSubscription.tsx<br/>- Uses store state only]
        ExpiringLocal[expiringSubscription.tsx<br/>- No local state]
    end

    subgraph "Hook State"
        OnboardingHook[use-onboarding<br/>- LoadingState: idle or loading or success or error<br/>- error: AppError or null]
        SubscriptionHook[use-user-subscription<br/>- LoadingState: idle or loading or success or error<br/>- subscription: UserSubscription or null]
    end

    UserDoc --> AuthStore
    SetupDoc --> AuthStore
    SubDoc --> SubscriptionHook

    AuthStore --> FreeLocal
    AuthStore --> PaidLocal
    AuthStore --> ExpiringLocal

    OnboardingStore --> PaidLocal
    OnboardingStore --> ExpiringLocal

    SubscriptionHook --> DynamicSplash
    OnboardingHook --> FreeLocal
    OnboardingHook --> PaidLocal
    OnboardingHook --> ExpiringLocal

    FreeLocal -->|completeOnboarding| OnboardingHook
    PaidLocal -->|completeOnboarding| OnboardingHook
    ExpiringLocal -->|completeOnboarding| OnboardingHook

    OnboardingHook -->|Updates| SetupDoc

    style UserDoc fill:#fff9c4
    style SetupDoc fill:#fff9c4
    style SubDoc fill:#fff9c4
    style OnboardingStore fill:#e1bee7
    style OnboardingHook fill:#c8e6c9
```

---

## Trigger Conditions Reference

### Navigation Guard Rules

```mermaid
graph TB
    subgraph "Priority 90: Expiry Warning"
        P90[Rule: subscription-expiry-warning]
        P90Cond{Conditions:<br/>- user exists<br/>- subscription exists<br/>- plan != FREE<br/>- autoRenew = false<br/>- endDate exists<br/>- !hasSeenExpiryWarning<br/>- daysUntilExpiry in 14,10,7,3,2,1}
        P90Cond -->|Match| P90Route[Route: ONBOARDING_EXPIRING]
        P90Cond -->|No Match| P90Next[Next Rule]
        P90 --> P90Cond
        P90Route --> P90Action[Set Flag:<br/>hasSeenExpiryWarning = true]
    end

    subgraph "Priority 65: Free Welcome"
        P65[Rule: free-plan-onboarding]
        P65Cond{Conditions:<br/>- user exists<br/>- subscription exists<br/>- plan = FREE<br/>- !hasSeenFreeWelcome}
        P65Cond -->|Match| P65Route[Route: ONBOARDING_FREE]
        P65Cond -->|No Match| P65Next[Next Rule]
        P65 --> P65Cond
        P65Route --> P65Action[Set Flag:<br/>hasSeenFreeWelcome = true]
    end

    subgraph "Priority 62: Active Onboarding"
        P62[Rule: active-onboarding]
        P62Cond{Conditions:<br/>- subscription exists<br/>- status = ACTIVE<br/>- setup.showOnboarding = true}
        P62Cond -->|Match| P62Plan{Plan Type?}
        P62Plan -->|BASIC| P62B1[Route: ONBOARDING_PAID<br/>flowBStep = 'B1']
        P62Plan -->|PRO/STUDIO| P62B2[Route: ONBOARDING_PAID<br/>flowBStep = 'B2']
        P62Cond -->|No Match| P62Next[Next Rule]
        P62 --> P62Cond
    end

    subgraph "Priority 50: Trialing Onboarding"
        P50[Rule: trialing-onboarding]
        P50Cond{Conditions:<br/>- subscription exists<br/>- status = TRIALING<br/>- setup.showOnboarding = true}
        P50Cond -->|Match| P50Route[Route: ONBOARDING_FREE]
        P50Cond -->|No Match| P50Next[Next Rule]
        P50 --> P50Cond
    end

    P90Next --> P65
    P65Next --> P62
    P62Next --> P50
    P50Next --> Default[Priority 10:<br/>Default to PROJECTS_INDEX]

    style P90 fill:#ffe1e1
    style P65 fill:#e1f5ff
    style P62 fill:#fff4e1
    style P50 fill:#e1f5ff
```

### Subscription Plan Values

| Plan   | Value      | Trial Days | Onboarding Flow      |
| ------ | ---------- | ---------- | -------------------- |
| NONE   | `'NONE'`   | 0          | No onboarding        |
| FREE   | `'FREE'`   | 5          | Flow A (Free)        |
| BASIC  | `'BASIC'`  | 14         | Flow B1 (Basic)      |
| PRO    | `'PRO'`    | 14         | Flow B2 (Pro/Studio) |
| STUDIO | `'STUDIO'` | 28         | Flow B2 (Pro/Studio) |

### Subscription Status Values

| Status    | Value         | Onboarding Eligibility                      |
| --------- | ------------- | ------------------------------------------- |
| NONE      | `'NONE'`      | No onboarding                               |
| INACTIVE  | `'INACTIVE'`  | No onboarding (routed to payment)           |
| ACTIVE    | `'ACTIVE'`    | Flow B1/B2 if showOnboarding=true           |
| PAST_DUE  | `'PAST_DUE'`  | No onboarding (routed to payment)           |
| EXPIRED   | `'EXPIRED'`   | No onboarding                               |
| CANCELLED | `'CANCELLED'` | No onboarding (routed to subscription gate) |

**Note:** Trial users have `status=ACTIVE` with `isTrial=true`. They see Flow A (Free) onboarding if `showOnboarding=true`. FREE trial users with verified emails and `firstTimeSetup=true` will have their lists auto-populated from master data.

### UserSetup Flags

| Flag                       | Type         | Default | Description                                      |
| -------------------------- | ------------ | ------- | ------------------------------------------------ |
| `showOnboarding`           | boolean      | true    | Must be true to enter any onboarding flow        |
| `firstTimeSetup`           | boolean      | true    | Set to true on completion, triggers setup wizard |
| `onboardingCompletedDate`  | Date \| null | null    | Timestamp when onboarding completed              |
| `viewedTutorials`          | string[]     | []      | Array of tutorial IDs viewed (for Option C)      |
| `skippedEmailVerification` | boolean      | false   | Affects email verification routing               |

### Session Flags

| Flag                   | Type    | Default | Description                                     |
| ---------------------- | ------- | ------- | ----------------------------------------------- |
| `hasSeenFreeWelcome`   | boolean | false   | Prevents repeat free onboarding in same session |
| `hasSeenExpiryWarning` | boolean | false   | Prevents repeat expiry warning in same session  |

---

## Component Button Actions

### DynamicSplash Component

| Button                  | Action                                   | Destination/Effect                              |
| ----------------------- | ---------------------------------------- | ----------------------------------------------- |
| **Manage Subscription** | `router.push('/(account)/subscription')` | Navigate to subscription management screen      |
| **Proceed**             | `onProceed()` callback                   | Calls parent's proceed handler (varies by flow) |

### Slideshow Component

| Button                      | Action                     | Destination/Effect                                   |
| --------------------------- | -------------------------- | ---------------------------------------------------- |
| **Skip** (Top Right)        | `onSkip()` callback        | Calls parent's skip handler (usually same as finish) |
| **Back**                    | `onBack()` callback        | Decrements step (disabled on first slide)            |
| **Next** / **Proceed**      | `onNext()` or `onFinish()` | Advances step or completes onboarding                |
| **Sign Out** (**DEV** only) | `auth.signOut()`           | Signs out user (testing only)                        |

### Screen Component Wrapper

| Element               | Action               | Destination/Effect                         |
| --------------------- | -------------------- | ------------------------------------------ |
| **Loading Indicator** | Auto-displayed       | Shows when `loading=true`                  |
| **Error Message**     | Auto-displayed       | Shows when `error!=null`                   |
| **Retry Button**      | `onRetry()` callback | Calls `clearError()` and retries operation |

---

## Complete Flow Decision Tree

```mermaid
graph TB
    Start([User Authenticated]) --> EmailCheck{Email Verified?}

    EmailCheck -->|No| EmailVerify[Email Verification Screen<br/>Priority 101]
    EmailCheck -->|Yes| PlanCheck{Subscription Plan?}

    PlanCheck -->|NONE| NoPlan[No Plan Pricing<br/>Priority 99]
    PlanCheck -->|FREE| FreeCheck{hasSeenFreeWelcome?}
    PlanCheck -->|BASIC| BasicCheck{Status & showOnboarding?}
    PlanCheck -->|PRO/STUDIO| ProCheck{Status & showOnboarding?}

    FreeCheck -->|No| FreeOnboarding[Flow A: Free Onboarding<br/>Priority 65]
    FreeCheck -->|Yes| FreeProjects[Projects Index<br/>Priority 10]

    BasicCheck -->|ACTIVE & showOnboarding=true| BasicOnboarding[Flow B1: Basic Onboarding<br/>Priority 62]
    BasicCheck -->|Other| BasicExpiry{Expiring Soon?}
    BasicCheck -->|Other| BasicProjects[Projects Index]

    ProCheck -->|ACTIVE & showOnboarding=true| ProOnboarding[Flow B2: Pro Onboarding<br/>Priority 62]
    ProCheck -->|Other| ProExpiry{Expiring Soon?}
    ProCheck -->|Other| ProProjects[Projects Index]

    BasicExpiry -->|Yes & autoRenew=false| ExpiringOnboarding[Flow B3: Expiry Warning<br/>Priority 90]
    BasicExpiry -->|No| BasicProjects

    ProExpiry -->|Yes & autoRenew=false| ExpiringOnboarding
    ProExpiry -->|No| ProProjects

    FreeOnboarding --> CompleteFree[Complete:<br/>showOnboarding=false<br/>firstTimeSetup=true]
    BasicOnboarding --> CompleteBasic[Complete:<br/>showOnboarding=false<br/>firstTimeSetup=true]
    ProOnboarding --> CompletePro[Complete:<br/>showOnboarding=false<br/>firstTimeSetup=true]
    ExpiringOnboarding --> CompleteExpiring[Complete:<br/>showOnboarding=false<br/>hasSeenExpiryWarning=true]

    CompleteFree --> SetupCheck{firstTimeSetup=true?}
    CompleteBasic --> SetupCheck
    CompletePro --> SetupCheck
    CompleteExpiring --> ProjectsFinal[Projects Index<br/>No setup]

    SetupCheck -->|Yes| SetupWizard[Setup Wizard<br/>Priority 60]
    SetupCheck -->|No| ProjectsFinal

    style FreeOnboarding fill:#e1f5ff
    style BasicOnboarding fill:#fff4e1
    style ProOnboarding fill:#ffe1f5
    style ExpiringOnboarding fill:#ffe1e1
    style CompleteFree fill:#c8e6c9
    style CompleteBasic fill:#c8e6c9
    style CompletePro fill:#c8e6c9
    style CompleteExpiring fill:#c8e6c9
    style SetupWizard fill:#ffccbc
```

---

## Summary

This document provides comprehensive diagrams showing:

1. **All onboarding flows** (A, B1, B2, B3) with detailed state management
2. **Navigation triggers** based on subscription plan, status, and user setup flags
3. **Component architecture** showing relationships between screens, components, hooks, and services
4. **State flow** from Firestore through stores to components
5. **Button actions** and their effects
6. **Complete decision tree** for routing users to appropriate onboarding flows

All flows follow the same pattern:

- **Entry**: Navigation guard evaluates conditions
- **Execution**: Screen renders appropriate components based on state
- **Completion**: Hook calls service to update Firestore
- **Exit**: Navigation guard re-evaluates and routes to next screen (setup or projects)
