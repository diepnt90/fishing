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

## 7. Theo loài cá — CHỈ tập trung 6 loài này (độ tin cậy: trung bình)

> Web này phục vụ câu 6 loài cá nước ngọt ao/hồ/sông: chép, trôi, trắm, mè, rô phi, diếc.
> Không ưu tiên các loài khác (lóc, tra, trê...).

- **Cá chép:** tinh khôn, nhát; ăn mạnh sáng sớm và chiều mát; rất sợ ồn ào, cần giữ yên tĩnh.
  Nhiệt độ ưa thích 20–28°C; áp suất ổn định thì ăn đều. Mồi: cám, khoai lang, ốc vặn.
- **Cá trôi:** ăn tạp, dạn hơn chép; ăn mạnh khi trời âm u hoặc mưa nhỏ, thích nước hơi đục;
  hoạt động cả ngày. Mồi: cám tanh, mồi ủ chua nhẹ.
- **Cá trắm cỏ:** ăn thực vật, ăn mạnh ban ngày khi trời ấm; thích chỗ có cỏ, bèo, rau muống.
  Mồi: lá sắn, rau muống, cỏ non, cám xanh.
- **Cá trắm đen:** ăn ốc, nhát và tinh như chép; thích yên tĩnh tuyệt đối; ăn mạnh đêm và sáng sớm.
  Mồi: ốc vặn đập dập, ốc bươu.
- **Cá mè (hoa/trắng):** ăn lọc, lửng lơ tầng mặt–tầng giữa; ăn mạnh khi nắng ấm (tảo phát triển).
  Câu lửng, mồi: cám chua/thơm, mồi ủ lên men nhẹ. Trời lạnh sâu thì kém hẳn.
- **Cá rô phi:** dễ tính nhất, ăn cả ngày khi 25–32°C; dưới 20°C thì kém ăn rõ rệt.
  Mồi gì cũng ăn: cám, giun, tép.
- **Cá diếc:** nhỏ, miệng bé, ăn nhẹ và tinh; thích nước tĩnh, sáng sớm/chiều mát;
  dùng lưỡi nhỏ, mồi nhỏ (cám mịn, giun quế); rất nhạy với động và bóng người.

## 8. Mùa ở Việt Nam (độ tin cậy: trung bình)

- Đầu mùa mưa: cá ăn mạnh (nước mới về, mồi tự nhiên nhiều).
- Miền Bắc tháng 12–2: lạnh, cá kém ăn rõ rệt.
- Ngay sau bão: nước đục, cá nhát; 1–2 ngày sau mới ổn định lại.

## 9. Mẹo từ cộng đồng (bổ sung dần)

- *(Chờ bạn thêm vào từ các hội nhóm câu cá)*

## 10. Tầng nước cá ăn: đáy / lửng / mặt (độ tin cậy: trung bình)

> Quy ước: **mặt** = tầng mặt–0,5m; **lửng** = tầng giữa ~1–2m; **đáy** = sát đáy.

**Tầng mặc định theo loài:**
- Cá chép: **đáy** (mò mẫm bùn tìm mồi).
- Cá trôi: **đáy–lửng thấp**.
- Trắm đen: **đáy** (ăn ốc dưới đáy).
- Trắm cỏ: **lửng–mặt** (ăn cỏ, bèo nổi).
- Cá mè: **lửng–mặt** (ăn lọc tảo lơ lửng).
- Cá rô phi: **lửng** linh hoạt, có thể lên mặt khi ấm.
- Cá diếc: **đáy**, sát đáy.

**Thời tiết làm dịch chuyển tầng ăn:**
- Nắng gắt giữa trưa (10h–15h, nhiệt >30°C): cá xuống sâu hơn 1 tầng (kể cả loài lửng).
- Trời âm u, mát (mây 40–80%): cá dạn, nổi lên cao hơn.
- Áp suất đang giảm (trước mưa): cá nổi lên tầng cao, ăn tích cực.
- Nước lạnh (<20°C): cá xuống đáy, chậm chạp.
- Giờ vàng bình minh/hoàng hôn: cá lên gần mặt kiếm ăn.
- Mưa nhỏ: cá lên mặt/lửng; mưa lớn nước đục: cá dạt đáy, nép bờ.
