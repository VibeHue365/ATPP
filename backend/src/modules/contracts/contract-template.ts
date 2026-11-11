import { Injectable, UnprocessableEntityException } from '@nestjs/common';

export interface ContractTemplate {
  version: string;
  status: 'DRAFT' | 'APPROVED';
  approvedAt: string | null;
  title: string;
  sections: ReadonlyArray<{ id: string; heading: string; source: string }>;
}

/** Structure only. Terms, charges and legal wording require business/legal approval. */
export const AO_DAI_RENTAL_V1: ContractTemplate = Object.freeze({
  version: 'ao-dai-rental-v1',
  status: 'DRAFT',
  approvedAt: null,
  title: 'Hợp đồng thuê áo dài — bản nháp nội bộ',
  sections: Object.freeze(
    [
      {
        id: 'parties',
        heading: 'Các bên',
        source: 'snapshot.customer/provider',
      },
      { id: 'items', heading: 'Áo dài thuê', source: 'snapshot.providerItems' },
      {
        id: 'schedule',
        heading: 'Thời gian và địa điểm giao trả',
        source: 'snapshot.providerItems',
      },
      {
        id: 'pricing',
        heading: 'Giá, tiền cọc và khoản phí',
        source: 'snapshot.pricing',
      },
      {
        id: 'policies',
        heading: 'Chính sách áp dụng',
        source: 'snapshot.policies',
      },
      {
        id: 'consent',
        heading: 'Xác nhận của các bên',
        source: 'contract consent records',
      },
    ].map((section) => Object.freeze(section)),
  ),
});

export const AO_DAI_RENTAL_V2: ContractTemplate = Object.freeze({
  version: 'ao-dai-rental-v2',
  status: 'APPROVED',
  approvedAt: '2026-10-31T00:00:00.000Z',
  title: 'HỢP ĐỒNG ĐIỆN TỬ THUÊ TRANG PHỤC ÁO DÀI',
  sections: Object.freeze(
    [
      {
        id: 'parties',
        heading: 'Các bên tham gia hợp đồng',
        source: 'snapshot.customer/provider',
      },
      { id: 'items', heading: 'Danh mục trang phục thuê', source: 'snapshot.providerItems' },
      {
        id: 'schedule',
        heading: 'Thời gian và địa điểm giao nhận trang phục',
        source: 'snapshot.providerItems',
      },
      {
        id: 'pricing',
        heading: 'Giá thuê, tiền đặt cọc và thanh toán',
        source: 'snapshot.pricing',
      },
      {
        id: 'policies',
        heading: 'Chính sách áp dụng và cam kết bồi thường',
        source: 'snapshot.policies',
      },
      {
        id: 'consent',
        heading: 'Xác nhận và cam kết điện tử của các bên',
        source: 'contract consent records',
      },
    ].map((section) => Object.freeze(section)),
  ),
});

@Injectable()
export class ContractTemplateService {
  getDraft(): ContractTemplate {
    return AO_DAI_RENTAL_V1;
  }

  getApproved(): ContractTemplate {
    if (process.env.CONTRACTS_V2_ENABLED === 'true') {
      return AO_DAI_RENTAL_V2;
    }
    const template = this.getDraft();
    if (template.status !== 'APPROVED' || !template.approvedAt)
      throw new UnprocessableEntityException('CONTRACT_TEMPLATE_NOT_APPROVED');
    return template;
  }
}
