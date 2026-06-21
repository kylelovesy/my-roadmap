# Mobile Timeline Module Architecture & Data Flows

This document details the architecture, component relationships, data flow patterns, database schema paths, validation rules, and error handling behaviors for the **Project Timeline module** (schedule and chronological wedding day events management) in the Eye-Doo mobile application.

---

## 1. Directory Structure & Key Files

The Timeline module follows a strict **Clean Architecture / Ports & Adapters** design, separating UI views, local state hooks, business services, and database adapters.

*   **Domain & Schema Definition:**
    *   [timeline.schema.ts](file:///c:/eye-doo-monorepo/packages/domain/src/project/timeline.schema.ts) — Source of truth for timeline and event schemas, types, default values, and time sequence validation rules.
*   **User Interface & Screens:**
    *   [index.tsx](file:///c:/eye-doo-monorepo/apps/mobile/src/app/(protected)/(app)/(dashboard)/(timeline)/index.tsx) — Main timeline list view, utilizing `FlatList` to render event sequences.
    *   [edit.tsx](file:///c:/eye-doo-monorepo/apps/mobile/src/app/(protected)/(app)/(dashboard)/(timeline)/edit.tsx) — Event creation/modification editor screen (currently holds placeholder layout).
    *   [TimelineEventCard.tsx](file:///c:/eye-doo-monorepo/apps/mobile/src/components/dashboard/timeline/TimelineEventCard.tsx) — Renders individual cards detailing event type icons, times, and notes.
*   **Hooks (State & Lifecycle):**
    *   [use-timeline-screen.ts](file:///c:/eye-doo-monorepo/apps/mobile/src/hooks/use-timeline-screen.ts) — Custom layout hook sorting items chronologically and fetching active project IDs.
    *   [use-timeline.ts](file:///c:/eye-doo-monorepo/apps/mobile/src/hooks/use-timeline.ts) — Core hook implementing local state management, subscription handlers, and optimistic updates.
    *   [use-project-timeline.ts](file:///c:/eye-doo-monorepo/apps/mobile/src/hooks/use-project-timeline.ts) — Simple project-scoped wrapper around `useTimeline`.
*   **Global Stores (Caching & Background Context):**
    *   [use-timeline-store.ts](file:///c:/eye-doo-monorepo/apps/mobile/src/stores/use-timeline-store.ts) — Declares a global Zustand store for cross-cutting synchronization (declared but bypassed in favor of local hook subscriptions in the active dashboard screens).
*   **Business Logic (Services):**
    *   [base-timeline-service.ts](file:///c:/eye-doo-monorepo/apps/mobile/src/services/base-timeline-service.ts) — Validates events and applies business finalization/limit guards.
*   **Data Access (Repositories):**
    *   [i-base-timeline-repository.ts](file:///c:/eye-doo-monorepo/apps/mobile/src/repositories/i-base-timeline-repository.ts) — Repository interface Port.
    *   [firestore-base-timeline-repository.ts](file:///c:/eye-doo-monorepo/apps/mobile/src/repositories/firestore/firestore-base-timeline-repository.ts) — Concrete Firestore Adapter.
    *   [firestore-project-paths.ts](file:///c:/eye-doo-monorepo/apps/mobile/src/repositories/firestore/paths/firestore-project-paths.ts) — Firestore path template declarations (`PROJECT_PATHS.TIMELINE_LIST`).
*   **Utility & Formatting:**
    *   [timeline-display-helpers.ts](file:///c:/eye-doo-monorepo/apps/mobile/src/utils/presentation/timeline-display-helpers.ts) — Translates event types to SVG icon names, titles, and time range labels.

---

## 2. High-Level Component Relationship

Below is the class relationship and Ports & Adapters diagram for the Timeline module, detailing how components communicate unidirectionally.

```mermaid
classDiagram
    direction TB
    
    class TimelineScreen {
        +useTimelineScreen()
        +handleEventPress()
        +handleAddPress()
    }
    
    class useTimelineScreenHook {
        +useTimeline()
        +sortTimelineEvents()
        +events: TimelineEvent[]
    }
    
    class useTimelineHook {
        +state: LoadingState
        +addEvent(eventInput)
        +updateEvent(id, updates)
        +deleteEvent(id)
    }
    
    class IBaseTimelineService {
        <<interface>>
        +addEvent()
        +updateEvent()
        +subscribeToProjectTimeline()
    }
    
    class BaseTimelineService {
        +repository: IBaseTimelineRepository
        +addEvent()
        +ensureNotFinalized()
        +ensureUnderLimit()
    }
    
    class IBaseTimelineRepository {
        <<interface>>
        +get()
        +setEvents()
        +addEvent()
        +subscribe()
    }
    
    class FirestoreBaseTimelineRepository {
        +parseSnapshot()
        +validateEvent()
        +subscribe()
    }
    
    class FirestoreDatabase {
        <<External>>
    }

    TimelineScreen --> useTimelineScreenHook : invokes
    useTimelineScreenHook --> useTimelineHook : invokes
    
    useTimelineHook --> IBaseTimelineService : calls via ServiceContext
    BaseTimelineService ..|> IBaseTimelineService : implements
    
    BaseTimelineService --> IBaseTimelineRepository : delegates to (Port)
    FirestoreBaseTimelineRepository ..|> IBaseTimelineRepository : implements (Adapter)
    
    FirestoreBaseTimelineRepository --> FirestoreDatabase : queries / listens
```

---

## 3. Database Schema & Path Configuration

Timeline lists are **Project-Only** entities. Unlike equipment lists, there is no intermediate "user template". The document path is mapped directly to a project's sub-collection:

*   **Firestore Document Path:** `/projects/{projectId}/projectOnlyLists/timeline` (Registered under `PROJECT_PATHS.TIMELINE_LIST` in [firestore-project-paths.ts](file:///c:/eye-doo-monorepo/apps/mobile/src/repositories/firestore/paths/firestore-project-paths.ts)).

### Zod Validation Constraints
*   **TimelineList Schema:** Compiles a `config` (metadata), an array of `items` (`TimelineEvent` objects), and `pendingUpdates`.
*   **Time Sequence Rule:** In `timelineEventWithTimesSchema`, `endTime` must be strictly after `startTime` (Zod `refine` assertion).
*   **Volume Guard:** The list size is capped at 50 events max (validated in [base-timeline-service.ts](file:///c:/eye-doo-monorepo/apps/mobile/src/services/base-timeline-service.ts) against `DEFAULT_SECTION_LIMITS.timeline`).

---

## 4. Main Data Flows

### Flow A: Real-time Timeline Sync & Event Mutations

This diagram maps out the data flow from when a user views the timeline, to when they add a new event. It illustrates the **real-time subscription loop** combined with an **optimistic local update**.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Screen as TimelineScreen
    participant Hook as useTimeline
    participant Service as BaseTimelineService
    participant Repo as BaseTimelineRepository
    participant DB as Firestore
    
    Note over Screen, DB: 1. Real-time Subscription Startup
    Hook->>Service: subscribeToProjectTimeline(projectId)
    Service->>Repo: subscribe(projectId)
    Repo->>DB: onSnapshot(projects/{pid}/projectOnlyLists/timeline)
    DB-->>Repo: document snapshot
    Repo->>Repo: parseSnapshot() & Zod schema validation
    Repo-->>Hook: Result.ok(TimelineList)
    Hook->>Hook: setState(success(TimelineList))
    Hook-->>Screen: Re-render list
    Screen->>User: Display sorted events

    Note over User, DB: 2. Add New Event Interaction
    User->>Screen: Fill Form & Press "Save Event"
    Screen->>Hook: addEvent(eventInput)
    
    Note over Hook: OPTIMISTIC UPDATE<br/>Update UI immediately with a temporary ID<br/>before the server request starts
    Hook->>Hook: Generate optimisticEvent (id: temp-timestamp)
    Hook->>Hook: setState(success(optimisticTimeline))
    Hook-->>Screen: Re-render with new item visible
    
    Hook->>Service: addEvent(projectId, eventInput)
    Service->>Service: validateWithSchema(timelineEventInputSchema, eventInput)
    
    Service->>Repo: get(projectId) (Fetches current config to verify constraints)
    Repo-->>Service: current timeline doc
    Service->>Service: ensureNotFinalized() & ensureUnderLimit()
    
    Service->>Repo: addEvent(projectId, eventWithoutId)
    Repo->>Repo: generateId() (Creates final UUID)
    Repo->>DB: updateDoc(docRef, { items: nextItems, updatedAt: serverTimestamp })
    
    alt Network Success
        DB-->>Repo: success ack
        Repo-->>Service: Result.ok(newUUID)
        Service-->>Hook: Result.ok(createdEvent)
        Note over Hook: Server write succeeded.<br/>The onSnapshot listener will<br/>soon dispatch official data.
    else Network Failure (Rollback)
        DB-->>Repo: error (offline / permission)
        Repo-->>Service: Result.err(AppError)
        Service-->>Hook: Result.err(AppError)
        Note over Hook: ROLLBACK STATE<br/>Reset state to last known server state
        Hook->>Hook: setState(success(currentData))
        Hook->>Hook: handleError(AppError)
        Hook-->>Screen: Remove optimistic item & show error dialog
    end
```

---

## 5. Normalization, Checks, & Defensive Parsing

```
[UI Layer] ---> [Service Layer] --------------------> [Repository Layer] ------> [Firestore]
                  - Finalization Guard                 - Zod Defensive Parsing
                  - Max Count Guard (50)               - Date/Timestamp Converter
                  - Zod Input Parsing                  - UUID Generator
```

### 1. Business Logic Guards (Service Boundary)
In `BaseTimelineService`:
*   **Finalization Guard:** Verifies `config.finalized` is false. If true, rejects any modifications immediately.
*   **List Limit Guard:** Prevents additions if the event list is already at 50 events (`DEFAULT_SECTION_LIMITS.timeline`).

### 2. Defensive Parsing & Normalization (Repository Boundary)
*   **Timestamp Normalization:** Raw documents loaded from Firestore are ran through `convertAllTimestamps()`, recursively mapping Firebase Timestamp structures to native JavaScript Date objects.
*   **Display Value Normalization:** In [timeline-display-helpers.ts](file:///c:/eye-doo-monorepo/apps/mobile/src/utils/presentation/timeline-display-helpers.ts):
    *   **Time Labels:** Computes strings like `"09:00 - 10:30 • 90 min"` based on `startTime`, `endTime`, and `duration`.
    *   **Icons:** Map event types to specific icons (e.g. `BRIDAL_PREP` $\to$ `'account-circle'`, `GROUP_PHOTOS` $\to$ `'account-group'`).
*   **Data Integrity Check:** The repository parses Firestore snapshots through `timelineListSchema.safeParse()`. If any corrupted fields are found (e.g., end time preceding start time, missing fields), the error is logged to `LoggingService.error()` and a structured `Result.err(AppError)` is returned, shielding the UI.

---

## 6. Railway-Oriented Error Handling Flow

The repository and service levels return `Result<T, AppError>`. This structure propagates cleanly up to the screen, where the custom hook manages the error presentation.

```mermaid
graph TD
    classDef success fill:#1b5e20,stroke:#81c784,color:#fff;
    classDef failure fill:#b71c1c,stroke:#e57373,color:#fff;
    classDef neutral fill:#37474f,stroke:#90a4ae,color:#fff;

    A[Firestore Query] -->|Operation Fails| B(Firestore Exception)
    B --> C[ErrorMapper.fromFirestore]
    C --> D[Result.err AppError]
    
    D --> E[Service Layer returns Result]
    E --> F[Hook Layer receives Result]
    
    F -->|Result.success === false| G[Call useErrorHandler.handleError]
    F -->|Update State| H[Set LoadingState to error]
    
    G --> I[LoggingService.error]
    G --> J[Display Snackbar / Toast]
    
    H --> K[Render LoadingStateDisplay error card]

    class D,E,F neutral;
    class G,H,I,J,K failure;
    class A success;
```
