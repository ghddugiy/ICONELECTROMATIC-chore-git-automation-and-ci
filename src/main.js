/**
 * Main Entry Point — ICON ELECTROMATIC
 */
import { registerRoute, initRouter, getCurrentPath, handleRoute } from './router.js';
import { renderHeader, renderHeaderInner, initHeader, closeSidebarDrawer, updateDrawerActiveState } from './components/Header.js';
import { renderFooter } from './components/Footer.js';
import { renderHomePage, initHomePage } from './pages/Home.js';
import { renderProductsPage, initProductsPage } from './pages/Products.js';
import { renderProductDetailPage, initProductDetailPage } from './pages/ProductDetail.js';
import { renderAboutPage, initAboutPage } from './pages/About.js';
import { renderServicesPage, initServicesPage } from './pages/Services.js';
import { renderPartnersPage, initPartnersPage } from './pages/Partners.js';
import { renderBlogsPage, initBlogsPage } from './pages/Blogs.js';
import { renderContactPage, initContactPage } from './pages/Contact.js';
import { renderChatbot, initChatbot } from './components/Chatbot.js';
import { initCustomCursor } from './components/CustomCursor.js';
import { renderAdminPage, initAdminPage } from './admin/Admin.js';
import { ImageStorage } from './data/ImageStorage.js';
import { SeoService } from './data/SeoService.js';
import { ContentService } from './data/ContentService.js';
import { renderSafely } from './rendering.js';

const app = document.getElementById('app');

function renderPage(renderContent, initFn) {
  const currentPath = getCurrentPath();
  let header = document.getElementById('site-header');

  if (!header) {
    header = document.createElement('header');
    header.className = 'site-header';
    header.id = 'site-header';
    document.body.insertBefore(header, app);
  }
  header.style.display = 'block';
  header.innerHTML = renderSafely(
    () => renderHeaderInner(currentPath),
    '',
    'site header'
  );
  renderSafely(initHeader, undefined, 'site header behavior');
  renderSafely(
    () => updateDrawerActiveState(currentPath),
    undefined,
    'navigation state'
  );

  // Always close mobile navigation drawer and sidebar drawer when a route loads
  const mainNav = document.getElementById('main-nav');
  const mobileToggle = document.getElementById('mobile-toggle');
  if (mainNav) mainNav.classList.remove('mobile-active');
  if (mobileToggle) {
    mobileToggle.classList.remove('active');
    mobileToggle.setAttribute('aria-expanded', 'false');
  }
  renderSafely(closeSidebarDrawer, undefined, 'navigation drawer');

  if (!currentPath.startsWith('/product/')) {
    renderSafely(
      () => SeoService.setDefaultSeo(currentPath),
      undefined,
      'page metadata'
    );
  }

  const content = renderSafely(
    renderContent,
    `<main class="page-content render-error" role="alert">
      <div class="container">
        <h1>This page could not be displayed</h1>
        <p>Please try again or return to the <a href="/" data-route="/">home page</a>.</p>
        <button type="button" onclick="window.location.reload()">Reload this page</button>
      </div>
    </main>`,
    `page ${currentPath}`
  );
  const footer = renderSafely(renderFooter, '', 'site footer');
  const chatbot = renderSafely(renderChatbot, '', 'chatbot');
  app.innerHTML = content + footer + renderBackToTop() + chatbot;
  renderSafely(initChatbot, undefined, 'chatbot behavior');
  if (initFn) renderSafely(initFn, undefined, 'page behavior');
  renderSafely(initBackToTop, undefined, 'back-to-top behavior');
  renderSafely(() => window.scrollTo({ top: 0 }), undefined, 'page scrolling');
}

function renderBackToTop() {
  return `<button class="back-to-top" id="back-to-top" aria-label="Back to top"><i class="fa-solid fa-arrow-up"></i></button>`;
}

function initBackToTop() {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 400);
  });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

registerRoute('/', () => renderPage(renderHomePage, initHomePage));
registerRoute('/products', () => renderPage(renderProductsPage, initProductsPage));
registerRoute('/product/:id', (params) => renderPage(() => renderProductDetailPage(params), () => initProductDetailPage(params)));
registerRoute('/about', () => renderPage(renderAboutPage, initAboutPage));
registerRoute('/services', () => renderPage(renderServicesPage, initServicesPage));
registerRoute('/partners', () => renderPage(renderPartnersPage, initPartnersPage));
registerRoute('/blogs', (params) => renderPage(() => renderBlogsPage(params), () => initBlogsPage(params)));
registerRoute('/blog', (params) => renderPage(() => renderBlogsPage(params), () => initBlogsPage(params)));
registerRoute('/contact', () => renderPage(renderContactPage, initContactPage));
registerRoute('/admin', () => {
  closeSidebarDrawer();
  const header = document.getElementById('site-header');
  if (header) header.style.display = 'none';
  SeoService.setDefaultSeo('/admin');
  const app = document.getElementById('app');
  app.innerHTML = renderAdminPage();
  initAdminPage();
});

// Listen for real-time CMS content updates to refresh layout and public page views
if (typeof window !== 'undefined') {
  window.addEventListener('cms-data-updated', (e) => {
    const pageKey = e.detail?.pageKey;
    const currentPath = getCurrentPath();

    // Never interrupt an active administrator session
    if (currentPath === '/admin' || currentPath.startsWith('/admin')) {
      return;
    }

    if (pageKey === 'header') {
      const header = document.getElementById('site-header');
      if (header && header.style.display !== 'none') {
        header.innerHTML = renderHeaderInner(currentPath);
        initHeader();
      }
      return;
    }

    if (pageKey === 'footer') {
      const footer = document.querySelector('.site-footer');
      if (footer) {
        footer.outerHTML = renderFooter();
      }
      return;
    }

    // Map content pageKey to active public route
    const pageRouteMap = {
      home: '/',
      about: '/about',
      services: '/services',
      contact: '/contact',
      partners: '/partners',
      blogs: '/blogs',
      projects: '/',
      gallery: '/',
      testimonials: '/',
    };

    const targetRoute = pageRouteMap[pageKey];
    if (
      targetRoute &&
      (currentPath === targetRoute || (pageKey === 'blogs' && currentPath === '/blog'))
    ) {
      handleRoute();
    }
  });
}

// Initialize components, preload all 12 CMS content modules, and start router
Promise.allSettled([
  ImageStorage.init(),
  ContentService.preload([
    'header', 'footer', 'home', 'about', 'services', 'contact',
    'partners', 'blogs', 'projects', 'gallery', 'testimonials', 'seo'
  ]),
]).finally(() => {
  initRouter();
  initCustomCursor();
});
