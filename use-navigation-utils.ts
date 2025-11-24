/*---------------------------------------
File: src/hooks/use-navigation-utils.ts
Description: Navigation utilities hook for route checking and SubPage navigation
Author: Kyle Lovesy
Date: 2025-01-XX
Version: 1.0.0
---------------------------------------*/

import { useMemo, useCallback } from 'react';
import { RelativePathString, UnknownInputParams, useRouter, useSegments } from 'expo-router';
import { SubPage } from '@/domain/navigation/navigation.schema';
import {
  homeSubPages,
  listsSubPages,
  toolsSubPages,
  settingsSubPages,
} from '@/constants/navigation';

/**
 * Result from navigation utils hook
 */
interface UseNavigationUtilsResult {
  /** Current route path */
  currentRoute: string;
  /** Check if a route is currently active */
  isRouteActive: (route: string) => boolean;
  /** Current route segments */
  segments: string[];
  /** Navigate to a SubPage */
  navigateToSubPage: (subPage: SubPage) => void;
  /** Get SubPage by ID from a group */
  getSubPageById: (groupId: 'home' | 'shots' | 'tools' | 'settings', id: string) => SubPage | null;
  /** Get all SubPages for a group */
  getSubPages: (groupId: 'home' | 'shots' | 'tools' | 'settings') => SubPage[];
}

/**
 * Hook for navigation utilities
 *
 * Provides utilities for route checking and SubPage navigation.
 * Extends the dashboard navigation pattern throughout the app.
 *
 * @returns Navigation utilities
 *
 * @example
 * ```typescript
 * const { currentRoute, isRouteActive, navigateToSubPage } = useNavigationUtils();
 *
 * // Check if route is active
 * if (isRouteActive('/(dashboard)/(home)')) {
 *   // Do something
 * }
 *
 * // Navigate to SubPage
 * const subPage = getSubPageById('home', 'locations');
 * if (subPage) {
 *   navigateToSubPage(subPage);
 * }
 * ```
 */
export function useNavigationUtils(): UseNavigationUtilsResult {
  const segments = useSegments();
  const router = useRouter();

  const currentRoute = useMemo(() => `/${segments.join('/')}`, [segments]);

  const isRouteActive = useCallback(
    (route: string): boolean => {
      return currentRoute.startsWith(route);
    },
    [currentRoute],
  );

  const navigateToSubPage = useCallback(
    (subPage: SubPage) => {
      if (subPage.params) {
        router.push({
          pathname: subPage.route as RelativePathString,
          params: subPage.params as unknown as UnknownInputParams,
        });
      } else {
        router.push(subPage.route as RelativePathString);
      }
    },
    [router],
  );

  const getSubPageById = useCallback(
    (groupId: 'home' | 'shots' | 'tools' | 'settings', id: string): SubPage | null => {
      const subPages =
        groupId === 'home'
          ? homeSubPages
          : groupId === 'shots'
            ? listsSubPages
            : groupId === 'tools'
              ? toolsSubPages
              : settingsSubPages;

      return subPages.find(page => page.id === id) || null;
    },
    [],
  );

  const getSubPages = useCallback((groupId: 'home' | 'shots' | 'tools' | 'settings'): SubPage[] => {
    return groupId === 'home'
      ? homeSubPages
      : groupId === 'shots'
        ? listsSubPages
        : groupId === 'tools'
          ? toolsSubPages
          : settingsSubPages;
  }, []);

  return {
    currentRoute,
    isRouteActive,
    segments,
    navigateToSubPage,
    getSubPageById,
    getSubPages,
  };
}
