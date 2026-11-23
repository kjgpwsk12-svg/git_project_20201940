// 장소(위치) 관련 기능 모음: 현재 위치 얻기, 장소 검색, 좌표로 장소 이름 찾기

// 브라우저에서 현재 위치(위도/경도)를 얻는 함수
function getCurrentCoordinates() {
  // Promise로 감싸 async/await 로 쓰기 쉽게 만든다
  return new Promise((resolve, reject) => {
    // 위치 기능을 지원하지 않는 브라우저 처리
    if (!navigator.geolocation) {
      reject({ code: "unsupported" });
      return;
    }
    // 위치 요청 (사용자에게 권한 허용 창이 뜬다)
    navigator.geolocation.getCurrentPosition(
      // 성공: 위도/경도를 돌려준다
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      }),
      // 실패: 권한 거부인지 그 밖의 오류인지 구분해서 돌려준다
      (error) => reject({ code: error.code === 1 ? "denied" : "failed" }),
      // 옵션: 대기 시간 제한, 캐시된 위치(5분 이내)도 허용해 빠르게 표시
      { timeout: APP_CONFIG.locationTimeoutMs, maximumAge: 300000 }
    );
  });
}

// 장소 이름으로 후보 장소 목록을 검색하는 함수
async function searchPlacesByName(keyword) {
  // Open-Meteo 지오코딩 API (한국어 결과 요청)
  const url =
    "https://geocoding-api.open-meteo.com/v1/search" +
    `?name=${encodeURIComponent(keyword)}&count=${APP_CONFIG.searchResultCount}&language=ko`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("검색 서버 응답 오류");
  const data = await response.json();

  // 결과가 없으면 빈 배열
  if (!data.results) return [];

  // 앱에서 쓰는 단순한 모양으로 변환 (이름, 행정구역 설명, 좌표)
  return data.results.map((item) => ({
    name: item.name,
    description: [item.admin1, item.country].filter(Boolean).join(", "), // 값이 있는 것만 연결
    latitude: item.latitude,
    longitude: item.longitude
  }));
}

// 좌표로 "서울특별시 종로구" 같은 장소 이름을 찾는 함수 (실패해도 앱은 계속 동작)
async function findPlaceNameByCoordinates(latitude, longitude) {
  try {
    const url =
      "https://api.bigdatacloud.net/data/reverse-geocode-client" +
      `?latitude=${latitude}&longitude=${longitude}&localityLanguage=ko`;
    const response = await fetch(url);
    const data = await response.json();
    // 도시/지역 이름 중 있는 것을 사용
    return data.city || data.locality || data.principalSubdivision || "현재 위치";
  } catch (error) {
    return "현재 위치"; // 이름을 못 찾으면 기본 문구 사용
  }
}
