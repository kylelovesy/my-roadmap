/*---------------------------------------
File: src/hooks/use-navigation-guard.ts
Description: Navigation guard hook for centralized routing logic
Author: Kyle Lovesy
Date: 2025-01-XX
Version: 1.0.0
---------------------------------------*/

import { useEffect, useRef, useCallback, useState } from 'react';
import {
  useRouter,
  useSegments,
  usePathname,
  UnknownInputParams,
  RelativePathString,
} from 'expo-router';
import { useAuthStore } from '@/stores/use-auth-store';
import { useActiveProjectStore } from '@/stores/use-active-project-store';
import { useServices } from '@/contexts/ServiceContext';
import { useErrorHandler } from '@/hooks/use-error-handler';
import { ErrorContextBuilder } from '@/utils/error-context-builder';
import { ErrorMapper } from '@/utils/error-mapper';
import { ErrorCode } from '@/constants/error-code-registry';
import { LoadingState, loading, success, error as errorState, idle } from '@/utils/loading-state';
import { withRetry } from '@/utils/error-recovery';
import {
  NavigationState,
  SessionFlags,
  defaultSessionFlags,
} from '@/domain/navigation/navigation.schema';
import {
  NavigationRoute,
  ROUTING_RULES,
  getRouteGroup,
  NavigationRouteGroup,
} from '@/constants/navigation';
import { BaseUser, UserSubscription, UserSetup } from '@/domain/user/user.schema';
import { AppError } from '@/domain/common/errors';

/**
 * Options for the navigation guard hook
 */
interface UseNavigationGuardOptions {
  /** Whether to enable the guard (default: true) */
  enabled?: boolean;
  /** Callback when navigation decision is made */
  onNavigate?: (route: NavigationRoute) => void;
  /** Callback on error */
  onError?: (error: AppError) => void;
}

/**
 * Result from the navigation guard hook
 */
interface UseNavigationGuardResult {
  /** Current navigation state */
  navigationState: NavigationState | null;
  /** Loading state for navigation decisions */
  loading: boolean;
  /** Error state if navigation fails */
  error: AppError | null;
  /** Whether auth is initialized */
  isInitialized: boolean;
}

/**
 * Navigation guard hook that handles centralized routing logic
 *
 * This hook:
 * - Monitors user authentication state
 * - Fetches subscription and setup data
 * - Evaluates routing rules from constants
 * - Navigates to appropriate routes based on user state
 * - Prevents duplicate navigation attempts
 * - Handles errors gracefully
 *
 * @param options - Configuration options for the guard
 * @returns Navigation guard state and utilities
 *
 * @example
 * ```typescript
 * const { loading, error, isInitialized } = useNavigationGuard({
 *   enabled: true,
 *   onNavigate: (route) => console.log('Navigating to:', route),
 * });
 * ```
 */
export function useNavigationGuard(
  options: UseNavigationGuardOptions = {},
): UseNavigationGuardResult {
  const { enabled = true, onNavigate, onError } = options;
  const { user, loading: authLoading } = useAuthStore();
  const services = useServices();
  const { userSubscription, userSetup } = services;
  const { handleError } = useErrorHandler();
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const activeProjectId = useActiveProjectStore(s => s.activeProjectId);
  const navigationAttemptedRef = useRef(false);
  const isMountedRef = useRef(true);
  const isFetchingRef = useRef(false);
  const sessionFlagsRef = useRef<SessionFlags>(defaultSessionFlags);
  const [state, setState] = useState<LoadingState<NavigationState | null>>(idle());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Build navigation state from current route segments
   */
  const buildNavigationState = useCallback((): NavigationState => {
    const firstSegment = segments[0] || '';
    const secondSegment = segments[1] || '';

    const navState: NavigationState = {
      inAuthGroup: firstSegment === '(auth)',
      inOnboardingGroup: firstSegment === '(onboarding)',
      inSetupGroup: firstSegment === '(setup)',
      inPaymentGroup: firstSegment === '(payment)',
      inSubscriptionGroup: firstSegment === '(subscription)',
      inProjects: firstSegment === '(projects)',
      inDashboard: (firstSegment as string) === '(dashboard)',
      inEmailVerification: firstSegment === '(auth)' && secondSegment === 'emailVerification',
      inAppGroup: false,
      inMainApp: false,
    };

    navState.inAppGroup =
      !navState.inAuthGroup &&
      !navState.inOnboardingGroup &&
      !navState.inSetupGroup &&
      !navState.inPaymentGroup &&
      !navState.inSubscriptionGroup;

    navState.inMainApp = navState.inProjects || navState.inDashboard;

    return navState;
  }, [segments]);

  /**
   * Evaluate routing rules and determine target route
   */
  const evaluateRoutingRules = useCallback(
    async (
      user: BaseUser | null,
      subscription: UserSubscription | null,
      setup: UserSetup | null,
    ): Promise<{ route: NavigationRoute; params?: Record<string, unknown> } | null> => {
      // Sort rules by priority (higher first)
      const sortedRules = [...ROUTING_RULES].sort((a, b) => b.priority - a.priority);

      for (const rule of sortedRules) {
        // Pass all 6 parameters to condition
        const match = rule.condition(
          user,
          subscription,
          setup,
          sessionFlagsRef.current,
          pathname,
          activeProjectId,
        );

        if (match) {
          // Execute onMatch callback if provided
          if (rule.onMatch && user) {
            try {
              const result = rule.onMatch(user, subscription, setup, services);

              // Handle sync session flag updates
              if (result && typeof result === 'object' && !('then' in result)) {
                sessionFlagsRef.current = {
                  ...sessionFlagsRef.current,
                  ...(result as Partial<SessionFlags>),
                };
                if (__DEV__) {
                  console.log(`[NavGuard] Updated session flags:`, result);
                }
              }
              // Handle async service calls
              else if (result && typeof result === 'object' && 'then' in result) {
                await (result as Promise<void>);
                if (__DEV__) {
                  console.log(`[NavGuard] Executed async onMatch for rule: ${rule.name}`);
                }
              }
            } catch (error) {
              const context = ErrorContextBuilder.fromHook(
                'useNavigationGuard',
                'evaluateRoutingRules',
                user.id,
              );
              const appError =
                error !== null &&
                typeof error === 'object' &&
                'code' in error &&
                'userMessage' in error
                  ? (error as AppError)
                  : ErrorMapper.createGenericError(
                      ErrorCode.NAVIGATION_ERROR,
                      `Failed to execute routing rule action: ${rule.name}`,
                      'Navigation error occurred',
                      ErrorContextBuilder.toString(context),
                      error,
                      false,
                    );
              handleError(appError, context);
              onError?.(appError);
            }
          }

          if (__DEV__) {
            console.log(`[NavGuard] Matched Rule: ${rule.name} -> ${rule.targetRoute}`);
          }

          return {
            route: rule.targetRoute as NavigationRoute,
            params: rule.params,
          };
        }
      }

      return null;
    },
    [pathname, activeProjectId, services, handleError, onError],
  );

  /**
   * Handle navigation decision
   */
  // const handleNavigation = useCallback(
  //   async (user: BaseUser | null, navState: NavigationState) => {
  //     if (!isMountedRef.current) return;

  //     // ✅ ADD: Prevent duplicate fetches
  //     if (isFetchingRef.current) {
  //       if (__DEV__) {
  //         console.log('⏸️ Navigation guard: Already fetching, skipping duplicate call');
  //       }
  //       return;
  //     }

  //     // Handle unauthenticated users
  //     if (!user) {
  //       if (!navState.inAuthGroup && !navigationAttemptedRef.current) {
  //         navigationAttemptedRef.current = true;
  //         router.push(NavigationRoute.WELCOME);
  //         // onNavigate?.(NavigationRoute.WELCOME);
  //       }
  //       return;
  //     }

  //     // Prevent duplicate navigation attempts
  //     if (navigationAttemptedRef.current) {
  //       return;
  //     }

  //     // ✅ FIX: Allow users to stay in payment group - don't redirect them away
  //     if (navState.inPaymentGroup) {
  //       if (__DEV__) {
  //         console.log('✅ User in payment flow - allowing to stay');
  //       }
  //       setState(success(navState));
  //       return;
  //     }

  //     setState(loading());
  //     isFetchingRef.current = true;

  //     try {
  //       if (__DEV__) {
  //         console.log('🔍 Navigation guard: Fetching subscription and setup data...');
  //       }

  //       // Fetch subscription and setup data with retry logic (exponential backoff)
  //       const [subResult, setupResult] = await Promise.all([
  //         withRetry(() => userSubscription.getByUserId(user.id), {
  //           maxAttempts: 5,
  //           delayMs: 500,
  //           exponential: true,
  //           onRetry: (attempt, error) => {
  //             if (__DEV__) {
  //               console.log(`⏳ Retry ${attempt}/5 fetching subscription: ${error.userMessage}`);
  //             }
  //           },
  //         }),
  //         withRetry(() => userSetup.getByUserId(user.id), {
  //           maxAttempts: 5,
  //           delayMs: 500,
  //           exponential: true,
  //           onRetry: (attempt, error) => {
  //             if (__DEV__) {
  //               console.log(`⏳ Retry ${attempt}/5 fetching setup: ${error.userMessage}`);
  //             }
  //           },
  //         }),
  //       ]);

  //       if (!isMountedRef.current) return;

  //       // Handle errors - fallback to projects
  //       if (!subResult.success || !setupResult.success) {
  //         const context = ErrorContextBuilder.fromHook(
  //           'useNavigationGuard',
  //           'handleNavigation',
  //           user.id,
  //         );
  //         const error = !subResult.success
  //           ? (subResult as { success: false; error: AppError }).error
  //           : (setupResult as { success: false; error: AppError }).error;

  //         if (__DEV__) {
  //           console.error('❌ Failed to fetch user data after retries:', error.userMessage);
  //         }
  //         handleError(error, context);
  //         onError?.(error);

  //         // Fallback to projects
  //         if (!navState.inProjects && !navState.inDashboard) {
  //           if (__DEV__) {
  //             console.log('🔄 Falling back to projects index');
  //           }
  //           navigationAttemptedRef.current = true;
  //           router.replace(NavigationRoute.PROJECTS_INDEX);
  //           onNavigate?.(NavigationRoute.PROJECTS_INDEX);
  //         }
  //         setState(success(navState));
  //         return;
  //       }

  //       const subscription = subResult.value;
  //       const setup = setupResult.value;

  //       services.onboarding
  //         .ensureTrialUserLists(user.id, subscription, user, setup)
  //         .then(result => {
  //           if (result.success && __DEV__) {
  //             console.log('✅ Trial user lists auto-populated');
  //           } else if (!result.success && __DEV__) {
  //             console.warn(
  //               '⚠️ Failed to auto-populate trial user lists:',
  //               result.error.userMessage,
  //             );
  //           }
  //         })
  //         .catch(err => {
  //           if (__DEV__) {
  //             console.error('❌ Error auto-populating trial user lists:', err);
  //           }
  //         });
  //       // Auto-populate trial user lists if conditions are met
  //       // if (
  //       //   subscription.plan === 'FREE' &&
  //       //   subscription.status === 'ACTIVE' &&
  //       //   subscription.isTrial === true &&
  //       //   user.isEmailVerified === true &&
  //       //   setup.firstTimeSetup === true
  //       // ) {
  //       //   if (__DEV__) {
  //       //     console.log('🔄 Auto-populating trial user lists...');
  //       //   }
  //       //   // Call ensureTrialUserLists in background (don't block navigation)
  //       //   services.onboarding
  //       //     .ensureTrialUserLists(user.id, subscription, user, setup)
  //       //     .then(result => {
  //       //       if (result.success) {
  //       //         if (__DEV__) {
  //       //           console.log('✅ Trial user lists auto-populated');
  //       //         }
  //       //       } else {
  //       //         if (__DEV__) {
  //       //           console.warn(
  //       //             '⚠️ Failed to auto-populate trial user lists:',
  //       //             result.error.userMessage,
  //       //           );
  //       //         }
  //       //       }
  //       //     })
  //       //     .catch(err => {
  //       //       if (__DEV__) {
  //       //         console.error('❌ Error auto-populating trial user lists:', err);
  //       //       }
  //       //     });
  //       // }

  //       if (__DEV__) {
  //         console.log('✅ Successfully fetched user data:', {
  //           plan: subscription.plan,
  //           status: subscription.status,
  //           firstTimeSetup: setup.firstTimeSetup,
  //           showOnboarding: setup.showOnboarding,
  //         });
  //       }

  //       // Evaluate routing rules
  //       const routingDecision = await evaluateRoutingRules(user, subscription, setup);

  //       if (!isMountedRef.current) return;

  //       if (routingDecision) {
  //         const targetGroup = getRouteGroup(routingDecision.route);
  //         const currentGroup = navState.inAuthGroup
  //           ? NavigationRouteGroup.AUTH
  //           : navState.inOnboardingGroup
  //             ? NavigationRouteGroup.ONBOARDING
  //             : navState.inSetupGroup
  //               ? NavigationRouteGroup.SETUP
  //               : navState.inPaymentGroup
  //                 ? NavigationRouteGroup.PAYMENT
  //                 : navState.inSubscriptionGroup
  //                   ? NavigationRouteGroup.SUBSCRIPTION
  //                   : navState.inProjects
  //                     ? NavigationRouteGroup.PROJECTS
  //                     : navState.inDashboard
  //                       ? NavigationRouteGroup.DASHBOARD
  //                       : NavigationRouteGroup.AUTH; // Default fallback

  //         // Check if already at target route (prevent infinite loops)
  //         const alreadyAtTarget = pathname.includes(routingDecision.route);

  //         // ✅ FIX: Allow sub-routes within the target group
  //         // If target is SETUP_INDEX and we're in setup group, allow all setup sub-routes
  //         const isInTargetGroup =
  //           (targetGroup === NavigationRouteGroup.SETUP && navState.inSetupGroup) ||
  //           (targetGroup === NavigationRouteGroup.ONBOARDING && navState.inOnboardingGroup) ||
  //           (targetGroup === NavigationRouteGroup.PAYMENT && navState.inPaymentGroup) ||
  //           (targetGroup === NavigationRouteGroup.PROJECTS && navState.inProjects) ||
  //           (targetGroup === NavigationRouteGroup.DASHBOARD && navState.inDashboard);

  //         // Only navigate if we're not already in the target group or at the target route
  //         if (targetGroup !== currentGroup && !alreadyAtTarget && !isInTargetGroup) {
  //           if (__DEV__) {
  //             console.log(`🚀 Navigating from ${currentGroup} to ${targetGroup}`);
  //           }
  //           navigationAttemptedRef.current = true;

  //           if (routingDecision.params) {
  //             router.replace({
  //               pathname: routingDecision.route as unknown as RelativePathString,
  //               params: routingDecision.params as UnknownInputParams,
  //             });
  //           } else {
  //             router.replace(routingDecision.route as unknown as RelativePathString);
  //           }

  //           onNavigate?.(routingDecision.route);
  //         } else {
  //           if (__DEV__) {
  //             console.log(`✅ Already at target route or in correct group: ${currentGroup}`);
  //           }
  //         }
  //       }

  //       // Update navigation state
  //       const updatedNavState = buildNavigationState();
  //       setState(success(updatedNavState));
  //     } catch (error) {
  //       if (!isMountedRef.current) return;

  //       const context = ErrorContextBuilder.fromHook(
  //         'useNavigationGuard',
  //         'handleNavigation',
  //         user?.id,
  //       );
  //       const appError =
  //         error !== null && typeof error === 'object' && 'code' in error && 'userMessage' in error
  //           ? (error as AppError)
  //           : ErrorMapper.createGenericError(
  //               ErrorCode.NAVIGATION_ERROR,
  //               'Navigation error',
  //               'Failed to determine navigation route',
  //               ErrorContextBuilder.toString(context),
  //               error,
  //               false,
  //             );

  //       if (__DEV__) {
  //         console.error('❌ Navigation guard error:', appError.userMessage);
  //       }
  //       setState(errorState(appError, navState));
  //       handleError(appError, context);
  //       onError?.(appError);

  //       // Fallback to projects
  //       if (user && !navState.inProjects && !navState.inDashboard) {
  //         if (__DEV__) {
  //           console.log('🔄 Error fallback: navigating to projects');
  //         }
  //         router.replace(NavigationRoute.PROJECTS_INDEX);
  //         onNavigate?.(NavigationRoute.PROJECTS_INDEX);
  //       }
  //     } finally {
  //       isFetchingRef.current = false;
  //       // Reset navigation attempt flag after a delay
  //       setTimeout(() => {
  //         navigationAttemptedRef.current = false;
  //       }, 500);
  //     }
  //   },
  //   [
  //     router,
  //     userSubscription,
  //     userSetup,
  //     services,
  //     evaluateRoutingRules,
  //     buildNavigationState,
  //     handleError,
  //     onNavigate,
  //     onError,
  //   ],
  // );

  // Main effect - runs when user or segments change

  const handleNavigation = useCallback(
    async (user: BaseUser | null, navState: NavigationState) => {
      if (!isMountedRef.current) return;

      // Prevent duplicate fetches
      if (isFetchingRef.current) {
        if (__DEV__) {
          console.log('⏸️ Navigation guard: Already fetching, skipping duplicate call');
        }
        return;
      }

      // Handle unauthenticated users
      if (!user) {
        if (!navState.inAuthGroup && !navigationAttemptedRef.current) {
          navigationAttemptedRef.current = true;
          router.push(NavigationRoute.WELCOME);
        }
        return;
      }

      // Prevent duplicate navigation attempts
      if (navigationAttemptedRef.current) {
        return;
      }

      // Allow users to stay in payment group - don't redirect them away
      if (navState.inPaymentGroup) {
        if (__DEV__) {
          console.log('✅ User in payment flow - allowing to stay');
        }
        setState(success(navState));
        return;
      }

      // ---------------------------------------------------------------------------
      // ✅ FIX: FLICKER PREVENTION
      // Determine if we are navigating within the same functional group.
      // If we are, we suppress the loading state change to prevent UI flickering.
      // ---------------------------------------------------------------------------
      const isIntraGroupNavigation =
        (navState.inSetupGroup && segments[0] === '(setup)') ||
        // (navState.inDashboard && segments[0] === '(dashboard)') ||
        (navState.inProjects && segments[0] === '(projects)');

      // Only set loading state if we are transitioning BETWEEN major groups
      if (!isIntraGroupNavigation) {
        setState(loading());
      }

      isFetchingRef.current = true;

      try {
        // Only log if not an intra-group nav to reduce console noise
        if (!isIntraGroupNavigation && __DEV__) {
          console.log('🔍 Navigation guard: Fetching subscription and setup data...');
        }

        // Fetch subscription and setup data with retry logic (exponential backoff)
        const [subResult, setupResult] = await Promise.all([
          withRetry(() => userSubscription.getByUserId(user.id), {
            maxAttempts: 5,
            delayMs: 500,
            exponential: true,
            // Only log retries
            onRetry: (attempt, error) => {
              if (__DEV__)
                console.log(`⏳ Retry ${attempt}/5 fetching subscription: ${error.userMessage}`);
            },
          }),
          withRetry(() => userSetup.getByUserId(user.id), {
            maxAttempts: 5,
            delayMs: 500,
            exponential: true,
            // Only log retries
            onRetry: (attempt, error) => {
              if (__DEV__)
                console.log(`⏳ Retry ${attempt}/5 fetching setup: ${error.userMessage}`);
            },
          }),
        ]);

        if (!isMountedRef.current) return;

        // Handle errors - fallback to projects
        if (!subResult.success || !setupResult.success) {
          const context = ErrorContextBuilder.fromHook(
            'useNavigationGuard',
            'handleNavigation',
            user.id,
          );
          const error = !subResult.success
            ? (subResult as { success: false; error: AppError }).error
            : (setupResult as { success: false; error: AppError }).error;

          if (__DEV__) {
            console.error('❌ Failed to fetch user data after retries:', error.userMessage);
          }
          handleError(error, context);
          onError?.(error);

          // Fallback to projects
          if (!navState.inProjects && !navState.inDashboard) {
            if (__DEV__) {
              console.log('🔄 Falling back to projects index');
            }
            navigationAttemptedRef.current = true;
            router.replace(NavigationRoute.PROJECTS_INDEX);
            onNavigate?.(NavigationRoute.PROJECTS_INDEX);
          }
          setState(success(navState));
          return;
        }

        const subscription = subResult.value;
        const setup = setupResult.value;

        // Auto-populate trial user lists (Fire and forget)
        services.onboarding
          .ensureTrialUserLists(user.id, subscription, user, setup)
          .then(result => {
            if (result.success && __DEV__) {
              // console.log('✅ Trial user lists auto-populated');
            }
          })
          .catch(err => {
            if (__DEV__) {
              console.error('❌ Error auto-populating trial user lists:', err);
            }
          });

        if (!isIntraGroupNavigation && __DEV__) {
          console.log('✅ Successfully fetched user data:', {
            plan: subscription.plan,
            status: subscription.status,
            firstTimeSetup: setup.firstTimeSetup,
            showOnboarding: setup.showOnboarding,
          });
        }

        // Evaluate routing rules
        const routingDecision = await evaluateRoutingRules(user, subscription, setup);

        if (!isMountedRef.current) return;

        if (routingDecision) {
          const targetGroup = getRouteGroup(routingDecision.route);
          const currentGroup = navState.inAuthGroup
            ? NavigationRouteGroup.AUTH
            : navState.inOnboardingGroup
              ? NavigationRouteGroup.ONBOARDING
              : navState.inSetupGroup
                ? NavigationRouteGroup.SETUP
                : navState.inPaymentGroup
                  ? NavigationRouteGroup.PAYMENT
                  : navState.inSubscriptionGroup
                    ? NavigationRouteGroup.SUBSCRIPTION
                    : navState.inProjects
                      ? NavigationRouteGroup.PROJECTS
                      : navState.inDashboard
                        ? NavigationRouteGroup.DASHBOARD
                        : NavigationRouteGroup.AUTH; // Default fallback

          // Check if already at target route (prevent infinite loops)
          const alreadyAtTarget = pathname.includes(routingDecision.route);

          // Allow sub-routes within the target group
          const isInTargetGroup =
            (targetGroup === NavigationRouteGroup.SETUP && navState.inSetupGroup) ||
            (targetGroup === NavigationRouteGroup.ONBOARDING && navState.inOnboardingGroup) ||
            (targetGroup === NavigationRouteGroup.PAYMENT && navState.inPaymentGroup) ||
            (targetGroup === NavigationRouteGroup.PROJECTS && navState.inProjects) ||
            (targetGroup === NavigationRouteGroup.DASHBOARD && navState.inDashboard);

          // Only navigate if we're not already in the target group or at the target route
          if (targetGroup !== currentGroup && !alreadyAtTarget && !isInTargetGroup) {
            if (__DEV__) {
              console.log(`🚀 Navigating from ${currentGroup} to ${targetGroup}`);
            }
            navigationAttemptedRef.current = true;

            if (routingDecision.params) {
              router.replace({
                pathname: routingDecision.route as unknown as RelativePathString,
                params: routingDecision.params as UnknownInputParams,
              });
            } else {
              router.replace(routingDecision.route as unknown as RelativePathString);
            }

            onNavigate?.(routingDecision.route);
          } else {
            if (!isIntraGroupNavigation && __DEV__) {
              console.log(`✅ Already at target route or in correct group: ${currentGroup}`);
            }
          }
        }

        // Update navigation state
        const updatedNavState = buildNavigationState();
        setState(success(updatedNavState));
      } catch (error) {
        if (!isMountedRef.current) return;

        const context = ErrorContextBuilder.fromHook(
          'useNavigationGuard',
          'handleNavigation',
          user?.id,
        );
        const appError =
          error !== null && typeof error === 'object' && 'code' in error && 'userMessage' in error
            ? (error as AppError)
            : ErrorMapper.createGenericError(
                ErrorCode.NAVIGATION_ERROR,
                'Navigation error',
                'Failed to determine navigation route',
                ErrorContextBuilder.toString(context),
                error,
                false,
              );

        if (__DEV__) {
          console.error('❌ Navigation guard error:', appError.userMessage);
        }
        setState(errorState(appError, navState));
        handleError(appError, context);
        onError?.(appError);

        // Fallback to projects
        if (user && !navState.inProjects && !navState.inDashboard) {
          if (__DEV__) {
            console.log('🔄 Error fallback: navigating to projects');
          }
          router.replace(NavigationRoute.PROJECTS_INDEX);
          onNavigate?.(NavigationRoute.PROJECTS_INDEX);
        }
      } finally {
        isFetchingRef.current = false;
        // Reset navigation attempt flag after a delay
        setTimeout(() => {
          navigationAttemptedRef.current = false;
        }, 500);
      }
    },
    [
      router,
      userSubscription,
      userSetup,
      services,
      evaluateRoutingRules,
      buildNavigationState,
      handleError,
      onNavigate,
      onError,
    ],
  );
  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Wait for auth initialization
    if (authLoading) {
      return;
    }

    const navState = buildNavigationState();
    setState(success(navState));

    // Handle navigation
    handleNavigation(user, navState);
  }, [enabled, authLoading, user, segments, handleNavigation, buildNavigationState]);

  // Reset navigation attempt flag when entering target groups
  useEffect(() => {
    const navState = buildNavigationState();
    if (
      navState.inAuthGroup ||
      navState.inOnboardingGroup ||
      navState.inSetupGroup ||
      navState.inProjects ||
      navState.inDashboard
    ) {
      navigationAttemptedRef.current = false;
    }
  }, [segments, buildNavigationState]);

  return {
    navigationState: state.status === 'success' ? state.data : null,
    loading: state.status === 'loading' || authLoading,
    error: state.status === 'error' ? state.error : null,
    isInitialized: !authLoading,
  };
}
