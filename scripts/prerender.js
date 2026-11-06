/**
 * Build-time Prerendering & SEO Generator — ICON ELECTROMATIC
 * Generates static HTML for every active product at dist/product/:id/index.html
 * and builds a clean XML sitemap without hash fragments.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CATALOG } from '../src/data/catalogData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.resolve(ROOT_DIR, 'dist');
const BASE_ORIGIN = process.env.VITE_SITE_ORIGIN || process.env.SITE_ORIGIN || 'https://iconelectromatic.com';
const SITE_NAME = 'ICON ELECTROMATIC';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeText(str) {
  if (!str) return '';
  return String(str)
    .replace(/<[^>]*>/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .trim();
}

async function run() {
  const distIndexPath = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(distIndexPath)) {
    console.error('Error: dist/index.html not found. Run "vite build" first.');
    process.exit(1);
  }

  const templateHtml = fs.readFileSync(distIndexPath, 'utf-8');

  // Extract all active products
  const activeProducts = [];
  CATALOG.forEach((oem) => {
    if (oem.visible === false) return;
    (oem.categories || []).forEach((cat) => {
      if (cat.visible === false) return;
      (cat.products || []).forEach((prod) => {
        if (prod.visible === false) return;
        activeProducts.push({
          product: prod,
          category: cat,
          oem: oem,
        });
      });
    });
  });

  console.log(`Prerendering ${activeProducts.length} active products...`);

  // Prerender each product
  for (const item of activeProducts) {
    const { product, category, oem } = item;
    const model = sanitizeText(product.name || 'Component');
    const oemName = sanitizeText(oem.name || 'Authorized OEM');
    const oemShort = sanitizeText(oem.shortName || oem.name);
    const catName = sanitizeText(category.name || 'Component');

    const title = sanitizeText(product.seoTitle || product.sourceData?.seo?.title) ||
      `${model} — ${oemShort} ${catName} | ${SITE_NAME}`;

    let rawDesc = product.description || '';
    if (product.applications) {
      rawDesc += ` Applications: ${product.applications}`;
    }
    const fallbackDesc = `${model} supplied by ${oemName}. High-frequency RF and microwave component distributed by ${SITE_NAME}.`;
    const cleanDesc = sanitizeText(product.seoDescription || product.sourceData?.seo?.description) ||
      sanitizeText(rawDesc) || fallbackDesc;
    const description = cleanDesc.length > 155 ? `${cleanDesc.slice(0, 152)}...` : cleanDesc;

    const canonicalUrl = `${BASE_ORIGIN}/product/${encodeURIComponent(product.id)}`;

    let imageUrl = product.image || '/images/rf-filter.jpg';
    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      imageUrl = `${BASE_ORIGIN}/${imageUrl.replace(/^\/+/, '')}`;
    }

    // JSON-LD Structured Data
    const productJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: model,
      image: imageUrl,
      description: description,
      sku: product.id,
      mpn: model,
      brand: {
        '@type': 'Brand',
        name: oemName,
      },
      category: catName,
      offers: {
        '@type': 'Offer',
        url: canonicalUrl,
        description: 'Authorized OEM distribution — request quote for formal pricing and lead time.',
      },
    };

    const breadcrumbJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name: 'Products', item: `${BASE_ORIGIN}/products` },
        { '@type': 'ListItem', position: 3, name: oemName, item: `${BASE_ORIGIN}/products?oem=${encodeURIComponent(oem.id)}` },
        { '@type': 'ListItem', position: 4, name: catName, item: `${BASE_ORIGIN}/products?oem=${encodeURIComponent(oem.id)}&category=${encodeURIComponent(category.id)}` },
        { '@type': 'ListItem', position: 5, name: model, item: canonicalUrl },
      ],
    };

    // Body content for non-JS readers and crawlers (Single H1)
    const appBodyHtml = `
      <main class="page-content product-detail-page" style="padding-top:100px;min-height:80vh;">
        <div class="container" style="max-width:1200px;margin:0 auto;padding:20px;">
          <nav aria-label="Breadcrumb" style="margin-bottom:20px;font-size:0.875rem;color:#94a3b8;">
            <a href="/" style="color:#60a5fa;text-decoration:none;">Home</a> &gt;
            <a href="/products" style="color:#60a5fa;text-decoration:none;">Products</a> &gt;
            <a href="/products?oem=${encodeURIComponent(oem.id)}" style="color:#60a5fa;text-decoration:none;">${escapeHtml(oemName)}</a> &gt;
            <span>${escapeHtml(catName)}</span> &gt;
            <span style="color:#f8fafc;">${escapeHtml(model)}</span>
          </nav>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));gap:40px;align-items:start;">
            <div style="background:#0b1120;border:1px solid #1e293b;border-radius:12px;padding:24px;text-align:center;">
              <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(model)}" style="max-width:100%;height:auto;max-height:360px;object-fit:contain;border-radius:8px;" />
            </div>
            <div>
              <div style="display:inline-block;padding:4px 12px;background:rgba(37,99,235,0.15);border:1px solid rgba(37,99,235,0.4);border-radius:6px;color:#60a5fa;font-size:0.8rem;font-weight:700;margin-bottom:12px;">
                ${escapeHtml(oemName)} &bull; ${escapeHtml(catName)}
              </div>
              <h1 style="font-size:2rem;font-weight:800;color:#ffffff;margin:0 0 16px 0;line-height:1.2;">
                ${escapeHtml(model)}
              </h1>
              <p style="color:#cbd5e1;line-height:1.6;margin-bottom:20px;font-size:1.05rem;">
                ${escapeHtml(product.description || fallbackDesc)}
              </p>
              ${product.applications ? `
                <div style="margin-bottom:24px;background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:16px;">
                  <strong style="color:#94a3b8;display:block;margin-bottom:8px;font-size:0.85rem;text-transform:uppercase;letter-spacing:0.05em;">Key Applications:</strong>
                  <p style="color:#e2e8f0;margin:0;font-size:0.95rem;line-height:1.5;">${escapeHtml(product.applications)}</p>
                </div>
              ` : ''}
              <div style="display:flex;gap:12px;flex-wrap:wrap;">
                <a href="/contact?subject=rfq&model=${encodeURIComponent(model)}&oem=${encodeURIComponent(oemName)}" style="display:inline-flex;align-items:center;padding:12px 24px;background:#2563eb;color:#ffffff;border-radius:6px;font-weight:600;text-decoration:none;">
                  Request Quote / RFQ
                </a>
                <a href="/products" style="display:inline-flex;align-items:center;padding:12px 20px;background:rgba(255,255,255,0.08);color:#cbd5e1;border:1px solid #334155;border-radius:6px;font-weight:600;text-decoration:none;">
                  Back to Catalog
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
    `;

    // Inject metadata into template
    let pageHtml = templateHtml;

    // Replace Title
    pageHtml = pageHtml.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);

    // Replace Meta Description
    pageHtml = pageHtml.replace(
      /<meta\s+name="description"\s+content=".*?"\s*\/?>/i,
      `<meta name="description" content="${escapeHtml(description)}" />`
    );

    // Replace Canonical Link
    pageHtml = pageHtml.replace(
      /<link\s+rel="canonical"\s+href=".*?"\s*\/?>/i,
      `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`
    );

    // Replace Open Graph Tags
    pageHtml = pageHtml.replace(
      /<meta\s+property="og:title"\s+content=".*?"\s*\/?>/i,
      `<meta property="og:title" content="${escapeHtml(title)}" />`
    );
    pageHtml = pageHtml.replace(
      /<meta\s+property="og:description"\s+content=".*?"\s*\/?>/i,
      `<meta property="og:description" content="${escapeHtml(description)}" />`
    );
    pageHtml = pageHtml.replace(
      /<meta\s+property="og:image"\s+content=".*?"\s*\/?>/i,
      `<meta property="og:image" content="${escapeHtml(imageUrl)}" />`
    );
    pageHtml = pageHtml.replace(
      /<meta\s+property="og:type"\s+content=".*?"\s*\/?>/i,
      `<meta property="og:type" content="product" />`
    );

    // Add og:url if not present, or replace
    if (pageHtml.includes('property="og:url"')) {
      pageHtml = pageHtml.replace(
        /<meta\s+property="og:url"\s+content=".*?"\s*\/?>/i,
        `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`
      );
    } else {
      pageHtml = pageHtml.replace(
        '</head>',
        `  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />\n  </head>`
      );
    }

    // Replace Twitter Card Tags
    pageHtml = pageHtml.replace(
      /<meta\s+name="twitter:title"\s+content=".*?"\s*\/?>/i,
      `<meta name="twitter:title" content="${escapeHtml(title)}" />`
    );
    pageHtml = pageHtml.replace(
      /<meta\s+name="twitter:description"\s+content=".*?"\s*\/?>/i,
      `<meta name="twitter:description" content="${escapeHtml(description)}" />`
    );
    pageHtml = pageHtml.replace(
      /<meta\s+name="twitter:image"\s+content=".*?"\s*\/?>/i,
      `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`
    );

    // Inject JSON-LD structured data into head
    const jsonLdBlock = `  <script type="application/ld+json" id="structured-data-jsonld">${JSON.stringify([productJsonLd, breadcrumbJsonLd])}</script>\n`;
    pageHtml = pageHtml.replace('</head>', `${jsonLdBlock}</head>`);

    // Inject prerendered body into <div id="app"></div>
    pageHtml = pageHtml.replace('<div id="app"></div>', `<div id="app">${appBodyHtml}</div>`);

    // Write file to dist/product/:id/index.html
    const targetDir = path.join(DIST_DIR, 'product', product.id);
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, 'index.html'), pageHtml, 'utf-8');
  }

  // Generate XML Sitemap
  console.log('Generating public sitemap.xml...');
  const sitemapUrls = [
    { loc: `${BASE_ORIGIN}/`, priority: '1.0', changefreq: 'weekly' },
    { loc: `${BASE_ORIGIN}/products`, priority: '0.9', changefreq: 'weekly' },
    { loc: `${BASE_ORIGIN}/partners`, priority: '0.8', changefreq: 'monthly' },
    { loc: `${BASE_ORIGIN}/services`, priority: '0.8', changefreq: 'monthly' },
    { loc: `${BASE_ORIGIN}/about`, priority: '0.7', changefreq: 'monthly' },
    { loc: `${BASE_ORIGIN}/blogs`, priority: '0.7', changefreq: 'weekly' },
    { loc: `${BASE_ORIGIN}/contact`, priority: '0.8', changefreq: 'monthly' },
  ];

  activeProducts.forEach(({ product }) => {
    sitemapUrls.push({
      loc: `${BASE_ORIGIN}/product/${encodeURIComponent(product.id)}`,
      priority: '0.6',
      changefreq: 'monthly',
    });
  });

  const todayIso = new Date().toISOString().split('T')[0];
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map((u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${todayIso}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

  const publicSitemapPath = path.join(ROOT_DIR, 'public', 'sitemap.xml');
  const publicFallbackPath = path.join(ROOT_DIR, 'public', 'sitemap.fallback.xml');
  const distFallbackPath = path.join(DIST_DIR, 'sitemap.fallback.xml');
  fs.writeFileSync(publicSitemapPath, sitemapXml.trim() + '\n', 'utf-8');
  fs.writeFileSync(publicFallbackPath, sitemapXml.trim() + '\n', 'utf-8');
  fs.writeFileSync(distFallbackPath, sitemapXml.trim() + '\n', 'utf-8');

  // Remove dist/sitemap.xml if Vite copied it from public/, allowing Vercel's
  // rewrite rule to route /sitemap.xml to the live dynamic backend (/api/sitemap.xml)
  // while keeping dist/sitemap.fallback.xml as a resilient static fallback.
  const distSitemapPath = path.join(DIST_DIR, 'sitemap.xml');
  if (fs.existsSync(distSitemapPath)) {
    fs.unlinkSync(distSitemapPath);
  }

  // Update robots.txt
  console.log('Generating public robots.txt...');
  const robotsTxt = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/

Sitemap: ${BASE_ORIGIN}/sitemap.xml
`;

  const publicRobotsPath = path.join(ROOT_DIR, 'public', 'robots.txt');
  const distRobotsPath = path.join(DIST_DIR, 'robots.txt');
  fs.writeFileSync(publicRobotsPath, robotsTxt, 'utf-8');
  fs.writeFileSync(distRobotsPath, robotsTxt, 'utf-8');

  console.log(`Prerender complete: ${activeProducts.length} product pages created.`);
  console.log(`Sitemap generated: ${sitemapUrls.length} valid canonical URLs.`);
}

run().catch((err) => {
  console.error('Prerender error:', err);
  process.exit(1);
});
