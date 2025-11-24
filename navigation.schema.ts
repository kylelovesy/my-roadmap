/*---------------------------------------
File: src/domain/navigation/navigation.schema.ts
Description: Navigation domain schemas for route state, routes, and navigation configuration
Author: Kyle Lovesy
Date: 2025-01-XX
Version: 1.0.0
---------------------------------------*/

import { z } from 'zod';
import { idSchema } from '@/domain/common/shared-schemas';
import { BaseUser } from '@/domain/user/user.schema';
import { UserSubscription, UserSetup } from '@/domain/user/user.schema';
import { ServiceFactoryClass } from '@/services/ServiceFactory';
// import { NavigationRoute } from '@/constants/navigation';

/**
 * ============================================================================
 * NAVIGATION STATE SCHEMA
 * ============================================================================
 * Represents the current navigation state based on route segments
 */

export const navigationStateSchema = z.object({
  inAuthGroup: z.boolean().default(false),
  inOnboardingGroup: z.boolean().default(false),
  inSetupGroup: z.boolean().default(false),
  inPaymentGroup: z.boolean().default(false),
  inSubscriptionGroup: z.boolean().default(false),
  inProjects: z.boolean().default(false),
  inDashboard: z.boolean().default(false),
  inEmailVerification: z.boolean().default(false),
  inAppGroup: z.boolean().default(false),
  inMainApp: z.boolean().default(false),
});

export type NavigationState = z.infer<typeof navigationStateSchema>;

/**
 * ============================================================================
 * SUB PAGE SCHEMA
 * ============================================================================
 * Represents a sub-page within a navigation group (e.g., dashboard tabs)
 */

export const subPageSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  iconName: z.string().min(1),
  route: z.string().min(1),
  params: z.record(z.unknown()).optional().nullable().default(null),
});

export type SubPage = z.infer<typeof subPageSchema>;

/**
 * ============================================================================
 * ROUTE TRANSITION SCHEMA
 * ============================================================================
 * Configuration for route transition animations
 */

export const routeTransitionSchema = z.object({
  type: z.enum(['fade', 'slide', 'scale']).default('fade'),
  duration: z.number().int().min(0).default(300),
  direction: z.enum(['up', 'down', 'left', 'right']).optional().nullable().default(null),
});

export type RouteTransition = z.infer<typeof routeTransitionSchema>;

/**
 * ============================================================================
 * NAVIGATION ROUTE SCHEMA
 * ============================================================================
 * Schema for validating route paths
 */

export const navigationRouteSchema = z.string().min(1);

export type NavigationRoute = z.infer<typeof navigationRouteSchema>;

/**
 * ============================================================================
 * SESSION FLAGS
 * ============================================================================
 * Session-based flags for transient navigation state
 * These flags reset on app reload, enabling "every launch" behavior
 */

/**
 * Session-based flags for transient navigation state
 * These flags reset on app reload, enabling "every launch" behavior
 */
export interface SessionFlags {
  /** Whether user has seen free welcome onboarding this session */
  hasSeenFreeWelcome: boolean;
  /** Whether user has seen subscription expiry warning this session */
  hasSeenExpiryWarning: boolean;
}

/**
 * Default session flags (all false - not seen)
 */
export const defaultSessionFlags: SessionFlags = {
  hasSeenFreeWelcome: false,
  hasSeenExpiryWarning: false,
};

/**
 * ============================================================================
 * ROUTING RULE SCHEMA
 * ============================================================================
 * Schema for routing decision rules (used in constants, not runtime validation)
 */

export const routingRuleSchema = z.object({
  id: idSchema,
  priority: z.number().int().min(0),
  targetRoute: navigationRouteSchema,
  params: z.record(z.unknown()).optional().nullable().default(null),
  // Note: condition and onMatch are functions, not validated by Zod
  // They are defined in TypeScript interfaces in constants
});

/**
 * Enhanced routing rule for navigation decisions
 * Evaluated in priority order (higher priority first)
 */
export interface RoutingRule {
  /** Unique identifier for the rule */
  id: string;

  /** Human-readable name for debugging */
  name: string;

  /** Priority (higher = checked first) */
  priority: number;

  /**
   * Condition function that determines if this rule applies
   *
   * @param user - Current authenticated user (or null)
   * @param subscription - User's subscription data (or null)
   * @param setup - User's setup data (or null)
   * @param sessionFlags - Session-based transient flags
   * @param currentRoute - Current route pathname
   * @param activeProjectId - Currently selected project ID (or null)
   * @returns True if rule condition is met
   */
  condition: (
    user: BaseUser | null,
    subscription: UserSubscription | null,
    setup: UserSetup | null,
    sessionFlags: SessionFlags,
    currentRoute: string,
    activeProjectId: string | null,
  ) => boolean;

  /** Target route when condition is true */
  targetRoute: NavigationRoute;

  /** Optional route parameters */
  params?: Record<string, unknown>;

  /**
   * Optional action to execute when rule matches
   * Can either:
   * - Return Partial<SessionFlags> to update session flags (sync)
   * - Return Promise<void> to execute async service calls (e.g., database updates)
   *
   * @param user - Current authenticated user
   * @param subscription - User's subscription data
   * @param setup - User's setup data
   * @param services - ServiceFactory instance for async operations
   * @returns Updated session flags or void for async operations
   */
  onMatch?: (
    user: BaseUser,
    subscription: UserSubscription | null,
    setup: UserSetup | null,
    services: ServiceFactoryClass,
  ) => Partial<SessionFlags> | Promise<void>;

  /** Optional description of the rule */
  description?: string;
}
