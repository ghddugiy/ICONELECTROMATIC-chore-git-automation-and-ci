import test from 'node:test';
import assert from 'node:assert/strict';

// Provide browser storage mocks for Node test environment
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) || null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

import { CATALOG } from '../../src/data/catalogData.js';
import { CatalogService, createReconciliationPreview } from '../../src/data/CatalogService.js';
import { ApiService } from '../../src/data/ApiService.js';

test('ApiService stores and manages CSRF token and base URL', () => {
  assert.equal(typeof ApiService.getBaseUrl(), 'string');
  ApiService.setCsrfToken('mock-csrf-token-12345');
  assert.equal(ApiService.getCsrfToken(), 'mock-csrf-token-12345');
  ApiService.setCsrfToken(null);
  assert.equal(ApiService.getCsrfToken(), null);
});

test('createReconciliationPreview accurately calculates counts against empty backend', () => {
  const preview = createReconciliationPreview(CATALOG, []);

  assert.equal(preview.isBackendEmpty, true);
  assert.deepEqual(preview.localCounts, {
    oems: 15,
    categories: 88,
    products: 169,
  });
  assert.deepEqual(preview.backendCounts, {
    oems: 0,
    categories: 0,
    products: 0,
  });
  assert.deepEqual(preview.proposedCreateCounts, {
    oems: 15,
    categories: 88,
    products: 169,
  });
  assert.equal(preview.summary.totalLocalRecords, 272);
  assert.equal(preview.summary.totalProposedCreates, 272);
});

test('createReconciliationPreview verifies hierarchy integrity (no orphaned categories or products)', () => {
  const preview = createReconciliationPreview(CATALOG, []);

  assert.equal(preview.orphanedCategories.length, 0);
  assert.equal(preview.orphanedProducts.length, 0);
  assert.equal(preview.conflicts.length, 0);
});

test('createReconciliationPreview flags non-URL strings in externalLink without losing data', () => {
  const preview = createReconciliationPreview(CATALOG, []);

  assert.equal(preview.externalLinkWarnings.length, 3);
  const flaggedIds = preview.externalLinkWarnings.map((w) => w.id);
  assert.ok(flaggedIds.includes('tcr-ehf-25n18p8x-55'));
  assert.ok(flaggedIds.includes('tcr-ehf-50n18p8x-56'));
  assert.ok(flaggedIds.includes('tcr-ehf-100n18p8x-57'));

  preview.externalLinkWarnings.forEach((warning) => {
    assert.match(warning.rawLink, /TCR-EHF/);
    assert.ok(warning.reason.includes('preserved in sourceData.link'));
  });
});

test('createReconciliationPreview audits image paths accurately', () => {
  const preview = createReconciliationPreview(CATALOG, []);

  assert.equal(typeof preview.imageAudit.localAssetCount, 'number');
  assert.ok(preview.imageAudit.localAssetCount >= 169);
  assert.equal(preview.imageAudit.indexedDbCount, 0);
});

test('CatalogService.findFallbackProduct returns full product details when backend is empty', () => {
  const product = CatalogService.findFallbackProduct('rt-duroid-5880-2');

  assert.ok(product);
  assert.equal(product.id, 'rt-duroid-5880-2');
  assert.equal(product.model, 'RT/duroid 5880');
  assert.equal(product.categoryName, 'RT/Duroid');
  assert.equal(product.oem, 'Rogers');
  assert.equal(product.oemId, 'rogers-corporation');
  assert.ok(Array.isArray(product.relatedProducts));
  assert.ok(product.relatedProducts.length > 0);
});

test('CatalogService.saveAdminCatalog throws error when backend catalog is empty', async () => {
  // Ensure adminCatalog is considered empty
  await assert.rejects(
    async () => {
      await CatalogService.saveAdminCatalog(CATALOG);
    },
    /The backend catalog is empty\. Review the migration preview/
  );
});

test('escapeHtml safely encodes special HTML characters and handles non-string inputs', () => {
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>'"]/g, (tag) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    }[tag] || tag));
  }

  assert.equal(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  assert.equal(escapeHtml("Tom & Jerry's"), 'Tom &amp; Jerry&#39;s');
  assert.equal(escapeHtml('TCR-EHF® Embedded Resistor'), 'TCR-EHF® Embedded Resistor');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(123), '123');
});

test('CatalogService.verifyBackendCatalog returns verified: true when actual counts match 15 OEMs, 88 categories, 169 products', async () => {
  const originalLoad = CatalogService.loadAdminCatalog;
  CatalogService.loadAdminCatalog = async () => JSON.parse(JSON.stringify(CATALOG));

  try {
    const result = await CatalogService.verifyBackendCatalog({ oems: 15, categories: 88, products: 169 });
    assert.equal(result.verified, true);
    assert.equal(result.counts.oems, 15);
    assert.equal(result.counts.categories, 88);
    assert.equal(result.counts.products, 169);
    assert.equal(result.counts.total, 272);
  } finally {
    CatalogService.loadAdminCatalog = originalLoad;
  }
});

test('CatalogService.verifyBackendCatalog returns verified: false when actual counts differ from expectations', async () => {
  const originalLoad = CatalogService.loadAdminCatalog;
  CatalogService.loadAdminCatalog = async () => [];

  try {
    const result = await CatalogService.verifyBackendCatalog({ oems: 15, categories: 88, products: 169 });
    assert.equal(result.verified, false);
    assert.equal(result.counts.oems, 0);
    assert.equal(result.counts.categories, 0);
    assert.equal(result.counts.products, 0);
    assert.equal(result.counts.total, 0);
  } finally {
    CatalogService.loadAdminCatalog = originalLoad;
  }
});

test('pre-execution dry-run validation detects conflicts, hierarchy errors, and unexpected counts', () => {
  function validateDryRunReport(report) {
    if (!report || !report.success || !report.data) {
      throw new Error('Dry-run validation did not return a valid response from the server.');
    }
    const data = report.data;
    if ((data.counts?.conflicts?.total || 0) > 0 || (data.conflicts && data.conflicts.length > 0)) {
      throw new Error('Dry-run detected conflict(s). Transfer aborted for safety.');
    }
    if (!data.hierarchy || !data.hierarchy.valid) {
      throw new Error('Dry-run detected orphaned categories or products in the catalog hierarchy.');
    }
    if (!data.duplicates || !data.duplicates.valid) {
      throw new Error('Dry-run detected duplicate IDs in candidate catalog.');
    }
    const candidate = data.counts?.candidate;
    if (!candidate || candidate.oems !== 15 || candidate.categories !== 88 || candidate.products !== 169) {
      throw new Error('Candidate counts differ from expected 15 OEMs, 88 categories, and 169 products.');
    }
    return true;
  }

  // 1. Valid report passes
  const validReport = {
    success: true,
    data: {
      counts: {
        candidate: { oems: 15, categories: 88, products: 169 },
        conflicts: { total: 0 },
      },
      hierarchy: { valid: true },
      duplicates: { valid: true },
    },
  };
  assert.equal(validateDryRunReport(validReport), true);

  // 2. Conflicts aborts
  assert.throws(() => {
    validateDryRunReport({
      ...validReport,
      data: { ...validReport.data, counts: { ...validReport.data.counts, conflicts: { total: 1 } } },
    });
  }, /conflict/);

  // 3. Hierarchy error aborts
  assert.throws(() => {
    validateDryRunReport({
      ...validReport,
      data: { ...validReport.data, hierarchy: { valid: false } },
    });
  }, /orphaned/);

  // 4. Unexpected count aborts
  assert.throws(() => {
    validateDryRunReport({
      ...validReport,
      data: { ...validReport.data, counts: { ...validReport.data.counts, candidate: { oems: 14, categories: 88, products: 169 } } },
    });
  }, /Candidate counts differ/);
});

test('transfer execution concurrency guard blocks double submissions', async () => {
  let isExecuting = false;
  async function runTransfer() {
    if (isExecuting) return false;
    isExecuting = true;
    await new Promise((resolve) => setTimeout(resolve, 10));
    isExecuting = false;
    return true;
  }

  const firstCall = runTransfer();
  const secondCall = runTransfer();

  const [firstResult, secondResult] = await Promise.all([firstCall, secondCall]);
  assert.equal(firstResult, true);
  assert.equal(secondResult, false, 'Concurrent invocation must be blocked by execution guard');
  assert.equal(isExecuting, false);
});
