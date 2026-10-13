# Switcher

## Security model (v4.0.1)

- Cookie profiles are sensitive login sessions. This extension is for personal or
  small-group testing, not a security-audited product.
- The extension starts with no website host permission. Use **Cấp quyền website
  này** only on the site being managed; revoke permissions when finished.
- A profile is keyed by the hostname shown in the active tab, but its cookie
  scope includes the same registrable two-label domain. This supports sites
  such as `school.vnedu.vn` that authenticate through `user.vnedu.vn`.
  Unrelated domains, partitioned-cookie, invalid-expiry and malformed cookie
  records are rejected. Incognito windows are not supported.
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
Nếu cần chuyển dữ liệu, dùng xuất/nhập JSON thủ công từ nguồn tin cậy.
Không bật đồng bộ của tiện ích gốc để thực hiện việc chuyển dữ liệu.

## Phạm vi và giới hạn
- Không Google Drive/OAuth, bookmark sync hoặc chrome.storage.sync.
- Không tải favicon từ website, không nút đánh giá/quyên góp hoặc kết nối mạng của tiện ích.
- Quyền cookies, storage, activeTab và HTTP/HTTPS được giữ để lưu và phục hồi phiên website.
- Website vẫn cần Internet. Tải lại tab khi chuyển profile sẽ tạo lưu lượng của website.
- Profile được mã hóa AES-GCM nhưng khóa nằm trong cùng vùng lưu trữ cục bộ. Không bảo vệ trước người có quyền đọc toàn bộ hồ sơ Edge.
- JSON xuất thủ công chứa cookie dạng rõ. Không chia sẻ; không lưu trong thư mục cloud; xóa khi không cần.
- Chuyển phiên chỉ xử lý cookie, không localStorage/IndexedDB hoặc phiên phía máy chủ. Một số website cần đăng nhập lại.
- Logic nhóm domain và xử lý cookie kế thừa bản gốc; chưa bảo đảm mọi public suffix, cookie partitioned hoặc nhiều cookie store.
- Không có thay đổi nào đối với bản gốc trong thư mục Edge hoặc bản sao cloud/bookmark đã tồn tại trước đây.

## Kiểm tra
Kiểm thử Node với API giả lập đã xác nhận cú pháp, import, manifest, lưu mã hóa, chuyển cookie, yêu thích, nhập/xuất profile, xóa cookie và từ chối hành động đồng bộ.
Chạy bộ kiểm thử từ thư mục mã nguồn: `node --test tests/*.test.mjs`.
Chưa kiểm thử UI và network trực tiếp trên Edge. Trong DevTools của popup/service worker, kiểm tra Console không lỗi và Network không có yêu cầu ra Internet; lưu lượng của website được tải lại không tính là lưu lượng tiện ích.