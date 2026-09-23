import {
  ONBOARDING_OCCASION_TAG_MAP,
  ONBOARDING_STYLE_TAG_MAP,
} from './smart-tag.constants';

describe('onboarding to Smart Tag mapping', () => {
  it('maps every current onboarding style to one canonical tag', () => {
    expect(ONBOARDING_STYLE_TAG_MAP).toEqual({
      TRADITIONAL: 'TRUYEN_THONG',
      MODERN: 'CACH_TAN',
      EDGY: 'PHA_CACH',
    });
  });

  it('maps every current onboarding occasion to one canonical tag', () => {
    expect(ONBOARDING_OCCASION_TAG_MAP).toEqual({
      WEDDING: 'PHU_HOP_LE_CUOI',
      GRADUATION: 'CHUP_ANH_KY_YEU',
      FESTIVAL: 'LE_HOI_TRUYEN_THONG',
      EVENT: 'BIEU_DIEN_SU_KIEN',
    });
  });
});
