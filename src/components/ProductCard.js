/**
 * Product Card Component — ICON ELECTROMATIC
 * Sleek Dark Card matching the Relay aesthetic with high-res photography and brief specs.
 * Note: "In Stock", "Authorized" badges, and direct external datasheet links are omitted per company policy.
 */

import { ContentService } from '../data/ContentService.js';

export function getProductDisplayImage(product) {
  if (product.image) return ContentService.resolveImg(product.image);

  const cat = (product.category || product.categoryName || '').toLowerCase();
  const name = (product.name || product.model || '').toLowerCase();

  if (cat.includes('lens') || name.includes('lens') || cat.includes('dielectric')) {
    return '/images/dielectric-3d-lens.jpg';
  }
  if (cat.includes('laminate') || name.includes('duroid') || name.includes('ro4') || name.includes('ro3') || name.includes('prepreg') || name.includes('tcr') || name.includes('rcm')) {
    return '/images/rf-laminate.jpg';
  }
  if (cat.includes('amplifier') || name.includes('gan') || name.includes('hemt') || name.includes('amplifier') || name.includes('power supply')) {
    return '/images/gan-power-chip.jpg';
  }
  if (cat.includes('switch') || name.includes('switch') || cat.includes('limiter') || name.includes('limiter')) {
    return '/images/rf-switch.jpg';
  }
  if (cat.includes('filter') || name.includes('filter')) {
    return '/images/rf-filter.webp';
  }
  if (cat.includes('mixer') || cat.includes('modulator')) {
    return '/images/rf-mixer.jpg';
  }
  if (cat.includes('attenuator') || cat.includes('coupler') || cat.includes('splitter')) {
    return '/images/rf-attenuator.jpg';
  }
  if (cat.includes('pcb') || cat.includes('sensor') || cat.includes('thermistor')) {
    return '/images/rf-microwave-pcb.jpg';
  }
  if (cat.includes('sdr') || cat.includes('radio') || cat.includes('satcom') || cat.includes('radar') || cat.includes('pids')) {
    return '/images/defense-satcom.jpg';
  }
  if (cat.includes('waveguide') || cat.includes('adapter') || cat.includes('cable')) {
    return '/images/rf-waveguide.jpg';
  }
  return '/images/hero-amplifier.jpg';
}

export function renderProductCard(product, index = 0) {
  const displayImage = getProductDisplayImage(product);
  const name = product.name || product.model || 'RF Component';
  const oemName = product.oemName || product.oemShort || 'Authorized OEM';
  const oemAccent = product.oemAccent || '#2563EB';
  const categoryName = product.categoryName || product.category || 'High-Frequency';
  
  // Format concise description
  let desc = product.description || '';
  if (desc.length > 120) desc = desc.slice(0, 117) + '...';

  // Format applications tags
  let appTags = [];
  if (product.applications) {
    appTags = product.applications
      .split(/[,;\n•]/)
      .map(a => a.replace(/^[0-9]+[\.\)]\s*/, '').trim())
      .filter(a => a.length > 2)
      .slice(0, 2);
  }

  // Route to component detail view
  const detailRoute = product.id 
    ? `/product/${encodeURIComponent(product.id)}`
    : (product.oemId && product.catId 
      ? `/products?level=products&oem=${encodeURIComponent(product.oemId)}&category=${encodeURIComponent(product.catId)}`
      : `/products`);

  return `
    <div class="product-card-relay" style="--oem-accent: ${oemAccent};">
      <div class="product-card-relay-img">
        <a href="${detailRoute}" style="display:block;width:100%;height:100%;text-decoration:none;" title="View ${name} Specifications">
          <img src="${displayImage}" alt="${name}" loading="lazy" onerror="this.onerror=null; this.src='/images/rf-filter.jpg';" />
        </a>
        <div class="relay-oem-pill" style="border: 1px solid ${oemAccent}40; background: rgba(10,15,30,0.85); color: #ffffff;">
          ${oemName}
        </div>
      </div>
      <div class="product-card-relay-body">
        <div class="relay-card-header">
          <span class="relay-cat-label">${categoryName}</span>
          <h3 class="relay-product-title" title="${name}">
            <a href="${detailRoute}" style="color:inherit;text-decoration:none;">${name}</a>
          </h3>
        </div>
        
        <p class="relay-card-desc-snippet">${desc}</p>

        ${appTags.length ? `
          <div class="relay-specs-brief">
            ${appTags.map(tag => `
              <div class="relay-spec-tag">
                <i class="fa-solid fa-circle-dot" style="color:${oemAccent};font-size:0.5rem;margin-right:5px;"></i>
                <span>${tag}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
        
        <div class="product-card-relay-footer">
          <a class="relay-inquire-btn" href="${detailRoute}" data-route="/product/${encodeURIComponent(product.id || '')}">
            <span>View Specs</span> <i class="fa-solid fa-arrow-right" style="font-size:0.7rem;margin-left:2px;"></i>
          </a>
          <a class="relay-rfq-btn" href="/contact?subject=rfq&model=${encodeURIComponent(name)}&product=${encodeURIComponent(name)}&oem=${encodeURIComponent(oemName)}" style="background:${oemAccent};">
            <span>Request RFQ</span>
          </a>
        </div>
      </div>
    </div>
  `;
}

export function renderSkeletonCard() {
  return `
    <div class="product-card-relay skeleton-pulse">
      <div class="product-card-relay-img" style="background:#0F172A;aspect-ratio:16/10;"></div>
      <div class="product-card-relay-body" style="padding:16px;">
        <div style="height:10px;width:35%;background:#1E293B;border-radius:4px;margin-bottom:8px;"></div>
        <div style="height:18px;width:60%;background:#334155;border-radius:4px;margin-bottom:14px;"></div>
        <div style="display:flex;gap:6px;margin-bottom:16px;">
          <div style="height:22px;flex:1;background:#1E293B;border-radius:4px;"></div>
          <div style="height:22px;flex:1;background:#1E293B;border-radius:4px;"></div>
        </div>
        <div style="height:14px;width:40%;background:#1E293B;border-radius:4px;"></div>
      </div>
    </div>
  `;
}
