# Architecture & Navigation System - Comprehensive Guide

## Table of Contents

1. [Overview](#overview)
2. [Navigation System Architecture](#navigation-system-architecture)
3. [Routing Rules Engine](#routing-rules-engine)
4. [Navigation Guard System](#navigation-guard-system)
5. [Flow Routing Logic](#flow-routing-logic)
6. [Component Hierarchy](#component-hierarchy)
7. [Critical Issues](#critical-issues)
8. [Recommendations](#recommendations)

---

## Overview

The Eye-Doo navigation system uses a **priority-based routing engine** with:

- **Navigation Guards** that evaluate complex user states
- **Routing Rules** that determine screen transitions
- **Flow Routing Logic** that handles multi-step flows
- **Smart Redirects** based on user status, subscriptions, and onboarding completion

**Architecture Style:** Ports & Adapters with clear separation of concerns

**Key Files:**
- `routing-rules.ts` - Defines routing rules with priorities
- `user-state-resolver.ts` - Resolves user state for routing
- `use-navigation-guard.ts` - Hook that applies routing rules
- `navigation-utils.ts` - Navigation utility functions
- `navigation.ts` - Route constants and navigation types

---

## Navigation System Architecture

```mermaid
graph TB
    subgraph "Decision Layer"
        A[AuthInitializer]
        B[NavigationGuard]
        C[RoutingRules]
    end
    
    subgraph "Resolution Layer"
        D[UserStateResolver]
        E[getRouteGroup]
        F[getDefaultRoute]
    end
    
    subgraph "Execution Layer"
        G[expo-router]
        H[Screen Navigation]
    end
    
    subgraph "Data Layer"
        I[AuthStore]
        J[Firestore]
        K[User State]
    end
    
    A --> K
    K --> I
    I --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    G --> H
    I --> D
    J --> K
    
    style B fill:#e1f5ff
    style C fill:#fff4e1
    style D fill:#f3e5f5
```

### Routing Priority System

Routes are evaluated in **priority order** (highest to lowest):

| Priority | Rule | Condition | Route |
|----------|------|-----------|-------|
| **101** | Email Verification Required | `!isEmailVerified` | `EMAIL_VERIFICATION` |
| **100** | Payment Verification Required | Payment not verified | `PAYMENT_VERIFICATION` |
| **99** | No Subscription | `!subscription` | `PRICING` |
| **90** | Subscription Expiring | Days until expiry ≤ 14 | `ONBOARDING_EXPIRING` |
| **80** | Subscription Inactive | `status !== ACTIVE` | `PAYMENT` |
| **75** | Past Due Payment | `status === PAST_DUE` | `PAYMENT` |
| **70** | Subscription Cancelled | `status === CANCELLED` | `SUBSCRIPTION_GATE` |
| **65** | Free Plan Onboarding | `plan === FREE && !hasSeenFreeWelcome` | `ONBOARDING_FREE` |
| **62** | Paid Onboarding | `status === ACTIVE && showOnboarding` | `ONBOARDING_PAID` |
| **60** | First Time Setup | `firstTimeSetup === true` | `SETUP_INDEX` |
| **50** | Dashboard Guard | Project selection | `PROJECTS_INDEX` or dashboard |
| **10** | Default | All conditions met | `PROJECTS_INDEX` |

---

## Navigation System Architecture

### Complete Flow Diagram

```mermaid
flowchart TD
    Start([User Authenticated]) --> AuthInit[AuthInitializer<br/>- Check currentUser<br/>- Fetch profile/subscription/setup]
    
    AuthInit --> Store[Update AuthStore<br/>- setUser<br/>- setSubscription<br/>- setSetup]
    
    Store --> NavGuard[NavigationGuard<br/>Evaluates Routing Rules]
    
    NavGuard --> R1{Rule 101<br/>Email Verified?}
    R1 -->|No| EmailScreen[Route:<br/>EMAIL_VERIFICATION]
    R1 -->|Yes| R2{Rule 99<br/>Has Plan?}
    
    R2 -->|No| PricingScreen[Route:<br/>PRICING]
    R2 -->|Yes| R3{Rule 90<br/>Expiring Soon?}
    
    R3 -->|Yes| ExpiringScreen[Route:<br/>ONBOARDING_EXPIRING]
    R3 -->|No| R4{Rule 80<br/>Status ACTIVE?}
    
    R4 -->|No| PaymentScreen[Route:<br/>PAYMENT]
    R4 -->|Yes| R5{Rule 65<br/>Free + New?}
    
    R5 -->|Yes| FreeOnboardingScreen[Route:<br/>ONBOARDING_FREE]
    R5 -->|No| R6{Rule 62<br/>Show Onboarding?}
    
    R6 -->|Yes| PaidOnboardingScreen[Route:<br/>ONBOARDING_PAID]
    R6 -->|No| R7{Rule 60<br/>Setup Needed?}
    
    R7 -->|Yes| SetupScreen[Route:<br/>SETUP_INDEX]
    R7 -->|No| ProjectsScreen[Route:<br/>PROJECTS_INDEX]
    
    EmailScreen --> End([Screen Rendered])
    PricingScreen --> End
    ExpiringScreen --> End
    PaymentScreen --> End
    FreeOnboardingScreen --> End
    PaidOnboardingScreen --> End
    SetupScreen --> End
    ProjectsScreen --> End
    
    style Start fill:#4dabf7
    style NavGuard fill:#ffd43b
    style End fill:#51cf66
```

---

## Routing Rules Engine

### Rule Structure

```typescript
interface RoutingRule {
  name: string;                          // Rule identifier
  priority: number;                      // Evaluation order (101 = highest)
  targetRouteGroup: NavigationRouteGroup;  // Where to navigate
  condition: (state) => boolean;         // When to apply rule
}
```

### State Resolver

The `UserStateResolver` evaluates the following conditions:

```typescript
interface ResolvedUserState {
  state: UserAuthState;                  // UNAUTHENTICATED, AUTHENTICATING, AUTHENTICATED
  redirectPath?: NavigationRoute;        // Where to redirect
  needsOnboarding: boolean;              // User needs onboarding
  needsSetup: boolean;                   // User needs setup
  needsEmailVerification: boolean;       // User must verify email
  permissionLevel: PermissionLevel;      // User's access level
  context: {                             // Additional context
    isEmailVerified: boolean;
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    isTrial: boolean;
    firstTimeSetup: boolean;
    showOnboarding: boolean;
    daysUntilExpiry: number | null;
  }
}
```

### Rule Evaluation Process

```mermaid
sequenceDiagram
    participant Guard as NavigationGuard
    participant Rules as RoutingRules
    participant Resolver as UserStateResolver
    participant Router as ExpoRouter

    Guard->>Resolver: resolveUserState(user, subscription, setup)
    Resolver->>Resolver: Check all conditions
    Resolver-->>Guard: ResolvedUserState
    
    Guard->>Rules: getRulesSorted() - by priority DESC
    Rules-->>Guard: [Rule101, Rule100, ..., Rule10]
    
    loop For each rule
        Guard->>Guard: Evaluate rule.condition(state)
        alt Condition met
            Guard->>Router: navigate(rule.targetRoute)
            Guard->>Guard: Break (route found)
        else Condition not met
            Guard->>Guard: Continue to next rule
        end
    end
```

---

## Navigation Guard System

### Hook: useNavigationGuard

**Location:** `src/hooks/use-navigation-guard.ts`

**Purpose:** Evaluates routing rules and redirects users appropriately

**Features:**
- Real-time user state monitoring
- Automatic navigation on state changes
- Error recovery with retry logic
- Development mode debugging

**Usage:**

```typescript
// In layout component
function ProtectedLayout() {
  useNavigationGuard();
  return <Slot />;
}
```

### Navigation Flow

```mermaid
graph TB
    A[useNavigationGuard Hook] --> B[useUserState]
    B --> C{State Changed?}
    C -->|Yes| D[resolveUserState]
    D --> E[getRulesSorted]
    E --> F[Evaluate Rules]
    F --> G{Rule Match?}
    G -->|Yes| H[Navigate]
    G -->|No| I[Continue]
    I --> F
    C -->|No| J[No Action]
    H --> K[Log Navigation]
    K --> L{Success?}
    L -->|Yes| M[User Navigated]
    L -->|No| N[Handle Error]
```

---

## Flow Routing Logic

### Onboarding Flow Routing

```mermaid
graph TB
    Start[Navigation Guard<br/>Rule Priority 65 & 62] --> Check{Check Plan Type}
    
    Check -->|FREE Plan| FreeCheck{hasSeenFreeWelcome?}
    Check -->|BASIC/PRO/STUDIO| PaidCheck{showOnboarding?}
    
    FreeCheck -->|No| FreeOnboard[Route to<br/>ONBOARDING_FREE]
    FreeCheck -->|Yes| SkipFree[Skip to next rule]
    
    PaidCheck -->|Yes| PaidOnboard[Route to<br/>ONBOARDING_PAID]
    PaidCheck -->|No| SkipPaid[Skip to next rule]
    
    FreeOnboard --> HandleFree[freeSubscription.tsx<br/>A1: Splash → A2: Slides]
    PaidOnboard --> HandlePaid[paidSubscription.tsx<br/>B1/B2/B3: Slides]
    
    HandleFree --> Complete1[showOnboarding = false]
    HandlePaid --> Complete2[showOnboarding = false]
    
    Complete1 --> Redirect[Navigate to<br/>PROJECTS_INDEX]
    Complete2 --> Redirect
    
    Redirect --> ReEval[Navigation Guard<br/>Re-evaluates]
    ReEval --> Setup{firstTimeSetup?}
    Setup -->|Yes| SetupFlow[Route to<br/>SETUP_INDEX]
    Setup -->|No| Projects[Stay at<br/>PROJECTS_INDEX]
```

### Setup Flow Routing

```mermaid
graph TB
    Start[Rule Priority 60<br/>firstTimeSetup = true] --> Route[Navigate to<br/>SETUP_INDEX]
    
    Route --> SetupWizard[SetupWizard Component]
    
    SetupWizard --> CheckUser{User Type?}
    
    CheckUser -->|FREE_UNVERIFIED| Auto1[Auto-Create:<br/>All Lists]
    CheckUser -->|FREE_VERIFIED| Auto2[Auto-Create:<br/>Task + Group]
    CheckUser -->|PAID| Manual[Manual Setup<br/>Available]
    
    Auto1 --> Complete1[firstTimeSetup = false]
    Auto2 --> Complete2[firstTimeSetup = false]
    Manual --> Complete3[firstTimeSetup = false]
    
    Complete1 --> Projects[Navigate to<br/>PROJECTS_INDEX]
    Complete2 --> Projects
    Complete3 --> Projects
```

---

## Component Hierarchy

### Layout Structure

```mermaid
graph TB
    RootLayout[RootLayout<br/>Root App Container]
    
    RootLayout --> AuthLayout[AuthLayout<br/>Authentication Layout]
    RootLayout --> ProtectedLayout[ProtectedLayout<br/>Protected Screens]
    RootLayout --> OnboardingLayout[OnboardingLayout<br/>Onboarding Layout]
    RootLayout --> SetupLayout[SetupLayout<br/>Setup Layout]
    RootLayout --> AppLayout[AppLayout<br/>Main App Layout]
    
    AuthLayout --> AuthScreens[Welcome<br/>SignUp<br/>SignIn]
    
    ProtectedLayout --> EmailScreen[EmailVerification]
    ProtectedLayout --> PaymentScreen[Payment]
    ProtectedLayout --> PricingScreen[Pricing]
    
    OnboardingLayout --> OnboardingScreens[OnboardingFree<br/>OnboardingPaid<br/>OnboardingExpiring]
    
    SetupLayout --> SetupScreens[SetupWizard<br/>SetupIndex]
    
    AppLayout --> AppScreens[ProjectsIndex<br/>Dashboard<br/>Settings]
    
    style RootLayout fill:#4dabf7
    style AuthLayout fill:#b3e5fc
    style ProtectedLayout fill:#b3e5fc
    style OnboardingLayout fill:#fff9c4
    style SetupLayout fill:#ffe0b2
    style AppLayout fill:#51cf66
```

### Screen Routes

**Auth Routes:**
- `/(auth)/welcome` - Welcome screen
- `/(auth)/signUp` - Registration
- `/(auth)/signIn` - Sign in

**Protected Routes:**
- `/(protected)/email-verification` - Email verification
- `/(protected)/pricing` - Plan selection
- `/(protected)/payment` - Payment processing

**Onboarding Routes:**
- `/(onboarding)/free` - Free plan onboarding
- `/(onboarding)/paid` - Paid plan onboarding
- `/(onboarding)/expiring` - Subscription expiry warning

**Setup Routes:**
- `/(setup)/index` - Setup wizard

**App Routes:**
- `/(app)/projects` - Projects list
- `/(app)/dashboard/:projectId` - Project dashboard
- `/(app)/settings` - Settings

---

## Critical Issues

### 🔴 Critical Bugs

#### 1. Type Mismatch in Navigation Guard (Line 70)

**Issue:** `rule.targetRoute` doesn't exist, should use `rule.targetRouteGroup`

**Impact:** Navigation will fail at runtime

**Fix:**
```typescript
const targetRoute = state.redirectPath || 
  getDefaultRouteForGroup(rule.targetRouteGroup);
```

#### 2. Syntax Error in Debug Code (Line 84)

**Issue:** Missing opening brace in `if (__DEV__)` block

**Impact:** Code will not compile

**Fix:** Add missing brace

#### 3. Missing userId Property (Line 111)

**Issue:** `state.context.userId` doesn't exist on `ResolvedUserState`

**Impact:** Trial list population fails

**Fix:** Get userId from auth store instead

#### 4. Non-existent Method Call (Line 113)

**Issue:** `ensureTrialUserList` method doesn't exist on service

**Impact:** Feature fails silently

### 🟡 Redundant Code

#### 1. Duplicate SubPage Lookup Logic

**Files:** `navigation-utils.ts` and `use-navigation-utils.ts`

**Issue:** Both functions duplicate same lookup

**Recommendation:** Extract to shared utility

#### 2. Unused Functions

**Unused in codebase:**
- `getStepPath(stepId)`
- `validateRoute(route)`
- `getSubPageRoute(groupId, pageId)`

**Recommendation:** Remove or document purpose

### 🟠 Architectural Issues

#### 1. Inconsistent Pathname Checks

**Problem:** Mix of:
- `isPathnameInGroup(pathname, group)` ✅
- Hardcoded strings like `pathname.startsWith('/(auth)')` ❌

**Fix:** Use consistent helper functions everywhere

#### 2. Missing RouteGroup to NavigationRoute Conversion

**Problem:** Rules return `RouteGroup` but navigation needs `NavigationRoute`

**Fix:** Add `getDefaultRouteForGroup()` utility

#### 3. Overlapping Responsibilities

**Problem:** Logic split across multiple files making flow unclear

**Fix:** Consolidate navigation logic with clear responsibilities

---

## Recommendations

### Priority 1: Critical Fixes

1. ✅ Fix syntax error in navigation guard
2. ✅ Fix type mismatches (targetRoute)
3. ✅ Fix missing property access (userId)
4. ✅ Add missing type guards for route validation

### Priority 2: Code Cleanup

1. Remove unused functions
2. Extract duplicate SubPage lookup logic
3. Replace hardcoded pathname strings with helpers
4. Fix import organization (move to top)
5. Remove magic numbers (500ms → constant)

### Priority 3: Architecture Improvements

1. Add `getDefaultRouteForGroup()` utility
2. Simplify navigation guard responsibilities
3. Standardize error handling
4. Add comprehensive logging in dev mode
5. Document routing rules priority system

### Priority 4: Testing

1. Unit test navigation guard logic
2. Test all routing rules
3. Test state resolver conditions
4. Test error recovery paths
5. Integration tests for complete flows

---

## Files Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── welcome.tsx
│   │   ├── signUp.tsx
│   │   └── signIn.tsx
│   ├── (protected)/
│   ├── (onboarding)/
│   ├── (setup)/
│   └── (app)/
├── hooks/
│   ├── use-navigation-guard.ts
│   ├── use-navigation-utils.ts
│   └── use-router.ts
├── constants/
│   └── navigation/
│       ├── navigation.ts (routes, enums)
│       ├── routing-rules.ts (rules)
│       └── navigation-utils.ts (helpers)
└── utils/
    └── navigation-utils.ts (utilities)
```

---

**Last Updated:** June 22, 2026
**Analysis Source:** NAVIGATION_ANALYSIS_REPORT.md + GLOBAL-FLOW-B.md
