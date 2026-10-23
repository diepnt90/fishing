/* Cá có ăn không? — app logic (bản demo UI) */
"use strict";

const $ = (s) => document.querySelector(s);
const state = { lat: null, lon: null, name: "", animId: null };

/* ---------- song ngữ VI/EN ---------- */
let LANG = "vi";
try { LANG = localStorage.getItem("fishing-lang") || "vi"; } catch {}
const STR = {
vi: {
  docTitle: "Hôm nay cá có ăn không? — Dự đoán đi câu",
  docDesc: "Dự đoán xem hôm nay cá có đi ăn không dựa trên thời tiết, áp suất, gió và pha mặt trăng.",
  brandH1: "Cá có ăn không?", brandSub: "Dự đoán đi câu bằng thời tiết + mặt trăng",
  step1: "Chọn điểm câu", tabSearch: "Tìm địa điểm", tabGps: "Vị trí của tôi",
  searchPh: "Nhập tên hồ, sông, địa danh… vd: hồ Trị An", searchBtn: "Tìm",
  gpsHint: "Dùng GPS của thiết bị để lấy tọa độ hiện tại của bạn.", gpsBtn: "Lấy vị trí hiện tại",
  changePlace: "đổi", step2: "Dự đoán ngay lúc này", verdictLoading: "Đang xem thời tiết…",
  verdictMore: "Xem thêm ▾", verdictLess: "Thu gọn ▴",
  legend1: "0–29 Ở nhà", legend2: "30–54 Hên xui", legend3: "55–74 Khá đấy", legend4: "75–100 Đi ngay",
  step3: "Vì sao lại thế?",
  aiNoteLive: "Kết quả do AI phân tích từ dữ liệu thời tiết thực tế.",
  aiNoteFallback: "AI chưa phản hồi — đang dùng thuật toán dự phòng.",
  step4: "Biến động thời tiết", histHours: "5 giờ gần nhất", histDays: "5 ngày qua",
  histNote: "AI dùng lịch sử này để đánh giá xu hướng (áp suất đang giảm hay tăng, nhiệt độ lên/xuống...).",
  footer: "Dữ liệu thời tiết: Open-Meteo · Pha trăng & giờ solunar tính tại chỗ",
  searching: "Đang tìm…", noResult: "Không tìm thấy, thử tên khác nhé", netErr: "Lỗi mạng, thử lại nhé",
  resolving: "Đang lấy tọa độ…", noKey: "Chưa cấu hình key Vietmap (secret VIETMAP_KEY).",
  noGeo: "Thiết bị không hỗ trợ định vị.", gettingPos: "Đang lấy vị trí…",
  posDenied: "Không lấy được vị trí — bạn đã từ chối quyền hoặc GPS yếu.",
  myPos: (la, lo) => `Vị trí hiện tại (${la.toFixed(3)}, ${lo.toFixed(3)})`,
  vLoadingT: "Đang xem thời tiết…", vLoadingS: "Đang tải dữ liệu…",
  vNetErrT: "Lỗi mạng", vNetErrS: "Không tải được thời tiết, thử lại nhé.",
  cachedNote: " (kết quả đã lưu, dưới 1 giờ)", errCode: (c) => ` (mã lỗi: ${c})`,
  thHour: "Giờ", thTemp: "Nhiệt", thPressure: "Áp suất", thWind: "Gió", thCloud: "Mây", thRain: "Mưa",
  thDate: "Ngày", thHiLo: "Cao/Thấp", thWeather: "Thời tiết",
  compass: ["Bắc","Đông Bắc","Đông","Đông Nam","Nam","Tây Nam","Tây","Tây Bắc"],
  moonNames: ["Trăng non","Lưỡi liềm đầu tháng","Bán nguyệt đầu tháng","Khuyết đầu tháng","Trăng tròn","Khuyết cuối tháng","Bán nguyệt cuối tháng","Lưỡi liềm cuối tháng"],
  dGo: "ĐI CÂU NGAY!", dGoS: "Cá đang ăn mạnh — xách cần lên đường!",
  dOk: "KHÁ ĐẤY", dOkS: "Có cơ hội tốt, canh đúng giờ vàng mà quất.",
  dMeh: "HÊN XUI", dMehS: "Cá lười ăn, đi cho vui là chính, đừng kỳ vọng.",
  dHome: "Ở NHÀ ĐI", dHomeS: "Hôm nay cá không thèm ăn — ở nhà đỡ phí mồi.",
  dMoon: "Mặt trăng", dMoonD: (m) => `Giờ vàng solunar: ${m}`,
  dPressure: "Áp suất", dPDown: "Đang giảm — cá thường ăn mạnh", dPUp: "Đang tăng nhanh", dPStable: "Ổn định",
  dWind: "Gió", dWCalm: "Nhẹ, lý tưởng", dWMod: "Vừa phải", dWStrong: "Mạnh, khó câu",
  dCloud: "Mây", dClIdeal: "Âm u nhẹ, cá dạn hơn", dClSun: "Nắng gắt", dClClear: "Trời quang", dClCloudy: "Nhiều mây",
  dRain: "Mưa", dNoRain: "Không mưa",
  dRainLight: (w) => `${w} — kích thích cá ăn`, dRainHeavy: (w) => `${w} — nước đục, kém ăn`, dDry: "Trời khô ráo",
  dTemp: "Nhiệt độ", dTIdeal: "Vùng nhiệt cá ăn mạnh", dTOff: "Hơi lệch vùng lý tưởng",
  dHum: "Độ ẩm", dHuHigh: "Ẩm cao — thường đi kèm âm u/sắp mưa", dHuNormal: "Bình thường", dHuDry: "Khô ráo",
  dSolunar: "Giờ solunar", dGoldenNow: "Đang trong giờ vàng!", dGoldenLater: "Khung ăn mạnh trong ngày"
},
en: {
  docTitle: "Are they biting today? — Fishing forecast",
  docDesc: "Predict whether fish are biting today from weather, pressure, wind and moon phase.",
  brandH1: "Are they biting?", brandSub: "Fishing forecast from weather + moon",
  step1: "Pick your spot", tabSearch: "Search place", tabGps: "My location",
  searchPh: "Lake, river, place name… e.g. Tri An lake", searchBtn: "Search",
  gpsHint: "Use your device GPS to get your current coordinates.", gpsBtn: "Get current location",
  changePlace: "change", step2: "Right-now forecast", verdictLoading: "Checking the weather…",
  verdictMore: "Show more ▾", verdictLess: "Show less ▴",
  legend1: "0–29 Stay home", legend2: "30–54 Hit or miss", legend3: "55–74 Pretty good", legend4: "75–100 Go now",
  step3: "Why?",
  aiNoteLive: "Analyzed by AI from live weather data.",
  aiNoteFallback: "AI didn't respond — using the fallback algorithm.",
  step4: "Weather trends", histHours: "Last 5 hours", histDays: "Last 5 days",
  histNote: "The AI uses this history to judge trends (pressure falling or rising, temperature up/down…).",
  footer: "Weather data: Open-Meteo · Moon phase & solunar times computed on-device",
  searching: "Searching…", noResult: "Not found, try another name", netErr: "Network error, try again",
  resolving: "Resolving location…", noKey: "Vietmap key not configured (secret VIETMAP_KEY).",
  noGeo: "Geolocation not supported on this device.", gettingPos: "Getting location…",
  posDenied: "Couldn't get location — permission denied or weak GPS.",
  myPos: (la, lo) => `Current location (${la.toFixed(3)}, ${lo.toFixed(3)})`,
  vLoadingT: "Checking the weather…", vLoadingS: "Loading data…",
  vNetErrT: "Network error", vNetErrS: "Couldn't load weather, try again.",
  cachedNote: " (cached result, under 1 hour)", errCode: (c) => ` (error: ${c})`,
  thHour: "Time", thTemp: "Temp", thPressure: "Pressure", thWind: "Wind", thCloud: "Cloud", thRain: "Rain",
  thDate: "Date", thHiLo: "High/Low", thWeather: "Weather",
  compass: ["N","NE","E","SE","S","SW","W","NW"],
  moonNames: ["New moon","Waxing crescent","First quarter","Waxing gibbous","Full moon","Waning gibbous","Last quarter","Waning crescent"],
  dGo: "GO FISHING!", dGoS: "Fish are biting hard — grab your rod!",
  dOk: "PRETTY GOOD", dOkS: "Good chance, time it with the golden hour.",
  dMeh: "HIT OR MISS", dMehS: "Fish are lazy; go for fun, keep expectations low.",
  dHome: "STAY HOME", dHomeS: "Fish aren't biting today — save your bait.",
  dMoon: "Moon", dMoonD: (m) => `Solunar majors: ${m}`,
  dPressure: "Pressure", dPDown: "Falling — fish often feed hard", dPUp: "Rising fast", dPStable: "Steady",
  dWind: "Wind", dWCalm: "Light, ideal", dWMod: "Moderate", dWStrong: "Strong, hard to fish",
  dCloud: "Cloud", dClIdeal: "Light overcast, fish bolder", dClSun: "Harsh sun", dClClear: "Clear sky", dClCloudy: "Very cloudy",
  dRain: "Rain", dNoRain: "No rain",
  dRainLight: (w) => `${w} — triggers feeding`, dRainHeavy: (w) => `${w} — murky water, poor bite`, dDry: "Dry",
  dTemp: "Temperature", dTIdeal: "Prime feeding temperature", dTOff: "Slightly off ideal range",
  dHum: "Humidity", dHuHigh: "High humidity — often overcast/rain coming", dHuNormal: "Normal", dHuDry: "Dry",
  dSolunar: "Solunar", dGoldenNow: "Right in the golden hour!", dGoldenLater: "Peak feeding windows today"
}};
const t = (k, ...a) => {
  const v = (STR[LANG] && STR[LANG][k]) ?? STR.vi[k];
  return typeof v === "function" ? v(...a) : (v ?? k);
};
function applyLang() {
  document.documentElement.lang = LANG;
  document.title = t("docTitle");
  const md = document.querySelector('meta[name="description"]');
  if (md) md.setAttribute("content", t("docDesc"));
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => { el.setAttribute("placeholder", t(el.dataset.i18nPh)); });
  document.querySelectorAll("#lang-btn .flag").forEach((f) => f.classList.toggle("active", f.dataset.lang === LANG));
  const vm = $("#verdict-more");
  if (vm && !vm.hidden) vm.textContent = t($("#verdict-sub").classList.contains("expanded") ? "verdictLess" : "verdictMore");
  try { localStorage.setItem("fishing-lang", LANG); } catch {}
}
$("#verdict-more").addEventListener("click", () => {
  const subEl = $("#verdict-sub");
  const open = subEl.classList.toggle("expanded");
  $("#verdict-more").textContent = t(open ? "verdictLess" : "verdictMore");
});
$("#lang-btn").addEventListener("click", () => {
  LANG = LANG === "vi" ? "en" : "vi";
  applyLang();
  if (state.lat != null) predict(); // dự đoán lại bằng ngôn ngữ mới
});
applyLang();

/* mã thời tiết WMO, song ngữ */
const WMO = {
vi: {0:"Quang đãng",1:"Chủ yếu quang đãng",2:"Mây rải rác",3:"Âm u",45:"Sương mù",48:"Sương mù đóng băng",51:"Mưa phùn nhẹ",53:"Mưa phùn",55:"Mưa phùn dày",56:"Mưa phùn đóng băng",57:"Mưa phùn đóng băng",61:"Mưa nhẹ",63:"Mưa vừa",65:"Mưa to",66:"Mưa đóng băng",67:"Mưa đóng băng",71:"Tuyết nhẹ",73:"Tuyết",75:"Tuyết dày",77:"Tuyết hạt",80:"Mưa rào nhẹ",81:"Mưa rào vừa",82:"Mưa rào to",85:"Mưa tuyết",86:"Mưa tuyết",95:"Dông",96:"Dông kèm mưa đá",99:"Dông kèm mưa đá"},
en: {0:"Clear",1:"Mostly clear",2:"Partly cloudy",3:"Overcast",45:"Fog",48:"Icy fog",51:"Light drizzle",53:"Drizzle",55:"Dense drizzle",56:"Freezing drizzle",57:"Freezing drizzle",61:"Light rain",63:"Moderate rain",65:"Heavy rain",66:"Freezing rain",67:"Freezing rain",71:"Light snow",73:"Snow",75:"Heavy snow",77:"Snow grains",80:"Light showers",81:"Moderate showers",82:"Violent showers",85:"Snow showers",86:"Snow showers",95:"Thunderstorm",96:"Storm with hail",99:"Storm with hail"}};

/* ---------- tabs ---------- */
document.querySelectorAll(".seg-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".seg-btn").forEach((b) => {
      b.classList.remove("active"); b.setAttribute("aria-selected", "false");
    });
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active"); btn.setAttribute("aria-selected", "true");
    $("#panel-" + btn.dataset.tab).classList.add("active");
  });
});

/* ---------- chọn địa điểm ---------- */
function choosePlace(lat, lon, name, gps = false) {
  state.lat = lat; state.lon = lon; state.name = name; state.gps = gps;
  $("#chosen-place-name").textContent = name;
  $("#chosen-place").classList.remove("hidden");
  $("#search-results").innerHTML = ""; // chọn xong thì ẩn danh sách gợi ý
  predict();
}
$("#change-place").addEventListener("click", () => {
  $("#chosen-place").classList.add("hidden");
  $("#scene-card").classList.add("hidden");
  $("#factors-card").classList.add("hidden");
  $("#history-card").classList.add("hidden");
  stopSea();
});

/* ---------- 1) tìm kiếm (Open-Meteo geocoding, miễn phí, không cần key) ---------- */
let searchTimer;
$("#search-input").addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  const q = e.target.value.trim();
  if (q.length < 2) { $("#search-results").innerHTML = ""; return; }
  searchTimer = setTimeout(() => doSearch(q), 350);
});
$("#search-btn").addEventListener("click", () => doSearch($("#search-input").value.trim()));
$("#search-input").addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(e.target.value.trim()); });

async function doSearch(q) {
  if (!q) return;
  const box = $("#search-results");
  box.innerHTML = `<li><button disabled>${escapeHtml(t("searching"))}</button></li>`;
  try {
    const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const j = await r.json();
    if (j.error === "missing_key") { box.innerHTML = `<li><button disabled>${escapeHtml(t("noKey"))}</button></li>`; return; }
    if (!j.results || !j.results.length) { box.innerHTML = `<li><button disabled>${escapeHtml(t("noResult"))}</button></li>`; return; }
    box.innerHTML = "";
    j.results.forEach((p) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.innerHTML = `${escapeHtml(p.name)}<small>${escapeHtml(p.display || p.address || "")}</small>`;
      b.addEventListener("click", async () => {
        b.disabled = true;
        const oldHtml = b.innerHTML;
        b.innerHTML = escapeHtml(t("resolving"));
        try {
          const rr = await fetch(`/api/search?ref_id=${encodeURIComponent(p.ref_id)}`);
          const jj = await rr.json();
          if (jj.lat != null && jj.lng != null) {
            choosePlace(jj.lat, jj.lng, jj.display || p.display || p.name);
          } else {
            b.innerHTML = oldHtml; b.disabled = false;
          }
        } catch { b.innerHTML = oldHtml; b.disabled = false; }
      });
      li.appendChild(b); box.appendChild(li);
    });
  } catch { box.innerHTML = `<li><button disabled>${escapeHtml(t("netErr"))}</button></li>`; }
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

/* ---------- 2) GPS ---------- */
$("#gps-btn").addEventListener("click", () => {
  const st = $("#gps-status");
  if (!navigator.geolocation) { st.textContent = t("noGeo"); return; }
  st.textContent = t("gettingPos");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      choosePlace(latitude, longitude, t("myPos", latitude, longitude), true);
      st.textContent = "";
    },
    () => { st.textContent = t("posDenied"); },
    { timeout: 10000 }
  );
});

/* ---------- mặt trăng & solunar (tính tại chỗ) ---------- */
function moonInfo(date = new Date()) {
  const synodic = 29.53058867;
  // Mốc trăng non chuẩn thiên văn: 10/10/2026 15:50 UTC (hiệu chỉnh 22/10/2026,
  // trước đây dùng mốc 2000 bị lệch ~1 ngày so với lịch âm thực tế)
  const known = Date.UTC(2026, 9, 10, 15, 50) / 86400000;
  const days = date.getTime() / 86400000 - known;
  const age = ((days % synodic) + synodic) % synodic;
  const illum = (1 - Math.cos((2 * Math.PI * age) / synodic)) / 2;
  const names = t("moonNames");
  const idx = Math.floor(((age / synodic) * 8 + 0.5)) % 8;
  // giờ trăng lên đỉnh (ước tính): trăng non ~12h trưa, mỗi ngày trễ ~50 phút
  const transit = (12 + age * 0.841 + 24) % 24;
  const fmt = (h) => { const H = Math.floor(h) % 24, M = Math.floor((h % 1) * 60); return `${String(H).padStart(2,"0")}:${String(M).padStart(2,"0")}`; };
  const major1 = fmt(transit), major2 = fmt((transit + 12.42) % 24);
  return { age, illum, phaseName: names[idx], major: [major1, major2] };
}

/* ---------- dự đoán ---------- */
async function predict() {
  const scene = $("#scene-card"), factors = $("#factors-card");
  scene.classList.remove("hidden"); factors.classList.remove("hidden");
  scene.scrollIntoView({ behavior: "smooth", block: "nearest" });
  setVerdict(t("vLoadingT"), t("vLoadingS"), null);
  startSonar(); // animation máy dò cá trong lúc chờ AI
  $("#verdict").classList.add("is-loading");
  $("#score").textContent = "–";
  $("#gauge-arc").style.strokeDashoffset = 251.4;

  let wx;
  try {
    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${state.lat}&longitude=${state.lon}` +
      `&current=temperature_2m,relative_humidity_2m,pressure_msl,cloud_cover,wind_speed_10m,wind_direction_10m,weather_code,precipitation,is_day` +
      `&hourly=temperature_2m,pressure_msl,cloud_cover,wind_speed_10m,wind_direction_10m,precipitation` +
      `&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code` +
      `&timezone=auto&forecast_days=1&past_days=5`
    );
    wx = await r.json();
  } catch { setVerdict(t("vNetErrT"), t("vNetErrS"), 0); stopSea(); $("#verdict").classList.remove("is-loading"); return; }

  const c = wx.current, moon = moonInfo();
  const nowH = new Date().getHours() + new Date().getMinutes() / 60;

  // gọi API dự đoán kiểu job: POST tạo job (trả về ngay) rồi poll GET mỗi 2s.
  // Mỗi poll là request nhẹ độc lập — hụt thì poll lại, không treo như chờ 1 request dài.
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  async function predictViaJob(payload) {
    let job = null;
    for (let a = 0; a < 2 && !job; a++) { // POST nhanh, thử lại 1 lần nếu kẹt
      try {
        const r = await fetch("/api/predict", {
          method: "POST", headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(10000), body: JSON.stringify(payload),
        });
        if (r.ok) job = await r.json();
      } catch { /* thử lại */ }
      if (!job && a === 0) await sleep(1500);
    }
    if (!job) return null;
    if (job.status === "done") return job; // trúng job đã xong (dedup)
    for (let i = 0; i < 90; i++) { // poll tối đa ~180s (chờ AI reasoning medium thoải mái)
      await sleep(2000);
      try {
        const pr = await fetch(`/api/predict?job=${encodeURIComponent(job.jobId)}`,
          { signal: AbortSignal.timeout(10000) });
        if (!pr.ok) continue;
        const pj = await pr.json();
        if (pj.status === "done") return pj;
        if (pj.status === "error") return null;
      } catch { /* poll hụt → poll tiếp */ }
    }
    return null;
  }
  let api = null;
  try {
    api = await predictViaJob({ lat: state.lat, lon: state.lon, gps: state.gps, lang: LANG, weather: c,
      moon: { illum: moon.illum, phase: moon.phaseName }, history: historyData(wx) });
  } catch { /* fallback demo */ }

  const data = api || demoScore(c, wx, moon, nowH);
  renderResult(data, c, moon);
  renderHistory(wx);
  const hp = wx.hourly?.pressure_msl || [];
  const trend = hp.length > 3 ? hp[hp.length - 1] - hp[hp.length - 4] : 0;
  const toH = (iso) => { const d = new Date(iso); return d.getHours() + d.getMinutes() / 60; };
  const sr = toH(wx.daily.sunrise[0]), ss = toH(wx.daily.sunset[0]);
  const nearGolden = Math.abs(nowH - sr) < 1 || Math.abs(nowH - ss) < 1;
  startSea(data.score, data.depth ?? feedingDepth(c, trend, nearGolden, nowH));
  $("#ai-note-text").textContent = api && !api.demo
    ? t("aiNoteLive")
    : t("aiNoteFallback") + (api && api.llmError ? t("errCode", api.llmError) : "");
}

/* thuật toán demo — sẽ thay bằng LLM */
function demoScore(c, wx, moon, nowH) {
  const chips = [];
  let s = 0;
  const toH = (iso) => { const d = new Date(iso); return d.getHours() + d.getMinutes() / 60; };
  const sr0 = toH(wx.daily.sunrise[0]), ss0 = toH(wx.daily.sunset[0]);
  const isDay = c.is_day === 1 ? true : c.is_day === 0 ? false : (nowH >= sr0 && nowH <= ss0);

  // mặt trăng 25đ
  const prox = Math.min(moon.illum, 1 - moon.illum); // gần non/tròn
  const moonPts = Math.round(25 * (1 - prox * 2));
  s += moonPts;
  chips.push({ k: t("dMoon"), v: `${moon.phaseName} · ${Math.round(moon.illum * 100)}%`, d: t("dMoonD", moon.major.join(" & ")), cls: moonPts >= 17 ? "good" : moonPts >= 10 ? "warn" : "bad" });

  // áp suất 25đ (+xu hướng)
  const p = c.pressure_msl;
  const hp = wx.hourly?.pressure_msl || [];
  const trend = hp.length > 3 ? hp[hp.length - 1] - hp[hp.length - 4] : 0;
  let pPts = p >= 1013 && p <= 1022 ? 20 : (p >= 1005 && p < 1013) || (p > 1022 && p <= 1030) ? 12 : 6;
  if (trend < -1) pPts += 5; // đang giảm: cá ăn tích cực trước mưa
  pPts = Math.min(25, pPts); s += pPts;
  chips.push({ k: t("dPressure"), v: `${Math.round(p)} hPa`, d: trend < -1 ? t("dPDown") : trend > 1 ? t("dPUp") : t("dPStable"), cls: pPts >= 17 ? "good" : pPts >= 10 ? "warn" : "bad" });

  // gió 15đ
  const w = c.wind_speed_10m;
  const wPts = w < 10 ? 15 : w < 20 ? 10 : w < 30 ? 5 : 2; s += wPts;
  const wdirs = t("compass");
  const wdirName = c.wind_direction_10m == null ? "" : wdirs[Math.round(c.wind_direction_10m / 45) % 8];
  chips.push({ k: t("dWind"), v: `${Math.round(w)} km/h${wdirName ? " · " + wdirName : ""}`,
    d: w < 10 ? t("dWCalm") : w < 20 ? t("dWMod") : t("dWStrong"),
    cls: wPts >= 10 ? "good" : wPts >= 5 ? "warn" : "bad" });

  // mây 10đ
  const cl = c.cloud_cover;
  const clPts = cl >= 20 && cl <= 60 ? 10 : cl < 20 ? 6 : cl <= 90 ? 7 : 4; s += clPts;
  chips.push({ k: t("dCloud"), v: `${cl}%`, d: cl >= 20 && cl <= 60 ? t("dClIdeal") : cl < 20 ? (isDay ? t("dClSun") : t("dClClear")) : t("dClCloudy"), cls: clPts >= 8 ? "good" : "warn" });

  const pr = c.precipitation ?? 0;
  const wmo = WMO[LANG][c.weather_code] ?? "";
  chips.push({ k: t("dRain"), v: pr > 0 ? `${pr} mm` : t("dNoRain"),
    d: pr > 0 && pr <= 2.5 ? t("dRainLight", wmo) : pr > 2.5 ? t("dRainHeavy", wmo) : (wmo || t("dDry")),
    cls: pr > 0 && pr <= 2.5 ? "good" : pr > 2.5 ? "bad" : "" });

  // nhiệt độ 15đ
  const t = c.temperature_2m;
  const tPts = t >= 24 && t <= 30 ? 15 : (t >= 20 && t < 24) || (t > 30 && t <= 33) ? 10 : 5; s += tPts;
  chips.push({ k: t("dTemp"), v: `${Math.round(t)}°C`, d: t >= 24 && t <= 30 ? t("dTIdeal") : t("dTOff"), cls: tPts >= 12 ? "good" : tPts >= 8 ? "warn" : "bad" });

  // độ ẩm: chỉ hiển thị tham khảo (không tính điểm — độ ẩm không tác động trực tiếp lên cá,
  // chỉ là dấu hiệu kèm theo của mưa/âm u, mà 2 yếu tố đó đã được chấm điểm riêng)
  const hu = c.relative_humidity_2m;
  chips.push({ k: t("dHum"), v: `${hu}%`,
    d: hu >= 85 ? t("dHuHigh") : hu >= 60 ? t("dHuNormal") : t("dHuDry"),
    cls: hu >= 85 ? "warn" : "" });

  // giờ vàng bình minh/hoàng hôn 10đ
  const nearGolden = Math.abs(nowH - sr0) < 1 || Math.abs(nowH - ss0) < 1;
  s += nearGolden ? 10 : 3;
  chips.push({ k: t("dSolunar"), v: moon.major.join(" & "), d: nearGolden ? t("dGoldenNow") : t("dGoldenLater"), cls: nearGolden ? "good" : "warn" });

  s = Math.min(100, Math.round(s));
  const verdict = s >= 75 ? [t("dGo"), t("dGoS")]
    : s >= 55 ? [t("dOk"), t("dOkS")]
    : s >= 30 ? [t("dMeh"), t("dMehS")]
    : [t("dHome"), t("dHomeS")];
  return { score: s, title: verdict[0], sub: verdict[1], chips, demo: true };
}

function renderResult(data, c, moon) {
  $("#verdict").classList.remove("is-loading");
  animateScore(data.score);
  setVerdict(data.title, data.sub, data.score);
  const box = $("#chips"); box.innerHTML = "";
  (data.chips || []).forEach((ch) => {
    const d = document.createElement("div");
    d.className = "chip " + (ch.cls || "");
    d.innerHTML = `<div class="k">${escapeHtml(ch.k)}</div><div class="v">${escapeHtml(ch.v)}</div><div class="d">${escapeHtml(ch.d || "")}</div>`;
    box.appendChild(d);
  });
}

function setVerdict(title, sub, score) {
  $("#verdict-title").textContent = title;
  const subEl = $("#verdict-sub"), moreBtn = $("#verdict-more");
  subEl.textContent = sub;
  subEl.classList.remove("expanded");
  moreBtn.hidden = true;
  // chỉ hiện nút "xem thêm" khi chữ thật sự bị cắt bớt
  requestAnimationFrame(() => {
    const cut = subEl.scrollHeight > subEl.clientHeight + 1;
    moreBtn.hidden = !cut;
    if (cut) moreBtn.textContent = t("verdictMore");
  });
  const el = $("#verdict-title");
  el.style.color = score == null ? "var(--ink)" : score >= 75 ? "var(--glow)" : score >= 55 ? "var(--lime)" : score >= 30 ? "var(--amber)" : "var(--coral)";
  el.style.textShadow = `0 0 34px ${score == null ? "transparent" : score >= 75 ? "rgba(62,230,196,.55)" : score >= 55 ? "rgba(163,230,53,.45)" : score >= 30 ? "rgba(245,185,66,.45)" : "rgba(255,107,107,.45)"}`;
}

/* ---------- lịch sử: 5 giờ gần nhất + 5 ngày qua ---------- */
function historyData(wx) {
  const times = wx.hourly.time;
  let idx = times.findIndex((t) => t.slice(0, 13) === wx.current.time.slice(0, 13));
  if (idx < 0) idx = times.length - 1;
  const hours = [];
  for (let i = Math.max(0, idx - 4); i <= idx; i++) {
    hours.push({
      time: times[i].slice(11, 16),
      temp: Math.round(wx.hourly.temperature_2m[i]),
      pressure: Math.round(wx.hourly.pressure_msl[i]),
      wind: Math.round(wx.hourly.wind_speed_10m[i]),
      windDir: wx.hourly.wind_direction_10m ? Math.round(wx.hourly.wind_direction_10m[i]) : null,
      cloud: wx.hourly.cloud_cover[i],
      precip: +wx.hourly.precipitation[i].toFixed(1),
    });
  }
  const days = [];
  const n = wx.daily.time.length;
  for (let i = Math.max(0, n - 6); i < n - 1; i++) { // 5 ngày trước, không tính hôm nay
    const d = new Date(wx.daily.time[i] + "T00:00:00");
    days.push({
      label: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
      tmax: Math.round(wx.daily.temperature_2m_max[i]),
      tmin: Math.round(wx.daily.temperature_2m_min[i]),
      precip: +wx.daily.precipitation_sum[i].toFixed(1),
      wmoCode: wx.daily.weather_code[i],
    });
  }
  return { hours, days };
}

function renderHistory(wx) {
  const { hours, days } = historyData(wx);
  const card = $("#history-card");
  card.classList.remove("hidden");
  $("#hist-hours").innerHTML =
    `<thead><tr><th>${t("thHour")}</th><th>${t("thTemp")}</th><th>${t("thPressure")}</th><th>${t("thWind")}</th><th>${t("thCloud")}</th><th>${t("thRain")}</th></tr></thead><tbody>` +
    hours.map((h) =>
      `<tr><td>${h.time}</td><td>${h.temp}°C</td><td>${h.pressure} hPa</td>` +
      `<td>${h.wind} km/h</td><td>${h.cloud}%</td><td>${h.precip > 0 ? h.precip + " mm" : "—"}</td></tr>`
    ).join("") + "</tbody>";
  $("#hist-days").innerHTML =
    `<thead><tr><th>${t("thDate")}</th><th>${t("thHiLo")}</th><th>${t("thRain")}</th><th>${t("thWeather")}</th></tr></thead><tbody>` +
    days.map((d) =>
      `<tr><td>${d.label}</td><td>${d.tmax}° / ${d.tmin}°</td>` +
      `<td>${d.precip > 0 ? d.precip + " mm" : "—"}</td><td>${escapeHtml(WMO[LANG][d.wmoCode] ?? "—")}</td></tr>`
    ).join("") + "</tbody>";
}

/* ---------- tầng nước cá ăn từ thời tiết (0=mặt, 1=lửng, 2=đáy) ----------
   Nắng gắt trưa → chìm đáy; âm u/áp suất giảm/giờ vàng → nổi lên;
   nước lạnh → xuống đáy. Animation đàn cá tụ về đúng tầng này. */
function feedingDepth(c, trend, nearGolden, nowH) {
  let d = 1; // mặc định lửng
  const t = c.temperature_2m, cl = c.cloud_cover, w = c.wind_speed_10m;
  if (cl < 30 && t > 30 && nowH >= 10 && nowH <= 15) d += 1;
  if (cl >= 40 && cl <= 80) d -= 0.5;
  if (trend < -1) d -= 0.5;
  if (t < 20) d += 0.5;
  if (nearGolden) d -= 0.5;
  // Thiếu oxy (kinh nghiệm thực tế của Điệp): trời oi nóng + lặng gió → oxy hòa tan
  // thấp, cá (kể cả cá đáy) nổi lên tầng lửng/mặt để hớp oxy
  if (t >= 30 && w <= 5) d -= 0.5;
  return Math.max(0, Math.min(2, d));
}

/* ---------- đồng hồ điểm ---------- */
function animateScore(target) {
  const arc = $("#gauge-arc"), num = $("#score");
  const len = 251.4, t0 = performance.now(), dur = 1600, from = parseInt(num.textContent) || 0;
  function tick(t) {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    const v = Math.round(from + (target - from) * e);
    num.textContent = v;
    arc.style.strokeDashoffset = len * (1 - v / 100);
    if (k < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ---------- đàn cá canvas ----------
   Điểm cao → đông cá, bơi nhanh, sáng rực. Điểm thấp → lèo tèo vài con, bơi chậm, mờ.
   Tầng ăn (depthAvg 0=mặt → 2=đáy) → đàn cá tụ về đúng tầng đó, di cư mượt mà. */
function scoreColor(s) { return s >= 75 ? "#3ee6c4" : s >= 55 ? "#a3e635" : s >= 30 ? "#f5b942" : "#ff6b6b"; }
function stopSea() { if (state.animId) cancelAnimationFrame(state.animId); state.animId = null; }

/* ---------- sonar máy dò cá: chạy trong lúc chờ AI ---------- */
function startSonar() {
  stopSea();
  const cv = $("#sea"), ctx = cv.getContext("2d");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = cv.clientWidth, H = cv.clientHeight;
  cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cx = W / 2, cy = H * 0.52, maxR = Math.hypot(W, H) / 2;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    ctx.beginPath(); ctx.arc(cx, cy, maxR * 0.45, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(62,230,196,.25)"; ctx.lineWidth = 2; ctx.stroke();
    return;
  }
  const rings = [{ r: 0 }];
  let lastPing = 0;
  const blips = Array.from({ length: 6 }, (_, i) => {
    const ang = hash1(i * 31 + 2) * Math.PI * 2, rr = maxR * (0.25 + hash1(i * 37 + 3) * 0.55);
    return { x: cx + Math.cos(ang) * rr, y: cy + Math.sin(ang) * rr * 0.7, ang, glow: 0, s: 3 + hash1(i * 41 + 4) * 4 };
  });
  function frame(t) {
    ctx.clearRect(0, 0, W, H);
    // vòng ping lan ra từ tâm
    if (t - lastPing > 1100) { rings.push({ r: 0 }); lastPing = t; }
    for (let i = rings.length - 1; i >= 0; i--) {
      const rg = rings[i];
      rg.r += Math.max(1.4, maxR / 150);
      const k = rg.r / maxR;
      if (k >= 1) { rings.splice(i, 1); continue; }
      ctx.beginPath(); ctx.arc(cx, cy, rg.r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(62,230,196," + (0.45 * (1 - k)).toFixed(3) + ")";
      ctx.lineWidth = 2; ctx.shadowColor = "#3ee6c4"; ctx.shadowBlur = 10;
      ctx.stroke(); ctx.shadowBlur = 0;
    }
    // tia quét xoay
    const sw = (t / 1400) % (Math.PI * 2);
    if (ctx.createConicGradient) {
      const g = ctx.createConicGradient(sw - 0.6, cx, cy);
      g.addColorStop(0, "rgba(62,230,196,0)");
      g.addColorStop(0.09, "rgba(62,230,196,.22)");
      g.addColorStop(0.1, "rgba(62,230,196,0)");
      g.addColorStop(1, "rgba(62,230,196,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, maxR, 0, Math.PI * 2); ctx.closePath(); ctx.fill();
    } else {
      ctx.save(); ctx.strokeStyle = "rgba(62,230,196,.5)"; ctx.lineWidth = 2;
      ctx.shadowColor = "#3ee6c4"; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sw) * maxR, cy + Math.sin(sw) * maxR); ctx.stroke(); ctx.restore();
    }
    // chấm cá sáng lên khi tia quét đi qua
    blips.forEach((b) => {
      let d = (sw - b.ang) % (Math.PI * 2);
      if (d < 0) d += Math.PI * 2;
      if (d < 0.15) b.glow = 1;
      b.glow *= 0.965;
      ctx.save();
      ctx.globalAlpha = 0.22 + b.glow * 0.78;
      ctx.fillStyle = "#3ee6c4"; ctx.shadowColor = "#3ee6c4"; ctx.shadowBlur = 4 + b.glow * 16;
      ctx.beginPath(); ctx.ellipse(b.x, b.y, b.s, b.s * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
    state.animId = requestAnimationFrame(frame);
  }
  state.animId = requestAnimationFrame(frame);
}
const hash1 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function startSea(score, depthAvg = 1) {
  stopSea();
  const cv = $("#sea"), ctx = cv.getContext("2d");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = cv.clientWidth, H = cv.clientHeight;
  cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const color = scoreColor(score);
  const energy = score / 100;                       // 0..1
  const count = 3 + Math.round(energy * 14);        // 3..17 con
  const speedBase = 0.25 + energy * 2.2;            // càng cao bơi càng nhanh
  const alpha = 0.5 + energy * 0.5;                 // càng thấp càng mờ
  const bandCenter = H * (0.24 + depthAvg * 0.26);  // depth 0→0.24H (mặt), 2→0.76H (đáy)

  // giữ đàn cá cũ để chúng "di cư" mượt khi dự đoán lại, chỉ cập nhật tham số
  if (!state.seaFishes) {
    state.seaFishes = Array.from({ length: 17 }, (_, i) => ({
      x: hash1(i * 3 + 1) * W, y: hash1(i * 7 + 2) * H,
      spread: hash1(i * 11 + 3) - 0.5,              // -0.5..0.5, cố định mỗi con
      s: 8 + hash1(i * 13 + 4) * 14,
      dir: i % 2 ? 1 : -1, ph: hash1(i * 17 + 5) * Math.PI * 2,
      depth: 0.4 + hash1(i * 19 + 6) * 0.6,
    }));
  }
  const fishes = state.seaFishes;
  fishes.forEach((f, i) => {
    f.active = i < count;
    f.v = (0.5 + hash1(i * 23 + 7)) * speedBase;
  });

  const bubbles = Array.from({ length: 24 }, (_, i) => ({
    x: hash1(i * 5 + 8) * W, y: hash1(i * 9 + 9) * H,
    r: 1 + hash1(i * 13 + 10) * 3, v: 0.3 + hash1(i * 17 + 11) * 0.8,
  }));
  const plankton = Array.from({ length: 60 }, (_, i) => ({
    x: hash1(i * 7 + 12) * W, y: hash1(i * 11 + 13) * H,
    r: hash1(i * 13 + 14) * 1.6, tw: hash1(i * 17 + 15) * Math.PI * 2,
  }));

  function drawFish(f, t) {
    const lively = 0.4 + energy * 1.4;              // quẫy đuôi nhanh khi cá ăn mạnh
    const wob = Math.sin(t / 300 + f.ph) * 4 * lively;
    ctx.save();
    ctx.translate(f.x, f.y + wob * 0.4);
    ctx.scale(f.dir * f.depth, f.depth);
    ctx.shadowColor = color; ctx.shadowBlur = 8 + energy * 16;
    ctx.fillStyle = color; ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.ellipse(0, 0, f.s, f.s * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    const flap = Math.sin(t / (220 - energy * 140) + f.ph) * f.s * 0.35;
    ctx.beginPath();
    ctx.moveTo(-f.s * 0.9, 0);
    ctx.lineTo(-f.s * 1.5, -f.s * 0.4 + flap);
    ctx.lineTo(-f.s * 1.5, f.s * 0.4 + flap);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.fillStyle = "#04121f";
    ctx.beginPath(); ctx.arc(f.s * 0.55, -f.s * 0.1, f.s * 0.11, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function frame(t) {
    ctx.clearRect(0, 0, W, H);
    plankton.forEach((p) => {
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t / 700 + p.tw);
      ctx.fillStyle = "#9fd8cf"; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(159,216,207,.35)"; ctx.lineWidth = 1;
    bubbles.forEach((b) => {
      b.y -= b.v; if (b.y < -6) { b.y = H + 6; b.x = Math.random() * W; }
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
    });
    fishes.forEach((f) => {
      if (!f.active) return;
      const targetY = bandCenter + f.spread * H * 0.30;
      if (!reduced) {
        f.x += f.v * f.dir;
        f.y += (targetY - f.y) * 0.03;              // di cư mượt về tầng ăn
        if (f.x > W + 40) { f.x = -40; f.dir = 1; }
        if (f.x < -40) { f.x = W + 40; f.dir = -1; }
        if (Math.random() < 0.002) f.dir *= -1;
      } else { f.y = targetY; }
      drawFish(f, t);
    });
    if (!reduced) state.animId = requestAnimationFrame(frame);
  }
  frame(0);
}
