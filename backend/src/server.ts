import http from 'http';
import { app } from './app';
import { config } from './config/environment';
import { logger } from './utils/logger';
import { checkDatabaseHealth, prisma, startDatabaseKeepalive, stopDatabaseKeepalive } from './config/database';
import { jobScheduler } from './services/scheduler.service';

const server = http.createServer(app);

async function startServer() {
  try {
    // 1. Check initial database connection
    logger.info('Initializing AI Staff Operations Intelligence Platform...', 'INIT');
    const dbStatus = await checkDatabaseHealth();
    if (dbStatus.connected) {
      logger.info(`PostgreSQL database connected (latency: ${dbStatus.latencyMs}ms)`, 'DB_READY');
      // Start background keepalive ping to maintain active socket with Neon/Postgres pool
      startDatabaseKeepalive(45000);
      // Start server-side background job scheduler
      jobScheduler.startScheduler();
    } else {
      logger.warn(`PostgreSQL not reachable: ${dbStatus.error}`, 'DB_WARNING');
    }

    // 2. Start HTTP listener on 0.0.0.0 for localhost & Android emulator (10.0.2.2) access
    server.listen(config.port, '0.0.0.0', () => {
      logger.logStartup(config.port, config.env, config.version);
      console.log(`
==========================================================
🚀 AI STAFF OPERATIONS INTELLIGENCE PLATFORM (RELEASE v1.0.0)
----------------------------------------------------------
Server URL:     http://localhost:${config.port}
Health Check:   http://localhost:${config.port}/api/health
Environment:    ${config.env}
Database URL:   ${config.databaseUrl.replace(/:[^:@]+@/, ':****@')}
==========================================================
      `);
    });
  } catch (error) {
    logger.error('Failed to start server', error, 'FATAL_STARTUP');
    process.exit(1);
  }
}

// Graceful Shutdown Logic
async function shutdown(signal: string) {
  logger.logShutdown(signal);
  jobScheduler.stopScheduler();
  stopDatabaseKeepalive();
  server.close(async () => {
    logger.info('HTTP server closed', 'SHUTDOWN');
    try {
      await prisma.$disconnect();
      logger.info('Database connection closed cleanly', 'SHUTDOWN');
      process.exit(0);
    } catch (err) {
      logger.error('Error during database disconnect', err, 'SHUTDOWN_ERROR');
      process.exit(1);
    }
  });

  // Force shutdown if hung
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout', undefined, 'SHUTDOWN_TIMEOUT');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

if (require.main === module) {
  startServer();
}

export { server };
