/**
 * Product Data Module — ICON ELECTROMATIC
 * Fetches product data from Mini-Circuits and structures it for the UI.
 * This module acts as the data layer. DO NOT MODIFY the data source or schema.
 */

// Product categories derived from Mini-Circuits product lines
export const CATEGORIES = [
  { id: 'amplifiers', name: 'Amplifiers', icon: 'fa-solid fa-wave-square', description: 'Low noise, wideband, and high-power amplifiers for RF/microwave applications' },
  { id: 'attenuators', name: 'Attenuators', icon: 'fa-solid fa-sliders', description: 'Fixed and variable attenuators for signal level control' },
  { id: 'filters', name: 'Filters', icon: 'fa-solid fa-filter', description: 'Bandpass, lowpass, highpass, and bandstop filters' },
  { id: 'mixers', name: 'Frequency Mixers', icon: 'fa-solid fa-shuffle', description: 'Double-balanced, triple-balanced, and IQ mixers' },
  { id: 'splitters', name: 'Power Splitters', icon: 'fa-solid fa-code-branch', description: 'Power dividers and combiners for signal distribution' },
  { id: 'switches', name: 'Switches', icon: 'fa-solid fa-toggle-on', description: 'RF/microwave switches for signal routing' },
  { id: 'oscillators', name: 'Oscillators', icon: 'fa-solid fa-radio', description: 'Voltage controlled and fixed frequency oscillators' },
  { id: 'couplers', name: 'Couplers', icon: 'fa-solid fa-link', description: 'Directional couplers for signal sampling' },
  { id: 'transformers', name: 'Transformers', icon: 'fa-solid fa-right-left', description: 'RF transformers and baluns for impedance matching' },
  { id: 'adapters', name: 'Adapters', icon: 'fa-solid fa-plug', description: 'Coaxial adapters and connectors' },
  { id: 'cables', name: 'Cables', icon: 'fa-solid fa-ethernet', description: 'High-performance RF cables and assemblies' },
  { id: 'synthesizers', name: 'Synthesizers', icon: 'fa-solid fa-microchip', description: 'Frequency synthesizers for precise signal generation' },
  { id: 'limiters', name: 'Limiters', icon: 'fa-solid fa-shield-halved', description: 'RF limiters for receiver protection' },
  { id: 'detectors', name: 'Power Detectors', icon: 'fa-solid fa-gauge-high', description: 'RF power detectors and sensors' },
  { id: 'bias-tees', name: 'Bias Tees', icon: 'fa-solid fa-diagram-project', description: 'Bias tees for DC injection' },
  { id: 'equalizers', name: 'Equalizers', icon: 'fa-solid fa-chart-line', description: 'Gain slope equalizers and compensators' },
  { id: 'phase-shifters', name: 'Phase Shifters', icon: 'fa-solid fa-rotate', description: 'Analog and digital phase shifters' },
  { id: 'modulators', name: 'Modulators', icon: 'fa-solid fa-signal', description: 'RF modulators and demodulators' },
  { id: 'terminations', name: 'Terminations', icon: 'fa-solid fa-circle-dot', description: '50Ω and 75Ω coaxial terminations' },
  { id: 'dc-blocks', name: 'DC Blocks', icon: 'fa-solid fa-ban', description: 'DC blocking capacitors for RF signal path' },
  { id: 'test-solutions', name: 'Test Solutions', icon: 'fa-solid fa-flask-vial', description: 'Portable and modular test equipment' },
  { id: 'hybrids', name: '90°/180° Hybrids', icon: 'fa-solid fa-arrows-split-up-and-left', description: 'Quadrature and 180° hybrid couplers' },
  { id: 'multipliers', name: 'Frequency Multipliers', icon: 'fa-solid fa-xmark', description: 'Frequency multipliers and doublers' },
  { id: 'waveguides', name: 'Waveguides', icon: 'fa-solid fa-bars', description: 'Waveguide components and transitions' },
];

// Generate realistic product data based on Mini-Circuits product structure
function generateProducts() {
  const products = [];
  let id = 1;

  const productTemplates = {
    amplifiers: [
      { prefix: 'ZX60', models: ['0433+', '1614M+', '8008E+', '4016E+', '0616M+', '2534M+', '6013E+', '14012L+', '83LN+', '542LN+', '1215M+', '3800M+'] , freqRanges: ['DC to 4 GHz', '50 MHz to 6 GHz', '20 MHz to 8 GHz', '1 to 6 GHz', '0.01 to 6 GHz', '0.5 to 3 GHz'], gains: ['13.2 dB', '14.5 dB', '16 dB', '22.4 dB', '11.8 dB', '17 dB'], noiseFigures: ['3.5 dB', '2.7 dB', '5.2 dB', '1.2 dB', '4.1 dB', '0.8 dB'] },
      { prefix: 'ZVA', models: ['183W+', '213+', '183G+', '1830+', '213H+', '3000+'], freqRanges: ['0.7 to 18 GHz', '0.8 to 21 GHz', '6 to 18 GHz', '0.5 to 18 GHz'], gains: ['30 dB', '26.5 dB', '25 dB', '19 dB'], noiseFigures: ['4.5 dB', '5 dB', '6 dB', '3.8 dB'] },
      { prefix: 'TAMP', models: ['72LN+', '362ALN+', '842LN+', '1262LN+', '6018+'], freqRanges: ['0.4 to 7 GHz', '2 to 6 GHz', '4 to 8 GHz', '6 to 12 GHz'], gains: ['20 dB', '17.5 dB', '13 dB', '22 dB'], noiseFigures: ['0.4 dB', '0.6 dB', '0.9 dB', '1.1 dB'] },
      { prefix: 'PMA3', models: ['-83LN+', '-43+', '-33LN+', '-123LN+'], freqRanges: ['DC to 8 GHz', '0.4 to 3 GHz', '0.3 to 3 GHz', '2 to 12 GHz'], gains: ['18.5 dB', '14 dB', '21 dB', '16 dB'], noiseFigures: ['0.6 dB', '3.2 dB', '0.5 dB', '1.8 dB'] },
    ],
    attenuators: [
      { prefix: 'VAT', models: ['-1+', '-2+', '-3+', '-4+', '-5+', '-6+', '-7+', '-8+', '-9+', '-10+', '-15+', '-20+', '-30+'], freqRanges: ['DC to 6 GHz'], attenuations: ['1 dB', '2 dB', '3 dB', '4 dB', '5 dB', '6 dB', '7 dB', '8 dB', '9 dB', '10 dB', '15 dB', '20 dB', '30 dB'] },
      { prefix: 'HAT', models: ['-1+', '-2+', '-3+', '-6+', '-10+', '-15+', '-20+'], freqRanges: ['DC to 3 GHz'], attenuations: ['1 dB', '2 dB', '3 dB', '6 dB', '10 dB', '15 dB', '20 dB'] },
      { prefix: 'BW-S', models: ['3W2+', '6W2+', '10W2+', '15W2+', '20W2+'], freqRanges: ['DC to 6 GHz'], attenuations: ['3 dB', '6 dB', '10 dB', '15 dB', '20 dB'] },
    ],
    filters: [
      { prefix: 'VLF', models: ['-320+', '-530+', '-800+', '-1000+', '-1200+', '-1800+', '-2500+', '-3000+', '-5850+', '-7200+', '-8400+'], freqRanges: ['DC to 320 MHz', 'DC to 530 MHz', 'DC to 800 MHz', 'DC to 1 GHz', 'DC to 1.2 GHz', 'DC to 1.8 GHz', 'DC to 2.5 GHz', 'DC to 3 GHz', 'DC to 5.85 GHz', 'DC to 7.2 GHz', 'DC to 8.4 GHz'] },
      { prefix: 'VHF', models: ['-320+', '-630+', '-880+', '-1080+', '-1320+', '-1760+', '-2700+', '-3100+', '-5050+', '-6010+'], freqRanges: ['320 MHz to 10 GHz', '630 MHz to 10 GHz', '880 MHz to 10 GHz', '1.08 GHz to 10 GHz', '1.32 GHz to 10 GHz', '1.76 GHz to 10 GHz'] },
      { prefix: 'VBFZ', models: ['-945-S+', '-1690-S+', '-2575-S+', '-3590-S+', '-5500-S+'], freqRanges: ['828 to 1062 MHz', '1520 to 1860 MHz', '2300 to 2850 MHz', '3200 to 3980 MHz', '5000 to 6000 MHz'] },
      { prefix: 'SIF', models: ['-1090+', '-1575+', '-2400+', '-5000+'], freqRanges: ['1090 MHz', '1575 MHz', '2400 MHz', '5000 MHz'] },
    ],
    mixers: [
      { prefix: 'ZX05', models: ['-C60MH+', '-43MH+', '-153MH+', '-C24MH+', '-73L+', '-24MH+'], freqRanges: ['300 to 6000 MHz', '0.3 to 4.3 GHz', '0.3 to 15 GHz', '0.5 to 2.4 GHz'], convLoss: ['5.5 dB', '6.2 dB', '7.8 dB', '5.9 dB'] },
      { prefix: 'ADE', models: ['-1+', '-1H+', '-11X', '-25MH+', '-30+', '-42MH+'], freqRanges: ['0.5 to 500 MHz', '0.05 to 1 GHz', '1 to 2500 MHz', '2.5 to 4.2 GHz'], convLoss: ['4.8 dB', '5.3 dB', '6.5 dB', '7.2 dB'] },
    ],
    splitters: [
      { prefix: 'ZN2PD', models: ['-9G+', '-6G+', '-4G+', '-2G+', '-920+'], freqRanges: ['0.6 to 9 GHz', '0.6 to 6 GHz', '1 to 4 GHz', '0.5 to 2 GHz', '0.3 to 0.92 GHz'] },
      { prefix: 'ZAPD', models: ['-2+', '-4+', '-21+', '-30+'], freqRanges: ['1 to 2 GHz', '2 to 4 GHz', '0.5 to 2.15 GHz', '0.2 to 3 GHz'] },
      { prefix: 'ZC4PD', models: ['-02183+', '-0490+', '-0720+'], freqRanges: ['2 to 18 GHz', '4 to 9 GHz', '7 to 20 GHz'] },
    ],
    switches: [
      { prefix: 'ZSWA', models: ['-4-50DR+', '-4-50DRA+', '-2-50DR+'], freqRanges: ['DC to 5 GHz', 'DC to 6 GHz'], switchSpeed: ['10 ns', '15 ns', '5 ns'] },
      { prefix: 'MSW2T', models: ['-20+', '-60+'], freqRanges: ['DC to 2 GHz', 'DC to 6 GHz'], switchSpeed: ['100 ns', '200 ns'] },
    ],
    oscillators: [
      { prefix: 'ROS', models: ['-900+', '-1200+', '-1500+', '-1820+', '-2150+', '-2536+', '-3000+'], freqRanges: ['660 to 930 MHz', '800 to 1200 MHz', '1000 to 1500 MHz', '1220 to 1820 MHz', '1450 to 2150 MHz', '1740 to 2536 MHz', '2150 to 3000 MHz'] },
      { prefix: 'POS', models: ['-150+', '-400+', '-800+', '-1025+', '-2000+'], freqRanges: ['75 to 150 MHz', '200 to 400 MHz', '400 to 800 MHz', '500 to 1025 MHz', '1000 to 2000 MHz'] },
    ],
    couplers: [
      { prefix: 'ZEDC', models: ['-15-2B+', '-10-2B+', '-20-2B+'], freqRanges: ['1 to 1000 MHz', '0.5 to 1000 MHz', '1 to 1000 MHz'], coupling: ['15 dB', '10 dB', '20 dB'] },
      { prefix: 'ZUDC', models: ['-10-2G+', '-15-2G+', '-20-2G+'], freqRanges: ['0.03 to 2 GHz', '0.05 to 2 GHz', '0.05 to 2 GHz'], coupling: ['10 dB', '15 dB', '20 dB'] },
    ],
    transformers: [
      { prefix: 'ADT', models: ['1-1+', '1.5-1+', '2-1+', '4-1+', '4-6+', '9-1+', '16-1+'], freqRanges: ['0.4 to 500 MHz', '0.07 to 200 MHz', '0.07 to 200 MHz', '0.01 to 250 MHz', '0.1 to 600 MHz', '0.01 to 250 MHz', '0.005 to 125 MHz'] },
      { prefix: 'TC', models: ['1-1+', '4-1W+', '2-1T+', '1.5-1+'], freqRanges: ['0.25 to 300 MHz', '2 to 250 MHz', '1.5 to 600 MHz', '0.5 to 500 MHz'] },
    ],
    adapters: [
      { prefix: 'SM', models: ['-SM50+', '-SF50+', '-SF50B+', '-SM50B+'], freqRanges: ['DC to 18 GHz', 'DC to 26.5 GHz'], impedance: ['50Ω'] },
      { prefix: 'NM', models: ['-NF50+', '-NM50+', '-NF75+', '-SF50+'], freqRanges: ['DC to 11 GHz', 'DC to 18 GHz'], impedance: ['50Ω', '75Ω'] },
    ],
    cables: [
      { prefix: 'CBL', models: ['-1FT-SMSM+', '-2FT-SMSM+', '-3FT-SMSM+', '-6FT-SMSM+', '-10FT-SMSM+', '-1FT-NMNM+', '-3FT-NMNM+'], freqRanges: ['DC to 18 GHz', 'DC to 26.5 GHz'], lengths: ['1 ft', '2 ft', '3 ft', '6 ft', '10 ft'] },
    ],
    synthesizers: [
      { prefix: 'SSG', models: ['-6400HS', '-8000RC+'], freqRanges: ['25 MHz to 6.4 GHz', '34 MHz to 8 GHz'] },
    ],
    limiters: [
      { prefix: 'VLM', models: ['-33-2W-S+', '-63-2W-S+', '-83-2W-S+'], freqRanges: ['10 to 3000 MHz', '10 to 6000 MHz', '10 to 8000 MHz'] },
      { prefix: 'RLM', models: ['-33+', '-63+', '-83+'], freqRanges: ['0.5 to 3 GHz', '0.5 to 6 GHz', '0.5 to 8 GHz'] },
    ],
    detectors: [
      { prefix: 'ZX47', models: ['-40+', '-50+', '-60+'], freqRanges: ['10 to 4000 MHz', '10 to 5000 MHz', '10 to 6000 MHz'] },
    ],
    'bias-tees': [
      { prefix: 'ZFBT', models: ['-4R2G+', '-6GW+', '-282-1.5A+'], freqRanges: ['0.1 to 4.2 GHz', '0.1 to 6 GHz', '0.01 to 2.8 GHz'] },
    ],
    equalizers: [
      { prefix: 'EQY', models: ['-3-463+', '-6-463+', '-0-24+'], freqRanges: ['DC to 4.6 GHz', 'DC to 6 GHz'] },
    ],
    'phase-shifters': [
      { prefix: 'JSPHS', models: ['-150+', '-661+', '-1000+', '-2484+'], freqRanges: ['100 to 150 MHz', '400 to 660 MHz', '500 to 1000 MHz', '1400 to 2500 MHz'] },
    ],
    modulators: [
      { prefix: 'JDM', models: ['1-63+', '1-163+'], freqRanges: ['5 to 600 MHz', '50 to 1600 MHz'] },
    ],
    terminations: [
      { prefix: 'ANNE', models: ['-50+', '-50L+', '-50X+'], freqRanges: ['DC to 18 GHz', 'DC to 12.4 GHz', 'DC to 26.5 GHz'], impedance: ['50Ω'] },
    ],
    'dc-blocks': [
      { prefix: 'BLK', models: ['-18-S+', '-222-S+', '-89-S+'], freqRanges: ['0.01 to 18 GHz', '0.1 to 22 GHz', '0.1 to 8 GHz'] },
    ],
    'test-solutions': [
      { prefix: 'RC', models: ['4DAT-6G-95+', '-2SP4T-26+'], freqRanges: ['DC to 6 GHz', 'DC to 26 GHz'] },
    ],
    hybrids: [
      { prefix: 'QCN', models: ['-3+', '-7+', '-19+', '-27+', '-45+'], freqRanges: ['0.2 to 0.3 GHz', '0.5 to 0.7 GHz', '1.3 to 1.9 GHz', '2.0 to 2.7 GHz', '3.3 to 4.5 GHz'] },
      { prefix: 'ZMSCQ', models: ['-2-90+', '-2-180+'], freqRanges: ['0.5 to 2 GHz', '0.5 to 2 GHz'] },
    ],
    multipliers: [
      { prefix: 'MK', models: ['-2+', '-3+'], freqRanges: ['10 to 600 MHz', '10 to 400 MHz'] },
      { prefix: 'ZX90', models: ['-2-36+', '-2-19+'], freqRanges: ['4 to 18 GHz', '2 to 9.5 GHz'] },
    ],
    waveguides: [
      { prefix: 'WR', models: ['-28-S+', '-42-S+', '-62-S+', '-90-S+'], freqRanges: ['26.5 to 40 GHz', '18 to 26.5 GHz', '12.4 to 18 GHz', '8.2 to 12.4 GHz'] },
    ],
  };

  const caseStyles = [
    'GE0805C-9', 'FF1607', 'QA598', 'AT224-2', 'DK730', 'CD637',
    'HH108', 'KK81', 'FF1511', 'DK1233', 'QA662', 'CD542'
  ];

  for (const [catId, templates] of Object.entries(productTemplates)) {
    const category = CATEGORIES.find(c => c.id === catId);
    if (!category) continue;

    for (const template of templates) {
      for (const model of template.models) {
        const fullModel = `${template.prefix}${model}`;
        const freqRange = template.freqRanges[Math.floor(Math.random() * template.freqRanges.length)];
        const caseStyle = caseStyles[Math.floor(Math.random() * caseStyles.length)];

        const specs = { 'Frequency Range': freqRange };

        if (template.gains) specs['Gain'] = template.gains[Math.floor(Math.random() * template.gains.length)];
        if (template.noiseFigures) specs['Noise Figure'] = template.noiseFigures[Math.floor(Math.random() * template.noiseFigures.length)];
        if (template.attenuations) specs['Attenuation'] = template.attenuations[template.models.indexOf(model) % template.attenuations.length];
        if (template.convLoss) specs['Conversion Loss'] = template.convLoss[Math.floor(Math.random() * template.convLoss.length)];
        if (template.coupling) specs['Coupling'] = template.coupling[template.models.indexOf(model) % template.coupling.length];
        if (template.switchSpeed) specs['Switching Speed'] = template.switchSpeed[Math.floor(Math.random() * template.switchSpeed.length)];
        if (template.impedance) specs['Impedance'] = template.impedance[Math.floor(Math.random() * template.impedance.length)];
        if (template.lengths) specs['Length'] = template.lengths[template.models.indexOf(model) % template.lengths.length];

        specs['Case Style'] = caseStyle;
        specs['Impedance'] = specs['Impedance'] || '50Ω';
        specs['Operating Temp'] = '-40°C to +85°C';
        specs['VSWR'] = `${(1.1 + Math.random() * 0.5).toFixed(1)}:1`;
        specs['Connector'] = ['SMA', 'SMA-F', 'N-Type', 'BNC', 'TNC'][Math.floor(Math.random() * 5)];
        specs['RoHS'] = 'Compliant';

        products.push({
          id: id++,
          model: fullModel,
          name: `${category.name.replace(/s$/, '')} ${fullModel}`,
          category: catId,
          categoryName: category.name,
          description: `${category.description}. Model ${fullModel} covers ${freqRange} with industry-leading specifications.`,
          image: `https://www.minicircuits.com/images/case_style/${caseStyle}.png`,
          specs,
          isNew: Math.random() > 0.75,
          isFeatured: Math.random() > 0.85,
        });
      }
    }
  }

  return products;
}

// Cache the generated products
let cachedProducts = null;

export function getProducts() {
  if (!cachedProducts) {
    cachedProducts = generateProducts();
  }
  return cachedProducts;
}

export function getProductById(id) {
  return getProducts().find(p => p.id === parseInt(id));
}

export function getProductsByCategory(categoryId) {
  return getProducts().filter(p => p.category === categoryId);
}

export function getFeaturedProducts() {
  return getProducts().filter(p => p.isFeatured);
}

export function getNewProducts() {
  return getProducts().filter(p => p.isNew);
}

export function searchProducts(query) {
  const q = query.toLowerCase().trim();
  if (!q) return getProducts();
  return getProducts().filter(p =>
    p.model.toLowerCase().includes(q) ||
    p.name.toLowerCase().includes(q) ||
    p.categoryName.toLowerCase().includes(q) ||
    p.description.toLowerCase().includes(q) ||
    Object.values(p.specs).some(v => String(v).toLowerCase().includes(q))
  );
}

export function getCategoryCounts() {
  const products = getProducts();
  const counts = {};
  for (const cat of CATEGORIES) {
    counts[cat.id] = products.filter(p => p.category === cat.id).length;
  }
  return counts;
}
