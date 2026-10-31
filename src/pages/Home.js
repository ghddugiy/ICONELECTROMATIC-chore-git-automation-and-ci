/**
 * Home Page — ICON ELECTROMATIC
 * Sleek Cinematic Dark Aesthetic directly modeled after the Relay Framer reference
 * Fully connected to ContentService for dynamic text, cards, images, projects, gallery, and testimonials.
 */
import { getPopularProducts } from '../data/catalogData.js';
import { renderProductCard } from '../components/ProductCard.js';
import { ContentService } from '../data/ContentService.js';

export function renderHomePage() {
  const popular = getPopularProducts();
  const data = ContentService.getData('home');
  const contact = ContentService.getData('contact');
  const blogs = ContentService.getData('blogs');

  const statsList = data.stats || [
    { value: '4,000+', label: 'PRODUCTS AVAILABLE' },
    { value: '24+', label: 'COMPONENT LINES' },
    { value: '100%', label: 'ROHS & ISO 9001' }
  ];

  const capList = data.capabilities || [
    { title: 'RF & Microwave Active', desc: 'High-linearity power amplifiers, ultra-low noise LNAs, active frequency mixers, and voltage-controlled oscillators.', linkText: 'Explore Amplifiers →', linkUrl: '/products?category=amplifiers', icon: 'fa-solid fa-wave-square' },
    { title: 'Passive & Waveguides', desc: 'High-Q cavity bandpass filters, low-loss waveguide transitions, directional couplers, and coaxial terminations.', linkText: 'Explore Filters →', linkUrl: '/products?category=filters', icon: 'fa-solid fa-filter' },
    { title: 'Defense & Aerospace', desc: 'Mil-Spec screening, extreme-temperature reliability, and radiation-tolerant solutions for tactical EW and SATCOM.', linkText: 'Learn More →', linkUrl: '/about', icon: 'fa-solid fa-shield-halved' },
    { title: 'Test & Measurement', desc: 'Precision calibration adapters, armored low-loss RF test cables, and laboratory attenuator modules up to 86 GHz.', linkText: 'Explore Solutions →', linkUrl: '/products?category=test-solutions', icon: 'fa-solid fa-flask-vial' },
  ];

  let blogList = [];
  if (Array.isArray(blogs)) {
    blogList = blogs.slice(0, 3);
  } else if (blogs && Array.isArray(blogs.oemBlogs)) {
    const allArticles = [];
    blogs.oemBlogs.forEach(oem => {
      if (oem.visible !== false && Array.isArray(oem.articles)) {
        oem.articles.forEach(art => {
          if (art.visible !== false) {
            allArticles.push({
              headline: art.title,
              title: art.title,
              excerpt: art.summary,
              desc: art.summary,
              tag: art.category,
              category: art.category,
              readTime: art.readTime,
              date: art.date,
              coverImg: art.image,
              author: art.author || oem.portalName || 'Technical Team'
            });
          }
        });
      }
    });
    blogList = allArticles.slice(0, 3);
  }

  const heroVideo = ContentService.resolveImg(data.heroBgVideo || '/icon-video.mp4');

  return `
    <!-- RELAY CINEMATIC HERO -->
    <section class="hero-relay">
      <!-- Background Video/Image -->
      <div class="hero-relay-bg">
        <video id="hero-bg-video" src="${heroVideo}" autoplay loop muted playsinline style="width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0;"></video>
        <div class="hero-relay-vignette"></div>
      </div>

      <div class="container" style="position:relative;z-index:3;width:100%;">
        <div class="hero-relay-content">
          <h1 class="hero-title-giant" style="font-size: clamp(2.2rem, 4.5vw, 4.2rem);">
            ${data.heroTitle || 'ICON ELECTROMATIC turns complex high-frequency requirements into <span class="accent-red" style="color: var(--logo-red);">mission-ready hardware.</span>'}
          </h1>

          <p class="hero-description-clean">
            ${data.heroSubtitle || 'Delivering precision RF, microwave, and electronic components for defense, aerospace, SATCOM, and telecommunications.'}
          </p>

          <div class="hero-actions-row">
            <a href="#${data.ctaExploreLink || '/products'}" class="btn-relay-red" data-route="${data.ctaExploreLink || '/products'}">
              ${data.ctaExploreText || 'Explore Products'} <i class="fa-solid fa-arrow-right"></i>
            </a>
            <a href="#${data.ctaQuoteLink || '/contact'}" class="btn-relay-dark" style="background:#ffffff; color:#000000;" data-route="${data.ctaQuoteLink || '/contact'}">
              ${data.ctaQuoteText || 'Request a Quote'}
            </a>
          </div>

          <!-- Integrated Stats -->
          <div class="hero-inline-stats" style="margin-top: 60px; padding-top: 30px; border-top: 1px solid rgba(255,255,255,0.2); display: flex; justify-content: space-between; align-items: center; max-width: 760px; gap: 20px;">
            ${statsList.map(st => `
              <div class="hero-stat-item" style="flex-direction: column; align-items: flex-start; gap: 4px;">
                <span class="hero-stat-number" style="color: var(--logo-red);">${st.value}</span>
                <span class="hero-stat-label" style="color: #cbd5e1;">${st.label}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </section>

    <!-- CORE CAPABILITIES (Relay Dark Minimal Cards) -->
    <section class="section-dark">
      <div class="container">
        <div class="section-head-minimal">
          <h2 class="section-tag-mono red-section-title" style="font-size: 2.75rem; font-weight: 800; letter-spacing: 0.05em; margin: 0; line-height: 1.2;">${data.coreCapabilitiesTitle || 'Core Capabilities'}</h2>
          <h3 class="section-h2" style="font-size: 2rem; font-weight: 600; line-height: 1.3; margin-top: 8px; margin-bottom: 16px;">${data.coreCapabilitiesSubtitle || 'Engineered for extreme performance.'}</h3>
          <p class="section-lead" style="font-size: 1.25rem; max-width: 800px; margin: 0;">
            ${data.coreCapabilitiesLead || 'From millimeter-wave defense radar to satellite ground infrastructure, we provide the verified hardware engineers depend on.'}
          </p>
        </div>

        <div class="capabilities-grid-dark">
          ${capList.map(cap => `
            <div class="capability-card-dark">
              <div class="capability-icon-box"><i class="${cap.icon || 'fa-solid fa-microchip'}"></i></div>
              <h3>${cap.title}</h3>
              <p>${cap.desc}</p>
              <a data-route="${cap.linkUrl || '/products'}">${cap.linkText || 'Explore →'}</a>
            </div>
          `).join('')}
        </div>
      </div>
    </section>

    <!-- POPULAR PRODUCTS SECTION -->
    <section class="products-dark-section">
      <div class="container">
        <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:var(--space-8);flex-wrap:wrap;gap:var(--space-4);">
          <div>
            <div class="popular-header" style="margin-bottom: 24px;">
              <h2 class="section-tag-mono red-section-title" style="font-size: 2.75rem; font-weight: 800; letter-spacing: 0.05em; margin: 0; line-height: 1.2;">${data.popularTitle || 'Popular Products &amp; Components'}</h2>
            </div>
            <p class="section-lead" style="font-size: 1.25rem; max-width: 850px; color: #e2e8f0; margin: 0;">
              ${data.popularLead || 'High-frequency laminates, precision GaN semiconductors, 3D metamaterial optics, and microwave modules from our global OEM partners.'}
            </p>
          </div>
          <div>
            <a class="btn-relay-dark" data-route="/products">
              Explore Full Catalog (OEMs) &rarr;
            </a>
          </div>
        </div>

        <!-- Filter Chips -->
        <div class="products-nav-bar" id="home-category-tabs" style="margin-bottom:var(--space-8);">
          <button class="filter-chip-dark active" data-filter="all">All Popular (${popular.length})</button>
          <button class="filter-chip-dark" data-filter="rogers">Rogers Laminates</button>
          <button class="filter-chip-dark" data-filter="qorvo">Qorvo GaN &amp; ICs</button>
          <button class="filter-chip-dark" data-filter="ohmega">Ohmega-Ticer</button>
          <button class="filter-chip-dark" data-filter="fortify">Fortify 3D Optics</button>
          <button class="filter-chip-dark" data-filter="components">Mini-Circuits &amp; RFuW</button>
          <button class="filter-chip-dark" data-filter="sensors">Sensors &amp; PCB</button>
        </div>

        <!-- Product Cards Grid -->
        <div class="products-grid-dark" id="home-products-grid">
          ${popular.map((p, i) => renderProductCard(p, i)).join('')}
        </div>
      </div>
    </section>

    <!-- INSIGHTS: Latest Blogs -->
    <section class="insights-dark-section">
      <div class="container">
        <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:var(--space-10);flex-wrap:wrap;gap:var(--space-4);">
          <div>
            <h2 class="section-tag-mono red-section-title" style="font-size: 2.75rem; font-weight: 800; letter-spacing: 0.05em; margin: 0; line-height: 1.2;">${data.insightsTitle || 'Insights'}</h2>
            <h3 class="section-h2" style="font-size: 2rem; font-weight: 600; line-height: 1.3; margin-top: 8px; margin-bottom: 0;">${data.insightsSubtitle || 'Latest Blogs'}</h3>
            <p class="section-lead">
              ${data.insightsLead || 'Engineering articles, application notes, and microwave design breakthroughs from our technical team.'}
            </p>
          </div>
          <div>
            <a class="btn-relay-dark" data-route="/blogs">
              Explore All Blogs &rarr;
            </a>
          </div>
        </div>

        <div class="insights-grid-dark">
          ${blogList.map(b => {
            const img = ContentService.resolveImg(b.coverImg || '/images/hero-amplifier.jpg');
            return `
              <article class="blog-card-relay" data-route="/blogs">
                <div class="blog-card-relay-img">
                  <img src="${img}" alt="${b.headline || 'Blog'}" loading="lazy" />
                  <span class="blog-badge-tag">${b.tag || b.category || 'Technical'}</span>
                  <span class="blog-read-time"><i class="fa-regular fa-clock" style="margin-right:4px;"></i>${b.readTime || '5 min'}</span>
                </div>
                <div class="blog-card-relay-body">
                  <div class="blog-date-meta">
                    <i class="fa-regular fa-calendar"></i>
                    <span>${b.date || 'October 2026'} · Technical Note</span>
                  </div>
                  <h3 class="blog-card-title">${b.headline || b.title || ''}</h3>
                  <p class="blog-card-excerpt">${b.excerpt || b.desc || ''}</p>
                  <div class="blog-card-footer">
                    <div class="blog-author-info">
                      <div class="blog-author-avatar">${(b.author || 'Dr. VN').split(' ').map(n=>n[0]).join('').substring(0,2)}</div>
                      <span class="blog-author-name">${b.author || 'Dr. Vikram Nair'}</span>
                    </div>
                    <span class="blog-read-link">Read Article &rarr;</span>
                  </div>
                </div>
              </article>
            `;
          }).join('')}
        </div>
      </div>
    </section>

    <!-- RELAY CONTACT & FAST QUERY -->
    <section class="contact-relay-section">
      <div class="container">
        <div class="section-head-minimal">
          <h2 class="section-tag-mono red-section-title" style="font-size: 2.75rem; font-weight: 800; letter-spacing: 0.05em; margin: 0; line-height: 1.2;">Connect with Engineering</h2>
          <h3 class="section-h2" style="font-size: 2rem; font-weight: 600; line-height: 1.3; margin-top: 8px; margin-bottom: 16px;">Initiate an enquiry or request pricing.</h3>
          <p class="section-lead">
            Direct access to our senior RF applications team in Bengaluru. Fast turnarounds on quotations and custom requirements.
          </p>
        </div>

        <div class="contact-relay-grid">
          <div class="contact-relay-info">
            <div class="contact-relay-card">
              <h3>Direct Engineering Reach</h3>
              <p>
                Founded in 2009 with corporate headquarters in Bengaluru and established international offices in Singapore and the United States.
              </p>

              <div class="contact-meta-list">
                <div class="contact-meta-row" style="align-items:flex-start;">
                  <div class="contact-meta-icon" style="margin-top:2px;"><i class="fa-solid fa-location-dot"></i></div>
                  <div class="contact-meta-text">
                    <h5>Registered Headquarters (India)</h5>
                    <p>${(contact.indiaAddress || '#303/2, 5th ‘A’ Cross, HRBR Layout, III Block,\nKalyan Nagar, Bengaluru – 560043').replace(/\n/g, '<br/>')}</p>
                  </div>
                </div>

                <div class="contact-meta-row" style="align-items:flex-start;">
                  <div class="contact-meta-icon" style="margin-top:2px;"><i class="fa-solid fa-phone"></i></div>
                  <div class="contact-meta-text">
                    <h5>Direct Telephone Reach</h5>
                    <p><a href="tel:${(contact.indiaPhone || '+918025429452').replace(/\s/g,'')}">${contact.indiaPhone || '+91 80 2542 9452'}</a> (India) · <a href="tel:${(contact.usaPhone || '+14055935176').replace(/\s/g,'')}">${contact.usaPhone || '+1 405 593 5176'}</a> (USA)</p>
                  </div>
                </div>

                <div class="contact-meta-row" style="align-items:flex-start;">
                  <div class="contact-meta-icon" style="margin-top:2px;"><i class="fa-solid fa-envelope"></i></div>
                  <div class="contact-meta-text">
                    <h5>Official Regional Communications</h5>
                    <p><a href="mailto:${contact.indiaEmail || 'salesiepl@iconelectromatic.com'}" style="color:var(--logo-red-light);">${contact.indiaEmail || 'salesiepl@iconelectromatic.com'}</a> (India)<br/><a href="mailto:${contact.singaporeEmail || 'IESing@iconelectromatic.com'}" style="color:var(--logo-red-light);">${contact.singaporeEmail || 'IESing@iconelectromatic.com'}</a> (Singapore)<br/><a href="mailto:${contact.usaEmail || 'salesiellc@iconelectromatic.com'}" style="color:var(--logo-red-light);">${contact.usaEmail || 'salesiellc@iconelectromatic.com'}</a> (USA)</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Quick Requirement Presets -->
            <div class="contact-relay-card">
              <h4 style="font-size:1.05rem;font-weight:700;color:var(--text-white);margin-bottom:var(--space-2);display:flex;align-items:center;gap:8px;">
                <i class="fa-solid fa-bolt" style="color:var(--logo-red);"></i> Quick Requirement Presets
              </h4>
              <p style="font-size:0.85rem;color:var(--text-gray-400);margin-bottom:var(--space-3);">Click any preset to prefill your enquiry message:</p>
              <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                ${(contact.presets || [
                  'Enquiring about High Frequency Laminates & Prepregs.',
                  'Enquiring about Embedded Resistive Film.',
                  'Enquiring about 3D Printed Dielectric Parts.',
                  'Enquiring about High Power GaN Device and Beamforming IC.',
                  'Enquiring about High Power Switches and Limiter.',
                  'Enquiring about RF and MW Components.',
                  'Enquiring about Tunable Filters.',
                  'Enquiring about Software Defined Radios.',
                  'Enquiring about high voltage power supplies.',
                  'Enquiring about Temperature Sensors.',
                  'Enquiring about Thin Film Capacitors.',
                  'Enquiring about Ceramic Capacitors.',
                  'Enquiring about PCB Fabrication.',
                  'Enquiring about Perimeter Intrusion Detection System (PIDS).'
                ]).map(p => `
                  <button class="filter-chip-dark quick-preset" data-preset="${p}">${p.replace(/^(?:Inquiring|Enquiring) about /, '').replace(/\.$/, '')}</button>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- Contact Form -->
          <div class="contact-relay-form">
            <h3>Send Us a Message</h3>
            <p class="subtitle">Complete the form below. Technical responses provided within 24 hours.</p>

            <form id="home-contact-form">
              <div class="relay-form-row">
                <div class="relay-field">
                  <label for="h-name">Full Name *</label>
                  <input type="text" id="h-name" placeholder="Dr. Rajesh Kumar" required />
                </div>
                <div class="relay-field">
                  <label for="h-company">Organization / Company *</label>
                  <input type="text" id="h-company" placeholder="Defense Lab / R&D Institute" required />
                </div>
              </div>

              <div class="relay-form-row">
                <div class="relay-field">
                  <label for="h-email">Work Email *</label>
                  <input type="email" id="h-email" placeholder="name@organization.com" required />
                </div>
                <div class="relay-field">
                  <label for="h-phone">Contact Number</label>
                  <input type="tel" id="h-phone" placeholder="+91 98765 43210" />
                </div>
              </div>

              <div class="relay-field">
                <label for="h-subject">Subject / Enquiry Domain *</label>
                <select id="h-subject" required>
                  <option value="rfq">Request for Quotation (RFQ)</option>
                  <option value="technical">Technical Consultation & Design-In</option>
                  <option value="bespoke">Bespoke RF Microwave Engineering</option>
                  <option value="delivery">Delivery Timeline & Stock Availability</option>
                  <option value="general">Partnership & General Enquiry</option>
                </select>
              </div>

              <div class="relay-field">
                <label for="h-message">Requirement Details *</label>
                <textarea id="h-message" rows="4" placeholder="Specify part numbers, frequency range, operational parameters, and delivery timeline..." required></textarea>
              </div>

              <button type="submit" class="btn-relay-red" style="width:100%; justify-content:center;">
                Transmit Enquiry <i class="fa-solid fa-paper-plane" style="margin-left:8px;"></i>
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  `;
}

export function initHomePage() {
  // Ensure background video plays smoothly & muted
  const video = document.getElementById('hero-bg-video');
  if (video) {
    video.muted = true;
    video.defaultMuted = true;
    const attemptPlay = () => {
      if (video.paused) {
        video.muted = true;
        video.play().catch(() => {});
      }
    };
    attemptPlay();
    setTimeout(attemptPlay, 100);
    setTimeout(attemptPlay, 400);

    window.addEventListener('click', attemptPlay, { once: true });
    window.addEventListener('scroll', attemptPlay, { once: true, passive: true });
  }

  // Category tabs on home page
  const tabButtons = document.querySelectorAll('#home-category-tabs .filter-chip-dark');
  const productsGrid = document.getElementById('home-products-grid');

  if (tabButtons.length && productsGrid) {
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const filter = btn.getAttribute('data-filter') || 'all';
        const allPopular = getPopularProducts();
        
        let filtered = allPopular;
        if (filter === 'rogers') {
          filtered = allPopular.filter(p => p.oemId === 'rogers-corporation');
        } else if (filter === 'qorvo') {
          filtered = allPopular.filter(p => p.oemId === 'qorvo');
        } else if (filter === 'ohmega') {
          filtered = allPopular.filter(p => p.oemId === 'ohmega-ticer');
        } else if (filter === 'fortify') {
          filtered = allPopular.filter(p => p.oemId === 'fortify');
        } else if (filter === 'components') {
          filtered = allPopular.filter(p => p.oemId === 'minicircuits' || p.oemId === 'rfuw-engineering' || p.oemId === 'triteq');
        } else if (filter === 'sensors') {
          filtered = allPopular.filter(p => p.oemId === 'thermosen' || p.oemId === 'nee' || p.oemId === 'transline-technology');
        }

        if (filtered.length === 0) {
          productsGrid.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:var(--space-8);color:var(--text-gray-500);">
              No popular items currently in this view. <a data-route="/products" style="color:var(--logo-blue-light);font-weight:600;">View full catalog &rarr;</a>
            </div>
          `;
        } else {
          productsGrid.innerHTML = filtered.map((p, i) => renderProductCard(p, i)).join('');
        }
      });
    });
  }

  // Quick preset pills
  const presets = document.querySelectorAll('.quick-preset');
  const messageInput = document.getElementById('h-message');
  if (presets.length && messageInput) {
    presets.forEach(p => {
      p.addEventListener('click', () => {
        messageInput.value = p.getAttribute('data-preset');
        messageInput.focus();
      });
    });
  }

  // Contact form submission
  const form = document.getElementById('home-contact-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('h-name').value;
      const refId = 'ICON-' + Math.floor(100000 + Math.random() * 900000);

      form.innerHTML = `
        <div style="text-align:center;padding:var(--space-8) var(--space-4);">
          <div style="width:60px;height:60px;border-radius:50%;background:rgba(37,99,235,0.15);color:var(--logo-blue-light);display:flex;align-items:center;justify-content:center;font-size:1.8rem;margin:0 auto var(--space-4);">
            <i class="fa-solid fa-check"></i>
          </div>
          <h3 style="font-size:1.4rem;font-weight:800;color:var(--text-white);margin-bottom:8px;">Thank You, ${name}!</h3>
          <p style="color:var(--text-gray-400);font-size:0.95rem;margin-bottom:var(--space-4);">
            Your message has been logged. A specialized RF application engineer will review your enquiry and contact you within 24 hours.
          </p>
          <div style="display:inline-block;padding:8px 16px;background:rgba(255,255,255,0.05);border:1px solid var(--border-card);border-radius:var(--radius-md);font-family:var(--font-display);font-size:0.85rem;color:var(--text-white);">
            Enquiry Tracking Ref: <strong style="color:var(--logo-red-light);">${refId}</strong>
          </div>
        </div>
      `;
    });
  }
}
