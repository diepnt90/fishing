# Kinh nghiệm câu cá — knowledge base cho AI dự đoán
"Bộ não" riêng của web **Cá có ăn không?** — `functions/api/predict.js` đọc mỗi lần gọi LLM.
Nguyên tắc: LLM đã biết kiến thức chung → chỉ ghi kinh nghiệm thực tế, mẹo địa phương, quy luật ngược lý thuyết.
Mặc định mọi mẹo: nguồn Điệp, độ tin cậy cao (ghi chú riêng nếu khác). Thêm mẹo mới: `- ...` (1 dòng/mẹo).
Phạm vi: cá tầng đáy VN — chép, trôi, trắm (cỏ/đen), rô phi, diếc. Không câu cá mè.

## Mẹo từ cộng đồng

- Cá đáy chỉ đi ăn lửng/mặt vào hôm thiếu oxy: oi nóng ≥30°C + gió ≤5 km/h (gió >5 km/h đã đủ oxy). Bình thường cá đáy vẫn ăn đáy.
- Điệp chỉ quan tâm cá ăn đáy: cá đi lửng (rời đáy lên tầng giữa) luôn nghĩa là cá đang ăn CHẬM — tín hiệu xấu, trừ điểm mạnh, không diễn giải tích cực.
- Trời nắng + nhiệt >30°C: càng gần giữa trưa cá càng ăn chậm (thấp nhất 11h–13h, sau 15h ăn lại dần).
- Sau mưa kéo dài 2–5 tiếng rồi hửng nắng mà không/lặng gió → cá không đi ăn.
- Chênh lệch nhiệt ngày–đêm càng lớn cá ăn càng chậm; chênh >8° gần như không ăn. Ngược lại, chênh <8° duy trì vài ngày → cá ăn mạnh.
- Giao mùa → cá ăn chậm hẳn.
- Gió Đông Nam/Nam → cá ăn mạnh; gió Tây/Tây Nam/Tây Bắc → ăn chậm; gió Bắc/Tây/Đông Bắc xuất hiện đột ngột → ăn chậm hoặc không ăn.
- Gió đổi hướng liên tục/thất thường trong ngày → cá ăn chậm; đừng kết luận theo riêng hướng gió, xét thêm nhiệt độ/sóng/dòng chảy (xem lịch sử hướng gió từng giờ).
- Thời tiết ổn định nhiều ngày + nhiệt độ nước ít biến động → cá duy trì nhịp ăn quen thuộc (ưu tiên tầng và khung giờ từng hiệu quả), ăn đều hơn.
- Không khí lạnh tràn về / nhiệt giảm nhanh → cá giảm ăn, rút xuống sâu; hôm sau của ngày lạnh về → cá không ăn. Ngược lại, ngày trước đợt lạnh về → cá tranh thủ ăn mạnh.
- Trời nóng oi, gió yếu, cá nổi đầu nhưng không đớp mồi: nghi thiếu oxy → ăn yếu/ngừng ăn; tìm vùng nước thông thoáng thay vì câu nổi.
- Gió nhẹ làm xáo mặt nước → cải thiện oxy; thử phía đón gió nếu an toàn.
- Sau mưa lớn: nước đục, dòng/mực nước đổi → cá đổi vị trí; thử cửa nước mới, ven bờ, vùng ít dòng.
- Hôm trước nắng nóng → hôm sau: mát hơn (cao nhất ≤36°C) + có gió → ăn mạnh; âm u + gió to → giảm ăn.
- Mưa nhẹ rồi hửng nắng nhẹ → cá ăn mạnh. Hai ngày liền nhiều mây, mát → cá ăn mạnh.
- Hôm trước mưa cả ngày, hôm sau tạnh/gió mạnh → cá không ăn.
- Độ ẩm >85% → ăn yếu; ẩm thấp → ăn mạnh hơn.
- Áp suất >1020 hPa → ăn mạnh; <1000 hPa → cá không ăn.
