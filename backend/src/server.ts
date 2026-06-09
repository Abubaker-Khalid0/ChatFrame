import { buildApp } from './app';
import { env } from './config/env';

const app = buildApp();

async function start(): Promise<void> {
  try {
    await app.listen({ port: env.BACKEND_PORT, host: '127.0.0.1' });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === 'EADDRINUSE') {
      app.log.error(
        `Port ${env.BACKEND_PORT} is already in use. ` +
          `Set BACKEND_PORT in your .env to a free port and try again.`,
      );
    } else {
      app.log.error(err);
    }
    process.exit(1);
  }
}

void start();
