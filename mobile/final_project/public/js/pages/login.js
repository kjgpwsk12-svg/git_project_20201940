import { validateEmail } from "/shared/validation.js";
import { getSupabase, getUser, koreanError, safeNext } from "../core/auth.js";
import { $ } from "../core/dom.js";
import { disableForm, onSubmit, validateFields } from "../core/form.js";
import { showMessage } from "../core/ui.js";

const form = $("form");
const message = $("message");
const email = $("email");
const password = $("password");
const params = new URLSearchParams(location.search);
const next = safeNext(params.get("next"));

if (params.get("reset") === "done") showMessage(message, "비밀번호를 바꿨어요. 새 비밀번호로 로그인하세요.", "success");

const client = await getSupabase();
if (!client) {
  disableForm(form, message, "로그인 기능이 아직 설정되지 않았어요.");
} else if (await getUser()) {
  location.replace(next); // 이미 로그인됨 (가입 확인 메일 링크로 들어온 경우 포함)
}

onSubmit(form, message, async () => {
  const valid = validateFields([
    [email, () => validateEmail(email.value)],
    [password, () => (password.value ? null : "비밀번호를 입력해 주세요.")],
  ]);
  if (!valid) return;
  const { error } = await client.auth.signInWithPassword({ email: email.value.trim(), password: password.value });
  if (error) throw new Error(koreanError(error));
  location.replace(next);
});
