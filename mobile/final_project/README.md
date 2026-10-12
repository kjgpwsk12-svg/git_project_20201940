# 이코노바 (ECONOVA)

Economy + Nova · 국내외 주식·경제 정보 통합 분석 플랫폼입니다.
종목 차트에서 크게 움직인 날을 누르면 **그날 주가에 영향을 줬을 뉴스**를 바로 볼 수 있습니다.

## 주요 기능

- **시장 한눈에 보기**: 코스피·코스닥, S&P 500·나스닥 100·다우존스(대표 ETF로 표시)
- **관심 종목**: 로그인하면 계정에, 아니면 이 브라우저에 저장. 시장별 필터, 1분마다 자동 갱신(탭이 보일 때만)
- **주식**: 국내·미국 주요 종목 시세 표, 정렬, 목록 내 찾기, ☆로 관심 종목 관리
- **주요 종목 등락**: 상승·하락 상위 종목
- **종목 검색**: 한글·영문 이름, 종목 코드로 검색, 키보드(↑↓ Enter Esc) 지원
- **"왜 움직였나" 차트**: 일봉 캔들 차트 위에 뉴스가 있던 날을 표시하고, 날짜를 고르면 그날 뉴스를 보여줍니다
- **데모 모드**: API 키가 없어도 가상 데이터로 모든 화면을 확인할 수 있습니다
- 금융 터미널 스타일 디자인: 어두운/밝은 테마 전환, 사이드바 메뉴(모바일에서는 서랍 메뉴), 장 운영 상태 표시
- 상단 검색: `/` 또는 `Ctrl+K`로 바로 검색
- 키보드·스크린리더 접근성

## 회원 기능 (1단계)

- 회원가입(닉네임 중복 확인, 약관 동의, 이메일 인증), 로그인, 로그아웃
- 비밀번호 재설정 메일, 마이페이지(프로필 수정, 계정 삭제)
- 데이터베이스 전체 스키마와 RLS 정책: [supabase/schema.sql](supabase/schema.sql)

### Supabase 설정

1. Supabase 프로젝트를 만들고 **SQL Editor**에서 `supabase/schema.sql` 전체를 실행합니다.
2. **Authentication → URL Configuration**에서 Site URL을 `http://localhost:3000`, Redirect URLs에 `http://localhost:3000/**`를 넣습니다. 배포 주소도 같은 방식으로 추가합니다.
3. **Project Settings → API Keys**의 Project URL과 공개 키(anon 또는 publishable)를 `.env`의 `SUPABASE_URL`, `SUPABASE_ANON_KEY`에 넣습니다.
4. 관리자 계정은 SQL Editor에서 지정합니다: `update profiles set role = 'admin' where nickname = '닉네임';`

`service_role`(secret) 키는 RLS를 무시하는 관리자 키이므로 `.env`나 브라우저 코드에 넣지 않습니다.

## 기술 구성

| 영역 | 사용 기술 |
|---|---|
| 화면 | HTML, CSS(직접 작성), JavaScript(ES 모듈) |
| 차트 | [lightweight-charts](https://github.com/tradingview/lightweight-charts) |
| 서버 | Node.js + Express (API 키 보호, 캐싱) |
| 회원·DB | Supabase Auth + PostgreSQL, RLS |
| 테스트 | Node.js 내장 테스트 러너 (`node --test`), 스키마·RLS는 PGlite(내장 PostgreSQL)로 검증 |

```
public/
  *.html              화면 (경제 홈, 주식, 종목 상세, 로그인·가입, 마이페이지 등)
  css/app.css         디자인 시스템: 색 토큰(어두운/밝은 테마), 사이드바 골격, 패널, 표, 버튼, 폼
  css/pages.css       화면별 스타일
  js/theme-init.js    저장된 테마를 화면 표시 전에 적용
  js/core/            공통: 골격(shell), 검색, 인증, 관심 종목, 폼, DOM 도우미
  js/components/      가격 차트
  js/pages/           화면별 동작
shared/               서버와 브라우저가 함께 쓰는 모듈 (종목, 표시 형식, 장 운영 시간, 뉴스-거래일 배정, 입력 검증)
server/               Express 서버, 시세·뉴스 공급자, 캐시, 데모 데이터
supabase/             DB 스키마와 RLS 정책
test/                 테스트
```

## 실행 방법

Node.js 22 이상이 필요합니다.

```bash
npm install
npm start
```

브라우저에서 http://localhost:3000 을 엽니다. 코드를 고치면서 개발할 때는 `npm run dev`(파일 변경 시 자동 재시작)를 씁니다.

테스트:

```bash
npm test
```

## 실제 데이터 연결

`.env.example`을 `.env`로 복사하고 키를 채운 뒤 서버를 다시 시작합니다. `.env`는 git에 올라가지 않습니다.

| 변수 | 용도 | 발급처 |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | 회원가입·로그인·DB | [Supabase](https://supabase.com) |
| `KIS_APP_KEY`, `KIS_APP_SECRET` | 국내·미국 시세 | [한국투자증권 KIS Developers](https://apiportal.koreainvestment.com) (계좌 필요) |
| `KIS_ENV` | `real`(실전) 또는 `paper`(모의투자) | |
| `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` | 국내 종목 뉴스 | [네이버 개발자센터](https://developers.naver.com) 검색 API |
| `FINNHUB_API_KEY` | 미국 종목 뉴스 | [Finnhub](https://finnhub.io) |
| `SITE_PASSWORD` | 배포 시 접근 비밀번호 (HTTP 기본 인증) | 직접 정함 |

- KIS 키가 없으면 시세와 뉴스 모두 데모 데이터를 씁니다.
- KIS 키가 있는데 뉴스 키가 없으면, 실제 시세에 가짜 뉴스를 섞지 않도록 해당 시장 뉴스를 표시하지 않습니다.
- 시세 API 키는 개인 증권 계좌에 묶여 있으므로, 인터넷에 배포할 때는 반드시 `SITE_PASSWORD`를 설정하세요.

## 설계 메모

- **API 키는 서버에만 둡니다.** 브라우저는 이 서버의 `/api/*`만 호출합니다.
- **캐시**: 지수 1분, 시세 30초, 일봉·뉴스 10분. 갱신에 실패하면 이전 데이터를 "갱신 실패" 표시와 함께 보여줍니다.
- **뉴스-거래일 배정 규칙**: 장 마감(국내 15:30, 미국 16:00 현지 시각) 이후 기사는 다음 거래일에, 주말·휴장일 기사는 다음 거래일에 배정합니다. 거래일은 일봉 날짜를 그대로 쓰므로 공휴일이 자동으로 처리됩니다. 미국은 뉴욕 시간(서머타임 포함) 기준입니다.
- **큰 움직임**: 전일 대비 ±3% 이상.
- 뉴스는 제목·요약·원문 링크만 표시하고 본문은 가져오지 않습니다.
- 관심 종목은 브라우저 localStorage에 저장됩니다(기기마다 따로). 여러 기기 동기화가 필요하면 `public/js/watchlist.js`를 서버 저장 방식으로 바꾸면 됩니다.

## 알려진 한계

- 무료·개인용 API 특성상 시세가 지연될 수 있습니다.
- KIS 일봉 조회는 한 번에 약 100거래일까지 가져옵니다.
- 서버 메모리 캐시를 쓰므로 서버를 재시작하면 캐시가 비워집니다.

> 이 사이트의 정보는 참고용이며 투자 권유가 아닙니다.
