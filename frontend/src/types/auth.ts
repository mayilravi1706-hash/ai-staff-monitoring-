export interface AuthUser {
  id: string;
  email: string;
  role: 'ADMIN' | 'STAFF' | string;
  status: string;
  staffRecordId?: string | null;
  staffId: string | null;
  fullName: string;
  designation: string | null;
  department: {
    id: string;
    name: string;
    code: string;
  } | null;
  lastLoginAt: string | null;
}

export interface LoginCredentials {
  identifier: string;
  password: string;
  role: 'ADMIN' | 'STAFF';
}

export interface LoginResponse {
  success: boolean;
  data: {
    user: AuthUser;
  };
}

export interface ForgotPasswordResponse {
  success: boolean;
  data: {
    message: string;
    devResetToken?: string;
    devResetUrl?: string;
  };
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
  confirmPassword: string;
}
