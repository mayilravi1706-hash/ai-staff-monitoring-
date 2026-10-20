import {
  AuthUser,
  LoginCredentials,
  LoginResponse,
  ForgotPasswordResponse,
  ResetPasswordPayload,
} from '../types/auth';

class AuthService {
  private baseUrl = '/api/auth';

  /**
   * Log in user using Email or Staff ID, password, and role.
   * HTTP-Only cookie is set by the backend server.
   * No tokens or passwords are ever stored in localStorage.
   */
  async login(credentials: LoginCredentials): Promise<AuthUser> {
    const response = await fetch(`${this.baseUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'include', // Includes HTTP-only session cookies
      body: JSON.stringify(credentials),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      const errorMessage =
        data.error?.message ||
        (response.status === 429
          ? 'Too many login attempts. Please wait a few minutes before trying again.'
          : 'Authentication failed. Please check your credentials.');
      throw new Error(errorMessage);
    }

    return (data as LoginResponse).data.user;
  }

  /**
   * Log out active session.
   * Clears session from database and instructs browser to clear HTTP-only cookie.
   */
  async logout(): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/logout`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        credentials: 'include',
      });
    } catch {
      // Continue even if network error occurs during logout
    }
  }

  /**
   * Fetches currently authenticated user via session cookie.
   * Returns null if unauthenticated or session has expired.
   */
  async getMe(): Promise<AuthUser | null> {
    try {
      const response = await fetch(`${this.baseUrl}/me`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      if (data.success && data.data?.user) {
        return data.data.user as AuthUser;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Request password reset instructions.
   */
  async forgotPassword(email: string): Promise<ForgotPasswordResponse['data']> {
    const response = await fetch(`${this.baseUrl}/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      const errorMessage =
        data.error?.message ||
        (response.status === 429
          ? 'Too many reset attempts. Please wait a few minutes.'
          : 'Failed to request password reset.');
      throw new Error(errorMessage);
    }

    return data.data;
  }

  /**
   * Reset password using single-use token.
   */
  async resetPassword(payload: ResetPasswordPayload): Promise<string> {
    const response = await fetch(`${this.baseUrl}/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error?.message || 'Password reset failed. Token may be invalid or expired.');
    }

    return data.data?.message || 'Password updated successfully.';
  }
}

export const authService = new AuthService();
