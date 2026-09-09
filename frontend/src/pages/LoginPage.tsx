import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<unknown>;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const message = (location.state as { successMessage?: string } | null)?.successMessage;
    if (message) {
      setSuccessMessage(message);
      window.history.replaceState({}, '', '/');
    }
  }, [location.state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    if (!password.trim()) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      await onLogin(username.trim(), password);
    } catch (loginError: unknown) {
      const message = loginError instanceof Error ? loginError.message : 'Invalid username or password';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Input field shared styles
  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: '50px',
    padding: '0 16px',
    border: '1.5px solid #d1d9e6',
    borderRadius: '12px',
    fontSize: '14.5px',
    color: '#1e293b',
    backgroundColor: '#ffffff',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    fontFamily: 'inherit',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#eef2f7',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '24px',
        overflowY: 'auto',
      }}
    >
      {/* Main auth card */}
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '20px',
          boxShadow:
            '0 4px 6px -1px rgba(0, 0, 0, 0.04), 0 20px 40px -8px rgba(0, 0, 0, 0.08)',
          padding: '40px 40px 32px',
          position: 'relative',
        }}
      >
        {/* ── Branding block ── */}
        <button
          type="button"
          onClick={() => navigate('/')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            marginBottom: '32px',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              width: '60px',
              height: '60px',
              backgroundColor: '#ffffff',
              border: '1.5px solid #e2e8f0',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              padding: '6px',
              boxShadow: '0 1px 4px 0 rgba(0, 0, 0, 0.07)',
              flexShrink: 0,
            }}
          >
            <img
              src="/logo.svg"
              alt="RoboPulse logo"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <div>
            <div
              style={{
                fontSize: '30px',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
              }}
            >
              <span style={{ color: '#1769D1' }}>Robo</span>
              <span style={{ color: '#F57C00' }}>Pulse</span>
            </div>
            <div
              style={{
                fontSize: '11px',
                color: '#64748b',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginTop: '4px',
              }}
            >
              INDUSTRIAL MONITORING
            </div>
          </div>
        </button>

        {/* ── Heading ── */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h1
            style={{
              fontSize: '26px',
              fontWeight: 800,
              color: '#0f172a',
              margin: '0 0 10px',
              letterSpacing: '-0.03em',
            }}
          >
            Sign in to your account
          </h1>
          <p
            style={{
              fontSize: '14px',
              color: '#64748b',
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            Enter your credentials to access the
            <br />
            monitoring console
          </p>
        </div>

        {/* ── Feedback banners ── */}
        {error && (
          <div
            style={{
              marginBottom: '20px',
              padding: '12px 16px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '10px',
              color: '#dc2626',
              fontSize: '13.5px',
              fontWeight: 500,
              lineHeight: 1.4,
            }}
          >
            {error}
          </div>
        )}

        {successMessage && (
          <div
            style={{
              marginBottom: '20px',
              padding: '12px 16px',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '10px',
              color: '#166534',
              fontSize: '13.5px',
              fontWeight: 500,
            }}
          >
            {successMessage}
          </div>
        )}

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} noValidate>
          {/* Username */}
          <div style={{ marginBottom: '18px' }}>
            <label
              htmlFor="login-username"
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 700,
                color: '#0f172a',
                marginBottom: '8px',
              }}
            >
              Username
            </label>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              placeholder="Enter your email or username"
              style={inputStyle}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#d1d9e6';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: '24px' }}>
            <label
              htmlFor="login-password"
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 700,
                color: '#0f172a',
                marginBottom: '8px',
              }}
            >
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                style={{ ...inputStyle, paddingRight: '48px' }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#3b82f6';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#d1d9e6';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                  lineHeight: 0,
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </div>

          {/* Sign In button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              height: '52px',
              backgroundColor: loading ? '#93c5fd' : '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '9px',
              transition: 'background-color 0.15s ease, transform 0.1s ease',
              boxSizing: 'border-box',
              letterSpacing: '0.01em',
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = '#1d4ed8';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = '#2563eb';
              }
            }}
            onMouseDown={(e) => {
              if (!loading) e.currentTarget.style.transform = 'scale(0.99)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <LogIn size={18} />
            <span>{loading ? 'Signing in…' : 'Sign In'}</span>
          </button>

          {/* Create account link */}
          <div
            style={{
              textAlign: 'center',
              marginTop: '22px',
              fontSize: '14px',
              color: '#334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
            }}
          >
            <span style={{ fontWeight: 500 }}>Don't have an account?</span>
            <button
              type="button"
              onClick={() => navigate('/signup')}
              style={{
                background: 'none',
                border: 'none',
                color: '#2563eb',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'none',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.textDecoration = 'underline';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textDecoration = 'none';
              }}
            >
              Create an account
            </button>
          </div>
        </form>

        {/* ── Footer ── */}
        <div
          style={{
            borderTop: '1px solid #f1f5f9',
            marginTop: '28px',
            paddingTop: '20px',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '12px',
              color: '#94a3b8',
              fontWeight: 500,
              letterSpacing: '0.01em',
            }}
          >
            RoboPulse Industrial Predictive Maintenance Platform
          </p>
        </div>
      </div>
    </div>
  );
};
