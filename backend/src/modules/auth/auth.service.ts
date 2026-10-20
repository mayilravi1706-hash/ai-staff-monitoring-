import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { config } from '../../config/environment';
import { LoginInput } from './auth.schema';

export interface SafeUser {
  id: string;
  email: string;
  role: 'ADMIN' | 'STAFF' | string;
  status: string;
  staffRecordId: string | null;
  staffId: string | null;
  fullName: string;
  designation: string | null;
  department: {
    id: string;
    name: string;
    code: string;
  } | null;
  lastLoginAt: Date | null;
}

export interface SessionResult {
  user: SafeUser;
  rawSessionToken: string;
  expiresAt: Date;
}

const SESSION_EXPIRATION_DAYS = 7;
const RESET_TOKEN_EXPIRATION_MINUTES = 15;

export class AuthService {
  /**
   * Hashes a raw token using SHA-256 for secure database storage.
   */
  public hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generates a cryptographically strong random token.
   */
  public generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Maps a database User (with optional Staff relation) to a safe client object.
   * STRICT: Never exposes password_hash or sensitive system secrets.
   */
  public toSafeUser(user: {
    id: string;
    email: string;
    role: string;
    status: string;
    last_login_at: Date | null;
    staff?: {
      id?: string;
      staff_id: string;
      full_name: string;
      designation: string;
      department?: {
        id: string;
        name: string;
        code: string;
      } | null;
    } | null;
  }): SafeUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      staffRecordId: user.staff?.id ?? null,
      staffId: user.staff?.staff_id ?? null,
      fullName: user.staff?.full_name ?? (user.role === 'ADMIN' ? 'System Administrator' : user.email),
      designation: user.staff?.designation ?? (user.role === 'ADMIN' ? 'Administrator' : null),
      department: user.staff?.department
        ? {
            id: user.staff.department.id,
            name: user.staff.department.name,
            code: user.staff.department.code,
          }
        : null,
      lastLoginAt: user.last_login_at,
    };
  }

  /**
   * Authenticates user via Email OR Staff ID, password, and expected role.
   */
  async login(
    input: LoginInput,
    meta: { ip?: string; userAgent?: string } = {}
  ): Promise<SessionResult> {
    const { identifier, password, role } = input;
    const isEmail = identifier.includes('@');

    // 1. Locate User by Email or Staff ID
    let dbUser: any = null;

    if (isEmail) {
      dbUser = await prisma.user.findUnique({
        where: { email: identifier.toLowerCase() },
        include: {
          staff: {
            include: { department: true },
          },
        },
      });
    } else {
      // Look up via Staff record
      const staffRecord = await prisma.staff.findUnique({
        where: { staff_id: identifier },
        include: {
          user: true,
          department: true,
        },
      });

      if (staffRecord && staffRecord.user) {
        dbUser = {
          ...staffRecord.user,
          staff: staffRecord,
        };
      }
    }

    // 2. Generic authentication failure handler (prevents timing attacks and account enumeration)
    const genericAuthError = new AppError(
      'Invalid email/staff ID, password, or role selection.',
      401,
      'INVALID_CREDENTIALS'
    );

    if (!dbUser) {
      // Execute dummy bcrypt to equalize response time
      await bcrypt.compare(password, '$2a$10$wT8B1vD4qJmI21eQ8qF60e3q7fWpE1hB0sK3mF0xL5lP4qE9tG7eK');
      throw genericAuthError;
    }

    // Check account status
    if (dbUser.status !== 'ACTIVE') {
      throw new AppError(
        'This account is currently inactive or suspended. Please contact your institution administrator.',
        403,
        'ACCOUNT_INACTIVE'
      );
    }

    // Verify role matches
    if (dbUser.role !== role) {
      // Dummy check for constant-time
      await bcrypt.compare(password, dbUser.password_hash);
      throw genericAuthError;
    }

    // 3. Verify Password using bcrypt
    const passwordMatches = await bcrypt.compare(password, dbUser.password_hash);
    if (!passwordMatches) {
      throw genericAuthError;
    }

    // 4. Update last login timestamp
    const now = new Date();
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { last_login_at: now },
    });

    // 5. Generate secure session
    const rawSessionToken = this.generateSecureToken();
    const tokenHash = this.hashToken(rawSessionToken);
    const expiresAt = new Date(now.getTime() + SESSION_EXPIRATION_DAYS * 24 * 60 * 60 * 1000);

    await prisma.userSession.create({
      data: {
        user_id: dbUser.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
        ip_address: meta.ip || null,
        user_agent: meta.userAgent || null,
      },
    });

    // 6. Log audit event
    await prisma.auditLog.create({
      data: {
        user_id: dbUser.id,
        action: 'USER_LOGIN',
        entity_type: 'USER',
        entity_id: dbUser.id,
        metadata: JSON.stringify({
          role: dbUser.role,
          identifierType: isEmail ? 'EMAIL' : 'STAFF_ID',
          ip: meta.ip,
        }),
      },
    });

    return {
      user: this.toSafeUser(dbUser),
      rawSessionToken,
      expiresAt,
    };
  }

  /**
   * Validates a session token and returns safe user information if valid.
   */
  async validateSession(rawSessionToken: string): Promise<SafeUser | null> {
    if (!rawSessionToken) return null;

    const tokenHash = this.hashToken(rawSessionToken);
    const now = new Date();

    const session = await prisma.userSession.findUnique({
      where: { token_hash: tokenHash },
      include: {
        user: {
          include: {
            staff: {
              include: { department: true },
            },
          },
        },
      },
    });

    if (!session) return null;

    // Check expiration
    if (session.expires_at <= now) {
      // Invalidate expired session
      await prisma.userSession.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }

    // Check user active status
    if (session.user.status !== 'ACTIVE') {
      return null;
    }

    return this.toSafeUser(session.user);
  }

  /**
   * Invalidates a session (Logout).
   */
  async logout(rawSessionToken: string): Promise<boolean> {
    if (!rawSessionToken) return false;

    const tokenHash = this.hashToken(rawSessionToken);
    try {
      const deleteResult = await prisma.userSession.deleteMany({
        where: { token_hash: tokenHash },
      });
      return deleteResult.count > 0;
    } catch {
      return false;
    }
  }

  /**
   * Initiates a password reset request.
   * Returns a generic message to prevent account enumeration.
   */
  async requestPasswordReset(email: string): Promise<{
    message: string;
    devResetToken?: string;
    devResetUrl?: string;
  }> {
    const genericMessage =
      'If an account associated with that email address exists, password reset instructions have been generated.';

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user || user.status !== 'ACTIVE') {
      return { message: genericMessage };
    }

    // Clean up any pending unused tokens for this user
    await prisma.passwordResetToken.deleteMany({
      where: {
        user_id: user.id,
        used_at: null,
      },
    });

    // Create a new single-use token
    const rawToken = this.generateSecureToken();
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRATION_MINUTES * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        user_id: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        entity_type: 'USER',
        entity_id: user.id,
      },
    });

    // Provide safe development helper so tester can complete the flow without third-party email service
    const isDev = !config.isProduction;
    return {
      message: genericMessage,
      devResetToken: isDev ? rawToken : undefined,
      devResetUrl: isDev ? `/reset-password?token=${rawToken}` : undefined,
    };
  }

  /**
   * Resets password using a single-use token.
   */
  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    const now = new Date();

    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { token_hash: tokenHash },
      include: { user: true },
    });

    if (!resetRecord) {
      throw new AppError(
        'Password reset token is invalid or has expired.',
        400,
        'INVALID_RESET_TOKEN'
      );
    }

    if (resetRecord.used_at !== null) {
      throw new AppError(
        'This password reset token has already been used.',
        400,
        'TOKEN_ALREADY_USED'
      );
    }

    if (resetRecord.expires_at <= now) {
      throw new AppError(
        'Password reset token has expired. Please request a new reset link.',
        400,
        'TOKEN_EXPIRED'
      );
    }

    // Hash the new password with bcrypt (cost 10)
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Atomically update user password, mark token as used, and invalidate all active sessions
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetRecord.user_id },
        data: { password_hash: newPasswordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { used_at: now },
      }),
      // Invalidate all active sessions for this user across all devices
      prisma.userSession.deleteMany({
        where: { user_id: resetRecord.user_id },
      }),
      prisma.auditLog.create({
        data: {
          user_id: resetRecord.user_id,
          action: 'PASSWORD_RESET_COMPLETED',
          entity_type: 'USER',
          entity_id: resetRecord.user_id,
        },
      }),
    ]);
  }
}

export const authService = new AuthService();
