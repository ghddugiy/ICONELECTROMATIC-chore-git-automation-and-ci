/**
 * Header Component — ICON ELECTROMATIC
 * Sleek Minimalist Header with Hamburger Menu & Slide-in Sidebar Drawer
 */
import { getCurrentPath, navigate } from '../router.js';
import { ContentService } from '../data/ContentService.js';
import './sidebar-drawer.css';

const DRAWER_LINKS = [
  { path: '/', label: 'Home', icon: 'fa-solid fa-house' },
  { path: '/about', label: 'About Us', icon: 'fa-solid fa-building' },
  { path: '/partners', label: 'Partners', icon: 'fa-solid fa-handshake' },
  { path: '/products', label: 'Products', icon: 'fa-solid fa-microchip' },
  { path: '/services', label: 'Services', icon: 'fa-solid fa-gear' },
  { path: '/blogs', label: 'Blogs', icon: 'fa-solid fa-newspaper' },
  { path: '/contact', label: 'Contact', icon: 'fa-solid fa-envelope' },
];

export function renderHeaderInner(currentRoute) {
  const route = currentRoute || getCurrentPath();

  const data = ContentService.getData('header');
  const ctaText = data.ctaLabel || data.ctaText || 'Request Quote';
  const ctaLink = data.ctaLink || '/contact';

  const navLinks = [
    { path: '/', label: data.navHome || 'Home' },
    { path: '/about', label: data.navAbout || 'About Us' },
    { path: '/partners', label: data.navPartners || 'Partners' },
    { path: '/products', label: data.navProducts || 'Products' },
    { path: '/services', label: data.navServices || 'Services' },
    { path: '/blogs', label: data.navBlogs || 'Blogs' },
    { path: '/contact', label: data.navContact || 'Contact' },
  ];

  const isLight = typeof window !== 'undefined' && (
    new URLSearchParams(window.location.search).get('theme') === 'light' ||
    localStorage.getItem('icon-theme') === 'light' ||
    document.documentElement.getAttribute('data-theme') === 'light'
  );

  const logoSrc = ContentService.resolveImg(
    isLight ? '/lighter-version-logo.png' : '/darker-version-logo.png'
  );

  return `
    <div class="header-inner">
      <div class="header-left-cluster">
        <button class="header-sidebar-toggle" id="header-sidebar-toggle" aria-label="Open navigation sidebar" aria-expanded="false" title="Menu">
          <span class="sidebar-bar"></span>
          <span class="sidebar-bar"></span>
          <span class="sidebar-bar"></span>
        </button>

        <a href="/" class="logo-container" data-route="/" title="ICON ELECTROMATIC Home">
          <img src="${logoSrc}" alt="ICON ELECTROMATIC" class="site-header-logo-img" />
        </a>
      </div>

      <nav class="main-nav" id="main-nav">
        ${navLinks.map(link => `
          <a href="${link.path}" class="nav-link ${route === link.path ? 'active' : ''}" data-route="${link.path}">
            ${link.label}
          </a>
        `).join('')}
        <div class="mobile-nav-cta">
          <a href="${ctaLink}" class="btn-relay-red mobile-drawer-cta" data-route="${ctaLink}">
            ${ctaText} <i class="fa-solid fa-arrow-right"></i>
          </a>
        </div>
      </nav>

      <div class="header-actions">
        <a href="${ctaLink}" class="btn-relay-border" data-route="${ctaLink}">
          ${ctaText}
        </a>
        <button class="theme-toggle-btn theme-toggle-switch ${isLight ? 'is-light' : ''}" id="theme-toggle-btn" role="switch" aria-checked="${isLight ? 'true' : 'false'}" aria-label="Toggle dark and light theme" title="${isLight ? 'Switch to Darker Version' : 'Switch to Lighter Version'}">
          <span class="theme-switch-track">
            <span class="theme-switch-icon theme-switch-moon" title="Darker Version">
              <i class="fa-solid fa-moon"></i>
            </span>
            <span class="theme-switch-icon theme-switch-sun" title="Lighter Version">
              <i class="fa-solid fa-sun"></i>
            </span>
            <span class="theme-switch-thumb">
              <i class="fa-solid ${isLight ? 'fa-sun' : 'fa-moon'}" id="theme-toggle-icon"></i>
            </span>
          </span>
        </button>
      </div>

      <button class="mobile-toggle" id="mobile-toggle" aria-label="Toggle navigation" style="display:none;">
        <span></span>
        <span></span>
        <span></span>
      </button>
    </div>
  `;
}

export function renderHeader() {
  return `
    <header class="site-header" id="site-header">
      ${renderHeaderInner()}
    </header>
  `;
}

/**
 * Renders HTML for the slide-in sidebar drawer and overlay.
 * Mounted directly to document.body to avoid CSS transform containing blocks.
 */
function renderSidebarDrawerHTML(currentRoute) {
  const route = currentRoute || getCurrentPath();
  const data = ContentService.getData('header') || {};
  const isLight = typeof window !== 'undefined' && (
    new URLSearchParams(window.location.search).get('theme') === 'light' ||
    localStorage.getItem('icon-theme') === 'light' ||
    document.documentElement.getAttribute('data-theme') === 'light'
  );
  const logoSrc = ContentService.resolveImg(
    isLight ? '/lighter-version-logo.png' : '/darker-version-logo.png'
  );
  const ctaText = data.ctaLabel || data.ctaText || 'Request Quote';
  const ctaLink = data.ctaLink || '/contact';

  const drawerLinks = [
    { path: '/', label: data.navHome || 'Home', icon: 'fa-solid fa-house' },
    { path: '/about', label: data.navAbout || 'About Us', icon: 'fa-solid fa-building' },
    { path: '/partners', label: data.navPartners || 'Partners', icon: 'fa-solid fa-handshake' },
    { path: '/products', label: data.navProducts || 'Products', icon: 'fa-solid fa-microchip' },
    { path: '/services', label: data.navServices || 'Services', icon: 'fa-solid fa-gear' },
    { path: '/blogs', label: data.navBlogs || 'Blogs', icon: 'fa-solid fa-newspaper' },
    { path: '/contact', label: data.navContact || 'Contact', icon: 'fa-solid fa-envelope' },
  ];

  return `
    <div class="sidebar-drawer-overlay" id="sidebar-drawer-overlay" aria-hidden="true"></div>
    <aside class="sidebar-drawer" id="sidebar-drawer" aria-label="Quick Navigation Sidebar" aria-hidden="true">
      <div class="drawer-header">
        <a href="/" class="drawer-logo" data-route="/" title="ICON ELECTROMATIC Home" style="background: transparent !important; border: none !important; box-shadow: none !important; padding: 4px 0 !important; display: inline-flex !important; align-items: center !important;">
          <img src="${logoSrc}" alt="ICON ELECTROMATIC" style="height: 34px; max-height: 34px; width: auto; object-fit: contain; display: block;" />
        </a>
        <button class="drawer-close-btn" id="drawer-close-btn" aria-label="Close navigation sidebar" title="Close">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="drawer-body">
        ${drawerLinks.map(link => `
          <a href="${link.path}" class="drawer-nav-item ${route === link.path ? 'active' : ''}" data-route="${link.path}">
            <div class="drawer-nav-item-content">
              <span class="drawer-icon"><i class="${link.icon}"></i></span>
              <span>${link.label}</span>
            </div>
            <i class="fa-solid fa-chevron-right drawer-chevron"></i>
          </a>
        `).join('')}

        <div class="drawer-divider"></div>

        <a href="/admin" class="drawer-nav-item drawer-employee-item ${route === '/admin' ? 'active' : ''}" data-route="/admin" id="drawer-employee-zone-link" title="Open Employee Zone Admin Panel">
          <div class="drawer-nav-item-content">
            <span class="drawer-icon employee-icon"><i class="fa-solid fa-id-badge"></i></span>
            <span class="drawer-item-title" style="font-weight: 600;">Employee Zone</span>
          </div>
          <span class="drawer-employee-badge"><i class="fa-solid fa-shield-halved"></i> Admin</span>
        </a>
      </div>

      <div class="drawer-footer">
        <a href="${ctaLink}" class="btn-relay-red drawer-footer-cta" data-route="${ctaLink}">
          ${ctaText} <i class="fa-solid fa-arrow-right"></i>
        </a>
      </div>
    </aside>
  `;
}

/**
 * Open the sidebar drawer
 */
export function openSidebarDrawer() {
  const drawer = document.getElementById('sidebar-drawer');
  const overlay = document.getElementById('sidebar-drawer-overlay');
  const toggleBtn = document.getElementById('header-sidebar-toggle');

  if (drawer && overlay) {
    // Sync logo with active theme
    const isLight = document.documentElement.getAttribute('data-theme') === 'light' ||
      localStorage.getItem('icon-theme') === 'light';
    const drawerLogoImg = drawer.querySelector('.drawer-logo img');
    if (drawerLogoImg) {
      drawerLogoImg.src = isLight ? '/lighter-version-logo.png' : '/darker-version-logo.png';
    }

    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('sidebar-drawer-open');
    if (toggleBtn) {
      toggleBtn.classList.add('active');
      toggleBtn.setAttribute('aria-expanded', 'true');
    }
  }
}

/**
 * Close the sidebar drawer
 */
export function closeSidebarDrawer() {
  const drawer = document.getElementById('sidebar-drawer');
  const overlay = document.getElementById('sidebar-drawer-overlay');
  const toggleBtn = document.getElementById('header-sidebar-toggle');

  if (drawer && overlay) {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('sidebar-drawer-open');
    if (toggleBtn) {
      toggleBtn.classList.remove('active');
      toggleBtn.setAttribute('aria-expanded', 'false');
    }
  }
}

/**
 * Update active highlight on drawer items
 */
export function updateDrawerActiveState(currentRoute) {
  const route = currentRoute || getCurrentPath();
  const drawerItems = document.querySelectorAll('.sidebar-drawer .drawer-nav-item');
  drawerItems.forEach(item => {
    const itemRoute = item.getAttribute('data-route') || item.getAttribute('href')?.replace(/^#/, '');
    item.classList.toggle('active', itemRoute === route);
  });
}

/**
 * Mount and bind the sidebar drawer to document.body
 */
function ensureSidebarDrawerMounted() {
  let drawerRoot = document.getElementById('sidebar-drawer-root');
  if (!drawerRoot) {
    drawerRoot = document.createElement('div');
    drawerRoot.id = 'sidebar-drawer-root';
    drawerRoot.innerHTML = renderSidebarDrawerHTML(getCurrentPath());
    document.body.appendChild(drawerRoot);

    // Bind Close Button
    const closeBtn = document.getElementById('drawer-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        closeSidebarDrawer();
      });
    }

    // Bind Overlay click
    const overlay = document.getElementById('sidebar-drawer-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => {
        closeSidebarDrawer();
      });
    }

    // Bind Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const drawer = document.getElementById('sidebar-drawer');
        if (drawer && drawer.classList.contains('open')) {
          closeSidebarDrawer();
        }
      }
    });

    // Bind Navigation links in drawer
    const drawerLinks = drawerRoot.querySelectorAll('a[data-route]');
    drawerLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetRoute = link.getAttribute('data-route') || link.getAttribute('href')?.replace(/^#/, '');
        closeSidebarDrawer();
        if (targetRoute) {
          navigate(targetRoute);
        }
      });
    });
  } else {
    updateDrawerActiveState(getCurrentPath());
  }
}

export function initHeader() {
  const header = document.getElementById('site-header');
  if (header) {
    const handleScroll = () => {
      header.classList.toggle('scrolled', window.scrollY > 15);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    if (window.location.hash.includes('scroll=')) {
      const match = window.location.hash.match(/scroll=(\d+)/);
      if (match) {
        setTimeout(() => {
          window.scrollTo(0, parseInt(match[1], 10));
          handleScroll();
        }, 150);
      }
    }
  }

  // Ensure sidebar drawer is mounted and bound
  ensureSidebarDrawerMounted();

  // Desktop/Universal Hamburger Menu Button click listener
  const hamburgerToggle = document.getElementById('header-sidebar-toggle');
  if (hamburgerToggle) {
    hamburgerToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const drawer = document.getElementById('sidebar-drawer');
      if (drawer && drawer.classList.contains('open')) {
        closeSidebarDrawer();
      } else {
        openSidebarDrawer();
      }
    });
  }

  // Mobile menu toggle & link navigation
  const mobileToggle = document.getElementById('mobile-toggle');
  const mainNav = document.getElementById('main-nav');
  if (mobileToggle && mainNav) {
    mobileToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = mainNav.classList.toggle('mobile-active');
      mobileToggle.classList.toggle('active', isOpen);
      mobileToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    mainNav.querySelectorAll('.nav-link, .mobile-drawer-cta').forEach(link => {
      link.addEventListener('click', (e) => {
        const targetRoute = link.getAttribute('data-route') || link.getAttribute('href')?.replace(/^#/, '');
        if (targetRoute) {
          navigate(targetRoute);
        }
        mainNav.classList.remove('mobile-active');
        mobileToggle.classList.remove('active');
        mobileToggle.setAttribute('aria-expanded', 'false');
      });
    });

    document.addEventListener('click', (e) => {
      if (mainNav.classList.contains('mobile-active') && !mainNav.contains(e.target) && !mobileToggle.contains(e.target)) {
        mainNav.classList.remove('mobile-active');
        mobileToggle.classList.remove('active');
        mobileToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Theme toggle — persist to localStorage (supports ?theme=light URL override)
  const toggleBtn = document.getElementById('theme-toggle-btn');
  const toggleIcon = document.getElementById('theme-toggle-icon');
  const urlTheme = new URLSearchParams(window.location.search).get('theme');
  const savedTheme = urlTheme || localStorage.getItem('icon-theme') || 'dark';

  const updateThemeUI = (theme) => {
    const isLight = theme === 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('icon-theme', theme);

    if (toggleBtn) {
      toggleBtn.classList.toggle('is-light', isLight);
      toggleBtn.setAttribute('aria-checked', isLight ? 'true' : 'false');
      toggleBtn.setAttribute('title', isLight ? 'Switch to Darker Version' : 'Switch to Lighter Version');
    }
    if (toggleIcon) {
      toggleIcon.className = isLight ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }

    // Dynamic logo switch for both lighter and darker versions
    const activeLogo = isLight ? '/lighter-version-logo.png' : '/darker-version-logo.png';
    document.querySelectorAll('.logo-container img, .drawer-logo img, .footer-logo-link img').forEach(img => {
      img.src = activeLogo;
    });
  };

  updateThemeUI(savedTheme);

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      updateThemeUI(isLight ? 'dark' : 'light');
      // Ensure hero video keeps playing smoothly
      const heroVid = document.getElementById('hero-bg-video');
      if (heroVid) {
        heroVid.muted = true;
        heroVid.play().catch(() => {});
      }
    });
  }
}

