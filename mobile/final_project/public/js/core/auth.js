// Supabase 인증. 브라우저는 서버의 /api/config에서 공개 설정(URL, 공개 키)만 받는다.
// 데이터 접근 권한은 DB의 RLS 정책이 지킨다.

let clientPromise = null;

/** Supabase 클라이언트. 서버에 설정이 없으면 null */
export function getSupabase() {
  clientPromise ??= (async () => {
    try {
      const res = await fetch("/api/config");
      const { supabase } = await res.json();
      if (!supabase || !window.supabase) return null;
      return window.supabase.createClient(supabase.url, supabase.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
      });
    } catch (error) {
      console.error("인증 설정을 불러오지 못했습니다", error);
      return null;
    }
  })();
  return clientPromise;
}

export async function getUser() {
  const client = await getSupabase();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session?.user ?? null;
}

export async function getMyProfile() {
  const client = await getSupabase();
  const user = await getUser();
  if (!client || !user) return null;
  const { data, error } = await client
    .from("profiles")
    .select("id, nickname, bio, role, created_at")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error(koreanError(error));
  return data;
}

export async function signOut() {
  const client = await getSupabase();
  await client?.auth.signOut();
}

/** 로그인이 필요한 페이지: 로그인하지 않았으면 로그인 화면으로 보내고 null을 돌려준다 */
export async function requireUser() {
  const user = await getUser();
  if (!user) {
    location.replace(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
    return null;
  }
  return user;
}

/** 로그인 후 돌아갈 주소. 다른 사이트로 보내는 주소는 무시한다. */
export function safeNext(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

const MESSAGES = [
  [/invalid login credentials/i, "이메일 또는 비밀번호가 맞지 않아요."],
  [/email not confirmed/i, "메일 인증을 아직 완료하지 않았어요. 받은 편지함을 확인해 주세요."],
  [/user already registered/i, "이미 가입된 이메일이에요."],
  [/password should be at least/i, "비밀번호가 너무 짧아요."],
  [/weak password|password is known/i, "더 안전한 비밀번호를 사용해 주세요."],
  [/rate limit|too many requests/i, "요청이 너무 많아요. 잠시 후 다시 시도해 주세요."],
  [/unable to validate email|invalid email/i, "이메일 형식이 올바르지 않아요."],
  [/same.*password|different from the old/i, "이전과 다른 비밀번호를 입력해 주세요."],
  [/auth session missing|jwt expired/i, "로그인이 만료되었어요. 다시 로그인해 주세요."],
  [/duplicate key.*nickname/i, "이미 사용 중인 닉네임이에요."],
  [/row-level security|permission denied/i, "권한이 없어요. 다시 로그인해 주세요."],
  [/failed to fetch|network/i, "서버에 연결하지 못했어요. 네트워크를 확인해 주세요."],
];

/** Supabase 오류를 사용자에게 보여줄 한국어 문장으로 바꾼다 */
export function koreanError(error) {
  const message = error?.message ?? String(error);
  return MESSAGES.find(([pattern]) => pattern.test(message))?.[1] ?? "처리하지 못했어요. 잠시 후 다시 시도해 주세요.";
}
