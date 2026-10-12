// 이코노바 서버 API 호출. 실패하면 서버가 보낸 안내 문구를 담아 오류를 던진다.
export async function api(path, options) {
  const res = await fetch(path, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `요청에 실패했어요 (${res.status})`);
  return body;
}

let statusPromise = null;

/** 데이터 출처 상태 (/api/status). 한 페이지에서 한 번만 불러온다. */
export function getStatus() {
  statusPromise ??= api("/api/status").catch(() => null);
  return statusPromise;
}
