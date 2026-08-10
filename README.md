# Ichigo Ichie V2

Website mới cho Ichigo Ichie: menu, boutique, giỏ hàng, order pickup và admin Supabase.

## Đã có trong bản này

- Trang chủ mobile-first, FR / EN.
- `/menu`: boissons + desserts, lọc theo catégorie và tìm kiếm.
- `/boutique`: matcha + accessoires.
- Product modal với variant (30 g / 50 g / 100 g), option, giá cộng thêm và stock.
- Giỏ hàng lưu trên trình duyệt.
- `/checkout`: tạo order để retrait boutique.
- API order kiểm tra lại **giá, stock, variant và option ở server** trước khi ghi đơn.
- `/admin/login`: đăng nhập bằng Supabase Auth.
- `/admin`: quản lý sản phẩm, catégorie, variant, ảnh, option/supplément, order và settings.
- Upload ảnh vào Supabase Storage.
- Supabase RLS: public chỉ đọc catalogue; admin mới được sửa; secret key chỉ dùng trong API server.
- Dữ liệu seed mẫu: Matcha Latte, Strawberry Matcha, Mango Matcha, Matcha Coconut Cloud, Matcha Lava, KYOCHA Sen, Chasen Takayama.

## 1. Yêu cầu trên Mac

Khuyên dùng Node.js 22 LTS trở lên.

```bash
node -v
npm -v
```

Nếu chưa có Node, cài Node 22 trước rồi mở Terminal lại.

## 2. Chạy project local

Giải nén project, sau đó:

```bash
cd ichigo-ichie-v2
npm install
cp .env.example .env.local
npm run dev
```

Mở:

```text
http://localhost:3000
```

Nếu chưa điền Supabase, storefront vẫn chạy bằng dữ liệu demo. Admin sẽ báo cần kết nối Supabase.

## 3. Tạo Supabase

Tạo một project mới trên Supabase.

Trong **SQL Editor**, chạy theo đúng thứ tự:

1. `supabase/schema.sql`
2. `supabase/seed.sql`

Sau đó vào **Authentication → Users** và tạo tài khoản admin bằng email/password.

Lấy UUID của user đó rồi chạy:

```sql
insert into public.admins(user_id)
values ('UUID-CUA-ADMIN')
on conflict do nothing;
```

## 4. Điền `.env.local`

Trong Supabase → Project Settings / Connect / API Keys, lấy URL, Publishable key và Secret key.

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxx
SUPABASE_SECRET_KEY=<YOUR_SUPABASE_SECRET_KEY>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

**Không** đưa `SUPABASE_SECRET_KEY` vào code client, GitHub, ảnh chụp hoặc tin nhắn. Key này bypass RLS và chỉ được dùng phía server.

Khởi động lại dev server sau khi đổi `.env.local`:

```bash
npm run dev
```

## 5. Admin

Mở:

```text
http://localhost:3000/admin/login
```

Sau khi login có các phần:

- **Produits & menu**: thêm/sửa món, giá, stock, ảnh, category, visibility, pickup-only.
- **Formats / variantes**: 30 g, 50 g, 100 g, boîte/sachet, giá và stock riêng.
- **Options client**: tick nhóm option nào áp dụng cho món đang sửa.
- **Options & suppléments**: tạo Lait, Sucre, Température, Tapioca… và giá cộng thêm.
- **Catégories**: Menu / Boutique.
- **Commandes**: Nouvelle → En préparation → Prête → Terminée.
- **Réglages**: banner FR/EN, horaires, téléphone, Instagram…

Catalogue public dùng fetch `no-store`, nên sau khi Save trong admin, lần tải trang kế tiếp sẽ lấy dữ liệu mới từ Supabase, không phụ thuộc `localStorage` của admin.

## 6. Order flow hiện tại

```text
Menu
→ Choisir produit
→ Variant / lait / sucre / topping
→ Panier
→ Checkout
→ POST /api/orders
→ Server relit prix + règles Supabase
→ orders + order_items
→ Admin
```

Bản V2 hiện tạo order với:

```text
payment_status = unpaid
order_type = pickup
```

Stripe chưa được nối trong package này. Nên chạy ổn menu/order trước, sau đó thêm paiement online mà không phải thay cấu trúc catalogue/admin.

## 7. Đưa lên GitHub từ Mac

Trong thư mục project:

```bash
git init
git add .
git commit -m "Ichigo Ichie V2"
git branch -M main
git remote add origin URL_REPOSITORY_GITHUB
git push -u origin main
```

`.env.local` đã nằm trong `.gitignore`, nên secret không được push.

## 8. Deploy Vercel

- Import repository GitHub vào Vercel.
- Framework: Next.js.
- Thêm 4 environment variables giống `.env.local`.
- Đổi `NEXT_PUBLIC_SITE_URL` thành domain production, ví dụ `https://ichigoichie.fr`.
- Deploy.

Sau khi GitHub được nối Vercel, push mới lên production branch sẽ tự tạo deployment mới.

## 9. Kiểm tra trước khi chuyển domain

Chạy local:

```bash
npm run lint
npm run build
```

Sau đó test tối thiểu:

1. Admin login.
2. Thêm một món test → storefront thấy ngay sau reload.
3. Đổi giá → storefront lấy giá mới.
4. Thêm/sửa option và giá supplément.
5. Upload ảnh.
6. Order 1 món thường.
7. Order món có option bắt buộc.
8. Order matcha có variant.
9. Chuyển trạng thái order trong admin.
10. Test mobile Safari/Chrome.

## Cấu trúc chính

```text
src/app/
  page.tsx
  menu/
  boutique/
  panier/
  checkout/
  admin/
  api/orders/

src/components/
  AdminDashboard.tsx
  ProductCard.tsx
  CatalogGrid.tsx
  CartProvider.tsx

src/lib/
  catalog.ts
  settings.ts
  seed.ts
  supabase/

supabase/
  schema.sql
  seed.sql
```

## Giai đoạn tiếp theo nên làm

Sau khi V2 chạy ổn với Supabase:

- Stripe paiement online.
- Shipping France / Mondial Relay / Colissimo cho matcha.
- Gallery nhiều ảnh theo từng variant.
- Promo codes.
- Màn hình bếp/tablet cho order đang chuẩn bị.
- Email/SMS confirmation.
- Inventory decrement transaction-safe khi payment/order được xác nhận.
