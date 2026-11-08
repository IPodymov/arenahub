import { existsSync } from 'node:fs';
import path from 'node:path';
import type { NextConfig } from 'next';

const rootEnv = path.resolve(__dirname, '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const apiUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

const config: NextConfig = {
  // API живёт за тем же origin: httpOnly cookie сессии первосторонняя, CORS не нужен
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
};

export default config;
