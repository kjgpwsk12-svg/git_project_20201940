// 화면이 그려지기 전에 저장된 테마를 적용해 깜빡임을 막는다. (일반 스크립트로 head에서 실행)
// 기본은 라이트(다크 사이드바 + 밝은 본문), 사용자가 고르면 다크.
(function () {
  try {
    if (localStorage.getItem("econova-theme") === "dark") document.documentElement.dataset.theme = "dark";
  } catch (e) {
    // 저장소를 쓸 수 없으면 기본 테마
  }
})();
