/**
 * Formats electronic contract JSON snapshot or text into human-readable Vietnamese legal terms.
 */
export function formatContractTerms(renderedText: string | null | undefined): string {
  if (!renderedText) {
    return 'Đang tải nội dung hợp đồng điện tử...';
  }

  const trimmed = renderedText.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const snapshot = parsed.snapshot || parsed;
      const booking = snapshot.booking || {};
      const provider = snapshot.provider || {};
      const customer = snapshot.customer || {};
      const items = snapshot.providerItems || [];
      const pricing = snapshot.pricing || {};
      const summary = pricing.bookingSummary || {};
      const policies = snapshot.policies || {};

      const formatDate = (val: string | Date | undefined) => {
        if (!val) return 'Theo lịch hẹn';
        try {
          const d = new Date(val);
          return isNaN(d.getTime()) ? String(val) : d.toLocaleDateString('vi-VN');
        } catch {
          return String(val);
        }
      };

      const formatVND = (amount: number | undefined) => {
        if (typeof amount !== 'number') return '0 đ';
        return `${amount.toLocaleString('vi-VN')} đ`;
      };

      const provAddr = provider.address
        ? [
            provider.address.addressLine,
            provider.address.ward,
            provider.address.district,
            provider.address.city,
          ]
            .filter(Boolean)
            .join(', ')
        : 'Theo địa chỉ của cửa hàng trên hệ thống';

      const custAddr = customer.defaultAddress
        ? [
            customer.defaultAddress.street,
            customer.defaultAddress.ward,
            customer.defaultAddress.district,
            customer.defaultAddress.city,
          ]
            .filter(Boolean)
            .join(', ')
        : 'Theo thông tin tài khoản người dùng';

      let doc = '';
      doc += 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\n';
      doc += 'Độc lập - Tự do - Hạnh phúc\n';
      doc += '-------------------o0o-------------------\n\n';
      doc += 'HỢP ĐỒNG ĐIỆN TỬ THUÊ TRANG PHỤC ÁO DÀI\n';
      if (booking.bookingCode) {
        doc += `Mã giao dịch đơn: ${booking.bookingCode}\n`;
      }
      doc += 'Căn cứ Luật Giao dịch Điện tử và Quy chế hoạt động Nền tảng VibeHue,\n';
      doc += 'Hai bên thống nhất giao kết hợp đồng dịch vụ thuê trang phục điện tử với các điều khoản sau:\n\n';

      doc += 'BÊN CHO THUÊ (BÊN A):\n';
      doc += `- Đơn vị / Thương hiệu: ${provider.businessName || 'Nhà cung cấp đối tác VibeHue'}\n`;
      doc += `- Địa chỉ cơ sở: ${provAddr}\n`;
      if (provider.contact?.phone) {
        doc += `- Điện thoại liên hệ: ${provider.contact.phone}\n`;
      }
      if (provider.contact?.email) {
        doc += `- Email: ${provider.contact.email}\n`;
      }
      doc += '\n';

      doc += 'BÊN THUÊ (BÊN B):\n';
      doc += `- Họ và tên khách hàng: ${customer.fullName || 'Khách hàng thuê'}\n`;
      if (customer.email) {
        doc += `- Email: ${customer.email}\n`;
      }
      if (customer.phone) {
        doc += `- Số điện thoại: ${customer.phone}\n`;
      }
      if (customer.defaultAddress) {
        doc += `- Địa chỉ: ${custAddr}\n`;
      }
      doc += '\n';

      doc += 'ĐIỀU 1: DANH MỤC TRANG PHỤC & DỊCH VỤ THUÊ\n';
      if (Array.isArray(items) && items.length > 0) {
        items.forEach((item, idx) => {
          doc += `${idx + 1}. ${item.productName || 'Trang phục Áo dài'}\n`;
          doc += `   - Kích cỡ (Size): ${item.size || 'Freesize'} | Màu sắc: ${item.color || 'Tiêu chuẩn'} | Số lượng: ${item.quantity || 1}\n`;
          doc += `   - Thời hạn thuê: Từ ngày ${formatDate(item.rentalFrom)} đến ngày ${formatDate(item.rentalTo)}\n`;
          const pickupLoc = item.pickupReturnLocation?.address
            ? [
                item.pickupReturnLocation.address,
                item.pickupReturnLocation.ward,
                item.pickupReturnLocation.district,
                item.pickupReturnLocation.city,
              ]
                .filter(Boolean)
                .join(', ')
            : provAddr;
          doc += `   - Điểm nhận & hoàn trả áo dài: ${pickupLoc}\n`;
          doc += `   - Đơn giá thuê: ${formatVND(item.unitPrice)} | Tiền cọc bảo đảm: ${formatVND(item.depositAmount)}\n`;
        });
      } else {
        doc += '- Chi tiết mặt hàng được ghi nhận theo dữ liệu đơn đặt hàng.\n';
      }
      doc += '\n';

      doc += 'ĐIỀU 2: GIÁ THUÊ, TIỀN ĐẶT CỌC VÀ THANH TOÁN\n';
      doc += `- Tiền thuê trang phục: ${formatVND(summary.subTotal ?? 0)}\n`;
      doc += `- Tiền cọc bảo đảm tài sản: ${formatVND(summary.depositTotal ?? 0)}\n`;
      if (summary.discountAmount && summary.discountAmount > 0) {
        doc += `- Giảm giá voucher/khuyến mãi: -${formatVND(summary.discountAmount)}\n`;
      }
      doc += `- TỔNG THANH TOÁN (CẦN THANH TOÁN): ${formatVND(summary.grandTotal ?? 0)}\n`;
      doc += '* Quy định về tiền cọc: Tiền đặt cọc được Bên A giữ tạm thời và sẽ hoàn trả lại đầy đủ cho Bên B khi Bên B hoàn trả trang phục đúng hạn, nguyên vẹn không rách hỏng theo quy định của Sàn.\n\n';

      doc += 'ĐIỀU 3: CHÍNH SÁCH HỦY ĐƠN & HOÀN TIỀN\n';
      if (policies.providerCancellation) {
        doc += `- Quy định hoàn cọc từ Bên A: ${policies.providerCancellation}\n`;
      }
      if (policies.cancellation?.value?.freeCancelBeforeHours) {
        doc += `- Quy định bảo vệ từ Sàn VibeHue: Miễn phí hủy trước ${policies.cancellation.value.freeCancelBeforeHours} giờ so với giờ nhận đồ.\n`;
      }
      doc += '\n';

      doc += 'ĐIỀU 4: NGHĨA VỤ CỦA CÁC BÊN & QUY ĐỊNH BỒI THƯỜNG\n';
      if (policies.providerRental) {
        doc += `- Quy định thuê đồ từ Bên A: ${policies.providerRental}\n`;
      }
      doc += '- Bên B có trách nhiệm bảo quản trang phục cẩn thận, không tự ý sửa đổi kích thước, cắt may, làm rách hoặc vấy bẩn không thể phục hồi.\n';
      doc += '- Trường hợp trang phục bị hư hại hoặc mất mát, Bên B có trách nhiệm bồi thường thiệt hại theo bảng giá niêm yết hoặc thỏa thuận với Bên A dưới sự giám sát của Sàn VibeHue.\n\n';

      doc += 'ĐIỀU 5: HIỆU LỰC HỢP ĐỒNG & CHỨNG THỰC ĐIỆN TỬ\n';
      doc += '- Hợp đồng điện tử này có giá trị pháp lý ràng buộc hai bên kể từ thời điểm Bên B bấm "Chấp thuận điều khoản" trên hệ thống.\n';
      doc += '- Dữ liệu hợp đồng được lưu trữ an toàn, gắn mã băm SHA-256 bảo đảm tính toàn vẹn và không thể làm sai lệch nội dung sau khi ký kết.\n';
      doc += '- Hai bên cam kết thực hiện đúng và đầy đủ mọi điều khoản đã thỏa thuận.';

      return doc;
    } catch {
      // In case of parsing error, return original text
      return renderedText;
    }
  }

  // Raw plain text format (e.g. from mock tests)
  return renderedText;
}
