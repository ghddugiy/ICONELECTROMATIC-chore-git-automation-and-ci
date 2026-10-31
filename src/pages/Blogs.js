/**
 * Blogs & OEM Technical News Page — ICON ELECTROMATIC
 * Sleek Dark Relay Aesthetics
 * Displays all 15 manufacturing partner OEMs, technical news releases,
 * demonstration videos, application notes, and official technical website links.
 */
import { CATALOG } from '../data/catalogData.js';
import { OEM_BLOGS } from '../data/blogData.js';
import { ContentService } from '../data/ContentService.js';

function getBlogCmsData() {
  const cms = ContentService.getData('blogs');
  if (cms && Array.isArray(cms.oemBlogs)) {
    return cms;
  }
  return {
    heroTitle: 'OEM Technical News, Video Demos & Insights',
    heroSubtitle: 'Direct technical bulletins, video demonstrations, application whitepapers, and product release updates from ICON Electromatic\'s 15 global manufacturing partners.',
    trustBadge1: 'Application Whitepapers & Notes',
    trustBadge2: 'Video Demos & Technical Webinars',
    trustBadge3: 'Direct Manufacturer Bulletins',
    oemBlogs: (OEM_BLOGS || [])
  };
}

function getActiveOemBlogs() {
  const data = getBlogCmsData();
  return (data.oemBlogs || []).filter(b => b.visible !== false);
}

function getActiveBlogDataForOem(oemId) {
  const cms = getBlogCmsData();
  const oemBlogs = cms.oemBlogs || [];
  const oem = CATALOG.find(o => o.id === oemId);
  if (!oem) return null;
  const blog = oemBlogs.find(b => b.oemId === oemId) || {
    oemId,
    officialWebsite: oem.website || '#',
    portalName: `${oem.name} Engineering Resource Hub`,
    headline: oem.tagline || oem.specialty,
    articles: [],
    videos: [],
    whitepapers: [],
    officialLinks: []
  };
  return { oem, blog };
}

function getAllActiveArticles() {
  const oemBlogs = getActiveOemBlogs();
  const list = [];
  oemBlogs.forEach(b => {
    const oem = CATALOG.find(o => o.id === b.oemId);
    if (!oem) return;
    (b.articles || []).filter(a => a.visible !== false).forEach(art => {
      list.push({ ...art, oemName: oem.name, oemShort: oem.shortName, oemId: oem.id, oemAccent: oem.accentColor, oemLogo: oem.logoSvg });
    });
  });
  return list;
}

function getAllActiveVideos() {
  const oemBlogs = getActiveOemBlogs();
  const list = [];
  oemBlogs.forEach(b => {
    const oem = CATALOG.find(o => o.id === b.oemId);
    if (!oem) return;
    (b.videos || []).filter(v => v.visible !== false).forEach(vid => {
      list.push({ ...vid, oemName: oem.name, oemShort: oem.shortName, oemId: oem.id, oemAccent: oem.accentColor, oemLogo: oem.logoSvg });
    });
  });
  return list;
}

function getActiveOemContentCount(oemId) {
  const cms = getBlogCmsData();
  const blog = (cms.oemBlogs || []).find(b => b.oemId === oemId);
  if (!blog) return { articles: 0, videos: 0, whitepapers: 0, links: 1, total: 1 };
  const articles = (blog.articles || []).filter(a => a.visible !== false).length;
  const videos = (blog.videos || []).filter(v => v.visible !== false).length;
  const whitepapers = (blog.whitepapers || []).filter(w => w.visible !== false).length;
  const links = (blog.officialLinks || []).length;
  return { articles, videos, whitepapers, links, total: articles + videos + whitepapers + links };
}

export function renderBlogsPage() {
  const hash = window.location.hash || '';
  const queryStr = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  const searchParams = new URLSearchParams(queryStr);
  const selectedOemId = searchParams.get('oem') || '';
  const activeTab = searchParams.get('tab') || 'all';

  if (selectedOemId) {
    const oemData = getActiveBlogDataForOem(selectedOemId);
    if (oemData) {
      return renderSingleOemBlogView(oemData.oem, oemData.blog, activeTab);
    }
  }

  return renderAllOemsBlogView();
}

function renderAllOemsBlogView() {
  const cmsData = getBlogCmsData();
  const allArticles = getAllActiveArticles();
  const allVideos = getAllActiveVideos();

  return `
    <div class="blogs-page-wrap" style="min-height:100vh;">
      <!-- Unified Page Hero Banner (Blue in light theme) -->
      <section class="page-hero-banner">
        <div class="container">
          <!-- Breadcrumb -->
          <nav class="breadcrumb-dark">
            <a data-route="/">Home</a>
            <span class="sep"><i class="fa-solid fa-chevron-right" style="font-size:0.7rem;"></i></span>
            <span class="crumb-current" style="color:var(--text-white);font-weight:600;">OEM Technical Blogs &amp; Releases</span>
          </nav>

          <!-- Page Header -->
          <div class="page-header-unified blogs-hero" style="margin-bottom:0;">
            <h1 class="page-title-unified">
              ${cmsData.heroTitle || 'OEM Technical News, Video Demos &amp; Insights'}
            </h1>
            <p class="page-lead-unified">
              ${cmsData.heroSubtitle || 'Direct technical bulletins, video demonstrations, application whitepapers, and product release updates from ICON Electromatic\'s 15 global manufacturing partners.'}
            </p>
          </div>

          <!-- Trust & Insights Highlights Strip (Matching Partners & Services 1:1) -->
          <div class="services-trust-strip blogs-trust-strip" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:24px;margin-bottom:0;padding-bottom:0;border-bottom:none;">
            <div style="background:rgba(225,29,72,0.08);border:1px solid rgba(225,29,72,0.25);border-radius:10px;padding:10px 18px;font-size:0.85rem;color:#FDA4AF;display:flex;align-items:center;gap:8px;">
              <i class="fa-solid fa-file-waveform" style="color:var(--logo-red-light);"></i>
              <span>${cmsData.trustBadge1 || 'Application Whitepapers &amp; Notes'}</span>
            </div>
            <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:10px;padding:10px 18px;font-size:0.85rem;color:#FCD34D;display:flex;align-items:center;gap:8px;">
              <i class="fa-solid fa-circle-play" style="color:#F59E0B;"></i>
              <span>${cmsData.trustBadge2 || 'Video Demos &amp; Technical Webinars'}</span>
            </div>
            <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:10px;padding:10px 18px;font-size:0.85rem;color:#6EE7B7;display:flex;align-items:center;gap:8px;">
              <i class="fa-solid fa-newspaper" style="color:#10B981;"></i>
              <span>${cmsData.trustBadge3 || 'Direct Manufacturer Bulletins'}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Main Content Area -->
      <div class="page-main-body" style="padding-top:var(--space-8);padding-bottom:var(--space-20);">
        <div class="container">
          <!-- Quick Filter Chips by OEM -->
          <div class="blogs-oem-selector-bar">
            <button class="blogs-oem-chip active" data-filter="all">
              <i class="fa-solid fa-layer-group"></i> All 15 OEMs
            </button>
          ${CATALOG.map(oem => `
            <button class="blogs-oem-chip" data-oem-select="${oem.id}">
              <span style="width:8px;height:8px;border-radius:50%;background:${oem.accentColor};display:inline-block;"></span>
              ${oem.shortName}
            </button>
          `).join('')}
        </div>

        <!-- Section: Select an OEM to Explore Their Releases -->
        <div style="margin-bottom:var(--space-6);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
          <div>
            <h3 style="font-size:1.3rem;font-weight:800;color:var(--text-white);margin-bottom:4px;">
              Select an OEM to Explore Direct Releases
            </h3>
            <p style="font-size:0.85rem;color:var(--text-gray-400);margin:0;">
              Click any manufacturer card to view their technical articles, lab videos, and application whitepapers:
            </p>
          </div>
        </div>

        <!-- 15 OEMs Grid -->
        <div class="blogs-oem-grid">
          ${CATALOG.map(oem => {
            const counts = getActiveOemContentCount(oem.id);
            return `
              <div class="blogs-oem-card" data-oem-id="${oem.id}" style="--oem-accent:${oem.accentColor};--oem-glow:${oem.glowColor};">
                <div class="blogs-oem-card-top-row">
                  <span class="blogs-oem-partner-tag" style="color:${oem.accentColor};background:${oem.accentColor}18;border:1px solid ${oem.accentColor}35;">
                    <i class="fa-solid fa-certificate"></i> Official Partner
                  </span>
                  <span class="blogs-oem-card-count">
                    <i class="fa-solid fa-newspaper" style="color:${oem.accentColor};font-size:0.7rem;"></i>
                    ${counts.total} Updates
                  </span>
                </div>

                <!-- Centered Prominent OEM Logo Showcase -->
                <div class="blogs-oem-card-logo-showcase">
                  <div class="oem-logo-badge-pod" style="--oem-accent:${oem.accentColor};">
                    ${oem.logoImg ? `<img src="${ContentService.resolveImg(oem.logoImg)}" alt="${oem.name} Official Logo" class="oem-logo-img" loading="eager" />` : (oem.logoSvg || '')}
                  </div>
                </div>

                <div style="text-align:center;margin-bottom:8px;">
                  <h3 style="margin-bottom:4px;">${oem.name}</h3>
                  <div class="blogs-oem-card-specialty" style="margin-bottom:8px;">${oem.specialty}</div>
                </div>
                <p class="blogs-oem-card-desc">${oem.description.slice(0, 130)}...</p>
                
                <div class="blogs-oem-card-footer">
                  <span>Explore Tech News &amp; Videos</span>
                  <i class="fa-solid fa-arrow-right"></i>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Latest Highlights across All OEMs -->
        <div style="margin-top:var(--space-12);padding-top:var(--space-8);border-top:1px solid var(--border-card);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-6);flex-wrap:wrap;gap:12px;">
            <div>
              <h2 style="font-size:1.45rem;font-weight:800;color:var(--text-white);margin:0;">
                Recent Technical News &amp; Product Announcements
              </h2>
            </div>
          </div>

          <div class="blogs-articles-grid">
            ${allArticles.slice(0, 6).map(art => `
              <div class="blog-article-card" data-article-id="${art.id}">
                <div class="blog-article-img-wrap">
                  <img src="${ContentService.resolveImg(art.image)}" alt="${art.title}" class="blog-article-img" loading="lazy" />
                  <span class="blog-article-cat-pill">${art.category}</span>
                </div>
                <div class="blog-article-body">
                  <div class="blog-article-meta">
                    <span style="color:${art.oemAccent};font-weight:700;"><i class="fa-solid fa-tag"></i> ${art.oemShort}</span>
                    <span>&bull;</span>
                    <span><i class="fa-regular fa-calendar"></i> ${art.date}</span>
                    <span>&bull;</span>
                    <span><i class="fa-regular fa-clock"></i> ${art.readTime}</span>
                  </div>
                  <h3 class="blog-article-title">${art.title}</h3>
                  <p class="blog-article-summary">${art.summary}</p>
                  
                  <div class="blog-article-tags">
                    ${art.tags.map(t => `<span class="blog-tag-pill">#${t}</span>`).join('')}
                  </div>

                  <button class="blog-article-btn read-article-trigger" data-art-id="${art.id}">
                    <span>Read Full Technical Release</span>
                    <i class="fa-solid fa-chevron-right" style="font-size:0.75rem;"></i>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Latest Videos Showcase across OEMs -->
        <div style="margin-top:var(--space-8);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-6);flex-wrap:wrap;gap:12px;">
            <div>
              <h2 style="font-size:1.45rem;font-weight:800;color:var(--text-white);margin:0;">
                Featured Engineering Video Releases
              </h2>
            </div>
          </div>

          <div class="blogs-videos-grid">
            ${allVideos.slice(0, 4).map(vid => `
              <div class="blog-video-card" data-video-id="${vid.id}">
                <div class="blog-video-thumb-wrap">
                  <img src="${vid.thumbnail}" alt="${vid.title}" class="blog-video-thumb" loading="lazy" />
                  <div class="blog-video-play-overlay">
                    <i class="fa-solid fa-play" style="margin-left:3px;"></i>
                  </div>
                  <span class="blog-video-dur-pill">${vid.duration}</span>
                </div>
                <div class="blog-video-body">
                  <div class="blog-video-speaker">
                    <i class="fa-solid fa-user-tie"></i> ${vid.speaker} (${vid.oemShort})
                  </div>
                  <h3 class="blog-video-title">${vid.title}</h3>
                  <p class="blog-video-summary">${vid.summary}</p>

                  <div class="blog-video-topics">
                    ${vid.topics.map(tp => `<span class="blog-topic-pill">${tp}</span>`).join('')}
                  </div>

                  <button class="blog-article-btn watch-video-trigger" data-vid-id="${vid.id}" style="background:rgba(225,29,72,0.12);border-color:rgba(225,29,72,0.3);color:var(--logo-red-light);">
                    <i class="fa-solid fa-play"></i>
                    <span>Watch Technical Session</span>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        </div>
      </div>
    </div>

    <!-- Article Reader Modal -->
    <div class="blog-modal-backdrop" id="blog-article-modal">
      <div class="blog-modal-dialog">
        <div class="blog-modal-header">
          <h3 id="modal-article-category">Technical Release</h3>
          <button class="blog-modal-close" id="close-article-modal" aria-label="Close article modal">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="blog-modal-body" id="modal-article-body">
          <!-- Dynamic article content -->
        </div>
        <div class="blog-modal-footer" id="modal-article-footer">
          <span style="font-size:0.8rem;color:var(--text-gray-400);">
            <i class="fa-solid fa-shield-check" style="color:var(--success);margin-right:5px;"></i> Official Technical Dispatch
          </span>
          <a class="btn-relay-blue" id="modal-article-rfq-link" href="#/contact?subject=technical">
            <i class="fa-solid fa-paper-plane"></i> Inquire on this Technology
          </a>
        </div>
      </div>
    </div>

    <!-- Video Player Modal -->
    <div class="blog-modal-backdrop" id="blog-video-modal">
      <div class="blog-modal-dialog">
        <div class="blog-modal-header">
          <h3 id="modal-video-title">Technical Demonstration</h3>
          <button class="blog-modal-close" id="close-video-modal" aria-label="Close video modal">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="blog-modal-body" id="modal-video-body">
          <!-- Dynamic video content -->
        </div>
        <div class="blog-modal-footer">
          <span style="font-size:0.8rem;color:var(--text-gray-400);" id="modal-video-speaker-tag">
            Technical Session
          </span>
          <button class="btn-relay-dark" id="modal-video-dismiss">Close Preview</button>
        </div>
      </div>
    </div>
  `;
}

function renderSingleOemBlogView(oem, blog, activeTab) {
  const articles = (blog.articles || []).filter(a => a.visible !== false);
  const videos = (blog.videos || []).filter(v => v.visible !== false);
  const whitepapers = (blog.whitepapers || []).filter(w => w.visible !== false);
  const totalContent = articles.length + videos.length + whitepapers.length;

  return `
    <div class="blogs-page-wrap" style="min-height:100vh;">
      <!-- Unified Page Hero Banner (Blue in light theme) -->
      <section class="page-hero-banner">
        <div class="container">
          <!-- Breadcrumb -->
          <nav class="breadcrumb-dark">
            <a data-route="/">Home</a>
            <span class="sep"><i class="fa-solid fa-chevron-right" style="font-size:0.7rem;"></i></span>
            <a data-route="/blogs">OEM Blogs &amp; Tech Hub</a>
            <span class="sep"><i class="fa-solid fa-chevron-right" style="font-size:0.7rem;"></i></span>
            <span class="crumb-current" style="color:var(--text-white);font-weight:600;">${oem.name}</span>
          </nav>

          <!-- Selected OEM Banner -->
          <div class="blogs-selected-header" style="border-top:3px solid ${oem.accentColor};margin-bottom:0;">
            <div class="blogs-selected-info">
              <div class="blogs-selected-logo-wrap">
                ${oem.logoImg ? `<img src="${ContentService.resolveImg(oem.logoImg)}" alt="${oem.name} Official Logo" class="oem-logo-img" loading="eager" />` : (oem.logoSvg || '')}
              </div>
              <div class="blogs-selected-text">
                <h2>${oem.name}</h2>
                <p>${blog.headline || oem.description}</p>
              </div>
            </div>

            <div class="blogs-selected-actions">
              <button class="btn-relay-dark" id="back-to-all-oems-btn">
                <i class="fa-solid fa-arrow-left"></i> All OEMs
              </button>
              <a class="btn-relay-blue" href="#/contact?subject=technical&oem=${encodeURIComponent(oem.name)}">
                <i class="fa-solid fa-paper-plane"></i> Technical Inquiry
              </a>
            </div>
          </div>
        </div>
      </section>

      <!-- Main Content Area -->
      <div class="page-main-body" style="padding-top:var(--space-8);padding-bottom:var(--space-20);">
        <div class="container">

          <!-- Content Type Filter Tabs -->
        <div class="blogs-content-tabs">
          <button class="blogs-tab-btn ${activeTab === 'all' ? 'active' : ''}" data-tab="all">
            <i class="fa-solid fa-border-all"></i> All Updates
            <span class="blogs-tab-badge">${totalContent}</span>
          </button>
          <button class="blogs-tab-btn ${activeTab === 'articles' ? 'active' : ''}" data-tab="articles">
            <i class="fa-solid fa-newspaper"></i> Technical News
            <span class="blogs-tab-badge">${articles.length}</span>
          </button>
          <button class="blogs-tab-btn ${activeTab === 'videos' ? 'active' : ''}" data-tab="videos">
            <i class="fa-solid fa-video"></i> Video Demonstrations
            <span class="blogs-tab-badge">${videos.length}</span>
          </button>
          <button class="blogs-tab-btn ${activeTab === 'whitepapers' ? 'active' : ''}" data-tab="whitepapers">
            <i class="fa-solid fa-file-pdf"></i> Whitepapers &amp; Notes
            <span class="blogs-tab-badge">${whitepapers.length}</span>
          </button>
        </div>

        <!-- 1. Technical News Section -->
        ${(activeTab === 'all' || activeTab === 'articles') && articles.length > 0 ? `
          <div style="margin-bottom:var(--space-10);">
            <div style="margin-bottom:var(--space-4);display:flex;align-items:center;gap:10px;">
              <h3 style="font-size:1.25rem;font-weight:800;color:var(--text-white);margin:0;">
                Technical News &amp; Product Releases from ${oem.shortName}
              </h3>
            </div>
            <div class="blogs-articles-grid">
              ${articles.map(art => `
                <div class="blog-article-card" data-article-id="${art.id}">
                  <div class="blog-article-img-wrap">
                    <img src="${ContentService.resolveImg(art.image)}" alt="${art.title}" class="blog-article-img" loading="lazy" />
                    <span class="blog-article-cat-pill">${art.category}</span>
                  </div>
                  <div class="blog-article-body">
                    <div class="blog-article-meta">
                      <span><i class="fa-regular fa-calendar"></i> ${art.date}</span>
                      <span>&bull;</span>
                      <span><i class="fa-regular fa-clock"></i> ${art.readTime}</span>
                    </div>
                    <h4 class="blog-article-title">${art.title}</h4>
                    <p class="blog-article-summary">${art.summary}</p>
                    
                    <div class="blog-article-tags">
                      ${art.tags.map(t => `<span class="blog-tag-pill">#${t}</span>`).join('')}
                    </div>

                    <button class="blog-article-btn read-article-trigger" data-art-id="${art.id}">
                      <span>Read Full Technical Release</span>
                      <i class="fa-solid fa-chevron-right" style="font-size:0.75rem;"></i>
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- 2. Videos Section -->
        ${(activeTab === 'all' || activeTab === 'videos') && videos.length > 0 ? `
          <div style="margin-bottom:var(--space-10);">
            <div style="margin-bottom:var(--space-4);display:flex;align-items:center;gap:10px;">
              <i class="fa-solid fa-circle-play" style="color:var(--logo-red);font-size:1.1rem;"></i>
              <h3 style="font-size:1.25rem;font-weight:800;color:var(--text-white);margin:0;">
                Demonstration Videos &amp; Technical Webinars
              </h3>
            </div>
            <div class="blogs-videos-grid">
              ${videos.map(vid => `
                <div class="blog-video-card" data-video-id="${vid.id}">
                  <div class="blog-video-thumb-wrap">
                    <img src="${vid.thumbnail}" alt="${vid.title}" class="blog-video-thumb" loading="lazy" />
                    <div class="blog-video-play-overlay">
                      <i class="fa-solid fa-play" style="margin-left:3px;"></i>
                    </div>
                    <span class="blog-video-dur-pill">${vid.duration}</span>
                  </div>
                  <div class="blog-video-body">
                    <div class="blog-video-speaker">
                      <i class="fa-solid fa-user-tie"></i> ${vid.speaker}
                    </div>
                    <h4 class="blog-video-title">${vid.title}</h4>
                    <p class="blog-video-summary">${vid.summary}</p>

                    <div class="blog-video-topics">
                      ${vid.topics.map(tp => `<span class="blog-topic-pill">${tp}</span>`).join('')}
                    </div>

                    <button class="blog-article-btn watch-video-trigger" data-vid-id="${vid.id}" style="background:rgba(225,29,72,0.12);border-color:rgba(225,29,72,0.3);color:var(--logo-red-light);">
                      <i class="fa-solid fa-play"></i>
                      <span>Watch Technical Session</span>
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- 3. Whitepapers Section -->
        ${(activeTab === 'all' || activeTab === 'whitepapers') && whitepapers.length > 0 ? `
          <div style="margin-bottom:var(--space-10);">
            <div style="margin-bottom:var(--space-4);display:flex;align-items:center;gap:10px;">
              <i class="fa-solid fa-file-lines" style="color:var(--logo-blue-light);font-size:1.1rem;"></i>
              <h3 style="font-size:1.25rem;font-weight:800;color:var(--text-white);margin:0;">
                Engineering Whitepapers &amp; Application Notes
              </h3>
            </div>
            <div class="blogs-whitepapers-grid">
              ${whitepapers.map(wp => `
                <div class="blog-whitepaper-card">
                  <div class="blog-whitepaper-top">
                    <span class="blog-whitepaper-badge">
                      <i class="fa-regular fa-file-pdf"></i> ${wp.pages}
                    </span>
                    <span class="blog-whitepaper-freq">${wp.frequencyBand}</span>
                  </div>
                  <h4 class="blog-whitepaper-title">${wp.title}</h4>
                  <div class="blog-whitepaper-author">
                    <i class="fa-solid fa-building"></i> ${wp.author} &bull; ${wp.date}
                  </div>
                  <p class="blog-whitepaper-summary">${wp.summary}</p>

                  <ul class="blog-key-findings">
                    ${wp.keyFindings.map(kf => `
                      <li><i class="fa-solid fa-check"></i> <span>${kf}</span></li>
                    `).join('')}
                  </ul>

                  <a class="btn-relay-border" href="#/contact?subject=technical&oem=${encodeURIComponent(oem.name)}" style="width:100%;justify-content:center;margin-top:auto;">
                    <i class="fa-solid fa-paper-plane"></i> Request Engineering Consultation
                  </a>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}



        <!-- Bottom OEM RFQ Box -->
        <div class="blogs-oem-rfq-box" style="background:rgba(255,255,255,0.02);border:1px solid var(--border-card);border-radius:var(--radius-xl);padding:24px 30px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;">
          <div>
            <h4 style="font-size:1.1rem;font-weight:800;color:var(--text-white);margin-bottom:4px;">
              Need Specific Components from ${oem.name}?
            </h4>
            <p style="font-size:0.85rem;color:var(--text-gray-400);margin:0;">
              Our Bengaluru application team provides official quotations, screening, and delivery estimates within 24 hours.
            </p>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <a class="btn-relay-dark" data-route="/products?level=categories&oem=${oem.id}">
              <i class="fa-solid fa-boxes-stacked"></i> Browse Catalog
            </a>
            <a class="btn-relay-blue" href="#/contact?subject=rfq&oem=${encodeURIComponent(oem.name)}">
              <i class="fa-solid fa-file-invoice"></i> Request Quote for ${oem.shortName}
            </a>
          </div>
        </div>

        </div>
      </div>
    </div>

    <!-- Article Reader Modal -->
    <div class="blog-modal-backdrop" id="blog-article-modal">
      <div class="blog-modal-dialog">
        <div class="blog-modal-header">
          <h3 id="modal-article-category">Technical Release</h3>
          <button class="blog-modal-close" id="close-article-modal" aria-label="Close article modal">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="blog-modal-body" id="modal-article-body"></div>
        <div class="blog-modal-footer">
          <span style="font-size:0.8rem;color:var(--text-gray-400);">
            <i class="fa-solid fa-shield-check" style="color:var(--success);margin-right:5px;"></i> Official Technical Bulletin
          </span>
          <a class="btn-relay-blue" id="modal-article-rfq-link" href="#/contact?subject=technical">
            <i class="fa-solid fa-paper-plane"></i> Inquire on this Technology
          </a>
        </div>
      </div>
    </div>

    <!-- Video Player Modal -->
    <div class="blog-modal-backdrop" id="blog-video-modal">
      <div class="blog-modal-dialog">
        <div class="blog-modal-header">
          <h3 id="modal-video-title">Technical Demonstration</h3>
          <button class="blog-modal-close" id="close-video-modal" aria-label="Close video modal">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="blog-modal-body" id="modal-video-body"></div>
        <div class="blog-modal-footer">
          <span style="font-size:0.8rem;color:var(--text-gray-400);" id="modal-video-speaker-tag">
            Technical Session
          </span>
          <button class="btn-relay-dark" id="modal-video-dismiss">Close Preview</button>
        </div>
      </div>
    </div>
  `;
}

export function initBlogsPage() {
  const hash = window.location.hash || '';
  const queryStr = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  const searchParams = new URLSearchParams(queryStr);
  const selectedOemId = searchParams.get('oem') || '';

  // OEM Card click in "All OEMs" grid
  document.querySelectorAll('.blogs-oem-card').forEach(card => {
    card.addEventListener('click', () => {
      const oemId = card.getAttribute('data-oem-id');
      if (oemId) {
        window.location.hash = `#/blogs?oem=${oemId}`;
      }
    });
  });

  // OEM chip in top selector
  document.querySelectorAll('[data-oem-select]').forEach(btn => {
    btn.addEventListener('click', () => {
      const oemId = btn.getAttribute('data-oem-select');
      if (oemId) {
        window.location.hash = `#/blogs?oem=${oemId}`;
      }
    });
  });

  // "All 15 OEMs" chip
  document.querySelector('.blogs-oem-chip[data-filter="all"]')?.addEventListener('click', () => {
    window.location.hash = '#/blogs';
  });

  // Back to All OEMs button in single OEM view
  document.getElementById('back-to-all-oems-btn')?.addEventListener('click', () => {
    window.location.hash = '#/blogs';
  });

  // Tab switching in single OEM view
  document.querySelectorAll('.blogs-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      if (selectedOemId && tab) {
        window.location.hash = `#/blogs?oem=${selectedOemId}&tab=${tab}`;
      }
    });
  });

  // Article Modal Logic
  const articleModal = document.getElementById('blog-article-modal');
  const closeArticleBtn = document.getElementById('close-article-modal');
  const modalCategory = document.getElementById('modal-article-category');
  const modalBody = document.getElementById('modal-article-body');
  const modalRfqLink = document.getElementById('modal-article-rfq-link');

  function openArticleModal(article) {
    if (!articleModal || !article) return;
    if (modalCategory) modalCategory.textContent = `${article.oemName || ''} · ${article.category}`;
    if (modalBody) {
      modalBody.innerHTML = `
        <div style="font-size:0.8rem;color:var(--text-gray-400);margin-bottom:12px;display:flex;align-items:center;gap:12px;">
          <span><i class="fa-regular fa-calendar"></i> ${article.date}</span>
          <span>&bull;</span>
          <span><i class="fa-regular fa-clock"></i> ${article.readTime}</span>
        </div>
        <h2 style="font-size:1.35rem;font-weight:800;color:var(--text-white);line-height:1.35;margin-bottom:16px;">
          ${article.title}
        </h2>
        <div style="border-radius:12px;overflow:hidden;margin-bottom:20px;max-height:240px;background:#090D16;">
          <img src="${ContentService.resolveImg(article.image)}" alt="${article.title}" style="width:100%;height:100%;object-fit:cover;" />
        </div>
        <div class="article-rich-text">
          ${article.content}
        </div>
        <div style="margin-top:20px;padding-top:14px;border-top:1px solid var(--border-card);display:flex;flex-wrap:wrap;gap:6px;">
          ${article.tags.map(t => `<span class="blog-tag-pill" style="font-size:0.75rem;padding:4px 10px;">#${t}</span>`).join('')}
        </div>
      `;
    }
    if (modalRfqLink) {
      modalRfqLink.href = `#/contact?subject=technical&oem=${encodeURIComponent(article.oemName || '')}&product=${encodeURIComponent(article.title)}`;
    }
    articleModal.classList.add('open');
  }

  document.querySelectorAll('.read-article-trigger').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const artId = btn.getAttribute('data-art-id');
      const allArts = getAllActiveArticles();
      const target = allArts.find(a => a.id === artId);
      if (target) {
        openArticleModal(target);
      }
    });
  });

  closeArticleBtn?.addEventListener('click', () => articleModal?.classList.remove('open'));
  articleModal?.addEventListener('click', (e) => {
    if (e.target === articleModal) articleModal.classList.remove('open');
  });

  // Video Modal Logic
  const videoModal = document.getElementById('blog-video-modal');
  const closeVideoBtn = document.getElementById('close-video-modal');
  const dismissVideoBtn = document.getElementById('modal-video-dismiss');
  const modalVideoTitle = document.getElementById('modal-video-title');
  const modalVideoBody = document.getElementById('modal-video-body');
  const modalVideoSpeakerTag = document.getElementById('modal-video-speaker-tag');

  function openVideoModal(video) {
    if (!videoModal || !video) return;
    if (modalVideoTitle) modalVideoTitle.textContent = video.title;
    if (modalVideoSpeakerTag) modalVideoSpeakerTag.textContent = `${video.speaker} (${video.oemName || 'OEM Lab'})`;
    if (modalVideoBody) {
      modalVideoBody.innerHTML = `
        <div style="position:relative;background:#000000;border-radius:12px;overflow:hidden;margin-bottom:20px;aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 40px rgba(0,0,0,0.8);">
          <img src="${video.thumbnail}" alt="${video.title}" style="width:100%;height:100%;object-fit:cover;opacity:0.6;" />
          <div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 60%,rgba(0,0,0,0.9) 100%);"></div>
          <div style="position:absolute;display:flex;flex-direction:column;align-items:center;gap:12px;color:var(--text-white);">
            <div style="width:68px;height:68px;border-radius:50%;background:rgba(225,29,72,0.9);display:flex;align-items:center;justify-content:center;font-size:1.6rem;box-shadow:0 12px 30px rgba(225,29,72,0.5);">
              <i class="fa-solid fa-play" style="margin-left:4px;"></i>
            </div>
            <span style="font-size:0.85rem;font-weight:700;letter-spacing:1px;background:rgba(0,0,0,0.7);padding:4px 12px;border-radius:4px;">
              Session Stream Ready · ${video.duration}
            </span>
          </div>
        </div>

        <div style="font-size:0.82rem;color:var(--logo-blue-light);font-weight:700;margin-bottom:6px;">
          <i class="fa-solid fa-microphone"></i> Presented by: ${video.speaker}
        </div>
        <p style="font-size:0.92rem;color:var(--text-gray-300);line-height:1.6;margin-bottom:16px;">
          ${video.summary}
        </p>

        <div style="background:rgba(255,255,255,0.03);padding:14px 18px;border-radius:8px;border:1px solid var(--border-card);margin-bottom:14px;">
          <strong style="font-size:0.85rem;color:var(--text-white);display:block;margin-bottom:8px;">
            Key Engineering Takeaways:
          </strong>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${(video.topics || []).map(tp => `<span class="blog-topic-pill" style="font-size:0.78rem;padding:4px 10px;"><i class="fa-solid fa-check" style="margin-right:4px;"></i>${tp}</span>`).join('')}
          </div>
        </div>
      `;
    }
    videoModal.classList.add('open');
  }

  document.querySelectorAll('.watch-video-trigger').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const vidId = btn.getAttribute('data-vid-id');
      const allVids = getAllActiveVideos();
      const target = allVids.find(v => v.id === vidId);
      if (target) {
        openVideoModal(target);
      }
    });
  });

  closeVideoBtn?.addEventListener('click', () => videoModal?.classList.remove('open'));
  dismissVideoBtn?.addEventListener('click', () => videoModal?.classList.remove('open'));
  videoModal?.addEventListener('click', (e) => {
    if (e.target === videoModal) videoModal.classList.remove('open');
  });
}
