/**
 * Services Page — ICON ELECTROMATIC
 * High-End Dark Relay-styled layout matching the authentic Icon Electromatic services
 * Fully dynamic via ContentService — cards, images, slideshows, tags, and sections.
 */
import { ContentService } from '../data/ContentService.js';

export function renderServicesPage() {
  const d = ContentService.getData('services');

  const badges = d.badges || [
    { icon: 'fa-solid fa-handshake-angle', text: 'Tier-1 Global Manufacturers Representation', color: '#93C5FD' },
    { icon: 'fa-solid fa-landmark', text: 'Indian Govt Tender Portals (GeM & CPPP)', color: '#FDA4AF' },
    { icon: 'fa-solid fa-coins', text: 'Global Multi-Currency Supply Logistics', color: '#E2E8F0' },
  ];

  const items = d.items || [];

  return `
    <div class="page-content services-page" style="min-height:100vh;">
      <!-- Unified Page Hero Banner -->
      <section class="page-hero-banner">
        <div class="container">
          <!-- Breadcrumb -->
          <nav class="breadcrumb-dark">
            <a data-route="/">Home</a>
            <span class="sep"><i class="fa-solid fa-chevron-right" style="font-size:0.7rem;"></i></span>
            <span class="crumb-current" style="color:var(--text-white);font-weight:600;">Services</span>
          </nav>

          <!-- Unified Page Header -->
          <div class="page-header-unified" style="margin-bottom:0;">
            <h1 class="page-title-unified">
              ${d.heroTitle || 'Engineering Services & Global Representation'}
            </h1>
            <p class="page-lead-unified">
              ${d.heroLead || 'We represent major RF, Microwave, mmWave, Semiconductors, Components, Subsystems and Power supplies manufacturers around the world, providing unparalleled support to electronic designers, manufacturers, engineers and researchers.'}
            </p>
          </div>

          <!-- Trust Badges Strip -->
          <div class="services-trust-strip" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:24px;margin-bottom:0;padding-bottom:0;border-bottom:none;">
            ${badges.map(b => `
              <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:10px 18px;font-size:0.85rem;color:${b.color || '#fff'};display:flex;align-items:center;gap:8px;">
                <i class="${b.icon || 'fa-solid fa-shield-halved'}" style="color:${b.color || 'var(--logo-blue-light)'};"></i>
                <span>${b.text}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </section>

      <!-- Main Content Area: Core Services Pillars -->
      <div class="page-main-body" style="padding-top:var(--space-12);padding-bottom:var(--space-24);">
        <div class="container">
          <div style="display:flex;flex-direction:column;gap:var(--space-16);margin-bottom:0;">
            ${items.map((srv, idx) => {
              const isEven = idx % 2 === 1;
              const slides = srv.slides || [];
              const badgeColor = srv.badgeColor || (idx % 2 === 0 ? 'blue' : 'red');

              const textCol = `
                <div class="service-text-col" style="${isEven ? 'order:2;' : ''}">
                  <div class="service-badge-pill service-badge-${badgeColor}">
                    <i class="fa-solid fa-layer-group"></i>
                    <span>${srv.badge || 'Core Service'}</span>
                  </div>
                  
                  <h2 class="service-primary-title">
                    ${srv.title}
                  </h2>
                  
                  <h3 class="service-secondary-title ${badgeColor}-accent">
                    ${srv.subtitle || ''}
                  </h3>
                  
                  <p style="font-size:1rem;color:var(--text-gray-300);line-height:1.75;margin-bottom:20px;">
                    ${srv.desc}
                  </p>

                  ${srv.desc2 ? `
                    <p style="font-size:0.95rem;color:var(--text-gray-400);line-height:1.7;margin-bottom:20px;">
                      ${srv.desc2}
                    </p>
                  ` : ''}

                  ${(srv.tags && srv.tags.length) ? `
                    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:12px;margin-bottom:24px;">
                      ${srv.tags.filter(t => t !== 'Bengaluru Stock Hub').map(t => `
                        <div style="background:#080D1A;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:12px;display:flex;align-items:center;gap:10px;">
                          <i class="fa-solid fa-check" style="color:var(--logo-${badgeColor}-light);font-size:0.85rem;"></i>
                          <span style="font-size:0.85rem;color:#E2E8F0;font-weight:500;">${t}</span>
                        </div>
                      `).join('')}
                    </div>
                  ` : ''}

                  <a class="btn-relay-${badgeColor === 'red' ? 'red' : 'border'}" data-route="${srv.ctaLink || '/contact'}">
                    ${srv.ctaText || 'Learn More'} <i class="fa-solid fa-arrow-right"></i>
                  </a>
                </div>
              `;

              const mediaCol = `
                <div class="service-img-col" style="${isEven ? 'order:1;' : ''}">
                  <div class="service-media-showcase" data-service-index="${idx}">
                    <div class="service-slides-wrapper">
                      ${slides.map((s, sIdx) => {
                        const img = ContentService.resolveImg(s.image);
                        return `
                          <div class="service-slide ${sIdx === 0 ? 'active' : ''}" data-index="${sIdx}">
                            <img src="${img}" alt="${s.caption || srv.title}" />
                          </div>
                        `;
                      }).join('')}
                    </div>
                    ${slides.length > 1 ? `
                      <div class="service-slide-indicators">
                        ${slides.map((_, sIdx) => `
                          <button class="service-slide-dot ${sIdx === 0 ? 'active' : ''}" data-slide="${sIdx}" aria-label="Slide ${sIdx + 1}"></button>
                        `).join('')}
                      </div>
                    ` : ''}
                  </div>
                </div>
              `;

              return `
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-12);align-items:center;" class="service-row-block">
                  ${isEven ? (mediaCol + textCol) : (textCol + mediaCol)}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

export function initServicesPage() {
  const showcases = document.querySelectorAll('.service-media-showcase');
  if (!showcases.length) return;

  showcases.forEach(showcase => {
    const slides = showcase.querySelectorAll('.service-slide');
    const dots = showcase.querySelectorAll('.service-slide-dot');
    if (slides.length <= 1) return;

    let currentIndex = 0;
    let timer = null;
    let isHovered = false;

    function goToSlide(targetIdx) {
      if (slides[currentIndex]) slides[currentIndex].classList.remove('active');
      if (dots[currentIndex]) dots[currentIndex].classList.remove('active');

      currentIndex = (targetIdx + slides.length) % slides.length;

      if (slides[currentIndex]) slides[currentIndex].classList.add('active');
      if (dots[currentIndex]) dots[currentIndex].classList.add('active');
    }

    function startAutoPlay() {
      stopAutoPlay();
      timer = setInterval(() => {
        if (!isHovered) {
          goToSlide(currentIndex + 1);
        }
      }, 3500);
    }

    function stopAutoPlay() {
      if (timer) clearInterval(timer);
      timer = null;
    }

    dots.forEach((dot, dotIdx) => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        goToSlide(dotIdx);
        startAutoPlay();
      });
    });

    showcase.addEventListener('mouseenter', () => { isHovered = true; });
    showcase.addEventListener('mouseleave', () => { isHovered = false; });

    startAutoPlay();
  });
}
