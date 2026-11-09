import test from 'node:test';
import assert from 'node:assert/strict';

// Provide browser storage mocks for Node test environment
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) || null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

import { CATALOG } from '../../shared/catalogData.js';
import { CatalogService } from '../../src/data/CatalogService.js';
import {
  SeoService,
  sanitizeMetaContent,
  generateProductStructuredData,
  generateBreadcrumbStructuredData,
  updateSeo,
  setProductSeo,
  setDefaultSeo,
} from '../../src/data/SeoService.js';
import prisma from '../src/db.js';
import { createApp } from '../src/server.js';
import {
  createSitemapHandler,
  createSitemapRouter,
  generateSitemapXml,
  getActiveProducts,
  CORE_PAGES,
  formatLastmod,
} from '../src/routes/sitemap.js';

async function withServer(app, callback) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await callback(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('CatalogService.findFallbackProduct returns full component details for real catalog products', () => {
  const rogersProd = CatalogService.findFallbackProduct('rt-duroid-5880-2');
  assert.ok(rogersProd, 'Expected rt-duroid-5880-2 to be found in catalog');
  assert.equal(rogersProd.id, 'rt-duroid-5880-2');
  assert.equal(rogersProd.model, 'RT/duroid 5880');
  assert.equal(rogersProd.oem, 'Rogers');
  assert.equal(rogersProd.oemId, 'rogers-corporation');
  assert.equal(rogersProd.category, 'rt-duroid');
  assert.equal(rogersProd.categoryName, 'RT/Duroid');
  assert.ok(rogersProd.description.length > 0);
  assert.ok(Array.isArray(rogersProd.relatedProducts));
  assert.ok(rogersProd.relatedProducts.length > 0);

  const miniCircuitsProd = CatalogService.findFallbackProduct('rf-adapters-78');
  assert.ok(miniCircuitsProd, 'Expected rf-adapters-78 to be found in catalog');
  assert.equal(miniCircuitsProd.id, 'rf-adapters-78');
  assert.equal(miniCircuitsProd.oemId, 'minicircuits');
  assert.equal(miniCircuitsProd.category, 'rf-adapters');
});

test('CatalogService.findFallbackProduct returns null for unknown or non-existent product IDs', () => {
  const unknownProd = CatalogService.findFallbackProduct('non-existent-product-id-xyz');
  assert.equal(unknownProd, null);

  const emptyProd = CatalogService.findFallbackProduct('');
  assert.equal(emptyProd, null);

  const nullProd = CatalogService.findFallbackProduct(null);
  assert.equal(nullProd, null);
});

test('CatalogService.getPublicProduct falls back to real catalog when backend has 0 records', async () => {
  // Database has 0 records, so API would throw or return fallback
  const product = await CatalogService.getPublicProduct('ro4003c-10');
  assert.ok(product);
  assert.equal(product.id, 'ro4003c-10');
  assert.equal(product.model, 'RO4003C');
  assert.equal(product.oemId, 'rogers-corporation');
  assert.equal(product.categoryName, 'RO400 Series');
});

test('CatalogService.getPublicProduct throws error for truly missing products when fallback has no record', async () => {
  await assert.rejects(
    async () => {
      await CatalogService.getPublicProduct('unknown-component-xyz-999');
    },
    (err) => err !== null
  );
});

test('sanitizeMetaContent strips HTML tags and normalizes whitespace safely', () => {
  assert.equal(
    sanitizeMetaContent('High-frequency <strong>mmWave</strong> laminate<script>alert(1)</script>'),
    'High-frequency mmWave laminatealert(1)'
  );
  assert.equal(
    sanitizeMetaContent('Line 1\nLine 2\r\n\tLine 3'),
    'Line 1 Line 2 Line 3'
  );
  assert.equal(sanitizeMetaContent(null), '');
  assert.equal(sanitizeMetaContent(undefined), '');
  assert.equal(sanitizeMetaContent(12345), '12345');
});

test('generateProductStructuredData creates valid Schema.org Product JSON-LD', () => {
  const product = {
    id: 'rt-duroid-5880-2',
    model: 'RT/duroid 5880',
    name: 'RT/duroid 5880 High Frequency Laminate',
    oem: 'Rogers Corporation',
    categoryName: 'RT/Duroid',
    description: 'PTFE composite laminate designed for exacting stripline and microstrip circuit applications.',
    image: '/images/rf-laminate.jpg',
  };

  const schema = generateProductStructuredData(product, 'https://iconelectromatic.com');
  assert.ok(schema);
  assert.equal(schema['@context'], 'https://schema.org');
  assert.equal(schema['@type'], 'Product');
  assert.equal(schema.name, 'RT/duroid 5880');
  assert.equal(schema.sku, 'rt-duroid-5880-2');
  assert.equal(schema.mpn, 'RT/duroid 5880');
  assert.equal(schema.brand['@type'], 'Brand');
  assert.equal(schema.brand.name, 'Rogers Corporation');
  assert.equal(schema.category, 'RT/Duroid');
  assert.equal(schema.image, 'https://iconelectromatic.com/images/rf-laminate.jpg');
  assert.equal(schema.offers.url, 'https://iconelectromatic.com/product/rt-duroid-5880-2');
  // Confirm no fake prices or fake stock availability are invented
  assert.equal(schema.offers.price, undefined);
  assert.equal(schema.offers.availability, undefined);
});

test('generateBreadcrumbStructuredData creates valid Schema.org BreadcrumbList', () => {
  const crumbs = [
    { name: 'Home', url: '/' },
    { name: 'Products', url: '/products' },
    { name: 'Rogers Corporation', url: '/products?oem=rogers-corporation' },
    { name: 'RT/duroid 5880', url: '/product/rt-duroid-5880-2' },
  ];

  const breadcrumb = generateBreadcrumbStructuredData(crumbs, 'https://iconelectromatic.com');
  assert.ok(breadcrumb);
  assert.equal(breadcrumb['@context'], 'https://schema.org');
  assert.equal(breadcrumb['@type'], 'BreadcrumbList');
  assert.equal(breadcrumb.itemListElement.length, 4);
  assert.equal(breadcrumb.itemListElement[0].position, 1);
  assert.equal(breadcrumb.itemListElement[0].name, 'Home');
  assert.equal(breadcrumb.itemListElement[3].name, 'RT/duroid 5880');
  assert.equal(breadcrumb.itemListElement[3].item, 'https://iconelectromatic.com/product/rt-duroid-5880-2');
});

test('setProductSeo generates product title, description, and canonical URL without fabricated claims', () => {
  const product = {
    id: 'tcr-ehf-25n18p8x-55',
    model: 'TCR EHF® 25N18P8X',
    name: 'TCR EHF® 25N18P8X',
    oem: 'Ohmega Ticer',
    categoryName: 'TCR-EHF Thin Film Resistor',
    description: 'Thin film embedded resistor copper foil for high-frequency millimeter wave applications.',
    applications: '5G mmWave Base Stations, Defense Electronics, Aerospace Radar',
    image: '/images/rf-microwave-pcb.jpg',
    visible: true,
  };

  const seo = setProductSeo(product);
  assert.ok(seo);
  assert.equal(
    seo.title,
    'TCR EHF® 25N18P8X — Ohmega Ticer TCR-EHF Thin Film Resistor | ICON ELECTROMATIC'
  );
  assert.match(seo.description, /Thin film embedded resistor/);
  assert.match(seo.description, /5G mmWave/);
  assert.equal(seo.noindex, false);
  assert.equal(
    seo.canonicalUrl,
    'https://iconelectromatic.com/product/tcr-ehf-25n18p8x-55'
  );
  assert.equal(seo.structuredData['@type'], 'Product');
});

test('setProductSeo respects optional custom seoTitle and seoDescription when present', () => {
  const productWithCustomSeo = {
    id: 'custom-seo-prod-1',
    model: 'Model-X',
    name: 'Model-X',
    oem: 'Test OEM',
    categoryName: 'Amplifiers',
    description: 'Generic description',
    seoTitle: 'Custom High-Performance Amplifier Model-X | ICON ELECTROMATIC',
    seoDescription: 'Engineered for satellite communications and rugged defense RF front-ends.',
    image: '/images/rf-filter.jpg',
    visible: true,
  };

  const seo = setProductSeo(productWithCustomSeo);
  assert.equal(seo.title, 'Custom High-Performance Amplifier Model-X | ICON ELECTROMATIC');
  assert.equal(seo.description, 'Engineered for satellite communications and rugged defense RF front-ends.');
  assert.equal(seo.canonicalUrl, 'https://iconelectromatic.com/product/custom-seo-prod-1');
});

test('setProductSeo sets noindex: true when product is null or hidden', () => {
  const nullSeo = setProductSeo(null);
  assert.equal(nullSeo.noindex, true);
  assert.match(nullSeo.title, /Component Not Found/);

  const hiddenProduct = {
    id: 'hidden-item-1',
    model: 'Secret Component',
    oem: 'Test OEM',
    visible: false,
  };
  const hiddenSeo = setProductSeo(hiddenProduct);
  assert.equal(hiddenSeo.noindex, true);
});

test('setDefaultSeo provides distinct titles and descriptions for primary website routes', () => {
  const homeSeo = setDefaultSeo('/');
  assert.match(homeSeo.title, /ICON ELECTROMATIC/);
  assert.equal(homeSeo.canonicalUrl, 'https://iconelectromatic.com/');
  assert.equal(homeSeo.structuredData?.['@type'], 'Organization');

  const productsSeo = setDefaultSeo('/products');
  assert.match(productsSeo.title, /Product Portfolio & Component Catalog/);
  assert.equal(productsSeo.canonicalUrl, 'https://iconelectromatic.com/products');

  const partnersSeo = setDefaultSeo('/partners');
  assert.match(partnersSeo.title, /Authorized OEM Principals/);

  const adminSeo = setDefaultSeo('/admin');
  assert.equal(adminSeo.noindex, true);
});

test('SITEMAP VERIFICATION: public/sitemap.xml covers all 169 catalog products and 7 core pages with 0 hash fragments', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const sitemapPath = path.resolve('../public/sitemap.xml');
  assert.ok(fs.existsSync(sitemapPath), 'public/sitemap.xml must exist');

  const xmlContent = fs.readFileSync(sitemapPath, 'utf-8');
  assert.ok(xmlContent.startsWith('<?xml'), 'Sitemap must have valid XML header');
  assert.ok(!xmlContent.includes('#'), 'Sitemap must contain ZERO hash fragments');
  assert.ok(!xmlContent.includes('/admin'), 'Sitemap must not expose admin routes');

  const locMatches = [...xmlContent.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
  assert.equal(locMatches.length, 176, `Expected exactly 176 URLs (7 core + 169 products), found ${locMatches.length}`);

  // Verify all 169 products exist in sitemap
  let catalogProdCount = 0;
  CATALOG.forEach(oem => {
    (oem.categories || []).forEach(cat => {
      (cat.products || []).forEach(prod => {
        catalogProdCount++;
        const expectedUrl = `https://iconelectromatic.com/product/${encodeURIComponent(prod.id)}`;
        assert.ok(locMatches.includes(expectedUrl), `Missing product in sitemap: ${expectedUrl}`);
      });
    });
  });
  assert.equal(catalogProdCount, 169);
});

test('ROBOTS.TXT VERIFICATION: public/robots.txt disallows admin and references sitemap without fragments', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const robotsPath = path.resolve('../public/robots.txt');
  assert.ok(fs.existsSync(robotsPath), 'public/robots.txt must exist');

  const robotsContent = fs.readFileSync(robotsPath, 'utf-8');
  assert.ok(robotsContent.includes('Disallow: /admin'), 'Must disallow /admin');
  assert.ok(robotsContent.includes('Disallow: /api/'), 'Must disallow /api/');
  assert.ok(!robotsContent.includes('#'), 'robots.txt must contain ZERO hash fragments');
  assert.ok(robotsContent.includes('Sitemap: https://iconelectromatic.com/sitemap.xml'), 'Must point to sitemap.xml');
});

test('PRERENDER VERIFICATION: dist/product/:id/index.html files contain valid static metadata, single H1, and non-empty body', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const sampleProductIds = ['rt-duroid-5880-2', 'ro4003c-10', 'rf-adapters-78'];

  for (const prodId of sampleProductIds) {
    const filePath = path.resolve(`../dist/product/${prodId}/index.html`);
    assert.ok(fs.existsSync(filePath), `Prerendered file must exist: ${filePath}`);

    const html = fs.readFileSync(filePath, 'utf-8');
    assert.ok(html.includes(`<link rel="canonical" href="https://iconelectromatic.com/product/${prodId}" />`), 'Must have clean canonical URL');
    assert.ok(html.includes('property="og:title"'), 'Must have og:title');
    assert.ok(html.includes('property="og:description"'), 'Must have og:description');
    assert.ok(html.includes('id="structured-data-jsonld"'), 'Must have structured-data-jsonld');
    assert.ok(html.includes('<main class="page-content product-detail-page"'), 'Must contain rendered product body for non-JS readers');
    
    // Exactly one <h1> tag on the public product page
    const h1Matches = [...html.matchAll(/<h1[\s>]/g)];
    assert.equal(h1Matches.length, 1, `Expected exactly 1 <h1> tag, found ${h1Matches.length} in ${prodId}`);
  }
});

test('POST-TRANSFER DATABASE VERIFICATION: PostgreSQL catalog tables contain the expected baseline counts', async () => {
  // The baseline catalog transfer was applied via the Admin CMS.
  // These counts verify that the SEO tests did not corrupt or modify catalog records.
  const [oemCount, catCount, prodCount, importRunCount, importItemCount] = await Promise.all([
    prisma.oem.count(),
    prisma.category.count(),
    prisma.product.count(),
    prisma.importRun.count(),
    prisma.importItem.count(),
  ]);

  assert.ok(oemCount >= 15, `oem table must have at least 15 records, got ${oemCount}`);
  assert.ok(catCount >= 88, `category table must have at least 88 records, got ${catCount}`);
  assert.ok(prodCount >= 169, `product table must have at least 169 records, got ${prodCount}`);
  assert.ok(importRunCount >= 1, `importRun table must have at least 1 record, got ${importRunCount}`);
  assert.ok(importItemCount >= 272, `importItem table must have at least 272 records (15+88+169), got ${importItemCount}`);
});

test('DYNAMIC SITEMAP ENDPOINT: GET /sitemap.xml and GET /api/sitemap.xml return 200, application/xml, and valid XML', async () => {
  const app = createApp({ prismaClient: prisma });

  await withServer(app, async (baseUrl) => {
    for (const route of ['/sitemap.xml', '/api/sitemap.xml']) {
      const res = await fetch(`${baseUrl}${route}`);
      assert.equal(res.status, 200, `Expected 200 for ${route}`);
      assert.match(res.headers.get('content-type') || '', /application\/xml/);
      assert.ok(res.headers.get('cache-control')?.includes('max-age=600'));

      const xml = await res.text();
      assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'Must have valid XML declaration');
      assert.ok(xml.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'), 'Must have urlset namespace');
      assert.ok(xml.endsWith('</urlset>\n') || xml.endsWith('</urlset>'), 'Must close urlset');
      assert.ok(!xml.includes('#'), 'Must not contain hash fragments');
      assert.ok(!xml.includes('/admin'), 'Must not expose admin URLs');

      const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
      assert.ok(locs.length >= 176, `Expected at least 176 URLs (7 core + 169 products), got ${locs.length}`);
    }
  });
});

test('DYNAMIC SITEMAP: Covers 7 core pages and PostgreSQL products with real lastmod timestamps', async () => {
  const app = createApp({ prismaClient: prisma });

  await withServer(app, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/sitemap.xml`);
    assert.equal(res.status, 200);
    const xml = await res.text();

    // Verify 7 core pages
    const expectedCorePages = [
      'https://iconelectromatic.com/',
      'https://iconelectromatic.com/products',
      'https://iconelectromatic.com/partners',
      'https://iconelectromatic.com/services',
      'https://iconelectromatic.com/about',
      'https://iconelectromatic.com/blogs',
      'https://iconelectromatic.com/contact',
    ];
    for (const coreUrl of expectedCorePages) {
      assert.ok(xml.includes(`<loc>${coreUrl}</loc>`), `Core page missing from sitemap: ${coreUrl}`);
    }

    // Verify real lastmod timestamps matching YYYY-MM-DD
    const lastmods = [...xml.matchAll(/<lastmod>(.*?)<\/lastmod>/g)].map(m => m[1]);
    assert.ok(lastmods.length > 0, 'Expected lastmod timestamps to be present');
    for (const lm of lastmods) {
      assert.match(lm, /^\d{4}-\d{2}-\d{2}$/, `Invalid lastmod format: ${lm}`);
    }

    // Verify sample products from PostgreSQL
    const dbSample = await prisma.product.findFirst({
      where: { visible: true, category: { visible: true, oem: { visible: true } } },
      select: { id: true, updatedAt: true },
    });
    assert.ok(dbSample);
    const expectedLoc = `<loc>https://iconelectromatic.com/product/${encodeURIComponent(dbSample.id)}</loc>`;
    assert.ok(xml.includes(expectedLoc), `Expected sitemap to contain ${expectedLoc}`);
    const expectedLastmod = dbSample.updatedAt.toISOString().split('T')[0];
    assert.ok(xml.includes(`<lastmod>${expectedLastmod}</lastmod>`), 'Expected authentic DB timestamp in lastmod');
  });
});

test('DYNAMIC SITEMAP: Filters out hidden products, hidden categories, and hidden OEMs', async () => {
  const mockPrisma = {
    product: {
      findMany: async (args) => {
        // Verify the query applies the visibility filter across product, category, and oem
        assert.equal(args.where.visible, true);
        assert.equal(args.where.category.visible, true);
        assert.equal(args.where.category.oem.visible, true);

        // Return only the visible product
        return [
          { id: 'active-prod-1', updatedAt: new Date('2026-10-20') },
        ];
      },
    },
  };

  const handler = createSitemapHandler({
    prismaClient: mockPrisma,
    baseUrl: 'https://iconelectromatic.com',
  });

  let responseBody = '';
  let responseStatus = 0;
  const mockRes = {
    setHeader: () => {},
    status: (s) => {
      responseStatus = s;
      return mockRes;
    },
    send: (body) => {
      responseBody = body;
      return mockRes;
    },
  };

  await handler({}, mockRes);
  assert.equal(responseStatus, 200);
  assert.ok(responseBody.includes('<loc>https://iconelectromatic.com/product/active-prod-1</loc>'));
  assert.ok(!responseBody.includes('hidden-prod'));
});

test('DYNAMIC SITEMAP: Automatically includes newly added products without requiring a rebuild', async () => {
  let productList = [
    { id: 'baseline-part-1', updatedAt: new Date('2026-10-15') },
  ];

  const mockPrisma = {
    product: {
      findMany: async () => productList,
    },
  };

  const handler = createSitemapHandler({
    prismaClient: mockPrisma,
    baseUrl: 'https://iconelectromatic.com',
  });

  // 1. Initial request before adding product
  let xml1 = '';
  await handler({}, {
    setHeader: () => {},
    status: () => ({ send: (b) => { xml1 = b; } }),
  });
  assert.ok(xml1.includes('baseline-part-1'));
  assert.ok(!xml1.includes('new-future-amp-999'));

  // 2. Admin adds a product in PostgreSQL via CMS (no code changes, no rebuild)
  productList.push({
    id: 'new-future-amp-999',
    updatedAt: new Date('2026-10-29'),
  });

  // 3. Second request immediately reflects the new product
  let xml2 = '';
  await handler({}, {
    setHeader: () => {},
    status: () => ({ send: (b) => { xml2 = b; } }),
  });
  assert.ok(xml2.includes('<loc>https://iconelectromatic.com/product/new-future-amp-999</loc>'));
  assert.ok(xml2.includes('<lastmod>2026-10-29</lastmod>'));
});

test('DYNAMIC SITEMAP: Falls back gracefully to static fallback when database query fails', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const tempFallbackPath = path.resolve('./test/temp-sitemap-fallback.xml');

  const sampleFallbackXml = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://iconelectromatic.com/fallback-route</loc><changefreq>weekly</changefreq><priority>1.0</priority></url></urlset>';
  fs.writeFileSync(tempFallbackPath, sampleFallbackXml, 'utf-8');

  try {
    const failingPrisma = {
      product: {
        findMany: async () => {
          throw new Error('Database connection failed');
        },
      },
    };

    const handler = createSitemapHandler({
      prismaClient: failingPrisma,
      fallbackPath: tempFallbackPath,
    });

    let resBody = '';
    let resStatus = 0;
    await handler({}, {
      setHeader: () => {},
      status: (s) => {
        resStatus = s;
        return {
          send: (b) => { resBody = b; },
        };
      },
    });

    assert.equal(resStatus, 200, 'Expected 200 via fallback');
    assert.equal(resBody, sampleFallbackXml);
  } finally {
    if (fs.existsSync(tempFallbackPath)) {
      fs.unlinkSync(tempFallbackPath);
    }
  }
});
