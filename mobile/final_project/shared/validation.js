// 회원 입력 검증. 통과하면 null, 아니면 사용자에게 보여줄 문장을 돌려준다.
// DB 제약 조건(supabase/schema.sql)과 같은 기준을 쓴다.

export function validateNickname(value) {
  const v = value.trim();
  if (v.length < 2) return "닉네임은 2자 이상이어야 해요.";
  if (v.length > 15) return "닉네임은 15자 이하로 써 주세요.";
  if (!/^[0-9A-Za-z가-힣_]+$/.test(v)) return "닉네임에는 한글, 영문, 숫자, 밑줄(_)만 쓸 수 있어요.";
  return null;
}

export function validateEmail(value) {
  const v = value.trim();
  if (!v) return "이메일을 입력해 주세요.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "이메일 형식이 올바르지 않아요.";
  return null;
}

export function validatePassword(value) {
  if (value.length < 8) return "비밀번호는 8자 이상이어야 해요.";
  if (value.length > 72) return "비밀번호는 72자 이하로 써 주세요.";
  if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) return "영문과 숫자를 함께 써 주세요.";
  return null;
}

export function validatePasswordConfirm(password, confirm) {
  return password === confirm ? null : "비밀번호가 서로 달라요.";
}

export function validateBio(value) {
  return value.length > 200 ? "소개는 200자 이하로 써 주세요." : null;
}

// ----- 게시판 -----

export function validatePostTitle(value) {
  const v = value.trim();
  if (!v) return "제목을 입력해 주세요.";
  if (v.length > 100) return "제목은 100자 이하로 써 주세요.";
  return null;
}

export function validatePostBody(value) {
  const v = value.trim();
  if (!v) return "내용을 입력해 주세요.";
  if (v.length > 10000) return "내용은 10,000자 이하로 써 주세요.";
  return null;
}

export function validateComment(value) {
  const v = value.trim();
  if (!v) return "댓글을 입력해 주세요.";
  if (v.length > 2000) return "댓글은 2,000자 이하로 써 주세요.";
  return null;
}
