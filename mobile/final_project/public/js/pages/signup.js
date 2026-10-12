import { validateEmail, validateNickname, validatePassword, validatePasswordConfirm } from "/shared/validation.js";
import { getSupabase, getUser, koreanError } from "../core/auth.js";
import { $ } from "../core/dom.js";
import { disableForm, onSubmit, setFieldError, validateFields } from "../core/form.js";
import { showMessage } from "../core/ui.js";

const form = $("form");
const message = $("message");
const nickname = $("nickname");
const email = $("email");
const password = $("password");
const password2 = $("password2");
const agree = $("agree");

const client = await getSupabase();
if (!client) {
  disableForm(form, message, "로그인 기능이 아직 설정되지 않았어요.");
} else if (await getUser()) {
  location.replace("/");
}

/** 닉네임 중복 확인 (프로필은 공개 조회 가능). DB에서도 겹치면 뒤에 ID를 붙여 막는다. */
async function nicknameTaken(value) {
  const { count, error } = await client.from("profiles").select("id", { count: "exact", head: true }).eq("nickname", value);
  if (error) return false; // 확인에 실패하면 가입 단계의 DB 처리에 맡긴다
  return count > 0;
}

nickname.addEventListener("blur", async () => {
  if (!nickname.value) return;
  const problem = validateNickname(nickname.value);
  if (problem) return setFieldError(nickname, problem);
  setFieldError(nickname, (await nicknameTaken(nickname.value.trim())) ? "이미 사용 중인 닉네임이에요." : null);
});
password2.addEventListener("blur", () => {
  if (password2.value) setFieldError(password2, validatePasswordConfirm(password.value, password2.value));
});

onSubmit(form, message, async () => {
  const valid = validateFields([
    [nickname, () => validateNickname(nickname.value)],
    [email, () => validateEmail(email.value)],
    [password, () => validatePassword(password.value)],
    [password2, () => validatePasswordConfirm(password.value, password2.value)],
  ]);
  if (!valid) return;
  if (!agree.checked) {
    agree.focus();
    throw new Error("이용약관과 개인정보 처리방침에 동의해 주세요.");
  }
  if (await nicknameTaken(nickname.value.trim())) {
    setFieldError(nickname, "이미 사용 중인 닉네임이에요.");
    nickname.focus();
    return;
  }

  const { data, error } = await client.auth.signUp({
    email: email.value.trim(),
    password: password.value,
    options: { data: { nickname: nickname.value.trim() }, emailRedirectTo: `${location.origin}/login` },
  });
  if (error) throw new Error(koreanError(error));

  // 이메일 확인이 켜져 있으면 세션이 없다
  if (!data.session) {
    form.before(message); // 폼을 숨기기 전에 안내 문구를 폼 밖으로 옮긴다
    form.hidden = true;
    showMessage(
      message,
      `${email.value.trim()}로 확인 메일을 보냈어요. 이 브라우저에서 메일의 링크를 누르면 가입이 완료돼요. 메일이 안 보이면 스팸함도 확인해 주세요.`,
      "success",
    );
    return;
  }
  location.replace("/");
});
