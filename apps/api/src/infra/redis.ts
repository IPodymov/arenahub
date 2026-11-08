import { createClient } from 'redis';

const makeClient = (url: string) => createClient({ url });

export type RedisClient = ReturnType<typeof makeClient>;
export const REDIS = Symbol('REDIS');

export async function createRedis(url: string): Promise<RedisClient> {
  const client = makeClient(url);
  client.on('error', (err) => console.error('[redis]', err));
  await client.connect();
  return client;
}
