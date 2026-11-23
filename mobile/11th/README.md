# 빠른 날씨 웹사이트

현재 위치와 검색한 장소의 날씨를 모바일 웹에서 빠르게 확인하는 웹 프로젝트입니다. 요구사항은 [prd.md](prd.md)를 참고하세요.

## 실행
```bash
npm start
```
브라우저에서 http://localhost:3000 을 엽니다. (Node.js 필요, 별도 설치 패키지 없음)

## 영화 사이트 (무비노트)
http://localhost:3000/movie/ — 요구사항은 [movie/movie_prd.md](movie/movie_prd.md), 코드는 `movie/` 폴더 (html / css / js 분리, 운영자 PIN 데모값 `1234`).

## 날씨 사이트 구조
```
server.js          웹 서버
public/            브라우저에 제공되는 파일
  index.html       화면 구조
  css/style.css    스타일
  js/config.js         설정, 안내 문구
  js/weatherCodes.js   날씨 코드 → 아이콘/설명
  js/weatherProvider.js 날씨 데이터 제공자 (기상청 등 추가 지점)
  js/placeService.js   현재 위치, 장소 검색
  js/storage.js        최근 검색 저장
  js/advice.js         날씨별 생활 조언 규칙 (규칙 한 줄 추가로 확장)
  js/ui.js             화면 그리기 (세부 타일, 그래프, 예보, 대기질)
  js/app.js            전체 흐름
```

## 확장
- 날씨 출처 추가: `weatherProvider.js`에 제공자를 추가하고 `config.js`의 `weatherProvider` 값을 변경
- 안내 문구 수정: `config.js`의 `messages`
