'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { MailIcon, ArrowLeftIcon, CheckCircleIcon } from '@/components/icons';

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    // Simulate network request
    setTimeout(() => {
      setIsLoading(false);
      setSubmitted(true);
      setResendStatus(null);
    }, 600);
  };

  const handleResend = () => {
    setResendStatus('Sending...');
    setTimeout(() => {
      setResendStatus('Reset link resent successfully!');
      setTimeout(() => setResendStatus(null), 3000);
    }, 600);
  };

  return (
    <main
      style={{
        flex: '1 1 58%',
        minWidth: 'min(380px, 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        boxSizing: 'border-box',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: '440px',
          padding: '40px',
          background: '#FFFFFF',
          borderRadius: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '28px',
          boxSizing: 'border-box',
          boxShadow: '0 2px 8px rgba(17, 24, 39, 0.04)',
        }}
      >
        {!submitted ? (
          <>
            {/* Header */}
            <div>
              <Link
                href="/login"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#4B5263',
                  textDecoration: 'none',
                  marginBottom: '20px',
                  transition: 'color 0.15s ease',
                }}
              >
                <ArrowLeftIcon />
                Back to sign in
              </Link>
              <h1
                style={{
                  margin: 0,
                  fontSize: '28px',
                  fontWeight: 600,
                  lineHeight: '36px',
                  color: '#111827',
                }}
              >
                Forgot password?
              </h1>
              <p
                style={{
                  margin: '8px 0 0 0',
                  fontSize: '16px',
                  fontWeight: 500,
                  lineHeight: '24px',
                  color: '#4B5263',
                }}
              >
                No worries! Enter the email address associated with your account and we&apos;ll send you instructions to reset your password.
              </p>
            </div>

            {/* Form */}
            <form
              noValidate
              onSubmit={handleSubmit}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
              }}
            >
              {/* Email field */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label
                  htmlFor="reset-email"
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    lineHeight: '20px',
                    color: '#1F2937',
                    marginBottom: '8px',
                    display: 'block',
                  }}
                >
                  Email address
                </label>
                <div
                  className="dl-field"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '9px',
                    height: '48px',
                    borderRadius: '24px',
                    border: '1px solid #E6E8EC',
                    background: '#FFFFFF',
                    padding: '0 15px',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                  }}
                >
                  <span style={{ color: '#2A3040', display: 'flex', alignItems: 'center', flex: 'none' }}>
                    <MailIcon />
                  </span>
                  <input
                    id="reset-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      border: 0,
                      outline: 'none',
                      background: 'transparent',
                      fontFamily: 'inherit',
                      fontSize: '16px',
                      color: '#111827',
                    }}
                  />
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '48px',
                  borderRadius: '24px',
                  background: 'var(--accent)',
                  color: '#FFFFFF',
                  border: 0,
                  fontSize: '16px',
                  fontWeight: 500,
                  fontFamily: 'inherit',
                  cursor: isLoading ? 'default' : 'pointer',
                  opacity: isLoading ? 0.8 : 1,
                  transition: 'opacity 0.15s ease, transform 0.1s ease',
                }}
              >
                {isLoading ? 'Sending instructions...' : 'Send reset instructions'}
              </button>
            </form>

            {/* Bottom link */}
            <div
              style={{
                textAlign: 'center',
                fontSize: '14px',
                fontWeight: 500,
                color: '#4B5263',
              }}
            >
              Remember your password?{' '}
              <Link
                href="/login"
                style={{
                  fontWeight: 600,
                  color: 'color-mix(in srgb, var(--accent) 82%, black)',
                  textDecoration: 'none',
                }}
              >
                Sign in
              </Link>
            </div>
          </>
        ) : (
          /* Success State */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: '20px',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#ECFDF5',
                color: '#10B981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircleIcon width={32} height={32} />
            </div>

            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: '24px',
                  fontWeight: 600,
                  lineHeight: '32px',
                  color: '#111827',
                }}
              >
                Check your email
              </h1>
              <p
                style={{
                  margin: '10px 0 0 0',
                  fontSize: '15px',
                  fontWeight: 500,
                  lineHeight: '22px',
                  color: '#4B5263',
                }}
              >
                We have sent a password reset link to{' '}
                <span style={{ fontWeight: 600, color: '#111827' }}>{email || 'your email'}</span>.
                Please check your inbox.
              </p>
            </div>

            {resendStatus && (
              <div
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  background: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  color: '#166534',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
              >
                {resendStatus}
              </div>
            )}

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
              <Link
                href="/login"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '48px',
                  borderRadius: '24px',
                  background: 'var(--accent)',
                  color: '#FFFFFF',
                  textDecoration: 'none',
                  fontSize: '16px',
                  fontWeight: 500,
                  transition: 'opacity 0.15s ease',
                }}
              >
                Back to sign in
              </Link>

              <button
                type="button"
                onClick={handleResend}
                style={{
                  background: 'transparent',
                  border: 0,
                  color: '#4B5263',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  padding: '8px',
                  fontFamily: 'inherit',
                }}
              >
                Didn&apos;t receive the email?{' '}
                <span
                  style={{
                    color: 'color-mix(in srgb, var(--accent) 82%, black)',
                    fontWeight: 600,
                  }}
                >
                  Click to resend
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setResendStatus(null);
                }}
                style={{
                  background: 'transparent',
                  border: 0,
                  color: '#8A90A0',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Try another email
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
