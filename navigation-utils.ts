/*---------------------------------------
File: src/utils/navigation-utils.ts
Description: Navigation utility functions for route mapping and validation
Author: Kyle Lovesy
Date: 2025-01-XX
Version: 1.0.0
---------------------------------------*/

import { Result, ok, err } from '@/domain/common/result';
import { AppError, ErrorCode } from '@/domain/common/errors';
import { ErrorContextBuilder } from '@/utils/error-context-builder';
import { ErrorMapper } from '@/utils/error-mapper';
import { validateWithSchema } from '@/utils/validation-helpers';
import { navigationRouteSchema, subPageSchema } from '@/domain/navigation/navigation.schema';
import { NavigationRoute, getRouteGroup, NavigationRouteGroup } from '@/constants/navigation';
import { PortalStepID } from '@/constants/enums';
import { z } from 'zod';

/**
 * Route configuration mapping PortalStepID to routes
 */
const STEP_ROUTES: Record<PortalStepID, NavigationRoute> = {
  [PortalStepID.WELCOME]: NavigationRoute.DASHBOARD_HOME,
  [PortalStepID.KEY_PEOPLE]: NavigationRoute.DASHBOARD_HOME, // Will be extended with sub-route
  [PortalStepID.LOCATIONS]: NavigationRoute.DASHBOARD_HOME, // Will be extended with sub-route
  [PortalStepID.GROUP_SHOTS]: NavigationRoute.DASHBOARD_SHOTS,
  [PortalStepID.PHOTO_REQUESTS]: NavigationRoute.DASHBOARD_SHOTS, // Will be extended with sub-route
  [PortalStepID.TIMELINE]: NavigationRoute.DASHBOARD_TIMELINE,
};

const PortalStepIDSchema = z.nativeEnum(PortalStepID);

/**
 * Get route path for a PortalStepID
 *
 * @param stepId - Portal step identifier
 * @returns Result containing the route path or an error
 *
 * @example
 * ```typescript
 * const result = getStepPath(PortalStepID.KEY_PEOPLE);
 * if (result.success) {
 *   console.log(result.value); // '/(dashboard)/(home)/keyPeople'
 * }
 * ```
 */
export function getStepPath(stepId: PortalStepID): Result<NavigationRoute, AppError> {
  const context = ErrorContextBuilder.fromService('NavigationUtils', 'getStepPath');
  const contextString = ErrorContextBuilder.toString(context);

  try {
    // Validate input
    const validation = PortalStepIDSchema.safeParse(stepId);
    if (!validation.success) {
      return err(
        ErrorMapper.createGenericError(
          ErrorCode.VALIDATION_FAILED,
          'Invalid portal step ID',
          'Invalid portal step identifier',
          contextString,
          validation.error,
          false,
        ),
      );
    }

    const path = STEP_ROUTES[stepId] || STEP_ROUTES[PortalStepID.WELCOME];
    return ok(path);
  } catch (error) {
    return err(
      ErrorMapper.createGenericError(
        ErrorCode.NAVIGATION_ERROR,
        'Failed to get step path',
        'Failed to determine route for portal step',
        contextString,
        error,
        false,
      ),
    );
  }
}

/**
 * Validate a route path
 *
 * @param route - Route path to validate
 * @returns Result containing validated route or an error
 *
 * @example
 * ```typescript
 * const result = validateRoute('/(dashboard)/(home)');
 * if (result.success) {
 *   // Route is valid
 * }
 * ```
 */
export function validateRoute(route: string): Result<NavigationRoute, AppError> {
  const context = ErrorContextBuilder.fromService('NavigationUtils', 'validateRoute');
  const contextString = ErrorContextBuilder.toString(context);

  const validation = validateWithSchema(navigationRouteSchema, route, contextString);
  if (!validation.success) {
    return err(validation.error);
  }

  return ok(validation.value as NavigationRoute);
}

/**
 * Get SubPage route by group and ID
 *
 * @param groupId - Navigation group identifier
 * @param subPageId - SubPage identifier
 * @returns Result containing SubPage or an error
 *
 * @example
 * ```typescript
 * const result = getSubPageRoute('home', 'locations');
 * if (result.success) {
 *   console.log(result.value.route); // '/(dashboard)/(home)/locations'
 * }
 * ```
 */
export function getSubPageRoute(
  groupId: 'home' | 'shots' | 'tools' | 'settings',
  subPageId: string,
): Result<string, AppError> {
  const context = ErrorContextBuilder.fromService('NavigationUtils', 'getSubPageRoute');
  const contextString = ErrorContextBuilder.toString(context);

  try {
    // Import sub-pages dynamically to avoid circular dependencies
    const { homeSubPages, listsSubPages, toolsSubPages, settingsSubPages } =
      require('@/constants/navigation');

    const subPages =
      groupId === 'home'
        ? homeSubPages
        : groupId === 'shots'
          ? listsSubPages
          : groupId === 'tools'
            ? toolsSubPages
            : settingsSubPages;

    const subPage = subPages.find(page => page.id === subPageId);

    if (!subPage) {
      return err(
        ErrorMapper.createGenericError(
          ErrorCode.DB_NOT_FOUND,
          `SubPage not found: ${groupId}/${subPageId}`,
          'Navigation page not found',
          contextString,
          undefined,
          false,
        ),
      );
    }

    // Validate SubPage schema
    const validation = validateWithSchema(subPageSchema, subPage, contextString);
    if (!validation.success) {
      return err(validation.error);
    }

    return ok(validation.value.route);
  } catch (error) {
    return err(
      ErrorMapper.createGenericError(
        ErrorCode.NAVIGATION_ERROR,
        'Failed to get SubPage route',
        'Failed to determine route for SubPage',
        contextString,
        error,
        false,
      ),
    );
  }
}

/**
 * Check if a route belongs to a specific group
 *
 * @param route - Route to check
 * @param group - Route group to check against
 * @returns True if route belongs to group
 *
 * @example
 * ```typescript
 * const isAuth = isRouteInGroup(NavigationRoute.SIGN_IN, NavigationRouteGroup.AUTH);
 * ```
 */
export function isRouteInGroup(route: NavigationRoute, group: NavigationRouteGroup): boolean {
  return getRouteGroup(route) === group;
}

/**
 * Check if a route is in the payment group
 * 
 * @param route - Route pathname to check
 * @returns True if route starts with /(payment)
 * 
 * @example
 * ```typescript
 * if (isRouteInPaymentGroup(pathname)) {
 *   // Require email verification
 * }
 * ```
 */
export function isRouteInPaymentGroup(route: string): boolean {
  return route.startsWith('/(payment)');
}

/**
 * Check if a route is in the dashboard group
 * 
 * @param route - Route pathname to check
 * @returns True if route starts with /(dashboard)
 * 
 * @example
 * ```typescript
 * if (isRouteInDashboard(pathname) && !activeProjectId) {
 *   // Redirect to projects
 * }
 * ```
 */
export function isRouteInDashboard(route: string): boolean {
  return route.startsWith('/(dashboard)');
}

