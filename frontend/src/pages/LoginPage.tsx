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

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '24px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(37, 99, 235, 0.03) 0%, transparent 40%), radial-gradient(circle at 80% 80%, rgba(37, 99, 235, 0.02) 0%, transparent 40%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          width: '100%',
          maxWidth: '430px',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '18px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03)',
          position: 'relative',
          padding: '36px 36px 28px',
        }}
      >
        {/* Branding Block */}
        <button
          type="button"
          onClick={() => navigate('/')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            marginBottom: '36px',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              width: '54px',
              height: '54px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              padding: '4px',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
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
                fontSize: '28px',
                fontWeight: 800,
                color: '#0f172a',
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
              }}
            >
              RoboPulse
            </div>
            <div
              style={{
                fontSize: '11px',
                color: '#64748b',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginTop: '3px',
              }}
            >
              INDUSTRIAL MONITORING
            </div>
          </div>
        </button>

        {/* Heading & Subtitle */}
        <div style={{ textAlign: 'center', marginBottom: '26px' }}>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 800,
              color: '#0f172a',
              margin: '0 0 8px',
              letterSpacing: '-0.025em',
            }}
          >
            Sign in to your account
          </h1>
          <p
            style={{
              fontSize: '13.5px',
              color: '#64748b',
              margin: 0,
              lineHeight: 1.45,
              maxWidth: '300px',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            Enter your credentials to access the monitoring console
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {error && (
            <div
              style={{
                marginBottom: '18px',
                padding: '10px 14px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#dc2626',
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              {error}
            </div>
          )}

          {successMessage && (
            <div
              style={{
                marginBottom: '18px',
                padding: '10px 14px',
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: '8px',
                color: '#166534',
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              {successMessage}
            </div>
          )}

          {/* Username Field */}
          <div style={{ marginBottom: '18px' }}>
            <label
              htmlFor="login-username"
              style={{
                display: 'block',
                fontSize: '13.5px',
                fontWeight: 600,
                color: '#0f172a',
                marginBottom: '6px',
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
              style={{
                width: '100%',
                height: '44px',
                padding: '0 14px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#0f172a',
                backgroundColor: '#ffffff',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.15)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#cbd5e1';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Password Field */}
          <div style={{ marginBottom: '22px' }}>
            <label
              htmlFor="login-password"
              style={{
                display: 'block',
                fontSize: '13.5px',
                fontWeight: 600,
                color: '#0f172a',
                marginBottom: '6px',
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
                style={{
                  width: '100%',
                  height: '44px',
                  padding: '0 42px 0 14px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: '#0f172a',
                  backgroundColor: '#ffffff',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#3b82f6';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.15)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#64748b',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              height: '46px',
              backgroundColor: loading ? '#93c5fd' : '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14.5px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background-color 0.15s ease',
              boxSizing: 'border-box',
            }}
            onMouseEnter={(e) => {
              if (!loading) e.currentTarget.style.backgroundColor = '#1d4ed8';
            }}
            onMouseLeave={(e) => {
              if (!loading) e.currentTarget.style.backgroundColor = '#2563eb';
            }}
          >
            <LogIn size={17} />
            <span>{loading ? 'Signing in...' : 'Sign In'}</span>
          </button>

          {/* Sign Up Navigation */}
          <div
            style={{
              textAlign: 'center',
              marginTop: '18px',
              marginBottom: '24px',
              fontSize: '13.5px',
              color: '#334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
            }}
          >
            <span>Don't have an account?</span>
            <button
              type="button"
              onClick={() => navigate('/signup')}
              style={{
                background: 'none',
                border: 'none',
                color: '#2563eb',
                fontWeight: 600,
                fontSize: '13.5px',
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'none',
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

        {/* Footer Divider & Text */}
        <div
          style={{
            borderTop: '1px solid #e2e8f0',
            paddingTop: '18px',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '12px',
              color: '#64748b',
              fontWeight: 500,
              lineHeight: 1.4,
            }}
          >
            RoboPulse Industrial Predictive Maintenance Platform
          </p>
        </div>
      </div>
    </div>
  );
};

