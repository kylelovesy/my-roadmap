/*---------------------------------------
File: app/(protected)/(payment)/_layout.tsx
Description: Payment routes - always accessible (Q14)
Author: Kyle Lovesy
Date: 2025-01-XX
Version: 2.0.0
---------------------------------------*/

import { Slot } from 'expo-router';
import { useUserState } from '@/hooks/use-user-state';
import { LoadingIndicator } from '@/components/common/loading-indicator';
// import { EmailVerificationPrompt } from '@/components/post-auth-setup/EmailVerificationPrompts';
import { EmailVerificationModal } from '@/components/pricing/EmailVerificationModal';

/**
 * Payment routes protection layer
 * - Always accessible (Q14) - users can upgrade from anywhere
 * - Shows email verification prompt if attempting payment without verification (Q3)
 */
export default function PaymentLayout() {
  const { state, loading } = useUserState();

  if (loading || !state) {
    return <LoadingIndicator />;
  }

  // Payment routes always accessible (Q14)
  // But show verification prompt if email not verified (Q3)
  return (
    <>
      {!state.context.isEmailVerified && (
        <EmailVerificationModal visible={true} onClose={() => {}} onVerified={() => {}} />
      )}
      <Slot />
    </>
  );
}
