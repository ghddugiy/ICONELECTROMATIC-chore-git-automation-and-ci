import test from 'node:test';
import assert from 'node:assert/strict';
import { loadChatbotCatalog, getBotReply } from '../src/components/Chatbot.js';
import { loadHomePopularProducts } from '../src/pages/Home.js';

const liveCatalog = [
  {
    id: 'rogers-corporation',
    name: 'Rogers Corporation',
    shortName: 'Rogers',
    accentColor: '#123456',
    categories: [
      {
        id: 'rt-duroid',
        name: 'RT/duroid',
        products: [
          {
            id: 'live-laminate',
            name: 'Live Backend Laminate',
            description: 'Loaded from the public catalogue API.',
            applications: 'Satellite communications',
          },
        ],
      },
    ],
  },
];

test('chatbot loads live catalogue data and uses it to answer product queries', async () => {
  const catalog = await loadChatbotCatalog({
    getPublicCatalog: async () => ({ catalog: liveCatalog, source: 'api' }),
  });

  assert.equal(catalog, liveCatalog);
  const reply = getBotReply('Tell me about Live Backend Laminate');
  assert.ok(reply.includes('Live Backend Laminate'));
  assert.ok(reply.includes('Rogers Corporation'));
  assert.ok(reply.includes('Loaded from the public catalogue API.'));
});

test('chatbot retains its available catalogue and logs when live loading fails', async () => {
  const errors = [];
  const existingCatalog = await loadChatbotCatalog(
    { getPublicCatalog: async () => { throw new Error('API unavailable'); } },
    (...args) => errors.push(args)
  );

  assert.equal(existingCatalog, liveCatalog);
  assert.equal(errors.length, 1);
  assert.match(errors[0][0], /retaining the available catalog/);
});

test('homepage popular products are selected from the public catalogue response', async () => {
  const products = await loadHomePopularProducts({
    getPublicCatalog: async () => ({ catalog: liveCatalog, source: 'api' }),
  });

  assert.equal(products.length, 1);
  assert.equal(products[0].id, 'live-laminate');
  assert.equal(products[0].oemId, 'rogers-corporation');
  assert.equal(products[0].oemName, 'Rogers Corporation');
  assert.equal(products[0].catId, 'rt-duroid');
});
