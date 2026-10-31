import { CATALOG } from './catalogData.js';
import { OEM_BLOGS } from './blogData.js';
import { ImageStorage } from './ImageStorage.js';

const INITIAL_CONTENT = {
  header: {
    logoUrl: '/darker-version-logo.png',
    logoDarkUrl: '/darker-version-logo.png',
    logoLightUrl: '/lighter-version-logo.png',
    ctaLabel: 'Request Quote',
    ctaLink: '/contact',
    navHome: 'Home',
    navAbout: 'About Us',
    navPartners: 'Partners',
    navProducts: 'Products',
    navServices: 'Services',
    navBlogs: 'Blogs',
    navContact: 'Contact',
  },
  footer: {
    logoUrl: '/darker-version-logo.png',
    logoDarkUrl: '/darker-version-logo.png',
    logoLightUrl: '/lighter-version-logo.png',
    tagline: 'Delivering advanced RF, Microwave, and High-Rel electronic components from DC to 86 GHz for aerospace, defense, SATCOM, and telecommunications.',
    copyrightText: '© 2026 ICON ELECTROMATIC PRIVATE LIMITED. All rights reserved.',
    // India Office
    indiaOfficeName: 'Icon Electromatic Pvt. Ltd. (India)',
    indiaAddress: '#303/2, 5th A Cross, HRBR Layout, III Block, Kalyan Nagar, Bengaluru – 560043',
    indiaPhone: '+91 80 2542 9452',
    indiaEmail: 'salesiepl@iconelectromatic.com',
    // Singapore Office
    singaporeOfficeName: 'Icon Electromatic Singapore Pte Ltd',
    singaporeAddress: '204D Compassvale Drive #08-409, Singapore 544204',
    singaporeEmail: 'IESing@iconelectromatic.com',
    // USA Office
    usaOfficeName: 'Icon Electromatic LLC (USA)',
    usaAddress: '15412 Meadow Vista Dr, Edmond, Oklahoma 73013, USA',
    usaPhone: '+1 405 593 5176',
    usaEmail: 'salesiellc@iconelectromatic.com',
    // Social
    linkedinUrl: 'https://www.linkedin.com/company/icon-electromatic/',
    youtubeUrl: '#',
  },
  home: {
    heroTitle: 'ICON ELECTROMATIC turns complex high-frequency requirements into <span class="accent-red" style="color: var(--logo-red);">mission-ready hardware.</span>',
    heroSubtitle: 'Delivering precision RF, microwave, and electronic components for defense, aerospace, SATCOM, and telecommunications.',
    heroBgVideo: '/icon-video.mp4',
    heroBgImage: '/images/hero-new-bg.png',
    ctaExploreText: 'Explore Products',
    ctaExploreLink: '/products',
    ctaQuoteText: 'Request a Quote',
    ctaQuoteLink: '/contact',
    stats: [
      { id: 'stat-1', value: '4,000+', label: 'PRODUCTS AVAILABLE' },
      { id: 'stat-2', value: '24+', label: 'COMPONENT LINES' },
      { id: 'stat-3', value: '100%', label: 'ROHS & ISO 9001' },
    ],
    coreCapabilitiesTitle: 'Core Capabilities',
    coreCapabilitiesSubtitle: 'Engineered for extreme performance.',
    coreCapabilitiesLead: 'From millimeter-wave defense radar to satellite ground infrastructure, we provide the verified hardware engineers depend on.',
    capabilities: [
      {
        id: 'cap-1',
        title: 'RF & Microwave Active',
        desc: 'High-linearity power amplifiers, ultra-low noise LNAs, active frequency mixers, and voltage-controlled oscillators.',
        linkText: 'Explore Amplifiers →',
        linkUrl: '/products?category=amplifiers',
        icon: 'fa-solid fa-wave-square',
      },
      {
        id: 'cap-2',
        title: 'Passive & Waveguides',
        desc: 'High-Q cavity bandpass filters, low-loss waveguide transitions, directional couplers, and coaxial terminations.',
        linkText: 'Explore Filters →',
        linkUrl: '/products?category=filters',
        icon: 'fa-solid fa-filter',
      },
      {
        id: 'cap-3',
        title: 'Defense & Aerospace',
        desc: 'Mil-Spec screening, extreme-temperature reliability, and radiation-tolerant solutions for tactical EW and SATCOM.',
        linkText: 'Learn More →',
        linkUrl: '/about',
        icon: 'fa-solid fa-shield-halved',
      },
      {
        id: 'cap-4',
        title: 'Test & Measurement',
        desc: 'Precision calibration adapters, armored low-loss RF test cables, and laboratory attenuator modules up to 86 GHz.',
        linkText: 'Explore Solutions →',
        linkUrl: '/products?category=test-solutions',
        icon: 'fa-solid fa-flask-vial',
      },
    ],
    popularTitle: 'Popular Products & Components',
    popularLead: 'High-frequency laminates, precision GaN semiconductors, 3D metamaterial optics, and microwave modules from our global OEM partners.',
    insightsTitle: 'Insights',
    insightsSubtitle: 'Latest Blogs',
    insightsLead: 'Engineering articles, application notes, and microwave design breakthroughs from our technical team.',
    testimonialsTitle: 'Trusted by Industry Leaders',
    testimonialsSubtitle: 'What Defense, Space & Aerospace Engineers Say',
    testimonialsLead: 'Engineered components and bespoke solutions deployed in mission-critical radar, satellite payloads, and defense communications across India and globally.',
    projectsTitle: 'Featured Projects & Mission Milestones',
    projectsSubtitle: 'Engineered for Extreme Environments',
    projectsLead: 'Direct contributions to premier radar, aerospace, and high-frequency communication programs.',
    galleryTitle: 'Hardware & Systems Showcase',
    gallerySubtitle: 'High-Rel Components in Action',
    galleryLead: 'Precision microwave active devices, passives, waveguide transitions, and advanced materials.',
  },
  about: {
    heroEyebrow: 'ABOUT ICON ELECTROMATIC',
    heroTitle: 'About Us',
    heroLead: 'Driven by decades of engineering expertise and global collaborations, Icon Electromatic Private Limited delivers advanced components and tailored solutions that transform design ambitions into reality.',
    badges: [
      { id: 'b-1', icon: 'fa-solid fa-award', text: 'Multi-Decade Pedigree', color: '#FDA4AF', bg: 'rgba(225,29,72,0.08)', border: 'rgba(225,29,72,0.25)' },
      { id: 'b-2', icon: 'fa-solid fa-satellite', text: 'Defense & Telecom Solutions', color: '#FCD34D', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)' },
      { id: 'b-3', icon: 'fa-solid fa-globe', text: 'Global OEM Representation', color: '#6EE7B7', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)' },
    ],
    coreCapabilitiesTitle: 'Core Capabilities',
    coreCapabilitiesSubtitle: 'Fulfillment partners for your electronic ambitions',
    companyDesc1: 'Icon Electromatic was founded in 2009 in Bengaluru by engineers with decades of expertise in RF, Microwave, Semiconductors, and allied service industries. In 2020, the company transitioned into Icon Electromatic Private Limited and expanded its presence across India, Israel, Singapore, and the USA.',
    companyDesc2: 'With deep experience in electronic research, development, and manufacturing ecosystems—spanning both public and private sectors—and strengthened by long-standing global partnerships, the company delivers more than advanced components. We also provide business consultancy and specialized RF design services to offer bespoke, high-performance solutions for its clients.',
    presentationLink: '/downloads/ICON_Corporate_Presentation_20Aug26.pptx',
    flyerLink: '/downloads/ICON_ELECTROMATIC_FLYER.pdf',
    highlightCards: [
      {
        id: 'hl-1',
        title: 'Global Leader in RF & Electronic Solutions',
        desc: 'Providing mission-critical components, assemblies, and custom microwave engineering for advanced applications.',
        icon: 'fa-solid fa-tower-broadcast',
        color: 'blue',
      },
      {
        id: 'hl-2',
        title: 'Advanced Components, Consultancy & Bespoke Design Services',
        desc: 'End-to-end design-in engineering, RF simulation review, and custom-tailored fulfillment for client success.',
        icon: 'fa-solid fa-microchip',
        color: 'red',
      },
    ],
    statsTitle: 'Some Quick Facts',
    statsSubtitle: 'The Numbers That Define Us',
    stats: [
      { id: 's-1', target: '1500', suffix: '+', label: 'Products', icon: 'fa-solid fa-boxes-stacked', color: 'red' },
      { id: 's-2', target: '150', suffix: '+', label: 'Years of combined experience', icon: 'fa-solid fa-calendar-check', color: 'blue' },
      { id: 's-3', target: '15', suffix: '+', label: 'Partners', icon: 'fa-solid fa-handshake-angle', color: 'red' },
    ],
    visionTitle: 'Our Vision',
    visionDesc: 'To be India’s foremost and most trusted source of essential electronics components for research, development, and manufacturing across both public and private sectors.',
    missionTitle: 'Our Mission',
    missionDesc: 'To introduce the world’s most cutting-edge technology solutions and components to India by forging strategic partnerships with global industry leaders, fostering indigenous product development and advancing “Make in India” initiatives.',
    journeyTitle: 'Chronology',
    journeySubtitle: 'Our Journey',
    journeyLead: 'From our founding in Bengaluru in 2009 as RF & Microwave specialists to global operations spanning Singapore, the USA, and India — empowering mission-critical Aerospace, Defence, Space, and SATCOM programs.',
    infographicImage: '/images/timeline/icon-journey-infographic-full.png',
    milestones: [
      {
        id: 'm-1',
        year: '2009',
        title: 'RF & Microwave Genesis',
        desc: 'Established in Bengaluru, Karnataka by veteran RF & Microwave engineers focusing on defense electronics and aerospace components distribution.',
        image: '/images/timeline/timeline-2009-bengaluru.jpg',
        caption: 'Genesis in Bengaluru, India',
        color: 'cyan',
      },
      {
        id: 'm-2',
        year: '2018',
        title: 'Singapore APAC Gateway',
        desc: 'Incorporated Icon Electromatic Singapore Pte Ltd to anchor international supply chains and streamline East Asian semiconductor distribution.',
        image: '/images/timeline/timeline-2018-singapore.jpg',
        caption: 'Regional Headquarters Singapore',
        color: 'red',
      },
      {
        id: 'm-3',
        year: 'May 2020',
        title: 'USA Transatlantic Corridor',
        desc: 'Expanded transatlantic footprint to the United States to collaborate directly with premier American microwave OEMs, ITAR suppliers, and global innovators.',
        image: '/images/timeline/timeline-2020-usa.jpg',
        caption: 'US Operations, Oklahoma',
        color: 'navy',
      },
      {
        id: 'm-4',
        year: 'Nov 2020',
        title: 'Incorporation in India',
        desc: 'Transitioned and formally incorporated as Icon Electromatic Private Limited, scaling nationwide operations and advancing “Make in India” initiatives.',
        image: '/images/timeline/timeline-2020-india.jpg',
        caption: 'Incorporation in India',
        color: 'amber',
      },
    ],
    strategicDomainsTitle: 'Strategic Application Domains',
    strategicDomainsSubtitle: 'Where Our Technology Operates',
    strategicDomainsLead: 'Delivering mission-critical electronic components, high-reliability assemblies, and custom microwave engineering across four strategic arenas.',
    domains: [
      {
        id: 'dom-1',
        title: 'Aerospace & Defence',
        desc: 'High-power GaN amplifiers, RF filters, waveguides, and radar subsystems for tactical airborne, naval, and ground-based defense platforms.',
        image: '/images/timeline/domain-aerospace-defence.jpg',
        tag: 'Radar & EW Systems',
        icon: 'fa-solid fa-jet-fighter',
      },
      {
        id: 'dom-2',
        title: 'Hi-Rel Space',
        desc: 'Spaceflight-qualified, radiation-tolerant microwave components and low-loss substrates engineered for orbital payloads and satellites.',
        image: '/images/timeline/domain-hirel-space.jpg',
        tag: 'Space-Grade Qualified',
        icon: 'fa-solid fa-satellite',
      },
      {
        id: 'dom-3',
        title: '6G & SATCOM',
        desc: 'Ultra-wideband mmWave components, parabolic antenna feed networks, beamformers, and ground station transceivers.',
        image: '/images/timeline/domain-5g-satcom.jpg',
        tag: 'Next-Gen Telecom',
        icon: 'fa-solid fa-tower-cell',
      },
      {
        id: 'dom-4',
        title: 'Homeland Security & Smart City',
        desc: 'Perimeter intrusion detection systems (PIDS), tactical perimeter radar sensors, and smart city surveillance electronics.',
        image: '/images/timeline/domain-homeland-security.jpg',
        tag: 'Intrusion & Radar',
        icon: 'fa-solid fa-shield-halved',
      },
    ],
    pillars: [
      {
        id: 'pil-1',
        eyebrow: 'GLOBAL ALLIANCES',
        title: 'Global Partnerships',
        subtitle: 'Advanced Technologies',
        desc: 'Direct OEM partnerships with premier global innovators (Qorvo, Rogers, Tecdia, Mini-Circuits, and more), delivering verified authentic high-performance components to Indian industries.',
        image: '/images/timeline/pillar-global-partnerships.jpg',
        color: 'blue',
      },
      {
        id: 'pil-2',
        eyebrow: 'ENGINEERING EXPERTISE',
        title: 'Bespoke Solutions',
        subtitle: 'RF & Design Services',
        desc: 'End-to-end design-in consultancy, specialized microwave simulation, prototyping, and custom RF assembly integration tailored precisely to mission specifications.',
        image: '/images/timeline/pillar-bespoke-solutions.jpg',
        color: 'red',
      },
    ],
    whyUsTitle: 'Our Advantage',
    whyUsSubtitle: 'Why Us',
    whyUs: [
      {
        id: 'wu-1',
        number: '01',
        title: 'We Help Customers Achieve Their Goals Without Compromise',
        desc: 'Access an expanding portfolio of high-performance RF and Microwave components, mmWave, and Semiconductor components. Whether simple or highly complex, our solutions integrate seamlessly into your designs—saving time, reducing effort, and accelerating project success.',
        icon: 'fa-solid fa-bullseye',
        color: 'red',
      },
      {
        id: 'wu-2',
        number: '02',
        title: 'Empowering You With Cutting-Edge Technology',
        desc: 'From advanced ICs to mission-critical subsystems, we provide the technologies that unlock new possibilities. Our expertise helps you build smarter, faster, and more capable electronic systems across every application.',
        icon: 'fa-solid fa-microchip',
        color: 'blue',
      },
      {
        id: 'wu-3',
        number: '03',
        title: 'Engineered Solutions Tailored to Your Needs',
        desc: 'Combining engineering insight with best-in-class global products, we deliver solutions that balance innovation, performance, and reliability. Every recommendation is customised to your technical, commercial, and operational requirements.',
        icon: 'fa-solid fa-gears',
        color: 'red',
      },
      {
        id: 'wu-4',
        number: '04',
        title: 'Access to Advanced Technology',
        desc: 'Stay ahead with timely access to the latest RF, Microwave, mmWave, and Semiconductor innovations sourced from world-leading OEMs.',
        icon: 'fa-solid fa-bolt',
        color: 'blue',
      },
    ],
  },
  services: {
    heroEyebrow: 'CAPABILITIES & SERVICES',
    heroTitle: 'Engineering Services & Global Representation',
    heroLead: 'We represent major RF, Microwave, mmWave, Semiconductors, Components, Subsystems and Power supplies manufacturers around the world, providing unparalleled support to electronic designers, manufacturers, engineers and researchers.',
    badges: [
      { id: 'sb-1', icon: 'fa-solid fa-handshake-angle', text: 'Tier-1 Global Manufacturers Representation', color: '#93C5FD' },
      { id: 'sb-2', icon: 'fa-solid fa-landmark', text: 'Indian Govt Tender Portals (GeM & CPPP)', color: '#FDA4AF' },
      { id: 'sb-3', icon: 'fa-solid fa-coins', text: 'Global Multi-Currency Supply Logistics', color: '#E2E8F0' },
    ],
    items: [
      {
        id: 'srv-1',
        badge: 'Tier-1 Global Representation',
        badgeColor: 'blue',
        title: 'Representation of Global Leaders',
        subtitle: 'Global Distribution & Sourcing',
        desc: 'We represent major RF and Microwave components, mmWave, Semiconductors, Components, Subsystems and Power supplies manufacturers around the world, providing unparalleled support to electronic designers, manufacturers, engineers and researchers.',
        ctaText: 'Explore Represented Products',
        ctaLink: '/products',
        tags: ['Direct OEM Warranty', 'Mil-Spec Screened', 'Traceable CoCs'],
        slides: [
          { image: '/images/hero-amplifier.jpg', caption: 'RF Component Representation — Microwave Amplifier' },
          { image: '/images/gan-power-chip.jpg', caption: 'Active Antenna GaN MMIC Semiconductor' },
          { image: '/images/rf-attenuator.jpg', caption: 'Precision RF Attenuator Module' },
          { image: '/images/rf-mixer.jpg', caption: 'Microwave Frequency Mixer Subsystem' },
        ],
      },
      {
        id: 'srv-2',
        badge: 'End-to-End Fulfillment',
        badgeColor: 'red',
        title: 'Product Supply and Logistics',
        subtitle: 'Supply Chain & Logistics',
        desc: 'We offer end-to-end product supply and logistics support across global shipping locations and multiple currencies, with strong expertise in import and export operations. Our team is experienced across Indian Government tender portals, enabling seamless engagement in public-sector and strategic procurement.',
        desc2: 'Supported by resources across geographies, we provide technical demonstrations, component selection, stack-up design verification, and application support throughout the design lifecycle.',
        ctaText: 'Explore Logistics Options',
        ctaLink: '/contact',
        tags: ['GeM & CPPP Portal Bidding', 'Customs & Duty Optimization', 'Multi-Currency Billing'],
        slides: [
          { image: '/images/defense-satcom.jpg', caption: 'Product Supply and Logistics — Aerospace & Defense SATCOM' },
          { image: '/images/rf-waveguide.jpg', caption: 'Waveguide Assemblies & Hardware Logistics' },
          { image: '/images/rf-microwave-pcb.jpg', caption: 'High-Frequency Space-Grade PCB Supply' },
          { image: '/images/dielectric-3d-lens.jpg', caption: 'Specialized Dielectric Component Logistics' },
        ],
      },
      {
        id: 'srv-3',
        badge: 'Technical Simulation & Advisory',
        badgeColor: 'blue',
        title: 'Design Services',
        subtitle: 'RF Engineering & Advisory',
        desc: 'In order to help compliment our partners, we at Icon provide design services for designers and engineers looking for information and advice on our products. With our team available on call, we ensure that designers and engineers get all the information they need, when they need it.',
        ctaText: 'Schedule Engineering Consultation',
        ctaLink: '/contact',
        tags: ['On-Call Senior RF Engineers', 'Stack-Up & S-Parameter Verification', 'Prototype Tuning'],
        slides: [
          { image: '/images/rf-filter.webp', caption: 'RF Design Services — Tunable Cavity Filter' },
          { image: '/images/rf-laminate.jpg', caption: 'High-Frequency Substrate Simulation & Stack-Up' },
          { image: '/images/rf-filter.jpg', caption: 'Custom Microwave Filter Design & Testing' },
          { image: '/images/rf-switch.jpg', caption: 'Solid-State RF Switch Prototype' },
        ],
      },
      {
        id: 'srv-4',
        badge: 'Enterprise Growth & Advisory',
        badgeColor: 'red',
        title: 'Business Consultancy',
        subtitle: 'Strategic Partnerships',
        desc: 'Our leadership collectively carries decades of professional expertise across various business domains. We further diversify this strength through meaningful partnerships with global leaders. We help organisations with Digital Transformation, next-generation Business Process Outsourcing, Make in India initiatives, and many more.',
        ctaText: 'Initiate Business Discussion',
        ctaLink: '/contact',
        tags: ['Make in India Strategy', 'Supply Chain Digitalization', 'Defense Offset Programs'],
        slides: [
          { image: '/images/rf-switch.jpg', caption: 'Strategic Partnership Consultancy & Hi-Rel Technology' },
          { image: '/images/rf-microwave-pcb.jpg', caption: 'Make in India Manufacturing Support & Local FAB' },
          { image: '/images/defense-satcom.jpg', caption: 'Aerospace Program Consultancy' },
          { image: '/images/gan-power-chip.jpg', caption: 'Semiconductor Industry Modernization & BPO' },
        ],
      },
    ],
  },
  projects: {
    heroTitle: 'Featured Engineering Projects',
    heroSubtitle: 'Mission-Ready Hardware Deployments',
    heroLead: 'Delivering verified high-reliability RF and microwave subsystems for defense, space, SATCOM, and radar applications across India and international programs.',
    items: [
      {
        id: 'proj-1',
        title: 'Multi-Band Radar Transceiver Subsystem',
        category: 'Defense & Radar',
        clientSector: 'Aerospace & Defense',
        desc: 'High-power GaN amplifier modules, frequency synthesizers, and low-loss filter cascades integrated for multi-mission ground radar installations.',
        image: '/images/defense-satcom.jpg',
        date: '2025 - 2026',
        status: 'Deployed',
        tags: ['GaN SSPA', 'Cavity Filters', 'AESA'],
      },
      {
        id: 'proj-2',
        title: 'Spaceflight Ku-Band Satellite Transponder',
        category: 'SATCOM & Space',
        clientSector: 'Satellite Ground & Payload',
        desc: 'Radiation-tolerant microwave switches, dielectric metamaterial lenses, and precision ceramic capacitors screened for orbital payloads.',
        image: '/images/dielectric-3d-lens.jpg',
        date: '2025',
        status: 'Flight Qualified',
        tags: ['Mil-Spec', '3D Dielectric', 'Ku-Band'],
      },
      {
        id: 'proj-3',
        title: 'High-Frequency Substrate Stack-Up Optimization',
        category: 'PCB Engineering',
        clientSector: 'High-Speed Telecom',
        desc: 'Precision simulation review and Rogers high-frequency copper clad laminate selection reducing insertion loss by 28% in 40 GHz test adapters.',
        image: '/images/rf-laminate.jpg',
        date: '2026',
        status: 'Completed',
        tags: ['Rogers RO4000', 'Impedance Match', 'Sub-40GHz'],
      },
      {
        id: 'proj-4',
        title: 'Tactical Perimeter Intrusion Detection Array',
        category: 'Homeland Security',
        clientSector: 'Strategic Border Infrastructure',
        desc: 'Micro-doppler radar sensors, high-rel RF switches, and temperature-stabilized RF assemblies deployed along sensitive perimeter installations.',
        image: '/images/rf-switch.jpg',
        date: '2025',
        status: 'Active Service',
        tags: ['PIDS', 'Radar Sensors', 'Ruggedized'],
      },
    ],
  },
  gallery: {
    heroTitle: 'Hardware & Facility Gallery',
    heroSubtitle: 'High-Reliability Components & Systems',
    heroLead: 'Visual showcase of microwave active modules, passives, waveguide transitions, precision substrates, and RF testing hardware.',
    items: [
      { id: 'gal-1', title: 'High-Power GaN Microwave Amplifier', category: 'Semiconductors', image: '/images/hero-amplifier.jpg', caption: 'High-linearity solid-state pulsed power amplifier' },
      { id: 'gal-2', title: 'Tunable Cavity Bandpass Filter', category: 'Passives', image: '/images/rf-filter.webp', caption: 'Sub-40 GHz ultra-low insertion loss filter module' },
      { id: 'gal-3', title: 'Precision Microwave Waveguide Transition', category: 'Passives', image: '/images/rf-waveguide.jpg', caption: 'Mil-Spec low-VSWR rectangular waveguide assembly' },
      { id: 'gal-4', title: 'Defense & SATCOM Earth Station Hardware', category: 'Systems', image: '/images/defense-satcom.jpg', caption: 'Ground terminal transceiver and feed assemblies' },
      { id: 'gal-5', title: 'Active Phased Array GaN MMIC Die', category: 'Semiconductors', image: '/images/gan-power-chip.jpg', caption: 'Beamformer front-end module on ceramic carrier' },
      { id: 'gal-6', title: 'High-Power PIN Diode RF Switch', category: 'Modules', image: '/images/rf-switch.jpg', caption: 'Fast-switching high-isolation multi-throw module' },
      { id: 'gal-7', title: '3D Printed Metamaterial Dielectric Lens', category: 'Optics', image: '/images/dielectric-3d-lens.jpg', caption: 'Fortify custom dielectric GRIN RF lens' },
      { id: 'gal-8', title: 'Precision Laboratory Attenuator Module', category: 'Test & Measurement', image: '/images/rf-attenuator.jpg', caption: 'DC to 40 GHz calibrated step attenuator' },
    ],
  },
  testimonials: {
    heroTitle: 'Trusted by Industry Leaders',
    heroSubtitle: 'Client & Engineer Endorsements',
    heroLead: 'Feedback from senior scientists, microwave designers, and defense procurement leads who rely on Icon Electromatic.',
    items: [
      {
        id: 'test-1',
        name: 'Dr. Vikram Nair',
        role: 'Chief Scientist (Radar Systems)',
        company: 'Defense Electronics Research Establishment',
        quote: 'Icon Electromatic consistently delivers MIL-STD screened components with rock-solid traceability. Their engineering consultations on GaN SSPA modules cut months off our prototyping cycle.',
        stars: 5,
        avatar: '/images/oem-logos/Qorvo_logo_wb.png',
        industry: 'Radar & Defense EW',
      },
      {
        id: 'test-2',
        name: 'Siddharth Rao',
        role: 'Head of RF Payload Engineering',
        company: 'Aerospace & SATCOM Systems',
        quote: 'From spaceflight-qualified dielectric substrates to custom cavity filters, Icon’s technical team in Bengaluru understands the nuances of high-frequency space transponders like few others.',
        stars: 5,
        avatar: '/images/oem-logos/Rogers_Logo_no_bg.png',
        industry: 'Space Payloads & SATCOM',
      },
      {
        id: 'test-3',
        name: 'Priya Swaminathan',
        role: 'Senior Microwave Test Engineer',
        company: 'Precision Instrumentation Labs',
        quote: 'The accuracy and repeatability of their coaxial terminations, calibration adapters, and waveguide assemblies up to 67 GHz have made Icon Electromatic our primary partner for all test bench hardware.',
        stars: 5,
        avatar: '/images/oem-logos/mini-circuits-seeklogo.png',
        industry: 'Test & Measurement',
      },
    ],
  },
  contact: {
    heroTitle: 'Send Us a Message & Request Fast Quotes',
    heroLead: 'Whether you require component data sheets, custom waveguide machining, or volume pricing, our application engineering team in Bengaluru is ready to assist.',
    careersTitle: 'Join India’s Foremost RF & Microwave Engineering Hub',
    careersLead: 'Accelerate your career in millimeter-wave technology, defense electronics, and satellite communications. Explore engineering opportunities at ICON Electromatic.',
    indiaOfficeName: 'Icon Electromatic Pvt. Ltd. (India)',
    indiaAddress: '#303/2, 5th ‘A’ Cross, HRBR Layout, III Block,\nKalyan Nagar, Bengaluru – 560043',
    indiaPhone: '+91 80 2542 9452',
    indiaEmail: 'salesiepl@iconelectromatic.com',
    singaporeOfficeName: 'Icon Electromatic Singapore Pte Ltd',
    singaporeAddress: '204D Compassvale Drive #08-409\nSingapore 544204',
    singaporeEmail: 'IESing@iconelectromatic.com',
    usaOfficeName: 'Icon Electromatic LLC (USA)',
    usaAddress: '15412 Meadow Vista Dr, Edmond,\nOklahoma 73013, USA',
    usaPhone: '+1 405 593 5176',
    usaEmail: 'salesiellc@iconelectromatic.com',
    hoursWeekday: 'Monday – Friday: 9:00 AM – 6:00 PM IST',
    hoursWeekend: 'Saturday: 9:30 AM – 1:30 PM IST',
    presets: [
      'Enquiring about High Frequency Laminates & Prepregs.',
      'Enquiring about Embedded Resistive Film.',
      'Enquiring about 3D Printed Dielectric Parts.',
      'Enquiring about High Power GaN Device and Beamforming IC.',
      'Enquiring about High Power Switches and Limiter.',
      'Enquiring about RF and MW Components.',
      'Enquiring about Tunable Filters.',
      'Enquiring about Software Defined Radios.',
      'Enquiring about high voltage power supplies.',
      'Enquiring about Temperature Sensors.',
      'Enquiring about Thin Film Capacitors.',
      'Enquiring about Ceramic Capacitors.',
      'Enquiring about PCB Fabrication.',
      'Enquiring about Perimeter Intrusion Detection System (PIDS).',
    ],
    careers: {
      // Tab & Breadcrumbs
      tabLabelSales: 'Sales & RFQ Inquiry',
      tabLabelCareers: 'Careers & Recruiting',
      showHiringBadge: true,
      hiringBadgeText: "We're Hiring",
      breadcrumbCareers: 'Careers & Recruiting',
      eyebrowCareers: 'ICON TALENT ACQUISITION',

      // Hero
      careersTitle: 'Join India’s Foremost RF & Microwave Engineering Hub',
      careersLead: 'Accelerate your career in millimeter-wave technology, defense electronics, and satellite communications. Explore engineering opportunities at ICON Electromatic.',
      careersHeroImage: '',

      // Intro & Benefits
      introIcon: 'fa-solid fa-users',
      introTitle: 'Why Build Your Career at ICON?',
      introSubtitle: 'RF & MICROWAVE EXCELLENCE',
      introDescription: 'ICON ELECTROMATIC represents the world’s foremost RF, microwave, and high-frequency component manufacturers in India. Our engineers work at the bleeding edge of radar, space satellites, defense EW systems, and 5G/6G research.',
      benefits: [
        {
          id: 'ben-1',
          icon: 'fa-solid fa-microchip',
          iconColor: '#60A5FA',
          title: 'Global OEM Partnerships',
          description: 'Direct technical engagement with leaders like Rogers Corporation, Qorvo, Spellman, Fortify, and YTTEK.'
        },
        {
          id: 'ben-2',
          icon: 'fa-solid fa-satellite-dish',
          iconColor: '#F87171',
          title: 'Strategic Defense & Space Missions',
          description: 'Contribute to critical airborne radars, missile guidance receivers, SATCOM transponders, and ISRO payloads.'
        },
        {
          id: 'ben-3',
          icon: 'fa-solid fa-flask-vial',
          iconColor: '#A855F7',
          title: 'Advanced Microwave Measurement Lab',
          description: 'Hands-on exposure to Vector Network Analyzers (VNA up to 67 GHz), noise figure meters, and RF anechoic test chambers.'
        }
      ],

      // Form Header & Badge
      showFormBadge: true,
      formBadgeIcon: 'fa-solid fa-briefcase',
      formBadgeText: 'Talent Acquisition · Bengaluru & Pan-India',
      formTitle: 'Apply for an Engineering Career',
      formSubtitle: "Join ICON Electromatic's elite RF & Microwave applications team. Fill out the application form below and our technical panel will review your profile.",

      // Form Fields Labels, Placeholders & Required toggles
      nameLabel: 'Full Name *',
      namePlaceholder: 'e.g. Vikram Sharma',
      nameRequired: true,

      emailLabel: 'Email Address *',
      emailPlaceholder: 'vikram.sharma@example.com',
      emailRequired: true,

      positionLabel: 'Position *',
      positionPlaceholder: 'Select Position...',
      positionRequired: true,

      phoneLabel: 'Phone / Mobile Number *',
      phonePlaceholder: '+91 98765 43210',
      phoneRequired: true,

      cityLabel: 'Current Location / City *',
      cityPlaceholder: 'e.g. Bengaluru, Hyderabad, Pune, Chennai',
      cityRequired: true,

      experienceLabel: 'Total Experience *',
      experiencePlaceholder: 'Select experience level...',
      experienceRequired: true,

      organizationLabel: 'Current Company or University *',
      organizationPlaceholder: 'e.g. BEL, DRDO, Astra Microwave, IISc, IIT',
      organizationRequired: true,

      noticeLabel: 'Notice Period / Earliest Availability *',
      noticeRequired: true,

      skillsLabel: 'Key Technical Skills & RF EDA Tools *',
      skillsPlaceholder: 'e.g. Keysight ADS, Ansys HFSS, CST Microwave Studio, VNA S-Parameters, GaN Matching, Rogers RT/duroid',
      skillsRequired: true,

      showLinkedin: true,
      linkedinLabel: 'LinkedIn Profile or Online Portfolio',
      linkedinPlaceholder: 'https://linkedin.com/in/username',
      linkedinRequired: false,

      statementLabel: 'Candidate Statement / Why ICON Electromatic? *',
      statementPlaceholder: 'Briefly highlight your relevant RF, Microwave, or electronics experience, core projects, and why you are keen to join ICON Electromatic...',
      statementRequired: true,

      // Resume upload settings
      resumeLabel: 'Resume / Curriculum Vitae (PDF / DOCX) *',
      resumeHelpText: 'Click or drop resume file (PDF/DOCX, max 10MB)',
      resumeAcceptedExtensions: '.pdf,.doc,.docx',
      resumeMaxSizeMb: 10,
      resumeRequired: true,

      // Dropdown option arrays (full CRUD + reorder)
      positions: [
        'RF & Microwave Design Engineer (DC–110 GHz)',
        'Field Applications Engineer (FAE) - RF Components',
        'Technical Sales & OEM Account Manager',
        'Radar, EW & SATCOM Systems Application Specialist',
        'RF Lab Test & Measurement Specialist (VNA/Spectrum)',
        'High-Frequency PCB & PTFE Substrates Specialist',
        'Graduate RF Engineering Trainee / Intern',
        'Other Technical / Engineering Specialist'
      ],
      experienceLevels: [
        'Fresh Graduate / Final Year (< 1 Year)',
        '1 – 3 Years Experience',
        '3 – 5 Years (Mid-Level Engineer)',
        '5 – 8 Years (Senior RF Specialist)',
        '8+ Years (Principal / Lead Engineer)'
      ],
      noticeOptions: [
        'Immediate / Less than 15 Days',
        '30 Days',
        '60 Days',
        '90 Days'
      ],

      // Submit Button & Messages
      submitButtonIcon: 'fa-solid fa-briefcase',
      submitButtonText: 'Submit Engineering Application',
      successTitle: 'Application Received!',
      successSubtitle: 'Thank you, {name}.',
      successMessage: 'Your application for {position} has been logged with our Technical Evaluation Committee and Talent Acquisition team in Bengaluru.',
      candidateIdPrefix: 'ICON-CAREER-',
      nextStepsTitle: 'Next Steps:',
      nextStepsText: 'Qualified candidates will be contacted within 3 to 5 business days for an introductory technical discussion. For updates, quote your Candidate Application ID to careers@iconelectromatic.com.',
      careersEmail: 'careers@iconelectromatic.com',
      resetButtonText: 'Submit Another Application',
      validationErrorMessage: 'Please complete all required fields and attach your resume before submitting.',
      errorMessage: 'An error occurred while submitting your application. Please check your connection and try again.',
      resumeFormatErrorMessage: 'Invalid file format. Please upload an accepted file type: {types}',
      resumeSizeErrorMessage: 'File size ({size} MB) exceeds the maximum allowed limit of {max} MB.'
    }
  },
  seo: {
    siteTitle: 'Icon Electromatic – RF, Microwave & Electronic Components',
    metaDescription: 'Icon Electromatic is an authorized distributor of premium RF, Microwave, and electromechanical components for defense, aerospace, SATCOM, and telecommunications.',
    metaKeywords: 'RF components, Microwave components, mmWave, defense electronics, SATCOM, Rogers Corporation, Mini-Circuits, Qorvo',
    ogTitle: 'Icon Electromatic – Your Ultimate Source for Electromechanical Components',
    ogDescription: 'Premium authorized OEM distribution for global defense and aerospace electronics.',
    ogImage: '/icon-logo-transparent.png',
  },
};

export const ContentService = {
  getData(pageKey) {
    const local = localStorage.getItem(`cms_${pageKey}`);
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (pageKey === 'products') {
          if (Array.isArray(parsed)) {
            return parsed;
          }
        } else if (pageKey === 'blogs') {
          // If cached blogs has structured oemBlogs, return it
          if (parsed && Array.isArray(parsed.oemBlogs)) {
            return parsed;
          }
          // If parsed is array of oemBlogs (older schema), wrap into current schema
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].oemId) {
            return {
              heroTitle: 'OEM Technical News, Video Demos & Insights',
              heroSubtitle: 'Direct technical bulletins, video demonstrations, application whitepapers, and product release updates from ICON Electromatic\'s 15 global manufacturing partners.',
              trustBadge1: 'Application Whitepapers & Notes',
              trustBadge2: 'Video Demos & Technical Webinars',
              trustBadge3: 'Direct Manufacturer Bulletins',
              oemBlogs: parsed
            };
          }
        } else if (pageKey === 'partners') {
          if (parsed && Array.isArray(parsed.partners)) {
            return parsed;
          }
          if (Array.isArray(parsed)) {
            return {
              heroTitle: 'Authorized Technology Partners',
              heroLead: 'We represent a diverse portfolio of OEMs across sectors, industries and application.<br />To know more about their products, make an enquiry or request samples just get in touch with us.',
              trustBadge1: '10+ Global Technology Partners',
              trustBadge2: 'Space & Mil-Spec Screening Support',
              partners: parsed
            };
          }
        } else if (pageKey === 'contact') {
          const defaults = INITIAL_CONTENT.contact;
          const mergedCareers = {
            ...defaults.careers,
            ...(parsed.careers || {})
          };
          if (!Array.isArray(mergedCareers.benefits)) mergedCareers.benefits = defaults.careers.benefits;
          if (!Array.isArray(mergedCareers.positions)) mergedCareers.positions = defaults.careers.positions;
          if (!Array.isArray(mergedCareers.experienceLevels)) mergedCareers.experienceLevels = defaults.careers.experienceLevels;
          if (!Array.isArray(mergedCareers.noticeOptions)) mergedCareers.noticeOptions = defaults.careers.noticeOptions;

          return {
            ...defaults,
            ...parsed,
            careers: mergedCareers
          };
        } else {
          return parsed;
        }
      } catch (e) {
        console.error('Failed to parse cached CMS data for', pageKey, e);
      }
    }

    // Seed products & blogs from real data files
    if (pageKey === 'products') {
      const initial = CATALOG.map(oem => ({
        id: oem.id,
        name: oem.name,
        shortName: oem.shortName || oem.name,
        specialty: oem.specialty,
        category: oem.specialty,
        tagline: oem.tagline || '',
        description: oem.description || '',
        website: oem.website || '',
        logoImg: oem.logoImg || '',
        logoSvg: oem.logoSvg || '',
        defaultImage: oem.defaultImage || '',
        accentColor: oem.accentColor || '#2563EB',
        glowColor: oem.glowColor || 'rgba(37,99,235,0.4)',
        visible: oem.visible !== false,
        categories: (oem.categories || []).map(cat => ({
          id: cat.id,
          name: cat.name,
          description: cat.description || '',
          visible: cat.visible !== false,
          products: (cat.products || []).map(prod => ({
            id: prod.id || `${cat.id}-${Math.random().toString(36).substr(2,6)}`,
            name: prod.name,
            category: prod.category || cat.name,
            description: prod.description || '',
            applications: prod.applications || '',
            link: prod.link || '',
            image: prod.image || oem.defaultImage || '',
            visible: prod.visible !== false,
          }))
        }))
      }));
      localStorage.setItem('cms_products', JSON.stringify(initial));
      return initial;
    }

    if (pageKey === 'partners') {
      // Seed all 13 authentic partners
      const initialPartners = [
        { id: 'rogers', name: 'Rogers Corporation', domain: 'High-Frequency Laminates & Prepregs', category: 'materials', accentColor: 'red', logoImg: '/images/oem-logos/Rogers_Logo_no_bg.png', description: 'A global leader in engineered materials, Rogers provides high-frequency laminates and prepregs widely used in radar, aerospace, defence, and high-speed communication systems where signal integrity and reliability are critical.', website: 'https://www.rogerscorp.com' },
        { id: 'mini-circuits', name: 'Mini-Circuits', domain: 'RF & Microwave Components', category: 'components', accentColor: 'red', logoImg: '/images/oem-logos/mini-circuits-seeklogo.png', description: 'Mini-Circuits offers an extensive portfolio of RF and microwave components supporting design, prototyping, and production across defence, SATCOM, test & measurement, and advanced communication platforms.', website: 'https://www.minicircuits.com' },
        { id: 'qorvo', name: 'Qorvo', domain: 'RF, mmWave & Active Antenna Solutions', category: 'semiconductors', accentColor: 'blue', logoImg: '/images/oem-logos/Qorvo_logo_wb.png', description: 'Qorvo develops advanced RF and mmWave technologies including RFICs, Power amplifiers, Switches, Converters, and Active antenna ASICs, enabling high-performance Radar, SATCOM, and next-generation Wireless systems.', website: 'https://www.qorvo.com' },
        { id: 'tecdia', name: 'Tecdia', domain: 'Precision Capacitors & Thin-Film Components', category: 'components', accentColor: 'blue', logoImg: '/images/oem-logos/Tecdia_cropped.png', description: 'Tecdia manufactures single-layer capacitors, thin-film chip resistors, mmWave varactors, and ground blocks for demanding aerospace, defence, medical, and RF applications.', website: 'https://www.tecdia.com' },
        { id: 'tri-teq', name: 'Tri-TeQ', domain: 'Tunable Filters & RF Assemblies', category: 'components', accentColor: 'red', logoImg: '/images/oem-logos/TriTeq_logo_wb.png', description: 'Tri-TeQ is a leader in harmonic switch filter banks, high/low and tunable band-pass filters, and multifunction RF assemblies used in defence, SATCOM, and electronic warfare systems.', website: 'https://www.tri-teq.com' },
        { id: 'rfuw', name: 'RFuW Engineering', domain: 'High-Performance RF Switches & Modules', category: 'components', accentColor: 'red', logoImg: '/images/oem-logos/RFuW_Logo.png', description: 'RFuW Engineering specialises in rugged RF switches, limiters, and integrated microwave modules designed for high-power, wideband, and mission-critical aerospace and defence applications.', website: 'https://www.rfuw.com' },
        { id: 'yttek', name: 'YTTEK', domain: 'Software-Defined Radio (SDR) Platforms', category: 'semiconductors', accentColor: 'blue', logoImg: '/images/oem-logos/YTTEK_Logo_wb.png', description: 'YTTEK builds flexible and reconfigurable software-defined radio platforms supporting research, defence, and advanced wireless communication applications.', website: 'https://www.yttek.com' },
        { id: 'quantic-eulex', name: 'Quantic Eulex / Evans', domain: 'Advanced Ceramic Microwave & Hybrid Capacitors', category: 'components', accentColor: 'blue', logoImg: '/images/oem-logos/Evans_logo.png', description: 'Quantic Eulex & Evans Hybrid Capacitors engineer high-energy, high-frequency ceramic capacitors and hybrid capacitor banks supporting radar, SATCOM, aerospace, and space platforms.', website: 'https://www.quanticdevices.com' },
        { id: 'quantic-ohmega', name: 'Quantic Ohmega-Ticer', domain: 'Embedded Thin-Film Resistive Materials', category: 'materials', accentColor: 'blue', logoImg: '/images/oem-logos/OhmegaTicer_Black.png', description: 'Ohmega-Ticer provides embedded thin-film resistive copper foils that enable compact, high-performance digital and RF PCB designs for defence, aerospace, and advanced electronics.', website: 'https://www.ohmega.com' },
        { id: 'thermosen', name: 'Thermosen Technologies', domain: 'Temperature Sensors for Hi-Rel Applications', category: 'sensors', accentColor: 'blue', logoImg: '/images/oem-logos/Thermosen_logo.png', description: 'Thermosen develops temperature sensing solutions focused on Hi-Rel, aerospace, and defence sectors, ensuring accurate thermal monitoring in extreme environments.', website: 'https://www.thermosen.com' },
        { id: 'fortify', name: 'Fortify', domain: 'Dielectric 3D Printing for RF & Microwave Devices', category: 'materials', accentColor: 'blue', logoImg: '/images/oem-logos/Fortify_Logo_Black_Bg.png', description: 'Fortify enables advanced dielectric 3D printing materials for RF and microwave components, supporting complex geometries, rapid prototyping, and next-generation device development.', website: 'https://www.fortify3d.com' },
        { id: 'powerfactor', name: 'PowerFactor Electronics (PowerRF)', domain: 'Power Electronics & RF Microwave Domains', category: 'components', accentColor: 'blue', logoImg: '/PICTURES/PowerRFlogo Vert Logo1.jpg', description: 'Specialized in R&D, design, testing, consultancy, and product development in Power Electronics and RF Microwave domains under the Make in India initiative.', website: 'https://powerrf.in' },
        { id: 'nee', name: 'NEE International (New Era Electronics)', domain: 'Application PCBs for Microwave & Satellite Communication', category: 'sensors', accentColor: 'red', logoImg: '/images/oem-logos/NEE_Logo_wb.png', description: 'NEE International is a leading fabricator of microwave and satellite communication PCBs, supporting high-frequency and space-grade electronic applications.', website: 'https://neeinternational.com' },
      ];
      const initial = {
        heroTitle: 'Authorized Technology Partners',
        heroLead: 'We represent a diverse portfolio of OEMs across sectors, industries and application.<br />To know more about their products, make an enquiry or request samples just get in touch with us.',
        trustBadge1: '10+ Global Technology Partners',
        trustBadge2: 'Space & Mil-Spec Screening Support',
        partners: initialPartners
      };
      localStorage.setItem('cms_partners', JSON.stringify(initial));
      return initial;
    }

    if (pageKey === 'blogs') {
      const initial = {
        heroTitle: 'OEM Technical News, Video Demos & Insights',
        heroSubtitle: 'Direct technical bulletins, video demonstrations, application whitepapers, and product release updates from ICON Electromatic\'s 15 global manufacturing partners.',
        trustBadge1: 'Application Whitepapers & Notes',
        trustBadge2: 'Video Demos & Technical Webinars',
        trustBadge3: 'Direct Manufacturer Bulletins',
        oemBlogs: (OEM_BLOGS || []).map(b => ({
          oemId: b.oemId,
          officialWebsite: b.officialWebsite || '',
          portalName: b.portalName || '',
          headline: b.headline || '',
          visible: b.visible !== false,
          articles: (b.articles || []).map(a => ({
            id: a.id || `art-${Math.random().toString(36).substr(2, 6)}`,
            title: a.title || '',
            date: a.date || '',
            category: a.category || 'Technical News',
            readTime: a.readTime || '5 min read',
            image: a.image || '',
            summary: a.summary || '',
            content: a.content || '',
            tags: Array.isArray(a.tags) ? a.tags : [],
            visible: a.visible !== false
          })),
          videos: (b.videos || []).map(v => ({
            id: v.id || `vid-${Math.random().toString(36).substr(2, 6)}`,
            title: v.title || '',
            speaker: v.speaker || '',
            duration: v.duration || '',
            date: v.date || '',
            thumbnail: v.thumbnail || '',
            videoUrl: v.videoUrl || '',
            summary: v.summary || '',
            topics: Array.isArray(v.topics) ? v.topics : [],
            visible: v.visible !== false
          })),
          whitepapers: (b.whitepapers || []).map(w => ({
            id: w.id || `wp-${Math.random().toString(36).substr(2, 6)}`,
            title: w.title || '',
            author: w.author || '',
            date: w.date || '',
            pages: w.pages || '',
            frequencyBand: w.frequencyBand || '',
            summary: w.summary || '',
            keyFindings: Array.isArray(w.keyFindings) ? w.keyFindings : [],
            downloadUrl: w.downloadUrl || '',
            visible: w.visible !== false
          })),
          officialLinks: (b.officialLinks || []).map(l => ({
            title: l.title || '',
            url: l.url || '',
            description: l.description || '',
            icon: l.icon || 'fa-globe'
          }))
        }))
      };
      localStorage.setItem('cms_blogs', JSON.stringify(initial));
      return initial;
    }

    const initial = INITIAL_CONTENT[pageKey] || {};
    localStorage.setItem(`cms_${pageKey}`, JSON.stringify(initial));
    return initial;
  },

  saveData(pageKey, data) {
    localStorage.setItem(`cms_${pageKey}`, JSON.stringify(data));
    // Dispatch event to inform live subscribers
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cms-data-updated', { detail: { pageKey, data } }));
    }
  },

  resetData(pageKey) {
    localStorage.removeItem(`cms_${pageKey}`);
    const fresh = this.getData(pageKey);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cms-data-updated', { detail: { pageKey, data: fresh } }));
    }
    return fresh;
  },

  /**
   * Helper to resolve images across content
   */
  resolveImg(url) {
    return ImageStorage.resolveImageUrl(url);
  }
};
