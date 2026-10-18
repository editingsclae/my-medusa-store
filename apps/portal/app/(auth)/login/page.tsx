import React from 'react';
import BrandPanel from '@/components/auth/BrandPanel';
import LoginForm from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
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
  );
}
