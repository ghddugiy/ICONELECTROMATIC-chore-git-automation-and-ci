import { ApiService } from './ApiService.js';
import { ContentService } from './ContentService.js';

let adminCatalog = null;
let adminCatalogWasEmpty = false;
let publicCatalog = null;

const clone = (value) => JSON.parse(JSON.stringify(value));

function isValidHttpUrl(string) {
  if (!string || typeof string !== 'string') return false;
  try {
    const url = new URL(string.trim());
    return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password;
  } catch {
    return false;
  }
}

function sourceData(record) {
  return record?.sourceData && typeof record.sourceData === 'object' && !Array.isArray(record.sourceData)
    ? record.sourceData
    : {};
}

function mapCatalog(oems, categories, products) {
  const categoriesByOem = new Map();
  const productsByCategory = new Map();

  categories.forEach((category) => {
    const extra = sourceData(category);
    const mapped = {
      ...extra,
      id: category.id,
      oemId: category.oemId,
      name: category.name,
      description: extra.description || category.description || '',
      label: extra.label || category.label || '',
      visible: category.visible,
      sortOrder: category.sortOrder,
      products: [],
    };
    const list = categoriesByOem.get(category.oemId) || [];
    list.push(mapped);
    categoriesByOem.set(category.oemId, list);
    productsByCategory.set(category.id, mapped.products);
  });

  products.forEach((product) => {
    const extra = sourceData(product);
    const categoryProducts = productsByCategory.get(product.categoryId);
    if (!categoryProducts) return;
    const category = categories.find((item) => item.id === product.categoryId);
    categoryProducts.push({
      ...extra,
      id: product.id,
      categoryId: product.categoryId,
      name: product.name,
      category: extra.category || category?.name || '',
      description: product.description || '',
      applications: product.applications || '',
      link: extra.link || product.link || product.externalLink || '',
      image: extra.image || product.image || product.sourceImagePath || '',
      visible: product.visible,
      sortOrder: product.sortOrder,
      seoTitle: extra.seo?.title || extra.seoTitle || '',
      seoDescription: extra.seo?.description || extra.seoDescription || '',
    });
  });

  return oems.map((oem) => {
    const extra = sourceData(oem);
    return {
      ...extra,
      id: oem.id,
      name: oem.name,
      shortName: extra.shortName || oem.shortName || oem.name,
      specialty: extra.specialty || oem.specialty || '',
      category: extra.category || oem.category || extra.specialty || oem.specialty || '',
      tagline: extra.tagline || oem.tagline || '',
      description: extra.description || oem.description || '',
      website: extra.website || oem.websiteUrl || '',
      logoImg: extra.logoImg || oem.logoImg || '',
      logoSvg: extra.logoSvg || oem.logoSvg || '',
      defaultImage: extra.defaultImage || oem.defaultImage || '',
      accentColor: extra.accentColor || oem.accentColor || '#2563EB',
      glowColor: extra.glowColor || oem.glowColor || '',
      visible: oem.visible,
      sortOrder: oem.sortOrder,
      categories: categoriesByOem.get(oem.id) || [],
    };
  });
}

function flattenCatalog(catalog) {
  const oems = [];
  const categories = [];
  const products = [];

  catalog.forEach((oem, oemIndex) => {
    oems.push({ ...oem, sortOrder: oemIndex });
    (oem.categories || []).forEach((category, categoryIndex) => {
      categories.push({ ...category, oemId: oem.id, sortOrder: categoryIndex });
      (category.products || []).forEach((product, productIndex) => {
        products.push({
          ...product,
          categoryId: category.id,
          category: category.name,
          sortOrder: productIndex,
        });
      });
    });
  });

  return { oems, categories, products };
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function oemBody(oem) {
  const { categories, id, name, visible, sortOrder, website, sourceData: _sourceData, ...extra } = oem;
  const rawWebsite = typeof website === 'string' ? website.trim() : null;
  const validWebsite = rawWebsite && isValidHttpUrl(rawWebsite) ? rawWebsite : null;
  return {
    name,
    websiteUrl: validWebsite,
    visible: visible !== false,
    sortOrder: typeof sortOrder === 'number' && Number.isInteger(sortOrder) && sortOrder >= 0 ? sortOrder : 0,
    sourceData: {
      ...extra,
      ...(rawWebsite && !validWebsite ? { website: rawWebsite } : {}),
    },
  };
}

function categoryBody(category) {
  const { products, id, oemId, name, visible, sortOrder, sourceData: _sourceData, ...extra } = category;
  return {
    oemId,
    name,
    visible: visible !== false,
    sortOrder: typeof sortOrder === 'number' && Number.isInteger(sortOrder) && sortOrder >= 0 ? sortOrder : 0,
    sourceData: extra,
  };
}

function productBody(product) {
  const {
    id, categoryId, name, description, applications, link, image, visible,
    sortOrder, sourceData: _sourceData, seoTitle, seoDescription, ...extra
  } = product;
  const rawLink = typeof link === 'string' ? link.trim() : null;
  const validLink = rawLink && isValidHttpUrl(rawLink) ? rawLink : null;
  const customSeo = (seoTitle || seoDescription)
    ? { title: (seoTitle || '').trim(), description: (seoDescription || '').trim() }
    : (extra.seo || null);

  return {
    categoryId,
    name,
    description: description || null,
    applications: applications || null,
    externalLink: validLink,
    visible: visible !== false,
    sortOrder: typeof sortOrder === 'number' && Number.isInteger(sortOrder) && sortOrder >= 0 ? sortOrder : 0,
    sourceImagePath: image || null,
    sourceData: {
      ...extra,
      category: product.category || '',
      ...(rawLink && !validLink ? { link: rawLink } : {}),
      ...(customSeo ? { seo: customSeo } : {}),
    },
  };
}

function toPublicSourceData(record, fields) {
  const extra = sourceData(record);
  const result = {};
  fields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(extra, field)) result[field] = extra[field];
  });
  return result;
}

async function fetchCatalog(admin = false) {
  const suffix = admin ? '/admin' : '';
  const [oems, categories, products] = await Promise.all([
    ApiService.get(`/oems${suffix}`),
    ApiService.get(`/categories${suffix}`),
    ApiService.get(`/products${suffix}`),
  ]);
  return mapCatalog(oems, categories, products);
}

function recordsById(records) {
  return new Map(records.map((record) => [record.id, record]));
}

async function applyEntityChanges(path, before, after, bodyFor) {
  const previous = recordsById(before);
  const next = recordsById(after);

  for (const record of after) {
    const body = bodyFor(record);
    if (!previous.has(record.id)) {
      await ApiService.post(path, { id: record.id, ...body });
      continue;
    }
    const oldBody = bodyFor(previous.get(record.id));
    // Content-level comparison excludes sortOrder because applyReorder handles order atomically
    const { sortOrder: _oldOrder, ...oldContent } = oldBody;
    const { sortOrder: _newOrder, ...newContent } = body;
    if (stableStringify(oldContent) !== stableStringify(newContent)) {
      const changedFields = [...new Set([...Object.keys(oldContent), ...Object.keys(newContent)])]
        .filter((key) => stableStringify(oldContent[key]) !== stableStringify(newContent[key]));
      if (changedFields.length === 1 && changedFields[0] === 'visible') {
        await ApiService.patch(`${path}/${encodeURIComponent(record.id)}/visibility`, {
          visible: body.visible,
        });
      } else {
        await ApiService.patch(`${path}/${encodeURIComponent(record.id)}`, newContent);
      }
    }
  }
}

async function applyReorder(path, before, after, parentField) {
  const groups = new Map();
  after.forEach((record) => {
    const parentId = parentField ? record[parentField] : '';
    const group = groups.get(parentId) || [];
    group.push(record);
    groups.set(parentId, group);
  });

  for (const [parentId, records] of groups) {
    const oldOrder = before
      .filter((record) => (parentField ? record[parentField] : '') === parentId)
      .map((record) => record.id);
    const newOrder = records.map((record) => record.id);
    if (stableStringify(oldOrder) === stableStringify(newOrder)) continue;

    // Backend route contract strictly allows only { items: [...] }
    await ApiService.patch(`${path}/reorder`, {
      items: records.map((record, sortOrder) => ({ id: record.id, sortOrder })),
    });
  }
}

async function deleteMissing(path, before, after) {
  const retained = new Set(after.map((record) => record.id));
  for (const record of before) {
    if (!retained.has(record.id)) {
      await ApiService.delete(`${path}/${encodeURIComponent(record.id)}`);
    }
  }
}

function catalogRecords(catalog) {
  return flattenCatalog(catalog);
}

export function createReconciliationPreview(localCatalog, remoteCatalog) {
  const local = catalogRecords(localCatalog);
  const remote = catalogRecords(remoteCatalog);
  const results = {};
  const conflicts = [];

  // Entity-level comparison
  ['oems', 'categories', 'products'].forEach((type) => {
    const remoteById = recordsById(remote[type]);
    const missing = local[type].filter((record) => !remoteById.has(record.id));
    const matching = local[type].filter((record) => remoteById.has(record.id));
    results[type] = {
      localCount: local[type].length,
      backendCount: remote[type].length,
      proposedCreateCount: missing.length,
      matchingCount: matching.length,
      proposedCreates: missing.map(({ id, name }) => ({ id, name })),
    };
    matching.forEach((record) => {
      const existing = remoteById.get(record.id);
      if (record.name !== existing.name) {
        conflicts.push({
          type,
          id: record.id,
          localName: record.name,
          backendName: existing.name,
          issue: 'Name mismatch on identical ID',
          action: 'Manual review required before import',
        });
      }
    });
  });

  // Hierarchy & parent relationship validation
  const localOemIds = new Set(local.oems.map((o) => o.id));
  const localCategoryIds = new Set(local.categories.map((c) => c.id));
  const orphanedCategories = local.categories.filter((c) => !localOemIds.has(c.oemId));
  const orphanedProducts = local.products.filter((p) => !localCategoryIds.has(p.categoryId));

  // External links audit
  const externalLinkWarnings = [];
  local.products.forEach((p) => {
    if (p.link && typeof p.link === 'string' && p.link.trim().length > 0) {
      if (!isValidHttpUrl(p.link)) {
        externalLinkWarnings.push({
          type: 'product',
          id: p.id,
          name: p.name,
          rawLink: p.link,
          reason: 'Non-HTTP(S) string detected. Will be preserved in sourceData.link while externalLink remains null.',
        });
      }
    }
  });

  local.oems.forEach((o) => {
    if (o.website && typeof o.website === 'string' && o.website.trim().length > 0) {
      if (!isValidHttpUrl(o.website)) {
        externalLinkWarnings.push({
          type: 'oem',
          id: o.id,
          name: o.name,
          rawLink: o.website,
          reason: 'Non-HTTP(S) OEM website URL. Will be preserved in sourceData.website.',
        });
      }
    }
  });

  // Image references audit
  const imageAudit = {
    indexedDbCount: 0,
    localAssetCount: 0,
    externalUrlCount: 0,
    missingCount: 0,
    samplePaths: [],
  };

  const allRecordsWithImages = [
    ...local.oems.map((o) => ({ id: o.id, name: o.name, type: 'oem', image: o.logoImg || o.defaultImage })),
    ...local.products.map((p) => ({ id: p.id, name: p.name, type: 'product', image: p.image })),
  ];

  allRecordsWithImages.forEach((item) => {
    const img = (item.image || '').trim();
    if (!img) {
      imageAudit.missingCount++;
    } else if (img.startsWith('idb:')) {
      imageAudit.indexedDbCount++;
    } else if (img.startsWith('http://') || img.startsWith('https://')) {
      imageAudit.externalUrlCount++;
    } else if (img.startsWith('/')) {
      imageAudit.localAssetCount++;
    } else {
      imageAudit.localAssetCount++;
    }
  });

  imageAudit.samplePaths = allRecordsWithImages
    .filter((item) => item.image)
    .slice(0, 5)
    .map((item) => `${item.id}: ${item.image}`);

  const isBackendEmpty = remote.oems.length === 0 && remote.categories.length === 0 && remote.products.length === 0;

  return {
    isBackendEmpty,
    localCounts: Object.fromEntries(Object.entries(results).map(([type, item]) => [type, item.localCount])),
    backendCounts: Object.fromEntries(Object.entries(results).map(([type, item]) => [type, item.backendCount])),
    proposedCreateCounts: Object.fromEntries(Object.entries(results).map(([type, item]) => [type, item.proposedCreateCount])),
    proposedCreates: results,
    conflicts,
    orphanedCategories,
    orphanedProducts,
    externalLinkWarnings,
    imageAudit,
    remoteOnly: Object.fromEntries(Object.entries(results).map(([type, item]) => [
      type,
      Math.max(0, item.backendCount - (item.localCount - item.proposedCreateCount)),
    ])),
    summary: {
      totalLocalRecords: local.oems.length + local.categories.length + local.products.length,
      totalBackendRecords: remote.oems.length + remote.categories.length + remote.products.length,
      totalProposedCreates: Object.values(results).reduce((sum, item) => sum + item.proposedCreateCount, 0),
      totalConflicts: conflicts.length,
      totalLinkWarnings: externalLinkWarnings.length,
      readOnlyGuarantee: 'READ-ONLY RECONCILIATION PREVIEW — no records were modified, inserted, or imported into PostgreSQL.',
    },
  };
}

export const CatalogService = {
  getFallbackCatalog() {
    const saved = ContentService.getData('products');
    return Array.isArray(saved) ? saved : [];
  },

  findFallbackProduct(id) {
    const catalog = this.getFallbackCatalog();
    for (const oem of catalog) {
      for (const cat of oem.categories || []) {
        const found = (cat.products || []).find((p) => p.id === id);
        if (found) {
          const relatedProducts = (cat.products || [])
            .filter((p) => p.id !== id)
            .slice(0, 4)
            .map((p) => ({
              ...p,
              model: p.name,
              categoryName: cat.name,
              oemName: oem.shortName || oem.name || '',
              oemId: oem.id,
              catId: cat.id,
              oemAccent: oem.accentColor,
            }));
          return {
            id: found.id,
            model: found.name,
            name: found.name,
            category: cat.id,
            categoryName: cat.name,
            description: found.description || '',
            image: found.image || oem.defaultImage || '',
            applications: found.applications || '',
            specs: found.applications ? { Applications: found.applications } : {},
            oem: oem.shortName || oem.name || '',
            oemId: oem.id,
            externalLink: found.link || '',
            seoTitle: found.seoTitle || found.sourceData?.seo?.title || '',
            seoDescription: found.seoDescription || found.sourceData?.seo?.description || '',
            relatedProducts,
          };
        }
      }
    }
    return null;
  },

  async getPublicCatalog() {
    const catalog = await fetchCatalog(false);
    if (!catalog.length) {
      publicCatalog = this.getFallbackCatalog();
      return {
        catalog: clone(publicCatalog),
        source: 'fallback-empty',
      };
    }
    publicCatalog = catalog;
    return { catalog: clone(catalog), source: 'api' };
  },

  getCurrentPublicCatalog() {
    return clone(publicCatalog || this.getFallbackCatalog());
  },

  async getPublicProduct(id) {
    try {
      const product = await ApiService.get(`/products/${encodeURIComponent(id)}`);
      const [category, sourceCatalog] = await Promise.all([
        ApiService.get(`/categories/${encodeURIComponent(product.categoryId)}`),
        fetchCatalog(false),
      ]);
      const oem = sourceCatalog.find((item) => item.id === category.oemId);
      const catalogCategory = oem?.categories.find((item) => item.id === category.id);
      const extra = toPublicSourceData(product, ['image', 'link']);
      const relatedProducts = (catalogCategory?.products || [])
        .filter((item) => item.id !== product.id)
        .slice(0, 4)
        .map((item) => ({
          ...item,
          model: item.name,
          categoryName: category.name,
          oemName: oem?.shortName || oem?.name || '',
          oemId: oem?.id,
          catId: category.id,
          oemAccent: oem?.accentColor,
        }));
      return {
        id: product.id,
        model: product.name,
        name: product.name,
        category: category.id,
        categoryName: category.name,
        description: product.description || '',
        image: extra.image || product.image || product.sourceImagePath || '',
        applications: product.applications || '',
        specs: product.applications ? { Applications: product.applications } : {},
        oem: oem?.shortName || oem?.name || '',
        oemId: category.oemId,
        externalLink: extra.link || product.link || product.externalLink || '',
        relatedProducts,
      };
    } catch (error) {
      const fallback = this.findFallbackProduct(id);
      if (fallback) {
        return fallback;
      }
      throw error;
    }
  },

  async loadAdminCatalog() {
    const catalog = await fetchCatalog(true);
    adminCatalog = catalog;
    adminCatalogWasEmpty = catalog.length === 0;
    return clone(catalog);
  },

  getAdminCatalog() {
    return adminCatalog?.length ? clone(adminCatalog) : this.getFallbackCatalog();
  },

  isAdminCatalogEmpty() {
    return adminCatalogWasEmpty;
  },

  isAdminCatalogReady() {
    return adminCatalog !== null;
  },

  getAdminCatalogLoadState() {
    return adminCatalog === null ? 'not-loaded' : 'loaded';
  },

  getReconciliationPreview() {
    return createReconciliationPreview(this.getFallbackCatalog(), adminCatalog || []);
  },

  async getTransferDryRun(candidateCatalog = null) {
    const catalog = candidateCatalog || this.getFallbackCatalog();
    return ApiService.post('/catalog/transfer/dry-run', { catalog });
  },

  async executeCatalogTransfer(candidateCatalog = null) {
    const catalog = candidateCatalog || this.getFallbackCatalog();
    return ApiService.post('/catalog/transfer/execute', { catalog });
  },

  async verifyBackendCatalog(expectedCounts = { oems: 15, categories: 88, products: 169 }) {
    const catalog = await this.loadAdminCatalog();
    const counts = {
      oems: catalog.length,
      categories: 0,
      products: 0,
      total: 0,
    };

    catalog.forEach((oem) => {
      (oem.categories || []).forEach((cat) => {
        counts.categories++;
        counts.products += (cat.products || []).length;
      });
    });
    counts.total = counts.oems + counts.categories + counts.products;

    const matchesExpected =
      (!expectedCounts.oems || counts.oems === expectedCounts.oems) &&
      (!expectedCounts.categories || counts.categories === expectedCounts.categories) &&
      (!expectedCounts.products || counts.products === expectedCounts.products);

    return {
      catalog,
      counts,
      verified: matchesExpected,
    };
  },

  async saveAdminCatalog(nextCatalog) {
    if (!adminCatalog || adminCatalogWasEmpty) {
      throw new Error('The backend catalog is empty. Review the migration preview before editing or importing any records.');
    }

    const before = catalogRecords(adminCatalog);
    const after = catalogRecords(nextCatalog);

    try {
      await applyEntityChanges('/oems', before.oems, after.oems, oemBody);
      await applyEntityChanges('/categories', before.categories, after.categories, categoryBody);
      await applyEntityChanges('/products', before.products, after.products, productBody);
      await applyReorder('/oems', before.oems, after.oems, null);
      await applyReorder('/categories', before.categories, after.categories, 'oemId');
      await applyReorder('/products', before.products, after.products, 'categoryId');
      await deleteMissing('/products', before.products, after.products);
      await deleteMissing('/categories', before.categories, after.categories);
      await deleteMissing('/oems', before.oems, after.oems);
      adminCatalog = clone(nextCatalog);
    } catch (error) {
      try {
        await this.loadAdminCatalog();
      } catch (reloadError) {
        throw new Error(`${error.message} The server state could not be reloaded: ${reloadError.message}`);
      }
      throw error;
    }

    return clone(adminCatalog);
  },
};
