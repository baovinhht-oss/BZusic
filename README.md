# BZusic

**BZusic** là trình phát nhạc cá nhân không quảng cáo với giao diện hiện đại lấy cảm hứng từ Apple Music / YouTube Music, được tối ưu cho cả máy tính (trạm quản lý & nạp nhạc Local) và Safari trên iPhone / PWA (nghe nhạc liên tục qua Cloud).

---

## Kiến trúc hai chế độ hoạt động

BZusic tách biệt việc nạp/quản lý dữ liệu với việc nghe nhạc mọi lúc mọi nơi:

1. **Local Mode (Trạm nạp nhạc trên Laptop):**
   - Chạy bằng **Node.js + Express**, kết hợp `youtubei.js`, `yt-dlp`, Deno và LRCLIB API.
   - Cho phép tìm kiếm bài hát/video hoặc dán link YouTube, import danh sách phát (`.json`, `.csv` hoặc dán danh sách tên bài - nghệ sĩ), tạo/chỉnh sửa playlist, đổi ảnh bìa và quản lý thư viện trong `data/library.json` (`liked`, `playlists`, `history`).
2. **Cloud Mode (Nghe nhạc qua GitHub Pages + Supabase Storage):**
   - Lệnh `npm run sync` (`sync-cloud.js`) sẽ tải file âm thanh `.m4a` và lời bài hát `.lrc` cho các bài hát chưa có trên cloud, đẩy lên **Supabase Storage** (bucket `Music`), xuất bản `library.json` bản Cloud kèm `audioUrl` / `lyricsUrl`, tạo `public/cloud-config.js` và đồng bộ giao diện tĩnh sang thư mục `docs/`.
   - Khi truy cập bản web tĩnh trên **GitHub Pages** (`https://baovinhht-oss.github.io/BZusic/`), ứng dụng tự động kích hoạt `Cloud Ad-Free Mode`: phát nhạc và tải lời trực tiếp từ Supabase Storage, lọc nhanh trong thư viện Cloud và ẩn các nút chỉnh sửa dành riêng cho máy Local.

---

## Tính năng nổi bật

- **Giao diện tối giản, trực quan:** Bố cục Sidebar, khu vực nội dung chính, màn hình **Now Playing** toàn màn hình với hiệu ứng ánh sáng nền (ambient glow), danh sách **Up Next** và lời bài hát đồng bộ theo thời gian (hỗ trợ cả LRC thường và Enhanced LRC theo từng từ).
- **Quản lý thư viện & Playlist:** Lưu bài hát yêu thích (*Favorites*), lịch sử nghe (*Listening History*), tạo/sửa/xóa playlist, ảnh bìa ghép lưới 2x2 tự động hoặc ảnh tùy chỉnh, tìm/lọc và sắp xếp bài hát trong playlist.
- **Tối ưu Safari iPhone & PWA:** Hỗ trợ `manifest.json`, điều khiển phát nhạc trên thiết bị di động và tích hợp Media Session API cho khóa màn hình.
- **Đồng bộ thông minh, chống tải trùng:** `sync-cloud.js` quét sẵn các file đã tồn tại trên Supabase Storage để bỏ qua bài cũ, chỉ xử lý bài mới và dọn dẹp file tạm sau khi tải lên.

---

## Cấu trúc thư mục chính

- `server.js` — Máy chủ Express phục vụ giao diện Local, tìm kiếm, stream audio, lấy lời bài hát và API quản lý `data/library.json`.
- `sync-cloud.js` — Script đồng bộ audio (`.m4a`), lyrics (`.lrc`), `library.json` lên Supabase Storage và xuất giao diện sang `docs/`.
- `data/library.json` — Dữ liệu thư viện Local (`liked`, `playlists`, `history`).
- `public/` — Mã nguồn giao diện (`index.html`, `style.css`, `app.js`, `cloud-config.js`, `manifest.json`, `favicon.svg`).
- `docs/` — Bản xuất giao diện tĩnh sẵn sàng dùng cho GitHub Pages.

---

## Hướng dẫn sử dụng nhanh

### 1. Chạy ở chế độ Local (Laptop)

Cài đặt thư viện phụ thuộc:

```bash
npm install
```

Khởi chạy máy chủ Local:

```bash
npm start
```

Mở trình duyệt tại `http://localhost:3000` để tìm nhạc, quản lý playlist và cập nhật thư viện.

### 2. Đồng bộ lên Supabase Storage & xuất `docs/`

Tạo file `.env` (tham khảo `.env.example`) với các biến cấu hình Supabase:

```env
SUPABASE_URL=https://kylypezlzcurjvsquxxa.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_or_secret_key
SUPABASE_BUCKET=Music
```

Chạy đồng bộ dữ liệu và xuất thư mục `docs/`:

```bash
npm run sync
```

### 3. Xuất bản giao diện qua GitHub Pages

1. Đẩy code và thư mục `docs/` lên repository GitHub (`baovinhht-oss/BZusic`).
2. Vào **Settings → Pages** của repository, chọn nhánh **`main`** và thư mục **`/docs`**, sau đó lưu lại.
3. Mở địa chỉ `https://baovinhht-oss.github.io/BZusic/` trên Safari iPhone và chọn **Thêm vào Màn hình chính** để sử dụng như một ứng dụng web độc lập.

---

## Lưu ý bảo mật

- Không chia sẻ hoặc đẩy file `.env`, `cookies.txt` hay các tệp tạm lên kho mã nguồn công khai. Đảm bảo `.gitignore` đã loại trừ các tệp nhạy cảm và thư mục tạm.