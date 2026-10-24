# Chỉ số phụ — quy luật định tính (AI tự tính điểm theo ngữ cảnh, KHÔNG có mốc điểm cố định)

Phạm vi: 5 loài cá tầng đáy (chép, trôi, trắm, rô phi, diếc).

## Áp suất
- Mùa hè áp suất thường dao động quanh 1000-1010 hPa, mùa đông 1015-1030 hPa. So với mức bình thường của mùa, không so tuyệt đối.
- Áp suất cao thấp không quan trọng bằng tốc độ thay đổi.
- Giảm chậm 1-2 hPa trong 5 giờ: ăn mạnh.
- Tăng hoặc giảm nhanh trong 5 giờ: bỏ ăn.
- Sau biến động mạnh cần 1-2 ngày để ăn mạnh lại.

## Xu hướng nhiệt độ nước (5 ngày)
- Tăng nhanh từ lạnh về phía thoải mái (20-25°C): ăn tăng.
- Giảm nhanh từ nóng về phía thoải mái (25-30°C): ăn mạnh.
- Tăng/giảm nhanh 2-3 độ trong 5 ngày mà không về phía thoải mái, hoặc dao động lên xuống liên tục: giảm ăn dần, càng thay đổi lớn càng giảm mạnh.
- Ổn định (dưới 1 độ trong 5 ngày): tốt.

## Đổi hướng gió đột ngột
- Đổi hướng đột ngột (từ 90° trở lên): ăn mạnh trong 2-3 giờ đầu, sau đó bỏ ăn. Cần 1-2 ngày hồi phục.

## Mưa
- Mưa nhẹ hoặc mưa rào + trời mát: ăn tốt.
- Mưa nhẹ hoặc mưa rào + trời nóng: trung bình.
- Mưa to / mưa kéo dài: ăn kém.

## Giờ trong ngày + mây/nắng
- Đỉnh ăn: 8h sáng và 5h chiều.
- Càng về trưa càng ăn kém (đáy 12-13h).
- Đêm ăn kém dần: 19-21h kém, 21-0h kém hơn, 0-4h kém nhất, 4-5h nới dần.
- Mây (âm u): ăn tốt. Nắng gắt: ăn kém.

## Chênh ngày-đêm
- Chênh trên 8°C: cá gần như không ăn.
- Chênh dưới 8°C duy trì 3 ngày trở lên: ăn mạnh.

## Giao mùa / lạnh về
- Giao mùa: ăn chậm.
- Ổn định nhiều ngày: cá quen nhịp, ăn đều.
- Hôm sau lạnh về: không ăn. Ngày trước lạnh về: ăn mạnh (tranh ăn trước front).
- Nóng hôm qua rồi mát + có gió hôm nay: ăn tốt. Nóng hôm qua rồi âm u + gió to: ăn kém.

## Thiếu oxy / cá ăn lửng
- Nóng từ 30°C trở lên + gió dưới 5 km/h: thiếu oxy, cá nổi lên vì ngạt.
- Gió trên 5 km/h đã hỗ trợ oxy tốt.
- Chỉ quan tâm cá ăn đáy — cá đi lửng nghĩa là cá đang ăn chậm (tín hiệu xấu), không phải tín hiệu tốt.

## Nguyên tắc tính điểm chỉ số phụ (quan trọng)
- Không có mốc điểm cố định. AI tự cân mức cộng/trừ theo ngữ cảnh.
- Nền càng cao, cú trừ càng đau (nền 70 + yếu tố làm bỏ ăn thì trừ mạnh để điểm cuối xuống thấp, thể hiện cá đã ngừng ăn; cùng yếu tố đó trên nền 50 thì trừ nhẹ).
- Điểm cuối phải phản ánh đúng thực tế cá có ăn hay không, không phải cộng trừ máy móc.
