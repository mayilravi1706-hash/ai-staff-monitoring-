import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { requireAuth } from './auth';

/**
 * Reusable Role-Based Access Control (RBAC) middleware generator.
 * Restricts access to one or more allowed user roles.
 */
export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError('Authentication required to access this resource.', 401, 'UNAUTHORIZED')
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          'Access denied. You do not have permission to access this resource.',
          403,
          'FORBIDDEN'
        )
      );
    }

    next();
  };
}

/**
 * Reusable middleware: Requires ADMIN role.
 * Rejects non-admin requests with 403 Forbidden.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  // Ensure authenticated first
  if (!req.user) {
    return requireAuth(req, res, (err) => {
      if (err) return next(err);
      if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN')) {
        return next(
          new AppError('Access denied. Administrator privileges required.', 403, 'FORBIDDEN')
        );
      }
      next();
    });
  }

  if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    return next(
      new AppError('Access denied. Administrator privileges required.', 403, 'FORBIDDEN')
    );
  }

  next();
}

/**
 * Reusable middleware: Requires STAFF role.
 */
export async function requireStaff(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return requireAuth(req, res, (err) => {
      if (err) return next(err);
      if (!req.user || req.user.role !== 'STAFF') {
        return next(
          new AppError('Access denied. Staff privileges required.', 403, 'FORBIDDEN')
        );
      }
      next();
    });
  }

  if (req.user.role !== 'STAFF') {
    return next(
      new AppError('Access denied. Staff privileges required.', 403, 'FORBIDDEN')
    );
  }

  next();
}

export interface RequireSelfOrAdminOptions {
  paramName?: string;
  targetExtractor?: (req: Request) => string | undefined;
}

/**
 * Reusable IDOR Protection Middleware:
 * Allows ADMIN to access any resource.
 * Restricts STAFF to ONLY their own resource matching:
 * - staffRecordId (Staff primary key UUID, e.g. stf-001)
 * - staffId (Institutional Staff ID, e.g. STF-CSE-001)
 * - id (User UUID)
 * - 'me' keyword
 *
 * If a STAFF user targets another staff member, blocks immediately with 403 Forbidden.
 */
export function requireSelfOrAdmin(options: RequireSelfOrAdminOptions = {}) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError('Authentication required to access this resource.', 401, 'UNAUTHORIZED')
      );
    }

    // ADMIN has full access across all staff and institutional resources
    if (req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    // STAFF role verification
    const targetIdentifier = options.targetExtractor
      ? options.targetExtractor(req)
      : req.params[options.paramName || 'id'] ||
        req.params.staffId ||
        (req.query.staffId as string) ||
        (req.query.staff_id as string);

    // If no target identifier specified in route, proceed to controller (which enforces scoping)
    if (!targetIdentifier) {
      return next();
    }

    // 'me' is always authorized for the authenticated user
    if (targetIdentifier.toLowerCase() === 'me') {
      return next();
    }

    const isOwnStaffRecord =
      (req.user.staffRecordId && targetIdentifier === req.user.staffRecordId) ||
      (req.user.staffId && targetIdentifier === req.user.staffId) ||
      targetIdentifier === req.user.id;

    if (!isOwnStaffRecord) {
      return next(
        new AppError(
          'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot access or modify records belonging to another staff member.',
          403,
          'FORBIDDEN'
        )
      );
    }

    next();
  };
}

/**
 * Reusable Query Param IDOR Protection Middleware:
 * Inspects query params (default: ['staffId', 'staff_id', 'targetStaffId']).
 * - If user is ADMIN: allows filtering by any staff ID.
 * - If user is STAFF:
 *   - If query param is provided and doesn't match authenticated staff: BLOCKS with 403 Forbidden.
 *   - If query param is omitted: sets req.scopedStaffId = req.user.staffRecordId.
 */
export function protectIdorQueryParam(
  paramNames: string[] = ['staffId', 'staff_id', 'targetStaffId']
) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError('Authentication required to access this resource.', 401, 'UNAUTHORIZED')
      );
    }

    // ADMINs can query for any staff member
    if (req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    // For STAFF users, inspect all specified query parameters
    for (const param of paramNames) {
      const val = req.query[param];
      if (typeof val === 'string' && val.trim() !== '') {
        const matchesSelf =
          (req.user.staffRecordId && val === req.user.staffRecordId) ||
          (req.user.staffId && val === req.user.staffId) ||
          val === 'me';

        if (!matchesSelf) {
          return next(
            new AppError(
              'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot query records belonging to another staff member.',
              403,
              'FORBIDDEN'
            )
          );
        }
      }
    }

    next();
  };
}

/**
 * Reusable Body IDOR Protection Middleware:
 * Never trusts request body staffId/userId from clients.
 * For STAFF users:
 * - If body contains a different staffId: BLOCKS with 403 Forbidden.
 * - Binds req.body.staff_id and req.body.assigned_staff_id to req.user.staffRecordId.
 */
export function protectIdorBody(
  fieldNames: string[] = ['staffId', 'staff_id', 'assigned_staff_id', 'assignedStaffId']
) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError('Authentication required to access this resource.', 401, 'UNAUTHORIZED')
      );
    }

    // ADMIN can specify target staff
    if (req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    // STAFF role: verify they are not attempting to forge another staff's ID
    for (const field of fieldNames) {
      const val = req.body[field];
      if (val && typeof val === 'string' && val.trim() !== '') {
        const matchesSelf =
          (req.user.staffRecordId && val === req.user.staffRecordId) ||
          (req.user.staffId && val === req.user.staffId);

        if (!matchesSelf) {
          return next(
            new AppError(
              'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot create or modify records for another staff member.',
              403,
              'FORBIDDEN'
            )
          );
        }
      }
    }

    // Server-enforced binding: inject verified staffRecordId
    if (req.user.staffRecordId) {
      req.body.staff_id = req.user.staffRecordId;
      req.body.staffId = req.user.staffRecordId;
    }

    next();
  };
}
