# Cá có ăn không? 🎣

Web dự đoán xem hôm nay cá có đi ăn không — dựa trên dữ liệu thời tiết
(Open-Meteo + WeatherAPI.com + OpenWeatherMap), pha mặt trăng / giờ solunar,
và phân tích của LLM.

Thiết kế: **Đáy biển phát quang** (bioluminescent deep-sea).

## Chạy & deploy

**Cloudflare Pages** (khuyên dùng):
1. Vào dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git
2. Chọn repo `diepnt90/fishing`
3. Build settings: Framework preset = None, Build command = *(trống)*, Output directory = `public`
4. Deploy — xong. Endpoint AI: `https://<tên>.pages.dev/api/predict`

**Chạy local:** mở `public/index.html` bằng live server
(vd: `npx serve public`). Lưu ý: `/api/predict` chỉ chạy khi deploy
lên Pages (hoặc `wrangler pages dev public`); mở file trực tiếp thì
app tự fallback sang thuật toán demo tại chỗ.

## Cấu trúc

```
public/
  index.html   — khung trang
  styles.css   — design system "đáy biển phát quang"
  app.js       — chọn vị trí (tìm kiếm / GPS) + gọi thời tiết +
                 tính pha trăng & solunar + animation đàn cá + đồng hồ điểm
functions/
  api/predict.js — Cloudflare Function: hiện trả demo, TODO cắm LLM
```

## Roadmap

- [x] UI: chọn vị trí 3 cách, đồng hồ điểm thang màu, đàn cá animation
- [x] Thời tiết thật từ Open-Meteo (không cần key)
- [ ] Cắm WeatherAPI.com + OpenWeatherMap làm nguồn đối chứng (cần key)
- [ ] Cắm LLM vào `functions/api/predict.js` (GPT-5 nano / Gemini 2.5 Flash-Lite)
- [x] Skill kiến thức câu cá (`public/skills/kinh-nghiem-cau-ca.md`) — bản đầu, chờ bồi đắp từ forum
- [ ] Log kết quả câu thực tế để fine-tune về sau
