import React from 'react';
import { cookies } from 'next/headers';
import BrandPanel from '@/components/auth/BrandPanel';
import LoginForm from '@/components/auth/LoginForm';
import LoginGate from '@/components/auth/LoginGate';

export default async function LoginPage() {
  // The portal sets this cookie when a merchant signs in. It only tells the page
  // that a session may exist; the gate checks it with the server.
  const hasSession = (await cookies()).has('merchant_token');

  return (
    <LoginGate hasSession={hasSession}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          minHeight: '100vh',
          background: '#F6F7F9',
          fontFamily: 'Urbanist, sans-serif',
        }}
      >
        <BrandPanel />
        <LoginForm />
      </div>
    </LoginGate>
  );
}
