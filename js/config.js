/* =====================================================================
 *  서울온라인학교 사이버폭력 예방 사이트 - 환경설정
 *  ---------------------------------------------------------------------
 *  ⚠️ 아래 값들을 실제 값으로 채워주세요. (현재는 비어 있으면 "준비 중"으로 동작)
 * ===================================================================== */

window.APP_CONFIG = {
  /* ---------------- Supabase ---------------- */
  // Supabase 프로젝트 > Settings > API 에서 복사
  SUPABASE_URL: "https://zvdozshnwtfwthuotynb.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_fn84m-fNZGN9kJ4o1wRo0Q_GkVov5-g",  // publishable(공개) 키

  // 갤러리 공개 뷰 이름.
  // 학생 개인정보(이름·학교·학년·반·번호)가 담긴 cv_students 테이블에는
  // 익명 접근이 차단되어 있고, 읽기는 이 뷰로만 이루어집니다.
  // 로그인·제출·좋아요는 DB 함수(RPC)를 통해 처리됩니다.
  WORKS_VIEW: "cv_works_public",

  /* ---------------- 이미지 업로드 (Google Apps Script) ---------------- */
  // 앱스크립트 웹앱(doPost) 배포 URL. 완성되면 여기에 붙여넣으세요.
  // 비어 있으면 업로드 대신 "링크 직접 입력" 모드로 동작합니다.
  APPSCRIPT_UPLOAD_URL: "https://script.google.com/macros/s/AKfycbzAjUprEWnXRLz7Cma6Nb1CyiSnbZVAUTnE-DHvR_QIP5PmY9e9HYLWi5qOgnFFv7v7/exec",

  /* ---------------- 상품(경품) 안내 ---------------- */
  PRIZES: [
    { name: "LAMY 샤프", count: 3, emoji: "✏️" },
    { name: "Smash 샤프", count: 4, emoji: "✒️" },
    { name: "과자 세트", count: 5, emoji: "🍪" },
  ],

  /* ---------------- 이벤트 기간 (표시용) ---------------- */
  EVENT_PERIOD: "2026. 6. 15.(월) ~ 6. 19.(금)",
};
