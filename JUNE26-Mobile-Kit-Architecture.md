# Mobile Kit Module Architecture & Data Flows

This document details the architecture, component relationships, data flow patterns, database schema paths, validation rules, and error handling behaviors for the **Kit List module** (equipment and gear management) in the Eye-Doo mobile application.

---

## 1. Directory Structure & Key Files

The Kit List module utilizes a **Clean Architecture / Ports & Adapters** design, maintaining a strict unidirectional data flow and domain separation.

*   **Domain & Schema Definition:**
    *   [kit.schema.ts](file:///c:/eye-doo-monorepo/packages/domain/src/project/kit.schema.ts) — Single source of truth for Kit schemas, types, and defaults.
*   **User Interface & Forms:**
    *   [kit-list.tsx](file:///c:/eye-doo-monorepo/apps/mobile/src/app/(protected)/(app)/(dashboard)/(lists)/kit-list.tsx) — The dashboard interactive checklist screen.
    *   [kit.tsx](file:///c:/eye-doo-monorepo/apps/mobile/src/app/(protected)/(setup)/kit.tsx) — The onboarding setup page utilizing `SetupListScreen`.
    *   [kit-item-form.config.ts](file:///c:/eye-doo-monorepo/apps/mobile/src/components/forms/configs/kit-item-form.config.ts) — Renders the glassmorphic add/edit bottom-sheet form via `UnifiedFormModal`.
*   **Hooks (State & Lifecycle):**
    *   [list-hooks.ts](file:///c:/eye-doo-monorepo/apps/mobile/src/hooks/list-hooks.ts) — Declares `useKitList()`.
    *   [use-generic-list.ts](file:///c:/eye-doo-monorepo/apps/mobile/src/hooks/use-generic-list.ts) — Central custom React hook (`useList()`) that manages local list state, loading states, real-time database listener bindings, and optimistic UI updates/rollbacks.
    *   [use-setup-list.ts](file:///c:/eye-doo-monorepo/apps/mobile/src/hooks/setup/use-setup-list.ts) — Onboarding hook (`useSetupKitList()`) managing draft list modifications locally before final batch validation & submission.
*   **Business Logic (Services):**
    *   [kit-list-service.ts](file:///c:/eye-doo-monorepo/apps/mobile/src/services/kit-list-service.ts) — Specific domain service subclass.
    *   [list-service.ts](file:///c:/eye-doo-monorepo/apps/mobile/src/services/list-service.ts) — Generic orchestration service encapsulating max count restrictions and category ownership checks.
*   **Data Access (Repositories):**
    *   [i-list-repository.ts](file:///c:/eye-doo-monorepo/apps/mobile/src/repositories/i-list-repository.ts) — Interface definition (Port) ensuring decoupleability.
    *   [firestore-list-repository.ts](file:///c:/eye-doo-monorepo/apps/mobile/src/repositories/firestore/firestore-list-repository.ts) — Concrete Firebase Firestore implementation (Adapter).
    *   [list.repository.ts](file:///c:/eye-doo-monorepo/apps/mobile/src/repositories/firestore/list.repository.ts) — Singleton instance declarations (`kitRepository`).
    *   [firestore-list-paths.ts](file:///c:/eye-doo-monorepo/apps/mobile/src/repositories/firestore/paths/firestore-list-paths.ts) — Registry of Firestore document key templates.
*   **Utility & Cross-cutting:**
    *   [list-utils.ts](file:///c:/eye-doo-monorepo/apps/mobile/src/utils/list-utils.ts) — Item calculations, type guards, and total updates.

---

## 2. High-Level Component Relationship

The following class/dependency diagram illustrates the Port-Adapter mapping, showcasing how components interact. The UI layer speaks only to Hook wrappers, which access Services via a React `ServiceContext`. The Service layer drives business validations and calls the Repository interface, which maps to the concrete Firestore adapter.

```mermaid
classDiagram
    direction TB
    
    class KitListScreen {
        +useKitList()
        +handleToggleItem()
        +handleResetList()
    }
    
    class KitListSetupScreen {
        +useSetupKitList()
        +addItem()
        +saveList()
    }
    
    class useKitListHook {
        +useList()
        +state: LoadingState
    }
    
    class useSetupKitListHook {
        +useSetupListBase()
        +workingList: KitList
    }
    
    class KitListService {
        +constructor(repository)
    }
    
    class ListService {
        +repository: IListRepository
        +listSchema: ZodSchema
        +addUserItem()
        +updateProjectItem()
        +subscribeToProjectList()
        -validateItemConstraints()
    }
    
    class IListRepository {
        <<interface>>
        +getUserList()
        +saveUserList()
        +addProjectItem()
        +subscribeToProjectList()
    }
    
    class FirestoreListRepository {
        +config: RepositoryConfig
        +parseSnapshot()
        +sanitizeList()
        +toFirestoreDoc()
    }
    
    class FirestoreDatabase {
        <<External>>
    }

    KitListScreen --> useKitListHook : invokes
    KitListSetupScreen --> useSetupKitListHook : invokes
    
    useKitListHook --> KitListService : calls via ServiceContext
    useSetupKitListHook --> KitListService : calls via ServiceContext
    
    KitListService --|> ListService : extends
    ListService --> IListRepository : delegates to (Port)
    
    FirestoreListRepository ..|> IListRepository : implements (Adapter)
    FirestoreListRepository --> FirestoreDatabase : queries / listens
```

---

## 3. Database Schema & Path Configuration

Kit lists are organized at three levels in Firestore, matching the user experience progression:

| Level | Path Registry | Firestore Path Template | Purpose |
| :--- | :--- | :--- | :--- |
| **Master Default** | `MASTER_LIST_PATHS.KIT` | `/masterData/kit` | Global static template containing default categories & core items. |
| **User Template** | `USER_LIST_PATHS.KIT` | `/users/{userId}/lists/kitList` | User-customized master template. Modified during setup and cloned when creating new projects. |
| **Project Instance** | `PROJECT_LIST_PATHS.KIT` | `/projects/{projectId}/lists/kitList` | Active project instance list. Checkmarks checked/unchecked here represent project-specific equipment states. |

### Zod Validation Constraints
*   **KitList Schema:** Contains a `config` (metadata), an array of `categories`, an array of `items`, and a `pendingUpdates` array.
*   **Category Limit:** Maximum of 100 items per category.
*   **Total List Limit:** Maximum of 500 items per list (validated in [list-service.ts](file:///c:/eye-doo-monorepo/apps/mobile/src/services/list-service.ts)).
*   **Kit Item Schema:** Quantity must be an integer, min value 1 (Zod validation: `z.number().int().min(1)`).

---

## 4. Primary Data Flows

### Flow A: Interactive Checklist (Dashboard Screen)

This flow illustrates what happens when a user toggles an equipment item on their dashboard. It utilizes a **real-time subscription** combined with a **local optimistic update**. If the Firestore operation fails, the state rolls back to the previous snapshot.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Screen as KitListScreen
    participant Hook as useKitList (useList)
    participant Service as KitListService
    participant Repo as kitRepository (FirestoreListRepository)
    participant DB as Firestore
    
    Note over Screen, DB: Initialization (Subscription Startup)
    Hook->>Service: subscribeToProjectList(projectId)
    Service->>Repo: subscribeToProjectList(projectId)
    Repo->>DB: onSnapshot(projects/{pid}/lists/kitList)
    DB-->>Repo: document snapshot
    Repo->>Repo: parseSnapshot() & sanitizeList()
    Repo-->>Hook: Result.ok(KitList)
    Hook->>Screen: Update state (LoadingState.success)
    Screen->>User: Render list items

    Note over User, DB: Item Checked Interaction
    User->>Screen: Press Checkbox (Toggle Item)
    Screen->>Hook: batchUpdateProjectItems([{ id, isChecked: true }])
    
    Note over Hook: OPTIMISTIC UPDATE<br/>Update working state in UI immediately<br/>before network request
    Hook->>Hook: setState(success(optimisticList))
    Hook-->>Screen: Re-render with checked state
    
    Hook->>Service: batchUpdateProjectItems(projectId, updates)
    Service->>Repo: batchUpdateProjectItems(projectId, updates)
    
    Repo->>DB: getDoc(projects/{pid}/lists/kitList)
    DB-->>Repo: current doc data
    Repo->>Repo: parseSnapshot() & apply updates
    Repo->>DB: updateDoc(docRef, { items, config })
    
    alt Network Success
        DB-->>Repo: success ack
        Repo-->>Service: Result.ok(void)
        Service-->>Hook: Result.ok(void)
        Note over Hook: Operation succeeded.<br/>The onSnapshot listener will<br/>soon dispatch server confirmation.
    else Network Failure
        DB-->>Repo: error (offline / permission)
        Repo-->>Service: Result.err(AppError)
        Service-->>Hook: Result.err(AppError)
        Note over Hook: ROLLBACK ON FAILURE<br/>Restore list state to previous snapshot
        Hook->>Hook: setState(success(previousList))
        Hook->>Hook: handleError(AppError)
        Hook-->>Screen: Re-render item as Unchecked + Show Alert
    end
```

---

### Flow B: Onboarding Wizard (Setup Screen)

During the first-time app setup, the user configures their template equipment. Instead of hitting the database for every single custom item addition or quantity change, mutations are applied **entirely to local state**. A single batch database request is fired only when the user presses **"Save & Continue"**.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Screen as SetupListScreen
    participant Hook as useSetupKitList (useSetupListBase)
    participant GenericHook as useKitList (useList)
    participant Service as KitListService
    participant Repo as kitRepository
    participant UserServ as UserService
    participant DB as Firestore

    Note over Screen, DB: Wizard Screen Loaded
    Hook->>GenericHook: getMaster() (Loads global default template)
    GenericHook->>Service: getMaster()
    Service->>Repo: getMaster()
    Repo->>DB: getDoc(masterData/kit)
    DB-->>Repo: default items
    Repo-->>Hook: Result.ok(defaultKitList)
    Hook->>Hook: setWorkingList(defaultKitList)
    Hook-->>Screen: Render default template list

    Note over User, DB: User Adds Custom Equipment
    User->>Screen: Type Name & Press 'Add to Kit'
    Screen->>Hook: addItem({ itemName, quantity })
    Note over Hook: Mutation is applied ONLY locally<br/>No database request triggered yet
    Hook->>Hook: setWorkingList(updatedWorkingList)
    Hook-->>Screen: Render updated item list

    Note over User, DB: Save & Proceed
    User->>Screen: Press "Save & Continue"
    Screen->>Hook: saveList()
    
    Hook->>Hook: setIsOperating(true)
    
    Hook->>GenericHook: createOrResetUserList(workingList)
    GenericHook->>Service: createOrResetUserList(userId, workingList)
    Service->>Service: validateWithSchema(kitListSchema, workingList)
    Service->>Repo: createOrResetUserList(userId, workingList)
    Repo->>DB: setDoc(users/{uid}/lists/kitList, sanitizedDoc)
    DB-->>Repo: success ack
    Repo-->>Hook: Result.ok(void)
    
    Hook->>UserServ: updateSetup(userId, { userKitListCreated: true })
    UserServ->>DB: updateDoc(users/{uid}, { setup.userKitListCreated: true })
    DB-->>UserServ: success ack
    UserServ-->>Hook: Result.ok(void)
    
    Hook->>Hook: setWorkingList(null) (Clears draft state)
    Hook->>Hook: setIsOperating(false)
    Hook->>Screen: Navigate to next setup step
```

---

## 5. Normalization, Checks, & Defensive Parsing

Data validation and sanitization are applied at multiple architectural boundaries to ensure Firestore schema errors cannot crash the application:

```
[UI Layer] ---> [Service Layer] ------------------> [Repository Layer] ---------> [Firestore]
                  - Max Items Check                   - Sanitization Helpers
                  - Category Exists Check             - Date/Timestamp Converter
                  - Zod Input Parsing                 - Zod Defensive Parsing
```

### 1. Business Logic Checks (Service Boundary)
In `ListService.validateItemConstraints()`, when adding/editing items:
*   **Total Items Guard:** Rejects operation if list size $\ge 500$ items.
*   **Category Exists Guard:** Validates that the item's `categoryId` matches an ID within `list.categories`.
*   **Category Limit Guard:** Caps items at 100 per category to prevent document size growth issues in sub-lists.

### 2. Sanitization (Repository Output Boundary)
Before writing data to Firestore in `FirestoreListRepository.sanitizeList()`:
*   **Strings:** `sanitizeString()` cleans up whitespace, strips carriage returns, and strips malicious HTML.
*   **Deep Clean:** `removeUndefinedValuesDeep()` deletes any properties with undefined values to prevent Firestore serialization crashes.
*   **Metadata Sync:** Re-tallies `totalItems` and `totalCategories` dynamically based on actual arrays, ensuring counters remain consistent.

### 3. Defensive Parsing & Normalization (Repository Input Boundary)
When reading raw documents from Firestore inside `FirestoreListRepository.parseSnapshot()`:
*   **Timestamp Conversion:** Firestore timestamps are converted to JS Date objects recursively using `convertAllTimestamps()`.
*   **Normalizers:** Legacy lists (e.g. key people roles, priority keys) are dynamically translated into modern schema values before schema checks.
*   **Schema Enforcement:** The object runs through `ZodSchema.safeParse()`. If a validation mismatch occurs (e.g. data corruption by third-party tools/admins):
    *   It blocks corrupt data from reaching the UI.
    *   Logs a detailed error report containing the document path and missing fields using `LoggingService.error()`.
    *   Returns a safe railway error state `Result.err(AppError)` with code `DB_VALIDATION_ERROR` rather than throwing a runtime error.

---

## 6. Railway-Oriented Error Handling Flow

The mobile app does not throw async exceptions. Operations return `Result<T, AppError>`. This structure is propagated cleanly to the screen, where the custom hook wraps error logging and displays UI notices.

```mermaid
graph TD
    classDef success fill:#1b5e20,stroke:#81c784,color:#fff;
    classDef failure fill:#b71c1c,stroke:#e57373,color:#fff;
    classDef neutral fill:#37474f,stroke:#90a4ae,color:#fff;

    A[Firestore Call] -->|Operation Fails| B(Firestore Exception)
    B --> C[ErrorMapper.fromFirestore]
    C --> D[Wrap in Result.err AppError]
    
    D --> E[Service Layer returns Result]
    E --> F[Hook Layer receives Result]
    
    F -->|Result.success === false| G[Call useErrorHandler.handleError]
    F -->|Update Local State| H[Set LoadingState to error]
    
    G --> I[LoggingService.error]
    G --> J[Display Snackbar / Toast]
    
    H --> K[Render LoadingStateDisplay retry banner]

    class D,E,F neutral;
    class G,H,I,J,K failure;
    class A success;
```

> [!IMPORTANT]
> **Key Error Scenarios Handled:**
> 1. **Offline Writes:** The repository utilizes Firebase's local caching. If a write fails permanently, the hook rolls back the optimistic state.
> 2. **Authentication Loss:** If the user session times out during a list operation, the path helper fails safely, the repository returns a `DB_PERMISSION_DENIED` mapped error, and the user is redirected to the login flow.
