const display = document.getElementById('display'); // 숫자 표시 화면 요소를 가져옴
let currentNumber = '0'; // 지금 입력 중인 숫자(문자열)
let previousNumber = null; // 연산자를 누르기 전에 입력했던 숫자
let selectedOperator = null; // 선택된 연산자(+, -, *, /)

let audioContext = null; // 소리를 만드는 도구(처음 클릭할 때 생성)

const operatorNames = { '+': '더하기', '-': '빼기', '*': '곱하기', '/': '나누기' }; // 연산자를 읽을 때 쓸 한글 이름

// 글자를 받아 한국어 목소리로 읽어주는 함수
function speak(text) { // 함수 시작
  window.speechSynthesis.cancel(); // 이전에 읽던 소리를 멈추고 새로 읽음
  const voice = new SpeechSynthesisUtterance(text); // 읽을 문장을 만듦
  voice.lang = 'ko-KR'; // 한국어로 읽기
  voice.pitch = 1.4; // 목소리를 높여 귀엽게
  voice.rate = 1.1; // 살짝 빠르게
  window.speechSynthesis.speak(voice); // 소리 내어 읽기
} // 함수 끝

// 화면에 지금 숫자를 보여주는 함수
function updateDisplay() { // 함수 시작
  display.textContent = currentNumber; // 화면 글자를 현재 숫자로 바꿈
} // 함수 끝

// 숫자 버튼을 눌렀을 때 숫자를 이어 붙이는 함수
function inputNumber(number) { // 함수 시작
  currentNumber = currentNumber === '0' ? number : currentNumber + number; // 0이면 교체, 아니면 뒤에 붙임
  updateDisplay(); // 화면 갱신
} // 함수 끝

// 연산자 버튼을 눌렀을 때 첫 번째 숫자를 저장하는 함수
function inputOperator(operator) { // 함수 시작
  if (selectedOperator) calculate(); // 이미 연산자가 있으면 먼저 계산함(연속 계산)
  previousNumber = currentNumber; // 현재 숫자를 앞 숫자로 저장
  selectedOperator = operator; // 누른 연산자를 저장
  currentNumber = '0'; // 다음 숫자를 받기 위해 초기화
} // 함수 끝

// 저장된 연산자로 두 숫자를 계산하는 함수
function calculate() { // 함수 시작
  if (!selectedOperator) return; // 연산자가 없으면 아무것도 안 함
  const a = Number(previousNumber); // 앞 숫자를 숫자로 변환
  const b = Number(currentNumber); // 뒤 숫자를 숫자로 변환
  let result; // 계산 결과를 담을 변수
  if (selectedOperator === '+') result = a + b; // 더하기
  if (selectedOperator === '-') result = a - b; // 빼기
  if (selectedOperator === '*') result = a * b; // 곱하기
  if (selectedOperator === '/') result = b === 0 ? '에러' : a / b; // 나누기(0으로 나누면 에러 표시)
  currentNumber = String(result); // 결과를 문자열로 저장
  previousNumber = null; // 앞 숫자 비움
  selectedOperator = null; // 연산자 비움
  updateDisplay(); // 화면 갱신
} // 함수 끝

// clear 버튼을 눌렀을 때 모든 값을 처음으로 되돌리는 함수
function clearAll() { // 함수 시작
  currentNumber = '0'; // 현재 숫자 초기화
  previousNumber = null; // 앞 숫자 초기화
  selectedOperator = null; // 연산자 초기화
  updateDisplay(); // 화면 갱신
} // 함수 끝

// 버튼 영역 클릭 한 번으로 모든 버튼을 처리하는 이벤트
document.querySelector('.buttons').addEventListener('click', (event) => { // 클릭 이벤트 등록
  const button = event.target; // 클릭된 요소
  if (button.dataset.number !== undefined) { inputNumber(button.dataset.number); speak(button.dataset.number); } // 숫자 버튼이면 숫자 입력 + 음성
  if (button.dataset.operator) { inputOperator(button.dataset.operator); speak(operatorNames[button.dataset.operator]); } // 연산자 버튼이면 연산자 입력 + 음성
  if (button.dataset.action === 'equal') { calculate(); speak('결과는 ' + currentNumber); } // = 버튼이면 계산 + 음성
  if (button.dataset.action === 'clear') { clearAll(); speak('지우기'); } // C 버튼이면 초기화 + 음성
}); // 이벤트 끝

const melody = [262, 330, 392, 330, 440, 392, 330, 262, 349, 440, 523, 440, 392, 330, 294, 262]; // 귀여운 도-미-솔 멜로디(Hz)
let melodyIndex = 0; // 지금 연주할 음 번호
let musicTimer = null; // 음악 반복 타이머(null이면 꺼진 상태)
let musicTouched = false; // 사용자가 음악 버튼을 직접 눌렀는지

// 멜로디 음 하나를 작은 볼륨으로 연주하는 함수
function playMusicNote(frequency) { // 함수 시작
  audioContext = audioContext || new AudioContext(); // 소리 도구가 없으면 새로 만듦
  const now = audioContext.currentTime; // 지금 시간
  const oscillator = audioContext.createOscillator(); // 소리를 만드는 발진기
  const volume = audioContext.createGain(); // 볼륨 조절기
  oscillator.type = 'triangle'; // 오르골 같은 부드러운 파형
  oscillator.frequency.value = frequency; // 음 높이
  volume.gain.setValueAtTime(0.07, now); // 효과음보다 작은 볼륨
  volume.gain.exponentialRampToValueAtTime(0.001, now + 0.45); // 오르골처럼 서서히 사라짐
  oscillator.connect(volume).connect(audioContext.destination); // 발진기 → 볼륨 → 스피커 연결
  oscillator.start(now); // 소리 시작
  oscillator.stop(now + 0.5); // 소리 끝
} // 함수 끝

// 배경 음악을 켜는 함수(0.4초마다 다음 음을 연주)
function startMusic() { // 함수 시작
  if (musicTimer) return; // 이미 켜져 있으면 아무것도 안 함
  musicTimer = setInterval(() => { // 0.4초마다 반복
    playMusicNote(melody[melodyIndex]); // 현재 음 연주
    melodyIndex = (melodyIndex + 1) % melody.length; // 다음 음으로(끝이면 처음으로)
  }, 400); // 반복 간격
  document.getElementById('music-button').classList.remove('off'); // 버튼을 켜진 모양으로
} // 함수 끝

// 배경 음악을 끄는 함수
function stopMusic() { // 함수 시작
  clearInterval(musicTimer); // 반복 타이머 멈춤
  musicTimer = null; // 꺼진 상태로 기록
  document.getElementById('music-button').classList.add('off'); // 버튼을 꺼진 모양으로
} // 함수 끝

// 음악 버튼을 누르면 켜고 끄는 이벤트
document.getElementById('music-button').addEventListener('click', () => { // 클릭 이벤트 등록
  musicTouched = true; // 사용자가 직접 조작했다고 기록
  if (musicTimer) stopMusic(); else startMusic(); // 켜져 있으면 끄고, 꺼져 있으면 켬
}); // 이벤트 끝

// 브라우저는 클릭 전에 소리를 막으므로, 첫 클릭 때 음악을 자동으로 시작
document.addEventListener('click', () => { // 첫 클릭 이벤트 등록
  if (!musicTouched) startMusic(); // 음악 버튼을 직접 누르지 않았다면 시작
}, { once: true }); // 한 번만 실행
