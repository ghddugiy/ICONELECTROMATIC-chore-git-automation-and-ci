/**
 * Chatbot Component — ICON ELECTROMATIC
 * Intelligent engineering dispatch chatbot with complete knowledge of all 15 OEMs,
 * their component categories, and flagship products.
 */
import { CATALOG } from '../data/catalogData.js';

const BOT_NAME = 'ICON Engineering Assistant';

// Helper to escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

// Find matched OEM
function findOem(query) {
  const q = query.toLowerCase();
  for (const oem of CATALOG) {
    if (q.includes(oem.name.toLowerCase()) || q.includes(oem.shortName.toLowerCase()) || q.includes(oem.id)) {
      return oem;
    }
    // Aliases
    if (oem.id === 'minicircuits' && (q.includes('mini-circuits') || q.includes('mini circuits') || q.includes('minicircuit'))) return oem;
    if (oem.id === 'ohmega-ticer' && (q.includes('ohmega') || q.includes('ticer') || q.includes('resistor foil'))) return oem;
    if (oem.id === 'rfuw-engineering' && (q.includes('rfuw') || q.includes('rf&w'))) return oem;
    if (oem.id === 'triteq' && (q.includes('tri-teq') || q.includes('triteq'))) return oem;
    if (oem.id === 'nee' && (q.includes('new england etching') || q.includes('nee') || q.includes('new england'))) return oem;
    if (oem.id === 'aee-isarael' && (q.includes('aee') || q.includes('pids') || q.includes('perimeter'))) return oem;
    if (oem.id === 'transline-technology' && q.includes('transline')) return oem;
    if (oem.id === 'evans' && (q.includes('eulex') || q.includes('paktron') || q.includes('evans capacitor'))) return oem;
    if (oem.id === 'tecdia' && (q.includes('tecdia') || q.includes('single layer cap'))) return oem;
    if (oem.id === 'fortify' && (q.includes('radix') || q.includes('fluxcore') || q.includes('3d print') || q.includes('dielectric lens'))) return oem;
  }
  return null;
}

// Find matched Category
function findCategory(query) {
  const q = query.toLowerCase();
  for (const oem of CATALOG) {
    for (const cat of oem.categories) {
      if (cat.name && cat.name.length > 2 && q.includes(cat.name.toLowerCase())) {
        return { oem, cat };
      }
      // Common category keywords
      if (cat.id === 'rt-duroid' && (q.includes('duroid') || q.includes('rt/duroid') || q.includes('5880') || q.includes('5870'))) return { oem, cat };
      if (cat.id === 'ro400-series' && (q.includes('ro4000') || q.includes('ro400') || q.includes('ro4350') || q.includes('ro4003'))) return { oem, cat };
      if (cat.id === 'ro300-series' && (q.includes('ro3000') || q.includes('ro300') || q.includes('ro3003'))) return { oem, cat };
      if (cat.id === 'power-amplifiers' && (q.includes('power amplifier') || q.includes('pa') || q.includes('rf pa'))) return { oem, cat };
      if (cat.id === 'low-noise-amplifiers' && (q.includes('low noise') || q.includes('lna'))) return { oem, cat };
      if (cat.id === 'gan-hemts' && (q.includes('gan') || q.includes('hemt'))) return { oem, cat };
      if (cat.id === 'beamforming-integrated-circuits' && q.includes('beamforming')) return { oem, cat };
      if (cat.id === '3d-printed-dielectric-parts' && (q.includes('dielectric') || q.includes('lens') || q.includes('radix'))) return { oem, cat };
      if (cat.id === 'rf-limiters' && q.includes('limiter')) return { oem, cat };
      if (cat.id === 'rf-switches' && (q.includes('rf switch') || q.includes('spdt') || q.includes('high isolation switch'))) return { oem, cat };
      if (cat.id === 'hypersdr' && (q.includes('sdr') || q.includes('software defined') || q.includes('hypersdr'))) return { oem, cat };
    }
  }
  return null;
}

// Find matched Product
function findProduct(query) {
  const q = query.toLowerCase();
  for (const oem of CATALOG) {
    for (const cat of oem.categories) {
      for (const prod of cat.products) {
        if (prod.name && prod.name.length > 3 && q.includes(prod.name.toLowerCase())) {
          return { oem, cat, prod };
        }
      }
    }
  }
  return null;
}

export function getBotReply(userText) {
  const query = userText.toLowerCase().trim();

  // 1. Check for specific Product match
  const matchedProd = findProduct(query);
  if (matchedProd) {
    const { oem, cat, prod } = matchedProd;
    return `
      <div>
        <strong>${escapeHtml(prod.name)}</strong> is manufactured by <strong>${escapeHtml(oem.name)}</strong> under the <em>${escapeHtml(cat.name)}</em> category.
        <br/><br/>
        <div style="font-size:0.82rem;color:var(--text-gray-300);line-height:1.45;margin-bottom:8px;">
          ${escapeHtml(prod.description)}
        </div>
        ${prod.applications ? `
          <div style="font-size:0.75rem;color:var(--text-gray-400);margin-bottom:10px;">
            <i class="fa-solid fa-microchip" style="color:var(--logo-blue-light);margin-right:4px;"></i>
            <strong>Typical Applications:</strong> ${escapeHtml(prod.applications.split(',').slice(0, 3).join(', '))}
          </div>
        ` : ''}
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;">
          <button class="chat-action-badge" data-route="/contact?subject=rfq&product=${encodeURIComponent(prod.name)}&model=${encodeURIComponent(prod.name)}&oem=${encodeURIComponent(oem.name)}">
            <i class="fa-solid fa-file-invoice-dollar"></i> Request RFQ for ${escapeHtml(prod.name)}
          </button>
          <button class="chat-action-badge" style="background:rgba(37,99,235,0.15);border-color:rgba(37,99,235,0.4);color:var(--logo-blue-light);" data-route="/products?level=products&oem=${oem.id}&category=${cat.id}">
            <i class="fa-solid fa-layer-group"></i> View ${escapeHtml(cat.name)}
          </button>
        </div>
      </div>
    `;
  }

  // 2. Check for specific Category match
  const matchedCat = findCategory(query);
  if (matchedCat) {
    const { oem, cat } = matchedCat;
    const prodList = cat.products.slice(0, 4).map(p => p.name).join(', ');
    const extraCount = cat.products.length > 4 ? ` (+${cat.products.length - 4} more)` : '';

    return `
      <div>
        <strong>${escapeHtml(cat.name)}</strong> is supplied by <strong>${escapeHtml(oem.name)}</strong>.
        <br/><br/>
        <div style="font-size:0.82rem;color:var(--text-gray-300);line-height:1.45;margin-bottom:8px;">
          ${escapeHtml(cat.description)}
        </div>
        <div style="font-size:0.75rem;color:var(--text-gray-400);margin-bottom:10px;">
          <i class="fa-solid fa-check-circle" style="color:var(--success);margin-right:4px;"></i>
          <strong>Key Models:</strong> ${escapeHtml(prodList)}${extraCount}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;">
          <button class="chat-action-badge" style="background:rgba(37,99,235,0.15);border-color:rgba(37,99,235,0.4);color:var(--logo-blue-light);" data-route="/products?level=products&oem=${oem.id}&category=${cat.id}">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> Open ${escapeHtml(cat.name)} Products
          </button>
          <button class="chat-action-badge" data-route="/contact?subject=rfq&product=${encodeURIComponent(cat.name)}&oem=${encodeURIComponent(oem.name)}">
            <i class="fa-solid fa-paper-plane"></i> Request RFQ
          </button>
        </div>
      </div>
    `;
  }

  // 3. Check for specific OEM match
  const matchedOem = findOem(query);
  if (matchedOem) {
    const catNames = matchedOem.categories.map(c => c.name).slice(0, 6).join(' · ');
    const extraCats = matchedOem.categories.length > 6 ? ` (+${matchedOem.categories.length - 6} more)` : '';

    return `
      <div>
        <strong>${escapeHtml(matchedOem.name)}</strong>
        <span style="font-size:0.75rem;color:${matchedOem.accentColor};font-weight:700;display:block;margin-top:2px;">
          ${escapeHtml(matchedOem.specialty)}
        </span>
        <div style="font-size:0.82rem;color:var(--text-gray-300);line-height:1.45;margin:8px 0;">
          ${escapeHtml(matchedOem.description)}
        </div>
        <div style="font-size:0.75rem;color:var(--text-gray-400);background:rgba(255,255,255,0.03);padding:6px 10px;border-radius:4px;border:1px solid var(--border-card);margin-bottom:10px;">
          <strong style="color:var(--text-white);">Available Categories (${matchedOem.categories.length}):</strong><br/>
          ${escapeHtml(catNames)}${extraCats}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;">
          <button class="chat-action-badge" style="background:rgba(37,99,235,0.15);border-color:rgba(37,99,235,0.4);color:var(--logo-blue-light);" data-route="/products?level=categories&oem=${matchedOem.id}">
            <i class="fa-solid fa-folder-tree"></i> Explore ${escapeHtml(matchedOem.shortName)} Categories
          </button>
          <button class="chat-action-badge" data-route="/contact?subject=rfq&oem=${encodeURIComponent(matchedOem.name)}">
            <i class="fa-solid fa-file-invoice"></i> Request Quote for ${escapeHtml(matchedOem.shortName)}
          </button>
        </div>
      </div>
    `;
  }

  // 4. Questions about list of OEMs / Brands / Principals
  if (
    query.includes('oem') || query.includes('companies') || query.includes('brands') ||
    query.includes('partners') || query.includes('principals') || query.includes('manufacturers') ||
    query.includes('who do you represent') || query.includes('list')
  ) {
    return `
      <div>
        ICON Electromatic is the specialized engineering distributor for <strong>15 global technology OEMs</strong>:
        <br/><br/>
        <ul style="padding-left:16px;margin:0 0 10px;font-size:0.8rem;line-height:1.6;color:var(--text-gray-300);">
          <li><strong>Rogers Corporation</strong> — High Frequency PTFE Laminates</li>
          <li><strong>Qorvo</strong> — GaN HEMTs, Power Amplifiers &amp; Front-End Modules</li>
          <li><strong>Fortify</strong> — 3D Printed Low-Loss RF Dielectric Optics</li>
          <li><strong>Ohmega Ticer</strong> — Thin-Film Embedded Resistor Foils</li>
          <li><strong>Mini-Circuits</strong> — Broadline RF/MW Components &amp; Adapters</li>
          <li><strong>RFuW Engineering</strong> — High-Power Limiters &amp; Switches</li>
          <li><strong>Tri-TeQ</strong> — Harmonic Switched Filters</li>
          <li><strong>YTTEK</strong> — Ultra-Wideband Software Defined Radios (HyperSDR)</li>
          <li><strong>Spellman</strong> — High Voltage Power Supplies</li>
          <li><strong>Thermosen, TecDia, Evans, NEE, PowerFactor (PowerRF), AEE Israel, Transline Technology</strong></li>
        </ul>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          <button class="chat-action-badge" style="background:rgba(37,99,235,0.15);border-color:rgba(37,99,235,0.4);color:var(--logo-blue-light);" data-route="/products">
            <i class="fa-solid fa-boxes-stacked"></i> Open Full OEM Catalog
          </button>
          <button class="chat-action-badge" data-route="/partners">
            <i class="fa-solid fa-handshake"></i> View Partners Directory
          </button>
        </div>
      </div>
    `;
  }

  // 5. Questions about Categories / What do you supply / Product line
  if (
    query.includes('categor') || query.includes('what do you sell') || query.includes('products do you offer') ||
    query.includes('product line') || query.includes('what do you have') || query.includes('components')
  ) {
    return `
      <div>
        Our portfolio spans <strong>over 70 specialized component categories</strong> across 15 manufacturers:
        <br/><br/>
        <ul style="padding-left:16px;margin:0 0 10px;font-size:0.8rem;line-height:1.6;color:var(--text-gray-300);">
          <li><strong>RF &amp; Microwave Laminates:</strong> RT/duroid, RO400, RO300, TMM, CLTE, DICLAD</li>
          <li><strong>Active MMICs &amp; GaN:</strong> Power Amplifiers, LNAs, Beamforming ICs, Drivers, GaN HEMTs</li>
          <li><strong>3D Printed RF Optics:</strong> GRIN dielectric lenses, low-loss Radix materials</li>
          <li><strong>Protection &amp; Control:</strong> High-power PIN diode limiters, fast RF switches</li>
          <li><strong>Embedded Passives:</strong> RCM, TCR resistor foils, single layer capacitors</li>
          <li><strong>Software-Defined Radios:</strong> HyperSDR, SDRspace transceivers</li>
        </ul>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          <button class="chat-action-badge" style="background:rgba(37,99,235,0.15);border-color:rgba(37,99,235,0.4);color:var(--logo-blue-light);" data-route="/products">
            <i class="fa-solid fa-boxes-stacked"></i> Browse Catalog by OEM &amp; Category
          </button>
          <button class="chat-action-badge" data-route="/contact?subject=rfq">
            <i class="fa-solid fa-paper-plane"></i> Request Custom Quote
          </button>
        </div>
      </div>
    `;
  }

  // 6. Pricing & RFQ questions
  if (query.includes('price') || query.includes('cost') || query.includes('quote') || query.includes('rfq')) {
    return `
      <div>
        Commercial pricing depends on component volume tier, screening levels, and required delivery schedules.
        <br/><br/>
        Official quotations with turnaround within 24 business hours are provided directly by our sales engineering dispatch.
        <div style="margin-top:10px;">
          <button class="chat-action-badge" data-route="/contact?subject=rfq">
            <i class="fa-solid fa-file-invoice-dollar"></i> Open RFQ Request Form
          </button>
        </div>
      </div>
    `;
  }

  // 7. Datasheet inquiries
  if (query.includes('datasheet') || query.includes('data sheet') || query.includes('drawing') || query.includes('spec')) {
    return `
      <div>
        In accordance with company policy, technical specifications, CAD footprints, and application consultation are provided directly by our application engineering team.
        <div style="margin-top:10px;">
          <button class="chat-action-badge" data-route="/contact?subject=technical">
            <i class="fa-solid fa-circle-info"></i> Connect with Application Engineer
          </button>
        </div>
      </div>
    `;
  }

  // 8. Delivery & Lead Times
  if (query.includes('delivery') || query.includes('lead time') || query.includes('stock') || query.includes('shipping')) {
    return `
      <div>
        Standard catalog components dispatch within <strong>24 to 48 hours</strong> across India and internationally. For project-specific lead times and batch production delivery dates, please reach out to our logistics desk.
        <div style="margin-top:10px;">
          <button class="chat-action-badge" data-route="/contact?subject=delivery">
            <i class="fa-solid fa-truck-fast"></i> Verify Delivery Schedule
          </button>
        </div>
      </div>
    `;
  }

  // 9. Compliance & Quality
  if (query.includes('rohs') || query.includes('iso') || query.includes('certif') || query.includes('quality') || query.includes('mil')) {
    return `
      <div>
        ICON Electromatic is <strong>ISO 9001:2015 certified</strong>. All supplied components are 100% genuine with OEM traceability certificates and comply strictly with RoHS and aerospace/defense Mil-Spec screening protocols.
        <div style="margin-top:10px;">
          <button class="chat-action-badge" data-route="/about">
            <i class="fa-solid fa-shield-check"></i> Learn About Quality &amp; ISO
          </button>
        </div>
      </div>
    `;
  }

  // 10. Corporate background
  if (query.includes('about') || query.includes('company') || query.includes('who are you') || query.includes('bengaluru') || query.includes('location')) {
    return `
      <div>
        <strong>ICON ELECTROMATIC PRIVATE LIMITED</strong> was founded in 2009 in Bengaluru, India. We are an authorized distributor providing advanced RF, microwave, and high-reliability electronic components across India, Israel, Singapore, and the United States.
        <div style="margin-top:10px;">
          <button class="chat-action-badge" data-route="/about">
            <i class="fa-solid fa-building"></i> Learn About ICON
          </button>
        </div>
      </div>
    `;
  }

  // Fallback
  return `
    <div>
      Thank you for your inquiry. You can ask me about any of our <strong>15 authorized OEMs</strong> (e.g. <em>Rogers, Qorvo, Fortify, Mini-Circuits, Ohmega-Ticer</em>), specific <strong>categories</strong> (e.g. <em>RT/Duroid, Power Amplifiers, 3D RF Optics</em>), or target models.
      <br/><br/>
      For custom specifications or commercial quotes, please connect directly with our engineering team:
      <div style="margin-top:8px;">
        <button class="chat-action-badge" data-route="/contact">
          <i class="fa-solid fa-paper-plane"></i> Contact Engineering Team &rarr;
        </button>
      </div>
    </div>
  `;
}

export function renderChatbot() {
  return `
    <div class="chatbot-launcher-container" id="chatbot-launcher-container">
      <button class="chatbot-launcher-btn" id="chatbot-launcher-btn" aria-label="Open engineering assistant">
        <i class="fa-solid fa-headset" id="chatbot-fab-icon"></i>
        <span class="chatbot-online-indicator"></span>
      </button>
    </div>

    <div class="chatbot-modal" id="chatbot-modal" role="dialog" aria-label="ICON Assistant">
      <div class="chat-modal-header">
        <div class="chat-avatar"><i class="fa-solid fa-microchip"></i></div>
        <div class="chat-header-details">
          <h4>${BOT_NAME}</h4>
          <p>Live Engineering Dispatch · Instant Inquiries</p>
        </div>
        <button class="chat-close-btn" id="chatbot-close-btn" aria-label="Close Assistant">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="chat-modal-body" id="chatbot-messages-body">
        <div class="chat-bubble-bot">
          👋 Welcome to <strong>ICON ELECTROMATIC</strong>. 
          <br/><br/>
          I can assist you with information about our <strong>15 authorized OEMs</strong>, component categories (Laminates, GaN Amplifiers, 3D RF Optics, Limiters, SDRs), and flagship models.
          <br/><br/>
          <em>What component or manufacturer can I assist you with today?</em>
        </div>
      </div>

      <div class="chat-quick-chips">
        <button class="chat-chip" data-q="All 15 OEMs">All 15 OEMs</button>
        <button class="chat-chip" data-q="Rogers Laminates">Rogers Laminates</button>
        <button class="chat-chip" data-q="Qorvo GaN & ICs">Qorvo GaN &amp; ICs</button>
        <button class="chat-chip" data-q="Fortify 3D Optics">Fortify 3D Optics</button>
        <button class="chat-chip" data-q="Request a Quote">Request Quote</button>
      </div>

      <div class="chat-input-row">
        <input type="text" id="chatbot-input-field" placeholder="Ask about an OEM, category, or model..." autocomplete="off" />
        <button class="chat-send-btn" id="chatbot-send-action" aria-label="Send">
          <i class="fa-solid fa-paper-plane"></i>
        </button>
      </div>
    </div>
  `;
}

export function initChatbot() {
  const launcher = document.getElementById('chatbot-launcher-btn');
  const modal = document.getElementById('chatbot-modal');
  const closeBtn = document.getElementById('chatbot-close-btn');
  const input = document.getElementById('chatbot-input-field');
  const sendBtn = document.getElementById('chatbot-send-action');
  const body = document.getElementById('chatbot-messages-body');

  if (!launcher || !modal) return;

  function toggleModal() {
    modal.classList.toggle('open');
    if (modal.classList.contains('open') && input) {
      input.focus();
    }
  }

  launcher.addEventListener('click', toggleModal);
  closeBtn?.addEventListener('click', () => modal.classList.remove('open'));

  // Wire up action buttons inside messages
  function wireActionButtons(container) {
    container.querySelectorAll('[data-route]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const route = btn.getAttribute('data-route');
        if (route) {
          window.location.hash = route;
          modal.classList.remove('open');
        }
      });
    });
  }

  // Wire initial bubble buttons if any
  wireActionButtons(body);

  function handleSend(text) {
    const query = text || input?.value.trim();
    if (!query) return;

    // Add user bubble
    const userBubble = document.createElement('div');
    userBubble.className = 'chat-bubble-user';
    userBubble.textContent = query;
    body.appendChild(userBubble);

    if (input) input.value = '';
    body.scrollTop = body.scrollHeight;

    // Simulate brief realistic typing delay (250ms)
    setTimeout(() => {
      const replyHtml = getBotReply(query);
      const botBubble = document.createElement('div');
      botBubble.className = 'chat-bubble-bot';
      botBubble.innerHTML = replyHtml;
      body.appendChild(botBubble);
      body.scrollTop = body.scrollHeight;

      // Wire up all action buttons in the new bubble
      wireActionButtons(botBubble);
    }, 250);
  }

  sendBtn?.addEventListener('click', () => handleSend());
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSend();
  });

  // Quick chips
  document.querySelectorAll('.chat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const q = chip.getAttribute('data-q');
      handleSend(q);
    });
  });
}
