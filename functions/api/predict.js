/**
 * POST /api/predict — tạo job dự đoán, trả về ngay { jobId, status: "pending" }.
 * GET  /api/predict?job=<id> — poll kết quả: { status: "pending" } hoặc { status: "done", ... }.
 *
 * Kiểu job bất đồng bộ: POST nhanh nên khó bị treo/hủy giữa chừng;
 * client poll bằng các GET nhẹ — hụt thì poll lại thoải mái.
 * Việc nặng (gọi LLM) chạy nền qua waitUntil.
 *
 * Secrets (Cloudflare, loại Secret, không commit):
 *   LLM_API_KEY — key OpenAI
 */

const CACHE_ENABLED = true; // dedup job theo lưới+khung giờ (~1h); false: testing, mỗi request 1 job mới
const LLM_MODEL = "gpt-5-nano";

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

/* lưới cache: tìm địa điểm → 0.02° (~2km); GPS → 0.45° (~50km) */
function cacheGrid(lat, lon, gps) {
  const step = gps ? 0.45 : 0.02;
  const dec = step < 0.1 ? 2 : 1;
  const r = (v) => (Math.round(v / step) * step).toFixed(dec);
  return `${r(lat)},${r(lon)}`;
}
function jobIdFor(lat, lon, gps, lang = "vi") {
  const grid = cacheGrid(lat, lon, gps);
  if (!CACHE_ENABLED) return `${grid}|${lang}|${Date.now()}|${Math.random().toString(36).slice(2, 8)}`;
  return `${grid}|${lang}|${Math.floor(Date.now() / 3600000)}`; // dedup ~1 giờ
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
    "## FACTOR PRIORITY (most important first — follow this order when factors conflict)",
    "1. Water temperature (infer from current air temperature + recent days' trend — no direct measurement available)",
    "2. Temperature trend (warming up or cooling down)",
    "3. Wind (speed + direction + direction stability)",
    "4. Atmospheric pressure (value + trend)",
    "5. Cloud / rain",
    "6. Humidity",
    "",
    "## HARD RULES (always obey — these override everything else)",
    "1. LOW-OXYGEN day (temperature ≥30°C AND wind ≤5 km/h): fish are stressed and only surface to breathe — they eat WEAKLY or STOP eating. Score MAX 40. Mid-water movement on such a day is a BAD sign of stress, NEVER a good feeding signal: never write chip reasons like 'good for mid-water feeding' or 'encourages mid-water feeding'. For these 5 bottom-feeder species, any mid-water feeding (depth=1) always means the fish are eating SLOWLY — always a bad signal, penalize heavily.",
"2. Sunny + temperature >30°C: the closer to midday, the lower the score — light penalty around 9:00–10:00, heaviest around 11:00–13:00 (harshest sun), easing after 15:00. Bottom fish retreat deep under harsh midday sun and barely feed.",
    "3. Humidity >85% → fish eat weakly (penalize heavily). Pressure >1020 hPa → strong feeding; pressure <1000 hPa → fish don't feed (score max 25).",
    "",
    "## REQUIREMENTS",
    "Predict RIGHT NOW whether fish are biting. Return pure JSON only (no markdown, no extra explanation):",
    "{",
    '  "score": number 0-100 (higher = more worth going fishing),',
    '  "title": "short band title (system normalizes it — just put a placeholder)",',
    '  "sub": "1-2 short sentences of explanation, max 2",',
    '  "chips": [',
    '    {"k": "Temperature", "v": "28°C", "d": "short reason", "cls": "good"},',
    "    ... factors: Pressure (with trend), Wind (with direction), Rain, Moon & solunar times, Humidity (reference)",
    '  ], // cls is good | warn | bad | ""',
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
    "## THỨ TỰ ƯU TIÊN CÁC YẾU TỐ (quan trọng giảm dần — khi các yếu tố mâu thuẫn thì nghe theo thứ tự này)",
    "1. Nhiệt độ nước (suy từ nhiệt độ không khí hiện tại + xu hướng mấy ngày qua — không có số liệu đo trực tiếp)",
    "2. Xu hướng thay đổi nhiệt độ (đang nóng lên hay lạnh đi)",
    "3. Gió (tốc độ + hướng + độ ổn định hướng)",
    "4. Áp suất khí quyển (giá trị + xu hướng)",
    "5. Mây / mưa",
    "6. Độ ẩm",
    "",
    "## NGƯỠNG CỨNG (luôn tuân thủ tuyệt đối — ghi đè mọi yếu tố khác)",
    "1. Ngày THIẾU OXY (nhiệt độ ≥30°C VÀ gió ≤5 km/h): cá bị stress, chỉ nổi lên để thở — ĂN YẾU HOẶC NGỪNG ĂN. Điểm TỐI ĐA 40. Cá 'ăn lửng' trong ngày này là tín hiệu XẤU (cá đang ngạt), KHÔNG phải tín hiệu tốt: cấm viết lý do chip kiểu 'phù hợp ăn lửng', 'tích cực cho ăn lửng', 'khuyến khích ăn lửng'. Với 5 loài cá đáy này, bất cứ khi nào cá đi lửng (depth=1) cũng đồng nghĩa cá đang ăn CHẬM — luôn là tín hiệu xấu, phải trừ điểm mạnh.",
    "2. Trời nắng + nhiệt độ >30°C: càng gần giữa trưa điểm càng giảm — khoảng 9h–10h trừ nhẹ, 11h–13h (nắng gắt nhất) trừ mạnh nhất, sau 15h nới dần. Cá rút sâu giữa trưa nắng gắt, hầu như không đi ăn.",
    "3. Độ ẩm >85% → cá ăn yếu (trừ điểm mạnh). Áp suất >1020 hPa → cá ăn mạnh; <1000 hPa → cá không ăn (điểm tối đa 25).",
    "",
    "## YÊU CẦU",
    "Dự đoán NGAY LÚC NÀY cá có đi ăn không. Chỉ trả về JSON thuần (không markdown, không giải thích thêm):",
    "{",
    '  "score": số 0-100 (càng cao càng nên đi câu),',
    '  "title": "tiêu đề ngắn theo band điểm (hệ thống tự chuẩn hoá — cứ để tạm)",',
    '  "sub": "1-2 câu giải thích ngắn gọn, tối đa 2 câu",',
    '  "chips": [',
    '    {"k": "Nhiệt độ", "v": "28°C", "d": "lý do ngắn", "cls": "good"},',
    "    ... các yếu tố: Áp suất (kèm xu hướng), Gió (kèm hướng), Mưa, Mặt trăng & giờ solunar, Độ ẩm (tham khảo)",
    '  ], // cls là good | warn | bad | ""',
    '  "depth": 0 (cá ăn mặt) | 1 (ăn lửng) | 2 (ăn đáy)',
    "}",
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
    signal: AbortSignal.timeout(120000), // chờ AI thoải mái (reasoning medium)
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
  const chips = Array.isArray(v.chips) ? v.chips.slice(0, 8).map((c) => ({
    k: String(c.k ?? ""), v: String(c.v ?? ""), d: String(c.d ?? ""), cls: okCls(c.cls),
  })) : [];
  const depth = [0, 1, 2].includes(v.depth) ? v.depth : 1;

  return { score, title, sub: String(v.sub || ""), chips, depth, demo: false };
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

/* chạy nền: gọi LLM rồi cất kết quả vào cache để poll đọc */
async function runJob(env, origin, jid, input) {
  let result;
  try {
    if (!env.LLM_API_KEY) throw new Error("LLM HTTP no_key");
    const lang = input.lang === "en" ? "en" : "vi";
    const extra = await fetchExtraSources(env, input.lat, input.lon, lang);
    const checkText = crossCheckText(input.weather, extra, lang);
    result = await llmPredict(env, origin, { ...input, crossCheck: checkText, lang });
    result.sources = checkText;
  } catch (e) {
    const m = /LLM HTTP ([\w_]+)/.exec(e.message || "");
    const fb = demoPredict(input.weather, input.moon, input.lang === "en" ? "en" : "vi");
    // chi tiết lỗi để debug lúc testing (lọc key nếu có lọt vào)
    const raw = String((e && e.name ? e.name + ": " : "") + ((e && e.message) || e)).slice(0, 140);
    const safe = raw.replace(/sk-[A-Za-z0-9-_]+/g, "[key]").replace(/Bearer\s+[^\s]+/gi, "Bearer [key]");
    result = { ...fb, llmError: m ? `http_${m[1]}` : `llm_error:${safe}` };
  }
  try {
    await caches.default.put(jobKey(jid), jsonCache({ ...result, status: "done", jobId: jid }));
  } catch { /* bỏ qua */ }
}

export async function onRequestPost({ request, env, waitUntil }) {
  let body = {};
  try { body = await request.json(); } catch { /* bỏ qua */ }
  const { weather = {}, moon = {}, history = null } = body;
  const lat = +body.lat, lon = +body.lon, gps = body.gps === true;
  const lang = body.lang === "en" ? "en" : "vi";
  const jid = jobIdFor(lat, lon, gps, lang);

  // job đã xong trước đó (dedup) → trả ngay
  try {
    const hit = await caches.default.match(jobKey(jid));
    if (hit) {
      const done = await hit.json();
      if (done.status === "done") return Response.json({ ...done, cached: true });
    }
  } catch { /* bỏ qua */ }

  // chạy nền, trả jobId ngay để client poll
  try {
    waitUntil(runJob(env, new URL(request.url).origin, jid, { weather, moon, history, lat, lon, lang }));
  } catch {
    /* môi trường không hỗ trợ waitUntil → chạy đồng bộ */
    await runJob(env, new URL(request.url).origin, jid, { weather, moon, history, lat, lon, lang });
    const hit = await caches.default.match(jobKey(jid)).catch(() => null);
    if (hit) return Response.json(await hit.json());
  }
  return Response.json({ jobId: jid, status: "pending", demo: false });
}

export async function onRequestGet({ request }) {
  const jid = new URL(request.url).searchParams.get("job");
  if (!jid) return Response.json({ status: "error", message: "missing job" }, { status: 400 });
  try {
    const hit = await caches.default.match(jobKey(jid));
    if (hit) return Response.json(await hit.json());
  } catch { /* bỏ qua */ }
  return Response.json({ status: "pending" });
}
