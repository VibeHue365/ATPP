export interface TestimonialItem {
  id: string;
  name: string;
  location: string;
  avatar: string;
  comment: string;
  rating: number;
}

export const TESTIMONIALS_DATA: TestimonialItem[] = [
  {
    id: '1',
    name: 'Nguyễn Mai Anh',
    location: 'HÀ NỘI, VN',
    avatar: '/avatar_mai_anh.webp',
    comment: '"Dịch vụ tuyệt vời. Bộ Áo Dài tơ tằm mình thuê rất đẹp, phom dáng chuẩn. AI gợi ý concept chụp ảnh tại Hội An rất có tâm."',
    rating: 5,
  },
  {
    id: '2',
    name: 'Lê Minh Tâm',
    location: 'TP. HỒ CHÍ MINH, VN',
    avatar: '/avatar_minh_tam.webp',
    comment: '"Đặt lịch chụp với anh Trần Bảo qua app cực nhanh. Hình ảnh nhận được rất chất lượng, đúng tinh thần heritage mà mình mong muốn."',
    rating: 5,
  },
  {
    id: '3',
    name: 'Hanna Nguyen',
    location: 'OVERSEAS CLIENT',
    avatar: '/avatar_hanna.webp',
    comment: '"Platform chuyên nghiệp nhất về Áo Dài mà mình từng dùng. Giao diện đẹp, dễ thao tác và thanh toán minh bạch."',
    rating: 5,
  },
];
