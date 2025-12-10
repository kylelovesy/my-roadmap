/*---------------------------------------
File: src/app/(post-auth-setup)/pricing.tsx
Description: Pricing screen with subscription plan selection
Follows Clean Architecture: Presentation layer only - no business logic
Author: Kyle Lovesy
Date: 2025-11-26
Version: 1.0.1
---------------------------------------*/

// React/React Native
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

// Components
import { Screen } from '@/components/common/screen';
import { StandardAppText } from '@/components/common/ui/StandardAppText';
import { StandardAppTextInput } from '@/components/common/ui/StandardAppTextInput';
import { StandardAppButton } from '@/components/common/ui/StandardAppButton';
import { StandardAppCard } from '@/components/common/ui/StandardAppCard';
import { FeatureComparisonTable } from '@/components/pricing/FeatureComparisonTable';
import { PricingFAQ } from '@/components/pricing/PricingFAQ';
import { EmailVerificationModal } from '@/components/pricing/EmailVerificationModal';

// Hooks
import { useAppStyles } from '@/hooks/use-app-styles';
import { useSubscriptionPlans } from '@/hooks/use-subscription-plans';
import { useAnalytics } from '@/hooks/use-analytics';
import { useErrorHandler } from '@/hooks/use-error-handler';
import { useAuthStore, useUser } from '@/stores/use-auth-store';
import { useServices } from '@/contexts/ServiceContext';
import { useUIStore } from '@/stores/use-ui-store';
// import { usePromoCode } from '@/hooks/use-promo-code';

// Domain/types
import { SubscriptionPlan, BillingCycle, SubscriptionStatus } from '@/constants/enums';

// Constants
import { NavigationRoute } from '@/constants/navigation/navigation';
import { getPriceDisplay, getAnnualSavings, CURRENCY } from '@/constants/subscriptions';
import {
  PRICING_SCREEN_CONSTANTS,
  PLAN_DESCRIPTIONS,
  EMAIL_VERIFICATION_CONSTANTS,
} from '@/constants/pricing-screen';
import { spacing, borderRadius, borderWidth } from '@/constants/design-tokens';

export default function PricingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { authStyles, theme } = useAppStyles();
  const { subscription, promoCode } = useServices();
  const { showToast } = useUIStore();
  const { handleError } = useErrorHandler();
  // UPDATED: Use selectors
  const user = useUser();

  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>(BillingCycle.MONTHLY);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  const { plans, loading, error } = useSubscriptionPlans();
  // const { applyPromoCode } = usePromoCode();
  const { trackEvent } = useAnalytics();

  // ADDED: isMountedRef per standards
  const isMountedRef = useRef(true);

  useEffect(() => {
    if (params.plan) {
      setSelectedPlan(params.plan as SubscriptionPlan);
    }
  }, [params.plan]);

  const handleCycleChange = useCallback(
    (cycle: BillingCycle) => {
      setSelectedCycle(cycle);
      trackEvent('pricing_cycle_changed', { cycle });
    },
    [trackEvent],
  );

  const handlePlanSelect = useCallback(
    (plan: SubscriptionPlan) => {
      setSelectedPlan(plan);
      trackEvent('pricing_plan_selected', { plan });
    },
    [trackEvent],
  );

  // const handleApplyPromo = useCallback(async () => {
  //   const result = await applyPromoCode(promoCodeInput);
  //   // UPDATED: Use fromResult for error state
  //   if (result.success) {
  //     if (isMountedRef.current) {
  //       setAppliedPromo(result.value);
  //       showToast({ type: 'success', message: 'Promo code applied!' });
  //     }
  //   } else {
  //     handleError(result.error);
  //   }
  // }, [promoCodeInput, applyPromoCode, showToast, handleError]);

  const handleSubscribe = useCallback(() => {
    if (!user?.isEmailVerified) {
      setShowVerificationModal(true);
      return;
    }

    if (!selectedPlan) return;

    router.push({
      pathname: NavigationRoute.PAYMENT,
      params: {
        plan: selectedPlan,
        cycle: selectedCycle,
        promo: appliedPromo?.code,
      },
    });
  }, [user, selectedPlan, selectedCycle, appliedPromo, router]);

  const closeVerificationModal = useCallback(() => {
    setShowVerificationModal(false);
  }, []);

  const colors = theme.colors;

  return (
    <Screen loading={loading} error={error} scrollable={true} safeArea={true}>
      <ScrollView contentContainerStyle={authStyles.screenContainer}>
        <View style={authStyles.contentWrapper}>
          <StandardAppText variant="headlineLarge" style={styles.title}>
            Choose Your Plan
          </StandardAppText>

          <StandardAppText variant="bodyMedium" style={styles.subtitle}>
            Select the perfect plan for your photography needs
          </StandardAppText>

          {/* Cycle Toggle */}
          <View style={[styles.cycleToggle, { backgroundColor: colors.surfaceVariant }]}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                selectedCycle === BillingCycle.MONTHLY && styles.activeToggle,
              ]}
              onPress={() => handleCycleChange(BillingCycle.MONTHLY)}
            >
              <StandardAppText
                variant="bodyMedium"
                style={
                  selectedCycle === BillingCycle.MONTHLY
                    ? { fontWeight: 'bold' }
                    : { fontWeight: 'normal' }
                }
              >
                Annually
              </StandardAppText>
              <View style={[styles.savingsBadge, { backgroundColor: colors.primary }]}>
                <StandardAppText
                  variant="labelSmall"
                  style={[styles.savingsBadgeText, { color: colors.onPrimary }]}
                >
                  Save {getAnnualSavings(selectedPlan as SubscriptionPlan) || 0}%
                </StandardAppText>
              </View>
            </TouchableOpacity>
          </View>

          {/* Plan Cards */}
          <View style={styles.cardsContainer}>
            {plans.map(plan => {
              const isSelected = selectedPlan === plan.plan;
              const isPopular = plan.plan === SubscriptionPlan.PRO;
              const price = getPriceDisplay(plan.plan as SubscriptionPlan, selectedCycle);

              return (
                <TouchableOpacity
                  key={plan.plan}
                  style={[
                    styles.card,
                    { backgroundColor: colors.surface, borderColor: colors.outline },
                    isSelected && { borderColor: colors.primary, borderWidth: borderWidth.md },
                    isPopular && styles.popularCard,
                  ]}
                  onPress={() => handlePlanSelect(plan.plan as SubscriptionPlan)}
                >
                  {isPopular && (
                    <View style={[styles.popularBadge, { backgroundColor: colors.primary }]}>
                      <StandardAppText
                        variant="labelMedium"
                        style={[styles.popularBadgeText, { color: colors.onPrimary }]}
                      >
                        Most Popular
                      </StandardAppText>
                    </View>
                  )}

                  <StandardAppText variant="headlineSmall" style={styles.planName}>
                    {plan.name}
                  </StandardAppText>

                  <StandardAppText variant="bodyMedium" style={styles.planDescription}>
                    {/* {plan.planData?.description || ''} */}
                    plan.description
                  </StandardAppText>

                  <View style={styles.priceContainer}>
                    <View style={styles.priceRow}>
                      <StandardAppText variant="headlineSmall">
                        {plan.pricing.monthly}
                      </StandardAppText>
                      <StandardAppText variant="bodyLarge">
                        {' '}
                        /{selectedCycle === BillingCycle.MONTHLY ? 'month' : 'year'}
                      </StandardAppText>
                    </View>
                  </View>

                  {plan.pricing.trialDays > 0 && (
                    <View style={[styles.trialInfo, { backgroundColor: colors.surfaceVariant }]}>
                      <StandardAppText
                        variant="bodyMedium"
                        style={[styles.trialInfoText, { color: colors.onSurfaceVariant }]}
                      >
                        {plan.pricing.trialDays}-day free trial
                      </StandardAppText>
                    </View>
                  )}

                  <View style={styles.featuresList}>
                    {plan.features.map((feature, index) => (
                      <View key={index} style={styles.featureItem}>
                        <StandardAppText style={styles.checkmark}>✓</StandardAppText>
                        <StandardAppText variant="bodyMedium" style={styles.featureText}>
                          {feature}
                        </StandardAppText>
                      </View>
                    ))}
                    <StandardAppText variant="bodySmall" style={styles.moreFeaturesText}>
                      And much more...
                    </StandardAppText>
                  </View>

                  <StandardAppButton
                    mode={isSelected ? 'contained' : 'outlined'}
                    style={styles.ctaButton}
                  >
                    {isSelected ? 'Selected' : 'Select Plan'}
                  </StandardAppButton>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Promo Code */}
          <StandardAppCard>
            <StandardAppText variant="headlineSmall">Promo Code</StandardAppText>
            <StandardAppTextInput
              value={promoCodeInput}
              onChangeText={setPromoCodeInput}
              placeholder="Enter promo code"
              style={{ marginBottom: spacing.md }}
            />
            <StandardAppButton onPress={() => {}} disabled={!promoCodeInput}>
              Apply Promo
            </StandardAppButton>
          </StandardAppCard>

          {/* Feature Comparison */}
          <View style={styles.comparisonSection}>
            <StandardAppText variant="headlineSmall" style={styles.comparisonTitle}>
              Compare Features
            </StandardAppText>
            <FeatureComparisonTable />
          </View>

          {/* FAQ */}
          <PricingFAQ />

          {/* CTA */}
          <StandardAppButton
            mode="contained"
            onPress={handleSubscribe}
            disabled={!selectedPlan || loading}
            style={{ marginTop: spacing.xxl }}
          >
            Proceed to Payment
          </StandardAppButton>
        </View>

        <EmailVerificationModal
          visible={showVerificationModal}
          onClose={closeVerificationModal}
          onVerified={handleSubscribe}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: spacing.xxxl,
  },
  cycleToggle: {
    flexDirection: 'row',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: spacing.xxxl,
  },
  toggleButton: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
  },
  activeToggle: {
    backgroundColor: 'rgba(0, 0, 0, 0.08)', // Adjust based on theme
  },
  savingsBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs / 2,
  },
  savingsBadgeText: {
    fontWeight: 'bold',
  },
  cardsContainer: {
    gap: spacing.lg,
    marginBottom: spacing.xxxl * 1.5,
  },
  card: {
    padding: spacing.xxl,
    borderRadius: borderRadius.lg,
    borderWidth: borderWidth.sm,
    position: 'relative',
  },
  popularCard: {
    transform: [{ scale: 1.02 }],
  },
  popularBadge: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  popularBadgeText: {
    fontWeight: 'bold',
  },
  planName: {
    marginBottom: spacing.xs,
  },
  planDescription: {
    marginBottom: spacing.lg,
  },
  priceContainer: {
    marginBottom: spacing.md,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  savingsText: {
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  trialInfo: {
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  trialInfoText: {
    fontWeight: '600',
  },
  featuresList: {
    marginBottom: spacing.xxl,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  checkmark: {
    marginRight: spacing.sm,
  },
  featureText: {
    flex: 1,
  },
  moreFeaturesText: {
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  ctaButton: {
    marginTop: 'auto',
  },
  comparisonSection: {
    marginTop: spacing.xxxl,
  },
  comparisonTitle: {
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
});

// export default function PricingScreen() {
//   const router = useRouter();
//   const params = useLocalSearchParams<{ promoCode?: string }>();
//   const { spacing: spacingTokens, theme } = useAppStyles();
//   const colors = theme.colors;
//   const { trackScreenView, trackEvent } = useAnalytics();
//   const { handleError } = useErrorHandler();
//   const { plans, loading, error, refresh } = useSubscriptionPlans();
//   const { user } = useAuthStore();
//   const { user: userService } = useServices();
//   const { showToast } = useUIStore();

//   const [billingCycle, setBillingCycle] = useState<BillingCycle>(BillingCycle.MONTHLY);
//   const [showEmailModal, setShowEmailModal] = useState(false);
//   const [pendingPlan, setPendingPlan] = useState<SubscriptionPlan | null>(null);
//   const [pendingBillingCycle, setPendingBillingCycle] = useState<BillingCycle | null>(null);
//   const [activatingFreePlan, setActivatingFreePlan] = useState(false);
//   const isMountedRef = useRef(true);

//   // Cleanup on unmount
//   useEffect(() => {
//     return () => {
//       isMountedRef.current = false;
//     };
//   }, []);
//   // Get promo code from route params
//   const promoCode = params.promoCode || null;

//   // Track screen view
//   useEffect(() => {
//     trackScreenView('pricing_page_viewed', {
//       billing_interval: billingCycle,
//     });
//   }, [trackScreenView, billingCycle]);

//   // Handle plan selection
//   const handleSelectPlan = useCallback(
//     async (plan: SubscriptionPlan) => {
//       trackEvent('plan_selected', {
//         plan,
//         billing_interval: billingCycle,
//       });

//       // Check email verification status
//       if (!user?.isEmailVerified) {
//         // Store pending plan and billing cycle
//         setPendingPlan(plan);
//         if (isPaidPlan(plan)) {
//           setPendingBillingCycle(billingCycle);
//         }
//         // Show email verification modal
//         setShowEmailModal(true);
//         return;
//       }

//       // Email is verified - proceed with plan activation/navigation
//       if (plan === SubscriptionPlan.FREE) {
//         if (!user?.id) {
//           const context = ErrorContextBuilder.fromHook('PricingScreen', 'handleSelectPlan');
//           handleError(
//             ErrorMapper.createGenericError(
//               ErrorCode.AUTH_USER_NOT_FOUND,
//               'User not found',
//               'Please sign in to continue',
//               ErrorContextBuilder.toString(context),
//             ),
//             context,
//           );
//           return;
//         }

//         setActivatingFreePlan(true);
//         const result = await userService.updateSubscription(user.id, {
//           plan: SubscriptionPlan.FREE,
//           status: SubscriptionStatus.ACTIVE,
//           isActive: true,
//           isTrial: false,
//           autoRenew: false,
//         });

//         if (!isMountedRef.current) return;

//         if (result.success) {
//           // Refresh user in store to prevent guard race conditions
//           const refreshed = await userService.getUser(user.id);
//           if (refreshed.success) {
//             useAuthStore.getState().setUser(refreshed.value);
//           }
//           router.push({
//             pathname: NavigationRoute.ONBOARDING_FREE,
//             params: { plan: SubscriptionPlan.FREE },
//           });
//         } else {
//           handleError(
//             result.error,
//             ErrorContextBuilder.fromHook('PricingScreen', 'handleSelectPlan', user.id),
//           );
//         }
//         setActivatingFreePlan(false);
//       } else {
//         router.push({
//           pathname: NavigationRoute.PAYMENT,
//           params: {
//             plan,
//             interval: billingCycle,
//             ...(promoCode && { promoCode }),
//           },
//         });
//       }
//     },
//     [
//       router,
//       billingCycle,
//       trackEvent,
//       user?.isEmailVerified,
//       user?.id,
//       userService,
//       promoCode,
//       handleError,
//     ],
//   );

//   // Handle email verification success
//   const handleEmailVerified = useCallback(async () => {
//     if (!pendingPlan || !user?.id) return;

//     // Navigate based on plan type
//     if (pendingPlan === SubscriptionPlan.FREE) {
//       setActivatingFreePlan(true);
//       const result = await userService.updateSubscription(user.id, {
//         plan: SubscriptionPlan.FREE,
//         status: SubscriptionStatus.ACTIVE,
//         isActive: true,
//         isTrial: false,
//         autoRenew: false,
//       });

//       if (!isMountedRef.current) return;

//       if (result.success) {
//         const refreshed = await userService.getUser(user.id);
//         if (refreshed.success) {
//           useAuthStore.getState().setUser(refreshed.value);
//         }
//         router.push({
//           pathname: NavigationRoute.ONBOARDING_FREE,
//           params: { plan: SubscriptionPlan.FREE },
//         });
//       } else {
//         handleError(
//           result.error,
//           ErrorContextBuilder.fromHook('PricingScreen', 'handleEmailVerified', user.id),
//         );
//       }
//       setActivatingFreePlan(false);
//     } else if (pendingBillingCycle) {
//       router.push({
//         pathname: NavigationRoute.PAYMENT,
//         params: {
//           plan: pendingPlan,
//           interval: pendingBillingCycle,
//           ...(promoCode && { promoCode }),
//         },
//       });
//     }

//     // Clear state and close modal
//     setPendingPlan(null);
//     setPendingBillingCycle(null);
//     setShowEmailModal(false);
//   }, [router, pendingPlan, pendingBillingCycle, user?.id, userService, promoCode, handleError]);

//   // Handle skip verification (FREE plan only)
//   const handleSkipVerification = useCallback(async () => {
//     if (!user?.id) {
//       const context = ErrorContextBuilder.fromHook('PricingScreen', 'handleSkipVerification');
//       handleError(
//         ErrorMapper.createGenericError(
//           ErrorCode.AUTH_USER_NOT_FOUND,
//           'User not found',
//           'Please sign in to continue',
//           ErrorContextBuilder.toString(context),
//         ),
//         context,
//       );
//       return;
//     }

//     if (pendingPlan === SubscriptionPlan.FREE) {
//       setActivatingFreePlan(true);

//       const result = await userService.updateSubscription(user.id, {
//         plan: SubscriptionPlan.FREE,
//         status: SubscriptionStatus.ACTIVE,
//         isActive: true,
//         isTrial: false,
//         autoRenew: false,
//       });

//       if (!isMountedRef.current) return;

//       if (result.success) {
//         const refreshed = await userService.getUser(user.id);
//         if (refreshed.success) {
//           useAuthStore.getState().setUser(refreshed.value);
//         }
//         router.push({
//           pathname: NavigationRoute.ONBOARDING_FREE,
//           params: { plan: SubscriptionPlan.FREE },
//         });
//       } else {
//         handleError(
//           result.error,
//           ErrorContextBuilder.fromHook('PricingScreen', 'handleSkipVerification', user.id),
//         );
//       }

//       setActivatingFreePlan(false);
//     }

//     // Clear state and close modal
//     setPendingPlan(null);
//     setPendingBillingCycle(null);
//     setShowEmailModal(false);
//   }, [user?.id, pendingPlan, userService, router, handleError]);

//   // Toggle billing cycle (UI state only)
//   const handleToggleBillingCycle = useCallback(() => {
//     setBillingCycle(prev =>
//       prev === BillingCycle.MONTHLY ? BillingCycle.ANNUALLY : BillingCycle.MONTHLY,
//     );
//   }, []);

//   // Handle retry (delegates to hook)
//   const handleRetry = useCallback(async () => {
//     await refresh();
//   }, [refresh]);

//   // Handle error (delegates to error handler)
//   useEffect(() => {
//     if (error) {
//       handleError(error, ErrorContextBuilder.fromHook('PricingScreen', 'useSubscriptionPlans'));
//     }
//   }, [error, handleError]);

//   return (
//     <Screen
//       loading={loading}
//       error={error}
//       onRetry={handleRetry}
//       scrollable={true}
//       testID="pricing-screen"
//     >
//       <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
//         {/* Header */}
//         <View style={styles.header}>
//           <StandardAppText variant="displaySmall" style={[styles.title, { color: colors.primary }]}>
//             {PRICING_SCREEN_CONSTANTS.TITLE}
//           </StandardAppText>
//           <StandardAppText
//             variant="bodyLarge"
//             style={[styles.subtitle, { color: colors.onSurfaceVariant }]}
//           >
//             {PRICING_SCREEN_CONSTANTS.SUBTITLE}
//           </StandardAppText>
//         </View>

//         {/* Billing Toggle */}
//         <View style={styles.billingToggle}>
//           <StandardAppText
//             variant="bodyMedium"
//             style={[
//               styles.billingLabel,
//               {
//                 color:
//                   billingCycle === BillingCycle.MONTHLY
//                     ? colors.onSurface
//                     : colors.onSurfaceVariant,
//                 fontWeight: billingCycle === BillingCycle.MONTHLY ? 'bold' : 'normal',
//               },
//             ]}
//           >
//             {PRICING_SCREEN_CONSTANTS.MONTHLY_LABEL}
//           </StandardAppText>

//           <TouchableOpacity
//             onPress={handleToggleBillingCycle}
//             style={[
//               styles.toggleSwitch,
//               {
//                 backgroundColor:
//                   billingCycle === BillingCycle.ANNUALLY ? colors.primary : colors.surfaceVariant,
//               },
//             ]}
//             accessibilityRole="switch"
//             accessibilityState={{ checked: billingCycle === BillingCycle.ANNUALLY }}
//           >
//             <View
//               style={[
//                 styles.toggleSlider,
//                 {
//                   backgroundColor: colors.surface,
//                 },
//                 billingCycle === BillingCycle.ANNUALLY && styles.toggleSliderActive,
//               ]}
//             />
//           </TouchableOpacity>

//           <View style={styles.annualLabelContainer}>
//             <StandardAppText
//               variant="bodyMedium"
//               style={[
//                 styles.billingLabel,
//                 {
//                   color:
//                     billingCycle === BillingCycle.ANNUALLY
//                       ? colors.onSurface
//                       : colors.onSurfaceVariant,
//                   fontWeight: billingCycle === BillingCycle.ANNUALLY ? 'bold' : 'normal',
//                 },
//               ]}
//             >
//               {PRICING_SCREEN_CONSTANTS.ANNUAL_LABEL}
//             </StandardAppText>
//             {billingCycle === BillingCycle.ANNUALLY && (
//               <View style={[styles.savingsBadge, { backgroundColor: colors.tertiary }]}>
//                 <StandardAppText
//                   variant="labelSmall"
//                   style={[styles.savingsBadgeText, { color: colors.onTertiary }]}
//                 >
//                   {PRICING_SCREEN_CONSTANTS.SAVINGS_BADGE_TEXT}
//                 </StandardAppText>
//               </View>
//             )}
//           </View>
//         </View>

//         {/* Pricing Cards */}
//         <View style={styles.cardsContainer}>
//           {plans.map(planInfo => {
//             const isPopular = planInfo.recommended;
//             // Use utility function for formatting (no business logic in component)
//             const priceDisplay = getPriceDisplay(planInfo.plan, billingCycle);
//             const savings = getAnnualSavings(planInfo.plan);

//             return (
//               <View
//                 key={planInfo.plan}
//                 style={[
//                   styles.card,
//                   { backgroundColor: colors.surface, borderColor: colors.outline },
//                   isPopular && [
//                     styles.popularCard,
//                     { borderColor: colors.primary, borderWidth: borderWidth.md },
//                   ],
//                 ]}
//               >
//                 {/* Popular Badge */}
//                 {isPopular && (
//                   <View style={[styles.popularBadge, { backgroundColor: colors.tertiary }]}>
//                     <StandardAppText
//                       variant="labelSmall"
//                       style={[styles.popularBadgeText, { color: colors.onTertiary }]}
//                     >
//                       {PRICING_SCREEN_CONSTANTS.POPULAR_BADGE_TEXT}
//                     </StandardAppText>
//                   </View>
//                 )}

//                 {/* Plan Name */}
//                 <StandardAppText variant="headlineSmall" style={styles.planName}>
//                   {planInfo.name}
//                 </StandardAppText>

//                 {/* Description */}
//                 <StandardAppText
//                   variant="bodySmall"
//                   style={[styles.planDescription, { color: colors.onSurfaceVariant }]}
//                 >
//                   {PLAN_DESCRIPTIONS[planInfo.plan]}
//                 </StandardAppText>

//                 {/* Price */}
//                 <View style={styles.priceContainer}>
//                   <View style={styles.priceRow}>
//                     <StandardAppText variant="displayMedium" style={{ color: colors.primary }}>
//                       {priceDisplay}
//                     </StandardAppText>
//                   </View>

//                   {savings > 0 && billingCycle === BillingCycle.ANNUALLY && (
//                     <StandardAppText
//                       variant="bodySmall"
//                       style={[styles.savingsText, { color: colors.primary }]}
//                     >
//                       {PRICING_SCREEN_CONSTANTS.SAVINGS_TEXT(savings.toFixed(2))}
//                     </StandardAppText>
//                   )}
//                 </View>

//                 {/* Trial Info */}
//                 {planInfo.plan !== SubscriptionPlan.FREE && (
//                   <View style={[styles.trialInfo, { backgroundColor: colors.primaryContainer }]}>
//                     <StandardAppText
//                       variant="bodySmall"
//                       style={[styles.trialInfoText, { color: colors.onPrimaryContainer }]}
//                     >
//                       {PRICING_SCREEN_CONSTANTS.TRIAL_INFO_TEXT(planInfo.pricing.trialDays)}
//                     </StandardAppText>
//                   </View>
//                 )}

//                 {/* Features */}
//                 <View style={styles.featuresList}>
//                   {planInfo.features.slice(0, 6).map((feature, index) => (
//                     <View key={index} style={styles.featureItem}>
//                       <StandardAppText
//                         variant="bodyMedium"
//                         style={[styles.checkmark, { color: colors.primary }]}
//                       >
//                         ✓
//                       </StandardAppText>
//                       <StandardAppText
//                         variant="bodySmall"
//                         style={[styles.featureText, { color: colors.onSurface }]}
//                       >
//                         {feature}
//                       </StandardAppText>
//                     </View>
//                   ))}

//                   {planInfo.features.length > 6 && (
//                     <StandardAppText
//                       variant="bodySmall"
//                       style={[styles.moreFeaturesText, { color: colors.onSurfaceVariant }]}
//                     >
//                       {PRICING_SCREEN_CONSTANTS.MORE_FEATURES_TEXT(planInfo.features.length - 6)}
//                     </StandardAppText>
//                   )}
//                 </View>

//                 {/* CTA Button */}
//                 <StandardAppButton
//                   onPress={() => handleSelectPlan(planInfo.plan)}
//                   mode={isPopular ? 'contained' : 'outlined'}
//                   style={styles.ctaButton}
//                 >
//                   {planInfo.plan === SubscriptionPlan.FREE
//                     ? PRICING_SCREEN_CONSTANTS.FREE_TRIAL_BUTTON
//                     : PRICING_SCREEN_CONSTANTS.START_TRIAL_BUTTON(planInfo.pricing.trialDays)}
//                 </StandardAppButton>
//               </View>
//             );
//           })}
//         </View>

//         {/* Feature Comparison Table */}
//         <View style={styles.comparisonSection}>
//           <StandardAppText
//             variant="headlineSmall"
//             style={[styles.comparisonTitle, { color: colors.onSurface }]}
//           >
//             {PRICING_SCREEN_CONSTANTS.COMPARISON_TITLE}
//           </StandardAppText>
//           <FeatureComparisonTable />
//         </View>

//         {/* FAQ Section */}
//         <PricingFAQ />
//       </ScrollView>

//       {/* Email Verification Modal */}
//       <EmailVerificationModal
//         visible={showEmailModal}
//         onClose={() => {
//           setShowEmailModal(false);
//           setPendingPlan(null);
//           setPendingBillingCycle(null);
//         }}
//         onVerified={handleEmailVerified}
//         onSkip={handleSkipVerification}
//         showSkipButton={pendingPlan === SubscriptionPlan.FREE}
//       />
//     </Screen>
//   );
// }

// // ============================================================================
// // STYLES
// // ============================================================================

// const styles = StyleSheet.create({
//   container: {
//     padding: spacing.xxl,
//     paddingBottom: spacing.xxxl * 1.5,
//   },
//   header: {
//     alignItems: 'center',
//     marginBottom: spacing.xxxl,
//   },
//   title: {
//     textAlign: 'center',
//     marginBottom: spacing.sm,
//   },
//   subtitle: {
//     textAlign: 'center',
//   },
//   billingToggle: {
//     flexDirection: 'row',
//     justifyContent: 'center',
//     alignItems: 'center',
//     gap: spacing.lg,
//     marginBottom: spacing.xxxl,
//   },
//   billingLabel: {
//     minWidth: 60,
//     textAlign: 'center',
//   },
//   toggleSwitch: {
//     width: 56,
//     height: 32,
//     borderRadius: borderRadius.lg,
//     padding: spacing.xs,
//     justifyContent: 'center',
//   },
//   toggleSlider: {
//     width: 24,
//     height: 24,
//     borderRadius: 12,
//   },
//   toggleSliderActive: {
//     alignSelf: 'flex-end',
//   },
//   annualLabelContainer: {
//     alignItems: 'flex-end',
//     minWidth: 60,
//   },
//   savingsBadge: {
//     paddingHorizontal: spacing.sm,
//     paddingVertical: spacing.xs / 2,
//     borderRadius: borderRadius.sm,
//     marginTop: spacing.xs / 2,
//   },
//   savingsBadgeText: {
//     fontWeight: 'bold',
//   },
//   cardsContainer: {
//     gap: spacing.lg,
//     marginBottom: spacing.xxxl * 1.5,
//   },
//   card: {
//     padding: spacing.xxl,
//     borderRadius: borderRadius.lg,
//     borderWidth: borderWidth.sm,
//     position: 'relative',
//   },
//   popularCard: {
//     transform: [{ scale: 1.02 }],
//   },
//   popularBadge: {
//     position: 'absolute',
//     top: spacing.lg,
//     right: spacing.lg,
//     paddingHorizontal: spacing.md,
//     paddingVertical: spacing.sm,
//     borderRadius: borderRadius.md,
//   },
//   popularBadgeText: {
//     fontWeight: 'bold',
//   },
//   planName: {
//     marginBottom: spacing.xs,
//   },
//   planDescription: {
//     marginBottom: spacing.lg,
//   },
//   priceContainer: {
//     marginBottom: spacing.md,
//   },
//   priceRow: {
//     flexDirection: 'row',
//     alignItems: 'baseline',
//     gap: spacing.xs,
//   },
//   savingsText: {
//     fontWeight: '600',
//     marginTop: spacing.xs,
//   },
//   trialInfo: {
//     padding: spacing.md,
//     borderRadius: borderRadius.sm,
//     alignItems: 'center',
//     marginBottom: spacing.lg,
//   },
//   trialInfoText: {
//     fontWeight: '600',
//   },
//   featuresList: {
//     marginBottom: spacing.xxl,
//   },
//   featureItem: {
//     flexDirection: 'row',
//     alignItems: 'flex-start',
//     marginBottom: spacing.sm,
//   },
//   checkmark: {
//     marginRight: spacing.sm,
//   },
//   featureText: {
//     flex: 1,
//   },
//   moreFeaturesText: {
//     fontStyle: 'italic',
//     marginTop: spacing.xs,
//   },
//   ctaButton: {
//     marginTop: 'auto',
//   },
//   comparisonSection: {
//     marginTop: spacing.xxxl,
//   },
//   comparisonTitle: {
//     textAlign: 'center',
//     marginBottom: spacing.xxl,
//   },
// });
