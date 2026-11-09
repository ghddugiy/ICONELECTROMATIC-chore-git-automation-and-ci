/**
 * Contact & Careers Page — ICON ELECTROMATIC
 * Sleek Dark Aesthetic matching the Relay reference.
 * Features dual interactive forms:
 *   1. Technical & RFQ Inquiry Form (with dynamic prefill from product pages)
 *   2. Engineering Careers & Recruiting Form (talent acquisition for RF/Microwave engineers)
 */
import { ContentService } from '../data/ContentService.js';
import { ImageStorage } from '../data/ImageStorage.js';
import { ApiService } from '../data/ApiService.js';
import { getRouteSearchParams } from '../router.js';

export function getInquiryDetails() {
  const p = getRouteSearchParams();
  const productParam = (p.get('product') || p.get('model') || '').trim();
  const oemParam = (p.get('oem') || '').trim();
  const rawSubject = (p.get('subject') || '').toLowerCase().trim();
  const rawTab = (p.get('tab') || p.get('type') || p.get('form') || '').toLowerCase().trim();

  let activeTab = 'inquiry';
  if (rawTab === 'careers' || rawTab === 'recruiting' || rawTab === 'career' || rawTab === 'jobs' || rawTab === 'hiring') {
    activeTab = 'recruiting';
  }

  let subjectVal = 'rfq';
  if (rawSubject.includes('tech')) {
    subjectVal = 'technical';
  } else if (rawSubject.includes('bespoke')) {
    subjectVal = 'bespoke';
  } else if (rawSubject.includes('delivery')) {
    subjectVal = 'delivery';
  } else if (rawSubject.includes('general') || rawSubject.includes('partner')) {
    subjectVal = 'general';
  } else if (rawSubject === 'rfq' || productParam) {
    subjectVal = 'rfq';
  }

  let targetModel = productParam;
  if (productParam && oemParam && !productParam.toLowerCase().includes(oemParam.toLowerCase())) {
    targetModel = `${productParam} (${oemParam})`;
  }

  let prefillMessage = '';
  if (targetModel) {
    if (subjectVal === 'technical') {
      prefillMessage = `Hello, I am requesting technical consultation and engineering specifications for ${targetModel}. Please connect me with an application engineer.`;
    } else {
      prefillMessage = `Hello, I would like to request a formal Request for Quotation (RFQ) for ${targetModel}. Please provide commercial pricing, minimum order quantities (MOQ), and estimated delivery schedules.`;
    }
  }

  return { productParam, oemParam, subjectVal, targetModel, prefillMessage, activeTab };
}

export function renderContactPage() {
  const { subjectVal, targetModel, prefillMessage, activeTab } = getInquiryDetails();
  const isRecruiting = activeTab === 'recruiting';
  const c = ContentService.getData('contact') || {};
  const careers = c.careers || {};

  return `
    <div class="page-content contact-page" style="min-height:100vh;">
      <!-- Unified Page Hero Banner (Blue in light theme) -->
      <section class="page-hero-banner">
        <div class="container">
          <!-- Breadcrumb -->
          <nav class="breadcrumb-dark">
            <a data-route="/">Home</a>
            <span class="sep"><i class="fa-solid fa-chevron-right" style="font-size:0.7rem;"></i></span>
            <span class="crumb-current" style="color:var(--text-white);font-weight:600;" id="contact-breadcrumb-active">
              ${isRecruiting ? (careers.breadcrumbCareers || 'Careers &amp; Recruiting') : 'Contact &amp; RFQ'}
            </span>
          </nav>

          <!-- Unified Page Header -->
          <div class="page-header-unified" style="margin-bottom:0;">
            <h1 class="page-title-unified" id="contact-page-title">
              ${isRecruiting
                ? (careers.careersTitle || c.careersTitle || 'Join India’s Foremost RF &amp; Microwave Engineering Hub')
                : (c.heroTitle || 'Send Us a Message &amp; Request Fast Quotes')}
            </h1>
            <p class="page-lead-unified" id="contact-page-lead">
              ${isRecruiting
                ? (careers.careersLead || c.careersLead || 'Accelerate your career in millimeter-wave technology, defense electronics, and satellite communications. Explore engineering opportunities at ICON Electromatic.')
                : (c.heroLead || 'Whether you require component data sheets, custom waveguide machining, or volume pricing, our application engineering team in Bengaluru is ready to assist.')}
            </p>
          </div>

          <!-- Highlights Strip (Matching Partners, Services, Blogs 1:1) -->
          <div class="services-trust-strip contact-trust-strip" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:16px;margin-bottom:0;padding-bottom:0;border-bottom:none;">
            <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:8px;padding:7px 14px;font-size:0.82rem;color:#FCD34D;display:flex;align-items:center;gap:7px;">
              <i class="fa-solid fa-dolly" style="color:#F59E0B;"></i>
              <span>Global Sourcing &amp; Logistics</span>
            </div>
            <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:8px;padding:7px 14px;font-size:0.82rem;color:#6EE7B7;display:flex;align-items:center;gap:7px;">
              <i class="fa-solid fa-shield-halved" style="color:#10B981;"></i>
              <span>Defense &amp; Commercial Pricing</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Main Content Area -->
      <div class="page-main-body" style="padding-top:var(--space-4);padding-bottom:var(--space-16);">
        <div class="container">
          <!-- Form Switcher Tabs -->
        <div class="contact-tabs-wrapper" style="margin-bottom:var(--space-4);">
          <div class="contact-form-tabs" role="tablist">
            <button
              class="contact-tab-btn ${!isRecruiting ? 'active' : ''}"
              id="tab-btn-inquiry"
              data-tab="inquiry"
              role="tab"
              aria-selected="${!isRecruiting}"
            >
              <i class="fa-solid fa-paper-plane"></i>
              <span>${careers.tabLabelSales || 'Sales &amp; RFQ Inquiry'}</span>
            </button>
            <button
              class="contact-tab-btn ${isRecruiting ? 'active' : ''}"
              id="tab-btn-recruiting"
              data-tab="recruiting"
              role="tab"
              aria-selected="${isRecruiting}"
            >
              <i class="fa-solid fa-user-plus"></i>
              <span>${careers.tabLabelCareers || 'Careers &amp; Recruiting'}</span>
              ${careers.showHiringBadge !== false ? `
                <span class="tab-hiring-pill"><span class="hiring-dot"></span> ${careers.hiringBadgeText || "We're Hiring"}</span>
              ` : ''}
            </button>
          </div>
        </div>

        <div class="contact-relay-grid">
          <!-- Left Column: Information Cards (Context-aware) -->
          <div class="contact-relay-info">

            <!-- 1A. INQUIRY INFO CARDS (Default) -->
            <div id="inquiry-info-column" style="${isRecruiting ? 'display:none;' : 'display:block;'}">
              <div class="contact-relay-card">
                <h3>Office Addresses</h3>
                <p>
                  Direct access to our corporate headquarters in India and international liaison offices in Singapore and the United States.
                </p>

                <div class="contact-meta-list">
                  <!-- India Office -->
                  <div class="contact-meta-row" style="align-items:flex-start;">
                    <div class="contact-meta-icon" style="margin-top:2px;"><i class="fa-solid fa-location-dot"></i></div>
                    <div class="contact-meta-text">
                      <h5>${c.indiaOfficeName || 'Icon Electromatic Pvt. Ltd (India)'}</h5>
                      <p style="margin-bottom:4px;">${(c.indiaAddress || '#303/2, 5th ‘A’ Cross, HRBR Layout, III Block,\nKalyan Nagar, Bengaluru – 560043').replace(/\n/g, '<br/>')}</p>
                      <p style="font-size:0.84rem;margin-bottom:2px;"><i class="fa-solid fa-phone" style="color:var(--logo-red);width:14px;margin-right:4px;"></i> Tel: <a href="tel:${(c.indiaPhone || '+918025429452').replace(/\s/g,'')}">${c.indiaPhone || '+91 80 2542 9452'}</a></p>
                      <p style="font-size:0.84rem;"><i class="fa-solid fa-envelope" style="color:var(--logo-red);width:14px;margin-right:4px;"></i> Email: <a href="mailto:${c.indiaEmail || 'salesiepl@iconelectromatic.com'}" style="color:var(--logo-red-light);">${c.indiaEmail || 'salesiepl@iconelectromatic.com'}</a></p>
                    </div>
                  </div>

                  <!-- Singapore Office -->
                  <div class="contact-meta-row" style="align-items:flex-start;margin-top:var(--space-4);padding-top:var(--space-4);border-top:1px solid var(--border-subtle);">
                    <div class="contact-meta-icon" style="margin-top:2px;"><i class="fa-solid fa-globe"></i></div>
                    <div class="contact-meta-text">
                      <h5>${c.singaporeOfficeName || 'Icon Electromatic Singapore Pte Ltd'}</h5>
                      <p style="margin-bottom:4px;">${(c.singaporeAddress || '204D Compassvale Drive #08-409\nSingapore 544204').replace(/\n/g, '<br/>')}</p>
                      <p style="font-size:0.84rem;"><i class="fa-solid fa-envelope" style="color:var(--logo-red);width:14px;margin-right:4px;"></i> Email: <a href="mailto:${c.singaporeEmail || 'IESing@iconelectromatic.com'}" style="color:var(--logo-red-light);">${c.singaporeEmail || 'IESing@iconelectromatic.com'}</a></p>
                    </div>
                  </div>

                  <!-- USA Office -->
                  <div class="contact-meta-row" style="align-items:flex-start;margin-top:var(--space-4);padding-top:var(--space-4);border-top:1px solid var(--border-subtle);">
                    <div class="contact-meta-icon" style="margin-top:2px;"><i class="fa-solid fa-building"></i></div>
                    <div class="contact-meta-text">
                      <h5>${c.usaOfficeName || 'Icon Electromatic LLC (USA)'}</h5>
                      <p style="margin-bottom:4px;">${(c.usaAddress || '15412 Meadow Vista Dr, Edmond,\nOklahoma 73013, USA').replace(/\n/g, '<br/>')}</p>
                      <p style="font-size:0.84rem;margin-bottom:2px;"><i class="fa-solid fa-phone" style="color:var(--logo-red);width:14px;margin-right:4px;"></i> Tel: <a href="tel:${(c.usaPhone || '+14055935176').replace(/\s/g,'')}">${c.usaPhone || '+1 405 593 5176'}</a></p>
                      <p style="font-size:0.84rem;"><i class="fa-solid fa-envelope" style="color:var(--logo-red);width:14px;margin-right:4px;"></i> Email: <a href="mailto:${c.usaEmail || 'salesiellc@iconelectromatic.com'}" style="color:var(--logo-red-light);">${c.usaEmail || 'salesiellc@iconelectromatic.com'}</a></p>
                    </div>
                  </div>

                  <!-- Hours -->
                  <div class="contact-meta-row" style="align-items:flex-start;margin-top:var(--space-4);padding-top:var(--space-4);border-top:1px solid var(--border-subtle);">
                    <div class="contact-meta-icon" style="margin-top:2px;"><i class="fa-solid fa-clock"></i></div>
                    <div class="contact-meta-text">
                      <h5>Business Operating Hours</h5>
                      <p style="font-size:0.84rem;margin-bottom:2px;">${c.hoursWeekday || 'Monday – Friday: 9:00 AM – 6:00 PM IST'}</p>
                      <p style="font-size:0.84rem;">${c.hoursWeekend || 'Saturday: 9:30 AM – 1:30 PM IST'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Fast Requirement Presets -->
              <div class="contact-relay-card">
                <h4 style="font-size:1.05rem;font-weight:700;color:var(--text-white);margin-bottom:var(--space-2);display:flex;align-items:center;gap:8px;">
                  <i class="fa-solid fa-bolt" style="color:var(--logo-red);"></i> Quick Requirement Presets
                </h4>
                <p style="font-size:0.85rem;color:var(--text-gray-400);margin-bottom:var(--space-3);">Click any preset to prefill your inquiry message:</p>
                <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                  ${(c.presets || [
                    'Inquiring about High Frequency Laminates & Prepregs.',
                    'Inquiring about Embedded Resistive Film.',
                    'Inquiring about 3D Printed Dielectric Parts.',
                    'Inquiring about High Power GaN Device and Beamforming IC.',
                    'Inquiring about High Power Switches and Limiter.',
                    'Inquiring about RF and MW Components.',
                    'Inquiring about Tunable Filters.',
                    'Inquiring about Software Defined Radios.',
                    'Inquiring about high voltage power supplies.',
                    'Inquiring about Temperature Sensors.',
                    'Inquiring about Thin Film Capacitors.',
                    'Inquiring about Ceramic Capacitors.',
                    'Inquiring about PCB Fabrication.',
                    'Inquiring about Perimeter Intrusion Detection System (PIDS).'
                  ]).map(p => `
                    <button class="filter-chip-dark quick-preset" data-preset="${p}">${p.replace(/^Inquiring about /, '').replace(/\.$/, '')}</button>
                  `).join('')}
                </div>
              </div>

            </div>

            <!-- 1B. RECRUITING INFO CARDS (Shown on Careers tab) -->
            <div id="recruiting-info-column" style="${isRecruiting ? 'display:block;' : 'display:none;'}">
              <div class="contact-relay-card">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:var(--space-3);">
                  <div style="width:38px;height:38px;border-radius:10px;background:rgba(37,99,235,0.15);color:var(--logo-blue-light);display:flex;align-items:center;justify-content:center;font-size:1.1rem;">
                    <i class="${careers.introIcon || 'fa-solid fa-users'}"></i>
                  </div>
                  <div>
                    <h3 style="font-size:1.25rem;font-weight:800;color:var(--text-white);margin:0;">${careers.introTitle || 'Why Build Your Career at ICON?'}</h3>
                    <span style="font-size:0.75rem;color:var(--logo-blue-light);font-weight:700;">${careers.introSubtitle || 'RF &amp; MICROWAVE EXCELLENCE'}</span>
                  </div>
                </div>

                ${careers.careersHeroImage ? `
                  <div style="margin-bottom:var(--space-4);border-radius:var(--radius-md);overflow:hidden;border:1px solid var(--border-card);">
                    <img src="${ImageStorage.resolveImageUrl(careers.careersHeroImage)}" alt="Careers Team" style="width:100%;height:auto;display:block;" />
                  </div>
                ` : ''}

                <p style="font-size:0.88rem;color:var(--text-gray-300);line-height:1.6;margin-bottom:var(--space-4);">
                  ${careers.introDescription || 'ICON ELECTROMATIC represents the world’s foremost RF, microwave, and high-frequency component manufacturers in India. Our engineers work at the bleeding edge of radar, space satellites, defense EW systems, and 5G/6G research.'}
                </p>

                <div class="recruiting-perks-list">
                  ${(careers.benefits || []).map(b => `
                    <div class="recruiting-perk-item">
                      <i class="${b.icon || 'fa-solid fa-microchip'}" style="color:${b.iconColor || 'var(--logo-blue-light)'};"></i>
                      <div>
                        <strong>${b.title}${b.title.endsWith(':') ? '' : ':'}</strong>
                        ${b.description}
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>

          </div>

          <!-- Right Column: Interactive Forms -->
          <div class="contact-relay-form">

            <!-- ═══════════════════════════════════════════════════════════ -->
            <!-- FORM 1: SALES & TECHNICAL RFQ INQUIRY                       -->
            <!-- ═══════════════════════════════════════════════════════════ -->
            <div id="inquiry-form-panel" style="${isRecruiting ? 'display:none;' : 'display:block;'}">
              <h3>Send Us a Message</h3>
              <p class="subtitle">Complete the form below. Technical responses and RFQ quotes provided within 24 hours.</p>

              <form id="contact-full-form">
                <div class="relay-form-row">
                  <div class="relay-field">
                    <label for="c-fullname">Full Name *</label>
                    <input type="text" id="c-fullname" name="fullname" placeholder="Dr. Rajesh Kumar" required />
                  </div>
                  <div class="relay-field">
                    <label for="c-company">Company / Organization *</label>
                    <input type="text" id="c-company" name="company" placeholder="ISRO / DRDO / BEL / Private Lab" required />
                  </div>
                </div>

                <div class="relay-form-row">
                  <div class="relay-field">
                    <label for="c-email">Work Email *</label>
                    <input type="email" id="c-email" name="email" placeholder="name@organization.com" required />
                  </div>
                  <div class="relay-field">
                    <label for="c-phone">Phone / Mobile *</label>
                    <input type="tel" id="c-phone" name="phone" placeholder="+91 98765 43210" required />
                  </div>
                </div>

                <div class="relay-form-row">
                  <div class="relay-field">
                    <label for="c-region">Target Office / Region *</label>
                    <select id="c-region" name="region" required>
                      <option value="" disabled selected>Select an Office...</option>
                      <option value="india">India (Bengaluru HQ)</option>
                      <option value="singapore">Singapore Liaison Office</option>
                      <option value="usa">USA Liaison Office</option>
                    </select>
                  </div>
                  <div class="relay-field">
                    <label for="c-subject">Subject / Inquiry Type</label>
                    <select id="c-subject" name="subject">
                      <option value="rfq" ${subjectVal === 'rfq' ? 'selected' : ''}>Formal Request for Quotation (RFQ)</option>
                      <option value="technical" ${subjectVal === 'technical' ? 'selected' : ''}>Technical Support &amp; Specifications</option>
                      <option value="bespoke" ${subjectVal === 'bespoke' ? 'selected' : ''}>Bespoke RF Component Engineering</option>
                      <option value="delivery" ${subjectVal === 'delivery' ? 'selected' : ''}>Lead Time &amp; Logistics Verification</option>
                      <option value="general" ${subjectVal === 'general' ? 'selected' : ''}>General Corporate Inquiry</option>
                    </select>
                  </div>
                </div>

                <div class="relay-field">
                  <label for="c-model">Target Model / Frequency Band</label>
                  <input type="text" id="c-model" name="model" value="${targetModel.replace(/"/g, '&quot;')}" placeholder="e.g. RT/duroid 5880 or ZX60-0433+ (2.4 - 5.8 GHz)" />
                </div>

                <div class="relay-field">
                  <label for="c-message">Technical Requirement / Message *</label>
                  <textarea id="c-message" name="message" placeholder="Please specify your project specifications, required quantities, target frequency band, and timeline..." required>${prefillMessage}</textarea>
                </div>

                <button type="submit" class="btn-relay-blue" id="inquiry-submit-btn" style="width:100%;margin-top:var(--space-2);">
                  <i class="fa-solid fa-paper-plane"></i> Send Message to Engineering Team
                </button>
                <!-- Honeypot: hidden from real users, filled by bots -->
                <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;" />
                <div id="inquiry-form-error" role="alert" style="display:none;margin-top:var(--space-3);padding:10px 14px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.35);border-radius:var(--radius-md);color:#fca5a5;font-size:0.88rem;"></div>
              </form>
            </div>

            <!-- ═══════════════════════════════════════════════════════════ -->
            <!-- FORM 2: ENGINEERING CAREERS & RECRUITING FORM               -->
            <!-- ═══════════════════════════════════════════════════════════ -->
            <div id="recruiting-form-panel" style="${isRecruiting ? 'display:block;' : 'display:none;'}">
              ${careers.showFormBadge !== false ? `
                <div class="form-badge-recruiting">
                  <i class="${careers.formBadgeIcon || 'fa-solid fa-briefcase'}"></i> ${careers.formBadgeText || 'Talent Acquisition · Bengaluru &amp; Pan-India'}
                </div>
              ` : ''}
              <h3>${careers.formTitle || 'Apply for an Engineering Career'}</h3>
              <p class="subtitle">${careers.formSubtitle || "Join ICON Electromatic's elite RF &amp; Microwave applications team. Fill out the application form below and our technical panel will review your profile."}</p>

              <form id="recruiting-full-form">
                <!-- Row 1: Candidate Name & Email -->
                <div class="relay-form-row">
                  <div class="relay-field">
                    <label for="r-fullname">${careers.nameLabel || 'Full Name *'}</label>
                    <input type="text" id="r-fullname" name="fullname" placeholder="${careers.namePlaceholder || 'e.g. Vikram Sharma'}" ${careers.nameRequired !== false ? 'required' : ''} />
                  </div>
                  <div class="relay-field">
                    <label for="r-email">${careers.emailLabel || 'Email Address *'}</label>
                    <input type="email" id="r-email" name="email" placeholder="${careers.emailPlaceholder || 'vikram.sharma@example.com'}" ${careers.emailRequired !== false ? 'required' : ''} />
                  </div>
                </div>

                <!-- Row 2: Position & Phone -->
                <div class="relay-form-row">
                  <div class="relay-field">
                    <label for="r-position">${careers.positionLabel || 'Position *'}</label>
                    <select id="r-position" name="position" ${careers.positionRequired !== false ? 'required' : ''}>
                      <option value="" disabled selected>${careers.positionPlaceholder || 'Select Position...'}</option>
                      ${(careers.positions || []).map(pos => `<option value="${pos}">${pos}</option>`).join('')}
                    </select>
                  </div>
                  <div class="relay-field">
                    <label for="r-phone">${careers.phoneLabel || 'Phone / Mobile Number *'}</label>
                    <input type="tel" id="r-phone" name="phone" placeholder="${careers.phonePlaceholder || '+91 98765 43210'}" ${careers.phoneRequired !== false ? 'required' : ''} />
                  </div>
                </div>

                <!-- Row 3: Current Location & Experience Level -->
                <div class="relay-form-row">
                  <div class="relay-field">
                    <label for="r-city">${careers.cityLabel || 'Current Location / City *'}</label>
                    <input type="text" id="r-city" name="city" placeholder="${careers.cityPlaceholder || 'e.g. Bengaluru, Hyderabad, Pune, Chennai'}" ${careers.cityRequired !== false ? 'required' : ''} />
                  </div>
                  <div class="relay-field">
                    <label for="r-experience">${careers.experienceLabel || 'Total Experience *'}</label>
                    <select id="r-experience" name="experience" ${careers.experienceRequired !== false ? 'required' : ''}>
                      <option value="" disabled selected>${careers.experiencePlaceholder || 'Select experience level...'}</option>
                      ${(careers.experienceLevels || []).map(exp => `<option value="${exp}">${exp}</option>`).join('')}
                    </select>
                  </div>
                </div>

                <!-- Row 4: Current Employer & Notice Period -->
                <div class="relay-form-row">
                  <div class="relay-field">
                    <label for="r-organization">${careers.organizationLabel || 'Current Company or University *'}</label>
                    <input type="text" id="r-organization" name="organization" placeholder="${careers.organizationPlaceholder || 'e.g. BEL, DRDO, Astra Microwave, IISc, IIT'}" ${careers.organizationRequired !== false ? 'required' : ''} />
                  </div>
                  <div class="relay-field">
                    <label for="r-notice">${careers.noticeLabel || 'Notice Period / Earliest Availability *'}</label>
                    <select id="r-notice" name="notice" ${careers.noticeRequired !== false ? 'required' : ''}>
                      ${(careers.noticeOptions || []).map((notc, i) => `<option value="${notc}" ${i === 1 ? 'selected' : ''}>${notc}</option>`).join('')}
                    </select>
                  </div>
                </div>

                <!-- Row 5: Key Technical Skills & EDA Tools -->
                <div class="relay-field">
                  <label for="r-skills">${careers.skillsLabel || 'Key Technical Skills &amp; RF EDA Tools *'}</label>
                  <input type="text" id="r-skills" name="skills" placeholder="${careers.skillsPlaceholder || 'e.g. Keysight ADS, Ansys HFSS, CST Microwave Studio, VNA S-Parameters, GaN Matching, Rogers RT/duroid'}" ${careers.skillsRequired !== false ? 'required' : ''} />
                </div>

                <!-- Row 6: LinkedIn Profile & Resume Upload Dropzone -->
                <div class="relay-form-row">
                  ${careers.showLinkedin !== false ? `
                    <div class="relay-field">
                      <label for="r-linkedin">${careers.linkedinLabel || 'LinkedIn Profile or Online Portfolio'}</label>
                      <input type="url" id="r-linkedin" name="linkedin" placeholder="${careers.linkedinPlaceholder || 'https://linkedin.com/in/username'}" ${careers.linkedinRequired ? 'required' : ''} />
                    </div>
                  ` : ''}
                  <div class="relay-field" style="${careers.showLinkedin === false ? 'grid-column: span 2;' : ''}">
                    <label for="r-resume-file">${careers.resumeLabel || 'Resume / Curriculum Vitae (PDF / DOCX) *'}</label>
                    <div class="resume-upload-box" id="resume-upload-dropzone">
                      <input type="file" id="r-resume-file" name="resume" accept="${careers.resumeAcceptedExtensions || '.pdf,.doc,.docx'}" class="resume-file-input" ${careers.resumeRequired !== false ? 'required' : ''} />
                      <div class="resume-upload-content" id="resume-upload-content">
                        <i class="fa-solid fa-cloud-arrow-up resume-upload-icon"></i>
                        <span class="resume-upload-text" id="resume-upload-text">${careers.resumeHelpText || 'Click or drop resume file (PDF/DOCX, max 10MB)'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Row 7: Candidate Cover Statement -->
                <div class="relay-field">
                  <label for="r-statement">${careers.statementLabel || 'Candidate Statement / Why ICON Electromatic? *'}</label>
                  <textarea id="r-statement" name="statement" placeholder="${careers.statementPlaceholder || 'Briefly highlight your relevant RF, Microwave, or electronics experience, core projects, and why you are keen to join ICON Electromatic...'}" ${careers.statementRequired !== false ? 'required' : ''}></textarea>
                </div>

                <button type="submit" class="btn-relay-blue" id="careers-submit-btn" style="width:100%;margin-top:var(--space-2);background:linear-gradient(135deg, var(--logo-blue), #1E40AF);">
                  <i class="${careers.submitButtonIcon || 'fa-solid fa-briefcase'}"></i> ${careers.submitButtonText || 'Submit Engineering Application'}
                </button>
                <!-- Honeypot: hidden from real users, filled by bots -->
                <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;" />
                <div id="careers-form-error" role="alert" style="display:none;margin-top:var(--space-3);padding:10px 14px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.35);border-radius:var(--radius-md);color:#fca5a5;font-size:0.88rem;"></div>
              </form>
            </div>

          </div>
        </div>
      </div>
    </div>
  </div>
  `;
}

export function initContactPage() {
  const inquiryTabBtn = document.getElementById('tab-btn-inquiry');
  const recruitingTabBtn = document.getElementById('tab-btn-recruiting');
  const inquiryPanel = document.getElementById('inquiry-form-panel');
  const recruitingPanel = document.getElementById('recruiting-form-panel');
  const inquiryInfoCol = document.getElementById('inquiry-info-column');
  const recruitingInfoCol = document.getElementById('recruiting-info-column');
  const breadcrumbActive = document.getElementById('contact-breadcrumb-active');
  const eyebrowText = document.getElementById('contact-eyebrow-text');
  const pageTitle = document.getElementById('contact-page-title');
  const pageLead = document.getElementById('contact-page-lead');

  // Form Elements
  const inquiryForm = document.getElementById('contact-full-form');
  const recruitingForm = document.getElementById('recruiting-full-form');
  const regionSelect = document.getElementById('c-region');
  const messageInput = document.getElementById('c-message');
  const subjectSelect = document.getElementById('c-subject');
  const modelInput = document.getElementById('c-model');
  const resumeInput = document.getElementById('r-resume-file');
  const resumeUploadText = document.getElementById('resume-upload-text');

  // Switch between Inquiry and Recruiting Tabs
  function switchTab(tab) {
    const isRecruiting = tab === 'recruiting';
    const c = ContentService.getData('contact') || {};
    const careers = c.careers || {};

    if (inquiryTabBtn && recruitingTabBtn) {
      inquiryTabBtn.classList.toggle('active', !isRecruiting);
      inquiryTabBtn.setAttribute('aria-selected', (!isRecruiting).toString());
      recruitingTabBtn.classList.toggle('active', isRecruiting);
      recruitingTabBtn.setAttribute('aria-selected', isRecruiting.toString());
    }

    if (inquiryPanel && recruitingPanel) {
      inquiryPanel.style.display = isRecruiting ? 'none' : 'block';
      recruitingPanel.style.display = isRecruiting ? 'block' : 'none';
    }

    if (inquiryInfoCol && recruitingInfoCol) {
      inquiryInfoCol.style.display = isRecruiting ? 'none' : 'block';
      recruitingInfoCol.style.display = isRecruiting ? 'block' : 'none';
    }

    if (breadcrumbActive) {
      breadcrumbActive.textContent = isRecruiting ? (careers.breadcrumbCareers || 'Careers & Recruiting') : 'Contact & RFQ';
    }

    if (eyebrowText) {
      eyebrowText.textContent = isRecruiting ? (careers.eyebrowCareers || 'ICON TALENT ACQUISITION') : 'CONNECT WITH ENGINEERING';
    }

    if (pageTitle) {
      pageTitle.innerHTML = isRecruiting
        ? (careers.careersTitle || c.careersTitle || 'Join India’s Foremost RF &amp; Microwave Engineering Hub')
        : (c.heroTitle || 'Send Us a Message &amp; Request Fast Quotes');
    }

    if (pageLead) {
      pageLead.textContent = isRecruiting
        ? (careers.careersLead || c.careersLead || 'Accelerate your career in millimeter-wave technology, defense electronics, and satellite communications. Explore engineering opportunities at ICON Electromatic.')
        : (c.heroLead || 'Whether you require component data sheets, custom waveguide machining, or volume pricing, our application engineering team in Bengaluru is ready to assist.');
    }
  }

  // Bind tab buttons
  if (inquiryTabBtn) {
    inquiryTabBtn.addEventListener('click', () => switchTab('inquiry'));
  }
  if (recruitingTabBtn) {
    recruitingTabBtn.addEventListener('click', () => switchTab('recruiting'));
  }

  // Resume File Upload feedback & validation
  if (resumeInput && resumeUploadText) {
    resumeInput.addEventListener('change', (e) => {
      const c = ContentService.getData('contact') || {};
      const careers = c.careers || {};
      const file = e.target.files && e.target.files[0];
      const maxMb = Number(careers.resumeMaxSizeMb) || 10;
      const rawExts = careers.resumeAcceptedExtensions || '.pdf,.doc,.docx';
      const acceptedExts = rawExts.toLowerCase().split(',').map(s => s.trim().replace(/^\./, ''));

      if (file) {
        const fileExt = file.name.split('.').pop().toLowerCase();
        if (acceptedExts.length > 0 && !acceptedExts.includes(fileExt)) {
          const tpl = careers.resumeFormatErrorMessage || 'Invalid file format. Please upload an accepted file type: {types}';
          alert(tpl.replace('{types}', rawExts));
          resumeInput.value = '';
          resumeUploadText.textContent = careers.resumeHelpText || 'Click or drop resume file (PDF/DOCX, max 10MB)';
          return;
        }

        const sizeMb = file.size / (1024 * 1024);
        if (sizeMb > maxMb) {
          const tpl = careers.resumeSizeErrorMessage || 'File size ({size} MB) exceeds the maximum allowed limit of {max} MB.';
          alert(tpl.replace('{size}', sizeMb.toFixed(1)).replace('{max}', maxMb));
          resumeInput.value = '';
          resumeUploadText.textContent = careers.resumeHelpText || 'Click or drop resume file (PDF/DOCX, max 10MB)';
          return;
        }

        resumeUploadText.innerHTML = `<strong style="color:var(--success);"><i class="fa-solid fa-file-check"></i> ${file.name}</strong> (${sizeMb.toFixed(1)} MB attached)`;
      } else {
        resumeUploadText.textContent = careers.resumeHelpText || 'Click or drop resume file (PDF/DOCX, max 10MB)';
      }
    });
  }

  // Synchronize values from hash/search query params
  function syncFormFields() {
    const { subjectVal, targetModel, prefillMessage, activeTab } = getInquiryDetails();

    switchTab(activeTab);

    if (modelInput && targetModel) {
      modelInput.value = targetModel;
    }
    if (subjectSelect && subjectVal) {
      subjectSelect.value = subjectVal;
    }
    if (messageInput && prefillMessage && (!messageInput.value.trim() || messageInput.value.includes('Request for Quotation') || messageInput.value.includes('technical consultation'))) {
      messageInput.value = prefillMessage;
    }
  }

  syncFormFields();

  // Listen to hash changes while on contact page
  const handleHashSync = () => {
    if (window.location.hash.includes('/contact')) {
      syncFormFields();
    }
  };
  window.addEventListener('hashchange', handleHashSync);

  // Quick requirement presets for RFQ form
  document.querySelectorAll('.quick-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const q = btn.getAttribute('data-preset');
      if (messageInput) {
        messageInput.value = q;
        messageInput.focus();
      }
    });
  });

  // Handle Inquiry Form Submission
  if (inquiryForm) {
    inquiryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('inquiry-submit-btn');
      const errorDiv = document.getElementById('inquiry-form-error');

      if (errorDiv) errorDiv.style.display = 'none';

      const regionVal = (regionSelect?.value || document.getElementById('c-region')?.value || '').trim().toLowerCase();
      if (!regionVal || !['india', 'singapore', 'usa'].includes(regionVal)) {
        if (errorDiv) {
          errorDiv.textContent = 'Please select a regional office (India, Singapore, or USA).';
          errorDiv.style.display = 'block';
        }
        (regionSelect || document.getElementById('c-region'))?.focus();
        return;
      }

      // Loading state
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';
      }

      const body = {
        fullname: (document.getElementById('c-fullname')?.value || '').trim(),
        company: (document.getElementById('c-company')?.value || '').trim(),
        email: (document.getElementById('c-email')?.value || '').trim(),
        phone: (document.getElementById('c-phone')?.value || '').trim(),
        region: regionVal,
        subject: (document.getElementById('c-subject')?.value || 'rfq').trim(),
        model: (document.getElementById('c-model')?.value || '').trim(),
        message: (document.getElementById('c-message')?.value || '').trim(),
        // honeypot field — value will be empty for real users
        website: (inquiryForm.querySelector('input[name="website"]')?.value || '').trim(),
      };

      try {
        const data = await ApiService.post('/enquiries/contact', body);

        if (data.success) {
          // Show existing success panel
          const name = body.fullname || 'Customer';
          if (inquiryPanel) {
            inquiryPanel.innerHTML = `
              <div style="text-align:center;padding:var(--space-10) var(--space-4);">
                <div style="width:68px;height:68px;border-radius:50%;background:rgba(37,99,235,0.15);color:var(--logo-blue-light);display:flex;align-items:center;justify-content:center;font-size:2rem;margin:0 auto var(--space-4);">
                  <i class="fa-solid fa-check"></i>
                </div>
                <h3 style="font-size:1.5rem;font-weight:800;color:var(--text-white);margin-bottom:8px;">Thank You, ${name}!</h3>
                <p style="color:var(--text-gray-400);font-size:1rem;max-width:480px;margin:0 auto var(--space-6);line-height:1.6;">
                  Your enquiry has been received by ICON Electromatic Technical Dispatch. We will respond within 24 hours.
                </p>
                <div>
                  <button class="btn-relay-secondary" id="reset-inquiry-btn" style="padding:8px 18px;font-size:0.85rem;">
                    <i class="fa-solid fa-rotate-left"></i> Send Another Inquiry
                  </button>
                </div>
              </div>
            `;
            document.getElementById('reset-inquiry-btn')?.addEventListener('click', () => window.location.reload());
          }
        } else {
          // Error state — show message, re-enable button
          const msg = data.message || 'Could not send your enquiry. Please try again or email us directly.';
          if (errorDiv) {
            errorDiv.textContent = msg;
            errorDiv.style.display = 'block';
          }
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send Message to Engineering Team';
          }
        }
      } catch (_err) {
        const fallbackMsg = 'Could not reach the server. Please check your connection or email us directly.';
        if (errorDiv) {
          errorDiv.textContent = fallbackMsg;
          errorDiv.style.display = 'block';
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send Message to Engineering Team';
        }
      }
    });
  }

  // Handle Recruiting Form Submission
  if (recruitingForm) {
    recruitingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const c = ContentService.getData('contact') || {};
      const careers = c.careers || {};
      const submitBtn = document.getElementById('careers-submit-btn');
      const errorDiv = document.getElementById('careers-form-error');

      // Client-side resume check (mirrors server requirement)
      if (careers.resumeRequired !== false && (!resumeInput || !resumeInput.files || resumeInput.files.length === 0)) {
        alert(careers.validationErrorMessage || 'Please complete all required fields and attach your resume before submitting.');
        if (resumeInput) resumeInput.focus();
        return;
      }

      // Loading state
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting Application...';
      }
      if (errorDiv) errorDiv.style.display = 'none';

      try {
        const formData = new FormData();
        const fields = [
          ['fullname', 'r-fullname'], ['email', 'r-email'], ['position', 'r-position'],
          ['phone', 'r-phone'], ['city', 'r-city'], ['experience', 'r-experience'],
          ['organization', 'r-organization'], ['notice', 'r-notice'],
          ['skills', 'r-skills'], ['linkedin', 'r-linkedin'], ['statement', 'r-statement'],
        ];
        fields.forEach(([name, id]) => {
          const el = document.getElementById(id);
          if (el) formData.append(name, el.value || '');
        });
        // Honeypot
        const honeypot = recruitingForm.querySelector('input[name="website"]')?.value || '';
        formData.append('website', honeypot);

        if (resumeInput && resumeInput.files && resumeInput.files[0]) {
          formData.append('resume', resumeInput.files[0]);
        }

        const data = await ApiService.post('/enquiries/careers', formData);

        if (data.success) {
          const candName = document.getElementById('r-fullname')?.value || 'Candidate';
          const position = document.getElementById('r-position')?.value || 'Engineering Role';
          const candRefId = data.id || ('ICON-CAREER-' + Math.floor(100000 + Math.random() * 900000));
          const careersEmail = careers.careersEmail || 'careers@iconelectromatic.com';

          if (recruitingPanel) {
            recruitingPanel.innerHTML = `
              <div style="text-align:center;padding:var(--space-10) var(--space-4);">
                <div style="width:72px;height:72px;border-radius:50%;background:rgba(16,185,129,0.15);color:#34D399;display:flex;align-items:center;justify-content:center;font-size:2.2rem;margin:0 auto var(--space-4);border:1px solid rgba(16,185,129,0.3);">
                  <i class="fa-solid fa-briefcase"></i>
                </div>
                <h3 style="font-size:1.6rem;font-weight:800;color:var(--text-white);margin-bottom:8px;">${careers.successTitle || 'Application Received!'}</h3>
                <p style="color:var(--text-white);font-weight:600;font-size:1.05rem;margin-bottom:6px;">Thank you, ${candName}.</p>
                <p style="color:var(--text-gray-300);font-size:0.95rem;max-width:500px;margin:0 auto var(--space-4);line-height:1.6;">
                  Your application for ${position} has been received. Our team will be in touch within 3–5 business days.
                </p>
                <div style="display:inline-block;padding:12px 24px;background:rgba(255,255,255,0.05);border:1px solid var(--border-card);border-radius:var(--radius-md);font-family:var(--font-display);font-size:0.95rem;color:var(--text-white);margin-bottom:var(--space-6);">
                  Candidate Application ID: <span style="color:#34D399;font-weight:800;letter-spacing:1px;">${candRefId}</span>
                </div>
                <div style="max-width:440px;margin:0 auto var(--space-6);padding:14px;background:rgba(37,99,235,0.08);border:1px solid rgba(37,99,235,0.25);border-radius:var(--radius-md);font-size:0.85rem;color:var(--text-gray-300);line-height:1.5;text-align:left;">
                  <i class="fa-solid fa-circle-info" style="color:var(--logo-blue-light);margin-right:6px;"></i>
                  <strong>Next Steps:</strong> Qualified candidates will be contacted for a technical discussion. Quote your Application ID for status updates.
                  <div style="margin-top:6px;font-size:0.8rem;color:var(--text-gray-400);">Contact Talent Team: <a href="mailto:${careersEmail}" style="color:var(--logo-blue-light);">${careersEmail}</a></div>
                </div>
                <div>
                  <button class="btn-relay-secondary" id="reset-recruiting-btn" style="padding:9px 20px;font-size:0.85rem;">
                    <i class="fa-solid fa-rotate-left"></i> ${careers.resetButtonText || 'Submit Another Application'}
                  </button>
                </div>
              </div>
            `;
            document.getElementById('reset-recruiting-btn')?.addEventListener('click', () => window.location.reload());
          }
        } else {
          const msg = data.message || 'Could not submit your application. Please try again or email us directly.';
          if (errorDiv) {
            errorDiv.textContent = msg;
            errorDiv.style.display = 'block';
          }
          if (submitBtn) {
            submitBtn.disabled = false;
            const icon = careers.submitButtonIcon || 'fa-solid fa-briefcase';
            submitBtn.innerHTML = `<i class="${icon}"></i> ${careers.submitButtonText || 'Submit Engineering Application'}`;
          }
        }
      } catch (_err) {
        if (errorDiv) {
          errorDiv.textContent = 'Could not reach the server. Please check your connection or email your CV directly.';
          errorDiv.style.display = 'block';
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          const icon = careers.submitButtonIcon || 'fa-solid fa-briefcase';
          submitBtn.innerHTML = `<i class="${icon}"></i> ${careers.submitButtonText || 'Submit Engineering Application'}`;
        }
      }
    });
  }
}
