import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProductWizardActions } from '../src/features/provider-dashboard/collections/createProductWizardActions';
import { productsApi } from '../src/features/provider-dashboard/api/providerDashboardApi';
import { sizeChartApi } from '../src/features/provider-dashboard/size-chart/sizeChartApi';
import { ConfirmModal } from '../src/utils/confirmModal';

vi.mock('../src/features/provider-dashboard/size-chart/sizeChartApi', () => ({ sizeChartApi: { get: vi.fn() } }));
vi.mock('../src/features/provider-dashboard/api/providerDashboardApi', () => ({ productsApi: { create: vi.fn(), update: vi.fn() }, inventoryApi: {} }));
vi.mock('../src/utils/confirmModal', () => ({ ConfirmModal: { pause: vi.fn() } }));
vi.mock('sweetalert2', () => ({ default: { DismissReason: { cancel: 'cancel', backdrop: 'backdrop', esc: 'esc' } } }));

beforeEach(() => vi.clearAllMocks());

const SAVED = { _id: 'p', name: 'Áo dài đỏ', description: 'Mẫu áo dài màu đỏ.', sizeChartPolicyVersion: 1 };

/** Wizard on step 2 while editing an existing product, with the given step-1 text. */
function editing(prodName: string, prodDescription: string) {
  const values: Record<string, unknown> = {
    editingProduct: SAVED, createdDraftId: null, wizardStep: 2, prodName, prodDescription,
    toast: { error: vi.fn(), success: vi.fn() },
  };
  const dependencies = new Proxy(values, { get(target, key: string) { if (!(key in target)) target[key] = vi.fn(); return target[key]; } });
  return {
    actions: createProductWizardActions(dependencies as Parameters<typeof createProductWizardActions>[0]),
    values: values as Record<string, ReturnType<typeof vi.fn>> & { toast: { error: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn> } },
  };
}

describe('Editing a product: smart tags in step 3 read the saved name/description', () => {
  it('goes straight to step 3 when the name and description did not change', async () => {
    const { actions, values } = editing(SAVED.name, SAVED.description);
    await actions.handleWizardNext();
    expect(ConfirmModal.pause).not.toHaveBeenCalled();
    expect(productsApi.update).not.toHaveBeenCalled();
    expect(values.setWizardStep).toHaveBeenCalledWith(3);
  });

  it('asks, then saves only the new name and description before step 3', async () => {
    vi.mocked(ConfirmModal.pause).mockResolvedValue({ isConfirmed: true, isDenied: false, isDismissed: false });
    vi.mocked(productsApi.update).mockResolvedValue({});
    const { actions, values } = editing('Áo dài cách tân lụa hoa sen', 'Phù hợp lễ cưới.');

    await actions.handleWizardNext();

    expect(ConfirmModal.pause).toHaveBeenCalledWith(expect.stringContaining('Lưu tên và mô tả'), expect.stringContaining('chờ duyệt'), expect.anything());
    expect(productsApi.update).toHaveBeenCalledWith('p', { name: 'Áo dài cách tân lụa hoa sen', description: 'Phù hợp lễ cưới.' });
    expect(values.setEditingProduct).toHaveBeenCalledWith(expect.objectContaining({ _id: 'p', name: 'Áo dài cách tân lụa hoa sen' }));
    expect(values.setSavingDraft).toHaveBeenNthCalledWith(1, true);
    expect(values.setSavingDraft).toHaveBeenLastCalledWith(false);
    expect(values.setWizardStep).toHaveBeenCalledWith(3);
    // The size chart check stays where it was: at the final save, not here.
    expect(sizeChartApi.get).not.toHaveBeenCalled();
  });

  it('"Bỏ qua" goes to step 3 without saving', async () => {
    vi.mocked(ConfirmModal.pause).mockResolvedValue({ isConfirmed: false, isDenied: false, isDismissed: true, dismiss: 'cancel' as never });
    const { actions, values } = editing('Tên mới', SAVED.description);
    await actions.handleWizardNext();
    expect(productsApi.update).not.toHaveBeenCalled();
    expect(values.setWizardStep).toHaveBeenCalledWith(3);
  });

  it('closing the dialog stays on step 2', async () => {
    vi.mocked(ConfirmModal.pause).mockResolvedValue({ isConfirmed: false, isDenied: false, isDismissed: true, dismiss: 'backdrop' as never });
    const { actions, values } = editing(SAVED.name, 'Mô tả mới');
    await actions.handleWizardNext();
    expect(productsApi.update).not.toHaveBeenCalled();
    expect(values.setWizardStep).not.toHaveBeenCalled();
  });

  it('jumping to step 3 from the stepper goes through the same check', async () => {
    vi.mocked(ConfirmModal.pause).mockResolvedValue({ isConfirmed: true, isDenied: false, isDismissed: false });
    vi.mocked(productsApi.update).mockResolvedValue({});
    const { actions, values } = editing('Tên mới', SAVED.description);

    await actions.handleWizardGoTo(3);

    expect(productsApi.update).toHaveBeenCalledWith('p', { name: 'Tên mới', description: SAVED.description });
    expect(values.setWizardStep).toHaveBeenCalledWith(3);
  });

  it('jumping back to step 1 or 2 never asks or saves', async () => {
    const { actions, values } = editing('Tên mới', 'Mô tả mới');
    await actions.handleWizardGoTo(1);
    expect(ConfirmModal.pause).not.toHaveBeenCalled();
    expect(values.setWizardStep).toHaveBeenCalledWith(1);
  });

  it('does not save an empty name', async () => {
    const { actions, values } = editing('   ', SAVED.description);
    await actions.handleWizardNext();
    expect(ConfirmModal.pause).not.toHaveBeenCalled();
    expect(productsApi.update).not.toHaveBeenCalled();
    expect(values.toast.error).toHaveBeenCalledWith(expect.stringContaining('tên áo dài'));
    expect(values.setWizardStep).not.toHaveBeenCalled();
  });

  it('stays on step 2 and explains when saving fails', async () => {
    vi.mocked(ConfirmModal.pause).mockResolvedValue({ isConfirmed: true, isDenied: false, isDismissed: false });
    vi.mocked(productsApi.update).mockRejectedValue(new Error('Mất kết nối'));
    const { actions, values } = editing('Tên mới', SAVED.description);
    await actions.handleWizardNext();
    expect(values.toast.error).toHaveBeenCalledWith('Mất kết nối');
    expect(values.setWizardStep).not.toHaveBeenCalled();
    expect(values.setSavingDraft).toHaveBeenLastCalledWith(false);
  });
});
