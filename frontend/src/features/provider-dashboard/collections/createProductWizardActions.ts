import React from 'react';
import Swal from 'sweetalert2';
import type { useToast } from '../../../components/feedback/Toast';
import { inventoryApi, productsApi } from '../api/providerDashboardApi';
import { colorLabels, DEFAULT_PRODUCT_IMAGE, TAG_TO_EVENT_SLUG, TAG_TO_OCCASION, TAG_TO_STYLE, TAG_TO_STYLE_SLUG } from '../constants';
import type { Product, VariantRow } from '../types';
import { emptyVariant, normalizeCategoryIds, normalizeVariants } from './productHelpers';
import type { useProductWizardState } from './useProductWizardState';
import type { useProviderProductsState } from './useProviderProductsState';

type Dependencies = Pick<ReturnType<typeof useProductWizardState>,
  'setEditingProduct' | 'setProdName' | 'setProdDescription' | 'setProdBasePrice' | 'setProdDepositAmount' | 'setProdSizes' | 'setProdColors' | 'setProdMaterials' | 'setProdStatus' | 'setProdImages' | 'setProdColorImages' | 'setProdVideos' | 'setProdStyle' | 'setProdOccasions' | 'setProdStyleCategoryIds' | 'setProdEventCategoryIds' | 'setVariants' | 'setWizardStep' | 'setCreatedDraftId' | 'setActiveTagCodes' | 'setProdCategoryId' | 'setIsModalOpen' | 'setEditInvSummary' | 'setUploadingImages' | 'prodVideos' | 'setUploadingVideos' | 'editingProduct' | 'editInvSummary' | 'variants' | 'setUploadingColor' | 'prodImages' | 'prodColorImages' | 'prodName' | 'prodCategoryId' | 'prodDescription' | 'prodBasePrice' | 'prodDepositAmount' | 'prodStatus' | 'prodStyle' | 'prodOccasions' | 'prodStyleCategoryIds' | 'prodEventCategoryIds' | 'wizardStep' | 'setSavingDraft' | 'createdDraftId' | 'activeTagCodes'
> &
  Pick<ReturnType<typeof useProviderProductsState>,
    'categories' | 'styleCategories' | 'eventCategories'
  > &
{
  toast: ReturnType<typeof useToast>;
  fetchProducts: () => Promise<void>;
};

/** Recreated each render so handlers retain the dashboard's existing closure semantics. */
export function createProductWizardActions({
  setEditingProduct, setProdName, setProdDescription, setProdBasePrice, setProdDepositAmount,
  setProdSizes, setProdColors, setProdMaterials, setProdStatus, setProdImages, setProdColorImages,
  setProdVideos, setProdStyle, setProdOccasions, setProdStyleCategoryIds, setProdEventCategoryIds,
  setVariants, setWizardStep, setCreatedDraftId, setActiveTagCodes, categories, setProdCategoryId,
  setIsModalOpen, setEditInvSummary, setUploadingImages, toast, prodVideos, setUploadingVideos,
  editingProduct, editInvSummary, variants, setUploadingColor, prodImages, prodColorImages, prodName,
  prodCategoryId, prodDescription, prodBasePrice, prodDepositAmount, prodStatus, prodStyle,
  prodOccasions, prodStyleCategoryIds, prodEventCategoryIds, wizardStep, setSavingDraft, createdDraftId,
  activeTagCodes, styleCategories, eventCategories, fetchProducts,
}: Dependencies) {
  void categories;
  const openAddModal = () => {
    setEditingProduct(null);
    setProdName('');
    setProdDescription('');
    setProdBasePrice('');
    setProdDepositAmount('');
    setProdSizes([]);
    setProdColors([]);
    setProdMaterials([]);
    setProdStatus('DRAFT');
    setProdImages([]);
    setProdColorImages({});
    setProdVideos([]);
    setProdStyle('traditional');
    setProdOccasions([]);
    setProdStyleCategoryIds([]);
    setProdEventCategoryIds([]);
    setVariants([]);
    setWizardStep(1);
    setCreatedDraftId(null);
    setActiveTagCodes([]);
    setProdCategoryId('');
    setIsModalOpen(true);
  };

  const loadEditInvSummary = async (productId: string) => {
    try {
      const summary: any = await inventoryApi.getSummary();
      setEditInvSummary((Array.isArray(summary) ? summary : []).filter((row: any) => row.productId === productId));
    } catch {
      setEditInvSummary([]);
    }
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setProdName(p.name);
    setProdCategoryId(typeof p.categoryId === 'object' ? p.categoryId._id : p.categoryId);
    setProdDescription(p.description || '');
    setProdBasePrice(p.basePrice.toString());
    setProdDepositAmount(p.depositAmount.toString());
    setProdSizes(p.sizes || []);
    setProdColors(p.colors || []);
    setProdMaterials(p.materials || []);
    setProdStatus(p.status);
    const loadedColorImages: Record<string, string[]> = {};
    (p.colorImages || []).forEach(entry => {
      if (entry?.color) loadedColorImages[entry.color] = [...(entry.images || [])];
    });
    setProdColorImages(loadedColorImages);
    const taggedUrls = new Set(Object.values(loadedColorImages).flat());
    setProdImages((p.images || []).filter(url => !taggedUrls.has(url)));
    setProdVideos(p.videos || []);
    setProdStyle(p.style || 'traditional');
    setProdOccasions(p.occasions || []);
    setProdStyleCategoryIds(normalizeCategoryIds(p.styleCategoryIds));
    setProdEventCategoryIds(normalizeCategoryIds(p.eventCategoryIds));
    setVariants([]);
    setWizardStep(1);
    setCreatedDraftId(null);
    setActiveTagCodes([]);
    void loadEditInvSummary(p._id);
    setIsModalOpen(true);
  };

  const handleDuplicateProduct = (p: Product) => {
    setEditingProduct(null);
    setProdName('');
    setProdCategoryId(typeof p.categoryId === 'object' ? p.categoryId._id : p.categoryId);
    setProdDescription(p.description || '');
    setProdBasePrice(p.basePrice.toString());
    setProdDepositAmount(p.depositAmount.toString());
    setProdSizes(p.sizes || []);
    setProdColors(p.colors || []);
    setProdMaterials(p.materials || []);
    setProdStatus(p.status);
    setProdImages([]);
    setProdColorImages({});
    setProdVideos([]);
    setProdStyle(p.style ? p.style.toLowerCase() : 'traditional');
    setProdOccasions(p.occasions || []);
    setProdStyleCategoryIds(normalizeCategoryIds(p.styleCategoryIds));
    setProdEventCategoryIds(normalizeCategoryIds(p.eventCategoryIds));
    // Sao chép biến thể từ áo gốc (số lượng đặt lại = 1 để provider tự nhập).
    const dupSizes = p.sizes && p.sizes.length ? p.sizes : ['M'];
    const dupColors = p.colors && p.colors.length ? p.colors : ['RED'];
    const dupMaterial = p.materials && p.materials.length ? p.materials[0] : 'SILK';
    const dupVariants: VariantRow[] = [];
    for (const s of dupSizes) for (const c of dupColors) dupVariants.push({ size: s, color: c, material: dupMaterial, quantity: 1, condition: 'GOOD' });
    setVariants(dupVariants.length ? dupVariants : [emptyVariant()]);
    setWizardStep(1);
    setCreatedDraftId(null);
    setActiveTagCodes([]);
    setIsModalOpen(true);
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setUploadingImages(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < e.target.files.length; i++) {
        formData.append('images', e.target.files[i]);
      }
      const res = await productsApi.uploadImages<{ urls: string[] }>(formData);
      setProdImages(prev => [...prev, ...res.urls]);
      toast.success('Đã tải lên hình ảnh thành công!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Tải ảnh lên thất bại');
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (index: number) => {
    setProdImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    if (prodVideos.length + e.target.files.length > 2) {
      toast.error('Tối đa 2 video cho mỗi sản phẩm');
      e.target.value = '';
      return;
    }
    setUploadingVideos(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < e.target.files.length; i++) {
        formData.append('videos', e.target.files[i]);
      }
      const res = await productsApi.uploadVideos<{ urls: string[] }>(formData);
      setProdVideos(prev => [...prev, ...res.urls]);
      toast.success('Đã tải video lên thành công!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Tải video lên thất bại');
    } finally {
      setUploadingVideos(false);
      e.target.value = '';
    }
  };

  const removeVideo = (index: number) => {
    setProdVideos(prev => prev.filter((_, i) => i !== index));
  };

  const addVariantRow = () => setVariants(prev => [...prev, emptyVariant()]);

  const removeVariantRow = (idx: number) => setVariants(prev => prev.filter((_, i) => i !== idx));

  const updateVariantRow = (idx: number, field: keyof VariantRow, value: string | number) =>
    setVariants(prev => prev.map((v, i) => (i === idx ? { ...v, [field]: value } : v)));

  const colorsNeedingImages = (): string[] => {
    // Ở chế độ Sửa: editingProduct là ảnh chụp lúc mở form nên KHÔNG có màu vừa thêm
    // qua "Nhập thêm hàng". Bảng tồn kho editInvSummary được tải lại sau mỗi lần nhập
    // nên phải hợp cả hai nguồn, nếu không màu mới sẽ không hiện ô thêm ảnh.
    const source = editingProduct
      ? [...(editingProduct.colors || []), ...editInvSummary.map((row: any) => row.color)]
      : variants.map(v => v.color);
    return Array.from(new Set(source.map(c => (c || '').trim().toUpperCase()).filter(Boolean)));
  };

  const handleColorImageChange = async (color: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploadingColor(color);
    try {
      const formData = new FormData();
      for (let i = 0; i < e.target.files.length; i++) {
        formData.append('images', e.target.files[i]);
      }
      const res = await productsApi.uploadImages<{ urls: string[] }>(formData);
      setProdColorImages(prev => ({ ...prev, [color]: [...(prev[color] || []), ...res.urls] }));
      toast.success(`Đã thêm ${res.urls.length} ảnh cho màu ${colorLabels[color] || color}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Tải ảnh lên thất bại');
    } finally {
      setUploadingColor(null);
      e.target.value = '';
    }
  };

  const removeColorImage = (color: string, index: number) => {
    setProdColorImages(prev => ({ ...prev, [color]: (prev[color] || []).filter((_, i) => i !== index) }));
  };

  const mergedImages = (): string[] => {
    const all = [...prodImages];
    Object.values(prodColorImages).forEach(urls => {
      urls.forEach(url => { if (!all.includes(url)) all.push(url); });
    });
    return all;
  };

  const buildColorImagesPayload = () => {
    const valid = new Set(colorsNeedingImages());
    return Object.entries(prodColorImages)
      .filter(([color, urls]) => valid.has(color) && urls.length > 0)
      .map(([color, images]) => ({ color, images }));
  };

  const buildBasePayload = () => ({
    name: prodName,
    categoryId: prodCategoryId,
    description: prodDescription,
    basePrice: Number(prodBasePrice),
    depositAmount: Number(prodDepositAmount),
    status: prodStatus,
    images: mergedImages().length > 0 ? mergedImages() : [DEFAULT_PRODUCT_IMAGE],
    colorImages: buildColorImagesPayload(),
    videos: prodVideos,
    style: prodStyle,
    occasions: prodOccasions,
    styleCategoryIds: prodStyleCategoryIds,
    eventCategoryIds: prodEventCategoryIds,
  });

  const validateWizardStep1 = () => {
    if (!prodName || !prodCategoryId || !prodBasePrice || !prodDepositAmount) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc ở bước 1');
      return false;
    }
    // Phải dùng >= cho khớp với backend (products.service.ts), nếu chỉ chặn > thì
    // trường hợp cọc BẰNG giá thuê sẽ lọt qua bước 1 rồi mới bị từ chối ở bước 2.
    if (Number(prodDepositAmount) >= Number(prodBasePrice)) {
      toast.error('Giá cọc phải nhỏ hơn giá thuê');
      return false;
    }
    if (mergedImages().length === 0) {
      toast.error('Cần tải lên ít nhất 1 hình ảnh sản phẩm');
      return false;
    }
    return true;
  };

  const handleWizardNext = async () => {
    if (wizardStep === 1) {
      if (!validateWizardStep1()) return;
      setWizardStep(2);
      return;
    }
    if (wizardStep === 2) {
      // Edit mode: biến thể được quản lý ở tab Tồn kho, chỉ cần sang bước gắn thẻ.
      if (editingProduct) { setWizardStep(3); return; }
      const normalized = normalizeVariants(variants);
      if (normalized.length === 0) {
        toast.error('Cần ít nhất 1 dòng biến thể hợp lệ (size + màu)');
        return;
      }
      // Tạo bản NHÁP ẨN để AI có productId mà gắn thẻ (khách chưa nhìn thấy).
      setSavingDraft(true);
      try {
        if (createdDraftId) {
          // Nháp đã tồn tại (quay lại rồi tiến tới): chỉ cập nhật thông tin cơ bản.
          await productsApi.update(createdDraftId, buildBasePayload());
        } else {
          const created: any = await productsApi.create({
            ...buildBasePayload(),
            status: 'DRAFT',
            variants: normalized,
          });
          setCreatedDraftId(created._id);
          if (normalized.length !== variants.length) {
            toast.success('Đã gộp các biến thể trùng size/màu/chất liệu.');
          }
        }
        setWizardStep(3);
      } catch (err: any) {
        toast.error(err.message || 'Lưu bản nháp thất bại. Vui lòng thử lại.');
      } finally {
        setSavingDraft(false);
      }
    }
  };

  const handleWizardBack = () => setWizardStep(step => Math.max(1, step - 1));

  const handleWizardFinish = async () => {
    if (!editingProduct && activeTagCodes.length < 1) {
      toast.error('Hãy tạo và chọn ít nhất 1 thẻ thông minh trước khi đăng.');
      return;
    }
    if (!validateWizardStep1()) return;
    try {
      const targetId = editingProduct?._id ?? createdDraftId;
      if (!targetId) return;
      // Trường phái & dịp lễ suy ngược từ thẻ đã chọn (thẻ là nguồn sự thật);
      // nếu chưa mở bước thẻ (edit nhanh giá/mô tả) thì giữ nguyên giá trị cũ.
      const styleFromTags = activeTagCodes.map(code => TAG_TO_STYLE[code]).find(Boolean);
      const occasionsFromTags = activeTagCodes.map(code => TAG_TO_OCCASION[code]).filter(Boolean);
      // Danh mục lọc cũng suy từ thẻ; nếu chưa có thẻ nào thì giữ nguyên giá trị cũ.
      const styleIdsFromTags = styleCategories
        .filter(category => activeTagCodes.some(code => TAG_TO_STYLE_SLUG[code] === category.slug))
        .map(category => category.id);
      const eventIdsFromTags = eventCategories
        .filter(category => activeTagCodes.some(code => TAG_TO_EVENT_SLUG[code] === category.slug))
        .map(category => category.id);
      await productsApi.update(targetId, {
        ...buildBasePayload(),
        status: 'ACTIVE',
        style: activeTagCodes.length ? (styleFromTags || prodStyle) : prodStyle,
        occasions: activeTagCodes.length ? occasionsFromTags : prodOccasions,
        styleCategoryIds: activeTagCodes.length ? styleIdsFromTags : prodStyleCategoryIds,
        eventCategoryIds: activeTagCodes.length ? eventIdsFromTags : prodEventCategoryIds,
      });
      toast.success(editingProduct ? `Cập nhật áo dài "${prodName}" thành công!` : `Đăng áo dài "${prodName}" thành công!`);
      setIsModalOpen(false);
      resetProductForm();
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || 'Thao tác thất bại.');
    }
  };

  const resetProductForm = () => {
    setEditingProduct(null);
    setCreatedDraftId(null);
    setActiveTagCodes([]);
    setWizardStep(1);
    setProdImages([]);
    setProdColorImages({});
    setProdVideos([]);
    setVariants([emptyVariant()]);
    setEditInvSummary([]);
  };

  const handleWizardCancel = async () => {
    // Bỏ dở một bản nháp vừa tạo -> xóa nó (kèm tồn kho) cho sạch.
    if (createdDraftId && !editingProduct) {
      const result = await Swal.fire({
        title: 'Hủy tạo áo dài?',
        html: 'Bản nháp vừa tạo sẽ bị xóa, kèm theo toàn bộ biến thể và số lượng đã nhập.<br/><br/>Thao tác này không thể hoàn tác.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Hủy và xóa nháp',
        cancelButtonText: 'Tiếp tục tạo',
        confirmButtonColor: '#DC2626',
        cancelButtonColor: '#71717A',
      });
      if (!result.isConfirmed) return;
      try { await productsApi.remove(createdDraftId); } catch { /* ignore */ }
    }
    resetProductForm();
    setIsModalOpen(false);
  };

  return {
    loadEditInvSummary, openAddModal, openEditModal, handleDuplicateProduct, handleWizardCancel,
    handleImageChange, removeImage, handleVideoChange, removeVideo, updateVariantRow, removeVariantRow,
    addVariantRow, colorsNeedingImages, handleColorImageChange, removeColorImage, handleWizardFinish,
    handleWizardBack, handleWizardNext,
  };
}
