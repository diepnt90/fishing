# Chỉ số phụ — quy luật định tính (AI tự tính điểm theo ngữ cảnh, KHÔNG có mốc điểm cố định)

LƯU Ý BẮT BUỘC CHO AI: Với mỗi quy luật dưới đây, phải TÍNH giá trị kích hoạt từ dữ liệu trước khi quyết định có áp dụng hay không. Không đoán, không bỏ qua quy luật nào. Vd: quy luật áp suất thì phải tính chênh lệch áp suất 5 giờ (giờ cuối trừ giờ đầu trong lịch sử 5 giờ); quy luật giờ thì phải xem giờ địa phương hiện tại; quy luật mưa thì phải xem mưa + nhiệt độ lúc này. Chỉ áp dụng quy luật sau khi đã tính xong giá trị kích hoạt.

Phạm vi: 5 loài cá tầng đáy (chép, trôi, trắm, rô phi, diếc).

## Áp suất
- Mùa hè áp suất thường dao động quanh 1000-1010 hPa, mùa đông 1015-1030 hPa. So với mức bình thường của mùa, không so tuyệt đối.
- Áp suất cao thấp không quan trọng bằng tốc độ thay đổi. Bảng thay đổi áp suất / 5 giờ:
- Ổn định (dưới ±1,5 hPa): bình thường.
- Giảm chậm 1,5-5 hPa: ăn mạnh nhất.
- Giảm nhanh 5-10 hPa: ăn kém dần, cá chọn lọc.
- Giảm rất nhanh (trên 10 hPa): gần như không ăn.
- Tăng chậm 1,5-3 hPa: ăn khá.
- Tăng nhanh (trên 5 hPa): ăn yếu.
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
- Đêm ăn kém dần theo giờ, nội suy liên tục: từ 19h phạt tăng dần, sâu nhất khoảng 0–4h, rồi nới dần về sáng (4–5h). Giờ kề nhau chỉ lệch nhẹ, cấm nhảy giữa các khung giờ.
- Mây (âm u): ăn tốt. Nắng gắt: ăn kém.

## Chênh ngày-đêm
- Mốc tốt là 5°C: quanh 5°C cá ăn tốt, chênh nhỏ hơn 5°C (thời tiết ổn định) cũng tốt.
- Chênh càng lớn càng xấu dần theo nội suy liên tục, không nhảy mốc: 6°C chỉ hơi kém hơn 5°C, 7°C kém hơn nữa, 8–9°C xấu dần, trên 10°C rất xấu. Cấm kiểu 8°C còn được mà 9°C đột ngột gần như không ăn.
- Chênh duy trì quanh mốc tốt nhiều ngày thì ăn đều.

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
- Nội suy bắt buộc, cấm nhảy ngưỡng: mức điều chỉnh thay đổi liên tục theo giá trị kích hoạt; chênh lệch nhỏ ở giá trị kích hoạt chỉ được gây chênh lệch nhỏ ở điểm (tối đa 2–3đ cho mỗi 1 hPa / 1°C / 0.5°C chênh lệch).
