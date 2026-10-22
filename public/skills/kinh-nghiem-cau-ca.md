# Kinh nghiệm câu cá — knowledge base cho AI dự đoán

> File này là "bộ não" của web **Cá có ăn không?**
> Cloudflare Function (`functions/api/predict.js`) đọc file này mỗi lần gọi LLM,
> nên mọi kinh nghiệm bạn thêm vào đây sẽ tự động đi vào prompt phân tích.
>
> **Cách bổ sung khi học được từ forum/hội nhóm:**
> `- **Quy luật:** ... | **Nguồn:** (tên group/diễn đàn) | **Độ tin cậy:** cao/trung bình/thấp`
>
> Độ tin cậy: **cao** = nhiều người đồng thuận + khớp lý thuyết; **trung bình** = kinh nghiệm
> phổ biến nhưng chưa kiểm chứng rộng; **thấp** = ý kiến cá nhân, cần thêm dữ liệu.

## 1. Mặt trăng & giờ solunar (độ tin cậy: cao)

- Trăng non và trăng rằm: cá ăn mạnh nhất trong tháng (major days).
- Giờ major: quanh lúc trăng lên đỉnh và xuống đáy (±1 tiếng).
- Giờ minor: quanh lúc trăng mọc và trăng lặn (±1 tiếng).
- Đêm trăng sáng: cá săn mồi nhiều về đêm, ban ngày có thể kém hơn.

## 2. Áp suất khí quyển (độ tin cậy: cao)

- 1013–1022 hPa và ổn định: điều kiện lý tưởng.
- Áp suất đang giảm dần (trước mưa/bão): cá ăn tích cực bất thường — tranh thủ.
- Áp suất giảm sâu dưới ~1005 hPa hoặc tăng vọt sau bão: cá kém ăn.
- Biến động mạnh (>3 hPa trong 3 giờ): cá bị xáo trộn, khó đoán.

## 3. Gió (độ tin cậy: trung bình)

- Gió nhẹ dưới 10 km/h: lý tưởng, mặt nước êm.
- Gió 10–20 km/h: vẫn câu được, cá có thể dạt về bờ khuất gió.
- Gió trên 30 km/h hoặc đổi hướng đột ngột: xấu, nên nghỉ.
- Gió mùa đông bắc lạnh ở miền Bắc: nước lạnh dần, cá lười ăn.

## 4. Nhiệt độ (độ tin cậy: trung bình)

- Cá nước ngọt nhiệt đới ở VN ăn mạnh nhất khi 24–30°C.
- Dưới 20°C (miền Bắc mùa đông): cá chậm chạp, ăn ít hẳn.
- Trên 33°C: cá tìm chỗ râm, sâu; câu lúc sáng sớm hoặc chiều mát.

## 5. Mây & mưa (độ tin cậy: trung bình)

- Trời âm u nhẹ, mây 20–60%: cá dạn hơn, ăn tốt hơn nắng gắt.
- Mưa nhỏ sau đợt nắng hạn: kích thích cá ăn (nước mới, oxy tăng).
- Mưa lớn, nước đục ngầu, chảy xiết: kém ăn; chờ 1–2 ngày nước trong lại.

## 6. Thời điểm trong ngày (độ tin cậy: cao)

- Bình minh và hoàng hôn (±1 tiếng): giờ vàng, cá săn mồi mạnh nhất.
- Trưa nắng gắt: cá xuống sâu tránh nóng, kém ăn.
- Ban đêm: nhiều loài săn mồi (cá tra, cá trê, cá lóc) ăn mạnh.

## 7. Theo loại cá phổ biến ở Việt Nam (độ tin cậy: trung bình)

- **Cá lóc:** thích nước nông, ăn mạnh sáng sớm và chiều mát; mồi giả hiệu quả lúc trời âm u.
- **Cá tra:** ăn mạnh về đêm, thích chỗ nước chảy nhẹ.
- **Cá rô phi:** dễ tính nhất, ăn cả ngày khi trời ấm.
- **Cá chép:** tinh khôn, thích yên tĩnh; câu sáng sớm, tránh ồn.
- **Cá trê:** chuyên ăn đêm, đặc biệt sau cơn mưa.

## 8. Mùa ở Việt Nam (độ tin cậy: trung bình)

- Đầu mùa mưa: cá ăn mạnh (nước mới về, mồi tự nhiên nhiều).
- Miền Bắc tháng 12–2: lạnh, cá kém ăn rõ rệt.
- Ngay sau bão: nước đục, cá nhát; 1–2 ngày sau mới ổn định lại.

## 9. Mẹo từ cộng đồng (bổ sung dần)

- *(Chờ bạn thêm vào từ các hội nhóm câu cá)*
