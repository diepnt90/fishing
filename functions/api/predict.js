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

const CACHE_ENABLED = false; // testing: mỗi request là 1 job mới; true: dedup job theo lưới+khung giờ (~1h)
const LLM_MODEL = "gpt-5-nano";

/* lưới cache: tìm địa điểm → 0.02° (~2km); GPS → 0.45° (~50km) */
function cacheGrid(lat, lon, gps) {
  const step = gps ? 0.45 : 0.02;
  const dec = step < 0.1 ? 2 : 1;
  const r = (v) => (Math.round(v / step) * step).toFixed(dec);
  return `${r(lat)},${r(lon)}`;
}
function jobIdFor(lat, lon, gps) {
  const grid = cacheGrid(lat, lon, gps);
  if (!CACHE_ENABLED) return `${grid}|${Date.now()}|${Math.random().toString(36).slice(2, 8)}`;
  return `${grid}|${Math.floor(Date.now() / 3600000)}`; // dedup ~1 giờ
}
const jobKey = (jid) => new Request(`https://cache.local/api/job?k=${encodeURIComponent(jid)}`);
const jsonCache = (obj, maxAge = 3600) =>
  new Response(JSON.stringify(obj), {
    headers: { "content-type": "application/json", "cache-control": `public, max-age=${maxAge}` },
  });

function demoPredict(weather, moon) {
  const t = weather.temperature_2m ?? 28;
  const p = weather.pressure_msl ?? 1013;
  const w = weather.wind_speed_10m ?? 8;
  const hu = weather.relative_humidity_2m ?? 70;
  const pr = weather.precipitation ?? 0;
  const wdirs = ["Bắc", "Đông Bắc", "Đông", "Đông Nam", "Nam", "Tây Nam", "Tây", "Tây Bắc"];
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

  const title = score >= 75 ? "ĐI CÂU NGAY!" : score >= 55 ? "KHÁ ĐẤY" : score >= 30 ? "HÊN XUI" : "Ở NHÀ ĐI";
  const sub = score >= 75 ? "Cá đang ăn mạnh — xách cần lên đường!"
    : score >= 55 ? "Có cơ hội tốt, canh đúng giờ vàng mà quất."
    : score >= 30 ? "Cá lười ăn, đi cho vui là chính."
    : "Hôm nay cá không thèm ăn — ở nhà đỡ phí mồi.";

  return {
    score, title, sub,
    chips: [
      { k: "Nhiệt độ", v: `${Math.round(t)}°C`, d: "Từ API thời tiết", cls: t >= 24 && t <= 30 ? "good" : "warn" },
      { k: "Áp suất", v: `${Math.round(p)} hPa`, d: "Từ API thời tiết", cls: p >= 1013 && p <= 1022 ? "good" : "warn" },
      { k: "Gió", v: `${Math.round(w)} km/h${wdirName ? " · " + wdirName : ""}`, d: "Từ API thời tiết", cls: w < 15 ? "good" : "warn" },
      { k: "Độ ẩm", v: `${hu}%`, d: hu >= 85 ? "Ẩm cao — có thể sắp mưa" : "Bình thường", cls: "" },
      { k: "Mưa", v: pr > 0 ? `${pr} mm` : "Không mưa", d: pr > 0 && pr <= 2.5 ? "Mưa nhỏ — kích thích cá ăn" : pr > 2.5 ? "Mưa to — kém" : "Trời khô ráo", cls: pr > 0 && pr <= 2.5 ? "good" : pr > 2.5 ? "bad" : "" },
    ],
    demo: true,
  };
}

/* Format số liệu KÈM ĐƠN VỊ cho AI — tránh AI đoán nhầm đơn vị (vd: km/h thành m/s) */
function fmtWeather(w = {}) {
  const dirs = ["Bắc", "Đông Bắc", "Đông", "Đông Nam", "Nam", "Tây Nam", "Tây", "Tây Bắc"];
  const wd = w.wind_direction_10m;
  const wdName = wd == null ? "?" : dirs[Math.round(wd / 45) % 8];
  return [
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
function fmtHistory(h) {
  if (!h) return "(không có)";
  const hh = (h.hours || []).map((x) =>
    `${x.time}: ${x.temp}°C, ${x.pressure} hPa, gió ${x.wind} km/h, mây ${x.cloud}%, mưa ${x.precip} mm`).join(" | ");
  const dd = (h.days || []).map((x) =>
    `${x.label}: cao ${x.tmax}°C/thấp ${x.tmin}°C, mưa ${x.precip} mm, ${x.wmo}`).join(" | ");
  return `5 giờ gần nhất: ${hh} \n5 ngày qua: ${dd}`;
}
function fmtMoon(moon = {}) {
  const pct = Math.round((moon.illum ?? 0) * 100);
  return `${moon.phase || "?"} (độ sáng ${pct}%)`;
}

async function llmPredict(env, origin, { weather, moon, history, lat, lon, crossCheck }) {
  let skill = "";
  try {
    const sr = await fetch(`${origin}/skills/kinh-nghiem-cau-ca.md`);
    if (sr.ok) skill = await sr.text();
  } catch { /* thiếu skill vẫn dự đoán được */ }

  const prompt = [
    "Bạn là chuyên gia câu cá nước ngọt Việt Nam (cá chép, trôi, trắm, rô phi, diếc — đều là cá ăn tầng đáy).",
    "",
    "## KINH NGHIỆM (chỉ ghi những điều không hiển nhiên, đừng dùng kiến thức phổ thông)",
    skill || "(chưa có)",
    "",
    "## SỐ LIỆU HIỆN TẠI (đơn vị đã ghi rõ — giữ nguyên đơn vị khi trả về chips)",
    `Vị trí: ${lat}, ${lon} (Việt Nam)`,
    `Thời tiết lúc này: ${fmtWeather(weather)}.`,
    `Mặt trăng: ${fmtMoon(moon)}.`,
    "Lịch sử — dùng để đánh giá XU HƯỚNG (áp suất đang giảm hay tăng, nhiệt độ lên/xuống...):",
    fmtHistory(history),
    "Lưu ý: số liệu gió là của model dự báo ở độ cao 10m (có thể mạnh hơn gió thực tế mặt đất trong khu dân cư).",
    "",
    "## ĐỐI CHỨNG 3 NGUỒN THỜI TIẾT",
    crossCheck || "(chưa có dữ liệu đối chứng)",
    "Hãy cân nhắc độ đồng thuận/mâu thuẫn giữa các nguồn khi kết luận. Nếu mâu thuẫn mạnh, nêu rõ trong phần sub.",
    "",
    "## YÊU CẦU",
    "Dự đoán NGAY LÚC NÀY cá có đi ăn không. Chỉ trả về JSON thuần (không markdown, không giải thích thêm):",
    "{",
    '  "score": số 0-100 (càng cao càng nên đi câu),',
    '  "title": "tiêu đề ngắn gọn tiếng Việt, vd: ĐI CÂU NGAY! / KHÁ ĐẤY / HÊN XUI / Ở NHÀ ĐI",',
    '  "sub": "1 câu giải thích ngắn gọn",',
    '  "chips": [',
    '    {"k": "Nhiệt độ", "v": "28°C", "d": "lý do ngắn", "cls": "good"},',
    "    ... các yếu tố: Áp suất (kèm xu hướng), Gió (kèm hướng), Mưa, Mặt trăng & giờ solunar, Độ ẩm (tham khảo)",
    '  ], // cls là good | warn | bad | ""',
    '  "depth": 0 (cá ăn mặt) | 1 (ăn lửng) | 2 (ăn đáy)',
    "}",
    "Lưu ý: cá tầng đáy bình thường luôn ăn ở đáy; chỉ cho ăn lửng/mặt khi có dấu hiệu thiếu oxy (trời oi nóng, lặng gió) hoặc điều kiện đặc biệt khác.",
  ].join("\n");

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.LLM_API_KEY}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(25000),
    body: JSON.stringify({
      model: LLM_MODEL,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!r.ok) throw new Error(`LLM HTTP ${r.status}`);
  const j = await r.json();
  const v = JSON.parse(j.choices[0].message.content);

  const score = Math.max(0, Math.min(100, Math.round(+v.score)));
  if (!Number.isFinite(score)) throw new Error("LLM score invalid");
  const okCls = (c) => ["good", "warn", "bad", ""].includes(c) ? c : "";
  const chips = Array.isArray(v.chips) ? v.chips.slice(0, 8).map((c) => ({
    k: String(c.k ?? ""), v: String(c.v ?? ""), d: String(c.d ?? ""), cls: okCls(c.cls),
  })) : [];
  const depth = [0, 1, 2].includes(v.depth) ? v.depth : 1;

  return { score, title: String(v.title || ""), sub: String(v.sub || ""), chips, depth, demo: false };
}

/* ---------- đối chứng 3 nguồn thời tiết ---------- */
async function fetchExtraSources(env, lat, lon) {
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
          `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${env.OPENWEATHER_KEY}&units=metric&lang=vi`,
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

function crossCheckText(omW, extra) {
  const om = { name: "Open-Meteo", temp: omW.temperature_2m, humidity: omW.relative_humidity_2m,
    pressure: omW.pressure_msl, wind: omW.wind_speed_10m, cloud: omW.cloud_cover, precip: omW.precipitation };
  const srcs = [om];
  if (extra.weatherapi) srcs.push({ name: "WeatherAPI", ...extra.weatherapi });
  if (extra.openweather) srcs.push({ name: "OpenWeather", ...extra.openweather });
  if (srcs.length < 2) return "(chỉ có 1 nguồn khả dụng — chưa đối chứng được)";
  const vals = (k) => srcs.map((s) => s[k]).filter((v) => v != null);
  const spread = (arr) => (arr.length ? Math.max(...arr) - Math.min(...arr) : 0);
  const fmt = (k, unit, rd = 1) =>
    srcs.map((s) => `${s.name} ${s[k] == null ? "?" : (+s[k]).toFixed(rd)}`).join(" · ") + ` ${unit}`;
  const tS = spread(vals("temp")), pS = spread(vals("pressure")),
        wS = spread(vals("wind")), rS = spread(vals("precip"));
  const lines = [
    `Nhiệt độ: ${fmt("temp", "°C")} → ${tS <= 2 ? "đồng thuận" : tS <= 4 ? "chênh lệch vừa" : "MÂU THUẪN"}`,
    `Áp suất: ${fmt("pressure", "hPa", 0)} → ${pS <= 2 ? "đồng thuận" : pS <= 4 ? "chênh lệch vừa" : "MÂU THUẪN"}`,
    `Gió: ${fmt("wind", "km/h")} → ${wS <= 5 ? "đồng thuận" : wS <= 10 ? "chênh lệch vừa" : "MÂU THUẪN"}`,
    `Mưa: ${fmt("precip", "mm")} → ${rS <= 1 ? "đồng thuận" : "chênh lệch"}`,
  ];
  lines.push((tS > 4 || pS > 4 || wS > 10)
    ? "⚠️ CẢNH BÁO: các nguồn mâu thuẫn mạnh — hãy thận trọng, giảm độ tin cậy của kết luận."
    : "Các nguồn nhìn chung đồng thuận — dữ liệu đáng tin.");
  return lines.join("\n");
}

/* chạy nền: gọi LLM rồi cất kết quả vào cache để poll đọc */
async function runJob(env, origin, jid, input) {
  let result;
  try {
    if (!env.LLM_API_KEY) throw new Error("LLM HTTP no_key");
    const extra = await fetchExtraSources(env, input.lat, input.lon);
    const checkText = crossCheckText(input.weather, extra);
    result = await llmPredict(env, origin, { ...input, crossCheck: checkText });
    result.sources = checkText;
  } catch (e) {
    const m = /LLM HTTP ([\w_]+)/.exec(e.message || "");
    const fb = demoPredict(input.weather, input.moon);
    result = { ...fb, llmError: m ? `http_${m[1]}` : "llm_error" };
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
  const jid = jobIdFor(lat, lon, gps);

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
    waitUntil(runJob(env, new URL(request.url).origin, jid, { weather, moon, history, lat, lon }));
  } catch {
    /* môi trường không hỗ trợ waitUntil → chạy đồng bộ */
    await runJob(env, new URL(request.url).origin, jid, { weather, moon, history, lat, lon });
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
