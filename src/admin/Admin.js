import './admin.css';
import { ContentService } from '../data/ContentService.js';
import { ImageStorage } from '../data/ImageStorage.js';
import { CATALOG } from '../data/catalogData.js';
import { ApiService } from '../data/ApiService.js';
import { CatalogService } from '../data/CatalogService.js';

// ─── State ─────────────────────────────────────────────────────────────────
let isAuthenticated = false;
let sessionCheckStarted = false;
let loginError = '';
let catalogLoadError = '';
let catalogSaving = false;
let currentTab = 'dashboard';
let currentSubTab = 'fields'; // for pages with subtabs (fields vs cards)

// ─── Enquiries Management State ─────────────────────────────────────────────
let enquiriesData = { items: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 1 } };
let enquiriesStats = { total: 0, byStatus: {}, byRegion: {} };
let enquiriesStaff = [];
let enquiriesFilter = { search: '', region: '', workflowStatus: '', assignedToId: '', page: 1, limit: 25 };
let enquiriesLoading = false;

// ─── Sidebar navigation config ──────────────────────────────────────────────
const NAV = [
  { section: 'OVERVIEW' },
  { id: 'dashboard',    icon: 'fa-solid fa-gauge',           label: 'Dashboard' },
  { id: 'enquiries',    icon: 'fa-solid fa-inbox',           label: 'Enquiries & RFQ' },
  { section: 'PAGES' },
  { id: 'home',         icon: 'fa-solid fa-house',           label: 'Home Page' },
  { id: 'about',        icon: 'fa-solid fa-building',        label: 'About Us' },
  { id: 'services',     icon: 'fa-solid fa-gear',            label: 'Services' },
  { id: 'projects',     icon: 'fa-solid fa-diagram-project', label: 'Projects' },
  { id: 'gallery',      icon: 'fa-solid fa-images',          label: 'Gallery' },
  { id: 'testimonials', icon: 'fa-solid fa-comments',        label: 'Testimonials' },
  { id: 'contact',      icon: 'fa-solid fa-phone',           label: 'Contact' },
  { section: 'CONTENT' },
  { id: 'products',     icon: 'fa-solid fa-microchip',       label: 'Products / OEMs' },
  { id: 'partners',     icon: 'fa-solid fa-handshake',       label: 'Partners' },
  { id: 'blogs',        icon: 'fa-solid fa-newspaper',       label: 'Blogs' },
  { section: 'GLOBAL' },
  { id: 'header',       icon: 'fa-solid fa-bars',            label: 'Header & Nav' },
  { id: 'footer',       icon: 'fa-solid fa-shoe-prints',     label: 'Footer & Offices' },
  { id: 'seo',          icon: 'fa-solid fa-magnifying-glass',label: 'SEO Settings' },
];

// ─── Entry Points ────────────────────────────────────────────────────────────
export function renderAdminPage() {
  if (!isAuthenticated) return renderLogin();
  return renderShell();
}

export function initAdminPage() {
  if (isAuthenticated) return bindShell();

  bindLoginForm();
  if (sessionCheckStarted) return;
  sessionCheckStarted = true;
  ApiService.getSession()
    .then(async (admin) => {
      if (!admin) {
        isAuthenticated = false;
        return;
      }
      isAuthenticated = true;
      await loadAdminCatalog();
      try {
        enquiriesStats = await ApiService.getAdminEnquiryStats();
      } catch { /* non-blocking */ }

      if (currentTab === 'enquiries') {
        await loadEnquiriesTabContent();
      }
      const contentKeys = [
        'home', 'about', 'services', 'contact', 'header', 'footer',
        'partners', 'blogs', 'projects', 'gallery', 'testimonials', 'seo'
      ];
      if (contentKeys.includes(currentTab)) {
        await ContentService.loadAdminContent(currentTab);
      }
      rerender();
    })
    .catch((error) => {
      if (error?.status !== 401) setLoginError(error?.message || 'Unable to verify session.');
    });
}

// ─── Login ───────────────────────────────────────────────────────────────────
function renderLogin() {
  return `
    <div class="a-login-page">
      <div class="a-login-box">
        <div class="a-login-logo">
          <img src="/icon-logo-transparent.png" alt="Icon Electromatic" onerror="this.style.display='none'">
        </div>
        <h2>Admin CMS</h2>
        <p>Icon Electromatic Content Portal</p>
        <form class="a-login-form" id="a-login-form">
          <div class="a-field">
            <label>Email</label>
            <input class="a-input" type="email" id="a-email" autocomplete="username" required>
          </div>
          <div class="a-field">
            <label>Password</label>
            <input class="a-input" type="password" id="a-password" autocomplete="current-password" required>
          </div>
          <button type="submit" class="a-btn a-btn-primary">Sign In <i class="fa-solid fa-arrow-right"></i></button>
        </form>
        <p class="a-login-error" id="a-login-error" role="alert">${loginError}</p>
        <div style="margin-top: 16px; text-align: center;">
          <a href="#/" class="a-btn a-btn-outline a-btn-sm" style="display: inline-flex; align-items: center; gap: 8px; text-decoration: none;">
            <i class="fa-solid fa-arrow-left"></i> Return to Website
          </a>
        </div>
      </div>
    </div>
  `;
}

function bindLoginForm() {
  document.getElementById('a-login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const email = document.getElementById('a-email').value.trim();
    const password = document.getElementById('a-password').value;
    button.disabled = true;
    setLoginError('');
    try {
      await ApiService.login(email, password);
      isAuthenticated = true;
      sessionCheckStarted = true;
      await loadAdminCatalog();
      rerender();
    } catch (error) {
      setLoginError(error.message);
      button.disabled = false;
    }
  });
}

function setLoginError(message) {
  loginError = message;
  const error = document.getElementById('a-login-error');
  if (error) error.textContent = message;
}

async function loadAdminCatalog() {
  catalogLoadError = '';
  try {
    await CatalogService.loadAdminCatalog();
  } catch (error) {
    catalogLoadError = error.message;
    if (error.status === 401) {
      isAuthenticated = false;
      loginError = 'Your session expired. Sign in again to continue.';
    }
  }
}

function getCatalogData() {
  return CatalogService.getAdminCatalog();
}

async function persistCatalog(nextCatalog, successMessage) {
  if (catalogSaving) return false;
  catalogSaving = true;
  try {
    await CatalogService.saveAdminCatalog(nextCatalog);
    catalogLoadError = '';
    catalogSaving = false;
    rerender();
    showToast(successMessage, 'success');
    return true;
  } catch (error) {
    catalogSaving = false;
    if (error.status === 401) {
      isAuthenticated = false;
      sessionCheckStarted = true;
      loginError = 'Your session expired. Sign in again to continue.';
      rerender();
      return false;
    }
    catalogLoadError = error.message;
    rerender();
    showToast(`Save failed: ${error.message}`, 'error');
    return false;
  }
}

// ─── Shell ───────────────────────────────────────────────────────────────────
function renderShell() {
  const sidebarItems = NAV.map(item => {
    if (item.section) {
      return `<div class="a-nav-section">${item.section}</div>`;
    }
    const isEnquiry = item.id === 'enquiries';
    const newCount = (isEnquiry && enquiriesStats?.byStatus?.NEW) ? enquiriesStats.byStatus.NEW : 0;
    const badgeHtml = newCount > 0 ? `<span class="a-badge" style="margin-left:auto;font-size:0.7rem;padding:2px 7px;border-radius:9999px;background:#ef4444;color:#fff;font-weight:700;">${newCount}</span>` : '';
    return `
      <button class="a-nav-item ${currentTab === item.id ? 'active' : ''}" data-tab="${item.id}" style="${isEnquiry ? 'display:flex;align-items:center;' : ''}">
        <i class="${item.icon}"></i> <span style="flex:1;text-align:left;">${item.label}</span> ${badgeHtml}
      </button>`;
  }).join('');

  const tab = NAV.find(n => n.id === currentTab);
  const pageTitle = tab ? tab.label : 'Dashboard';

  return `
    <div class="admin-wrap">
      <aside class="a-sidebar">
        <div class="a-sidebar-brand">
          <h1>ICON Admin</h1>
          <small>Universal CMS Portal</small>
        </div>
        <nav class="a-nav">${sidebarItems}</nav>
      </aside>

      <div class="a-main">
        <div class="a-topbar">
          <div class="a-topbar-left">
            <h2>${pageTitle}</h2>
            <p>Backend catalog CMS with local image previews</p>
          </div>
          <div class="a-topbar-right">
            <a href="#/" class="a-btn a-btn-outline a-btn-sm" style="text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-globe"></i> View Site
            </a>
            <button class="a-btn a-btn-outline a-btn-sm" id="a-reset-btn" title="Reset this section to authentic default data">
              <i class="fa-solid fa-rotate-left"></i> Reset Defaults
            </button>
            <button class="a-btn a-btn-danger a-btn-sm" id="a-logout-btn">
              Logout <i class="fa-solid fa-arrow-right-from-bracket"></i>
            </button>
          </div>
        </div>

        <div class="a-content">
          <div class="a-notice">
            <i class="fa-solid fa-circle-check"></i>
            <span><strong>CMS connected:</strong> Catalog edits are saved by the backend. Existing browser content and IndexedDB images remain preserved.</span>
          </div>
          ${renderTabContent()}
        </div>
      </div>
    </div>

    <!-- Universal Modal Container -->
    <div id="a-modal-container"></div>
  `;
}

function renderLoadingTabState(tabName) {
  const contentEl = document.querySelector('.a-content');
  if (contentEl) {
    contentEl.innerHTML = `
      <div style="padding:48px 24px;text-align:center;color:#64748b;">
        <i class="fa-solid fa-spinner fa-spin" style="font-size:28px;color:#2563eb;margin-bottom:12px;"></i>
        <p style="font-size:14px;font-weight:500;">Loading latest content for <strong>${tabName}</strong> from PostgreSQL...</p>
      </div>
    `;
  }
}

function bindShell() {
  // Navigation with authoritative database content loading
  document.querySelectorAll('.a-nav-item[data-tab]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const targetTab = btn.getAttribute('data-tab');
      currentTab = targetTab;
      currentSubTab = 'fields';

      const contentKeys = [
        'home', 'about', 'services', 'contact', 'header', 'footer',
        'partners', 'blogs', 'projects', 'gallery', 'testimonials', 'seo'
      ];

      if (contentKeys.includes(targetTab)) {
        renderLoadingTabState(targetTab);
        try {
          const res = await ContentService.loadAdminContent(targetTab);
          if (res && res.error) {
            showToast(`Notice: Live database load failed (${res.error}). Displaying local copy.`, 'info');
          }
        } catch (err) {
          showToast(`Database load notice: ${err.message}`, 'info');
        }
      }

      if (targetTab === 'enquiries') {
        renderLoadingTabState('enquiries');
        await loadEnquiriesTabContent();
      }

      rerender();
    });
  });

  // Logout
  document.getElementById('a-logout-btn')?.addEventListener('click', async () => {
    try {
      await ApiService.logout();
      isAuthenticated = false;
      sessionCheckStarted = false;
      rerender();
    } catch (error) {
      if (error.status === 401) {
        isAuthenticated = false;
        loginError = 'Your session expired. Sign in again to continue.';
        sessionCheckStarted = true;
        rerender();
        return;
      }
      showToast(`Logout failed: ${error.message}`, 'error');
    }
  });

  // Reset section
  document.getElementById('a-reset-btn')?.addEventListener('click', () => {
    if (currentTab === 'products') {
      showToast('Catalog reset is disabled to protect existing data.', 'error');
      return;
    }
    if (confirm(`Reset "${currentTab}" to default authentic content? All custom edits in this section will be replaced with defaults.`)) {
      ContentService.resetData(currentTab);
      rerender();
      showToast('Section reset to authentic defaults.', 'success');
    }
  });

  // Bind active tab specific events & image widgets
  bindTabEvents();
}

function rerender() {
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = renderAdminPage();
    initAdminPage();
  }
}

function showToast(msg, type = '') {
  const existing = document.getElementById('a-toast');
  if (existing) existing.remove();

  const t = document.createElement('div');
  t.id = 'a-toast';
  t.className = `a-toast ${type}`;
  const icon = type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check';
  t.innerHTML = `<i class="fa-solid ${icon}"></i> ${msg}`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>'"]/g, (tag) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[tag] || tag));
}

// ─── Universal Image Upload Widget ───────────────────────────────────────────
export function renderImageUploadField(fieldName, label, currentValue, ctxText = '') {
  const resolved = ImageStorage.resolveImageUrl(currentValue);
  const hasImg = Boolean(currentValue);

  return `
    <div class="a-field span2 a-image-widget" data-field="${fieldName}">
      <label class="a-label">${label} <span class="a-label-ctx">${ctxText}</span></label>
      <div class="a-img-uploader">
        <div class="a-img-thumb-box" id="thumb-box-${fieldName}">
          ${hasImg
            ? `<img src="${resolved}" class="a-thumb-img" id="thumb-img-${fieldName}" alt="Preview" />`
            : `<div class="a-thumb-empty" id="thumb-empty-${fieldName}"><i class="fa-solid fa-image"></i><span>No image</span></div>`}
        </div>
        <div class="a-img-actions">
          <input type="hidden" name="${fieldName}" id="hidden-${fieldName}" value="${currentValue || ''}" />
          <div class="a-img-btn-row">
            <label class="a-btn a-btn-sm a-btn-primary a-upload-btn">
              <i class="fa-solid fa-cloud-arrow-up"></i> <span id="upload-txt-${fieldName}">${hasImg ? 'Replace Image' : 'Upload Image'}</span>
              <input type="file" accept="image/*" class="a-file-input" data-target="${fieldName}" style="display:none;" />
            </label>
            <button type="button" class="a-btn a-btn-sm a-btn-danger a-img-delete-btn" data-target="${fieldName}" id="del-btn-${fieldName}" style="${hasImg ? '' : 'display:none;'}">
              <i class="fa-solid fa-xmark"></i> Clear image
            </button>
          </div>
          <div class="a-img-url-row">
            <input type="text" class="a-input a-input-sm a-img-url-input" data-target="${fieldName}" placeholder="Or paste asset path (/images/...) or URL" value="${currentValue || ''}" />
          </div>
        </div>
      </div>
    </div>
  `;
}

function bindImageWidgets(container = document) {
  // File upload input change
  container.querySelectorAll('.a-file-input').forEach(input => {
    input.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const fieldName = input.getAttribute('data-target') || 'image';
      const uploadTxt = container.querySelector(`#upload-txt-${fieldName}`);
      const prevTxt = uploadTxt ? uploadTxt.textContent : 'Upload Image';
      if (uploadTxt) uploadTxt.textContent = 'Uploading to R2...';
      showToast('Uploading image to Cloudflare R2...', '');

      try {
        const folder = fieldName.toLowerCase().includes('logo') ? 'oem-logos' : 'products';
        const media = await ApiService.uploadMedia(file, folder);

        // Permanent URL reference
        const permanentUrl = media.publicUrl || `/api/media/file/${media.id}`;
        const previewUrl = media.previewUrl || permanentUrl;

        // Cache preview URL in ImageStorage for immediate rendering
        ImageStorage.setCachedUrl(permanentUrl, previewUrl);
        if (media.r2Key) {
          ImageStorage.setCachedUrl(media.r2Key, previewUrl);
        }

        // Update hidden input & text input
        const hiddenInput = container.querySelector(`#hidden-${fieldName}`) || container.querySelector(`input[name="${fieldName}"]`);
        if (hiddenInput) hiddenInput.value = permanentUrl;

        const urlInput = container.querySelector(`.a-img-url-input[data-target="${fieldName}"]`);
        if (urlInput) urlInput.value = permanentUrl;

        // Update thumbnail preview
        const thumbBox = container.querySelector(`#thumb-box-${fieldName}`) || container.querySelector(`.a-image-widget[data-field="${fieldName}"] .a-img-thumb-box`);
        if (thumbBox) {
          thumbBox.innerHTML = `<img src="${previewUrl}" class="a-thumb-img" alt="Preview" />`;
        }

        // Show delete button and update button label
        const delBtn = container.querySelector(`#del-btn-${fieldName}`) || container.querySelector(`.a-img-delete-btn[data-target="${fieldName}"]`);
        if (delBtn) delBtn.style.display = 'inline-flex';

        if (uploadTxt) uploadTxt.textContent = 'Replace Image';
        showToast('Image uploaded and stored in Cloudflare R2!', 'success');
      } catch (err) {
        console.error('Cloudflare R2 upload failed:', err);
        if (uploadTxt) uploadTxt.textContent = prevTxt;
        showToast(`R2 upload failed: ${err.message}`, 'error');

        // Explicit fallback confirmation: never silently fall back
        const fallback = confirm(
          `Cloudflare R2 upload failed: ${err.message}\n\nWould you like to save this image locally in your browser storage (IndexedDB) instead?`
        );
        if (fallback) {
          try {
            showToast('Saving image locally in IndexedDB...', '');
            const imgId = await ImageStorage.saveImage(file);
            const resolvedUrl = ImageStorage.resolveImageUrl(imgId);

            const hiddenInput = container.querySelector(`#hidden-${fieldName}`) || container.querySelector(`input[name="${fieldName}"]`);
            if (hiddenInput) hiddenInput.value = imgId;

            const urlInput = container.querySelector(`.a-img-url-input[data-target="${fieldName}"]`);
            if (urlInput) urlInput.value = imgId;

            const thumbBox = container.querySelector(`#thumb-box-${fieldName}`) || container.querySelector(`.a-image-widget[data-field="${fieldName}"] .a-img-thumb-box`);
            if (thumbBox) {
              thumbBox.innerHTML = `<img src="${resolvedUrl}" class="a-thumb-img" alt="Preview" />`;
            }

            const delBtn = container.querySelector(`#del-btn-${fieldName}`) || container.querySelector(`.a-img-delete-btn[data-target="${fieldName}"]`);
            if (delBtn) delBtn.style.display = 'inline-flex';

            if (uploadTxt) uploadTxt.textContent = 'Replace Image';
            showToast('Saved locally in browser IndexedDB (not uploaded to R2)', 'success');
          } catch (localErr) {
            console.error('Local image storage failed:', localErr);
            alert(`Failed to save image: ${localErr.message}`);
          }
        }
      } finally {
        input.value = '';
      }
    });
  });

  // URL input change
  container.querySelectorAll('.a-img-url-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const fieldName = input.getAttribute('data-target');
      const val = input.value.trim();

      const hiddenInput = container.querySelector(`#hidden-${fieldName}`) || container.querySelector(`input[name="${fieldName}"]`);
      if (hiddenInput) hiddenInput.value = val;

      const thumbBox = container.querySelector(`#thumb-box-${fieldName}`) || container.querySelector(`.a-image-widget[data-field="${fieldName}"] .a-img-thumb-box`);
      const delBtn = container.querySelector(`#del-btn-${fieldName}`) || container.querySelector(`.a-img-delete-btn[data-target="${fieldName}"]`);
      const uploadTxt = container.querySelector(`#upload-txt-${fieldName}`);

      if (val) {
        const resolved = ImageStorage.resolveImageUrl(val);
        if (thumbBox) thumbBox.innerHTML = `<img src="${resolved}" class="a-thumb-img" alt="Preview" onerror="this.parentElement.innerHTML='<div class=\\'a-thumb-empty\\'><i class=\\'fa-solid fa-triangle-exclamation\\'></i><span>Invalid</span></div>'" />`;
        if (delBtn) delBtn.style.display = 'inline-flex';
        if (uploadTxt) uploadTxt.textContent = 'Replace Image';
      } else {
        if (thumbBox) thumbBox.innerHTML = `<div class="a-thumb-empty"><i class="fa-solid fa-image"></i><span>No image</span></div>`;
        if (delBtn) delBtn.style.display = 'none';
        if (uploadTxt) uploadTxt.textContent = 'Upload Image';
      }
    });
  });

  // Delete image button
  container.querySelectorAll('.a-img-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const fieldName = btn.getAttribute('data-target');
      const hiddenInput = container.querySelector(`#hidden-${fieldName}`) || container.querySelector(`input[name="${fieldName}"]`);

      if (hiddenInput) hiddenInput.value = '';

      const urlInput = container.querySelector(`.a-img-url-input[data-target="${fieldName}"]`);
      if (urlInput) urlInput.value = '';

      const thumbBox = container.querySelector(`#thumb-box-${fieldName}`) || container.querySelector(`.a-image-widget[data-field="${fieldName}"] .a-img-thumb-box`);
      if (thumbBox) {
        thumbBox.innerHTML = `<div class="a-thumb-empty"><i class="fa-solid fa-image"></i><span>No image</span></div>`;
      }

      btn.style.display = 'none';
      const uploadTxt = container.querySelector(`#upload-txt-${fieldName}`);
      if (uploadTxt) uploadTxt.textContent = 'Upload Image';

      showToast('Image reference cleared; the stored image remains preserved.', '');
    });
  });
}

// ─── Modal Dialog Helper ─────────────────────────────────────────────────────
function openModal(title, formHtml, onSave, options = {}) {
  const container = document.getElementById('a-modal-container');
  if (!container) return;
  const saveAction = typeof onSave === 'function';
  const submitText = options.submitText || 'Save Card';
  const submitIcon = options.submitIcon !== undefined ? options.submitIcon : 'fa-solid fa-floppy-disk';
  const submitClass = options.submitClass || 'a-btn-primary';
  const submitId = options.submitId || '';
  const cancelText = options.cancelText || (saveAction ? 'Cancel' : 'Close');

  container.innerHTML = `
    <div class="a-modal-backdrop" id="a-modal-backdrop">
      <div class="a-modal">
        <div class="a-modal-header">
          <h3>${title}</h3>
          <button type="button" class="a-modal-close" id="a-modal-close-btn">&times;</button>
        </div>
        <form id="a-modal-form">
          <div class="a-modal-body">
            ${formHtml}
          </div>
          <div class="a-modal-footer">
            <button type="button" class="a-btn a-btn-outline" id="a-modal-cancel-btn">${cancelText}</button>
            ${saveAction ? `<button type="submit" class="a-btn ${submitClass}" ${submitId ? `id="${submitId}"` : ''}>${submitIcon ? `<i class="${submitIcon}"></i> ` : ''}${submitText}</button>` : ''}
          </div>
        </form>
      </div>
    </div>
  `;

  bindImageWidgets(container);

  const closeModal = () => { container.innerHTML = ''; };

  document.getElementById('a-modal-close-btn')?.addEventListener('click', closeModal);
  document.getElementById('a-modal-cancel-btn')?.addEventListener('click', closeModal);
  document.getElementById('a-modal-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'a-modal-backdrop') closeModal();
  });

  document.getElementById('a-modal-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!saveAction) {
      closeModal();
      return;
    }
    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalButtonHtml = submitButton ? submitButton.innerHTML : '';
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right:6px;"></i>Saving...';
    }

    const fd = new FormData(e.target);
    const data = {};
    fd.forEach((v, k) => { data[k] = v; });

    try {
      const result = onSave(data);
      if (result && typeof result.then === 'function') {
        const saved = await result;
        if (saved === false) {
          if (submitButton && submitButton.isConnected) {
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonHtml;
          }
          return;
        }
      }
      closeModal();
      rerender();
      showToast('Card saved to database successfully!', 'success');
    } catch (error) {
      console.error('Modal save failed:', error);
      if (submitButton && submitButton.isConnected) {
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonHtml;
      }
      if (error?.isConflict) {
        showToast(`Save conflict: ${error.message}`, 'error');
      } else {
        showToast(`Save failed: ${error.message}`, 'error');
      }
    }
  });
}

// ─── Card Reordering & Action Handlers ───────────────────────────────────────
function reorderArray(arr, fromIdx, toIdx) {
  if (toIdx < 0 || toIdx >= arr.length) return arr;
  const clone = [...arr];
  const [item] = clone.splice(fromIdx, 1);
  clone.splice(toIdx, 0, item);
  return clone;
}

// ─── Tab Content Router ──────────────────────────────────────────────────────
function renderTabContent() {
  switch (currentTab) {
    case 'dashboard':    return renderDashboard();
    case 'home':         return renderHomePageEditor();
    case 'about':        return renderAboutPageEditor();
    case 'services':     return renderServicesPageEditor();
    case 'projects':     return renderProjectsPageEditor();
    case 'gallery':      return renderGalleryPageEditor();
    case 'testimonials': return renderTestimonialsPageEditor();
    case 'contact':      return renderContactPageEditor();
    case 'header':       return renderHeaderPageEditor();
    case 'footer':       return renderFooterPageEditor();
    case 'seo':          return renderSeoPageEditor();
    case 'products':     return renderProductsTab();
    case 'partners':     return renderPartnersTab();
    case 'blogs':        return renderBlogsTab();
    case 'enquiries':    return renderEnquiriesTab();
    default:             return `<p>Section not yet implemented.</p>`;
  }
}

function bindTabEvents() {
  // Bind image widgets in content
  bindImageWidgets(document.querySelector('.a-content'));

  // Generic page form submission
  const genericForm = document.getElementById('a-page-form');
  if (genericForm) {
    genericForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(genericForm);
      const existing = ContentService.getData(currentTab) || {};
      const updated = { ...existing };
      fd.forEach((v, k) => { updated[k] = v; });
      try {
        await ContentService.saveData(currentTab, updated);
        showToast('Page sections saved to database successfully!', 'success');
        rerender();
      } catch (err) {
        showToast(`Failed to save to database: ${err.message}`, 'error');
      }
    });
  }

  // Bind specific tabs
  switch (currentTab) {
    case 'dashboard':    bindDashboardTabEvents(); break;
    case 'home':         bindHomeTabEvents(); break;
    case 'about':        bindAboutTabEvents(); break;
    case 'services':     bindServicesTabEvents(); break;
    case 'projects':     bindProjectsTabEvents(); break;
    case 'gallery':      bindGalleryTabEvents(); break;
    case 'testimonials': bindTestimonialsTabEvents(); break;
    case 'contact':      bindContactTabEvents(); break;
    case 'products':     bindProductsTabEvents(); break;
    case 'partners':     bindPartnersTabEvents(); break;
    case 'blogs':        bindBlogsTabEvents(); break;
    case 'enquiries':    bindEnquiriesTabEvents(); break;
  }
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
function renderDashboard() {
  const products = getCatalogData();
  const partners = ContentService.getData('partners') || [];
  const blogs = ContentService.getData('blogs') || [];
  const projects = ContentService.getData('projects')?.items || [];
  const gallery = ContentService.getData('gallery')?.items || [];
  const testimonials = ContentService.getData('testimonials')?.items || [];

  return `
    <div class="a-stats-row">
      <div class="a-stat-card">
        <h3>${products.length}</h3>
        <p>Products / OEMs</p>
      </div>
      <div class="a-stat-card red">
        <h3>${partners.length}</h3>
        <p>Technology Partners</p>
      </div>
      <div class="a-stat-card">
        <h3>${projects.length}</h3>
        <p>Featured Projects</p>
      </div>
      <div class="a-stat-card red">
        <h3>${testimonials.length}</h3>
        <p>Testimonials</p>
      </div>
      <div class="a-stat-card">
        <h3>${gallery.length}</h3>
        <p>Gallery Photos</p>
      </div>
      <div class="a-stat-card red">
        <h3>${blogs.length}</h3>
        <p>Blog Entries</p>
      </div>
    </div>

    <div class="a-card">
      <div class="a-card-header">
        <div>
          <h3>Full Website Content &amp; Card Architecture</h3>
          <p>Every image, card, and section across the entire website is editable, reorderable, and saved locally</p>
        </div>
      </div>
      <div class="a-table-wrap">
        <table class="a-table">
          <thead><tr><th>Section</th><th>Image Upload</th><th>Card CRUD &amp; Reorder</th><th>Status</th></tr></thead>
          <tbody>
            <tr><td><strong>Home Page</strong></td><td><i class="fa-solid fa-check" style="color:var(--a-success);"></i> Background video/img</td><td>Hero Stats &amp; Core Capabilities cards</td><td><span class="a-badge a-badge-green">Full CRUD</span></td></tr>
            <tr><td><strong>About Us</strong></td><td><i class="fa-solid fa-check" style="color:var(--a-success);"></i> Infographic &amp; Card photos</td><td>Badges, Stats, Milestones, Domains, Pillars, Why Us</td><td><span class="a-badge a-badge-green">Full CRUD</span></td></tr>
            <tr><td><strong>Services</strong></td><td><i class="fa-solid fa-check" style="color:var(--a-success);"></i> Multi-image sliders</td><td>4 Service Pillars with photo carousels &amp; tags</td><td><span class="a-badge a-badge-green">Full CRUD</span></td></tr>
            <tr><td><strong>Projects</strong></td><td><i class="fa-solid fa-check" style="color:var(--a-success);"></i> Project covers</td><td>Defense &amp; Space engineering project cards</td><td><span class="a-badge a-badge-green">Full CRUD</span></td></tr>
            <tr><td><strong>Gallery</strong></td><td><i class="fa-solid fa-check" style="color:var(--a-success);"></i> Hardware photos</td><td>Component &amp; hardware gallery cards</td><td><span class="a-badge a-badge-green">Full CRUD</span></td></tr>
            <tr><td><strong>Testimonials</strong></td><td><i class="fa-solid fa-check" style="color:var(--a-success);"></i> Client avatars</td><td>Scientist &amp; Engineer testimonial cards</td><td><span class="a-badge a-badge-green">Full CRUD</span></td></tr>
            <tr><td><strong>Products / OEMs</strong></td><td><i class="fa-solid fa-check" style="color:var(--a-success);"></i> OEM Logos</td><td>All 15 global manufacturers with logo upload</td><td><span class="a-badge a-badge-green">Full CRUD</span></td></tr>
            <tr><td><strong>Partners</strong></td><td><i class="fa-solid fa-check" style="color:var(--a-success);"></i> Partner Logos</td><td>All 13 partners in running ticker &amp; static grid</td><td><span class="a-badge a-badge-green">Full CRUD</span></td></tr>
            <tr><td><strong>Blogs</strong></td><td><i class="fa-solid fa-check" style="color:var(--a-success);"></i> Article covers</td><td>Technical news, notes, and bulletins</td><td><span class="a-badge a-badge-green">Full CRUD</span></td></tr>
            <tr><td><strong>Contact &amp; Offices</strong></td><td><i class="fa-solid fa-minus" style="color:#94a3b8;"></i> Text based</td><td>Offices (India, Singapore, USA) &amp; Requirement presets</td><td><span class="a-badge a-badge-green">Connected</span></td></tr>
            <tr><td><strong>Header &amp; Nav</strong></td><td><i class="fa-solid fa-check" style="color:var(--a-success);"></i> Brand Logo</td><td>Navigation labels, CTA button text &amp; destination</td><td><span class="a-badge a-badge-green">Connected</span></td></tr>
            <tr><td><strong>Footer</strong></td><td><i class="fa-solid fa-check" style="color:var(--a-success);"></i> Footer Logo</td><td>Tagline, 3 offices, socials, copyright bar</td><td><span class="a-badge a-badge-green">Connected</span></td></tr>
            <tr><td><strong>SEO Settings</strong></td><td><i class="fa-solid fa-check" style="color:var(--a-success);"></i> OpenGraph image</td><td>Meta titles, descriptions, keywords, social tags</td><td><span class="a-badge a-badge-green">Connected</span></td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="a-card" style="margin-top:24px;border:1px solid #3b82f6;background:#f0f7ff;">
      <div class="a-card-header" style="border-bottom:1px solid #bfdbfe;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h3 style="color:#1e3a8a;"><i class="fa-solid fa-database" style="margin-right:8px;color:#2563eb;"></i>Database Content Synchronization (PostgreSQL)</h3>
          <p style="color:#1e40af;margin-top:4px;">All non-catalog CMS content (Home, About, Services, Contact, Header, Footer, Blogs, Partners) is backed by PostgreSQL.</p>
        </div>
        <button id="btn-migrate-local-drafts" class="a-btn a-btn-primary" style="white-space:nowrap;">
          <i class="fa-solid fa-cloud-arrow-up" style="margin-right:6px;"></i>Sync Browser Drafts to Database
        </button>
      </div>
      <div style="padding:16px 20px;font-size:13px;color:#334155;">
        <p style="margin:0 0 8px 0;"><strong>Active Persistence Mode:</strong> Database-Backed (REST API &rarr; PostgreSQL <code>SiteContent</code> table).</p>
        <p style="margin:0;">Any edits saved in the CMS are sent to <code>PUT /api/admin/content/:pageKey</code> and automatically synchronized with the public website for all visitors across devices.</p>
      </div>
    </div>
  `;
}

function bindDashboardTabEvents() {
  document.getElementById('btn-migrate-local-drafts')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-migrate-local-drafts');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right:6px;"></i>Inspecting drafts...';
    }

    try {
      const drafts = await ContentService.getLocalStorageDrafts();
      const candidates = drafts.filter((d) => d.needsMigration);

      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up" style="margin-right:6px;"></i>Sync Browser Drafts to Database';
      }

      if (candidates.length === 0) {
        showToast('All browser drafts are already synchronized with PostgreSQL.', 'info');
        return;
      }

      // Render Review Modal with draft details and DB collision warnings
      const rowsHtml = candidates.map((d) => {
        const isDbCustomized = d.dbStatus === 'customized';
        // Checked by default only if DB is uncustomized (safe); unchecked if DB has existing data
        const isChecked = !isDbCustomized ? 'checked' : '';
        const badge = isDbCustomized
          ? `<span class="a-badge a-badge-amber" title="Database already has content. Overwriting will replace it."><i class="fa-solid fa-triangle-exclamation" style="margin-right:4px;"></i>DB customized (${d.dbUpdatedAt ? new Date(d.dbUpdatedAt).toLocaleDateString() : 'existing'})</span>`
          : `<span class="a-badge a-badge-green"><i class="fa-solid fa-check" style="margin-right:4px;"></i>Safe (No DB content)</span>`;

        return `
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:10px 12px;text-align:center;">
              <input type="checkbox" class="draft-migrate-checkbox" value="${d.pageKey}" ${isChecked} style="cursor:pointer;" />
            </td>
            <td style="padding:10px 12px;">
              <strong>${d.pageKey.toUpperCase()}</strong>
            </td>
            <td style="padding:10px 12px;font-size:12px;color:#64748b;">
              ${d.sizeBytes} bytes
            </td>
            <td style="padding:10px 12px;">
              ${badge}
            </td>
          </tr>
        `;
      }).join('');

      const modalHtml = `
        <div style="font-size:13px;color:#334155;margin-bottom:16px;">
          <p style="margin:0 0 8px 0;">The following customized sections were found in your browser's local storage. Review each section before synchronizing to PostgreSQL.</p>
          <p style="margin:0;font-size:12px;color:#64748b;">Note: Unchecking a section keeps your local copy without modifying the database.</p>
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;background:#ffffff;border-radius:6px;overflow:hidden;margin-bottom:16px;">
          <thead style="background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:left;color:#475569;">
            <tr>
              <th style="padding:8px 12px;text-align:center;width:40px;">Sync</th>
              <th style="padding:8px 12px;">Section</th>
              <th style="padding:8px 12px;">Draft Size</th>
              <th style="padding:8px 12px;">Database Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      `;

      openModal('Review & Sync Browser Drafts to Database', modalHtml, async () => {
        const checkboxes = document.querySelectorAll('.draft-migrate-checkbox:checked');
        const selectedKeys = Array.from(checkboxes).map(cb => cb.value);

        if (selectedKeys.length === 0) {
          showToast('No drafts selected for migration.', 'info');
          return false;
        }

        const overwriteKeys = candidates
          .filter(c => selectedKeys.includes(c.pageKey) && c.dbStatus === 'customized')
          .map(c => c.pageKey);

        if (overwriteKeys.length > 0) {
          if (!confirm(`Warning: You selected [${overwriteKeys.join(', ')}], which already have customized content in PostgreSQL. Overwrite the database with your local drafts?`)) {
            return false;
          }
        }

        const res = await ContentService.migrateLocalStorageDrafts(selectedKeys);
        if (res.success) {
          showToast(`Successfully synchronized ${res.count} section(s) to PostgreSQL!`, 'success');
        } else {
          showToast(`Partial sync: ${res.count} section(s) saved, ${res.failedKeys.length} failed.`, 'error');
        }
        return true;
      });
    } catch (err) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up" style="margin-right:6px;"></i>Sync Browser Drafts to Database';
      }
      showToast(`Failed to inspect drafts: ${err.message}`, 'error');
    }
  });
}

// ─── HOME PAGE EDITOR ────────────────────────────────────────────────────────
function renderHomePageEditor() {
  const d = ContentService.getData('home') || {};
  const stats = d.stats || [];
  const caps = d.capabilities || [];

  return `
    <div class="a-subtabs-nav">
      <button type="button" class="a-subtab-btn ${currentSubTab === 'fields' ? 'active' : ''}" data-subtab="fields"><i class="fa-solid fa-pen-to-square"></i> Hero &amp; Section Texts</button>
      <button type="button" class="a-subtab-btn ${currentSubTab === 'stats' ? 'active' : ''}" data-subtab="stats"><i class="fa-solid fa-chart-simple"></i> Hero Stats Bar (${stats.length})</button>
      <button type="button" class="a-subtab-btn ${currentSubTab === 'capabilities' ? 'active' : ''}" data-subtab="capabilities"><i class="fa-solid fa-boxes-stacked"></i> Core Capabilities Cards (${caps.length})</button>
    </div>

    ${currentSubTab === 'fields' ? `
      <form id="a-page-form">
        <div class="a-card">
          <div class="a-card-header"><div><h3>Hero Banner Section</h3><p>Main high-impact visual &amp; headline</p></div></div>
          <div class="a-form-grid">
            <div class="a-field span2"><label class="a-label">Main Heading <span class="a-label-ctx">HTML supported for color accent</span></label>
              <textarea class="a-textarea" name="heroTitle">${d.heroTitle || ''}</textarea></div>
            <div class="a-field span2"><label class="a-label">Sub-description</label>
              <textarea class="a-textarea" name="heroSubtitle">${d.heroSubtitle || ''}</textarea></div>
            <div class="a-field"><label class="a-label">Hero Video URL / Path</label>
              <input class="a-input" type="text" name="heroBgVideo" value="${d.heroBgVideo || '/icon-video.mp4'}"></div>
            ${renderImageUploadField('heroBgImage', 'Hero Poster / Background Image', d.heroBgImage || '', 'Fallback or video poster')}
            <div class="a-field"><label class="a-label">Primary CTA Label</label>
              <input class="a-input" type="text" name="ctaExploreText" value="${d.ctaExploreText || 'Explore Products'}"></div>
            <div class="a-field"><label class="a-label">Primary CTA Link</label>
              <input class="a-input" type="text" name="ctaExploreLink" value="${d.ctaExploreLink || '/products'}"></div>
            <div class="a-field"><label class="a-label">Secondary CTA Label</label>
              <input class="a-input" type="text" name="ctaQuoteText" value="${d.ctaQuoteText || 'Request a Quote'}"></div>
            <div class="a-field"><label class="a-label">Secondary CTA Link</label>
              <input class="a-input" type="text" name="ctaQuoteLink" value="${d.ctaQuoteLink || '/contact'}"></div>
          </div>
        </div>

        <div class="a-card">
          <div class="a-card-header"><div><h3>Section Headers on Home Page</h3><p>Customize section titles &amp; subtitles displayed on the homepage</p></div></div>
          <div class="a-form-grid">
            <div class="a-section-divider span2">Core Capabilities Section</div>
            <div class="a-field"><label class="a-label">Section Tag</label><input class="a-input" name="coreCapabilitiesTitle" value="${d.coreCapabilitiesTitle || 'Core Capabilities'}"></div>
            <div class="a-field"><label class="a-label">Section Subtitle</label><input class="a-input" name="coreCapabilitiesSubtitle" value="${d.coreCapabilitiesSubtitle || 'Engineered for extreme performance.'}"></div>
            <div class="a-field span2"><label class="a-label">Section Lead</label><textarea class="a-textarea" name="coreCapabilitiesLead">${d.coreCapabilitiesLead || ''}</textarea></div>

            <div class="a-section-divider span2">Popular Products Section</div>
            <div class="a-field"><label class="a-label">Title</label><input class="a-input" name="popularTitle" value="${d.popularTitle || 'Popular Products & Components'}"></div>
            <div class="a-field span2"><label class="a-label">Lead</label><textarea class="a-textarea" name="popularLead">${d.popularLead || ''}</textarea></div>

            <div class="a-section-divider span2">Featured Projects Section</div>
            <div class="a-field"><label class="a-label">Title</label><input class="a-input" name="projectsTitle" value="${d.projectsTitle || 'Featured Projects'}"></div>
            <div class="a-field"><label class="a-label">Subtitle</label><input class="a-input" name="projectsSubtitle" value="${d.projectsSubtitle || 'Mission-Ready Hardware Deployments'}"></div>
            <div class="a-field span2"><label class="a-label">Lead</label><textarea class="a-textarea" name="projectsLead">${d.projectsLead || ''}</textarea></div>

            <div class="a-section-divider span2">Hardware Gallery Section</div>
            <div class="a-field"><label class="a-label">Title</label><input class="a-input" name="galleryTitle" value="${d.galleryTitle || 'Hardware Gallery'}"></div>
            <div class="a-field"><label class="a-label">Subtitle</label><input class="a-input" name="gallerySubtitle" value="${d.gallerySubtitle || 'High-Rel Components in Action'}"></div>
            <div class="a-field span2"><label class="a-label">Lead</label><textarea class="a-textarea" name="galleryLead">${d.galleryLead || ''}</textarea></div>

            <div class="a-section-divider span2">Testimonials Section</div>
            <div class="a-field"><label class="a-label">Title</label><input class="a-input" name="testimonialsTitle" value="${d.testimonialsTitle || 'Trusted by Industry Leaders'}"></div>
            <div class="a-field"><label class="a-label">Subtitle</label><input class="a-input" name="testimonialsSubtitle" value="${d.testimonialsSubtitle || 'What Defense, Space & Aerospace Engineers Say'}"></div>
            <div class="a-field span2"><label class="a-label">Lead</label><textarea class="a-textarea" name="testimonialsLead">${d.testimonialsLead || ''}</textarea></div>

            <div class="a-section-divider span2">Latest Insights / Blogs Section</div>
            <div class="a-field"><label class="a-label">Title</label><input class="a-input" name="insightsTitle" value="${d.insightsTitle || 'Insights'}"></div>
            <div class="a-field"><label class="a-label">Subtitle</label><input class="a-input" name="insightsSubtitle" value="${d.insightsSubtitle || 'Latest Blogs'}"></div>
            <div class="a-field span2"><label class="a-label">Lead</label><textarea class="a-textarea" name="insightsLead">${d.insightsLead || ''}</textarea></div>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button type="submit" class="a-btn a-btn-primary"><i class="fa-solid fa-floppy-disk"></i> Save Home Page Content</button>
        </div>
      </form>
    ` : ''}

    ${currentSubTab === 'stats' ? `
      <div class="a-cards-box">
        <div class="a-cards-box-header">
          <div>
            <h3>Hero Stats Bar Figures</h3>
            <p>Reorder, edit, or add figures shown in the hero stats banner</p>
          </div>
          <button type="button" class="a-btn a-btn-primary a-btn-sm" id="a-add-stat-btn"><i class="fa-solid fa-plus"></i> Add Stat Figure</button>
        </div>
        <div class="a-table-wrap">
          <table class="a-table">
            <thead><tr><th>Reorder</th><th>Stat Value</th><th>Label</th><th>Actions</th></tr></thead>
            <tbody>
              ${stats.map((st, idx) => `
                <tr>
                  <td style="width:90px;">
                    <div class="a-reorder-group">
                      <button class="a-btn-reorder btn-move-stat" data-dir="up" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''} title="Move Up"><i class="fa-solid fa-arrow-up"></i></button>
                      <button class="a-btn-reorder btn-move-stat" data-dir="down" data-idx="${idx}" ${idx === stats.length - 1 ? 'disabled' : ''} title="Move Down"><i class="fa-solid fa-arrow-down"></i></button>
                    </div>
                  </td>
                  <td><strong style="color:var(--a-red); font-size:1.1rem;">${st.value}</strong></td>
                  <td>${st.label}</td>
                  <td>
                    <button class="a-btn a-btn-outline a-btn-sm btn-edit-stat" data-idx="${idx}"><i class="fa-solid fa-pen"></i> Edit</button>
                    <button class="a-btn a-btn-danger a-btn-sm btn-del-stat" data-idx="${idx}" style="margin-left:6px;"><i class="fa-solid fa-trash"></i></button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}

    ${currentSubTab === 'capabilities' ? `
      <div class="a-cards-box">
        <div class="a-cards-box-header">
          <div>
            <h3>Core Capabilities Cards</h3>
            <p>Add, edit, delete, and reorder the capability cards shown on the homepage</p>
          </div>
          <button type="button" class="a-btn a-btn-primary a-btn-sm" id="a-add-cap-btn"><i class="fa-solid fa-plus"></i> Add Capability Card</button>
        </div>
        <div class="a-table-wrap">
          <table class="a-table">
            <thead><tr><th>Reorder</th><th>Icon</th><th>Title</th><th>Description</th><th>Action Link</th><th>Actions</th></tr></thead>
            <tbody>
              ${caps.map((cap, idx) => `
                <tr>
                  <td style="width:90px;">
                    <div class="a-reorder-group">
                      <button class="a-btn-reorder btn-move-cap" data-dir="up" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                      <button class="a-btn-reorder btn-move-cap" data-dir="down" data-idx="${idx}" ${idx === caps.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
                    </div>
                  </td>
                  <td style="font-size:1.2rem; color:var(--a-blue);"><i class="${cap.icon || 'fa-solid fa-microchip'}"></i></td>
                  <td><strong>${cap.title}</strong></td>
                  <td style="font-size:0.82rem; color:var(--a-muted); max-width:320px;">${cap.desc}</td>
                  <td style="font-size:0.8rem;"><code>${cap.linkUrl || '/products'}</code></td>
                  <td>
                    <button class="a-btn a-btn-outline a-btn-sm btn-edit-cap" data-idx="${idx}"><i class="fa-solid fa-pen"></i> Edit</button>
                    <button class="a-btn a-btn-danger a-btn-sm btn-del-cap" data-idx="${idx}" style="margin-left:6px;"><i class="fa-solid fa-trash"></i></button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}
  `;
}

function bindHomeTabEvents() {
  // Subtabs switcher
  document.querySelectorAll('.a-subtab-btn[data-subtab]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSubTab = btn.getAttribute('data-subtab');
      rerender();
    });
  });

  const d = ContentService.getData('home') || {};

  // Stats Card management
  document.getElementById('a-add-stat-btn')?.addEventListener('click', () => {
    openModal('Add Hero Stat Figure', `
      <div class="a-field"><label class="a-label">Stat Value (e.g. 4,000+)</label><input class="a-input" name="value" required /></div>
      <div class="a-field" style="margin-top:12px;"><label class="a-label">Label (e.g. PRODUCTS AVAILABLE)</label><input class="a-input" name="label" required /></div>
    `, async (data) => {
      const stats = d.stats || [];
      stats.push({ id: 'stat-' + Date.now(), value: data.value, label: data.label });
      d.stats = stats;
      await ContentService.saveData('home', d);
    });
  });

  document.querySelectorAll('.btn-edit-stat').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const st = d.stats[idx];
      openModal('Edit Hero Stat Figure', `
        <div class="a-field"><label class="a-label">Stat Value</label><input class="a-input" name="value" value="${st.value}" required /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Label</label><input class="a-input" name="label" value="${st.label}" required /></div>
      `, async (data) => {
        d.stats[idx] = { ...st, value: data.value, label: data.label };
        await ContentService.saveData('home', d);
      });
    });
  });

  document.querySelectorAll('.btn-del-stat').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      if (!confirm('Delete this stat figure?')) return;
      btn.disabled = true;
      try {
        d.stats.splice(idx, 1);
        await ContentService.saveData('home', d);
        rerender();
        showToast('Stat removed.', 'info');
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed to delete stat: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });

  document.querySelectorAll('.btn-move-stat').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const dir = btn.getAttribute('data-dir');
      const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
      btn.disabled = true;
      try {
        d.stats = reorderArray(d.stats, idx, targetIdx);
        await ContentService.saveData('home', d);
        rerender();
        showToast('Stat order updated!', 'success');
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed to move stat: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });

  // Capabilities Card management
  document.getElementById('a-add-cap-btn')?.addEventListener('click', () => {
    openModal('Add Capability Card', `
      <div class="a-field"><label class="a-label">Card Title</label><input class="a-input" name="title" required /></div>
      <div class="a-field" style="margin-top:12px;"><label class="a-label">FontAwesome Icon (e.g. fa-solid fa-wave-square)</label><input class="a-input" name="icon" value="fa-solid fa-wave-square" /></div>
      <div class="a-field" style="margin-top:12px;"><label class="a-label">Description</label><textarea class="a-textarea" name="desc" required></textarea></div>
      <div class="a-field" style="margin-top:12px;"><label class="a-label">Link Label (e.g. Explore Amplifiers →)</label><input class="a-input" name="linkText" value="Explore →" /></div>
      <div class="a-field" style="margin-top:12px;"><label class="a-label">Link URL (e.g. /products?category=amplifiers)</label><input class="a-input" name="linkUrl" value="/products" /></div>
    `, async (data) => {
      const caps = d.capabilities || [];
      caps.push({ id: 'cap-' + Date.now(), ...data });
      d.capabilities = caps;
      await ContentService.saveData('home', d);
    });
  });

  document.querySelectorAll('.btn-edit-cap').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const cap = d.capabilities[idx];
      openModal('Edit Capability Card', `
        <div class="a-field"><label class="a-label">Card Title</label><input class="a-input" name="title" value="${cap.title}" required /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">FontAwesome Icon</label><input class="a-input" name="icon" value="${cap.icon || 'fa-solid fa-microchip'}" /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Description</label><textarea class="a-textarea" name="desc" required>${cap.desc || ''}</textarea></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Link Label</label><input class="a-input" name="linkText" value="${cap.linkText || 'Explore →'}" /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Link URL</label><input class="a-input" name="linkUrl" value="${cap.linkUrl || '/products'}" /></div>
      `, async (data) => {
        d.capabilities[idx] = { ...cap, ...data };
        await ContentService.saveData('home', d);
      });
    });
  });

  document.querySelectorAll('.btn-del-cap').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      if (!confirm('Delete this capability card?')) return;
      btn.disabled = true;
      try {
        d.capabilities.splice(idx, 1);
        await ContentService.saveData('home', d);
        rerender();
        showToast('Capability card deleted.', 'info');
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed to delete capability: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });

  document.querySelectorAll('.btn-move-cap').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const dir = btn.getAttribute('data-dir');
      const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
      btn.disabled = true;
      try {
        d.capabilities = reorderArray(d.capabilities, idx, targetIdx);
        await ContentService.saveData('home', d);
        rerender();
        showToast('Capability cards reordered!', 'success');
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed to move capability: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });
}

// ─── ABOUT US PAGE EDITOR ────────────────────────────────────────────────────
function renderAboutPageEditor() {
  const d = ContentService.getData('about') || {};
  const badges = d.badges || [];
  const highlights = d.highlightCards || [];
  const stats = d.stats || [];
  const milestones = d.milestones || [];
  const domains = d.domains || [];
  const pillars = d.pillars || [];
  const whyUs = d.whyUs || [];

  return `
    <div class="a-subtabs-nav">
      <button type="button" class="a-subtab-btn ${currentSubTab === 'fields' ? 'active' : ''}" data-subtab="fields"><i class="fa-solid fa-pen-to-square"></i> General &amp; Vision</button>
      <button type="button" class="a-subtab-btn ${currentSubTab === 'badges' ? 'active' : ''}" data-subtab="badges"><i class="fa-solid fa-award"></i> Badges (${badges.length})</button>
      <button type="button" class="a-subtab-btn ${currentSubTab === 'highlights' ? 'active' : ''}" data-subtab="highlights"><i class="fa-solid fa-star"></i> Highlights (${highlights.length})</button>
      <button type="button" class="a-subtab-btn ${currentSubTab === 'stats' ? 'active' : ''}" data-subtab="stats"><i class="fa-solid fa-chart-line"></i> Quick Facts (${stats.length})</button>
      <button type="button" class="a-subtab-btn ${currentSubTab === 'milestones' ? 'active' : ''}" data-subtab="milestones"><i class="fa-solid fa-timeline"></i> Timeline (${milestones.length})</button>
      <button type="button" class="a-subtab-btn ${currentSubTab === 'domains' ? 'active' : ''}" data-subtab="domains"><i class="fa-solid fa-satellite-dish"></i> Domains (${domains.length})</button>
      <button type="button" class="a-subtab-btn ${currentSubTab === 'pillars' ? 'active' : ''}" data-subtab="pillars"><i class="fa-solid fa-monument"></i> Pillars (${pillars.length})</button>
      <button type="button" class="a-subtab-btn ${currentSubTab === 'whyus' ? 'active' : ''}" data-subtab="whyus"><i class="fa-solid fa-circle-question"></i> Why Us (${whyUs.length})</button>
    </div>

    ${currentSubTab === 'fields' ? `
      <form id="a-page-form">
        <div class="a-card">
          <div class="a-card-header"><div><h3>About Us Hero Banner</h3><p>Page heading and introduction</p></div></div>
          <div class="a-form-grid">
            <div class="a-field"><label class="a-label">Eyebrow</label><input class="a-input" name="heroEyebrow" value="${d.heroEyebrow || 'ABOUT ICON ELECTROMATIC'}"></div>
            <div class="a-field"><label class="a-label">Page Title</label><input class="a-input" name="heroTitle" value="${d.heroTitle || 'About Us'}"></div>
            <div class="a-field span2"><label class="a-label">Lead Paragraph</label><textarea class="a-textarea" name="heroLead">${d.heroLead || ''}</textarea></div>
          </div>
        </div>

        <div class="a-card">
          <div class="a-card-header"><div><h3>Company Background &amp; Downloads</h3><p>Narrative paragraphs and brochure downloads</p></div></div>
          <div class="a-form-grid">
            <div class="a-field"><label class="a-label">Section Title</label><input class="a-input" name="coreCapabilitiesTitle" value="${d.coreCapabilitiesTitle || 'Core Capabilities'}"></div>
            <div class="a-field"><label class="a-label">Section Subtitle</label><input class="a-input" name="coreCapabilitiesSubtitle" value="${d.coreCapabilitiesSubtitle || 'Fulfillment partners for your electronic ambitions'}"></div>
            <div class="a-field span2"><label class="a-label">Description Paragraph 1</label><textarea class="a-textarea" name="companyDesc1">${d.companyDesc1 || ''}</textarea></div>
            <div class="a-field span2"><label class="a-label">Description Paragraph 2</label><textarea class="a-textarea" name="companyDesc2">${d.companyDesc2 || ''}</textarea></div>
            <div class="a-field"><label class="a-label">Corporate Presentation Link</label><input class="a-input" name="presentationLink" value="${d.presentationLink || ''}"></div>
            <div class="a-field"><label class="a-label">Company Flyer Link</label><input class="a-input" name="flyerLink" value="${d.flyerLink || ''}"></div>
          </div>
        </div>

        <div class="a-card">
          <div class="a-card-header"><div><h3>Vision &amp; Mission</h3><p>Guiding organizational principles</p></div></div>
          <div class="a-form-grid">
            <div class="a-field"><label class="a-label">Vision Title</label><input class="a-input" name="visionTitle" value="${d.visionTitle || 'Our Vision'}"></div>
            <div class="a-field"><label class="a-label">Mission Title</label><input class="a-input" name="missionTitle" value="${d.missionTitle || 'Our Mission'}"></div>
            <div class="a-field span2"><label class="a-label">Vision Statement</label><textarea class="a-textarea" name="visionDesc">${d.visionDesc || ''}</textarea></div>
            <div class="a-field span2"><label class="a-label">Mission Statement</label><textarea class="a-textarea" name="missionDesc">${d.missionDesc || ''}</textarea></div>
          </div>
        </div>

        <div class="a-card">
          <div class="a-card-header"><div><h3>Chronology / Journey Section</h3><p>Timeline lead and official presentation infographic slide</p></div></div>
          <div class="a-form-grid">
            <div class="a-field"><label class="a-label">Title</label><input class="a-input" name="journeyTitle" value="${d.journeyTitle || 'Chronology'}"></div>
            <div class="a-field"><label class="a-label">Subtitle</label><input class="a-input" name="journeySubtitle" value="${d.journeySubtitle || 'Our Journey'}"></div>
            <div class="a-field span2"><label class="a-label">Lead Paragraph</label><textarea class="a-textarea" name="journeyLead">${d.journeyLead || ''}</textarea></div>
            ${renderImageUploadField('infographicImage', 'Chronology Infographic Slide Image', d.infographicImage || '', 'High-res image opened by View Slide Graphic modal')}
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button type="submit" class="a-btn a-btn-primary"><i class="fa-solid fa-floppy-disk"></i> Save About Us Content</button>
        </div>
      </form>
    ` : ''}

    ${currentSubTab === 'badges' ? renderCardsManagerTab('Trust Badges', badges, 'badge', ['text', 'icon', 'color']) : ''}
    ${currentSubTab === 'highlights' ? renderCardsManagerTab('Feature Highlights', highlights, 'highlight', ['title', 'desc', 'icon', 'color']) : ''}
    ${currentSubTab === 'stats' ? renderCardsManagerTab('Quick Facts Counters', stats, 'quickstat', ['target', 'suffix', 'label', 'icon', 'color']) : ''}
    ${currentSubTab === 'milestones' ? renderCardsManagerTab('Timeline Milestones', milestones, 'milestone', ['year', 'title', 'desc', 'image', 'caption', 'color']) : ''}
    ${currentSubTab === 'domains' ? renderCardsManagerTab('Strategic Application Domains', domains, 'domain', ['title', 'desc', 'image', 'tag']) : ''}
    ${currentSubTab === 'pillars' ? renderCardsManagerTab('Strategic Pillars', pillars, 'pillar', ['eyebrow', 'title', 'subtitle', 'desc', 'image', 'color']) : ''}
    ${currentSubTab === 'whyus' ? renderCardsManagerTab('Why Us Points', whyUs, 'whyus', ['number', 'title', 'desc', 'icon', 'color']) : ''}
  `;
}

function bindAboutTabEvents() {
  document.querySelectorAll('.a-subtab-btn[data-subtab]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSubTab = btn.getAttribute('data-subtab');
      rerender();
    });
  });

  const d = ContentService.getData('about') || {};

  // Badges
  bindUniversalCardActions('about', d, 'badges', 'badge', () => `
    <div class="a-field"><label class="a-label">Badge Text</label><input class="a-input" name="text" required /></div>
    <div class="a-field" style="margin-top:12px;"><label class="a-label">Icon (e.g. fa-solid fa-award)</label><input class="a-input" name="icon" value="fa-solid fa-award" /></div>
    <div class="a-field" style="margin-top:12px;"><label class="a-label">Text Color Hex (e.g. #FDA4AF)</label><input class="a-input" name="color" value="#FDA4AF" /></div>
  `, (card) => `
    <div class="a-field"><label class="a-label">Badge Text</label><input class="a-input" name="text" value="${card.text}" required /></div>
    <div class="a-field" style="margin-top:12px;"><label class="a-label">Icon</label><input class="a-input" name="icon" value="${card.icon || ''}" /></div>
    <div class="a-field" style="margin-top:12px;"><label class="a-label">Text Color Hex</label><input class="a-input" name="color" value="${card.color || ''}" /></div>
  `);

  // Highlights
  bindUniversalCardActions('about', d, 'highlightCards', 'highlight', () => `
    <div class="a-field"><label class="a-label">Card Title</label><input class="a-input" name="title" required /></div>
    <div class="a-field" style="margin-top:12px;"><label class="a-label">Icon</label><input class="a-input" name="icon" value="fa-solid fa-tower-broadcast" /></div>
    <div class="a-field" style="margin-top:12px;"><label class="a-label">Accent Color (blue / red)</label><input class="a-input" name="color" value="blue" /></div>
    <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Description</label><textarea class="a-textarea" name="desc" required></textarea></div>
  `, (card) => `
    <div class="a-field"><label class="a-label">Card Title</label><input class="a-input" name="title" value="${card.title}" required /></div>
    <div class="a-field" style="margin-top:12px;"><label class="a-label">Icon</label><input class="a-input" name="icon" value="${card.icon || ''}" /></div>
    <div class="a-field" style="margin-top:12px;"><label class="a-label">Accent Color (blue / red)</label><input class="a-input" name="color" value="${card.color || 'blue'}" /></div>
    <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Description</label><textarea class="a-textarea" name="desc" required>${card.desc || ''}</textarea></div>
  `);

  // Stats
  bindUniversalCardActions('about', d, 'stats', 'quickstat', () => `
    <div class="a-field"><label class="a-label">Target Number (e.g. 1500)</label><input class="a-input" name="target" required /></div>
    <div class="a-field" style="margin-top:12px;"><label class="a-label">Suffix (e.g. +)</label><input class="a-input" name="suffix" value="+" /></div>
    <div class="a-field" style="margin-top:12px;"><label class="a-label">Label (e.g. Products)</label><input class="a-input" name="label" required /></div>
    <div class="a-field" style="margin-top:12px;"><label class="a-label">Icon</label><input class="a-input" name="icon" value="fa-solid fa-boxes-stacked" /></div>
    <div class="a-field" style="margin-top:12px;"><label class="a-label">Color (red / blue)</label><input class="a-input" name="color" value="red" /></div>
  `, (card) => `
    <div class="a-field"><label class="a-label">Target Number</label><input class="a-input" name="target" value="${card.target}" required /></div>
    <div class="a-field" style="margin-top:12px;"><label class="a-label">Suffix</label><input class="a-input" name="suffix" value="${card.suffix || '+'}" /></div>
    <div class="a-field" style="margin-top:12px;"><label class="a-label">Label</label><input class="a-input" name="label" value="${card.label}" required /></div>
    <div class="a-field" style="margin-top:12px;"><label class="a-label">Icon</label><input class="a-input" name="icon" value="${card.icon || ''}" /></div>
    <div class="a-field" style="margin-top:12px;"><label class="a-label">Color (red / blue)</label><input class="a-input" name="color" value="${card.color || 'red'}" /></div>
  `);

  // Milestones
  bindUniversalCardActions('about', d, 'milestones', 'milestone', () => `
    <div class="a-field"><label class="a-label">Year / Milestone Date (e.g. 2009)</label><input class="a-input" name="year" required /></div>
    <div class="a-field" style="margin-top:12px;"><label class="a-label">Headline Title</label><input class="a-input" name="title" required /></div>
    <div class="a-field" style="margin-top:12px;"><label class="a-label">Theme Color (cyan / red / navy / amber)</label><input class="a-input" name="color" value="cyan" /></div>
    <div class="a-field" style="margin-top:12px;"><label class="a-label">Photo Caption</label><input class="a-input" name="caption" /></div>
    ${renderImageUploadField('image', 'Milestone Photo', '', 'Visual for this timeline step')}
    <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Milestone Description</label><textarea class="a-textarea" name="desc" required></textarea></div>
  `, (card) => `
    <div class="a-field"><label class="a-label">Year / Milestone Date</label><input class="a-input" name="year" value="${card.year}" required /></div>
    <div class="a-field" style="margin-top:12px;"><label class="a-label">Headline Title</label><input class="a-input" name="title" value="${card.title}" required /></div>
    <div class="a-field" style="margin-top:12px;"><label class="a-label">Theme Color (cyan / red / navy / amber)</label><input class="a-input" name="color" value="${card.color || 'cyan'}" /></div>
    <div class="a-field" style="margin-top:12px;"><label class="a-label">Photo Caption</label><input class="a-input" name="caption" value="${card.caption || ''}" /></div>
    ${renderImageUploadField('image', 'Milestone Photo', card.image || '', 'Visual for this timeline step')}
    <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Milestone Description</label><textarea class="a-textarea" name="desc" required>${card.desc || ''}</textarea></div>
  `);

  // Domains
  bindUniversalCardActions('about', d, 'domains', 'domain', () => `
    <div class="a-field"><label class="a-label">Domain Name (e.g. Aerospace & Defence)</label><input class="a-input" name="title" required /></div>
    <div class="a-field" style="margin-top:12px;"><label class="a-label">Tag Pill (e.g. Radar & EW Systems)</label><input class="a-input" name="tag" /></div>
    ${renderImageUploadField('image', 'Domain Photo', '', 'Image displayed on domain card')}
    <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Description</label><textarea class="a-textarea" name="desc" required></textarea></div>
  `, (card) => `
    <div class="a-field"><label class="a-label">Domain Name</label><input class="a-input" name="title" value="${card.title}" required /></div>
    <div class="a-field" style="margin-top:12px;"><label class="a-label">Tag Pill</label><input class="a-input" name="tag" value="${card.tag || ''}" /></div>
    ${renderImageUploadField('image', 'Domain Photo', card.image || '', 'Image displayed on domain card')}
    <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Description</label><textarea class="a-textarea" name="desc" required>${card.desc || ''}</textarea></div>
  `);

  // Pillars
  bindUniversalCardActions('about', d, 'pillars', 'pillar', () => `
    <div class="a-field"><label class="a-label">Eyebrow (e.g. GLOBAL ALLIANCES)</label><input class="a-input" name="eyebrow" value="FOUNDATIONAL PILLAR" /></div>
    <div class="a-field" style="margin-top:12px;"><label class="a-label">Title</label><input class="a-input" name="title" required /></div>
    <div class="a-field" style="margin-top:12px;"><label class="a-label">Subtitle</label><input class="a-input" name="subtitle" /></div>
    <div class="a-field" style="margin-top:12px;"><label class="a-label">Color (blue / red)</label><input class="a-input" name="color" value="blue" /></div>
    ${renderImageUploadField('image', 'Pillar Photo', '', 'Image displayed for this pillar')}
    <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Description</label><textarea class="a-textarea" name="desc" required></textarea></div>
  `, (card) => `
    <div class="a-field"><label class="a-label">Eyebrow</label><input class="a-input" name="eyebrow" value="${card.eyebrow || ''}" /></div>
    <div class="a-field" style="margin-top:12px;"><label class="a-label">Title</label><input class="a-input" name="title" value="${card.title}" required /></div>
    <div class="a-field" style="margin-top:12px;"><label class="a-label">Subtitle</label><input class="a-input" name="subtitle" value="${card.subtitle || ''}" /></div>
    <div class="a-field" style="margin-top:12px;"><label class="a-label">Color (blue / red)</label><input class="a-input" name="color" value="${card.color || 'blue'}" /></div>
    ${renderImageUploadField('image', 'Pillar Photo', card.image || '', 'Image displayed for this pillar')}
    <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Description</label><textarea class="a-textarea" name="desc" required>${card.desc || ''}</textarea></div>
  `);

  // Why Us
  bindUniversalCardActions('about', d, 'whyUs', 'whyus', () => `
    <div class="a-field"><label class="a-label">Number (e.g. 01)</label><input class="a-input" name="number" value="01" required /></div>
    <div class="a-field" style="margin-top:12px;"><label class="a-label">Title</label><input class="a-input" name="title" required /></div>
    <div class="a-field" style="margin-top:12px;"><label class="a-label">Icon</label><input class="a-input" name="icon" value="fa-solid fa-bullseye" /></div>
    <div class="a-field" style="margin-top:12px;"><label class="a-label">Color (red / blue)</label><input class="a-input" name="color" value="red" /></div>
    <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Description</label><textarea class="a-textarea" name="desc" required></textarea></div>
  `, (card) => `
    <div class="a-field"><label class="a-label">Number</label><input class="a-input" name="number" value="${card.number || '01'}" required /></div>
    <div class="a-field" style="margin-top:12px;"><label class="a-label">Title</label><input class="a-input" name="title" value="${card.title}" required /></div>
    <div class="a-field" style="margin-top:12px;"><label class="a-label">Icon</label><input class="a-input" name="icon" value="${card.icon || ''}" /></div>
    <div class="a-field" style="margin-top:12px;"><label class="a-label">Color (red / blue)</label><input class="a-input" name="color" value="${card.color || 'red'}" /></div>
    <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Description</label><textarea class="a-textarea" name="desc" required>${card.desc || ''}</textarea></div>
  `);
}

// ─── SERVICES PAGE EDITOR ────────────────────────────────────────────────────
function renderServicesPageEditor() {
  const d = ContentService.getData('services') || {};
  const items = d.items || [];
  const badges = d.badges || [];

  return `
    <div class="a-subtabs-nav">
      <button type="button" class="a-subtab-btn ${currentSubTab === 'fields' ? 'active' : ''}" data-subtab="fields"><i class="fa-solid fa-pen-to-square"></i> Hero &amp; Badges</button>
      <button type="button" class="a-subtab-btn ${currentSubTab === 'services' ? 'active' : ''}" data-subtab="services"><i class="fa-solid fa-gears"></i> Service Pillars (${items.length})</button>
    </div>

    ${currentSubTab === 'fields' ? `
      <form id="a-page-form">
        <div class="a-card">
          <div class="a-card-header"><div><h3>Services Hero Banner</h3><p>Page heading and introduction</p></div></div>
          <div class="a-form-grid">
            <div class="a-field"><label class="a-label">Eyebrow Tag</label><input class="a-input" name="heroEyebrow" value="${d.heroEyebrow || 'CAPABILITIES & SERVICES'}"></div>
            <div class="a-field"><label class="a-label">Page Title</label><input class="a-input" name="heroTitle" value="${d.heroTitle || 'Engineering Services & Global Representation'}"></div>
            <div class="a-field span2"><label class="a-label">Lead Paragraph</label><textarea class="a-textarea" name="heroLead">${d.heroLead || ''}</textarea></div>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button type="submit" class="a-btn a-btn-primary"><i class="fa-solid fa-floppy-disk"></i> Save Services Hero</button>
        </div>
      </form>
    ` : ''}

    ${currentSubTab === 'services' ? `
      <div class="a-cards-box">
        <div class="a-cards-box-header">
          <div>
            <h3>Core Service Blocks &amp; Sliders</h3>
            <p>Each service block has its own title, descriptions, tags, and multi-image slideshow</p>
          </div>
          <button type="button" class="a-btn a-btn-primary a-btn-sm" id="a-add-srv-btn"><i class="fa-solid fa-plus"></i> Add Service Pillar</button>
        </div>
        <div class="a-table-wrap">
          <table class="a-table">
            <thead><tr><th>Reorder</th><th>Service Title</th><th>Subtitle / Domain</th><th>Slideshow Images</th><th>Actions</th></tr></thead>
            <tbody>
              ${items.map((srv, idx) => {
                const slidesCount = (srv.slides || []).length;
                const firstImg = slidesCount ? ImageStorage.resolveImageUrl(srv.slides[0].image) : '';
                return `
                  <tr>
                    <td style="width:90px;">
                      <div class="a-reorder-group">
                        <button class="a-btn-reorder btn-move-srv" data-dir="up" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                        <button class="a-btn-reorder btn-move-srv" data-dir="down" data-idx="${idx}" ${idx === items.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
                      </div>
                    </td>
                    <td>
                      <div style="display:flex; align-items:center; gap:10px;">
                        ${firstImg ? `<img src="${firstImg}" class="a-img-preview" alt="Thumb" style="width:50px; height:38px;" />` : ''}
                        <div>
                          <strong>${srv.title}</strong>
                          <div style="font-size:0.75rem; color:var(--a-muted);">${srv.badge || ''}</div>
                        </div>
                      </div>
                    </td>
                    <td>${srv.subtitle || '—'}</td>
                    <td><span class="a-badge a-badge-blue">${slidesCount} Slides</span></td>
                    <td>
                      <button class="a-btn a-btn-outline a-btn-sm btn-edit-srv" data-idx="${idx}"><i class="fa-solid fa-pen"></i> Edit</button>
                      <button class="a-btn a-btn-danger a-btn-sm btn-del-srv" data-idx="${idx}" style="margin-left:6px;"><i class="fa-solid fa-trash"></i></button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}
  `;
}

function bindServicesTabEvents() {
  document.querySelectorAll('.a-subtab-btn[data-subtab]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSubTab = btn.getAttribute('data-subtab');
      rerender();
    });
  });

  const d = ContentService.getData('services') || {};

  document.getElementById('a-add-srv-btn')?.addEventListener('click', () => {
    openModal('Add Service Block', `
      <div class="a-field"><label class="a-label">Service Title</label><input class="a-input" name="title" required /></div>
      <div class="a-field" style="margin-top:12px;"><label class="a-label">Subtitle / Focus</label><input class="a-input" name="subtitle" /></div>
      <div class="a-field" style="margin-top:12px;"><label class="a-label">Badge Pill Label</label><input class="a-input" name="badge" value="Core Capability" /></div>
      <div class="a-field" style="margin-top:12px;"><label class="a-label">Badge Color (blue / red)</label><input class="a-input" name="badgeColor" value="blue" /></div>
      <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Primary Description</label><textarea class="a-textarea" name="desc" required></textarea></div>
      <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Secondary Description (Optional)</label><textarea class="a-textarea" name="desc2"></textarea></div>
      <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Tags (comma separated)</label><input class="a-input" name="tags" placeholder="e.g. Mil-Spec, Direct Warranty, Stock Hub" /></div>
      ${renderImageUploadField('slide1', 'Slide Image 1', '', 'First slideshow photo')}
      <div class="a-field span2"><label class="a-label">Slide 1 Caption</label><input class="a-input" name="caption1" /></div>
      ${renderImageUploadField('slide2', 'Slide Image 2 (Optional)', '', 'Second slideshow photo')}
      <div class="a-field span2"><label class="a-label">Slide 2 Caption</label><input class="a-input" name="caption2" /></div>
    `, async (data) => {
      const items = d.items || [];
      const slides = [];
      if (data.slide1) slides.push({ image: data.slide1, caption: data.caption1 || '' });
      if (data.slide2) slides.push({ image: data.slide2, caption: data.caption2 || '' });
      if (!slides.length) slides.push({ image: '/images/hero-amplifier.jpg', caption: data.title });

      const tags = (data.tags || '').split(',').map(t => t.trim()).filter(Boolean);
      items.push({
        id: 'srv-' + Date.now(),
        title: data.title,
        subtitle: data.subtitle,
        badge: data.badge,
        badgeColor: data.badgeColor,
        desc: data.desc,
        desc2: data.desc2,
        tags,
        slides,
        ctaText: 'Explore More',
        ctaLink: '/products'
      });
      d.items = items;
      await ContentService.saveData('services', d);
    });
  });

  document.querySelectorAll('.btn-edit-srv').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const srv = d.items[idx];
      const s1 = srv.slides?.[0] || {};
      const s2 = srv.slides?.[1] || {};

      openModal('Edit Service Block', `
        <div class="a-field"><label class="a-label">Service Title</label><input class="a-input" name="title" value="${srv.title}" required /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Subtitle / Focus</label><input class="a-input" name="subtitle" value="${srv.subtitle || ''}" /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Badge Pill Label</label><input class="a-input" name="badge" value="${srv.badge || ''}" /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Badge Color (blue / red)</label><input class="a-input" name="badgeColor" value="${srv.badgeColor || 'blue'}" /></div>
        <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Primary Description</label><textarea class="a-textarea" name="desc" required>${srv.desc || ''}</textarea></div>
        <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Secondary Description (Optional)</label><textarea class="a-textarea" name="desc2">${srv.desc2 || ''}</textarea></div>
        <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Tags (comma separated)</label><input class="a-input" name="tags" value="${(srv.tags || []).join(', ')}" /></div>
        ${renderImageUploadField('slide1', 'Slide Image 1', s1.image || '', 'First slideshow photo')}
        <div class="a-field span2"><label class="a-label">Slide 1 Caption</label><input class="a-input" name="caption1" value="${s1.caption || ''}" /></div>
        ${renderImageUploadField('slide2', 'Slide Image 2', s2.image || '', 'Second slideshow photo')}
        <div class="a-field span2"><label class="a-label">Slide 2 Caption</label><input class="a-input" name="caption2" value="${s2.caption || ''}" /></div>
      `, async (data) => {
        const slides = [];
        if (data.slide1) slides.push({ image: data.slide1, caption: data.caption1 || '' });
        if (data.slide2) slides.push({ image: data.slide2, caption: data.caption2 || '' });
        // Preserve any remaining slides
        if (srv.slides && srv.slides.length > 2) {
          slides.push(...srv.slides.slice(2));
        }

        const tags = (data.tags || '').split(',').map(t => t.trim()).filter(Boolean);
        d.items[idx] = {
          ...srv,
          title: data.title,
          subtitle: data.subtitle,
          badge: data.badge,
          badgeColor: data.badgeColor,
          desc: data.desc,
          desc2: data.desc2,
          tags,
          slides: slides.length ? slides : srv.slides
        };
        await ContentService.saveData('services', d);
      });
    });
  });

  document.querySelectorAll('.btn-del-srv').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      if (!confirm('Delete this service block?')) return;
      btn.disabled = true;
      try {
        d.items.splice(idx, 1);
        await ContentService.saveData('services', d);
        rerender();
        showToast('Service block deleted.', 'info');
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed to delete service block: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });

  document.querySelectorAll('.btn-move-srv').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const dir = btn.getAttribute('data-dir');
      const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
      btn.disabled = true;
      try {
        d.items = reorderArray(d.items, idx, targetIdx);
        await ContentService.saveData('services', d);
        rerender();
        showToast('Service blocks reordered!', 'success');
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed to move service block: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });
}

// ─── PROJECTS PAGE EDITOR ────────────────────────────────────────────────────
function renderProjectsPageEditor() {
  const d = ContentService.getData('projects') || {};
  const items = d.items || [];

  return `
    <form id="a-page-form" style="margin-bottom:20px;">
      <div class="a-card">
        <div class="a-card-header"><div><h3>Projects Section Intro</h3><p>Section title and narrative lead</p></div></div>
        <div class="a-form-grid">
          <div class="a-field"><label class="a-label">Section Title</label><input class="a-input" name="heroTitle" value="${d.heroTitle || 'Featured Engineering Projects'}"></div>
          <div class="a-field"><label class="a-label">Section Subtitle</label><input class="a-input" name="heroSubtitle" value="${d.heroSubtitle || 'Mission-Ready Hardware Deployments'}"></div>
          <div class="a-field span2"><label class="a-label">Lead Paragraph</label><textarea class="a-textarea" name="heroLead">${d.heroLead || ''}</textarea></div>
        </div>
        <div style="display:flex; justify-content:flex-end; margin-top:14px;">
          <button type="submit" class="a-btn a-btn-primary a-btn-sm"><i class="fa-solid fa-floppy-disk"></i> Save Header</button>
        </div>
      </div>
    </form>

    <div class="a-cards-box">
      <div class="a-cards-box-header">
        <div>
          <h3>Engineering Project Cards (${items.length})</h3>
          <p>Add, edit, delete, and reorder defense, space &amp; microwave projects</p>
        </div>
        <button type="button" class="a-btn a-btn-primary a-btn-sm" id="a-add-proj-btn"><i class="fa-solid fa-plus"></i> Add New Project</button>
      </div>
      <div class="a-table-wrap">
        <table class="a-table">
          <thead><tr><th>Reorder</th><th>Cover</th><th>Project Title</th><th>Client / Sector</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${items.map((proj, idx) => {
              const img = ImageStorage.resolveImageUrl(proj.image);
              return `
                <tr>
                  <td style="width:90px;">
                    <div class="a-reorder-group">
                      <button class="a-btn-reorder btn-move-proj" data-dir="up" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                      <button class="a-btn-reorder btn-move-proj" data-dir="down" data-idx="${idx}" ${idx === items.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
                    </div>
                  </td>
                  <td>${img ? `<img src="${img}" class="a-img-preview" alt="Thumb" />` : '<span style="color:#94a3b8; font-size:0.75rem;">No image</span>'}</td>
                  <td><strong>${proj.title}</strong><div style="font-size:0.75rem; color:var(--a-muted);">${proj.category || ''}</div></td>
                  <td style="font-size:0.82rem;">${proj.clientSector || '—'}</td>
                  <td><span class="a-badge a-badge-green">${proj.status || 'Active'}</span></td>
                  <td>
                    <button class="a-btn a-btn-outline a-btn-sm btn-edit-proj" data-idx="${idx}"><i class="fa-solid fa-pen"></i> Edit</button>
                    <button class="a-btn a-btn-danger a-btn-sm btn-del-proj" data-idx="${idx}" style="margin-left:6px;"><i class="fa-solid fa-trash"></i></button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function bindProjectsTabEvents() {
  const d = ContentService.getData('projects') || {};

  document.getElementById('a-add-proj-btn')?.addEventListener('click', () => {
    openModal('Add Project Card', `
      <div class="a-field"><label class="a-label">Project Title</label><input class="a-input" name="title" required /></div>
      <div class="a-field" style="margin-top:12px;"><label class="a-label">Category (e.g. Defense & Radar)</label><input class="a-input" name="category" value="Defense & Radar" /></div>
      <div class="a-field" style="margin-top:12px;"><label class="a-label">Client / Sector</label><input class="a-input" name="clientSector" value="Aerospace & Defense" /></div>
      <div class="a-field" style="margin-top:12px;"><label class="a-label">Date / Timeline</label><input class="a-input" name="date" value="2026" /></div>
      <div class="a-field" style="margin-top:12px;"><label class="a-label">Status (e.g. Deployed, Flight Qualified)</label><input class="a-input" name="status" value="Deployed" /></div>
      <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Tags (comma separated)</label><input class="a-input" name="tags" placeholder="GaN SSPA, Cavity Filters, AESA" /></div>
      ${renderImageUploadField('image', 'Project Cover Photo', '', 'Hero hardware photo')}
      <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Description</label><textarea class="a-textarea" name="desc" required></textarea></div>
    `, async (data) => {
      const items = d.items || [];
      const tags = (data.tags || '').split(',').map(t => t.trim()).filter(Boolean);
      items.push({ id: 'proj-' + Date.now(), ...data, tags });
      d.items = items;
      await ContentService.saveData('projects', d);
    });
  });

  document.querySelectorAll('.btn-edit-proj').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const proj = d.items[idx];
      openModal('Edit Project Card', `
        <div class="a-field"><label class="a-label">Project Title</label><input class="a-input" name="title" value="${proj.title}" required /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Category</label><input class="a-input" name="category" value="${proj.category || ''}" /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Client / Sector</label><input class="a-input" name="clientSector" value="${proj.clientSector || ''}" /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Date / Timeline</label><input class="a-input" name="date" value="${proj.date || ''}" /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Status</label><input class="a-input" name="status" value="${proj.status || ''}" /></div>
        <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Tags (comma separated)</label><input class="a-input" name="tags" value="${(proj.tags || []).join(', ')}" /></div>
        ${renderImageUploadField('image', 'Project Cover Photo', proj.image || '', 'Hero hardware photo')}
        <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Description</label><textarea class="a-textarea" name="desc" required>${proj.desc || ''}</textarea></div>
      `, async (data) => {
        const tags = (data.tags || '').split(',').map(t => t.trim()).filter(Boolean);
        d.items[idx] = { ...proj, ...data, tags };
        await ContentService.saveData('projects', d);
      });
    });
  });

  document.querySelectorAll('.btn-del-proj').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      if (!confirm('Delete this project card?')) return;
      btn.disabled = true;
      try {
        d.items.splice(idx, 1);
        await ContentService.saveData('projects', d);
        rerender();
        showToast('Project deleted.', 'info');
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed to delete project: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });

  document.querySelectorAll('.btn-move-proj').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const dir = btn.getAttribute('data-dir');
      const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
      btn.disabled = true;
      try {
        d.items = reorderArray(d.items, idx, targetIdx);
        await ContentService.saveData('projects', d);
        rerender();
        showToast('Projects reordered!', 'success');
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed to move project: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });
}

// ─── GALLERY PAGE EDITOR ─────────────────────────────────────────────────────
function renderGalleryPageEditor() {
  const d = ContentService.getData('gallery') || {};
  const items = d.items || [];

  return `
    <form id="a-page-form" style="margin-bottom:20px;">
      <div class="a-card">
        <div class="a-card-header"><div><h3>Gallery Section Intro</h3><p>Page heading and gallery lead</p></div></div>
        <div class="a-form-grid">
          <div class="a-field"><label class="a-label">Section Title</label><input class="a-input" name="heroTitle" value="${d.heroTitle || 'Hardware & Facility Gallery'}"></div>
          <div class="a-field"><label class="a-label">Section Subtitle</label><input class="a-input" name="heroSubtitle" value="${d.heroSubtitle || 'High-Reliability Components & Systems'}"></div>
          <div class="a-field span2"><label class="a-label">Lead Paragraph</label><textarea class="a-textarea" name="heroLead">${d.heroLead || ''}</textarea></div>
        </div>
        <div style="display:flex; justify-content:flex-end; margin-top:14px;">
          <button type="submit" class="a-btn a-btn-primary a-btn-sm"><i class="fa-solid fa-floppy-disk"></i> Save Header</button>
        </div>
      </div>
    </form>

    <div class="a-cards-box">
      <div class="a-cards-box-header">
        <div>
          <h3>Hardware Gallery Items (${items.length})</h3>
          <p>Add, edit, delete, and reorder hardware photos and captions</p>
        </div>
        <button type="button" class="a-btn a-btn-primary a-btn-sm" id="a-add-gal-btn"><i class="fa-solid fa-plus"></i> Add Gallery Photo</button>
      </div>
      <div class="a-table-wrap">
        <table class="a-table">
          <thead><tr><th>Reorder</th><th>Photo</th><th>Item Title</th><th>Category</th><th>Caption</th><th>Actions</th></tr></thead>
          <tbody>
            ${items.map((gal, idx) => {
              const img = ImageStorage.resolveImageUrl(gal.image);
              return `
                <tr>
                  <td style="width:90px;">
                    <div class="a-reorder-group">
                      <button class="a-btn-reorder btn-move-gal" data-dir="up" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                      <button class="a-btn-reorder btn-move-gal" data-dir="down" data-idx="${idx}" ${idx === items.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
                    </div>
                  </td>
                  <td>${img ? `<img src="${img}" class="a-img-preview" alt="Thumb" />` : '<span style="color:#94a3b8; font-size:0.75rem;">No image</span>'}</td>
                  <td><strong>${gal.title}</strong></td>
                  <td><span class="a-badge a-badge-blue">${gal.category || 'Component'}</span></td>
                  <td style="font-size:0.82rem; color:var(--a-muted); max-width:260px;">${gal.caption || '—'}</td>
                  <td>
                    <button class="a-btn a-btn-outline a-btn-sm btn-edit-gal" data-idx="${idx}"><i class="fa-solid fa-pen"></i> Edit</button>
                    <button class="a-btn a-btn-danger a-btn-sm btn-del-gal" data-idx="${idx}" style="margin-left:6px;"><i class="fa-solid fa-trash"></i></button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function bindGalleryTabEvents() {
  const d = ContentService.getData('gallery') || {};

  document.getElementById('a-add-gal-btn')?.addEventListener('click', () => {
    openModal('Add Gallery Photo', `
      <div class="a-field"><label class="a-label">Item Title</label><input class="a-input" name="title" required /></div>
      <div class="a-field" style="margin-top:12px;"><label class="a-label">Category (e.g. Semiconductors, Passives, Systems)</label><input class="a-input" name="category" value="Semiconductors" /></div>
      ${renderImageUploadField('image', 'Hardware Photo', '', 'Upload or select image')}
      <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Caption / Description</label><input class="a-input" name="caption" /></div>
    `, async (data) => {
      const items = d.items || [];
      items.push({ id: 'gal-' + Date.now(), ...data });
      d.items = items;
      await ContentService.saveData('gallery', d);
    });
  });

  document.querySelectorAll('.btn-edit-gal').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const gal = d.items[idx];
      openModal('Edit Gallery Photo', `
        <div class="a-field"><label class="a-label">Item Title</label><input class="a-input" name="title" value="${gal.title}" required /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Category</label><input class="a-input" name="category" value="${gal.category || ''}" /></div>
        ${renderImageUploadField('image', 'Hardware Photo', gal.image || '', 'Upload or select image')}
        <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Caption / Description</label><input class="a-input" name="caption" value="${gal.caption || ''}" /></div>
      `, async (data) => {
        d.items[idx] = { ...gal, ...data };
        await ContentService.saveData('gallery', d);
      });
    });
  });

  document.querySelectorAll('.btn-del-gal').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      if (!confirm('Delete this gallery photo?')) return;
      btn.disabled = true;
      try {
        d.items.splice(idx, 1);
        await ContentService.saveData('gallery', d);
        rerender();
        showToast('Gallery photo deleted.', 'info');
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed to delete photo: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });

  document.querySelectorAll('.btn-move-gal').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const dir = btn.getAttribute('data-dir');
      const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
      btn.disabled = true;
      try {
        d.items = reorderArray(d.items, idx, targetIdx);
        await ContentService.saveData('gallery', d);
        rerender();
        showToast('Gallery reordered!', 'success');
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed to move photo: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });
}

// ─── TESTIMONIALS PAGE EDITOR ────────────────────────────────────────────────
function renderTestimonialsPageEditor() {
  const d = ContentService.getData('testimonials') || {};
  const items = d.items || [];

  return `
    <form id="a-page-form" style="margin-bottom:20px;">
      <div class="a-card">
        <div class="a-card-header"><div><h3>Testimonials Section Header</h3><p>Section title and endorsement lead</p></div></div>
        <div class="a-form-grid">
          <div class="a-field"><label class="a-label">Section Title</label><input class="a-input" name="heroTitle" value="${d.heroTitle || 'Trusted by Industry Leaders'}"></div>
          <div class="a-field"><label class="a-label">Section Subtitle</label><input class="a-input" name="heroSubtitle" value="${d.heroSubtitle || 'Client & Engineer Endorsements'}"></div>
          <div class="a-field span2"><label class="a-label">Lead Paragraph</label><textarea class="a-textarea" name="heroLead">${d.heroLead || ''}</textarea></div>
        </div>
        <div style="display:flex; justify-content:flex-end; margin-top:14px;">
          <button type="submit" class="a-btn a-btn-primary a-btn-sm"><i class="fa-solid fa-floppy-disk"></i> Save Header</button>
        </div>
      </div>
    </form>

    <div class="a-cards-box">
      <div class="a-cards-box-header">
        <div>
          <h3>Client Testimonial Cards (${items.length})</h3>
          <p>Add, edit, delete, and reorder scientist &amp; engineering endorsements</p>
        </div>
        <button type="button" class="a-btn a-btn-primary a-btn-sm" id="a-add-test-btn"><i class="fa-solid fa-plus"></i> Add Testimonial</button>
      </div>
      <div class="a-table-wrap">
        <table class="a-table">
          <thead><tr><th>Reorder</th><th>Avatar</th><th>Client Name</th><th>Role &amp; Company</th><th>Stars</th><th>Industry Tag</th><th>Actions</th></tr></thead>
          <tbody>
            ${items.map((t, idx) => {
              const avatar = ImageStorage.resolveImageUrl(t.avatar);
              return `
                <tr>
                  <td style="width:90px;">
                    <div class="a-reorder-group">
                      <button class="a-btn-reorder btn-move-test" data-dir="up" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                      <button class="a-btn-reorder btn-move-test" data-dir="down" data-idx="${idx}" ${idx === items.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
                    </div>
                  </td>
                  <td>${avatar ? `<img src="${avatar}" class="a-img-preview" alt="Avatar" style="width:40px; height:40px; border-radius:50%;" />` : '<div style="width:36px; height:36px; border-radius:50%; background:#e2e8f0; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.8rem;">' + (t.name ? t.name.substring(0,2).toUpperCase() : 'CL') + '</div>'}</td>
                  <td><strong>${t.name}</strong></td>
                  <td style="font-size:0.82rem; color:var(--a-muted);">${t.role} · ${t.company}</td>
                  <td><span style="color:#f59e0b;">${'★'.repeat(t.stars || 5)}</span></td>
                  <td><span class="a-badge a-badge-blue">${t.industry || 'Defense'}</span></td>
                  <td>
                    <button class="a-btn a-btn-outline a-btn-sm btn-edit-test" data-idx="${idx}"><i class="fa-solid fa-pen"></i> Edit</button>
                    <button class="a-btn a-btn-danger a-btn-sm btn-del-test" data-idx="${idx}" style="margin-left:6px;"><i class="fa-solid fa-trash"></i></button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function bindTestimonialsTabEvents() {
  const d = ContentService.getData('testimonials') || {};

  document.getElementById('a-add-test-btn')?.addEventListener('click', () => {
    openModal('Add Testimonial Card', `
      <div class="a-field"><label class="a-label">Client Name</label><input class="a-input" name="name" required /></div>
      <div class="a-field" style="margin-top:12px;"><label class="a-label">Role / Title</label><input class="a-input" name="role" required /></div>
      <div class="a-field" style="margin-top:12px;"><label class="a-label">Organization / Company</label><input class="a-input" name="company" required /></div>
      <div class="a-field" style="margin-top:12px;"><label class="a-label">Industry Tag (e.g. Radar & Defense EW)</label><input class="a-input" name="industry" value="Defense & Space" /></div>
      <div class="a-field" style="margin-top:12px;"><label class="a-label">Rating Stars (1-5)</label><input class="a-input" type="number" min="1" max="5" name="stars" value="5" /></div>
      ${renderImageUploadField('avatar', 'Client / OEM Avatar Photo', '', 'Upload avatar or logo')}
      <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Quote Endorsement</label><textarea class="a-textarea" name="quote" required></textarea></div>
    `, async (data) => {
      const items = d.items || [];
      items.push({ id: 'test-' + Date.now(), ...data, stars: parseInt(data.stars, 10) || 5 });
      d.items = items;
      await ContentService.saveData('testimonials', d);
    });
  });

  document.querySelectorAll('.btn-edit-test').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const t = d.items[idx];
      openModal('Edit Testimonial Card', `
        <div class="a-field"><label class="a-label">Client Name</label><input class="a-input" name="name" value="${t.name}" required /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Role / Title</label><input class="a-input" name="role" value="${t.role || ''}" required /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Organization / Company</label><input class="a-input" name="company" value="${t.company || ''}" required /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Industry Tag</label><input class="a-input" name="industry" value="${t.industry || ''}" /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Rating Stars (1-5)</label><input class="a-input" type="number" min="1" max="5" name="stars" value="${t.stars || 5}" /></div>
        ${renderImageUploadField('avatar', 'Client / OEM Avatar Photo', t.avatar || '', 'Upload avatar or logo')}
        <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Quote Endorsement</label><textarea class="a-textarea" name="quote" required>${t.quote || ''}</textarea></div>
      `, async (data) => {
        d.items[idx] = { ...t, ...data, stars: parseInt(data.stars, 10) || 5 };
        await ContentService.saveData('testimonials', d);
      });
    });
  });

  document.querySelectorAll('.btn-del-test').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      if (!confirm('Delete this testimonial?')) return;
      btn.disabled = true;
      try {
        d.items.splice(idx, 1);
        await ContentService.saveData('testimonials', d);
        rerender();
        showToast('Testimonial deleted.', 'info');
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed to delete testimonial: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });

  document.querySelectorAll('.btn-move-test').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const dir = btn.getAttribute('data-dir');
      const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
      btn.disabled = true;
      try {
        d.items = reorderArray(d.items, idx, targetIdx);
        await ContentService.saveData('testimonials', d);
        rerender();
        showToast('Testimonials reordered!', 'success');
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed to move testimonial: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });
}

// ─── CONTACT PAGE EDITOR ─────────────────────────────────────────────────────
function renderContactPageEditor() {
  const c = ContentService.getData('contact') || {};
  const presets = c.presets || [];
  const careers = c.careers || {};
  const benefits = careers.benefits || [];
  const positions = careers.positions || [];
  const experienceLevels = careers.experienceLevels || [];
  const noticeOptions = careers.noticeOptions || [];

  return `
    <div class="a-subtabs-nav">
      <button type="button" class="a-subtab-btn ${currentSubTab === 'fields' ? 'active' : ''}" data-subtab="fields"><i class="fa-solid fa-building"></i> Offices &amp; Contact Info</button>
      <button type="button" class="a-subtab-btn ${currentSubTab === 'presets' ? 'active' : ''}" data-subtab="presets"><i class="fa-solid fa-bolt"></i> Requirement Presets (${presets.length})</button>
      <button type="button" class="a-subtab-btn ${currentSubTab === 'careers' ? 'active' : ''}" data-subtab="careers"><i class="fa-solid fa-briefcase"></i> Careers &amp; Recruiting Management</button>
    </div>

    ${currentSubTab === 'fields' ? `
      <form id="a-page-form">
        <div class="a-card">
          <div class="a-card-header"><div><h3>Contact Page Headers</h3><p>RFQ and career tab headings</p></div></div>
          <div class="a-form-grid">
            <div class="a-field"><label class="a-label">Inquiry Hero Title</label><input class="a-input" name="heroTitle" value="${c.heroTitle || ''}"></div>
            <div class="a-field"><label class="a-label">Careers Hero Title</label><input class="a-input" name="careersTitle" value="${c.careersTitle || ''}"></div>
            <div class="a-field span2"><label class="a-label">Inquiry Lead</label><textarea class="a-textarea" name="heroLead">${c.heroLead || ''}</textarea></div>
            <div class="a-field span2"><label class="a-label">Careers Lead</label><textarea class="a-textarea" name="careersLead">${c.careersLead || ''}</textarea></div>
          </div>
        </div>

        <div class="a-card">
          <div class="a-card-header"><div><h3>Global Office Locations</h3><p>Displayed in contact page and site footer</p></div></div>
          <div class="a-form-grid">
            <div class="a-section-divider span2">India Office (Headquarters)</div>
            <div class="a-field"><label class="a-label">Office Name</label><input class="a-input" name="indiaOfficeName" value="${c.indiaOfficeName || ''}"></div>
            <div class="a-field"><label class="a-label">Telephone</label><input class="a-input" name="indiaPhone" value="${c.indiaPhone || ''}"></div>
            <div class="a-field span2"><label class="a-label">Address</label><textarea class="a-textarea" name="indiaAddress">${c.indiaAddress || ''}</textarea></div>
            <div class="a-field span2"><label class="a-label">Email</label><input class="a-input" name="indiaEmail" value="${c.indiaEmail || ''}"></div>

            <div class="a-section-divider span2">Singapore Office</div>
            <div class="a-field"><label class="a-label">Office Name</label><input class="a-input" name="singaporeOfficeName" value="${c.singaporeOfficeName || ''}"></div>
            <div class="a-field"><label class="a-label">Email</label><input class="a-input" name="singaporeEmail" value="${c.singaporeEmail || ''}"></div>
            <div class="a-field span2"><label class="a-label">Address</label><textarea class="a-textarea" name="singaporeAddress">${c.singaporeAddress || ''}</textarea></div>

            <div class="a-section-divider span2">USA Office</div>
            <div class="a-field"><label class="a-label">Office Name</label><input class="a-input" name="usaOfficeName" value="${c.usaOfficeName || ''}"></div>
            <div class="a-field"><label class="a-label">Telephone</label><input class="a-input" name="usaPhone" value="${c.usaPhone || ''}"></div>
            <div class="a-field span2"><label class="a-label">Address</label><textarea class="a-textarea" name="usaAddress">${c.usaAddress || ''}</textarea></div>
            <div class="a-field span2"><label class="a-label">Email</label><input class="a-input" name="usaEmail" value="${c.usaEmail || ''}"></div>

            <div class="a-section-divider span2">Operating Hours</div>
            <div class="a-field"><label class="a-label">Weekday Hours</label><input class="a-input" name="hoursWeekday" value="${c.hoursWeekday || ''}"></div>
            <div class="a-field"><label class="a-label">Weekend Hours</label><input class="a-input" name="hoursWeekend" value="${c.hoursWeekend || ''}"></div>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button type="submit" class="a-btn a-btn-primary"><i class="fa-solid fa-floppy-disk"></i> Save Contact Info</button>
        </div>
      </form>
    ` : ''}

    ${currentSubTab === 'presets' ? `
      <div class="a-cards-box">
        <div class="a-cards-box-header">
          <div>
            <h3>Quick Requirement Presets (${presets.length})</h3>
            <p>One-click inquiry messages displayed on Home and Contact forms</p>
          </div>
          <button type="button" class="a-btn a-btn-primary a-btn-sm" id="a-add-preset-btn"><i class="fa-solid fa-plus"></i> Add Preset</button>
        </div>
        <div class="a-table-wrap">
          <table class="a-table">
            <thead><tr><th>Reorder</th><th>Preset Message</th><th>Actions</th></tr></thead>
            <tbody>
              ${presets.map((p, idx) => `
                <tr>
                  <td style="width:90px;">
                    <div class="a-reorder-group">
                      <button class="a-btn-reorder btn-move-preset" data-dir="up" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                      <button class="a-btn-reorder btn-move-preset" data-dir="down" data-idx="${idx}" ${idx === presets.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
                    </div>
                  </td>
                  <td><strong>${p}</strong></td>
                  <td>
                    <button class="a-btn a-btn-outline a-btn-sm btn-edit-preset" data-idx="${idx}"><i class="fa-solid fa-pen"></i> Edit</button>
                    <button class="a-btn a-btn-danger a-btn-sm btn-del-preset" data-idx="${idx}" style="margin-left:6px;"><i class="fa-solid fa-trash"></i></button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}

    ${currentSubTab === 'careers' ? `
      <!-- Card 1: Tab Navigation, Hero & Badges -->
      <form id="a-careers-hero-form">
        <div class="a-card">
          <div class="a-card-header">
            <div>
              <h3>Hero, Header Tabs &amp; Hiring Badges</h3>
              <p>Customize tab buttons, navigation badges, and hero titles on Contact &amp; Careers page</p>
            </div>
            <button type="submit" class="a-btn a-btn-primary a-btn-sm"><i class="fa-solid fa-floppy-disk"></i> Save Header &amp; Hero</button>
          </div>
          <div class="a-form-grid">
            <div class="a-field">
              <label class="a-label">Careers Tab Button Label</label>
              <input class="a-input" name="tabLabelCareers" value="${careers.tabLabelCareers || 'Careers &amp; Recruiting'}" required>
            </div>
            <div class="a-field">
              <label class="a-label">Sales Tab Button Label</label>
              <input class="a-input" name="tabLabelSales" value="${careers.tabLabelSales || 'Sales &amp; RFQ Inquiry'}" required>
            </div>
            <div class="a-field">
              <label class="a-label">Breadcrumb Text</label>
              <input class="a-input" name="breadcrumbCareers" value="${careers.breadcrumbCareers || 'Careers &amp; Recruiting'}" required>
            </div>
            <div class="a-field">
              <label class="a-label">Hero Eyebrow Text</label>
              <input class="a-input" name="eyebrowCareers" value="${careers.eyebrowCareers || 'ICON TALENT ACQUISITION'}">
            </div>
            <div class="a-field span2">
              <label class="a-label">Hero Main Title</label>
              <input class="a-input" name="careersTitle" value="${careers.careersTitle || ''}" required>
            </div>
            <div class="a-field span2">
              <label class="a-label">Hero Lead Paragraph / Subtitle</label>
              <textarea class="a-textarea" name="careersLead" rows="2" required>${careers.careersLead || ''}</textarea>
            </div>
            <div class="a-field">
              <label class="a-checkbox-row" style="margin-top:6px;">
                <input type="checkbox" name="showHiringBadge" ${careers.showHiringBadge !== false ? 'checked' : ''}>
                <span>Display "We're Hiring" Badge on Tab</span>
              </label>
            </div>
            <div class="a-field">
              <label class="a-label">Hiring Badge Text</label>
              <input class="a-input" name="hiringBadgeText" value="${careers.hiringBadgeText || "We're Hiring"}">
            </div>
            ${renderImageUploadField('careersHeroImage', 'Careers Hero / Team Photo (Optional)', careers.careersHeroImage || '', 'Upload photo of engineering team, lab, or office')}
          </div>
        </div>
      </form>

      <!-- Card 2: Company Intro & Benefits -->
      <form id="a-careers-intro-form" style="margin-top:20px;">
        <div class="a-card">
          <div class="a-card-header">
            <div>
              <h3>"Why Build Your Career at ICON?" Introduction</h3>
              <p>Introductory copy displayed in the left column on the Careers tab</p>
            </div>
            <button type="submit" class="a-btn a-btn-primary a-btn-sm"><i class="fa-solid fa-floppy-disk"></i> Save Intro Copy</button>
          </div>
          <div class="a-form-grid">
            <div class="a-field">
              <label class="a-label">Intro Heading</label>
              <input class="a-input" name="introTitle" value="${careers.introTitle || 'Why Build Your Career at ICON?'}" required>
            </div>
            <div class="a-field">
              <label class="a-label">Intro Subtitle / Tagline</label>
              <input class="a-input" name="introSubtitle" value="${careers.introSubtitle || 'RF &amp; MICROWAVE EXCELLENCE'}">
            </div>
            <div class="a-field">
              <label class="a-label">Header Icon (FontAwesome class)</label>
              <input class="a-input" name="introIcon" value="${careers.introIcon || 'fa-solid fa-users'}">
            </div>
            <div class="a-field span2">
              <label class="a-label">Intro Description Paragraph</label>
              <textarea class="a-textarea" name="introDescription" rows="3" required>${careers.introDescription || ''}</textarea>
            </div>
          </div>
        </div>
      </form>

      <!-- Benefits Table -->
      <div class="a-cards-box" style="margin-top:20px;">
        <div class="a-cards-box-header">
          <div>
            <h3>Why Join Us Benefits &amp; Perks (${benefits.length})</h3>
            <p>Reorderable highlight cards showcasing engineering culture, labs, and OEM access</p>
          </div>
          <button type="button" class="a-btn a-btn-primary a-btn-sm" id="a-add-benefit-btn"><i class="fa-solid fa-plus"></i> Add Benefit</button>
        </div>
        <div class="a-table-wrap">
          <table class="a-table">
            <thead><tr><th>Reorder</th><th>Icon</th><th>Title</th><th>Description</th><th>Actions</th></tr></thead>
            <tbody>
              ${benefits.map((b, idx) => `
                <tr>
                  <td style="width:90px;">
                    <div class="a-reorder-group">
                      <button class="a-btn-reorder btn-move-benefit" data-dir="up" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                      <button class="a-btn-reorder btn-move-benefit" data-dir="down" data-idx="${idx}" ${idx === benefits.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
                    </div>
                  </td>
                  <td>
                    <div class="a-icon-preview-badge" style="color:${b.iconColor || '#3b82f6'};">
                      <i class="${b.icon || 'fa-solid fa-star'}"></i>
                    </div>
                  </td>
                  <td><strong>${b.title}</strong></td>
                  <td style="font-size:0.8rem;color:var(--a-muted);max-width:320px;">${b.description || ''}</td>
                  <td>
                    <button class="a-btn a-btn-outline a-btn-sm btn-edit-benefit" data-idx="${idx}"><i class="fa-solid fa-pen"></i> Edit</button>
                    <button class="a-btn a-btn-danger a-btn-sm btn-del-benefit" data-idx="${idx}" style="margin-left:6px;"><i class="fa-solid fa-trash"></i></button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Card 3: Application Form Fields, Validation & Upload Rules -->
      <form id="a-careers-form-config" style="margin-top:20px;">
        <div class="a-card">
          <div class="a-card-header">
            <div>
              <h3>Application Form Header &amp; Fields Configuration</h3>
              <p>Customize form title, badges, labels, placeholders, and required validation rules</p>
            </div>
            <button type="submit" class="a-btn a-btn-primary a-btn-sm"><i class="fa-solid fa-floppy-disk"></i> Save Form Settings</button>
          </div>

          <div class="a-form-grid">
            <div class="a-section-divider span2">Top Form Banner &amp; Heading</div>
            <div class="a-field">
              <label class="a-checkbox-row" style="margin-top:6px;">
                <input type="checkbox" name="showFormBadge" ${careers.showFormBadge !== false ? 'checked' : ''}>
                <span>Display Talent Acquisition Badge</span>
              </label>
            </div>
            <div class="a-field">
              <label class="a-label">Form Badge Text</label>
              <input class="a-input" name="formBadgeText" value="${careers.formBadgeText || 'Talent Acquisition · Bengaluru &amp; Pan-India'}">
            </div>
            <div class="a-field">
              <label class="a-label">Form Badge Icon (FontAwesome class)</label>
              <input class="a-input" name="formBadgeIcon" value="${careers.formBadgeIcon || 'fa-solid fa-briefcase'}">
            </div>
            <div class="a-field">
              <label class="a-label">Form Main Heading</label>
              <input class="a-input" name="formTitle" value="${careers.formTitle || 'Apply for an Engineering Career'}" required>
            </div>
            <div class="a-field span2">
              <label class="a-label">Form Subtitle / Instructions</label>
              <textarea class="a-textarea" name="formSubtitle" rows="2" required>${careers.formSubtitle || ''}</textarea>
            </div>

            <div class="a-section-divider span2">Field Labels, Placeholders &amp; Required Toggles</div>

            <!-- Full Name -->
            <div class="a-field">
              <label class="a-label">Full Name Field Label</label>
              <input class="a-input" name="nameLabel" value="${careers.nameLabel || 'Full Name *'}" required>
            </div>
            <div class="a-field">
              <label class="a-label">Full Name Placeholder</label>
              <input class="a-input" name="namePlaceholder" value="${careers.namePlaceholder || 'e.g. Vikram Sharma'}">
            </div>
            <div class="a-field span2">
              <label class="a-checkbox-row">
                <input type="checkbox" name="nameRequired" ${careers.nameRequired !== false ? 'checked' : ''}>
                <span>Full Name is Required</span>
              </label>
            </div>

            <!-- Email Address -->
            <div class="a-field">
              <label class="a-label">Email Field Label</label>
              <input class="a-input" name="emailLabel" value="${careers.emailLabel || 'Email Address *'}" required>
            </div>
            <div class="a-field">
              <label class="a-label">Email Placeholder</label>
              <input class="a-input" name="emailPlaceholder" value="${careers.emailPlaceholder || 'vikram.sharma@example.com'}">
            </div>
            <div class="a-field span2">
              <label class="a-checkbox-row">
                <input type="checkbox" name="emailRequired" ${careers.emailRequired !== false ? 'checked' : ''}>
                <span>Email Address is Required</span>
              </label>
            </div>

            <!-- Position -->
            <div class="a-field">
              <label class="a-label">Position Dropdown Label</label>
              <input class="a-input" name="positionLabel" value="${careers.positionLabel || 'Position *'}" required>
            </div>
            <div class="a-field">
              <label class="a-label">Position Default Option Text</label>
              <input class="a-input" name="positionPlaceholder" value="${careers.positionPlaceholder || 'Select Position...'}">
            </div>
            <div class="a-field span2">
              <label class="a-checkbox-row">
                <input type="checkbox" name="positionRequired" ${careers.positionRequired !== false ? 'checked' : ''}>
                <span>Position Selection is Required</span>
              </label>
            </div>

            <!-- Phone -->
            <div class="a-field">
              <label class="a-label">Phone Field Label</label>
              <input class="a-input" name="phoneLabel" value="${careers.phoneLabel || 'Phone / Mobile Number *'}" required>
            </div>
            <div class="a-field">
              <label class="a-label">Phone Placeholder</label>
              <input class="a-input" name="phonePlaceholder" value="${careers.phonePlaceholder || '+91 98765 43210'}">
            </div>
            <div class="a-field span2">
              <label class="a-checkbox-row">
                <input type="checkbox" name="phoneRequired" ${careers.phoneRequired !== false ? 'checked' : ''}>
                <span>Phone / Mobile Number is Required</span>
              </label>
            </div>

            <!-- Location / City -->
            <div class="a-field">
              <label class="a-label">Location Field Label</label>
              <input class="a-input" name="cityLabel" value="${careers.cityLabel || 'Current Location / City *'}" required>
            </div>
            <div class="a-field">
              <label class="a-label">Location Placeholder</label>
              <input class="a-input" name="cityPlaceholder" value="${careers.cityPlaceholder || 'e.g. Bengaluru, Hyderabad, Pune, Chennai'}">
            </div>
            <div class="a-field span2">
              <label class="a-checkbox-row">
                <input type="checkbox" name="cityRequired" ${careers.cityRequired !== false ? 'checked' : ''}>
                <span>Location / City is Required</span>
              </label>
            </div>

            <!-- Experience Level -->
            <div class="a-field">
              <label class="a-label">Experience Dropdown Label</label>
              <input class="a-input" name="experienceLabel" value="${careers.experienceLabel || 'Total Experience *'}" required>
            </div>
            <div class="a-field">
              <label class="a-label">Experience Default Option Text</label>
              <input class="a-input" name="experiencePlaceholder" value="${careers.experiencePlaceholder || 'Select experience level...'}">
            </div>
            <div class="a-field span2">
              <label class="a-checkbox-row">
                <input type="checkbox" name="experienceRequired" ${careers.experienceRequired !== false ? 'checked' : ''}>
                <span>Experience Level is Required</span>
              </label>
            </div>

            <!-- Current Company -->
            <div class="a-field">
              <label class="a-label">Company / University Label</label>
              <input class="a-input" name="organizationLabel" value="${careers.organizationLabel || 'Current Company or University *'}" required>
            </div>
            <div class="a-field">
              <label class="a-label">Company / University Placeholder</label>
              <input class="a-input" name="organizationPlaceholder" value="${careers.organizationPlaceholder || 'e.g. BEL, DRDO, Astra Microwave, IISc, IIT'}">
            </div>
            <div class="a-field span2">
              <label class="a-checkbox-row">
                <input type="checkbox" name="organizationRequired" ${careers.organizationRequired !== false ? 'checked' : ''}>
                <span>Current Company or University is Required</span>
              </label>
            </div>

            <!-- Notice Period -->
            <div class="a-field">
              <label class="a-label">Notice Period Field Label</label>
              <input class="a-input" name="noticeLabel" value="${careers.noticeLabel || 'Notice Period / Earliest Availability *'}" required>
            </div>
            <div class="a-field">
              <label class="a-checkbox-row" style="margin-top:24px;">
                <input type="checkbox" name="noticeRequired" ${careers.noticeRequired !== false ? 'checked' : ''}>
                <span>Notice Period is Required</span>
              </label>
            </div>

            <!-- Technical Skills -->
            <div class="a-field">
              <label class="a-label">Skills Field Label</label>
              <input class="a-input" name="skillsLabel" value="${careers.skillsLabel || 'Key Technical Skills &amp; RF EDA Tools *'}" required>
            </div>
            <div class="a-field">
              <label class="a-label">Skills Field Placeholder</label>
              <input class="a-input" name="skillsPlaceholder" value="${careers.skillsPlaceholder || 'e.g. Keysight ADS, Ansys HFSS, CST Microwave Studio...'}">
            </div>
            <div class="a-field span2">
              <label class="a-checkbox-row">
                <input type="checkbox" name="skillsRequired" ${careers.skillsRequired !== false ? 'checked' : ''}>
                <span>Technical Skills Field is Required</span>
              </label>
            </div>

            <!-- LinkedIn -->
            <div class="a-field">
              <label class="a-label">LinkedIn Field Label</label>
              <input class="a-input" name="linkedinLabel" value="${careers.linkedinLabel || 'LinkedIn Profile or Online Portfolio'}">
            </div>
            <div class="a-field">
              <label class="a-label">LinkedIn Placeholder</label>
              <input class="a-input" name="linkedinPlaceholder" value="${careers.linkedinPlaceholder || 'https://linkedin.com/in/username'}">
            </div>
            <div class="a-field">
              <label class="a-checkbox-row">
                <input type="checkbox" name="showLinkedin" ${careers.showLinkedin !== false ? 'checked' : ''}>
                <span>Display LinkedIn / Portfolio Field</span>
              </label>
            </div>
            <div class="a-field">
              <label class="a-checkbox-row">
                <input type="checkbox" name="linkedinRequired" ${careers.linkedinRequired ? 'checked' : ''}>
                <span>LinkedIn URL is Required</span>
              </label>
            </div>

            <!-- Statement -->
            <div class="a-field span2">
              <label class="a-label">Candidate Statement Field Label</label>
              <input class="a-input" name="statementLabel" value="${careers.statementLabel || 'Candidate Statement / Why ICON Electromatic? *'}" required>
            </div>
            <div class="a-field span2">
              <label class="a-label">Statement Placeholder</label>
              <textarea class="a-textarea" name="statementPlaceholder" rows="2">${careers.statementPlaceholder || ''}</textarea>
            </div>
            <div class="a-field span2">
              <label class="a-checkbox-row">
                <input type="checkbox" name="statementRequired" ${careers.statementRequired !== false ? 'checked' : ''}>
                <span>Candidate Statement is Required</span>
              </label>
            </div>

            <div class="a-section-divider span2">Resume Upload Controls &amp; Settings</div>
            <div class="a-field">
              <label class="a-label">Resume Upload Label</label>
              <input class="a-input" name="resumeLabel" value="${careers.resumeLabel || 'Resume / Curriculum Vitae (PDF / DOCX) *'}" required>
            </div>
            <div class="a-field">
              <label class="a-label">Dropzone Help / Instruction Text</label>
              <input class="a-input" name="resumeHelpText" value="${careers.resumeHelpText || 'Click or drop resume file (PDF/DOCX, max 10MB)'}">
            </div>
            <div class="a-field">
              <label class="a-label">Accepted File Types (Comma separated)</label>
              <input class="a-input" name="resumeAcceptedExtensions" value="${careers.resumeAcceptedExtensions || '.pdf,.doc,.docx'}" required>
            </div>
            <div class="a-field">
              <label class="a-label">Max Allowed File Size (Megabytes)</label>
              <input class="a-input" type="number" min="1" max="100" name="resumeMaxSizeMb" value="${careers.resumeMaxSizeMb || 10}" required>
            </div>
            <div class="a-field">
              <label class="a-label">Resume Format Error Message (Use {types})</label>
              <input class="a-input" name="resumeFormatErrorMessage" value="${careers.resumeFormatErrorMessage || 'Invalid file format. Please upload an accepted file type: {types}'}">
            </div>
            <div class="a-field">
              <label class="a-label">Resume Size Limit Error Message (Use {size} and {max})</label>
              <input class="a-input" name="resumeSizeErrorMessage" value="${careers.resumeSizeErrorMessage || 'File size ({size} MB) exceeds the maximum allowed limit of {max} MB.'}">
            </div>
            <div class="a-field span2">
              <label class="a-checkbox-row">
                <input type="checkbox" name="resumeRequired" ${careers.resumeRequired !== false ? 'checked' : ''}>
                <span>Resume File Attachment is Required</span>
              </label>
            </div>

            <div class="a-section-divider span2">Submit Button Configuration</div>
            <div class="a-field">
              <label class="a-label">Submit Button Text</label>
              <input class="a-input" name="submitButtonText" value="${careers.submitButtonText || 'Submit Engineering Application'}" required>
            </div>
            <div class="a-field">
              <label class="a-label">Submit Button Icon (FontAwesome class)</label>
              <input class="a-input" name="submitButtonIcon" value="${careers.submitButtonIcon || 'fa-solid fa-briefcase'}">
            </div>
          </div>
        </div>
      </form>

      <!-- Card 4: Open Job Positions -->
      <div class="a-cards-box" style="margin-top:20px;">
        <div class="a-cards-box-header">
          <div>
            <h3>Open Engineering Positions (${positions.length})</h3>
            <p>Manage job titles in the Position dropdown on the public application form</p>
          </div>
          <button type="button" class="a-btn a-btn-primary a-btn-sm" id="a-add-position-btn"><i class="fa-solid fa-plus"></i> Add Position</button>
        </div>
        <div class="a-table-wrap">
          <table class="a-table">
            <thead><tr><th>Reorder</th><th>Position Title</th><th>Actions</th></tr></thead>
            <tbody>
              ${positions.map((pos, idx) => `
                <tr>
                  <td style="width:90px;">
                    <div class="a-reorder-group">
                      <button class="a-btn-reorder btn-move-pos" data-dir="up" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                      <button class="a-btn-reorder btn-move-pos" data-dir="down" data-idx="${idx}" ${idx === positions.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
                    </div>
                  </td>
                  <td><strong>${pos}</strong></td>
                  <td>
                    <button class="a-btn a-btn-outline a-btn-sm btn-edit-pos" data-idx="${idx}"><i class="fa-solid fa-pen"></i> Edit</button>
                    <button class="a-btn a-btn-danger a-btn-sm btn-del-pos" data-idx="${idx}" style="margin-left:6px;"><i class="fa-solid fa-trash"></i></button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Card 5: Experience Levels & Notice Periods -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 20px; margin-top:20px;">
        <!-- Experience Levels -->
        <div class="a-cards-box">
          <div class="a-cards-box-header">
            <div>
              <h3>Experience Levels (${experienceLevels.length})</h3>
              <p>Seniority options in application dropdown</p>
            </div>
            <button type="button" class="a-btn a-btn-primary a-btn-sm" id="a-add-exp-btn"><i class="fa-solid fa-plus"></i> Add Level</button>
          </div>
          <div class="a-table-wrap">
            <table class="a-table">
              <thead><tr><th>Reorder</th><th>Experience Bracket</th><th>Actions</th></tr></thead>
              <tbody>
                ${experienceLevels.map((exp, idx) => `
                  <tr>
                    <td style="width:90px;">
                      <div class="a-reorder-group">
                        <button class="a-btn-reorder btn-move-exp" data-dir="up" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                        <button class="a-btn-reorder btn-move-exp" data-dir="down" data-idx="${idx}" ${idx === experienceLevels.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
                      </div>
                    </td>
                    <td><strong>${exp}</strong></td>
                    <td>
                      <button class="a-btn a-btn-outline a-btn-sm btn-edit-exp" data-idx="${idx}"><i class="fa-solid fa-pen"></i></button>
                      <button class="a-btn a-btn-danger a-btn-sm btn-del-exp" data-idx="${idx}" style="margin-left:4px;"><i class="fa-solid fa-trash"></i></button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Notice Periods -->
        <div class="a-cards-box">
          <div class="a-cards-box-header">
            <div>
              <h3>Notice Period Options (${noticeOptions.length})</h3>
              <p>Candidate availability window options</p>
            </div>
            <button type="button" class="a-btn a-btn-primary a-btn-sm" id="a-add-notice-btn"><i class="fa-solid fa-plus"></i> Add Option</button>
          </div>
          <div class="a-table-wrap">
            <table class="a-table">
              <thead><tr><th>Reorder</th><th>Availability Window</th><th>Actions</th></tr></thead>
              <tbody>
                ${noticeOptions.map((notc, idx) => `
                  <tr>
                    <td style="width:90px;">
                      <div class="a-reorder-group">
                        <button class="a-btn-reorder btn-move-notice" data-dir="up" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                        <button class="a-btn-reorder btn-move-notice" data-dir="down" data-idx="${idx}" ${idx === noticeOptions.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
                      </div>
                    </td>
                    <td><strong>${notc}</strong></td>
                    <td>
                      <button class="a-btn a-btn-outline a-btn-sm btn-edit-notice" data-idx="${idx}"><i class="fa-solid fa-pen"></i></button>
                      <button class="a-btn a-btn-danger a-btn-sm btn-del-notice" data-idx="${idx}" style="margin-left:4px;"><i class="fa-solid fa-trash"></i></button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Card 6: Application Confirmation & Success Message -->
      <form id="a-careers-success-form" style="margin-top:20px;">
        <div class="a-card">
          <div class="a-card-header">
            <div>
              <h3>Submission Success Screen &amp; Candidate Messages</h3>
              <p>Customize confirmation modal, candidate reference prefix, and next steps contact instructions</p>
            </div>
            <button type="submit" class="a-btn a-btn-primary a-btn-sm"><i class="fa-solid fa-floppy-disk"></i> Save Confirmation Settings</button>
          </div>
          <div class="a-form-grid">
            <div class="a-field">
              <label class="a-label">Success Screen Main Title</label>
              <input class="a-input" name="successTitle" value="${careers.successTitle || 'Application Received!'}" required>
            </div>
            <div class="a-field">
              <label class="a-label">Greeting Template (Use {name})</label>
              <input class="a-input" name="successSubtitle" value="${careers.successSubtitle || 'Thank you, {name}.'}" required>
            </div>
            <div class="a-field span2">
              <label class="a-label">Confirmation Body Message (Use {name} and {position})</label>
              <textarea class="a-textarea" name="successMessage" rows="2" required>${careers.successMessage || ''}</textarea>
            </div>
            <div class="a-field">
              <label class="a-label">Candidate Application ID Prefix</label>
              <input class="a-input" name="candidateIdPrefix" value="${careers.candidateIdPrefix || 'ICON-CAREER-'}" required>
            </div>
            <div class="a-field">
              <label class="a-label">Talent Acquisition Email</label>
              <input class="a-input" name="careersEmail" value="${careers.careersEmail || 'careers@iconelectromatic.com'}" required>
            </div>
            <div class="a-field">
              <label class="a-label">Next Steps Section Title</label>
              <input class="a-input" name="nextStepsTitle" value="${careers.nextStepsTitle || 'Next Steps:'}" required>
            </div>
            <div class="a-field">
              <label class="a-label">Submit Another Button Text</label>
              <input class="a-input" name="resetButtonText" value="${careers.resetButtonText || 'Submit Another Application'}" required>
            </div>
            <div class="a-field span2">
              <label class="a-label">Next Steps Guidance Text</label>
              <textarea class="a-textarea" name="nextStepsText" rows="3" required>${careers.nextStepsText || ''}</textarea>
            </div>
            <div class="a-field span2">
              <label class="a-label">Form Validation Error Message (Shown if required fields are missing)</label>
              <input class="a-input" name="validationErrorMessage" value="${careers.validationErrorMessage || 'Please complete all required fields and attach your resume before submitting.'}">
            </div>
            <div class="a-field span2">
              <label class="a-label">General Submission Error Message</label>
              <input class="a-input" name="errorMessage" value="${careers.errorMessage || 'An error occurred while submitting your application. Please check your connection and try again.'}">
            </div>
          </div>
        </div>
      </form>
    ` : ''}
  `;
}

function bindContactTabEvents() {
  document.querySelectorAll('.a-subtab-btn[data-subtab]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSubTab = btn.getAttribute('data-subtab');
      rerender();
    });
  });

  const c = ContentService.getData('contact') || {};
  const careers = c.careers || {};

  // Presets Handlers
  document.getElementById('a-add-preset-btn')?.addEventListener('click', () => {
    openModal('Add Quick Requirement Preset', `
      <div class="a-field"><label class="a-label">Preset Message Text</label><input class="a-input" name="text" placeholder="e.g. Inquiring about High Power GaN Device and Beamforming IC." required /></div>
    `, async (data) => {
      const presets = c.presets || [];
      presets.push(data.text);
      c.presets = presets;
      await ContentService.saveData('contact', c);
    });
  });

  document.querySelectorAll('.btn-edit-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const text = c.presets[idx];
      openModal('Edit Requirement Preset', `
        <div class="a-field"><label class="a-label">Preset Message Text</label><input class="a-input" name="text" value="${text}" required /></div>
      `, async (data) => {
        c.presets[idx] = data.text;
        await ContentService.saveData('contact', c);
      });
    });
  });

  document.querySelectorAll('.btn-del-preset').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      if (!confirm('Delete this preset?')) return;
      btn.disabled = true;
      try {
        c.presets.splice(idx, 1);
        await ContentService.saveData('contact', c);
        rerender();
        showToast('Preset deleted.', 'info');
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed to delete preset: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });

  document.querySelectorAll('.btn-move-preset').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const dir = btn.getAttribute('data-dir');
      const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
      btn.disabled = true;
      try {
        c.presets = reorderArray(c.presets, idx, targetIdx);
        await ContentService.saveData('contact', c);
        rerender();
        showToast('Presets reordered!', 'success');
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed to move preset: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });

  // ─── Careers Forms & Action Handlers ───
  function handleCareersFormSave(formId, processFormData) {
    const form = document.getElementById(formId);
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      try {
        const currentContact = ContentService.getData('contact') || {};
        const currentCareers = currentContact.careers || {};
        const fd = new FormData(form);
        const updated = { ...currentCareers };
        fd.forEach((v, k) => { updated[k] = v; });
        if (processFormData) processFormData(form, updated);
        currentContact.careers = updated;
        if (updated.careersTitle) currentContact.careersTitle = updated.careersTitle;
        if (updated.careersLead) currentContact.careersLead = updated.careersLead;
        await ContentService.saveData('contact', currentContact);
        rerender();
        showToast('Careers settings saved successfully!', 'success');
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed to save careers settings: ' + err.message, 'error');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  handleCareersFormSave('a-careers-hero-form', (form, updated) => {
    updated.showHiringBadge = form.querySelector('[name="showHiringBadge"]')?.checked || false;
  });

  handleCareersFormSave('a-careers-intro-form');

  handleCareersFormSave('a-careers-form-config', (form, updated) => {
    updated.showFormBadge = form.querySelector('[name="showFormBadge"]')?.checked || false;
    updated.nameRequired = form.querySelector('[name="nameRequired"]')?.checked || false;
    updated.emailRequired = form.querySelector('[name="emailRequired"]')?.checked || false;
    updated.positionRequired = form.querySelector('[name="positionRequired"]')?.checked || false;
    updated.phoneRequired = form.querySelector('[name="phoneRequired"]')?.checked || false;
    updated.cityRequired = form.querySelector('[name="cityRequired"]')?.checked || false;
    updated.experienceRequired = form.querySelector('[name="experienceRequired"]')?.checked || false;
    updated.organizationRequired = form.querySelector('[name="organizationRequired"]')?.checked || false;
    updated.noticeRequired = form.querySelector('[name="noticeRequired"]')?.checked || false;
    updated.skillsRequired = form.querySelector('[name="skillsRequired"]')?.checked || false;
    updated.showLinkedin = form.querySelector('[name="showLinkedin"]')?.checked || false;
    updated.linkedinRequired = form.querySelector('[name="linkedinRequired"]')?.checked || false;
    updated.statementRequired = form.querySelector('[name="statementRequired"]')?.checked || false;
    updated.resumeRequired = form.querySelector('[name="resumeRequired"]')?.checked || false;
    updated.resumeMaxSizeMb = Number(updated.resumeMaxSizeMb) || 10;
  });

  handleCareersFormSave('a-careers-success-form');

  // Benefits CRUD
  document.getElementById('a-add-benefit-btn')?.addEventListener('click', () => {
    openModal('Add Why Join Benefit Card', `
      <div class="a-field"><label class="a-label">Benefit Title</label><input class="a-input" name="title" placeholder="e.g. Cutting-Edge mmWave Lab" required /></div>
      <div class="a-field" style="margin-top:12px;"><label class="a-label">Icon Class (FontAwesome)</label><input class="a-input" name="icon" value="fa-solid fa-microchip" required /></div>
      <div class="a-field" style="margin-top:12px;"><label class="a-label">Icon Color (Hex / CSS)</label><input class="a-input" name="iconColor" value="#3b82f6" /></div>
      <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Benefit Description</label><textarea class="a-textarea" name="description" rows="3" required></textarea></div>
    `, async (data) => {
      const currentContact = ContentService.getData('contact') || {};
      const currentCareers = currentContact.careers || {};
      const list = currentCareers.benefits || [];
      list.push({ id: 'ben-' + Date.now(), ...data });
      currentCareers.benefits = list;
      currentContact.careers = currentCareers;
      await ContentService.saveData('contact', currentContact);
    });
  });

  document.querySelectorAll('.btn-edit-benefit').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const currentContact = ContentService.getData('contact') || {};
      const currentCareers = currentContact.careers || {};
      const b = (currentCareers.benefits || [])[idx];
      if (!b) return;

      openModal('Edit Why Join Benefit Card', `
        <div class="a-field"><label class="a-label">Benefit Title</label><input class="a-input" name="title" value="${b.title || ''}" required /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Icon Class (FontAwesome)</label><input class="a-input" name="icon" value="${b.icon || 'fa-solid fa-microchip'}" required /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Icon Color (Hex / CSS)</label><input class="a-input" name="iconColor" value="${b.iconColor || '#3b82f6'}" /></div>
        <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Benefit Description</label><textarea class="a-textarea" name="description" rows="3" required>${b.description || ''}</textarea></div>
      `, async (data) => {
        currentCareers.benefits[idx] = { ...b, ...data };
        currentContact.careers = currentCareers;
        await ContentService.saveData('contact', currentContact);
      });
    });
  });

  document.querySelectorAll('.btn-del-benefit').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const currentContact = ContentService.getData('contact') || {};
      const currentCareers = currentContact.careers || {};
      if (!confirm('Delete this benefit card?')) return;
      btn.disabled = true;
      try {
        (currentCareers.benefits || []).splice(idx, 1);
        currentContact.careers = currentCareers;
        await ContentService.saveData('contact', currentContact);
        rerender();
        showToast('Benefit card deleted.', 'info');
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed to delete benefit: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });

  document.querySelectorAll('.btn-move-benefit').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const dir = btn.getAttribute('data-dir');
      const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
      const currentContact = ContentService.getData('contact') || {};
      const currentCareers = currentContact.careers || {};
      btn.disabled = true;
      try {
        currentCareers.benefits = reorderArray(currentCareers.benefits || [], idx, targetIdx);
        currentContact.careers = currentCareers;
        await ContentService.saveData('contact', currentContact);
        rerender();
        showToast('Benefits reordered!', 'success');
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed to move benefit: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });

  // Positions CRUD
  document.getElementById('a-add-position-btn')?.addEventListener('click', () => {
    openModal('Add Open Engineering Position', `
      <div class="a-field"><label class="a-label">Position Title</label><input class="a-input" name="title" placeholder="e.g. Senior mmWave Antenna Engineer" required /></div>
    `, async (data) => {
      const currentContact = ContentService.getData('contact') || {};
      const currentCareers = currentContact.careers || {};
      const list = currentCareers.positions || [];
      list.push(data.title.trim());
      currentCareers.positions = list;
      currentContact.careers = currentCareers;
      await ContentService.saveData('contact', currentContact);
    });
  });

  document.querySelectorAll('.btn-edit-pos').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const currentContact = ContentService.getData('contact') || {};
      const currentCareers = currentContact.careers || {};
      const currentPos = (currentCareers.positions || [])[idx];

      openModal('Edit Engineering Position', `
        <div class="a-field"><label class="a-label">Position Title</label><input class="a-input" name="title" value="${currentPos || ''}" required /></div>
      `, async (data) => {
        currentCareers.positions[idx] = data.title.trim();
        currentContact.careers = currentCareers;
        await ContentService.saveData('contact', currentContact);
      });
    });
  });

  document.querySelectorAll('.btn-del-pos').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const currentContact = ContentService.getData('contact') || {};
      const currentCareers = currentContact.careers || {};
      if (!confirm('Delete this position?')) return;
      btn.disabled = true;
      try {
        (currentCareers.positions || []).splice(idx, 1);
        currentContact.careers = currentCareers;
        await ContentService.saveData('contact', currentContact);
        rerender();
        showToast('Position deleted.', 'info');
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed to delete position: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });

  document.querySelectorAll('.btn-move-pos').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const dir = btn.getAttribute('data-dir');
      const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
      const currentContact = ContentService.getData('contact') || {};
      const currentCareers = currentContact.careers || {};
      btn.disabled = true;
      try {
        currentCareers.positions = reorderArray(currentCareers.positions || [], idx, targetIdx);
        currentContact.careers = currentCareers;
        await ContentService.saveData('contact', currentContact);
        rerender();
        showToast('Positions reordered!', 'success');
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed to move position: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });

  // Experience Levels CRUD
  document.getElementById('a-add-exp-btn')?.addEventListener('click', () => {
    openModal('Add Experience Level Option', `
      <div class="a-field"><label class="a-label">Experience Bracket Text</label><input class="a-input" name="level" placeholder="e.g. 10+ Years (Chief Technical Officer)" required /></div>
    `, async (data) => {
      const currentContact = ContentService.getData('contact') || {};
      const currentCareers = currentContact.careers || {};
      const list = currentCareers.experienceLevels || [];
      list.push(data.level.trim());
      currentCareers.experienceLevels = list;
      currentContact.careers = currentCareers;
      await ContentService.saveData('contact', currentContact);
    });
  });

  document.querySelectorAll('.btn-edit-exp').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const currentContact = ContentService.getData('contact') || {};
      const currentCareers = currentContact.careers || {};
      const currentExp = (currentCareers.experienceLevels || [])[idx];

      openModal('Edit Experience Level Option', `
        <div class="a-field"><label class="a-label">Experience Bracket Text</label><input class="a-input" name="level" value="${currentExp || ''}" required /></div>
      `, async (data) => {
        currentCareers.experienceLevels[idx] = data.level.trim();
        currentContact.careers = currentCareers;
        await ContentService.saveData('contact', currentContact);
      });
    });
  });

  document.querySelectorAll('.btn-del-exp').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const currentContact = ContentService.getData('contact') || {};
      const currentCareers = currentContact.careers || {};
      if (!confirm('Delete this experience level?')) return;
      btn.disabled = true;
      try {
        (currentCareers.experienceLevels || []).splice(idx, 1);
        currentContact.careers = currentCareers;
        await ContentService.saveData('contact', currentContact);
        rerender();
        showToast('Experience level deleted.', 'info');
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed to delete experience level: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });

  document.querySelectorAll('.btn-move-exp').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const dir = btn.getAttribute('data-dir');
      const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
      const currentContact = ContentService.getData('contact') || {};
      const currentCareers = currentContact.careers || {};
      btn.disabled = true;
      try {
        currentCareers.experienceLevels = reorderArray(currentCareers.experienceLevels || [], idx, targetIdx);
        currentContact.careers = currentCareers;
        await ContentService.saveData('contact', currentContact);
        rerender();
        showToast('Experience levels reordered!', 'success');
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed to move experience level: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });

  // Notice Period CRUD
  document.getElementById('a-add-notice-btn')?.addEventListener('click', () => {
    openModal('Add Notice Period Option', `
      <div class="a-field"><label class="a-label">Notice Period Text</label><input class="a-input" name="notice" placeholder="e.g. 45 Days" required /></div>
    `, async (data) => {
      const currentContact = ContentService.getData('contact') || {};
      const currentCareers = currentContact.careers || {};
      const list = currentCareers.noticeOptions || [];
      list.push(data.notice.trim());
      currentCareers.noticeOptions = list;
      currentContact.careers = currentCareers;
      await ContentService.saveData('contact', currentContact);
    });
  });

  document.querySelectorAll('.btn-edit-notice').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const currentContact = ContentService.getData('contact') || {};
      const currentCareers = currentContact.careers || {};
      const currentNotc = (currentCareers.noticeOptions || [])[idx];

      openModal('Edit Notice Period Option', `
        <div class="a-field"><label class="a-label">Notice Period Text</label><input class="a-input" name="notice" value="${currentNotc || ''}" required /></div>
      `, async (data) => {
        currentCareers.noticeOptions[idx] = data.notice.trim();
        currentContact.careers = currentCareers;
        await ContentService.saveData('contact', currentContact);
      });
    });
  });

  document.querySelectorAll('.btn-del-notice').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const currentContact = ContentService.getData('contact') || {};
      const currentCareers = currentContact.careers || {};
      if (!confirm('Delete this notice period option?')) return;
      btn.disabled = true;
      try {
        (currentCareers.noticeOptions || []).splice(idx, 1);
        currentContact.careers = currentCareers;
        await ContentService.saveData('contact', currentContact);
        rerender();
        showToast('Notice option deleted.', 'info');
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed to delete notice option: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });

  document.querySelectorAll('.btn-move-notice').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const dir = btn.getAttribute('data-dir');
      const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
      const currentContact = ContentService.getData('contact') || {};
      const currentCareers = currentContact.careers || {};
      btn.disabled = true;
      try {
        currentCareers.noticeOptions = reorderArray(currentCareers.noticeOptions || [], idx, targetIdx);
        currentContact.careers = currentCareers;
        await ContentService.saveData('contact', currentContact);
        rerender();
        showToast('Notice options reordered!', 'success');
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed to move notice option: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });
}

// ─── PRODUCTS / OEMS TAB ─────────────────────────────────────────────────────
const expandedOemIds = new Set();
const expandedCategoryKeys = new Set();
let catalogSearchQuery = '';

function renderProductsTab() {
  const oems = getCatalogData();
  const backendReady = CatalogService.isAdminCatalogReady();
  const backendEmpty = CatalogService.isAdminCatalogEmpty();
  const catalogStatus = catalogLoadError
    ? `<div class="a-notice a-notice-error" role="alert"><i class="fa-solid fa-triangle-exclamation"></i><span><strong>Catalog API unavailable:</strong> ${catalogLoadError}. Existing browser catalog data is shown without replacing it.</span></div>`
    : !backendReady
      ? '<div class="a-notice a-notice-warning" role="status"><i class="fa-solid fa-spinner fa-spin"></i><span>Loading catalog from the backend. Editing is unavailable until this completes.</span></div>'
    : backendEmpty
      ? `<div class="a-notice a-notice-warning"><i class="fa-solid fa-triangle-exclamation"></i><span><strong>Backend catalog is empty.</strong> Your existing browser catalog and images are preserved. Editing is paused until you review the transfer preview or execute the initial catalog transfer. <button type="button" class="a-btn a-btn-outline a-btn-sm" id="btn-preview-catalog-migration" style="margin-right:6px;"><i class="fa-solid fa-eye"></i> Preview transfer</button><button type="button" class="a-btn a-btn-primary a-btn-sm" id="btn-execute-catalog-transfer"><i class="fa-solid fa-cloud-arrow-up"></i> Execute Transfer to PostgreSQL</button></span></div>`
      : '';

  const totalOems = oems.length;
  const visibleOemsCount = oems.filter(o => o.visible !== false).length;
  let totalCategoriesCount = 0;
  let totalProductsCount = 0;
  oems.forEach(o => {
    (o.categories || []).forEach(cat => {
      totalCategoriesCount++;
      totalProductsCount += (cat.products || []).length;
    });
  });

  const q = (catalogSearchQuery || '').trim().toLowerCase();
  const filteredOems = oems.filter(o => {
    if (!q) return true;
    if ((o.name || '').toLowerCase().includes(q)) return true;
    if ((o.specialty || '').toLowerCase().includes(q)) return true;
    if ((o.description || '').toLowerCase().includes(q)) return true;
    return (o.categories || []).some(cat => {
      if ((cat.name || '').toLowerCase().includes(q)) return true;
      if ((cat.description || '').toLowerCase().includes(q)) return true;
      if ((cat.label || '').toLowerCase().includes(q)) return true;
      return (cat.products || []).some(p => {
        return (p.name || '').toLowerCase().includes(q) ||
               (p.id || '').toLowerCase().includes(q) ||
               (p.description || '').toLowerCase().includes(q) ||
               (p.applications || '').toLowerCase().includes(q);
      });
    });
  });

  const oemCardsHtml = filteredOems.map(oem => {
    const origIdx = oems.indexOf(oem);
    const resolvedLogo = ImageStorage.resolveImageUrl(oem.logoImg);

    let oemProdTotal = 0;
    (oem.categories || []).forEach(c => {
      oemProdTotal += (c.products || []).length;
    });

    const catCount = (oem.categories || []).length;
    const isExpanded = expandedOemIds.has(oem.id) || (q.length > 0);
    const isHidden = oem.visible === false;

    let oemPanelHtml = '';
    if (isExpanded) {
      const categories = oem.categories || [];

      const categoriesCardsHtml = categories.map((cat, catIdx) => {
        const catKey = `${oem.id}__${cat.id || catIdx}`;
        const catProds = cat.products || [];
        const isCatExpanded = expandedCategoryKeys.has(catKey) || (q.length > 0 && (
          (cat.name || '').toLowerCase().includes(q) ||
          (cat.description || '').toLowerCase().includes(q) ||
          (cat.label || '').toLowerCase().includes(q) ||
          catProds.some(p =>
            (p.name || '').toLowerCase().includes(q) ||
            (p.id || '').toLowerCase().includes(q) ||
            (p.description || '').toLowerCase().includes(q) ||
            (p.applications || '').toLowerCase().includes(q)
          )
        ));
        const isCatHidden = cat.visible === false;

        let catalogPanelHtml = '';
        if (isCatExpanded) {
          const productRows = catProds.map((p, prodIdx) => {
            const prodImg = ImageStorage.resolveImageUrl(p.image || oem.defaultImage);
            const isProdHidden = p.visible === false;

            return `
              <tr class="${isProdHidden ? 'a-row-hidden' : ''}">
                <td style="width: 80px;">
                  <div class="a-reorder-group">
                    <button type="button" class="a-btn-reorder btn-move-prod" data-oem-idx="${origIdx}" data-cat-idx="${catIdx}" data-prod-idx="${prodIdx}" data-dir="up" ${prodIdx === 0 ? 'disabled' : ''} title="Move Product Up"><i class="fa-solid fa-arrow-up"></i></button>
                    <button type="button" class="a-btn-reorder btn-move-prod" data-oem-idx="${origIdx}" data-cat-idx="${catIdx}" data-prod-idx="${prodIdx}" data-dir="down" ${prodIdx === catProds.length - 1 ? 'disabled' : ''} title="Move Product Down"><i class="fa-solid fa-arrow-down"></i></button>
                  </div>
                </td>
                <td style="width: 60px;">
                  <div class="a-prod-thumb-box">
                    ${prodImg ? `<img src="${prodImg}" alt="${p.name}" />` : '<i class="fa-solid fa-microchip" style="color:#64748b;"></i>'}
                  </div>
                </td>
                <td>
                  <div class="a-prod-name-box">
                    <strong>${p.name || 'Unnamed Product'}</strong>
                    <span>ID: ${p.id || '—'}</span>
                  </div>
                </td>
                <td>
                  <div class="a-prod-text-snippet" title="${p.description || ''}">
                    ${p.description || '<span style="color:#94a3b8;font-style:italic;">No description</span>'}
                  </div>
                  ${p.applications ? `<div class="a-prod-text-snippet" style="color:#2563eb;font-size:0.7rem;margin-top:2px;" title="${p.applications}"><i class="fa-solid fa-bullseye"></i> ${p.applications}</div>` : ''}
                </td>
                <td>
                  ${p.link ? `<a href="${p.link}" target="_blank" rel="noopener" class="a-btn a-btn-outline a-btn-sm" style="padding:3px 8px;font-size:0.72rem;"><i class="fa-solid fa-arrow-up-right-from-square"></i> Datasheet</a>` : '<span style="color:#94a3b8;font-size:0.72rem;">None</span>'}
                </td>
                <td>
                  <button type="button" class="a-btn a-btn-sm btn-toggle-prod-vis" data-oem-idx="${origIdx}" data-cat-idx="${catIdx}" data-prod-idx="${prodIdx}" title="Click to toggle visibility" style="${isProdHidden ? 'opacity:0.6;background:#f1f5f9;color:#64748b;' : 'background:#ecfdf5;color:#059669;border-color:#a7f3d0;'}">
                    <i class="fa-solid ${isProdHidden ? 'fa-eye-slash' : 'fa-eye'}"></i> ${isProdHidden ? 'Hidden' : 'Visible'}
                  </button>
                </td>
                <td style="white-space: nowrap;">
                  <button type="button" class="a-btn a-btn-outline a-btn-sm btn-edit-product" data-oem-idx="${origIdx}" data-cat-idx="${catIdx}" data-prod-idx="${prodIdx}"><i class="fa-solid fa-pen"></i> Edit</button>
                  <button type="button" class="a-btn a-btn-danger a-btn-sm btn-del-product" data-oem-idx="${origIdx}" data-cat-idx="${catIdx}" data-prod-idx="${prodIdx}" style="margin-left:4px;"><i class="fa-solid fa-trash"></i></button>
                </td>
              </tr>
            `;
          }).join('');

          catalogPanelHtml = `
            <div class="a-cat-products-panel">
              <div class="a-cat-products-top">
                <div>
                  <strong style="color:#0f172a; font-size:0.86rem;">
                    <i class="fa-solid fa-microchip" style="color:var(--a-blue);margin-right:5px;"></i>
                    Product Portfolio &amp; Component Catalog — ${cat.name} (${catProds.length})
                  </strong>
                  <div style="font-size:0.74rem; color:var(--a-muted); margin-top:2px;">
                    Edit hardware models, upload component photos, update technical specifications, applications, and datasheets for ${cat.name}
                  </div>
                </div>
                <button type="button" class="a-btn a-btn-primary a-btn-sm btn-add-prod-to-cat" data-oem-idx="${origIdx}" data-cat-idx="${catIdx}">
                  <i class="fa-solid fa-plus"></i> Add Product to ${cat.name}
                </button>
              </div>
              <div class="a-table-wrap">
                <table class="a-sub-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Image</th>
                      <th>Model / Part No.</th>
                      <th>Description &amp; Applications</th>
                      <th>Datasheet</th>
                      <th>Visibility</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${productRows || `<tr><td colspan="7" style="text-align:center;padding:22px;color:var(--a-muted);">No products registered under <strong>${cat.name}</strong> yet. Click "+ Add Product to ${cat.name}" above to add one.</td></tr>`}
                  </tbody>
                </table>
              </div>
            </div>
          `;
        }

        return `
          <div class="a-cat-card ${isCatHidden ? 'cat-hidden' : ''}" id="cat-card-${catKey.replace(/[^a-zA-Z0-9_-]/g, '_')}">
            <div class="a-cat-header">
              <div class="a-cat-header-left">
                <div class="a-reorder-group">
                  <button type="button" class="a-btn-reorder btn-move-cat" data-oem-idx="${origIdx}" data-cat-idx="${catIdx}" data-dir="up" ${catIdx === 0 ? 'disabled' : ''} title="Move Category Up"><i class="fa-solid fa-arrow-up"></i></button>
                  <button type="button" class="a-btn-reorder btn-move-cat" data-oem-idx="${origIdx}" data-cat-idx="${catIdx}" data-dir="down" ${catIdx === categories.length - 1 ? 'disabled' : ''} title="Move Category Down"><i class="fa-solid fa-arrow-down"></i></button>
                </div>
                <div class="a-cat-icon-badge">
                  <i class="fa-solid fa-layer-group"></i>
                </div>
                <div class="a-cat-info">
                  <div class="a-cat-title-row">
                    <span class="a-cat-title">${cat.name || 'Unnamed Category'}</span>
                    <span class="a-badge a-badge-blue"><i class="fa-solid fa-microchip"></i> ${catProds.length} ${catProds.length === 1 ? 'Product' : 'Products'}</span>
                    ${cat.label ? `<span class="a-badge" style="background:#fef3c7;color:#92400e;border:1px solid #fde68a;">${cat.label}</span>` : ''}
                    ${isCatHidden ? '<span class="a-badge" style="background:#64748b;color:#fff;"><i class="fa-solid fa-eye-slash"></i> Hidden</span>' : '<span class="a-badge a-badge-green"><i class="fa-solid fa-eye"></i> Visible</span>'}
                  </div>
                  <div class="a-cat-desc" title="${cat.description || ''}">
                    ${cat.description || '<span style="font-style:italic;color:#94a3b8;">No category description provided</span>'}
                  </div>
                </div>
              </div>

              <div class="a-cat-header-actions">
                <button type="button" class="a-btn a-btn-outline a-btn-sm btn-toggle-cat-vis" data-oem-idx="${origIdx}" data-cat-idx="${catIdx}" title="${isCatHidden ? 'Show category on public site' : 'Hide category from public site'}">
                  <i class="fa-solid ${isCatHidden ? 'fa-eye' : 'fa-eye-slash'}"></i> ${isCatHidden ? 'Show' : 'Hide'}
                </button>
                <button type="button" class="a-btn a-btn-primary a-btn-sm btn-toggle-cat-expand" data-cat-key="${catKey}">
                  <i class="fa-solid ${isCatExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}"></i>
                  <span>${isCatExpanded ? 'Collapse' : 'Expand'} Portfolio &amp; Catalog (${catProds.length})</span>
                </button>
                <button type="button" class="a-btn a-btn-outline a-btn-sm btn-edit-category" data-oem-idx="${origIdx}" data-cat-idx="${catIdx}">
                  <i class="fa-solid fa-pen"></i> Edit Category
                </button>
                <button type="button" class="a-btn a-btn-danger a-btn-sm btn-del-category" data-oem-idx="${origIdx}" data-cat-idx="${catIdx}" title="Delete Category and its products">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            </div>

            ${catalogPanelHtml}
          </div>
        `;
      }).join('');

      oemPanelHtml = `
        <div class="a-oem-panel">
          <div class="a-oem-panel-top">
            <div>
              <strong style="color:#0f172a; font-size:0.9rem;">
                <i class="fa-solid fa-folder-tree" style="color:var(--a-blue);margin-right:6px;"></i>
                Product Categories under ${oem.name} (${catCount})
              </strong>
              <div style="font-size:0.75rem; color:var(--a-muted); margin-top:2px;">
                Edit all category content, titles, and labels. Click "Expand Portfolio &amp; Catalog" to edit hardware models.
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button type="button" class="a-btn a-btn-outline a-btn-sm btn-expand-oem-cats" data-oem-id="${oem.id}">
                <i class="fa-solid fa-angles-down"></i> Expand All Categories
              </button>
              <button type="button" class="a-btn a-btn-primary a-btn-sm btn-add-cat-to-oem" data-oem-idx="${origIdx}">
                <i class="fa-solid fa-plus"></i> Add Category to ${oem.shortName || oem.name}
              </button>
            </div>
          </div>

          <div class="a-cat-list">
            ${categoriesCardsHtml || `<div class="a-empty-state" style="padding:24px;text-align:center;background:#fff;border-radius:8px;border:1px dashed var(--a-border);">No product categories registered yet. Click "+ Add Category to ${oem.shortName || oem.name}" above.</div>`}
          </div>
        </div>
      `;
    }

    return `
      <div class="a-oem-card ${isHidden ? 'oem-hidden' : ''}" id="oem-card-${oem.id}">
        <div class="a-oem-header">
          <div class="a-oem-header-left">
            <div class="a-reorder-group">
              <button type="button" class="a-btn-reorder btn-move-oem" data-dir="up" data-idx="${origIdx}" ${origIdx === 0 ? 'disabled' : ''} title="Move OEM Up"><i class="fa-solid fa-arrow-up"></i></button>
              <button type="button" class="a-btn-reorder btn-move-oem" data-dir="down" data-idx="${origIdx}" ${origIdx === oems.length - 1 ? 'disabled' : ''} title="Move OEM Down"><i class="fa-solid fa-arrow-down"></i></button>
            </div>
            <div class="a-oem-logo-thumb">
              ${resolvedLogo ? `<img src="${resolvedLogo}" alt="${oem.name}" />` : (oem.logoSvg || '<i class="fa-solid fa-industry" style="color:#94a3b8;"></i>')}
            </div>
            <div class="a-oem-info">
              <div class="a-oem-name-row">
                <span class="a-oem-title">${oem.name}</span>
                <span class="a-badge a-badge-blue">${oem.specialty || oem.category || 'RF & Microwave'}</span>
                ${isHidden ? '<span class="a-badge" style="background:#64748b;color:#fff;"><i class="fa-solid fa-eye-slash"></i> Hidden</span>' : '<span class="a-badge a-badge-green"><i class="fa-solid fa-eye"></i> Visible</span>'}
              </div>
              <div class="a-oem-meta-row">
                <span><i class="fa-solid fa-folder-tree"></i> <strong>${catCount}</strong> ${catCount === 1 ? 'Category' : 'Categories'}</span>
                <span>&bull;</span>
                <span><i class="fa-solid fa-microchip"></i> <strong>${oemProdTotal}</strong> ${oemProdTotal === 1 ? 'Product' : 'Products & Lines'}</span>
                ${oem.website ? `<span>&bull;</span> <a href="${oem.website}" target="_blank" rel="noopener" style="color:var(--a-blue);text-decoration:none;"><i class="fa-solid fa-globe"></i> Website</a>` : ''}
              </div>
            </div>
          </div>

          <div class="a-oem-header-actions">
            <button type="button" class="a-btn a-btn-outline a-btn-sm btn-toggle-oem-vis" data-idx="${origIdx}" title="${isHidden ? 'Show on public site' : 'Hide from public site'}">
              <i class="fa-solid ${isHidden ? 'fa-eye' : 'fa-eye-slash'}"></i> ${isHidden ? 'Show' : 'Hide'}
            </button>
            <button type="button" class="a-btn a-btn-primary a-btn-sm btn-toggle-oem-expand" data-oem-id="${oem.id}">
              <i class="fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}"></i>
              <span>${isExpanded ? 'Collapse' : 'Manage'} Categories (${catCount})</span>
            </button>
            <button type="button" class="a-btn a-btn-outline a-btn-sm btn-edit-oem" data-idx="${origIdx}">
              <i class="fa-solid fa-pen"></i> Edit OEM
            </button>
            <button type="button" class="a-btn a-btn-danger a-btn-sm btn-del-oem" data-idx="${origIdx}" title="Delete OEM and its categories">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>

        ${oemPanelHtml}
      </div>
    `;
  }).join('');

  return `
    ${catalogStatus}
    <div class="a-cards-box">
      <div class="a-cards-box-header" style="align-items:flex-start;">
        <div>
          <h3>OEM Principals, Product Categories &amp; Component Catalogs</h3>
          <p>Full two-tier management: select any of the 15 authorized OEM principals to edit its product categories and labels, then expand any category to edit its Product Portfolio &amp; Component Catalog.</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" class="a-btn a-btn-outline a-btn-sm" id="btn-expand-all"><i class="fa-solid fa-angles-down"></i> Expand All</button>
          <button type="button" class="a-btn a-btn-outline a-btn-sm" id="btn-collapse-all"><i class="fa-solid fa-angles-up"></i> Collapse All</button>
          <button type="button" class="a-btn a-btn-primary a-btn-sm" id="btn-add-new-oem"><i class="fa-solid fa-plus"></i> Add New OEM</button>
        </div>
      </div>

      <div class="a-catalog-toolbar">
        <div class="a-catalog-stats-strip">
          <div class="a-catalog-stat-badge">
            <span>Visible OEMs:</span>
            <strong>${visibleOemsCount}</strong>
            <span style="color:var(--a-muted);">/ ${totalOems}</span>
          </div>
          <div class="a-catalog-stat-badge">
            <span>Product Categories:</span>
            <strong>${totalCategoriesCount}</strong>
          </div>
          <div class="a-catalog-stat-badge">
            <span>Total Catalog Products:</span>
            <strong>${totalProductsCount}</strong>
          </div>
        </div>

        <div style="flex:1;max-width:420px;position:relative;">
          <input type="text" id="admin-catalog-search-input" class="a-input" placeholder="Search OEMs, categories, products, or keywords..." value="${catalogSearchQuery || ''}" style="padding-left:36px;" />
          <i class="fa-solid fa-magnifying-glass" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--a-muted);font-size:0.85rem;"></i>
          ${catalogSearchQuery ? '<button type="button" id="admin-catalog-search-clear" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--a-muted);cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>' : ''}
        </div>
      </div>

      <div class="a-oem-accordions-list">
        ${oemCardsHtml || '<div class="a-empty-state" style="padding:40px;text-align:center;background:#fff;border-radius:12px;border:1px dashed var(--a-border);">No OEMs found matching your search.</div>'}
      </div>
    </div>
  `;
}

export let isExecutingTransfer = false;

export function openExecuteTransferModal() {
  if (isExecutingTransfer) return;

  const contentHtml = `
    <div class="a-notice a-notice-warning" style="margin-bottom:16px;">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <span><strong>Owner Action Required:</strong> This operation transfers the initial baseline catalog into PostgreSQL. This transfer only needs to be run once to populate the database catalog.</span>
    </div>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px;">
      <h4 style="margin:0 0 10px;font-size:0.95rem;color:#0f172a;">Transfer Scope</h4>
      <table class="a-table" style="background:#fff;margin-bottom:12px;">
        <thead>
          <tr><th>Entity</th><th>Candidate Count</th><th>Target Database</th></tr>
        </thead>
        <tbody>
          <tr><td><strong>OEMs (Principals)</strong></td><td>15</td><td>PostgreSQL <code>oem</code></td></tr>
          <tr><td><strong>Product Categories</strong></td><td>88</td><td>PostgreSQL <code>category</code></td></tr>
          <tr><td><strong>Products &amp; Models</strong></td><td>169</td><td>PostgreSQL <code>product</code></td></tr>
          <tr style="background:#f1f5f9;"><td><strong>Total Catalog Records</strong></td><td><strong>272</strong></td><td><strong>Baseline PostgreSQL Catalog</strong></td></tr>
        </tbody>
      </table>

      <h4 style="margin:12px 0 6px;font-size:0.9rem;color:#0f172a;">Safety &amp; Verification Safeguards</h4>
      <ul style="margin:0;padding-left:18px;font-size:0.85rem;color:#334155;line-height:1.6;">
        <li><strong>Pre-execution Dry-Run:</strong> Automatically audits for conflicts, duplicate IDs, or hierarchy discrepancies before any data is written.</li>
        <li><strong>Atomic Transaction:</strong> The entire transfer (including audit tracking) runs inside an isolated database transaction. If any error occurs, all changes roll back automatically.</li>
        <li><strong>Server-Side Verification:</strong> Queries the live database to confirm all 15 OEMs, 88 categories, and 169 products exist before unlocking the editor.</li>
        <li><strong>Data Preservation:</strong> Existing localStorage, IndexedDB images, and website assets remain intact.</li>
      </ul>
    </div>

    <div id="transfer-modal-status-area"></div>
  `;

  openModal(
    'Execute Catalog Transfer to PostgreSQL',
    contentHtml,
    async () => {
      return executeTransferWorkflow();
    },
    {
      submitText: 'Confirm & Execute Transfer',
      submitIcon: 'fa-solid fa-cloud-arrow-up',
      submitClass: 'a-btn-primary',
      submitId: 'btn-confirm-execute-transfer',
      cancelText: 'Cancel',
    }
  );
}

export async function executeTransferWorkflow() {
  if (isExecutingTransfer) return false;
  isExecutingTransfer = true;

  const statusArea = typeof document !== 'undefined' ? document.getElementById('transfer-modal-status-area') : null;
  const submitBtn = typeof document !== 'undefined' ? (document.getElementById('btn-confirm-execute-transfer') || document.querySelector('#a-modal-form button[type="submit"]')) : null;
  const cancelBtn = typeof document !== 'undefined' ? document.getElementById('a-modal-cancel-btn') : null;
  const closeBtn = typeof document !== 'undefined' ? document.getElementById('a-modal-close-btn') : null;

  const updateStatus = (message, icon = 'fa-spinner fa-spin') => {
    if (statusArea) {
      statusArea.innerHTML = `
        <div class="a-notice a-notice-info" style="margin-top:12px;">
          <i class="fa-solid ${icon}"></i>
          <span>${escapeHtml(message)}</span>
        </div>
      `;
    }
  };

  const showError = (message) => {
    if (statusArea) {
      statusArea.innerHTML = `
        <div class="a-notice a-notice-error" style="margin-top:12px;">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span><strong>Transfer aborted:</strong> ${escapeHtml(message)}</span>
        </div>
      `;
    }
    if (typeof showToast === 'function') {
      showToast(`Transfer failed: ${message}`, 'error');
    }
  };

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing Transfer...';
    }
    if (cancelBtn) cancelBtn.disabled = true;
    if (closeBtn) closeBtn.disabled = true;

    // Step 1: Pre-execution validation using dry-run
    updateStatus('Step 1/3: Running pre-execution dry-run validation against PostgreSQL...');
    const dryRunRes = await CatalogService.getTransferDryRun();

    // ApiService.post() unwraps { success, data } and returns the inner data object.
    // A valid dry-run report always has dryRun: true.
    if (!dryRunRes || !dryRunRes.dryRun) {
      throw new Error('Dry-run validation did not return a valid response from the server.');
    }

    const report = dryRunRes;

    // Check conflicts
    if ((report.counts?.conflicts?.total || 0) > 0 || (report.conflicts && report.conflicts.length > 0)) {
      throw new Error(`Dry-run detected ${report.counts?.conflicts?.total || report.conflicts.length} conflict(s). Transfer aborted for safety.`);
    }

    // Check hierarchy
    if (!report.hierarchy || !report.hierarchy.valid) {
      throw new Error('Dry-run detected orphaned categories or products in the catalog hierarchy.');
    }

    // Check duplicates
    if (!report.duplicates || !report.duplicates.valid) {
      throw new Error('Dry-run detected duplicate IDs in candidate catalog.');
    }

    // Check candidate counts: expect 15 OEMs, 88 categories, 169 products
    const candidate = report.counts?.candidate;
    if (!candidate || candidate.oems !== 15 || candidate.categories !== 88 || candidate.products !== 169) {
      throw new Error(`Candidate counts (${candidate?.oems || 0} OEMs, ${candidate?.categories || 0} categories, ${candidate?.products || 0} products) differ from expected 15 OEMs, 88 categories, and 169 products.`);
    }

    // Step 2: Execute atomic transfer
    updateStatus('Step 2/3: Executing atomic catalog transfer into PostgreSQL...');
    const execRes = await CatalogService.executeCatalogTransfer();

    // execRes is the unwrapped transferSummary; backend sets status: 'APPLIED' or 'ALREADY_APPLIED'.
    if (!execRes || !['APPLIED', 'ALREADY_APPLIED'].includes(execRes.status)) {
      throw new Error(execRes?.message || 'Transfer execution failed on server.');
    }

    // Step 3: Server-side post-transfer verification
    updateStatus('Step 3/3: Verifying live database catalog counts...');
    const verification = await CatalogService.verifyBackendCatalog({
      oems: 15,
      categories: 88,
      products: 169,
    });

    if (!verification.verified) {
      throw new Error(`Post-transfer verification failed: Database returned ${verification.counts.oems} OEMs, ${verification.counts.categories} categories, and ${verification.counts.products} products (expected 15 OEMs, 88 categories, 169 products).`);
    }

    // Success!
    if (typeof showToast === 'function') {
      showToast('Catalog transfer completed and verified! 15 OEMs, 88 categories, and 169 products are now live in PostgreSQL.', 'success');
    }
    isExecutingTransfer = false;
    if (typeof rerender === 'function') {
      rerender();
    }
    return true;
  } catch (err) {
    console.error('Execute catalog transfer failed:', err);
    isExecutingTransfer = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Confirm &amp; Execute Transfer';
    }
    if (cancelBtn) cancelBtn.disabled = false;
    if (closeBtn) closeBtn.disabled = false;
    showError(err.message || 'An unexpected error occurred during transfer.');
    return false;
  }
}

function bindProductsTabEvents() {
  const oems = getCatalogData();

  // Search input
  const searchInput = document.getElementById('admin-catalog-search-input');
  searchInput?.addEventListener('input', (e) => {
    catalogSearchQuery = e.target.value;
    rerender();
    const newInp = document.getElementById('admin-catalog-search-input');
    if (newInp) {
      newInp.focus();
      newInp.selectionStart = newInp.selectionEnd = newInp.value.length;
    }
  });

  document.getElementById('admin-catalog-search-clear')?.addEventListener('click', () => {
    catalogSearchQuery = '';
    rerender();
  });

  // Expand / Collapse All
  document.getElementById('btn-expand-all')?.addEventListener('click', () => {
    oems.forEach(o => {
      expandedOemIds.add(o.id);
      (o.categories || []).forEach((c, cIdx) => {
        expandedCategoryKeys.add(`${o.id}__${c.id || cIdx}`);
      });
    });
    rerender();
  });

  document.getElementById('btn-collapse-all')?.addEventListener('click', () => {
    expandedOemIds.clear();
    expandedCategoryKeys.clear();
    rerender();
  });

  document.getElementById('btn-preview-catalog-migration')?.addEventListener('click', () => {
    try {
      const preview = CatalogService.getReconciliationPreview();
    const countRows = ['oems', 'categories', 'products'].map((type) => {
      const row = preview.proposedCreates[type];
      return `<tr><td><strong>${type.toUpperCase()}</strong></td><td>${row.localCount}</td><td>${row.backendCount}</td><td>${row.proposedCreateCount}</td><td>${row.matchingCount}</td></tr>`;
    }).join('');

    const linkWarningRows = (preview.externalLinkWarnings || []).map((w) => `
      <tr>
        <td><code>${escapeHtml(w.id)}</code></td>
        <td>${escapeHtml(w.name)}</td>
        <td style="color:#f59e0b;font-size:0.8rem;">${escapeHtml(w.rawLink)}</td>
        <td style="font-size:0.8rem;">Preserved in <code>sourceData.link</code></td>
      </tr>
    `).join('');

    const conflictsHtml = preview.conflicts.length
      ? `<div class="a-notice a-notice-error" style="margin-top:12px;"><strong>Conflicts requiring manual review:</strong><br/>${preview.conflicts.map((item) => `${item.type} <code>${escapeHtml(item.id)}</code>: browser “${escapeHtml(item.localName)}”, backend “${escapeHtml(item.backendName)}”`).join('<br/>')}</div>`
      : '<p style="color:#10b981;font-size:0.9rem;margin-top:8px;"><i class="fa-solid fa-check"></i> No ID collisions or naming conflicts detected between browser catalog and PostgreSQL.</p>';

    const hierarchyHtml = (preview.orphanedCategories?.length || 0) === 0 && (preview.orphanedProducts?.length || 0) === 0
      ? '<p style="color:#10b981;font-size:0.9rem;"><i class="fa-solid fa-check"></i> Hierarchy integrity verified: all categories map to existing OEMs, and all products map to existing categories.</p>'
      : `<div class="a-notice a-notice-error">Hierarchy issues detected: ${preview.orphanedCategories?.length || 0} orphaned categories, ${preview.orphanedProducts?.length || 0} orphaned products.</div>`;

    openModal('Catalog Transfer Preview (Read-Only)', `
      <div class="a-notice a-notice-info" style="margin-bottom:16px;">
        <i class="fa-solid fa-shield-halved"></i>
        <span><strong>Safety Guarantee:</strong> This is a read-only audit. No data has been modified or imported into PostgreSQL. Your existing browser catalog and IndexedDB images remain intact.</span>
      </div>

      <h4 style="margin:12px 0 6px;">1. Catalog Record Counts</h4>
      <table class="a-table" style="margin-bottom:16px;">
        <thead><tr><th>Entity</th><th>Browser Local</th><th>PostgreSQL Backend</th><th>Proposed Inserts</th><th>Matching</th></tr></thead>
        <tbody>${countRows}</tbody>
      </table>

      <h4 style="margin:12px 0 6px;">2. Hierarchy & Relationship Integrity</h4>
      ${hierarchyHtml}

      <h4 style="margin:16px 0 6px;">3. External Link Audit (${preview.externalLinkWarnings?.length || 0} items)</h4>
      ${linkWarningRows ? `
        <table class="a-table" style="margin-bottom:16px;">
          <thead><tr><th>ID</th><th>Name</th><th>Source Link String</th><th>Action</th></tr></thead>
          <tbody>${linkWarningRows}</tbody>
        </table>
      ` : '<p style="color:#10b981;font-size:0.9rem;">All external links are valid HTTP(S) URLs.</p>'}

      <h4 style="margin:16px 0 6px;">4. Image References Audit</h4>
      <div style="font-size:0.875rem;background:rgba(255,255,255,0.03);padding:12px;border-radius:6px;border:1px solid rgba(255,255,255,0.08);margin-bottom:16px;">
        <p style="margin:0 0 6px;">• <strong>Local asset paths (/images/...):</strong> ${preview.imageAudit.localAssetCount} records</p>
        <p style="margin:0 0 6px;">• <strong>IndexedDB local blobs (idb:...):</strong> ${preview.imageAudit.indexedDbCount} records</p>
        <p style="margin:0 0 6px;">• <strong>External image URLs:</strong> ${preview.imageAudit.externalUrlCount} records</p>
        <p style="margin:0;color:#94a3b8;font-size:0.8rem;">Note: Image storage will transition to Cloudflare R2 in a future phase. Existing local asset and IndexedDB image resolutions are fully preserved.</p>
      </div>

      <h4 style="margin:16px 0 6px;">5. Potential Conflicts</h4>
      ${conflictsHtml}

      <div class="a-notice a-notice-warning" style="margin-top:16px;">
        <i class="fa-solid fa-hand"></i>
        <span><strong>Automatic Import Disabled:</strong> Transfer will not execute automatically. A separate owner-approved migration step is required to populate PostgreSQL.</span>
      </div>

      <div style="margin-top:20px;display:flex;justify-content:flex-end;">
        <button type="button" class="a-btn a-btn-primary a-btn-sm" id="btn-modal-open-transfer">
          <i class="fa-solid fa-cloud-arrow-up"></i> Proceed to Execute Transfer...
        </button>
      </div>
    `);

    document.getElementById('btn-modal-open-transfer')?.addEventListener('click', () => {
      openExecuteTransferModal();
    });
    } catch (err) {
      console.error('Failed to generate catalog transfer preview:', err);
      showToast(`Preview failed: ${err.message}`, 'error');
    }
  });

  document.getElementById('btn-execute-catalog-transfer')?.addEventListener('click', () => {
    openExecuteTransferModal();
  });

  if (!CatalogService.isAdminCatalogReady() || CatalogService.isAdminCatalogEmpty()) {
    document.querySelectorAll(
      '.btn-toggle-oem-vis, .btn-move-oem, #btn-add-new-oem, .btn-edit-oem, .btn-del-oem, ' +
      '.btn-toggle-cat-vis, .btn-move-cat, .btn-add-cat-to-oem, .btn-edit-category, .btn-del-category, ' +
      '.btn-add-prod-to-cat, .btn-edit-product, .btn-del-product, .btn-move-prod, .btn-toggle-prod-vis'
    ).forEach((button) => {
      button.addEventListener('click', () => {
        showToast('Catalog editing is paused until the backend catalog is populated and reviewed.', 'error');
      });
    });
    return;
  }

  // Toggle individual OEM expand
  document.querySelectorAll('.btn-toggle-oem-expand').forEach(btn => {
    btn.addEventListener('click', () => {
      const oemId = btn.getAttribute('data-oem-id');
      if (expandedOemIds.has(oemId)) {
        expandedOemIds.delete(oemId);
      } else {
        expandedOemIds.add(oemId);
      }
      rerender();
    });
  });

  // Expand all categories under a specific OEM
  document.querySelectorAll('.btn-expand-oem-cats').forEach(btn => {
    btn.addEventListener('click', () => {
      const oemId = btn.getAttribute('data-oem-id');
      const oem = oems.find(o => o.id === oemId);
      if (oem) {
        (oem.categories || []).forEach((c, cIdx) => {
          expandedCategoryKeys.add(`${oem.id}__${c.id || cIdx}`);
        });
        rerender();
      }
    });
  });

  // Toggle Category Expand / Collapse
  document.querySelectorAll('.btn-toggle-cat-expand').forEach(btn => {
    btn.addEventListener('click', () => {
      const catKey = btn.getAttribute('data-cat-key');
      if (expandedCategoryKeys.has(catKey)) {
        expandedCategoryKeys.delete(catKey);
      } else {
        expandedCategoryKeys.add(catKey);
      }
      rerender();
    });
  });

  // Toggle OEM visibility
  document.querySelectorAll('.btn-toggle-oem-vis').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const o = oems[idx];
      o.visible = o.visible === false ? true : false;
      void persistCatalog(oems, `OEM "${o.name}" is now ${o.visible ? 'visible' : 'hidden'}.`);
    });
  });

  // Move OEM up / down
  document.querySelectorAll('.btn-move-oem').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const dir = btn.getAttribute('data-dir');
      const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
      const reordered = reorderArray(oems, idx, targetIdx);
      void persistCatalog(reordered, 'OEMs reordered.');
    });
  });

  // Add New OEM
  document.getElementById('btn-add-new-oem')?.addEventListener('click', () => {
    openModal('Add New Manufacturing Partner / OEM', `
      <div class="a-field"><label class="a-label">OEM / Principal Name *</label><input class="a-input" name="name" required placeholder="e.g. Rogers Corporation" /></div>
      <div class="a-field" style="margin-top:12px;"><label class="a-label">Short Display Name *</label><input class="a-input" name="shortName" required placeholder="e.g. Rogers" /></div>
      <div class="a-field" style="margin-top:12px;"><label class="a-label">Specialty / Domain *</label><input class="a-input" name="specialty" required placeholder="e.g. High Frequency Laminates & Prepregs" /></div>
      <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Tagline</label><input class="a-input" name="tagline" placeholder="High Performance Materials for RF/Microwave" /></div>
      <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Description</label><textarea class="a-textarea" name="description" rows="3"></textarea></div>
      <div class="a-field" style="margin-top:12px;"><label class="a-label">Official Website URL</label><input class="a-input" name="website" placeholder="https://..." /></div>
      <div class="a-field" style="margin-top:12px;"><label class="a-label">Accent Theme Color</label><input class="a-input" name="accentColor" value="#2563EB" placeholder="#2563EB" /></div>
      <div class="a-field" style="margin-top:12px;">
        <label class="a-label">Visibility Status</label>
        <select class="a-input" name="visible">
          <option value="true" selected>Visible in Public Catalog</option>
          <option value="false">Hidden (Draft / Archive)</option>
        </select>
      </div>
      ${renderImageUploadField('logoImg', 'Principal Logo Image', '', 'Upload PNG/SVG logo with transparent background')}
    `, (data) => {
      const slug = (data.shortName || data.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const newOem = {
        id: slug + '-' + Date.now(),
        name: data.name,
        shortName: data.shortName || data.name,
        specialty: data.specialty,
        category: data.specialty,
        tagline: data.tagline || '',
        description: data.description || '',
        website: data.website || '',
        accentColor: data.accentColor || '#2563EB',
        glowColor: (data.accentColor || '#2563EB') + '40',
        logoImg: data.logoImg || '',
        visible: data.visible === 'true',
        categories: [
          {
            id: 'general',
            name: 'General Products',
            label: '',
            description: 'Core product line and components',
            visible: true,
            products: []
          }
        ]
      };
      oems.push(newOem);
      expandedOemIds.add(newOem.id);
      return persistCatalog(oems, `Added OEM "${newOem.name}".`);
    });
  });

  // Edit OEM
  document.querySelectorAll('.btn-edit-oem').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const o = oems[idx];

      openModal('Edit OEM: ' + o.name, `
        <div class="a-field"><label class="a-label">OEM / Principal Name *</label><input class="a-input" name="name" value="${o.name}" required /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Short Display Name *</label><input class="a-input" name="shortName" value="${o.shortName || o.name}" required /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Specialty / Domain *</label><input class="a-input" name="specialty" value="${o.specialty || o.category || ''}" required /></div>
        <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Tagline</label><input class="a-input" name="tagline" value="${o.tagline || ''}" /></div>
        <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Description</label><textarea class="a-textarea" name="description" rows="3">${o.description || ''}</textarea></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Official Website URL</label><input class="a-input" name="website" value="${o.website || ''}" /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Accent Theme Color</label><input class="a-input" name="accentColor" value="${o.accentColor || '#2563EB'}" /></div>
        <div class="a-field" style="margin-top:12px;">
          <label class="a-label">Visibility Status</label>
          <select class="a-input" name="visible">
            <option value="true" ${o.visible !== false ? 'selected' : ''}>Visible in Public Catalog</option>
            <option value="false" ${o.visible === false ? 'selected' : ''}>Hidden (Draft / Archive)</option>
          </select>
        </div>
        ${renderImageUploadField('logoImg', 'Principal Logo Image', o.logoImg || '', 'Upload PNG/SVG logo with transparent background')}
      `, (data) => {
        oems[idx] = {
          ...o,
          name: data.name,
          shortName: data.shortName || data.name,
          specialty: data.specialty,
          category: data.specialty,
          tagline: data.tagline || '',
          description: data.description || '',
          website: data.website || '',
          accentColor: data.accentColor || '#2563EB',
          glowColor: (data.accentColor || '#2563EB') + '40',
          logoImg: data.logoImg,
          visible: data.visible === 'true',
        };
        return persistCatalog(oems, `OEM "${data.name}" updated.`);
      });
    });
  });

  // Delete OEM
  document.querySelectorAll('.btn-del-oem').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const o = oems[idx];
      let pCount = 0;
      (o.categories || []).forEach(c => pCount += (c.products || []).length);

      if (confirm(`Are you sure you want to delete OEM "${o.name}" and all of its ${pCount} products?\n\nThis cannot be undone.`)) {
        expandedOemIds.delete(o.id);
        oems.splice(idx, 1);
        void persistCatalog(oems, `Deleted OEM "${o.name}".`);
      }
    });
  });

  // ─── CATEGORY MANAGEMENT EVENTS ───

  // Toggle Category Visibility
  document.querySelectorAll('.btn-toggle-cat-vis').forEach(btn => {
    btn.addEventListener('click', () => {
      const oemIdx = parseInt(btn.getAttribute('data-oem-idx'), 10);
      const catIdx = parseInt(btn.getAttribute('data-cat-idx'), 10);
      const cat = oems[oemIdx]?.categories?.[catIdx];
      if (!cat) return;

      cat.visible = cat.visible === false ? true : false;
      void persistCatalog(oems, `Category "${cat.name}" is now ${cat.visible ? 'visible' : 'hidden'}.`);
    });
  });

  // Move Category Up / Down
  document.querySelectorAll('.btn-move-cat').forEach(btn => {
    btn.addEventListener('click', () => {
      const oemIdx = parseInt(btn.getAttribute('data-oem-idx'), 10);
      const catIdx = parseInt(btn.getAttribute('data-cat-idx'), 10);
      const dir = btn.getAttribute('data-dir');
      const oem = oems[oemIdx];
      if (!oem || !oem.categories) return;

      const targetIdx = dir === 'up' ? catIdx - 1 : catIdx + 1;
      oem.categories = reorderArray(oem.categories, catIdx, targetIdx);
      void persistCatalog(oems, 'Categories reordered.');
    });
  });

  // Add Category to OEM
  document.querySelectorAll('.btn-add-cat-to-oem').forEach(btn => {
    btn.addEventListener('click', () => {
      const oemIdx = parseInt(btn.getAttribute('data-oem-idx'), 10);
      const oem = oems[oemIdx];
      if (!oem) return;

      openModal(`Add Product Category to ${oem.name}`, `
        <div class="a-field">
          <label class="a-label">Category Title / Name *</label>
          <input class="a-input" name="name" required placeholder="e.g. RT/Duroid or RO4000 Series" />
        </div>
        <div class="a-field" style="margin-top:12px;">
          <label class="a-label">Category ID / Slug (Optional)</label>
          <input class="a-input" name="id" placeholder="e.g. rt-duroid (auto-generated if left blank)" />
        </div>
        <div class="a-field" style="margin-top:12px;">
          <label class="a-label">Category Tag / Label (Optional)</label>
          <input class="a-input" name="label" placeholder="e.g. Flagship Line, Low Loss, Mil-Spec" />
        </div>
        <div class="a-field" style="margin-top:12px;">
          <label class="a-label">Visibility Status</label>
          <select class="a-input" name="visible">
            <option value="true" selected>Visible in Public Catalog</option>
            <option value="false">Hidden (Draft / Archive)</option>
          </select>
        </div>
        <div class="a-field span2" style="margin-top:12px;">
          <label class="a-label">Category Description &amp; Overview</label>
          <textarea class="a-textarea" name="description" rows="3" placeholder="Overview of what this category covers, typical materials, frequency domains..."></textarea>
        </div>
      `, (data) => {
        if (!oem.categories) oem.categories = [];
        const slug = (data.id || data.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const newCat = {
          id: slug || ('cat-' + Date.now()),
          name: data.name.trim(),
          label: (data.label || '').trim(),
          description: (data.description || '').trim(),
          visible: data.visible === 'true',
          products: []
        };

        oem.categories.push(newCat);
        expandedOemIds.add(oem.id);
        expandedCategoryKeys.add(`${oem.id}__${newCat.id}`);
        return persistCatalog(oems, `Category "${newCat.name}" added to ${oem.shortName || oem.name}.`);
      });
    });
  });

  // Edit Category
  document.querySelectorAll('.btn-edit-category').forEach(btn => {
    btn.addEventListener('click', () => {
      const oemIdx = parseInt(btn.getAttribute('data-oem-idx'), 10);
      const catIdx = parseInt(btn.getAttribute('data-cat-idx'), 10);
      const oem = oems[oemIdx];
      const cat = oem?.categories?.[catIdx];
      if (!oem || !cat) return;

      openModal(`Edit Category: ${cat.name}`, `
        <div class="a-field">
          <label class="a-label">Category Title / Name *</label>
          <input class="a-input" name="name" value="${cat.name || ''}" required />
        </div>
        <div class="a-field" style="margin-top:12px;">
          <label class="a-label">Category ID / Slug</label>
          <input class="a-input" name="id" value="${cat.id || ''}" required />
        </div>
        <div class="a-field" style="margin-top:12px;">
          <label class="a-label">Category Tag / Label (Optional)</label>
          <input class="a-input" name="label" value="${cat.label || ''}" placeholder="e.g. Flagship Line, Low Loss, Mil-Spec" />
        </div>
        <div class="a-field" style="margin-top:12px;">
          <label class="a-label">Visibility Status</label>
          <select class="a-input" name="visible">
            <option value="true" ${cat.visible !== false ? 'selected' : ''}>Visible in Public Catalog</option>
            <option value="false" ${cat.visible === false ? 'selected' : ''}>Hidden (Draft / Archive)</option>
          </select>
        </div>
        <div class="a-field span2" style="margin-top:12px;">
          <label class="a-label">Category Description &amp; Overview</label>
          <textarea class="a-textarea" name="description" rows="3">${cat.description || ''}</textarea>
        </div>
      `, (data) => {
        const oldCatName = cat.name;
        const newCatName = data.name.trim();

        cat.name = newCatName;
        cat.id = (data.id || cat.id).trim();
        cat.label = (data.label || '').trim();
        cat.description = (data.description || '').trim();
        cat.visible = data.visible === 'true';

        // Cascade category name to all contained products
        if (oldCatName !== newCatName && Array.isArray(cat.products)) {
          cat.products.forEach(p => {
            p.category = newCatName;
          });
        }

        expandedOemIds.add(oem.id);
        return persistCatalog(oems, `Category "${newCatName}" updated.`);
      });
    });
  });

  // Delete Category
  document.querySelectorAll('.btn-del-category').forEach(btn => {
    btn.addEventListener('click', () => {
      const oemIdx = parseInt(btn.getAttribute('data-oem-idx'), 10);
      const catIdx = parseInt(btn.getAttribute('data-cat-idx'), 10);
      const oem = oems[oemIdx];
      const cat = oem?.categories?.[catIdx];
      if (!oem || !cat) return;

      const prodCount = (cat.products || []).length;
      if (confirm(`Are you sure you want to delete category "${cat.name}" and all ${prodCount} products inside it?\n\nThis action cannot be undone.`)) {
        expandedCategoryKeys.delete(`${oem.id}__${cat.id || catIdx}`);
        oem.categories.splice(catIdx, 1);
        void persistCatalog(oems, `Deleted category "${cat.name}".`);
      }
    });
  });

  // ─── PRODUCT PORTFOLIO & CATALOG MANAGEMENT EVENTS ───

  // Add Product to Category
  document.querySelectorAll('.btn-add-prod-to-cat').forEach(btn => {
    btn.addEventListener('click', () => {
      const oemIdx = parseInt(btn.getAttribute('data-oem-idx'), 10);
      const catIdx = parseInt(btn.getAttribute('data-cat-idx'), 10);
      const oem = oems[oemIdx];
      const cat = oem?.categories?.[catIdx];
      if (!oem || !cat) return;

      openModal(`Add Product to ${cat.name} (${oem.name})`, `
        <div class="a-field">
          <label class="a-label">Product Model / Part No. *</label>
          <input class="a-input" name="name" required placeholder="e.g. RT/duroid 5880 or QPA2211" />
        </div>
        <div class="a-field" style="margin-top:12px;">
          <label class="a-label">Product ID / Part Identifier (Optional)</label>
          <input class="a-input" name="id" placeholder="e.g. 5880-laminate (auto-generated if left blank)" />
        </div>
        <div class="a-field" style="margin-top:12px;">
          <label class="a-label">Visibility Status</label>
          <select class="a-input" name="visible">
            <option value="true" selected>Visible in Public Catalog</option>
            <option value="false">Hidden (Draft / Archive)</option>
          </select>
        </div>
        ${renderImageUploadField('image', 'Product Image / Hardware Photo', '', 'Upload high-resolution component photo or diagram')}
        <div class="a-field span2" style="margin-top:12px;">
          <label class="a-label">Technical Description</label>
          <textarea class="a-textarea" name="description" rows="3" placeholder="Key electrical characteristics, frequency range, packaging, etc."></textarea>
        </div>
        <div class="a-field span2" style="margin-top:12px;">
          <label class="a-label">Specifications &amp; Target Applications</label>
          <textarea class="a-textarea" name="applications" rows="3" placeholder="e.g. Military Radar, Satellite Communications, 5G/6G mmWave..."></textarea>
        </div>
        <div class="a-field span2" style="margin-top:12px;">
          <label class="a-label">Datasheet / Official Product URL</label>
          <input class="a-input" name="link" placeholder="https://..." />
        </div>
        <div class="a-field span2" style="margin-top:12px;">
          <label class="a-label">Custom SEO Meta Title (Optional)</label>
          <input class="a-input" name="seoTitle" placeholder="Leave blank to use automatic: [Model] — [OEM] [Category] | ICON ELECTROMATIC" />
        </div>
        <div class="a-field span2" style="margin-top:12px;">
          <label class="a-label">Custom SEO Meta Description (Optional)</label>
          <textarea class="a-textarea" name="seoDescription" rows="2" placeholder="Leave blank to generate automatically from product description and applications"></textarea>
        </div>
      `, (data) => {
        if (!cat.products) cat.products = [];

        const prodSlug = (data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'prod') + '-' + Date.now().toString().slice(-4);
        const newProd = {
          id: (data.id ? data.id.trim() : prodSlug),
          name: data.name.trim(),
          category: cat.name,
          image: data.image || oem.defaultImage || '',
          description: data.description || '',
          applications: data.applications || '',
          link: data.link || '',
          visible: data.visible === 'true',
          seoTitle: (data.seoTitle || '').trim(),
          seoDescription: (data.seoDescription || '').trim(),
        };

        cat.products.push(newProd);
        expandedOemIds.add(oem.id);
        expandedCategoryKeys.add(`${oem.id}__${cat.id || catIdx}`);
        return persistCatalog(oems, `Added product "${newProd.name}" to ${cat.name}.`);
      });
    });
  });

  // Edit Product
  document.querySelectorAll('.btn-edit-product').forEach(btn => {
    btn.addEventListener('click', () => {
      const oemIdx = parseInt(btn.getAttribute('data-oem-idx'), 10);
      const catIdx = parseInt(btn.getAttribute('data-cat-idx'), 10);
      const prodIdx = parseInt(btn.getAttribute('data-prod-idx'), 10);

      const oem = oems[oemIdx];
      const cat = oem?.categories?.[catIdx];
      const prod = cat?.products?.[prodIdx];
      if (!oem || !cat || !prod) return;

      const existingCats = (oem.categories || []).map(c => c.name);
      const catOptions = existingCats.map(c => `<option value="${c}">${c}</option>`).join('');

      openModal(`Edit Product: ${prod.name}`, `
        <div class="a-field">
          <label class="a-label">Product Model / Part No. *</label>
          <input class="a-input" name="name" value="${prod.name || ''}" required />
        </div>
        <div class="a-field" style="margin-top:12px;">
          <label class="a-label">Product ID</label>
          <input class="a-input" name="id" value="${prod.id || ''}" />
        </div>
        <div class="a-field" style="margin-top:12px;">
          <label class="a-label">Category Name *</label>
          <input class="a-input" name="category" list="cat-suggestions" value="${cat.name}" required />
          <datalist id="cat-suggestions">
            ${catOptions}
          </datalist>
          <small style="color:var(--a-muted);font-size:0.75rem;">Modify to move this product into another category.</small>
        </div>
        <div class="a-field" style="margin-top:12px;">
          <label class="a-label">Visibility Status</label>
          <select class="a-input" name="visible">
            <option value="true" ${prod.visible !== false ? 'selected' : ''}>Visible in Public Catalog</option>
            <option value="false" ${prod.visible === false ? 'selected' : ''}>Hidden (Draft / Archive)</option>
          </select>
        </div>
        ${renderImageUploadField('image', 'Product Image / Hardware Photo', prod.image || '', 'Upload high-resolution component photo or diagram')}
        <div class="a-field span2" style="margin-top:12px;">
          <label class="a-label">Technical Description</label>
          <textarea class="a-textarea" name="description" rows="3">${prod.description || ''}</textarea>
        </div>
        <div class="a-field span2" style="margin-top:12px;">
          <label class="a-label">Specifications &amp; Target Applications</label>
          <textarea class="a-textarea" name="applications" rows="3">${prod.applications || ''}</textarea>
        </div>
        <div class="a-field span2" style="margin-top:12px;">
          <label class="a-label">Datasheet / Official Product URL</label>
          <input class="a-input" name="link" value="${prod.link || ''}" />
        </div>
        <div class="a-field span2" style="margin-top:12px;">
          <label class="a-label">Custom SEO Meta Title (Optional)</label>
          <input class="a-input" name="seoTitle" value="${prod.seoTitle || prod.sourceData?.seo?.title || ''}" placeholder="Leave blank to use automatic: [Model] — [OEM] [Category] | ICON ELECTROMATIC" />
        </div>
        <div class="a-field span2" style="margin-top:12px;">
          <label class="a-label">Custom SEO Meta Description (Optional)</label>
          <textarea class="a-textarea" name="seoDescription" rows="2" placeholder="Leave blank to generate automatically from product description and applications">${prod.seoDescription || prod.sourceData?.seo?.description || ''}</textarea>
        </div>
      `, (data) => {
        const newCatName = (data.category || cat.name).trim();
        const updatedProd = {
          ...prod,
          name: data.name.trim(),
          id: (data.id || prod.id).trim(),
          category: newCatName,
          image: data.image,
          description: data.description || '',
          applications: data.applications || '',
          link: data.link || '',
          visible: data.visible === 'true',
          seoTitle: (data.seoTitle || '').trim(),
          seoDescription: (data.seoDescription || '').trim(),
        };

        if (newCatName.toLowerCase() === cat.name.toLowerCase()) {
          cat.products[prodIdx] = updatedProd;
        } else {
          cat.products.splice(prodIdx, 1);
          let targetCat = oem.categories.find(c => c.name.toLowerCase() === newCatName.toLowerCase());
          if (!targetCat) {
            const catSlug = newCatName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            targetCat = {
              id: catSlug || ('cat-' + Date.now()),
              name: newCatName,
              label: '',
              description: '',
              visible: true,
              products: []
            };
            oem.categories.push(targetCat);
          }
          targetCat.products.push(updatedProd);
        }

        expandedOemIds.add(oem.id);
        return persistCatalog(oems, `Product "${updatedProd.name}" updated.`);
      });
    });
  });

  // Delete Product
  document.querySelectorAll('.btn-del-product').forEach(btn => {
    btn.addEventListener('click', () => {
      const oemIdx = parseInt(btn.getAttribute('data-oem-idx'), 10);
      const catIdx = parseInt(btn.getAttribute('data-cat-idx'), 10);
      const prodIdx = parseInt(btn.getAttribute('data-prod-idx'), 10);

      const oem = oems[oemIdx];
      const cat = oem?.categories?.[catIdx];
      const prod = cat?.products?.[prodIdx];
      if (!oem || !cat || !prod) return;

      if (confirm(`Delete product "${prod.name}" from ${cat.name}?`)) {
        cat.products.splice(prodIdx, 1);
        void persistCatalog(oems, `Deleted product "${prod.name}".`);
      }
    });
  });

  // Move Product Up / Down within Category
  document.querySelectorAll('.btn-move-prod').forEach(btn => {
    btn.addEventListener('click', () => {
      const oemIdx = parseInt(btn.getAttribute('data-oem-idx'), 10);
      const catIdx = parseInt(btn.getAttribute('data-cat-idx'), 10);
      const prodIdx = parseInt(btn.getAttribute('data-prod-idx'), 10);
      const dir = btn.getAttribute('data-dir');

      const oem = oems[oemIdx];
      const cat = oem?.categories?.[catIdx];
      if (!cat || !cat.products) return;

      const targetIdx = dir === 'up' ? prodIdx - 1 : prodIdx + 1;
      cat.products = reorderArray(cat.products, prodIdx, targetIdx);
      void persistCatalog(oems, 'Products reordered.');
    });
  });

  // Toggle Product Visibility
  document.querySelectorAll('.btn-toggle-prod-vis').forEach(btn => {
    btn.addEventListener('click', () => {
      const oemIdx = parseInt(btn.getAttribute('data-oem-idx'), 10);
      const catIdx = parseInt(btn.getAttribute('data-cat-idx'), 10);
      const prodIdx = parseInt(btn.getAttribute('data-prod-idx'), 10);

      const oem = oems[oemIdx];
      const cat = oem?.categories?.[catIdx];
      const prod = cat?.products?.[prodIdx];
      if (!prod) return;

      prod.visible = prod.visible === false ? true : false;
      void persistCatalog(oems, `Product "${prod.name}" is now ${prod.visible ? 'visible' : 'hidden'}.`);
    });
  });
}

// ─── PARTNERS TAB ────────────────────────────────────────────────────────────
function renderPartnersTab() {
  const d = ContentService.getData('partners') || {};
  const partners = Array.isArray(d) ? d : (d.partners || []);
  const heroTitle = d.heroTitle || 'Authorized Technology Partners';
  const heroLead = d.heroLead || 'We represent a diverse portfolio of OEMs across sectors, industries and application.<br />To know more about their products, make an enquiry or request samples just get in touch with us.';
  const trustBadge1 = d.trustBadge1 || '<strong>10+</strong> Global Technology Partners';
  const trustBadge2 = d.trustBadge2 || 'Space &amp; Mil-Spec Screening Support';

  const rows = partners.map((p, idx) => {
    const logo = ImageStorage.resolveImageUrl(p.logoImg);
    return `
      <tr>
        <td style="width:90px;">
          <div class="a-reorder-group">
            <button class="a-btn-reorder btn-move-partner" data-dir="up" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
            <button class="a-btn-reorder btn-move-partner" data-dir="down" data-idx="${idx}" ${idx === partners.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
          </div>
        </td>
        <td>${logo ? `<img src="${logo}" class="a-img-preview" alt="${p.name}">` : '<span style="color:#94a3b8;font-size:0.75rem;">No logo</span>'}</td>
        <td><strong>${p.name}</strong></td>
        <td style="color:var(--a-muted);font-size:0.8rem;">${p.domain || '—'}</td>
        <td>
          <button class="a-btn a-btn-outline a-btn-sm partner-edit-btn" data-idx="${idx}"><i class="fa-solid fa-pen"></i> Edit</button>
          <button class="a-btn a-btn-danger a-btn-sm partner-del-btn" data-idx="${idx}" style="margin-left:6px;"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <!-- Partners Page Header & Trust Badges Editor -->
    <div class="a-cards-box" style="margin-bottom:24px;">
      <div class="a-cards-box-header">
        <div>
          <h3>Partners Page Hero &amp; Badges</h3>
          <p>Customize banner title, introductory lead, and trust counters (supports lowercase/capital edits)</p>
        </div>
      </div>
      <form id="a-partners-hero-form" style="padding:16px 20px;">
        <div class="a-field">
          <label class="a-label">Page Title</label>
          <input class="a-input" name="heroTitle" value="${heroTitle}" required />
        </div>
        <div class="a-field" style="margin-top:12px;">
          <label class="a-label">Introductory Lead Text</label>
          <textarea class="a-textarea" name="heroLead" rows="2" required>${heroLead}</textarea>
        </div>
        <div class="a-field-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">
          <div class="a-field">
            <label class="a-label">Trust Badge 1</label>
            <input class="a-input" name="trustBadge1" value="${trustBadge1}" required />
          </div>
          <div class="a-field">
            <label class="a-label">Trust Badge 2</label>
            <input class="a-input" name="trustBadge2" value="${trustBadge2}" required />
          </div>
        </div>
        <div style="margin-top:16px;text-align:right;">
          <button type="submit" class="a-btn a-btn-primary a-btn-sm"><i class="fa-solid fa-floppy-disk"></i> Save Hero &amp; Badges</button>
        </div>
      </form>
    </div>

    <div class="a-cards-box">
      <div class="a-cards-box-header">
        <div>
          <h3>All Technology Partners (${partners.length})</h3>
          <p>Add, edit, delete, and reorder partners with live logo upload</p>
        </div>
        <button type="button" class="a-btn a-btn-primary a-btn-sm" id="partner-add-btn"><i class="fa-solid fa-plus"></i> Add Partner</button>
      </div>
      <div class="a-table-wrap">
        <table class="a-table">
          <thead><tr><th>Reorder</th><th>Logo</th><th>Partner Name</th><th>Domain / Specialty</th><th>Actions</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function bindPartnersTabEvents() {
  const d = ContentService.getData('partners') || {};
  const partners = Array.isArray(d) ? d : (d.partners || []);

  const saveAll = async (newPartners) => {
    let payload;
    if (Array.isArray(d)) {
      payload = newPartners;
    } else {
      d.partners = newPartners;
      payload = d;
    }
    await ContentService.saveData('partners', payload);
    rerender();
  };

  document.getElementById('a-partners-hero-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      const fd = new FormData(e.target);
      const existing = ContentService.getData('partners') || {};
      const updated = Array.isArray(existing) ? { partners: existing } : { ...existing };
      fd.forEach((v, k) => { updated[k] = v; });
      await ContentService.saveData('partners', updated);
      rerender();
      showToast('Partners hero banner updated!', 'success');
    } catch (err) {
      showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed to save partners hero: ' + err.message, 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  document.getElementById('partner-add-btn')?.addEventListener('click', () => {
    openModal('Add New Technology Partner', `
      <div class="a-field"><label class="a-label">Partner Name</label><input class="a-input" name="name" required /></div>
      <div class="a-field" style="margin-top:12px;"><label class="a-label">Domain / Specialty</label><input class="a-input" name="domain" placeholder="e.g. High-Frequency Laminates" /></div>
      <div class="a-field" style="margin-top:12px;"><label class="a-label">Accent Color (red / blue)</label><input class="a-input" name="accentColor" value="blue" /></div>
      ${renderImageUploadField('logoImg', 'Partner Brand Logo', '', 'Transparent PNG/SVG')}
      <div class="a-field" style="margin-top:12px;"><label class="a-label">Official Website URL</label><input class="a-input" name="website" placeholder="https://..." /></div>
      <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Description</label><textarea class="a-textarea" name="description"></textarea></div>
    `, async (data) => {
      partners.push({
        id: 'partner-' + Date.now(),
        ...data,
      });
      await saveAll(partners);
      showToast('Partner added.', 'success');
    });
  });

  document.querySelectorAll('.partner-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const p = partners[idx];
      openModal('Edit Partner: ' + p.name, `
        <div class="a-field"><label class="a-label">Partner Name</label><input class="a-input" name="name" value="${p.name}" required /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Domain / Specialty</label><input class="a-input" name="domain" value="${p.domain || ''}" /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Accent Color (red / blue)</label><input class="a-input" name="accentColor" value="${p.accentColor || 'blue'}" /></div>
        ${renderImageUploadField('logoImg', 'Partner Brand Logo', p.logoImg || '', 'Transparent PNG/SVG')}
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Official Website URL</label><input class="a-input" name="website" value="${p.website || ''}" /></div>
        <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Description</label><textarea class="a-textarea" name="description">${p.description || ''}</textarea></div>
      `, async (data) => {
        partners[idx] = { ...p, ...data };
        await saveAll(partners);
        showToast('Partner updated.', 'success');
      });
    });
  });

  document.querySelectorAll('.partner-del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      if (!confirm('Delete this partner?')) return;
      btn.disabled = true;
      try {
        partners.splice(idx, 1);
        await saveAll(partners);
        showToast('Partner deleted.', 'info');
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed to delete partner: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });

  document.querySelectorAll('.btn-move-partner').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const dir = btn.getAttribute('data-dir');
      const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
      btn.disabled = true;
      try {
        const reordered = reorderArray(partners, idx, targetIdx);
        await saveAll(reordered);
        showToast('Partners reordered!', 'success');
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed to move partner: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });
}

// ─── BLOGS & OEM TECH HUBS TAB ──────────────────────────────────────────────
const expandedBlogOemIds = new Set();
let blogSearchQuery = '';

function getCmsBlogsPayload() {
  const data = ContentService.getData('blogs');
  if (data && Array.isArray(data.oemBlogs)) {
    return data;
  }
  return {
    heroTitle: 'OEM Technical News, Video Demos & Insights',
    heroSubtitle: 'Direct technical bulletins, video demonstrations, application whitepapers, and product release updates from ICON Electromatic\'s 15 global manufacturing partners.',
    trustBadge1: 'Application Whitepapers & Notes',
    trustBadge2: 'Video Demos & Technical Webinars',
    trustBadge3: 'Direct Manufacturer Bulletins',
    oemBlogs: []
  };
}

function renderBlogsTab() {
  const cmsBlogs = getCmsBlogsPayload();
  const oemBlogs = cmsBlogs.oemBlogs || [];

  // Ensure all 15 OEMs from CATALOG exist in oemBlogs
  CATALOG.forEach(oem => {
    let b = oemBlogs.find(x => x.oemId === oem.id);
    if (!b) {
      b = {
        oemId: oem.id,
        officialWebsite: oem.website || '',
        portalName: `${oem.name} Technology Hub`,
        headline: oem.tagline || oem.description || '',
        visible: true,
        articles: [],
        videos: [],
        whitepapers: [],
        officialLinks: []
      };
      oemBlogs.push(b);
    }
  });

  const totalOems = CATALOG.length;
  let totalArticles = 0;
  let totalVideos = 0;
  let totalWhitepapers = 0;

  oemBlogs.forEach(b => {
    totalArticles += (b.articles || []).length;
    totalVideos += (b.videos || []).length;
    totalWhitepapers += (b.whitepapers || []).length;
  });

  const q = (blogSearchQuery || '').trim().toLowerCase();

  const oemCardsHtml = CATALOG.map(oem => {
    const b = oemBlogs.find(x => x.oemId === oem.id) || {
      oemId: oem.id,
      officialWebsite: oem.website || '',
      portalName: `${oem.name} Technology Hub`,
      headline: '',
      visible: true,
      articles: [],
      videos: [],
      whitepapers: [],
      officialLinks: []
    };

    const articles = b.articles || [];
    const videos = b.videos || [];
    const whitepapers = b.whitepapers || [];
    const links = b.officialLinks || [];
    const totalUpdates = articles.length + videos.length + whitepapers.length + links.length;

    // Search filter
    if (q) {
      const matchOem = (oem.name || '').toLowerCase().includes(q) ||
                       (oem.shortName || '').toLowerCase().includes(q) ||
                       (b.portalName || '').toLowerCase().includes(q) ||
                       (b.headline || '').toLowerCase().includes(q);
      const matchArt = articles.some(a => (a.title || '').toLowerCase().includes(q) || (a.summary || '').toLowerCase().includes(q) || (a.category || '').toLowerCase().includes(q));
      const matchVid = videos.some(v => (v.title || '').toLowerCase().includes(q) || (v.speaker || '').toLowerCase().includes(q) || (v.summary || '').toLowerCase().includes(q));
      const matchWp = whitepapers.some(w => (w.title || '').toLowerCase().includes(q) || (w.author || '').toLowerCase().includes(q) || (w.summary || '').toLowerCase().includes(q));
      if (!matchOem && !matchArt && !matchVid && !matchWp) {
        return '';
      }
    }

    const isExpanded = expandedBlogOemIds.has(oem.id) || (q.length > 0);
    const isHidden = b.visible === false;
    const resolvedLogo = ImageStorage.resolveImageUrl(oem.logoImg);

    let oemHubPanelHtml = '';
    if (isExpanded) {
      // 1. Articles Rows
      const articleRows = articles.map((art, aIdx) => {
        const artImg = ImageStorage.resolveImageUrl(art.image);
        const isArtHidden = art.visible === false;
        return `
          <tr class="${isArtHidden ? 'a-row-hidden' : ''}">
            <td style="width: 70px;">
              <div class="a-reorder-group">
                <button type="button" class="a-btn-reorder btn-move-oem-art" data-oem-id="${oem.id}" data-idx="${aIdx}" data-dir="up" ${aIdx === 0 ? 'disabled' : ''} title="Move Up"><i class="fa-solid fa-arrow-up"></i></button>
                <button type="button" class="a-btn-reorder btn-move-oem-art" data-oem-id="${oem.id}" data-idx="${aIdx}" data-dir="down" ${aIdx === articles.length - 1 ? 'disabled' : ''} title="Move Down"><i class="fa-solid fa-arrow-down"></i></button>
              </div>
            </td>
            <td style="width: 60px;">
              <div class="a-prod-thumb-box">
                ${artImg ? `<img src="${artImg}" alt="${art.title}" />` : '<i class="fa-solid fa-newspaper" style="color:#64748b;"></i>'}
              </div>
            </td>
            <td>
              <div class="a-prod-name-box">
                <strong>${art.title || 'Untitled Article'}</strong>
                <span>${art.date || 'No date'} · ${art.readTime || '5 min'}</span>
              </div>
            </td>
            <td><span class="a-badge a-badge-blue">${art.category || 'Technical News'}</span></td>
            <td>
              <div class="a-prod-text-snippet" title="${art.summary || ''}">
                ${art.summary || '<span style="color:#94a3b8;font-style:italic;">No excerpt</span>'}
              </div>
              <div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap;">
                ${(art.tags || []).slice(0, 3).map(t => `<span style="font-size:0.68rem;background:#f1f5f9;color:#475569;padding:1px 6px;border-radius:4px;">#${t}</span>`).join('')}
              </div>
            </td>
            <td>
              <button type="button" class="a-btn a-btn-sm btn-toggle-art-vis" data-oem-id="${oem.id}" data-idx="${aIdx}" style="${isArtHidden ? 'opacity:0.6;background:#f1f5f9;color:#64748b;' : 'background:#ecfdf5;color:#059669;border-color:#a7f3d0;'}">
                <i class="fa-solid ${isArtHidden ? 'fa-eye-slash' : 'fa-eye'}"></i> ${isArtHidden ? 'Hidden' : 'Visible'}
              </button>
            </td>
            <td style="white-space:nowrap;">
              <button type="button" class="a-btn a-btn-outline a-btn-sm btn-edit-oem-art" data-oem-id="${oem.id}" data-idx="${aIdx}"><i class="fa-solid fa-pen"></i> Edit</button>
              <button type="button" class="a-btn a-btn-danger a-btn-sm btn-del-oem-art" data-oem-id="${oem.id}" data-idx="${aIdx}" style="margin-left:4px;"><i class="fa-solid fa-trash"></i></button>
            </td>
          </tr>
        `;
      }).join('');

      // 2. Videos Rows
      const videoRows = videos.map((vid, vIdx) => {
        const vidThumb = ImageStorage.resolveImageUrl(vid.thumbnail);
        const isVidHidden = vid.visible === false;
        return `
          <tr class="${isVidHidden ? 'a-row-hidden' : ''}">
            <td style="width: 70px;">
              <div class="a-reorder-group">
                <button type="button" class="a-btn-reorder btn-move-oem-vid" data-oem-id="${oem.id}" data-idx="${vIdx}" data-dir="up" ${vIdx === 0 ? 'disabled' : ''} title="Move Up"><i class="fa-solid fa-arrow-up"></i></button>
                <button type="button" class="a-btn-reorder btn-move-oem-vid" data-oem-id="${oem.id}" data-idx="${vIdx}" data-dir="down" ${vIdx === videos.length - 1 ? 'disabled' : ''} title="Move Down"><i class="fa-solid fa-arrow-down"></i></button>
              </div>
            </td>
            <td style="width: 60px;">
              <div class="a-prod-thumb-box" style="position:relative;">
                ${vidThumb ? `<img src="${vidThumb}" alt="${vid.title}" />` : '<i class="fa-solid fa-video" style="color:#64748b;"></i>'}
                <i class="fa-solid fa-play" style="position:absolute;font-size:0.6rem;color:#fff;background:rgba(225,29,72,0.85);padding:3px;border-radius:50%;"></i>
              </div>
            </td>
            <td>
              <div class="a-prod-name-box">
                <strong>${vid.title || 'Untitled Video'}</strong>
                <span><i class="fa-solid fa-user-tie"></i> ${vid.speaker || 'Presenter'} · ${vid.duration || '0:00'}</span>
              </div>
            </td>
            <td>
              <div class="a-prod-text-snippet" title="${vid.summary || ''}">
                ${vid.summary || '<span style="color:#94a3b8;font-style:italic;">No description</span>'}
              </div>
              <div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap;">
                ${(vid.topics || []).slice(0, 3).map(tp => `<span style="font-size:0.68rem;background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:4px;">${tp}</span>`).join('')}
              </div>
            </td>
            <td>
              <button type="button" class="a-btn a-btn-sm btn-toggle-vid-vis" data-oem-id="${oem.id}" data-idx="${vIdx}" style="${isVidHidden ? 'opacity:0.6;background:#f1f5f9;color:#64748b;' : 'background:#ecfdf5;color:#059669;border-color:#a7f3d0;'}">
                <i class="fa-solid ${isVidHidden ? 'fa-eye-slash' : 'fa-eye'}"></i> ${isVidHidden ? 'Hidden' : 'Visible'}
              </button>
            </td>
            <td style="white-space:nowrap;">
              <button type="button" class="a-btn a-btn-outline a-btn-sm btn-edit-oem-vid" data-oem-id="${oem.id}" data-idx="${vIdx}"><i class="fa-solid fa-pen"></i> Edit</button>
              <button type="button" class="a-btn a-btn-danger a-btn-sm btn-del-oem-vid" data-oem-id="${oem.id}" data-idx="${vIdx}" style="margin-left:4px;"><i class="fa-solid fa-trash"></i></button>
            </td>
          </tr>
        `;
      }).join('');

      // 3. Whitepapers Rows
      const whitepaperRows = whitepapers.map((wp, wIdx) => {
        const isWpHidden = wp.visible === false;
        return `
          <tr class="${isWpHidden ? 'a-row-hidden' : ''}">
            <td style="width: 70px;">
              <div class="a-reorder-group">
                <button type="button" class="a-btn-reorder btn-move-oem-wp" data-oem-id="${oem.id}" data-idx="${wIdx}" data-dir="up" ${wIdx === 0 ? 'disabled' : ''} title="Move Up"><i class="fa-solid fa-arrow-up"></i></button>
                <button type="button" class="a-btn-reorder btn-move-oem-wp" data-oem-id="${oem.id}" data-idx="${wIdx}" data-dir="down" ${wIdx === whitepapers.length - 1 ? 'disabled' : ''} title="Move Down"><i class="fa-solid fa-arrow-down"></i></button>
              </div>
            </td>
            <td>
              <div class="a-prod-name-box">
                <strong>${wp.title || 'Untitled Whitepaper'}</strong>
                <span><i class="fa-solid fa-building"></i> ${wp.author || oem.name} · ${wp.date || ''}</span>
              </div>
            </td>
            <td>
              <span class="a-badge" style="background:#fee2e2;color:#991b1b;border:1px solid #fecaca;"><i class="fa-regular fa-file-pdf"></i> ${wp.pages || 'PDF'}</span>
              <span class="a-badge a-badge-blue" style="margin-left:4px;">${wp.frequencyBand || 'Broadband'}</span>
            </td>
            <td>
              <div class="a-prod-text-snippet" title="${wp.summary || ''}">
                ${wp.summary || '<span style="color:#94a3b8;font-style:italic;">No summary</span>'}
              </div>
              <div style="font-size:0.72rem;color:var(--a-muted);margin-top:2px;">
                ${(wp.keyFindings || []).length} key findings documented
              </div>
            </td>
            <td>
              <button type="button" class="a-btn a-btn-sm btn-toggle-wp-vis" data-oem-id="${oem.id}" data-idx="${wIdx}" style="${isWpHidden ? 'opacity:0.6;background:#f1f5f9;color:#64748b;' : 'background:#ecfdf5;color:#059669;border-color:#a7f3d0;'}">
                <i class="fa-solid ${isWpHidden ? 'fa-eye-slash' : 'fa-eye'}"></i> ${isWpHidden ? 'Hidden' : 'Visible'}
              </button>
            </td>
            <td style="white-space:nowrap;">
              <button type="button" class="a-btn a-btn-outline a-btn-sm btn-edit-oem-wp" data-oem-id="${oem.id}" data-idx="${wIdx}"><i class="fa-solid fa-pen"></i> Edit</button>
              <button type="button" class="a-btn a-btn-danger a-btn-sm btn-del-oem-wp" data-oem-id="${oem.id}" data-idx="${wIdx}" style="margin-left:4px;"><i class="fa-solid fa-trash"></i></button>
            </td>
          </tr>
        `;
      }).join('');

      // 4. Official Links Rows
      const linkRows = links.map((l, lIdx) => {
        return `
          <tr>
            <td style="width: 70px;">
              <div class="a-reorder-group">
                <button type="button" class="a-btn-reorder btn-move-oem-link" data-oem-id="${oem.id}" data-idx="${lIdx}" data-dir="up" ${lIdx === 0 ? 'disabled' : ''} title="Move Up"><i class="fa-solid fa-arrow-up"></i></button>
                <button type="button" class="a-btn-reorder btn-move-oem-link" data-oem-id="${oem.id}" data-idx="${lIdx}" data-dir="down" ${lIdx === links.length - 1 ? 'disabled' : ''} title="Move Down"><i class="fa-solid fa-arrow-down"></i></button>
              </div>
            </td>
            <td style="width:40px;text-align:center;"><i class="fa-solid ${l.icon || 'fa-globe'}" style="color:var(--a-blue);font-size:1.1rem;"></i></td>
            <td>
              <strong>${l.title || 'Official Resource'}</strong>
              <div style="font-size:0.75rem;"><a href="${l.url}" target="_blank" rel="noopener" style="color:var(--a-blue);text-decoration:none;">${l.url} <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:0.65rem;"></i></a></div>
            </td>
            <td style="font-size:0.76rem;color:#475569;">${l.description || '—'}</td>
            <td style="white-space:nowrap;">
              <button type="button" class="a-btn a-btn-outline a-btn-sm btn-edit-oem-link" data-oem-id="${oem.id}" data-idx="${lIdx}"><i class="fa-solid fa-pen"></i> Edit</button>
              <button type="button" class="a-btn a-btn-danger a-btn-sm btn-del-oem-link" data-oem-id="${oem.id}" data-idx="${lIdx}" style="margin-left:4px;"><i class="fa-solid fa-trash"></i></button>
            </td>
          </tr>
        `;
      }).join('');

      oemHubPanelHtml = `
        <div class="a-oem-panel">
          <!-- Hub Profile Strip -->
          <div class="a-blog-hub-profile">
            <div class="a-blog-hub-info">
              <div><strong style="color:#0f172a;font-size:0.92rem;"><i class="fa-solid fa-building-columns" style="color:var(--a-blue);margin-right:6px;"></i> ${b.portalName || `${oem.name} Technology Hub`}</strong></div>
              <div><span style="color:#64748b;">Headline:</span> ${b.headline || oem.description}</div>
              <div><span style="color:#64748b;">Official Portal:</span> ${b.officialWebsite ? `<a href="${b.officialWebsite}" target="_blank" rel="noopener" style="color:var(--a-blue);">${b.officialWebsite}</a>` : '<span style="color:#94a3b8;">None configured</span>'}</div>
            </div>
            <button type="button" class="a-btn a-btn-outline a-btn-sm btn-edit-oem-hub" data-oem-id="${oem.id}">
              <i class="fa-solid fa-pen"></i> Edit Hub Profile
            </button>
          </div>

          <!-- 1. Articles Section -->
          <div class="a-blog-section-box">
            <div class="a-blog-section-header">
              <div>
                <div class="a-blog-section-title">
                  <i class="fa-solid fa-newspaper" style="color:var(--a-blue);"></i> Technical Articles &amp; News Releases (${articles.length})
                </div>
                <div class="a-blog-section-subtitle">Manage article headlines, publication dates, categories, excerpts, and full technical dispatch</div>
              </div>
              <button type="button" class="a-btn a-btn-primary a-btn-sm btn-add-oem-art" data-oem-id="${oem.id}">
                <i class="fa-solid fa-plus"></i> Add Article to ${oem.shortName}
              </button>
            </div>
            <div class="a-table-wrap">
              <table class="a-sub-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Cover</th>
                    <th>Headline &amp; Date</th>
                    <th>Category</th>
                    <th>Excerpt &amp; Tags</th>
                    <th>Visibility</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${articleRows || `<tr><td colspan="7" style="text-align:center;padding:18px;color:var(--a-muted);">No technical articles added yet. Click "+ Add Article to ${oem.shortName}" above.</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>

          <!-- 2. Videos Section -->
          <div class="a-blog-section-box">
            <div class="a-blog-section-header">
              <div>
                <div class="a-blog-section-title">
                  <i class="fa-solid fa-circle-play" style="color:#f59e0b;"></i> Demonstration Videos &amp; Webinars (${videos.length})
                </div>
                <div class="a-blog-section-subtitle">Manage lab sessions, speaker details, duration, video streaming URLs, and topics</div>
              </div>
              <button type="button" class="a-btn a-btn-primary a-btn-sm btn-add-oem-vid" data-oem-id="${oem.id}">
                <i class="fa-solid fa-plus"></i> Add Video to ${oem.shortName}
              </button>
            </div>
            <div class="a-table-wrap">
              <table class="a-sub-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Thumb</th>
                    <th>Video Title &amp; Speaker</th>
                    <th>Description &amp; Topics</th>
                    <th>Visibility</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${videoRows || `<tr><td colspan="6" style="text-align:center;padding:18px;color:var(--a-muted);">No demonstration videos added yet. Click "+ Add Video to ${oem.shortName}" above.</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>

          <!-- 3. Whitepapers Section -->
          <div class="a-blog-section-box">
            <div class="a-blog-section-header">
              <div>
                <div class="a-blog-section-title">
                  <i class="fa-solid fa-file-pdf" style="color:#ef4444;"></i> Engineering Whitepapers &amp; Notes (${whitepapers.length})
                </div>
                <div class="a-blog-section-subtitle">Manage research whitepapers, frequency bands, page count, PDF downloads, and key findings</div>
              </div>
              <button type="button" class="a-btn a-btn-primary a-btn-sm btn-add-oem-wp" data-oem-id="${oem.id}">
                <i class="fa-solid fa-plus"></i> Add Whitepaper to ${oem.shortName}
              </button>
            </div>
            <div class="a-table-wrap">
              <table class="a-sub-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Whitepaper Title &amp; Author</th>
                    <th>Format &amp; Band</th>
                    <th>Summary &amp; Key Findings</th>
                    <th>Visibility</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${whitepaperRows || `<tr><td colspan="6" style="text-align:center;padding:18px;color:var(--a-muted);">No whitepapers added yet. Click "+ Add Whitepaper to ${oem.shortName}" above.</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>

          <!-- 4. Official Resources & Links -->
          <div class="a-blog-section-box" style="margin-bottom:0;">
            <div class="a-blog-section-header">
              <div>
                <div class="a-blog-section-title">
                  <i class="fa-solid fa-link" style="color:var(--a-blue);"></i> Official Manufacturer Tools &amp; Portal Links (${links.length})
                </div>
                <div class="a-blog-section-subtitle">Direct links to manufacturer calculators, software, and design centers</div>
              </div>
              <button type="button" class="a-btn a-btn-primary a-btn-sm btn-add-oem-link" data-oem-id="${oem.id}">
                <i class="fa-solid fa-plus"></i> Add Official Link to ${oem.shortName}
              </button>
            </div>
            <div class="a-table-wrap">
              <table class="a-sub-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Icon</th>
                    <th>Resource Title &amp; URL</th>
                    <th>Description</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${linkRows || `<tr><td colspan="5" style="text-align:center;padding:18px;color:var(--a-muted);">No official links added yet. Click "+ Add Official Link to ${oem.shortName}" above.</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      `;
    }

    return `
      <div class="a-oem-card ${isHidden ? 'oem-hidden' : ''}" id="blog-oem-card-${oem.id}">
        <div class="a-oem-header">
          <div class="a-oem-header-left">
            <div class="a-oem-logo-thumb">
              ${resolvedLogo ? `<img src="${resolvedLogo}" alt="${oem.name}" />` : (oem.logoSvg || '<i class="fa-solid fa-industry" style="color:#94a3b8;"></i>')}
            </div>
            <div class="a-oem-info">
              <div class="a-oem-name-row">
                <span class="a-oem-title">${oem.name}</span>
                <span class="a-badge a-badge-blue">${oem.specialty || 'Manufacturing Principal'}</span>
                ${isHidden ? '<span class="a-badge" style="background:#64748b;color:#fff;"><i class="fa-solid fa-eye-slash"></i> Hidden</span>' : '<span class="a-badge a-badge-green"><i class="fa-solid fa-eye"></i> Visible</span>'}
              </div>
              <div class="a-oem-meta-row">
                <span><i class="fa-solid fa-newspaper"></i> <strong>${articles.length}</strong> Articles</span>
                <span>&bull;</span>
                <span><i class="fa-solid fa-video"></i> <strong>${videos.length}</strong> Videos</span>
                <span>&bull;</span>
                <span><i class="fa-solid fa-file-pdf"></i> <strong>${whitepapers.length}</strong> Whitepapers</span>
                <span>&bull;</span>
                <span><i class="fa-solid fa-link"></i> <strong>${links.length}</strong> Links</span>
              </div>
            </div>
          </div>

          <div class="a-oem-header-actions">
            <button type="button" class="a-btn a-btn-outline a-btn-sm btn-toggle-blog-oem-vis" data-oem-id="${oem.id}" title="${isHidden ? 'Show on public site' : 'Hide from public site'}">
              <i class="fa-solid ${isHidden ? 'fa-eye' : 'fa-eye-slash'}"></i> ${isHidden ? 'Show' : 'Hide'}
            </button>
            <button type="button" class="a-btn a-btn-primary a-btn-sm btn-toggle-blog-oem-expand" data-oem-id="${oem.id}">
              <i class="fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}"></i>
              <span>${isExpanded ? 'Collapse' : 'Manage'} Tech Hub (${totalUpdates} Updates)</span>
            </button>
            <button type="button" class="a-btn a-btn-outline a-btn-sm btn-edit-oem-hub" data-oem-id="${oem.id}">
              <i class="fa-solid fa-pen"></i> Edit Hub Profile
            </button>
          </div>
        </div>

        ${oemHubPanelHtml}
      </div>
    `;
  }).filter(Boolean).join('');

  return `
    <div class="a-cards-box">
      <div class="a-cards-box-header" style="align-items:flex-start;">
        <div>
          <h3>OEM Technical Blogs, Video Demos &amp; Whitepapers Catalog</h3>
          <p>Full pin-to-pin CMS management for all 15 global manufacturing partners. Edit technical articles, full dispatch text, video webinars, whitepapers, and official links.</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" class="a-btn a-btn-outline a-btn-sm" id="btn-edit-blog-hero"><i class="fa-solid fa-heading"></i> Edit Page Hero &amp; Badges</button>
          <button type="button" class="a-btn a-btn-outline a-btn-sm" id="btn-expand-all-blog-oems"><i class="fa-solid fa-angles-down"></i> Expand All</button>
          <button type="button" class="a-btn a-btn-outline a-btn-sm" id="btn-collapse-all-blog-oems"><i class="fa-solid fa-angles-up"></i> Collapse All</button>
        </div>
      </div>

      <div class="a-catalog-toolbar">
        <div class="a-catalog-stats-strip">
          <div class="a-catalog-stat-badge">
            <span>Global OEM Hubs:</span>
            <strong>${totalOems}</strong>
          </div>
          <div class="a-catalog-stat-badge">
            <span>Technical Articles:</span>
            <strong>${totalArticles}</strong>
          </div>
          <div class="a-catalog-stat-badge">
            <span>Engineering Videos:</span>
            <strong>${totalVideos}</strong>
          </div>
          <div class="a-catalog-stat-badge">
            <span>Whitepapers &amp; Notes:</span>
            <strong>${totalWhitepapers}</strong>
          </div>
        </div>

        <div style="flex:1;max-width:420px;position:relative;">
          <input type="text" id="admin-blog-search-input" class="a-input" placeholder="Search OEMs, articles, videos, whitepapers, or tags..." value="${blogSearchQuery || ''}" style="padding-left:36px;" />
          <i class="fa-solid fa-magnifying-glass" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--a-muted);font-size:0.85rem;"></i>
          ${blogSearchQuery ? '<button type="button" id="admin-blog-search-clear" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--a-muted);cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>' : ''}
        </div>
      </div>

      <div class="a-oem-accordions-list">
        ${oemCardsHtml || '<div class="a-empty-state" style="padding:40px;text-align:center;background:#fff;border-radius:12px;border:1px dashed var(--a-border);">No OEM tech hubs match your search query.</div>'}
      </div>
    </div>
  `;
}

function bindBlogsTabEvents() {
  const cmsBlogs = getCmsBlogsPayload();
  const oemBlogs = cmsBlogs.oemBlogs || [];

  const saveAndRefresh = async (toastMsg = 'Blog updates saved!') => {
    cmsBlogs.oemBlogs = oemBlogs;
    await ContentService.saveData('blogs', cmsBlogs);
    rerender();
    showToast(toastMsg, 'success');
  };

  // Search input
  const searchInput = document.getElementById('admin-blog-search-input');
  searchInput?.addEventListener('input', (e) => {
    blogSearchQuery = e.target.value;
    rerender();
    const newInp = document.getElementById('admin-blog-search-input');
    if (newInp) {
      newInp.focus();
      newInp.selectionStart = newInp.selectionEnd = newInp.value.length;
    }
  });

  document.getElementById('admin-blog-search-clear')?.addEventListener('click', () => {
    blogSearchQuery = '';
    rerender();
  });

  // Expand / Collapse All
  document.getElementById('btn-expand-all-blog-oems')?.addEventListener('click', () => {
    CATALOG.forEach(o => expandedBlogOemIds.add(o.id));
    rerender();
  });

  document.getElementById('btn-collapse-all-blog-oems')?.addEventListener('click', () => {
    expandedBlogOemIds.clear();
    rerender();
  });

  // Edit Page Hero & Badges
  document.getElementById('btn-edit-blog-hero')?.addEventListener('click', () => {
    openModal('Edit Blogs Page Hero &amp; Badges', `
      <div class="a-field span2"><label class="a-label">Main Page Title *</label><input class="a-input" name="heroTitle" value="${cmsBlogs.heroTitle || 'OEM Technical News, Video Demos & Insights'}" required /></div>
      <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Lead Subtitle</label><textarea class="a-textarea" name="heroSubtitle" rows="3">${cmsBlogs.heroSubtitle || ''}</textarea></div>
      <div class="a-field" style="margin-top:12px;"><label class="a-label">Trust Badge 1 (Whitepapers)</label><input class="a-input" name="trustBadge1" value="${cmsBlogs.trustBadge1 || 'Application Whitepapers & Notes'}" /></div>
      <div class="a-field" style="margin-top:12px;"><label class="a-label">Trust Badge 2 (Videos)</label><input class="a-input" name="trustBadge2" value="${cmsBlogs.trustBadge2 || 'Video Demos & Technical Webinars'}" /></div>
      <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Trust Badge 3 (Bulletins)</label><input class="a-input" name="trustBadge3" value="${cmsBlogs.trustBadge3 || 'Direct Manufacturer Bulletins'}" /></div>
    `, async (data) => {
      cmsBlogs.heroTitle = data.heroTitle;
      cmsBlogs.heroSubtitle = data.heroSubtitle;
      cmsBlogs.trustBadge1 = data.trustBadge1;
      cmsBlogs.trustBadge2 = data.trustBadge2;
      cmsBlogs.trustBadge3 = data.trustBadge3;
      await saveAndRefresh('Page hero and badges updated successfully!');
    });
  });

  // Toggle OEM expand
  document.querySelectorAll('.btn-toggle-blog-oem-expand').forEach(btn => {
    btn.addEventListener('click', () => {
      const oemId = btn.getAttribute('data-oem-id');
      if (expandedBlogOemIds.has(oemId)) {
        expandedBlogOemIds.delete(oemId);
      } else {
        expandedBlogOemIds.add(oemId);
      }
      rerender();
    });
  });

  // Toggle OEM visibility
  document.querySelectorAll('.btn-toggle-blog-oem-vis').forEach(btn => {
    btn.addEventListener('click', async () => {
      const oemId = btn.getAttribute('data-oem-id');
      const b = oemBlogs.find(x => x.oemId === oemId);
      if (b) {
        btn.disabled = true;
        try {
          b.visible = b.visible === false ? true : false;
          await saveAndRefresh(`Tech Hub for ${oemId} is now ${b.visible ? 'visible' : 'hidden'}.`);
        } catch (err) {
          showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed: ' + err.message, 'error');
        } finally {
          btn.disabled = false;
        }
      }
    });
  });

  // Edit OEM Hub Profile
  document.querySelectorAll('.btn-edit-oem-hub').forEach(btn => {
    btn.addEventListener('click', () => {
      const oemId = btn.getAttribute('data-oem-id');
      const oem = CATALOG.find(o => o.id === oemId);
      const b = oemBlogs.find(x => x.oemId === oemId);
      if (!oem || !b) return;

      openModal(`Edit Tech Hub Profile: ${oem.name}`, `
        <div class="a-field span2"><label class="a-label">Dedicated Tech Hub Name *</label><input class="a-input" name="portalName" value="${b.portalName || `${oem.name} Technology Hub`}" required /></div>
        <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Hub Headline / Mission</label><textarea class="a-textarea" name="headline" rows="3">${b.headline || oem.description}</textarea></div>
        <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Official Engineering Website URL</label><input class="a-input" name="officialWebsite" value="${b.officialWebsite || ''}" placeholder="https://..." /></div>
        <div class="a-field" style="margin-top:12px;">
          <label class="a-label">Visibility Status</label>
          <select class="a-input" name="visible">
            <option value="true" ${b.visible !== false ? 'selected' : ''}>Visible in Public Hub</option>
            <option value="false" ${b.visible === false ? 'selected' : ''}>Hidden (Draft)</option>
          </select>
        </div>
      `, async (data) => {
        b.portalName = data.portalName;
        b.headline = data.headline;
        b.officialWebsite = data.officialWebsite;
        b.visible = data.visible === 'true';
        await saveAndRefresh(`Updated ${oem.name} Hub Profile!`);
      });
    });
  });

  // ─── ARTICLE ACTIONS ───
  // Add Article
  document.querySelectorAll('.btn-add-oem-art').forEach(btn => {
    btn.addEventListener('click', () => {
      const oemId = btn.getAttribute('data-oem-id');
      const oem = CATALOG.find(o => o.id === oemId);
      const b = oemBlogs.find(x => x.oemId === oemId);
      if (!oem || !b) return;

      openModal(`Add Technical Article to ${oem.name}`, `
        <div class="a-field span2"><label class="a-label">Article Headline / Title *</label><input class="a-input" name="title" required placeholder="e.g. Next-Gen Millimeter-Wave Substrate Formulations" /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Article Category *</label><input class="a-input" name="category" value="Materials Innovation" required /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Publication Date</label><input class="a-input" name="date" value="${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}" /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Read Time</label><input class="a-input" name="readTime" value="5 min read" /></div>
        <div class="a-field" style="margin-top:12px;">
          <label class="a-label">Visibility Status</label>
          <select class="a-input" name="visible">
            <option value="true" selected>Visible in Public Hub</option>
            <option value="false">Hidden (Draft)</option>
          </select>
        </div>
        ${renderImageUploadField('image', 'Article Cover Image', '', 'Upload hero image for article')}
        <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Excerpt / Summary (Card Preview) *</label><textarea class="a-textarea" name="summary" rows="3" required placeholder="Short 2-3 sentence overview for the card preview..."></textarea></div>
        <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Full Technical Article Body (Rich HTML or Paragraphs)</label><textarea class="a-textarea" name="content" rows="6" placeholder="<p>Full article text, specifications, and engineering details...</p>"></textarea></div>
        <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Topic Tags (Comma-separated)</label><input class="a-input" name="tags" placeholder="e.g. 77 GHz Radar, RT/duroid, Substrate, Automotive" /></div>
      `, async (data) => {
        if (!b.articles) b.articles = [];
        const tagsArr = (data.tags || '').split(',').map(t => t.trim()).filter(Boolean);
        const newArt = {
          id: `${oemId}-art-${Date.now()}`,
          title: data.title.trim(),
          category: data.category.trim(),
          date: data.date.trim(),
          readTime: data.readTime.trim(),
          image: data.image || '',
          summary: data.summary.trim(),
          content: data.content || `<p>${data.summary}</p>`,
          tags: tagsArr,
          visible: data.visible === 'true'
        };
        b.articles.unshift(newArt);
        expandedBlogOemIds.add(oemId);
        await saveAndRefresh(`Added article "${newArt.title}"!`);
      });
    });
  });

  // Edit Article
  document.querySelectorAll('.btn-edit-oem-art').forEach(btn => {
    btn.addEventListener('click', () => {
      const oemId = btn.getAttribute('data-oem-id');
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const b = oemBlogs.find(x => x.oemId === oemId);
      const art = b?.articles?.[idx];
      if (!b || !art) return;

      openModal(`Edit Article: ${art.title}`, `
        <div class="a-field span2"><label class="a-label">Article Headline / Title *</label><input class="a-input" name="title" value="${art.title || ''}" required /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Article Category *</label><input class="a-input" name="category" value="${art.category || ''}" required /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Publication Date</label><input class="a-input" name="date" value="${art.date || ''}" /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Read Time</label><input class="a-input" name="readTime" value="${art.readTime || ''}" /></div>
        <div class="a-field" style="margin-top:12px;">
          <label class="a-label">Visibility Status</label>
          <select class="a-input" name="visible">
            <option value="true" ${art.visible !== false ? 'selected' : ''}>Visible in Public Hub</option>
            <option value="false" ${art.visible === false ? 'selected' : ''}>Hidden (Draft)</option>
          </select>
        </div>
        ${renderImageUploadField('image', 'Article Cover Image', art.image || '', 'Upload hero image for article')}
        <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Excerpt / Summary (Card Preview) *</label><textarea class="a-textarea" name="summary" rows="3" required>${art.summary || ''}</textarea></div>
        <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Full Technical Article Body (Rich HTML or Paragraphs)</label><textarea class="a-textarea" name="content" rows="8">${art.content || ''}</textarea></div>
        <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Topic Tags (Comma-separated)</label><input class="a-input" name="tags" value="${(art.tags || []).join(', ')}" /></div>
      `, async (data) => {
        art.title = data.title.trim();
        art.category = data.category.trim();
        art.date = data.date.trim();
        art.readTime = data.readTime.trim();
        art.image = data.image;
        art.summary = data.summary.trim();
        art.content = data.content;
        art.tags = (data.tags || '').split(',').map(t => t.trim()).filter(Boolean);
        art.visible = data.visible === 'true';
        expandedBlogOemIds.add(oemId);
        await saveAndRefresh(`Updated article "${art.title}"!`);
      });
    });
  });

  // Delete Article
  document.querySelectorAll('.btn-del-oem-art').forEach(btn => {
    btn.addEventListener('click', async () => {
      const oemId = btn.getAttribute('data-oem-id');
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const b = oemBlogs.find(x => x.oemId === oemId);
      const art = b?.articles?.[idx];
      if (!b || !art) return;

      if (!confirm(`Delete article "${art.title}"?`)) return;
      btn.disabled = true;
      try {
        b.articles.splice(idx, 1);
        await saveAndRefresh(`Deleted article "${art.title}".`);
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed to delete article: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });

  // Move Article
  document.querySelectorAll('.btn-move-oem-art').forEach(btn => {
    btn.addEventListener('click', async () => {
      const oemId = btn.getAttribute('data-oem-id');
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const dir = btn.getAttribute('data-dir');
      const b = oemBlogs.find(x => x.oemId === oemId);
      if (!b || !b.articles) return;

      const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
      btn.disabled = true;
      try {
        b.articles = reorderArray(b.articles, idx, targetIdx);
        await saveAndRefresh('Articles reordered!');
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed to move article: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });

  // Toggle Article Visibility
  document.querySelectorAll('.btn-toggle-art-vis').forEach(btn => {
    btn.addEventListener('click', async () => {
      const oemId = btn.getAttribute('data-oem-id');
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const b = oemBlogs.find(x => x.oemId === oemId);
      const art = b?.articles?.[idx];
      if (!art) return;
      btn.disabled = true;
      try {
        art.visible = art.visible === false ? true : false;
        await saveAndRefresh(`Article "${art.title}" is now ${art.visible ? 'visible' : 'hidden'}.`);
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });

  // ─── VIDEO ACTIONS ───
  // Add Video
  document.querySelectorAll('.btn-add-oem-vid').forEach(btn => {
    btn.addEventListener('click', () => {
      const oemId = btn.getAttribute('data-oem-id');
      const oem = CATALOG.find(o => o.id === oemId);
      const b = oemBlogs.find(x => x.oemId === oemId);
      if (!oem || !b) return;

      openModal(`Add Video Demonstration to ${oem.name}`, `
        <div class="a-field span2"><label class="a-label">Video Title *</label><input class="a-input" name="title" required placeholder="e.g. Dielectric Material Characterization at W-Band" /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Presenter / Speaker Name &amp; Title</label><input class="a-input" name="speaker" placeholder="e.g. John Coonrod, Technical Marketing Director" /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Duration (MM:SS)</label><input class="a-input" name="duration" value="15:00" /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Date</label><input class="a-input" name="date" value="${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}" /></div>
        <div class="a-field" style="margin-top:12px;">
          <label class="a-label">Visibility Status</label>
          <select class="a-input" name="visible">
            <option value="true" selected>Visible in Public Hub</option>
            <option value="false">Hidden (Draft)</option>
          </select>
        </div>
        ${renderImageUploadField('thumbnail', 'Video Thumbnail Image', '', 'Upload video cover preview')}
        <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Video Streaming / Embed URL (YouTube, Vimeo, MP4)</label><input class="a-input" name="videoUrl" placeholder="https://..." /></div>
        <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Session Summary</label><textarea class="a-textarea" name="summary" rows="3" placeholder="Overview of the technical topics demonstrated in the video..."></textarea></div>
        <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Takeaway Topics (Comma-separated)</label><input class="a-input" name="topics" placeholder="e.g. Sub-THz Metrology, Skin Depth Effects, Microstrip Resonators" /></div>
      `, async (data) => {
        if (!b.videos) b.videos = [];
        const topicsArr = (data.topics || '').split(',').map(t => t.trim()).filter(Boolean);
        const newVid = {
          id: `${oemId}-vid-${Date.now()}`,
          title: data.title.trim(),
          speaker: data.speaker.trim(),
          duration: data.duration.trim(),
          date: data.date.trim(),
          thumbnail: data.thumbnail || '',
          videoUrl: data.videoUrl || '',
          summary: data.summary.trim(),
          topics: topicsArr,
          visible: data.visible === 'true'
        };
        b.videos.unshift(newVid);
        expandedBlogOemIds.add(oemId);
        await saveAndRefresh(`Added video "${newVid.title}"!`);
      });
    });
  });

  // Edit Video
  document.querySelectorAll('.btn-edit-oem-vid').forEach(btn => {
    btn.addEventListener('click', () => {
      const oemId = btn.getAttribute('data-oem-id');
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const b = oemBlogs.find(x => x.oemId === oemId);
      const vid = b?.videos?.[idx];
      if (!b || !vid) return;

      openModal(`Edit Video: ${vid.title}`, `
        <div class="a-field span2"><label class="a-label">Video Title *</label><input class="a-input" name="title" value="${vid.title || ''}" required /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Presenter / Speaker Name &amp; Title</label><input class="a-input" name="speaker" value="${vid.speaker || ''}" /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Duration</label><input class="a-input" name="duration" value="${vid.duration || ''}" /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Date</label><input class="a-input" name="date" value="${vid.date || ''}" /></div>
        <div class="a-field" style="margin-top:12px;">
          <label class="a-label">Visibility Status</label>
          <select class="a-input" name="visible">
            <option value="true" ${vid.visible !== false ? 'selected' : ''}>Visible in Public Hub</option>
            <option value="false" ${vid.visible === false ? 'selected' : ''}>Hidden (Draft)</option>
          </select>
        </div>
        ${renderImageUploadField('thumbnail', 'Video Thumbnail Image', vid.thumbnail || '', 'Upload video cover preview')}
        <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Video Streaming / Embed URL</label><input class="a-input" name="videoUrl" value="${vid.videoUrl || ''}" /></div>
        <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Session Summary</label><textarea class="a-textarea" name="summary" rows="3">${vid.summary || ''}</textarea></div>
        <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Takeaway Topics (Comma-separated)</label><input class="a-input" name="topics" value="${(vid.topics || []).join(', ')}" /></div>
      `, async (data) => {
        vid.title = data.title.trim();
        vid.speaker = data.speaker.trim();
        vid.duration = data.duration.trim();
        vid.date = data.date.trim();
        vid.thumbnail = data.thumbnail;
        vid.videoUrl = data.videoUrl;
        vid.summary = data.summary.trim();
        vid.topics = (data.topics || '').split(',').map(t => t.trim()).filter(Boolean);
        vid.visible = data.visible === 'true';
        expandedBlogOemIds.add(oemId);
        await saveAndRefresh(`Updated video "${vid.title}"!`);
      });
    });
  });

  // Delete Video
  document.querySelectorAll('.btn-del-oem-vid').forEach(btn => {
    btn.addEventListener('click', async () => {
      const oemId = btn.getAttribute('data-oem-id');
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const b = oemBlogs.find(x => x.oemId === oemId);
      const vid = b?.videos?.[idx];
      if (!b || !vid) return;

      if (!confirm(`Delete video "${vid.title}"?`)) return;
      btn.disabled = true;
      try {
        b.videos.splice(idx, 1);
        await saveAndRefresh(`Deleted video "${vid.title}".`);
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed to delete video: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });

  // Move Video
  document.querySelectorAll('.btn-move-oem-vid').forEach(btn => {
    btn.addEventListener('click', async () => {
      const oemId = btn.getAttribute('data-oem-id');
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const dir = btn.getAttribute('data-dir');
      const b = oemBlogs.find(x => x.oemId === oemId);
      if (!b || !b.videos) return;

      const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
      btn.disabled = true;
      try {
        b.videos = reorderArray(b.videos, idx, targetIdx);
        await saveAndRefresh('Videos reordered!');
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed to move video: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });

  // Toggle Video Visibility
  document.querySelectorAll('.btn-toggle-vid-vis').forEach(btn => {
    btn.addEventListener('click', async () => {
      const oemId = btn.getAttribute('data-oem-id');
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const b = oemBlogs.find(x => x.oemId === oemId);
      const vid = b?.videos?.[idx];
      if (!vid) return;
      btn.disabled = true;
      try {
        vid.visible = vid.visible === false ? true : false;
        await saveAndRefresh(`Video "${vid.title}" is now ${vid.visible ? 'visible' : 'hidden'}.`);
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });

  // ─── WHITEPAPER ACTIONS ───
  // Add Whitepaper
  document.querySelectorAll('.btn-add-oem-wp').forEach(btn => {
    btn.addEventListener('click', () => {
      const oemId = btn.getAttribute('data-oem-id');
      const oem = CATALOG.find(o => o.id === oemId);
      const b = oemBlogs.find(x => x.oemId === oemId);
      if (!oem || !b) return;

      openModal(`Add Whitepaper to ${oem.name}`, `
        <div class="a-field span2"><label class="a-label">Whitepaper Title *</label><input class="a-input" name="title" required placeholder="e.g. Thermal Management Strategies for Multi-Layer High-Power RF Amplifiers" /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Author / Engineering Lab</label><input class="a-input" name="author" value="${oem.name} Advanced Electronics Lab" /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Publication Date</label><input class="a-input" name="date" value="${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}" /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Page Count</label><input class="a-input" name="pages" value="12 Pages" /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Frequency Band</label><input class="a-input" name="frequencyBand" value="DC to 40 GHz" /></div>
        <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Download / PDF Document URL</label><input class="a-input" name="downloadUrl" placeholder="https://..." /></div>
        <div class="a-field" style="margin-top:12px;">
          <label class="a-label">Visibility Status</label>
          <select class="a-input" name="visible">
            <option value="true" selected>Visible in Public Hub</option>
            <option value="false">Hidden (Draft)</option>
          </select>
        </div>
        <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Executive Summary</label><textarea class="a-textarea" name="summary" rows="3" placeholder="Technical summary of the study..."></textarea></div>
        <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Key Engineering Findings (One finding per line)</label><textarea class="a-textarea" name="keyFindings" rows="4" placeholder="Direct copper bonded substrates eliminate interface resistances.&#10;Thermal rating up to 170°C for airborne pods."></textarea></div>
      `, async (data) => {
        if (!b.whitepapers) b.whitepapers = [];
        const findingsArr = (data.keyFindings || '').split('\n').map(f => f.trim()).filter(Boolean);
        const newWp = {
          id: `${oemId}-wp-${Date.now()}`,
          title: data.title.trim(),
          author: data.author.trim(),
          date: data.date.trim(),
          pages: data.pages.trim(),
          frequencyBand: data.frequencyBand.trim(),
          downloadUrl: data.downloadUrl || '',
          summary: data.summary.trim(),
          keyFindings: findingsArr,
          visible: data.visible === 'true'
        };
        b.whitepapers.unshift(newWp);
        expandedBlogOemIds.add(oemId);
        await saveAndRefresh(`Added whitepaper "${newWp.title}"!`);
      });
    });
  });

  // Edit Whitepaper
  document.querySelectorAll('.btn-edit-oem-wp').forEach(btn => {
    btn.addEventListener('click', () => {
      const oemId = btn.getAttribute('data-oem-id');
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const b = oemBlogs.find(x => x.oemId === oemId);
      const wp = b?.whitepapers?.[idx];
      if (!b || !wp) return;

      openModal(`Edit Whitepaper: ${wp.title}`, `
        <div class="a-field span2"><label class="a-label">Whitepaper Title *</label><input class="a-input" name="title" value="${wp.title || ''}" required /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Author / Engineering Lab</label><input class="a-input" name="author" value="${wp.author || ''}" /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Publication Date</label><input class="a-input" name="date" value="${wp.date || ''}" /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Page Count</label><input class="a-input" name="pages" value="${wp.pages || ''}" /></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">Frequency Band</label><input class="a-input" name="frequencyBand" value="${wp.frequencyBand || ''}" /></div>
        <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Download / PDF Document URL</label><input class="a-input" name="downloadUrl" value="${wp.downloadUrl || ''}" /></div>
        <div class="a-field" style="margin-top:12px;">
          <label class="a-label">Visibility Status</label>
          <select class="a-input" name="visible">
            <option value="true" ${wp.visible !== false ? 'selected' : ''}>Visible in Public Hub</option>
            <option value="false" ${wp.visible === false ? 'selected' : ''}>Hidden (Draft)</option>
          </select>
        </div>
        <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Executive Summary</label><textarea class="a-textarea" name="summary" rows="3">${wp.summary || ''}</textarea></div>
        <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Key Engineering Findings (One finding per line)</label><textarea class="a-textarea" name="keyFindings" rows="4">${(wp.keyFindings || []).join('\n')}</textarea></div>
      `, async (data) => {
        wp.title = data.title.trim();
        wp.author = data.author.trim();
        wp.date = data.date.trim();
        wp.pages = data.pages.trim();
        wp.frequencyBand = data.frequencyBand.trim();
        wp.downloadUrl = data.downloadUrl;
        wp.summary = data.summary.trim();
        wp.keyFindings = (data.keyFindings || '').split('\n').map(f => f.trim()).filter(Boolean);
        wp.visible = data.visible === 'true';
        expandedBlogOemIds.add(oemId);
        await saveAndRefresh(`Updated whitepaper "${wp.title}"!`);
      });
    });
  });

  // Delete Whitepaper
  document.querySelectorAll('.btn-del-oem-wp').forEach(btn => {
    btn.addEventListener('click', async () => {
      const oemId = btn.getAttribute('data-oem-id');
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const b = oemBlogs.find(x => x.oemId === oemId);
      const wp = b?.whitepapers?.[idx];
      if (!b || !wp) return;

      if (!confirm(`Delete whitepaper "${wp.title}"?`)) return;
      btn.disabled = true;
      try {
        b.whitepapers.splice(idx, 1);
        await saveAndRefresh(`Deleted whitepaper "${wp.title}".`);
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed to delete whitepaper: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });

  // Move Whitepaper
  document.querySelectorAll('.btn-move-oem-wp').forEach(btn => {
    btn.addEventListener('click', async () => {
      const oemId = btn.getAttribute('data-oem-id');
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const dir = btn.getAttribute('data-dir');
      const b = oemBlogs.find(x => x.oemId === oemId);
      if (!b || !b.whitepapers) return;

      const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
      btn.disabled = true;
      try {
        b.whitepapers = reorderArray(b.whitepapers, idx, targetIdx);
        await saveAndRefresh('Whitepapers reordered!');
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed to move whitepaper: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });

  // Toggle Whitepaper Visibility
  document.querySelectorAll('.btn-toggle-wp-vis').forEach(btn => {
    btn.addEventListener('click', async () => {
      const oemId = btn.getAttribute('data-oem-id');
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const b = oemBlogs.find(x => x.oemId === oemId);
      const wp = b?.whitepapers?.[idx];
      if (!wp) return;
      btn.disabled = true;
      try {
        wp.visible = wp.visible === false ? true : false;
        await saveAndRefresh(`Whitepaper "${wp.title}" is now ${wp.visible ? 'visible' : 'hidden'}.`);
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });

  // ─── OFFICIAL LINKS ACTIONS ───
  // Add Link
  document.querySelectorAll('.btn-add-oem-link').forEach(btn => {
    btn.addEventListener('click', () => {
      const oemId = btn.getAttribute('data-oem-id');
      const oem = CATALOG.find(o => o.id === oemId);
      const b = oemBlogs.find(x => x.oemId === oemId);
      if (!oem || !b) return;

      openModal(`Add Official Tool / Link to ${oem.name}`, `
        <div class="a-field span2"><label class="a-label">Resource Title *</label><input class="a-input" name="title" required placeholder="e.g. ${oem.name} Design Hub & Calculator" /></div>
        <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Official URL *</label><input class="a-input" name="url" required placeholder="https://..." /></div>
        <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Description</label><textarea class="a-textarea" name="description" rows="2" placeholder="Interactive RF calculator and design suite..."></textarea></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">FontAwesome Icon Class</label><input class="a-input" name="icon" value="fa-globe" placeholder="fa-globe, fa-calculator, fa-book-open" /></div>
      `, async (data) => {
        if (!b.officialLinks) b.officialLinks = [];
        const newLink = {
          title: data.title.trim(),
          url: data.url.trim(),
          description: (data.description || '').trim(),
          icon: (data.icon || 'fa-globe').trim()
        };
        b.officialLinks.push(newLink);
        expandedBlogOemIds.add(oemId);
        await saveAndRefresh(`Added link "${newLink.title}"!`);
      });
    });
  });

  // Edit Link
  document.querySelectorAll('.btn-edit-oem-link').forEach(btn => {
    btn.addEventListener('click', () => {
      const oemId = btn.getAttribute('data-oem-id');
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const b = oemBlogs.find(x => x.oemId === oemId);
      const link = b?.officialLinks?.[idx];
      if (!b || !link) return;

      openModal(`Edit Official Link: ${link.title}`, `
        <div class="a-field span2"><label class="a-label">Resource Title *</label><input class="a-input" name="title" value="${link.title || ''}" required /></div>
        <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Official URL *</label><input class="a-input" name="url" value="${link.url || ''}" required /></div>
        <div class="a-field span2" style="margin-top:12px;"><label class="a-label">Description</label><textarea class="a-textarea" name="description" rows="2">${link.description || ''}</textarea></div>
        <div class="a-field" style="margin-top:12px;"><label class="a-label">FontAwesome Icon Class</label><input class="a-input" name="icon" value="${link.icon || 'fa-globe'}" /></div>
      `, async (data) => {
        link.title = data.title.trim();
        link.url = data.url.trim();
        link.description = (data.description || '').trim();
        link.icon = (data.icon || 'fa-globe').trim();
        expandedBlogOemIds.add(oemId);
        await saveAndRefresh(`Updated link "${link.title}"!`);
      });
    });
  });

  // Delete Link
  document.querySelectorAll('.btn-del-oem-link').forEach(btn => {
    btn.addEventListener('click', async () => {
      const oemId = btn.getAttribute('data-oem-id');
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const b = oemBlogs.find(x => x.oemId === oemId);
      const link = b?.officialLinks?.[idx];
      if (!b || !link) return;

      if (!confirm(`Delete official link "${link.title}"?`)) return;
      btn.disabled = true;
      try {
        b.officialLinks.splice(idx, 1);
        await saveAndRefresh(`Deleted link "${link.title}".`);
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed to delete link: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });

  // Move Link
  document.querySelectorAll('.btn-move-oem-link').forEach(btn => {
    btn.addEventListener('click', async () => {
      const oemId = btn.getAttribute('data-oem-id');
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const dir = btn.getAttribute('data-dir');
      const b = oemBlogs.find(x => x.oemId === oemId);
      if (!b || !b.officialLinks) return;

      const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
      btn.disabled = true;
      try {
        b.officialLinks = reorderArray(b.officialLinks, idx, targetIdx);
        await saveAndRefresh('Official links reordered!');
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed to move link: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });
}

// ─── HEADER & NAV EDITOR ─────────────────────────────────────────────────────
function renderHeaderPageEditor() {
  const h = ContentService.getData('header') || {};

  return `
    <form id="a-page-form">
      <div class="a-card">
        <div class="a-card-header"><div><h3>Logo &amp; Brand Image</h3><p>Main website logo displayed in top navigation</p></div></div>
        <div class="a-form-grid">
          ${renderImageUploadField('logoUrl', 'Header Brand Logo', h.logoUrl || '/icon-logo-transparent.png', 'Transparent PNG/SVG recommended')}
        </div>
      </div>

      <div class="a-card">
        <div class="a-card-header"><div><h3>Header Call-to-Action (CTA)</h3><p>Button in top-right corner &amp; mobile menu</p></div></div>
        <div class="a-form-grid">
          <div class="a-field"><label class="a-label">Button Label</label><input class="a-input" name="ctaLabel" value="${h.ctaLabel || 'Request Quote'}"></div>
          <div class="a-field"><label class="a-label">Button Destination</label><input class="a-input" name="ctaLink" value="${h.ctaLink || '/contact'}"></div>
        </div>
      </div>

      <div class="a-card">
        <div class="a-card-header"><div><h3>Navigation Menu Labels</h3><p>Customize the 7 primary navigation links</p></div></div>
        <div class="a-form-grid">
          <div class="a-field"><label class="a-label">Home Link Label</label><input class="a-input" name="navHome" value="${h.navHome || 'Home'}"></div>
          <div class="a-field"><label class="a-label">About Us Label</label><input class="a-input" name="navAbout" value="${h.navAbout || 'About Us'}"></div>
          <div class="a-field"><label class="a-label">Partners Label</label><input class="a-input" name="navPartners" value="${h.navPartners || 'Partners'}"></div>
          <div class="a-field"><label class="a-label">Products Label</label><input class="a-input" name="navProducts" value="${h.navProducts || 'Products'}"></div>
          <div class="a-field"><label class="a-label">Services Label</label><input class="a-input" name="navServices" value="${h.navServices || 'Services'}"></div>
          <div class="a-field"><label class="a-label">Blogs Label</label><input class="a-input" name="navBlogs" value="${h.navBlogs || 'Blogs'}"></div>
          <div class="a-field"><label class="a-label">Contact Label</label><input class="a-input" name="navContact" value="${h.navContact || 'Contact'}"></div>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:10px;">
        <button type="submit" class="a-btn a-btn-primary"><i class="fa-solid fa-floppy-disk"></i> Save Header &amp; Nav</button>
      </div>
    </form>
  `;
}

// ─── FOOTER & OFFICES EDITOR ─────────────────────────────────────────────────
function renderFooterPageEditor() {
  const f = ContentService.getData('footer') || {};

  return `
    <form id="a-page-form">
      <div class="a-card">
        <div class="a-card-header"><div><h3>Footer Branding &amp; Tagline</h3><p>Footer brand column</p></div></div>
        <div class="a-form-grid">
          ${renderImageUploadField('logoUrl', 'Footer Logo Image', f.logoUrl || '/icon-logo-transparent.png', 'Transparent logo')}
          <div class="a-field span2"><label class="a-label">Company Mission Tagline</label><textarea class="a-textarea" name="tagline">${f.tagline || ''}</textarea></div>
          <div class="a-field span2"><label class="a-label">Copyright Notice</label><input class="a-input" name="copyrightText" value="${f.copyrightText || ''}"></div>
        </div>
      </div>

      <div class="a-card">
        <div class="a-card-header"><div><h3>Social Media Channels</h3><p>External links for social icons</p></div></div>
        <div class="a-form-grid">
          <div class="a-field"><label class="a-label">LinkedIn Company URL</label><input class="a-input" name="linkedinUrl" value="${f.linkedinUrl || ''}"></div>
          <div class="a-field"><label class="a-label">YouTube URL</label><input class="a-input" name="youtubeUrl" value="${f.youtubeUrl || ''}"></div>
        </div>
      </div>

      <div class="a-card">
        <div class="a-card-header"><div><h3>Office Contacts (In Footer)</h3><p>Synced with contact page</p></div></div>
        <div class="a-form-grid">
          <div class="a-section-divider span2">India Office</div>
          <div class="a-field"><label class="a-label">Office Name</label><input class="a-input" name="indiaOfficeName" value="${f.indiaOfficeName || ''}"></div>
          <div class="a-field"><label class="a-label">Telephone</label><input class="a-input" name="indiaPhone" value="${f.indiaPhone || ''}"></div>
          <div class="a-field span2"><label class="a-label">Address</label><textarea class="a-textarea" name="indiaAddress">${f.indiaAddress || ''}</textarea></div>
          <div class="a-field span2"><label class="a-label">Email</label><input class="a-input" name="indiaEmail" value="${f.indiaEmail || ''}"></div>

          <div class="a-section-divider span2">Singapore Office</div>
          <div class="a-field"><label class="a-label">Office Name</label><input class="a-input" name="singaporeOfficeName" value="${f.singaporeOfficeName || ''}"></div>
          <div class="a-field"><label class="a-label">Email</label><input class="a-input" name="singaporeEmail" value="${f.singaporeEmail || ''}"></div>
          <div class="a-field span2"><label class="a-label">Address</label><textarea class="a-textarea" name="singaporeAddress">${f.singaporeAddress || ''}</textarea></div>

          <div class="a-section-divider span2">USA Office</div>
          <div class="a-field"><label class="a-label">Office Name</label><input class="a-input" name="usaOfficeName" value="${f.usaOfficeName || ''}"></div>
          <div class="a-field"><label class="a-label">Telephone</label><input class="a-input" name="usaPhone" value="${f.usaPhone || ''}"></div>
          <div class="a-field span2"><label class="a-label">Address</label><textarea class="a-textarea" name="usaAddress">${f.usaAddress || ''}</textarea></div>
          <div class="a-field span2"><label class="a-label">Email</label><input class="a-input" name="usaEmail" value="${f.usaEmail || ''}"></div>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:10px;">
        <button type="submit" class="a-btn a-btn-primary"><i class="fa-solid fa-floppy-disk"></i> Save Footer Settings</button>
      </div>
    </form>
  `;
}

// ─── SEO SETTINGS EDITOR ─────────────────────────────────────────────────────
function renderSeoPageEditor() {
  const s = ContentService.getData('seo') || {};

  return `
    <form id="a-page-form">
      <div class="a-card">
        <div class="a-card-header"><div><h3>Global SEO &amp; Meta Tags</h3><p>Search engine optimization tokens</p></div></div>
        <div class="a-form-grid">
          <div class="a-field span2"><label class="a-label">Site &lt;title&gt; Tag</label><input class="a-input" name="siteTitle" value="${s.siteTitle || ''}"></div>
          <div class="a-field span2"><label class="a-label">Meta Description</label><textarea class="a-textarea" name="metaDescription">${s.metaDescription || ''}</textarea></div>
          <div class="a-field span2"><label class="a-label">Meta Keywords (Comma separated)</label><input class="a-input" name="metaKeywords" value="${s.metaKeywords || ''}"></div>
        </div>
      </div>

      <div class="a-card">
        <div class="a-card-header"><div><h3>Open Graph &amp; Social Share</h3><p>Preview cards when links are shared on LinkedIn, Twitter, etc.</p></div></div>
        <div class="a-form-grid">
          <div class="a-field"><label class="a-label">OG Title</label><input class="a-input" name="ogTitle" value="${s.ogTitle || ''}"></div>
          <div class="a-field"><label class="a-label">OG Description</label><textarea class="a-textarea" name="ogDescription">${s.ogDescription || ''}</textarea></div>
          ${renderImageUploadField('ogImage', 'OG Social Share Image', s.ogImage || '', 'Image preview shown in social posts')}
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:10px;">
        <button type="submit" class="a-btn a-btn-primary"><i class="fa-solid fa-floppy-disk"></i> Save SEO Settings</button>
      </div>
    </form>
  `;
}

// ─── Universal Card Manager Tab Helper ───────────────────────────────────────
function renderCardsManagerTab(title, cardsArray, cardType, fieldsList) {
  return `
    <div class="a-cards-box">
      <div class="a-cards-box-header">
        <div>
          <h3>${title} (${cardsArray.length})</h3>
          <p>Add, edit, delete, and reorder cards in this collection</p>
        </div>
        <button type="button" class="a-btn a-btn-primary a-btn-sm" id="a-add-${cardType}-btn"><i class="fa-solid fa-plus"></i> Add ${title.replace(/\s*\(\d+\)/, '')}</button>
      </div>
      <div class="a-table-wrap">
        <table class="a-table">
          <thead>
            <tr>
              <th>Reorder</th>
              ${fieldsList.includes('image') ? '<th>Photo</th>' : ''}
              <th>Item / Heading</th>
              <th>Details</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${cardsArray.map((card, idx) => {
              const img = fieldsList.includes('image') ? ImageStorage.resolveImageUrl(card.image) : '';
              const titleVal = card.title || card.text || card.year || card.number || ('Item #' + (idx + 1));
              const subVal = card.desc || card.domain || card.subtitle || card.label || card.tag || card.company || '';
              return `
                <tr>
                  <td style="width:90px;">
                    <div class="a-reorder-group">
                      <button class="a-btn-reorder btn-move-${cardType}" data-dir="up" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                      <button class="a-btn-reorder btn-move-${cardType}" data-dir="down" data-idx="${idx}" ${idx === cardsArray.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
                    </div>
                  </td>
                  ${fieldsList.includes('image') ? `
                    <td>${img ? `<img src="${img}" class="a-img-preview" alt="Thumb" />` : '<span style="color:#94a3b8; font-size:0.75rem;">No image</span>'}</td>
                  ` : ''}
                  <td><strong>${titleVal}</strong></td>
                  <td style="font-size:0.82rem; color:var(--a-muted); max-width:300px;">${subVal}</td>
                  <td>
                    <button class="a-btn a-btn-outline a-btn-sm btn-edit-${cardType}" data-idx="${idx}"><i class="fa-solid fa-pen"></i> Edit</button>
                    <button class="a-btn a-btn-danger a-btn-sm btn-del-${cardType}" data-idx="${idx}" style="margin-left:6px;"><i class="fa-solid fa-trash"></i></button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function bindUniversalCardActions(pageKey, parentData, arrayPropName, cardType, renderAddForm, renderEditForm) {
  const cards = parentData[arrayPropName] || [];

  document.getElementById(`a-add-${cardType}-btn`)?.addEventListener('click', () => {
    openModal('Add New Card', renderAddForm(), async (data) => {
      cards.push({ id: `${cardType}-${Date.now()}`, ...data });
      parentData[arrayPropName] = cards;
      await ContentService.saveData(pageKey, parentData);
    });
  });

  document.querySelectorAll(`.btn-edit-${cardType}`).forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const card = cards[idx];
      openModal('Edit Card', renderEditForm(card), async (data) => {
        cards[idx] = { ...card, ...data };
        parentData[arrayPropName] = cards;
        await ContentService.saveData(pageKey, parentData);
      });
    });
  });

  document.querySelectorAll(`.btn-del-${cardType}`).forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      if (!confirm('Delete this card?')) return;
      btn.disabled = true;
      try {
        cards.splice(idx, 1);
        parentData[arrayPropName] = cards;
        await ContentService.saveData(pageKey, parentData);
        rerender();
        showToast('Card deleted.', 'info');
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed to delete card: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });

  document.querySelectorAll(`.btn-move-${cardType}`).forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const dir = btn.getAttribute('data-dir');
      const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
      btn.disabled = true;
      try {
        parentData[arrayPropName] = reorderArray(cards, idx, targetIdx);
        await ContentService.saveData(pageKey, parentData);
        rerender();
        showToast('Card order updated!', 'success');
      } catch (err) {
        showToast(err.isConflict ? 'Conflict: modified elsewhere. Please refresh.' : 'Failed to move card: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });
}

// ─── Enquiries Management Module ────────────────────────────────────────────

async function loadEnquiriesTabContent() {
  enquiriesLoading = true;
  try {
    const [statsRes, staffRes, enquiriesRes] = await Promise.all([
      ApiService.getAdminEnquiryStats().catch(() => ({ total: 0, byStatus: {}, byRegion: {} })),
      ApiService.getAdminStaff().catch(() => ({ staff: [] })),
      ApiService.getAdminEnquiries(enquiriesFilter).catch(() => ({ items: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 1 } })),
    ]);

    enquiriesStats = statsRes || { total: 0, byStatus: {}, byRegion: {} };
    enquiriesStaff = staffRes.staff || [];
    enquiriesData = enquiriesRes || { items: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 1 } };
  } catch (err) {
    showToast(`Error loading enquiries: ${err.message}`, 'error');
  } finally {
    enquiriesLoading = false;
  }
}

function renderEnquiriesTab() {
  const { items = [], pagination = { page: 1, limit: 25, total: 0, totalPages: 1 } } = enquiriesData;
  const stats = enquiriesStats || {};
  const byStatus = stats.byStatus || {};

  const totalCount = stats.total || 0;
  const newCount = byStatus.NEW || 0;
  const inProgressCount = (byStatus.ASSIGNED || 0) + (byStatus.IN_PROGRESS || 0);
  const quotedCount = byStatus.QUOTED || 0;
  const closedCount = (byStatus.CLOSED || 0) + (byStatus.ARCHIVED || 0);

  const exportUrl = ApiService.getAdminEnquiriesExportUrl(enquiriesFilter);
  const exportCommsUrl = ApiService.getAdminCommunicationsExportUrl(enquiriesFilter);

  return `
    <div class="a-tab-header">
      <div>
        <h2>Enquiries &amp; Technical RFQ Management</h2>
        <p>Real-time customer enquiries, regional office routing, workflow states, and communication audit trails.</p>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <a href="${exportUrl}" download class="a-btn a-btn-outline a-btn-sm" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
          <i class="fa-solid fa-file-csv"></i> Export Enquiries CSV
        </a>
        <a href="${exportCommsUrl}" download class="a-btn a-btn-outline a-btn-sm" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
          <i class="fa-solid fa-file-lines"></i> Export Communications CSV
        </a>
        <button type="button" class="a-btn a-btn-primary a-btn-sm" id="btn-refresh-enquiries">
          <i class="fa-solid fa-rotate"></i> Refresh
        </button>
      </div>
    </div>

    <!-- KPI Summary Row -->
    <div class="a-kpi-row">
      <div class="a-kpi-card ${!enquiriesFilter.workflowStatus ? 'active' : ''}" data-kpi-status="">
        <h4>${totalCount}</h4>
        <p>All Enquiries</p>
      </div>
      <div class="a-kpi-card ${enquiriesFilter.workflowStatus === 'NEW' ? 'active' : ''}" data-kpi-status="NEW">
        <h4 style="color:#2563eb;">${newCount}</h4>
        <p>New / Unreviewed</p>
      </div>
      <div class="a-kpi-card ${enquiriesFilter.workflowStatus === 'IN_PROGRESS' || enquiriesFilter.workflowStatus === 'ASSIGNED' ? 'active' : ''}" data-kpi-status="IN_PROGRESS">
        <h4 style="color:#d97706;">${inProgressCount}</h4>
        <p>Assigned / Active</p>
      </div>
      <div class="a-kpi-card ${enquiriesFilter.workflowStatus === 'QUOTED' ? 'active' : ''}" data-kpi-status="QUOTED">
        <h4 style="color:#16a34a;">${quotedCount}</h4>
        <p>Quoted</p>
      </div>
      <div class="a-kpi-card ${enquiriesFilter.workflowStatus === 'CLOSED' || enquiriesFilter.workflowStatus === 'ARCHIVED' ? 'active' : ''}" data-kpi-status="CLOSED">
        <h4 style="color:#64748b;">${closedCount}</h4>
        <p>Closed / Archived</p>
      </div>
    </div>

    <!-- Search & Filter Controls -->
    <div class="a-enquiries-filters">
      <div style="flex:2;min-width:220px;position:relative;">
        <input
          type="text"
          class="a-input"
          id="enq-search-input"
          placeholder="Search customer, company, email, or model..."
          value="${escapeHtml(enquiriesFilter.search || '')}"
          style="padding-left:32px;"
        />
        <i class="fa-solid fa-magnifying-glass" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#94a3b8;font-size:0.85rem;"></i>
      </div>

      <div style="flex:1;min-width:150px;">
        <select class="a-input" id="enq-region-select">
          <option value="" ${!enquiriesFilter.region ? 'selected' : ''}>All Offices / Regions</option>
          <option value="INDIA" ${enquiriesFilter.region === 'INDIA' ? 'selected' : ''}>India HQ (Bengaluru)</option>
          <option value="SINGAPORE" ${enquiriesFilter.region === 'SINGAPORE' ? 'selected' : ''}>Singapore Liaison</option>
          <option value="USA" ${enquiriesFilter.region === 'USA' ? 'selected' : ''}>USA Liaison</option>
          <option value="UNCLASSIFIED" ${enquiriesFilter.region === 'UNCLASSIFIED' ? 'selected' : ''}>Historical (Unclassified)</option>
        </select>
      </div>

      <div style="flex:1;min-width:150px;">
        <select class="a-input" id="enq-status-select">
          <option value="" ${!enquiriesFilter.workflowStatus ? 'selected' : ''}>All Statuses</option>
          <option value="NEW" ${enquiriesFilter.workflowStatus === 'NEW' ? 'selected' : ''}>NEW</option>
          <option value="ASSIGNED" ${enquiriesFilter.workflowStatus === 'ASSIGNED' ? 'selected' : ''}>ASSIGNED</option>
          <option value="IN_PROGRESS" ${enquiriesFilter.workflowStatus === 'IN_PROGRESS' ? 'selected' : ''}>IN PROGRESS</option>
          <option value="QUOTED" ${enquiriesFilter.workflowStatus === 'QUOTED' ? 'selected' : ''}>QUOTED</option>
          <option value="CONTACTED" ${enquiriesFilter.workflowStatus === 'CONTACTED' ? 'selected' : ''}>CONTACTED</option>
          <option value="CLOSED" ${enquiriesFilter.workflowStatus === 'CLOSED' ? 'selected' : ''}>CLOSED</option>
          <option value="ARCHIVED" ${enquiriesFilter.workflowStatus === 'ARCHIVED' ? 'selected' : ''}>ARCHIVED</option>
        </select>
      </div>

      <div style="flex:1;min-width:150px;">
        <select class="a-input" id="enq-staff-select">
          <option value="" ${!enquiriesFilter.assignedToId ? 'selected' : ''}>All Staff</option>
          <option value="unassigned" ${enquiriesFilter.assignedToId === 'unassigned' ? 'selected' : ''}>Unassigned</option>
          ${enquiriesStaff.map(s => `
            <option value="${s.id}" ${enquiriesFilter.assignedToId === s.id ? 'selected' : ''}>${escapeHtml(s.email)}</option>
          `).join('')}
        </select>
      </div>

      ${(enquiriesFilter.search || enquiriesFilter.region || enquiriesFilter.workflowStatus || enquiriesFilter.assignedToId) ? `
        <button type="button" class="a-btn a-btn-outline a-btn-sm" id="btn-clear-enq-filters" style="white-space:nowrap;">
          <i class="fa-solid fa-xmark"></i> Clear Filters
        </button>
      ` : ''}
    </div>

    <!-- Enquiries Data Table -->
    <div class="a-card" style="padding:0;overflow:hidden;">
      <div style="overflow-x:auto;">
        <table class="a-table" style="width:100%;border-collapse:collapse;margin:0;">
          <thead>
            <tr style="background:#f8fafc;border-bottom:1px solid var(--a-border);text-align:left;">
              <th style="padding:10px 14px;font-size:0.75rem;color:#64748b;">REFERENCE / DATE</th>
              <th style="padding:10px 14px;font-size:0.75rem;color:#64748b;">CUSTOMER &amp; COMPANY</th>
              <th style="padding:10px 14px;font-size:0.75rem;color:#64748b;">CONTACT</th>
              <th style="padding:10px 14px;font-size:0.75rem;color:#64748b;">OFFICE &amp; SUBJECT</th>
              <th style="padding:10px 14px;font-size:0.75rem;color:#64748b;">STATUS</th>
              <th style="padding:10px 14px;font-size:0.75rem;color:#64748b;">ASSIGNEE</th>
              <th style="padding:10px 14px;font-size:0.75rem;color:#64748b;text-align:right;">ACTION</th>
            </tr>
          </thead>
          <tbody>
            ${items.length === 0 ? `
              <tr>
                <td colspan="7" style="text-align:center;padding:48px 16px;color:#94a3b8;">
                  <i class="fa-solid fa-inbox" style="font-size:2rem;margin-bottom:8px;opacity:0.5;display:block;"></i>
                  ${enquiriesLoading ? 'Loading enquiries...' : 'No customer enquiries found matching the selected filters.'}
                </td>
              </tr>
            ` : items.map(item => {
              const refCode = (item.id.length > 8 ? item.id.slice(-8) : item.id).toUpperCase();
              const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
              const statusClass = (item.workflowStatus || 'NEW').toLowerCase();
              const regionClass = (item.region || 'unclassified').toLowerCase();
              const assigneeName = item.assignedTo?.email || '<span style="color:#94a3b8;font-style:italic;">Unassigned</span>';

              return `
                <tr style="border-bottom:1px solid #f1f5f9;">
                  <td style="padding:10px 14px;font-size:0.82rem;">
                    <strong style="color:#0f172a;font-family:monospace;">#IE-${escapeHtml(refCode)}</strong>
                    <div style="font-size:0.72rem;color:#94a3b8;margin-top:2px;">${dateStr}</div>
                  </td>
                  <td style="padding:10px 14px;font-size:0.84rem;">
                    <div style="font-weight:700;color:#0f172a;">${escapeHtml(item.fullname)}</div>
                    <div style="font-size:0.76rem;color:#475569;">${escapeHtml(item.company)}</div>
                  </td>
                  <td style="padding:10px 14px;font-size:0.8rem;">
                    <div><a href="mailto:${escapeHtml(item.email)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(item.email)}</a></div>
                    <div style="color:#64748b;font-size:0.74rem;">${escapeHtml(item.phone)}</div>
                  </td>
                  <td style="padding:10px 14px;">
                    <span class="a-badge-region a-badge-${regionClass}">${escapeHtml(item.region || 'Unclassified')}</span>
                    <div style="font-size:0.75rem;color:#64748b;margin-top:3px;text-transform:uppercase;">${escapeHtml(item.type || 'general')}</div>
                  </td>
                  <td style="padding:10px 14px;">
                    <span class="a-badge-status a-badge-${statusClass}">${escapeHtml(item.workflowStatus || 'NEW')}</span>
                  </td>
                  <td style="padding:10px 14px;font-size:0.8rem;color:#334155;">
                    ${assigneeName}
                  </td>
                  <td style="padding:10px 14px;text-align:right;">
                    <button type="button" class="a-btn a-btn-outline a-btn-sm btn-view-enquiry" data-id="${item.id}" style="padding:4px 10px;font-size:0.78rem;">
                      <i class="fa-solid fa-eye"></i> View &amp; Manage
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Pagination bar -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#f8fafc;border-top:1px solid var(--a-border);font-size:0.8rem;color:#64748b;flex-wrap:wrap;gap:10px;">
        <div>
          Showing <strong>${items.length ? (pagination.page - 1) * pagination.limit + 1 : 0}</strong> to <strong>${Math.min(pagination.page * pagination.limit, pagination.total)}</strong> of <strong>${pagination.total}</strong> enquiries
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <button
            type="button"
            class="a-btn a-btn-outline a-btn-sm"
            id="btn-enq-prev"
            ${pagination.page <= 1 ? 'disabled style="opacity:0.5;"' : ''}
          >
            <i class="fa-solid fa-chevron-left"></i> Previous
          </button>
          <span style="padding:0 8px;font-weight:600;">Page ${pagination.page} of ${pagination.totalPages || 1}</span>
          <button
            type="button"
            class="a-btn a-btn-outline a-btn-sm"
            id="btn-enq-next"
            ${pagination.page >= pagination.totalPages ? 'disabled style="opacity:0.5;"' : ''}
          >
            Next <i class="fa-solid fa-chevron-right"></i>
          </button>
        </div>
      </div>
    </div>
  `;
}

function bindEnquiriesTabEvents() {
  const refreshBtn = document.getElementById('btn-refresh-enquiries');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      refreshBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Refreshing...';
      await loadEnquiriesTabContent();
      rerender();
      showToast('Enquiry data refreshed.', 'info');
    });
  }

  // KPI card clicks
  document.querySelectorAll('.a-kpi-card[data-kpi-status]').forEach(card => {
    card.addEventListener('click', async () => {
      enquiriesFilter.workflowStatus = card.getAttribute('data-kpi-status');
      enquiriesFilter.page = 1;
      await loadEnquiriesTabContent();
      rerender();
    });
  });

  // Search input with debounce
  let searchTimeout = null;
  const searchInput = document.getElementById('enq-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(async () => {
        enquiriesFilter.search = e.target.value.trim();
        enquiriesFilter.page = 1;
        await loadEnquiriesTabContent();
        rerender();
      }, 350);
    });
  }

  // Region filter
  const regionSelect = document.getElementById('enq-region-select');
  if (regionSelect) {
    regionSelect.addEventListener('change', async (e) => {
      enquiriesFilter.region = e.target.value;
      enquiriesFilter.page = 1;
      await loadEnquiriesTabContent();
      rerender();
    });
  }

  // Status filter
  const statusSelect = document.getElementById('enq-status-select');
  if (statusSelect) {
    statusSelect.addEventListener('change', async (e) => {
      enquiriesFilter.workflowStatus = e.target.value;
      enquiriesFilter.page = 1;
      await loadEnquiriesTabContent();
      rerender();
    });
  }

  // Staff filter
  const staffSelect = document.getElementById('enq-staff-select');
  if (staffSelect) {
    staffSelect.addEventListener('change', async (e) => {
      enquiriesFilter.assignedToId = e.target.value;
      enquiriesFilter.page = 1;
      await loadEnquiriesTabContent();
      rerender();
    });
  }

  // Clear filters
  const clearBtn = document.getElementById('btn-clear-enq-filters');
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      enquiriesFilter = { search: '', region: '', workflowStatus: '', assignedToId: '', page: 1, limit: 25 };
      await loadEnquiriesTabContent();
      rerender();
    });
  }

  // Pagination buttons
  document.getElementById('btn-enq-prev')?.addEventListener('click', async () => {
    if (enquiriesFilter.page > 1) {
      enquiriesFilter.page--;
      await loadEnquiriesTabContent();
      rerender();
    }
  });

  document.getElementById('btn-enq-next')?.addEventListener('click', async () => {
    if (enquiriesFilter.page < (enquiriesData?.pagination?.totalPages || 1)) {
      enquiriesFilter.page++;
      await loadEnquiriesTabContent();
      rerender();
    }
  });

  // View / Manage enquiry buttons
  document.querySelectorAll('.btn-view-enquiry').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (id) openEnquiryDetailModal(id);
    });
  });
}

/**
 * Open detail and management modal with customer details, workflow status, assignment, and communication timeline.
 */
async function openEnquiryDetailModal(enquiryId) {
  const container = document.getElementById('a-modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="a-modal-backdrop" id="a-modal-backdrop">
      <div class="a-modal" style="max-width:960px;width:95%;">
        <div style="padding:40px;text-align:center;color:#64748b;">
          <i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;color:#2563eb;margin-bottom:12px;"></i>
          <p>Loading full enquiry history and communications...</p>
        </div>
      </div>
    </div>
  `;

  let enquiry = null;
  try {
    const res = await ApiService.getAdminEnquiryDetail(enquiryId);
    enquiry = res?.enquiry || null;
  } catch (err) {
    container.innerHTML = '';
    showToast(`Failed to load enquiry: ${err.message}`, 'error');
    return;
  }

  if (!enquiry) {
    container.innerHTML = '';
    showToast('Enquiry not found.', 'error');
    return;
  }

  const refCode = (enquiry.id.length > 8 ? enquiry.id.slice(-8) : enquiry.id).toUpperCase();
  const dateStr = enquiry.createdAt ? new Date(enquiry.createdAt).toLocaleString() : '';
  const comms = enquiry.communications || [];

  const modalHtml = `
    <div class="a-modal-backdrop" id="a-modal-backdrop">
      <div class="a-modal" style="max-width:1000px;width:95%;max-height:92vh;display:flex;flex-direction:column;">
        <div class="a-modal-header" style="padding:14px 20px;">
          <div>
            <h3 style="margin:0;font-size:1.15rem;display:flex;align-items:center;gap:8px;">
              <span>Enquiry Ref: #IE-${escapeHtml(refCode)}</span>
              <span class="a-badge-status a-badge-${(enquiry.workflowStatus || 'NEW').toLowerCase()}">${escapeHtml(enquiry.workflowStatus || 'NEW')}</span>
            </h3>
            <p style="margin:2px 0 0;font-size:0.75rem;color:#64748b;">Submitted ${dateStr} &bull; ${escapeHtml(enquiry.region || 'Unclassified Office')}</p>
          </div>
          <button type="button" class="a-modal-close" id="modal-close-enquiry">&times;</button>
        </div>

        <div class="a-modal-body" style="padding:18px 20px;overflow-y:auto;flex:1;">
          <div style="display:grid;grid-template-columns:1fr 1.3fr;gap:20px;">

            <!-- LEFT COLUMN: Customer Information Card -->
            <div>
              <div class="a-card" style="margin-bottom:16px;">
                <h4 style="margin:0 0 12px;font-size:0.85rem;text-transform:uppercase;color:#1e3a5f;letter-spacing:0.5px;">Customer Profile</h4>
                <table style="width:100%;font-size:0.82rem;border-collapse:collapse;">
                  <tr><td style="padding:5px 0;color:#64748b;width:34%;">Name:</td><td style="padding:5px 0;font-weight:700;color:#0f172a;">${escapeHtml(enquiry.fullname)}</td></tr>
                  <tr><td style="padding:5px 0;color:#64748b;">Company:</td><td style="padding:5px 0;color:#0f172a;">${escapeHtml(enquiry.company)}</td></tr>
                  <tr><td style="padding:5px 0;color:#64748b;">Email:</td><td style="padding:5px 0;"><a href="mailto:${escapeHtml(enquiry.email)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(enquiry.email)}</a></td></tr>
                  <tr><td style="padding:5px 0;color:#64748b;">Phone:</td><td style="padding:5px 0;"><a href="tel:${escapeHtml(enquiry.phone)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(enquiry.phone)}</a></td></tr>
                  <tr><td style="padding:5px 0;color:#64748b;">Target Office:</td><td style="padding:5px 0;"><span class="a-badge-region a-badge-${(enquiry.region || 'unclassified').toLowerCase()}">${escapeHtml(enquiry.region || 'Unclassified')}</span></td></tr>
                  <tr><td style="padding:5px 0;color:#64748b;">Subject:</td><td style="padding:5px 0;text-transform:uppercase;font-weight:600;">${escapeHtml(enquiry.type)}</td></tr>
                  ${enquiry.model ? `<tr><td style="padding:5px 0;color:#64748b;">Model / Band:</td><td style="padding:5px 0;color:#0f172a;">${escapeHtml(enquiry.model)}</td></tr>` : ''}
                  <tr><td style="padding:5px 0;color:#64748b;">Submitter IP:</td><td style="padding:5px 0;font-family:monospace;font-size:0.75rem;color:#64748b;">${escapeHtml(enquiry.ip || 'Not recorded')}</td></tr>
                </table>
              </div>

              <div class="a-card">
                <h4 style="margin:0 0 8px;font-size:0.85rem;text-transform:uppercase;color:#1e3a5f;letter-spacing:0.5px;">Customer Requirement</h4>
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;font-size:0.84rem;color:#334155;line-height:1.6;white-space:pre-wrap;max-height:260px;overflow-y:auto;">${escapeHtml(enquiry.message)}</div>
              </div>
            </div>

            <!-- RIGHT COLUMN: Workflow Management & Communication Timeline -->
            <div>
              <!-- Quick Status & Assignee Controls -->
              <div class="a-card" style="margin-bottom:16px;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:10px;">
                  <div>
                    <label style="display:block;font-size:0.75rem;font-weight:700;color:#475569;margin-bottom:4px;">WORKFLOW STATUS</label>
                    <select class="a-input a-input-sm" id="modal-status-select">
                      <option value="NEW" ${enquiry.workflowStatus === 'NEW' ? 'selected' : ''}>NEW</option>
                      <option value="ASSIGNED" ${enquiry.workflowStatus === 'ASSIGNED' ? 'selected' : ''}>ASSIGNED</option>
                      <option value="IN_PROGRESS" ${enquiry.workflowStatus === 'IN_PROGRESS' ? 'selected' : ''}>IN PROGRESS</option>
                      <option value="QUOTED" ${enquiry.workflowStatus === 'QUOTED' ? 'selected' : ''}>QUOTED</option>
                      <option value="CONTACTED" ${enquiry.workflowStatus === 'CONTACTED' ? 'selected' : ''}>CONTACTED</option>
                      <option value="CLOSED" ${enquiry.workflowStatus === 'CLOSED' ? 'selected' : ''}>CLOSED</option>
                      <option value="ARCHIVED" ${enquiry.workflowStatus === 'ARCHIVED' ? 'selected' : ''}>ARCHIVED</option>
                    </select>
                  </div>
                  <div>
                    <label style="display:block;font-size:0.75rem;font-weight:700;color:#475569;margin-bottom:4px;">ASSIGN TO STAFF</label>
                    <select class="a-input a-input-sm" id="modal-assign-select">
                      <option value="" ${!enquiry.assignedToId ? 'selected' : ''}>Unassigned</option>
                      ${enquiriesStaff.map(s => `
                        <option value="${s.id}" ${enquiry.assignedToId === s.id ? 'selected' : ''}>${escapeHtml(s.email)}</option>
                      `).join('')}
                    </select>
                  </div>
                </div>
                <div style="display:flex;justify-content:flex-end;">
                  <button type="button" class="a-btn a-btn-primary a-btn-sm" id="btn-save-workflow-changes">
                    <i class="fa-solid fa-check"></i> Apply Status &amp; Assignment
                  </button>
                </div>
              </div>

              <!-- Communication Logger Form -->
              <div class="a-card" style="margin-bottom:16px;">
                <h4 style="margin:0 0 8px;font-size:0.85rem;text-transform:uppercase;color:#1e3a5f;letter-spacing:0.5px;">Log Communication / Note</h4>
                <div style="display:flex;gap:8px;margin-bottom:10px;">
                  <button type="button" class="a-btn a-btn-sm a-btn-primary btn-comm-type active" data-type="INTERNAL_NOTE">
                    <i class="fa-solid fa-note-sticky"></i> Internal Note
                  </button>
                  <button type="button" class="a-btn a-btn-sm a-btn-outline btn-comm-type" data-type="CUSTOMER_REPLY">
                    <i class="fa-solid fa-reply"></i> Customer Reply
                  </button>
                  <button type="button" class="a-btn a-btn-sm a-btn-outline btn-comm-type" data-type="PHONE_LOG">
                    <i class="fa-solid fa-phone"></i> Phone Call
                  </button>
                </div>
                <div style="margin-bottom:8px;">
                  <input type="text" class="a-input a-input-sm" id="comm-subject" placeholder="Subject or summary..." style="margin-bottom:6px;" />
                  <textarea class="a-input a-input-sm" id="comm-body" rows="3" placeholder="Enter communication details or call notes..." required></textarea>
                </div>
                <div style="display:flex;justify-content:flex-end;">
                  <button type="button" class="a-btn a-btn-primary a-btn-sm" id="btn-submit-comm">
                    <i class="fa-solid fa-plus"></i> Save to Timeline
                  </button>
                </div>
              </div>

              <!-- Chronological Timeline -->
              <div>
                <h4 style="margin:0 0 10px;font-size:0.85rem;text-transform:uppercase;color:#1e3a5f;letter-spacing:0.5px;">
                  Communication &amp; Audit Timeline (${comms.length + 1})
                </h4>
                <div class="a-timeline">

                  <!-- Event 1: Initial Submission -->
                  <div class="a-timeline-item">
                    <div class="a-timeline-dot email"></div>
                    <div class="a-timeline-card">
                      <div class="a-timeline-head">
                        <span><i class="fa-solid fa-paper-plane" style="color:#2563eb;"></i> Enquiry Submitted via Website</span>
                        <span style="font-size:0.72rem;color:#94a3b8;">${dateStr}</span>
                      </div>
                      <div class="a-timeline-body">
                        Customer submitted RFQ / technical requirement. Regional routing directed notification to ${escapeHtml(enquiry.region || 'central')} team.
                      </div>
                      <div class="a-timeline-meta">Delivery status: ${escapeHtml(enquiry.status || 'RECEIVED')}</div>
                    </div>
                  </div>

                  <!-- Subsequent Events -->
                  ${comms.map(c => {
                    const cDate = c.createdAt ? new Date(c.createdAt).toLocaleString() : '';
                    let dotClass = 'note';
                    let icon = 'fa-solid fa-note-sticky';
                    let label = 'Internal Note';

                    if (c.type === 'STATUS_CHANGE') {
                      dotClass = 'status';
                      icon = 'fa-solid fa-arrows-rotate';
                      label = 'Workflow Status Updated';
                    } else if (c.type === 'PHONE_LOG') {
                      dotClass = 'phone';
                      icon = 'fa-solid fa-phone';
                      label = 'Phone Call Log';
                    } else if (c.type === 'CUSTOMER_REPLY') {
                      dotClass = 'reply';
                      icon = 'fa-solid fa-reply';
                      label = 'Customer Reply Recorded';
                    } else if (c.type === 'EMAIL_OUTBOUND') {
                      dotClass = 'email';
                      icon = 'fa-solid fa-envelope';
                      label = 'Automated Email Dispatched';
                    }

                    const authorStr = c.author?.email ? `by ${c.author.email}` : (c.type === 'EMAIL_OUTBOUND' ? 'Automated System' : '');
                    const meta = c.metadata && typeof c.metadata === 'object' ? c.metadata : null;
                    const deliveryStatus = meta?.deliveryStatus;
                    const deliveryBadge = deliveryStatus ? `
                      <span class="a-badge-status ${deliveryStatus === 'SENT' ? 'a-badge-sent' : 'a-badge-failed'}" style="font-size:0.65rem;padding:1px 6px;margin-left:6px;">
                        ${escapeHtml(deliveryStatus)}
                      </span>
                    ` : '';
                    const recipientInfo = meta?.recipient ? `<span class="a-timeline-channel">To: ${escapeHtml(meta.recipient)}</span>` : '';
                    const errorBox = meta?.error ? `
                      <div class="a-timeline-error">
                        <i class="fa-solid fa-triangle-exclamation"></i> <strong>Delivery Error:</strong> ${escapeHtml(meta.error)}
                      </div>
                    ` : '';

                    return `
                      <div class="a-timeline-item">
                        <div class="a-timeline-dot ${dotClass}"></div>
                        <div class="a-timeline-card">
                          <div class="a-timeline-head">
                            <span style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;">
                              <i class="${icon}"></i> ${escapeHtml(c.subject || label)}
                              ${deliveryBadge}
                              ${recipientInfo}
                            </span>
                            <span style="font-size:0.72rem;color:#94a3b8;">${cDate}</span>
                          </div>
                          <div class="a-timeline-body">${escapeHtml(c.body)}</div>
                          ${errorBox}
                          ${authorStr ? `<div class="a-timeline-meta">${escapeHtml(authorStr)}</div>` : ''}
                        </div>
                      </div>
                    `;
                  }).join('')}

                </div>
              </div>

            </div>
          </div>
        </div>

        <div class="a-modal-footer" style="padding:12px 20px;border-top:1px solid var(--a-border);">
          <button type="button" class="a-btn a-btn-outline a-btn-sm" id="modal-close-enquiry-footer">Close</button>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = modalHtml;

  const closeModal = () => { container.innerHTML = ''; };
  document.getElementById('modal-close-enquiry')?.addEventListener('click', closeModal);
  document.getElementById('modal-close-enquiry-footer')?.addEventListener('click', closeModal);
  document.getElementById('a-modal-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'a-modal-backdrop') closeModal();
  });

  // Communication type button selector
  let activeCommType = 'INTERNAL_NOTE';
  document.querySelectorAll('.btn-comm-type').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-comm-type').forEach(b => {
        b.classList.remove('active', 'a-btn-primary');
        b.classList.add('a-btn-outline');
      });
      btn.classList.add('active', 'a-btn-primary');
      btn.classList.remove('a-btn-outline');
      activeCommType = btn.getAttribute('data-type');
    });
  });

  // Submit new communication log
  document.getElementById('btn-submit-comm')?.addEventListener('click', async () => {
    const bodyInput = document.getElementById('comm-body');
    const subjectInput = document.getElementById('comm-subject');
    const body = bodyInput ? bodyInput.value.trim() : '';
    const subject = subjectInput ? subjectInput.value.trim() : '';

    if (!body) {
      alert('Please enter communication details or call notes.');
      if (bodyInput) bodyInput.focus();
      return;
    }

    const btn = document.getElementById('btn-submit-comm');
    if (btn) btn.disabled = true;

    try {
      await ApiService.logEnquiryCommunication(enquiry.id, {
        type: activeCommType,
        subject,
        body,
      });
      showToast('Communication logged successfully!', 'success');
      // Reload and re-open modal to refresh timeline
      await loadEnquiriesTabContent();
      openEnquiryDetailModal(enquiry.id);
    } catch (err) {
      showToast(`Failed to log communication: ${err.message}`, 'error');
      if (btn) btn.disabled = false;
    }
  });

  // Submit Status & Assignment update
  document.getElementById('btn-save-workflow-changes')?.addEventListener('click', async () => {
    const statusSelect = document.getElementById('modal-status-select');
    const assignSelect = document.getElementById('modal-assign-select');
    const newStatus = statusSelect ? statusSelect.value : null;
    const newAssigneeId = assignSelect ? (assignSelect.value || null) : null;

    const btn = document.getElementById('btn-save-workflow-changes');
    if (btn) btn.disabled = true;

    try {
      let changed = false;
      let currentExpectedUpdatedAt = enquiry.updatedAt;

      // Update status if changed, passing currentExpectedUpdatedAt for optimistic concurrency
      if (newStatus && newStatus !== enquiry.workflowStatus) {
        const statusRes = await ApiService.updateEnquiryStatus(
          enquiry.id,
          newStatus,
          null,
          currentExpectedUpdatedAt
        );
        if (statusRes?.enquiry?.updatedAt) {
          currentExpectedUpdatedAt = statusRes.enquiry.updatedAt;
          enquiry.updatedAt = statusRes.enquiry.updatedAt;
        }
        changed = true;
      }

      // Update assignee if changed, passing the refreshed expectedUpdatedAt
      if (newAssigneeId !== enquiry.assignedToId) {
        const assignRes = await ApiService.assignEnquiry(
          enquiry.id,
          newAssigneeId,
          null,
          currentExpectedUpdatedAt
        );
        if (assignRes?.enquiry?.updatedAt) {
          enquiry.updatedAt = assignRes.enquiry.updatedAt;
        }
        changed = true;
      }

      if (changed) {
        showToast('Workflow updates saved successfully!', 'success');
        await loadEnquiriesTabContent();
        openEnquiryDetailModal(enquiry.id);
      } else {
        showToast('No changes detected.', 'info');
        if (btn) btn.disabled = false;
      }
    } catch (err) {
      if (
        err.status === 409 ||
        err.message?.includes('modified by another user') ||
        err.message?.includes('CONCURRENT_MODIFICATION')
      ) {
        showToast('Conflict: This enquiry was modified by another user. Reloading latest details...', 'error');
        await loadEnquiriesTabContent();
        openEnquiryDetailModal(enquiry.id);
      } else {
        showToast(`Update failed: ${err.message}`, 'error');
        if (btn) btn.disabled = false;
      }
    }
  });
}
