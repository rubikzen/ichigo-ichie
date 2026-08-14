import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();

const cart = readFileSync(
  resolve(root, "src/components/CartPageClient.tsx"),
  "utf8",
);
const menu = readFileSync(
  resolve(root, "src/components/MenuInfoCard.tsx"),
  "utf8",
);
const footer = readFileSync(
  resolve(root, "src/components/SiteFooter.tsx"),
  "utf8",
);
const login = readFileSync(
  resolve(root, "src/app/admin/login/page.tsx"),
  "utf8",
);

test("cart thumbnails use SafeImage and keep responsive cart widths", () => {
  assert.match(cart, /import \{ SafeImage \} from "@\/components\/SafeImage";/);
  assert.match(
    cart,
    /className="cart-item-image-v216"[\s\S]*?width=\{236\}[\s\S]*?height=\{300\}[\s\S]*?sizes="\(max-width: 560px\) 82px, \(max-width: 820px\) 100px, 118px"/,
  );
  assert.doesNotMatch(cart, /<img/);
});

test("menu cards use SafeImage with product name alt text", () => {
  assert.match(menu, /import \{ SafeImage \} from "\.\/SafeImage";/);
  assert.match(
    menu,
    /<SafeImage[\s\S]*?src=\{image\}[\s\S]*?alt=\{name\}[\s\S]*?width=\{800\}[\s\S]*?height=\{640\}/,
  );
  assert.doesNotMatch(menu, /<img/);
});

test("footer logo uses SafeImage without changing CMS visibility conditions", () => {
  assert.match(footer, /settings\.footer_show_logo !== "false"/);
  assert.match(footer, /settings\.brand_logo_url/);
  assert.match(
    footer,
    /<SafeImage src=\{settings\.brand_logo_url\} alt="" width=\{64\} height=\{64\} sizes="64px" \/>/,
  );
  assert.doesNotMatch(footer, /<img/);
});

test("admin login logo uses a prioritized local SafeImage", () => {
  assert.match(login, /import \{ SafeImage \} from "@\/components\/SafeImage";/);
  assert.match(
    login,
    /<SafeImage src="\/brand-mark\.svg" alt="" width=\{58\} height=\{58\} sizes="58px" priority \/>/,
  );
  assert.doesNotMatch(login, /<img/);
});
