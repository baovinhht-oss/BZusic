# 🎵 BZusic - Trình Phát Nhạc Cá Nhân Local (Phong cách YouTube Music)

**BZusic** là một Web App nghe nhạc cá nhân chạy hoàn toàn trên máy cục bộ (Local), lấy cảm hứng từ giao diện hiện đại của **YouTube Music**, **hoàn toàn không có quảng cáo** (Ad-free), phát nhạc mượt mà và tối ưu hóa cao cho trình duyệt máy tính và điện thoại cùng mạng Wi-Fi.

---

## ✨ Điểm Nổi Bật

1. **Branding BZusic & Giao Diện Tinh Tế**:
   - Dark Mode sâu chuẩn AMOLED (`#030303`), bề mặt card `#121212`.
   - Hiệu ứng **Ambient Glow** làm mờ động theo màu sắc ảnh bìa bài hát đang phát.
   - **Dynamic Tab Title**: Tự động đổi tiêu đề tab thành `▶ [Tên bài hát] - [Ca sĩ] | BZusic` khi đang phát, và trở về `BZusic` khi tạm dừng.
   - Logo SVG tối giản, kèm Favicon SVG sắc nét.

2. **Dữ liệu YouTube Music Chuẩn Xác**:
   - Tích hợp `youtubei.js` (Innertube) để tìm kiếm bài hát, trích xuất metadata và danh sách gợi ý phát tiếp theo (**Up Next / Radio**).

3. **Luồng Âm Thanh Không Quảng Cáo (Ad-Free Streaming)**:
   - Tự động phát hiện và sử dụng binary `yt-dlp` cài sẵn trên máy để trích xuất link audio chất lượng cao nhất (`bestaudio[ext=m4a]/bestaudio`).
   - Tích hợp **RAM Cache** với TTL 30 phút theo `videoId` giúp phát lại và tua bài tức thì.
   - Hỗ trợ đầy đủ **HTTP Range headers** (`206 Partial Content`) để tua nhạc không độ trễ.

4. **Lời Bài Hát Đồng Bộ (Synced Lyrics)**:
   - Tích hợp API của **LRCLIB** (`syncedLyrics` và `plainLyrics`).
   - Tự động cuộn theo thời gian thực và highlight dòng đang hát.
   - Bấm vào bất kỳ dòng lời bài hát nào để tua trực tiếp đến đoạn đó.

5. **Lưu Trữ Cá Nhân Bền Vững**:
   - Quản lý Bài hát yêu thích (Liked Songs), tạo/xóa Playlist cá nhân và lưu Lịch sử nghe nhạc (History) vào `data/library.json`.

6. **Trải Nghiệm Web App Đỉnh Cao**:
   - **Media Session API**: Hỗ trợ phím Media trên bàn phím, tai nghe Bluetooth và widget phát nhạc của Windows/macOS.
   - **Phím tắt bàn phím tiện dụng**:
     - `Space`: Phát / Tạm dừng
     - `←` / `→`: Tua lùi / tiến 5 giây
     - `↑` / `↓`: Tăng / Giảm 10% âm lượng
     - `M`: Bật / Tắt tiếng (Mute/Unmute)
     - `L`: Yêu thích / Bỏ yêu thích bài hiện tại
     - `J` / `K`: Bài trước / Bài tiếp theo
     - `S`: Bật / Tắt phát ngẫu nhiên (Shuffle)
     - `R`: Lặp lại (Tắt / Lặp tất cả / Lặp 1 bài)
     - `Esc`: Đóng giao diện Đang phát hoặc Modal
     - *(Tự động bỏ qua phím tắt khi con trỏ đang nhập trong ô tìm kiếm)*

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### 1. Cài đặt các thư viện cần thiết
Mở terminal tại thư mục dự án `d:\BZmusic` và chạy:
```bash
npm install
```

### 2. Khởi động Web App
```bash
npm start
```
*(hoặc `node server.js`)*

### 3. Thưởng thức âm nhạc
Mở trình duyệt web và truy cập vào:
```
http://localhost:3000
```

> **Mẹo hữu ích về Cookies:** Nếu bạn muốn phát các bài hát có yêu cầu đăng nhập từ YouTube, bạn chỉ cần xuất file `cookies.txt` từ trình duyệt của mình (dùng extension như *Get cookies.txt LOCALLY*) và đặt vào thư mục `d:\BZmusic\cookies.txt` hoặc `data/cookies.txt`. Server BZusic sẽ tự động nhận diện và sử dụng!
