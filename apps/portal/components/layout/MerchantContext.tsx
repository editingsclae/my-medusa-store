'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { endSession, getMerchantMe, getStoredToken, MerchantProfile } from '@/lib/medusa';

interface MerchantState {
  profile: MerchantProfile | null;
  loading: boolean;
  failed: boolean;
}

const MerchantContext = createContext<MerchantState>({
  profile: null,
  loading: true,
  failed: false,
});

// Loads the signed in merchant once for the whole portal. The top bar and the
// sidebar both read it from here: one request, and neither shows placeholder
// names while it is loading (they show skeletons instead).
export function MerchantProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<MerchantState>({
    profile: null,
    loading: true,
    failed: false,
  });

  // Signed out, or signed out in another tab: back to the login page
  useEffect(() => {
    if (!getStoredToken()) {
      endSession('signed_out');
      return;
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'merchant_token' && !e.newValue) {
        endSession('signed_out');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!getStoredToken()) return;
    let alive = true;
    getMerchantMe()
      .then((profile) => {
        if (alive) setState({ profile, loading: false, failed: false });
      })
      .catch(() => {
        if (alive) setState({ profile: null, loading: false, failed: true });
      });
    return () => {
      alive = false;
    };
  }, []);

  return <MerchantContext.Provider value={state}>{children}</MerchantContext.Provider>;
}

export function useMerchant(): MerchantState {
  return useContext(MerchantContext);
}
