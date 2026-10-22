/**
 * POST /api/predict — endpoint dự đoán (Cloudflare Pages Function).
 *
 * Bản hiện tại: trả về kết quả DEMO để UI chạy được ngay.
 * Bản chính thức: thay phần demo bằng lời gọi LLM (GPT-5 nano / Gemini 2.5 Flash-Lite),
 * prompt gồm: số liệu thời tiết (3 nguồn) + pha trăng/solunar + nội dung skill kiến thức câu cá.
 * API key của LLM và các nguồn thời tiết đặt trong biến môi trường Cloudflare (không commit).
 */

export async function onRequestPost({ request, env }) {
  let body = {};
  try { body = await request.json(); } catch { /* bỏ qua */ }
  const { weather = {}, moon = {} } = body;

  // ---- TODO: thay bằng fetch tới LLM ----
  // Đọc skill kiến thức câu cá (file public/skills/kinh-nghiem-cau-ca.md,
  // được serve tại /skills/kinh-nghiem-cau-ca.md) để nhét vào prompt.
  // const skillRes = await fetch(new URL("/skills/kinh-nghiem-cau-ca.md", request.url));
  // const skill = skillRes.ok ? await skillRes.text() : "";
  // const prompt = [
  //   "Bạn là chuyên gia câu cá Việt Nam. Dựa vào KINH NGHIỆM dưới đây và SỐ LIỆU hiện tại,",
  //   "hãy dự đoán xem NGAY LÚC NÀY cá có đi ăn không.",
  //   "Trả về JSON: { score (0-100), title (ngắn gọn, tiếng Việt), sub (1 câu giải thích),",
  //   "  chips: [{k,v,d,cls}],",
  //   "  depth (0=mặt, 1=lửng, 2=đáy): tầng nước cá đang ăn, dựa vào mục 10 của kinh nghiệm. }.",
  //   "--- KINH NGHIỆM ---", skill,
  //   "--- SỐ LIỆU ---", JSON.stringify({ weather, moon, lat: body.lat, lon: body.lon }),
  // ].join("\n");
  // const ai = await fetch("https://api.openai.com/v1/chat/completions", {
  //   method: "POST",
  //   headers: { Authorization: `Bearer ${env.LLM_API_KEY}`, "Content-Type": "application/json" },
  //   body: JSON.stringify({ model: "gpt-5-nano", response_format: { type: "json_object" },
  //                          messages: [{ role: "user", content: prompt }] }),
  // });
  // const verdict = parseAi(await ai.json());
  // return Response.json({ ...verdict, demo: false });

  // ---- demo: chấm điểm heuristic giống client ----
  const t = weather.temperature_2m ?? 28;
  const p = weather.pressure_msl ?? 1013;
  const w = weather.wind_speed_10m ?? 8;
  const hu = weather.relative_humidity_2m ?? 70;
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

  return Response.json({
    score, title, sub,
    chips: [
      { k: "Nhiệt độ", v: `${Math.round(t)}°C`, d: "Từ API thời tiết", cls: t >= 24 && t <= 30 ? "good" : "warn" },
      { k: "Áp suất", v: `${Math.round(p)} hPa`, d: "Từ API thời tiết", cls: p >= 1013 && p <= 1022 ? "good" : "warn" },
      { k: "Gió", v: `${Math.round(w)} km/h`, d: "Từ API thời tiết", cls: w < 15 ? "good" : "warn" },
      { k: "Độ ẩm", v: `${hu}%`, d: hu >= 85 ? "Ẩm cao — có thể sắp mưa" : "Bình thường", cls: "" },
    ],
    demo: true,
  });
}
