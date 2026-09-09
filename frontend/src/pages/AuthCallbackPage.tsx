/**
 * AuthCallbackPage
 *
 * The backend Google OAuth callback redirects to:
 *   /auth/callback#token=<url-encoded JSON>
 *
 * This page reads the token from the URL hash, stores it the same
 * way a normal username/password login does, and then navigates the
 * user to /overview.
 *
 * If the hash is missing or invalid, the user is redirected to the
 * login page with a clean error message.
 */

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface AuthCallbackPageProps {
  onGoogleLogin: (token: string, user: {
    id: string;
    username: string;
    name?: string;
    email?: string | null;
    role: string;
  }) => void;
}

export const AuthCallbackPage: React.FC<AuthCallbackPageProps> = ({ onGoogleLogin }) => {
  const navigate = useNavigate();

  useEffect(() => {
    // The backend encodes the payload in the URL hash to keep it out of
    // server access logs.  Format: #token=<urlencoded JSON>
    const hash = window.location.hash;

    if (!hash.startsWith('#token=')) {
      // No payload — could be a direct navigation or a stale redirect.
      navigate('/?google_error=auth_failed', { replace: true });
      return;
    }

    try {
      const encoded = hash.slice('#token='.length);
      const payload = JSON.parse(decodeURIComponent(encoded)) as {
        token: string;
        user: {
          id: string;
          username: string;
          name?: string;
          email?: string | null;
          role: string;
        };
      };

      if (!payload.token || !payload.user?.id) {
        throw new Error('Incomplete payload');
      }

      // Hand off to the App-level handler (same path as username/password login)
      onGoogleLogin(payload.token, payload.user);

      // Clear the hash from the address bar so the token does not linger
      window.history.replaceState(null, '', window.location.pathname);

      navigate('/overview', { replace: true });
    } catch {
      // Deliberately no detail — do not expose token values in any error message
      navigate('/?google_error=auth_failed', { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#eef2f7',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        zIndex: 9999,
      }}
    >
      {/* Minimal spinner */}
      <div
        style={{
          width: '44px',
          height: '44px',
          border: '4px solid #e2e8f0',
          borderTopColor: '#2563eb',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <p
        style={{
          margin: 0,
          fontSize: '15px',
          fontWeight: 600,
          color: '#334155',
          fontFamily: '-apple-system, "Segoe UI", system-ui, sans-serif',
        }}
      >
        Completing sign-in…
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
