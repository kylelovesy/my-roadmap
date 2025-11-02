Eye-Doo Application Framework: Comprehensive Project Documentation
Version: 2.1.0
Last Updated: December 2024
Status: Phase 2 - Foundation Complete, Moving to Production Readiness


Table of Contents
Executive Summary
Architecture Overview
System Architecture Diagrams
Completed Features
Outstanding Tasks
Data Flow Diagrams
Production Readiness Roadmap
Implementation Timeline
Technical Stack
File Structure
Patterns & Standards


Executive Summary
The Eye-Doo application is a React Native (Expo) event management application built with a Ports & Adapters (Hexagonal) Architecture. The foundation is complete with authentication, user management, project management, and core business logic implemented using TypeScript, Zod validation, and Firebase (Auth, Firestore, Storage).
Current Status
✅ Completed:

Complete authentication system (sign-up, sign-in, password reset, email verification)
User management with real-time subscriptions
Project creation and management
Timeline service with event validation
List management system (Kit, Tasks, Shots)
Comprehensive error handling system
Result pattern throughout
Service Factory dependency injection
Rate limiting for auth operations

⚠️ In Progress:

Production optimizations
Offline support
Analytics integration
Performance tuning

❌ Outstanding:

Firebase Auth persistence configuration
Image upload service generalization
Comprehensive test coverage
Production deployment configuration
Security audit
Key Metrics
Services: 12 core services implemented
Repositories: 9 Firestore repository adapters
Hooks: 13 React hooks for UI integration
Schemas: 19 Zod schemas for validation
Error Codes: Comprehensive error code registry
Architecture: Clean separation with Ports & Adapters


Architecture Overview
Core Principles
Ports & Adapters (Hexagonal Architecture)

Interfaces define contracts (Ports)
Concrete implementations are adapters
Services depend on interfaces, not implementations

Result Pattern

All async operations return Result<T, AppError>
No exceptions thrown in business logic
Type-safe error handling

Unidirectional Data Flow

Component → Hook → Service → Repository → Firestore

Type Safety First

TypeScript strict mode
Zod runtime validation
No any types

Explicit Error Handling

Structured error types
Context-aware error tracking
User-friendly error messages
Layer Responsibilities
Components Layer
UI presentation only
Uses hooks for data/state
No business logic
Hooks Layer
React state management
Loading state handling
Error handling integration
Optimistic updates
Services Layer
Business logic orchestration
Input validation (Zod)
Rate limiting
Cross-repository coordination
Repositories Layer
Data access only
Input sanitization
Firestore operations
Result mapping
Domain Layer
Schema definitions (Zod)
Type definitions
Error definitions
Business constants


System Architecture Diagrams
High-Level System Architecture
graph TB

    subgraph "Client Application (React Native/Expo)"

        A[UI Components]

        B[React Hooks]

        C[Zustand Stores]

        D[Services Layer]

        E[Repository Interfaces]

    end

    

    subgraph "Firebase Services"

        F[Firebase Auth]

        G[Cloud Firestore]

        H[Firebase Storage]

        I[Cloud Functions]

        J[Firebase Analytics]

    end

    

    subgraph "External Services"

        K[Rate Limiting]

        L[Error Logging]

    end

    

    A --> B

    B --> C

    B --> D

    C --> D

    D --> E

    E --> F

    E --> G

    E --> H

    D --> I

    D --> J

    D --> K

    D --> L

    

    style D fill:#e1f5ff

    style E fill:#fff4e1

    style F fill:#ffe1f5

    style G fill:#ffe1f5
Ports & Adapters Architecture Detail
graph LR

    subgraph "Application Core"

        A[AuthService]

        B[UserService]

        C[ProjectService]

        D[TimelineService]

        E[ListService]

    end

    

    subgraph "Ports (Interfaces)"

        F[IAuthRepository]

        G[IUserRepository]

        H[IProjectRepository]

        I[ITimelineRepository]

        J[IListRepository]

    end

    

    subgraph "Adapters (Implementations)"

        K[FirestoreAuthRepository]

        L[FirestoreUserRepository]

        M[FirestoreProjectRepository]

        N[FirestoreTimelineRepository]

        O[FirestoreListRepository]

    end

    

    subgraph "External"

        P[(Cloud Firestore)]

        Q[Firebase Auth]

    end

    

    A --> F

    B --> G

    C --> H

    D --> I

    E --> J

    

    F -.-> K

    G -.-> L

    H -.-> M

    I -.-> N

    J -.-> O

    

    K --> Q

    K --> P

    L --> P

    M --> P

    N --> P

    O --> P

    

    style F fill:#fff4e1

    style G fill:#fff4e1

    style H fill:#fff4e1

    style I fill:#fff4e1

    style J fill:#fff4e1

    style K fill:#e1f5ff

    style L fill:#e1f5ff

    style M fill:#e1f5ff

    style N fill:#e1f5ff

    style O fill:#e1f5ff
Service Factory Pattern
graph TB

    A[ServiceFactory] --> B[AuthService]

    A --> C[UserService]

    A --> D[ProjectService]

    A --> E[TimelineService]

    A --> F[ListService]

    A --> G[PortalService]

    A --> H[LocationService]

    A --> I[BusinessCardService]

    

    B --> J[authRepository]

    B --> K[userRepository]

    C --> K

    D --> L[projectRepository]

    D --> M[listRepositories]

    E --> N[timelineRepository]

    F --> M

    G --> O[portalRepository]

    H --> P[locationRepository]

    I --> Q[businessCardRepository]

    

    style A fill:#e1f5ff

    style B fill:#fff4e1

    style C fill:#fff4e1

    style D fill:#fff4e1


Completed Features
✅ Authentication System
Status: Complete
Files:

src/services/auth-service.ts
src/repositories/firestore/firestore-auth-repository.ts
src/hooks/use-sign-up.ts
src/hooks/use-sign-in.ts
src/components/auth/SignUpForm.tsx
src/components/auth/SignInForm.tsx

Features:

✅ User sign-up with email/password
✅ User sign-in with remember me
✅ Password reset flow (request & confirm)
✅ Password change
✅ Email verification
✅ Resend email verification
✅ Rate limiting (sign-up, sign-in, password reset, email verification)
✅ Input validation with Zod
✅ Error handling with user-friendly messages
✅ Auth state management (Zustand)

Implementation Details:

Uses Firebase Auth for authentication
Creates Firestore user document on sign-up
Handles orphaned auth accounts
Comprehensive error mapping from Firebase errors
✅ User Management System
Status: Complete
Files:

src/services/user-service.ts
src/repositories/firestore/firestore-user-repository.ts
src/hooks/use-user-profile.ts
src/hooks/use-user-realtime.ts
src/hooks/use-user-admin.ts

Features:

✅ Get user profile by ID
✅ Update user profile
✅ Update user preferences
✅ Update subscription details
✅ Update setup status
✅ Update last login timestamp
✅ Update email verification status
✅ Real-time user subscriptions
✅ Admin operations (get all users, update role, ban/unban, delete)
✅ User document creation with defaults

Implementation Details:

Flat document structure in Firestore
Server timestamps for audit fields
Real-time subscriptions with cleanup
Proper sanitization and validation
✅ Project Management System
Status: Complete
Files:

src/services/project-service.ts
src/repositories/firestore/firestore-project-repository.ts

Features:

✅ Create project with subcollection initialization
✅ Get project for launch
✅ Get projects for user
✅ Real-time project subscriptions
✅ Update project
✅ Delete project (basic implementation)
✅ Automatic list copying (Kit, Tasks, Shots)

Implementation Details:

Orchestrates multiple repository operations
Handles partial failures gracefully
Aggregated error reporting
Proper initialization order
✅ Timeline Service
Status: Complete
Files:

src/services/timeline-service.ts
src/repositories/firestore/firestore-timeline-repository.ts

Features:

✅ Create initial timeline
✅ Get timeline
✅ Update timeline config
✅ Add event with validation
✅ Update event
✅ Delete event
✅ Set events (batch)
✅ Real-time timeline subscriptions
✅ Event status calculation (upcoming, in-progress, completed, scheduled)
✅ Event timing validation (conflicts, buffer times)
✅ Finalization guard (prevents edits when finalized)

Business Logic:

Calculates event status based on current time
Validates event timing against existing events
Ensures minimum buffer time between events
Prevents overlapping events
Handles point-in-time events vs duration-based events
✅ List Management System
Status: Complete
Files:

src/services/ListService.ts
src/repositories/firestore/list.repository.ts

Features:

✅ Generic list service for all list types
✅ Master list management
✅ User list management
✅ Project list management
✅ CRUD operations (add, update, delete items)
✅ List copying and resetting
✅ Real-time list subscriptions
✅ Category-based organization

List Types Supported:

Kit List (equipment with quantities)
Task List (checklist items)
Group Shot List (photo groupings)
Couple Shot List (couple photos)
✅ Error Handling System
Status: Complete
Files:

src/domain/common/errors.ts
src/utils/error-mapper.ts
src/services/error-handler-service.ts
src/services/global-error-handler-service.ts
src/utils/error-context-builder.ts

Features:

✅ Structured error types (AuthError, FirestoreError, NetworkError, ValidationError, etc.)
✅ Error code registry
✅ Error context tracking
✅ User-friendly error messages
✅ Retry logic support
✅ Aggregated errors for batch operations
✅ Error logging service
✅ Global error handler
✅ Error boundary component

Error Types:

AuthError - Authentication failures
FirestoreError - Database operations
NetworkError - Network/API failures
ValidationError - Input validation failures
SubscriptionError - Subscription/billing errors
LocationError - Location/geocoding errors
PaymentError - Payment processing errors
FirebaseStorageError - File storage errors
✅ State Management
Status: Complete
Files:

src/stores/use-auth-store.ts
src/utils/loading-state.ts
src/hooks/use-optimistic-update.ts

Features:

✅ Zustand stores for global state
✅ LoadingState type for async operations
✅ Optimistic update pattern
✅ Rollback on error
✅ Cleanup on unmount
✅ Validation & Sanitization
Status: Complete
Files:

src/utils/validation-helpers.ts
src/utils/sanitization-helpers.ts
All schema files in src/domain/

Features:

✅ Zod schema validation
✅ Input sanitization utilities
✅ Email validation & sanitization
✅ Phone number sanitization
✅ String sanitization
✅ Person info sanitization
✅ Validation at service layer
✅ Sanitization at repository layer
✅ Rate Limiting
Status: Complete
Files:

src/utils/rate-limiter.ts

Features:

✅ Sign-up rate limiting
✅ Sign-in rate limiting
✅ Password reset rate limiting
✅ Email verification rate limiting
✅ Time-based blocking
✅ Reset on success


Outstanding Tasks
🔴 Critical (Must Fix Before Production)
1. Firebase Auth Persistence
File: src/config/firebaseConfig.ts:41
Status: Not Started
Priority: Critical
Issue: Auth state not persisted across app restarts
Fix Required:

import { getReactNativePersistence } from 'firebase/auth/react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

export const auth = initializeAuth(app, {

  persistence: getReactNativePersistence(AsyncStorage),

});

Impact: Users must sign in on every app restart
Estimated Time: 1 hour
2. Project Deletion Business Logic
File: src/services/project-service.ts:242
Status: Not Started
Priority: Critical
Issue: No authorization checks before deletion
Fix Required:

Add authorization checks
Add cascade deletion for subcollections
Add confirmation flow Impact: Users could delete projects without proper validation
Estimated Time: 4 hours
3. Portal Subcollection Initialization
File: src/services/project-service.ts:95
Status: Not Started
Priority: High
Issue: Timeline and Locations not initialized on project creation
Fix Required:

Add Timeline initialization in createProject
Add Location initialization in createProject
Handle initialization failures gracefully Impact: New projects missing timeline and locations data
Estimated Time: 3 hours
🟡 High Priority (Should Fix Soon)
4. Image Upload Service Generalization
Status: Not Started
Priority: High
Issue: BusinessCardService has image upload logic but no generic service
Impact: Image upload logic duplicated across services
Estimated Time: 6 hours
5. Analytics Integration
Status: Not Started
Priority: Medium
Issue: Firebase Analytics imported but not used
Impact: No user analytics tracking
Estimated Time: 4 hours
6. Offline Support
Status: Not Started
Priority: High
Issue: No Firestore offline persistence
Impact: App doesn't work offline
Estimated Time: 8 hours
7. Service Factory Validation
Status: Not Started
Priority: Medium
Issue: ServiceFactory doesn't validate required repositories
Impact: Runtime errors if dependencies missing
Estimated Time: 2 hours
8. PortalService Hardcoded Values
File: src/services/portal-service.ts
Status: Not Started
Priority: Medium
Issue: Hardcoded 'default-portal' string
Impact: Cannot support multiple portals per project
Estimated Time: 2 hours
🟢 Medium Priority (Nice to Have)
9. Caching Layer
Status: Not Started
Priority: Medium
Issue: No service-level caching
Impact: Redundant network requests
Estimated Time: 8 hours
10. Request Batching
Status: Not Started
Priority: Low
Issue: No batch operations for lists
Impact: Multiple network requests instead of one
Estimated Time: 4 hours
11. Memory Management
Status: Not Started
Priority: Medium
Issue: Need review for memory leaks
Impact: Potential memory issues on long sessions
Estimated Time: 4 hours
12. Input Sanitization Review
Status: Not Started
Priority: Medium
Issue: Ensure all inputs sanitized
Impact: Security vulnerabilities
Estimated Time: 4 hours
13. Type Exports
Status: Not Started
Priority: Low
Issue: Some types not exported from index files
Impact: Inconsistent imports
Estimated Time: 2 hours
14. JSDoc Comments
Status: Not Started
Priority: Low
Issue: Missing JSDoc for some public APIs
Impact: Poor developer experience
Estimated Time: 8 hours


Data Flow Diagrams
Authentication Flow (Sign-Up)
sequenceDiagram

    participant UI as SignUpForm

    participant Hook as useSignUp

    participant Service as AuthService

    participant RateLimiter as Rate Limiter

    participant AuthRepo as AuthRepository

    participant UserRepo as UserRepository

    participant Firebase as Firebase Auth

    participant Firestore as Cloud Firestore

    

    UI->>Hook: signUp(input)

    Hook->>Service: signUp(payload)

    Service->>RateLimiter: Check rate limit

    RateLimiter-->>Service: Allowed/Blocked

    alt Rate Limited

        Service-->>Hook: Error

        Hook-->>UI: Show error message

    else Allowed

        Service->>Service: Validate input (Zod)

        alt Validation Failed

            Service-->>Hook: ValidationError

            Hook-->>UI: Show field errors

        else Valid

            Service->>AuthRepo: signUp(payload)

            AuthRepo->>AuthRepo: Sanitize email

            AuthRepo->>Firebase: createUserWithEmailAndPassword()

            Firebase-->>AuthRepo: UserCredential

            AuthRepo->>UserRepo: create(userData)

            UserRepo->>UserRepo: Sanitize inputs

            UserRepo->>Firestore: setDoc(userDoc)

            Firestore-->>UserRepo: Success

            UserRepo-->>AuthRepo: Result<User>

            AuthRepo-->>Service: Result<User>

            Service->>RateLimiter: Reset on success

            Service-->>Hook: Result<User>

            Hook->>Hook: Update LoadingState

            Hook-->>UI: Success, navigate to app

        end

    end
User Profile Update Flow
sequenceDiagram

    participant UI as ProfileForm

    participant Hook as useUserProfile

    participant Service as UserService

    participant Repo as UserRepository

    participant Firestore as Cloud Firestore

    participant Subscriber as Real-time Subscriber

    

    UI->>Hook: updateProfile(updates)

    Hook->>Hook: Set loading state

    Hook->>Service: updateProfile(userId, payload)

    Service->>Service: Validate input (Zod)

    alt Validation Failed

        Service-->>Hook: ValidationError

        Hook->>Hook: Set error state

        Hook-->>UI: Show field errors

    else Valid

        Service->>Repo: updateProfile(userId, validatedData)

        Repo->>Repo: Sanitize inputs

        Repo->>Firestore: updateDoc(userRef, updates)

        Firestore-->>Repo: Success

        Repo-->>Service: Result<void>

        Service-->>Hook: Result<void>

        Hook->>Hook: Set success state

        Hook-->>UI: Show success message

        

        Note over Firestore,Subscriber: Real-time update triggered

        Firestore->>Subscriber: onSnapshot event

        Subscriber->>Hook: User data updated

        Hook->>Hook: Update local state

    end
Project Creation with Subcollection Initialization
sequenceDiagram

    participant UI as ProjectForm

    participant Hook as useProject

    participant Service as ProjectService

    participant ProjectRepo as ProjectRepository

    participant KitRepo as KitRepository

    participant TaskRepo as TaskRepository

    participant ShotRepo as ShotRepository

    participant Firestore as Cloud Firestore

    

    UI->>Hook: createProject(input)

    Hook->>Service: createProject(userId, payload)

    Service->>Service: Validate input

    Service->>ProjectRepo: create(userId, validatedData)

    ProjectRepo->>Firestore: addDoc(projects, projectData)

    Firestore-->>ProjectRepo: ProjectDocument

    ProjectRepo-->>Service: Result<Project>

    

    Service->>Service: Initialize subcollections (parallel)

    

    par Copy Kit List

        Service->>KitRepo: getUserList(userId)

        alt User list exists

            KitRepo-->>Service: User KitList

            Service->>KitRepo: createOrResetProjectList(userId, projectId, userList)

        else Fallback to master

            Service->>KitRepo: getMaster()

            KitRepo-->>Service: Master KitList

            Service->>KitRepo: createOrResetProjectList(userId, projectId, masterList)

        end

        KitRepo->>Firestore: setDoc(projectKitList)

        Firestore-->>KitRepo: Success

        KitRepo-->>Service: Result<void>

    and Copy Task List

        Service->>TaskRepo: getUserList(userId)

        TaskRepo-->>Service: TaskList

        Service->>TaskRepo: createOrResetProjectList(userId, projectId, taskList)

        TaskRepo->>Firestore: setDoc(projectTaskList)

        Firestore-->>TaskRepo: Success

        TaskRepo-->>Service: Result<void>

    and Copy Shots Lists

        Service->>ShotRepo: getUserList(userId)

        ShotRepo-->>Service: ShotLists

        Service->>ShotRepo: createOrResetProjectList(userId, projectId, shotLists)

        ShotRepo->>Firestore: setDoc(projectShotLists)

        Firestore-->>ShotRepo: Success

        ShotRepo-->>Service: Result<void>

    end

    

    alt All succeeded

        Service-->>Hook: Result<Project>

        Hook-->>UI: Show success, navigate

    else Some failed

        Service->>Service: Aggregate errors

        Service-->>Hook: AggregatedError with partial success

        Hook-->>UI: Show warning, project created but some features unavailable

    end
Timeline Event Addition with Validation
sequenceDiagram

    participant UI as TimelineForm

    participant Hook as useTimeline

    participant Service as TimelineService

    participant Repo as TimelineRepository

    participant Firestore as Cloud Firestore

    

    UI->>Hook: addEvent(eventInput)

    Hook->>Service: addEvent(projectId, event)

    Service->>Repo: get(projectId)

    Repo->>Firestore: getDoc(timelineDoc)

    Firestore-->>Repo: TimelineDocument

    Repo-->>Service: TimelineList

    

    Service->>Service: Check finalized guard

    alt Timeline finalized

        Service-->>Hook: ValidationError("Timeline finalized")

        Hook-->>UI: Show error message

    else Not finalized

        Service->>Service: Validate event structure (Zod)

        Service->>Service: Validate time ordering

        Service->>Service: Validate event timing (conflicts, buffer)

        

        alt Validation failed

            Service-->>Hook: ValidationError

            Hook-->>UI: Show field/context errors

        else Valid

            Service->>Repo: addEvent(projectId, validatedEvent)

            Repo->>Firestore: updateDoc(timelineDoc, add to items array)

            Firestore-->>Repo: Success

            Repo-->>Service: Result<eventId>

            Service-->>Hook: Result<TimelineEvent>

            Hook->>Hook: Update timeline state

            Hook-->>UI: Show success, refresh timeline

        end

    end


Production Readiness Roadmap
Phase 1: Critical Fixes (Week 1)
Goal: Fix blocking issues preventing production deployment
Day 1-2: Authentication & Persistence
Implement Firebase Auth persistence
Test auth state across app restarts
Verify session management
Document auth flow
Day 3-4: Project Operations
Implement project deletion business logic
Add authorization checks
Add cascade deletion for subcollections
Test project deletion flow
Day 5: Subcollection Initialization
Add Timeline initialization to project creation
Add Location initialization to project creation
Test initialization with failures
Update error handling

Deliverables:

All critical bugs fixed
Auth persistence working
Project operations secure
Subcollections initialized correctly
Phase 2: High-Priority Features (Week 2)
Goal: Complete essential features for production
Day 1-2: Image Upload Service
Create generic image upload service
Support multiple formats
Add compression options
Refactor BusinessCardService to use generic service
Add error handling
Day 3: Analytics Integration
Set up Firebase Analytics events
Track key user actions (sign-up, sign-in, project creation)
Add user property tracking
Test analytics events
Day 4-5: Offline Support
Enable Firestore offline persistence
Add sync status indicators
Handle offline/online transitions
Test offline scenarios
Document offline behavior

Deliverables:

Generic image upload service
Analytics tracking active
Offline functionality working
Phase 3: Optimizations & Polish (Week 3)
Goal: Performance improvements and code quality
Day 1-2: Service Factory & Validation
Add ServiceFactory dependency validation
Extract hardcoded constants
Fix PortalService hardcoded values
Add helpful error messages
Day 3: Caching Layer
Implement service-level caching
Add cache invalidation logic
Set cache size limits
Test cache behavior
Day 4: Memory Management
Review hooks for memory leaks
Ensure subscription cleanup
Optimize image handling
Add memory profiling
Day 5: Code Quality
Add missing JSDoc comments
Ensure all types exported
Review and remove commented code
Run full linter check

Deliverables:

ServiceFactory validated
Caching implemented
Memory optimized
Code quality improved
Phase 4: Security & Testing (Week 4)
Goal: Security audit and testing infrastructure
Day 1-2: Security Review
Audit input sanitization
Review authorization checks
Test rate limiting
Review Firestore security rules
Document security practices
Day 3-4: Testing Infrastructure
Set up test framework
Write service tests
Write repository tests
Write hook tests
Add integration tests
Day 5: Final Review
Code review
Performance testing
Security audit
Documentation review
Production checklist

Deliverables:

Security audit complete
Test infrastructure in place
Production-ready codebase


Implementation Timeline
Critical Path (Must Complete)
gantt

    title Production Readiness Timeline

    dateFormat YYYY-MM-DD

    section Critical

    Firebase Auth Persistence    :crit, 2024-12-01, 1d

    Project Deletion Logic        :crit, 2024-12-02, 2d

    Subcollection Init            :crit, 2024-12-04, 1d

    section High Priority

    Image Upload Service          :2024-12-05, 2d

    Analytics Integration         :2024-12-07, 1d

    Offline Support               :2024-12-08, 2d

    section Optimization

    Service Factory Validation    :2024-12-10, 1d

    Caching Layer                 :2024-12-11, 2d

    Memory Management             :2024-12-13, 1d

    section Security

    Security Audit                :2024-12-14, 2d

    Testing Infrastructure        :2024-12-16, 2d
Detailed Task Breakdown
Week 1: Critical Fixes
Day 1 (8 hours): Firebase Auth Persistence

Implement AsyncStorage persistence
Test across app restarts
Handle persistence errors

Day 2-3 (16 hours): Project Deletion Logic

Add authorization checks
Implement cascade deletion
Add confirmation flow
Test deletion scenarios

Day 4 (8 hours): Subcollection Initialization

Add Timeline initialization
Add Location initialization
Handle initialization failures
Test initialization flow
Week 2: High-Priority Features
Day 1-2 (16 hours): Image Upload Service

Create generic service
Support formats (JPEG, PNG, WebP)
Add compression
Refactor existing code

Day 3 (8 hours): Analytics Integration

Set up events
Track user actions
Test analytics

Day 4-5 (16 hours): Offline Support

Enable persistence
Add sync indicators
Handle transitions
Test offline scenarios
Week 3: Optimizations
Day 1 (8 hours): Service Factory & Validation

Add dependency validation
Extract constants
Fix hardcoded values

Day 2-3 (16 hours): Caching Layer

Implement caching
Add invalidation
Set limits

Day 4 (8 hours): Memory Management

Review hooks
Check subscriptions
Optimize images
Week 4: Security & Testing
Day 1-2 (16 hours): Security Audit

Review sanitization
Check authorization
Test rate limiting

Day 3-4 (16 hours): Testing Infrastructure

Set up framework
Write tests
Integration tests

Day 5 (8 hours): Final Review

Code review
Performance testing
Documentation

Total Estimated Time: 128 hours (16 days @ 8 hours/day)


Technical Stack
Frontend
Framework: React Native (Expo ~54.0)
Language: TypeScript 5.9
State Management:
Zustand (global state)
React Hooks (local state)
LoadingState pattern
Navigation: Expo Router 6.0
UI Components: React Native Paper
Backend Services
Authentication: Firebase Auth
Database: Cloud Firestore
Storage: Firebase Storage
Functions: Cloud Functions
Analytics: Firebase Analytics
Validation & Type Safety
Runtime Validation: Zod 3.25
Type Safety: TypeScript strict mode
Schema Validation: Zod schemas throughout
Utilities
Date Handling: date-fns 4.1
UUID Generation: uuid 13.0
QR Codes: react-native-qrcode-svg
Development Tools
Linting: ESLint 9.38
Formatting: Prettier 3.6
Type Checking: TypeScript


File Structure
src/

├── app/                      # Expo Router screens

│   ├── (auth)/              # Auth screens

│   │   ├── sign-in.tsx

│   │   └── sign-up.tsx

│   ├── (features)/          # Feature screens

│   ├── (onboarding)/        # Onboarding flow

│   ├── (setup)/             # Setup screens

│   └── _layout.tsx          # Root layout

│

├── components/              # React components

│   ├── auth/               # Auth components

│   │   ├── SignInForm.tsx

│   │   └── SignUpForm.tsx

│   └── common/             # Common components

│       ├── error-boundary.tsx

│       ├── error-display.tsx

│       ├── loading-indicator.tsx

│       ├── screen.tsx

│       └── toast.tsx

│

├── config/                  # Configuration

│   └── firebaseConfig.ts   # Firebase initialization

│

├── constants/               # App constants

│   ├── defaults.ts

│   ├── enums.ts

│   ├── error-code-registry.ts

│   ├── portal.ts

│   ├── styles.ts

│   ├── theme.ts

│   └── typography.ts

│

├── domain/                  # Domain layer (schemas, types)

│   ├── common/             # Shared schemas

│   │   ├── errors.ts       # Error definitions

│   │   ├── list-base.schema.ts

│   │   ├── result.ts       # Result type

│   │   └── shared-schemas.ts

│   ├── project/            # Project domain schemas

│   │   ├── key-people.schema.ts

│   │   ├── location.schema.ts

│   │   ├── photo-request.schema.ts

│   │   ├── portal.schema.ts

│   │   ├── project.schema.ts

│   │   ├── tag.schema.ts

│   │   └── timeline.schema.ts

│   ├── scoped/             # Scoped schemas

│   │   ├── notes.schema.ts

│   │   ├── vendor.schema.ts

│   │   └── weather-schema.ts

│   ├── screens/            # Screen schemas

│   │   ├── onboarding.schema.ts

│   │   └── setup.schema.ts

│   ├── types/             # TypeScript type definitions

│   │   ├── assets.d.ts

│   │   ├── env.d.ts

│   │   ├── fonts.d.ts

│   │   └── theme.d.ts

│   └── user/              # User domain schemas

│       ├── auth.schema.ts

│       ├── business-card.schema.ts

│       ├── kit.schema.ts

│       ├── notification.schema.ts

│       ├── shots.schema.ts

│       ├── task.schema.ts

│       └── user.schema.ts

│

├── hooks/                   # React hooks

│   ├── use-app-styles.ts

│   ├── use-auth.ts

│   ├── use-business-card.ts

│   ├── use-error-handler.ts

│   ├── use-list-actions.ts

│   ├── use-location.ts

│   ├── use-optimistic-update.ts

│   ├── use-password-reset.ts

│   ├── use-portal.ts

│   ├── use-sign-in.ts

│   ├── use-sign-up.ts

│   ├── use-user-admin.ts

│   ├── use-user-profile.ts

│   └── use-user-realtime.ts

│

├── ports/                   # Port interfaces (future)

│   ├── i-file-system-repository.ts

│   ├── i-notification-repository.ts

│   ├── i-photo-request-repository.ts

│   ├── i-storage-repository.ts

│   ├── i-tag-repository.ts

│   └── i-vendor-repository.ts

│

├── repositories/            # Repository layer

│   ├── firestore/          # Firestore implementations

│   │   ├── firestore-auth-repository.ts

│   │   ├── firestore-business-card-repository.ts

│   │   ├── firestore-list-repository.ts

│   │   ├── firestore-location-repository.ts

│   │   ├── firestore-portal-repository.ts

│   │   ├── firestore-project-repository.ts

│   │   ├── firestore-timeline-repository.ts

│   │   ├── firestore-user-repository.ts

│   │   └── list.repository.ts

│   ├── i-auth-repository.ts

│   ├── i-business-card-repository.ts

│   ├── i-key-people-repository.ts

│   ├── i-list-repository.ts

│   ├── i-location-repository.ts

│   ├── i-portal-repository.ts

│   ├── i-project-repository.ts

│   ├── i-timeline-repository.ts

│   └── i-user-repository.ts

│

├── services/                 # Service layer (business logic)

│   ├── auth-service.ts

│   ├── business-card-service.ts

│   ├── error-handler-service.ts

│   ├── global-error-handler-service.ts

│   ├── ListService.ts

│   ├── location-service.ts

│   ├── logging-service.ts

│   ├── portal-service.ts

│   ├── project-service.ts

│   ├── ServiceFactory.ts    # Dependency injection

│   ├── timeline-service.ts

│   └── user-service.ts

│

├── stores/                   # Zustand stores

│   ├── store-template.ts

│   ├── use-auth-store.ts

│   └── use-ui-store.ts

│

└── utils/                    # Utility functions

    ├── date-time-utils.ts

    ├── error-classifier.ts

    ├── error-context-builder.ts

    ├── error-context-capture.ts

    ├── error-mapper.ts

    ├── error-recovery.ts

    ├── id-generator.ts

    ├── loading-state.ts

    ├── rate-limiter.ts

    ├── result-helpers.ts

    ├── sanitization-helpers.ts

    └── validation-helpers.ts


Patterns & Standards
Architecture Patterns
Ports & Adapters (Hexagonal Architecture)

Interfaces define contracts (Ports)
Implementations are adapters
Services depend on interfaces only

Result Pattern

All async operations return Result<T, AppError>
Never throw in business logic
Type-safe error handling

Service Factory Pattern

Centralized dependency injection
Singleton services
Easy testing with mock repositories
Code Patterns
Unidirectional Data Flow

Component → Hook → Service → Repository → Firestore

Loading State Pattern

type LoadingState<T> = 

  | { status: 'idle' }

  | { status: 'loading', data?: T }

  | { status: 'success', data: T }

  | { status: 'error', error: AppError, data?: T }

Optimistic Updates

Update UI immediately
Rollback on error
Show loading state during operation
Error Handling Pattern
Error Context

Always include component, method, userId, projectId
Use ErrorContextBuilder for consistency

Error Mapping

Map Firebase errors to AppError
Map Zod errors to ValidationError
Create user-friendly messages

Error Flow

Error → ErrorMapper → AppError → ErrorHandler → UI/Logging
Validation Pattern
Service Layer

Validate all inputs with Zod
Return ValidationError on failure

Repository Layer

Sanitize all inputs
Validate structure
Return FirestoreError on failure
Naming Conventions
Files:

Components: PascalCase.tsx
Hooks: use-kebab-case.ts
Services: kebab-case-service.ts
Repositories: kebab-case-repository.ts
Interfaces: i-kebab-case.ts
Schemas: kebab-case.schema.ts

Code:

Interfaces: IPascalCase
Types: PascalCase
Functions: camelCase
Constants: UPPER_SNAKE_CASE
Components: PascalCase


Success Criteria
Production Readiness Checklist
Critical Requirements ✅
Authentication system complete
User management complete
Project management complete
Error handling system complete
Firebase Auth persistence configured
Project deletion secure
All subcollections initialized
High Priority Requirements ✅
Rate limiting implemented
Input validation throughout
Error context tracking
Image upload service generalized
Analytics integrated
Offline support enabled
Quality Requirements ✅
Result pattern consistent
Type safety maintained
No any types
All JSDoc comments added
Test coverage adequate
Memory leaks resolved
Security Requirements ✅
Input sanitization
Rate limiting
Error message security
Security audit complete
Firestore rules reviewed
Authorization checks complete


Conclusion
The Eye-Doo application has a solid foundation with:

✅ Complete authentication system
✅ Comprehensive user management
✅ Project management with orchestration
✅ Robust error handling
✅ Type-safe validation
✅ Clean architecture

Next Steps:

Complete critical fixes (Week 1)
Implement high-priority features (Week 2)
Optimize and polish (Week 3)
Security audit and testing (Week 4)

Estimated Time to Production: 4 weeks (128 hours)



Document Version: 1.0.0
Last Updated: December 2024
Maintained By: Development Team

