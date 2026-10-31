/**
 * Main Entry Point — ICON ELECTROMATIC
 */
import { registerRoute, initRouter, getCurrentPath } from './router.js';
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

const app = document.getElementById('app');

function renderPage(content, initFn) {
  const currentPath = getCurrentPath();
  let header = document.getElementById('site-header');

  if (!header) {
    header = document.createElement('header');
    header.className = 'site-header';
    header.id = 'site-header';
    document.body.insertBefore(header, app);
  }
  header.style.display = 'block';
  header.innerHTML = renderHeaderInner(currentPath);
  initHeader();
  updateDrawerActiveState(currentPath);

  // Always close mobile navigation drawer and sidebar drawer when a route loads
  const mainNav = document.getElementById('main-nav');
  const mobileToggle = document.getElementById('mobile-toggle');
  if (mainNav) mainNav.classList.remove('mobile-active');
  if (mobileToggle) {
    mobileToggle.classList.remove('active');
    mobileToggle.setAttribute('aria-expanded', 'false');
  }
  closeSidebarDrawer();

  if (!currentPath.startsWith('/product/')) {
    SeoService.setDefaultSeo(currentPath);
  }

  app.innerHTML = content + renderFooter() + renderBackToTop() + renderChatbot();
  initChatbot();
  if (initFn) initFn();
  initBackToTop();
  window.scrollTo({ top: 0 });
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

registerRoute('/', () => renderPage(renderHomePage(), initHomePage));
registerRoute('/products', () => renderPage(renderProductsPage(), initProductsPage));
registerRoute('/product/:id', (params) => renderPage(renderProductDetailPage(params), () => initProductDetailPage(params)));
registerRoute('/about', () => renderPage(renderAboutPage(), initAboutPage));
registerRoute('/services', () => renderPage(renderServicesPage(), initServicesPage));
registerRoute('/partners', () => renderPage(renderPartnersPage(), initPartnersPage));
registerRoute('/blogs', (params) => renderPage(renderBlogsPage(params), () => initBlogsPage(params)));
registerRoute('/blog', (params) => renderPage(renderBlogsPage(params), () => initBlogsPage(params)));
registerRoute('/contact', () => renderPage(renderContactPage(), initContactPage));
registerRoute('/admin', () => {
  closeSidebarDrawer();
  const header = document.getElementById('site-header');
  if (header) header.style.display = 'none';
  SeoService.setDefaultSeo('/admin');
  const app = document.getElementById('app');
  app.innerHTML = renderAdminPage();
  initAdminPage();
});

// Initialize router and components immediately
ImageStorage.init().finally(() => {
  initRouter();
  initCustomCursor();
});
