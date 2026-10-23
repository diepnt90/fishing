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
- **Quy luật:** Gió hướng Tây (Tây, Tây Nam, Tây Bắc) thì cá ăn chậm hẳn. | **Nguồn:** Điệp (kinh nghiệm thực tế đi câu) | **Độ tin cậy:** cao
- **Quy luật:** Gió đổi hướng liên tục trong ngày thì cá ăn chậm (xem lịch sử hướng gió các giờ gần nhất). | **Nguồn:** Điệp (kinh nghiệm thực tế đi câu) | **Độ tin cậy:** cao
- **Quy luật:** Thời tiết ổn định nhiều ngày: cá có xu hướng duy trì nhịp ăn quen thuộc; ưu tiên tầng đã có cá và khung giờ từng hiệu quả. | **Nguồn:** Điệp (tổng hợp kinh nghiệm) | **Độ tin cậy:** cao
- **Quy luật:** Nhiệt độ nước phù hợp, ít biến động: khả năng cá ăn đều hơn; thử đáy và sát đáy trước với cá chép, cá trôi, cá diếc. | **Nguồn:** Điệp (tổng hợp kinh nghiệm) | **Độ tin cậy:** cao
- **Quy luật:** Không khí lạnh tràn về, nhiệt độ giảm nhanh: cá có thể giảm ăn và chuyển đến vùng sâu, ít biến động nhiệt; giảm lượng mồi, dò đáy sâu. | **Nguồn:** Điệp (tổng hợp kinh nghiệm) | **Độ tin cậy:** cao
- **Quy luật:** Chênh lệch nhiệt độ ngày đêm lớn: cá có thể đổi vị trí và tầng hoạt động; thử đáy vào lúc nước lạnh, kiểm tra tầng cao hơn khi nước ấm lên. | **Nguồn:** Điệp (tổng hợp kinh nghiệm) | **Độ tin cậy:** cao
- **Quy luật:** Trời nóng oi, gió yếu, cá nổi đầu: nguy cơ thiếu oxy; cá có thể nổi nhưng ăn yếu hoặc ngừng ăn, không mặc định câu nổi sẽ hiệu quả. | **Nguồn:** Điệp (tổng hợp kinh nghiệm) | **Độ tin cậy:** cao
- **Quy luật:** Gió nhẹ làm mặt nước xáo động: có thể cải thiện trao đổi oxy và tạo điều kiện kiếm ăn; thử phía đón gió nếu an toàn và phù hợp địa hình. | **Nguồn:** Điệp (tổng hợp kinh nghiệm) | **Độ tin cậy:** cao
- **Quy luật:** Gió mạnh, gió đổi hướng thất thường: cá có thể thay đổi vị trí kiếm ăn; cần xét nhiệt độ, sóng và dòng chảy thay vì kết luận theo riêng hướng gió. | **Nguồn:** Điệp (tổng hợp kinh nghiệm) | **Độ tin cậy:** cao
- **Quy luật:** Sau mưa lớn: nước đục, dòng chảy và mực nước thay đổi có thể làm cá đổi vị trí; thử cửa nước mới, ven bờ hoặc vùng nước ít dòng, tùy điều kiện thực tế. | **Nguồn:** Điệp (tổng hợp kinh nghiệm) | **Độ tin cậy:** cao
- **Quy luật:** Cá chép, cá diếc sau đợt giảm nhiệt mạnh: thường nên thử đáy trước; nếu trời ổn định trở lại, kiểm tra cả vùng sát bờ và tầng nông. | **Nguồn:** Điệp (tổng hợp kinh nghiệm) | **Độ tin cậy:** cao
- **Quy luật:** Cá trắm cỏ khi trời ấm: có thể ăn ở nhiều tầng; thử đáy trước rồi nâng mồi lên khoảng 30–50 cm nếu không có tín hiệu. | **Nguồn:** Điệp (tổng hợp kinh nghiệm) | **Độ tin cậy:** cao
- **Quy luật:** Cá trôi: thử sát đáy và đáy trước, sau đó điều chỉnh độ cao dựa trên tín hiệu thực tế; không có căn cứ để mặc định một kiểu thời tiết luôn khiến cá trôi ăn lửng. | **Nguồn:** Điệp (tổng hợp kinh nghiệm) | **Độ tin cậy:** cao
- **Quy luật:** Cá rô phi: ưu tiên thử tầng đáy hoặc sát đáy khi nước mát; khi nước ấm, kiểm tra cả tầng giữa và vùng nông có thức ăn. | **Nguồn:** Điệp (tổng hợp kinh nghiệm) | **Độ tin cậy:** cao
- **Quy luật:** Mồi có tín hiệu khi đang chìm nhưng mất tín hiệu khi chạm đáy: tăng khả năng cá đang ăn lửng; thử thay đổi độ cao mồi theo từng nấc. | **Nguồn:** Điệp (tổng hợp kinh nghiệm) | **Độ tin cậy:** cao
- **Quy luật:** Cá nổi đầu nhưng không đớp mồi: nghi ngờ thiếu oxy hoặc điều kiện nước bất lợi; ưu tiên tìm vùng nước thông thoáng thay vì chỉ đổi sang câu tầng mặt. | **Nguồn:** Điệp (tổng hợp kinh nghiệm) | **Độ tin cậy:** cao
- **Quy luật:** Chênh lệch nhiệt độ ngày–đêm ít hơn 8 độ trong vài ngày gần đây → cá đi ăn mạnh. | **Nguồn:** Điệp (kinh nghiệm thực tế đi câu) | **Độ tin cậy:** cao
- **Quy luật:** Có mưa nhẹ rồi hửng nắng nhẹ → cá ăn mạnh. | **Nguồn:** Điệp (kinh nghiệm thực tế đi câu) | **Độ tin cậy:** cao
- **Quy luật:** Ngày trước khi không khí lạnh về → cá ăn mạnh (tranh thủ ăn trước đợt lạnh). | **Nguồn:** Điệp (kinh nghiệm thực tế đi câu) | **Độ tin cậy:** cao
- **Quy luật:** Hôm trước nắng nóng, hôm sau mát hơn (nhiệt cao nhất không quá 36°C) và có gió → cá ăn mạnh. | **Nguồn:** Điệp (kinh nghiệm thực tế đi câu) | **Độ tin cậy:** cao
- **Quy luật:** Hôm trước và hôm sau đều nhiều mây, nắng nhẹ, mát mẻ → cá ăn mạnh. | **Nguồn:** Điệp (kinh nghiệm thực tế đi câu) | **Độ tin cậy:** cao
- **Quy luật:** Hôm trước nắng nóng, hôm sau âm u kèm gió to → cá giảm ăn. | **Nguồn:** Điệp (kinh nghiệm thực tế đi câu) | **Độ tin cậy:** cao
- **Quy luật:** Hôm trước có không khí lạnh về → hôm sau cá không ăn. | **Nguồn:** Điệp (kinh nghiệm thực tế đi câu) | **Độ tin cậy:** cao
- **Quy luật:** Hôm trước mưa cả ngày, hôm sau mưa giảm/tạnh hoặc nổi gió mạnh → cá không ăn. | **Nguồn:** Điệp (kinh nghiệm thực tế đi câu) | **Độ tin cậy:** cao
