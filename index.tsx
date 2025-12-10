/*---------------------------------------
File: src/app/(protected)/(payment)/index.tsx
Description: Enhanced payment screen with improved styling using StandardApp components
Author: Kyle Lovesy
Date: 2025-12-06
Version: 2.1.0
---------------------------------------*/
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/common/screen';
import { StandardAppText } from '@/components/common/ui/StandardAppText';
import { StandardAppButton } from '@/components/common/ui/StandardAppButton';
import { StandardAppTextInput } from '@/components/common/ui/StandardAppTextInput';
import { StandardAppCard } from '@/components/common/ui/StandardAppCard';
import { StandardAppDivider } from '@/components/common/ui/StandardAppDivider';
import { StandardSpacer } from '@/components/common/ui/StandardSpacer';
import { useServices } from '@/contexts/ServiceContext';
import { useAppStyles } from '@/hooks/use-app-styles';
import { useErrorHandler } from '@/hooks/use-error-handler';
import { ErrorContextBuilder } from '@/utils/error/error-context-builder';
import { LoadingState, loading, success, error as errorState, idle } from '@/utils/loading-state';
import { CardField, useStripe } from '@stripe/stripe-react-native';
import { getPrice } from '@/constants/subscriptions';
import { BillingCycle, SubscriptionPlan, SubscriptionStatus } from '@/constants/enums';
import { ErrorCode } from '@/constants/error-code-registry';
import { NavigationRoute } from '@/constants/navigation/navigation';
import { AppError } from '@/domain/common/errors';
import { ErrorMapper } from '@/utils/error/error-mapper';
import { isPaidPlan } from '@/utils/pricing-display-helpers';
import { CURRENCY } from '@/constants/subscriptions';
// UPDATED: Use specific selector
import { useUser } from '@/stores/use-auth-store';

export default function PaymentScreen() {
  const params = useLocalSearchParams();
  const { payment, subscription } = useServices();
  const { theme, spacing } = useAppStyles();
  const { handleError } = useErrorHandler();
  // UPDATED: Use selector
  const user = useUser();
  const { createPaymentMethod } = useStripe();

  const [cardComplete, setCardComplete] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [state, setState] = useState<LoadingState<any>>(idle());

  const plan = params.plan as SubscriptionPlan;
  const cycle = params.cycle as BillingCycle;
  const promo = params.promo as string;

  const isUpdateMode = !!user?.subscription?.transactionId;
  const price = getPrice(plan, cycle);
  const formattedPrice = `${CURRENCY}${price.toFixed(2)}`;

  // ADDED: isMountedRef
  const isMountedRef = useRef(true);

  const handlePayment = useCallback(async () => {
    if (!user?.id || !cardComplete) return;

    setProcessing(true);
    setState(loading());

    try {
      const { paymentMethod, error: stripeError } = await createPaymentMethod({
        paymentMethodType: 'Card',
      });

      if (stripeError) {
        throw ErrorMapper.toAppError(stripeError, 'Stripe card validation failed');
      }

      const result = await payment.createPaymentIntent(user.id, plan, cycle, promo);

      if (!result.success) {
        throw result.error;
      }

      const confirmResult = await subscription.confirmPayment(
        result.value.clientSecret,
        paymentMethod.id,
      );

      if (!confirmResult.success) {
        throw confirmResult.error;
      }

      if (isMountedRef.current) {
        setState(success(confirmResult.value));
      }

      router.replace(NavigationRoute.PROJECTS);
    } catch (error) {
      const appError = ErrorMapper.toAppError(
        error,
        ErrorContextBuilder.toString(
          ErrorContextBuilder.fromComponent('PaymentScreen', 'handlePayment'),
        ),
      );
      if (isMountedRef.current) {
        setState(errorState(appError));
      }
      handleError(appError);
    } finally {
      if (isMountedRef.current) setProcessing(false);
    }
  }, [
    user,
    cardComplete,
    plan,
    cycle,
    promo,
    price,
    createPaymentMethod,
    payment,
    subscription,
    handleError,
    router,
  ]);

  const colors = theme.colors;

  return (
    <Screen
      loading={state.status === 'loading'}
      error={state.status === 'error' ? state.error : null}
      scrollable={true}
      safeArea={true}
    >
      <ScrollView contentContainerStyle={{ padding: spacing.xxl }}>
        <StandardAppText variant="headlineSmall" style={{ marginBottom: spacing.lg }}>
          Complete Your Subscription
        </StandardAppText>

        <StandardAppCard>
          <StandardAppText variant="headlineSmall" style={{ marginBottom: spacing.md }}>
            {plan} Plan - {cycle}
          </StandardAppText>

          <StandardAppDivider style={{ marginBottom: spacing.md }} />

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginBottom: spacing.sm,
            }}
          >
            <StandardAppText>Price:</StandardAppText>
            <StandardAppText>{formattedPrice}</StandardAppText>
          </View>

          {promo && (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginBottom: spacing.sm,
              }}
            >
              <StandardAppText>Promo Applied:</StandardAppText>
              <StandardAppText>{promo}</StandardAppText>
            </View>
          )}

          <StandardAppDivider style={{ marginVertical: spacing.md }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <StandardAppText style={{ fontWeight: 'bold' }}>Total:</StandardAppText>
            <StandardAppText style={{ fontWeight: 'bold' }}>{formattedPrice}</StandardAppText>
          </View>
        </StandardAppCard>

        <StandardSpacer size="xl" />

        <StandardAppCard>
          <StandardAppText variant="bodyMedium" style={{ marginBottom: spacing.lg }}>
            Enter your card details to complete the payment
          </StandardAppText>

          <CardField
            postalCodeEnabled={true}
            onCardChange={cardDetails => {
              setCardComplete(cardDetails.complete);
            }}
            cardStyle={{
              backgroundColor: colors.surface,
              textColor: colors.onSurface,
            }}
            style={{
              width: '100%',
              height: 50,
              marginBottom: spacing.lg,
            }}
          />

          <StandardAppButton
            onPress={handlePayment}
            disabled={!cardComplete || processing}
            mode="contained"
            loading={processing}
          >
            {processing
              ? 'Processing Payment...'
              : isUpdateMode
                ? 'Update Payment Method'
                : `Pay ${formattedPrice}`}
          </StandardAppButton>

          <StandardSpacer size="md" />

          {/* Security Notice */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surfaceVariant,
              padding: spacing.md,
              borderRadius: 8,
            }}
          >
            <StandardAppText variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
              🔒 Secure payment powered by Stripe
            </StandardAppText>
          </View>
        </StandardAppCard>

        <StandardSpacer size="xxl" />
      </ScrollView>
    </Screen>
  );
}
// /*---------------------------------------
// File: src/app/(protected)/(payment)/index.tsx
// Description: Enhanced payment screen with improved styling using StandardApp components
// Author: Kyle Lovesy
// Date: 2025-12-06
// Version: 2.1.0
// ---------------------------------------*/
// import React, { useState, useEffect, useCallback, useRef } from 'react';
// import { View, ScrollView } from 'react-native';
// import { router, useLocalSearchParams } from 'expo-router';
// import { Screen } from '@/components/common/screen';
// import { StandardAppText } from '@/components/common/ui/StandardAppText';
// import { StandardAppButton } from '@/components/common/ui/StandardAppButton';
// import { StandardAppTextInput } from '@/components/common/ui/StandardAppTextInput';
// import { StandardAppCard } from '@/components/common/ui/StandardAppCard';
// import { StandardAppDivider } from '@/components/common/ui/StandardAppDivider';
// import { StandardSpacer } from '@/components/common/ui/StandardSpacer';
// import { useAuthStore } from '@/stores/use-auth-store';
// import { useServices } from '@/contexts/ServiceContext';
// import { useAppStyles } from '@/hooks/use-app-styles';
// import { useErrorHandler } from '@/hooks/use-error-handler';
// import { ErrorContextBuilder } from '@/utils/error/error-context-builder';
// import { LoadingState, loading, success, error as errorState, idle } from '@/utils/loading-state';
// import { CardField, useStripe } from '@stripe/stripe-react-native';
// import { getPrice } from '@/constants/subscriptions';
// import { BillingCycle, SubscriptionPlan, SubscriptionStatus } from '@/constants/enums';
// import { ErrorCode } from '@/constants/error-code-registry';
// import { NavigationRoute } from '@/constants/navigation/navigation';
// import { AppError } from '@/domain/common/errors';
// import { ErrorMapper } from '@/utils/error/error-mapper';
// import { isPaidPlan } from '@/utils/pricing-display-helpers';
// import { Card } from 'react-native-paper';

// interface PaymentState {
//   selectedPlan: SubscriptionPlan;
//   selectedInterval: BillingCycle;
// }

// export default function PaymentScreen() {
//   const user = useAuthStore(state => state.user);
//   const { spacing, theme, typography, uiStyles } = useAppStyles();
//   const colors = theme.colors;
//   const { confirmPayment } = useStripe();
//   const { payment, promoCode: promoCodeService, user: userService } = useServices();
//   const { handleError } = useErrorHandler();
//   const params = useLocalSearchParams<{
//     mode?: string;
//     plan?: SubscriptionPlan;
//     interval?: BillingCycle;
//   }>();
//   const isUpdateMode = params.mode === 'update';
//   const isMountedRef = useRef(true);

//   const [state, setState] = useState<LoadingState<PaymentState | null>>(idle());
//   const [processing, setProcessing] = useState(false);
//   const [cardComplete, setCardComplete] = useState(false);
//   const [promoCode, setPromoCode] = useState('');
//   const [validatingPromo, setValidatingPromo] = useState(false);
//   const [promoDiscount, setPromoDiscount] = useState<number | null>(null);
//   const [promoError, setPromoError] = useState<string | null>(null);

//   // Cleanup on unmount
//   useEffect(() => {
//     return () => {
//       isMountedRef.current = false;
//     };
//   }, []);

//   const loadSubscription = useCallback(() => {
//     if (!user?.id) {
//       setState(idle());
//       return;
//     }

//     setState(loading());

//     const planFromParams = params.plan as SubscriptionPlan | undefined;
//     const rawInterval = params.interval as BillingCycle | string | undefined;
//     let intervalFromParams: BillingCycle | undefined;

//     if (rawInterval && typeof rawInterval === 'string') {
//       const intervalUpper = rawInterval.toUpperCase();
//       if (intervalUpper === 'ANNUALLY' || intervalUpper === 'ANNUAL') {
//         intervalFromParams = BillingCycle.ANNUALLY;
//       } else if (intervalUpper === 'MONTHLY' || intervalUpper === 'MONTH') {
//         intervalFromParams = BillingCycle.MONTHLY;
//       }
//     } else if (rawInterval) {
//       intervalFromParams = rawInterval as BillingCycle;
//     }

//     const currentSubscription = user.subscription;
//     const selectedPlan = planFromParams ?? currentSubscription?.plan;
//     const selectedInterval = intervalFromParams ?? currentSubscription?.billingCycle;

//     const context = ErrorContextBuilder.fromComponent('PaymentScreen', 'loadSubscription', user.id);

//     if (!selectedPlan || !selectedInterval) {
//       const missingError = ErrorMapper.createGenericError(
//         ErrorCode.VALIDATION_FAILED,
//         'Missing plan information',
//         'Plan or billing interval is missing. Please select a plan from pricing.',
//         ErrorContextBuilder.toString(context),
//       );
//       setState(errorState(missingError, null));
//       handleError(missingError, context);
//       router.push({
//         pathname: NavigationRoute.PRICING,
//       });
//       return;
//     }

//     if (isPaidPlan(selectedPlan) && !user.isEmailVerified) {
//       const emailError = ErrorMapper.createGenericError(
//         ErrorCode.AUTH_EMAIL_NOT_VERIFIED,
//         'Email verification required',
//         'Please verify your email address before proceeding with payment for a paid plan.',
//         ErrorContextBuilder.toString(context),
//         undefined,
//         false,
//       );
//       setState(errorState(emailError, null));
//       handleError(emailError, context);
//       router.push('/(auth)/email-verification');
//       return;
//     }

//     setState(
//       success({
//         selectedPlan,
//         selectedInterval,
//       }),
//     );
//   }, [
//     user?.id,
//     user?.subscription,
//     user?.isEmailVerified,
//     params.plan,
//     params.interval,
//     handleError,
//     router,
//   ]);

//   useEffect(() => {
//     loadSubscription();
//   }, [loadSubscription]);

//   const currentData = state.status === 'success' ? state.data : null;
//   const selectedPlan = currentData?.selectedPlan || user?.subscription?.plan;
//   const selectedInterval = currentData?.selectedInterval || user?.subscription?.billingCycle;

//   const validatePromoCode = useCallback(async () => {
//     if (!promoCode.trim() || !selectedPlan) {
//       setPromoError(null);
//       setPromoDiscount(null);
//       return;
//     }

//     setValidatingPromo(true);
//     setPromoError(null);

//     const result = await promoCodeService.validatePromoCode(promoCode.trim(), selectedPlan);

//     setValidatingPromo(false);

//     if (!isMountedRef.current) return;

//     if (result.success) {
//       setPromoDiscount(result.value.discountPercent);
//       setPromoError(null);
//     } else {
//       setPromoError(result.error.userMessage || 'Invalid promo code');
//       setPromoDiscount(null);
//       handleError(
//         result.error,
//         ErrorContextBuilder.fromComponent('PaymentScreen', 'validatePromoCode', user?.id),
//       );
//     }
//   }, [promoCode, selectedPlan, promoCodeService, handleError, user?.id]);

//   const handlePayment = useCallback(async () => {
//     if (!user?.id || !cardComplete || !selectedPlan || !selectedInterval) return;

//     if (isPaidPlan(selectedPlan) && !user.isEmailVerified) {
//       const context = ErrorContextBuilder.fromComponent('PaymentScreen', 'handlePayment', user.id);
//       const emailError = ErrorMapper.createGenericError(
//         ErrorCode.AUTH_EMAIL_NOT_VERIFIED,
//         'Email verification required',
//         'Please verify your email address before proceeding with payment for a paid plan.',
//         ErrorContextBuilder.toString(context),
//         undefined,
//         false,
//       );
//       handleError(emailError, context);
//       router.push('/(auth)/email-verification');
//       return;
//     }

//     setProcessing(true);

//     try {
//       const intentResult = await payment.createPaymentIntent(
//         user.id,
//         selectedPlan,
//         selectedInterval,
//         promoCode.trim() || undefined,
//       );

//       if (!isMountedRef.current) return;

//       if (!intentResult.success) {
//         handleError(
//           intentResult.error,
//           ErrorContextBuilder.fromComponent('PaymentScreen', 'handlePayment', user.id, undefined, {
//             step: 'createPaymentIntent',
//             plan: selectedPlan,
//             interval: selectedInterval,
//           }),
//         );
//         return;
//       }

//       const { clientSecret } = intentResult.value;

//       const { error, paymentIntent } = await confirmPayment(clientSecret, {
//         paymentMethodType: 'Card',
//       });

//       if (!isMountedRef.current) return;

//       if (error) {
//         const context = ErrorContextBuilder.fromComponent(
//           'PaymentScreen',
//           'handlePayment',
//           user.id,
//           undefined,
//           { step: 'confirmPayment', stripeError: error.code },
//         );
//         const stripeError = ErrorMapper.createGenericError(
//           ErrorCode.PAYMENT_FAILED,
//           error.message || 'Payment failed',
//           error.message || 'Payment failed. Please try again.',
//           ErrorContextBuilder.toString(context),
//           error,
//           true,
//         );
//         handleError(stripeError, context);
//         return;
//       }

//       if (paymentIntent?.status === 'Succeeded') {
//         if (isUpdateMode) {
//           if (!user?.subscription) {
//             handleError(
//               ErrorMapper.createGenericError(
//                 ErrorCode.VALIDATION_FAILED,
//                 'Subscription required',
//                 'Subscription is required to update payment method.',
//                 ErrorContextBuilder.toString(
//                   ErrorContextBuilder.fromComponent('PaymentScreen', 'handlePayment', user.id),
//                 ),
//               ),
//               ErrorContextBuilder.fromComponent('PaymentScreen', 'handlePayment', user.id),
//             );
//             return;
//           }
//           router.back();
//         } else {
//           const activationContext = ErrorContextBuilder.fromComponent(
//             'PaymentScreen',
//             'handlePayment',
//             user.id,
//             undefined,
//             { step: 'activateSubscription', paymentIntentId: paymentIntent.id },
//           );

//           const activationResult = await userService.updateSubscription(user.id, {
//             plan: selectedPlan,
//             status: SubscriptionStatus.ACTIVE,
//             isActive: true,
//             isTrial: false,
//             autoRenew: true,
//             billingCycle: selectedInterval,
//             startDate: new Date(),
//             lastPaymentDate: new Date(),
//           });

//           if (!isMountedRef.current) return;

//           if (!activationResult.success) {
//             handleError(activationResult.error, activationContext);
//             return;
//           }

//           const refreshed = await userService.getUser(user.id);
//           if (refreshed.success) {
//             useAuthStore.getState().setUser(refreshed.value);
//           }

//           const finalPrice = getPrice(selectedPlan, selectedInterval);
//           await payment.trackPaymentSuccess(user.id, selectedPlan, selectedInterval, finalPrice);

//           router.replace('/(protected)/(onboarding)/paid');
//         }
//       }
//     } catch (error) {
//       if (!isMountedRef.current) return;

//       const context = ErrorContextBuilder.fromComponent('PaymentScreen', 'handlePayment', user?.id);
//       const appError: AppError =
//         error !== null &&
//         typeof error === 'object' &&
//         'code' in error &&
//         'userMessage' in error &&
//         'timestamp' in error
//           ? (error as AppError)
//           : ErrorMapper.createGenericError(
//               ErrorCode.PAYMENT_FAILED,
//               'Payment processing failed',
//               'Payment processing failed. Please try again.',
//               ErrorContextBuilder.toString(context),
//               error,
//               true,
//             );

//       handleError(appError, context);
//     } finally {
//       if (isMountedRef.current) {
//         setProcessing(false);
//       }
//     }
//   }, [
//     user?.id,
//     user?.subscription,
//     cardComplete,
//     selectedPlan,
//     selectedInterval,
//     promoCode,
//     payment,
//     confirmPayment,
//     isUpdateMode,
//     handleError,
//     userService,
//   ]);

//   const isLoading = state.status === 'loading';
//   const error = state.status === 'error' ? state.error : null;

//   if (isLoading) {
//     return (
//       <Screen loading={true} scrollable={false}>
//         <View />
//       </Screen>
//     );
//   }

//   if (error) {
//     return (
//       <Screen error={error} onRetry={loadSubscription} scrollable={false}>
//         <View />
//       </Screen>
//     );
//   }

//   if (!selectedPlan || !selectedInterval) {
//     return (
//       <Screen scrollable={true}>
//         <View style={[{ padding: spacing.xxl, alignItems: 'center', justifyContent: 'center' }]}>
//           <StandardAppText style={[typography.headlineMedium, { marginBottom: spacing.md }]}>
//             Missing Plan Information
//           </StandardAppText>
//           <StandardAppText
//             style={[
//               typography.bodyMedium,
//               { marginBottom: spacing.lg, textAlign: 'center', color: colors.onSurfaceVariant },
//             ]}
//           >
//             Please select a plan from the pricing page.
//           </StandardAppText>
//           <StandardAppButton onPress={() => router.push('/(protected)/(payment)/pricing')}>
//             View Plans
//           </StandardAppButton>
//         </View>
//       </Screen>
//     );
//   }

//   // Calculate pricing
//   const basePrice = getPrice(selectedPlan, selectedInterval);
//   const discountAmount = promoDiscount !== null ? basePrice * (promoDiscount / 100) : 0;
//   const finalPrice = basePrice - discountAmount;
//   const formattedPrice = finalPrice.toFixed(2);
//   const formattedBasePrice = basePrice.toFixed(2);

//   return (
//     <Screen>
//       <ScrollView
//         contentContainerStyle={{
//           padding: spacing.xxl,
//           flexGrow: 1,
//         }}
//       >
//         <View style={{ maxWidth: 500, alignSelf: 'center', width: '100%' }}>
//           {/* Header */}
//           <StandardAppText style={[typography.displayLarge, { marginBottom: spacing.md }]}>
//             {isUpdateMode ? 'Update Payment' : 'Complete Purchase'}
//           </StandardAppText>

//           <StandardAppText
//             style={[
//               typography.bodyLarge,
//               { color: colors.onSurfaceVariant, marginBottom: spacing.xxl },
//             ]}
//           >
//             {isUpdateMode
//               ? 'Update your payment method for future billing cycles'
//               : `Subscribe to ${selectedPlan} plan and unlock all premium features`}
//           </StandardAppText>

//           {/* Plan Details Card - Only show for new payments */}
//           {!isUpdateMode && (
//             <>
//               <StandardAppCard variant="elevated">
//                 <Card.Content style={uiStyles.cardContent}>
//                   <View
//                     style={{
//                       flexDirection: 'row',
//                       justifyContent: 'space-between',
//                       alignItems: 'center',
//                       marginBottom: spacing.md,
//                     }}
//                   >
//                     <View style={{ flex: 1 }}>
//                       <StandardAppText style={typography.headlineMedium}>
//                         {selectedPlan} Plan
//                       </StandardAppText>
//                       <StandardAppText
//                         style={[
//                           typography.bodyMedium,
//                           { color: colors.onSurfaceVariant, marginTop: spacing.xs },
//                         ]}
//                       >
//                         {selectedInterval === BillingCycle.MONTHLY
//                           ? 'Billed monthly'
//                           : 'Billed annually'}
//                       </StandardAppText>
//                     </View>

//                     <View style={{ alignItems: 'flex-end' }}>
//                       {promoDiscount !== null && (
//                         <StandardAppText
//                           style={[
//                             typography.bodyMedium,
//                             {
//                               color: colors.onSurfaceVariant,
//                               textDecorationLine: 'line-through',
//                               marginBottom: spacing.xs,
//                             },
//                           ]}
//                         >
//                           £{formattedBasePrice}
//                         </StandardAppText>
//                       )}
//                       <StandardAppText style={[typography.displayLarge, { color: colors.primary }]}>
//                         £{formattedPrice}
//                       </StandardAppText>
//                       <StandardAppText
//                         style={[
//                           typography.labelMedium,
//                           { color: colors.onSurfaceVariant, marginTop: spacing.xs },
//                         ]}
//                       >
//                         {selectedInterval === BillingCycle.MONTHLY ? 'per month' : 'per year'}
//                       </StandardAppText>
//                     </View>
//                   </View>

//                   {promoDiscount !== null && (
//                     <>
//                       <StandardAppDivider />
//                       <View
//                         style={{
//                           backgroundColor: colors.primaryContainer,
//                           padding: spacing.md,
//                           borderRadius: 8,
//                           marginTop: spacing.md,
//                         }}
//                       >
//                         <StandardAppText
//                           style={[typography.labelLarge, { color: colors.onPrimaryContainer }]}
//                         >
//                           🎉 {promoDiscount}% discount applied!
//                         </StandardAppText>
//                         <StandardAppText
//                           style={[
//                             typography.bodySmall,
//                             { color: colors.onPrimaryContainer, marginTop: spacing.xs },
//                           ]}
//                         >
//                           You're saving £{discountAmount.toFixed(2)}
//                         </StandardAppText>
//                       </View>
//                     </>
//                   )}
//                 </Card.Content>
//               </StandardAppCard>

//               <StandardSpacer size="lg" />
//             </>
//           )}

//           {/* Promo Code Card - Only show for new payments */}
//           {!isUpdateMode && (
//             <>
//               <StandardAppCard>
//                 <Card.Content style={uiStyles.cardContent}>
//                   <StandardAppText style={[typography.titleLarge, { marginBottom: spacing.md }]}>
//                     Have a Promo Code?
//                   </StandardAppText>

//                   <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
//                     <View style={{ flex: 1 }}>
//                       <StandardAppTextInput
//                         label="Enter promo code"
//                         value={promoCode}
//                         onChangeText={text => {
//                           setPromoCode(text.toUpperCase());
//                           setPromoError(null);
//                           setPromoDiscount(null);
//                         }}
//                         autoCapitalize="characters"
//                         editable={!validatingPromo && !processing}
//                         error={!!promoError}
//                         style={{ marginBottom: promoError ? spacing.xs : 0 }}
//                       />
//                       {promoError && (
//                         <StandardAppText
//                           style={[
//                             typography.bodySmall,
//                             { color: colors.error, marginTop: spacing.xs },
//                           ]}
//                         >
//                           {promoError}
//                         </StandardAppText>
//                       )}
//                     </View>
//                     <StandardAppButton
//                       mode="outlined"
//                       onPress={validatePromoCode}
//                       disabled={!promoCode.trim() || validatingPromo || processing}
//                       loading={validatingPromo}
//                       style={{ marginTop: 0 }}
//                     >
//                       Apply
//                     </StandardAppButton>
//                   </View>
//                 </Card.Content>
//               </StandardAppCard>

//               <StandardSpacer size="lg" />
//             </>
//           )}

//           {/* Payment Information Card */}
//           <StandardAppCard variant="elevated">
//             <Card.Content style={uiStyles.cardContent}>
//               <StandardAppText style={[typography.titleLarge, { marginBottom: spacing.md }]}>
//                 Payment Information
//               </StandardAppText>

//               <StandardAppText
//                 style={[
//                   typography.bodyMedium,
//                   { color: colors.onSurfaceVariant, marginBottom: spacing.lg },
//                 ]}
//               >
//                 Enter your card details to complete the payment
//               </StandardAppText>

//               <CardField
//                 postalCodeEnabled={true}
//                 onCardChange={cardDetails => {
//                   setCardComplete(cardDetails.complete);
//                 }}
//                 cardStyle={{
//                   backgroundColor: colors.surface,
//                   textColor: colors.onSurface,
//                 }}
//                 style={{
//                   width: '100%',
//                   height: 50,
//                   marginBottom: spacing.lg,
//                 }}
//               />

//               <StandardAppButton
//                 onPress={handlePayment}
//                 disabled={!cardComplete || processing}
//                 mode="contained"
//                 loading={processing}
//               >
//                 {processing
//                   ? 'Processing Payment...'
//                   : isUpdateMode
//                     ? 'Update Payment Method'
//                     : `Pay £${formattedPrice}`}
//               </StandardAppButton>

//               <StandardSpacer size="md" />

//               {/* Security Notice */}
//               <View
//                 style={{
//                   flexDirection: 'row',
//                   alignItems: 'center',
//                   justifyContent: 'center',
//                   backgroundColor: colors.surfaceVariant,
//                   padding: spacing.md,
//                   borderRadius: 8,
//                 }}
//               >
//                 <StandardAppText style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>
//                   🔒 Secure payment powered by Stripe
//                 </StandardAppText>
//               </View>
//             </Card.Content>
//           </StandardAppCard>

//           <StandardSpacer size="xxl" />
//         </View>
//       </ScrollView>
//     </Screen>
//   );
// }
