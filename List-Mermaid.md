# User List Setup Flow - Mermaid Diagrams

This document provides comprehensive information about how user lists (Kit, Task, Group-Shots, Couple-Shots) are created, checked, and customized during the setup module, including subscription plan effects.

## Table of Contents

1. [Overview](#overview)
2. [Initial List Existence Checks](#initial-list-existence-checks)
3. [Master List Fetching](#master-list-fetching)
4. [User List Creation Flow](#user-list-creation-flow)
5. [List Customization Flow](#list-customization-flow)
6. [Subscription Plan Effects](#subscription-plan-effects)
7. [Setup Completion Tracking](#setup-completion-tracking)

---

## Overview

The setup module manages four types of user lists:

- **Kit List** - Equipment and gear management
- **Task List** - Task management
- **Group Shot List** - Group photography shot lists
- **Couple Shot List** - Couple photography shot lists

Each list follows a consistent pattern:

1. Check if user list exists
2. If not, fetch master list
3. Allow user to customize (if subscription allows)
4. Save user list
5. Mark setup as complete

---

## Initial List Existence Checks

### Sequence Diagram: List Existence Check

```mermaid
sequenceDiagram
    participant Screen as Setup Screen
    participant Hook as useList Hook
    participant Service as ListService
    participant Repo as FirestoreListRepository
    participant Firestore as Firestore

    Screen->>Hook: getUserList() (autoFetch: true)
    Hook->>Service: getUserList(userId)
    Service->>Repo: getUserList(userId)
    Repo->>Firestore: getDoc(users/{userId}/lists/{listType})

    alt List Exists
        Firestore-->>Repo: DocumentSnapshot (exists: true)
        Repo->>Repo: parseSnapshot()
        Repo->>Repo: sanitizeList()
        Repo-->>Service: Result<TList, AppError> (success)
        Service-->>Hook: Result<TList, AppError> (success)
        Hook->>Hook: setState(success(list))
        Hook-->>Screen: list: TList
    else List Not Found
        Firestore-->>Repo: DocumentSnapshot (exists: false)
        Repo-->>Service: Result<TList, AppError> (error: DB_NOT_FOUND)
        Service-->>Hook: Result<TList, AppError> (error: DB_NOT_FOUND)
        Hook->>Hook: setState(error(DB_NOT_FOUND))
        Hook-->>Screen: error: AppError (code: 'DB_001')

        Note over Screen: Detects error.code === 'DB_001'<br/>Triggers master list fetch
        Screen->>Hook: getMaster()
    end
```

### Flow Diagram: List Check Logic

```mermaid
flowchart TD
    A[Setup Screen Mounts] --> B[useList Hook with autoFetch: true]
    B --> C[getUserList called]
    C --> D{List Exists?}

    D -->|Yes| E[Display User List]
    D -->|No| F[Error: DB_NOT_FOUND]

    F --> G{Error Code === 'DB_001'?}
    G -->|Yes| H[Fetch Master List]
    G -->|No| I[Display Error]

    H --> J[Display Master List for Customization]

    E --> K{Setup Complete?}
    K -->|Yes| L[Show Locked State]
    K -->|No| M[Allow Customization]

    J --> M
    M --> N[User Customizes List]
    N --> O[Save User List]
    O --> P[Mark Setup Complete]
```

---

## Master List Fetching

### Sequence Diagram: Master List Fetch

```mermaid
sequenceDiagram
    participant Index as Setup Index
    participant KitScreen as Kit Setup Screen
    participant Hook as useList Hook
    participant Service as ListService
    participant Repo as FirestoreListRepository
    participant Firestore as Firestore

    Note over Index: On Mount - Fetch All Master Lists
    Index->>Hook: getMaster() (Kit)
    Index->>Hook: getMaster() (Task)
    Index->>Hook: getMaster() (GroupShot)
    Index->>Hook: getMaster() (CoupleShot)

    par Parallel Fetch
        Hook->>Service: getMaster()
        Service->>Repo: getMaster()
        Repo->>Firestore: getDoc(masterData/{listType})

        alt Master Exists
            Firestore-->>Repo: DocumentSnapshot
            Repo->>Repo: parseSnapshot()
            Repo->>Repo: sanitizeList()
            Repo-->>Service: Result<TList> (success)
        else Master Not Found
            Repo->>Repo: createDefaultList('master')
            Repo-->>Service: Result<TList> (default empty list)
        end

        Service-->>Hook: Result<TList>
        Hook->>Hook: setState(success(masterList))
        Hook-->>Index: list: TList (master)
    end

    Note over KitScreen: On Mount - Auto-fetch User List
    KitScreen->>Hook: getUserList() (autoFetch: true)

    alt User List Not Found
        Hook-->>KitScreen: error: DB_NOT_FOUND
        KitScreen->>Hook: getMaster() (fallback)
        Hook->>Service: getMaster()
        Service->>Repo: getMaster()
        Repo->>Firestore: getDoc(masterData/kitList)
        Firestore-->>Repo: DocumentSnapshot
        Repo-->>Service: Result<KitList>
        Service-->>Hook: Result<KitList>
        Hook-->>KitScreen: list: KitList (master)
    end
```

### Data Flow: Master List to User List

```mermaid
flowchart LR
    A["Master List<br/>masterData/listType"] -->|getMaster| B[ListService]
    B -->|validate| C[FirestoreListRepository]
    C -->|sanitize| D[Master List Data]

    D -->|createOrResetUserList| E[User List Creation]
    E -->|personalize| F["Set source: USER_LIST<br/>Set createdBy: userId"]
    F -->|save| G["User List<br/>users/userId/lists/listType"]

    G -->|getUserList| H[Display in Setup Screen]
    H -->|user edits| I[Customized User List]
    I -->|saveUserList| G
```

---

## User List Creation Flow

### Sequence Diagram: User List Creation

```mermaid
sequenceDiagram
    participant User as User
    participant Screen as Setup Screen
    participant Hook as useList Hook
    participant Service as ListService
    participant Repo as FirestoreListRepository
    participant Firestore as Firestore

    Note over User,Screen: Scenario: First-time Setup

    User->>Screen: Navigate to Setup Screen
    Screen->>Hook: getUserList() (autoFetch: true)
    Hook->>Service: getUserList(userId)
    Service->>Repo: getUserList(userId)
    Repo->>Firestore: getDoc(users/{userId}/lists/{listType})
    Firestore-->>Repo: DocumentSnapshot (exists: false)
    Repo-->>Service: Result (error: DB_NOT_FOUND)
    Service-->>Hook: Result (error: DB_NOT_FOUND)
    Hook-->>Screen: error: DB_NOT_FOUND

    Screen->>Hook: getMaster()
    Hook->>Service: getMaster()
    Service->>Repo: getMaster()
    Repo->>Firestore: getDoc(masterData/{listType})
    Firestore-->>Repo: DocumentSnapshot (master list)
    Repo-->>Service: Result (master list)
    Service-->>Hook: Result (master list)
    Hook-->>Screen: list: TList (master)

    Note over User: User views master list<br/>and customizes it

    User->>Screen: Click "Load Default List"
    Screen->>Hook: createOrResetUserList(masterList)
    Hook->>Service: createOrResetUserList(userId, masterList)
    Service->>Service: validateWithSchema(listSchema)
    Service->>Repo: createOrResetUserList(userId, validatedList)

    Repo->>Repo: sanitizeList(sourceList)
    Repo->>Repo: Set source: USER_LIST
    Repo->>Repo: Set createdBy: userId
    Repo->>Repo: Set lastModifiedBy: userId

    Repo->>Firestore: setDoc(users/{userId}/lists/{listType}, list)
    Firestore-->>Repo: Success
    Repo-->>Service: Result (success)

    Service->>Repo: getUserList(userId) (refresh)
    Repo->>Firestore: getDoc(users/{userId}/lists/{listType})
    Firestore-->>Repo: DocumentSnapshot
    Repo-->>Service: Result (user list)
    Service-->>Hook: Result (user list)
    Hook-->>Screen: list: TList (user list)
```

### Flow Diagram: User List Creation Options

```mermaid
flowchart TD
    A[Setup Screen] --> B{User List Exists?}

    B -->|Yes| C[Display User List]
    B -->|No| D[Display Empty State]

    D --> E{User Action}
    E -->|Load Default| F[getMaster]
    E -->|Start Custom| G[Create Empty List]

    F --> H[createOrResetUserList<br/>masterList]
    G --> I[createOrResetUserList<br/>emptyList]

    H --> J[User List Created<br/>from Master]
    I --> K[User List Created<br/>Empty]

    J --> L[User Customizes]
    K --> L

    L --> M[Save User List]
    M --> N[Mark Setup Complete]
```

---

## List Customization Flow

### Sequence Diagram: Adding Items

```mermaid
sequenceDiagram
    participant User as User
    participant Screen as Setup Screen
    participant Hook as useList Hook
    participant Service as ListService
    participant Repo as FirestoreListRepository
    participant Firestore as Firestore
    participant FeatureAccess as FeatureAccess

    User->>Screen: Click "Add Item"
    Screen->>FeatureAccess: canCustomizeKitListUser()
    FeatureAccess-->>Screen: true/false

    alt Feature Allowed
        Screen->>Screen: Check maxAdditions limit
        Screen->>Screen: Show Add Item Form
        User->>Screen: Submit Item Data

        Screen->>Hook: addUserItem(item)

        Note over Hook: Optimistic Update
        Hook->>Hook: Create optimistic list<br/>items: [...items, newItem]<br/>totalItems: totalItems + 1
        Hook->>Hook: setState(success(optimisticList))
        Hook-->>Screen: UI updates immediately

        Hook->>Service: addUserItem(userId, item)
        Service->>Service: getUserList(userId) (validate constraints)
        Service->>Service: validateItemConstraints()

        alt Constraints Valid
            Service->>Repo: addUserItem(userId, item)
            Repo->>Repo: sanitizeItem(item)
            Repo->>Firestore: updateDoc(users/{userId}/lists/{listType})<br/>arrayUnion(item)
            Firestore-->>Repo: Success
            Repo-->>Service: Result (success)
            Service-->>Hook: Result (success)
            Hook->>Service: getUserList(userId) (refresh)
            Service->>Repo: getUserList(userId)
            Repo->>Firestore: getDoc(users/{userId}/lists/{listType})
            Firestore-->>Repo: DocumentSnapshot
            Repo-->>Service: Result (updated list)
            Service-->>Hook: Result (updated list)
            Hook-->>Screen: list: TList (updated)
        else Constraints Invalid
            Service-->>Hook: Result (error: VALIDATION_FAILED)
            Hook->>Hook: Rollback optimistic update
            Hook->>Hook: setState(success(previousList))
            Hook-->>Screen: error: AppError
        end
    else Feature Not Allowed
        Screen->>User: Alert: "Feature Unavailable"
    end
```

### Sequence Diagram: Deleting Items

```mermaid
sequenceDiagram
    participant User as User
    participant Screen as Setup Screen
    participant Hook as useList Hook
    participant Service as ListService
    participant Repo as FirestoreListRepository
    participant Firestore as Firestore
    participant FeatureAccess as FeatureAccess

    User->>Screen: Click "Delete Item"
    Screen->>FeatureAccess: canCustomizeKitListUser()
    FeatureAccess-->>Screen: true/false

    alt Feature Allowed
        Screen->>Hook: deleteUserItem(itemId)

        Note over Hook: Optimistic Update
        Hook->>Hook: Create optimistic list<br/>items: items.filter(id !== itemId)<br/>totalItems: totalItems - 1
        Hook->>Hook: setState(success(optimisticList))
        Hook-->>Screen: UI updates immediately

        Hook->>Service: deleteUserItem(userId, itemId)
        Service->>Repo: deleteUserItem(userId, itemId)
        Repo->>Firestore: updateDoc(users/{userId}/lists/{listType})<br/>arrayRemove(item)
        Firestore-->>Repo: Success
        Repo-->>Service: Result (success)
        Service-->>Hook: Result (success)
        Hook->>Service: getUserList(userId) (refresh)
        Service->>Repo: getUserList(userId)
        Repo->>Firestore: getDoc(users/{userId}/lists/{listType})
        Firestore-->>Repo: DocumentSnapshot
        Repo-->>Service: Result (updated list)
        Service-->>Hook: Result (updated list)
        Hook-->>Screen: list: TList (updated)
    else Feature Not Allowed
        Screen->>User: Action Disabled
    end
```

### Sequence Diagram: Batch Update Items

```mermaid
sequenceDiagram
    participant User as User
    participant Screen as Setup Screen
    participant Hook as useList Hook
    participant Service as ListService
    participant Repo as FirestoreListRepository
    participant Firestore as Firestore

    User->>Screen: Update Multiple Items
    Screen->>Hook: batchUpdateUserItems(updates)

    Note over Hook: Optimistic Update
    Hook->>Hook: Create optimistic list<br/>items: items.map(apply updates)
    Hook->>Hook: setState(success(optimisticList))
    Hook-->>Screen: UI updates immediately

    Hook->>Service: batchUpdateUserItems(userId, updates)
    Service->>Repo: batchUpdateUserItems(userId, updates)
    Repo->>Repo: sanitizeItems(updates)
    Repo->>Firestore: updateDoc(users/{userId}/lists/{listType})<br/>items: updatedItems
    Firestore-->>Repo: Success
    Repo-->>Service: Result (success)
    Service-->>Hook: Result (success)
    Hook->>Service: getUserList(userId) (refresh)
    Service->>Repo: getUserList(userId)
    Repo->>Firestore: getDoc(users/{userId}/lists/{listType})
    Firestore-->>Repo: DocumentSnapshot
    Repo-->>Service: Result (updated list)
    Service-->>Hook: Result (updated list)
    Hook-->>Screen: list: TList (updated)
```

---

## Subscription Plan Effects

### Flow Diagram: Subscription Plan Feature Checks

```mermaid
flowchart TD
    A[Setup Screen] --> B[Fetch User Subscription]
    B --> C[Get Plan Data from Firestore]
    C --> D[Create FeatureAccess Instance]

    D --> E{Check Feature Access}

    E -->|canUseKitList| F{Kit List Enabled?}
    E -->|canUseTaskList| G{Task List Enabled?}
    E -->|canUseGroupShotList| H{Group Shot List Enabled?}
    E -->|canUseCoupleShotList| I{Couple Shot List Enabled?}

    F -->|Yes| J[canCustomizeKitListUser]
    G -->|Yes| K[canCustomizeTaskListUser]
    H -->|Yes| L[canCustomizeGroupShotListUser]
    I -->|Yes| M[canCustomizeCoupleShotListUser]

    J --> N{User Customizable?}
    K --> O{User Customizable?}
    L --> P{User Customizable?}
    M --> Q{User Customizable?}

    N -->|Yes| R[Enable Add/Update/Delete]
    N -->|No| S[Disable Customization]

    O -->|Yes| T[Enable Add/Update/Delete]
    O -->|No| U[Disable Customization]

    P -->|Yes| V[Enable Add/Update/Delete]
    P -->|No| W[Disable Customization]

    Q -->|Yes| X[Enable Add/Update/Delete]
    Q -->|No| Y[Disable Customization]

    R --> Z[Check maxAdditions Limit]
    T --> Z
    V --> Z
    X --> Z

    Z --> AA{Current Count < Max?}
    AA -->|Yes| AB[Allow Add Item]
    AA -->|No| AC[Show Limit Reached Alert]
```

### Sequence Diagram: Subscription Plan Validation

```mermaid
sequenceDiagram
    participant Screen as Setup Screen
    participant Hook as useUserSubscription
    participant Service as SubscriptionService
    participant FeatureAccess as FeatureAccess
    participant User as User

    Screen->>Hook: useUserSubscription(userId, { autoFetch: true })
    Hook->>Service: getByUserId(userId)
    Service->>Service: Fetch from Firestore
    Service-->>Hook: subscription: UserSubscription
    Hook-->>Screen: subscription

    Screen->>Service: getPlanData(subscription.plan)
    Service->>Service: Fetch from Firestore<br/>subscriptionPlans/plan
    Service-->>Screen: planData: SubscriptionPlanData

    Screen->>FeatureAccess: new FeatureAccess(planData)

    Note over Screen,FeatureAccess: Feature Checks
    Screen->>FeatureAccess: canUseKitList()
    FeatureAccess-->>Screen: plan.kitList.enabled

    Screen->>FeatureAccess: canCustomizeKitListUser()
    FeatureAccess-->>Screen: plan.kitList.userCustomizable

    Screen->>FeatureAccess: getKitListMaxAdditions()
    FeatureAccess-->>Screen: plan.kitList.maxAdditions

    User->>Screen: Attempt to Add Item
    Screen->>Screen: Check canCustomizeKitListUser()

    alt Customization Allowed
        Screen->>Screen: Check currentCount < maxAdditions
        alt Under Limit
            Screen->>Screen: Allow Add Item
        else Limit Reached
            Screen->>User: Alert: "Limit Reached"
        end
    else Customization Not Allowed
        Screen->>User: Alert: "Feature Unavailable"
    end
```

### Subscription Plan Feature Matrix

```mermaid
graph TB
    subgraph "Subscription Plans"
        FREE[FREE Plan]
        BASIC[BASIC Plan]
        PRO[PRO Plan]
        STUDIO[STUDIO Plan]
    end

    subgraph "Kit List Features"
        K1[Enabled]
        K2[User Customizable]
        K3[Max Additions: 0]
        K4[Max Additions: 10]
        K5[Max Additions: 50]
        K6[Max Additions: Unlimited]
    end

    subgraph "Task List Features"
        T1[Enabled]
        T2[User Customizable]
        T3[Max Additions: 0]
        T4[Max Additions: 10]
        T5[Max Additions: 50]
        T6[Max Additions: Unlimited]
    end

    subgraph "Group Shot List Features"
        G1[Enabled]
        G2[User Customizable]
        G3[Max Additions: 0]
        G4[Max Additions: 10]
        G5[Max Additions: 50]
        G6[Max Additions: Unlimited]
    end

    subgraph "Couple Shot List Features"
        C1[Enabled]
        C2[User Customizable]
        C3[Max Additions: 0]
        C4[Max Additions: 10]
        C5[Max Additions: 50]
        C6[Max Additions: Unlimited]
    end

    FREE --> K1
    FREE --> K2
    FREE --> K3
    FREE --> T1
    FREE --> T2
    FREE --> T3
    FREE --> G1
    FREE --> G2
    FREE --> G3
    FREE --> C1
    FREE --> C2
    FREE --> C3

    BASIC --> K1
    BASIC --> K2
    BASIC --> K4
    BASIC --> T1
    BASIC --> T2
    BASIC --> T4
    BASIC --> G1
    BASIC --> G2
    BASIC --> G4
    BASIC --> C1
    BASIC --> C2
    BASIC --> C4

    PRO --> K1
    PRO --> K2
    PRO --> K5
    PRO --> T1
    PRO --> T2
    PRO --> T5
    PRO --> G1
    PRO --> G2
    PRO --> G5
    PRO --> C1
    PRO --> C2
    PRO --> C5

    STUDIO --> K1
    STUDIO --> K2
    STUDIO --> K6
    STUDIO --> T1
    STUDIO --> T2
    STUDIO --> T6
    STUDIO --> G1
    STUDIO --> G2
    STUDIO --> G6
    STUDIO --> C1
    STUDIO --> C2
    STUDIO --> C6
```

---

## Setup Completion Tracking

### Sequence Diagram: Saving List and Marking Complete

```mermaid
sequenceDiagram
    participant User as User
    participant Screen as Setup Screen
    participant ListHook as useList Hook
    participant SetupHook as useUserSetup Hook
    participant ListService as ListService
    participant SetupService as UserSetupService
    participant Firestore as Firestore

    User->>Screen: Click "Save List"
    Screen->>Screen: Check isListCustomized()

    alt List Customized
        Screen->>ListHook: saveUserList(list)
        ListHook->>ListHook: setState(success(list)) (optimistic)
        ListHook->>ListService: saveUserList(userId, list)
        ListService->>ListService: validateWithSchema(listSchema)
        ListService->>Firestore: setDoc(users/{userId}/lists/{listType}, list)
        Firestore-->>ListService: Success
        ListService->>ListService: getUserList(userId) (refresh)
        ListService-->>ListHook: Result (updated list)
        ListHook-->>Screen: Success

        Screen->>SetupHook: updateSetup({ customKitListSetup: true })
        SetupHook->>SetupService: update(userId, setupId, updates)
        SetupService->>Firestore: updateDoc(users/{userId}/setup/{setupId})
        Firestore-->>SetupService: Success
        SetupService-->>SetupHook: Result (updated setup)
        SetupHook-->>Screen: Success

        Screen->>Screen: Navigate to Setup Index
    else List Not Customized
        Screen->>ListHook: saveUserList(list)
        ListHook->>ListService: saveUserList(userId, list)
        ListService->>Firestore: setDoc(users/{userId}/lists/{listType}, list)
        Firestore-->>ListService: Success
        ListService-->>ListHook: Success
        ListHook-->>Screen: Success

        Note over Screen: Setup not marked complete<br/>if list not customized
    end
```

### Flow Diagram: Setup Completion Logic

```mermaid
flowchart TD
    A[User Clicks Save] --> B[saveUserList called]
    B --> C{List Saved Successfully?}

    C -->|No| D[Show Error]
    C -->|Yes| E{isListCustomized?}

    E -->|Yes| F[Check List Customization]
    F --> G{source !== MASTER_LIST<br/>OR<br/>defaultValues === false<br/>OR<br/>lastModifiedBy !== 'system'?}

    G -->|Yes| H[updateSetup<br/>customKitListSetup: true]
    G -->|No| I[Don't Mark Complete]

    H --> J[Setup Marked Complete]
    I --> K[Setup Not Complete]

    J --> L[Navigate to Setup Index]
    K --> L

    L --> M{All Lists Complete?}
    M -->|Yes| N[Show All Complete]
    M -->|No| O[Show Remaining Lists]
```

---

## Complete Setup Flow

### Complete Sequence: End-to-End Setup

```mermaid
sequenceDiagram
    participant User as User
    participant Index as Setup Index
    participant Screen as Kit Setup Screen
    participant ListHook as useList Hook
    participant SetupHook as useUserSetup Hook
    participant SubHook as useUserSubscription Hook
    participant OnboardingService as OnboardingService
    participant ListService as ListService
    participant Firestore as Firestore

    Note over User,Firestore: Initial Setup Flow

    User->>Index: Navigate to Setup Index
    Index->>ListHook: getMaster() (all lists)
    ListHook->>ListService: getMaster()
    ListService->>Firestore: getDoc(masterData/{listType})
    Firestore-->>ListService: Master Lists
    ListService-->>ListHook: Master Lists
    ListHook-->>Index: Display Master List Info

    User->>Index: Click "Kit List" Card
    Index->>Screen: Navigate to Kit Setup

    Screen->>ListHook: getUserList() (autoFetch: true)
    ListHook->>ListService: getUserList(userId)
    ListService->>Firestore: getDoc(users/{userId}/lists/kitList)

    alt User List Exists
        Firestore-->>ListService: User List
        ListService-->>ListHook: User List
        ListHook-->>Screen: Display User List
    else User List Not Found
        Firestore-->>ListService: Error: DB_NOT_FOUND
        ListService-->>ListHook: Error: DB_NOT_FOUND
        ListHook-->>Screen: error: DB_NOT_FOUND

        Screen->>ListHook: getMaster()
        ListHook->>ListService: getMaster()
        ListService->>Firestore: getDoc(masterData/kitList)
        Firestore-->>ListService: Master List
        ListService-->>ListHook: Master List
        ListHook-->>Screen: Display Master List
    end

    Screen->>SubHook: useUserSubscription (autoFetch: true)
    SubHook->>Firestore: Fetch Subscription
    Firestore-->>SubHook: Subscription
    SubHook-->>Screen: subscription

    Screen->>Screen: Create FeatureAccess
    Screen->>Screen: Check canCustomizeKitListUser()

    User->>Screen: Customize List (add/remove items)
    Screen->>ListHook: addUserItem / deleteUserItem
    ListHook->>ListService: Item Operations
    ListService->>Firestore: Update List
    Firestore-->>ListService: Success
    ListService-->>ListHook: Updated List
    ListHook-->>Screen: Updated List

    User->>Screen: Click "Save List"
    Screen->>ListHook: saveUserList(list)
    ListHook->>ListService: saveUserList(userId, list)
    ListService->>Firestore: setDoc(users/{userId}/lists/kitList)
    Firestore-->>ListService: Success
    ListService-->>ListHook: Success

    Screen->>SetupHook: updateSetup({ customKitListSetup: true })
    SetupHook->>Firestore: updateDoc(users/{userId}/setup/{setupId})
    Firestore-->>SetupHook: Success
    SetupHook-->>Screen: Setup Updated

    Screen->>Index: Navigate Back
    Index->>Index: Refresh Setup Status
```

---

## Key Implementation Details

### List Existence Check

The system checks if a user list exists by:

1. **Repository Level** (`FirestoreListRepository.getUserList`):
   - Attempts to fetch document from `users/{userId}/lists/{listType}`
   - If document doesn't exist, returns `ErrorCode.DB_NOT_FOUND`
   - If document exists, parses and sanitizes the data

2. **Hook Level** (`useList`):
   - With `autoFetch: true`, automatically calls `getUserList()` on mount
   - If error code is `'DB_001'` (DB_NOT_FOUND), setup screens can trigger `getMaster()` as fallback

3. **Screen Level**:
   - Detects `error.code === 'DB_001'` to identify missing lists
   - Fetches master list to display for customization
   - Shows empty state if master list also unavailable

### Master List Fetching

Master lists are fetched from:

- **Path**: `masterData/{listType}` where `listType` is one of:
  - `kitList`
  - `taskList`
  - `groupShots`
  - `coupleShots`

**Timing**:

- **Setup Index**: Fetches all master lists on mount to display overview
- **Individual Setup Screens**: Fetches master list when user list not found (fallback)

### User List Creation

User lists are created via `createOrResetUserList`:

1. **Source**: Can be master list or empty list
2. **Personalization**:
   - Sets `config.source = ListSource.USER_LIST`
   - Sets `config.createdBy = userId`
   - Sets `config.lastModifiedBy = userId`
3. **Path**: `users/{userId}/lists/{listType}`

### Customization Operations

All customization operations use **optimistic updates**:

1. **Add Item**:
   - Immediately updates UI with new item
   - Calls service to persist
   - On success: refreshes from server
   - On error: rolls back to previous state

2. **Delete Item**:
   - Immediately removes from UI
   - Calls service to persist
   - On success: refreshes from server
   - On error: rolls back to previous state

3. **Batch Update**:
   - Immediately applies updates to UI
   - Calls service to persist
   - On success: refreshes from server
   - On error: rolls back to previous state

### Subscription Plan Effects

Subscription plans control:

1. **Feature Availability**:
   - `canUseKitList()` - Whether list feature is enabled
   - `canCustomizeKitListUser()` - Whether user can customize
   - `canCustomizeKitListProject()` - Whether project customization is allowed

2. **Limits**:
   - `getKitListMaxAdditions()` - Maximum custom items user can add
   - Limits are checked before allowing add operations
   - Alerts shown when limits reached

3. **Plan Data Source**:
   - Fetched from Firestore: `subscriptionPlans/{plan}`
   - Cached in `SubscriptionService`
   - Accessed via `FeatureAccess` helper class

### Setup Completion Tracking

Setup completion is tracked in `users/{userId}/setup/{setupId}`:

- `customKitListSetup: boolean`
- `customTaskListSetup: boolean`
- `customGroupShotsSetup: boolean`
- `customCoupleShotsSetup: boolean`

**Marked as complete when**:

- List is customized (source !== MASTER_LIST OR defaultValues === false OR lastModifiedBy !== 'system')
- AND user successfully saves the list

**Used to**:

- Show locked state on setup screens
- Track onboarding progress
- Prevent re-editing completed lists

---

## Error Handling

### Error Codes

- **DB_001 (DB_NOT_FOUND)**: List doesn't exist (expected for first-time setup)
- **DB_002 (DB_VALIDATION_ERROR)**: List data integrity failure
- **VALIDATION_FAILED**: Business logic constraints violated (e.g., max items reached)

### Error Recovery

1. **List Not Found**: Automatically fetch master list as fallback
2. **Validation Errors**: Show user-friendly messages, rollback optimistic updates
3. **Network Errors**: Retry with exponential backoff (handled by error recovery utilities)

---

## Summary

The setup module follows a consistent pattern for all list types:

1. **Check** if user list exists
2. **Fetch** master list if needed
3. **Display** list for customization (if subscription allows)
4. **Customize** with optimistic updates
5. **Save** user list
6. **Mark** setup as complete

Subscription plans control:

- Feature availability
- Customization permissions
- Maximum additions limits

All operations use the Result pattern for error handling and optimistic updates for responsive UI.
