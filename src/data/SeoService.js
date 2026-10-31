/**
 * Centralized SEO & Structured Data Service — ICON ELECTROMATIC
 * Dynamically updates document titles, meta descriptions, canonical URLs,
 * Open Graph, Twitter Cards, and Schema.org JSON-LD structured data.
 */

import { ContentService } from './ContentService.js';

const SITE_NAME = 'ICON ELECTROMATIC';
const DEFAULT_ORIGIN = 'https://iconelectromatic.com';

export function getSiteOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return DEFAULT_ORIGIN;
}

export function sanitizeMetaContent(content) {
  if (content === null || content === undefined) return '';
  return String(content)
    .replace(/<[^>]*>/g, '') // strip HTML tags
    .replace(/[\r\n\t]+/g, ' ') // normalize whitespace
    .trim();
}

function getOrCreateMetaTag(attributeName, attributeValue) {
  if (typeof document === 'undefined') return null;
  let element = document.head.querySelector(`meta[${attributeName}="${attributeValue}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attributeName, attributeValue);
    document.head.appendChild(element);
  }
  return element;
}

function getOrCreateLinkTag(rel) {
  if (typeof document === 'undefined') return null;
  let element = document.head.querySelector(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }
  return element;
}

export function generateProductStructuredData(product, origin = getSiteOrigin()) {
  if (!product) return null;

  const model = sanitizeMetaContent(product.model || product.name || 'Component');
  const oem = sanitizeMetaContent(product.oem || product.oemName || 'Authorized Principal');
  const description = sanitizeMetaContent(
    product.description ||
    `${model} supplied by ${oem}. High-frequency RF and microwave component distributed by ${SITE_NAME}.`
  );

  let imageUrl = product.image || '/images/rf-filter.jpg';
  if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
    imageUrl = `${origin.replace(/\/+$/, '')}/${imageUrl.replace(/^\/+/, '')}`;
  }

  const productUrl = `${origin.replace(/\/+$/, '')}/product/${encodeURIComponent(product.id || '')}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: model,
    image: imageUrl,
    description: description,
    sku: String(product.id || model),
    mpn: model,
    brand: {
      '@type': 'Brand',
      name: oem,
    },
    category: sanitizeMetaContent(product.categoryName || product.category || 'RF & Microwave Components'),
    offers: {
      '@type': 'Offer',
      url: productUrl,
      description: 'Authorized OEM distribution — request quote for formal pricing and lead time.',
    },
  };
}

export function generateBreadcrumbStructuredData(items, origin = getSiteOrigin()) {
  if (!Array.isArray(items) || items.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => {
      let itemUrl = item.url || '';
      if (itemUrl && !itemUrl.startsWith('http')) {
        itemUrl = `${origin.replace(/\/+$/, '')}/${itemUrl.replace(/^\/+/, '')}`;
      }
      return {
        '@type': 'ListItem',
        position: index + 1,
        name: sanitizeMetaContent(item.name),
        item: itemUrl,
      };
    }),
  };
}

export function updateSeo({
  title = '',
  description = '',
  canonicalUrl = '',
  ogImage = '',
  ogType = 'website',
  noindex = false,
  structuredData = null,
} = {}) {
  const origin = getSiteOrigin();

  // Document Title
  const cleanTitle = sanitizeMetaContent(title);
  const endsWithSiteName = new RegExp(`[|\\-–—]?\\s*${SITE_NAME}\\s*$`, 'i').test(cleanTitle);
  const fullTitle = cleanTitle
    ? (endsWithSiteName ? cleanTitle : `${cleanTitle} | ${SITE_NAME}`)
    : `${SITE_NAME} — RF, Microwave & Electronic Components`;

  if (typeof document !== 'undefined') {
    document.title = fullTitle;

    // Meta Description
    const cleanDesc = sanitizeMetaContent(description);
    const metaDesc = getOrCreateMetaTag('name', 'description');
    if (metaDesc) metaDesc.setAttribute('content', cleanDesc);

    // Robots Directive
    const metaRobots = getOrCreateMetaTag('name', 'robots');
    if (metaRobots) metaRobots.setAttribute('content', noindex ? 'noindex, nofollow' : 'index, follow');

    // Canonical Link
    const cleanCanonical = canonicalUrl || origin;
    const linkCanonical = getOrCreateLinkTag('canonical');
    if (linkCanonical) linkCanonical.setAttribute('href', cleanCanonical);

    // Open Graph Tags
    const ogTitle = getOrCreateMetaTag('property', 'og:title');
    if (ogTitle) ogTitle.setAttribute('content', fullTitle);

    const ogDesc = getOrCreateMetaTag('property', 'og:description');
    if (ogDesc) ogDesc.setAttribute('content', cleanDesc);

    const ogUrl = getOrCreateMetaTag('property', 'og:url');
    if (ogUrl) ogUrl.setAttribute('content', cleanCanonical);

    const ogTypeTag = getOrCreateMetaTag('property', 'og:type');
    if (ogTypeTag) ogTypeTag.setAttribute('content', ogType);

    let cleanImage = ogImage || '/icon-logo-transparent.png';
    if (!cleanImage.startsWith('http')) {
      cleanImage = `${origin.replace(/\/+$/, '')}/${cleanImage.replace(/^\/+/, '')}`;
    }
    const ogImgTag = getOrCreateMetaTag('property', 'og:image');
    if (ogImgTag) ogImgTag.setAttribute('content', cleanImage);

    // Twitter Card Tags
    const twCard = getOrCreateMetaTag('name', 'twitter:card');
    if (twCard) twCard.setAttribute('content', 'summary_large_image');

    const twTitle = getOrCreateMetaTag('name', 'twitter:title');
    if (twTitle) twTitle.setAttribute('content', fullTitle);

    const twDesc = getOrCreateMetaTag('name', 'twitter:description');
    if (twDesc) twDesc.setAttribute('content', cleanDesc);

    const twImage = getOrCreateMetaTag('name', 'twitter:image');
    if (twImage) twImage.setAttribute('content', cleanImage);

    // Structured Data (JSON-LD)
    let jsonLdScript = document.head.querySelector('#structured-data-jsonld');
    if (structuredData) {
      if (!jsonLdScript) {
        jsonLdScript = document.createElement('script');
        jsonLdScript.id = 'structured-data-jsonld';
        jsonLdScript.type = 'application/ld+json';
        document.head.appendChild(jsonLdScript);
      }
      jsonLdScript.textContent = JSON.stringify(structuredData);
    } else if (jsonLdScript) {
      jsonLdScript.remove();
    }
  }

  return {
    title: fullTitle,
    description: sanitizeMetaContent(description),
    canonicalUrl: canonicalUrl || origin,
    ogImage: ogImage || `${origin}/icon-logo-transparent.png`,
    noindex,
    structuredData,
  };
}

export function setProductSeo(product) {
  if (!product) {
    return updateSeo({
      title: 'Component Not Found',
      description: 'The requested RF or microwave component was not found in the Icon Electromatic catalog.',
      noindex: true,
    });
  }

  const origin = getSiteOrigin();
  const model = sanitizeMetaContent(product.model || product.name || 'Component');
  const oem = sanitizeMetaContent(product.oem || product.oemName || 'Authorized Principal');
  const category = sanitizeMetaContent(product.categoryName || product.category || 'Component');

  // Title: check optional product-level custom SEO title, or default to "[Model] — [OEM] [Category]"
  const customTitle = sanitizeMetaContent(product.seoTitle || product.sourceData?.seo?.title || '');
  const title = customTitle || `${model} — ${oem} ${category}`;

  // Description: check optional custom SEO description, or build from real description + applications
  const customDesc = sanitizeMetaContent(product.seoDescription || product.sourceData?.seo?.description || '');
  let description = customDesc;
  if (!description) {
    let rawDesc = product.description || '';
    if (product.applications) {
      rawDesc += ` Applications: ${product.applications}`;
    }
    const cleanDesc = sanitizeMetaContent(rawDesc) || `${model} by ${oem}. Technical datasheets and pricing available from ${SITE_NAME}.`;
    description = cleanDesc.length > 155 ? `${cleanDesc.slice(0, 152)}...` : cleanDesc;
  }

  const canonicalUrl = `${origin.replace(/\/+$/, '')}/product/${encodeURIComponent(product.id)}`;
  const structuredData = generateProductStructuredData(product, origin);

  let ogImage = product.image || '/icon-logo-transparent.png';
  if (!ogImage.startsWith('http://') && !ogImage.startsWith('https://')) {
    ogImage = `${origin.replace(/\/+$/, '')}/${ogImage.replace(/^\/+/, '')}`;
  }

  return updateSeo({
    title,
    description,
    canonicalUrl,
    ogImage,
    ogType: 'product',
    noindex: product.visible === false,
    structuredData,
  });
}

export function setDefaultSeo(routePath = '/') {
  const origin = getSiteOrigin();
  const cmsSeo = ContentService?.getData?.('seo') || {};

  const cleanRoute = (routePath || '/').split('?')[0].replace(/\/+$/, '') || '/';

  const routeMetadata = {
    '/': {
      title: cmsSeo.siteTitle || 'RF, Microwave & Electronic Components',
      description: cmsSeo.metaDescription || 'Icon Electromatic is an authorized distributor of RF, Microwave, and electromechanical components for defense, aerospace, SATCOM, and telecommunications.',
      canonicalUrl: `${origin}/`,
    },
    '/products': {
      title: 'Product Portfolio & Component Catalog',
      description: 'Browse authorized OEM RF and microwave components across leading manufacturers: Rogers Corporation, Mini-Circuits, Qorvo, TecDia, and more.',
      canonicalUrl: `${origin}/products`,
    },
    '/about': {
      title: 'About Us — 28+ Years of RF Excellence',
      description: 'Discover Icon Electromatic’s history, core milestones, and certified distribution of microwave, millimetre-wave, and RF electronic hardware.',
      canonicalUrl: `${origin}/about`,
    },
    '/services': {
      title: 'Engineering Services & Technical Solutions',
      description: 'Full lifecycle support including technical consulting, RF testing, defense/aerospace component qualification, and supply-chain logistics.',
      canonicalUrl: `${origin}/services`,
    },
    '/partners': {
      title: 'Authorized OEM Principals & Technology Partners',
      description: 'Explore Icon Electromatic’s global manufacturing partners including Rogers Corporation, Mini-Circuits, Qorvo, Evans, Ohmega Ticer, and more.',
      canonicalUrl: `${origin}/partners`,
    },
    '/blogs': {
      title: 'Technical News, Video Demos & Whitepapers',
      description: 'Read official application notes, technical webinars, whitepapers, and product bulletins direct from our authorized OEM principals.',
      canonicalUrl: `${origin}/blogs`,
    },
    '/blog': {
      title: 'Technical News, Video Demos & Whitepapers',
      description: 'Read official application notes, technical webinars, whitepapers, and product bulletins direct from our authorized OEM principals.',
      canonicalUrl: `${origin}/blogs`,
    },
    '/contact': {
      title: 'Contact Us — Request Quote & Technical Inquiry',
      description: 'Get in touch with Icon Electromatic engineers across our offices in India, Singapore, and USA for formal quotes and technical assistance.',
      canonicalUrl: `${origin}/contact`,
    },
    '/admin': {
      title: 'CMS Admin Portal',
      description: 'Icon Electromatic Content Management System.',
      canonicalUrl: `${origin}/admin`,
      noindex: true,
    },
  };

  const selected = routeMetadata[cleanRoute] || {
    title: cmsSeo.siteTitle || 'RF, Microwave & Electronic Components',
    description: cmsSeo.metaDescription || 'Authorized distributor of RF, microwave, and electromechanical components.',
    canonicalUrl: `${origin}${cleanRoute.startsWith('/') ? cleanRoute : '/' + cleanRoute}`,
  };

  return updateSeo({
    title: selected.title,
    description: selected.description,
    canonicalUrl: selected.canonicalUrl,
    ogImage: cmsSeo.ogImage || '/icon-logo-transparent.png',
    noindex: selected.noindex || false,
    structuredData: cleanRoute === '/' ? {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: SITE_NAME,
      url: origin,
      logo: `${origin}/icon-logo-transparent.png`,
      description: selected.description,
      sameAs: [
        'https://www.linkedin.com/company/icon-electromatic/',
      ],
    } : null,
  });
}

export const SeoService = {
  getSiteOrigin,
  sanitizeMetaContent,
  generateProductStructuredData,
  generateBreadcrumbStructuredData,
  updateSeo,
  setProductSeo,
  setDefaultSeo,
};

export default SeoService;
