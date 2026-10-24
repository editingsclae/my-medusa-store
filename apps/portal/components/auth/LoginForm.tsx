'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MailIcon, LockIcon, EyeIcon, EyeOffIcon, CheckIcon } from '@/components/icons';
import { loginMerchant } from '@/lib/medusa';

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter your email and password');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { profile } = await loginMerchant(email.trim(), password);
      // Platform admins have no store of their own; their page is the merchant list
      router.push(profile.is_super_admin ? '/merchants' : '/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials or login failed');
    } finally {
      setLoading(false);
    }
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
        }}
      >
        {/* Header */}
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: '28px',
              fontWeight: 600,
              lineHeight: '36px',
              color: '#111827',
            }}
          >
            Welcome back
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
            Enter your details to sign in to your account.
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              background: '#FEE2E2',
              color: '#DC2626',
              fontSize: '14px',
              fontWeight: 500,
              border: '1px solid #FCA5A5',
            }}
          >
            {error}
          </div>
        )}

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
              htmlFor="login-email"
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
                id="login-email"
                type="email"
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

          {/* Password field */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                marginBottom: '8px',
              }}
            >
              <label
                htmlFor="login-password"
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  lineHeight: '20px',
                  color: '#1F2937',
                }}
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  lineHeight: '20px',
                  color: 'color-mix(in srgb, var(--accent) 82%, black)',
                  textDecoration: 'none',
                }}
              >
                Forgot password?
              </Link>
            </div>
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
                padding: '0 8px 0 15px',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
              }}
            >
              <span style={{ color: '#2A3040', display: 'flex', alignItems: 'center', flex: 'none' }}>
                <LockIcon />
              </span>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
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
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  width: '32px',
                  height: '32px',
                  boxSizing: 'border-box',
                  borderRadius: '50%',
                  border: 0,
                  background: 'transparent',
                  color: '#4B5263',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                  flex: 'none',
                }}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          {/* Remember me */}
          <label
            className="dl-cb"
            style={{
              alignSelf: 'flex-start',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: 500,
              lineHeight: '20px',
              color: '#1F2937',
              cursor: 'pointer',
            }}
          >
            <span style={{ position: 'relative', width: '16px', height: '16px', flex: 'none', display: 'block' }}>
              <span
                style={{
                  boxSizing: 'border-box',
                  width: '16px',
                  height: '16px',
                  borderRadius: '4px',
                  border: rememberMe ? '1.5px solid var(--accent)' : '1.5px solid #C9CED8',
                  background: rememberMe ? 'var(--accent)' : '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.15s ease, border-color 0.15s ease',
                }}
              >
                {rememberMe && <CheckIcon />}
              </span>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '16px',
                  height: '16px',
                  margin: 0,
                  opacity: 0,
                  cursor: 'pointer',
                }}
              />
            </span>
            Remember me
          </label>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '48px',
              borderRadius: '24px',
              border: 0,
              background: loading ? '#9CA3AF' : 'var(--accent)',
              color: '#FFFFFF',
              fontSize: '16px',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
            }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

      </section>
    </main>
  );
}
