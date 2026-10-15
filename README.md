# N3 Study Studio

Ứng dụng luyện JLPT N3 gồm giao diện HTML/CSS/JavaScript, backend FastAPI và MySQL. Mỗi tài khoản có dữ liệu từ vựng, tiến độ ôn tập, ghi chú nghe và lịch sử quiz riêng. Đăng nhập bằng tài khoản/mật khẩu hoặc Google OAuth.

## Cấu trúc dự án

```text
backend/
  app/
    api/routes/       HTTP routes, health checks và dependencies xác thực
    core/             Settings và bảo mật mật khẩu
    db/               SQLAlchemy base và session
    models/           Mỗi entity một module: User, StudyData
    repositories/     Truy vấn persistence
    schemas/           Pydantic request/response models
    services/          Nghiệp vụ tài khoản và dữ liệu học
    main.py            FastAPI app factory và middleware
  migrations/          Alembic migrations
  tests/               API integration tests (SQLite)
  pyproject.toml        Python dependencies/tooling
dist/                    Giao diện tĩnh và seed từ vựng
```

Các API tiếp tục dùng `/api/auth/*` và `/api/study-data`, nên bootstrap phía trình duyệt đồng bộ với backend mà không đổi luồng học hiện có.

## Chạy local trên Windows

Yêu cầu Python 3.12+, MySQL 8.0+ và Redis (Redis chỉ cần nếu chạy production hoặc nhiều worker).

1. Tạo database MySQL và user riêng, chỉ cấp quyền cần thiết trên database đó. Ví dụ chạy bằng tài khoản quản trị:

   ```sql
   CREATE DATABASE n3_study_studio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'n3studio'@'localhost' IDENTIFIED BY 'replace-with-a-strong-password';
   GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
     ON n3_study_studio.* TO 'n3studio'@'localhost';
   ```

2. Sao chép `.env.example` thành `.env`, điền mật khẩu MySQL, rồi tạo `SESSION_SECRET` ngẫu nhiên dài tối thiểu 32 ký tự. Giữ `.env` ngoài Git.
3. Mở PowerShell tại thư mục dự án và chạy:

   ```powershell
   py -3.12 -m venv .venv
   .\.venv\Scripts\Activate.ps1
   python -m pip install --upgrade pip
   Set-Location backend
   python -m pip install -e ".[dev]"
   alembic upgrade head
   Set-Location ..
   uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
   ```

   Mở `http://localhost:8000`. Alembic là nơi duy nhất tạo/cập nhật schema khi deploy; ứng dụng không tự sửa database lúc khởi động.

## Đăng nhập Google

Tạo OAuth 2.0 Client ID loại Web trong Google Cloud Console. Thêm Authorized JavaScript origin của website và đặt Authorized redirect URI chính xác bằng `GOOGLE_REDIRECT_URI` (local: `http://localhost:8000/api/auth/google/callback`; production bắt buộc HTTPS). Điền `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` cùng lúc. Khi bỏ trống cả ba, Google login ẩn đi, còn tài khoản/mật khẩu vẫn dùng được.

Tài khoản Google được định danh bằng subject do Google xác minh, không tự liên kết theo email với tài khoản mật khẩu có sẵn. Mỗi tài khoản mới được khởi tạo từ `dist/seed.json`.

## Tạo câu hỏi flashcard bằng AI

Thêm `GEMINI_API_KEY` vào `.env` khi chạy local hoặc Render Environment để bật nút **Tạo câu hỏi bằng Gemini**. Tạo key trong Google AI Studio; giữ key ở backend, không đưa vào JavaScript trình duyệt. Có thể đổi model qua `GEMINI_MODEL` (mặc định `gemini-3.8-flash`). Khi tạo câu hỏi, nội dung từ, nghĩa, cách đọc, phân môn và ví dụ của flashcard được gửi đến Gemini. Câu hỏi sinh ra được lưu cùng flashcard trong dữ liệu tài khoản. Trên Render, thêm `GEMINI_API_KEY` trong **Environment** rồi deploy lại; không đưa key vào Git.

## Kiểm tra

Tại thư mục dự án:

```powershell
Set-Location backend
python -m pytest
ruff check app migrations tests
alembic upgrade head
```

Test API dùng SQLite tạm để kiểm tra đăng ký, đăng nhập, xác thực, phân tách dữ liệu từng user, kiểm tra payload và CSRF. Trước khi phát hành vẫn phải chạy migration và smoke test trên MySQL của môi trường deploy; workspace này không chứa credentials để kết nối MySQL.

## Triển khai

- Dự án đã có Render Blueprint tại `render.yaml`: cài Python package, chạy Alembic migration trước khi start FastAPI, và kiểm tra readiness qua MySQL.
- Đưa source lên GitHub/GitLab, vào Render tạo **New → Blueprint**, chọn repository và xác nhận `render.yaml`. Tạo Blueprint yêu cầu tài khoản Render và repository Git; không deploy trực tiếp được từ thư mục local chưa có Git remote.
- Trong bước khai báo biến môi trường của Render, cung cấp `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` từ một dịch vụ MySQL có kết nối mạng từ Render. `127.0.0.1` là máy Render chứ không phải MySQL chạy trên máy Windows của bạn. Không dùng `root` hoặc mở MySQL cục bộ ra Internet; tạo DB user giới hạn quyền trên database ứng dụng.
- Blueprint đặt port TiDB Cloud là `4000` và bật TLS. Production tự bật TLS ngay cả khi thiếu `MYSQL_SSL`; cấu hình `MYSQL_SSL=false` trong production sẽ bị từ chối để tránh kết nối không mã hóa. Với TiDB Cloud Serverless, dùng trust store hệ thống để xác minh chứng chỉ nên không cần Render Secret File riêng. Chỉ đặt `MYSQL_SSL_CA` khi nhà cung cấp database yêu cầu CA riêng. Khi chạy local, TLS tắt mặc định; bật bằng `MYSQL_SSL=true` nếu cần kiểm tra kết nối cloud.
- Blueprint chạy một Uvicorn worker và dùng bộ đếm rate-limit trong bộ nhớ của tiến trình. Không tăng số worker/instance nếu chưa cấu hình Redis/Valkey chia sẻ qua `RATE_LIMIT_STORAGE_URI`; bộ đếm memory được reset khi service khởi động lại.
- Blueprint tạo web service free; Free web service có thể sleep khi không dùng. MySQL bên ngoài có thể tính phí theo nhà cung cấp; kiểm tra giá trước khi xác nhận.
- Lệnh ứng dụng: `n3-study-studio` (dùng `APP_HOST`/`APP_PORT`, hoặc `PORT` nếu hosting cung cấp).
- Health checks: liveness `GET /api/health/live`; readiness (kiểm tra MySQL) `GET /api/health/ready`.
- Giữ thư mục `dist/` trong thư mục dự án khi cài/chạy; đặt `FRONTEND_DIRECTORY` thành đường dẫn tuyệt đối nếu layout deploy khác.
- Đặt `APP_ENV=production`, `TRUSTED_HOSTS` là JSON array chứa domain thật. Blueprint dùng `memory://` với một Uvicorn worker; nếu tăng số worker/instance, chuyển `RATE_LIMIT_STORAGE_URI` sang Redis/Valkey dùng chung để bộ đếm không bị tách riêng. Wildcard tổng quát không được chấp nhận; Blueprint cho phép `*.onrender.com`, thêm domain riêng vào `TRUSTED_HOSTS` nếu dùng custom domain.
- Bật HTTPS tại reverse proxy/load balancer. Đặt `FORWARDED_ALLOW_IPS` thành IP/CIDR của proxy tin cậy theo cấu hình Uvicorn; không dùng `*` tùy tiện.
- Giới hạn inbound MySQL theo network của ứng dụng. Sao lưu database định kỳ và thử khôi phục backup.

## Học ngữ pháp

Chọn **Ngữ pháp** ở thanh điều hướng để xem các mẫu đã nhập, học flashcard hoặc mở quiz theo ví dụ. Trong **Nhập bài học**, nhập file XLSX/CSV/TSV với các cột cơ bản `bai`, `loai`, `tieng_nhat`, `nghia`, `vi_du`, `dich_vi_du`; có thể thêm `cong_thuc`/`structure`, `cach_dung`/`usage`, `ngu_canh`/`context`, `luu_y_jlpt`/`jlpt_note`, `ghi_chu_vo`/`study_note`. Đặt `loai` là `Ngữ pháp`. Mỗi hàng là một mẫu ngữ pháp; `tieng_nhat` là mẫu, `nghia` là ý nghĩa/cách giải thích, còn cột tùy chọn cung cấp ghi chú để học và chép vào vở. Nội dung và ghi chú được đồng bộ cùng dữ liệu tài khoản như các mục học khác.

Trong **Kho bài học**, tạo bài theo chủ đề, có tên, ngày tạo tự động và mô tả tùy chọn. Các bài hiển thị thành lưới ngang nhiều cột, tự xuống dòng theo kích thước màn hình. Mở bài để thêm flashcard bằng biểu mẫu hoặc nhập file XLSX/CSV/TSV. Khi tạo thẻ, chỉ cần nhập **từ tiếng Nhật hoặc nghĩa/giải thích**; có thể nhập cả hai. File nhập cũng chấp nhận mỗi dòng có một trong hai nội dung này, và bỏ qua dòng không có cả hai. Thẻ và thông tin bài cùng được đồng bộ theo tài khoản. **Flashcard** và **Bộ flashcard** dùng chung những thẻ trong kho, nên thẻ được tạo tại bài học cũng xuất hiện trong bộ flashcard tương ứng. Dùng nút **Xóa bài / Xóa bộ** để xóa nhóm cùng flashcard bên trong; ứng dụng hỏi xác nhận và xóa tiến độ ôn của các thẻ bị xóa. Có thể xóa riêng flashcard trong nội dung bài. Thẻ đã có trước khi bật cấu trúc bài học sẽ tự được xếp thành bài theo phân môn/chủ đề và tên bài cũ, không bị xóa; thông tin ôn tập vẫn giữ nguyên. Trong **Bộ flashcard** có thể tạo bộ độc lập bằng cách đặt tên thư mục và tên bộ trước khi nhập file. Các cột `thu_muc`/`folder` và `bo_flashcard`/`deck` trong bảng tính là tùy chọn.

Trong **Ngữ pháp**, tạo từng mẫu theo bài/chủ đề, với các trường riêng: mẫu câu, ý nghĩa, công thức, cách dùng, ngữ cảnh, ví dụ/dịch ví dụ, lưu ý JLPT và ghi chép. Chỉ cần nhập mẫu câu hoặc ý nghĩa. Các mẫu hiển thị theo lưới, có thể sửa/xóa riêng; xóa mẫu cũng xóa tiến độ ôn của mẫu đó.

## Dữ liệu

Mật khẩu tài khoản dùng Argon2; cookie phiên được ký, `HttpOnly`, `SameSite=Lax`, và `Secure` trong production. API kiểm tra Origin, host, giới hạn request, rate-limit auth và xác thực dữ liệu bằng Pydantic. Dữ liệu học JSON được gắn với user qua khóa ngoại MySQL. Rate limit trong blueprint là bộ nhớ cục bộ cho một worker; dùng Redis/Valkey chia sẻ nếu scale nhiều worker/instance.

Trước đây tiến độ lưu trong localStorage **không tự chuyển** khi đăng nhập: trước khi chuyển, xuất JSON trong Nhập & sao lưu; sau khi đăng nhập, nhập lại file đó. Audio tải lên chỉ tồn tại trong phiên mở trang. XLSX cần trình duyệt hỗ trợ `DecompressionStream('deflate-raw')`; CSV/TSV là phương án thay thế.

Bộ từ gốc chưa có nhãn từng bài; chỉnh bài/phân môn trong Kho bài học hoặc nhập file Excel. Quiz là bài luyện tự tạo, không phải đề JLPT chính thức.
