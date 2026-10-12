// ===== 마우스 올렸을 때 효과 (mouseover / mouseout) =====

// 효과를 줄 요소들: 패널, 아이디어 카드, 사진, 태그
const hoverItems = document.querySelectorAll(".panel, .idea, .gallery img, .tags li");

hoverItems.forEach(function (item) {
  // 부드럽게 움직이도록 전환 효과 지정
  item.style.transition = "transform 0.2s, box-shadow 0.2s";

  // 마우스를 올리면 살짝 떠오르고 그림자가 생김
  item.addEventListener("mouseover", function () {
    item.style.transform = "translateY(-5px)";
    item.style.boxShadow = "0 8px 20px rgba(24, 33, 47, 0.15)";
  });

  // 마우스가 벗어나면 원래대로
  item.addEventListener("mouseout", function () {
    item.style.transform = "";
    item.style.boxShadow = "";
  });
});

// 프로필 사진: 마우스를 올리면 살짝 커짐
const profileImg = document.querySelector(".arch img");

if (profileImg) {
  profileImg.style.transition = "transform 0.3s";

  profileImg.addEventListener("mouseover", function () {
    profileImg.style.transform = "scale(1.05)";
  });

  profileImg.addEventListener("mouseout", function () {
    profileImg.style.transform = "";
  });
}

// ===== 메인 화면 사진 바꾸기 =====
// 메인 화면(.hero)의 아치형 사진에 마우스를 올리면 리브 사진으로 바뀜
const mainImg = document.querySelector(".hero .arch img");

if (mainImg) {
  const originalSrc = mainImg.src;   // 원래 사진 주소 기억

  mainImg.addEventListener("mouseover", function () {
    mainImg.src = "images/liv.jpg";
  });

  mainImg.addEventListener("mouseout", function () {
    mainImg.src = originalSrc;
  });
}

// ===== 메뉴 드롭다운 =====
// 메뉴에 마우스를 올리면 아래에 하위 메뉴가 나타남 (보여 주기용)
const subMenus = {
  "index.html": ["둘러보기", "요즘 공부하는 것"],
  "mintro.html": ["저는 이런 사람입니다", "성격과 장점", "관심 분야", "기술 수준", "활동 사진"],
  "minfo.html": ["연락처", "자격", "사용 도구"],
  "mstudy.html": ["학력", "웹 프로그래밍 학습 기록", "학습 목표"],
  "mcareer.html": ["활동 경력"],
  "midea.html": ["도서 · 영화 5선", "혼자 진행한다면"],
  "msns.html": ["연락하기", "주소 검색", "디자인 참고 사이트", "연락처 정보"]
};

// 드롭다운 상자를 하나 만들어 둠 (처음에는 숨김)
const dropdown = document.createElement("div");
dropdown.className = "dropdown";
document.body.appendChild(dropdown);

const menuLinks = document.querySelectorAll("nav a");

menuLinks.forEach(function (link) {
  link.addEventListener("mouseover", function () {
    const page = link.getAttribute("href");
    const items = subMenus[page] || [];

    // 하위 메뉴 내용 채우기
    dropdown.innerHTML = "";
    items.forEach(function (text) {
      const a = document.createElement("a");
      a.href = page;
      a.textContent = text;
      dropdown.appendChild(a);
    });

    // 마우스를 올린 메뉴 바로 아래에 위치시키기
    const box = link.getBoundingClientRect();
    dropdown.style.left = box.left + "px";
    dropdown.style.top = box.bottom + "px";
    dropdown.style.display = "block";
  });

  // 메뉴에서 벗어날 때, 드롭다운 쪽으로 가는 게 아니면 숨김
  link.addEventListener("mouseout", function (event) {
    if (!dropdown.contains(event.relatedTarget)) {
      dropdown.style.display = "none";
    }
  });
});

// 드롭다운에서 마우스가 벗어나면 숨김
dropdown.addEventListener("mouseleave", function () {
  dropdown.style.display = "none";
});
