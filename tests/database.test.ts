import { describe, it, expect, afterAll } from 'vitest';
import { checkDatabaseHealth, prisma } from '../backend/src/config/database';

describe('Database Integration & Health', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('checkDatabaseHealth should return an object containing connected boolean', async () => {
    const health = await checkDatabaseHealth();
    expect(typeof health.connected).toBe('boolean');
    if (!health.connected) {
      expect(typeof health.error).toBe('string');
    } else {
      expect(typeof health.latencyMs).toBe('number');
    }
  });

  it('Prisma client exposes all Phase 1 schema models', () => {
    // Verify all 21 models exist on PrismaClient instance
    expect(prisma.user).toBeDefined();
    expect(prisma.staff).toBeDefined();
    expect(prisma.department).toBeDefined();
    expect(prisma.class).toBeDefined();
    expect(prisma.subject).toBeDefined();
    expect(prisma.academicYear).toBeDefined();
    expect(prisma.timetable).toBeDefined();
    expect(prisma.attendance).toBeDefined();
    expect(prisma.task).toBeDefined();
    expect(prisma.taskUpdate).toBeDefined();
    expect(prisma.activity).toBeDefined();
    expect(prisma.leaveRequest).toBeDefined();
    expect(prisma.notification).toBeDefined();
    expect(prisma.performance).toBeDefined();
    expect(prisma.workloadMetric).toBeDefined();
    expect(prisma.aiAlert).toBeDefined();
    expect(prisma.aiAnalysisRun).toBeDefined();
    expect(prisma.aiEvidence).toBeDefined();
    expect(prisma.report).toBeDefined();
    expect(prisma.setting).toBeDefined();
    expect(prisma.auditLog).toBeDefined();
    expect(prisma.userSession).toBeDefined();
    expect(prisma.passwordResetToken).toBeDefined();
  });
});
