import React from 'react';
import BrandPanel from '@/components/auth/BrandPanel';
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';

export const metadata = {
  title: 'Forgot Password - Delisas',
  description: 'Reset your Delisas account password',
};

export default function ForgotPasswordPage() {
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
      <ForgotPasswordForm />
    </div>
  );
}
