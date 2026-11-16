import { HeritageSpotSpaceType } from '../schemas/heritage-spot.schema';

export interface HeritageSpotSeedItem {
  name: string;
  slug: string;
  spaceType: HeritageSpotSpaceType;
  location: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  address: string;
  tags: string[];
  operatingHours: {
    openTime: string;
    closeTime: string;
  };
  standardAdmissionFee: number;
  baseTravelFee: number;
  bestOutfitCategories: string[];
  samplePhotos: string[];
  description: string;
  isActive: boolean;
}

export const HUE_HERITAGE_SPOTS_SEED: HeritageSpotSeedItem[] = [
  {
    name: 'Đại Nội Huế - Ngọ Môn & Điện Thái Hòa',
    slug: 'dai-noi-hue',
    spaceType: HeritageSpotSpaceType.OUTDOOR,
    location: {
      type: 'Point',
      coordinates: [107.5794, 16.4698],
    },
    address: 'Đường 23/8, Phường Thuận Hòa, TP. Huế',
    tags: ['HOANG_CUNG', 'DI_SAN_THE_GIOI', 'CO_KINH', 'KIEN_TRUC_CUNG_DINH'],
    operatingHours: { openTime: '07:00', closeTime: '17:30' },
    standardAdmissionFee: 200000,
    baseTravelFee: 0,
    bestOutfitCategories: ['NHAT_BINH', 'NGU_THAN', 'AO_TAC'],
    samplePhotos: [
      'https://images.unsplash.com/photo-1599707367072-cd6ada2bc375?auto=format&fit=crop&w=1200&q=80',
    ],
    description: 'Trái tim của Di sản Cố đô Huế, bối cảnh uy nghiêm tráng lệ nhất cho các bộ cổ phục cung đình.',
    isActive: true,
  },
  {
    name: 'Cung Diên Thọ & Thái Bình Lâu',
    slug: 'cung-dien-tho',
    spaceType: HeritageSpotSpaceType.SEMI_INDOOR,
    location: {
      type: 'Point',
      coordinates: [107.5765, 16.4712],
    },
    address: 'Khuôn viên Đại Nội Huế, Phường Thuận Hòa, TP. Huế',
    tags: ['SEMI_INDOOR', 'MAI_CHE', 'HOANG_CUNG', 'SAN_VUON', 'HO_TINH_TAM'],
    operatingHours: { openTime: '07:00', closeTime: '17:30' },
    standardAdmissionFee: 200000,
    baseTravelFee: 0,
    bestOutfitCategories: ['NHAT_BINH', 'AO_TAC_LUA', 'NGU_THAN'],
    samplePhotos: [
      'https://images.unsplash.com/photo-1599707367072-cd6ada2bc375?auto=format&fit=crop&w=1200&q=80',
    ],
    description: 'Khuôn viên có hệ thống hành lang mái che nối liền các cung điện, phù hợp chụp chân dung cổ phục khi có mưa nhỏ.',
    isActive: true,
  },
  {
    name: 'Lăng Tự Đức - Khiêm Lăng',
    slug: 'lang-tu-duc',
    spaceType: HeritageSpotSpaceType.OUTDOOR,
    location: {
      type: 'Point',
      coordinates: [107.5658, 16.4332],
    },
    address: 'Thôn Thượng Ba, Phường Thủy Xuân, TP. Huế',
    tags: ['LANG_TAM', 'HO_LUU_KHIEM', 'THO_MONG', 'RUNG_THONG'],
    operatingHours: { openTime: '07:00', closeTime: '17:30' },
    standardAdmissionFee: 150000,
    baseTravelFee: 70000,
    bestOutfitCategories: ['NGU_THAN', 'AO_TAC', 'AO_DAI_TRUYEN_THONG'],
    samplePhotos: [
      'https://images.unsplash.com/photo-1599707367072-cd6ada2bc375?auto=format&fit=crop&w=1200&q=80',
    ],
    description: 'Quần thể lăng tẩm mang vẻ đẹp trữ tình, thơ mộng như một công viên hoàng gia nép mình bên rừng thông.',
    isActive: true,
  },
  {
    name: 'Lăng Khải Định - Ứng Lăng',
    slug: 'lang-khai-dinh',
    spaceType: HeritageSpotSpaceType.SEMI_INDOOR,
    location: {
      type: 'Point',
      coordinates: [107.5902, 16.3989],
    },
    address: 'Xã Thủy Bằng, TP. Huế',
    tags: ['SEMI_INDOOR', 'LANG_TAM', 'KHAM_SANH_SU', 'DOC_DAO', 'A_AU'],
    operatingHours: { openTime: '07:00', closeTime: '17:30' },
    standardAdmissionFee: 150000,
    baseTravelFee: 90000,
    bestOutfitCategories: ['NHAT_BINH_DO', 'NGU_THAN_GAM', 'AO_TAC'],
    samplePhotos: [
      'https://images.unsplash.com/photo-1599707367072-cd6ada2bc375?auto=format&fit=crop&w=1200&q=80',
    ],
    description: 'Kiến trúc đỉnh cao khảm sành sứ trong nhà tại Cung Thiên Định, có mái che kiên cố chụp ảnh bất chấp mưa phùn.',
    isActive: true,
  },
  {
    name: 'Cung An Định',
    slug: 'cung-an-dinh',
    spaceType: HeritageSpotSpaceType.SEMI_INDOOR,
    location: {
      type: 'Point',
      coordinates: [107.5953, 16.4589],
    },
    address: '179B Phan Đình Phùng, Phường Phú Nhuận, TP. Huế',
    tags: ['SEMI_INDOOR', 'BIET_THU_PHAP', 'HOANG_GIA', 'KHAI_TUONG_LAU'],
    operatingHours: { openTime: '07:00', closeTime: '17:00' },
    standardAdmissionFee: 50000,
    baseTravelFee: 20000,
    bestOutfitCategories: ['AO_DAI_TAN_THOI', 'NHAT_BINH', 'AO_TAC_LUA'],
    samplePhotos: [
      'https://images.unsplash.com/photo-1599707367072-cd6ada2bc375?auto=format&fit=crop&w=1200&q=80',
    ],
    description: 'Bạch Dinh hoàng gia tráng lệ của vua Khải Định và Nam Phương Hoàng hậu, không gian hành lang và sảnh chụp ảnh tuyệt mỹ.',
    isActive: true,
  },
  {
    name: 'Chùa Thiên Mụ & Bến Thuyền Hương Giang',
    slug: 'chua-thien-mu',
    spaceType: HeritageSpotSpaceType.OUTDOOR,
    location: {
      type: 'Point',
      coordinates: [107.5508, 16.4531],
    },
    address: 'Đường Nguyễn Phúc Nguyên, Phường Kim Long, TP. Huế',
    tags: ['CHUA_CHIEN', 'SONG_HUONG', 'HOANG_HON', 'THANH_TINH'],
    operatingHours: { openTime: '06:30', closeTime: '18:00' },
    standardAdmissionFee: 0,
    baseTravelFee: 50000,
    bestOutfitCategories: ['AO_DAI_TRANG', 'NGU_THAN_NHE', 'NON_LA'],
    samplePhotos: [
      'https://images.unsplash.com/photo-1599707367072-cd6ada2bc375?auto=format&fit=crop&w=1200&q=80',
    ],
    description: 'Biểu tượng tâm linh cổ kính nhất xứ Huế, đón trọn ánh hoàng hôn buông xuống dòng sông Hương thơ mộng.',
    isActive: true,
  },
  {
    name: 'Lăng Minh Mạng - Hiếu Lăng',
    slug: 'lang-minh-mang',
    spaceType: HeritageSpotSpaceType.OUTDOOR,
    location: {
      type: 'Point',
      coordinates: [107.5701, 16.3887],
    },
    address: 'Xã Hương Thọ, TP. Huế',
    tags: ['LANG_TAM', 'UY_NGHIEM', 'HO_TRANG_MINH', 'DOI_XUNG'],
    operatingHours: { openTime: '07:00', closeTime: '17:30' },
    standardAdmissionFee: 150000,
    baseTravelFee: 120000,
    bestOutfitCategories: ['NHAT_BINH', 'NGU_THAN', 'AO_TAC'],
    samplePhotos: [
      'https://images.unsplash.com/photo-1599707367072-cd6ada2bc375?auto=format&fit=crop&w=1200&q=80',
    ],
    description: 'Kiến trúc đăng đối chuẩn mực Nho giáo, kết hợp hài hòa giữa hồ nước và đồi thông bạt ngàn.',
    isActive: true,
  },
  {
    name: 'Đồi Vọng Cảnh & Rừng Thông',
    slug: 'doi-vong-canh',
    spaceType: HeritageSpotSpaceType.OUTDOOR,
    location: {
      type: 'Point',
      coordinates: [107.5512, 16.4357],
    },
    address: 'Đường Huyền Trân Công Chúa, Phường Thủy Biều, TP. Huế',
    tags: ['THIEN_NHIEN', 'RUNG_THONG', 'NGAM_SONG_HUONG', 'HOANG_HON'],
    operatingHours: { openTime: '05:30', closeTime: '18:30' },
    standardAdmissionFee: 0,
    baseTravelFee: 70000,
    bestOutfitCategories: ['AO_DAI_LUA', 'NGU_THAN', 'NON_BAI_THO'],
    samplePhotos: [
      'https://images.unsplash.com/photo-1599707367072-cd6ada2bc375?auto=format&fit=crop&w=1200&q=80',
    ],
    description: 'Điểm ngắm khúc quanh sông Hương đẹp nhất xứ Huế, không gian khoáng đạt chụp ảnh hoàng hôn tự nhiên.',
    isActive: true,
  },
  {
    name: 'Cầu Trường Tiền & Tuyến Phố Đi Bộ Sông Hương',
    slug: 'cau-truong-tien',
    spaceType: HeritageSpotSpaceType.OUTDOOR,
    location: {
      type: 'Point',
      coordinates: [107.5925, 16.4678],
    },
    address: 'Đường Lê Lợi / Trần Hưng Đạo, TP. Huế',
    tags: ['BIEU_TUONG_HUE', 'SONG_HUONG', 'DAP_DA', 'GIO_VANG'],
    operatingHours: { openTime: '00:00', closeTime: '23:59' },
    standardAdmissionFee: 0,
    baseTravelFee: 0,
    bestOutfitCategories: ['AO_DAI_TRUYEN_THONG', 'AO_TAC_TRANG', 'AO_DAI_LUA'],
    samplePhotos: [
      'https://images.unsplash.com/photo-1599707367072-cd6ada2bc375?auto=format&fit=crop&w=1200&q=80',
    ],
    description: 'Cây cầu 6 vài 12 nhịp nối đôi bờ sông Hương, địa điểm chụp áo dài biểu tượng không thể bỏ qua khi đến Huế.',
    isActive: true,
  },
  {
    name: 'Phim Trường Cổ Trang Cố Đô (Indoor Studio)',
    slug: 'phim-truong-co-trang-co-do',
    spaceType: HeritageSpotSpaceType.INDOOR_STUDIO,
    location: {
      type: 'Point',
      coordinates: [107.5855, 16.4612],
    },
    address: '45 Lê Lợi, Phường Phú Hội, TP. Huế',
    tags: ['INDOOR_STUDIO', 'TRONG_NHA', 'CHONG_BAO', 'DIEU_HOA', 'CO_TRANG'],
    operatingHours: { openTime: '08:00', closeTime: '21:00' },
    standardAdmissionFee: 100000,
    baseTravelFee: 0,
    bestOutfitCategories: ['NHAT_BINH_HOANG_HAU', 'NGU_THAN_QUY_TOC', 'AO_TAC_CUOI'],
    samplePhotos: [
      'https://images.unsplash.com/photo-1599707367072-cd6ada2bc375?auto=format&fit=crop&w=1200&q=80',
    ],
    description: 'Phim trường hoàng cung trong nhà 100% cách âm, điều hòa trung tâm và ánh sáng điện ảnh, an toàn tuyệt đối khi có bão.',
    isActive: true,
  },
];
