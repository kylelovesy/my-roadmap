# my-roadmap

A comprehensive documentation repository for the Eye-Doo application - a modern project management and planning platform built with React Native and Firebase.

## 📋 Overview

This repository contains:
- Complete system architecture documentation
- Feature flows and user journeys
- Authentication and subscription systems
- Data models and schemas
- Standards and best practices
- Navigation and routing logic

## 🚀 Quick Start Documentation

### Core Systems

- **[AUTH-SYSTEM.md](AUTH-SYSTEM.md)** - Complete authentication guide
  - Sign-up, sign-in, sign-out flows
  - Password reset and email verification
  - Rate limiting and error handling
  - Validation, sanitization, and security

- **[SUBSCRIPTION-PRICING.md](SUBSCRIPTION-PRICING.md)** - Subscription management
  - Free, Pro, and Studio plan details
  - Payment processing with Stripe
  - Subscription lifecycle
  - Trial periods and billing

- **[ONBOARDING-FLOWS.md](ONBOARDING-FLOWS.md)** - User onboarding
  - Verified and non-verified flows
  - Free vs paid user paths
  - Setup and customization
  - First-time user experience

### Architecture & Design

- **[ARCHITECTURE-NAVIGATION.md](ARCHITECTURE-NAVIGATION.md)** - Navigation system
  - Route structure and navigation guards
  - Flow routing logic
  - Screen transitions and navigation rules

- **[DATA-MODELS.md](DATA-MODELS.md)** - Complete schema documentation
  - User models
  - Subscription and preferences
  - Project and task structures
  - Relationship diagrams

### Standards & Best Practices

- **[standards-error-handling.md](standards-error-handling.md)** - Error handling standards
- **[standards-loading-states.md](standards-loading-states.md)** - Loading state patterns
- **[standards-store-patterns.md](standards-store-patterns.md)** - State management patterns
- **[Guide-Errors-Full.md](Guide-Errors-Full.md)** - Comprehensive error handling guide
- **[Guide-Loading.md](Guide-Loading.md)** - Loading state implementation guide

### Architecture Analysis

- **[GLOBAL-FLOW-B.md](GLOBAL-FLOW-B.md)** - Global application flow
- **[JUNE26-Mobile-Kit-Architecture.md](JUNE26-Mobile-Kit-Architecture.md)** - Kit system architecture
- **[JUNE26-Mobile-Location-Architecture.md](JUNE26-Mobile-Location-Architecture.md)** - Location system
- **[JUNE26-Mobile-Timeline-Architecture.md](JUNE26-Mobile-Timeline-Architecture.md)** - Timeline system
- **[NAVIGATION_ANALYSIS_REPORT.md](NAVIGATION_ANALYSIS_REPORT.md)** - Navigation analysis
- **[ISSUES_DIAGNOSIS.md](ISSUES_DIAGNOSIS.md)** - Known issues and diagnostics

## 🏗️ Architecture

### Tech Stack

- **Frontend:** React Native, TypeScript, Expo
- **State Management:** Zustand
- **Form Management:** React Hook Form + Zod
- **Backend:** Firebase (Auth, Firestore, Cloud Functions)
- **Payments:** Stripe integration
- **Styling:** NativeWind / Tailwind CSS

### Design Pattern: Ports & Adapters

The application follows **Hexagonal Architecture** with clear separation:

```
┌─────────────────┐
│    UI Layer     │  (Screens, Components)
├─────────────────┤
│   Hook Layer    │  (useSignUp, useSignIn, etc.)
├─────────────────┤
│  Service Layer  │  (AuthService, Business Logic)
├─────────────────┤
│ Repository Layer│  (Firebase, Firestore Adapters)
├─────────────────┤
│  Domain Layer   │  (Schemas, Types, Rules)
└─────────────────┘
```

### Key Principles

- **Result Pattern:** All async operations return `Result<T, AppError>` (never throw)
- **Type Safety:** Full TypeScript + Zod for runtime validation
- **Error Handling:** Centralized error mapping with user-friendly messages
- **Testability:** Each layer can be tested independently
- **Maintainability:** Clear responsibilities and dependencies

## 🔐 Authentication

### Sign-Up Process

1. User fills sign-up form (name, email, password, plan selection)
2. Client validates with Zod schema
3. Service layer validates again (defense in depth)
4. Repository sanitizes email, creates Firebase Auth user
5. Verification email sent (non-blocking)
6. Base user document created in Firestore
7. Cloud Function creates subscription and other collections
8. User can sign in immediately

### Sign-In Process

1. User enters email and password
2. Form validates input
3. Service checks rate limits
4. Repository authenticates with Firebase
5. Last login timestamp updated (non-blocking)
6. User data fetched from Firestore
7. Auth store updated with user info
8. App navigates to appropriate screen based on subscription status

### Security Features

- ✅ Rate limiting (3 signups/hr, 5 signins/15min)
- ✅ Email sanitization (trimmed, lowercased)
- ✅ Password complexity requirements (8+ chars, alphanumeric)
- ✅ Multi-layer validation
- ✅ Email verification before certain features
- ✅ Secure password storage (Firebase Auth)
- ✅ No sensitive data in error messages

## 💳 Subscription System

### Plan Types

| Feature | Free | Pro | Studio |
|---------|------|-----|--------|
| Projects | Limited | Unlimited | Unlimited |
| Collaborators | Solo | Up to 5 | Up to 20 |
| Storage | 1GB | 50GB | 500GB |
| Priority Support | - | ✓ | ✓ |
| Advanced Features | - | ✓ | ✓ |
| Custom Domain | - | - | ✓ |

### Subscription Flow

1. **FREE Plan:** Automatic, no payment needed
2. **PRO/STUDIO:** Requires payment via Stripe
3. **Trial Period:** 14 days free for paid plans
4. **Billing:** Monthly or Annual
5. **Renewal:** Automatic on renewal date
6. **Cancellation:** Self-service cancellation available

## 📱 User Flows

### Free User Flow

```
Sign Up (FREE plan)
  ↓
Sign In
  ↓
Verify Email (optional)
  ↓
Skip Onboarding (automatic)
  ↓
Projects Screen
```

### Paid User Flow

```
Sign Up (PRO/STUDIO)
  ↓
Sign In
  ↓
Verify Email
  ↓
Payment Screen
  ↓
Setup Screen
  ↓
Onboarding Flow
  ↓
Projects Screen
```

## 🛠️ Development

### Project Structure

```
src/
├── app/                    # Expo Router screens
├── components/             # Reusable React components
├── hooks/                  # Custom React hooks
├── services/              # Business logic layer
├── repositories/          # Data access layer
├── domain/               # Schemas and types
├── stores/               # Zustand stores
├── utils/                # Helper functions
├── constants/            # Constants and config
└── styles/               # Global styles
```

### Key Files

**Authentication:**
- `services/auth-service.ts` - Core auth logic
- `repositories/firestore/firestore-auth-repository.ts` - Firebase adapter
- `hooks/use-sign-up.ts`, `use-sign-in.ts` - Auth hooks
- `domain/user/auth.schema.ts` - Zod validation schemas

**State Management:**
- `stores/use-auth-store.ts` - Global auth state (Zustand)
- `stores/use-ui-store.ts` - UI state (toasts, modals)

**Error Handling:**
- `utils/error-mapper.ts` - Error type mapping
- `utils/error-context-builder.ts` - Error context
- `services/error-handler-service.ts` - Centralized handling

## 📊 Data Models

### User Document

```typescript
interface User {
  id: string;                              // Firebase Auth UID
  email: string;
  displayName: string;
  phone: string | null;
  role: 'USER' | 'ADMIN';
  isEmailVerified: boolean;
  isActive: boolean;
  isBanned: boolean;
  preferences: UserPreferences;            // Settings and options
  subscription: UserSubscription;          // Plan and billing
  setup: UserSetup;                        // Onboarding flags
  projects: UserProjects;                  // Project counters
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### Preferences

```typescript
interface UserPreferences {
  notifications: boolean;
  darkMode: boolean;
  language: 'ENGLISH' | 'SPANISH' | 'FRENCH';
  marketingConsent: boolean;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
}
```

### Subscription

```typescript
interface UserSubscription {
  plan: 'FREE' | 'PRO' | 'STUDIO';
  status: 'INACTIVE' | 'ACTIVE' | 'TRIALING' | 'CANCELLED';
  isActive: boolean;
  billingCycle: 'MONTHLY' | 'ANNUAL';
  startDate: Date;
  endDate: Date | null;
  nextBillingDate: Date | null;
  trialEndsAt: Date | null;
}
```

## 🧪 Testing

### Test Strategy

- **Unit Tests:** Service layer and utilities
- **Integration Tests:** Repository and service interaction
- **E2E Tests:** Complete user flows
- **Error Testing:** All error paths covered

### Example: Auth Flow

1. Form validation (unit)
2. Service validation (unit)
3. Repository interaction (integration)
4. Firebase auth (mocked)
5. State updates (integration)
6. Navigation (E2E)

## 📚 Documentation Standards

### What's Documented

- ✅ User flows and journeys
- ✅ System architecture
- ✅ Data models and schemas
- ✅ API and service boundaries
- ✅ Error handling patterns
- ✅ Security considerations

### How to Update

1. **File-based:** One feature = one doc file
2. **Mermaid Diagrams:** Visual flows and architecture
3. **Sequence Diagrams:** Multi-actor interactions
4. **Code Examples:** Actual implementation references
5. **Links:** Cross-references to related docs

## 🐛 Known Issues

See [ISSUES_DIAGNOSIS.md](ISSUES_DIAGNOSIS.md) for current issues and workarounds.

## 🔗 Dependencies

### Core Libraries

- `react-native` - Mobile UI framework
- `expo` - React Native development platform
- `zustand` - State management
- `react-hook-form` - Form state management
- `zod` - TypeScript validation
- `firebase` - Backend services
- `stripe-react-native` - Payment processing

### Development

- `typescript` - Type safety
- `prettier` - Code formatting
- `eslint` - Linting
- `jest` - Testing

## 📞 Support

### Documentation Issues

If you find:
- **Outdated info:** Check the "Last updated" date
- **Missing docs:** Check cross-references
- **Conflicting info:** Refer to code as source of truth

### Code Questions

Refer to inline code comments and:
1. Check the relevant documentation file
2. Look at test files for usage examples
3. Search for similar patterns in the codebase

## 📝 License

This documentation is internal to Eye-Doo and should not be shared externally.

---

**Last Updated:** June 22, 2026

**Next Review:** Quarterly
