'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getMerchantMe, getStoredToken, removeStoredToken } from '@/lib/medusa';

// Wraps the login page. A merchant who is already signed in (a new tab, or the
// portal address typed again) goes straight to the portal instead of seeing the
// login form. `hasSession` comes from the server (the session cookie), so a
// signed in merchant never sees the form flash while the session is checked.
export default function LoginGate({
  hasSession,
  children,
}: {
  hasSession: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [checking, setChecking] = useState(hasSession);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('expired') === '1') {
      setExpired(true);
    }

    if (!getStoredToken()) {
      // The cookie outlived the stored token: nothing to check
      removeStoredToken();
      setChecking(false);
      return;
    }

    let alive = true;
    getMerchantMe()
      .then((profile) => {
        if (!alive) return;
        // Platform admins have no store of their own; their page is the merchant list
        router.replace(profile.is_super_admin ? '/merchants' : '/dashboard');
      })
      .catch(() => {
        if (!alive) return;
        // Token refused (expired): clear it and show the form
        removeStoredToken();
        setExpired(true);
        setChecking(false);
      });
    return () => {
      alive = false;
    };
  }, [router]);

  if (checking) {
    return <div style={{ minHeight: '100vh', background: '#F6F7F9' }} aria-busy="true" />;
  }

  return (
    <>
      {expired && (
        <div
          role="status"
          style={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            maxWidth: 'calc(100vw - 32px)',
            padding: '10px 16px',
            borderRadius: 10,
            background: '#FFFAF0',
            border: '1px solid #F7D9A3',
            color: '#B45309',
            fontFamily: 'Urbanist, sans-serif',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Your session has ended. Please sign in again.
        </div>
      )}
      {children}
    </>
  );
}
