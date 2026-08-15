/* =====================================================================
 *  서울온라인학교 사이버폭력 예방 - 앱 로직
 * ===================================================================== */
(function () {
  "use strict";
  const CFG = window.APP_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------- Supabase 클라이언트 ---------- */
  let sb = null;
  const sbReady = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase);
  if (sbReady) {
    sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
  }
  const V_WORKS = CFG.WORKS_VIEW || "cv_works_public";

  /* ---------- 세션 (localStorage) ---------- */
  const SESSION_KEY = "sos_session";
  function getSession() {
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY));
      // token 이 없는 예전 방식 세션은 무효로 보고 다시 로그인받습니다.
      return s && s.token ? s : null;
    } catch { return null; }
  }
  function setSession(s) { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
  function clearSession() { localStorage.removeItem(SESSION_KEY); }

  /* ---------- 유틸 ---------- */
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg; el.hidden = false;
    clearTimeout(el._t);
    el._t = setTimeout(() => (el.hidden = true), 2600);
  }
  function msg(el, text, ok) { el.textContent = text; el.className = "form-msg " + (ok ? "ok" : "err"); }
  function esc(s) { return String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function needSupabase() {
    if (!sbReady) { toast("⚠️ Supabase 설정이 필요합니다 (js/config.js)"); return true; }
    return false;
  }

  /* ---------- 정적 콘텐츠 채우기 ---------- */
  $("#eventPeriod").textContent = CFG.EVENT_PERIOD || "";
  (function renderPrizes() {
    const prizes = CFG.PRIZES || [];
    const total = prizes.reduce((sum, p) => sum + (p.count || 0), 0);
    $("#winnerCount").textContent = total || "n";
    const grid = $("#prizeGrid");
    grid.innerHTML = prizes.map(p =>
      `<article class="glass prize"><div class="emoji">${esc(p.emoji || "🎁")}</div><h3>${esc(p.name)}</h3><p class="prize-count">${esc(p.count)}명 선정</p></article>`
    ).join("");
  })();

  /* ---------- 내비게이션 ---------- */
  $("#navToggle").addEventListener("click", () => $("#navLinks").classList.toggle("open"));
  $$("#navLinks a").forEach(a => a.addEventListener("click", () => $("#navLinks").classList.remove("open")));

  /* ---------- 스크롤 진행바 + 슬라이딩 인디케이터(스크롤 스파이) ---------- */
  (function scrollNav() {
    const links = $$("#navLinks a");
    const indicator = $("#navIndicator");
    const progress = $("#scrollProgress");
    const sections = links
      .map(a => ({ a, sec: $(a.getAttribute("href")) }))
      .filter(x => x.sec);
    let activeLink = null;

    function moveIndicator(a) {
      if (!a || window.innerWidth <= 820) { indicator.style.opacity = "0"; return; }
      indicator.style.opacity = "1";
      indicator.style.width = a.offsetWidth + "px";
      indicator.style.transform = `translateX(${a.offsetLeft}px)`;
    }
    function setActive(a) {
      if (a === activeLink) return;
      activeLink = a;
      links.forEach(l => l.classList.toggle("active", l === a));
      moveIndicator(a);
    }
    function onScroll() {
      // 진행바
      const h = document.documentElement;
      const sc = h.scrollTop || document.body.scrollTop;
      const max = h.scrollHeight - h.clientHeight;
      progress.style.width = (max > 0 ? (sc / max) * 100 : 0) + "%";
      // 현재 섹션 찾기 (화면 상단 1/3 기준)
      const line = window.innerHeight * 0.33;
      let current = null;
      for (const { a, sec } of sections) {
        const r = sec.getBoundingClientRect();
        if (r.top <= line) current = a;
      }
      setActive(current);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", () => moveIndicator(activeLink));
    onScroll();
  })();

  /* ---------- 로그인 UI ---------- */
  const loginModal = $("#loginModal");
  function openLogin() { loginModal.hidden = false; }
  function closeLogin() { loginModal.hidden = true; }
  $("#loginBtn").addEventListener("click", () => {
    const s = getSession();
    if (s) {
      if (confirm(`${s.name}님으로 로그인됨. 로그아웃 할까요?`)) { clearSession(); refreshAuthUI(); toast("로그아웃 되었습니다."); }
    } else openLogin();
  });
  $("#loginClose").addEventListener("click", closeLogin);
  loginModal.addEventListener("click", e => { if (e.target === loginModal) closeLogin(); });

  function refreshAuthUI() {
    const s = getSession();
    const chip = $("#userChip"), btn = $("#loginBtn");
    if (s) { chip.hidden = false; chip.textContent = `👤 ${s.name} (${s.grade}-${s.class}-${s.num})`; btn.textContent = "로그아웃"; }
    else { chip.hidden = true; btn.textContent = "로그인"; }
  }

  $("#doLoginBtn").addEventListener("click", async () => {
    if (needSupabase()) return;
    const name = $("#inName").value.trim();
    const school = $("#inSchool").value.trim();
    const grade = parseInt($("#inGrade").value, 10);
    const klass = parseInt($("#inClass").value, 10);
    const num = parseInt($("#inNum").value, 10);
    const m = $("#loginMsg");
    if (!name || !school || !grade || !klass || !num) { msg(m, "모든 항목을 입력해 주세요.", false); return; }

    msg(m, "확인 중…", true);
    // 조회·등록·이름 대조를 DB 함수 한 번에 맡깁니다.
    // (학생 명단 테이블은 익명 조회가 막혀 있어 브라우저로 개인정보가 내려오지 않습니다)
    const { data, error } = await sb.rpc("cv_login_or_register", {
      p_name: name, p_school: school, p_grade: grade, p_class: klass, p_num: num
    });
    if (error) { msg(m, error.message, false); return; }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) { msg(m, "로그인에 실패했습니다. 다시 시도해 주세요.", false); return; }
    loginSuccess(row, school, grade, klass, num);
  });

  function loginSuccess(row, school, grade, klass, num) {
    // token 은 본인 확인용 비밀값입니다. 제출·좋아요 때 함께 보냅니다.
    setSession({ id: row.id, token: row.token, name: row.name, school, grade, class: klass, num });
    refreshAuthUI(); closeLogin();
    toast(`${row.name}님 환영합니다!`);
    loadMyVotes();
  }

  /* ---------- 이미지 업로드 (Apps Script) ---------- */
  $("#pickFileBtn").addEventListener("click", () => {
    if (!getSession()) { toast("먼저 로그인해 주세요."); openLogin(); return; }
    $("#fileInput").click();
  });
  $("#fileInput").addEventListener("change", async e => {
    const file = e.target.files[0]; if (!file) return;
    const st = $("#uploadStatus");
    if (!CFG.APPSCRIPT_UPLOAD_URL) {
      st.textContent = "⚠️ 업로드 서버(Apps Script) 미설정 — 아래 ‘이미지 링크’에 직접 붙여넣어 주세요.";
      return;
    }
    st.textContent = "업로드 중…";
    try {
      const b64 = await fileToBase64(file);
      // ⚠️ Content-Type 헤더를 일부러 지정하지 않습니다.
      // application/json 을 붙이면 브라우저가 CORS preflight(OPTIONS)를 보내는데
      // Apps Script 웹앱은 CORS 헤더를 줄 수 없어 업로드가 실패합니다.
      // 헤더를 비우면 text/plain "단순 요청"이 되어 preflight 없이 통과합니다.
      // (Apps Script 쪽 doPost 는 e.postData.contents 를 JSON.parse 하므로 동일하게 동작)
      const res = await fetch(CFG.APPSCRIPT_UPLOAD_URL, {
        method: "POST",
        body: JSON.stringify({ filename: file.name, mimeType: file.type, data: b64 })
      });
      const out = await res.json();
      if (out && out.link) {
        $("#imgLink").value = out.link;
        st.textContent = "✅ 업로드 완료! 링크가 입력되었습니다.";
      } else if (out && out.error) {
        st.textContent = "업로드 오류: " + out.error;
      } else {
        st.textContent = "업로드 응답에 link가 없습니다: " + JSON.stringify(out);
      }
    } catch (err) {
      st.textContent = "업로드 실패: " + err.message;
    }
  });
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1]);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  /* ---------- 작품 제출 ---------- */
  $("#submitWorkBtn").addEventListener("click", async () => {
    if (needSupabase()) return;
    const s = getSession();
    const m = $("#submitMsg");
    if (!s) { msg(m, "먼저 로그인해 주세요.", false); openLogin(); return; }
    const link = $("#imgLink").value.trim();
    const exp = $("#imgExp").value.trim();
    if (!link) { msg(m, "이미지 링크가 필요합니다.", false); return; }

    msg(m, "제출 중…", true);
    // token 이 맞는 본인 행만 수정됩니다. (id 만 바꿔 남의 작품을 덮어쓸 수 없음)
    const { error } = await sb.rpc("cv_submit_work", {
      p_id: s.id, p_token: s.token, p_link: link, p_exp: exp
    });
    if (error) { msg(m, "제출 실패: " + error.message, false); return; }
    msg(m, "✅ 제출 완료! 갤러리에서 확인하세요.", true);
    loadGallery();
    $("#doneModal").hidden = false;
  });

  /* ---------- 제출 완료 모달 ---------- */
  const doneModal = $("#doneModal");
  $("#doneClose").addEventListener("click", () => (doneModal.hidden = true));
  doneModal.addEventListener("click", e => { if (e.target === doneModal) doneModal.hidden = true; });
  $("#goGalleryBtn").addEventListener("click", () => {
    doneModal.hidden = true;
    $("#gallery").scrollIntoView({ behavior: "smooth" });
  });

  /* ---------- 갤러리 ---------- */
  let currentSort = "recent";
  let myVotes = new Set();

  async function loadMyVotes() {
    if (!sbReady) return;
    const s = getSession(); if (!s) { myVotes = new Set(); return; }
    const { data } = await sb.rpc("cv_my_votes", { p_voter: s.id, p_token: s.token });
    myVotes = new Set(data || []);
  }

  async function loadGallery() {
    const grid = $("#galleryGrid");
    if (!sbReady) { grid.innerHTML = `<p class="empty-hint">⚠️ Supabase 설정 후 작품이 표시됩니다. (js/config.js)</p>`; return; }
    grid.innerHTML = `<p class="empty-hint">불러오는 중…</p>`;
    // 공개 뷰에는 작품 정보만 들어 있습니다.
    // (예전 select("*") 는 전교생 이름·학교·학년·반·번호까지 함께 내려받았습니다)
    let q = sb.from(V_WORKS).select("*");
    q = currentSort === "like"
      ? q.order("like_num", { ascending: false }).order("id", { ascending: false })
      : q.order("created_at", { ascending: false });
    const { data, error } = await q;
    if (error) { grid.innerHTML = `<p class="empty-hint">불러오기 오류: ${esc(error.message)}</p>`; return; }
    if (!data || !data.length) { grid.innerHTML = `<p class="empty-hint">아직 제출된 작품이 없어요. 첫 작품을 올려보세요! 🎨</p>`; return; }
    grid.innerHTML = data.map(w => `
      <article class="glass work-tile" data-id="${w.id}">
        <img class="thumb" loading="lazy" src="${esc(w.submit_img_link)}" alt="포스터" onerror="this.style.opacity=0.3" />
        <div class="meta">
          <p class="exp">${esc(w.submit_exp || "작품 설명이 없습니다.")}</p>
          <p class="likes">❤️ ${w.like_num || 0}</p>
        </div>
      </article>`).join("");
    $$(".work-tile", grid).forEach(t => t.addEventListener("click", () => openWork(data.find(d => String(d.id) === t.dataset.id))));
  }

  $("#refreshGallery").addEventListener("click", loadGallery);
  $$(".sort .chip").forEach(c => c.addEventListener("click", () => {
    $$(".sort .chip").forEach(x => x.classList.remove("active"));
    c.classList.add("active"); currentSort = c.dataset.sort; loadGallery();
  }));

  /* ---------- 작품 상세 + 좋아요 ---------- */
  const workModal = $("#workModal");
  let activeWork = null;
  function openWork(w) {
    if (!w) return;
    activeWork = w;
    $("#workImg").src = w.submit_img_link;
    $("#workExp").textContent = w.submit_exp || "작품 설명이 없습니다.";
    $("#likeCount").textContent = w.like_num || 0;
    const liked = myVotes.has(w.id);
    $("#likeBtn").classList.toggle("liked", liked);
    $("#workMsg").textContent = "";
    workModal.hidden = false;
  }
  $("#workClose").addEventListener("click", () => (workModal.hidden = true));
  workModal.addEventListener("click", e => { if (e.target === workModal) workModal.hidden = true; });

  $("#likeBtn").addEventListener("click", async () => {
    if (needSupabase()) return;
    const s = getSession();
    const m = $("#workMsg");
    if (!s) { msg(m, "좋아요는 로그인 후 가능해요.", false); openLogin(); return; }
    if (!activeWork) return;
    if (myVotes.has(activeWork.id)) { msg(m, "이미 좋아요한 작품이에요. (작품당 1회)", false); return; }

    // DB 트리거가 like_num 을 갱신하고, 갱신된 값을 그대로 돌려줍니다.
    const { data: newCount, error } = await sb.rpc("cv_like_work", {
      p_voter: s.id, p_token: s.token, p_work: activeWork.id
    });
    if (error) {
      // unique 위반 = 이미 누름
      msg(m, error.code === "23505" ? "이미 좋아요한 작품이에요." : "오류: " + error.message, false);
      return;
    }
    myVotes.add(activeWork.id);
    activeWork.like_num = newCount;
    $("#likeCount").textContent = newCount;
    $("#likeBtn").classList.add("liked");
    msg(m, "❤️ 좋아요 완료!", true);
    loadGallery();
  });

  /* ---------- 초기화 ---------- */
  refreshAuthUI();
  loadMyVotes().then(loadGallery);
})();
