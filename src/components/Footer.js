/**
 * Footer Component — ICON ELECTROMATIC
 * Fully data-driven via ContentService
 */
import { ContentService } from '../data/ContentService.js';

export function renderFooter() {
  const d = ContentService.getData('footer');
  const isLight = typeof window !== 'undefined' && (
    new URLSearchParams(window.location.search).get('theme') === 'light' ||
    localStorage.getItem('icon-theme') === 'light' ||
    document.documentElement.getAttribute('data-theme') === 'light'
  );
  const logoSrc = ContentService.resolveImg(
    isLight ? '/lighter-version-logo.png' : '/darker-version-logo.png'
  );
  const year = new Date().getFullYear();

  return `
    <footer class="site-footer-white">
      <div class="footer-main">
        <div class="container footer-main-inner">
          
          <!-- Left: Logo, Tagline, Socials -->
          <div class="footer-brand-col">
            <a href="/" data-route="/" class="footer-logo-link">
              <img src="${logoSrc}" alt="ICON ELECTROMATIC" />
            </a>
            <p class="footer-tagline">
              ${d.tagline || 'Delivering advanced RF, Microwave, and High-Rel electronic components from DC to 86 GHz for aerospace, defense, SATCOM, and telecommunications.'}
            </p>
            <div class="footer-social-icons">
              <a href="${d.linkedinUrl || '#'}" target="_blank" aria-label="LinkedIn"><i class="fa-brands fa-linkedin-in"></i></a>
              <a href="${d.youtubeUrl || '#'}" target="_blank" aria-label="YouTube"><i class="fa-brands fa-youtube"></i></a>
              <a href="mailto:${d.indiaEmail || 'salesiepl@iconelectromatic.com'}" aria-label="Email"><i class="fa-solid fa-envelope"></i></a>
              <a href="tel:${(d.indiaPhone || '+918025429452').replace(/\s/g,'')}" aria-label="Phone"><i class="fa-solid fa-phone"></i></a>
            </div>
          </div>

          <!-- Center: Office Locations -->
          <div class="footer-offices-col">
            <h4 class="footer-heading">Office Addresses</h4>
            
            <div class="footer-office-item">
              <div class="office-icon"><i class="fa-solid fa-location-dot"></i></div>
              <div class="office-details">
                <h5>${d.indiaOfficeName || 'Icon Electromatic Pvt. Ltd. (India)'}</h5>
                <p>${d.indiaAddress || '#303/2, 5th A Cross, HRBR Layout, Kalyan Nagar, Bengaluru – 560043'}</p>
                <p>Tel: <a href="tel:${(d.indiaPhone || '+918025429452').replace(/\s/g,'')}">${d.indiaPhone || '+91 80 2542 9452'}</a></p>
                <p>Email: <a href="mailto:${d.indiaEmail || 'salesiepl@iconelectromatic.com'}">${d.indiaEmail || 'salesiepl@iconelectromatic.com'}</a></p>
              </div>
            </div>

            <div class="footer-office-item">
              <div class="office-icon"><i class="fa-solid fa-location-dot"></i></div>
              <div class="office-details">
                <h5>${d.singaporeOfficeName || 'Icon Electromatic Singapore Pte Ltd'}</h5>
                <p>${d.singaporeAddress || '204D Compassvale Drive #08-409, Singapore 544204'}</p>
                <p>Email: <a href="mailto:${d.singaporeEmail || 'IESing@iconelectromatic.com'}">${d.singaporeEmail || 'IESing@iconelectromatic.com'}</a></p>
              </div>
            </div>

            <div class="footer-office-item">
              <div class="office-icon"><i class="fa-solid fa-location-dot"></i></div>
              <div class="office-details">
                <h5>${d.usaOfficeName || 'Icon Electromatic LLC (USA)'}</h5>
                <p>${d.usaAddress || '15412 Meadow Vista Dr, Edmond, Oklahoma 73013, USA'}</p>
                <p>Tel: <a href="tel:${(d.usaPhone || '+14055935176').replace(/\s/g,'')}">${d.usaPhone || '+1 405 593 5176'}</a></p>
                <p>Email: <a href="mailto:${d.usaEmail || 'salesiellc@iconelectromatic.com'}">${d.usaEmail || 'salesiellc@iconelectromatic.com'}</a></p>
              </div>
            </div>
          </div>

          <!-- Right: Quick Links -->
          <div class="footer-links-col">
            <h4 class="footer-heading">Quick Links</h4>
            <ul>
              <li><a href="/" data-route="/"><i class="fa-solid fa-chevron-right"></i> Home</a></li>
              <li><a href="/about" data-route="/about"><i class="fa-solid fa-chevron-right"></i> About Us</a></li>
              <li><a href="/products" data-route="/products"><i class="fa-solid fa-chevron-right"></i> Products</a></li>
              <li><a href="/services" data-route="/services"><i class="fa-solid fa-chevron-right"></i> Services</a></li>
              <li><a href="/partners" data-route="/partners"><i class="fa-solid fa-chevron-right"></i> Partners</a></li>
              <li><a href="/blogs" data-route="/blogs"><i class="fa-solid fa-chevron-right"></i> Blogs</a></li>
              <li><a href="/contact" data-route="/contact"><i class="fa-solid fa-chevron-right"></i> Contact Us</a></li>
            </ul>
          </div>

        </div>
      </div>

      <div class="footer-copyright-bar">
        <div class="container footer-copyright-inner" style="justify-content:center;text-align:center;">
          <p>${d.copyrightText || '&copy; ' + year + ' ICON ELECTROMATIC PRIVATE LIMITED. All rights reserved.'}</p>
        </div>
      </div>
    </footer>
  `;
}
