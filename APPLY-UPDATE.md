# Ichigo Ichie V2.2 — Boutique Shipping

Bản cập nhật này bổ sung giao hàng cho phần **Boutique** và giữ nguyên luồng **retrait boutique** cho đồ uống/menu.

## Chức năng mới

- Checkout Boutique chọn **Livraison** hoặc **Retrait boutique**.
- Khi giao hàng, khách phải nhập: prénom, nom, email, téléphone, adresse, complément (tuỳ chọn), code postal, ville.
- Hiện hỗ trợ **France métropolitaine**; mã bưu điện 97xxx/98xxx (Outre-mer) bị chặn ở server.
- Mỗi sản phẩm/variant có **Poids expédition (g)** riêng trong Admin.
- Tổng trọng lượng colis = tổng trọng lượng các sản phẩm × số lượng + trọng lượng emballage.
- Server tự tính lại trọng lượng và giá; không tin giá/khối lượng gửi từ browser.
- Admin > Réglages có **Poids emballage d’expédition (g)**.
- Admin > Réglages có **Livraison & tarifs** để tự sửa các tranche de poids, giá và mức livraison offerte.
- Đơn giao hàng lưu địa chỉ, phương thức vận chuyển, phí ship và trọng lượng colis.
- Trang suivi và Admin hiển thị thông tin giao hàng.

## Tarif mặc định

Migration tạo sẵn `Colissimo à domicile` và bảng giá 2026 theo trọng lượng. Đây chỉ là giá khởi tạo và có thể sửa trực tiếp trong Admin.

Mức livraison offerte mặc định: **89 €**.
Poids emballage mặc định: **120 g**.

## Cài đặt

### 1. Dừng server

Trong Terminal đang chạy `npm run dev`:

```bash
Ctrl + C
```

### 2. Backup project

```bash
cp -R ~/Downloads/ichigo-ichie-v2 ~/Downloads/ichigo-ichie-v2-backup-v2.2
```

### 3. Chép patch vào project

Giải nén `ichigo-shipping-v2.2.zip` trong Downloads, sau đó:

```bash
rsync -av ~/Downloads/ichigo-shipping-v2.2/ ~/Downloads/ichigo-ichie-v2/
```

### 4. Đẩy migration Supabase

```bash
cd ~/Downloads/ichigo-ichie-v2
npx supabase db push
```

Xác nhận migration sau được apply:

```text
20260808143000_shipping_checkout.sql
```

### 5. Chạy website

```bash
npm run dev
```

## Cấu hình trong Admin

Mở:

```text
http://localhost:3000/admin
```

### Produits

Với từng sản phẩm Boutique, điền **Poids expédition (g)**.

Nếu sản phẩm có variant 30g / 50g / 100g, điền trọng lượng riêng cho từng variant. Đây nên là **trọng lượng thực tế dùng để tính cước** của một đơn vị sản phẩm (sản phẩm + bao bì riêng của sản phẩm), không chỉ là poids net của trà.

Ví dụ:

- boîte matcha 30 g: poids expédition 90 g
- sachet matcha 50 g: poids expédition 75 g
- sachet matcha 100 g: poids expédition 125 g

### Réglages

`Poids emballage d’expédition (g)` là trọng lượng carton/giấy chèn dùng một lần cho toàn đơn. Giá mặc định 120 g.

Trong **Livraison & tarifs**, bạn có thể sửa:

- tên phương thức giao hàng;
- bật/tắt phương thức;
- livraison offerte dès ... €;
- tranche jusqu'à 250 g / 500 g / 750 g / ...;
- giá từng tranche.

## Test

1. Mở `http://localhost:3000/boutique`.
2. Thêm 1–2 sản phẩm vào panier.
3. Checkout và chọn `Livraison`.
4. Nhập địa chỉ France métropolitaine.
5. Kiểm tra dòng `Poids colis` và phí vận chuyển.
6. Tăng số lượng sản phẩm để kiểm tra hệ thống tự chuyển sang tranche de poids cao hơn.
7. Tạo đơn.
8. Vào `/admin` > `Commandes`: kiểm tra địa chỉ, Colissimo, poids colis và frais de livraison.

## Lưu ý

Nếu một sản phẩm Boutique có `Poids expédition = 0`, server sẽ từ chối giao hàng để tránh tính sai phí.

Nếu panier chứa đồ uống/dessert `pickup_only`, toàn panier sẽ buộc `Retrait boutique`.
