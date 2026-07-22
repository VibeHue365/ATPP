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
  const [planTemplate, setPlanTemplate] = useState<PhotographyPackage | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const summary = useMemo(() => ({
    ACTIVE: packages.filter((item) => item.status === 'ACTIVE').length,
    DRAFT: packages.filter((item) => item.status === 'DRAFT').length,
    INACTIVE: packages.filter((item) => item.status === 'INACTIVE').length,
  }), [packages]);

  const serviceGroups = useMemo(() => {
    const groups = new Map<string, PhotographyPackage[]>();
    packages.forEach((item) => {
      const key = item.serviceGroupId || item._id;
      groups.set(key, [...(groups.get(key) || []), item]);
    });
    return Array.from(groups.entries()).map(([id, plans]) => ({
      id,
      name: plans.find((plan) => plan.serviceName)?.serviceName || plans[0].name,
      plans,
    }));
  }, [packages]);

  if (!enabled) return null;

  const openCreate = () => {
    setEditingPackage(null);
    setPlanTemplate(null);
    setIsFormOpen(true);
  };

  const openAddPlan = (plans: PhotographyPackage[]) => {
    const units = ['PER_SESSION', 'PER_DAY', 'PER_BOOKING'] as const;
    const nextUnit = units.find((unit) => !plans.some((plan) => (plan.pricingUnit || 'PER_SESSION') === unit));
    if (!nextUnit) {
      toast.error('Dịch vụ đã có đủ ba cách tính giá.');
      return;
    }
    const anchor = plans[0];
    const defaultPlanName = nextUnit === 'PER_DAY' ? 'Gói theo ngày' : nextUnit === 'PER_BOOKING' ? 'Gói trọn booking' : 'Gói theo buổi';
    setEditingPackage(null);
    setPlanTemplate({
      ...anchor,
      _id: '',
      serviceGroupId: anchor.serviceGroupId || anchor._id,
      serviceName: anchor.serviceName || anchor.name,
      planName: defaultPlanName,
      name: `${anchor.serviceName || anchor.name} · ${defaultPlanName}`,
      pricingUnit: nextUnit,
      price: 0,
    });
    setIsFormOpen(true);
  };

  const submit = async (payload: PhotographyPackagePayload | PhotographyPackagePayload[]) => {
    setIsSaving(true);
    let createdCount = 0;
    try {
      if (editingPackage) {
        const editPayload = Array.isArray(payload) ? payload[0] : payload;
        await update(editingPackage._id, editPayload);
        toast.success(editPayload.status === 'ACTIVE' ? 'Đã cập nhật và đăng bán gói chụp.' : 'Đã lưu thay đổi gói chụp.');
      } else {
        const payloads = Array.isArray(payload) ? payload : [payload];
        const inheritedGroupId = payloads.find((item) => item.serviceGroupId)?.serviceGroupId;
        const serviceGroupId = inheritedGroupId || globalThis.crypto?.randomUUID?.() || `photo-service-${Date.now()}`;
        for (const item of payloads) {
          await create({ ...item, serviceGroupId });
          createdCount += 1;
        }
        toast.success(payloads.length > 1
          ? `Đã ${payloads[0].status === 'ACTIVE' ? 'đăng bán' : 'lưu nháp'} ${payloads.length} gói trong cùng một sản phẩm chụp ảnh.`
          : payloads[0].status === 'ACTIVE' ? 'Đã đăng bán gói chụp ảnh.' : 'Đã lưu gói chụp vào bản nháp.');
      }
      await refresh();
      setIsFormOpen(false);
      setEditingPackage(null);
      setPlanTemplate(null);
    } catch (requestError: unknown) {
      toast.error(createdCount > 0
        ? `Đã tạo ${createdCount} gói nhưng các gói còn lại chưa lưu được. Hãy kiểm tra lại dữ liệu.`
        : errorMessage(requestError, 'Không thể lưu gói chụp ảnh.'));
      await refresh();
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
          <Plus size={17} /> Tạo sản phẩm & các gói giá
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
          <button type="button" className="photography-package-button photography-package-button--primary" onClick={openCreate}><Plus size={17} /> Tạo sản phẩm và các gói giá đầu tiên</button>
        </section>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {serviceGroups.map((group) => (
            <section key={group.id} style={{ padding: '18px', border: '1px solid var(--color-light-border)', borderRadius: '14px', background: '#fff' }}>
              <header style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '14px' }}>
                <div><small style={{ color: 'var(--color-text-secondary)', fontWeight: 700 }}>SẢN PHẨM CHỤP ẢNH</small><h3 style={{ margin: '3px 0 0' }}>{group.name}</h3></div>
                <button type="button" className="photography-package-button photography-package-button--secondary" onClick={() => openAddPlan(group.plans)} disabled={group.plans.length >= 3}><Plus size={15} /> Thêm lựa chọn giá</button>
              </header>
              <div className="photography-package-manager__grid">
                {group.plans.map((item) => <PhotographyPackageCard key={item._id} photographyPackage={item} isBusy={busyId === item._id} onEdit={(selected) => { setPlanTemplate(null); setEditingPackage(selected); setIsFormOpen(true); }} onTogglePublication={(selected) => void togglePublication(selected)} />)}
              </div>
            </section>
          ))}
        </div>
      )}

      {isFormOpen && <PhotographyPackageFormModal isOpen isSaving={isSaving} initialPackage={editingPackage || planTemplate} isNewPlan={Boolean(planTemplate)} onClose={() => { if (!isSaving) { setIsFormOpen(false); setEditingPackage(null); setPlanTemplate(null); } }} onSubmit={submit} />}
    </main>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: 'active' | 'draft' | 'inactive' }) {
  return <div className={`photography-package-summary-card photography-package-summary-card--${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}
