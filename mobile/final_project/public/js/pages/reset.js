// 비밀번호 재설정 메일의 링크로 들어오는 화면.
// supabase-js가 주소의 인증 코드를 세션으로 바꾸면 새 비밀번호를 받는다.
import { validatePassword, validatePasswordConfirm } from "/shared/validation.js";
import { getSupabase, koreanError, signOut } from "../core/auth.js";
import { $ } from "../core/dom.js";
import { onSubmit, validateFields } from "../core/form.js";

const form = $("form");
const message = $("message");
const lead = $("lead");
const invalid = $("invalid");
const password = $("password");
const password2 = $("password2");

const client = await getSupabase();

const ready = () => {
  lead.textContent = "새로 사용할 비밀번호를 입력하세요.";
  form.hidden = false;
  invalid.hidden = true;
  password.focus();
};

if (!client) {
  lead.textContent = "로그인 기능이 아직 설정되지 않았어요.";
} else {
  client.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") ready();
  });
  // 코드 교환이 이미 끝났을 수도 있으므로 세션도 확인한다
  const { data } = await client.auth.getSession();
  if (data.session) ready();
  else
    setTimeout(() => {
      if (form.hidden) {
        lead.textContent = "";
        invalid.hidden = false;
      }
    }, 3000);
}

onSubmit(form, message, async () => {
  const valid = validateFields([
    [password, () => validatePassword(password.value)],
    [password2, () => validatePasswordConfirm(password.value, password2.value)],
  ]);
  if (!valid) return;
  const { error } = await client.auth.updateUser({ password: password.value });
  if (error) throw new Error(koreanError(error));
  await signOut();
  location.replace("/login?reset=done");
});
