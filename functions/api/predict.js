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
const LLM_MODEL = "gpt-4.1-mini";

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

  const title = score >= 90 ? (en ? "FISH QUEUEING UP" : "CÁ XẾP HÀNG ĐỚP")
    : score >= 75 ? (en ? "GO FISHING!" : "ĐI CÂU NGAY!")
    : score >= 65 ? (en ? "TASTY!" : "NGON RỒI ĐẤY")
    : score >= 55 ? (en ? "PRETTY GOOD" : "KHÁ ĐẤY")
    : score >= 45 ? (en ? "HOPEFUL" : "CÓ HY VỌNG")
    : score >= 30 ? (en ? "HIT OR MISS" : "HÊN XUI")
    : score >= 10 ? (en ? "STAY HOME" : "Ở NHÀ ĐI") : (en ? "FISH ON STRIKE" : "CÁ TUYỆT THỰC");
  const sub = score >= 90 ? (en ? "Skip today and waste a whole week, fish are already waiting!" : "Không đi hôm nay là phí cả tuần, cá chờ sẵn rồi!")
    : score >= 75 ? (en ? "Fish are biting hard — grab your rod!" : "Cá đang ăn mạnh — xách cần lên đường!")
    : score >= 65 ? (en ? "Fish biting steadily, bring extra bait." : "Cá ăn khá đều, mang thêm mồi đi.")
    : score >= 55 ? (en ? "Good chance, time it with the golden hour." : "Có cơ hội tốt, canh đúng giờ vàng mà quất.")
    : score >= 45 ? (en ? "Fish are stirring, patience pays." : "Cá bắt đầu nhúc nhích, kiên nhẫn là có quà.")
    : score >= 30 ? (en ? "Fish are lazy; go for fun." : "Cá lười ăn, đi cho vui là chính.")
    : score >= 10 ? (en ? "Fish snub your bait, save it for another day." : "Cá chê mồi, ở nhà đỡ phí mồi.")
    : (en ? "Fish are fasting in protest, stay home and nap." : "Cá nhịn ăn tập thể, ở nhà ngủ cho lành.");
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
  const dd = (h.days || []).map((x) => {
    const p = x.pressure != null ? (en ? `, pressure ${x.pressure} hPa` : `, áp suất ${x.pressure} hPa`) : "";
    return en ? `${x.label}: high ${x.tmax}°C/low ${x.tmin}°C${p}, rain ${x.precip} mm, ${wmoName(x.wmoCode)}`
              : `${x.label}: cao ${x.tmax}°C/thấp ${x.tmin}°C${p}, mưa ${x.precip} mm, ${wmoName(x.wmoCode)}`;
  }).join(" | ");
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
    "### Step 1: Score 6 factors (each 0–100, INTERPOLATE by actual value — never pick a number from a range)",
    "Interpolation rule: the tables below are ANCHOR POINTS. The score for an actual value = linear interpolation between the 2 nearest anchors. Eg: wind 5 km/h = 50 pts, then wind 4 km/h = 45 pts (lower), not the same 50.",
    "1. WATER TEMP — estimate with METHOD B: take each day's mean temp (high+low)/2 over the last 5 days, then weighted average (most recent day heaviest): yesterday ×0.4, day before ×0.25, 3 days ago ×0.15, 4 days ago ×0.12, 5 days ago ×0.08; then MINUS 1–2°C (evaporation). Eg: daily means (newest→oldest) 25, 26, 27, 28, 29 → weighted = 25×0.4+26×0.25+27×0.15+28×0.12+29×0.08 = 26.2 → water ≈ 24.7°C.",
    "   Anchors (peak 25°C = 100, good feeding 20–30°C):",
    "   25°C: 100 | 24°C and 26°C: 95 | 23°C and 27°C: 90 | 22°C and 28°C: 85 | 20°C and 30°C: 70 | 18°C and 32°C: 50 | 15°C and 35°C: 25 | 12°C and 38°C: 5 | ≤10°C and ≥40°C: 0",
    "   Gentle near 25°C, accelerating drop above 30°C, sharp drop below 20°C.",
    "2. PRESSURE — bell curve, peak around 1012 hPa:",
    "   1012 hPa: 100 | 1010 and 1014: 95 | 1008 and 1016: 90 | 1020: 70 | 1025: 40 | 1005: 40 | 1000: 10 | >1025: decreasing (higher = lower, 10–40) | <1000: 0–5 (no feeding)",
    "   Note: absolute value matters less than rate of change (see sub-indicators in skill).",
    "3. AIR TEMP — peak 28°C = 100, good feeding 23–33°C:",
    "   28°C: 100 | 27 and 29: 95 | 25 and 31: 85 | 23 and 33: 70 | 21 and 35: 50 | 18 and 37: 25 | 15 and 39: 5 | ≤10°C and ≥40°C: 0",
    "   Hot side steeper than cold side (28→40 is 12° to 0, 28→10 is 18° to 0).",
    "4. WIND SPEED — anchors:",
    "   10–12 km/h: 100 | 5 km/h: 50 | 15 km/h: 85 | 25 km/h: 60 | 0 km/h: 25 | 40 km/h: 10 | >40 km/h: 0",
    "   5–15 km/h strongest feeding, 16–25 good, 0–5 poor, 25–40 poor, >40 no feeding.",
    "5. WIND DIRECTION: S: 100 | SE: 95 | E: 80 | SW: 55 | W: 30 | NW: 30 | N: 10 | NE: 5",
    "6. HUMIDITY — peak 75% = 100:",
    "   75%: 100 | 70% and 85%: 85 | 60%: 70 | 90%: 40 | 95%: 20 | 55%: 50 | 50%: 25 | 40%: 10 | >95%: 0–20 | <40%: 0–10",
    "   Above 85% weaker as it rises, below 55% weaker as it falls.",
    "### Step 2: Weighted total (max 80 points)",
    "Total = water×0.28 + pressure×0.16 + air×0.12 + windSpeed×0.12 + windDir×0.08 + humidity×0.04 (max 80 when all factors are 100)",
    "### Step 3: Sub-indicators — AI CALCULATES, NO FIXED VALUES",
    "Read the KNOWLEDGE section (skill) — those are sub-indicator rules (pressure, water trend, wind shift, rain, hour, cloud/sun, day-night diff, season change, cold front, low oxygen, mid-water feeding...).",
    "For each rule, judge: does it apply to the current situation? How strong is the effect?",
    "Before deciding adjustments, you MUST calculate and state the following values from the data (no guessing, skip nothing):",
    "- 5-hour pressure change = last hour pressure − first hour pressure in the 5-hour history (eg: 1010 − 1012 = −2 hPa).",
    "- 5-day pressure stability = range and day-to-day jumps of daily mean pressure over the last 5 days (stable or not).",
    "- 5-day water temp trend (up/down by how many degrees, sudden or slight, from average toward good or not).",
    "- Did wind direction shift suddenly (90° or more) in the last 5 hours, and how many hours ago.",
    "- Current rain (light/shower/heavy/prolonged) + current temperature (cool or hot).",
    "- Rain-then-sun sequence: rain in the last 5 hours followed by strong sun + weak wind right now or not.",
    "- 5-day air temperature fluctuation vs what water/air factors already deducted (deduct a lot more or just a little more, enough for the final score to match reality) and how many following days it affects (stronger swing → more days, interpolated).",
    "- Local hour + cloud/sun.",
    "- Today day-night diff (write into dayNightDiff).",
    "Each skill rule may be applied ONLY AFTER its trigger value has been calculated. Write the calculated values into penalties (d: rule name + calculated value, pts: adjustment).",
    "Then calculate the adjustment so the FINAL SCORE REFLECTS REALITY (whether fish actually feed):",
    "- Golden rule: the higher the base, the harder the hit (more to lose). Eg: base 70 + a no-feeding factor → subtract ~40 to reach ~30 (fish stopped eating). Same factor on base 50 → subtract only ~10 to ~40 (fish were already sluggish, little change).",
    "- MANDATORY INTERPOLATION, NO THRESHOLD JUMPS: adjustments must scale CONTINUOUSLY with the trigger value. A small difference in trigger value may only cause a small difference in adjustment (max 2–3 pts per 1 hPa / 1°C / 0.5°C difference). NEVER jump to a different level just because a threshold was crossed.",
    "- Night penalty interpolates by hour, and day-night diff interpolates around the good anchor of 5°C (further from 5°C = gradually worse, no jump at 8°C).",
    "- Conversely, a positive factor adds more on a low base than on a high base.",
    "- NO +20 cap, NO fixed sub-indicator table. Final = base 80 + your adjustments, floor 0, cap 100, round to integer.",
    "- List each adjustment in \"penalties\" (d: rule name, pts: points you added/subtracted).",
    "### Step 4: Special rules",
    "- For these 5 bottom feeders: depth=1 (mid-water) is always a bad sign, penalize heavily. Mid-water feeding means stressed fish (low oxygen), not strong feeding.",
    "- Low oxygen (hot ≥30°C + wind ≤5 km/h): fish surface because they suffocate → score must be LOW, never interpret mid-water feeding positively.",
    "### Step 5: Final = Step 2 total + Step 3 adjustments. Floor 0, cap 100, round to integer",
    "NOTE: The 6-factor score comes from anchor tables + interpolation (Steps 1–2). Sub-indicator adjustments are your contextual judgment (Step 3). The final score must match reality — if fish don't feed, the score must be low even if the 6-factor base is high.",
    "",
    "## REQUIREMENTS",
    "Predict RIGHT NOW whether fish are biting. Return pure JSON only (no markdown, no extra explanation):",
    "{",
    '  "score": final number 0-100 from Steps 1-5 ONLY,',
    '  "dayNightDiff": 9.5, // day-night temp difference calculated from data (°C), required',
    '  "title": "short band title (system normalizes it — just put a placeholder)",',
    '  "sub": "1-2 short sentences of explanation, max 2",',
    '  "factors": [',
    '    {"k": "Water temp", "v": "27°C (from 5-day history)", "pts": 85, "d": "short reason"},',
    '    ... all 6 factors in order: Water temp, Pressure, Air temp, Wind speed, Wind direction, Humidity (pts 0–100 each)',
    '  ],',
    '  "penalties": [{"d": "rain 2–5h then sun+calm", "pts": -20}], // may be empty',
    '  "chips": [',
    '    {"k": "Moon", "v": "91%", "d": "solunar times...", "cls": "good"},',
    '  ], // chips ONLY for info OUTSIDE the 6 factors (moon, rain, solunar...). NEVER repeat the 6 factors; NEVER include weather-source cross-check info (sources agreeing/disagreeing); cls is good | warn | bad | "",',
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
    "### Bước 1: Chấm 6 yếu tố (mỗi thang 0–100, NỘI SUY theo giá trị thực tế — không bốc số trong khoảng)",
    "Nguyên tắc nội suy: các bảng dưới là MỐC NEO. Điểm của giá trị thực tế = nội suy tuyến tính giữa 2 mốc gần nhất. Vd: gió 5 km/h = 50đ thì gió 4 km/h = 45đ (thấp hơn), không phải cùng 50đ.",
    "1. NHIỆT ĐỘ NƯỚC — ước bằng CÁCH B: lấy nhiệt trung bình ngày (cao+thấp)/2 của mỗi ngày trong 5 ngày qua, rồi trung bình có trọng số (ngày gần nhất nặng nhất): hôm qua ×0.4, hôm kia ×0.25, 3 hôm trước ×0.15, 4 hôm trước ×0.12, 5 hôm trước ×0.08; sau đó TRỪ 1–2°C (bay hơi). Vd: mean 5 ngày (mới→cũ) 25, 26, 27, 28, 29 → weighted = 25×0.4+26×0.25+27×0.15+28×0.12+29×0.08 = 26.2 → nước ≈ 24.7°C.",
    "   Mốc neo (đỉnh 25°C = 100, ăn tốt 20–30°C):",
    "   25°C: 100 | 24°C và 26°C: 95 | 23°C và 27°C: 90 | 22°C và 28°C: 85 | 20°C và 30°C: 70 | 18°C và 32°C: 50 | 15°C và 35°C: 25 | 12°C và 38°C: 5 | ≤10°C và ≥40°C: 0",
    "   Quanh 25°C giảm nhẹ, trên 30°C càng cao giảm càng nhanh, dưới 20°C càng thấp giảm càng mạnh.",
    "2. ÁP SUẤT — hình chuông, đỉnh quanh 1012 hPa:",
    "   1012 hPa: 100 | 1010 và 1014: 95 | 1008 và 1016: 90 | 1020: 70 | 1025: 40 | 1005: 40 | 1000: 10 | >1025: giảm dần (càng cao càng thấp, 10–40) | <1000: 0–5 (bỏ ăn)",
    "   Lưu ý: giá trị tuyệt đối ít quan trọng bằng tốc độ thay đổi (xem chỉ số phụ trong skill).",
    "3. NHIỆT ĐỘ KHÔNG KHÍ — đỉnh 28°C = 100, ăn tốt 23–33°C:",
    "   28°C: 100 | 27 và 29: 95 | 25 và 31: 85 | 23 và 33: 70 | 21 và 35: 50 | 18 và 37: 25 | 15 và 39: 5 | ≤10°C và ≥40°C: 0",
    "   Phía nóng dốc hơn phía lạnh (28→40 chỉ 12° là về 0, 28→10 là 18° mới về 0).",
    "4. TỐC ĐỘ GIÓ — mốc neo:",
    "   10–12 km/h: 100 | 5 km/h: 50 | 15 km/h: 85 | 25 km/h: 60 | 0 km/h: 25 | 40 km/h: 10 | >40 km/h: 0",
    "   5–15 km/h là vùng ăn mạnh, 16–25 tốt, 0–5 ăn kém, 25–40 kém, >40 không ăn.",
    "5. HƯỚNG GIÓ (tên tiếng Việt đầy đủ, cấm viết tắt EN): Nam: 100 | Đông Nam: 95 | Đông: 80 | Tây Nam: 55 | Tây: 30 | Tây Bắc: 30 | Bắc: 10 | Đông Bắc: 5",
    "6. ĐỘ ẨM — đỉnh 75% = 100:",
    "   75%: 100 | 70% và 85%: 85 | 60%: 70 | 90%: 40 | 95%: 20 | 55%: 50 | 50%: 25 | 40%: 10 | >95%: 0–20 | <40%: 0–10",
    "   Trên 85% càng cao càng yếu, dưới 55% càng thấp càng yếu dần.",
    "### Bước 2: Tổng có trọng số (tối đa 80 điểm)",
    "Tổng = nước×0.28 + áp suất×0.16 + không khí×0.12 + tốc độ gió×0.12 + hướng gió×0.08 + độ ẩm×0.04 (tối đa 80 điểm khi tất cả yếu tố đều 100)",
    "### Bước 3: Chỉ số phụ — AI TỰ TÍNH, KHÔNG CÓ MỐC CỐ ĐỊNH",
    "Đọc phần KINH NGHIỆM (skill) — đó là các quy luật chỉ số phụ (áp suất, xu hướng nước, đổi hướng gió, mưa, giờ, mây/nắng, chênh ngày–đêm, giao mùa, lạnh về, thiếu oxy, cá ăn lửng...).",
    "Với mỗi quy luật, tự đánh giá: quy luật này có áp dụng trong tình huống hiện tại không? Mức độ ảnh hưởng mạnh hay yếu?",
    "Trước khi quyết định điều chỉnh, BẮT BUỘC tính và nêu rõ các giá trị sau từ dữ liệu (không đoán, không bỏ qua mục nào):",
    "- Chênh lệch áp suất 5 giờ = áp suất giờ cuối − áp suất giờ đầu trong lịch sử 5 giờ (vd: 1010 − 1012 = −2 hPa).",
    "- Ổn định áp suất 5 ngày = biên độ và nhảy ngày-ngày của áp suất trung bình ngày trong 5 ngày qua (ổn định hay không).",
    "- Xu hướng nhiệt nước 5 ngày (tăng/giảm bao nhiêu độ, đột ngột hay nhẹ, từ mức trung bình về mức tốt hay không).",
    "- Hướng gió có đổi đột ngột (từ 90° trở lên) trong 5 giờ qua không, và đổi cách đây mấy giờ.",
    "- Mưa hiện tại (nhẹ/rào/to/kéo dài) + nhiệt độ lúc này (mát hay nóng).",
    "- Chuỗi mưa→nắng: CHỈ kích hoạt nếu có mưa TO kéo dài trong lịch sử 5 giờ (tham chiếu ≥5 mm/giờ trong ít nhất 2 giờ liên tiếp), SAU ĐÓ nắng gắt và gió ≤5 km/h. Tổng mưa nhỏ như 0,8 mm/5h hoặc mưa phùn KHÔNG tính và KHÔNG được phạt theo quy luật này. Nếu không xác nhận đủ dữ liệu mưa to liên tiếp, bỏ qua quy luật.",
    "- Độ biến động nhiệt không khí 5 ngày so với mức yếu tố nước/không khí đã trừ (cần trừ thêm nhiều hay tí thôi, đủ để tổng điểm khớp thực tế) và số ngày ảnh hưởng về sau (biến động mạnh → nhiều ngày hơn, nội suy).",
    "- Giờ địa phương + mây/nắng.",
    "- Chênh ngày–đêm hôm nay (ghi vào dayNightDiff).",
    "Mỗi quy luật trong skill chỉ được áp dụng SAU KHI đã tính xong giá trị kích hoạt tương ứng. Ghi các giá trị đã tính vào trường penalties (d: tên quy luật + giá trị tính được, pts: điểm điều chỉnh).",
    "Rồi tự tính mức cộng/trừ sao cho ĐIỂM CUỐI PHẢN ÁNH ĐÚNG thực tế cá có ăn hay không:",
    "- Nguyên tắc vàng: nền càng cao, cú trừ càng đau (vì \"có nhiều để mất\"). Vd: nền 70 + yếu tố làm bỏ ăn → trừ ~40 để điểm cuối xuống ~30 (cá đã ngừng ăn). Cùng yếu tố đó trên nền 50 → chỉ trừ ~10 xuống ~40 (cá vốn đã ăn kém, thêm xấu cũng không thay đổi nhiều).",
    "- NỘI SUY BẮT BUỘC, CẤM NHẢY NGƯỠNG: mức điều chỉnh phải thay đổi LIÊN TỤC theo giá trị kích hoạt. Chênh lệch nhỏ ở giá trị kích hoạt chỉ được gây chênh lệch nhỏ ở điểm điều chỉnh (tối đa 2–3đ cho mỗi 1 hPa / 1°C / 0.5°C chênh lệch). CẤM kiểu vừa qua mốc là đổi hẳn mức điểm.",
    "- Phạt đêm nội suy theo giờ và chênh ngày–đêm nội suy với mốc tốt 5°C (càng lệch khỏi 5°C càng xấu dần, cấm nhảy tại 8°C).",
    "- Ngược lại, yếu tố tích cực trên nền thấp cộng nhiều hơn trên nền cao.",
    "- KHÔNG có cap +20, KHÔNG có bảng điểm cố định cho chỉ số phụ. Điểm cuối = nền 80 + điều chỉnh của bạn, sàn 0, trần 100, làm tròn số nguyên.",
    "- Ghi rõ từng điều chỉnh vào trường \"penalties\" (d: tên quy luật, pts: số điểm bạn cộng/trừ).",
    "### Bước 4: Quy tắc đặc biệt",
    "- Với 5 loài cá đáy: depth=1 (ăn lửng) luôn là tín hiệu xấu, phải trừ điểm mạnh. Cá ăn lửng nghĩa là cá đang stress (thiếu oxy), không phải đang ăn mạnh.",
    "- Thiếu oxy (nóng ≥30°C + gió ≤5 km/h): cá nổi lên vì ngạt → điểm phải THẤP, cấm diễn giải \"ăn lửng\" tích cực.",
    "### Bước 5: Điểm cuối = tổng Bước 2 + điều chỉnh Bước 3. Sàn 0, trần 100, làm tròn số nguyên",
    "LƯU Ý: Điểm 6 yếu tố đến từ bảng mốc + nội suy (Bước 1–2). Điểm chỉ số phụ do bạn tự cân theo ngữ cảnh (Bước 3). Điểm cuối phải khớp với thực tế cá ăn hay không — nếu cá bỏ ăn thì điểm phải thấp dù nền 6 yếu tố có cao.",
    "",
    "## YÊU CẦU",
    "Dự đoán NGAY LÚC NÀY cá có đi ăn không. Chỉ trả về JSON thuần (không markdown, không giải thích thêm):",
    "{",
    '  "score": số 0-100 cuối cùng, CHỈ từ Bước 1–5,',
    '  "dayNightDiff": 9.5, // chênh nhiệt ngày-đêm tính từ dữ liệu (°C), bắt buộc phải có',
    '  "title": "tiêu đề ngắn theo band điểm (hệ thống tự chuẩn hoá — cứ để tạm)",',
    '  "sub": "1-2 câu giải thích ngắn gọn, tối đa 2 câu",',
    '  "factors": [',
    '    {"k": "Nhiệt độ nước", "v": "27°C (ước từ 5 ngày)", "pts": 85, "d": "lý do ngắn"},',
    '    ... đủ 6 yếu tố theo thứ tự: Nhiệt độ nước, Áp suất, Nhiệt độ không khí, Tốc độ gió, Hướng gió, Độ ẩm (pts 0–100 mỗi yếu tố)',
    '  ],',
    '  "penalties": [{"d": "chỉ ghi quy luật có bằng chứng định lượng rõ ràng", "pts": -5}], // ví dụ định dạng, không phải mức trừ cố định; có thể rỗng',
    '  "chips": [',
    '    {"k": "Mặt trăng", "v": "91%", "d": "giờ solunar...", "cls": "good"},',
    '  ], // chips CHỈ cho thông tin NGOÀI 6 yếu tố (mặt trăng, mưa, solunar...). CẤM lặp lại 6 yếu tố đã có trong factors; CẤM đưa thông tin đối chứng nguồn thời tiết (các nguồn đồng thuận/mâu thuẫn) vào chips; cls là good | warn | bad | "",',
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
  const title = score >= 90 ? (lang === "en" ? "FISH QUEUEING UP" : "CÁ XẾP HÀNG ĐỚP")
    : score >= 75 ? (lang === "en" ? "GO FISHING!" : "ĐI CÂU NGAY!")
    : score >= 65 ? (lang === "en" ? "TASTY!" : "NGON RỒI ĐẤY")
    : score >= 55 ? (lang === "en" ? "PRETTY GOOD" : "KHÁ ĐẤY")
    : score >= 45 ? (lang === "en" ? "HOPEFUL" : "CÓ HY VỌNG")
    : score >= 30 ? (lang === "en" ? "HIT OR MISS" : "HÊN XUI")
    : score >= 10 ? (lang === "en" ? "STAY HOME" : "Ở NHÀ ĐI")
    : (lang === "en" ? "FISH ON STRIKE" : "CÁ TUYỆT THỰC");
  const okCls = (c) => ["good", "warn", "bad", ""].includes(c) ? c : "";
  const factorKeys = (Array.isArray(v.factors) ? v.factors : []).map((f) => String(f.k || "").toLowerCase());
  const dupKw = ["gió", "wind", "nhiệt", "temp", "ẩm", "humid", "áp suất", "pressure", "nguồn", "source", "đối chứng", "đồng thuận", "cross", "agree"];
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
  const dayNightDiff = Number.isFinite(+v.dayNightDiff) ? Math.round(+v.dayNightDiff * 10) / 10 : null;

  return { score, title, sub: String(v.sub || ""), chips, factors, penalties, depth, demo: false, dayNightDiff };
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
