import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldAlert, ShieldCheck, AlertTriangle, 
  ArrowLeft, DollarSign, Image, Eye
} from 'lucide-react';
import Swal from 'sweetalert2';
import { httpClient } from '../../services/httpClient';
import { useToast } from '../../components/feedback/Toast';
import { useAuth } from '../../features/auth/hooks/useAuth';

interface DisputeItem {
  _id: string;
  bookingId: any; // populated Booking
  bookingItemId: any; // populated BookingItem
  productId: any; // populated Product
  reportedBy: any; // populated Provider
  description: string;
  evidencePhotos: string[];
  requestedAmount: number;
  status: string;
  adminNotes?: string;
  resolvedAt?: string;
  createdAt: string;
}

export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, isAuthenticated } = useAuth();
  
  const [disputes, setDisputes] = useState<DisputeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState<DisputeItem | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [resolving, setResolving] = useState(false);

  // Check role: must be Admin
  const isAdmin = user?.roles?.includes('ADMIN') || user?.roles?.includes('admin');

  const fetchDisputes = async () => {
    setLoading(true);
    try {
      const data = await httpClient.get<DisputeItem[]>('/api/disputes/admin/disputed');
      setDisputes(data || []);
    } catch (err: any) {
      console.error(err);
      toast.error('Lỗi khi tải danh sách tranh chấp');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      if (!isAdmin) {
        toast.error('Bạn không có quyền truy cập trang quản trị!');
        navigate('/');
      } else {
        fetchDisputes();
      }
    }
  }, [isAuthenticated, isAdmin]);

  const handleResolve = async (decision: 'SHOP_RIGHT' | 'CUSTOMER_RIGHT') => {
    if (!selectedDispute) return;
    if (!adminNotes.trim()) {
      toast.error('Vui lòng nhập ghi chú phán quyết của Admin!');
      return;
    }

    const decisionText = decision === 'SHOP_RIGHT' 
      ? 'Phán quyết Đối tác (Shop) đúng' 
      : 'Phán quyết Khách hàng đúng';
    
    const explanation = decision === 'SHOP_RIGHT'
      ? `Hệ thống sẽ chuyển ${selectedDispute.requestedAmount.toLocaleString()}đ tiền đền bù sang tài khoản ngân hàng của Shop, phần cọc còn lại (nếu có) hoàn cho Khách.`
      : `Hệ thống sẽ hoàn trả lại 100% tiền cọc (${selectedDispute.bookingId?.pricingSummary?.depositTotal?.toLocaleString()}đ) cho Khách hàng. Shop không nhận được đền bù.`;

    const result = await Swal.fire({
      title: 'Xác nhận phán quyết?',
      html: `<div style="text-align: left; font-size: 14px;">
        <p><strong>Quyết định:</strong> <span style="color: var(--color-primary); font-weight: 700;">${decisionText}</span></p>
        <p>${explanation}</p>
        <p>Thao tác chuyển tiền/hoàn cọc ngân hàng sẽ được thực thi trực tiếp.</p>
      </div>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: decision === 'SHOP_RIGHT' ? 'var(--color-primary)' : 'var(--color-gold)',
      cancelButtonColor: '#9CA3AF',
      confirmButtonText: 'Xác nhận thi hành',
      cancelButtonText: 'Quay lại',
      background: 'white',
      customClass: {
        popup: 'font-body',
      }
    });

    if (result.isConfirmed) {
      setResolving(true);
      try {
        const bookingId = selectedDispute.bookingId?._id || selectedDispute.bookingId;
        await httpClient.post(`/api/disputes/admin/resolve/${bookingId}`, {
          decision,
          notes: adminNotes.trim(),
        });
        toast.success('Phán quyết tranh chấp thành công! Giao dịch ngân hàng đã được thực hiện.');
        setAdminNotes('');
        setSelectedDispute(null);
        fetchDisputes();
      } catch (err: any) {
        toast.error(err.message || 'Giải quyết tranh chấp thất bại');
      } finally {
        setResolving(false);
      }
    }
  };

  if (!isAuthenticated || !isAdmin) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh', fontFamily: 'var(--font-body)' }}>
        <div style={{ textAlign: 'center', padding: '40px', maxWidth: '400px', backgroundColor: '#FFF5F5', borderRadius: '12px', border: '1px solid #FEB2B2' }}>
          <ShieldAlert size={48} color="#E53E3E" style={{ marginBottom: '16px' }} />
          <h3 style={{ margin: '0 0 8px 0', color: '#C53030', fontWeight: 700 }}>Không Có Quyền Truy Cập</h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#742A2A' }}>Vui lòng đăng nhập với tài khoản Quản trị viên để truy cập chức năng này.</p>
          <button onClick={() => navigate('/')} style={{ padding: '8px 16px', border: 'none', borderRadius: '6px', backgroundColor: '#C53030', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Về Trang Chủ</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '90vh', backgroundColor: '#FAF9F6', padding: '40px 24px', fontFamily: 'var(--font-body)', color: 'var(--color-text-primary)' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', borderBottom: '1px solid var(--color-light-border)', paddingBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldCheck size={28} color="var(--color-primary-dark)" />
              <h1 style={{ fontFamily: 'var(--font-header)', fontSize: '32px', fontWeight: 700, margin: 0, color: 'var(--color-primary-dark)' }}>
                Kênh Quản Trị Viên (Admin)
              </h1>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '8px' }}>
              Phân định tranh chấp và đối soát đền bù sự cố giữa Shop Áo Dài và Khách Hàng.
            </p>
          </div>
          <button 
            onClick={() => navigate('/')} 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', border: '1px solid var(--color-light-border)', borderRadius: '8px', backgroundColor: 'white', fontSize: '13px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
          >
            <ArrowLeft size={16} /> Quay lại
          </button>
        </div>

        {/* Dashboard Cards Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '32px' }}>
          
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid var(--color-light-border)', padding: '24px', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '8px', backgroundColor: '#FFF5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E53E3E' }}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tranh chấp chờ xử lý</div>
              <div style={{ fontSize: '24px', fontWeight: 700, marginTop: '4px', color: '#E53E3E' }}>{disputes.length} ca</div>
            </div>
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid var(--color-light-border)', padding: '24px', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '8px', backgroundColor: '#EBF8FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3182CE' }}>
              <DollarSign size={24} />
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tiền ký quỹ tạm khóa</div>
              <div style={{ fontSize: '24px', fontWeight: 700, marginTop: '4px', color: '#3182CE' }}>
                {disputes.reduce((sum, d) => sum + (d.bookingId?.pricingSummary?.depositTotal || 0), 0).toLocaleString()}đ
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid var(--color-light-border)', padding: '24px', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '8px', backgroundColor: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38A169' }}>
              <ShieldCheck size={24} />
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tuân thủ Quy định ví</div>
              <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '4px', color: '#38A169' }}>Bảo lưu chuyển khoản trực tiếp</div>
            </div>
          </div>

        </div>

        {/* Workspace Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: selectedDispute ? '1.2fr 1fr' : '1fr', gap: '24px', transition: 'all 0.3s ease' }}>
          
          {/* Dispute List Table */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid var(--color-light-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-light-border)', backgroundColor: '#FAF8F5' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 750, color: 'var(--color-primary-dark)' }}>DANH SÁCH TRANH CHẤP CHỜ GIẢI QUYẾT</h3>
            </div>
            
            {loading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Đang tải danh sách tranh chấp...</div>
            ) : disputes.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Không có cuộc tranh chấp sự cố nào cần xử lý.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-light-border)', backgroundColor: 'var(--color-light-bg)' }}>
                    {['MÃ ĐƠN HÀNG', 'SẢN PHẨM SỰ CỐ', 'ĐỐI TÁC BÁO CÁO', 'YÊU CẦU ĐỀN BÙ', 'TIỀN CỌC GIỮ ĐỒ', 'THAO TÁC'].map(h => (
                      <th key={h} style={{ padding: '14px 20px', fontWeight: 700, fontSize: '10px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: h === 'YÊU CẦU ĐỀN BÙ' || h === 'TIỀN CỌC GIỮ ĐỒ' ? 'right' : 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {disputes.map(d => {
                    const bookingCode = d.bookingId?.bookingCode || 'N/A';
                    const productName = d.productId?.name || d.bookingItemId?.name || 'Sản phẩm';
                    const shopName = d.reportedBy?.businessName || d.reportedBy?.profile?.fullName || 'Shop';
                    const reqAmt = d.requestedAmount;
                    const depTotal = d.bookingId?.pricingSummary?.depositTotal || 0;

                    return (
                      <tr 
                        key={d._id} 
                        style={{ 
                          borderBottom: '1px solid var(--color-light-border)', 
                          backgroundColor: selectedDispute?._id === d._id ? '#FFF9F9' : 'transparent',
                          transition: 'var(--transition-smooth)' 
                        }}
                      >
                        <td style={{ padding: '16px 20px', fontWeight: 700 }}>{bookingCode}</td>
                        <td style={{ padding: '16px 20px', fontWeight: 600 }}>{productName}</td>
                        <td style={{ padding: '16px 20px', color: 'var(--color-primary-dark)', fontWeight: 600 }}>{shopName}</td>
                        <td style={{ padding: '16px 20px', fontWeight: 700, color: '#C53030', textAlign: 'right' }}>{reqAmt.toLocaleString()}đ</td>
                        <td style={{ padding: '16px 20px', fontWeight: 700, color: '#2B6CB0', textAlign: 'right' }}>{depTotal.toLocaleString()}đ</td>
                        <td style={{ padding: '16px 20px' }}>
                          <button 
                            onClick={() => {
                              setSelectedDispute(d);
                              setAdminNotes('');
                            }}
                            style={{ 
                              display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', 
                              border: 'none', borderRadius: '4px', backgroundColor: 'var(--color-primary)', 
                              color: 'white', fontSize: '11px', fontWeight: 700, cursor: 'pointer' 
                            }}
                          >
                            <Eye size={12} /> Xem Chi Tiết
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Dispute Details & Resolution Panel */}
          {selectedDispute && (
            <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid var(--color-light-border)', boxShadow: 'var(--shadow-md)', overflow: 'hidden', height: 'fit-content', position: 'sticky', top: '24px', display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px' }} className="animate-scale-up-fade">
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-light-border)', paddingBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 750, color: 'var(--color-primary-dark)' }}>
                  CHI TIẾT TRANH CHẤP: {selectedDispute.bookingId?.bookingCode}
                </h3>
                <button 
                  onClick={() => setSelectedDispute(null)} 
                  style={{ background: 'none', border: 'none', fontSize: '18px', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
                >✕</button>
              </div>

              {/* Dispute facts */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Nhà cung cấp báo cáo:</span>
                  <strong>{selectedDispute.reportedBy?.businessName || 'Shop'}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Điện thoại Shop:</span>
                  <strong>{selectedDispute.reportedBy?.profile?.phoneNumber || selectedDispute.reportedBy?.userId?.phone || 'Chưa cập nhật'}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--color-light-border)', paddingBottom: '10px' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Mã tài khoản Shop:</span>
                  <strong style={{ fontSize: '11px', backgroundColor: '#EDF2F7', padding: '2px 6px', borderRadius: '4px' }}>
                    {selectedDispute.reportedBy?.paymentAccounts?.[0]?.bankName || 'VietinBank'} • {selectedDispute.reportedBy?.paymentAccounts?.[0]?.accountNumberMasked || '*********'}
                  </strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Khách hàng khiếu nại:</span>
                  <strong>{selectedDispute.bookingId?.customerId?.profile?.fullName || 'Khách hàng'}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--color-light-border)', paddingBottom: '10px' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Email khách hàng:</span>
                  <strong>{selectedDispute.bookingId?.customerId?.email || 'N/A'}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Sản phẩm hư hỏng:</span>
                  <strong>{selectedDispute.productId?.name || selectedDispute.bookingItemId?.name || 'Sản phẩm'}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Yêu cầu đền bù của Shop:</span>
                  <strong style={{ color: '#C53030', fontSize: '15px' }}>{selectedDispute.requestedAmount.toLocaleString()}đ</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--color-light-border)', paddingBottom: '10px' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Tổng cọc giữ đồ:</span>
                  <strong style={{ color: '#2B6CB0', fontSize: '15px' }}>{selectedDispute.bookingId?.pricingSummary?.depositTotal?.toLocaleString()}đ</strong>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Mô tả sự cố của Shop:</span>
                  <p style={{ margin: 0, padding: '10px', backgroundColor: '#FFF5F5', borderRadius: '6px', borderLeft: '4px solid #E53E3E', fontSize: '13px', color: '#2D3748', fontStyle: 'italic' }}>
                    "{selectedDispute.description}"
                  </p>
                </div>

                {/* Evidence photos */}
                {selectedDispute.evidencePhotos && selectedDispute.evidencePhotos.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                    <span style={{ color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}><Image size={14} /> Ảnh chụp bằng chứng:</span>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {selectedDispute.evidencePhotos.map((photo, idx) => (
                        <a key={idx} href={photo} target="_blank" rel="noopener noreferrer">
                          <img src={photo} alt={`Bằng chứng ${idx + 1}`} style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #E2E8F0' }} />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

              </div>

              {/* Resolution Form */}
              <div style={{ marginTop: '12px', borderTop: '1px solid var(--color-light-border)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Ý KIẾN PHÁN QUYẾT CỦA ADMIN *</span>
                  <textarea
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--color-light-border)', fontSize: '13px', outline: 'none', resize: 'none', height: '80px', fontFamily: 'inherit' }}
                    placeholder="Nhập ghi chú lý do đưa ra quyết định để gửi thông báo cho cả 2 bên..."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => handleResolve('SHOP_RIGHT')}
                    disabled={resolving}
                    style={{
                      flex: 1,
                      padding: '12px 10px',
                      backgroundColor: 'var(--color-primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 700,
                      cursor: resolving ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      textAlign: 'center',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    SHOP ĐÚNG (ĐỀN BÙ)
                  </button>
                  <button
                    onClick={() => handleResolve('CUSTOMER_RIGHT')}
                    disabled={resolving}
                    style={{
                      flex: 1,
                      padding: '12px 10px',
                      backgroundColor: '#2D3748',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 700,
                      cursor: resolving ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      textAlign: 'center',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    KHÁCH ĐÚNG (HOÀN 100%)
                  </button>
                </div>

              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};

export default AdminDashboardPage;
