# Client Portal Data Flow Diagrams

This document contains comprehensive Mermaid diagrams showing all data flows, interactions, triggers, Firebase functions, and helpers that interact with the Firestore document at `/projects/{projectId}/clientPortals/default-portal`.

## Table of Contents
1. [High-Level Architecture](#1-high-level-architecture)
2. [Portal Creation Flow](#2-portal-creation-flow)
3. [Client Authentication Flow](#3-client-authentication-flow)
4. [Portal Data Read Operations](#4-portal-data-read-operations)
5. [Section Submit Flow](#5-section-submit-flow)
6. [Section Skip Flow](#6-section-skip-flow)
7. [Photographer Review Flow](#7-photographer-review-flow)
8. [Portal Finalization Flow](#8-portal-finalization-flow)
9. [Real-Time Updates (SSE)](#9-real-time-updates-sse)
10. [Helper Functions & Utilities](#10-helper-functions--utilities)
11. [Complete Entity Relationship](#11-complete-entity-relationship)

---

## 1. High-Level Architecture

```mermaid
graph TB
    subgraph "Client Portal App"
        UI[Client UI]
        Store[usePortalStore]
        Service[portalService]
    end
    
    subgraph "Next.js API Routes"
        AuthAPI[/api/auth/portal]
        ProjectAPI[/api/wedding/projectId]
        PortalAPI[/api/wedding/projectId/portal]
        SectionAPI[/api/wedding/projectId/section/sectionId/*]
        TrackAPI[/api/wedding/projectId/track-access]
        StepAPI[/api/wedding/projectId/current-step]
        StreamAPI[/api/wedding/projectId/stream]
    end
    
    subgraph "Firebase Functions"
        GenerateLink[generatePortalLink]
        DisableLink[disablePortalLink]
        ApproveSection[photographerApproveSection]
        RequestRevision[photographerRequestRevision]
        OnSubmitted[onSectionSubmitted Trigger]
        OnFinalized[onSectionFinalized Trigger]
    end
    
    subgraph "Firestore Collections"
        Projects[(projects)]
        ClientPortals[(clientPortals subcollection)]
        PortalAccess[(portalAccess)]
        ProjectOnlyLists[(projectOnlyLists)]
        Lists[(lists)]
    end
    
    subgraph "Key Document"
        DefaultPortal["/projects/{projectId}/clientPortals/default-portal"]
    end
    
    UI --> Store
    Store --> Service
    Service --> AuthAPI
    Service --> ProjectAPI
    Service --> PortalAPI
    Service --> SectionAPI
    Service --> TrackAPI
    Service --> StepAPI
    Service --> StreamAPI
    
    AuthAPI --> PortalAccess
    ProjectAPI --> Projects
    ProjectAPI --> DefaultPortal
    PortalAPI --> DefaultPortal
    SectionAPI --> DefaultPortal
    SectionAPI --> ProjectOnlyLists
    SectionAPI --> Lists
    SectionAPI --> PortalAccess
    TrackAPI --> DefaultPortal
    StepAPI --> DefaultPortal
    StreamAPI --> DefaultPortal
    
    GenerateLink --> DefaultPortal
    GenerateLink --> PortalAccess
    GenerateLink --> Projects
    DisableLink --> DefaultPortal
    DisableLink --> PortalAccess
    ApproveSection --> DefaultPortal
    ApproveSection --> ProjectOnlyLists
    ApproveSection --> Lists
    RequestRevision --> DefaultPortal
    RequestRevision --> ProjectOnlyLists
    RequestRevision --> Lists
    
    OnSubmitted --> ProjectOnlyLists
    OnSubmitted --> Lists
    OnFinalized --> DefaultPortal
    OnFinalized --> PortalAccess
    
    DefaultPortal -.part of.-> ClientPortals
    ClientPortals -.subcollection of.-> Projects
```

---

## 2. Portal Creation Flow

```mermaid
sequenceDiagram
    participant Photographer as Photographer (Mobile App)
    participant GenerateLink as Firebase Function: generatePortalLink
    participant Firestore as Firestore
    participant DefaultPortal as /projects/{projectId}/clientPortals/default-portal
    participant PortalAccess as /portalAccess/{projectId}
    participant Project as /projects/{projectId}
    
    Photographer->>GenerateLink: Call with projectId, selectedSteps
    
    Note over GenerateLink: Generate raw token (64 hex chars)
    Note over GenerateLink: Hash token with SHA-256
    Note over GenerateLink: Create portalId
    Note over GenerateLink: Transform selectedSteps to PortalStep objects
    
    GenerateLink->>Firestore: START TRANSACTION
    
    GenerateLink->>PortalAccess: SET document
    Note over PortalAccess: Store hashed token<br/>selectedSteps<br/>isEnabled: true<br/>portalStatus: "active"<br/>expiresAt: +30 days
    
    GenerateLink->>DefaultPortal: SET document
    Note over DefaultPortal: isSetup: true<br/>portalSetupComplete: true<br/>isEnabled: true<br/>portalUrl: URL with raw token<br/>currentStepID: first step<br/>steps: initializedSteps<br/>metadata: initial stats
    
    GenerateLink->>Project: UPDATE document
    Note over Project: portalId: "default-portal"<br/>metadata.hasLaunchedDashboard: true<br/>metadata.portalSetupDate: timestamp
    
    GenerateLink->>Firestore: COMMIT TRANSACTION
    
    GenerateLink-->>Photographer: Return { portalUrl, portalId }
    
    Note over Photographer: Share portalUrl with client<br/>(contains raw token)
```

---

## 3. Client Authentication Flow

```mermaid
sequenceDiagram
    participant Client as Client Browser
    participant AuthAPI as /api/auth/portal
    participant PortalAccess as /portalAccess/{projectId}
    participant Response as HTTP Response
    
    Client->>AuthAPI: POST { projectId, token (raw) }
    
    Note over AuthAPI: Hash raw token with SHA-256
    
    AuthAPI->>PortalAccess: GET document
    PortalAccess-->>AuthAPI: Return portal data
    
    alt Valid Token & Active Portal
        Note over AuthAPI: Verify:<br/>- hashedToken matches<br/>- isEnabled: true<br/>- portalStatus: "active"<br/>- not expired
        
        Note over AuthAPI: Create JWT with:<br/>{ projectId, role: "client" }<br/>Valid for 7 days
        
        AuthAPI->>PortalAccess: UPDATE accessCount++, lastAccessedAt
        
        AuthAPI->>Response: Set httpOnly cookie "portal_session"
        AuthAPI-->>Client: Return { success: true }
        
    else Invalid/Expired Token
        AuthAPI-->>Client: Return 401 error
    end
```

---

## 4. Portal Data Read Operations

```mermaid
sequenceDiagram
    participant Store as usePortalStore
    participant Service as portalService
    participant TrackAPI as /api/track-access
    participant ProjectAPI as /api/wedding/projectId
    participant PortalAPI as /api/portal
    participant SectionAPIs as /api/section/sectionId
    participant DefaultPortal as default-portal doc
    participant Project as /projects/{projectId}
    
    Store->>Store: initialize(projectId)
    
    Note over Store: Clear localStorage<br/>Clear draft timers
    
    Store->>Service: trackClientAccess(projectId)
    Service->>TrackAPI: POST (best effort, non-blocking)
    TrackAPI->>DefaultPortal: READ document
    
    alt Should increment count (>30 min since last)
        TrackAPI->>DefaultPortal: UPDATE<br/>metadata.lastClientActivity<br/>metadata.clientAccessCount++
    else Recent activity
        TrackAPI->>DefaultPortal: UPDATE<br/>metadata.lastClientActivity only
    end
    
    par Parallel Data Fetch
        Store->>Service: getInitialData(projectId)
        Service->>ProjectAPI: GET with session cookie
        ProjectAPI->>Project: READ document
        ProjectAPI->>DefaultPortal: READ document
        ProjectAPI-->>Service: Return merged project + portal data
        
        Store->>Service: fetchCategoryData("keyPeople")
        Store->>Service: fetchCategoryData("locations")
        Store->>Service: fetchCategoryData("groupShots")
        Store->>Service: fetchCategoryData("photoRequests")
        Store->>Service: fetchCategoryData("timeline")
        
        Service->>SectionAPIs: GET each section
        SectionAPIs-->>Service: Return section data
    end
    
    Service-->>Store: All data loaded
    
    Note over Store: Set state with:<br/>- project data<br/>- section data<br/>- isLoading: false
```

---

## 5. Section Submit Flow

```mermaid
sequenceDiagram
    participant Client as Client UI
    participant Store as usePortalStore
    participant Service as portalService
    participant SubmitAPI as /api/section/sectionId/submit
    participant SectionDoc as Section Document
    participant DefaultPortal as default-portal doc
    participant PortalAccess as /portalAccess/{projectId}
    participant Trigger as Firebase Trigger
    participant Photographer as Photographer (Push Notification)
    
    Client->>Store: saveCurrentStep()
    Store->>Service: submitSection(projectId, sectionId, data)
    Service->>SubmitAPI: POST { list: [...items] }
    
    Note over SubmitAPI: Validate with Zod schema<br/>Check item count limits
    
    SubmitAPI->>SubmitAPI: START TRANSACTION
    
    SubmitAPI->>SectionDoc: READ document
    Note over SubmitAPI: Check section status<br/>Verify not locked/finalized
    
    SubmitAPI->>DefaultPortal: READ document
    SubmitAPI->>PortalAccess: READ document
    
    alt Section is unlocked
        SubmitAPI->>SectionDoc: SET (merge)
        Note over SectionDoc: items: validated list<br/>config.status: "locked"<br/>config.actionOn: "photographer"<br/>config.clientSubmittedAt: timestamp<br/>config.totalItems: count
        
        SubmitAPI->>DefaultPortal: UPDATE steps array
        Note over DefaultPortal: Find matching step<br/>Set stepStatus: "review"<br/>Set actionOn: "photographer"<br/>Update lastUpdated
        
        SubmitAPI->>PortalAccess: UPDATE selectedSteps array
        Note over PortalAccess: Mirror step status update
        
        SubmitAPI->>SubmitAPI: COMMIT TRANSACTION
        
        SubmitAPI-->>Service: Return { success: true }
        Service-->>Store: Update complete
        Store-->>Client: Show success message
        
        Note over SectionDoc: Document update triggers...
        SectionDoc->>Trigger: onDocumentUpdated
        
        Note over Trigger: Detect status change to "locked"<br/>with actionOn: "photographer"
        
        Trigger->>Photographer: Send push notification<br/>"Client submitted {section} for review"
        
    else Section is locked/finalized
        SubmitAPI-->>Service: Return 403 error
        Service-->>Store: Set error
        Store-->>Client: Show error message
    end
```

---

## 6. Section Skip Flow

```mermaid
sequenceDiagram
    participant Client as Client UI
    participant Store as usePortalStore
    participant Service as portalService
    participant SkipAPI as /api/section/sectionId/skip
    participant SectionDoc as Section Document
    participant DefaultPortal as default-portal doc
    participant PortalAccess as /portalAccess/{projectId}
    
    Client->>Store: skipStep(stepId)
    Store->>Service: skipSection(projectId, sectionId)
    Service->>SkipAPI: POST
    
    SkipAPI->>SkipAPI: START TRANSACTION
    
    SkipAPI->>SectionDoc: READ document
    SkipAPI->>DefaultPortal: READ document
    SkipAPI->>PortalAccess: READ document
    
    Note over SkipAPI: Verify section not locked/finalized
    
    alt Section can be skipped
        SkipAPI->>SectionDoc: SET (merge)
        Note over SectionDoc: config.status: "finalized"<br/>config.skippedByClient: true<br/>config.skipped: true<br/>config.finalized: true<br/>config.actionOn: "none"<br/>config.skippedAt: timestamp
        
        Note over SkipAPI: Calculate completion percentage
        
        SkipAPI->>DefaultPortal: UPDATE
        Note over DefaultPortal: steps[i].stepStatus: "finalized"<br/>steps[i].actionOn: "none"<br/>currentStepID: "welcome"<br/>completedSteps++<br/>completionPercentage: calculated<br/>lastUpdated: timestamp
        
        SkipAPI->>PortalAccess: UPDATE selectedSteps array
        Note over PortalAccess: Mirror step status update
        
        SkipAPI->>SkipAPI: COMMIT TRANSACTION
        
        SkipAPI-->>Service: Return { success: true }
        Service-->>Store: Update complete
        Store-->>Client: Navigate to welcome step
        
    else Section is locked/finalized
        SkipAPI-->>Service: Return 403 error
        Service-->>Store: Set error
        Store-->>Client: Show error message
    end
```

---

## 7. Photographer Review Flow

```mermaid
sequenceDiagram
    participant Photographer as Photographer (Mobile App)
    participant Function as Firebase Function
    participant SectionDoc as Section Document
    participant DefaultPortal as default-portal doc
    participant Client as Client Portal
    participant ConfirmAPI as /api/confirm-review
    
    rect rgb(200, 220, 255)
        Note over Photographer,DefaultPortal: SCENARIO A: Photographer Approves Section
        
        Photographer->>Function: photographerApproveSection(projectId, sectionId)
        
        Function->>Function: START TRANSACTION
        
        Function->>SectionDoc: READ document
        Function->>DefaultPortal: READ document
        
        Function->>SectionDoc: SET (merge)
        Note over SectionDoc: config.status: "finalized"<br/>config.finalized: true<br/>config.actionOn: "none"<br/>config.approvedAt: timestamp<br/>config.approvedBy: userId
        
        Function->>DefaultPortal: UPDATE steps array
        Note over DefaultPortal: steps[i].stepStatus: "finalized"<br/>steps[i].actionOn: "none"<br/>lastUpdated: timestamp
        
        Function->>Function: COMMIT TRANSACTION
        
        Function-->>Photographer: Return { success: true }
        
        Note over Client: Real-time update via SSE<br/>Shows section as finalized
    end
    
    rect rgb(255, 220, 200)
        Note over Photographer,Client: SCENARIO B: Photographer Requests Revision
        
        Photographer->>Function: photographerRequestRevision(projectId, sectionId, reason)
        
        Function->>Function: START TRANSACTION
        
        Function->>SectionDoc: READ document
        Function->>DefaultPortal: READ document
        
        Function->>SectionDoc: SET (merge)
        Note over SectionDoc: config.status: "unlocked"<br/>config.actionOn: "client"<br/>config.revisionRequested: true<br/>config.revisionReason: reason<br/>config.revisionRequestedAt: timestamp<br/>config.revisionRequestedBy: userId
        
        Function->>DefaultPortal: UPDATE steps array
        Note over DefaultPortal: steps[i].stepStatus: "unlocked"<br/>steps[i].actionOn: "client"<br/>lastUpdated: timestamp
        
        Function->>Function: COMMIT TRANSACTION
        
        Function-->>Photographer: Return { success: true }
        
        Note over Client: Real-time update via SSE<br/>Shows revision request
        
        Client->>ConfirmAPI: POST confirm-review
        
        ConfirmAPI->>ConfirmAPI: START TRANSACTION
        
        ConfirmAPI->>SectionDoc: READ and verify status is "locked"
        
        ConfirmAPI->>SectionDoc: SET (merge)
        Note over SectionDoc: config.status: "unlocked"<br/>config.actionOn: "client"<br/>config.clientReviewConfirmedAt: timestamp
        
        ConfirmAPI->>DefaultPortal: UPDATE steps array
        Note over DefaultPortal: steps[i].stepStatus: "unlocked"<br/>steps[i].actionOn: "client"
        
        ConfirmAPI->>ConfirmAPI: COMMIT TRANSACTION
        
        Note over Client: Client can now re-edit and resubmit
    end
```

---

## 8. Portal Finalization Flow

```mermaid
sequenceDiagram
    participant SectionDoc as Any Section Document
    participant Trigger as onSectionFinalized Trigger
    participant AllSections as All 5 Section Documents
    participant DefaultPortal as default-portal doc
    participant PortalAccess as /portalAccess/{projectId}
    participant Client as Client Portal
    
    Note over SectionDoc: Section status changes to "finalized"
    
    SectionDoc->>Trigger: onDocumentUpdated event
    
    Note over Trigger: Detect status change<br/>from non-finalized to "finalized"
    
    Trigger->>AllSections: READ all 5 section documents
    Note over Trigger: Check sections:<br/>- keyPeople<br/>- locations<br/>- photoRequests<br/>- timeline<br/>- groupShots
    
    alt All sections are finalized
        Note over Trigger: All required sections complete!
        
        Trigger->>Trigger: START BATCH WRITE
        
        Trigger->>PortalAccess: UPDATE document
        Note over PortalAccess: portalStatus: "finalized"<br/>isEnabled: false<br/>accessToken: DELETE<br/>finalizedAt: timestamp
        
        Trigger->>DefaultPortal: UPDATE document
        Note over DefaultPortal: isEnabled: false<br/>currentStepID: "thankYou"<br/>lastUpdated: timestamp
        
        Trigger->>Trigger: COMMIT BATCH
        
        Note over Client: Real-time update via SSE<br/>Portal shows thank you page<br/>Access token invalidated
        
    else Some sections not finalized
        Note over Trigger: Do nothing, wait for more sections
    end
```

---

## 9. Real-Time Updates (SSE)

```mermaid
sequenceDiagram
    participant Client as Client Browser
    participant StreamAPI as /api/wedding/projectId/stream
    participant DefaultPortal as default-portal doc
    participant Firestore as Firestore Listener
    
    Client->>StreamAPI: GET (establish SSE connection)
    
    Note over StreamAPI: Verify session cookie
    
    StreamAPI->>DefaultPortal: Setup onSnapshot listener
    
    Note over StreamAPI: Create ReadableStream
    
    StreamAPI-->>Client: Return SSE stream<br/>Content-Type: text/event-stream
    
    loop Real-time updates
        DefaultPortal->>Firestore: Document changes
        Firestore->>StreamAPI: Snapshot callback
        
        Note over StreamAPI: Extract data:<br/>- currentStepID<br/>- steps (normalized)<br/>- metadata<br/>- portalMessage
        
        StreamAPI->>StreamAPI: Format as SSE message<br/>data: {...}\n\n
        
        StreamAPI-->>Client: Send SSE event
        
        Client->>Client: usePortalStore.updateFromStream(data)
        
        Note over Client: UI updates automatically:<br/>- Step statuses<br/>- Progress indicators<br/>- Action requirements
    end
    
    alt Client disconnects
        Client->>StreamAPI: Close connection
        StreamAPI->>Firestore: Unsubscribe listener
    end
```

---

## 10. Helper Functions & Utilities

```mermaid
graph TB
    subgraph "portalAlignment.ts Helpers"
        GetPortalPath[getPortalDocPath]
        GetSectionPath[getCanonicalSectionDocPath]
        NormalizeSteps[normalizePortalSteps]
        PatchStep[patchPortalStep]
        GetStatus[getCanonicalSectionStatus]
        IsLocked[isSectionLockedLike]
    end
    
    subgraph "Firebase Functions Helpers"
        GetPortalRef[getPortalDocRef]
        GetSectionRef[getSectionDocRef]
        GetSectionState[getSectionState]
        BuildPayload[buildSectionWritePayload]
    end
    
    subgraph "Usage in API Routes"
        ProjectRoute[/api/wedding/projectId]
        PortalRoute[/api/portal]
        SectionRoutes[/api/section/*/]
        StreamRoute[/api/stream]
        StepRoute[/api/current-step]
    end
    
    subgraph "Usage in Firebase Functions"
        GenerateFn[generatePortalLink]
        DisableFn[disablePortalLink]
        ApproveFn[photographerApproveSection]
        RevisionFn[photographerRequestRevision]
        TriggerFns[onSection* Triggers]
    end
    
    GetPortalPath --> ProjectRoute
    GetPortalPath --> PortalRoute
    GetPortalPath --> StreamRoute
    GetPortalPath --> StepRoute
    
    GetSectionPath --> SectionRoutes
    
    NormalizeSteps --> ProjectRoute
    NormalizeSteps --> PortalRoute
    NormalizeSteps --> StreamRoute
    
    PatchStep --> SectionRoutes
    
    GetStatus --> SectionRoutes
    
    IsLocked --> SectionRoutes
    
    GetPortalRef --> GenerateFn
    GetPortalRef --> DisableFn
    GetPortalRef --> ApproveFn
    GetPortalRef --> RevisionFn
    GetPortalRef --> TriggerFns
    
    GetSectionRef --> ApproveFn
    GetSectionRef --> RevisionFn
    GetSectionRef --> TriggerFns
    
    GetSectionState --> TriggerFns
    
    BuildPayload --> TriggerFns
    
    style GetPortalPath fill:#e1f5ff
    style GetPortalRef fill:#e1f5ff
    style NormalizeSteps fill:#ffe1f5
    style PatchStep fill:#ffe1f5
```

---

## 11. Complete Entity Relationship

```mermaid
erDiagram
    PROJECTS ||--o{ CLIENT_PORTALS : contains
    PROJECTS ||--o{ PROJECT_ONLY_LISTS : contains
    PROJECTS ||--o{ LISTS : contains
    PROJECTS ||--|| PORTAL_ACCESS : "linked by projectId"
    
    CLIENT_PORTALS {
        string id "default-portal"
        boolean isSetup
        boolean portalSetupComplete
        boolean isEnabled
        string portalUrl
        timestamp setupDate
        timestamp lastUpdated
        string currentStepID
        string portalMessage
        array steps
        object metadata
    }
    
    PORTAL_ACCESS {
        string projectId "document ID"
        string accessToken "hashed"
        string portalId
        array selectedSteps
        boolean isEnabled
        string portalStatus
        timestamp createdAt
        timestamp expiresAt
        number accessCount
        timestamp lastAccessedAt
    }
    
    PROJECT_ONLY_LISTS {
        string id "keyPeople | locations | photoRequests | timeline"
        array items
        object config
        array pendingUpdates
    }
    
    LISTS {
        string id "groupShots"
        array items
        object config
        array categories
    }
    
    PROJECTS {
        string id "projectId"
        string projectName
        timestamp eventDate
        string photographerName
        object personAName
        object personBName
        string portalId
        object metadata
    }
    
    CLIENT_PORTALS ||--o{ STEPS : contains
    PORTAL_ACCESS ||--o{ SELECTED_STEPS : contains
    
    STEPS {
        string id
        string portalStepID
        string stepTitle
        number stepNumber
        boolean requiredStep
        string stepIcon
        string stepStatus
        string stepDescription
        string actionOn
    }
    
    SELECTED_STEPS {
        string id
        string portalStepID
        string stepStatus
        string actionOn
    }
    
    CLIENT_PORTALS }o--|| METADATA : has
    
    METADATA {
        number totalSteps
        number completedSteps
        number completionPercentage
        timestamp lastClientActivity
        number clientAccessCount
    }
```

---

## Summary of Interactions with `/projects/{projectId}/clientPortals/default-portal`

### Write Operations (CREATE/UPDATE)

1. **generatePortalLink** (Firebase Function)
   - Creates the document with initial setup
   - Sets: `isSetup`, `portalSetupComplete`, `isEnabled`, `portalUrl`, `currentStepID`, `steps`, `metadata`

2. **disablePortalLink** (Firebase Function)
   - Updates: `isEnabled: false`, `lastUpdated`

3. **photographerApproveSection** (Firebase Function)
   - Updates: `steps` array (specific step status), `lastUpdated`

4. **photographerRequestRevision** (Firebase Function)
   - Updates: `steps` array (specific step status), `lastUpdated`

5. **POST /api/section/[sectionId]/submit**
   - Updates: `steps` array (set to "review"), `lastUpdated`

6. **POST /api/section/[sectionId]/skip**
   - Updates: `steps` array (set to "finalized"), `currentStepID`, `completedSteps`, `completionPercentage`, `lastUpdated`

7. **POST /api/section/[sectionId]/confirm-review**
   - Updates: `steps` array (set to "unlocked"), `lastUpdated`

8. **POST /api/track-access**
   - Updates: `metadata.lastClientActivity`, `metadata.clientAccessCount` (conditional), `lastUpdated`

9. **PATCH /api/current-step**
   - Updates: `currentStepID`, `lastUpdated`

10. **onSectionFinalized** (Firebase Trigger)
    - Updates: `isEnabled: false`, `currentStepID: "thankYou"`, `lastUpdated`

### Read Operations

1. **GET /api/wedding/[projectId]**
   - Reads: entire document for initial project load

2. **GET /api/portal**
   - Reads: entire document for portal-specific data

3. **GET /api/current-step**
   - Reads: `currentStepID`

4. **GET /api/stream** (SSE)
   - Listens: real-time updates to `currentStepID`, `steps`, `metadata`, `portalMessage`

5. **POST /api/track-access**
   - Reads: `metadata.lastClientActivity` (to determine if count should increment)

6. All section operation routes (submit, skip, confirm-review)
   - Read: `steps` array for transaction validation

### Helper Functions

- **getPortalDocPath()**: Returns canonical path string
- **normalizePortalSteps()**: Ensures consistent step structure
- **patchPortalStep()**: Updates specific step in steps array
- **getPortalDocRef()**: Returns Firestore document reference (Firebase Functions)

### Triggers

- **onProjectOnlyListSectionSubmitted**: Monitors section submissions, sends push notifications
- **onListSectionSubmitted**: Monitors groupShots submissions, sends push notifications
- **onProjectOnlyListSectionFinalized**: Checks if all sections finalized, updates portal
- **onListSectionFinalized**: Checks if all sections finalized, updates portal

---

**Document Version:** 1.0  
**Last Updated:** March 10, 2026  
**Owner:** Eye-Doo Team
