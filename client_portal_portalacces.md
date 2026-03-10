# Mermaid diagrams for portalAccess collection
_Exported on 3/10/2026 at 17:46:29 GMT from Cursor (2.6.14)_

---

**User**

Create mermaid diagrams that show all data flows, interactions, triggers, firebase functions, helpers and anything else that uses the firestore collection named "portalAccess"

---

**Cursor**

I'll help you create comprehensive Mermaid diagrams showing all data flows and interactions related to the `portalAccess` Firestore collection. Let me first search for all references to this collection across the codebase.

Now let me read the key files to understand the complete data flow:

Now let me check if there are any other files that interact with portalAccess:

Perfect! Now I have a complete picture of all the data flows related to the `portalAccess` collection. Let me create comprehensive Mermaid diagrams showing all interactions, triggers, and data flows.

Based on my analysis of the codebase, I've created comprehensive Mermaid diagrams showing all data flows and interactions with the `portalAccess` Firestore collection:

## 1. Portal Creation & Authentication Flow

```mermaid
sequenceDiagram
    participant Mobile as Mobile App (Photographer)
    participant CF as Cloud Function<br/>generatePortalLink
    participant PA as portalAccess/{projectId}
    participant Portal as clientPortals/default-portal
    participant Project as projects/{projectId}
    participant Client as Client Portal (Web)
    participant Auth as API: /auth/portal

    Mobile->>CF: generatePortalLink(projectId, selectedSteps)
    Note over CF: Generate raw token (64 hex chars)
    Note over CF: Hash token with SHA-256
    
    CF->>PA: transaction.set()
    Note over PA: Store:<br/>- accessToken (hashed)<br/>- portalId<br/>- selectedSteps<br/>- isEnabled: true<br/>- portalStatus: "active"<br/>- createdAt<br/>- expiresAt (+30 days)<br/>- accessCount: 0<br/>- lastAccessedAt: null
    
    CF->>Portal: transaction.set()
    Note over Portal: Store:<br/>- steps (initialized)<br/>- currentStepID<br/>- portalUrl<br/>- isEnabled: true
    
    CF->>Project: transaction.update()
    Note over Project: Update:<br/>- portalId<br/>- metadata.hasLaunchedDashboard
    
    CF-->>Mobile: Return portalUrl with raw token
    
    Client->>Auth: POST /auth/portal<br/>{projectId, token}
    Note over Auth: Hash incoming token
    Auth->>PA: Read document
    PA-->>Auth: Return data
    Note over Auth: Verify:<br/>- accessToken matches<br/>- isEnabled = true<br/>- portalStatus = "active"<br/>- not expired
    
    Auth->>PA: Update accessCount & lastAccessedAt
    Note over PA: accessCount++<br/>lastAccessedAt = now
    
    Auth-->>Client: Set httpOnly JWT cookie<br/>(7 day expiry)
```

## 2. Section Submission Flow

```mermaid
sequenceDiagram
    participant Client as Client Portal
    participant API as API: section/submit
    participant Section as Section Document<br/>(keyPeople/locations/etc)
    participant Portal as clientPortals/default-portal
    participant PA as portalAccess/{projectId}
    participant Trigger as Firestore Trigger<br/>onDocumentUpdated
    participant Push as Push Notification

    Client->>API: POST submit<br/>{list: items[]}
    Note over API: Validate with Zod schema<br/>Check limits (30/6/5/100/50)
    
    API->>Section: transaction.get()
    API->>Portal: transaction.get()
    API->>PA: transaction.get()
    
    Note over API: Check if section is locked
    
    API->>Section: transaction.set(merge)
    Note over Section: Update:<br/>- items: [...data]<br/>- config.status: "locked"<br/>- config.actionOn: "photographer"<br/>- config.clientSubmittedAt<br/>- config.totalItems
    
    API->>Portal: transaction.update()
    Note over Portal: Update steps array:<br/>- stepStatus: "review"<br/>- actionOn: "photographer"
    
    API->>PA: transaction.update()
    Note over PA: Update selectedSteps array:<br/>- stepStatus: "review"<br/>- actionOn: "photographer"
    
    API-->>Client: {success: true}
    
    Note over Trigger: Detects status change to "locked"
    Trigger->>Push: Send notification to photographer
    Note over Push: "Client submitted {section} for review"
```

## 3. Section Skip Flow

```mermaid
sequenceDiagram
    participant Client as Client Portal
    participant API as API: section/skip
    participant Section as Section Document
    participant Portal as clientPortals/default-portal
    participant PA as portalAccess/{projectId}

    Client->>API: POST skip
    
    API->>Section: transaction.get()
    API->>Portal: transaction.get()
    API->>PA: transaction.get()
    
    Note over API: Verify section not locked
    
    API->>Section: transaction.set(merge)
    Note over Section: Update config:<br/>- status: "finalized"<br/>- skippedByClient: true<br/>- skipped: true<br/>- finalized: true<br/>- actionOn: "none"<br/>- skippedAt: timestamp
    
    API->>Portal: transaction.update()
    Note over Portal: Update step:<br/>- stepStatus: "finalized"<br/>- actionOn: "none"<br/>- completedSteps++<br/>- completionPercentage
    
    API->>PA: transaction.update()
    Note over PA: Update selectedSteps:<br/>- stepStatus: "finalized"<br/>- actionOn: "none"
    
    API-->>Client: {success: true}
```

## 4. Photographer Review Flow (Approve/Request Revision)

```mermaid
sequenceDiagram
    participant Mobile as Mobile App (Photographer)
    participant CF as Cloud Function
    participant Section as Section Document
    participant Portal as clientPortals/default-portal
    participant Trigger as Firestore Trigger<br/>handleSectionFinalized
    participant PA as portalAccess/{projectId}

    alt Approve Section
        Mobile->>CF: photographerApproveSection
        CF->>Section: transaction.update()
        Note over Section: config:<br/>- status: "finalized"<br/>- finalized: true<br/>- actionOn: "none"<br/>- approvedAt<br/>- approvedBy
        
        CF->>Portal: transaction.update()
        Note over Portal: Update step:<br/>- stepStatus: "finalized"<br/>- actionOn: "none"
        
        Note over Trigger: Detects all sections finalized
        Trigger->>PA: batch.update()
        Note over PA: Finalize portal:<br/>- portalStatus: "finalized"<br/>- isEnabled: false<br/>- accessToken: DELETED<br/>- finalizedAt
        
        Trigger->>Portal: batch.update()
        Note over Portal: - isEnabled: false<br/>- currentStepID: "thankYou"
        
    else Request Revision
        Mobile->>CF: photographerRequestRevision<br/>{revisionReason}
        CF->>Section: transaction.update()
        Note over Section: config:<br/>- status: "unlocked"<br/>- actionOn: "client"<br/>- finalized: false<br/>- revisionRequested: true<br/>- revisionReason<br/>- revisionRequestedAt
        
        CF->>Portal: transaction.update()
        Note over Portal: Update step:<br/>- stepStatus: "unlocked"<br/>- actionOn: "client"
    end
```

## 5. Confirm Review Flow (Client Acknowledges Feedback)

```mermaid
sequenceDiagram
    participant Client as Client Portal
    participant API as API: confirm-review
    participant Section as Section Document
    participant Portal as clientPortals/default-portal
    participant PA as portalAccess/{projectId}

    Client->>API: POST confirm-review
    
    API->>Section: transaction.get()
    API->>Portal: transaction.get()
    API->>PA: transaction.get()
    
    Note over API: Verify:<br/>- not skipped<br/>- status = "locked"
    
    API->>Section: transaction.set(merge)
    Note over Section: config:<br/>- status: "unlocked"<br/>- actionOn: "client"<br/>- clientReviewConfirmedAt<br/>- locked: DELETED
    
    API->>Portal: transaction.update()
    Note over Portal: Update step:<br/>- stepStatus: "unlocked"<br/>- actionOn: "client"
    
    API->>PA: transaction.update()
    Note over PA: Update selectedSteps:<br/>- stepStatus: "unlocked"<br/>- actionOn: "client"
    
    API-->>Client: {success: true}
```

## 6. Portal Disable Flow

```mermaid
sequenceDiagram
    participant Mobile as Mobile App (Photographer)
    participant CF as Cloud Function<br/>disablePortalLink
    participant PA as portalAccess/{projectId}
    participant Portal as clientPortals/default-portal

    Mobile->>CF: disablePortalLink(projectId)
    
    CF->>PA: transaction.update()
    Note over PA: - isEnabled: false<br/>- disabledAt: timestamp
    
    CF->>Portal: transaction.update()
    Note over Portal: - isEnabled: false<br/>- lastUpdated: timestamp
    
    CF-->>Mobile: {success: true}
```

## 7. Complete Data Model & Relationships

```mermaid
graph TB
    subgraph "Firestore Collections"
        PA[portalAccess/{projectId}]
        Portal[projects/{projectId}/<br/>clientPortals/default-portal]
        Project[projects/{projectId}]
        Sections[Section Documents:<br/>- keyPeople<br/>- locations<br/>- groupShots<br/>- photoRequests<br/>- timeline]
    end
    
    subgraph "Cloud Functions"
        GenLink[generatePortalLink]
        DisLink[disablePortalLink]
        Approve[photographerApproveSection]
        Revision[photographerRequestRevision]
        TriggerSubmit[onDocumentUpdated<br/>handleSectionSubmitted]
        TriggerFinal[onDocumentUpdated<br/>handleSectionFinalized]
    end
    
    subgraph "API Routes"
        AuthAPI[/auth/portal]
        SubmitAPI[/section/submit]
        SkipAPI[/section/skip]
        ConfirmAPI[/section/confirm-review]
        TrackAPI[/track-access]
    end
    
    GenLink -->|Creates| PA
    GenLink -->|Creates| Portal
    GenLink -->|Updates| Project
    
    DisLink -->|Updates isEnabled| PA
    DisLink -->|Updates isEnabled| Portal
    
    AuthAPI -->|Reads & validates| PA
    AuthAPI -->|Updates accessCount| PA
    
    SubmitAPI -->|Reads| PA
    SubmitAPI -->|Updates selectedSteps| PA
    SubmitAPI -->|Updates| Sections
    SubmitAPI -->|Updates steps| Portal
    
    SkipAPI -->|Reads| PA
    SkipAPI -->|Updates selectedSteps| PA
    SkipAPI -->|Updates| Sections
    SkipAPI -->|Updates steps| Portal
    
    ConfirmAPI -->|Reads| PA
    ConfirmAPI -->|Updates selectedSteps| PA
    ConfirmAPI -->|Updates| Sections
    ConfirmAPI -->|Updates steps| Portal
    
    Approve -->|Updates| Sections
    Approve -->|Updates steps| Portal
    
    Revision -->|Updates| Sections
    Revision -->|Updates steps| Portal
    
    Sections -->|Triggers on update| TriggerSubmit
    Sections -->|Triggers on finalize| TriggerFinal
    
    TriggerFinal -->|Finalizes when all done| PA
    TriggerFinal -->|Disables| Portal
    
    style PA fill:#ff9999
    style Portal fill:#99ccff
    style Sections fill:#99ff99
```

## 8. portalAccess Document Schema

```mermaid
classDiagram
    class portalAccess {
        +string projectId
        +string accessToken (SHA-256 hash)
        +string portalId
        +PortalStep[] selectedSteps
        +boolean isEnabled
        +string portalStatus ("active" | "finalized")
        +Timestamp createdAt
        +Timestamp expiresAt
        +number accessCount
        +Timestamp lastAccessedAt
        +Timestamp? disabledAt
        +Timestamp? finalizedAt
    }
    
    class PortalStep {
        +string id
        +string portalStepID
        +string stepTitle
        +number stepNumber
        +boolean requiredStep
        +string? stepIcon
        +string stepStatus ("unlocked" | "review" | "finalized")
        +string stepDescription
        +string actionOn ("client" | "photographer" | "none")
    }
    
    portalAccess "1" --> "*" PortalStep : contains
```

## Key Insights:

1. **portalAccess** is the **authentication & access control** document
2. It stores the **hashed token** (never the raw token)
3. It maintains a **synchronized copy** of `selectedSteps` that mirrors the portal's steps
4. **Three-way synchronization** happens on every section operation: Section → Portal → portalAccess
5. **Automatic finalization** when all sections are approved (via Firestore trigger)
6. **Access tracking** via `accessCount` and `lastAccessedAt`
7. **Security**: Token is deleted on finalization, making the link permanently invalid

