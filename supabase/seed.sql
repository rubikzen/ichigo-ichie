-- Ichigo Ichie V2 — starter catalog. Run after schema.sql.

-- Categories
insert into public.categories(id,slug,name_fr,name_en,kind,sort_order,active) values
('10000000-0000-0000-0000-000000000001','matcha','Matcha','Matcha','menu',1,true),
('10000000-0000-0000-0000-000000000002','cafe-bubble','Café & Bubble Tea','Coffee & Bubble Tea','menu',2,true),
('10000000-0000-0000-0000-000000000003','desserts','Desserts','Desserts','menu',3,true),
('10000000-0000-0000-0000-000000000004','ceremonie','Matcha cérémonie','Ceremonial matcha','shop',1,true),
('10000000-0000-0000-0000-000000000005','latte','Matcha latte','Matcha for latte','shop',2,true),
('10000000-0000-0000-0000-000000000006','accessoires','Accessoires','Accessories','shop',3,true)
on conflict (id) do nothing;

-- Products / menu
insert into public.products(id,slug,category_id,type,name_fr,name_en,description_fr,description_en,badge,base_price,stock,pickup_only,active,featured,sort_order,image_url,ideal_for,shipping_weight_g) values
('20000000-0000-0000-0000-000000000001','matcha-latte','10000000-0000-0000-0000-000000000001','drink','Matcha Latte','Matcha Latte','Matcha japonais fouetté, doux et crémeux, avec le lait de votre choix.','Whisked Japanese matcha, smooth and creamy, with your choice of milk.','Classique',6.50,99,true,true,true,1,'/product-placeholder.svg',array['Matcha latte','Débutant'],0),
('20000000-0000-0000-0000-000000000002','strawberry-matcha','10000000-0000-0000-0000-000000000001','drink','Strawberry Matcha','Strawberry Matcha','Fraise, lait onctueux et matcha dans une boisson fraîche et gourmande.','Strawberry, smooth milk and matcha in a fresh, indulgent drink.','Fruité',7.50,99,true,true,true,2,'/product-placeholder.svg',array['Matcha latte','Boisson fruitée'],0),
('20000000-0000-0000-0000-000000000003','mango-matcha','10000000-0000-0000-0000-000000000001','drink','Mango Matcha','Mango Matcha','Mangue fruitée, lait et matcha végétal dans une création douce et lumineuse.','Fruity mango, milk and vegetal matcha in a soft, vibrant creation.','Fruité',7.50,99,true,true,true,3,'/product-placeholder.svg',array['Matcha latte','Été'],0),
('20000000-0000-0000-0000-000000000004','matcha-coconut-cloud','10000000-0000-0000-0000-000000000001','drink','Matcha Coconut Cloud','Matcha Coconut Cloud','Eau de coco fraîche surmontée d’une mousse nuageuse au matcha.','Fresh coconut water topped with a cloud-like matcha foam.','Signature',8.00,99,true,true,true,4,'/products/matcha-coconut-cloud.webp',array['Rafraîchissant','Été'],0),
('20000000-0000-0000-0000-000000000005','matcha-lava','10000000-0000-0000-0000-000000000003','dessert','Matcha Lava','Matcha Lava','Dessert fondant au matcha avec un cœur intensément coulant.','A soft matcha dessert with an intensely molten centre.','Gourmand',7.50,20,true,true,true,1,'/products/matcha-lava.webp',array['Dessert','Matcha intense'],0),
('20000000-0000-0000-0000-000000000006','kyocha-sen','10000000-0000-0000-0000-000000000004','product','KYOCHA Sen','KYOCHA Sen','Un matcha lumineux et facile à boire, agréable en usucha et suffisamment net pour un latte.','A bright, easy-drinking matcha for usucha and clean enough for lattes.','Usucha',24.90,30,false,true,true,1,'/products/matcha-packaging.webp',array['Usucha','Matcha latte','Débutant','Matcha quotidien'],90),
('20000000-0000-0000-0000-000000000007','chasen-takayama','10000000-0000-0000-0000-000000000006','accessory','Chasen Takayama','Takayama Chasen','Fouet en bambou pour obtenir une mousse fine et homogène.','Bamboo whisk for a fine, even foam.','Artisanal',24.00,14,false,true,false,2,'/product-placeholder.svg',array['Usucha','Matcha latte'],80)
on conflict (id) do nothing;

insert into public.product_variants(id,product_id,name,packaging,weight,price,stock,active,sort_order,image_url,shipping_weight_g) values
('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000006','30 g','can','30 g',24.90,18,true,1,'/products/matcha-packaging.webp',90),
('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000006','50 g','bag','50 g',36.90,8,true,2,'/products/matcha-packaging.webp',75),
('30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000006','100 g','bag','100 g',64.90,4,true,3,'/products/matcha-packaging.webp',125)
on conflict (id) do nothing;

-- Option groups
insert into public.option_groups(id,name_fr,name_en,required,min_select,max_select) values
('40000000-0000-0000-0000-000000000001','Température','Temperature',true,1,1),
('40000000-0000-0000-0000-000000000002','Lait','Milk',true,1,1),
('40000000-0000-0000-0000-000000000003','Sucre','Sugar',true,1,1),
('40000000-0000-0000-0000-000000000004','Suppléments','Extras',false,0,3),
('40000000-0000-0000-0000-000000000005','Service','Serving',true,1,1)
on conflict (id) do nothing;

insert into public.option_values(id,option_group_id,label_fr,label_en,price_delta,sort_order,active) values
('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','Glacé','Iced',0,1,true),
('50000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','Chaud','Hot',0,2,true),
('50000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000002','Lait','Dairy milk',0,1,true),
('50000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000002','Avoine','Oat',0.50,2,true),
('50000000-0000-0000-0000-000000000005','40000000-0000-0000-0000-000000000002','Coco','Coconut',0.50,3,true),
('50000000-0000-0000-0000-000000000006','40000000-0000-0000-0000-000000000003','0 %','0%',0,1,true),
('50000000-0000-0000-0000-000000000007','40000000-0000-0000-0000-000000000003','30 %','30%',0,2,true),
('50000000-0000-0000-0000-000000000008','40000000-0000-0000-0000-000000000003','50 %','50%',0,3,true),
('50000000-0000-0000-0000-000000000009','40000000-0000-0000-0000-000000000003','100 %','100%',0,4,true),
('50000000-0000-0000-0000-000000000010','40000000-0000-0000-0000-000000000004','Tapioca','Tapioca',0.70,1,true),
('50000000-0000-0000-0000-000000000011','40000000-0000-0000-0000-000000000004','Sucre brun','Brown sugar',0.50,2,true),
('50000000-0000-0000-0000-000000000012','40000000-0000-0000-0000-000000000004','Crème matcha','Matcha cream',1.00,3,true),
('50000000-0000-0000-0000-000000000013','40000000-0000-0000-0000-000000000005','Glacé','Iced',0,1,true)
on conflict (id) do nothing;

-- Link standard options to Matcha Latte / Strawberry / Mango.
insert into public.product_option_groups(product_id,option_group_id,sort_order) values
('20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',1),
('20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002',2),
('20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000003',3),
('20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000004',4),
('20000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000005',1),
('20000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002',2),
('20000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000003',3),
('20000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000004',4),
('20000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000005',1),
('20000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000002',2),
('20000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000003',3),
('20000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000004',4),
('20000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000005',1),
('20000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000003',2)
on conflict do nothing;
