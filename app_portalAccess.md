# `portalAccess` Firestore Collection Data Flows

This document contains Mermaid diagrams illustrating all interactions, triggers, Cloud Functions, and helpers that read from or write to the `portalAccess` Firestore collection based on current backend implementations.

## 1. High-Level Architecture & Interactions

This diagram shows the major components that interact with the `portalAccess` collection.

```mermaid
graph TD
    classDef function fill:#f9f,stroke:#333,stroke-width:2px;
    classDef collection fill:#f96,stroke:#333,stroke-width:2px;
    classDef client fill:#bbf,stroke:#333,stroke-width:2px;
    
    Collection[(portalAccess\nFirestore Collection)]:::collection
    
    subgraph Cloud Functions
        Gen[generatePortalLink\nCallable]:::function
        Dis[disablePortalLink\nCallable]:::function
        Val[validatePortalToken\nHelper Function]:::function
        Trig[handleSectionFinalized\nFirestore Trigger]:::function
    end
    
    MobileApp[react-native app\neye-doo-app]:::client
    WebPortal[next.js web app\neye-doo-client-portal]:::client
    
    %% Interactions
    MobileApp -- "Calls via HTTPS" --> Gen
    MobileApp -- "Calls via HTTPS" --> Dis
    WebPortal -- "Uses internally" --> Val
    
    Gen -- "Writes\n(Hashed Token)" --> Collection
    Dis -- "Updates\n(isEnabled: false)" --> Collection
    Val -- "Reads\n(Validates Token)" --> Collection
    Trig -- "Updates\n(portalStatus: finalized,\nDeletes Token)" --> Collection
```

## 2. `generatePortalLink` Flow

Triggered when the photographer creates a new Client Portal. This function handles the secure token generation and storage.

```mermaid
sequenceDiagram
    participant App as Eye-Doo App
    participant CF as Cloud Function: generatePortalLink
    participant PA as portalAccess Collection
    participant Portals as clientPortals Subcollection
    participant Projects as projects Collection

    App->>CF: Call with projectId, selectedSteps
    activate CF
    
    CF->>CF: Generate raw token (32 bytes)
    CF->>CF: Hash token (SHA-256)
    CF->>CF: Generate unique portalId
    
    Note over CF,PA: Transaction Starts
    
    CF->>PA: SET Document (docId: projectId)<br/>- accessToken: Hashed Token<br/>- portalId<br/>- isEnabled: true<br/>- expiresAt (30 days)
    
    CF->>Portals: SET default-portal<br/>- portalUrl (with raw token)<br/>- currentStepID<br/>- metadata
    
    CF->>Projects: UPDATE Project<br/>- portalId: 'default-portal'<br/>- hasLaunchedDashboard: true
    
    Note over CF,PA: Transaction Commits
    
    CF-->>App: Return portalUrl (with RAW token), portalId
    deactivate CF
```

## 3. `disablePortalLink` Flow

Triggered when the photographer manually revokes portal access.

```mermaid
sequenceDiagram
    participant App as Eye-Doo App
    participant CF as Cloud Function: disablePortalLink
    participant PA as portalAccess Collection
    participant Portals as clientPortals Subcollection

    App->>CF: Call with projectId
    activate CF
    
    Note over CF,PA: Transaction Starts
    
    CF->>PA: UPDATE Document (docId: projectId)<br/>- isEnabled: false<br/>- disabledAt: serverTimestamp
    
    CF->>Portals: UPDATE default-portal<br/>- isEnabled: false
    
    Note over CF,PA: Transaction Commits
    
    CF-->>App: Return success
    deactivate CF
```

## 4. `validatePortalToken` Flow

An internal helper function used to verify a client's access when they attempt to view the Web Portal.

```mermaid
sequenceDiagram
    participant Web as Client Web Portal
    participant Helper as js: validatePortalToken
    participant PA as portalAccess Collection

    Web->>Helper: Call with projectId, raw accessToken (from URL)
    activate Helper
    
    Helper->>PA: GET Document (docId: projectId)
    PA-->>Helper: Return portalData
    
    opt Document does not exist
        Helper-->>Web: Throw "not-found" Error
    end
    
    Helper->>Helper: Hash incoming raw accessToken
    
    opt Hash Mismatch OR isEnabled is false
        Helper-->>Web: Throw "permission-denied" Error
    end
    
    opt Current Date > expiresAt
        Helper-->>Web: Throw "permission-denied" (Expired) Error
    end
    
    Helper-->>Web: Return generic portalData for rendering
    deactivate Helper
```

## 5. Background Trigger (`handleSectionFinalized`) Flow

A Firestore `onDocumentUpdated` background trigger that locks the portal once all required sections are completed/finalized by the photographer.

```mermaid
sequenceDiagram
    participant DB as Firestore (Project / Lists)
    participant Trig as Cloud Function: handleSectionFinalized
    participant PA as portalAccess Collection
    participant Portals as clientPortals Subcollection

    DB->>Trig: Triggered on update to projects/{projectId}/*lists/{sectionId}
    activate Trig
    
    Trig->>Trig: Check if target collection is managed<br/>(keyPeople, locations, timeline, etc.)
    Trig->>Trig: Compare before vs after state.<br/>Proceed if status turned to "finalized"
    
    Trig->>DB: GET all 5 required section documents
    DB-->>Trig: Return section snapshots
    
    Trig->>Trig: Check if ALL 5 sections have config.finalized == true
    
    opt If all are finalized
        Note over Trig,PA: Batch Write Starts
        
        Trig->>PA: UPDATE (docId: projectId)<br/>- portalStatus: "finalized"<br/>- isEnabled: false<br/>- accessToken: DELETE FIELD (Link permanently destroyed)<br/>- finalizedAt: serverTimestamp
        
        Trig->>Portals: UPDATE default-portal<br/>- isEnabled: false<br/>- currentStepID: "thankYou"
        
        Note over Trig,PA: Batch Commit
    end
    
    Trig-->>DB: Exit cleanly
    deactivate Trig
```

## Relevant Code Files
- **Cloud Functions:** `functions/index.js` (Separate repository folder: `eye-doo-client-portal/functions`)
- **App Configuration:** `src/domain/project/portal.schema.ts` explicitly acknowledges `// accessToken is still excluded — it only lives in portalAccess collection.`
