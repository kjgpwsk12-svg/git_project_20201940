// 서버 메모리 캐시. 외부 API 호출 한도를 아끼고, 갱신에 실패하면
// 이전 값을 stale 표시와 함께 돌려준다. 이전 값도 없으면 오류를 그대로 던진다.

const store = new Map();
const inflight = new Map();

/** @returns {Promise<{ value: any, fetchedAt: string, stale: boolean }>} */
export async function cached(key, ttlMs, load) {
  const hit = store.get(key);
  if (hit && Date.now() - hit.fetchedAt < ttlMs) {
    return { value: hit.value, fetchedAt: new Date(hit.fetchedAt).toISOString(), stale: false };
  }
  // 같은 키를 동시에 요청하면 한 번만 불러온다.
  if (inflight.has(key)) return inflight.get(key);

  const task = (async () => {
    try {
      const value = await load();
      const fetchedAt = Date.now();
      store.set(key, { value, fetchedAt });
      return { value, fetchedAt: new Date(fetchedAt).toISOString(), stale: false };
    } catch (error) {
      if (hit) {
        console.error(`[cache] ${key} 갱신 실패, 이전 데이터 사용:`, error.message);
        return { value: hit.value, fetchedAt: new Date(hit.fetchedAt).toISOString(), stale: true };
      }
      throw error;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, task);
  return task;
}

/**
 * 보관하지 않고, 같은 요청이 동시에 들어오면 한 번만 불러온다.
 * 저장·캐싱이 허용되지 않는 자료(FRED 이용 약관 등)에 쓴다.
 * @returns {Promise<{ value: any, fetchedAt: string, stale: false }>}
 */
export function deduped(key, load) {
  if (inflight.has(key)) return inflight.get(key);
  const task = (async () => {
    try {
      return { value: await load(), fetchedAt: new Date().toISOString(), stale: false };
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, task);
  return task;
}

export function clearCache() {
  store.clear();
  inflight.clear();
}
