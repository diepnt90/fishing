/**
 * POST /api/predict — endpoint dự đoán (Cloudflare Pages Function).
 *
 * Luồng chính: gọi LLM (GPT-5 nano) với prompt gồm skill kiến thức câu cá
 * + số liệu thời tiết hiện tại + pha trăng/solunar + lịch sử 5 giờ & 5 ngày.
 * Nếu không có LLM_API_KEY hoặc gọi lỗi → fallback về heuristic demo để UI không vỡ.
 *
 * Secrets (Cloudflare, loại Secret, không commit):
 *   LLM_API_KEY — key OpenAI
 */

const CACHE_ENABLED = false; // đang testing → tắt; xong bật lại true
const LLM_MODEL = "gpt-5-nano";

/* Cache 1 giờ: tìm địa điểm → lưới 0.02° (~2km); GPS → lưới 0.45° (~50km) */
function cacheGrid(lat, lon, gps) {
  const step = gps ? 0.45 : 0.02;
  const dec = step < 0.1 ? 2 : 1;
  const r = (v) => (Math.round(v / step) * step).toFixed(dec);
  return `${r(lat)},${r(lon)}`;
}

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

async function llmPredict(env, request, { weather, moon, history, lat, lon }) {
  let skill = "";
  try {
    const sr = await fetch(new URL("/skills/kinh-nghiem-cau-ca.md", request.url));
    if (sr.ok) skill = await sr.text();
  } catch { /* thiếu skill vẫn dự đoán được */ }

  const prompt = [
    "Bạn là chuyên gia câu cá nước ngọt Việt Nam (cá chép, trôi, trắm, rô phi, diếc — đều là cá ăn tầng đáy).",
    "",
    "## KINH NGHIỆM (chỉ ghi những điều không hiển nhiên, đừng dùng kiến thức phổ thông)",
    skill || "(chưa có)",
    "",
    "## SỐ LIỆU HIỆN TẠI",
    `Vị trí: ${lat}, ${lon} (Việt Nam)`,
    `Thời tiết lúc này: ${JSON.stringify(weather)}`,
    `Mặt trăng & giờ solunar: ${JSON.stringify(moon)}`,
    `Lịch sử (5 giờ gần nhất + 5 ngày qua) — dùng để đánh giá XU HƯỚNG: ${JSON.stringify(history)}`,
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

export async function onRequestPost({ request, env }) {
  let body = {};
  try { body = await request.json(); } catch { /* bỏ qua */ }
  const { weather = {}, moon = {}, history = null } = body;
  const lat = +body.lat, lon = +body.lon, gps = body.gps === true;

  const cache = caches.default;
  const cacheReq = new Request(
    `https://cache.local/api/predict?k=${encodeURIComponent(cacheGrid(lat, lon, gps))}`);
  if (CACHE_ENABLED) {
    try {
      const hit = await cache.match(cacheReq);
      if (hit) return Response.json({ ...(await hit.json()), cached: true });
    } catch { /* cache lỗi thì tính lại */ }
  }

  let payload = null;
  let llmError = null;
  if (!env.LLM_API_KEY) {
    llmError = "no_key";
  } else {
    try {
      payload = await llmPredict(env, request, { weather, moon, history, lat, lon });
    } catch (e) {
      const m = /LLM HTTP (\d+)/.exec(e.message || "");
      llmError = m ? `http_${m[1]}` : "llm_error";
      console.log("LLM failed, fallback demo:", e.message);
    }
  }
  if (!payload) {
    payload = demoPredict(weather, moon);
    if (llmError) payload.llmError = llmError; // debug lúc testing, không lộ key
  }

  if (CACHE_ENABLED) {
    try {
      await cache.put(cacheReq, new Response(JSON.stringify(payload), {
        headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" },
      }));
    } catch { /* bỏ qua */ }
  }
  return Response.json(payload);
}
