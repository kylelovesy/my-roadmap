/*---------------------------------------
File: src/constants/navigation.ts
Description: Navigation constants, route enums, and configurable routing rules
Author: Kyle Lovesy
Date: 2025-01-XX
Version: 1.0.0
---------------------------------------*/

import { BaseUser, UserSubscription, UserSetup } from '@/domain/user/user.schema';
import { SubscriptionPlan, SubscriptionStatus } from '@/constants/enums';
import { SubPage } from '@/domain/navigation/navigation.schema';
import { RoutingRule, SessionFlags } from '@/domain/navigation/navigation.schema';
import { isExpiringDay } from '@/constants/subscriptions';

/**
 * ============================================================================
 * NAVIGATION ROUTE GROUPS
 * ============================================================================
 */

export enum NavigationRouteGroup {
  AUTH = 'auth',
  ONBOARDING = 'onboarding',
  SETUP = 'setup',
  PAYMENT = 'payment',
  SUBSCRIPTION = 'subscription',
  PROJECTS = 'projects',
  DASHBOARD = 'dashboard',
}

/**
 * ============================================================================
 * NAVIGATION ROUTES
 * ============================================================================
 */

export enum NavigationRoute {
  // Auth routes
  WELCOME = '/(auth)/welcome',
  SIGN_IN = '/(auth)/signIn',
  REGISTER = '/(auth)/register',
  RESET_PASSWORD = '/(auth)/resetPassword',
  RESET_PASSWORD_CONFIRM = '/(auth)/resetPasswordConfirm',
  VERIFY_EMAIL = '/(auth)/emailVerification',
  SUBSCRIPTION_GATE = '/(auth)/subscriptionGate',
  TERMS_OF_SERVICE = '/(auth)/termsOfService',
  PRIVACY_POLICY = '/(auth)/privacyPolicy',

  // Onboarding routes
  ONBOARDING_FREE = '/(onboarding)/freeSubscription',
  ONBOARDING_PAID = '/(onboarding)/paidSubscription',
  ONBOARDING_EXPIRING = '/(onboarding)/expiringSubscription',

  // Setup routes
  SETUP_INDEX = '/(setup)',
  SETUP_KIT = '/(setup)/kit',
  SETUP_TASKS = '/(setup)/tasks',
  SETUP_GROUP_SHOTS = '/(setup)/groupShots',
  SETUP_COUPLE_SHOTS = '/(setup)/coupleShots',

  // Payment routes
  PAYMENT_INDEX = '/(payment)',
  // PAYMENT_UPDATE = '/(payment)/update',

  // Subscription routes
  SUBSCRIPTION_PRICING = '/(subscription)/pricing',

  // Projects routes
  PROJECTS_INDEX = '/(projects)',
  // ACCOUNT_ADMIN = '/(projects)/manageProjects',

  // Dashboard base routes
  DASHBOARD_HOME = '/(dashboard)/(home)',
  DASHBOARD_TIMELINE = '/(dashboard)/(timeline)',
  DASHBOARD_SHOTS = '/(dashboard)/(shots)',
  DASHBOARD_TOOLS = '/(dashboard)/(tools)',
  DASHBOARD_SETTINGS = '/(dashboard)/(settings)',

  // Dashboard sub-routes
  DASHBOARD_HOME_LOCATIONS = '/(dashboard)/(home)/locations',
  DASHBOARD_HOME_KEY_PEOPLE = '/(dashboard)/(home)/keyPeople',
  DASHBOARD_HOME_NOTES = '/(dashboard)/(home)/notes',

  DASHBOARD_SHOTS_REQUESTED = '/(dashboard)/(shots)/requested',
  DASHBOARD_SHOTS_KIT_LIST = '/(dashboard)/(shots)/kitList',
  DASHBOARD_SHOTS_TASK_LIST = '/(dashboard)/(shots)/taskList',

  DASHBOARD_TOOLS_GUIDES = '/(dashboard)/(tools)/guides',
  DASHBOARD_TOOLS_TAGS = '/(dashboard)/(tools)/tags',
  DASHBOARD_TOOLS_VENDORS = '/(dashboard)/(tools)/vendors',
  DASHBOARD_TOOLS_QR_CARD = '/(dashboard)/(tools)/qrCard',

  DASHBOARD_SETTINGS_PROJECT_SETTINGS = '/(dashboard)/(settings)/projectSettings',
  DASHBOARD_SETTINGS_MANAGE_DATA = '/(dashboard)/(settings)/manageData',
  DASHBOARD_SETTINGS_MANAGE_PROJECTS = '/(dashboard)/(settings)/manageProjects',
  DASHBOARD_SETTINGS_MY_ACCOUNT = '/(dashboard)/(settings)/myAccount',
}

/**
 * ============================================================================
 * ROUTE CONFIGURATION
 * ============================================================================
 * Maps routes to their route groups
 */

export const ROUTE_CONFIG: Record<NavigationRoute, NavigationRouteGroup> = {
  [NavigationRoute.WELCOME]: NavigationRouteGroup.AUTH,
  [NavigationRoute.SIGN_IN]: NavigationRouteGroup.AUTH,
  [NavigationRoute.REGISTER]: NavigationRouteGroup.AUTH,
  [NavigationRoute.RESET_PASSWORD]: NavigationRouteGroup.AUTH,
  [NavigationRoute.RESET_PASSWORD_CONFIRM]: NavigationRouteGroup.AUTH,
  [NavigationRoute.VERIFY_EMAIL]: NavigationRouteGroup.AUTH,
  [NavigationRoute.SUBSCRIPTION_GATE]: NavigationRouteGroup.AUTH,
  [NavigationRoute.TERMS_OF_SERVICE]: NavigationRouteGroup.AUTH,
  [NavigationRoute.PRIVACY_POLICY]: NavigationRouteGroup.AUTH,

  [NavigationRoute.ONBOARDING_FREE]: NavigationRouteGroup.ONBOARDING,
  [NavigationRoute.ONBOARDING_PAID]: NavigationRouteGroup.ONBOARDING,
  [NavigationRoute.ONBOARDING_EXPIRING]: NavigationRouteGroup.ONBOARDING,

  [NavigationRoute.SETUP_INDEX]: NavigationRouteGroup.SETUP,
  [NavigationRoute.SETUP_KIT]: NavigationRouteGroup.SETUP,
  [NavigationRoute.SETUP_TASKS]: NavigationRouteGroup.SETUP,
  [NavigationRoute.SETUP_GROUP_SHOTS]: NavigationRouteGroup.SETUP,
  [NavigationRoute.SETUP_COUPLE_SHOTS]: NavigationRouteGroup.SETUP,

  [NavigationRoute.PAYMENT_INDEX]: NavigationRouteGroup.PAYMENT,
  // [NavigationRoute.PAYMENT_UPDATE]: NavigationRouteGroup.PAYMENT,

  [NavigationRoute.SUBSCRIPTION_PRICING]: NavigationRouteGroup.SUBSCRIPTION,

  [NavigationRoute.PROJECTS_INDEX]: NavigationRouteGroup.PROJECTS,

  [NavigationRoute.DASHBOARD_HOME]: NavigationRouteGroup.DASHBOARD,
  [NavigationRoute.DASHBOARD_TIMELINE]: NavigationRouteGroup.DASHBOARD,
  [NavigationRoute.DASHBOARD_SHOTS]: NavigationRouteGroup.DASHBOARD,
  [NavigationRoute.DASHBOARD_TOOLS]: NavigationRouteGroup.DASHBOARD,
  [NavigationRoute.DASHBOARD_SETTINGS]: NavigationRouteGroup.DASHBOARD,
  [NavigationRoute.DASHBOARD_HOME_LOCATIONS]: NavigationRouteGroup.DASHBOARD,
  [NavigationRoute.DASHBOARD_HOME_KEY_PEOPLE]: NavigationRouteGroup.DASHBOARD,
  [NavigationRoute.DASHBOARD_HOME_NOTES]: NavigationRouteGroup.DASHBOARD,
  [NavigationRoute.DASHBOARD_SHOTS_REQUESTED]: NavigationRouteGroup.DASHBOARD,
  [NavigationRoute.DASHBOARD_SHOTS_KIT_LIST]: NavigationRouteGroup.DASHBOARD,
  [NavigationRoute.DASHBOARD_SHOTS_TASK_LIST]: NavigationRouteGroup.DASHBOARD,
  [NavigationRoute.DASHBOARD_TOOLS_GUIDES]: NavigationRouteGroup.DASHBOARD,
  [NavigationRoute.DASHBOARD_TOOLS_TAGS]: NavigationRouteGroup.DASHBOARD,
  [NavigationRoute.DASHBOARD_TOOLS_VENDORS]: NavigationRouteGroup.DASHBOARD,
  [NavigationRoute.DASHBOARD_TOOLS_QR_CARD]: NavigationRouteGroup.DASHBOARD,
  [NavigationRoute.DASHBOARD_SETTINGS_PROJECT_SETTINGS]: NavigationRouteGroup.DASHBOARD,
  [NavigationRoute.DASHBOARD_SETTINGS_MANAGE_DATA]: NavigationRouteGroup.DASHBOARD,
  [NavigationRoute.DASHBOARD_SETTINGS_MANAGE_PROJECTS]: NavigationRouteGroup.DASHBOARD,
  [NavigationRoute.DASHBOARD_SETTINGS_MY_ACCOUNT]: NavigationRouteGroup.DASHBOARD,
};

export const ROUTING_RULES: RoutingRule[] = [
  // Priority 101: Email verification (MUST be higher than subscription checks to show first)
  // Blocks all navigation for unverified users unless they have explicitly skipped it.
  {
    id: 'email-verification',
    name: 'Email Verification Required',
    priority: 101,
    condition: (user, _subscription, setup, _sessionFlags, currentRoute, _activeProjectId) =>
      !!user &&
      !user.isEmailVerified &&
      !(setup?.skippedEmailVerification === true) &&
      // Don't redirect if already on verification screen (prevent loop)
      currentRoute !== NavigationRoute.VERIFY_EMAIL,
    targetRoute: NavigationRoute.VERIFY_EMAIL,
    description: 'Unverified users must verify email first (unless skipped)',
  },

  // Priority 100: Payment email verification gate
  // Catches users who skipped verification (bypassing rule 101) but now try to access payment features.
  {
    id: 'payment-verification-gate',
    name: 'Payment Email Verification Gate',
    priority: 100,
    condition: (user, _subscription, _setup, _sessionFlags, currentRoute, _activeProjectId) =>
      !!user && !user.isEmailVerified && currentRoute.startsWith('/(payment)'),
    targetRoute: NavigationRoute.VERIFY_EMAIL,
    description: 'Payment routes require email verification',
  },

  // Priority 99: No plan pricing
  // Forces users with no plan to select one.
  {
    id: 'no-plan-pricing',
    name: 'No Plan Pricing',
    priority: 99,
    condition: (user, subscription, setup, _sessionFlags, _currentRoute, _activeProjectId) =>
      !!user &&
      !!subscription &&
      (subscription.plan === SubscriptionPlan.NONE ||
        subscription.status === SubscriptionStatus.NONE) &&
      !!setup &&
      setup.firstTimeSetup === true,
    targetRoute: NavigationRoute.SUBSCRIPTION_PRICING,
    description: 'Users without a plan must select one',
  },

  // Priority 98: Newly registered users - route to pricing to select plan
  {
    id: 'newly-registered-pricing',
    name: 'Newly Registered Pricing',
    priority: 98,
    condition: (user, subscription, setup, _sessionFlags, _currentRoute, _activeProjectId) =>
      !!user &&
      !!subscription &&
      subscription.status === SubscriptionStatus.INACTIVE &&
      !!setup &&
      setup.firstTimeSetup === true,
    targetRoute: NavigationRoute.SUBSCRIPTION_PRICING,
    description: 'Newly registered users must select a plan',
  },

  // // Priority 90: Subscription expiry warning
  // // Shows warning on specific days [14, 10, 5, 3, 1] before expiry.
  // {
  //   id: 'subscription-expiry-warning',
  //   name: 'Subscription Expiry Warning',
  //   priority: 90,
  //   condition: (user, subscription, _setup, sessionFlags, _currentRoute, _activeProjectId) => {
  //     if (
  //       !user ||
  //       !subscription ||
  //       subscription.plan === SubscriptionPlan.FREE ||
  //       subscription.autoRenew === true ||
  //       !subscription.endDate ||
  //       sessionFlags.hasSeenExpiryWarning
  //     ) {
  //       return false;
  //     }
  //     // Checks against [14, 10, 5, 3, 1] defined in subscriptions.ts
  //     return isExpiringDay(subscription.endDate);
  //   },
  //   targetRoute: NavigationRoute.ONBOARDING_EXPIRING,
  //   onMatch: () => ({ hasSeenExpiryWarning: true }),
  //   description: 'Show expiry warning on specific days',
  // },
  // Priority 90: Subscription expiry warning
  // Shows warning on specific days [14, 10, 5, 3, 1] before expiry.
  {
    id: 'subscription-expiry-warning',
    name: 'Subscription Expiry Warning',
    priority: 90,
    condition: (user, subscription, _setup, sessionFlags, currentRoute, _activeProjectId) => {
      if (
        !user ||
        !subscription ||
        subscription.plan === SubscriptionPlan.FREE ||
        subscription.autoRenew === true ||
        !subscription.endDate ||
        sessionFlags.hasSeenExpiryWarning
      ) {
        return false;
      }
      // ✅ ADD: Allow navigation to pricing/payment routes even during expiry warning
      if (
        currentRoute === NavigationRoute.SUBSCRIPTION_PRICING ||
        currentRoute.startsWith('/(payment)')
      ) {
        return false;
      }
      // Checks against [14, 10, 5, 3, 1] defined in subscriptions.ts
      return isExpiringDay(subscription.endDate);
    },
    targetRoute: NavigationRoute.ONBOARDING_EXPIRING,
    onMatch: () => ({ hasSeenExpiryWarning: true }),
    description: 'Show expiry warning on specific days (except when accessing pricing/payment)',
  },
  // Priority 80: INACTIVE subscription - route to payment
  {
    id: 'inactive-subscription',
    name: 'Inactive Subscription',
    priority: 80,
    condition: (_user, subscription, _setup, _sessionFlags, _currentRoute, _activeProjectId) =>
      !!subscription && subscription.status === SubscriptionStatus.INACTIVE,
    targetRoute: NavigationRoute.PAYMENT_INDEX,
    description: 'Inactive subscriptions need payment',
  },

  // Priority 75: PAST_DUE subscription - route to payment update
  {
    id: 'past-due-subscription',
    name: 'Past Due Subscription',
    priority: 75,
    condition: (_user, subscription, _setup, _sessionFlags, _currentRoute, _activeProjectId) =>
      !!subscription && subscription.status === SubscriptionStatus.PAST_DUE,
    targetRoute: NavigationRoute.PAYMENT_INDEX,
    params: { mode: 'update' },
    description: 'Past due subscriptions need payment update',
  },
  // Priority 70: CANCELLED subscription - route to subscription gate
  {
    id: 'cancelled-subscription',
    name: 'Cancelled Subscription',
    priority: 70,
    condition: (_user, subscription, _setup, _sessionFlags, currentRoute, _activeProjectId) =>
      !!subscription &&
      subscription.status === SubscriptionStatus.CANCELLED &&
      // ✅ ADD: Allow navigation to pricing/payment routes even with cancelled subscription
      currentRoute !== NavigationRoute.SUBSCRIPTION_PRICING &&
      !currentRoute.startsWith('/(payment)'),
    targetRoute: NavigationRoute.SUBSCRIPTION_GATE,
    description:
      'Cancelled subscriptions need reactivation (except when accessing pricing/payment)',
  },
  // Priority 70: CANCELLED subscription - route to subscription gate
  // {
  //   id: 'cancelled-subscription',
  //   name: 'Cancelled Subscription',
  //   priority: 70,
  //   condition: (_user, subscription, _setup, _sessionFlags, _currentRoute, _activeProjectId) =>
  //     !!subscription && subscription.status === SubscriptionStatus.CANCELLED,
  //   targetRoute: NavigationRoute.SUBSCRIPTION_GATE,
  //   description: 'Cancelled subscriptions need reactivation',
  // },

  // Priority 65: Free plan onboarding with session flag
  // Ensures Free users see onboarding once per session.
  // {
  //   id: 'free-plan-onboarding',
  //   name: 'Free User Welcome',
  //   priority: 65,
  //   condition: (user, subscription, _setup, sessionFlags, _currentRoute, _activeProjectId) =>
  //     !!user &&
  //     !!subscription &&
  //     subscription.plan === SubscriptionPlan.FREE &&
  //     !sessionFlags.hasSeenFreeWelcome,
  //   targetRoute: NavigationRoute.ONBOARDING_FREE,
  //   onMatch: () => ({ hasSeenFreeWelcome: true }),
  //   description: 'Free users see onboarding every launch (session flag)',
  // },
  // Priority 65: Free plan onboarding with session flag
  // Ensures Free users see onboarding once per session.
  {
    id: 'free-plan-onboarding',
    name: 'Free User Welcome',
    priority: 65,
    condition: (user, subscription, _setup, sessionFlags, currentRoute, _activeProjectId) =>
      !!user &&
      !!subscription &&
      subscription.plan === SubscriptionPlan.FREE &&
      !sessionFlags.hasSeenFreeWelcome &&
      // ✅ ADD: Allow navigation to pricing/payment routes even during onboarding
      currentRoute !== NavigationRoute.SUBSCRIPTION_PRICING &&
      !currentRoute.startsWith('/(payment)'),
    targetRoute: NavigationRoute.ONBOARDING_FREE,
    onMatch: () => ({ hasSeenFreeWelcome: true }),
    description: 'Free users see onboarding every launch (except when accessing pricing/payment)',
  },

  // Priority 62: Active Onboarding (Paid) - [UPDATED PRIORITY]
  // Moved UP from 40 to 62.
  // Ensures Paid users see Onboarding BEFORE they are sent to the Setup Wizard (Priority 60).
  {
    id: 'active-onboarding',
    name: 'Active Onboarding',
    priority: 62,
    condition: (_user, subscription, setup, _sessionFlags, currentRoute, _activeProjectId) =>
      !!subscription &&
      subscription.status === SubscriptionStatus.ACTIVE &&
      // ✅ Only redirect paid plans (BASIC, PRO, STUDIO) - exclude FREE
      (subscription.plan === SubscriptionPlan.BASIC ||
        subscription.plan === SubscriptionPlan.PRO ||
        subscription.plan === SubscriptionPlan.STUDIO) &&
      !!setup &&
      setup.showOnboarding === true &&
      // Allow navigation to pricing/payment routes even during onboarding
      currentRoute !== NavigationRoute.SUBSCRIPTION_PRICING &&
      !currentRoute.startsWith('/(payment)'),
    targetRoute: NavigationRoute.ONBOARDING_PAID,
    description:
      'Active paid users see paid onboarding first (except when accessing pricing/payment)',
  },

  // Priority 60: Active First Time Setup
  // Runs AFTER Onboarding is complete (showOnboarding: false).
  // Explicitly checks user.isEmailVerified to skip setup for unverified users (Req #14).
  // {
  //   id: 'active-first-time-setup',
  //   name: 'Active First Time Setup',
  //   priority: 60,
  //   condition: (user, subscription, setup, _sessionFlags, currentRoute, _activeProjectId) =>
  //     !!user &&
  //     user.isEmailVerified &&
  //     !!subscription &&
  //     subscription.status === SubscriptionStatus.ACTIVE &&
  //     !!setup &&
  //     setup.firstTimeSetup === true &&
  //     // ✅ ADD THIS: Allow navigation to pricing/payment routes even during setup
  //     currentRoute !== NavigationRoute.SUBSCRIPTION_PRICING &&
  //     !currentRoute.startsWith('/(payment)'),
  //   targetRoute: NavigationRoute.SETUP_INDEX,
  //   description:
  //     'Verified users with active subscription go through setup wizard (except when accessing pricing/payment)',
  // },

  // Priority 50: Dashboard project guard
  // Prevents access to dashboard sub-pages without a selected project.
  {
    id: 'dashboard-project-guard',
    name: 'Dashboard Project Guard',
    priority: 50,
    condition: (_user, _subscription, _setup, _sessionFlags, currentRoute, activeProjectId) =>
      currentRoute.startsWith('/(dashboard)') && !activeProjectId,
    targetRoute: NavigationRoute.PROJECTS_INDEX,
    description: 'Dashboard requires active project selection',
  },

  // Priority 50: Trial (isTrial=true + ACTIVE) + showOnboarding - route to trial onboarding
  {
    id: 'trialing-onboarding',
    name: 'Trialing Onboarding',
    priority: 50,
    condition: (_user, subscription, setup, _sessionFlags, currentRoute, _activeProjectId) =>
      !!subscription &&
      subscription.isTrial === true &&
      subscription.status === SubscriptionStatus.ACTIVE &&
      !!setup &&
      setup.showOnboarding === true &&
      // Allow navigation to pricing/payment routes even during onboarding
      currentRoute !== NavigationRoute.SUBSCRIPTION_PRICING &&
      !currentRoute.startsWith('/(payment)'),
    targetRoute: NavigationRoute.ONBOARDING_FREE,
    description: 'Trialing users see free onboarding (except when accessing pricing/payment)',
  },

  // Priority 10: Default - route to projects (lowest priority)
  // Catch-all for fully onboarded, verified, active users.
  {
    id: 'default-projects',
    name: 'Default Projects',
    priority: 10,
    condition: (_user, _subscription, _setup, _sessionFlags, _currentRoute, _activeProjectId) =>
      true,
    targetRoute: NavigationRoute.PROJECTS_INDEX,
    description: 'Default route for all other users',
  },
];

// export const ROUTING_RULES: RoutingRule[] = [
//   // Priority 100: Payment email verification gate (NEW)
//   {
//     id: 'payment-verification-gate',
//     name: 'Payment Email Verification Gate',
//     priority: 100,
//     condition: (user, _subscription, _setup, _sessionFlags, currentRoute, _activeProjectId) =>
//       !!user && !user.isEmailVerified && currentRoute.startsWith('/(payment)'),
//     targetRoute: NavigationRoute.VERIFY_EMAIL,
//     description: 'Payment routes require email verification',
//   },

//   // Priority 90: Subscription expiry warning (NEW)
//   {
//     id: 'subscription-expiry-warning',
//     name: 'Subscription Expiry Warning',
//     priority: 90,
//     condition: (user, subscription, _setup, sessionFlags, _currentRoute, _activeProjectId) => {
//       if (
//         !user ||
//         !subscription ||
//         subscription.plan === SubscriptionPlan.FREE ||
//         subscription.autoRenew === true ||
//         !subscription.endDate ||
//         sessionFlags.hasSeenExpiryWarning
//       ) {
//         return false;
//       }
//       return isExpiringDay(subscription.endDate);
//     },
//     targetRoute: NavigationRoute.ONBOARDING_EXPIRING,
//     onMatch: () => ({ hasSeenExpiryWarning: true }),
//     description: 'Show expiry warning on specific days [14,10,7,3,2,1]',
//   },

//   // Priority 101: Email verification (MUST be higher than subscription checks to show first)
//   {
//     id: 'email-verification',
//     name: 'Email Verification Required',
//     priority: 101,
//     condition: (user, _subscription, setup, _sessionFlags, currentRoute, _activeProjectId) =>
//       !!user &&
//       !user.isEmailVerified &&
//       !(setup?.skippedEmailVerification === true) &&
//       // Don't redirect if already on verification screen (prevent loop)
//       currentRoute !== NavigationRoute.VERIFY_EMAIL,
//     targetRoute: NavigationRoute.VERIFY_EMAIL,
//     description: 'Unverified users must verify email first (unless skipped)',
//   },

//   // Priority 99: No plan pricing
//   {
//     id: 'no-plan-pricing',
//     name: 'No Plan Pricing',
//     priority: 99,
//     condition: (user, subscription, setup, _sessionFlags, _currentRoute, _activeProjectId) =>
//       !!user &&
//       !!subscription &&
//       (subscription.plan === SubscriptionPlan.NONE ||
//         subscription.status === SubscriptionStatus.NONE) &&
//       !!setup &&
//       setup.firstTimeSetup === true,
//     targetRoute: NavigationRoute.SUBSCRIPTION_PRICING,
//     description: 'Users without a plan must select one',
//   },

//   // Priority 98: Newly registered users - route to pricing to select plan
//   {
//     id: 'newly-registered-pricing',
//     name: 'Newly Registered Pricing',
//     priority: 98,
//     condition: (user, subscription, setup, _sessionFlags, _currentRoute, _activeProjectId) =>
//       !!user &&
//       !!subscription &&
//       subscription.status === SubscriptionStatus.INACTIVE &&
//       !!setup &&
//       setup.firstTimeSetup === true,
//     targetRoute: NavigationRoute.SUBSCRIPTION_PRICING,
//     description: 'Newly registered users must select a plan',
//   },

//   // Priority 80: INACTIVE subscription - route to payment
//   {
//     id: 'inactive-subscription',
//     name: 'Inactive Subscription',
//     priority: 80,
//     condition: (_user, subscription, _setup, _sessionFlags, _currentRoute, _activeProjectId) =>
//       !!subscription && subscription.status === SubscriptionStatus.INACTIVE,
//     targetRoute: NavigationRoute.PAYMENT_INDEX,
//     description: 'Inactive subscriptions need payment',
//   },

//   // Priority 75: PAST_DUE subscription - route to payment update
//   {
//     id: 'past-due-subscription',
//     name: 'Past Due Subscription',
//     priority: 75,
//     condition: (_user, subscription, _setup, _sessionFlags, _currentRoute, _activeProjectId) =>
//       !!subscription && subscription.status === SubscriptionStatus.PAST_DUE,
//     targetRoute: NavigationRoute.PAYMENT_INDEX,
//     params: { mode: 'update' },
//     description: 'Past due subscriptions need payment update',
//   },

//   // Priority 70: CANCELLED subscription - route to subscription gate
//   {
//     id: 'cancelled-subscription',
//     name: 'Cancelled Subscription',
//     priority: 70,
//     condition: (_user, subscription, _setup, _sessionFlags, _currentRoute, _activeProjectId) =>
//       !!subscription && subscription.status === SubscriptionStatus.CANCELLED,
//     targetRoute: NavigationRoute.SUBSCRIPTION_GATE,
//     description: 'Cancelled subscriptions need reactivation',
//   },

//   // Priority 65: Free plan onboarding with session flag (UPDATED)
//   {
//     id: 'free-plan-onboarding',
//     name: 'Free User Welcome',
//     priority: 65,
//     condition: (user, subscription, _setup, sessionFlags, _currentRoute, _activeProjectId) =>
//       !!user &&
//       !!subscription &&
//       subscription.plan === SubscriptionPlan.FREE &&
//       !sessionFlags.hasSeenFreeWelcome,
//     targetRoute: NavigationRoute.ONBOARDING_FREE,
//     onMatch: () => ({ hasSeenFreeWelcome: true }),
//     description: 'Free users see onboarding every launch (session flag)',
//   },

//   // Priority 60: ACTIVE subscription + firstTimeSetup - route to setup (verified users only)
//   {
//     id: 'active-first-time-setup',
//     name: 'Active First Time Setup',
//     priority: 60,
//     condition: (user, subscription, setup, _sessionFlags, _currentRoute, _activeProjectId) =>
//       !!user &&
//       user.isEmailVerified &&
//       !!subscription &&
//       subscription.status === SubscriptionStatus.ACTIVE &&
//       !!setup &&
//       setup.firstTimeSetup === true,
//     targetRoute: NavigationRoute.SETUP_INDEX,
//     description: 'Verified users with active subscription go through setup wizard',
//   },

//   // Priority 50: Dashboard project guard (NEW)
//   {
//     id: 'dashboard-project-guard',
//     name: 'Dashboard Project Guard',
//     priority: 50,
//     condition: (_user, _subscription, _setup, _sessionFlags, currentRoute, activeProjectId) =>
//       currentRoute.startsWith('/(dashboard)') && !activeProjectId,
//     targetRoute: NavigationRoute.PROJECTS_INDEX,
//     description: 'Dashboard requires active project selection',
//   },

//   // Priority 50: TRIALING + showOnboarding - route to trial onboarding
//   {
//     id: 'trialing-onboarding',
//     name: 'Trialing Onboarding',
//     priority: 50,
//     condition: (_user, subscription, setup, _sessionFlags, _currentRoute, _activeProjectId) =>
//       !!subscription &&
//       subscription.status === SubscriptionStatus.TRIALING &&
//       !!setup &&
//       setup.showOnboarding === true,
//     targetRoute: NavigationRoute.ONBOARDING_FREE,
//     description: 'Trialing users see free onboarding',
//   },

//   // Priority 40: ACTIVE + showOnboarding - route to paid onboarding
//   {
//     id: 'active-onboarding',
//     name: 'Active Onboarding',
//     priority: 40,
//     condition: (_user, subscription, setup, _sessionFlags, _currentRoute, _activeProjectId) =>
//       !!subscription &&
//       subscription.status === SubscriptionStatus.ACTIVE &&
//       !!setup &&
//       setup.showOnboarding === true,
//     targetRoute: NavigationRoute.ONBOARDING_PAID,
//     description: 'Active paid users see paid onboarding',
//   },

//   // Priority 10: Default - route to projects (lowest priority)
//   {
//     id: 'default-projects',
//     name: 'Default Projects',
//     priority: 10,
//     condition: (_user, _subscription, _setup, _sessionFlags, _currentRoute, _activeProjectId) =>
//       true, // Always matches
//     targetRoute: NavigationRoute.PROJECTS_INDEX,
//     description: 'Default route for all other users',
//   },
// ];

/**
 * ============================================================================
 * SUB PAGE CONFIGURATIONS
 * ============================================================================
 * Sub-pages for navigation groups (extending dashboard pattern)
 */

// Home tab sub-pages
export const homeSubPages: SubPage[] = [
  {
    id: 'index',
    title: 'Home',
    iconName: 'home',
    route: NavigationRoute.DASHBOARD_HOME,
    params: null,
  },
  {
    id: 'locations',
    title: 'Locations',
    iconName: 'map-marker',
    route: NavigationRoute.DASHBOARD_HOME_LOCATIONS,
    params: null,
  },
  {
    id: 'keyPeople',
    title: 'Key People',
    iconName: 'account-group',
    route: NavigationRoute.DASHBOARD_HOME_KEY_PEOPLE,
    params: null,
  },
  {
    id: 'notes',
    title: 'Notes',
    iconName: 'note-plus',
    route: NavigationRoute.DASHBOARD_HOME_NOTES,
    params: null,
  },
];

// // Shots tab sub-pages
export const listsSubPages: SubPage[] = [
  {
    id: 'index',
    title: 'Shot Lists',
    iconName: 'camera-iris',
    route: NavigationRoute.DASHBOARD_SHOTS,
    params: null,
  },
  {
    id: 'requested',
    title: 'Requested Shots',
    iconName: 'camera-plus',
    route: NavigationRoute.DASHBOARD_SHOTS_REQUESTED,
    params: null,
  },
  {
    id: 'kitList',
    title: 'Kit List',
    iconName: 'bag-personal',
    route: NavigationRoute.DASHBOARD_SHOTS_KIT_LIST,
    params: null,
  },
  {
    id: 'taskList',
    title: 'Task List',
    iconName: 'clipboard-list',
    route: NavigationRoute.DASHBOARD_SHOTS_TASK_LIST,
    params: null,
  },
];

// // Tools tab sub-pages
export const toolsSubPages: SubPage[] = [
  {
    id: 'index',
    title: 'Guides',
    iconName: 'lightbulb-on',
    route: NavigationRoute.DASHBOARD_TOOLS,
    params: null,
  },
  {
    id: 'tags',
    title: 'Tags',
    iconName: 'tag-faces',
    route: NavigationRoute.DASHBOARD_TOOLS_TAGS,
    params: null,
  },
  {
    id: 'vendors',
    title: 'Vendors',
    iconName: 'card-account-details',
    route: NavigationRoute.DASHBOARD_TOOLS_VENDORS,
    params: null,
  },
  {
    id: 'qrCard',
    title: 'QR Business Card',
    iconName: 'qrcode',
    route: NavigationRoute.DASHBOARD_TOOLS_QR_CARD,
    params: null,
  },
];

// // Settings tab sub-pages
export const settingsSubPages: SubPage[] = [
  {
    id: 'index',
    title: 'Project Settings',
    iconName: 'cogs',
    route: NavigationRoute.DASHBOARD_SETTINGS,
    params: null,
  },
  {
    id: 'manageData',
    title: 'Manage Data',
    iconName: 'database-export',
    route: NavigationRoute.DASHBOARD_SETTINGS_MANAGE_DATA,
    params: null,
  },
  {
    id: 'manageProjects',
    title: 'Manage Projects',
    iconName: 'book-open-variant',
    route: NavigationRoute.DASHBOARD_SETTINGS_MANAGE_PROJECTS,
    params: null,
  },
  {
    id: 'myAccount',
    title: 'My Account',
    iconName: 'account-settings',
    route: NavigationRoute.DASHBOARD_SETTINGS_MY_ACCOUNT,
    params: null,
  },
];

/**
 * ============================================================================
 * HELPER FUNCTIONS
 * ============================================================================
 */

/**
 * Get route group for a given route
 */
export function getRouteGroup(route: NavigationRoute): NavigationRouteGroup {
  return ROUTE_CONFIG[route];
}

/**
 * Check if a route belongs to a specific group
 */
export function isRouteInGroup(route: NavigationRoute, group: NavigationRouteGroup): boolean {
  return ROUTE_CONFIG[route] === group;
}

/**
 * Get all routes in a group
 */
export function getRoutesInGroup(group: NavigationRouteGroup): NavigationRoute[] {
  return Object.entries(ROUTE_CONFIG)
    .filter(([_route, routeGroup]) => routeGroup === group)
    .map(([route]) => route as NavigationRoute);
}
