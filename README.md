# Luồng Hoạt Động Phát Video HLS trên Front-End (HLS Video Playback Flow)

Tài liệu này mô tả chi tiết, rõ ràng luồng hoạt động tích hợp của tính năng **phát Video chuẩn HLS (HTTP Live Streaming)** trên Front-End của dự án hiện tại (kết hợp React, Redux Toolkit, thư viện `hls.js`, và CDN lưu trữ trên MinIO).

---

## 1. Tổng Quan Kiến Trúc HLS & MinIO CDN

Hệ thống sử dụng chuẩn stream video **HLS (HTTP Live Streaming)** để mang lại trải nghiệm xem video mượt mà, tối ưu băng thông cho học viên:
*   **Video CDN & MinIO Storage**: Video bài giảng được mã hóa (transcode) thành file manifest `.m3u8` và hàng loạt các phân đoạn video ngắn `.ts` (thường từ 2-6 giây mỗi segment). Toàn bộ dữ liệu này được lưu trữ và tối ưu hóa phân phối qua **MinIO Object Storage (chuẩn S3)**.
*   **HLS Client (Front-End)**: Sử dụng thư viện `hls.js` chạy trên nền React nhằm tải nhỏ giọt các file segment `.ts` dựa theo chất lượng đường truyền mạng của người dùng (Adaptive Bitrate Streaming) giúp chống giật lag.
---

## 2. Luồng Hoạt Động Chi Tiết (Step-by-Step Flow)

Dưới đây là luồng xử lý từ khi người dùng mở trang khóa học cho tới khi phát video, tương tác và hoàn thành bài học:

### Bước 1: Tải thông tin Khóa học & Video URLs từ Laravel API
Khi truy cập trang `CoursePlayerPage.jsx`, một API request dạng `GET` được gửi đến đầu cuối backend:
```http
GET http://localhost:8000/api/course-videos
```
*   **Dữ liệu phản hồi**: Trả về cấu trúc JSON gồm thông tin khóa học, thông tin giảng viên, danh sách các chương mục (`sections`), danh sách bài học (`lessons`).
*   **HLS Video URL**: Mỗi bài học có kiểu `'video'` sẽ chứa một thuộc tính `videoUrl` trỏ thẳng tới file manifest `.m3u8` lưu trữ trên CDN/MinIO (Ví dụ: `http://localhost:9000/course-bucket/lesson1/index.m3u8`).

### Bước 2: Thiết lập Trạng thái Toàn cục (Redux Store & Hook)
*   Hệ thống kiểm tra nếu chưa có bài học nào được chọn, ứng dụng sẽ tự động chọn bài học đầu tiên (`firstLessonId`) và thực hiện dispatch action lên Redux:
    ```javascript
    dispatch(setCurrentLessonId(firstLessonId))
    ```
*   Redux Slice `courseSlice.js` quản lý các trạng thái toàn cục bao gồm: `currentLessonId`, `isPlaying`, `playbackRate` và tiến trình `progress` (%).

### Bước 3: Render & Tách Biệt Player qua thuộc tính `key`
Trong `CoursePlayerPage.jsx`, component trình phát được gọi:
```jsx
<HlsVideoPlayer
  key={currentLessonId}
  videoUrl={videoUrl}
  hasNextLesson={hasNextLesson}
  shouldAutoplay={shouldAutoplay}
  onProgress={(pct) => dispatch(setProgress(pct))}
  onTimeUpdate={({ currentTimeSec }) => setCurrentTimeSec(currentTimeSec)}
  onPlayingChange={(v) => dispatch(setIsPlaying(v))}
  onPlaybackRateChange={(r) => dispatch(setPlaybackRate(r))}
  onPlayNextLesson={handlePlayNextLesson}
/>
```
> [!NOTE]
> Việc sử dụng `key={currentLessonId}` cực kỳ quan trọng. Nó bắt buộc React hủy bỏ (unmount) instance trình phát cũ và tạo mới (remount) hoàn toàn instance trình phát mới khi chuyển bài. Điều này giúp dọn dẹp bộ nhớ đệm cũ và reset các listener của HLS một cách sạch sẽ.

### Bước 4: Khởi Tạo Streaming HLS & Fallback
Bên trong `HlsVideoPlayer.jsx`, logic kiểm tra độ tương thích trình duyệt được kích hoạt trong `useEffect` giám sát `videoUrl`:
1.  **Trường hợp 1: Trình duyệt hỗ trợ MSE (Media Source Extensions)** - Hầu hết các trình duyệt Chrome, Edge, Firefox trên PC & Android:
    *   Khởi tạo trình xử lý HLS: `const hls = new Hls()`.
    *   Gắn nguồn phát: `hls.loadSource(videoUrl)`.
    *   Đính kèm phần tử HTML5 Video: `hls.attachMedia(videoRef.current)`.
    *   Lưu trữ instance vào ref `hlsRef.current = hls` để quản lý vòng đời.
2.  **Trường hợp 2: Trình duyệt hỗ trợ Native HLS (Safari trên macOS/iOS)**:
    *   Các thiết bị của Apple không cần thư viện bên thứ ba mà tự đọc được HLS.
    *   Thiết lập trực tiếp: `video.src = videoUrl`.
    *   Lắng nghe sự kiện `loadedmetadata` để tự động phát nếu cấu hình `shouldAutoplay` được bật.

### Bước 5: Phân Tích Manifest & Cấu Hình Chất Lượng Phát (Quality Levels)
Khi file `.m3u8` chính (Master Playlist) được tải và phân tích thành công, sự kiện `MANIFEST_PARSED` được kích hoạt:
*   Trình phát trích xuất danh sách chất lượng video có sẵn (`data.levels`) gồm chiều cao khung hình (ví dụ: `1080px`, `720px`, `480px`, `360px`).
*   Lọc bỏ các độ phân giải quá thấp (< 360p), lọc trùng lặp và sắp xếp theo thứ tự độ phân giải giảm dần.
*   Lưu vào state `availableQualities` để hiển thị lên Menu Cấu hình Custom UI.
*   Mặc định chất lượng được đặt ở chế độ **Auto** (`currentQualityLevel = -1`), cho phép `hls.js` tự động nhảy chất lượng (Auto Adaptive) tùy theo tốc độ tải mạng.

### Bước 6: Xử Lý Lỗi Tự Động (Auto Error Recovery)
Để đảm bảo trải nghiệm học tập không gián đoạn, trình phát lắng nghe sự kiện lỗi `Hls.Events.ERROR`:
*   **Lỗi mạng (NETWORK_ERROR)**: Hệ thống tự động kích hoạt `hls.startLoad()` để cố gắng kết nối lại và tải tiếp segment. Nếu thất bại nặng, tiến hành dọn dẹp giải phóng qua `hls.destroy()`.
*   **Lỗi giải mã/Media (MEDIA_ERROR)**: Hệ thống tự động kích hoạt `hls.recoverMediaError()` để tái đồng bộ hóa luồng video và tiếp tục phát từ phân đoạn lỗi.

### Bước 7: Trải Nghiệm Người Dùng (UX) & Bộ Điều Khiển Tùy Biến
Trình phát sử dụng một hệ thống custom control bar tuyệt đẹp với các tính năng:
*   **Đồng bộ thời gian thực**: Lắng nghe sự kiện `timeupdate` của thẻ `<video>` để tính toán tỷ lệ phần trăm tiến trình phát (`progressPct`) đồng thời truyền dữ liệu ngược về Redux và đồng bộ thời gian ghi chú trong thẻ `NotesTab`.
*   **Tự động ẩn thanh điều khiển**: Lắng nghe di chuyển chuột trên khung video. Nếu người dùng không di chuyển chuột/không chạm màn hình trong vòng **3 giây** (`IDLE_TIMEOUT_MS = 3000`) khi video đang phát, thanh điều khiển sẽ tự động trượt ẩn đi (`translate-y-2 opacity-0`) và ẩn con trỏ chuột (`cursor-none` khi ở chế độ Fullscreen) để tối đa diện tích hiển thị video. Con trỏ và thanh điều khiển sẽ hiện ngay lại khi phát hiện di chuyển chuột.
*   **Timeline Hover & Drag**: Khi di chuyển chuột trên thanh tiến trình, hiển thị một tooltip nhỏ chỉ định chính xác mốc thời gian tại điểm hover (`hoverTimeSec`). Click hoặc kéo vuốt để nhảy nhanh (`seekToPct`) tới mốc đó.
*   **Tốc độ phát**: Hỗ trợ thay đổi tốc độ từ `0.5x` đến `2.0x`.
*   **Thay đổi chất lượng thủ công**: Người dùng nhấp vào biểu tượng Settings răng cưa để chọn chất lượng cụ thể. Khi chọn một mức phân giải (ví dụ `720p`), Front-end gán chỉ số level vào `hls.nextLevel = selectedIndex`, buộc trình phát tải phân đoạn tiếp theo theo đúng cấu hình yêu cầu.

### Bước 8: Luồng Xử Lý Kết Thúc Bài Học (Lesson Completed & Autoplay Next)
Khi video phát tới giây cuối cùng, trình phát phát tín hiệu kết thúc qua sự kiện `ended`:
1.  **Nếu là bài học cuối cùng của khóa học (`!hasNextLesson`)**:
    *   Trình phát hiển thị giao diện chúc mừng (Completion Overlay) phủ toàn màn hình tuyệt đẹp với Cúp vàng (`Trophy`) và lời chúc mừng hoàn thành khóa học, cung cấp tùy chọn "Review Course" hoặc "View Certificate".
    *   Kích hoạt callback `onCourseComplete()` gửi tín hiệu về trang cha.
2.  **Nếu còn bài học tiếp theo và `Autoplay` đang được bật**:
    *   Hệ thống chuyển sang trạng thái chờ phát bài mới bằng cách hiển thị lớp phủ **"Up Next"** kèm đếm ngược 5 giây.
    *   Nếu học viên muốn tạm dừng, họ có thể nhấp **Cancel** để dừng đếm ngược.
    *   Nếu hết 5 giây đếm ngược mà không bị hủy, callback `onPlayNextLesson` được gọi. Trang cha thực hiện đổi `currentLessonId` sang bài tiếp theo, kích hoạt lại toàn bộ vòng đời phát video cho bài học mới.

---
![Sơ đồ hoạt động](https://github.com/quocchife1/Task1-SOLDEMYPLA-1/blob/main/Gemini_Generated_Image_4xzrm4xzrm4xzrm4.png)
---