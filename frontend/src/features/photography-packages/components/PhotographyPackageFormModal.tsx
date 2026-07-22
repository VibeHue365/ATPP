import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, ImagePlus, LoaderCircle, Trash2, UploadCloud } from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { httpClient } from '../../../services/httpClient';
import { getMediaUrl } from '../../../shared/media/mediaUrl';
import { categoryService } from '../../categories/services/categoryService';
import type { Category } from '../../categories/types';
import type { PhotographyPackage, PhotographyPackagePayload, PhotographyPackageStatus, PhotographyPricingUnit } from '../types/photographyPackage.types';

interface PhotographyPackageFormModalProps {
  isOpen: boolean;
  isSaving?: boolean;
  initialPackage?: PhotographyPackage | null;
  isNewPlan?: boolean;
  onClose: () => void;
  onSubmit: (payload: PhotographyPackagePayload | PhotographyPackagePayload[]) => Promise<void>;
}

interface PricingPlanDraft {
  planName: string;
  price: string;
  durationHours: string;
  includedSessionCount: string;
  includedDayCount: string;
  additionalSessionFee: string;
  editedPhotosCount: string;
  rawPhotosCount: string;
  includesRawPhotos: boolean;
  deliveryDays: string;
  maxPeople: string;
  overtimeFeePerHour: string;
  overtimeIncrementMinutes: string;
  maxOvertimeMinutes: string;
}

const pricingUnits: PhotographyPricingUnit[] = ['PER_SESSION', 'PER_DAY', 'PER_BOOKING'];
const defaultPlanName = (unit: PhotographyPricingUnit) => unit === 'PER_DAY' ? 'Gói theo ngày' : unit === 'PER_BOOKING' ? 'Gói trọn booking' : 'Gói theo buổi';
const createPlanDraft = (unit: PhotographyPricingUnit, initialPackage?: PhotographyPackage | null): PricingPlanDraft => ({
  planName: initialPackage?.planName || defaultPlanName(unit),
  price: initialPackage ? String(initialPackage.price) : '',
  durationHours: initialPackage ? String(initialPackage.durationHours) : '1',
  includedSessionCount: String(initialPackage?.includedSessionCount || 1),
  includedDayCount: String(initialPackage?.includedDayCount || 1),
  additionalSessionFee: String(initialPackage?.additionalSessionFee || 0),
  editedPhotosCount: initialPackage ? String(initialPackage.editedPhotosCount) : '',
  rawPhotosCount: initialPackage ? String(initialPackage.rawPhotosCount || 0) : '0',
  includesRawPhotos: Boolean(initialPackage?.rawPhotosCount),
  deliveryDays: initialPackage ? String(initialPackage.deliveryDays) : '1',
  maxPeople: initialPackage ? String(initialPackage.maxPeople || 1) : '1',
  overtimeFeePerHour: initialPackage ? String(initialPackage.overtimeFeePerHour || 0) : '0',
  overtimeIncrementMinutes: String(initialPackage?.overtimeIncrementMinutes || 30),
  maxOvertimeMinutes: String(initialPackage?.maxOvertimeMinutes ?? 240),
});

const numberValue = (value: string, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const normalizeForMatching = (value: string) => value
  .toLocaleLowerCase('vi-VN')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd');

const fallbackKeywordsForPhotographyCategory = (category: Category) => {
  const categoryText = normalizeForMatching(`${category.name} ${category.slug} ${category.description || ''} ${category.metadata?.occasion || ''}`);
  if (/(cuoi|wedding|an hoi|pre-wedding|pre wedding|co dau|chu re)/.test(categoryText)) {
    return ['cuoi', 'wedding', 'an hoi', 'pre wedding', 'dam cuoi', 'co dau', 'chu re', 'bridal'];
  }
  if (/(ky yeu|tot nghiep|graduation)/.test(categoryText)) {
    return ['ky yeu', 'tot nghiep', 'graduation', 'sinh vien'];
  }
  if (/(ao dai|co phuc|truyen thong|heritage)/.test(categoryText)) {
    return ['ao dai', 'co phuc', 'truyen thong', 'heritage', 'hue'];
  }
  if (/(su kien|event|le hoi|festival)/.test(categoryText)) {
    return ['su kien', 'event', 'le hoi', 'festival', 'bieu dien'];
  }
  if (/(studio|chan dung|portrait|ca nhan)/.test(categoryText)) {
    return ['studio', 'chan dung', 'portrait', 'ca nhan'];
  }
  return [];
};

const isTagRelevantToPhotographyCategory = (tag: Category, photographyCategory: Category) => {
  const configuredCategoryIds = tag.metadata?.photographyCategoryIds || [];
  if (configuredCategoryIds.length > 0) return configuredCategoryIds.includes(photographyCategory.id);

  const keywords = fallbackKeywordsForPhotographyCategory(photographyCategory);
  if (keywords.length === 0) return false;
  const tagText = normalizeForMatching(`${tag.name} ${tag.slug} ${tag.description || ''} ${tag.metadata?.occasion || ''}`);
  return keywords.some((keyword) => tagText.includes(keyword));
};

export function PhotographyPackageFormModal({
  isOpen,
  isSaving = false,
  initialPackage = null,
  isNewPlan = false,
  onClose,
  onSubmit,
}: PhotographyPackageFormModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [packageCategories, setPackageCategories] = useState<Category[]>([]);
  const [conceptCategories, setConceptCategories] = useState<Category[]>([]);
  const [styleCategories, setStyleCategories] = useState<Category[]>([]);
  const [eventCategories, setEventCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState(() => initialPackage?.categoryId || '');
  const [conceptCategoryIds, setConceptCategoryIds] = useState<string[]>(() => initialPackage?.conceptCategoryIds || []);
  const [styleCategoryIds, setStyleCategoryIds] = useState<string[]>(() => initialPackage?.styleCategoryIds || []);
  const [eventCategoryIds, setEventCategoryIds] = useState<string[]>(() => initialPackage?.eventCategoryIds || []); const [serviceGroupId] = useState(() => initialPackage?.serviceGroupId || initialPackage?._id || '');
  const [serviceName, setServiceName] = useState(() => initialPackage?.serviceName || initialPackage?.name || '');
  const [description, setDescription] = useState(() => initialPackage?.description || '');
  const [pricingUnit, setPricingUnit] = useState<PhotographyPricingUnit>(() => initialPackage?.pricingUnit || 'PER_SESSION');
  const [selectedPricingUnits, setSelectedPricingUnits] = useState<PhotographyPricingUnit[]>(() => initialPackage ? [initialPackage.pricingUnit || 'PER_SESSION'] : pricingUnits);
  const [planDrafts, setPlanDrafts] = useState<Record<PhotographyPricingUnit, PricingPlanDraft>>(() => ({
    PER_SESSION: createPlanDraft('PER_SESSION', initialPackage?.pricingUnit === 'PER_SESSION' || !initialPackage?.pricingUnit ? initialPackage : null),
    PER_DAY: createPlanDraft('PER_DAY', initialPackage?.pricingUnit === 'PER_DAY' ? initialPackage : null),
    PER_BOOKING: createPlanDraft('PER_BOOKING', initialPackage?.pricingUnit === 'PER_BOOKING' ? initialPackage : null),
  }));
  const [travelFeeNotes, setTravelFeeNotes] = useState(() => initialPackage?.travelFeeNotes || '');
  const [images, setImages] = useState<string[]>(() => initialPackage?.images || []);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const canCreateMultiplePlans = !initialPackage;
  const activePlan = planDrafts[pricingUnit];
  const selectedPhotographyCategory = packageCategories.find((category) => category.id === categoryId);
  const relevantConceptCategories = useMemo(() => selectedPhotographyCategory
    ? conceptCategories.filter((category) => isTagRelevantToPhotographyCategory(category, selectedPhotographyCategory))
    : [], [conceptCategories, selectedPhotographyCategory]);
  const relevantStyleCategories = useMemo(() => selectedPhotographyCategory
    ? styleCategories.filter((category) => isTagRelevantToPhotographyCategory(category, selectedPhotographyCategory))
    : [], [styleCategories, selectedPhotographyCategory]);
  const relevantEventCategories = useMemo(() => selectedPhotographyCategory
    ? eventCategories.filter((category) => isTagRelevantToPhotographyCategory(category, selectedPhotographyCategory))
    : [], [eventCategories, selectedPhotographyCategory]);
  const updateActivePlan = (patch: Partial<PricingPlanDraft>) => setPlanDrafts((current) => ({
    ...current,
    [pricingUnit]: { ...current[pricingUnit], ...patch },
  }));

  const steps = ['Thông tin chung', 'Chọn gói giá', 'Cấu hình từng gói', 'Kiểm tra & lưu'];
  const goToNextStep = () => {
    if (currentStep === 1 && (!categoryId || !serviceName.trim())) {
      setError('Vui lòng chọn danh mục và nhập tên dịch vụ trước khi tiếp tục.');
      return;
    }
    if (currentStep === 2 && selectedPricingUnits.length === 0) {
      setError('Cần chọn ít nhất một loại gói giá.');
      return;
    }
    if (currentStep === 3) {
      for (const unit of selectedPricingUnits) {
        const plan = planDrafts[unit];
        if (!plan.planName.trim() || numberValue(plan.durationHours) < 0.5 || plan.price.trim() === '' || numberValue(plan.price) < 0) {
          setPricingUnit(unit);
          setError(`Vui lòng hoàn tất tên, giá và thời lượng của ${defaultPlanName(unit).toLowerCase()}.`);
          return;
        }
      }
    }
    setError(null);
    setCurrentStep((step) => Math.min(4, step + 1));
  };


  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    void Promise.all([
      categoryService.getPublic({ type: 'PHOTOGRAPHY_CATEGORY' }),
      categoryService.getPublic({ type: 'CONCEPT' }),
      categoryService.getPublic({ type: 'STYLE' }),
      categoryService.getPublic({ type: 'EVENT' }),
    ])
      .then(([packages, concepts, styles, events]) => {
        if (!active) return;
        setPackageCategories(packages);
        setConceptCategories(concepts);
        setStyleCategories(styles);
        setEventCategories(events);
      })
      .catch((categoryError: unknown) => {
        if (active) setError(errorMessage(categoryError, 'Không thể tải danh mục. Vui lòng thử lại.'));
      });
    return () => { active = false; };
  }, [isOpen]);

  const toggleCategory = (
    id: string,
    setValue: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    setValue((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  };
  const changePhotographyCategory = (nextCategoryId: string) => {
    setCategoryId(nextCategoryId);
    const nextCategory = packageCategories.find((category) => category.id === nextCategoryId);
    if (!nextCategory) {
      setConceptCategoryIds([]);
      setStyleCategoryIds([]);
      setEventCategoryIds([]);
      return;
    }
    const relevantIds = (categories: Category[]) => new Set(categories
      .filter((category) => isTagRelevantToPhotographyCategory(category, nextCategory))
      .map((category) => category.id));
    const conceptIds = relevantIds(conceptCategories);
    const styleIds = relevantIds(styleCategories);
    const eventIds = relevantIds(eventCategories);
    setConceptCategoryIds((current) => current.filter((id) => conceptIds.has(id)));
    setStyleCategoryIds((current) => current.filter((id) => styleIds.has(id)));
    setEventCategoryIds((current) => current.filter((id) => eventIds.has(id)));
  };
  const uploadFiles = async (files: FileList) => {
    if (!files.length) return;
    setIsUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append('images', file));
      const response = await httpClient.post<{ urls: string[] }>('/products/upload', formData);
      setImages((current) => [...new Set([...current, ...(response.urls || [])])]);
    } catch (uploadError: unknown) {
      setError(errorMessage(uploadError, 'Không thể tải ảnh lên. Vui lòng thử lại.'));
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= images.length) return;
    setImages((current) => {
      const next = [...current];
      [next[index], next[destination]] = [next[destination], next[index]];
      return next;
    });
  };

  const submit = async (status: PhotographyPackageStatus) => {
    const normalizedServiceName = serviceName.trim();
    const unitsToSubmit = canCreateMultiplePlans ? selectedPricingUnits : [pricingUnit];
    if (!normalizedServiceName || !categoryId || unitsToSubmit.length === 0) {
      setError('Vui lòng chọn danh mục, nhập tên dịch vụ và chọn ít nhất một loại gói.');
      return;
    }

    if (status === 'ACTIVE' && !images.length) {
      setError('Thêm ít nhất một ảnh minh họa trước khi đăng bán gói chụp.');
      return;
    }

    const payloads: PhotographyPackagePayload[] = [];
    for (const unit of unitsToSubmit) {
      const plan = planDrafts[unit];
      const normalizedPlanName = plan.planName.trim();
      const normalizedPrice = numberValue(plan.price);
      const normalizedDuration = numberValue(plan.durationHours);
      const normalizedEditedPhotos = numberValue(plan.editedPhotosCount);
      const normalizedDeliveryDays = numberValue(plan.deliveryDays);
      const normalizedMaxPeople = numberValue(plan.maxPeople, 1);
      const includedDurationMinutes = Math.round(normalizedDuration * 60);
      const normalizedIncludedSessions = numberValue(plan.includedSessionCount);
      const normalizedIncludedDays = numberValue(plan.includedDayCount);
      const normalizedOvertimeIncrement = numberValue(plan.overtimeIncrementMinutes);
      const normalizedMaxOvertime = numberValue(plan.maxOvertimeMinutes);
      if (!normalizedPlanName || normalizedPrice < 0 || normalizedDuration < 0.5 || normalizedEditedPhotos < 0 || normalizedDeliveryDays < 0 || normalizedMaxPeople < 1) {
        setPricingUnit(unit);
        setError(`Thông tin ${defaultPlanName(unit).toLowerCase()} chưa hợp lệ.`);
        return;
      }
      if (status === 'ACTIVE' && normalizedPrice <= 0) {
        setPricingUnit(unit);
        setError(`Giá ${defaultPlanName(unit).toLowerCase()} phải lớn hơn 0 trước khi đăng bán.`);
        return;
      }
      if (normalizedOvertimeIncrement < 30 || includedDurationMinutes % normalizedOvertimeIncrement !== 0 || normalizedMaxOvertime < 0 || normalizedMaxOvertime % normalizedOvertimeIncrement !== 0) {
        setPricingUnit(unit);
        setError(`Thời lượng và giới hạn tăng giờ của ${defaultPlanName(unit).toLowerCase()} phải chia hết cho bước tăng giờ.`);
        return;
      }
      if (unit === 'PER_BOOKING' && (normalizedIncludedSessions < 1 || normalizedIncludedDays < 1 || normalizedIncludedSessions < normalizedIncludedDays)) {
        setPricingUnit(unit);
        setError('Gói trọn booking cần số buổi, số ngày hợp lệ; số buổi không được ít hơn số ngày.');
        return;
      }
      payloads.push({
        categoryId,
        conceptCategoryIds,
        styleCategoryIds,
        eventCategoryIds,
        name: `${normalizedServiceName} · ${normalizedPlanName}`,
        serviceGroupId: serviceGroupId || undefined,
        serviceName: normalizedServiceName,
        planName: normalizedPlanName,
        description: description.trim() || undefined,
        price: normalizedPrice,
        durationHours: normalizedDuration,
        pricingUnit: unit,
        includedDurationMinutes,
        includedSessionCount: unit === 'PER_BOOKING' ? normalizedIncludedSessions : undefined,
        includedDayCount: unit === 'PER_BOOKING' ? normalizedIncludedDays : undefined,
        additionalSessionFee: unit === 'PER_BOOKING' ? numberValue(plan.additionalSessionFee) : 0,
        overtimeIncrementMinutes: normalizedOvertimeIncrement,
        maxOvertimeMinutes: normalizedMaxOvertime,
        maxPeople: normalizedMaxPeople,
        editedPhotosCount: normalizedEditedPhotos,
        rawPhotosCount: plan.includesRawPhotos ? numberValue(plan.rawPhotosCount) : 0,
        deliveryDays: normalizedDeliveryDays,
        overtimeFeePerHour: numberValue(plan.overtimeFeePerHour),
        travelFeeNotes: travelFeeNotes.trim() || undefined,
        images,
        status,
      });
    }

    setError(null);
    await onSubmit(payloads.length === 1 ? payloads[0] : payloads);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isNewPlan ? 'Thêm lựa chọn giá' : initialPackage ? 'Chỉnh sửa gói giá' : 'Tạo sản phẩm chụp ảnh'} maxWidth="1020px">
      <div className="photography-package-form">
        <div className="photography-package-form__intro">
          {isNewPlan && <p style={{ margin: 0, color: '#6b5f55', fontSize: '12px' }}>Thông tin chung được kế thừa từ sản phẩm; bạn chỉ cần đặt tên và cấu hình giá cho lựa chọn mới.</p>}
          <ImagePlus size={20} />
          <p>Gói chụp đang hoạt động sẽ hiển thị để khách có thể xem và đặt lịch. Bạn có thể lưu nháp để hoàn thiện sau.</p>
        </div>

        <nav aria-label="Các bước tạo gói" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))', gap: '8px', marginBottom: '18px' }}>
          {steps.map((label, index) => {
            const stepNumber = index + 1;
            const active = currentStep === stepNumber;
            const completed = currentStep > stepNumber;
            return <button key={label} type="button" onClick={() => { if (completed) { setError(null); setCurrentStep(stepNumber); } }} style={{ border: active ? '2px solid #8f1d2c' : '1px solid #ded4c6', background: active ? '#fff0f1' : completed ? '#f4f7ef' : '#fff', borderRadius: '10px', padding: '10px 8px', color: active ? '#8f1d2c' : '#5f554c', cursor: completed ? 'pointer' : 'default', textAlign: 'left' }}>
              <small style={{ display: 'block', fontWeight: 800, marginBottom: '3px' }}>{completed ? '✓' : `Bước ${stepNumber}`}</small>
              <span style={{ fontSize: '12px', fontWeight: 700 }}>{label}</span>
            </button>;
          })}
        </nav>

        <div className="photography-package-form__grid" style={currentStep === 1 ? undefined : { gridTemplateColumns: '1fr' }}>
          <section className="photography-package-form__section">
            <h3>{steps[currentStep - 1]}</h3>
            {currentStep === 1 && <>
            <label><span>
              Danh mục nhiếp ảnh <b>*</b>
            </span>
              <select value={categoryId} onChange={(event) => changePhotographyCategory(event.target.value)}>
                <option value="">Chọn danh mục dịch vụ</option>
                {packageCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            {selectedPhotographyCategory && <p style={{ margin: '-3px 0 13px', color: '#756b62', fontSize: '12px', lineHeight: 1.5 }}>
              {selectedPhotographyCategory.description || `Chỉ hiển thị concept, phong cách và sự kiện phù hợp với ${selectedPhotographyCategory.name}.`}
            </p>}
            {([
              ['Concept chụp phù hợp', relevantConceptCategories, conceptCategoryIds, setConceptCategoryIds],
              ['Phong cách phù hợp', relevantStyleCategories, styleCategoryIds, setStyleCategoryIds],
              ['Sự kiện phù hợp', relevantEventCategories, eventCategoryIds, setEventCategoryIds],
            ] as Array<[string, Category[], string[], React.Dispatch<React.SetStateAction<string[]>>]>).map(([label, categories, selectedIds, setSelectedIds]) => (
              <div key={label} style={{ marginBottom: '13px' }}>
                <strong style={{ display: 'block', marginBottom: '7px', color: '#4d453e', fontSize: '12px' }}>{label}</strong>
                {selectedPhotographyCategory && categories.length === 0 ? <small style={{ display: 'block', color: '#8a8179', padding: '8px 10px', border: '1px dashed #ded4c6', borderRadius: '8px', background: '#fffaf5' }}>Chưa có tag phù hợp được cấu hình cho {selectedPhotographyCategory.name}. Bạn có thể tiếp tục mà không chọn mục này.</small> : <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                  {categories.map((category) => {
                    const selected = selectedIds.includes(category.id);
                    return <button key={category.id} type="button" onClick={() => toggleCategory(category.id, setSelectedIds)} style={{ border: selected ? '1px solid #9f1d27' : '1px solid #ded4c6', borderRadius: '999px', padding: '6px 10px', background: selected ? '#fae9e9' : '#fff', color: selected ? '#7d1520' : '#5e554c', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>{selected ? '✓ ' : ''}{category.name}</button>;
                  })}
                </div>
                }
              </div>
            ))}
            <label><span>Tên dịch vụ chụp ảnh <b>*</b></span><input value={serviceName} onChange={(event) => setServiceName(event.target.value)} maxLength={160} placeholder={selectedPhotographyCategory ? `Ví dụ: Dịch vụ ${selectedPhotographyCategory.name.toLocaleLowerCase('vi-VN')}` : 'Ví dụ: Chụp ảnh theo concept của bạn'} /><small>Thông tin chung để nhóm tất cả lựa chọn giá trong cùng một sản phẩm.</small></label>
            <label>Mô tả <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={4} placeholder="Điểm nổi bật, concept và những trải nghiệm khách nhận được..." /></label>
            </>}
            {currentStep === 2 && <div style={{ margin: '4px 0', padding: '16px', border: '1px solid #e4d8c8', borderRadius: '12px', background: '#fffaf5' }}>
              <strong style={{ display: 'block', marginBottom: '4px', color: '#4d453e' }}>Cách tính giá <b style={{ color: '#9f1d27' }}>*</b></strong>
              <small style={{ display: 'block', marginBottom: '12px', color: '#756b62' }}>{canCreateMultiplePlans ? 'Chọn một hoặc nhiều gói cần tạo. Bấm vào từng gói để cấu hình giá và quyền lợi riêng.' : 'Cấu hình giá theo đúng đơn vị của lựa chọn này.'}</small>
              {canCreateMultiplePlans && <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                {pricingUnits.map((unit) => <label key={unit} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '6px', padding: '7px 10px', border: '1px solid #d9cec1', borderRadius: '8px', background: '#fff', cursor: 'pointer' }}>
                  <input type="checkbox" checked={selectedPricingUnits.includes(unit)} onChange={(event) => {
                    if (event.target.checked) {
                      setSelectedPricingUnits((current) => [...new Set([...current, unit])]);
                      setPricingUnit(unit);
                      setError(null);
                      return;
                    }
                    if (selectedPricingUnits.length === 1) {
                      setError('Cần chọn ít nhất một loại gói.');
                      return;
                    }
                    const remaining = selectedPricingUnits.filter((item) => item !== unit);
                    setSelectedPricingUnits(remaining);
                    if (pricingUnit === unit) setPricingUnit(remaining[0]);
                    setError(null);
                  }} />
                  <span>{defaultPlanName(unit)}</span>
                </label>)}
              </div>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                {([
                  { value: 'PER_SESSION', title: 'Theo buổi', description: 'Mỗi buổi dùng một giá gói và số giờ bao gồm riêng.' },
                  { value: 'PER_DAY', title: 'Theo ngày', description: 'Các buổi cùng ngày dùng chung giá và quỹ giờ trong ngày.' },
                  { value: 'PER_BOOKING', title: 'Trọn booking', description: 'Một giá cố định bao gồm nhiều buổi và nhiều ngày.' },
                ] as const).map((option) => {
                  const active = pricingUnit === option.value;
                  const enabled = selectedPricingUnits.includes(option.value);
                  return <button key={option.value} type="button" disabled={canCreateMultiplePlans && !enabled} onClick={() => {
                    if (!canCreateMultiplePlans) setSelectedPricingUnits([option.value]);
                    setPricingUnit(option.value);
                  }} style={{ padding: '12px', borderRadius: '10px', border: active ? '2px solid #8f1d2c' : enabled ? '1px solid #c99048' : '1px solid #d9cec1', background: active ? '#fff0f1' : enabled ? '#fff8ec' : '#f3f1ee', opacity: enabled ? 1 : 0.55, color: '#4d453e', textAlign: 'left', cursor: enabled ? 'pointer' : 'not-allowed' }}>
                    <strong style={{ display: 'block', color: active || enabled ? '#8f1d2c' : '#4d453e', marginBottom: '4px' }}>{enabled ? '✓ ' : ''}{option.title}</strong>
                    <span style={{ fontSize: '11px', lineHeight: 1.4, color: '#756b62' }}>{option.description}</span>
                    {active && <small style={{ display: 'block', marginTop: '6px', color: '#8f1d2c', fontWeight: 800 }}>Đang chọn để cấu hình</small>}
                  </button>;
                })}
              </div>
              {canCreateMultiplePlans && <small style={{ display: 'block', marginTop: '9px', color: '#756b62' }}>Các gói có dấu ✓ đều sẽ được tạo. Thẻ viền đỏ chỉ là gói đang chọn để cấu hình; bấm thẻ khác để chuyển.</small>}
            </div>}
            {currentStep === 3 && <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                {selectedPricingUnits.map((unit, index) => <button key={unit} type="button" onClick={() => setPricingUnit(unit)} style={{ border: pricingUnit === unit ? '2px solid #8f1d2c' : '1px solid #d9cec1', background: pricingUnit === unit ? '#fff0f1' : '#fff', color: pricingUnit === unit ? '#8f1d2c' : '#514940', borderRadius: '9px', padding: '9px 12px', cursor: 'pointer', fontWeight: 800 }}>
                  {index + 1}. {defaultPlanName(unit)}
                </button>)}
              </div>
              <div style={{ padding: '10px 12px', background: '#fff8ec', borderRadius: '9px', marginBottom: '14px', color: '#6b5742', fontSize: '12px' }}>
                Đang cấu hình <strong>{defaultPlanName(pricingUnit)}</strong>. Thông tin được giữ riêng khi bạn chuyển sang gói khác.
              </div>
              <label><span>Tên lựa chọn giá <b>*</b></span><input value={activePlan.planName} onChange={(event) => updateActivePlan({ planName: event.target.value })} maxLength={120} placeholder="Ví dụ: Gói 2 giờ / Gói nguyên ngày" /></label>
            <div className="photography-package-form__two-columns">
              <label><span>{pricingUnit === 'PER_SESSION' ? 'Giá mỗi buổi (đ)' : pricingUnit === 'PER_DAY' ? 'Giá mỗi ngày (đ)' : 'Giá trọn booking (đ)'} <b>*</b></span><input type="number" min="0" value={activePlan.price} onChange={(event) => updateActivePlan({ price: event.target.value })} placeholder="1500000" /><small>Giá cơ bản theo đúng đơn vị tính đã chọn.</small></label>
              <label><span>{pricingUnit === 'PER_DAY' ? 'Số giờ bao gồm mỗi ngày' : pricingUnit === 'PER_BOOKING' ? 'Tổng số giờ bao gồm' : 'Số giờ bao gồm mỗi buổi'} <b>*</b></span><input type="number" min="0.5" step="0.5" value={activePlan.durationHours} onChange={(event) => updateActivePlan({ durationHours: event.target.value })} /><small>Khách chỉ trả phụ thu khi vượt thời lượng này.</small></label>
              {pricingUnit === 'PER_BOOKING' && <>
                <label><span>Số buổi bao gồm <b>*</b></span><input type="number" min="1" step="1" value={activePlan.includedSessionCount} onChange={(event) => updateActivePlan({ includedSessionCount: event.target.value })} /></label>
                <label><span>Số ngày bao gồm <b>*</b></span><input type="number" min="1" step="1" value={activePlan.includedDayCount} onChange={(event) => updateActivePlan({ includedDayCount: event.target.value })} /></label>
                <label><span>Phụ thu mỗi buổi thêm (đ)</span><input type="number" min="0" value={activePlan.additionalSessionFee} onChange={(event) => updateActivePlan({ additionalSessionFee: event.target.value })} /><small>Áp dụng khi khách đặt vượt số buổi bao gồm.</small></label>
              </>}
              <label><span>Số người chụp tối đa <b>*</b></span><input type="number" min="1" value={activePlan.maxPeople} onChange={(event) => updateActivePlan({ maxPeople: event.target.value })} placeholder="1" /><small>Số người tối đa được chụp trong gói.</small></label>
              <label><span>Ảnh thành phẩm đã chỉnh sửa <b>*</b></span><input type="number" min="0" value={activePlan.editedPhotosCount} onChange={(event) => updateActivePlan({ editedPhotosCount: event.target.value })} placeholder="20" /><small>Ảnh đã chọn lọc, chỉnh màu và gửi cho khách.</small></label>
              <div className="photography-package-form__raw-photos-option">
                <div><strong>Có gửi ảnh gốc cho khách?</strong><small>Ảnh từ máy ảnh, chưa chỉnh sửa.</small></div>
                <button type="button" role="switch" aria-checked={activePlan.includesRawPhotos} className={activePlan.includesRawPhotos ? 'is-enabled' : ''} onClick={() => updateActivePlan({ includesRawPhotos: !activePlan.includesRawPhotos })}>
                  <span aria-hidden="true" />{activePlan.includesRawPhotos ? 'Có cung cấp' : 'Không cung cấp'}
                </button>
                {activePlan.includesRawPhotos && <label>Số ảnh gốc dự kiến<input type="number" min="1" value={activePlan.rawPhotosCount} onChange={(event) => updateActivePlan({ rawPhotosCount: event.target.value })} placeholder="150" /></label>}
              </div>
              <label><span>Trả ảnh sau (ngày) <b>*</b></span><input type="number" min="0" value={activePlan.deliveryDays} onChange={(event) => updateActivePlan({ deliveryDays: event.target.value })} /></label>
              <label><span>Phí tăng giờ (đ/giờ)</span><input type="number" min="0" value={activePlan.overtimeFeePerHour} onChange={(event) => updateActivePlan({ overtimeFeePerHour: event.target.value })} /><small>Để 0: hệ thống tự suy ra từ giá gói và thời lượng bao gồm.</small></label>
              <label><span>Bước tăng giờ (phút)</span><select value={activePlan.overtimeIncrementMinutes} onChange={(event) => updateActivePlan({ overtimeIncrementMinutes: event.target.value })}><option value="30">30 phút</option><option value="60">60 phút</option></select></label>
              <label><span>Tăng giờ tối đa (phút)</span><input type="number" min="0" step={numberValue(activePlan.overtimeIncrementMinutes, 30)} value={activePlan.maxOvertimeMinutes} onChange={(event) => updateActivePlan({ maxOvertimeMinutes: event.target.value })} /><small>Nhập 0 nếu gói không cho phép tăng giờ.</small></label>
            </div>
            <label>Ghi chú di chuyển<textarea value={travelFeeNotes} onChange={(event) => setTravelFeeNotes(event.target.value)} maxLength={500} rows={2} placeholder="Ví dụ: Miễn phí trong nội thành Huế..." /></label>
            </>}
            {currentStep === 4 && <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ padding: '14px', borderRadius: '10px', background: '#f7f4ef', border: '1px solid #e2d9ce' }}>
                <small style={{ color: '#756b62' }}>SẢN PHẨM CHỤP ẢNH</small>
                <strong style={{ display: 'block', marginTop: '4px', color: '#3f3832' }}>{serviceName}</strong>
                <span style={{ display: 'block', marginTop: '4px', color: '#756b62', fontSize: '12px' }}>{selectedPricingUnits.length} gói giá · {images.length} ảnh minh họa</span>
              </div>
              {selectedPricingUnits.map((unit) => {
                const plan = planDrafts[unit];
                return <article key={unit} style={{ padding: '14px', border: '1px solid #ded4c6', borderRadius: '10px', background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                    <div><small style={{ color: '#8f1d2c', fontWeight: 800 }}>{defaultPlanName(unit).toUpperCase()}</small><strong style={{ display: 'block', marginTop: '4px' }}>{plan.planName}</strong></div>
                    <strong style={{ color: '#8f1d2c' }}>{numberValue(plan.price).toLocaleString('vi-VN')}đ</strong>
                  </div>
                  <p style={{ margin: '8px 0 0', color: '#756b62', fontSize: '12px' }}>{plan.durationHours} giờ · tối đa {plan.maxPeople} người · {plan.editedPhotosCount || 0} ảnh chỉnh sửa · trả ảnh sau {plan.deliveryDays} ngày</p>
                </article>;
              })}
              <small style={{ color: '#756b62' }}>Bạn có thể quay lại bước trước để chỉnh sửa. Chỉ khi bấm “Lưu nháp” hoặc “Đăng bán” dữ liệu mới được gửi lên hệ thống.</small>
            </div>}
          </section>

          {currentStep === 1 && <section className="photography-package-form__section">
            <div className="photography-package-form__upload-heading"><h3>Ảnh minh họa</h3><span>{images.length} ảnh</span></div>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(event) => { if (event.target.files) void uploadFiles(event.target.files); }} />
            <div className={`photography-package-form__dropzone ${isDragging ? 'is-dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); void uploadFiles(event.dataTransfer.files); }} onClick={() => inputRef.current?.click()}>
              {isUploading ? <LoaderCircle className="photography-package-form__spin" size={26} /> : <UploadCloud size={26} />}
              <strong>{isUploading ? 'Đang tải ảnh lên...' : 'Chọn hoặc kéo thả nhiều ảnh'}</strong>
              <span>JPG, PNG hoặc WEBP; ảnh đầu tiên sẽ làm ảnh bìa.</span>
            </div>
            {images.length > 0 && <div className="photography-package-form__images">
              {images.map((image, index) => <div className="photography-package-form__image" key={image}>
                <img src={getMediaUrl(image)} alt={`Ảnh gói chụp ${index + 1}`} />
                {index === 0 && <span>Ảnh bìa</span>}
                <div className="photography-package-form__image-actions">
                  <button type="button" title="Đưa ảnh về trước" disabled={index === 0} onClick={() => moveImage(index, -1)}><ArrowLeft size={14} /></button>
                  <button type="button" title="Đưa ảnh về sau" disabled={index === images.length - 1} onClick={() => moveImage(index, 1)}><ArrowRight size={14} /></button>
                  <button type="button" title="Xóa ảnh" onClick={() => setImages((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={14} /></button>
                </div>
              </div>)}
            </div>}
          </section>}
        </div>

        {error && <p className="photography-package-form__error"><AlertCircle size={16} /> {error}</p>}
        <div className="photography-package-form__actions">
          <button type="button" className="photography-package-button photography-package-button--secondary" onClick={onClose} disabled={isSaving || isUploading}>Hủy</button>
          {currentStep > 1 && <button type="button" className="photography-package-button photography-package-button--secondary" onClick={() => { setError(null); setCurrentStep((step) => Math.max(1, step - 1)); }} disabled={isSaving || isUploading}><ArrowLeft size={15} /> Quay lại</button>}
          {currentStep < 4 ? (
            <button type="button" className="photography-package-button photography-package-button--primary" onClick={goToNextStep} disabled={isSaving || isUploading}>Tiếp tục <ArrowRight size={15} /></button>
          ) : <>
            <button type="button" className="photography-package-button photography-package-button--secondary" onClick={() => void submit('DRAFT')} disabled={isSaving || isUploading}>{isSaving ? 'Đang lưu...' : `Lưu nháp${canCreateMultiplePlans ? ` ${selectedPricingUnits.length} gói` : ''}`}</button>
            <button type="button" className="photography-package-button photography-package-button--primary" onClick={() => void submit('ACTIVE')} disabled={isSaving || isUploading}>{isSaving ? 'Đang lưu...' : `Đăng bán${canCreateMultiplePlans ? ` ${selectedPricingUnits.length} gói` : ' gói'}`}</button>
          </>}
        </div>
      </div>
    </Modal>
  );
}
