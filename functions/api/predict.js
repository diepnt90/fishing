/**
 * POST /api/predict — gọi AI đồng bộ, trả kết quả luôn (tối đa ~55s).
 *
 * Thiết kế đồng bộ có chủ ý: kiểu job bất đồng bộ trước đây (waitUntil + poll +
 * caches.default) hay treo vì (1) caches.default không đồng bộ giữa các colo
 * Cloudflare → poll mãi không thấy, (2) task nền waitUntil có thể bị giết.
 * Đồng bộ thì đơn giản, khó hỏng. Cache 1h vẫn giữ để dedup (miss thì tính lại).
 *
 * Secrets (Cloudflare, loại Secret, không commit):
 *   LLM_API_KEY — key OpenAI
 */

const CACHE_ENABLED = true; // dedup job theo lưới+khung giờ (~1h); false: testing, mỗi request 1 job mới
const LLM_MODEL = "gpt-5-mini";

/* chuỗi dùng chung, song ngữ */
const T = {
  vi: {
    compass: ["Bắc","Đông Bắc","Đông","Đông Nam","Nam","Tây Nam","Tây","Tây Bắc"],
    wmo: {0:"Quang đãng",1:"Chủ yếu quang đãng",2:"Mây rải rác",3:"Âm u",45:"Sương mù",48:"Sương mù đóng băng",51:"Mưa phùn nhẹ",53:"Mưa phùn",55:"Mưa phùn dày",56:"Mưa phùn đóng băng",57:"Mưa phùn đóng băng",61:"Mưa nhẹ",63:"Mưa vừa",65:"Mưa to",66:"Mưa đóng băng",67:"Mưa đóng băng",71:"Tuyết nhẹ",73:"Tuyết",75:"Tuyết dày",77:"Tuyết hạt",80:"Mưa rào nhẹ",81:"Mưa rào vừa",82:"Mưa rào to",85:"Mưa tuyết",86:"Mưa tuyết",95:"Dông",96:"Dông kèm mưa đá",99:"Dông kèm mưa đá"},
    agree: "đồng thuận", partial: "chênh lệch vừa", conflict: "MÂU THUẪN", rainDiff: "chênh lệch",
    warn: "⚠️ CẢNH BÁO: các nguồn mâu thuẫn mạnh — hãy thận trọng, giảm độ tin cậy của kết luận.",
    ok: "Các nguồn nhìn chung đồng thuận — dữ liệu đáng tin.",
    oneSrc: "(chỉ có 1 nguồn khả dụng — chưa đối chứng được)",
  },
  en: {
    compass: ["N","NE","E","SE","S","SW","W","NW"],
    wmo: {0:"Clear",1:"Mostly clear",2:"Partly cloudy",3:"Overcast",45:"Fog",48:"Icy fog",51:"Light drizzle",53:"Drizzle",55:"Dense drizzle",56:"Freezing drizzle",57:"Freezing drizzle",61:"Light rain",63:"Moderate rain",65:"Heavy rain",66:"Freezing rain",67:"Freezing rain",71:"Light snow",73:"Snow",75:"Heavy snow",77:"Snow grains",80:"Light showers",81:"Moderate showers",82:"Violent showers",85:"Snow showers",86:"Snow showers",95:"Thunderstorm",96:"Storm with hail",99:"Storm with hail"},
    agree: "agree", partial: "differ somewhat", conflict: "CONFLICT", rainDiff: "differ",
    warn: "⚠️ WARNING: sources strongly disagree — be cautious, lower confidence in the conclusion.",
    ok: "Sources generally agree — data looks reliable.",
    oneSrc: "(only 1 source available — no cross-check possible)",
  },
};

/* lưới cache: tìm địa điểm → 0.02° (~2km); GPS → 0.27° (~30km) */
function cacheGrid(lat, lon, gps) {
  const step = gps ? 0.27 : 0.02;
  const dec = step < 0.1 ? 2 : 1;
  const r = (v) => (Math.round(v / step) * step).toFixed(dec);
  return `${r(lat)},${r(lon)}`;
}
function jobIdFor(lat, lon, gps, lang = "vi") {
  const grid = cacheGrid(lat, lon, gps);
  if (!CACHE_ENABLED) return `${grid}|${lang}|${Date.now()}|${Math.random().toString(36).slice(2, 8)}`;
  return `${grid}|${lang}`; // dedup ~1h nhờ max-age=3600 của cache (không kèm giờ để tránh miss khi qua mốc giờ)
}
const jobKey = (jid) => new Request(`https://cache.local/api/job?k=${encodeURIComponent(jid)}`);
const jsonCache = (obj, maxAge = 3600) =>
  new Response(JSON.stringify(obj), {
    headers: { "content-type": "application/json", "cache-control": `public, max-age=${maxAge}` },
  });

function demoPredict(weather, moon, lang = "vi") {
  const en = lang === "en";
  const t = weather.temperature_2m ?? 28;
  const p = weather.pressure_msl ?? 1013;
  const w = weather.wind_speed_10m ?? 8;
  const hu = weather.relative_humidity_2m ?? 70;
  const pr = weather.precipitation ?? 0;
  const wdirs = T[lang].compass;
  const wdir = weather.wind_direction_10m;
  const wdirName = wdir == null ? "" : wdirs[Math.round(wdir / 45) % 8];
  const illum = moon.illum ?? 0.5;

  let score = 40;
  if (t >= 24 && t <= 30) score += 12;
  if (p >= 1013 && p <= 1022) score += 12;
  if (w < 15) score += 10;
  const prox = Math.min(illum, 1 - illum);
  score += Math.round(14 * (1 - prox * 2));
  score = Math.max(5, Math.min(97, score));

  const title = score >= 75 ? (en ? "GO FISHING!" : "ĐI CÂU NGAY!")
    : score >= 55 ? (en ? "PRETTY GOOD" : "KHÁ ĐẤY")
    : score >= 30 ? (en ? "HIT OR MISS" : "HÊN XUI") : (en ? "STAY HOME" : "Ở NHÀ ĐI");
  const sub = score >= 75 ? (en ? "Fish are biting hard — grab your rod!" : "Cá đang ăn mạnh — xách cần lên đường!")
    : score >= 55 ? (en ? "Good chance, time it with the golden hour." : "Có cơ hội tốt, canh đúng giờ vàng mà quất.")
    : score >= 30 ? (en ? "Fish are lazy; go for fun." : "Cá lười ăn, đi cho vui là chính.")
    : (en ? "Fish aren't biting today — save your bait." : "Hôm nay cá không thèm ăn — ở nhà đỡ phí mồi.");
  const fromApi = en ? "From weather API" : "Từ API thời tiết";

  return {
    score, title, sub,
    chips: [
      { k: en ? "Temperature" : "Nhiệt độ", v: `${Math.round(t)}°C`, d: fromApi, cls: t >= 24 && t <= 30 ? "good" : "warn" },
      { k: en ? "Pressure" : "Áp suất", v: `${Math.round(p)} hPa`, d: fromApi, cls: p >= 1013 && p <= 1022 ? "good" : "warn" },
      { k: en ? "Wind" : "Gió", v: `${Math.round(w)} km/h${wdirName ? " · " + wdirName : ""}`, d: fromApi, cls: w < 15 ? "good" : "warn" },
      { k: en ? "Humidity" : "Độ ẩm", v: `${hu}%`, d: hu >= 85 ? (en ? "High humidity — rain may be coming" : "Ẩm cao — có thể sắp mưa") : (en ? "Normal" : "Bình thường"), cls: "" },
      { k: en ? "Rain" : "Mưa", v: pr > 0 ? `${pr} mm` : (en ? "No rain" : "Không mưa"), d: pr > 0 && pr <= 2.5 ? (en ? "Light rain — triggers feeding" : "Mưa nhỏ — kích thích cá ăn") : pr > 2.5 ? (en ? "Heavy rain — poor" : "Mưa to — kém") : (en ? "Dry" : "Trời khô ráo"), cls: pr > 0 && pr <= 2.5 ? "good" : pr > 2.5 ? "bad" : "" },
    ],
    demo: true,
  };
}

/* Format số liệu KÈM ĐƠN VỊ cho AI — tránh AI đoán nhầm đơn vị (vd: km/h thành m/s) */
function fmtWeather(w = {}, lang = "vi") {
  const en = lang === "en";
  const dirs = T[lang].compass;
  const wd = w.wind_direction_10m;
  const wdName = wd == null ? "?" : dirs[Math.round(wd / 45) % 8];
  return en ? [
    `temperature ${w.temperature_2m ?? "?"}°C`,
    `humidity ${w.relative_humidity_2m ?? "?"}%`,
    `pressure ${w.pressure_msl ?? "?"} hPa`,
    `cloud ${w.cloud_cover ?? "?"}%`,
    `wind ${w.wind_speed_10m ?? "?"} km/h, direction ${wd ?? "?"}° (${wdName})`,
    `rain ${w.precipitation ?? "?"} mm`,
    `WMO weather code ${w.weather_code ?? "?"}`,
    w.is_day === 1 ? "daytime" : w.is_day === 0 ? "nighttime" : "",
  ].filter(Boolean).join("; ") : [
    `nhiệt độ ${w.temperature_2m ?? "?"}°C`,
    `độ ẩm ${w.relative_humidity_2m ?? "?"}%`,
    `áp suất ${w.pressure_msl ?? "?"} hPa`,
    `mây ${w.cloud_cover ?? "?"}%`,
    `gió ${w.wind_speed_10m ?? "?"} km/h, hướng ${wd ?? "?"}° (${wdName})`,
    `mưa ${w.precipitation ?? "?"} mm`,
    `mã thời tiết WMO ${w.weather_code ?? "?"}`,
    w.is_day === 1 ? "đang là ban ngày" : w.is_day === 0 ? "đang là ban đêm" : "",
  ].filter(Boolean).join("; ");
}
function fmtHistory(h, lang = "vi") {
  if (!h) return lang === "en" ? "(none)" : "(không có)";
  const en = lang === "en";
  const wmoName = (c) => T[lang].wmo[c] ?? "?";
  const dirName = (d) => d == null ? "?" : T[lang].compass[Math.round(d / 45) % 8];
  const hh = (h.hours || []).map((x) =>
    en ? `${x.time}: ${x.temp}°C, ${x.pressure} hPa, wind ${x.wind} km/h (${dirName(x.windDir)}), cloud ${x.cloud}%, rain ${x.precip} mm`
       : `${x.time}: ${x.temp}°C, ${x.pressure} hPa, gió ${x.wind} km/h (${dirName(x.windDir)}), mây ${x.cloud}%, mưa ${x.precip} mm`).join(" | ");
  const dd = (h.days || []).map((x) =>
    en ? `${x.label}: high ${x.tmax}°C/low ${x.tmin}°C, rain ${x.precip} mm, ${wmoName(x.wmoCode)}`
       : `${x.label}: cao ${x.tmax}°C/thấp ${x.tmin}°C, mưa ${x.precip} mm, ${wmoName(x.wmoCode)}`).join(" | ");
  return en ? `Last 5 hours: ${hh} \nLast 5 days: ${dd}` : `5 giờ gần nhất: ${hh} \n5 ngày qua: ${dd}`;
}
function fmtMoon(moon = {}, lang = "vi") {
  const pct = Math.round((moon.illum ?? 0) * 100);
  return `${moon.phase || "?"} (${lang === "en" ? "illumination" : "độ sáng"} ${pct}%)`;
}

function localTime(w = {}) {
  const m = /T(\d{2}:\d{2})/.exec(w.time || "");
  return m ? m[1] : "?";
}
function buildPrompt(lang, { skill, weather, moon, history, lat, lon, crossCheck }) {
  const en = lang === "en";
  const body = en ? [
    "You are a Vietnamese freshwater fishing expert (common carp, mud carp, grass/black carp, tilapia, crucian carp — all bottom feeders).",
    "",
    "## KNOWLEDGE (non-obvious tips only; the section below is written in Vietnamese — understand it, but respond in English)",
    skill || "(none yet)",
    "",
    "## CURRENT DATA (units are explicit — keep the same units in chips)",
    `Location: ${lat}, ${lon} (Vietnam)`,
    `Weather now: ${fmtWeather(weather, lang)}.`,
    `Local time: ${localTime(weather)} (fishing time).`,
    `Moon: ${fmtMoon(moon, lang)}.`,
    "History — use to judge TRENDS (pressure falling or rising, temperature up/down...):",
    fmtHistory(history, lang),
    "Note: wind figures are model forecast at 10m height (may be stronger than actual ground-level wind in built-up areas).",
    "",
    "## 3-SOURCE WEATHER CROSS-CHECK",
    crossCheck || "(no cross-check data)",
    "Weigh the agreement/disagreement between sources in your conclusion. If they strongly conflict, say so in sub.",
    "",
    "## SCORING (0–100 scale — follow each step)",
    "",
    "### Step 0: Read the 5-day context (internal reasoning, no need to output)",
    "Before scoring, read the 5-day history carefully and ask yourself: is weather stable? season changing? just after a cold front? front approaching? Understanding the overall context helps you identify sub-indicators more accurately and score closer to reality.",
    "If the 3 sources conflict or you see an unusual pattern not in the knowledge base, be more conservative in scoring and note the uncertainty in your explanation (sub).",
    "Also identify the 1-2 factors most driving the score and emphasize them in your explanation.",
    "",
    "### Step 1: Score 6 factors (each 0–100)",
    "1. WATER TEMP — estimate from last 5 days of air temp (thermal inertia, NOT today's temp). CONCRETE METHOD: take the average of the last 5 days' high temps, MINUS 2–3°C (water is cooler than air due to evaporation). Eg: 5 days at 32–33°C → water ≈ 30°C. Eg: 35°C for 4 days then 25°C today → water still ~30°C (not 25°C).",
    "   26–27°C: 100 | 25–26°C và 27–28°C: 90–100 | 28–32°C: 70–90 | 20–25°C: 70–90 | 32–35°C: 40–70 | 35–38°C: 10–40 | ≥39°C: 0 | 17–20°C: 40–70 | 14–17°C: 10–40 | 10–14°C: 0–10 | ≤10°C: 0",
    "   Minus thermal shock (today vs yesterday, floor 0): <3°: 0 | 3–5°: −15 | 5–8°: −30 | 8–12°: −60 | >12°: −90",
    "2. PRESSURE: 1025–1030: 100 | >1030: 90–100 | 1020–1025: 80–95 | 1015–1020: 60–80 | 1010–1015: 40–60 | 1005–1010: 25–40 | 1000–1005: 10–25 | <1000: 10",
    "3. AIR TEMP: 26–28°C: 100 | 25–26 and 28–30: 90–100 | 30–33: 70–90 | 33–36: 40–70 | 36–39: 10–40 | >39: 0–10 | 22–25: 80–90 | 18–22: 50–80 | 14–18: 20–50 | <14: 0–20",
    "4. WIND SPEED: 8–12 km/h: 100 | 5–8 and 12–15: 85–100 | 15–20: 70–85 | 20–30: 40–70 | 30–40: 10–40 | >40: 0–10 | 2–5: 70–85 | <2: 40–70",
    "5. WIND DIRECTION: SE/S: 90–100 | E: 70–90 | NE: 50–70 | N: 30–50 | NW/W/SW: 10–30. Minus: sudden shift −20; constantly shifting −20",
    "6. HUMIDITY: <60%: 90–100 | 60–75%: 70–90 | 75–85%: 40–70 | 85–95%: 10–40 | >95%: 0–10",
    "",
    "IMPORTANT NOTE: The scales above are GUIDELINES only. If you feel the table score does not reflect reality in a specific situation (e.g., borderline between two levels, or special circumstances the table does not cover), adjust FLEXIBLY by ±10–15 points and briefly explain in the factor's \"d\" field.",
    "",
    "### Step 2: Weighted total",
    "Total = water×0.30 + pressure×0.20 + air×0.15 + windSpeed×0.15 + windDir×0.15 + humidity×0.05",
    "",
    "### Step 3: Minus time + sub-indicators (only what the 6 factors missed — avoid double counting)",
    "MANDATORY: check EACH item below from the data, do not skip any. If a condition is met, you MUST apply it — do not skip at your discretion.",
    "- Local hour: 5–10h & 14–19h: 0 | 10–14h: hot day (>30°C): −10/−25/−10, cool day (<28°C): half | Night: 19–21h: −10, 21h–0h: −20, 0h–4h: −30, 4h–5h: easing. Harsh sun extra.",
    "- Day–night diff: CALCULATE from data (today's high minus low, or today vs yesterday if available). If >8°C → MANDATORY −25. If <8°C for 3+ days → +10.",
    "- Season change: −15 | Stable many days: +10",
    "- Day after cold front: −50 | Day before cold front: +15 | Hot yesterday→cool+wind today: +15 | →overcast+strong wind: −20",
    "- Light rain then light sun: +15 | 2 cloudy cool days: +10 | Rain all yesterday→clear today: −30 | Rain 2–5h then sun+calm: −20",
    "",
    "### Step 4: Hard caps",
    "- Low oxygen (≥30°C AND wind ≤5 km/h): score MAX 40. Mid-water feeding then is a BAD sign, never positive.",
    "- For these 5 bottom feeders: depth=1 (mid-water) is always a bad sign, penalize heavily.",
    "",
    "### Step 5: Floor 0, round to integer → final score",
    "NOTE: Do NOT invent your own score. The score comes ONLY from the calculation above. Your judgment is used ONLY in Step 3 — identifying which sub-indicators apply from the data.",
    "",
    "## REQUIREMENTS",
    "Predict RIGHT NOW whether fish are biting. Return pure JSON only (no markdown, no extra explanation):",
    "{",
    '  "score": final number 0-100 from Steps 1-5 ONLY,',
    '  "title": "short band title (system normalizes it — just put a placeholder)",',
    '  "sub": "1-2 short sentences of explanation, max 2",',
    '  "factors": [',
    '    {"k": "Water temp", "v": "27°C (from 5-day history)", "pts": 85, "d": "short reason"},',
    '    ... all 6 factors in order: Water temp, Pressure, Air temp, Wind speed, Wind direction, Humidity (pts 0–100 each)',
    '  ],',
    '  "penalties": [{"d": "rain 2–5h then sun+calm", "pts": -20}], // may be empty',
    '  "chips": [',
    '    {"k": "Moon", "v": "91%", "d": "solunar times...", "cls": "good"},',
    '  ], // chips ONLY for info OUTSIDE the 6 factors (moon, rain, solunar...). NEVER repeat the 6 factors; cls is good | warn | bad | "",',
    '  "depth": 0 (surface feeding) | 1 (mid-water) | 2 (bottom)',
    "}",
    "Note: bottom feeders normally feed at the bottom; only choose mid-water/surface when there are signs of low oxygen (hot, muggy, still air) or other special conditions — and in that case keep the score LOW (≤40) because the fish are stressed, not feeding well.",
  ] : [
    "Bạn là chuyên gia câu cá nước ngọt Việt Nam (cá chép, trôi, trắm, rô phi, diếc — đều là cá ăn tầng đáy).",
    "",
    "## KINH NGHIỆM (chỉ ghi những điều không hiển nhiên, đừng dùng kiến thức phổ thông)",
    skill || "(chưa có)",
    "",
    "## SỐ LIỆU HIỆN TẠI (đơn vị đã ghi rõ — giữ nguyên đơn vị khi trả về chips)",
    `Vị trí: ${lat}, ${lon} (Việt Nam)`,
    `Thời tiết lúc này: ${fmtWeather(weather, lang)}.`,
    `Giờ địa phương: ${localTime(weather)} (giờ đi câu).`,
    `Mặt trăng: ${fmtMoon(moon, lang)}.`,
    "Lịch sử — dùng để đánh giá XU HƯỚNG (áp suất đang giảm hay tăng, nhiệt độ lên/xuống...):",
    fmtHistory(history, lang),
    "Lưu ý: số liệu gió là của model dự báo ở độ cao 10m (có thể mạnh hơn gió thực tế mặt đất trong khu dân cư).",
    "",
    "## ĐỐI CHỨNG 3 NGUỒN THỜI TIẾT",
    crossCheck || "(chưa có dữ liệu đối chứng)",
    "Hãy cân nhắc độ đồng thuận/mâu thuẫn giữa các nguồn khi kết luận. Nếu mâu thuẫn mạnh, nêu rõ trong phần sub.",
    "",
    "## CÁCH CHẤM ĐIỂM (thang 100 — làm đúng từng bước)",
    "",
    "### Bước 0: Đọc bối cảnh 5 ngày (suy luận nội bộ, không cần xuất ra)",
    "Trước khi chấm điểm, hãy đọc kỹ lịch sử 5 ngày qua và tự trả lời: thời tiết đang ổn định? đang chuyển mùa? vừa qua đợt lạnh? sắp có front? Hiểu được bối cảnh tổng thể sẽ giúp bạn xác định chỉ số phụ chính xác hơn và chấm điểm sát thực tế hơn.",
    "Nếu dữ liệu 3 nguồn mâu thuẫn nhau hoặc gặp pattern lạ chưa có trong kinh nghiệm, hãy thận trọng hơn khi chấm và nêu rõ sự không chắc chắn trong phần diễn giải (sub).",
    "Đồng thời xác định 1-2 yếu tố đang ảnh hưởng mạnh nhất đến điểm số để nhấn mạnh trong phần diễn giải.",
    "",
    "### Bước 1: Chấm 6 yếu tố (mỗi thang 0–100)",
    "1. NHIỆT ĐỘ NƯỚC — ước từ nhiệt độ không khí 5 ngày qua (nước có quán tính nhiệt, KHÔNG dùng nhiệt độ hôm nay). CÁCH ƯỚC CỤ THỂ: lấy trung bình nhiệt độ cao nhất 5 ngày qua, TRỪ 2–3°C (nước mát hơn không khí do bay hơi). Vd: 5 ngày đều 32–33°C → nước ≈ 30°C. Vd: 4 hôm 35°C rồi hôm nay 25°C → nước vẫn ~30°C (không phải 25°C).",
    "   26–27°C: 100 | 25–26°C and 27–28°C: 90–100 | 28–32°C: 70–90 | 20–25°C: 70–90 | 32–35°C: 40–70 | 35–38°C: 10–40 | ≥39°C: 0 | 17–20°C: 40–70 | 14–17°C: 10–40 | 10–14°C: 0–10 | ≤10°C: 0",
    "   Trừ sốc nhiệt (chênh hôm nay vs hôm qua, trừ vào điểm nước, sàn 0): <3°: 0 | 3–5°: −15 | 5–8°: −30 | 8–12°: −60 | >12°: −90",
    "2. ÁP SUẤT: 1025–1030: 100 | >1030: 90–100 | 1020–1025: 80–95 | 1015–1020: 60–80 | 1010–1015: 40–60 | 1005–1010: 25–40 | 1000–1005: 10–25 | <1000: 10",
    "3. NHIỆT ĐỘ KHÔNG KHÍ: 26–28°C: 100 | 25–26 và 28–30: 90–100 | 30–33: 70–90 | 33–36: 40–70 | 36–39: 10–40 | >39: 0–10 | 22–25: 80–90 | 18–22: 50–80 | 14–18: 20–50 | <14: 0–20",
    "4. TỐC ĐỘ GIÓ: 8–12 km/h: 100 | 5–8 và 12–15: 85–100 | 15–20: 70–85 | 20–30: 40–70 | 30–40: 10–40 | >40: 0–10 | 2–5: 70–85 | <2: 40–70",
    "5. HƯỚNG GIÓ (tên tiếng Việt đầy đủ, cấm viết tắt EN): Đông Nam/Nam: 90–100 | Đông: 70–90 | Đông Bắc: 50–70 | Bắc: 30–50 | Tây Bắc/Tây/Tây Nam: 10–30. Trừ: xuất hiện đột ngột −20; đổi hướng liên tục −20",
    "6. ĐỘ ẨM: <60%: 90–100 | 60–75%: 70–90 | 75–85%: 40–70 | 85–95%: 10–40 | >95%: 0–10",
    "",
    "LƯU Ý QUAN TRỌNG: Các thang điểm trên chỉ là THAM KHẢO. Nếu bạn thấy điểm tra bảng không phản ánh đúng thực tế trong tình huống cụ thể (vd: nằm giữa 2 mức, hoặc có yếu tố đặc biệt mà bảng chưa cover), hãy LINH ĐỘNG điều chỉnh ±10–15 điểm và giải thích ngắn gọn trong trường \"d\" của yếu tố đó.",
    "",
    "### Bước 2: Tổng có trọng số",
    "Tổng = nước×0.30 + áp suất×0.20 + không khí×0.15 + tốc độ gió×0.15 + hướng gió×0.15 + độ ẩm×0.05",
    "",
    "### Bước 3: Trừ phạt giờ + chỉ số phụ (chỉ trừ cái 6 yếu tố chưa bắt được — tránh tính trùng)",
    "BẮT BUỘC kiểm tra TỪNG mục dưới đây từ số liệu, không được bỏ qua mục nào. Nếu điều kiện thỏa mãn thì BẮT BUỘC áp dụng, không được tùy ý bỏ qua.",
    "- Giờ địa phương: 5–10h & 14–19h: 0 | 10–14h: ngày nóng (>30°C): −10/−25/−10, ngày mát (<28°C): một nửa | Đêm: 19–21h: −10, 21h–0h: −20, 0h–4h: −30, 4h–5h: nới dần. Nắng gắt trừ thêm.",
    "- Chênh ngày–đêm: TÍNH từ dữ liệu (nhiệt cao nhất trừ thấp nhất trong ngày hôm nay, hoặc hôm nay so với hôm qua nếu có). Nếu >8°C → BẮT BUỘC −25. Nếu <8°C duy trì 3+ ngày → +10.",
    "- Giao mùa: −15 | Ổn định nhiều ngày: +10",
    "- Hôm sau lạnh về: −50 | Ngày trước lạnh về: +15 | Nóng hôm qua→mát+gió hôm nay: +15 | →âm u+gió to: −20",
    "- Mưa nhẹ rồi nắng nhẹ: +15 | 2 ngày mây mát: +10 | Mưa cả ngày hôm qua→tạnh hôm nay: −30 | Mưa 2–5h rồi nắng+lặng gió: −20",
    "",
    "### Bước 4: Áp trần cứng",
    "- Thiếu oxy (≥30°C VÀ gió ≤5 km/h): điểm TỐI ĐA 40. Cá ăn lửng lúc này là tín hiệu XẤU, cấm diễn giải tích cực.",
    "- Với 5 loài cá đáy: depth=1 (ăn lửng) luôn là tín hiệu xấu, phải trừ điểm mạnh.",
    "",
    "### Bước 5: Sàn 0, làm tròn số nguyên → điểm cuối",
    "LƯU Ý: CẤM tự bịa điểm. Điểm CHỈ đến từ phép tính trên. Nhận định của bạn CHỈ dùng ở Bước 3 — xác định chỉ số phụ nào áp dụng từ số liệu.",
    "",
    "## YÊU CẦU",
    "Dự đoán NGAY LÚC NÀY cá có đi ăn không. Chỉ trả về JSON thuần (không markdown, không giải thích thêm):",
    "{",
    '  "score": số 0-100 cuối cùng, CHỈ từ Bước 1–5,',
    '  "title": "tiêu đề ngắn theo band điểm (hệ thống tự chuẩn hoá — cứ để tạm)",',
    '  "sub": "1-2 câu giải thích ngắn gọn, tối đa 2 câu",',
    '  "factors": [',
    '    {"k": "Nhiệt độ nước", "v": "27°C (ước từ 5 ngày)", "pts": 85, "d": "lý do ngắn"},',
    '    ... đủ 6 yếu tố theo thứ tự: Nhiệt độ nước, Áp suất, Nhiệt độ không khí, Tốc độ gió, Hướng gió, Độ ẩm (pts 0–100 mỗi yếu tố)',
    '  ],',
    '  "penalties": [{"d": "mưa 2–5h rồi nắng+lặng gió", "pts": -20}], // có thể rỗng',
    '  "chips": [',
    '    {"k": "Mặt trăng", "v": "91%", "d": "giờ solunar...", "cls": "good"},',
    '  ], // chips CHỈ cho thông tin NGOÀI 6 yếu tố (mặt trăng, mưa, solunar...). CẤM lặp lại 6 yếu tố đã có trong factors; cls là good | warn | bad | "",',
    '  "depth": 0 (cá ăn mặt) | 1 (ăn lửng) | 2 (ăn đáy)',
    "}",
    "Hướng gió trong chips (cả v và d): viết tên tiếng Việt đầy đủ (Bắc, Đông Bắc, Đông, Đông Nam, Nam, Tây Nam, Tây, Tây Bắc) — CẤM viết tắt kiểu tiếng Anh (N, NE, E, SE, S, SW, W, NW).",
    "Lưu ý: cá tầng đáy bình thường luôn ăn ở đáy; chỉ cho ăn lửng/mặt khi có dấu hiệu thiếu oxy (trời oi nóng, lặng gió) — và khi đó điểm phải THẤP (≤40) vì cá đang stress chứ không phải đang ăn mạnh.",
  ];
  return body.join("\n");
}

async function llmPredict(env, origin, { weather, moon, history, lat, lon, crossCheck, lang = "vi" }) {
  let skill = "";
  try {
    const sr = await fetch(`${origin}/skills/kinh-nghiem-cau-ca.md`);
    if (sr.ok) skill = await sr.text();
  } catch { /* thiếu skill vẫn dự đoán được */ }

  const prompt = buildPrompt(lang, { skill, weather, moon, history, lat, lon, crossCheck });

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.LLM_API_KEY}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(90000),
    body: JSON.stringify({
      model: LLM_MODEL,
      reasoning_effort: "medium",
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!r.ok) throw new Error(`LLM HTTP ${r.status}`);
  const j = await r.json();
  const v = JSON.parse(j.choices[0].message.content);

  const score = Math.max(0, Math.min(100, Math.round(+v.score)));
  if (!Number.isFinite(score)) throw new Error("LLM score invalid");
  // tiêu đề suy từ band điểm — không dùng title của AI (đã từng chép nguyên hướng dẫn vào title)
  const title = score >= 75 ? (lang === "en" ? "GO FISHING!" : "ĐI CÂU NGAY!")
    : score >= 55 ? (lang === "en" ? "PRETTY GOOD" : "KHÁ ĐẤY")
    : score >= 30 ? (lang === "en" ? "HIT OR MISS" : "HÊN XUI")
    : (lang === "en" ? "STAY HOME" : "Ở NHÀ ĐI");
  const okCls = (c) => ["good", "warn", "bad", ""].includes(c) ? c : "";
  const factorKeys = (Array.isArray(v.factors) ? v.factors : []).map((f) => String(f.k || "").toLowerCase());
  const dupKw = ["gió", "wind", "nhiệt", "temp", "ẩm", "humid", "áp suất", "pressure"];
  const chips = Array.isArray(v.chips) ? v.chips.slice(0, 8).map((c) => ({
    k: String(c.k ?? ""), v: String(c.v ?? ""), d: String(c.d ?? ""), cls: okCls(c.cls),
  })).filter((c) => {
    const k = c.k.toLowerCase();
    if (!k) return false;
    if (factorKeys.some((fk) => fk && (fk.includes(k) || k.includes(fk)))) return false;
    if (dupKw.some((w) => k.includes(w))) return false;
    return true;
  }) : [];
  const factors = Array.isArray(v.factors) ? v.factors.slice(0, 6).map((f) => ({
    k: String(f.k ?? ""), v: String(f.v ?? ""),
    pts: Math.max(0, Math.min(100, Math.round(+f.pts || 0))),
    d: String(f.d ?? ""),
  })) : [];
  const penalties = Array.isArray(v.penalties) ? v.penalties.slice(0, 10).map((x) => ({
    d: String(x.d ?? ""), pts: Math.max(-100, Math.min(100, Math.round(+x.pts || 0))),
  })) : [];
  const depth = [0, 1, 2].includes(v.depth) ? v.depth : 1;

  return { score, title, sub: String(v.sub || ""), chips, factors, penalties, depth, demo: false };
}

/* ---------- đối chứng 3 nguồn thời tiết ---------- */
async function fetchExtraSources(env, lat, lon, lang = "vi") {
  const out = { weatherapi: null, openweather: null };
  const jobs = [];
  if (env.WEATHERAPI_KEY) {
    jobs.push((async () => {
      try {
        const r = await fetch(
          `https://api.weatherapi.com/v1/current.json?key=${env.WEATHERAPI_KEY}&q=${lat},${lon}&aqi=no`,
          { signal: AbortSignal.timeout(8000) });
        if (!r.ok) return;
        const j = await r.json();
        const c = j.current || {};
        out.weatherapi = {
          temp: c.temp_c, humidity: c.humidity, pressure: c.pressure_mb,
          wind: c.wind_kph, windDeg: c.wind_degree, cloud: c.cloud,
          precip: c.precip_mm, desc: c.condition && c.condition.text,
        };
      } catch { /* bỏ qua nguồn lỗi */ }
    })());
  }
  if (env.OPENWEATHER_KEY) {
    jobs.push((async () => {
      try {
        const r = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${env.OPENWEATHER_KEY}&units=metric&lang=${lang}`,
          { signal: AbortSignal.timeout(8000) });
        if (!r.ok) return;
        const j = await r.json();
        out.openweather = {
          temp: j.main && j.main.temp, humidity: j.main && j.main.humidity,
          pressure: j.main && j.main.pressure,
          wind: j.wind && j.wind.speed != null ? Math.round(j.wind.speed * 3.6 * 10) / 10 : null,
          windDeg: j.wind && j.wind.deg, cloud: j.clouds && j.clouds.all,
          precip: j.rain && (j.rain["1h"] || 0),
          desc: j.weather && j.weather[0] && j.weather[0].description,
        };
      } catch { /* bỏ qua nguồn lỗi */ }
    })());
  }
  await Promise.all(jobs);
  return out;
}

function crossCheckText(omW, extra, lang = "vi") {
  const om = { name: "Open-Meteo", temp: omW.temperature_2m, humidity: omW.relative_humidity_2m,
    pressure: omW.pressure_msl, wind: omW.wind_speed_10m, cloud: omW.cloud_cover, precip: omW.precipitation };
  const srcs = [om];
  if (extra.weatherapi) srcs.push({ name: "WeatherAPI", ...extra.weatherapi });
  if (extra.openweather) srcs.push({ name: "OpenWeather", ...extra.openweather });
  if (srcs.length < 2) return T[lang].oneSrc;
  const vals = (k) => srcs.map((s) => s[k]).filter((v) => v != null);
  const spread = (arr) => (arr.length ? Math.max(...arr) - Math.min(...arr) : 0);
  const fmt = (k, unit, rd = 1) =>
    srcs.map((s) => `${s.name} ${s[k] == null ? "?" : (+s[k]).toFixed(rd)}`).join(" · ") + ` ${unit}`;
  const tS = spread(vals("temp")), pS = spread(vals("pressure")),
        wS = spread(vals("wind")), rS = spread(vals("precip"));
  const lines = [
    `${T[lang].agree === "agree" ? "Temperature" : "Nhiệt độ"}: ${fmt("temp", "°C")} → ${tS <= 2 ? T[lang].agree : tS <= 4 ? T[lang].partial : T[lang].conflict}`,
    `${T[lang].agree === "agree" ? "Pressure" : "Áp suất"}: ${fmt("pressure", "hPa", 0)} → ${pS <= 2 ? T[lang].agree : pS <= 4 ? T[lang].partial : T[lang].conflict}`,
    `${T[lang].agree === "agree" ? "Wind" : "Gió"}: ${fmt("wind", "km/h")} → ${wS <= 5 ? T[lang].agree : wS <= 10 ? T[lang].partial : T[lang].conflict}`,
    `${T[lang].agree === "agree" ? "Rain" : "Mưa"}: ${fmt("precip", "mm")} → ${rS <= 1 ? T[lang].agree : T[lang].rainDiff}`,
  ];
  lines.push((tS > 4 || pS > 4 || wS > 10) ? T[lang].warn : T[lang].ok);
  return lines.join("\n");
}

/* chạy ĐỒNG BỘ trong request: gọi LLM rồi trả kết quả (fallback khi lỗi) */
async function runSync(env, origin, input) {
  try {
    if (!env.LLM_API_KEY) throw new Error("LLM HTTP no_key");
    const lang = input.lang === "en" ? "en" : "vi";
    const extra = await fetchExtraSources(env, input.lat, input.lon, lang);
    const checkText = crossCheckText(input.weather, extra, lang);
    const result = await llmPredict(env, origin, { ...input, crossCheck: checkText, lang });
    result.sources = checkText;
    return result;
  } catch (e) {
    const m = /LLM HTTP ([\w_]+)/.exec(e.message || "");
    const fb = demoPredict(input.weather, input.moon, input.lang === "en" ? "en" : "vi");
    // chi tiết lỗi để debug (lọc key nếu có lọt vào)
    const raw = String((e && e.name ? e.name + ": " : "") + ((e && e.message) || e)).slice(0, 140);
    const safe = raw.replace(/sk-[A-Za-z0-9-_]+/g, "[key]").replace(/Bearer\s+[^\s]+/gi, "Bearer [key]");
    return { ...fb, llmError: m ? `http_${m[1]}` : `llm_error:${safe}` };
  }
}

export async function onRequestPost({ request, env }) {
  let body = {};
  try { body = await request.json(); } catch { /* bỏ qua */ }
  const { weather = {}, moon = {}, history = null } = body;
  const lat = +body.lat, lon = +body.lon, gps = body.gps === true;
  const lang = body.lang === "en" ? "en" : "vi";
  const jid = jobIdFor(lat, lon, gps, lang);

  // dedup: đã tính trong 1h qua → trả ngay (cache miss do khác colo thì tính lại, không treo)
  try {
    const hit = await caches.default.match(jobKey(jid));
    if (hit) {
      const done = await hit.json();
      if (done.status === "done") return Response.json({ ...done, cached: true });
    }
  } catch { /* bỏ qua */ }

  // gọi AI đồng bộ trong request (nguồn phụ ≤8s + LLM ≤45s), xong trả luôn
  const result = await runSync(env, new URL(request.url).origin, { weather, moon, history, lat, lon, lang });
  try {
    await caches.default.put(jobKey(jid), jsonCache({ ...result, status: "done", jobId: jid }));
  } catch { /* bỏ qua */ }
  return Response.json({ ...result, status: "done", jobId: jid });
}
