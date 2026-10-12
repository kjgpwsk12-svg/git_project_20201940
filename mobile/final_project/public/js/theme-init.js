// 화면이 그려지기 전에 저장된 테마를 적용해 깜빡임을 막는다. (일반 스크립트로 head에서 실행)
(function () {
  try {
    var theme = localStorage.getItem("econova-theme");
    if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  } catch (e) {
    // 저장소를 쓸 수 없으면 시스템 설정을 따른다
  }
})();
