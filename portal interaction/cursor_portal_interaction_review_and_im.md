# Portal interaction review and improvement
_Exported on 3/10/2026 at 22:09:35 GMT from Cursor (2.6.14)_

---

**User**

@eye-doo-app/portal interaction  Review the attached docs and all portal references in the webclient @src , firebase functions @eye-doo-client-portal/functions/index.js  and the portal files in the react-native app @eye-doo-app/src/domain/project  @eye-doo-app/src/app/(protected)/(app)/(dashboard) @eye-doo-app/src/hooks/use-portal.ts @eye-doo-app/src/hooks/dashboard/use-dashboard.ts @eye-doo-app/src/hooks/dashboard/home/use-dashboard-home.ts @eye-doo-app/src/repositories/i-portal-repository.ts @eye-doo-app/src/repositories/firestore/firestore-base-project-repository.ts @eye-doo-app/src/repositories/firestore/firestore-portal-repository.ts @eye-doo-app/src/components/dashboard/ClientPortalCard.tsx @eye-doo-app/src/app/(protected)/(app)/(dashboard)/(lists)/requested.tsx @eye-doo-app/src/app/(protected)/(app)/(dashboard)/(home)/index.tsx @eye-doo-app/src/components/dashboard/SetupPortalModal.tsx @eye-doo-app/src/components/pricing/FeatureComparisonTable.tsx @eye-doo-app/src/constants/analytics-events.ts @eye-doo-app/src/constants/defaults.ts @eye-doo-app/src/constants/enums.ts @eye-doo-app/src/constants/portal.ts @eye-doo-app/src/constants/content/dashboard-home-content.ts @eye-doo-app/src/design-system/components/containers/StandardAppDialog.tsx @eye-doo-app/src/domain/project/portal.schema.ts @eye-doo-app/src/domain/project/project.schema.ts @eye-doo-app/src/domain/subscription/plan.schema.ts @eye-doo-app/src/domain/user/README.md @eye-doo-app/src/services/analytics-service.ts @eye-doo-app/src/services/portal-service.ts @eye-doo-app/src/utils/feature-access.ts @eye-doo-app/src/services/ServiceFactory.ts @eye-doo-app/src/utils/portal-validation.ts @eye-doo-app/src/utils/project-helpers.ts . Suggest a way to improve interaction, ensure SSOT, updating and sync

---

**Cursor**

Reviewing the portal flow across the web client, Firebase function, and React Native app first, then I’ll trace where portal state is defined, read, written, and synced so I can call out SSOT and interaction risks concretely.

I’ve traced the first layer of the data path and there’s already a clear pattern: portal state is being represented in multiple places with overlapping responsibilities, so I’m now reading the service/schema/UI layers to see exactly where the duplication leaks into interaction and sync behavior.

The schema/constants layer confirms the drift: the app still models portal progress and tokens as flattened first-class fields, while the web client has already started compensating for mixed shapes. I’m checking the alignment helpers and dashboard screens next to separate “UI polish” issues from actual source-of-truth problems.

I’ve got enough to see the architectural drift now. I’m doing one last pass over the write paths on the portal web app so I can tie each recommendation to the exact mutation boundaries instead of giving generic “centralize state” advice.

## Findings
1. The current setup flow breaks SSOT by writing the same portal twice with different contracts. The Firebase callable creates the portal as a canonical server-owned document with `setupDate`, `lastUpdated`, nested `metadata`, and the first enabled step as `currentStepID`, but the React Native app then creates and updates that exact same document again through `FirestorePortalRepository` using a different flattened model and `createdAt`/`updatedAt`. This is the main reason the portal shape keeps drifting.

```187:237:functions/index.js
      transaction.set(portalDocRef, {
        isSetup: true,
        portalSetupComplete: true,
        isEnabled: true,
        portalUrl,
        setupDate: FieldValue.serverTimestamp(),
        lastUpdated: FieldValue.serverTimestamp(),
        currentStepID: firstStepID,
        portalMessage: "Welcome to your planning portal!",
        steps: initializedSteps,
        metadata: {
          totalSteps: initializedSteps.length,
          completedSteps: 0,
          completionPercentage: 0,
          lastClientActivity: null,
          clientAccessCount: 0,
        },
      });
```

```236:284:src/services/portal-service.ts
    const portalInput: ClientPortalInput = {
      isSetup: true,
      isEnabled: true,
      currentStepID: PortalStepID.WELCOME,
      portalMessage: sanitizeText(defaultMessage, 1000) || defaultMessage,
      steps: portalSteps,
    };

    const createResult = await this.repository.create(
      userId,
      projectId,
      validation.value as ClientPortalInput,
    );

    const updateData = {
      expiresAt: expirationDate,
      portalUrl,
      totalSteps: portalSteps.length,
      completedSteps: 0,
      completionPercentage: 0,
    } as ClientPortalUpdate;
```

2. Portal link lifecycle is split across `portalAccess` and the portal doc, so enable/disable is not authoritative. Authentication only trusts `portalAccess`, but `enablePortal()` in the app only flips `isEnabled` on the portal document. That means the photographer UI can say “enabled” while the web portal still rejects the link because `portalAccess.isEnabled`, `portalStatus`, or `expiresAt` were never updated. On top of that, access duration is hardcoded three different ways: 30 days in the function, 14 in app defaults, 7 in the plan schema default.

```321:325:src/services/portal-service.ts
  async enablePortal(projectId: string, portalId: string): Promise<Result<void, AppError>> {
    return this.repository.update(portalId, projectId, {
      isEnabled: true,
    });
  }
```

```35:45:src/app/api/auth/portal/route.ts
  if (
    data.accessToken !== hashedToken ||
    !data.isEnabled ||
    data.portalStatus !== "active" ||
    data.expiresAt.toDate() < new Date()
  ) {
    return NextResponse.json(
      { error: "Invalid or expired portal link" },
      { status: 401 },
    );
  }
```

3. Activity and progress are being tracked in two incompatible shapes: nested `metadata.*` on the web side and flattened fields in the app schema. The web app updates `metadata.lastClientActivity` and `metadata.clientAccessCount`, but the mobile dashboard card renders `portal.lastClientActivity`. Since `FirestorePortalRepository.parseSnapshot()` does not flatten `metadata` back into those app fields, the photographer-side interaction can easily stay stale or show “Never” even when the client is active. The same split exists for completion stats, and the web GET routes are already compensating with fallback synthesis, which is a strong signal the contract is unstable.

```43:57:src/app/api/wedding/[projectId]/track-access/route.ts
    const updateData: Record<string, unknown> = {
      "metadata.lastClientActivity": FieldValue.serverTimestamp(),
      lastUpdated: FieldValue.serverTimestamp(),
    };

    if (shouldIncrementCount) {
      updateData["metadata.clientAccessCount"] = FieldValue.increment(1);
    }
```

```200:207:src/components/dashboard/ClientPortalCard.tsx
              {portal.lastClientActivity
                ? new Date(
                  typeof portal.lastClientActivity === 'object' &&
                    'seconds' in portal.lastClientActivity
                    ? (portal.lastClientActivity.seconds as number) * 1000
                    : portal.lastClientActivity,
                ).toLocaleDateString()
                : HOME_CONTENT.PORTAL.NEVER_LABEL}
```

4. The project-level portal references are also inconsistent. The runtime uses raw `project.portalId` plus `metadata.hasLaunchedDashboard` and `metadata.portalSetupDate`, while the typed mobile project schema still exposes `clientPortalStatus` and `clientPortalId`, which are never actually maintained by the setup path. That means `BaseProject` is not a reliable source for portal presence or portal state.

5. The web portal still models `accessToken` as part of the portal subcollection contract even though the backend comments and auth route clearly moved token storage to `portalAccess` only. That is security-contract drift, and it makes it easier for future code to accidentally reintroduce sensitive material into the wrong document.

6. Interaction-wise, the mobile dashboard is still “setup portal” oriented instead of “manage portal” oriented. The `Manage` action just reopens the setup modal, there is no first-class state for pause/resume/regenerate/expiry, portal analytics exist in constants but are not wired, and the app still loads portals by listing all user portals and filtering by project instead of subscribing directly to the current project’s portal.

## Recommended Direction
The cleanest fix is to stop trying to make one document be both source-of-truth and every client’s view model.

1. Make `portalAccess/{projectId}` the only source of truth for auth and link lifecycle.
2. Make each section doc under `projectOnlyLists/*` and `lists/groupShots` the only source of truth for section content and section status.
3. Make `projects/{projectId}/clientPortals/default-portal` a server-owned projection/read model only. Both the mobile app and the web portal can read it, but neither should construct or mutate it directly.
4. Move every portal write behind one backend orchestration layer: `createPortal`, `setPortalEnabled`, `regeneratePortalLink`, `updatePortalMessage`, `submitSection`, `requestRevision`, `approveSection`, `trackAccess`.
5. Have that backend layer always emit the same normalized aggregate shape, and have both the REST GET routes and SSE route serialize from the same function so the initial load and live updates cannot diverge.
6. Share the schema between the web app, RN app, and functions. A small shared contract package with `PortalAggregateSchema`, `PortalAccessSchema`, `PortalSectionSchema`, `PortalStepSchema`, and canonical enums would remove most of the current drift immediately.

## Suggested SSOT Model
If I were standardizing this, I would use this ownership model:

1. `portalAccess`: `isEnabled`, `portalStatus`, `expiresAt`, `token hash`, link regeneration history.
2. Section docs: `items`, `config.status`, `config.actionOn`, `revisionReason`, `submittedAt`, `approvedAt`.
3. Portal aggregate doc: `steps[]`, `currentStepID`, `portalMessage`, `metadata.lastClientActivity`, `metadata.clientAccessCount`, derived progress counters, display-friendly portal status.
4. Project doc: only a lightweight pointer like `hasPortal: true` or `portalRef: "default-portal"` if discovery is needed. Remove or stop using `clientPortalStatus` and `clientPortalId` unless you truly want them maintained as a deliberate projection.

## Interaction Improvements
A better portal interaction layer would look like this:

1. Replace the current setup modal with a true “Manage Portal” surface that shows `link status`, `expires in`, `last client activity`, `sections enabled`, and `sections awaiting review`.
2. Add explicit actions: `Share`, `Copy Link`, `Pause Access`, `Resume Access`, `Regenerate Link`, `Edit Enabled Sections`, `Extend Access`.
3. Show section badges driven from the canonical section state machine: `Client editing`, `Awaiting photographer`, `Needs client review`, `Finalized`.
4. Drive the dashboard freshness UI from the same aggregate field the web app updates, not a parallel flat field.
5. Add portal analytics around `portal_created`, `portal_shared`, `portal_paused`, `portal_resumed`, `portal_regenerated`, `portal_section_submitted`, and `portal_client_active`.

## Open Questions
- Is the intended product rule “one portal per project forever”? The codebase already behaves that way with `default-portal`, so I would lean into it and remove the extra `portalId` abstraction from app interfaces.
- Should subscription plan `accessDuration` actually control expiry? Right now it is defined, but the live setup path ignores it.

If you want, I can turn this into a concrete refactor plan next: `contract cleanup`, `backend write consolidation`, `projection builder`, and `dashboard interaction redesign`.

---

**User**

There should only be one portal per project.  Yes subscription plan should control accessDuration expiry along  @eye-doo-app/src/domain/subscription/plan.schema.ts:21-62 @eye-doo-app/src/domain/subscription/plan.schema.ts:75-85 @eye-doo-app/src/domain/subscription/plan.schema.ts:108.   

The client-portal @eye-doo-client-portal/src is still missing functionality?  @eye-doo-app/src/domain/project/portal.schema.ts @eye-doo-app/src/domain/subscription/plan.schema.ts lists things such as couple shots to go with groupShots, customGallery, realtime sync, customisation,     



---

**Cursor**

I’m checking the plan/schema feature flags against the actual portal implementation now so I can separate “planned but not modeled” from “modeled but not implemented.”

I found one confirmed implementation gap already: photo requests support images in the web portal, but several other plan-advertised portal features don’t exist as actual portal features yet. I’m verifying which ones are truly absent versus just ungated.

I’ve narrowed it down: some “portal” capabilities are genuinely implemented, but a lot of the plan sub-feature matrix is only defined in the subscription schema and helper methods, not in the portal product surface itself.

## Short Answer
Yes. If the rule is truly `one portal per project`, the codebase should stop pretending `portalId` is variable and treat `projects/{projectId}/clientPortals/default-portal` as the only portal identity everywhere.

And yes, `subscriptionPlans.clientPortal.accessDuration` should become the canonical expiry source. Right now expiry is drifting between plan defaults, app defaults, portal setup defaults, and the cloud function hardcode.

```21:27:src/domain/subscription/plan.schema.ts
const clientPortalLimitsSchema = baseFeatureSchema.extend({
  customBranding: z.boolean().default(false),
  customWelcomeMessage: z.boolean().default(false),
  customThankYou: z.boolean().default(false),
  realTimeSync: z.boolean().default(false),
  accessDuration: z.number().int().default(7),
  extendAccess: z.boolean().default(false),
});
```

```193:198:src/domain/project/portal.schema.ts
export const portalSetupInputSchema = z.object({
  projectId: idSchema,
  enabledSteps: z.array(z.nativeEnum(PortalStepID)).min(1, 'At least one step must be enabled'),
  portalMessage: z.string().max(1000, 'Message is too long').optional(),
  expiryDays: z.number().int().min(1).max(365).default(30),
});
```

```49:50:src/constants/defaults.ts
  PORTAL_EXPIRATION_DAYS: 14,
  PORTAL_EXTENSION_DAYS: 14,
```

```199:201:functions/index.js
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
```

## Is The Client Portal Missing Functionality?
Also yes, but there are two different kinds of “missing” here.

### 1. Features defined in plans, but not actually implemented as portal features
The biggest one is `couple shots`.

Your plan model advertises a dedicated portal couple-shots capability:

```46:49:src/domain/subscription/plan.schema.ts
const portalCoupleShotsLimitsSchema = baseFeatureSchema.extend({
  clientCanSelect: z.boolean().default(false),
  showTimeEstimate: z.boolean().default(false),
  customGallery: z.boolean().default(false),
});
```

But the actual portal domain only supports these steps: `keyPeople`, `locations`, `groupShots`, `photoRequests`, `timeline`.

```91:97:src/domain/project/portal.schema.ts
export const portalStepSchema = z.discriminatedUnion('id', [
  keyPeopleStepSchema,
  locationsStepSchema,
  groupShotsStepSchema,
  photoRequestsStepSchema,
  timelineStepSchema,
]);
```

And the setup UI only exposes those same five steps:

```30:33:src/components/dashboard/SetupPortalModal.tsx
  // Default to all steps selected
  const allStepKeys = Object.keys(DEFAULT_PORTAL_STEPS);
  const [selectedSteps, setSelectedSteps] = useState<string[]>(allStepKeys);
```

So `portalCoupleShots.clientCanSelect`, `portalCoupleShots.showTimeEstimate`, and `portalCoupleShots.customGallery` are not just “not wired”; they are outside the current portal product model.

### 2. Features that exist technically, but are not controlled by the plan system
These are present in some form, but not enforced or surfaced correctly.

`customWelcomeMessage`
This is partially implemented. The portal has a `portalMessage`, and the welcome screen renders it:

```115:116:src/domain/project/portal.schema.ts
  currentStepID: z.nativeEnum(PortalStepID).default(PortalStepID.WELCOME),
  portalMessage: z.string().max(1000, 'Message is too long').optional(),
```

```119:124:src/components/sections/WelcomeSection.tsx
        {project.portalMessage && project.portalMessage.length > 0 && (
          <Alert className="mb-4 flex items-center justify-center pt-1 pb-2">
            <AlertDescription className="text-center mx-auto italic font-sans text-lg font-medium font-error">
              &quot;{project.portalMessage}&quot;
            </AlertDescription>
          </Alert>
        )}
```

But there is no visible plan-aware configuration flow around it in the dashboard setup/manage flow.

`customThankYou`
This looks missing. The thank-you screen is fully hardcoded and there is no corresponding field in the portal schema.

```11:24:src/components/sections/CongratulationsScreen.tsx
export const CongratulationsScreen: React.FC = () => (
  <Card className="text-center py-8">
    <CardHeader>
      <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
      <CardTitle className="text-3xl font-bold mt-4 text-green-600">
        Congratulations!
      </CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-muted-foreground">
        You have successfully completed all the required steps. We will be in
        touch shortly.
      </p>
    </CardContent>
  </Card>
);
```

`customBranding`
This also looks missing as a portal feature. The web portal has a global theme provider / dark mode toggle, but nothing project- or plan-driven for branding, logo, colors, typography, or white-labeling.

`realTimeSync`
This exists technically through SSE:

```31:35:src/hooks/usePortalStream.ts
  useEffect(() => {
    if (!projectId) return;

    const eventSource = new EventSource(`/api/wedding/${projectId}/stream`);
    setSseConnectionStateRef.current("connected");
```

But it is not tied to `clientPortal.realTimeSync` in the subscription model, and the section-level sync flags are not used to decide what syncs into the portal. So I would call this “implemented infra, not implemented entitlement.”

`groupShots.showTimeEstimate`
This is also partial. The web portal does calculate `totalTimeEstimated` for group shots, so the capability exists in data terms:

```338:343:src/types/types.ts
export const PortalGroupShotDataSchema = z.object({
  config: SectionConfigSchema.extend({
    totalTimeEstimated: z.number().default(0),
  }),
  categories: z.array(ClientGroupShotCategorySchema),
  items: z.array(ClientGroupShotItemSchema),
});
```

But I did not find plan-based gating around `portalGroupShots.showTimeEstimate`. So again: capability exists, entitlement does not.

`photoRequests.requestWithImage`
This one is actually implemented in the web portal. The portal UI supports image upload and the API accepts `imageUrl`.

```54:62:src/components/sections/PhotoRequestSection.tsx
const emptyRequest: Omit<ClientPhotoRequest, "id"> = {
  createdBy: CreatedBy.CLIENT,
  title: "",
  description: "",
  priority: PhotoRequestPriority.MEDIUM,
  type: PhotoRequestType.OTHER,
  notes: "",
  imageUrl: "",
};
```

```428:445:src/components/sections/PhotoRequestSection.tsx
          <div className="space-y-0.5">
            <Label
              htmlFor="imageUpload"
              className="font-sans text-xs text-muted-foreground"
            >
              Reference Image
            </Label>
            <Input
              id="imageUpload"
              type="file"
              accept="image/jpeg, image/png, image/jpg"
              onChange={(e) =>
                setSelectedFile(e.target.files ? e.target.files[0] : null)
              }
            />
            {uploadProgress !== null && (
              <Progress value={uploadProgress} className="mt-2" />
            )}
          </div>
```

## Practical Conclusion
The portal matrix currently breaks down like this:

- Implemented: `keyPeople`, `locations`, `groupShots`, `photoRequests`, `timeline`, welcome message, SSE updates, photo request images.
- Partially implemented: group-shot time estimate, real-time sync.
- Not implemented as portal features: `couple shots`, `custom gallery`, `custom branding`, `custom thank-you`.
- Not wired to plan entitlements: most of the section-level plan flags in `plan.schema.ts`.

## What I’d Treat As The Next Cleanup
1. Make `accessDuration` from the subscription plan the only expiry input.
2. Collapse portal identity to one constant `default-portal` everywhere and remove the fake variable `portalId` abstraction from app/service interfaces.
3. Split portal features into:
   - `implemented + plan-gated`
   - `implemented but not gated`
   - `defined in plans only`
4. Either add `coupleShots` to the real portal contract, or remove/rename the `portalCoupleShots` plan feature until the product actually supports it.
5. Add explicit schema fields if you truly want premium portal customization:
   - `branding`
   - `welcomeMessage`
   - `thankYouMessage`
   - maybe `themeVariant` / `logoUrl`

If you want, I can next give you a precise feature-by-feature matrix: `plan flag -> schema support -> mobile dashboard support -> client portal support -> backend support`.

---

**User**

Should I do the Recommended Direction / Suggested SSOT / Interaction Improvements before completing the portal matrix and implementing any missing features?

---

**Cursor**

Yes, with one caveat: do a **lightweight portal matrix first for decision-making**, but do **not** start implementing missing features before the SSOT / architecture cleanup.

The right order is:

1. **Finish a lean portal matrix**
   Just enough to classify each feature as:
   - `real and keep`
   - `planned but defer`
   - `schema-only / remove`
   - `implemented but not gated`

2. **Lock the product scope**
   Decide what the portal actually is in v1/v2:
   - one portal per project
   - which sections exist
   - whether `coupleShots`, `customBranding`, `customThankYou`, etc. are truly in scope

3. **Do the SSOT / backend consolidation**
   This is the most important step.
   - make `portalAccess` own access lifecycle
   - make section docs own section content/status
   - make `default-portal` a server-owned projection
   - remove fake multi-portal abstractions

4. **Standardize the shared contract**
   Align app, web portal, and functions on one canonical shape before adding more behavior.

5. **Improve dashboard/portal interaction**
   Build the proper manage/resume/pause/extend/regenerate UX on top of the clean model.

6. **Then implement missing features**
   Only after the model is stable, otherwise you’ll build new features on top of drifting contracts and likely rework them.

## Why
If you implement missing features first, you’ll multiply the current inconsistencies:
- more places writing portal state
- more feature flags with no authoritative owner
- more UI coupled to unstable document shapes
- more migration work later

## Best practical approach
Do the matrix **as a planning artifact**, not as a large implementation exercise. Once you know which features are real, fix the architecture first. After that, feature work becomes much cleaner and safer.

So the short answer is:

- **Yes**: do `Recommended Direction`, `Suggested SSOT`, and the interaction cleanup **before feature implementation**.
- **But**: finish a **small scope-confirming matrix first**, so you don’t spend time stabilizing features you may cut or defer.

If you want, I can outline the exact migration sequence in 5-8 concrete phases with dependencies and risk level.

---

**User**

Yes,  outline the exact migration sequence in 5-8 concrete phases with dependencies and risk level. 

---

**Cursor**

## Migration Sequence

### Phase 1: Scope And Contract Freeze
**Goal:** decide what the portal product actually supports before restructuring it.

- Produce a lean portal matrix for every relevant flag in `plan.schema.ts`.
- Mark each feature as `ship now`, `defer`, `remove from portal scope`, or `keep as future contract only`.
- Confirm the hard rules:
  - one portal per project
  - `default-portal` is the only portal identity
  - `accessDuration` from subscription plan controls expiry
  - current supported sections are either `keyPeople`, `locations`, `groupShots`, `photoRequests`, `timeline` only, or explicitly expanded

**Dependencies:** none  
**Risk:** low

**Why first:** this prevents you from stabilizing fields and flows for features like `portalCoupleShots` or `customThankYou` if they are not actually in scope.

---

### Phase 2: Define The Canonical Shared Contract
**Goal:** create one authoritative portal contract shared by app, portal web client, and backend.

- Define the canonical models for:
  - `PortalAccess`
  - `PortalAggregate`
  - `PortalSectionState`
  - `PortalStep`
  - canonical enums for section IDs and statuses
- Explicitly separate:
  - auth/link lifecycle fields
  - aggregate/read-model fields
  - per-section content/status fields
- Remove ambiguous dual-shape ideas like flattened-vs-nested metadata from the contract.
- Make it explicit that `accessToken` never belongs on the portal aggregate document.

**Dependencies:** Phase 1  
**Risk:** medium

**Key outcome:** everyone codes against the same shape instead of compensating in adapters.

---

### Phase 3: Assign SSOT Ownership By Data Domain
**Goal:** decide exactly which collection owns which facts.

Recommended ownership:

1. `portalAccess/{projectId}`
   - `isEnabled`
   - `portalStatus`
   - `expiresAt`
   - token hash
   - link lifecycle metadata

2. `projects/{projectId}/projectOnlyLists/*` and `projects/{projectId}/lists/groupShots`
   - section items
   - section config/status
   - revision/approval/submission timestamps
   - section-specific derived values

3. `projects/{projectId}/clientPortals/default-portal`
   - server-owned projection only
   - `steps`
   - `currentStepID`
   - `portalMessage`
   - aggregate metadata like access count and last client activity

4. `projects/{projectId}`
   - only lightweight portal discovery/reference fields if still needed

- Remove any expectation that the mobile app writes the aggregate directly.
- Remove any expectation that the project doc is a reliable portal state source.

**Dependencies:** Phase 2  
**Risk:** medium

**Key decision:** this is the real SSOT step. Everything after this becomes implementation detail.

---

### Phase 4: Consolidate All Writes Behind Backend Orchestration
**Goal:** stop multi-writer drift.

- Move all portal mutations behind server-owned entry points:
  - create portal
  - enable/disable portal
  - regenerate link
  - extend expiry
  - update welcome message
  - submit draft/final section
  - approve section
  - request revision
  - confirm review
  - track access
- Ensure each write updates only its owned documents plus any server-owned projections.
- Eliminate the current pattern where the cloud function writes one version of the portal and the app repository writes another.

**Dependencies:** Phase 3  
**Risk:** high

**Why high risk:** this is where most live behavior changes. It touches setup, sharing, expiry, state transitions, and synchronization.

**Mitigation:** keep old readers temporarily, but do not allow old write paths to remain active once the new orchestration is live.

---

### Phase 5: Rebuild The Aggregate / Projection Layer
**Goal:** make `default-portal` a consistent read model instead of an ad hoc mutable doc.

- Create one normalization/projection builder used by:
  - setup response
  - mobile dashboard reads
  - web portal initial load
  - SSE stream payloads
- Derive:
  - `steps`
  - completion stats
  - client activity
  - display status
  - current step
- Make the aggregate shape identical on first load and live updates.

**Dependencies:** Phase 4  
**Risk:** medium-high

**Why important:** this removes the current “REST synthesizes fallback values while Firestore doc shape drifts underneath” problem.

---

### Phase 6: Update Clients To Be Readers Of The Canonical Model
**Goal:** simplify the app and web portal so they consume the server contract rather than reconstructing it.

For the React Native app:
- remove fake multi-portal handling
- stop listing all user portals just to filter by `projectId`
- stop treating `portalId` as variable
- stop writing portal aggregate fields directly
- make dashboard management act on backend orchestration endpoints

For the client portal web app:
- keep section editing flows, but ensure they only hit the server mutation layer
- make SSE and initial load use the same normalized aggregate payload
- remove any leftover assumptions that token/access data lives on the portal document

**Dependencies:** Phase 5  
**Risk:** medium

**Good checkpoint:** by the end of this phase, behavior should be stable even before adding missing features.

---

### Phase 7: Interaction Improvements And Feature Implementation
**Goal:** only now add UX improvements and missing capabilities.

First do interaction improvements:
- proper “Manage Portal” UI instead of reusing “Setup Portal”
- share/copy/pause/resume/regenerate/extend
- status surfaces for `active`, `paused`, `expired`, `awaiting review`, `finalized`
- accurate activity and progress indicators
- plan-aware controls

Then implement missing features that survived Phase 1:
- `customWelcomeMessage`
- `customThankYou`
- `customBranding`
- `coupleShots` if kept in scope
- plan-gated `realTimeSync`
- any image/gallery/time-estimate entitlements

**Dependencies:** Phase 6  
**Risk:** medium for interaction, medium-high for new features

**Reason last:** by this point you are building on stable ownership and contracts instead of reworking features twice.

---

## Recommended Total Order
1. Scope and matrix
2. Shared contract
3. SSOT ownership
4. Backend write consolidation
5. Aggregate/projection rebuild
6. Client refactor
7. UX improvements and missing features

## Risk Summary
- Phase 1: Low
- Phase 2: Medium
- Phase 3: Medium
- Phase 4: High
- Phase 5: Medium-High
- Phase 6: Medium
- Phase 7: Medium to Medium-High

## Best Cut Line
If you want the safest milestone split, stop after **Phase 6** for the first release. That gives you:
- one portal per project
- clean SSOT
- stable sync
- correct expiry ownership
- cleaner clients

Then ship the “missing features” in a second pass.

## Suggested Milestone Names
- `M1`: Scope + contract freeze
- `M2`: SSOT + backend consolidation
- `M3`: client migration + stable sync
- `M4`: portal management UX
- `M5`: feature expansion

If you want, I can turn this into a **repo-specific checklist** next, mapping each phase to the exact files and modules you’d touch.

