import bcrypt from 'bcryptjs'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const escapeSql = (value: string): string => {
  return value.replaceAll("'", "''")
}

const sqlString = (value: string): string => {
  return `'${escapeSql(value)}'`
}

async function main(): Promise<void> {
  const password = 'Password@123'
  const hashedPassword = await bcrypt.hash(password, 10)

  const sql = `
PRAGMA defer_foreign_keys = ON;

-- =========================================================
-- XÓA DỮ LIỆU CŨ THEO THỨ TỰ BẢNG CON → BẢNG CHA
-- Không xóa cấu trúc bảng hoặc migrations.
-- =========================================================

DELETE FROM returns;
DELETE FROM reviews;
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM cart_items;
DELETE FROM variant_values;
DELETE FROM product_variants;
DELETE FROM product_options;
DELETE FROM option_values;
DELETE FROM option_groups;
DELETE FROM media;
DELETE FROM products;
DELETE FROM categories;
DELETE FROM addresses;
DELETE FROM shop_profiles;
DELETE FROM customer_profiles;
DELETE FROM oauth_accounts;
DELETE FROM users;

DELETE FROM sqlite_sequence
WHERE name IN (
  'users',
  'oauth_accounts',
  'addresses',
  'categories',
  'products',
  'media',
  'option_groups',
  'option_values',
  'product_variants',
  'cart_items',
  'orders',
  'order_items',
  'reviews',
  'returns'
);

-- =========================================================
-- USERS
-- Mật khẩu chung: Password@123
-- =========================================================

INSERT INTO users (
  user_id,
  username,
  name,
  email,
  password,
  role,
  status,
  email_verified_at
)
VALUES
(
  1,
  'admin',
  'Quản trị viên',
  'admin@pharmacy.vn',
  ${sqlString(hashedPassword)},
  'admin',
  'active',
  CURRENT_TIMESTAMP
),
(
  2,
  'longchau',
  'Nhà thuốc Long Châu',
  'shop@longchau.vn',
  ${sqlString(hashedPassword)},
  'shop',
  'active',
  CURRENT_TIMESTAMP
),
(
  3,
  'nguyenvana',
  'Nguyễn Văn A',
  'vana@gmail.com',
  ${sqlString(hashedPassword)},
  'customer',
  'active',
  CURRENT_TIMESTAMP
),
(
  4,
  'tranthib',
  'Trần Thị B',
  'thib@gmail.com',
  ${sqlString(hashedPassword)},
  'customer',
  'active',
  CURRENT_TIMESTAMP
);

-- =========================================================
-- CUSTOMER PROFILES
-- =========================================================

INSERT INTO customer_profiles (
  customer_id,
  phone,
  date_of_birth,
  gender
)
VALUES
(3, '0901234567', '2000-01-15', 'male'),
(4, '0912345678', '2001-06-20', 'female');

-- =========================================================
-- SHOP PROFILE
-- Shop approved cần approved_by và approved_at.
-- =========================================================

INSERT INTO shop_profiles (
  shop_id,
  shop_name,
  phone,
  description,
  rating,
  rating_count,
  followers,
  total_products,
  level,
  approval_status,
  approved_by,
  approved_at
)
VALUES (
  2,
  'Nhà thuốc Long Châu',
  '19006928',
  'Nhà thuốc cung cấp thuốc, thực phẩm chức năng và sản phẩm chăm sóc sức khỏe.',
  4.9,
  1250,
  52000,
  0,
  'premium',
  'approved',
  1,
  CURRENT_TIMESTAMP
);

-- =========================================================
-- ADDRESSES
-- =========================================================

INSERT INTO addresses (
  address_id,
  customer_id,
  recipient_name,
  phone,
  province,
  district,
  ward,
  address_detail,
  type,
  is_default
)
VALUES
(
  1,
  3,
  'Nguyễn Văn A',
  '0901234567',
  'Hà Nội',
  'Thanh Xuân',
  'Thượng Đình',
  '12 Nguyễn Trãi',
  'home',
  1
),
(
  2,
  4,
  'Trần Thị B',
  '0912345678',
  'TP. Hồ Chí Minh',
  'Quận 1',
  'Bến Nghé',
  '25 Lê Lợi',
  'home',
  1
);

-- =========================================================
-- CATEGORIES
-- =========================================================

INSERT INTO categories (
  category_id,
  category_name,
  slug,
  parent_category_id,
  status
)
VALUES
(1, 'Chăm sóc sức khỏe', 'cham-soc-suc-khoe', NULL, 1),
(2, 'Chăm sóc cá nhân', 'cham-soc-ca-nhan', NULL, 1),
(3, 'Vitamin và khoáng chất', 'vitamin-khoang-chat', 1, 1),
(4, 'Dược mỹ phẩm', 'duoc-my-pham', 2, 1),
(5, 'Thực phẩm dinh dưỡng', 'thuc-pham-dinh-duong', 1, 1);

-- =========================================================
-- PRODUCTS
-- total_products sẽ được trigger cập nhật nếu trigger đã cài.
-- =========================================================

INSERT INTO products (
  product_id,
  shop_id,
  category_id,
  name,
  slug,
  price,
  sale_price,
  description,
  usage_guide,
  stock_quantity,
  status
)
VALUES
(
  1,
  2,
  4,
  'Sữa rửa mặt dịu nhẹ Cetaphil 500ml',
  'sua-rua-mat-cetaphil-500ml',
  200000,
  190000,
  'Sữa rửa mặt dành cho da thường và da nhạy cảm.',
  'Làm ướt da, thoa sản phẩm, massage nhẹ rồi rửa sạch.',
  100,
  'active'
),
(
  2,
  2,
  5,
  'Mật ong hoa rừng tự nhiên',
  'mat-ong-hoa-rung-tu-nhien',
  150000,
  135000,
  'Mật ong hoa rừng nguyên chất, phù hợp pha nước ấm.',
  'Dùng trực tiếp hoặc pha với nước ấm.',
  200,
  'active'
),
(
  3,
  2,
  3,
  'Vitamin C 1000mg',
  'vitamin-c-1000mg',
  250000,
  220000,
  'Viên uống bổ sung vitamin C hỗ trợ sức đề kháng.',
  'Uống một viên mỗi ngày sau bữa ăn.',
  120,
  'active'
),
(
  4,
  2,
  5,
  'Mật ong Manuka cao cấp',
  'mat-ong-manuka-cao-cap',
  450000,
  NULL,
  'Mật ong Manuka nhập khẩu, đóng chai tiện dụng.',
  'Dùng trực tiếp hoặc pha với trà ấm.',
  80,
  'active'
);

-- =========================================================
-- MEDIA
-- =========================================================

INSERT INTO media (
  media_id,
  product_id,
  url,
  type,
  is_thumbnail,
  priority
)
VALUES
(
  1,
  1,
  'https://picsum.photos/seed/cetaphil/800/800',
  'image',
  1,
  0
),
(
  2,
  2,
  'https://picsum.photos/seed/honey/800/800',
  'image',
  1,
  0
),
(
  3,
  3,
  'https://picsum.photos/seed/vitaminc/800/800',
  'image',
  1,
  0
),
(
  4,
  4,
  'https://picsum.photos/seed/manuka/800/800',
  'image',
  1,
  0
),
(
  5,
  1,
  'https://picsum.photos/seed/cetaphil-detail/800/800',
  'image',
  0,
  1
);

-- =========================================================
-- OPTIONS VÀ VARIANTS
-- =========================================================

INSERT INTO option_groups (
  group_id,
  group_name
)
VALUES
(1, 'Dung tích'),
(2, 'Quy cách');

INSERT INTO option_values (
  value_id,
  group_id,
  value_name
)
VALUES
(1, 1, '250ml'),
(2, 1, '500ml'),
(3, 2, 'Hộp 30 viên'),
(4, 2, 'Hộp 60 viên');

INSERT INTO product_options (
  product_id,
  group_id
)
VALUES
(2, 1),
(3, 2),
(4, 1);

INSERT INTO product_variants (
  variant_id,
  product_id,
  price,
  sale_price,
  stock_quantity,
  sku,
  status
)
VALUES
(
  1,
  2,
  90000,
  85000,
  100,
  'HONEY-250ML',
  'active'
),
(
  2,
  2,
  150000,
  135000,
  100,
  'HONEY-500ML',
  'active'
),
(
  3,
  3,
  250000,
  220000,
  60,
  'VITC-30',
  'active'
),
(
  4,
  3,
  420000,
  390000,
  60,
  'VITC-60',
  'active'
),
(
  5,
  4,
  450000,
  NULL,
  80,
  'MANUKA-250ML',
  'active'
);

INSERT INTO variant_values (
  variant_id,
  value_id
)
VALUES
(1, 1),
(2, 2),
(3, 3),
(4, 4),
(5, 1);

-- =========================================================
-- CART
-- variant_key là generated column, không được INSERT trực tiếp.
-- =========================================================

INSERT INTO cart_items (
  cart_item_id,
  customer_id,
  product_id,
  variant_id,
  quantity
)
VALUES
(1, 3, 2, 2, 2),
(2, 3, 1, NULL, 1),
(3, 4, 3, 3, 1);

-- =========================================================
-- ORDERS
-- Ban đầu subtotal và total bằng phí vận chuyển.
-- Trigger order_items sẽ cập nhật lại tổng tiền.
-- =========================================================

INSERT INTO orders (
  order_id,
  order_code,
  customer_id,
  subtotal_amount,
  shipping_fee,
  discount_amount,
  total_amount,
  recipient_name,
  recipient_phone,
  shipping_address,
  note,
  payment_method,
  payment_status,
  order_status
)
VALUES
(
  1,
  'ORD-20260806-0001',
  3,
  0,
  30000,
  10000,
  20000,
  'Nguyễn Văn A',
  '0901234567',
  '12 Nguyễn Trãi, Thanh Xuân, Hà Nội',
  'Giao hàng giờ hành chính',
  'COD',
  'pending',
  'confirmed'
),
(
  2,
  'ORD-20260806-0002',
  4,
  0,
  20000,
  0,
  20000,
  'Trần Thị B',
  '0912345678',
  '25 Lê Lợi, Quận 1, TP. Hồ Chí Minh',
  NULL,
  'VNPay',
  'paid',
  'delivered'
);

INSERT INTO order_items (
  order_item_id,
  order_id,
  product_id,
  shop_id,
  variant_id,
  product_name,
  variant_name,
  quantity,
  unit_price
)
VALUES
(
  1,
  1,
  2,
  2,
  2,
  'Mật ong hoa rừng tự nhiên',
  'Dung tích: 500ml',
  2,
  135000
),
(
  2,
  1,
  1,
  2,
  NULL,
  'Sữa rửa mặt dịu nhẹ Cetaphil 500ml',
  NULL,
  1,
  190000
),
(
  3,
  2,
  3,
  2,
  3,
  'Vitamin C 1000mg',
  'Quy cách: Hộp 30 viên',
  1,
  220000
);

-- =========================================================
-- REVIEW
-- Chỉ review item thuộc đúng customer và product.
-- =========================================================

INSERT INTO reviews (
  review_id,
  customer_id,
  product_id,
  order_item_id,
  title,
  comment,
  rating,
  status
)
VALUES
(
  1,
  4,
  3,
  3,
  'Sản phẩm tốt',
  'Đóng gói cẩn thận, giao hàng nhanh.',
  5,
  'published'
);

PRAGMA defer_foreign_keys = OFF;
`

  const outputPath = resolve(process.cwd(), 'scripts', 'seed.sql')

  await writeFile(outputPath, sql.trimStart(), 'utf8')

  console.log(`Đã tạo: ${outputPath}`)
  console.log('Tài khoản test:')
  console.log('Admin:    admin@pharmacy.vn / Password@123')
  console.log('Shop:     shop@longchau.vn / Password@123')
  console.log('Customer: vana@gmail.com / Password@123')
  console.log('Customer: thib@gmail.com / Password@123')
}

main().catch((error: unknown) => {
  console.error('Tạo seed thất bại:', error)
  process.exitCode = 1
})