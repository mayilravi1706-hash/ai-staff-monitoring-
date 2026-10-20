import { spawn } from 'child_process';

console.log('🚀 Starting AI Staff Operations Intelligence Platform...');

// Parse CLI arguments to detect custom port passed by platform (e.g. --port 3000)
function getCommandLineArg(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index !== -1 && index + 1 < process.argv.length) {
    return process.argv[index + 1];
  }
  for (const arg of process.argv) {
    if (arg.startsWith(`${flag}=`)) {
      return arg.split('=')[1];
    }
  }
  return null;
}

// 1. Determine Frontend Port
const cliPort = getCommandLineArg('--port') || getCommandLineArg('-p');
const frontendPort = parseInt(cliPort || process.env.PORT || '3000', 10);

// 2. Determine Backend Port (ensure it never conflicts with frontend)
const customBackendPort = process.env.BACKEND_PORT ? parseInt(process.env.BACKEND_PORT, 10) : null;
const backendPort = customBackendPort || (frontendPort === 5000 ? 5001 : 5000);

console.log(`[Startup] Frontend listening on 0.0.0.0:${frontendPort}`);
console.log(`[Startup] Backend API listening on 0.0.0.0:${backendPort}`);
console.log(`[Startup] Vite proxy: /api -> http://localhost:${backendPort}`);

// 3. Start Express Backend
const backend = spawn('npx', ['tsx', 'backend/src/server.ts'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    PORT: String(backendPort),
    APP_URL: `http://localhost:${frontendPort}`,
    NODE_ENV: 'development',
  },
});

// 4. Start Vite Frontend Dev Server
const frontend = spawn(
  'npx',
  [
    'vite',
    '--config',
    'frontend/vite.config.ts',
    'frontend',
    '--host',
    '0.0.0.0',
    '--port',
    String(frontendPort),
  ],
  {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      PORT: String(frontendPort),
      BACKEND_PORT: String(backendPort),
    },
  }
);

function shutdown() {
  console.log('\n🛑 Gracefully shutting down servers...');
  try { backend.kill('SIGTERM'); } catch {}
  try { frontend.kill('SIGTERM'); } catch {}
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
