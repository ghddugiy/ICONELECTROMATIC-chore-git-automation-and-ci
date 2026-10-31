/**
 * Partners Page — ICON ELECTROMATIC
 * High-End Dark Relay-styled layout matching authentic Icon Electromatic partners.
 * Connected to ContentService for dynamic CRUD, image upload, and reordering.
 */
import { ContentService } from '../data/ContentService.js';

// Helper: Running OEM Logos Ticker (Unconfined, full-width continuous flow of only large OEM logos)
function renderRunningLogoTicker(partners) {
  const tickerPartners = partners.filter(p => Boolean(p.logoImg));
  if (!tickerPartners.length) return '';
  const loopList = [...tickerPartners, ...tickerPartners, ...tickerPartners];
  const itemsMarkup = loopList.map((p, idx) => {
    const img = ContentService.resolveImg(p.logoImg);
    return `
      <div class="oem-running-logo-item" data-partner-id="${p.id}" title="${p.name}">
        <div class="oem-running-logo-box">
          <img src="${img}" alt="${p.name} Official Logo" class="oem-running-logo-img" loading="eager" />
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="oem-running-ticker-runthrough">
      <div class="oem-running-ticker-track">
        ${itemsMarkup}
      </div>
    </div>
  `;
}

// Clean Static Card Component
function renderPartnerCardMarkup(partner) {
  const isRed = partner.accentColor === 'red';
  const accentClass = isRed ? 'accent-red' : '';
  const resolvedLogo = ContentService.resolveImg(partner.logoImg);

  const logoMarkup = resolvedLogo
    ? `<img src="${resolvedLogo}" alt="${partner.name} Official Logo" class="partner-logo-img" loading="eager" />`
    : (partner.logoSvg || `<span style="color:#94a3b8; font-size:0.9rem; font-weight:600;">${partner.name}</span>`);

  return `
    <div class="partner-static-card ${accentClass}" data-partner-id="${partner.id}" data-category="${partner.category || ''}" title="Explore ${partner.name} Products">
      <!-- Card Top: Centered Brand Logo Box -->
      <div class="partner-stream-card-top" style="justify-content:center;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,0.07);">
        <div class="partner-stream-card-logo-box" style="width:100%;display:flex;justify-content:center;align-items:center;">
          ${logoMarkup}
        </div>
      </div>

      <!-- Partner Name & Domain -->
      <h3 class="partner-stream-card-name">${partner.name}</h3>
      <div class="partner-stream-card-domain">${partner.domain || ''}</div>

      <!-- Description of the Partner Association -->
      <p class="partner-stream-card-desc" style="margin-bottom:16px;">${partner.description || ''}</p>

      <!-- View Products Link Indicator -->
      <div class="partner-card-action-row" style="margin-top:auto;display:flex;align-items:center;gap:6px;font-size:0.85rem;font-weight:700;color:${isRed ? 'var(--logo-red-light)' : 'var(--logo-blue-light)'};">
        <span>View Products &amp; Catalog</span>
        <i class="fa-solid fa-arrow-right" style="font-size:0.75rem;"></i>
      </div>
    </div>
  `;
}

export function renderPartnersPage() {
  const d = ContentService.getData('partners') || {};
  const partners = Array.isArray(d) ? d : (d.partners || []);
  const heroTitle = d.heroTitle || 'Authorized Technology Partners';
  const heroLead = d.heroLead || 'We represent a diverse portfolio of OEMs across sectors, industries and application.<br />To know more about their products, make an enquiry or request samples just get in touch with us.';
  const trustBadge1 = d.trustBadge1 || '<strong>10+</strong> Global Technology Partners';
  const trustBadge2 = d.trustBadge2 || 'Space &amp; Mil-Spec Screening Support';

  return `
    <div class="page-content partners-page" style="min-height:100vh;">
      <!-- Unified Page Hero Banner (Blue in light theme) -->
      <section class="page-hero-banner">
        <div class="container">
          
          <!-- Breadcrumb -->
          <nav class="breadcrumb-dark">
            <a data-route="/">Home</a>
            <span class="sep"><i class="fa-solid fa-chevron-right" style="font-size:0.7rem;"></i></span>
            <span class="crumb-current" style="color:var(--text-white);font-weight:600;">Partners</span>
          </nav>

          <!-- Unified Page Header -->
          <div class="page-header-unified" style="margin-bottom:0;">
            <h1 class="page-title-unified">
              ${heroTitle}
            </h1>
            <p class="page-lead-unified">
              ${heroLead}
            </p>
          </div>

          <!-- Trust Badges Strip -->
          <div class="services-trust-strip partners-trust-strip" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:24px;margin-bottom:0;padding-bottom:0;border-bottom:none;">
            <div style="background:rgba(37,99,235,0.08);border:1px solid rgba(37,99,235,0.25);border-radius:10px;padding:10px 18px;font-size:0.85rem;color:#93C5FD;display:flex;align-items:center;gap:8px;">
              <i class="fa-solid fa-handshake-angle" style="color:var(--logo-blue-light);"></i>
              <span>${trustBadge1}</span>
            </div>
            <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:10px;padding:10px 18px;font-size:0.85rem;color:#FCD34D;display:flex;align-items:center;gap:8px;">
              <i class="fa-solid fa-certificate" style="color:#F59E0B;"></i>
              <span>${trustBadge2}</span>
            </div>
          </div>

        </div>
      </section>

      <!-- Main Content Body -->
      <div class="page-main-body" style="padding-top:var(--space-12);padding-bottom:var(--space-24);">
        <div class="container">
          <!-- Running OEM Logos Ticker -->
          ${renderRunningLogoTicker(partners)}

          <!-- Static Grid of Partner Cards -->
          <div id="partners-static-grid" class="partners-static-grid">
            ${partners.map(p => renderPartnerCardMarkup(p)).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

const PARTNER_TO_OEM_MAP = {
  'rogers': 'rogers-corporation',
  'mini-circuits': 'minicircuits',
  'qorvo': 'qorvo',
  'tecdia': 'tecdia',
  'tri-teq': 'triteq',
  'rfuw': 'rfuw-engineering',
  'yttek': 'yttek',
  'quantic-eulex': 'evans',
  'quantic-ohmega': 'ohmega-ticer',
  'thermosen': 'thermosen',
  'fortify': 'fortify',
  'powerfactor': 'powerfactor',
  'nee': 'nee',
  'transline-technology': 'transline-technology'
};

export function initPartnersPage() {
  document.querySelectorAll('.oem-running-logo-item').forEach(item => {
    item.addEventListener('click', () => {
      const pid = item.getAttribute('data-partner-id');
      const targetCard = document.querySelector(`#partners-static-grid .partner-static-card[data-partner-id="${pid}"]`);
      if (targetCard) {
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetCard.classList.add('card-highlight-pulse');
        setTimeout(() => {
          targetCard.classList.remove('card-highlight-pulse');
        }, 2000);
      }
    });
  });

  document.querySelectorAll('.partner-static-card').forEach(card => {
    card.addEventListener('click', () => {
      const pid = card.getAttribute('data-partner-id');
      if (pid) {
        const oemId = PARTNER_TO_OEM_MAP[pid] || pid;
        window.location.hash = `#/products?level=categories&oem=${encodeURIComponent(oemId)}`;
      }
    });
  });
}
