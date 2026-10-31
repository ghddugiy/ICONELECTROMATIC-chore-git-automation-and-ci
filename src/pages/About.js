/**
 * About Page — ICON ELECTROMATIC
 * Strictly containing the authentic content from https://iconelectromatic2.lbimedia.in/about-us/
 * Fully dynamic via ContentService — cards, images, milestones, domains, pillars, why us.
 * Brand Theme: Deep Black, Electric Blue (#2563EB), Vibrant Red (#E11D48)
 */
import { ContentService } from '../data/ContentService.js';

export function renderAboutPage() {
  const d = ContentService.getData('about');

  const badges = d.badges || [
    { icon: 'fa-solid fa-award', text: 'Multi-Decade Pedigree', color: '#FDA4AF', bg: 'rgba(225,29,72,0.08)', border: 'rgba(225,29,72,0.25)' },
    { icon: 'fa-solid fa-satellite', text: 'Defense & Telecom Solutions', color: '#FCD34D', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)' },
    { icon: 'fa-solid fa-globe', text: 'Global OEM Representation', color: '#6EE7B7', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)' },
  ];

  const highlightCards = d.highlightCards || [
    { title: 'Global Leader in RF & Electronic Solutions', desc: 'Providing mission-critical components, assemblies, and custom microwave engineering for advanced applications.', icon: 'fa-solid fa-tower-broadcast', color: 'blue' },
    { title: 'Advanced Components, Consultancy & Bespoke Design Services', desc: 'End-to-end design-in engineering, RF simulation review, and custom-tailored fulfillment for client success.', icon: 'fa-solid fa-microchip', color: 'red' },
  ];

  const stats = d.stats || [
    { target: '1500', suffix: '+', label: 'Products', icon: 'fa-solid fa-boxes-stacked', color: 'red' },
    { target: '150', suffix: '+', label: 'Years of combined experience', icon: 'fa-solid fa-calendar-check', color: 'blue' },
    { target: '15', suffix: '+', label: 'Partners', icon: 'fa-solid fa-handshake-angle', color: 'red' },
  ];

  const milestones = d.milestones || [
    { year: '2009', title: 'RF & Microwave Genesis', desc: 'Established in Bengaluru, Karnataka by veteran RF & Microwave engineers focusing on defense electronics and aerospace components distribution.', image: '/images/timeline/timeline-2009-bengaluru.jpg', caption: 'Genesis in Bengaluru, India', color: 'cyan' },
    { year: '2018', title: 'Singapore APAC Gateway', desc: 'Incorporated Icon Electromatic Singapore Pte Ltd to anchor international supply chains and streamline East Asian semiconductor distribution.', image: '/images/timeline/timeline-2018-singapore.jpg', caption: 'Regional Headquarters Singapore', color: 'red' },
    { year: 'May 2020', title: 'USA Transatlantic Corridor', desc: 'Expanded transatlantic footprint to the United States to collaborate directly with premier American microwave OEMs, ITAR suppliers, and global innovators.', image: '/images/timeline/timeline-2020-usa.jpg', caption: 'US Operations, Oklahoma', color: 'navy' },
    { year: 'Nov 2020', title: 'Incorporation in India', desc: 'Transitioned and formally incorporated as Icon Electromatic Private Limited, scaling nationwide operations and advancing “Make in India” initiatives.', image: '/images/timeline/timeline-2020-india.jpg', caption: 'Incorporation in India', color: 'amber' },
  ];

  const domains = d.domains || [
    { title: 'Aerospace & Defence', desc: 'High-power GaN amplifiers, RF filters, waveguides, and radar subsystems for tactical airborne, naval, and ground-based defense platforms.', image: '/images/timeline/domain-aerospace-defence.jpg', tag: 'Radar & EW Systems' },
    { title: 'Hi-Rel Space', desc: 'Spaceflight-qualified, radiation-tolerant microwave components and low-loss substrates engineered for orbital payloads and satellites.', image: '/images/timeline/domain-hirel-space.jpg', tag: 'Space-Grade Qualified' },
    { title: '6G & SATCOM', desc: 'Ultra-wideband mmWave components, parabolic antenna feed networks, beamformers, and ground station transceivers.', image: '/images/timeline/domain-5g-satcom.jpg', tag: 'Next-Gen Telecom' },
    { title: 'Homeland Security & Smart City', desc: 'Perimeter intrusion detection systems (PIDS), tactical perimeter radar sensors, and smart city surveillance electronics.', image: '/images/timeline/domain-homeland-security.jpg', tag: 'Intrusion & Radar' },
  ];

  const pillars = d.pillars || [
    { eyebrow: 'GLOBAL ALLIANCES', title: 'Global Partnerships', subtitle: 'Advanced Technologies', desc: 'Direct OEM partnerships with premier global innovators (Qorvo, Rogers, Tecdia, Mini-Circuits, and more), delivering verified authentic high-performance components to Indian industries.', image: '/images/timeline/pillar-global-partnerships.jpg', color: 'blue' },
    { eyebrow: 'ENGINEERING EXPERTISE', title: 'Bespoke Solutions', subtitle: 'RF & Design Services', desc: 'End-to-end design-in consultancy, specialized microwave simulation, prototyping, and custom RF assembly integration tailored precisely to mission specifications.', image: '/images/timeline/pillar-bespoke-solutions.jpg', color: 'red' },
  ];

  const whyUs = d.whyUs || [
    { number: '01', title: 'We Help Customers Achieve Their Goals Without Compromise', desc: 'Access an expanding portfolio of high-performance RF and Microwave components, mmWave, and Semiconductor components. Whether simple or highly complex, our solutions integrate seamlessly into your designs—saving time, reducing effort, and accelerating project success.', icon: 'fa-solid fa-bullseye', color: 'red' },
    { number: '02', title: 'Empowering You With Cutting-Edge Technology', desc: 'From advanced ICs to mission-critical subsystems, we provide the technologies that unlock new possibilities. Our expertise helps you build smarter, faster, and more capable electronic systems across every application.', icon: 'fa-solid fa-microchip', color: 'blue' },
    { number: '03', title: 'Engineered Solutions Tailored to Your Needs', desc: 'Combining engineering insight with best-in-class global products, we deliver solutions that balance innovation, performance, and reliability. Every recommendation is customised to your technical, commercial, and operational requirements.', icon: 'fa-solid fa-gears', color: 'red' },
    { number: '04', title: 'Access to Advanced Technology', desc: 'Stay ahead with timely access to the latest RF, Microwave, mmWave, and Semiconductor innovations sourced from world-leading OEMs.', icon: 'fa-solid fa-bolt', color: 'blue' },
  ];

  const infographicImg = ContentService.resolveImg(d.infographicImage || '/images/timeline/icon-journey-infographic-full.png');

  return `
    <div class="page-content about-page" style="min-height:100vh;">
      <!-- Unified Page Hero Banner -->
      <section class="page-hero-banner" style="position:relative;overflow:hidden;">
        <!-- Ambient Lighting Effects -->
        <div class="about-ambient-orb about-ambient-orb-1" style="position:absolute;top:0;left:10%;width:500px;height:500px;background:radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 70%);border-radius:50%;pointer-events:none;"></div>
        <div class="about-ambient-orb about-ambient-orb-2" style="position:absolute;top:300px;right:5%;width:600px;height:600px;background:radial-gradient(circle, rgba(225,29,72,0.08) 0%, transparent 70%);border-radius:50%;pointer-events:none;"></div>

        <div class="container" style="position:relative;z-index:2;">
          <!-- Breadcrumb -->
          <nav class="breadcrumb-dark">
            <a href="#/" data-route="/">Home</a>
            <span class="sep"><i class="fa-solid fa-chevron-right" style="font-size:0.7rem;"></i></span>
            <span class="crumb-current" style="color:var(--text-white);font-weight:600;">About Us</span>
          </nav>

          <!-- Section 1: Hero Header with Animated Ambient Radar -->
          <div class="page-header-unified" style="display:flex;align-items:center;padding:10px 0;margin-bottom:0;">
            <div class="rf-radar-ambient" aria-hidden="true">
              <div class="rf-radar-ring"></div>
              <div class="rf-radar-ring"></div>
              <div class="rf-radar-ring"></div>
              <div class="rf-radar-ring"></div>
              <div class="rf-radar-sweep"></div>
            </div>

            <div style="position:relative;z-index:3;">
              <h1 class="page-title-unified">
                ${d.heroTitle || 'About Us'}
              </h1>
              
              <p class="page-lead-unified">
                ${d.heroLead || 'Driven by decades of engineering expertise and global collaborations, Icon Electromatic Private Limited delivers advanced components and tailored solutions that transform design ambitions into reality.'}
              </p>
            </div>
          </div>

          <!-- Highlights Strip -->
          <div class="services-trust-strip about-trust-strip" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:24px;margin-bottom:0;padding-bottom:0;border-bottom:none;">
            ${badges.map(b => `
              <div style="background:${b.bg || 'rgba(255,255,255,0.05)'};border:1px solid ${b.border || 'rgba(255,255,255,0.15)'};border-radius:10px;padding:10px 18px;font-size:0.85rem;color:${b.color || '#fff'};display:flex;align-items:center;gap:8px;">
                <i class="${b.icon || 'fa-solid fa-award'}"></i>
                <span>${b.text}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </section>

      <!-- Main Content Area -->
      <div class="page-main-body" style="padding-top:var(--space-12);padding-bottom:var(--space-20);">
        <div class="container">
          <!-- Section 2: Fulfillment Partners & Origin -->
          <div style="display:grid;grid-template-columns:1.15fr 0.85fr;gap:40px;align-items:center;border-radius:24px;padding:44px 36px;margin-bottom:var(--space-16);" class="about-hero-feature-card about-interactive-card about-animate-fadeup">
            <div>
              <h2 style="font-family:var(--font-display);font-size:clamp(1.85rem, 2.8vw, 2.35rem);font-weight:800;line-height:1.2;margin-bottom:10px;" class="about-hero-main-title">
                ${d.coreCapabilitiesTitle || 'Core Capabilities'}
              </h2>
              <div style="font-family:var(--font-display);font-size:clamp(1.15rem, 1.6vw, 1.35rem);font-weight:700;color:var(--logo-red-light);line-height:1.35;margin-bottom:18px;" class="about-hero-sub-title">
                ${d.coreCapabilitiesSubtitle || 'Fulfillment partners for your electronic ambitions'}
              </div>
              <p style="font-size:0.95rem;line-height:1.75;margin-bottom:14px;">
                ${d.companyDesc1 || 'Icon Electromatic was founded in 2009 in Bengaluru by engineers with decades of expertise in RF, Microwave, Semiconductors, and allied service industries. In 2020, the company transitioned into <strong>Icon Electromatic Private Limited</strong> and expanded its presence across India, Israel, Singapore, and the USA.'}
              </p>
              <p style="font-size:0.95rem;line-height:1.75;margin-bottom:24px;">
                ${d.companyDesc2 || 'With deep experience in electronic research, development, and manufacturing ecosystems—spanning both public and private sectors—and strengthened by long-standing global partnerships, the company delivers more than advanced components. We also provide business consultancy and specialized RF design services to offer bespoke, high-performance solutions for its clients.'}
              </p>

              <!-- Downloads -->
              <div style="display:flex;flex-wrap:wrap;gap:14px;">
                <a href="${d.presentationLink || '/downloads/ICON_Corporate_Presentation_20Aug26.pptx'}" download class="btn-relay btn-relay-primary" style="padding:11px 22px;font-size:0.85rem;">
                  <i class="fa-solid fa-file-powerpoint" style="margin-right:6px;"></i>Corporate Presentation &darr;
                </a>
                <a href="${d.flyerLink || '/downloads/ICON_ELECTROMATIC_FLYER.pdf'}" download class="btn-relay btn-relay-secondary" style="padding:11px 22px;font-size:0.85rem;">
                  <i class="fa-solid fa-file-pdf" style="color:var(--logo-red-light);margin-right:6px;"></i>Company Flyer &darr;
                </a>
              </div>
            </div>

            <!-- Feature Highlight Cards -->
            <div style="display:flex;flex-direction:column;gap:16px;">
              ${highlightCards.map(hl => `
                <div style="border-radius:16px;padding:24px 20px;display:flex;align-items:flex-start;gap:16px;" class="about-subcard-${hl.color || 'blue'} about-interactive-card ${hl.color === 'red' ? 'red-glow' : ''} about-animate-fadeup">
                  <div class="about-card-icon" style="width:48px;height:48px;border-radius:12px;background:rgba(${hl.color === 'red' ? '225,29,72' : '37,99,235'},0.15);border:1px solid rgba(${hl.color === 'red' ? '225,29,72' : '37,99,235'},0.3);display:flex;align-items:center;justify-content:center;font-size:1.3rem;color:var(--logo-${hl.color || 'blue'}-light);flex-shrink:0;">
                    <i class="${hl.icon || 'fa-solid fa-microchip'}"></i>
                  </div>
                  <div>
                    <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:4px;line-height:1.3;">
                      ${hl.title}
                    </h3>
                    <p style="font-size:0.85rem;line-height:1.5;margin:0;">
                      ${hl.desc}
                    </p>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Section 3: Some Quick Facts -->
          <div class="about-stats-banner" id="about-stats-container">
            <div class="about-stats-banner-accent"></div>
            
            <div style="text-align:center;max-width:650px;margin:0 auto var(--space-8);">
              <h2 class="about-stats-h2" style="font-family:var(--font-display);font-size:clamp(1.85rem, 2.8vw, 2.4rem);font-weight:800;letter-spacing:-0.02em;margin-bottom:8px;">
                ${d.statsTitle || 'Some Quick Facts'}
              </h2>
              <div class="about-section-sub-title" style="font-family:var(--font-display);font-size:clamp(1.15rem, 1.6vw, 1.35rem);font-weight:700;color:var(--logo-red-light);line-height:1.35;margin-bottom:12px;">
                ${d.statsSubtitle || 'The Numbers That Define Us'}
              </div>
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:28px;text-align:center;" id="stats-grid-wrapper">
              ${stats.map(st => `
                <div class="about-interactive-card ${st.color || 'red'}-glow about-animate-fadeup" style="padding:36px 24px;">
                  <div class="about-stats-icon-box about-stats-icon-${st.color || 'red'}">
                    <i class="${st.icon || 'fa-solid fa-boxes-stacked'}"></i>
                  </div>
                  <div class="stat-num-${st.color || 'red'}" style="font-family:var(--font-display);font-size:clamp(2.6rem, 3.8vw, 3.5rem);font-weight:900;color:var(--logo-${st.color || 'red'}${st.color === 'blue' ? '-light' : ''});line-height:1;margin-bottom:10px;">
                    <span class="stat-counter" data-target="${st.target}">${st.target}</span><span>${st.suffix || '+'}</span>
                  </div>
                  <div class="about-stat-label" style="font-size:1.05rem;font-weight:700;letter-spacing:-0.01em;">${st.label}</div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Section 4: Our Vision & Our Mission -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-bottom:var(--space-16);">
            <!-- Our Vision Card -->
            <div class="about-vision-card about-interactive-card red-glow about-animate-fadeup" style="padding:36px;display:flex;flex-direction:column;justify-content:space-between;border-top:3px solid var(--logo-red);">
              <div>
                <div class="about-card-icon" style="width:52px;height:52px;border-radius:12px;background:rgba(225,29,72,0.12);border:1px solid rgba(225,29,72,0.3);color:var(--logo-red-light);display:flex;align-items:center;justify-content:center;font-size:1.4rem;margin-bottom:20px;">
                  <i class="fa-solid fa-eye"></i>
                </div>
                <h2 style="font-family:var(--font-display);font-size:1.75rem;font-weight:800;margin-bottom:14px;">
                  ${d.visionTitle || 'Our Vision'}
                </h2>
                <p style="font-size:1rem;line-height:1.75;margin:0;">
                  ${d.visionDesc || 'To be India’s foremost and most trusted source of essential electronics components for research, development, and manufacturing across both public and private sectors.'}
                </p>
              </div>
            </div>

            <!-- Our Mission Card -->
            <div class="about-mission-card about-interactive-card about-animate-fadeup" style="padding:36px;display:flex;flex-direction:column;justify-content:space-between;border-top:3px solid var(--logo-blue);">
              <div>
                <div class="about-card-icon" style="width:52px;height:52px;border-radius:12px;background:rgba(37,99,235,0.12);border:1px solid rgba(37,99,235,0.3);color:var(--logo-blue-light);display:flex;align-items:center;justify-content:center;font-size:1.4rem;margin-bottom:20px;">
                  <i class="fa-solid fa-bullseye"></i>
                </div>
                <h2 style="font-family:var(--font-display);font-size:1.75rem;font-weight:800;margin-bottom:14px;">
                  ${d.missionTitle || 'Our Mission'}
                </h2>
                <p style="font-size:1rem;line-height:1.75;margin:0;">
                  ${d.missionDesc || 'To introduce the world’s most cutting-edge technology solutions and components to India by forging strategic partnerships with global industry leaders, fostering indigenous product development and advancing “Make in India” initiatives.'}
                </p>
              </div>
            </div>
          </div>

          <!-- Section 5: Our Journey (Chronological Timeline Format) -->
          <div style="margin-bottom:var(--space-16);">
            <div style="text-align:center;max-width:720px;margin:0 auto var(--space-8);">
              <h2 style="font-family:var(--font-display);font-size:clamp(1.85rem, 2.8vw, 2.4rem);font-weight:800;letter-spacing:-0.02em;margin-bottom:8px;">
                ${d.journeyTitle || 'Chronology'}
              </h2>
              <div class="about-section-sub-title" style="font-family:var(--font-display);font-size:clamp(1.15rem, 1.6vw, 1.35rem);font-weight:700;color:var(--logo-red-light);line-height:1.35;margin-bottom:14px;">
                ${d.journeySubtitle || 'Our Journey'}
              </div>
              <p style="font-size:0.95rem;line-height:1.7;color:var(--text-muted);margin:0 auto 16px;">
                ${d.journeyLead || 'From our founding in Bengaluru in 2009 as RF & Microwave specialists to global operations spanning Singapore, the USA, and India — empowering mission-critical Aerospace, Defence, Space, and SATCOM programs.'}
              </p>
              <div style="display:flex;justify-content:center;gap:12px;">
                <button type="button" id="btn-view-infographic" class="btn-relay btn-relay-secondary" style="padding:9px 20px;font-size:0.82rem;display:inline-flex;align-items:center;gap:8px;cursor:pointer;">
                  <i class="fa-solid fa-expand"></i> View Slide Graphic
                </button>
              </div>
            </div>

          <div class="relay-timeline-wrapper">
            <!-- 4-Node Timeline Connecting Rail with Passing Neon Wave -->
            <div class="relay-timeline-rail-4">
              <!-- High-Tech Rail Track with Neon Wave Plasma -->
              <div class="relay-timeline-rail-track">
                <div class="relay-timeline-rail-plasma"></div>
                <div class="relay-timeline-rail-ticks"></div>
                <!-- Dynamic Neon Wave Passing across the Timeline -->
                <div class="relay-neon-wave-beam"></div>
                <div class="relay-neon-wave-droplet"></div>
              </div>
              
              <!-- Node 1: 2009 (RF & Microwave Genesis) -->
              <div class="relay-timeline-node node-step-1" data-milestone="${milestones[0]?.year || '2009'}">
                <div class="node-radar-wave-ring"></div>
                <div class="node-radar-wave-ring delay"></div>
                <div class="node-tech-reticle"></div>
                <div class="timeline-node-circle cyan-node">
                  <svg class="node-tech-svg" viewBox="0 0 32 32" fill="none" stroke="currentColor">
                    <path d="M16 8v15M13 23h6M12 17h8M14 12h4" stroke-width="1.8" stroke-linecap="round"/>
                    <circle cx="16" cy="7" r="2.5" fill="currentColor"/>
                    <path d="M11 4.5A7 7 0 0 0 11 9.5" stroke-width="1.8" stroke-linecap="round" class="svg-wave-left-1"/>
                    <path d="M7.5 2.5A12 12 0 0 0 7.5 11.5" stroke-width="1.6" stroke-linecap="round" class="svg-wave-left-2"/>
                    <path d="M21 4.5A7 7 0 0 1 21 9.5" stroke-width="1.8" stroke-linecap="round" class="svg-wave-right-1"/>
                    <path d="M24.5 2.5A12 12 0 0 1 24.5 11.5" stroke-width="1.6" stroke-linecap="round" class="svg-wave-right-2"/>
                    <path d="M10 27l6-3 6 3" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
                <div class="timeline-node-year-pill cyan-pill">
                  <span class="node-year-text">${milestones[0]?.year || '2009'}</span>
                  <span class="node-live-dot"></span>
                </div>
                <div class="timeline-stem-connector cyan-stem">
                  <div class="stem-photon-drop"></div>
                </div>
              </div>

              <!-- Node 2: 2018 (Singapore APAC Gateway) -->
              <div class="relay-timeline-node node-step-2" data-milestone="${milestones[1]?.year || '2018'}">
                <div class="node-radar-wave-ring red-ring"></div>
                <div class="node-radar-wave-ring red-ring delay"></div>
                <div class="node-tech-reticle"></div>
                <div class="timeline-node-circle red-node">
                  <svg class="node-tech-svg" viewBox="0 0 32 32" fill="none" stroke="currentColor">
                    <circle cx="16" cy="16" r="11" stroke-width="1.8"/>
                    <ellipse cx="16" cy="16" rx="5" ry="11" stroke-width="1.4"/>
                    <path d="M5.5 16h21M7.5 10.5h17M7.5 21.5h17" stroke-width="1.2" stroke-linecap="round"/>
                    <ellipse cx="16" cy="16" rx="14" ry="4.5" stroke-width="1.6" stroke-dasharray="3 2" transform="rotate(-25 16 16)" class="svg-orbit-ring"/>
                    <circle cx="26" cy="11" r="2" fill="currentColor"/>
                    <circle cx="16" cy="16" r="2.5" fill="currentColor"/>
                  </svg>
                </div>
                <div class="timeline-node-year-pill red-pill">
                  <span class="node-year-text">${milestones[1]?.year || '2018'}</span>
                  <span class="node-live-dot"></span>
                </div>
                <div class="timeline-stem-connector red-stem">
                  <div class="stem-photon-drop"></div>
                </div>
              </div>

              <!-- Node 3: May 2020 (USA Transatlantic Corridor) -->
              <div class="relay-timeline-node node-step-3" data-milestone="${milestones[2]?.year || 'May 2020'}">
                <div class="node-radar-wave-ring navy-ring"></div>
                <div class="node-radar-wave-ring navy-ring delay"></div>
                <div class="node-tech-reticle"></div>
                <div class="timeline-node-circle navy-node">
                  <svg class="node-tech-svg" viewBox="0 0 32 32" fill="none" stroke="currentColor">
                    <circle cx="16" cy="16" r="11.5" stroke-width="1.2" stroke-dasharray="2 2" opacity="0.6"/>
                    <path d="M25 7l-6 13-3-3-5 3 2-6-3-3 15-4z" stroke-width="1.8" stroke-linejoin="round" fill="rgba(59,130,246,0.25)"/>
                    <path d="M10 23l-4 4M13 22l-5 5M12 25l-4 4" stroke-width="1.5" stroke-linecap="round" class="svg-thrust-trail"/>
                    <path d="M16 2v3M16 27v3M2 16h3M27 16h3" stroke-width="1.5" stroke-linecap="round"/>
                  </svg>
                </div>
                <div class="timeline-node-year-pill navy-pill">
                  <span class="node-year-text">${milestones[2]?.year || 'May 2020'}</span>
                  <span class="node-live-dot"></span>
                </div>
                <div class="timeline-stem-connector navy-stem">
                  <div class="stem-photon-drop"></div>
                </div>
              </div>

              <!-- Node 4: Nov 2020 (India Incorporation & Enterprise Crest) -->
              <div class="relay-timeline-node node-step-4" data-milestone="${milestones[3]?.year || 'Nov 2020'}">
                <div class="node-radar-wave-ring amber-ring"></div>
                <div class="node-radar-wave-ring amber-ring delay"></div>
                <div class="node-tech-reticle"></div>
                <div class="timeline-node-circle amber-node">
                  <svg class="node-tech-svg" viewBox="0 0 32 32" fill="none" stroke="currentColor">
                    <path d="M16 3l10 4v8c0 7-5 12-10 14C11 27 6 22 6 15V7l10-4z" stroke-width="1.8" stroke-linejoin="round" fill="rgba(245,158,11,0.2)"/>
                    <path d="M16 9l2 4.5 4.5 1-3.5 3 1 4.5-4-2.5-4 2.5 1-4.5-3.5-3 4.5-1L16 9z" fill="currentColor" stroke-width="1" stroke-linejoin="round"/>
                    <path d="M10 29h12" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </div>
                <div class="timeline-node-year-pill amber-pill">
                  <span class="node-year-text">${milestones[3]?.year || 'Nov 2020'}</span>
                  <span class="node-live-dot"></span>
                </div>
                <div class="timeline-stem-connector amber-stem">
                  <div class="stem-photon-drop"></div>
                </div>
              </div>
            </div>

            <!-- 4 Chronological Milestone Cards -->
            <div class="journey-grid-four">
              ${milestones.map((m, idx) => {
                const img = ContentService.resolveImg(m.image);
                const color = m.color || (idx === 0 ? 'cyan' : idx === 1 ? 'red' : idx === 2 ? 'navy' : 'amber');
                const archClass = color === 'red' ? 'red' : color === 'navy' ? 'navy-flag' : color === 'amber' ? 'amber' : 'blue';
                const cardAccentClass = color === 'red' ? 'card-accent-red red-glow' : color === 'navy' ? 'card-accent-navy blue-glow' : color === 'amber' ? 'card-accent-amber' : 'blue-glow';
                const borderTopColor = color === 'red' ? 'var(--logo-red)' : color === 'navy' ? '#1e40af' : color === 'amber' ? '#d97706' : 'var(--logo-blue)';
                const dotGlowClass = color === 'red' ? 'red' : color === 'navy' ? 'navy' : color === 'amber' ? 'amber' : '';

                return `
                  <div class="journey-milestone-card ${cardAccentClass} about-interactive-card about-animate-fadeup" style="border-top:3.5px solid ${borderTopColor};">
                    <div class="journey-arch-badge-wrapper">
                      <div class="journey-arch-badge ${archClass}">
                        <span class="badge-dot-glow ${dotGlowClass}"></span>${m.year}
                      </div>
                    </div>
                    <h3 class="journey-milestone-headline">
                      ${m.title}
                    </h3>
                    ${img ? `
                      <div class="journey-photo-frame">
                        <img src="${img}" alt="${m.title}" loading="lazy" />
                        ${m.caption ? `
                          <div class="journey-photo-caption">
                            <i class="${idx === 0 ? 'fa-solid fa-satellite-dish' : idx === 1 ? 'fa-solid fa-earth-asia' : idx === 2 ? 'fa-solid fa-plane-up' : 'fa-solid fa-shield-halved'}" style="margin-right:6px; color:${color === 'red' ? '#FB7185' : color === 'navy' ? '#60A5FA' : color === 'amber' ? '#FBBF24' : '#00E5FF'};"></i>
                            <span>${m.caption}</span>
                          </div>
                        ` : ''}
                      </div>
                    ` : ''}
                    <p class="journey-milestone-desc">
                      ${m.desc}
                    </p>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

            <!-- Central Junction Connector to Strategic Sectors -->
            <div class="timeline-central-junction about-animate-fadeup">
              <div class="timeline-junction-divider">
                <div class="timeline-junction-orb">
                  <i class="fa-solid fa-satellite-dish"></i>
                </div>
              </div>
              <h3 style="font-family:var(--font-display);font-size:clamp(1.65rem, 2.4vw, 2.05rem);font-weight:800;letter-spacing:-0.01em;margin-bottom:8px;">
                ${d.strategicDomainsTitle || 'Strategic Application Domains'}
              </h3>
              <div class="about-section-sub-title" style="font-family:var(--font-display);font-size:clamp(1.1rem, 1.5vw, 1.3rem);font-weight:700;color:var(--logo-red-light);line-height:1.35;margin-bottom:14px;">
                ${d.strategicDomainsSubtitle || 'Where Our Technology Operates'}
              </div>
              <p style="font-size:0.9rem;line-height:1.6;color:var(--text-muted);max-width:620px;margin:0 auto 28px;">
                ${d.strategicDomainsLead || 'Delivering mission-critical electronic components, high-reliability assemblies, and custom microwave engineering across four strategic arenas.'}
              </p>
            </div>

            <!-- 4 Domain Sector Cards -->
            <div class="journey-domains-grid">
              ${domains.map(dom => {
                const img = ContentService.resolveImg(dom.image);
                return `
                  <div class="domain-sector-card about-interactive-card blue-glow about-animate-fadeup">
                    <div class="domain-photo-frame">
                      <img src="${img}" alt="${dom.title}" loading="lazy" />
                      <div class="domain-photo-badge">
                        ${dom.title}
                      </div>
                    </div>
                    <p class="domain-sector-desc">
                      ${dom.desc}
                    </p>
                    <span class="domain-tag-pill">
                      <i class="fa-solid fa-shield-halved" style="margin-right:4px;"></i>${dom.tag || ''}
                    </span>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Foundational Strategic Pillars -->
            <div class="journey-pillars-grid">
              ${pillars.map(pil => {
                const img = ContentService.resolveImg(pil.image);
                return `
                  <div class="pillar-foundation-card ${pil.color || 'blue'}-pillar about-interactive-card ${pil.color || 'blue'}-glow about-animate-fadeup" style="border-left:4px solid var(--logo-${pil.color || 'blue'});">
                    <div class="pillar-photo-frame">
                      <img src="${img}" alt="${pil.title}" loading="lazy" />
                    </div>
                    <div>
                      <div style="font-size:0.75rem;font-weight:700;color:var(--logo-${pil.color || 'blue'}-light);letter-spacing:0.08em;margin-bottom:4px;">
                        ${pil.eyebrow || 'FOUNDATIONAL PILLAR'}
                      </div>
                      <h3 class="pillar-content-title">
                        ${pil.title}
                      </h3>
                      <div class="pillar-content-sub">
                        ${pil.subtitle}
                      </div>
                      <p class="pillar-content-text">
                        ${pil.desc}
                      </p>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Section 6: Why Us -->
          <div style="margin-bottom:var(--space-12);">
            <div style="text-align:center;max-width:600px;margin:0 auto var(--space-10);">
              <h2 style="font-family:var(--font-display);font-size:clamp(1.85rem, 2.8vw, 2.4rem);font-weight:800;letter-spacing:-0.02em;margin-bottom:8px;">
                ${d.whyUsTitle || 'Our Advantage'}
              </h2>
              <div class="about-section-sub-title" style="font-family:var(--font-display);font-size:clamp(1.15rem, 1.6vw, 1.35rem);font-weight:700;color:var(--logo-red-light);line-height:1.35;margin-bottom:14px;">
                ${d.whyUsSubtitle || 'Why Us'}
              </div>
            </div>

            <div class="why-us-grid-dark">
              ${whyUs.map(wu => `
                <div class="why-us-card about-interactive-card ${wu.color === 'red' ? 'red-accent red-glow' : ''} about-animate-fadeup" style="border-top:3px solid var(--logo-${wu.color || 'blue'});">
                  <span class="why-card-number">${wu.number || '01'}</span>
                  <div class="about-card-icon" style="width:48px;height:48px;border-radius:12px;background:rgba(${wu.color === 'red' ? '225,29,72' : '37,99,235'},0.12);border:1px solid rgba(${wu.color === 'red' ? '225,29,72' : '37,99,235'},0.3);color:var(--logo-${wu.color || 'blue'}-light);display:flex;align-items:center;justify-content:center;font-size:1.3rem;margin-bottom:20px;">
                    <i class="${wu.icon || 'fa-solid fa-bullseye'}"></i>
                  </div>
                  <h3 style="font-family:var(--font-display);font-size:1.25rem;font-weight:800;margin-bottom:12px;line-height:1.35;">
                    ${wu.title}
                  </h3>
                  <p style="font-size:0.9rem;line-height:1.7;margin:0;">
                    ${wu.desc}
                  </p>
                </div>
              `).join('')}
            </div>
          </div>

        </div>
      </div>

      <!-- Infographic Lightbox Modal -->
      <div id="timeline-infographic-modal" class="timeline-modal-backdrop" aria-hidden="true">
        <div class="timeline-modal-content">
          <div class="timeline-modal-header">
            <div style="display:flex;align-items:center;gap:12px;">
              <span class="domain-tag-pill" style="font-size:0.72rem;">OFFICIAL PRESENTATION SLIDE</span>
              <h3 style="font-family:var(--font-display);font-size:1.1rem;font-weight:800;margin:0;">Icon Electromatic — Chronology &amp; Core Focus</h3>
            </div>
            <button type="button" id="close-timeline-modal-btn" class="timeline-modal-close" aria-label="Close modal">&times;</button>
          </div>
          <div class="timeline-modal-body">
            <img src="${infographicImg}" alt="Official Icon Electromatic Chronology and Core Focus Infographic" style="width:100%;height:auto;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.5);display:block;" />
          </div>
        </div>
      </div>
    </div>
  `;
}

export function initAboutPage() {
  // 1. Mouse Spotlight Glow & Interactive 3D Subtle Tilt on Cards
  const cards = document.querySelectorAll('.about-interactive-card');
  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);

      const tiltX = ((y / rect.height) - 0.5) * -5;
      const tiltY = ((x / rect.width) - 0.5) * 5;
      card.style.transform = `perspective(1000px) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg) translateY(-6px)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.style.removeProperty('--mouse-x');
      card.style.removeProperty('--mouse-y');
    });
  });

  // 2. Animated Stats Number Counter on Scroll
  const statsContainer = document.getElementById('about-stats-container');
  if (statsContainer) {
    let animated = false;
    const counters = statsContainer.querySelectorAll('.stat-counter');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !animated) {
          animated = true;
          counters.forEach(counter => {
            const target = parseInt(counter.getAttribute('data-target'), 10) || 0;
            const duration = 1800;
            const startTime = performance.now();

            function updateCounter(currentTime) {
              const elapsed = currentTime - startTime;
              const progress = Math.min(elapsed / duration, 1);
              const easeOut = 1 - Math.pow(1 - progress, 4);
              const currentVal = Math.floor(easeOut * target);

              counter.textContent = currentVal.toLocaleString();

              if (progress < 1) {
                requestAnimationFrame(updateCounter);
              } else {
                counter.textContent = target.toLocaleString();
              }
            }

            requestAnimationFrame(updateCounter);
          });
        }
      });
    }, { threshold: 0.25 });

    observer.observe(statsContainer);
  }

  // 3. Staggered Scroll Reveal Animation for Cards
  const animatedCards = document.querySelectorAll('.about-animate-fadeup');
  if (animatedCards.length) {
    const cardObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry, idx) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            entry.target.classList.add('is-visible');
          }, idx * 60);
          cardObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    animatedCards.forEach(c => cardObserver.observe(c));
  }

  // 4. Official Infographic Modal Lightbox
  const openModalBtn = document.getElementById('btn-view-infographic');
  const modal = document.getElementById('timeline-infographic-modal');
  const closeModalBtn = document.getElementById('close-timeline-modal-btn');

  if (openModalBtn && modal) {
    const openModal = () => {
      modal.classList.add('is-active');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    };

    const closeModal = () => {
      modal.classList.remove('is-active');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    };

    openModalBtn.addEventListener('click', openModal);

    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', closeModal);
    }

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('is-active')) {
        closeModal();
      }
    });
  }
}
