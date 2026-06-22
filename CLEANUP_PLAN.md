# Repository Cleanup Plan

**Date Generated:** June 22, 2026  
**Repository:** kylelovesy/my-roadmap  
**Status:** Planning Phase

---

## Executive Summary

This repository contains 86+ files with significant duplication and outdated content. This cleanup plan identifies files to **DELETE**, **CONSOLIDATE**, **ARCHIVE**, and **RETAIN** to improve maintainability and clarity.

---

## 📊 File Categorization

### 🗑️ PHASE 1: DELETE (Low Risk - Clear Duplicates)

#### Duplicate Flow Documentation
| File | Reason | Alternative |
|------|--------|-------------|
| `mermaid.md` | Minimal version (3.6 KB) | Keep `mermaid-flows.md` (23 KB) |
| `mermaid-flows-2.md` | Variant/incomplete (5.2 KB) | Merge into `mermaid-flows.md` |
| `GLOBFLOW-A.md` | Superseded by GLOBAL-FLOW-B | Keep `GLOBAL-FLOW-B.md` (44 KB) |

**Action:** Delete `mermaid.md`, `mermaid-flows-2.md`, `GLOBFLOW-A.md`

#### Flow Review Snapshots
| File | Reason | Alternative |
|------|--------|-------------|
| `flow-review-10-12-a.md` | Individual review snapshots (4.6 KB) | Archive all to `/archive/flow-reviews/` |
| `flow-review-10-12-b.md` | (4 KB) | |
| `flow-review-10-12-c.md` | (3.5 KB) | |
| `flow-review-10-12-d.md` | (4 KB) | |
| `flow-review-10-12-e.md` | (3 KB) | |
| `flow-review-10-12-f.md` | (2.8 KB) | |
| `flow-review-10-12-g.md` | (2.8 KB) | |

**Action:** Archive to `/archive/flow-reviews/` OR create single `FLOW-REVIEW-SUMMARY.md`

#### Outdated Progress & Reports
| File | Reason | Alternative |
|------|--------|-------------|
| `1-11-Progress.md` | Dated progress snapshot (35 KB) | Archive to `/archive/progress-snapshots/` |
| `report-19-11.md` | November report (22 KB) | Archive for historical reference |
| `report-19-11-A.md` | Duplicate/variant report (66 KB) | Archive for historical reference |

**Action:** Archive these files to `/archive/` directory

#### Tool-Generated Auth Reviews
| File | Reason | Alternative |
|------|--------|-------------|
| `Auth-Review-auto-cursor.md` | Auto-generated from Cursor AI (47 KB) | Archive to `/archive/ai-reviews/` |
| `Auth-Review-auto-vsCode.md` | VS Code variant (6.6 KB) | Archive to `/archive/ai-reviews/` |
| `Auth-Review-grok.md` | Grok AI review (13 KB) | Archive to `/archive/ai-reviews/` |
| `Auth-Review-grok2.md` | Grok variant (29 KB) | Archive to `/archive/ai-reviews/` |

**Action:** Archive all to `/archive/ai-reviews/` (these are tool-specific and become outdated quickly)

#### HTML Files (Not in Use)
| File | Reason | Alternative |
|------|--------|-------------|
| `index.html` | Appears unused (16.9 KB) | Verify purpose; likely demo/old project |
| `Fix-tracker.html` | Old tracking file (19 KB) | Archive to `/archive/` |

**Action:** Verify if `index.html` is needed; archive or delete. Archive `Fix-tracker.html`.

---

### 🔄 PHASE 2: CONSOLIDATE (Medium Complexity)

#### Authentication Documentation (6 overlapping files)

**Current Files:**
- `allAuth.md` (56 KB)
- `New-SignUp.md` (27 KB)
- `New-SignIn.md` (34 KB)
- `signin.md` (26 KB)
- `signup.md` (48 KB)
- `New-lAuth.md` (27 KB)
- `free-sign-up.md` (28 KB)
- `paid-sign-up.md` (30 KB)

**Consolidate Into:** `AUTH-SYSTEM.md`
- Sections: Overview, Sign-Up Flow, Sign-In Flow, Email Verification, Subscription Integration
- Reference source files in archive for historical context

**Action:** 
1. Create new `AUTH-SYSTEM.md` (unified, concise)
2. Keep only the most current/comprehensive source file
3. Archive others to `/archive/auth-docs/`

#### Flow & Navigation Documentation (5 overlapping files)

**Current Files:**
- `navigation.ts` (30 KB)
- `navigation.schema.ts` (6.5 KB)
- `use-navigation-guard.ts` (29 KB)
- `navGuards-rouRules.md` (31 KB)
- `navigation-utils.ts` (6.9 KB)
- `use-navigation-transition.ts` (4 KB)
- `GLOBAL-FLOW-B.md` (44 KB)
- `mermaid-flows.md` (23 KB)

**Consolidate Into:** `ARCHITECTURE-NAVIGATION.md`
- Sections: Overview, Route Structure, Navigation Guards, Routing Rules, Transition Animations
- Reference source code files
- Include mermaid diagrams

**Action:**
1. Create `ARCHITECTURE-NAVIGATION.md`
2. Keep all `.ts` files (these are source code, not docs)
3. Archive markdown variants to `/archive/`

#### Data Models Documentation (Multiple `.schema.ts` files)

**Current Files:**
- `user.schema.ts` (20 KB)
- `list-base.schema.ts` (6.8 KB)
- `kit.schema.ts` (4.2 KB)
- `task.schema.ts` (3.6 KB)
- `shots.schema.ts` (8.7 KB)
- `business-card.schema.ts` (8.8 KB)
- `shared-schemas.ts` (16 KB)

**Consolidate Into:** `DATA-MODELS.md`
- Sections: Shared Schemas, User Model, List Models, Kit Models, Task Models, Shots Models, Business Card Model
- Reference source `.ts` files with line numbers
- Include validation rules and relationships

**Action:**
1. Create `DATA-MODELS.md`
2. Keep all `.ts` files (source code)
3. Delete duplicate documentation files

#### Subscription & Pricing Documentation (4 files)

**Current Files:**
- `subscription.md` (26 KB)
- `New-FreeTrial.md` (30 KB)
- `New-ProVersion.md` (38 KB)
- `pricing_payments_architecture.md` (22 KB)

**Consolidate Into:** `SUBSCRIPTION-PRICING.md`
- Sections: Overview, Subscription Plans, Free Trial, Pro Features, Payment Integration, Billing Cycles

**Action:**
1. Create `SUBSCRIPTION-PRICING.md`
2. Archive old versions to `/archive/subscription-docs/`

#### Onboarding Documentation (4+ files)

**Current Files:**
- `onboarding-new.md` (32 KB)
- `welcome-projects.md` (17 KB)
- `NEW-REG-NONVER-FREE-ONB-PROJECTS.md` (71 KB)
- `NEW-REG-VER-BASIC-ONB-SET-PROJECTS.md` (108 KB)

**Consolidate Into:** `ONBOARDING-FLOWS.md`
- Sections: Overview, Free Tier Onboarding, Verified Basic Onboarding, Projects Setup, Personalization

**Action:**
1. Create `ONBOARDING-FLOWS.md`
2. Archive detailed versions to `/archive/onboarding-docs/`

---

### 📦 PHASE 3: ORGANIZE (Source Code Files)

These should remain but be organized properly:

#### TypeScript Source Files
Move to appropriate location (likely `/src` or keep if documenting in-place):
- `_layout.tsx` 
- `index.tsx`
- `pricing.tsx`
- `navigation.ts`
- `navigation.schema.ts`
- `use-navigation-guard.ts`
- `use-navigation-transition.ts`
- `use-navigation-utils.ts`
- `navigation-utils.ts`
- `feature-access.ts`

#### Schema Definition Files
Keep in repository but document in `DATA-MODELS.md`:
- `shared-schemas.ts`
- `user.schema.ts`
- `list-base.schema.ts`
- `kit.schema.ts`
- `task.schema.ts`
- `shots.schema.ts`
- `business-card.schema.ts`

#### Data Files
- `text-tone-table.csv` - Keep if used by project

---

### ✅ PHASE 4: RETAIN (Current, Essential Content)

#### Core Standards & Guides
- `standards-error-handling.md` ✓
- `standards-loading-states.md` ✓
- `standards-store-patterns.md` ✓
- `Guide-Errors-Full.md` ✓
- `Guide-Loading.md` ✓

#### Architecture & Design
- `GLOBAL-FLOW-B.md` ✓
- `mermaid-flows.md` ✓
- `SETUP-MODULE.md` ✓
- `JUNE26-Mobile-Kit-Architecture.md` ✓
- `JUNE26-Mobile-Location-Architecture.md` ✓
- `JUNE26-Mobile-Timeline-Architecture.md` ✓

#### Analysis & Diagnostics
- `NAVIGATION_ANALYSIS_REPORT.md` ✓
- `ISSUES_DIAGNOSIS.md` ✓
- `MIGRATION_INDEX.txt` ✓

#### Directories
- `/plonk/` - Determine purpose; archive if unused
- `/portal interaction/` - Determine purpose; consolidate into docs

**Action:** Review these directories and organize or delete if no longer needed.

---

## 🗂️ Proposed New Structure

```
my-roadmap/
├── README.md (NEW - Enhanced)
├── ARCHITECTURE.md (NEW - Consolidated)
├── ARCHITECTURE-NAVIGATION.md (NEW - Consolidated)
├── AUTH-SYSTEM.md (NEW - Consolidated)
├── DATA-MODELS.md (NEW - Consolidated)
├── ONBOARDING-FLOWS.md (NEW - Consolidated)
├── SUBSCRIPTION-PRICING.md (NEW - Consolidated)
├── 
├── standards/
│   ├── ERROR-HANDLING.md
│   ├── LOADING-STATES.md
│   └── STORE-PATTERNS.md
│
├── guides/
│   ├── ERROR-HANDLING-GUIDE.md
│   └── LOADING-GUIDE.md
│
├── src/ (or keep alongside docs)
│   ├── navigation.ts
│   ├── feature-access.ts
│   └── ... (other source files)
│
├── archive/
│   ├── flow-reviews/
│   ├── ai-reviews/
│   ├── progress-snapshots/
│   ├── auth-docs/
│   ├── subscription-docs/
│   ├── onboarding-docs/
│   └── reports/
│
└── CLEANUP_PLAN.md (this file)
```

---

## 📋 Deletion Checklist

### Quick Win Deletes (Safe - Clear Duplicates)
- [ ] `mermaid.md`
- [ ] `mermaid-flows-2.md`
- [ ] `GLOBFLOW-A.md`
- [ ] `Fix-tracker.html`

### Archive (7 flow review files)
- [ ] `flow-review-10-12-a.md`
- [ ] `flow-review-10-12-b.md`
- [ ] `flow-review-10-12-c.md`
- [ ] `flow-review-10-12-d.md`
- [ ] `flow-review-10-12-e.md`
- [ ] `flow-review-10-12-f.md`
- [ ] `flow-review-10-12-g.md`

### Archive (4 tool-generated reviews)
- [ ] `Auth-Review-auto-cursor.md`
- [ ] `Auth-Review-auto-vsCode.md`
- [ ] `Auth-Review-grok.md`
- [ ] `Auth-Review-grok2.md`

### Archive (Dated progress/reports)
- [ ] `1-11-Progress.md`
- [ ] `report-19-11.md`
- [ ] `report-19-11-A.md`

### Verify & Archive (HTML files)
- [ ] `index.html` - **VERIFY PURPOSE FIRST**

---

## 📝 Consolidation Checklist

- [ ] Create `AUTH-SYSTEM.md` (merge 8 auth-related files)
- [ ] Create `ARCHITECTURE-NAVIGATION.md` (merge 8 flow/nav files)
- [ ] Create `DATA-MODELS.md` (consolidate schema documentation)
- [ ] Create `SUBSCRIPTION-PRICING.md` (merge 4 subscription files)
- [ ] Create `ONBOARDING-FLOWS.md` (merge 4+ onboarding files)
- [ ] Update `README.md` (currently 12 bytes!)

---

## 🗂️ Organization Checklist

- [ ] Review `/plonk/` directory - delete if unused
- [ ] Review `/portal interaction/` directory - consolidate or delete
- [ ] Move or reference source `.ts` files appropriately
- [ ] Create `/archive/` directory structure
- [ ] Move identified files to `/archive/`

---

## 🎯 Implementation Order

1. **Week 1 - Quick Wins**
   - Delete obvious duplicates (3 files)
   - Archive flow review files (7 files)
   - Archive tool-generated reviews (4 files)
   - **Estimated result:** 14 files removed, 40 KB saved

2. **Week 2 - Consolidation**
   - Create new consolidated documentation files
   - Merge content from 20+ files
   - Archive old versions

3. **Week 3 - Enhancement**
   - Update README.md with project overview
   - Create documentation index
   - Organize file structure

4. **Week 4 - Verification**
   - Test all cross-references work
   - Update any external links
   - Final cleanup pass

---

## 📊 Expected Impact

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Documentation Files | 86+ | ~30 | 65% reduction |
| Duplication | High | Low | Cleaner references |
| Maintainability | Low | High | Single source of truth |
| Clarity | Confusing | Clear | Better navigation |

---

## ⚠️ Risk Assessment

### Low Risk (Safe to Delete)
- Duplicate mermaid files
- Tool-generated reviews (can be regenerated)
- Old progress snapshots

### Medium Risk (Verify Before Deleting)
- HTML files (verify if used elsewhere)
- Duplicate auth documentation (ensure coverage is complete)

### High Risk (Archive, Don't Delete)
- Historical reports
- Dated flows (may contain legacy system info)

---

## 📝 Notes

- All archived files remain in git history
- Can be restored if needed
- Archive serves as historical reference
- New consolidated files should be more maintainable
- Update dates on new consolidated files

---

**Next Steps:** Review this plan and approve Phase 1 deletions to begin cleanup.
