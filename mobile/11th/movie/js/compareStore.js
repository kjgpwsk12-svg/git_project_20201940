// "비교하기"에 담은 영화 목록을 관리하는 파일 (새로고침해도 유지).
// 영화는 { id, title } 로 저장한다. id 가 "k-" 로 시작하면 KOBIS 영화, 아니면 운영자 등록 영화다.

// 담은 영화 목록을 읽는 함수
function getCompareItems() {
  try {
    const saved = JSON.parse(localStorage.getItem(MOVIE_CONFIG.storageKeys.compare));
    if (Array.isArray(saved)) return saved.filter((item) => item && typeof item.id === "string" && typeof item.title === "string");
  } catch (error) { /* 무시 */ }
  return [];
}

// 담은 영화 id 목록만 필요할 때 쓰는 함수
function getCompareIds() {
  return getCompareItems().map((item) => item.id);
}

// 목록을 저장하고, 화면이 갱신되도록 알림 이벤트를 보내는 함수
function saveCompareItems(items) {
  try { localStorage.setItem(MOVIE_CONFIG.storageKeys.compare, JSON.stringify(items)); } catch (error) { /* 무시 */ }
  window.dispatchEvent(new CustomEvent("compare-changed"));
}

// 영화가 비교 목록에 있는지 확인하는 함수
function isInCompare(movieId) {
  return getCompareIds().includes(movieId);
}

// 비교 목록에 넣거나 빼는 함수. 최대 개수를 넘으면 false 를 돌려준다
function toggleCompare(movieId, title) {
  const items = getCompareItems();
  if (items.some((item) => item.id === movieId)) {            // 이미 있으면 제거
    saveCompareItems(items.filter((item) => item.id !== movieId));
    return true;
  }
  if (items.length >= MOVIE_CONFIG.compareMax) {              // 가득 찼으면 거절
    showToast(`비교는 최대 ${MOVIE_CONFIG.compareMax}편까지 가능합니다.`);
    return false;
  }
  saveCompareItems([...items, { id: movieId, title: title || movieId }]);
  return true;
}

// 비교 목록을 모두 비우는 함수
function clearCompare() {
  saveCompareItems([]);
}
