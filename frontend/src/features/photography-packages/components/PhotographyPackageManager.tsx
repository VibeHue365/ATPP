import { useMemo, useState } from 'react';
import { Camera, CircleAlert, LoaderCircle, Plus } from 'lucide-react';
import { useToast } from '../../../components/feedback/Toast';
import { usePhotographyPackages } from '../hooks/usePhotographyPackages';
import type { PhotographyPackage, PhotographyPackagePayload } from '../types/photographyPackage.types';
import { PhotographyPackageCard } from './PhotographyPackageCard';
import { PhotographyPackageFormModal } from './PhotographyPackageFormModal';
import './photographyPackages.css';

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

interface PhotographyPackageManagerProps {
  enabled: boolean;
}

export function PhotographyPackageManager({ enabled }: PhotographyPackageManagerProps) {
  const toast = useToast();
  const { packages, isLoading, error, refresh, create, update, publish, unpublish } = usePhotographyPackages(enabled);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<PhotographyPackage | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const summary = useMemo(() => ({
    ACTIVE: packages.filter((item) => item.status === 'ACTIVE').length,
    DRAFT: packages.filter((item) => item.status === 'DRAFT').length,
    INACTIVE: packages.filter((item) => item.status === 'INACTIVE').length,
  }), [packages]);

  if (!enabled) return null;

  const openCreate = () => {
    setEditingPackage(null);
    setIsFormOpen(true);
  };

  const submit = async (payload: PhotographyPackagePayload) => {
    setIsSaving(true);
    try {
      if (editingPackage) {
        await update(editingPackage._id, payload);
        toast.success(payload.status === 'ACTIVE' ? 'Đã cập nhật và đăng bán gói chụp.' : 'Đã lưu thay đổi gói chụp.');
      } else {
        await create(payload);
        toast.success(payload.status === 'ACTIVE' ? 'Đã đăng bán gói chụp ảnh.' : 'Đã lưu gói chụp vào bản nháp.');
      }
      setIsFormOpen(false);
      setEditingPackage(null);
    } catch (requestError: unknown) {
      toast.error(errorMessage(requestError, 'Không thể lưu gói chụp ảnh.'));
    } finally {
      setIsSaving(false);
    }
  };

  const togglePublication = async (item: PhotographyPackage) => {
    const shouldUnpublish = item.status === 'ACTIVE';
    if (shouldUnpublish && !window.confirm(`Tạm ngưng “${item.name}”? Khách sẽ không thể đặt gói này.`)) return;
    setBusyId(item._id);
    try {
      if (shouldUnpublish) {
        await unpublish(item._id);
        toast.success('Đã tạm ngưng gói chụp.');
      } else {
        await publish(item._id);
        toast.success('Gói chụp đã được đăng bán.');
      }
    } catch (requestError: unknown) {
      toast.error(errorMessage(requestError, 'Không thể cập nhật trạng thái gói chụp.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="photography-package-manager">
      <header className="photography-package-manager__header">
        <div>
          <p className="photography-package-manager__eyebrow"><Camera size={16} /> DỊCH VỤ NHIẾP ẢNH</p>
          <h2>Quản lý gói chụp ảnh</h2>
          <p>Tạo các dịch vụ để khách biết chính xác quyền lợi và có thể đặt lịch với bạn.</p>
        </div>
        <button type="button" className="photography-package-button photography-package-button--primary" onClick={openCreate}>
          <Plus size={17} /> Tạo gói chụp
        </button>
      </header>

      <section className="photography-package-manager__summary" aria-label="Thống kê gói chụp">
        <SummaryCard label="Đang hoạt động" value={summary.ACTIVE} tone="active" />
        <SummaryCard label="Bản nháp" value={summary.DRAFT} tone="draft" />
        <SummaryCard label="Tạm ngưng" value={summary.INACTIVE} tone="inactive" />
      </section>

      {isLoading ? <div className="photography-package-manager__state"><LoaderCircle className="photography-package-form__spin" /> Đang tải gói chụp...</div> : error ? (
        <div className="photography-package-manager__state photography-package-manager__state--error"><CircleAlert size={19} /><span>{error}</span><button type="button" onClick={() => void refresh()}>Tải lại</button></div>
      ) : packages.length === 0 ? (
        <section className="photography-package-manager__empty">
          <div><Camera size={30} /></div>
          <h3>Bạn chưa có gói chụp nào</h3>
          <p>Portfolio giúp khách biết phong cách của bạn. Gói chụp cho họ biết giá, thời lượng và quyền lợi để đặt lịch.</p>
          <button type="button" className="photography-package-button photography-package-button--primary" onClick={openCreate}><Plus size={17} /> Tạo gói chụp đầu tiên</button>
        </section>
      ) : (
        <section className="photography-package-manager__grid">
          {packages.map((item) => <PhotographyPackageCard key={item._id} photographyPackage={item} isBusy={busyId === item._id} onEdit={(selected) => { setEditingPackage(selected); setIsFormOpen(true); }} onTogglePublication={(selected) => void togglePublication(selected)} />)}
        </section>
      )}

      {isFormOpen && <PhotographyPackageFormModal isOpen isSaving={isSaving} initialPackage={editingPackage} onClose={() => { if (!isSaving) { setIsFormOpen(false); setEditingPackage(null); } }} onSubmit={submit} />}
    </main>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: 'active' | 'draft' | 'inactive' }) {
  return <div className={`photography-package-summary-card photography-package-summary-card--${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}
