# Feature implementation matrix
_Exported on 3/10/2026 at 22:10:09 GMT from Cursor (2.6.14)_

---

**User**

Create a precise feature-by-feature matrix: plan flag -> schema support -> mobile dashboard support -> client portal support -> backend support.

real and keep
planned but defer
schema-only / remove
implemented but not gated
Implemented: keyPeople, locations, groupShots, photoRequests, timeline, welcome message, SSE updates, photo request images.
Partially implemented: group-shot time estimate, real-time sync.
Not implemented as portal features: couple shots, custom gallery, custom branding, custom thank-you.
Not wired to plan entitlements: most of the section-level plan flags in plan.schema.ts.

---

**Cursor**

I’ll map this directly from the code so the matrix is precise, starting with the plan flags and portal/domain schemas, then tracing each feature through mobile, client portal, and backend handling.

I’ve confirmed the schema side: only five portal steps are in the discriminated union and defaults. Next I’m tracing where each feature is actually consumed in mobile hooks, client portal UI, and backend endpoints/functions.

I found strong signals that plan-level gating lives outside `use-portal` (mostly in shared feature-access utilities/services), so I’m now tracing those plus the client-portal section components and submit APIs to complete the matrix accurately.

I’ve confirmed SSE and submit/upload backend paths. I’m now checking the store/sections to classify each feature as full, partial, or absent in the client experience (including group-shot estimate and real-time behavior).

## Feature Matrix (Current State)

Status legend used below:
- `Yes` = implemented and used in code paths
- `Partial` = some plumbing exists, but behavior is incomplete
- `Schema-only` = defined in plan/schema layer but not meaningfully used
- `No` = not implemented in that layer

### Real and keep (implemented)

| Feature | Plan flag(s) | Schema support | Mobile dashboard support | Client portal support | Backend support | Entitlement wired? |
|---|---|---|---|---|---|---|
| Key People | `portalKeyPeople.clientCanAdd/maxCount/canAddAvatar` | Yes (`portalStepSchema` + `keyPeople` section data) | Yes (step selectable in setup modal) | Yes (`KeyPeopleSection`) | Yes (`/section/keyPeople` get/draft/submit/skip/confirm-review + CF step updates) | **No** |
| Locations | `portalLocation.clientCanAdd/multipleLocations` | Yes | Yes | Yes (`LocationsSection`) | Yes (`/section/locations` routes) | **No** |
| Group Shots | `portalGroupShots.clientCanSelect` | Yes | Yes | Yes (`GroupShotsSection`) | Yes (`/section/groupShots` routes + mappers) | **No** |
| Photo Requests | `portalPhotoRequests.clientCanRequest/maxRequests` | Yes | Yes | Yes (`PhotoRequestSection`) | Yes (`/section/photoRequests` routes) | **No** |
| Timeline | `portalTimeline.clientCanAdd/maxEvents` | Yes | Yes | Yes (`TimelineSection`) | Yes (`/section/timeline` routes) | **No** |
| Welcome message | `clientPortal.customWelcomeMessage` (intended gate) | Yes (`portalMessage`) | Partial (service/hook can update, no clear active UI caller) | Yes (displayed in `WelcomeSection`) | Yes (stored in portal doc + served via `/api/wedding/[projectId]`) | **No** |
| SSE updates | `clientPortal.realTimeSync` (intended gate) | Yes (stream payload shape) | N/A for SSE specifically | Yes (`usePortalStream` + store update) | Yes (`/api/wedding/[projectId]/stream`) | **No** |
| Photo request images | `portalPhotoRequests.requestWithImage` / `photoRequests.canAddImage` | Yes (`imageUrl` fields) | N/A | Yes (file picker + upload in `PhotoRequestSection`) | Yes (`/api/storage/upload` + submit includes `imageUrl`) | **No** |

---

### Partially implemented

| Feature | Plan flag(s) | Schema support | Mobile dashboard support | Client portal support | Backend support | Notes |
|---|---|---|---|---|---|---|
| Group-shot time estimate | `portalGroupShots.showTimeEstimate` | Yes | No gating | Partial (always computed/displayed from selected shots) | Partial (not a plan-controlled backend behavior) | Implemented as UI calc, not entitlement-driven |
| Real-time sync (full data sync) | `clientPortal.realTimeSync`, `groupShotList.realTimeSyncToPortal` | Yes | No gating | Partial (SSE updates step/meta/message; section item data not streamed) | Partial (stream endpoint exists but limited payload) | Works for portal state, not full section-content sync |

---

### Planned but defer

| Feature | Plan flag(s) | Schema support | Mobile dashboard support | Client portal support | Backend support |
|---|---|---|---|---|---|
| Couple shots (portal section) | `portalCoupleShots.clientCanSelect/showTimeEstimate`, `coupleShotList.syncToPortal` | Yes | No | No portal section | No canonical section/routes |
| Custom gallery | `portalCoupleShots.customGallery`, `coupleShotList.gallery/maxGalleryCount` | Yes | No | No | No |
| Custom branding (portal-facing) | `clientPortal.customBranding` | Yes | Partial (used in app-level customization checks) | No client-portal implementation | No portal backend behavior tied to it |
| Custom thank-you | `clientPortal.customThankYou` | Yes | No | No custom thank-you behavior (only static thank-you step/screen) | No |

---

### Schema-only / remove candidates

| Flag area | Current reality |
|---|---|
| Most section-level portal entitlement flags (`portalLocation.*`, `portalTimeline.*`, `portalGroupShots.*`, `portalKeyPeople.*`, `portalPhotoRequests.*`) | Present in `plan.schema.ts` and `FeatureAccess`, but not used to gate section availability/limits in runtime flows |
| Hardcoded limits vs plan limits | Limits are hardcoded in portal backend (`submit` route + `functions/index.js`), not sourced from subscriber plan entitlements |

---

## Key conclusion

Your own summary is correct: the portal features are largely implemented end-to-end, but **entitlement wiring is mostly missing**. In practice, I only found clear active gating for top-level portal access (`canUseClientPortal`) and branding checks in app customization paths, while section-level flags remain mostly declarative/schema-level.

