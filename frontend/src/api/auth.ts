import { apiClient } from './client';

export interface AuthUser {
  id: string;
  username: string;
  name?: string;
  email?: string | null;
  role: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: AuthUser;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export async function loginUser(username: string, password: string): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/auth/login', {
    username,
    password,
  });
  return response.data;
}

export async function registerUser(data: RegisterRequest): Promise<RegisterResponse> {
  const response = await apiClient.post<RegisterResponse>('/auth/register', data);
  return response.data;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordResponse {
  success: boolean;
  message: string;
}

export async function changeUserPassword(data: ChangePasswordRequest): Promise<ChangePasswordResponse> {
  const response = await apiClient.post<ChangePasswordResponse>('/auth/change-password', data);
  return response.data;
}

// ── Google OAuth helpers ──────────────────────────────────────────

export interface GoogleStatusResponse {
  success: boolean;
  configured: boolean;
}

/**
 * Ask the backend whether Google OAuth is configured.
 * Uses a plain fetch so it never throws — returns false on any network error.
 */
export async function checkGoogleOAuthStatus(): Promise<boolean> {
  try {
    const response = await apiClient.get<GoogleStatusResponse>('/auth/google/status');
    return response.data.configured === true;
  } catch {
    return false;
  }
}

/**
 * The URL the browser should navigate to in order to start the Google
 * OAuth consent flow.  The actual redirect is handled by the backend;
 * the frontend never receives the client secret.
 */
export function getGoogleOAuthUrl(): string {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined)
    || 'http://localhost:5000/api';
  return `${base.replace(/\/$/, '')}/auth/google`;
}
