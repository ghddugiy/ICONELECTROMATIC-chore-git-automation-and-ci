/**
 * SPA Router for ICON ELECTROMATIC
 * Supports hash routing (#/about), HTML5 history fallback, and mobile touch events
 */

const routes = {};
let currentPath = '';

export function registerRoute(path, handler) {
  let cleanPath = path;
  if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;
  if (cleanPath.length > 1 && cleanPath.endsWith('/')) cleanPath = cleanPath.slice(0, -1);
  routes[cleanPath] = handler;
}

export function getRouteSearchParams(
  location = typeof window !== 'undefined'
    ? window.location
    : { search: '', hash: '' }
) {
  if (location.search) {
    return new URLSearchParams(location.search);
  }

  const hash = location.hash || '';
  const queryIndex = hash.indexOf('?');
  return new URLSearchParams(queryIndex === -1 ? '' : hash.slice(queryIndex + 1));
}

export function navigate(path) {
  let clean = path || '/';
  if (!clean.startsWith('/')) clean = '/' + clean;
  if (clean.length > 1 && clean.endsWith('/')) clean = clean.slice(0, -1);

  if (typeof window !== 'undefined') {
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== clean || window.location.hash) {
      window.history.pushState(null, '', clean);
    }
  }
  handleRoute();
}

export function handleRoute() {
  // 1. Backwards compatibility for legacy hash URLs:
  // If #/product/:id is accessed, rewrite cleanly to /product/:id via replaceState
  if (typeof window !== 'undefined' && window.location.hash) {
    const hash = window.location.hash;
    if (hash.startsWith('#/product/') || hash.startsWith('#product/')) {
      const prodId = hash.replace(/^#\/?product\//, '');
      window.history.replaceState(null, '', `/product/${prodId}`);
    } else if (hash.startsWith('#/') && hash !== '#/' && hash !== '#/admin') {
      const cleanPath = hash.replace(/^#\/?/, '/');
      window.history.replaceState(null, '', cleanPath);
    }
  }

  // Extract route: pathname first, then hash fallback
  let raw = '';
  if (typeof window !== 'undefined') {
    if (window.location.pathname && window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
      raw = window.location.pathname;
    } else if (window.location.hash) {
      raw = window.location.hash.replace(/^#\/?/, '/');
    } else {
      raw = '/';
    }
  } else {
    raw = '/';
  }

  let routePath = raw;
  let queryStr = typeof window !== 'undefined' && window.location.search ? window.location.search.slice(1) : '';
  if (raw.includes('?')) {
    const [p, q] = raw.split('?');
    routePath = p;
    queryStr = q;
  }
  const queryParams = new URLSearchParams(queryStr);

  // Normalize: ensure leading slash, strip trailing slash
  let route = routePath.startsWith('/') ? routePath : '/' + routePath;
  if (route.length > 1 && route.endsWith('/')) {
    route = route.slice(0, -1);
  }

  // Extract base route and params
  const parts = route.split('/').filter(Boolean);
  let matchedHandler = null;
  let params = { _query: queryParams };

  // 1. Exact match
  if (routes[route]) {
    matchedHandler = routes[route];
  }
  // 2. Pattern match (e.g. /product/:id)
  else {
    for (const [pattern, handler] of Object.entries(routes)) {
      const patternParts = pattern.split('/').filter(Boolean);
      if (patternParts.length !== parts.length) continue;

      let match = true;
      const extractedParams = { _query: queryParams };
      for (let i = 0; i < patternParts.length; i++) {
        if (patternParts[i].startsWith(':')) {
          extractedParams[patternParts[i].slice(1)] = parts[i];
        } else if (patternParts[i] !== parts[i]) {
          match = false;
          break;
        }
      }

      if (match) {
        matchedHandler = handler;
        params = extractedParams;
        break;
      }
    }
  }

  if (matchedHandler) {
    currentPath = route;
    try {
      matchedHandler(params);
    } catch (err) {
      console.error('Error rendering route:', route, err);
      const app = document.getElementById('app');
      if (app) {
        app.innerHTML = `
          <div style="min-height: 80vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 40px; color: #fff;">
            <h1 style="font-size: 2rem; margin-bottom: 16px; color: #dd2b1c;">Unable to display page</h1>
            <p style="color: #94a3b8; max-width: 500px; margin-bottom: 24px;">An error occurred while loading this section.</p>
            <a href="/" data-route="/" class="btn-relay-red">Return Home</a>
          </div>
        `;
      }
    }
  } else if (routes['/']) {
    currentPath = '/';
    try {
      routes['/'](params);
    } catch (err) {
      console.error('Error rendering root fallback route:', err);
    }
  }

  // Scroll to top cleanly
  window.scrollTo({ top: 0, behavior: 'instant' });
}

export function getCurrentPath() {
  let raw = '';
  if (typeof window !== 'undefined') {
    if (window.location.pathname && window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
      raw = window.location.pathname;
    } else if (window.location.hash) {
      raw = window.location.hash.replace(/^#\/?/, '/');
    } else {
      raw = '/';
    }
  } else {
    raw = '/';
  }
  const [route] = raw.split('?');
  let clean = route.startsWith('/') ? route : '/' + route;
  if (clean.length > 1 && clean.endsWith('/')) clean = clean.slice(0, -1);
  return clean || currentPath || '/';
}

export function initRouter() {
  window.addEventListener('popstate', handleRoute);
  window.addEventListener('hashchange', handleRoute);

  // Global click navigation delegation
  const handleNavClick = (e) => {
    // Only primary left clicks without modifiers
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const link = e.target.closest('[data-route], a[href^="/"], a[href^="#/"]');
    if (!link) return;

    // Do not intercept external links, downloads, API or asset paths
    if (link.target === '_blank' || link.hasAttribute('download')) return;
    const rawHref = link.getAttribute('href');
    if (rawHref && (
      rawHref.startsWith('/api/') ||
      rawHref.startsWith('/images/') ||
      rawHref.startsWith('/assets/') ||
      rawHref.startsWith('http://') ||
      rawHref.startsWith('https://') ||
      rawHref.startsWith('mailto:') ||
      rawHref.startsWith('tel:')
    )) {
      return;
    }

    let targetRoute = link.getAttribute('data-route');
    if (!targetRoute && rawHref) {
      if (rawHref.startsWith('#/')) {
        targetRoute = rawHref.slice(1);
      } else if (rawHref.startsWith('/')) {
        targetRoute = rawHref;
      }
    }

    if (targetRoute) {
      e.preventDefault();
      navigate(targetRoute);
    }
  };

  document.addEventListener('click', handleNavClick, { passive: false });

  // Handle any legacy hash present on initial page load
  if (typeof window !== 'undefined' && window.location.hash) {
    const hash = window.location.hash;
    if (hash.startsWith('#/product/') || hash.startsWith('#product/')) {
      const prodId = hash.replace(/^#\/?product\//, '');
      window.history.replaceState(null, '', `/product/${prodId}`);
    } else if (hash.startsWith('#/') && hash !== '#/' && hash !== '#/admin') {
      const cleanPath = hash.replace(/^#\/?/, '/');
      window.history.replaceState(null, '', cleanPath);
    }
  }

  // Always invoke handleRoute on startup to render the matched view immediately!
  handleRoute();
}
