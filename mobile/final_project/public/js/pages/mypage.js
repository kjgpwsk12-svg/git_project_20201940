import { validateBio, validateNickname } from "/shared/validation.js";
import { getMyProfile, getSupabase, koreanError, requireUser, signOut } from "../core/auth.js";
import { $ } from "../core/dom.js";
import { onSubmit, validateFields } from "../core/form.js";
import { initShell } from "../core/shell.js";
import { showMessage } from "../core/ui.js";
import { initWatchlist, watchlistIds } from "../core/watchlist.js";

initShell();

const client = await getSupabase();
if (!client) {
  showMessage($("page-message"), "로그인 기능이 아직 설정되지 않았어요.");
} else {
  const user = await requireUser();
  if (user) await init(user);
}

async function init(user) {
  let profile;
  try {
    profile = await getMyProfile();
  } catch (error) {
    showMessage($("page-message"), error.message);
    return;
  }
  if (!profile) {
    showMessage($("page-message"), "프로필을 찾지 못했어요. 데이터베이스 설정을 확인해 주세요.");
    return;
  }

  $("content").hidden = false;
  $("email").textContent = user.email;
  $("my-email").textContent = user.email;
  $("my-name").textContent = `${profile.nickname}님`;
  $("my-avatar").textContent = profile.nickname.slice(0, 1);
  $("joined").textContent = new Date(profile.created_at).toLocaleDateString("ko-KR");
  initWatchlist()
    .then(() => ($("watch-count").textContent = `${watchlistIds().length}개`))
    .catch(() => ($("watch-count").textContent = "불러오지 못함"));

  // 프로필
  const nickname = $("nickname");
  const bio = $("bio");
  const bioCount = $("bio-count");
  nickname.value = profile.nickname;
  bio.value = profile.bio;
  const updateCount = () => (bioCount.textContent = `${bio.value.length} / 200`);
  bio.addEventListener("input", updateCount);
  updateCount();

  onSubmit($("profile-form"), $("profile-message"), async () => {
    const valid = validateFields([
      [nickname, () => validateNickname(nickname.value)],
      [bio, () => validateBio(bio.value)],
    ]);
    if (!valid) return;
    const { error } = await client
      .from("profiles")
      .update({ nickname: nickname.value.trim(), bio: bio.value.trim() })
      .eq("id", user.id);
    if (error) throw new Error(koreanError(error));
    profile.nickname = nickname.value.trim();
    $("my-name").textContent = `${profile.nickname}님`;
    $("my-avatar").textContent = profile.nickname.slice(0, 1);
    showMessage($("profile-message"), "저장했어요.", "success");
  });

  // 비밀번호 재설정 메일
  $("send-reset").addEventListener("click", async () => {
    const button = $("send-reset");
    button.disabled = true;
    const { error } = await client.auth.resetPasswordForEmail(user.email, { redirectTo: `${location.origin}/reset` });
    button.disabled = false;
    if (error) showMessage($("password-message"), koreanError(error));
    else showMessage($("password-message"), `${user.email}로 재설정 링크를 보냈어요.`, "success");
  });

  // 계정 삭제
  onSubmit($("delete-form"), $("delete-message"), async () => {
    if ($("delete-confirm").value.trim() !== profile.nickname) throw new Error("닉네임이 일치하지 않아요.");
    const ok = confirm(
      [
        "계정을 삭제할까요?",
        "",
        "삭제되는 것: 투자 기록, 관심 종목, 북마크, 사용자 정의 지표",
        "남는 것: 게시글과 댓글(작성자는 '탈퇴한 사용자'로 표시)",
        "",
        "삭제하면 되돌릴 수 없어요.",
      ].join("\n"),
    );
    if (!ok) return;
    const { error } = await client.rpc("delete_my_account");
    if (error) throw new Error(koreanError(error));
    await signOut();
    location.replace("/");
  });
}
