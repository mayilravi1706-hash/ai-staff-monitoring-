import { prisma } from '../config/database';
import { SafeUser } from '../modules/auth/auth.service';

/**
 * Resolves a staff record from an identifier, which can be:
 * - 'me' (resolves to authenticated user's staff record)
 * - Staff UUID (e.g. 'stf-001')
 * - Institutional Staff ID (e.g. 'STF-CSE-001')
 * - User UUID (e.g. 'usr-staff-001')
 */
export async function findStaffByIdentifier(identifier: string, currentUser?: SafeUser) {
  if (identifier.toLowerCase() === 'me' && currentUser?.staffRecordId) {
    return prisma.staff.findUnique({
      where: { id: currentUser.staffRecordId },
      include: {
        department: true,
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
            last_login_at: true,
          },
        },
      },
    });
  }

  return prisma.staff.findFirst({
    where: {
      OR: [
        { id: identifier },
        { staff_id: identifier },
        { user_id: identifier },
      ],
    },
    include: {
      department: true,
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          last_login_at: true,
        },
      },
    },
  });
}

/**
 * Checks if a target identifier matches the authenticated user.
 */
export function isSelfStaff(identifier: string, user: SafeUser): boolean {
  if (identifier.toLowerCase() === 'me') return true;
  if (user.staffRecordId && identifier === user.staffRecordId) return true;
  if (user.staffId && identifier === user.staffId) return true;
  if (user.id && identifier === user.id) return true;
  if (user.email && identifier.toLowerCase() === user.email.toLowerCase()) return true;
  return false;
}
