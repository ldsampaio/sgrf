// Redis fake da suíte de sessão — só as leituras que a ACL `saga_readonly`
// permite (`get` em saga:heartbeat, `hgetall` em saga:sess:*:meta). Não há
// escrita de sessão: o sgrf nunca escreve no Redis.

export function createFakeRedis() {
  const store = new Map();
  let fail = null;

  return {
    store,
    async get(key) {
      if (fail) throw fail;
      return store.has(key) ? store.get(key) : null;
    },
    async hgetall(key) {
      if (fail) throw fail;
      return store.has(key) ? { ...store.get(key) } : {};
    },
    // Helpers de setup de teste (não são comandos que o sgrf usa).
    set(key, value) { store.set(key, value); },
    setHash(key, obj) { store.set(key, { ...obj }); },
    del(key) { store.delete(key); },
    clear() { store.clear(); },
    failWith(err) { fail = err; },
    allow() { fail = null; },
  };
}

export function metaKey(sid) {
  return `saga:sess:${sid}:meta`;
}

export function seedSession(fake, sid, meta) {
  fake.set('saga:heartbeat', '1');
  fake.setHash(metaKey(sid), meta);
}
