import { PrismaClient } from '@prisma/client';

let _client = null;

function getClient() {
  if (!_client) {
    _client = globalThis._prismaClient ?? new PrismaClient();
    if (process.env.NODE_ENV !== 'production') globalThis._prismaClient = _client;
  }
  return _client;
}

// Proxy defers PrismaClient construction until first property access,
// so a missing DATABASE_URL won't crash the module at import time.
export default new Proxy({}, {
  get(_, prop) { return getClient()[prop]; }
});
