import React, { useMemo, useState } from 'react';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SignupPageProps {
  onRegister: (data: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) => Promise<{ success: boolean; message: string; user?: { id: string; name: string; email: string } }>;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const SignupPage: React.FC<SignupPageProps> = ({ onRegister }) => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordRules = useMemo(() => [
    { label: 'At least 8 characters', valid: form.password.length >= 8 },
    { label: 'One uppercase letter', valid: /[A-Z]/.test(form.password) },
    { label: 'One lowercase letter', valid: /[a-z]/.test(form.password) },
    { label: 'One number', valid: /\d/.test(form.password) },
  ], [form.password]);

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!form.name.trim()) {
      nextErrors.name = 'Full name is required.';
    }

    if (!form.email.trim()) {
      nextErrors.email = 'Email is required.';
    } else if (!emailRegex.test(form.email.trim())) {
      nextErrors.email = 'Please enter a valid email address.';
    }

    if (!form.password) {
      nextErrors.password = 'Password is required.';
    } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(form.password)) {
      nextErrors.password = 'Password must be at least 8 characters and include uppercase, lowercase, and a number.';
    }

    if (!form.confirmPassword) {
      nextErrors.confirmPassword = 'Please confirm your password.';
    } else if (form.confirmPassword !== form.password) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
    setSubmitError('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError('');

    if (!validate()) {
      return;
    }

    setLoading(true);
    try {
      const response = await onRegister({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
      });

      if (!response.success) {
        setSubmitError(response.message || 'Unable to create your account. Please try again.');
        return;
      }

      navigate('/', {
        replace: true,
        state: { successMessage: 'Account created successfully. Please sign in.' },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to create your account. Please try again.';
      setSubmitError(message);
    } finally {
      setLoading(false);
    }
  };

  const renderField = (
    id: string,
    label: string,
    type: 'text' | 'email' | 'password',
    value: string,
    onChange: (value: string) => void,
    placeholder?: string,
    showToggle?: {
      visible: boolean;
      onToggle: () => void;
    }
  ) => {
    const fieldError = errors[id];

    return (
      <div style={{ marginBottom: '16px' }}>
        <label
          htmlFor={id}
          style={{
            display: 'block',
            fontSize: '12.5px',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            marginBottom: '6px',
          }}
        >
          {label}
        </label>
        <div style={{ position: 'relative' }}>
          <input
            id={id}
            type={type === 'password' && showToggle ? (showToggle.visible ? 'text' : 'password') : type}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            autoComplete={type === 'email' ? 'email' : type === 'password' ? 'new-password' : 'name'}
            style={{
              width: '100%',
              height: '40px',
              padding: type === 'password' ? '0 40px 0 12px' : '0 12px',
              border: `1px solid ${fieldError ? '#fca5a5' : 'var(--border-default)'}`,
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              color: 'var(--text-primary)',
              backgroundColor: 'var(--bg-surface-secondary)',
              outline: 'none',
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = fieldError ? '#fca5a5' : 'var(--accent-primary)';
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(37, 99, 235, 0.15)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = fieldError ? '#fca5a5' : 'var(--border-default)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
          {showToggle && (
            <button
              type="button"
              onClick={showToggle.onToggle}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                padding: '4px',
              }}
              aria-label={showToggle.visible ? 'Hide password' : 'Show password'}
            >
              {showToggle.visible ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          )}
        </div>
        {fieldError && (
          <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '6px' }}>{fieldError}</div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--bg-app)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '24px',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle at 25% 25%, rgba(37, 99, 235, 0.04) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(37, 99, 235, 0.03) 0%, transparent 50%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            padding: '32px 36px 18px',
            borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <button
            type="button"
            onClick={() => navigate('/')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '32px',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                padding: '3px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <img src="/logo.svg" alt="RoboPulse logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div>
              <div
                style={{
                  fontSize: '22px',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                }}
              >
                <span style={{ color: '#1769D1' }}>Robo</span><span style={{ color: '#F57C00' }}>Pulse</span>
              </div>
              <div
                style={{
                  fontSize: '10.5px',
                  color: 'var(--text-muted)',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                INDUSTRIAL MONITORING
              </div>
            </div>
          </button>

          <h2
            style={{
              fontSize: '17px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Create your RoboPulse account
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Register to access the industrial monitoring console
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px 36px 32px' }}>
          {submitError && (
            <div
              style={{
                marginBottom: '16px',
                padding: '10px 14px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 'var(--radius-sm)',
                color: '#dc2626',
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              {submitError}
            </div>
          )}

          {renderField('name', 'Full Name', 'text', form.name, (value) => handleChange('name', value), 'Enter your full name')}
          {renderField('email', 'Email Address', 'email', form.email, (value) => handleChange('email', value), 'name@company.com')}
          {renderField('password', 'Password', 'password', form.password, (value) => handleChange('password', value), 'Create a password', {
            visible: showPassword,
            onToggle: () => setShowPassword((value) => !value),
          })}
          {renderField('confirmPassword', 'Confirm Password', 'password', form.confirmPassword, (value) => handleChange('confirmPassword', value), 'Re-enter your password', {
            visible: showConfirmPassword,
            onToggle: () => setShowConfirmPassword((value) => !value),
          })}

          <div style={{ marginTop: '8px', marginBottom: '20px' }}>
            {passwordRules.map((rule) => (
              <div
                key={rule.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  color: rule.valid ? '#166534' : '#64748b',
                  marginBottom: '4px',
                }}
              >
                <span style={{ fontWeight: 700 }}>{rule.valid ? '✓' : '•'}</span>
                <span>{rule.label}</span>
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              height: '42px',
              backgroundColor: loading ? '#93c5fd' : 'var(--accent-primary)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (!loading) e.currentTarget.style.backgroundColor = 'var(--accent-primary-hover)';
            }}
            onMouseLeave={(e) => {
              if (!loading) e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
            }}
          >
            <UserPlus size={16} />
            <span>{loading ? 'Creating account...' : 'Create Account'}</span>
          </button>

          <div style={{ textAlign: 'center', marginTop: '18px' }}>
            <button
              type="button"
              onClick={() => navigate('/')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Already have an account? <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Sign in</span>
            </button>
          </div>
        </form>

        <div
          style={{
            padding: '14px 36px',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface-secondary)',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
            RoboPulse Industrial Predictive Maintenance Platform
          </p>
        </div>
      </div>
    </div>
  );
};
