import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const product = readFileSync(
  resolve(root, "src/components/ProductCard.tsx"),
  "utf8",
);

test("ProductCard remount key follows product identity and option configuration", () => {
  assert.match(
    product,
    /function productCardStateKey\(product: Product\) \{\s+return `\$\{product\.id\}:\$\{JSON\.stringify\(product\.option_groups\)\}`;\s+\}/,
  );
  assert.match(
    product,
    /return <ProductCardStateful key=\{productCardStateKey\(product\)\} product=\{product\} \/>;/,
  );
});

test("ProductCard keeps variant option and gallery defaults in state initializers", () => {
  assert.match(
    product,
    /const \[variantId, setVariantId\] = useState\(firstAvailable\?\.id \?\? ""\);/,
  );
  assert.match(
    product,
    /const \[selectedPackaging, setSelectedPackaging\] = useState<PackagingKey>\(firstAvailable \? packagingKey\(firstAvailable\) : "other"\);/,
  );
  assert.match(
    product,
    /const \[imageIndex, setImageIndex\] = useState\(0\);/,
  );
  assert.match(
    product,
    /const \[selected, setSelected\] = useState<Record<string, string\[\]>>\(\(\) => Object\.fromEntries\(product\.option_groups\.map/,
  );
});

test("ProductCard no longer synchronizes local selection state from props inside effects", () => {
  assert.doesNotMatch(
    product,
    /useEffect\(\(\) => \{\s+setSelected\(Object\.fromEntries\(product\.option_groups\.map/,
  );
  assert.doesNotMatch(
    product,
    /useEffect\(\(\) => \{\s+const next = selectableVariants\.find/,
  );
  assert.doesNotMatch(
    product,
    /\}, \[product\.id\]\); \/\/ eslint-disable-line react-hooks\/exhaustive-deps/,
  );

  // The modal effect remains because it synchronizes with document.body and keyboard events.
  assert.match(product, /document\.body\.style\.overflow = "hidden"/);
  assert.match(product, /window\.addEventListener\("keydown", onKeyDown\)/);
});
