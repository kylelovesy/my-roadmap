/*---------------------------------------
File: src/hooks/use-navigation-transition.ts
Description: Hook for handling route transition animations
Author: Kyle Lovesy
Date: 2025-01-XX
Version: 1.0.0
---------------------------------------*/

import { useEffect, useCallback } from 'react';
import { Animated } from 'react-native';
import { useSegments } from 'expo-router';
import { useAnimation, AnimationPresets } from '@/utils/animations';
import { RouteTransition } from '@/domain/navigation/navigation.schema';

/**
 * Options for navigation transition hook
 */
interface UseNavigationTransitionOptions {
  /** Transition type (default: 'fade') */
  type?: RouteTransition['type'];
  /** Transition duration in milliseconds (default: 300) */
  duration?: number;
  /** Whether to enable transitions (default: true) */
  enabled?: boolean;
  /** Callback when transition starts */
  onTransitionStart?: () => void;
  /** Callback when transition completes */
  onTransitionEnd?: () => void;
}

/**
 * Result from navigation transition hook
 */
interface UseNavigationTransitionResult {
  /** Fade animation value (0-1) */
  fadeAnim: Animated.Value;
  /** Slide animation value */
  slideAnim: Animated.Value;
  /** Scale animation value (0-1) */
  scaleAnim: Animated.Value;
  /** Start fade in animation */
  fadeIn: (callback?: () => void) => void;
  /** Start fade out animation */
  fadeOut: (callback?: () => void) => void;
  /** Start slide up animation */
  slideUp: (callback?: () => void) => void;
  /** Start slide down animation */
  slideDown: (callback?: () => void) => void;
  /** Start scale in animation */
  scaleIn: (callback?: () => void) => void;
  /** Start scale out animation */
  scaleOut: (callback?: () => void) => void;
}

/**
 * Hook for handling route transition animations
 *
 * Provides animated values and functions for smooth route transitions.
 * Automatically triggers animations when route segments change.
 *
 * @param options - Configuration options for transitions
 * @returns Animation values and control functions
 *
 * @example
 * ```typescript
 * const { fadeAnim, fadeIn } = useNavigationTransition({
 *   type: 'fade',
 *   duration: 300,
 *   onTransitionEnd: () => console.log('Transition complete'),
 * });
 *
 * // Use in component
 * <Animated.View style={{ opacity: fadeAnim }}>
 *   {children}
 * </Animated.View>
 * ```
 */
export function useNavigationTransition(
  options: UseNavigationTransitionOptions = {},
): UseNavigationTransitionResult {
  const {
    type = 'fade',
    duration = 300,
    enabled = true,
    onTransitionStart,
    onTransitionEnd,
  } = options;

  const segments = useSegments();
  const { fadeAnim, slideAnim, scaleAnim, fadeIn, fadeOut, slideUp, slideDown, scaleIn, scaleOut } =
    useAnimation();

  /**
   * Handle route change with animation
   */
  const handleRouteChange = useCallback(() => {
    if (!enabled) {
      return;
    }

    onTransitionStart?.();

    switch (type) {
      case 'fade':
        fadeOut(() => {
          fadeIn(() => {
            onTransitionEnd?.();
          });
        });
        break;
      case 'slide':
        slideDown(() => {
          slideUp(() => {
            onTransitionEnd?.();
          });
        });
        break;
      case 'scale':
        scaleOut(() => {
          scaleIn(() => {
            onTransitionEnd?.();
          });
        });
        break;
    }
  }, [enabled, type, fadeIn, fadeOut, slideUp, slideDown, scaleIn, scaleOut, onTransitionStart, onTransitionEnd]);

  // Trigger animation on route change
  useEffect(() => {
    if (segments.length > 0) {
      handleRouteChange();
    }
  }, [segments.join('/'), handleRouteChange]);

  return {
    fadeAnim,
    slideAnim,
    scaleAnim,
    fadeIn,
    fadeOut,
    slideUp,
    slideDown,
    scaleIn,
    scaleOut,
  };
}

