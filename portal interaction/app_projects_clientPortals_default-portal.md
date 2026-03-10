# Default-Portal Data Flows

The `default-portal` document in Firestore is the source of truth for a project's client portal state. It resides at `projects/{projectId}/clientPortals/default-portal`.

Below are the Mermaid diagrams visualizing all data flows, interactions, helpers, and cloud functions associated with this document.

---

## 1. High-Level Architecture & Interactions

This diagram shows the complete ecosystem of how the app interacts with the `default-portal` document, including UI hooks, services, repositories, and cloud functions.

```mermaid
graph TD
    subgraph Client Application
        Hook[usePortal Hook<br/>React Component Layer]
        PS[PortalService<br/>Business Logic]
        Repo[FirestorePortalRepository<br/>Data Adapter]
    end

    subgraph Firebase Cloud Functions
        GenLinkFN[generatePortalLink<br>Callable]
        DisableLinkFN[disablePortalLink<br>Callable]
    end

    subgraph Firestore Database
        ProjectDoc[("Project Document<br>projects/{projectId}")]
        PortalDoc[("Portal Document<br>projects/{projectId}/clientPortals/default-portal")]
        PortalAccessColl[("Portal Access<br>portalAccess (Token Storage)")]
        SublistDocs[("Project Lists<br>(keyPeople, timeline, etc.)")]
    end

    %% Flow lines
    Hook -->|User Actions| PS
    Hook -.->|Real-time Data| Repo
    
    PS -->|CRUD Operations| Repo
    PS -->|Generates Link| GenLinkFN
    PS -->|Disables Link| DisableLinkFN
    
    Repo -->|1. read/write| PortalDoc
    Repo -->|2. onSnapshot/subscribe| PortalDoc
    Repo -->|3. update portalId ref| ProjectDoc
    Repo -->|4. finalizeSubcollectionConfig| SublistDocs
    
    GenLinkFN -.->|Stores access token| PortalAccessColl
    GenLinkFN -.->|Returns portalUrl| PS
```

---

## 2. Portal Setup Flow

When a photographer sets up a new portal for a project, the app interacts with Cloud Functions to generate secure tokens and initialises the Firestore structure.

```mermaid
sequenceDiagram
    autonumber
    participant UI as UI Layer
    participant PS as PortalService
    participant CF as Cloud Functions
    participant Repo as FirestorePortalRepository
    participant DB as Firestore DB

    UI->>PS: setupPortal(userId, projectId, steps)
    PS->>PS: Validate steps
    
    PS->>CF: call httpsCallable("generatePortalLink")
    CF-->>PS: returns { portalUrl, portalId }
    Note right of CF: Cloud Function saves a hashed<br/>access token in portalAccess
    
    PS->>Repo: create(portalInput)
    Repo->>DB: setDoc('default-portal', { ...input, dates })
    Repo->>DB: updateDoc(Project, { portalId, hasLaunched: true })
    Repo-->>PS: Result.success(ClientPortal)
    
    PS->>Repo: update(portalId, { expiresAt, portalUrl })
    Repo->>DB: updateDoc('default-portal')
    Repo-->>PS: Result.success()
    PS-->>UI: Setup Complete
```

---

## 3. Step Finalization & Subcollection Triggers

When a specific step in the portal (e.g., Timeline, Key People) is finalized, the `PortalService` calculates stats and `FirestorePortalRepository` explicitly updates deep `config.finalized` flags on related project lists.

```mermaid
sequenceDiagram
    autonumber
    participant UI as UI Layer
    participant PS as PortalService
    participant Repo as FirestorePortalRepository
    participant DB as Firestore

    UI->>PS: updateStepStatus(FINALIZED)
    PS->>Repo: getById('default-portal')
    Repo-->>PS: Current Portal
    
    Note over PS: Begins handleSectionFinalization()
    
    PS->>Repo: finalizeSubcollectionConfig(step)
    Note over Repo: Maps step to specific Firestore list doc<br/>(e.g., projectOnlyLists/timeline)
    Repo->>DB: updateDoc(ListDoc, { "config.finalized": true })
    Repo-->>PS: Success
    
    PS->>PS: incrementCompletedSteps()
    PS->>Repo: update('default-portal', { completedSteps++, completionPercentage })
    
    PS->>PS: checkPortalCompletion()
    opt If all steps are complete
        PS->>Repo: update('default-portal', { completionPercentage: 100 })
    end
    
    PS->>Repo: update('default-portal', { steps: updatedStepsArray })
    Repo->>DB: updateDoc('default-portal')
    PS-->>UI: Updated successfully
```

---

## 4. Real-time Subscriptions Data Flow

The app maintains an optimized, parallel listener system to ensure UI stays in sync with `default-portal` document changes and project context.

```mermaid
graph LR
    subgraph UI 
        Store[Zustand Store]
    end

    subgraph Repository
        Repo[subscribeToUserPortals]
    end
    
    subgraph Firestore
        QueryProjects[Query projects<br>where userId == x]
        QueryPortal[onSnapshot<br>default-portal]
    end

    Repo --> |1. user projects listener| QueryProjects
    QueryProjects -.-> |triggers| Repo
    
    Repo --> |2. loop projects and listen| QueryPortal
    QueryPortal -.-> |triggers| Repo
    
    Repo --> |3. Parse & Combine Results| Repo
    Repo --> |4. onData Callback| Store
```

## Summary of External Dependencies
1. **Firebase Cloud Functions**: `generatePortalLink`, `disablePortalLink`.
2. **Other Firestore Docs**:
   - Updates `projects/{projectId}`.
   - Updates `projects/{projectId}/projectOnlyLists/{sectionId}` (via finalization).
   - Updates `projects/{projectId}/lists/groupShots`.
3. **Core Helpers**: Validation (Zod schemas), result pattern returns, sanitization.
