# Switcher

## Security model

- Cookie profiles are sensitive login sessions. This extension is for personal or
  small-group testing, not a security-audited product.
- The extension requests HTTP/HTTPS website access to manage cookies. Review
  website access in the browser's extension settings before using it.
- A profile is keyed by the hostname shown in the active tab, but its cookie
   scope groups hosts by their last two labels (not a full public-suffix lookup). This supports sites
  such as `school.vnedu.vn` that authenticate through `user.vnedu.vn`.
  Unrelated domains, partitioned-cookie, invalid-expiry and malformed cookie
   records are rejected. InPrivate/incognito is supported after the user enables
   it in the browser's extension settings. Cookie operations use the target tab's
   cookie store, separately from regular-window cookies.
- Stored profiles use AES-GCM. The encryption key is kept in the same local
  extension storage, so this protects against casual storage inspection only;
  it does not protect a compromised browser profile or a malicious extension.
- Backups are encrypted with AES-GCM using a password-derived key (PBKDF2
  SHA-256, 600,000 iterations). Passwords are never stored. The password must
  be 8–256 characters; losing it makes the backup unrecoverable.
- Plaintext JSON cookie export/import is intentionally disabled.
- Corrupt or undecryptable storage fails closed and is not replaced. Preserve
  the Edge profile before attempting recovery.
- The popup receives profile metadata only; cookie values remain in the service
  worker. Every mutating operation is serialized and cookie-switch failure
  attempts to restore the previous cookie set.

## Known limitations

Cookie access is inherently high risk and broad cookie permission is still
required by the browser API. Websites using multiple subdomains, unusual
cookie stores, partitioned cookies or non-HTTP schemes may not switch fully.
Test with non-critical accounts first. Verify the unpacked extension and its
service-worker DevTools/network panel in Edge before sharing it.

## Cài đặt
1. Mở edge://extensions và bật Developer mode.
2. Tắt tiện ích gốc để nó không tiếp tục đồng bộ hoặc can thiệp cookie.
3. Chọn Load unpacked và chọn thư mục mã nguồn Switcher chứa `manifest.json`.
4. Mở website, đăng nhập tài khoản A, mở popup và lưu profile A.
5. Đăng nhập tài khoản B, lưu profile B, rồi thử chuyển lại A/B.
6. Đóng/mở popup và khởi động lại Edge để kiểm tra dữ liệu còn lưu.

Bản unpacked có vùng lưu trữ riêng, không tự lấy profile từ tiện ích gốc.
Nếu cần chuyển dữ liệu, dùng chức năng xuất/nhập bản sao lưu đã mã hóa bằng mật khẩu, từ nguồn tin cậy.
Không bật đồng bộ của tiện ích gốc để thực hiện việc chuyển dữ liệu.

## Phạm vi và giới hạn
- Không Google Drive/OAuth, bookmark sync hoặc chrome.storage.sync.
- Không tải favicon từ website, không nút đánh giá/quyên góp hoặc kết nối mạng của tiện ích.
- Quyền cookies, storage, activeTab và HTTP/HTTPS được giữ để lưu và phục hồi phiên website.
- Website vẫn cần Internet. Tải lại tab khi chuyển profile sẽ tạo lưu lượng của website.
- Profile được mã hóa AES-GCM nhưng khóa nằm trong cùng vùng lưu trữ cục bộ. Không bảo vệ trước người có quyền đọc toàn bộ hồ sơ Edge.
- Bản sao lưu JSON chứa dữ liệu mã hóa, không phải cookie dạng rõ. Giữ kín mật khẩu và chỉ nhập bản sao lưu từ nguồn tin cậy.
- Chuyển phiên chỉ xử lý cookie, không localStorage/IndexedDB hoặc phiên phía máy chủ. Một số website cần đăng nhập lại.
- Khi chuyển phiên, cookie đã hết hạn được bỏ qua và thông báo số lượng; cookie còn hạn và cookie phiên không có ngày hết hạn vẫn được khôi phục. Nếu không còn cookie dùng được, tiện ích dừng trước khi thay đổi phiên hiện tại. Bản lưu gốc không bị sửa và hạn cookie không được kéo dài.
- Bản lưu không tự cập nhật theo website. Khôi phục cookie thành công không chứng minh đăng nhập thành công; Google hoặc website có thể thu hồi phiên phía máy chủ. Khi đó cần đăng nhập lại và lưu đúng tài khoản. Để giữ các tài khoản Google độc lập ổn định hơn, nên dùng các hồ sơ trình duyệt Edge riêng biệt thay vì chỉ khôi phục cookie.
- Logic nhóm domain và xử lý cookie kế thừa bản gốc; chưa bảo đảm mọi public suffix, cookie partitioned hoặc nhiều cookie store.
- Không có thay đổi nào đối với bản gốc trong thư mục Edge hoặc bản sao cloud/bookmark đã tồn tại trước đây.

## Kiểm tra
### InPrivate / Ẩn danh
- Sau khi tải lại tiện ích tại `edge://extensions`, mở Chi tiết của Switcher và bật **Cho phép trong InPrivate**. Trên Chrome, bật **Allow in Incognito** tại `chrome://extensions`.
- Tiện ích dùng chung tiến trình nền và danh sách phiên đã lưu giữa cửa sổ thường và InPrivate; cookie được đọc/ghi vào kho của tab đang thao tác, không phải luôn vào kho thường.
- **Lưu phiên trong InPrivate vẫn lưu dữ liệu lâu dài vào bộ nhớ tiện ích.** Đóng InPrivate không xóa bản lưu, tên tài khoản hoặc dữ liệu giao diện đã lưu. Muốn xóa bản lưu, dùng Xóa phiên trong tiện ích.
- Dùng tài khoản thử nghiệm: lưu/chuyển phiên trong InPrivate rồi kiểm tra cửa sổ thường vẫn giữ nguyên cookie; thử lại theo chiều ngược lại. Kiểm tra cả khi đổi cửa sổ trong lúc đang chuyển phiên.
- InPrivate không khắc phục cookie hết hạn hoặc phiên bị website vô hiệu hóa. Các cửa sổ InPrivate cùng hồ sơ trình duyệt cũng không phải các kho cookie độc lập với nhau.

Bộ kiểm thử Node dùng API giả lập để kiểm tra các chức năng cookie, sao lưu, thứ tự profile, InPrivate và YouTube/Studio; không thay thế kiểm thử trực tiếp trên trình duyệt.
Chạy bộ kiểm thử từ thư mục mã nguồn: `node --test tests/*.test.mjs`.
Chưa kiểm thử UI và network trực tiếp trên Edge. Trong DevTools của popup/service worker, kiểm tra Console không lỗi và Network không có yêu cầu ra Internet; lưu lượng của website được tải lại không tính là lưu lượng tiện ích.