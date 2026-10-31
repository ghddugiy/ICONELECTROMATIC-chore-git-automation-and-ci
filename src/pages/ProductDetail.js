/**
 * Product Detail Page — ICON ELECTROMATIC
 * Sleek Dark Relay-styled Detail View connected to real catalog data & dynamic SEO.
 */
import { renderProductCard, getProductDisplayImage } from '../components/ProductCard.js';
import { CatalogService } from '../data/CatalogService.js';
import { SeoService } from '../data/SeoService.js';

export function renderProductDetailPage(params, catalogProduct = null, apiError = '') {
  const id = params?.id;
  const product = catalogProduct || (id ? CatalogService.findFallbackProduct(id) : null);

  if (!product) {
    if (!apiError && id) {
      // Set SEO to loading / unindexed state while resolving
      SeoService.setProductSeo(null);
      return `
        <div class="page-content product-detail-page" style="padding-top:calc(var(--header-height) + 40px);min-height:80vh;">
          <div class="container" style="text-align:center;padding:var(--space-20) 0;">
            <i class="fa-solid fa-spinner fa-spin" style="font-size:2.5rem;color:var(--logo-blue);margin-bottom:var(--space-4);display:block;"></i>
            <p role="status" style="color:var(--text-gray-300);">Loading product specifications…</p>
          </div>
        </div>
      `;
    }

    SeoService.setProductSeo(null);
    return `
      <div class="page-content" style="padding-top:calc(var(--header-height) + 40px);padding-bottom:var(--space-24);background:var(--bg-dark);min-height:80vh;">
        <div class="container" style="text-align:center; padding:var(--space-20) 0;">
          ${apiError ? `<p role="alert" style="color:#ef4444;margin-bottom:12px;">${apiError}</p>` : ''}
          <i class="fa-solid fa-circle-exclamation" style="font-size:3rem; color:var(--text-gray-500); margin-bottom:var(--space-4); display:block;"></i>
          <h2 style="color:var(--text-white); margin-bottom:var(--space-2);">Component Not Found</h2>
          <p style="color:var(--text-gray-400); margin-bottom:var(--space-6);">The component you are searching for does not exist or has been removed from the catalog.</p>
          <a class="btn-relay-blue" data-route="/products">
            <i class="fa-solid fa-arrow-left"></i> Back to Products
          </a>
        </div>
      </div>
    `;
  }

  // If the product is explicitly marked hidden
  if (product.visible === false) {
    SeoService.setProductSeo(product);
    return `
      <div class="page-content product-detail-page" style="padding-top:calc(var(--header-height) + 40px);padding-bottom:var(--space-24);background:var(--bg-dark);min-height:80vh;">
        <div class="container" style="text-align:center; padding:var(--space-20) 0;">
          <i class="fa-solid fa-eye-slash" style="font-size:3rem; color:var(--text-gray-500); margin-bottom:var(--space-4); display:block;"></i>
          <h2 style="color:var(--text-white); margin-bottom:var(--space-2);">Component Temporarily Unavailable</h2>
          <p style="color:var(--text-gray-400); margin-bottom:var(--space-6);">The component <strong>${product.model || product.name}</strong> is currently unlisted or archived.</p>
          <a class="btn-relay-blue" data-route="/products">
            <i class="fa-solid fa-arrow-left"></i> Back to Products
          </a>
        </div>
      </div>
    `;
  }

  // Update dynamic SEO with the real product details
  SeoService.setProductSeo(product);

  const related = (product.relatedProducts || [])
    .filter(p => p.id !== product.id)
    .slice(0, 4);

  const specEntries = Object.entries(product.specs || {});
  const displayImage = getProductDisplayImage(product);
  const modelName = product.model || product.name || 'Component';
  const oemName = product.oem || product.oemName || 'Authorized OEM';
  const categoryName = product.categoryName || 'RF & Microwave Components';

  return `
    <div class="page-content product-detail-page" style="min-height:100vh;">
      ${apiError ? `<p class="catalog-api-notice" role="status" style="margin:16px auto;max-width:1200px;background:#fef2f2;color:#991b1b;padding:8px 16px;border-radius:6px;border:1px solid #fecaca;">${apiError}</p>` : ''}
      <!-- Unified Page Hero Banner -->
      <section class="page-hero-banner" style="padding-bottom:20px;">
        <div class="container">
          <!-- Breadcrumb -->
          <nav class="breadcrumb-dark" style="margin-bottom:0;" aria-label="Breadcrumb">
            <a data-route="/">Home</a>
            <span class="sep"><i class="fa-solid fa-chevron-right" style="font-size:0.7rem;"></i></span>
            <a data-route="/products">Products</a>
            ${product.oemId ? `
              <span class="sep"><i class="fa-solid fa-chevron-right" style="font-size:0.7rem;"></i></span>
              <a data-route="/products?level=categories&oem=${encodeURIComponent(product.oemId)}">${oemName}</a>
            ` : ''}
            <span class="sep"><i class="fa-solid fa-chevron-right" style="font-size:0.7rem;"></i></span>
            <a data-route="/products?level=products&oem=${encodeURIComponent(product.oemId || '')}&category=${encodeURIComponent(product.category || '')}">${categoryName}</a>
            <span class="sep"><i class="fa-solid fa-chevron-right" style="font-size:0.7rem;"></i></span>
            <span class="crumb-current" style="color:var(--text-white);font-weight:600;">${modelName}</span>
          </nav>
        </div>
      </section>

      <!-- Main Content Area -->
      <div class="page-main-body" style="padding-top:var(--space-8);padding-bottom:var(--space-24);">
        <div class="container">
          <div class="product-detail-layout" style="display:grid;grid-template-columns:1fr 1.15fr;gap:var(--space-12);margin-bottom:var(--space-16);margin-top:var(--space-4);">
          <!-- Product Photography Gallery -->
          <div>
            <div style="background:var(--bg-card);border:1px solid var(--border-card);border-radius:var(--radius-xl);overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.5);margin-bottom:var(--space-4);aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;padding:var(--space-4);">
              <img src="${displayImage}" alt="${modelName}" style="width:100%;height:100%;object-fit:contain;padding:12px;border-radius:var(--radius-md);" />
            </div>
            <div style="display:flex;gap:10px;">
              <div style="width:72px;height:72px;border-radius:var(--radius-md);border:1.5px solid var(--logo-blue);overflow:hidden;cursor:pointer;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">
                <img src="${displayImage}" alt="Thumb" style="width:100%;height:100%;object-fit:contain;padding:4px;" />
              </div>
            </div>
          </div>

          <!-- Product Details -->
          <div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
              <span class="a-badge a-badge-blue" style="font-size:0.78rem;letter-spacing:0.04em;">
                <i class="fa-solid fa-industry" style="margin-right:4px;"></i> ${oemName}
              </span>
              <span class="a-badge" style="background:rgba(255,255,255,0.08);color:#cbd5e1;font-size:0.78rem;">
                ${categoryName}
              </span>
            </div>

            <h1 class="page-title-unified" style="font-size:clamp(2rem, 3.5vw, 2.75rem);margin-bottom:10px;">
              ${modelName}
            </h1>
            <p style="font-size:0.85rem;color:var(--text-gray-400);margin-bottom:var(--space-4);">
              Part ID: <strong style="color:var(--text-white);">${product.id}</strong> · Authorized Distribution · High-Frequency RF &amp; Microwave
            </p>

            <p style="font-size:1rem;color:var(--text-gray-300);line-height:1.7;margin-bottom:var(--space-6);">
              ${product.description || 'High-reliability RF and microwave electronic component from authorized OEM partner.'}
            </p>

            <!-- Technical Specifications Table -->
            <div style="margin-bottom:var(--space-8);">
              <h3 style="font-size:1.1rem;font-weight:700;color:var(--text-white);margin-bottom:var(--space-3);display:flex;align-items:center;gap:8px;">
                <i class="fa-solid fa-list-check" style="color:var(--logo-blue-light);font-size:0.9rem;"></i> Technical Specifications &amp; Applications
              </h3>
              <div style="border:1px solid var(--border-card);border-radius:var(--radius-lg);overflow:hidden;background:var(--bg-card);">
                <div style="display:flex;justify-content:space-between;padding:10px 16px;border-bottom:1px solid var(--border-subtle);background:rgba(255,255,255,0.02);font-size:0.875rem;">
                  <span style="color:var(--text-gray-400);">Manufacturer / Principal</span>
                  <span style="color:var(--text-white);font-weight:600;">${oemName}</span>
                </div>
                <div style="display:flex;justify-content:space-between;padding:10px 16px;border-bottom:1px solid var(--border-subtle);background:transparent;font-size:0.875rem;">
                  <span style="color:var(--text-gray-400);">Component Line</span>
                  <span style="color:var(--text-white);font-weight:600;">${categoryName}</span>
                </div>
                ${product.applications ? `
                  <div style="display:flex;justify-content:space-between;padding:10px 16px;border-bottom:1px solid var(--border-subtle);background:rgba(255,255,255,0.02);font-size:0.875rem;">
                    <span style="color:var(--text-gray-400);">Verified Applications</span>
                    <span style="color:var(--text-white);font-weight:600;max-width:65%;text-align:right;">${product.applications}</span>
                  </div>
                ` : ''}
                ${specEntries.map(([key, value], idx) => `
                  <div style="display:flex;justify-content:space-between;padding:10px 16px;border-bottom:1px solid var(--border-subtle);background:${idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'};font-size:0.875rem;">
                    <span style="color:var(--text-gray-400);">${key}</span>
                    <span style="color:var(--text-white);font-weight:600;">${value}</span>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Inquire Actions Box -->
            <div style="background:var(--bg-card);border:1px solid var(--border-card);border-radius:var(--radius-xl);padding:var(--space-6);">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-4);flex-wrap:wrap;gap:var(--space-2);">
                <div>
                  <h4 style="color:var(--text-white);font-size:1.1rem;font-weight:700;">Request Pricing &amp; Fast Quote</h4>
                  <p style="color:var(--text-gray-400);font-size:0.8rem;">Technical datasheets and formal quote delivered within 24 hours.</p>
                </div>
                <span style="display:inline-flex;align-items:center;gap:6px;font-size:0.75rem;color:var(--success);font-weight:600;">
                  <i class="fa-solid fa-circle-check"></i> Authorized Stock
                </span>
              </div>

              <div style="display:flex;gap:var(--space-3);flex-wrap:wrap;">
                <a class="btn-relay-blue" data-route="/contact?subject=rfq&model=${encodeURIComponent(modelName)}&product=${encodeURIComponent(product.name || modelName)}&oem=${encodeURIComponent(oemName)}" style="flex:1;justify-content:center;">
                  <i class="fa-solid fa-paper-plane"></i> Inquire for ${modelName}
                </a>
                <a class="btn-relay-dark" data-route="/contact?subject=technical&model=${encodeURIComponent(modelName)}&product=${encodeURIComponent(product.name || modelName)}&oem=${encodeURIComponent(oemName)}">
                  Speak to Engineer
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- Related Products Section -->
        ${related.length > 0 ? `
          <div style="border-top:1px solid var(--border-subtle);padding-top:var(--space-12);">
            <div style="margin-bottom:var(--space-6);">
              <span class="section-tag-mono">SIMILAR SPECIFICATIONS</span>
              <h3 style="font-size:1.6rem;font-weight:800;color:var(--text-white);">Related Components</h3>
            </div>
            <div class="products-grid-dark">
              ${related.map((p, i) => renderProductCard(p, i)).join('')}
            </div>
          </div>
        ` : ''}
        </div>
      </div>
    </div>
  `;
}

let requestedProductId = null;

export function initProductDetailPage(params) {
  const id = params?.id;
  if (!id || requestedProductId === id) return;
  requestedProductId = id;

  CatalogService.getPublicProduct(id)
    .then((product) => {
      const currentPage = document.querySelector('.product-detail-page');
      if (currentPage) {
        currentPage.outerHTML = renderProductDetailPage(params, product);
      } else {
        SeoService.setProductSeo(product);
      }
    })
    .catch((error) => {
      const fallback = CatalogService.findFallbackProduct(id);
      const currentPage = document.querySelector('.product-detail-page');
      if (fallback) {
        if (currentPage) currentPage.outerHTML = renderProductDetailPage(params, fallback);
        return;
      }
      if (error.status === 404) {
        if (currentPage) {
          currentPage.outerHTML = renderProductDetailPage(params, null, 'The requested component was not found in the catalog.');
        }
        return;
      }
      if (currentPage) {
        currentPage.outerHTML = renderProductDetailPage(params, null, `Product specifications could not be loaded: ${error.message}`);
      }
    });
}
