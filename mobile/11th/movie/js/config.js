// 사이트 전체 설정 값 모음. 동작을 바꾸고 싶을 때 먼저 이 파일을 확인한다.
const MOVIE_CONFIG = {
  // 사이트 이름
  siteName: "무비노트",

  // 브라우저 저장소(localStorage)에 쓰는 이름표
  storageKeys: {
    movies: "movieNote.movies",         // 운영자가 수정한 영화 목록
    stats: "movieNote.stats",           // 조회/외부 이동 횟수
    compare: "movieNote.compare",       // 비교에 담은 영화
    operatorSession: "movieNote.operator" // 운영자 로그인 상태(탭 단위)
  },

  // 운영자 화면 PIN (※ 브라우저에서만 확인하는 데모용 잠금이다. 실제 서비스는 서버 로그인으로 교체해야 한다)
  operatorPin: "1234",

  // 비교할 수 있는 최대 영화 수
  compareMax: 3,

  // 외부 링크 확인일이 이 일수보다 오래되면 "점검 필요"로 표시
  staleLinkDays: 30,

  // 핵심 지표 목표: 상세 화면 조회 대비 관련 사이트 이동 비율(%)
  targetOutboundRate: 20,

  // 영화 상태 (키 → 화면에 보일 이름)
  statusLabels: { showing: "상영중", upcoming: "개봉예정", ended: "종영" },

  // 평점 출처 종류 (새 출처를 추가하려면 한 줄 추가)
  ratingSources: ["관객 평점", "전문가 평점", "커뮤니티"],

  // 관련 사이트 종류와 아이콘 (새 종류를 추가하려면 한 줄 추가)
  linkTypes: { "예매": "🎟️", "공식 정보": "📄", "평가 원문": "💬", "예고편": "▶️" },

  // 관람 등급 목록
  ageRatings: ["전체", "12세", "15세", "19세"],

  // 홈 화면 정렬 옵션
  sortOptions: {
    rating: "평점 높은 순",
    release: "최신 개봉순",
    reviews: "작품평 많은 순",
    title: "제목순"
  }
};
