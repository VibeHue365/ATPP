import React, { useEffect, useState } from 'react';
import { Check, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { httpClient } from '../../../services/httpClient';
import { useToast } from '../../../components/feedback/Toast';

interface SavedAddress {
  id: string;
  label: string;
  recipientName?: string | null;
  phone?: string | null;
  addressLine: string;
  ward?: string | null;
  district?: string | null;
  city?: string | null;
  note?: string | null;
  isDefault: boolean;
}

interface AdministrativeOption {
  code: number;
  name: string;
}

type AddressForm = {
  label: string;
  recipientName: string;
  phone: string;
  addressLine: string;
  ward: string;
  district: string;
  city: string;
  note: string;
};

const emptyForm = (): AddressForm => ({
  label: '', recipientName: '', phone: '', addressLine: '', ward: '', district: '', city: '', note: '',
});

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '11px 12px', border: '1px solid #E0D9CC',
  borderRadius: '9px', background: '#FCFAF6', fontSize: '14px', color: '#342B25', outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: '7px', color: '#77695B', fontSize: '11px', fontWeight: 800,
  letterSpacing: '0.05em', textTransform: 'uppercase',
};

export const AddressBook: React.FC = () => {
  const toast = useToast();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AddressForm>(emptyForm());
  const [provinces, setProvinces] = useState<AdministrativeOption[]>([]);
  const [districts, setDistricts] = useState<AdministrativeOption[]>([]);
  const [wards, setWards] = useState<AdministrativeOption[]>([]);
  const [selectedProvinceCode, setSelectedProvinceCode] = useState<number | null>(null);
  const [selectedDistrictCode, setSelectedDistrictCode] = useState<number | null>(null);
  const [administrativeLoading, setAdministrativeLoading] = useState(false);

  const loadAddresses = async () => {
    setLoading(true);
    try {
      setAddresses(await httpClient.get<SavedAddress[]>('/users/me/addresses'));
    } catch (error: any) {
      toast.error(error.message || 'Không thể tải Sổ địa chỉ.');
    } finally {
      setLoading(false);
    }
  };

  const loadProvinces = async (): Promise<AdministrativeOption[]> => {
    const response = await fetch('https://provinces.open-api.vn/api/p/');
    if (!response.ok) throw new Error('Không thể tải danh sách tỉnh/thành.');
    const data = await response.json() as AdministrativeOption[];
    setProvinces(data);
    return data;
  };

  const loadDistricts = async (provinceCode: number): Promise<AdministrativeOption[]> => {
    const response = await fetch(`https://provinces.open-api.vn/api/p/${provinceCode}?depth=2`);
    if (!response.ok) throw new Error('Không thể tải danh sách quận/huyện.');
    const data = await response.json() as { districts?: AdministrativeOption[] };
    const result = data.districts || [];
    setDistricts(result);
    return result;
  };

  const loadWards = async (districtCode: number): Promise<AdministrativeOption[]> => {
    const response = await fetch(`https://provinces.open-api.vn/api/d/${districtCode}?depth=2`);
    if (!response.ok) throw new Error('Không thể tải danh sách phường/xã.');
    const data = await response.json() as { wards?: AdministrativeOption[] };
    const result = data.wards || [];
    setWards(result);
    return result;
  };

  useEffect(() => {
    void loadAddresses();
    void loadProvinces().catch(() => toast.error('Không thể tải danh sách tỉnh/thành. Vui lòng thử lại.'));
  }, []);
  const change = (field: keyof AddressForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setEditingId(null);
    setShowForm(false);
    setForm(emptyForm());
    setSelectedProvinceCode(null);
    setSelectedDistrictCode(null);
    setDistricts([]);
    setWards([]);
  };

  const handleProvinceChange = async (rawCode: string) => {
    const code = Number(rawCode);
    const province = provinces.find((item) => item.code === code);
    setSelectedProvinceCode(Number.isFinite(code) ? code : null);
    setSelectedDistrictCode(null);
    setDistricts([]);
    setWards([]);
    change('city', province?.name || '');
    change('district', '');
    change('ward', '');
    if (!province) return;
    setAdministrativeLoading(true);
    try {
      await loadDistricts(code);
    } catch (error: any) {
      toast.error(error.message || 'Không thể tải quận/huyện.');
    } finally {
      setAdministrativeLoading(false);
    }
  };

  const handleDistrictChange = async (rawCode: string) => {
    const code = Number(rawCode);
    const district = districts.find((item) => item.code === code);
    setSelectedDistrictCode(Number.isFinite(code) ? code : null);
    setWards([]);
    change('district', district?.name || '');
    change('ward', '');
    if (!district) return;
    setAdministrativeLoading(true);
    try {
      await loadWards(code);
    } catch (error: any) {
      toast.error(error.message || 'Không thể tải phường/xã.');
    } finally {
      setAdministrativeLoading(false);
    }
  };

  const handleWardChange = (rawCode: string) => {
    const ward = wards.find((item) => item.code === Number(rawCode));
    change('ward', ward?.name || '');
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.label.trim() || !form.addressLine.trim() || !form.city || !form.district || !form.ward) {
      toast.error('Vui lòng chọn đủ Tỉnh/Thành, Quận/Huyện, Phường/Xã và nhập địa chỉ chi tiết.');
      return;
    }
    setSaving(true);
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()]));
      if (editingId) {
        await httpClient.patch(`/users/me/addresses/${editingId}`, payload);
        toast.success('Đã cập nhật địa chỉ.');
      } else {
        await httpClient.post('/users/me/addresses', payload);
        toast.success('Đã thêm địa chỉ mới.');
      }
      resetForm();
      await loadAddresses();
    } catch (error: any) {
      toast.error(error.message || 'Không thể lưu địa chỉ.');
    } finally {
      setSaving(false);
    }
  };

  const edit = async (address: SavedAddress) => {
    setEditingId(address.id);
    setForm({
      label: address.label, recipientName: address.recipientName || '', phone: address.phone || '',
      addressLine: address.addressLine, ward: address.ward || '', district: address.district || '',
      city: address.city || '', note: address.note || '',
    });
    setShowForm(true);
    setSelectedProvinceCode(null);
    setSelectedDistrictCode(null);
    setDistricts([]);
    setWards([]);
    setAdministrativeLoading(true);
    try {
      const availableProvinces = provinces.length > 0 ? provinces : await loadProvinces();
      const province = availableProvinces.find((item) => item.name === address.city);
      if (!province) return;
      setSelectedProvinceCode(province.code);
      const availableDistricts = await loadDistricts(province.code);
      const district = availableDistricts.find((item) => item.name === address.district);
      if (!district) return;
      setSelectedDistrictCode(district.code);
      await loadWards(district.code);
    } catch (error: any) {
      toast.error(error.message || 'Không thể tải lại địa giới của địa chỉ này.');
    } finally {
      setAdministrativeLoading(false);
    }
  };
  const makeDefault = async (address: SavedAddress) => {
    if (address.isDefault) return;
    try {
      await httpClient.post(`/users/me/addresses/${address.id}/default`);
      await loadAddresses();
      toast.success('Đã đặt địa chỉ mặc định.');
    } catch (error: any) {
      toast.error(error.message || 'Không thể đặt địa chỉ mặc định.');
    }
  };

  const remove = async (address: SavedAddress) => {
    if (!window.confirm(`Xóa địa chỉ “${address.label}”?`)) return;
    try {
      await httpClient.delete(`/users/me/addresses/${address.id}`);
      await loadAddresses();
      toast.success('Đã xóa địa chỉ.');
    } catch (error: any) {
      toast.error(error.message || 'Không thể xóa địa chỉ.');
    }
  };

  return (
    <section className="vh-settings-tab-view animate-fade-in" style={{ maxWidth: '780px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '18px', alignItems: 'flex-start', marginBottom: '22px' }}>
        <div>
          <h3 className="vh-settings-section-title font-header" style={{ marginBottom: '6px' }}>Sổ địa chỉ</h3>
          <p style={{ margin: 0, color: '#817467', fontSize: '13px', lineHeight: 1.55 }}>
            Lưu nhiều địa chỉ để dùng khi có luồng giao nhận sau này. Vị trí buổi chụp được chọn riêng khi đặt lịch, không dùng pin tại đây.
          </p>
        </div>
        <button type="button" onClick={() => { resetForm(); setShowForm(true); }} style={{ flexShrink: 0, border: 'none', borderRadius: '9px', background: 'var(--color-primary)', color: '#fff', padding: '11px 14px', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', gap: '7px', alignItems: 'center' }}>
          <Plus size={16} /> Thêm địa chỉ
        </button>
      </div>

      {showForm && (
        <form onSubmit={save} style={{ padding: '18px', border: '1px solid #E6D9C7', background: '#FFFCF6', borderRadius: '13px', marginBottom: '18px' }}>
          <h4 style={{ margin: '0 0 16px', color: '#3A2B20', fontSize: '15px' }}>{editingId ? 'Chỉnh sửa địa chỉ' : 'Thêm địa chỉ mới'}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '13px' }}>
            <div><label style={labelStyle}>Tên gợi nhớ *</label><input style={inputStyle} value={form.label} onChange={(e) => change('label', e.target.value)} placeholder="Ví dụ: Nhà riêng, Công ty" maxLength={60} /></div>
            <div><label style={labelStyle}>Người nhận</label><input style={inputStyle} value={form.recipientName} onChange={(e) => change('recipientName', e.target.value)} placeholder="Họ và tên người nhận" maxLength={120} /></div>
            <div><label style={labelStyle}>Số điện thoại</label><input style={inputStyle} value={form.phone} onChange={(e) => change('phone', e.target.value)} placeholder="0901 234 567" maxLength={20} /></div>
            <div><label style={labelStyle}>Tỉnh / Thành phố *</label><select style={inputStyle} value={selectedProvinceCode ?? ''} onChange={(e) => void handleProvinceChange(e.target.value)} disabled={administrativeLoading || provinces.length === 0} required><option value="">Chọn Tỉnh / Thành phố</option>{provinces.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Địa chỉ chi tiết *</label><input style={inputStyle} value={form.addressLine} onChange={(e) => change('addressLine', e.target.value)} placeholder="Số nhà, tên đường" maxLength={500} /></div>
            <div><label style={labelStyle}>Quận / Huyện *</label><select style={inputStyle} value={selectedDistrictCode ?? ''} onChange={(e) => void handleDistrictChange(e.target.value)} disabled={administrativeLoading || !selectedProvinceCode} required><option value="">Chọn Quận / Huyện</option>{districts.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></div>
            <div><label style={labelStyle}>Phường / Xã *</label><select style={inputStyle} value={wards.find((item) => item.name === form.ward)?.code ?? ''} onChange={(e) => handleWardChange(e.target.value)} disabled={administrativeLoading || !selectedDistrictCode} required><option value="">Chọn Phường / Xã</option>{wards.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Ghi chú cho tài xế / cửa hàng</label><input style={inputStyle} value={form.note} onChange={(e) => change('note', e.target.value)} placeholder="Ví dụ: gọi trước khi đến" maxLength={500} /></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' }}>
            <button type="button" onClick={resetForm} style={{ border: '1px solid #D9CCBD', color: '#655A50', background: '#fff', borderRadius: '8px', padding: '10px 15px', fontWeight: 700, cursor: 'pointer' }}>Hủy</button>
            <button type="submit" disabled={saving} style={{ border: 'none', color: '#fff', background: saving ? '#9E9185' : 'var(--color-primary)', borderRadius: '8px', padding: '10px 15px', fontWeight: 800, cursor: saving ? 'wait' : 'pointer' }}>{saving ? 'Đang lưu...' : 'Lưu địa chỉ'}</button>
          </div>
        </form>
      )}

      {loading ? <p style={{ color: '#817467' }}>Đang tải địa chỉ...</p> : addresses.length === 0 ? (
        <div style={{ border: '1px dashed #D8C8B4', borderRadius: '13px', padding: '38px 22px', textAlign: 'center', color: '#817467', background: '#FFFCF8' }}>
          <MapPin size={26} style={{ marginBottom: '9px', color: 'var(--color-primary)' }} />
          <div style={{ fontWeight: 800, color: '#55463A', marginBottom: '5px' }}>Bạn chưa lưu địa chỉ nào</div>
          <div style={{ fontSize: '13px' }}>Thêm địa chỉ để quản lý thuận tiện khi dịch vụ có giao nhận.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {addresses.map((address) => (
            <article key={address.id} style={{ border: address.isDefault ? '1px solid #C28B35' : '1px solid #E5DDD2', borderRadius: '12px', padding: '15px 16px', background: '#fff', boxShadow: '0 3px 10px rgba(68, 47, 29, 0.035)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                    <MapPin size={16} color="var(--color-primary)" /><strong style={{ color: '#3A2B20' }}>{address.label}</strong>
                    {address.isDefault && <span style={{ color: '#80601E', background: '#FFF2C9', borderRadius: '999px', padding: '3px 8px', fontSize: '11px', fontWeight: 800 }}>Mặc định</span>}
                  </div>
                  <div style={{ fontSize: '14px', color: '#4F453D', lineHeight: 1.5 }}>{[address.addressLine, address.ward, address.district, address.city].filter(Boolean).join(', ')}</div>
                  {(address.recipientName || address.phone) && <div style={{ fontSize: '12.5px', color: '#86796C', marginTop: '4px' }}>{[address.recipientName, address.phone].filter(Boolean).join(' · ')}</div>}
                  {address.note && <div style={{ fontSize: '12px', color: '#978675', marginTop: '4px' }}>Ghi chú: {address.note}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '5px' }}>
                  {!address.isDefault && <button type="button" onClick={() => makeDefault(address)} title="Đặt mặc định" style={{ border: 'none', background: '#FFF8E8', color: '#997022', borderRadius: '7px', padding: '7px', cursor: 'pointer' }}><Check size={16} /></button>}
                  <button type="button" onClick={() => edit(address)} title="Chỉnh sửa" style={{ border: 'none', background: '#F5F0EA', color: '#6B5A4A', borderRadius: '7px', padding: '7px', cursor: 'pointer' }}><Pencil size={16} /></button>
                  <button type="button" onClick={() => remove(address)} title="Xóa" style={{ border: 'none', background: '#FFF0ED', color: '#B44336', borderRadius: '7px', padding: '7px', cursor: 'pointer' }}><Trash2 size={16} /></button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};