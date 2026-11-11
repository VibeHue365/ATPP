# VIB-92 / UC-M08 — bảng size riêng và tư vấn theo sản phẩm

## Chạy chức năng đọc ảnh ở máy local

`npm run dev` ở thư mục gốc chỉ khởi động backend và frontend. Để provider tải ảnh và AI điền các dòng size, cần chạy thêm AI service ở cổng 8000. Trên Windows, mở terminal riêng:

```powershell
cd ai-service
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Nếu chưa có `.venv`, tạo môi trường Python và cài `ai-service/requirements.txt`, hoặc chạy `docker compose up -d ai-service` như trong `docker-services.md`. Kiểm tra `http://127.0.0.1:8000/` trước khi tải ảnh. API key chỉ nằm trong `ai-service/.env`; không cần nhập vào giao diện. Nếu AI service hoặc hạn mức Gemini chưa sẵn sàng, lần thay ảnh bị hủy và bảng size trước đó được giữ nguyên. Provider có thể nhập số đo bằng tay hoặc thử lại sau.

## Giai đoạn 6–7: onboarding, engine và trang sản phẩm

Kiểm chứng bổ sung sau khi điều chỉnh quy tắc: 32 test backend về engine/service và 15 test frontend về modal/bảng detail đạt; Chrome headless với API giả lập đạt ở desktop/mobile. API local với sản phẩm `6ada152a31f17be1dca1a945` trả MATCH/M cho bộ số đo vòng 86/68/92 cm dù chiều cao 175 cm và cân nặng 65 kg ngoài khoảng tham khảo; bộ 83/68/92 cm trả NO_MATCH, `closestSizes=M,S`, nêu ngực lệch 1 cm so với M và không chọn size. Đây là dữ liệu kiểm thử mẫu, không phải số đo thật của khách. Backend build đạt; frontend build vẫn dừng ở 14 lỗi TS6133 baseline ngoài VIB-92.

- Onboarding thêm ngực/eo/mông (cm), sở thích SLIM/REGULAR/COMFORT, hướng dẫn đo. Không bắt người cũ nhập lại; các số đo mới tùy chọn. Bỏ thông báo khớp “size chuẩn” dùng bảng chung. Size thường mặc vẫn được giữ cho tương thích, nhưng engine không dùng nhãn này để quyết định size.
- `POST /products/:id/size-recommendation` (cũng có tiền tố /api): optional JWT. Body chỉ chấp nhận height/weight/chest/waist/hip/shoulder/bicep/fitPreference; số đo theo cm/kg. Có JWT thì lấy chính hồ sơ người đó; body override chỉ cho lần tư vấn, null bỏ giá trị cũ. Guest nhập trực tiếp. Không nhận userId hay chart do client cung cấp.
- Response: status UNAVAILABLE/MATCH/MULTIPLE_MATCHES/PRELIMINARY/NO_MATCH/INSUFFICIENT_DATA; chartVersion; candidates; recommendedSize chỉ có khi đúng một size đạt kiểm tra đầy đủ; `closestSizes` chỉ dùng để đối chiếu khi NO_MATCH, không phải size được chọn; `missingMeasurements` nêu trường khách cần nhập, `missingChartMeasurements` nêu dữ liệu cửa hàng thiếu; evaluations gồm lý do, số đo thiếu và `violations` có số đo lệch, khoảng chuẩn, độ lệch và mức giao nhau của khoảng áo. Không có điểm tin cậy % tự tạo.
- Engine chỉ đọc bảng CONFIRMED còn khớp size sản phẩm. Các số đo provider chọn trong `requiredMeasurements` luôn bắt buộc; số đo khác có trong bảng vẫn được kiểm tra khi khách cung cấp, nhưng không bị hỏi nếu khách chưa có. Nếu khách cung cấp số đo phụ mà một size thiếu khoảng tương ứng, size đó không được giả thành phù hợp.
- Gợi ý sơ bộ cần đủ khoảng height+weight và số liệu người dùng tương ứng; không được che một số đo đã biết là vượt giới hạn, thiếu constraint trong bảng hoặc thiếu quy tắc fit cần thiết. Sơ bộ không có recommendedSize và UI không cho áp dụng.
- Modal trang chi tiết lấy bảng đã xác nhận và số đo thực từ hồ sơ, không điền số đo mẫu 160/50/84/66 như luồng cũ. Có thể sửa cho một lần tư vấn hoặc chủ động lưu vào hồ sơ. Kết quả cũ bị xóa khi sửa số đo. Không gọi chatbot/Gemini hay fallback sang bảng size chung.
- Khi bảng thay đổi giữa lúc mở modal/tư vấn/chọn áp dụng, modal yêu cầu lấy gợi ý mới. Nhiều size đạt thì hiển thị từng nút để người dùng tự chọn. Không thay đổi màu, lịch, số lượng hoặc cơ chế kiểm tra tồn kho của booking.

## Kiểm chứng tổng hợp và giới hạn hiện tại

- Backend: build thành công; 14 suites/130 tests của products + users thành công, gồm quyền sở hữu, version, publish gate, profile, engine/body/garment, đơn vị, edge cases và không gọi Gemini khi tư vấn.
- Frontend VIB-92: 4 files/27 tests thành công (editor nhập khoảng hai ô và upload ảnh, wizard lưu biến thể ở bước 2/gửi duyệt, onboarding, modal tư vấn). Có test sản phẩm legacy vẫn sửa được mà không bị ép thêm bảng, sản phẩm mới bị chặn khi bảng chưa xác nhận/không khớp size. Chrome headless dùng API giả lập đã kiểm tra riêng editor nhập/lưu nháp/xác nhận, chủ động áp dụng size, desktop/mobile và không tràn ngang trang; chưa chạy lại Chrome với toàn bộ wizard sau khi chuyển bảng size sang bước 2. Không phải test end-to-end trên database thật.
- Frontend build: vẫn thất bại với đúng 14 TS6133 baseline ghi bên dưới; không sửa các file ngoài phạm vi đó.
- Bộ test provider parity cũ: lần chạy working tree 28 passed/11 failed. Chạy lại code HEAD bằng loader test (không checkout/reset/stash) cũng 28 passed/11 failed; các khác biệt baseline gồm overview API/UI, selector cũ và CRLF của style tham chiếu. Không chỉnh test/reference để ép PASS. Các lần dùng --no-cache còn gặp lỗi resolve module tham chiếu của bộ test; không tính là kết quả PASS.
- Python: 9 unittest thành công với Gemini giả lập và kiểm tra dữ liệu thật qua Pydantic. Đã gọi trực tiếp endpoint AI localhost bằng ảnh bảng size do người dùng gửi với `gemini-3.1-flash-lite`: đọc được 6 dòng XS–XXL, size M có ngực 84–88 và eo 66–70. Đây là kiểm tra AI service, chưa phải HTTP end-to-end qua phiên provider. Key giữ ở .env được Git ignore và không in ra.
- Chưa chạy ghi/đọc MongoDB hoặc upload Cloudinary thật, chưa chạy full booking với database. Không có migration/backfill production, commit hay push trong đợt này. File local ngoài phạm vi được giữ nguyên.

Các lệnh kiểm chứng:

```text
backend: npm run build
backend: npm test -- --runInBand modules/products modules/users
frontend: vitest run tests/size-chart.test.tsx tests/size-chart-wizard.test.ts tests/onboarding-size-info.test.tsx tests/size-recommendation.test.tsx
frontend: node tests/size-recommendation-browser.mjs (VIB92_SCREENSHOT_DIR trỏ thư mục artifact)
ai-service: python -m unittest test_size_chart -v
ai-service: python smoke_size_chart.py test-fixtures/size-chart.png (tùy chọn, gọi Gemini thật)
```

## Bổ sung giai đoạn 4–5: provider UI và đọc ảnh

- Provider mở form tạo/sửa áo dài để quản lý bảng size ngay tại bước 2, sau phần chọn kích cỡ. Sản phẩm mới chọn biến thể rồi bấm "Lưu biến thể để nhập bảng size"; hệ thống tạo draft ẩn, khóa biến thể đã lưu và hiện editor dựa trên đúng các size đã lưu. Phải xác nhận bảng size trước khi sang bước 3. Provider chọn nguồn nhập tay/ảnh, loại bảng BODY/GARMENT, đơn vị; các số đo cơ thể cần khoảng hai đầu khác nhau như `86..89`; riêng dài áo có thể là một giá trị chính xác. Số đo vòng là cả vòng, không phải ngang áo.
- Khi bảng có thay đổi chưa lưu/đang xử lý, nút hoàn tất sản phẩm tạm khóa. Bảng lưu lại luôn là DRAFT. Provider phải bấm nút xác nhận riêng sau khi kiểm tra; gửi duyệt sản phẩm mới kiểm tra bảng đã CONFIRMED. Legacy được sửa sản phẩm mà không bị ép thêm bảng, nhưng nháp không được dùng tư vấn.
- API owner GET bổ sung `sizes` để editor lấy size persisted, không dùng biến thể chưa lưu trong form.
- `POST /products/:id/size-chart/image` (JWT + owner, 5 yêu cầu/phút): multipart field `image` (JPG/PNG/WebP, tối đa 8 MB), `expectedVersion`, `measurementType`, `lengthUnit`, `weightUnit`. Không nhận URL để server tùy ý tải ảnh. Gửi bytes của chính ảnh đã upload vào AI service.
- Backend kiểm tra quyền/version trước khi upload, upload qua PublicMediaService hiện có, gọi AI service rồi kiểm tra DTO/range; chỉ sau khi có dữ liệu hợp lệ mới ghi một DRAFT mới với expectedVersion. Khi ảnh có nhiều size hơn các biến thể của sản phẩm, chỉ giữ những dòng khớp size đã lưu và cảnh báo các dòng bị bỏ qua. Bản nháp tự chọn các vòng đo có đủ dữ liệu ở mọi size sản phẩm; nếu không có vòng nào đủ, chỉ chọn chiều cao cùng cân nặng khi cả hai đều đủ ở mọi size. Provider có thể sửa lựa chọn này trước khi lưu và xác nhận, AI không tự xác nhận. Race với edit/replace khác trả 409, không ghi đè kết quả mới.
- AI lỗi/timeout/trả dữ liệu sai: bảng cũ và version được giữ nguyên; response có `extractionFailed:true` và warnings để provider nhập tay/thử lại. Ảnh vừa upload nhưng chưa dùng được được dọn qua PublicMediaService. Không xác nhận tự động trong bất kỳ nhánh xử lý nào.
- AI service thêm `/size-charts/extract`. Dùng `GEMINI_API_KEY` đã có; tùy chọn `SIZE_CHART_GEMINI_MODEL` để chọn đúng một model. Mặc định dùng `gemini-3.1-flash-lite` cho OCR; SDK chỉ thử lại một lần nếu Gemini trả 503/504, không thử lại lỗi hạn mức 429 và không tự chuyển model. Việc này chỉ đổi model của OCR bảng size, không đổi chatbot. Backend dùng `AI_SERVICE_URL` hiện có. Không đưa key lên frontend. Model đọc ảnh theo schema Gemini hỗ trợ; Pydantic và backend tiếp tục kiểm tra kết quả.
- Không suy đơn vị: thiếu đơn vị thì xóa các số liệu tương ứng khỏi kết quả trích xuất và cảnh báo provider. Không nhân đôi chiều ngang thành vòng, không suy độ cử động/co giãn. measurementType provider đã chọn được giữ; AI đọc khác thì cảnh báo để provider kiểm tra.
- Lời gọi Gemini chỉ xảy ra ở upload/đọc ảnh của provider. API khách hàng không gọi Gemini. AI service phải được giữ trong mạng nội bộ như kiến trúc hiện tại; endpoint nội bộ không thay cho kiểm tra quyền/rate-limit ở backend.
- Timeout backend->AI: 90 giây, mỗi lượt SDK Gemini: 40 giây, request frontend upload: 105 giây. Các request frontend khác giữ timeout hiện có.

Tham khảo hợp đồng structured output của SDK: [Google Gemini structured outputs](https://ai.google.dev/gemini-api/docs/generate-content/structured-output?hl=en).

## Phạm vi và trạng thái

Phần dưới ghi lại hợp đồng schema/API được xây ở giai đoạn 2–3. Provider UI, Gemini extraction và engine đã được nối ở các giai đoạn phía trên; các giới hạn kiểm chứng được báo riêng, không coi test giả lập là kiểm chứng với hệ thống thật.

Ảnh dùng PublicMediaService/Cloudinary hiện có. MongoDB lưu URL HTTPS, không lưu ảnh base64. Luồng upload bảng size chuyên biệt gửi file bytes sang Gemini; kết quả chỉ được ghi khi phiên bản còn khớp. Không cho client ghi status/confirmedBy/confirmedAt/version/policy marker qua DTO sản phẩm.

## Dữ liệu

- `products.sizes` và kho/booking không đổi.
- `products.sizeChartPolicyVersion`: server gán `1` trong createProduct, immutable, không có default. Document cũ không có marker là legacy, không backfill marker này. Chỉ triển khai writer mới sau khi dừng writer cũ để không tạo document thiếu marker trong thời gian rollout.
- `products.sizeChartVersion`: bộ đếm atomic mặc định 0. Document cũ thiếu field được xử lý như 0. Mỗi save hoặc confirm tăng 1.
- `products.sizeChart`: null hoặc object chứa source MANUAL/IMAGE, measurementType BODY/GARMENT, lengthUnit CM/IN, weightUnit KG/LB, imageUrl, rows, requiredMeasurements, fitRules, stretchAllowanceCm, version, sourceRevision, status DRAFT/CONFIRMED, confirmedBy, confirmedAt.
- Mỗi row có size (trim/uppercase), các range `{min,max}`: chest, waist, hip, height, weight, length. Ngực/eo/mông/chiều cao/cân nặng yêu cầu `min < max`; một số in riêng lẻ bị bỏ qua. Riêng dài áo có thể có `min = max` để biểu diễn đúng một giá trị in trên ảnh, không tự chế khoảng mới. Endpoint nhận range đầy đủ, không nhận min/max thiếu hoặc âm/NaN. Giới hạn kỹ thuật 0 < giá trị <= 1000 theo đơn vị khai báo; đây không phải bảng size chuẩn hay suy luận nhân trắc.
- height/weight luôn là khoảng chiều cao/cân nặng người mặc phù hợp, kể cả khi measurementType=GARMENT. length là chiều dài thực tế áo, không phải chiều cao người mặc. chest/waist/hip tuân theo measurementType.
- requiredMeasurements: subset chest/waist/hip/height/weight; phải có vòng cơ thể hoặc cả height và weight trước khi confirm. Tất cả size sản phẩm phải có một row, không trùng hoặc thêm size ngoài sản phẩm. Mỗi row có đủ trường required.
- Fit rule theo SLIM/REGULAR/COMFORT: range độ cử động trên từng vòng, luôn tính bằng cm kể cả bảng dùng inch. `stretchAllowanceCm`: số cm cho phép giãn thêm từng vòng, không phải phần trăm. Không có mặc định về độ cử động/co giãn; thiếu declaration thì không được dùng negative ease. BODY không nhận garment fit rules. GARMENT phải có vòng và fitRules đủ cho các vòng đã khai báo; preference không có rule phải trả thiếu dữ liệu ở engine sau này.
- `users.preferences.sizeInfo`: thêm chest/waist/hip (cm, 1..300) và fitPreference (SLIM/REGULAR/COMFORT). Optional/null để người cũ không phải khai báo lại; null xóa giá trị cũ. Chiều cao/cân nặng vẫn theo hợp đồng cm/kg hiện có.

Không cần chạy migration ghi dữ liệu production ở giai đoạn này: Mongoose đọc document cũ bình thường. Dữ liệu cũ giữ nguyên, không gán bảng số đo chung. Nếu cần backfill trong tương lai phải có dry run và không được gán marker mới cho sản phẩm cũ.

## API (cũng hỗ trợ tiền tố /api)

1. `GET /products/my-listings/:id/size-chart`: JWT + chủ sở hữu. Trả `{version,sizeChart}` kể cả draft/null.
2. `PATCH /products/:id/size-chart`: JWT + chủ sở hữu. Body là toàn bộ nội dung nháp và expectedVersion. Luôn DRAFT, xóa xác nhận trước. Không phải merge từng ô. Khi thay nguồn ảnh thì rows cũ bị xóa; sau đó lưu bảng vừa đọc/sửa bằng version mới. sourceRevision tăng khi đổi URL/source. Thay nội dung tại cùng URL không được hỗ trợ; upload ảnh mới lấy URL mới. Response của các thao tác lưu/đọc ảnh/xác nhận trả lại danh sách `sizes` hiện lưu trên sản phẩm để editor hiển thị đúng các dòng OCR ngay cả khi danh sách size phía client đã cũ.
3. `POST /products/:id/size-chart/confirm`: JWT + chủ sở hữu. Body chỉ `{expectedVersion}`. Xác nhận nội dung đang lưu sau khi kiểm tra đầy đủ. Tăng version và ghi người/thời điểm xác nhận.
4. `GET /products/:id/size-chart`: chỉ sản phẩm public theo repository hiện có. Trả READY cùng bảng đã xác nhận còn khớp size, hoặc UNAVAILABLE/NO_CONFIRMED_SIZE_CHART với sizeChart=null. Không trả draft làm đầu vào tư vấn.

Version không khớp hoặc bị ghi đồng thời trả 409; không sở hữu trả 403; id sai/không tồn tại trả 404; dữ liệu sai trả 400. DTO global whitelist/forbidNonWhitelisted từ chối status và field hệ thống do client gửi.

Ví dụ body PATCH (thay M bằng toàn bộ size sản phẩm):

```json
{
  "expectedVersion": 0,
  "source": "MANUAL",
  "measurementType": "BODY",
  "lengthUnit": "CM",
  "weightUnit": "KG",
  "rows": [{"size":"M","chest":{"min":86,"max":89},"waist":{"min":68,"max":71}}],
  "requiredMeasurements": ["chest","waist"]
}
```

Tạo sản phẩm vẫn được lưu ở pending review để lấy id và nhập bảng. Admin không duyệt đăng bán sản phẩm có marker 1 khi thiếu bảng đã xác nhận đầy đủ. Kiểm tra lúc ghi duyệt kèm version và danh sách sizes để ngăn race với sửa bảng/size. Legacy không bị chặn vì thiếu bảng. Sửa bảng trên sản phẩm đang public không gỡ sản phẩm, nhưng API tư vấn lập tức UNAVAILABLE cho đến khi xác nhận lại. Thay danh sách size khiến bảng không còn khớp cũng trả UNAVAILABLE và không duyệt được cho sản phẩm mới.

## Quy tắc engine hiện tại

Các trường `shoulder` (ngang vai, cm hoặc inch) và `bicep` (vòng bắp tay, cm hoặc inch) là tùy chọn trong từng row bảng size và trong `users.preferences.sizeInfo`. Đây là bổ sung vào embedded schema MongoDB, không cần migration dữ liệu cũ. Ảnh OCR có thể trích xuất hai trường này vào bản nháp, nhưng provider vẫn phải đối chiếu và xác nhận. Bảng `GARMENT` có khai báo vai/bắp tay phải có quy tắc độ cử động tương ứng cho từng kiểu mặc; không suy ra quy tắc từ tên chất liệu. `products.sizes`, kho và đặt thuê không đổi.

Phản hồi độ vừa sau thuê là bước đo chất lượng ở giai đoạn sau. Trước khi ghi nhận, đơn thuê cần lưu snapshot size thực tế và phiên bản bảng size tại thời điểm đặt; chỉ khách của đơn đã hoàn tất mới được gửi, và không lưu lại số đo thô trong phản hồi. Luồng review/booking hiện tại chưa có đủ snapshot này, nên không gắn phản hồi vào review bằng phiên bản bảng hiện tại vì sẽ quy nhầm kết quả cho bảng đã bị sửa.

1. Chỉ nhận bảng CONFIRMED còn khớp sản phẩm. Chuẩn hóa inch->cm (2.54), lb->kg (0.45359237). Không suy số đo cơ thể từ chiều cao/cân nặng, nhãn size, giới tính hay dáng người.
2. BODY: các số đo ngực/eo/mông, ngang vai và vòng bắp tay được so với khoảng của từng size khi được chọn là bắt buộc hoặc khi khách chủ động nhập. Biên min/max tính bao gồm. Khi đã có ít nhất một số đo này, chiều cao/cân nặng được đối chiếu như thông tin tham khảo: lệch hai chỉ số này không phủ định một size khớp số đo chi tiết, nhưng được nêu rõ trong cảnh báo. Khi chưa có số đo chi tiết, chiều cao và cân nặng đều phải nằm trong khoảng khai báo mới có gợi ý sơ bộ. Các số đo rơi vào size khác nhau không bỏ phiếu; size vượt một giới hạn bắt buộc hoặc số đo phụ khách đã cung cấp bị loại.
3. Thiếu trường required hoặc thiếu constraint cần thiết thì trả thiếu dữ liệu. Ngoại lệ gợi ý sơ bộ từ height+weight chỉ khi row có cả hai và user có cả hai; ghi rõ chưa xác minh độ vừa theo ba vòng, không tự áp dụng size.
4. GARMENT: cần số đo cơ thể và quy tắc độ cử động đúng sở thích mặc do provider khai báo. Độ cử động = số đo áo - số đo cơ thể; ngang vai dùng chiều ngang, bắp tay dùng cả vòng. Với khoảng số đo áo, chỉ bảo đảm phù hợp khi toàn bộ khoảng độ cử động nằm trong khoảng cho phép của provider. Nếu chỉ giao một phần, evaluation ghi `PARTIAL_OVERLAP` và vẫn loại size; không giao ghi `NO_FIT`. Negative ease chỉ hợp lệ trong stretchAllowanceCm được khai báo; không tự cộng độ giãn theo vật liệu. Chiều dài áo không được so sánh trực tiếp với chiều cao cơ thể.
5. BODY không dùng fitPreference để tự dịch size vì không có quy tắc provider tương ứng; giải thích bảng không mô hình hóa sở thích. GARMENT thiếu preference/rule phù hợp thì yêu cầu bổ sung, không mặc định REGULAR.
6. Một size đạt: gợi ý kèm từng constraint và giới hạn dữ liệu. Nhiều size đạt: trả tất cả ứng viên, không tự chọn theo thứ tự chữ S/M/L; để user chọn. Nếu số đo đã biết loại tất cả size thì trả NO_MATCH ngay cả khi khách còn thiếu số đo khác. `closestSizes` chỉ gồm các row đã kiểm tra đủ dữ liệu, tối đa hai size, xếp theo số điều kiện không khớp rồi tổng độ lệch chuẩn hóa; chỉ dùng để đối chiếu, không cho áp dụng. Thiếu dữ liệu ở size còn khả năng đạt: INSUFFICIENT_DATA với `missingMeasurements`. Điểm tin cậy dạng % chưa được hiệu chuẩn nên không tự sinh.
7. Tồn kho/lịch thuê tách biệt với độ vừa. Không thay size vừa bằng size còn hàng nhưng không vừa.

## Baseline frontend trước triển khai

Build nền trước thay đổi thất bại với 14 TS6133 (biến/import không dùng):

- DisputesPanel.tsx:308 toggleSelectRow; :317 toggleSelectAll; :700 isChecked.
- ReportedReviewsPanel.tsx:17 MoreVertical; :18 Check; :252 toggleSelectRow; :261 toggleSelectAll.
- ProfileRentalDetailPage.tsx:28 loadingIncident.
- ProfilePaymentsTab.tsx:469 displayCode.
- ProductModerationPanel.tsx:13 MoreHorizontal; :16 Eye; :165 activeActionMenuId; :445 handleToggleSelectAll; :453 handleToggleSelectRow.

Không lỗi nào liên quan trực tiếp đến backend VIB-92; giai đoạn này không sửa các file đó.

## Kết quả kiểm chứng giai đoạn 2–3

- `npm run build` tại backend: exit code 0.
- `npm test -- --runInBand modules/products modules/users`: 11 suites passed, 91 tests passed.
- `git diff --check`: exit code 0.
- Test gồm validation qua ValidationPipe thật, schema Mongoose hydrate/serialization không kết nối DB, service/repository với model mock. Có kiểm tra quyền sở hữu, ghi/xác nhận đồng thời, thay ảnh, mất xác nhận khi sửa, chặn field hệ thống và điều kiện duyệt sản phẩm mới/giữ sản phẩm cũ.
- Chưa chạy HTTP end-to-end với server, chưa ghi/đọc MongoDB thật và chưa gọi Cloudinary/Gemini. Frontend không đổi, không chạy lại build frontend ở giai đoạn này; 14 lỗi phía trên là kết quả baseline trước triển khai.
