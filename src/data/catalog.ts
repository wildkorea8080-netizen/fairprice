export type Category = {
  description: string;
  name: string;
  slug: string;
};

export type Product = {
  brand: string;
  category: Category;
  coupangUrl: string;
  description: string;
  discountRate: number;
  imageTone: string;
  originalPrice: number;
  partnerUrl: string;
  price: number;
  slug: string;
  title: string;
};

export const categories: Category[] = [
  {
    description: "이어폰, 가전, 주변기기처럼 가격 변동이 큰 디지털 특가",
    name: "디지털",
    slug: "digital",
  },
  {
    description: "세제, 휴지, 수납용품 등 반복 구매가 많은 생활용품",
    name: "생활",
    slug: "living",
  },
  {
    description: "간편식, 생수, 커피처럼 장바구니에 자주 담는 식품",
    name: "식품",
    slug: "food",
  },
  {
    description: "기저귀, 물티슈, 유아용품 중심의 육아 특가",
    name: "육아",
    slug: "baby",
  },
  {
    description: "시즌 의류와 잡화 중심의 패션 할인 상품",
    name: "패션",
    slug: "fashion",
  },
];

export const products: Product[] = [
  {
    brand: "SoundPeak",
    category: categories[0],
    coupangUrl: "https://www.coupang.com/",
    description:
      "출퇴근과 운동용으로 쓰기 좋은 무선 이어폰입니다. 노이즈 캔슬링, 생활 방수, 긴 배터리 시간을 기준으로 할인 감시 대상에 올렸습니다.",
    discountRate: 42,
    imageTone: "bg-gradient-to-br from-sky-100 to-emerald-100",
    originalPrice: 129000,
    partnerUrl: "https://www.coupang.com/",
    price: 74800,
    slug: "wireless-noise-cancelling-earbuds",
    title: "무선 블루투스 이어폰 노이즈 캔슬링 모델",
  },
  {
    brand: "CleanDay",
    category: categories[1],
    coupangUrl: "https://www.coupang.com/",
    description:
      "대용량 리필 구성으로 단가가 중요한 생필품입니다. 반복 구매 상품이라 일정 할인율 이상일 때 알림 가치가 높습니다.",
    discountRate: 35,
    imageTone: "bg-gradient-to-br from-amber-100 to-lime-100",
    originalPrice: 39900,
    partnerUrl: "https://www.coupang.com/",
    price: 25900,
    slug: "laundry-detergent-refill-set",
    title: "대용량 세탁세제 리필 패키지 4개 세트",
  },
  {
    brand: "FitMeal",
    category: categories[2],
    coupangUrl: "https://www.coupang.com/",
    description:
      "냉동 보관 가능한 닭가슴살 도시락 혼합 구성입니다. 식단 관리 상품은 가격 하락 시 구매 전환이 빠른 편입니다.",
    discountRate: 28,
    imageTone: "bg-gradient-to-br from-orange-100 to-rose-100",
    originalPrice: 52000,
    partnerUrl: "https://www.coupang.com/",
    price: 37400,
    slug: "chicken-lunchbox-variety-pack",
    title: "간편식 닭가슴살 도시락 혼합 구성",
  },
  {
    brand: "BabyPure",
    category: categories[3],
    coupangUrl: "https://www.coupang.com/",
    description:
      "박스 단위로 구매하는 캡형 아기 물티슈입니다. 육아용품은 키워드 알림과 가격 조건 알림을 함께 쓰기 좋습니다.",
    discountRate: 51,
    imageTone: "bg-gradient-to-br from-violet-100 to-cyan-100",
    originalPrice: 88000,
    partnerUrl: "https://www.coupang.com/",
    price: 42900,
    slug: "premium-baby-wipes-box",
    title: "프리미엄 아기 물티슈 캡형 박스",
  },
  {
    brand: "DailyFit",
    category: categories[4],
    coupangUrl: "https://www.coupang.com/",
    description:
      "가벼운 외출용으로 쓰기 좋은 시즌 후드 집업입니다. 패션 상품은 시즌 종료 시 할인율이 크게 움직입니다.",
    discountRate: 46,
    imageTone: "bg-gradient-to-br from-fuchsia-100 to-slate-100",
    originalPrice: 69000,
    partnerUrl: "https://www.coupang.com/",
    price: 36900,
    slug: "season-hooded-zipup",
    title: "시즌 후드 집업 데일리핏 남녀공용",
  },
  {
    brand: "HomeBrew",
    category: categories[2],
    coupangUrl: "https://www.coupang.com/",
    description:
      "캡슐 커피 대용량 번들입니다. 자주 구매하는 식품형 상품이라 목표 가격 이하 알림에 적합합니다.",
    discountRate: 33,
    imageTone: "bg-gradient-to-br from-stone-100 to-teal-100",
    originalPrice: 44900,
    partnerUrl: "https://www.coupang.com/",
    price: 29900,
    slug: "capsule-coffee-bundle",
    title: "캡슐 커피 대용량 번들 80개입",
  },
];

export function formatPrice(price: number) {
  return new Intl.NumberFormat("ko-KR").format(price) + "원";
}

export function getFeaturedProducts() {
  return products.slice().sort((a, b) => b.discountRate - a.discountRate).slice(0, 4);
}

export function getProductsByCategory(categorySlug: string) {
  return products.filter((product) => product.category.slug === categorySlug);
}

export function getProductBySlug(slug: string) {
  return products.find((product) => product.slug === slug);
}

export function getCategoryBySlug(slug: string) {
  return categories.find((category) => category.slug === slug);
}
