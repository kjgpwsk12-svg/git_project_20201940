// 샘플 영화 데이터 (제목·인물·평점·작품평은 모두 가상의 예시이며 실제 작품과 무관하다)
// 실제 서비스에서는 이 파일 대신 API(예: 영화진흥위원회, TMDB)에서 불러오도록 movieStore.js 의 데이터 소스를 교체한다.
// 개봉일은 "오늘 기준 며칠 전/후"로 만들어 언제 열어도 상영 상태가 자연스럽게 보이게 한다.

// 오늘로부터 offsetDays 일 뒤(음수면 이전)의 날짜 문자열을 만드는 함수
function sampleDate(offsetDays) {
  const date = getToday();
  date.setDate(date.getDate() + offsetDays);
  return toDateText(date);
}

// 모든 샘플 영화에 공통으로 붙는 관련 사이트 4종 (공개된 대표 사이트 첫 화면 주소, 운영자가 작품별 주소로 교체한다)
function createSampleLinks(checkedDaysAgo) {
  const checkedAt = sampleDate(-checkedDaysAgo);   // 링크 확인일
  return [
    { type: "예매", label: "CGV에서 예매", source: "CGV", url: "https://www.cgv.co.kr", checkedAt },
    { type: "예매", label: "롯데시네마에서 예매", source: "롯데시네마", url: "https://www.lottecinema.co.kr", checkedAt },
    { type: "공식 정보", label: "영화관입장권통합전산망", source: "KOBIS", url: "https://www.kobis.or.kr", checkedAt },
    { type: "평가 원문", label: "해외 평론 모음 보기", source: "Rotten Tomatoes", url: "https://www.rottentomatoes.com", checkedAt }
  ];
}

// 샘플 영화 목록
const SAMPLE_MOVIES = [
  {
    id: "m-starlight",
    title: "별빛 아래서 다시",
    originalTitle: "Under the Starlight, Again",
    status: "showing",
    releaseDate: sampleDate(-9),
    runtime: 118,
    ageRating: "12세",
    genres: ["로맨스", "드라마"],
    director: "한서윤",
    cast: ["이도현", "정하린", "오민석"],
    synopsis: "십 년 만에 고향 천문대로 돌아온 천문학자 하은은 옛 연인 지후와 재회한다. 사라져 가는 별자리 관측소를 지키려는 두 사람은 서로 외면했던 진심과 마주한다.",
    posterColors: ["#3a2d7c", "#d1558b"],
    posterUrl: "",
    ratings: [
      { source: "관객 평점", score: 8.6, count: 12840 },
      { source: "전문가 평점", score: 7.8, count: 14 },
      { source: "커뮤니티", score: 8.9, count: 3120 }
    ],
    reviews: [
      { source: "관객 평점", author: "별헤는밤", score: 9, date: sampleDate(-5), text: "잔잔한데 끝나고 오래 남아요. 마지막 관측 장면은 극장에서 꼭 보세요." },
      { source: "전문가 평점", author: "평론가 A", score: 7.5, date: sampleDate(-7), text: "전개는 예상 가능하지만 촬영과 음악이 이를 충분히 보완한다." },
      { source: "커뮤니티", author: "movie_lover", score: 9, date: sampleDate(-3), text: "두 주연 배우의 호흡이 좋습니다. 데이트 영화로 추천!" }
    ],
    links: createSampleLinks(3),
    updatedAt: sampleDate(-1)
  },
  {
    id: "m-zerohour",
    title: "제로 아워",
    originalTitle: "Zero Hour",
    status: "showing",
    releaseDate: sampleDate(-16),
    runtime: 131,
    ageRating: "15세",
    genres: ["액션", "스릴러"],
    director: "강태오",
    cast: ["박준혁", "윤세라", "김도윤"],
    synopsis: "도시 전체의 전력망이 정지되기까지 남은 시간은 단 90분. 전직 보안 요원 도진은 폭파 계획의 배후를 쫓으며 시간과의 추격전을 벌인다.",
    posterColors: ["#0f2740", "#e0782b"],
    posterUrl: "",
    ratings: [
      { source: "관객 평점", score: 7.9, count: 25400 },
      { source: "전문가 평점", score: 6.4, count: 18 },
      { source: "커뮤니티", score: 8.1, count: 5870 }
    ],
    reviews: [
      { source: "관객 평점", author: "액션러버", score: 8, date: sampleDate(-10), text: "러닝타임이 순삭입니다. 카체이스 장면이 특히 시원해요." },
      { source: "전문가 평점", author: "평론가 B", score: 6, date: sampleDate(-12), text: "액션 설계는 훌륭하나 인물의 동기가 얕다." }
    ],
    links: createSampleLinks(8),
    updatedAt: sampleDate(-2)
  },
  {
    id: "m-smallvillage",
    title: "작은 마을의 비밀",
    originalTitle: "Secrets of a Small Village",
    status: "showing",
    releaseDate: sampleDate(-23),
    runtime: 104,
    ageRating: "12세",
    genres: ["미스터리", "코미디"],
    director: "문지안",
    cast: ["최유나", "배성훈", "서다온"],
    synopsis: "인구 백 명의 마을에서 해마다 같은 날 사라지는 우체통. 신입 집배원 보라는 이웃 주민들의 엉뚱한 비밀을 하나씩 파헤치다 뜻밖의 진실에 다가선다.",
    posterColors: ["#1f5d4a", "#e8c15a"],
    posterUrl: "",
    ratings: [
      { source: "관객 평점", score: 8.2, count: 9320 },
      { source: "전문가 평점", score: 7.1, count: 11 },
      { source: "커뮤니티", score: 8.4, count: 2210 }
    ],
    reviews: [
      { source: "관객 평점", author: "우체통지킴이", score: 8, date: sampleDate(-14), text: "웃다가 마지막에 울컥했어요. 가족과 함께 보기 좋아요." },
      { source: "커뮤니티", author: "cinema_k", score: 8.5, date: sampleDate(-9), text: "촘촘한 복선 회수가 인상적. 두 번 봐야 보이는 디테일이 있음." }
    ],
    links: createSampleLinks(12),
    updatedAt: sampleDate(-4)
  },
  {
    id: "m-atlasfall",
    title: "아틀라스 폴",
    originalTitle: "Atlas Fall",
    status: "showing",
    releaseDate: sampleDate(-5),
    runtime: 142,
    ageRating: "12세",
    genres: ["SF", "어드벤처"],
    director: "이준서",
    cast: ["장하늘", "한예리", "노아 벤슨"],
    synopsis: "지구로 추락하는 거대 궤도 정거장 '아틀라스'. 구조대원 서아는 마지막 생존자 열두 명을 지상으로 데려오기 위해 불가능에 가까운 하강 작전에 나선다.",
    posterColors: ["#0b1d3a", "#2fb3d6"],
    posterUrl: "",
    ratings: [
      { source: "관객 평점", score: 8.8, count: 31200 },
      { source: "전문가 평점", score: 8.2, count: 21 },
      { source: "커뮤니티", score: 8.6, count: 7400 }
    ],
    reviews: [
      { source: "관객 평점", author: "우주덕후", score: 9.5, date: sampleDate(-2), text: "대형 화면으로 봐야 하는 영화. 무중력 연출이 압도적입니다." },
      { source: "전문가 평점", author: "평론가 C", score: 8, date: sampleDate(-3), text: "스펙터클과 감정선의 균형이 좋다. 후반부 전개가 다소 빠르다." },
      { source: "커뮤니티", author: "sf_fan", score: 8, date: sampleDate(-1), text: "사운드가 대박. 음향 좋은 상영관 추천." }
    ],
    links: createSampleLinks(2),
    updatedAt: sampleDate(0)
  },
  {
    id: "m-recipe",
    title: "엄마의 레시피",
    originalTitle: "Mom's Recipe",
    status: "showing",
    releaseDate: sampleDate(-30),
    runtime: 112,
    ageRating: "전체",
    genres: ["가족", "드라마"],
    director: "조은채",
    cast: ["김선영", "이하준", "최민아"],
    synopsis: "어머니가 남긴 낡은 요리 공책 한 권. 흩어져 지내던 삼남매는 레시피를 따라 요리하며 어머니의 지난 시간과 서로의 마음을 다시 맛본다.",
    posterColors: ["#8a3b1d", "#f0b96a"],
    posterUrl: "",
    ratings: [
      { source: "관객 평점", score: 9.1, count: 18900 },
      { source: "전문가 평점", score: 7.6, count: 13 },
      { source: "커뮤니티", score: 9.0, count: 4100 }
    ],
    reviews: [
      { source: "관객 평점", author: "삼남매맏이", score: 10, date: sampleDate(-20), text: "부모님과 같이 봤는데 극장 안이 눈물바다였어요." },
      { source: "전문가 평점", author: "평론가 D", score: 7.5, date: sampleDate(-22), text: "감정 과잉의 순간이 있으나 연기의 진정성이 이를 이긴다." }
    ],
    links: createSampleLinks(40),   // 확인일이 오래된 예시 (운영자 화면에서 점검 필요로 표시됨)
    updatedAt: sampleDate(-10)
  },
  {
    id: "m-shadowcity",
    title: "그림자 도시",
    originalTitle: "Shadow City",
    status: "showing",
    releaseDate: sampleDate(-12),
    runtime: 127,
    ageRating: "19세",
    genres: ["범죄", "느와르"],
    director: "백진호",
    cast: ["송재민", "하연우", "류시안"],
    synopsis: "항만 도시의 밤을 지배하는 조직과 이를 쫓는 형사 사이에서 정체를 숨긴 회계사가 장부 한 권을 손에 쥔다. 모두가 그를 쫓기 시작한다.",
    posterColors: ["#15151c", "#9b2d3f"],
    posterUrl: "",
    ratings: [
      { source: "관객 평점", score: 7.4, count: 11050 },
      { source: "전문가 평점", score: 7.9, count: 16 },
      { source: "커뮤니티", score: 7.2, count: 2650 }
    ],
    reviews: [
      { source: "관객 평점", author: "느와르팬", score: 7.5, date: sampleDate(-6), text: "분위기와 색감이 좋아요. 다소 어둡고 잔인한 장면이 있어요." },
      { source: "전문가 평점", author: "평론가 E", score: 8, date: sampleDate(-8), text: "장르의 문법을 영리하게 비튼 연출. 배우들의 절제된 연기가 빛난다." }
    ],
    links: createSampleLinks(5),
    updatedAt: sampleDate(-3)
  },
  {
    id: "m-run-may",
    title: "달려라, 오월",
    originalTitle: "Run, May",
    status: "showing",
    releaseDate: sampleDate(-2),
    runtime: 96,
    ageRating: "전체",
    genres: ["애니메이션", "가족"],
    director: "신유리",
    cast: ["김아라", "정우진"],
    synopsis: "달리기를 좋아하는 아기 사슴 오월이는 숲속 마라톤 대회에 나가기 위해 친구들과 특별한 훈련을 시작한다. 이기는 것보다 소중한 것을 배우는 모험.",
    posterColors: ["#2b8a5a", "#f4d35e"],
    posterUrl: "",
    ratings: [
      { source: "관객 평점", score: 8.0, count: 4200 },
      { source: "전문가 평점", score: 7.0, count: 8 },
      { source: "커뮤니티", score: 8.3, count: 960 }
    ],
    reviews: [
      { source: "관객 평점", author: "아이와함께", score: 8, date: sampleDate(-1), text: "아이가 끝까지 집중해서 봤어요. 노래가 귀에 맴돌아요." }
    ],
    links: createSampleLinks(1),
    updatedAt: sampleDate(0)
  },
  {
    id: "m-lastvoyage",
    title: "마지막 항해",
    originalTitle: "The Last Voyage",
    status: "upcoming",
    releaseDate: sampleDate(12),
    runtime: 138,
    ageRating: "12세",
    genres: ["어드벤처", "드라마"],
    director: "오태경",
    cast: ["유재원", "마리아 로페즈", "차은호"],
    synopsis: "은퇴를 앞둔 노선장이 마지막 항해에서 지도에 없는 섬을 발견한다. 선원들과 함께 섬의 비밀을 쫓으며 평생 피해 온 과거와 마주한다.",
    posterColors: ["#10375c", "#6fb7d9"],
    posterUrl: "",
    ratings: [],
    reviews: [],
    links: createSampleLinks(2).filter((link) => link.type !== "평가 원문"),
    updatedAt: sampleDate(-1)
  },
  {
    id: "m-winter",
    title: "겨울 협주곡",
    originalTitle: "Winter Concerto",
    status: "ended",
    releaseDate: sampleDate(-75),
    runtime: 109,
    ageRating: "전체",
    genres: ["음악", "드라마"],
    director: "김세린",
    cast: ["박소율", "임도훈"],
    synopsis: "해체 위기의 시골 학교 오케스트라가 겨울 연주회를 준비하며 벌어지는 이야기.",
    posterColors: ["#3d4b6b", "#c9d6ee"],
    posterUrl: "",
    ratings: [
      { source: "관객 평점", score: 8.3, count: 22100 },
      { source: "전문가 평점", score: 7.7, count: 15 }
    ],
    reviews: [
      { source: "관객 평점", author: "현악기좋아", score: 8, date: sampleDate(-60), text: "음악이 좋아서 OST를 계속 듣고 있어요." }
    ],
    links: createSampleLinks(20).filter((link) => link.type !== "예매"),
    updatedAt: sampleDate(-30)
  }
];
