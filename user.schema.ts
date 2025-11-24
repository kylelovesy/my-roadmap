/*---------------------------------------
File: src/domain/user.schema.ts
Description: Refactored user schemas with base document and subcollections
Author: Kyle Lovesy
Date: 03/11-2025
Version: 2.0.0
---------------------------------------*/
import { z } from 'zod';
import {
  idSchema,
  displayNameSchema,
  emailSchema,
  phoneSchema,
  requiredTimestampSchema,
  optionalTimestampSchema,
  projectTrackingSchema,
  personInfoSchema,
  hexColorSchema,
  urlSchema,
} from '@/domain/common/shared-schemas';
import {
  UserRole,
  SubscriptionPlan,
  SubscriptionStatus,
  BillingCycle,
  LanguageOption,
  WeatherUnit,
} from '@/constants/enums';
import { DEFAULTS } from '@/constants/defaults';
import { kitListSchema } from './kit.schema';
import { taskListSchema } from './task.schema';
import { coupleShotListSchema, groupShotListSchema } from './shots.schema';

// --- Re-export enums for other modules ---
export { UserRole };

/**
 * ============================================================================
 * BASE USER SCHEMA - Main user document in /users/{userId}
 * ============================================================================
 * Contains core identity, authentication, and account status
 */

export const baseUserSchema = z.object({
  id: idSchema,
  email: emailSchema,
  displayName: z
    .union([
      displayNameSchema, // Valid: 2-50 chars
      z.string().max(1), // Invalid: 0-1 chars, will be transformed
      z.literal(''), // Empty string
      z.null(), // Null
    ])
    .optional()
    .nullable()
    .transform(val => {
      // Normalize: convert invalid values to null
      if (!val || (typeof val === 'string' && val.trim().length < 2)) {
        return null;
      }
      return typeof val === 'string' ? val.trim() : null;
    })
    .default(null),
  name: personInfoSchema.optional().nullable().default(null),
  phone: phoneSchema.optional().nullable().default(null),
  role: z.nativeEnum(UserRole).default(UserRole.USER),
  isEmailVerified: z.boolean().default(DEFAULTS.DISABLED),
  isActive: z.boolean().default(DEFAULTS.ENABLED),
  isBanned: z.boolean().default(DEFAULTS.DISABLED),
  hasCustomizations: z.boolean().default(DEFAULTS.DISABLED),
  lastLoginAt: optionalTimestampSchema.optional(),
  deletedAt: optionalTimestampSchema.nullable().default(null),
  /**
   * @deprecated - No longer used. Cloud Function now uses defaults only.
   * Subscription plan is not set during registration (defaults to FREE).
   */
  selectedSubscriptionPlan: z.nativeEnum(SubscriptionPlan).optional().nullable().default(null),
  /**
   * @internal - Used by Cloud Function to signal document initialization completion
   * Set to true after all subcollections are created
   */
  _documentsInitialized: z.boolean().optional(),
  _documentsInitializedAt: optionalTimestampSchema.optional(),
  createdAt: requiredTimestampSchema,
  updatedAt: optionalTimestampSchema.optional(),
});

export const baseUserInputSchema = baseUserSchema.omit({
  id: true,
  role: true,
  isEmailVerified: true,
  isActive: true,
  isBanned: true,
  hasCustomizations: true,
  lastLoginAt: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const baseUserUpdateSchema = baseUserInputSchema.partial();

/**
 * @deprecated - User documents are now created automatically server-side via Cloud Function
 */
export const baseUserCreateSchema = baseUserInputSchema.extend({
  id: idSchema, // Auth provides the ID
});

/**
 * ============================================================================
 * PROFILE SUBCOLLECTION - /users/{userId}/profile/{profileId}
 * ============================================================================
 * Extended profile information and personal details
 */

export const userProfileSchema = z.object({
  id: idSchema,
  userId: idSchema,
  name: personInfoSchema.optional().nullable().default(null),
  bio: z.string().max(500).optional().nullable().default(null),
  website: z.string().url().optional().nullable().default(null),
  businessName: z.string().max(100).optional().nullable().default(null),
  bannedAt: optionalTimestampSchema.nullable().default(null),
  bannedReason: z.string().max(500).nullable().default(null),
  createdAt: requiredTimestampSchema,
  updatedAt: optionalTimestampSchema.optional(),
});

export const userProfileInputSchema = userProfileSchema.omit({
  id: true,
  userId: true,
  bannedAt: true,
  bannedReason: true,
  createdAt: true,
  updatedAt: true,
});

export const userProfileUpdateSchema = userProfileInputSchema.partial();

/**
 * @deprecated - User documents are now created automatically server-side via Cloud Function
 */
export const userProfileCreateSchema = userProfileInputSchema.extend({
  userId: idSchema,
});

/**
 * ============================================================================
 * PREFERENCES SUBCOLLECTION - /users/{userId}/preferences/{preferencesId}
 * ============================================================================
 * User settings and application preferences
 */

export const userPreferencesSchema = z.object({
  id: idSchema,
  userId: idSchema,
  notifications: z.boolean().default(DEFAULTS.ENABLED),
  darkMode: z.boolean().default(DEFAULTS.DISABLED),
  language: z.nativeEnum(LanguageOption).default(LanguageOption.ENGLISH),
  weatherUnits: z.nativeEnum(WeatherUnit).default(WeatherUnit.METRIC),
  weekStartsOn: z.number().int().min(0).max(6).default(1),
  marketingConsent: z.boolean().default(DEFAULTS.DISABLED),
  timezone: z.string().default('UTC'),
  dateFormat: z.string().default('DD/MM/YYYY'),
  timeFormat: z.enum(['12h', '24h']).default('24h'),
  createdAt: requiredTimestampSchema,
  updatedAt: optionalTimestampSchema.optional(),
});

export const userPreferencesInputSchema = userPreferencesSchema.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const userPreferencesUpdateSchema = userPreferencesInputSchema.partial();

/**
 * @deprecated - User documents are now created automatically server-side via Cloud Function
 */
export const userPreferencesCreateSchema = userPreferencesInputSchema.extend({
  userId: idSchema,
});

/**
 * ============================================================================
 * CUSTOMIZATIONS SUBCOLLECTION - /users/{userId}/customizations/{customizationsId}
 * ============================================================================
 * User branding/theme settings moved from shared schema to subcollection
 */

export const userCustomizationsSchema = z.object({
  id: idSchema,
  userId: idSchema,
  primaryColor: hexColorSchema.optional(),
  secondaryColor: hexColorSchema.optional(),
  accentColor: hexColorSchema.optional(),
  backgroundColor: hexColorSchema.optional(),
  textColor: hexColorSchema.optional(),
  logo: urlSchema.optional(),
  createdAt: requiredTimestampSchema,
  updatedAt: optionalTimestampSchema.optional(),
});

export const userCustomizationsInputSchema = userCustomizationsSchema.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const userCustomizationsUpdateSchema = userCustomizationsInputSchema.partial();

/**
 * @deprecated - User documents are now created automatically server-side via Cloud Function
 */
export const userCustomizationsCreateSchema = userCustomizationsInputSchema.extend({
  userId: idSchema,
});

/**
 * ============================================================================
 * SUBSCRIPTION SUBCOLLECTION - /users/{userId}/subscription/{subscriptionId}
 * ============================================================================
 * Billing and subscription management
 */

export const userSubscriptionSchema = z.object({
  id: idSchema,
  userId: idSchema,
  plan: z.nativeEnum(SubscriptionPlan).default(SubscriptionPlan.NONE),
  status: z.nativeEnum(SubscriptionStatus).default(SubscriptionStatus.NONE),
  isActive: z.boolean().default(DEFAULTS.DISABLED),
  isTrial: z.boolean().default(false),
  autoRenew: z.boolean().default(DEFAULTS.DISABLED),
  billingCycle: z.nativeEnum(BillingCycle).default(BillingCycle.NONE),
  startDate: requiredTimestampSchema,
  endDate: optionalTimestampSchema.optional(),
  trialEndsAt: optionalTimestampSchema.optional(),
  cancelledAt: optionalTimestampSchema.optional(),
  lastPaymentDate: optionalTimestampSchema.optional(),
  nextBillingDate: optionalTimestampSchema.optional(),
  transactionId: z.string().max(255).optional(),
  receipt: z.string().optional(),
  createdAt: requiredTimestampSchema,
  updatedAt: optionalTimestampSchema.optional(),
});

export const userSubscriptionInputSchema = userSubscriptionSchema.omit({
  id: true,
  userId: true,
  // Removed from omit to allow updates: isActive, endDate, cancelledAt, transactionId, lastPaymentDate, nextBillingDate, trialEndsAt, receipt
  startDate: true, // Set on creation only
  createdAt: true,
  updatedAt: true,
});

export const userSubscriptionUpdateSchema = userSubscriptionInputSchema.partial();

/**
 * @deprecated - User documents are now created automatically server-side via Cloud Function
 */
export const userSubscriptionCreateSchema = userSubscriptionInputSchema.extend({
  userId: idSchema,
  startDate: requiredTimestampSchema,
});

/**
 * ============================================================================
 * SETUP SUBCOLLECTION - /users/{userId}/setup/{setupId}
 * ============================================================================
 * Onboarding and initial configuration tracking
 */

export const userSetupSchema = z.object({
  id: idSchema,
  userId: idSchema,
  firstTimeSetup: z.boolean().default(DEFAULTS.ENABLED),
  showOnboarding: z.boolean().default(DEFAULTS.ENABLED),
  skippedEmailVerification: z.boolean().default(DEFAULTS.DISABLED),
  onboardingCompletedDate: optionalTimestampSchema.optional(),
  viewedTutorials: z.array(z.string()).default([]),
  customKitListSetup: z.boolean().default(DEFAULTS.DISABLED),
  customTaskListSetup: z.boolean().default(DEFAULTS.DISABLED),
  customBusinessCardSetup: z.boolean().default(DEFAULTS.DISABLED),
  customGroupShotsSetup: z.boolean().default(DEFAULTS.DISABLED),
  customCoupleShotsSetup: z.boolean().default(DEFAULTS.DISABLED),
  createdAt: requiredTimestampSchema,
  updatedAt: optionalTimestampSchema.optional(),
});

export const userSetupInputSchema = userSetupSchema.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const userSetupUpdateSchema = userSetupInputSchema.partial();

/**
 * @deprecated - User documents are now created automatically server-side via Cloud Function
 */
export const userSetupCreateSchema = userSetupInputSchema.extend({
  userId: idSchema,
});

/**
 * ============================================================================
 * PROJECTS SUBCOLLECTION - /users/{userId}/projects/{projectsId}
 * ============================================================================
 * User's project tracking and statistics
 */

export const userProjectsSchema = z.object({
  id: idSchema,
  userId: idSchema,
  activeProjects: z.number().int().min(0).default(DEFAULTS.ITEM_COUNT),
  totalProjects: z.number().int().min(0).default(DEFAULTS.ITEM_COUNT),
  projects: z.array(projectTrackingSchema).default([]),
  createdAt: requiredTimestampSchema,
  updatedAt: optionalTimestampSchema.optional(),
});

export const userProjectsInputSchema = userProjectsSchema.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const userProjectsUpdateSchema = userProjectsInputSchema.partial();

/**
 * @deprecated - User documents are now created automatically server-side via Cloud Function
 */
export const userProjectsCreateSchema = userProjectsInputSchema.extend({
  userId: idSchema,
});

/**
 * ============================================================================
 * ADMIN OPERATIONS SCHEMAS
 * ============================================================================
 */

export const userBanInputSchema = z.object({
  reason: z.string().min(1, 'Ban reason is required').max(500),
});

export const userUnbanInputSchema = z.object({
  note: z.string().max(500).optional(),
});

export const userRoleUpdateSchema = z.object({
  role: z.nativeEnum(UserRole),
});

/**
 * ============================================================================
 * COMPOSITE SCHEMAS (for joins/aggregation)
 * ============================================================================
 */

export const userWithSubcollectionsSchema = baseUserSchema.extend({
  profile: userProfileSchema.optional(),
  preferences: userPreferencesSchema.optional(),
  customizations: userCustomizationsSchema.optional(),
  subscription: userSubscriptionSchema.optional(),
  setup: userSetupSchema.optional(),
  projects: userProjectsSchema.optional(),
  kitList: kitListSchema.optional(),
  taskList: taskListSchema.optional(),
  coupleShotList: coupleShotListSchema.optional(),
  groupShotList: groupShotListSchema.optional(),
  // businessCard: businessCardSchema.optional(),
  // notes: noteSchema.optional(),
  // vendors: vendorsListSchema.optional(),
});

/**
 * ============================================================================
 * TYPE EXPORTS
 * ============================================================================
 */

// Base User
export type BaseUser = z.infer<typeof baseUserSchema>;
export type BaseUserInput = z.infer<typeof baseUserInputSchema>;
export type BaseUserUpdate = z.infer<typeof baseUserUpdateSchema>;
/**
 * @deprecated - User documents are now created automatically server-side via Cloud Function
 */
export type BaseUserCreate = z.infer<typeof baseUserCreateSchema>;

// Profile
export type UserProfile = z.infer<typeof userProfileSchema>;
export type UserProfileInput = z.infer<typeof userProfileInputSchema>;
export type UserProfileUpdate = z.infer<typeof userProfileUpdateSchema>;
/**
 * @deprecated - User documents are now created automatically server-side via Cloud Function
 */
export type UserProfileCreate = z.infer<typeof userProfileCreateSchema>;

// Preferences
export type UserPreferences = z.infer<typeof userPreferencesSchema>;
export type UserPreferencesInput = z.infer<typeof userPreferencesInputSchema>;
export type UserPreferencesUpdate = z.infer<typeof userPreferencesUpdateSchema>;
/**
 * @deprecated - User documents are now created automatically server-side via Cloud Function
 */
export type UserPreferencesCreate = z.infer<typeof userPreferencesCreateSchema>;

// Customizations
export type UserCustomizations = z.infer<typeof userCustomizationsSchema>;
export type UserCustomizationsInput = z.infer<typeof userCustomizationsInputSchema>;
export type UserCustomizationsUpdate = z.infer<typeof userCustomizationsUpdateSchema>;
/**
 * @deprecated - User documents are now created automatically server-side via Cloud Function
 */
export type UserCustomizationsCreate = z.infer<typeof userCustomizationsCreateSchema>;

// Subscription
export type UserSubscription = z.infer<typeof userSubscriptionSchema>;
export type UserSubscriptionInput = z.infer<typeof userSubscriptionInputSchema>;
export type UserSubscriptionUpdate = z.infer<typeof userSubscriptionUpdateSchema>;
/**
 * @deprecated - User documents are now created automatically server-side via Cloud Function
 */
export type UserSubscriptionCreate = z.infer<typeof userSubscriptionCreateSchema>;

// Setup
export type UserSetup = z.infer<typeof userSetupSchema>;
export type UserSetupInput = z.infer<typeof userSetupInputSchema>;
export type UserSetupUpdate = z.infer<typeof userSetupUpdateSchema>;
/**
 * @deprecated - User documents are now created automatically server-side via Cloud Function
 */
export type UserSetupCreate = z.infer<typeof userSetupCreateSchema>;

// Projects
export type UserProjects = z.infer<typeof userProjectsSchema>;
export type UserProjectsInput = z.infer<typeof userProjectsInputSchema>;
export type UserProjectsUpdate = z.infer<typeof userProjectsUpdateSchema>;
/**
 * @deprecated - User documents are now created automatically server-side via Cloud Function
 */
export type UserProjectsCreate = z.infer<typeof userProjectsCreateSchema>;

// Admin
export type UserBanInput = z.infer<typeof userBanInputSchema>;
export type UserUnbanInput = z.infer<typeof userUnbanInputSchema>;
export type UserRoleUpdate = z.infer<typeof userRoleUpdateSchema>;

// Composite
export type UserWithSubcollections = z.infer<typeof userWithSubcollectionsSchema>;

/**
 * ============================================================================
 * DEFAULT VALUE FACTORIES
 * ============================================================================
 */

// Replaced base metadata object with flat createdAt/updatedAt fields

// Customizations moved to dedicated subcollection

export const defaultBaseUser = (id: string, email: string): BaseUser => ({
  id,
  email,
  displayName: '',
  name: {
    firstName: '',
    lastName: '',
  },
  phone: null as string | null,
  role: UserRole.USER,
  isEmailVerified: false,
  isActive: true,
  isBanned: false,
  hasCustomizations: false,
  lastLoginAt: null as Date | null,
  deletedAt: null as Date | null,
  selectedSubscriptionPlan: null,
  _documentsInitialized: undefined,
  _documentsInitializedAt: undefined,
  createdAt: new Date(),
  updatedAt: null as Date | null,
});

export const defaultUserProfile = (userId: string): UserProfile => ({
  id: '', // Generated by Firestore
  userId,
  name: null,
  bio: null,
  website: null,
  businessName: null,
  bannedAt: null,
  bannedReason: null,
  createdAt: new Date(),
  updatedAt: null,
});

export const defaultUserPreferences = (userId: string): UserPreferences => ({
  id: '', // Generated by Firestore
  userId,
  notifications: true,
  darkMode: false,
  language: LanguageOption.ENGLISH,
  weatherUnits: WeatherUnit.METRIC,
  weekStartsOn: 1,
  marketingConsent: false,
  timezone: 'UTC',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24h',
  createdAt: new Date(),
  updatedAt: null as Date | null,
});

export const defaultUserSubscription = (userId: string): UserSubscription => ({
  id: '', // Generated by Firestore
  userId,
  plan: SubscriptionPlan.NONE,
  status: SubscriptionStatus.NONE,
  isActive: false,
  isTrial: false,
  autoRenew: false,
  billingCycle: BillingCycle.NONE,
  startDate: new Date(),
  endDate: null as Date | null,
  trialEndsAt: null as Date | null,
  cancelledAt: null as Date | null,
  lastPaymentDate: null as Date | null,
  nextBillingDate: null as Date | null,
  transactionId: '',
  receipt: '',
  createdAt: new Date(),
  updatedAt: null as Date | null,
});

export const defaultUserSetup = (userId: string): UserSetup => ({
  id: '', // Generated by Firestore
  userId,
  firstTimeSetup: true,
  showOnboarding: true,
  skippedEmailVerification: false,
  onboardingCompletedDate: null as Date | null,
  viewedTutorials: [],
  customKitListSetup: false,
  customTaskListSetup: false,
  customBusinessCardSetup: false,
  customGroupShotsSetup: false,
  customCoupleShotsSetup: false,
  createdAt: new Date(),
  updatedAt: null as Date | null,
});

export const defaultUserProjects = (userId: string): UserProjects => ({
  id: '', // Generated by Firestore
  userId,
  activeProjects: 0,
  totalProjects: 0,
  projects: [],
  createdAt: new Date(),
  updatedAt: null as Date | null,
});

export const defaultUserCustomizations = (userId: string): UserCustomizations => ({
  id: '', // Generated by Firestore
  userId,
  primaryColor: '#4A90E2',
  secondaryColor: '#D4A76A',
  accentColor: '#6B8E23',
  backgroundColor: '#F5F5F5',
  textColor: '#1A1A1A',
  logo: '',
  createdAt: new Date(),
  updatedAt: null as Date | null,
});
