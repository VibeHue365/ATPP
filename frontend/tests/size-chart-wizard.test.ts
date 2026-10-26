import { beforeEach, expect, it, vi } from 'vitest';
import { createProductWizardActions } from '../src/features/provider-dashboard/collections/createProductWizardActions';
import { sizeChartApi } from '../src/features/provider-dashboard/size-chart/sizeChartApi';
import { productsApi } from '../src/features/provider-dashboard/api/providerDashboardApi';

vi.mock('../src/features/provider-dashboard/size-chart/sizeChartApi', () => ({ sizeChartApi: { get: vi.fn() } }));
vi.mock('../src/features/provider-dashboard/api/providerDashboardApi', () => ({ productsApi: { create: vi.fn(), update: vi.fn() }, inventoryApi: {} }));
beforeEach(() => vi.clearAllMocks());
function fixture(policy: number | undefined, isNew = false, wizardStep = 1, createdDraftId: string | null = isNew ? 'p' : null) {
  const values: Record<string, unknown> = {
    editingProduct: isNew ? null : { _id: 'p', sizeChartPolicyVersion: policy }, createdDraftId,
    prodName: 'Áo kiểm thử', prodCategoryId: 'c', prodBasePrice: '100', prodDepositAmount: '10',
    prodDescription: '', prodImages: ['/fixture.jpg'], prodColorImages: {}, prodVideos: [], prodStyle: 'traditional',
    prodOccasions: [], prodStyleCategoryIds: [], prodEventCategoryIds: [], prodCustomTags: [], prodStatus: 'DRAFT',
    variants: [], wizardStep, editInvSummary: [], categories: [], styleCategories: [], eventCategories: [], activeTagCodes: ['TRUYEN_THONG'],
    toast: { error: vi.fn(), success: vi.fn() }, fetchProducts: vi.fn().mockResolvedValue(undefined),
  };
  const dependencies = new Proxy(values, { get(target, key: string) { if (!(key in target)) target[key] = vi.fn(); return target[key]; } });
  return { actions: createProductWizardActions(dependencies as Parameters<typeof createProductWizardActions>[0]), toast: values.toast as { error: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn> }, values };
}
it('creates a hidden draft from step 2 before exposing its size chart', async () => {
  vi.mocked(productsApi.create).mockResolvedValue({ _id: 'draft' });
  const { actions, values, toast } = fixture(1, true, 2, null);
  (values.variants as unknown[]).push({ size: 'M', color: 'RED', material: 'SILK', quantity: 2 });
  await actions.handlePrepareSizeChart();
  expect(productsApi.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'DRAFT', variants: [expect.objectContaining({ size: 'M', quantity: 2 })] }));
  expect(values.setCreatedDraftId).toHaveBeenCalledWith('draft');
  expect(values.setWizardStep).not.toHaveBeenCalled();
  expect(toast.error).not.toHaveBeenCalled();
});
it('keeps a new product on step 2 until the chart is confirmed', async () => {
  vi.mocked(sizeChartApi.get).mockResolvedValue({ version: 1, sizeChart: null, sizes: ['M'] });
  const { actions, values, toast } = fixture(1, true, 2, 'draft');
  await actions.handleWizardNext();
  expect(values.setWizardStep).not.toHaveBeenCalled();
  expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('xác nhận bảng size'));

  vi.mocked(sizeChartApi.get).mockResolvedValue({ version: 2, sizeChart: {
    version: 2, sourceRevision: 1, source: 'MANUAL', status: 'CONFIRMED', measurementType: 'BODY', lengthUnit: 'CM', weightUnit: 'KG',
    rows: [{ size: 'M', chest: { min: 86, max: 89 } }], requiredMeasurements: ['chest'],
  }, sizes: ['M'] });
  await actions.handleWizardNext();
  expect(productsApi.update).toHaveBeenCalledWith('draft', expect.objectContaining({ images: ['/fixture.jpg'] }));
  expect(values.setWizardStep).toHaveBeenCalledWith(3);
});
it('keeps legacy product editing available without forcing a chart', async () => {
  const { actions, toast } = fixture(undefined);
  await actions.handleWizardFinish();
  expect(sizeChartApi.get).not.toHaveBeenCalled();
  expect(productsApi.update).toHaveBeenCalledWith('p', expect.objectContaining({ name: 'Áo kiểm thử', status: 'ACTIVE' }));
  expect(toast.error).not.toHaveBeenCalled();
});
it.each([true, false])('blocks a new-policy product with a draft chart (new=%s)', async isNew => {
  vi.mocked(sizeChartApi.get).mockResolvedValue({ version: 0, sizeChart: null, sizes: ['M'] });
  const { actions, toast } = fixture(1, isNew);
  await actions.handleWizardFinish();
  expect(productsApi.update).not.toHaveBeenCalled(); expect(toast.error).toHaveBeenCalled();
});
it('checks chart size coverage without altering existing product payload fields', async () => {
  const chart = { version: 2, sourceRevision: 1, source: 'MANUAL' as const, status: 'CONFIRMED' as const, measurementType: 'BODY' as const, lengthUnit: 'CM' as const, weightUnit: 'KG' as const, rows: [{ size: 'M', chest: { min: 86, max: 89 } }], requiredMeasurements: ['chest' as const] };
  vi.mocked(sizeChartApi.get).mockResolvedValue({ version: 2, sizeChart: chart, sizes: ['M', 'L'] });
  const { actions, toast } = fixture(1);
  await actions.handleWizardFinish();
  expect(productsApi.update).not.toHaveBeenCalled();
  vi.mocked(sizeChartApi.get).mockResolvedValue({ version: 2, sizeChart: chart, sizes: ['M'] });
  await actions.handleWizardFinish();
  expect(productsApi.update).toHaveBeenCalledWith('p', expect.objectContaining({ basePrice: 100, depositAmount: 10, images: ['/fixture.jpg'] }));
  expect(toast.success).toHaveBeenCalled();
});
