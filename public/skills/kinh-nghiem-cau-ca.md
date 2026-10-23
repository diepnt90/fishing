# Kinh nghiệm câu cá — knowledge base cho AI dự đoán

> File này là "bộ não" riêng của web **Cá có ăn không?**
> Cloudflare Function (`functions/api/predict.js`) đọc file này mỗi lần gọi LLM.
>
> **Nguyên tắc:** kiến thức chung (thuyết solunar, ảnh hưởng áp suất/nhiệt độ/gió/mây,
> tập tính cơ bản của cá...) thì LLM đã biết — KHÔNG ghi lại ở đây cho đỡ tốn token.
> Chỉ ghi những gì AI không biết: kinh nghiệm thực tế từ forum/hội nhóm câu cá Việt Nam,
> mẹo địa phương, và những quy luật ngược với lý thuyết chung.
>
> **Cách thêm:** `- **Quy luật:** ... | **Nguồn:** (tên group/diễn đàn) | **Độ tin cậy:** cao/trung bình/thấp`
>
> Độ tin cậy: **cao** = nhiều người đồng thuận; **trung bình** = kinh nghiệm phổ biến
> nhưng chưa kiểm chứng rộng; **thấp** = ý kiến cá nhân, cần thêm dữ liệu.

## Phạm vi

Web này phục vụ câu các loài cá tầng đáy ở ao/hồ/sông Việt Nam:
**cá chép, cá trôi, cá trắm (cỏ/đen), cá rô phi, cá diếc.**
(Không câu cá mè — loài ăn lửng/mặt.)

## Mẹo từ cộng đồng

- **Quy luật:** Cá (kể cả cá đáy như chép, diếc) chỉ đi ăn lửng/mặt vào những hôm thiếu oxy — trời oi nóng, lặng gió. Bình thường cá đáy vẫn ăn đáy. | **Nguồn:** Điệp (kinh nghiệm thực tế đi câu) | **Độ tin cậy:** cao
- **Quy luật:** Sau cơn mưa kéo dài 2–5 tiếng, trời hửng nắng trở lại mà không có gió hoặc gió rất yếu → cá không đi ăn. | **Nguồn:** Điệp (kinh nghiệm thực tế đi câu) | **Độ tin cậy:** cao
- **Quy luật:** Chênh lệch nhiệt độ ngày–đêm càng lớn thì cá ăn càng chậm; chênh trên 8 độ thì cá gần như không ăn. | **Nguồn:** Điệp (kinh nghiệm thực tế đi câu) | **Độ tin cậy:** cao
- **Quy luật:** Vào thời điểm giao mùa (chuyển mùa) cá ăn chậm hẳn. | **Nguồn:** Điệp (kinh nghiệm thực tế đi câu) | **Độ tin cậy:** cao
