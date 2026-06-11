// POST /api/reset — remove o jogador dos rankings (reset de jogo)
// Body: { id } · Apaga das tabelas global e do país + perfil.
import { Redis } from '@upstash/redis';
const redis = Redis.fromEnv();

export default async function handler(req, res){
  if(req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const { id } = req.body || {};
  if(typeof id !== 'string' || !/^[A-Za-z0-9-]{8,40}$/.test(id))
    return res.status(400).json({ error: 'id' });

  // rate limit: 3 resets/hora por id (proteção contra abuso)
  const rlKey = `rlr:${id}`;
  const hits = await redis.incr(rlKey);
  if(hits === 1) await redis.expire(rlKey, 3600);
  if(hits > 3) return res.status(429).json({ error: 'rate' });

  // país vem do perfil salvo (pra achar a tabela certa)
  let country = 'XX';
  try{
    const p = await redis.get(`p:${id}`);
    const obj = typeof p === 'string' ? JSON.parse(p) : p;
    if(obj && obj.c) country = String(obj.c).toUpperCase().slice(0,2);
  }catch(_){}

  await Promise.all([
    redis.zrem('lb:global', id),
    redis.zrem(`lb:c:${country}`, id),
    redis.del(`p:${id}`)
  ]);

  return res.status(200).json({ ok: true });
}
