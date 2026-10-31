/**
 * Custom Interactive Cursor Component — ICON ELECTROMATIC
 * Framer / Relay-style floating circular cursor with smooth trailing & interactive scaling
 */

export function initCustomCursor() {
  // Disable on touch devices or small screens
  if (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768) {
    return;
  }

  // Remove existing cursor if already mounted
  document.getElementById('custom-cursor-ring')?.remove();
  document.getElementById('custom-cursor-dot')?.remove();

  const ring = document.createElement('div');
  ring.id = 'custom-cursor-ring';
  ring.className = 'custom-cursor-ring';

  const dot = document.createElement('div');
  dot.id = 'custom-cursor-dot';
  dot.className = 'custom-cursor-dot';

  document.body.appendChild(ring);
  document.body.appendChild(dot);

  let mouseX = -100;
  let mouseY = -100;
  let ringX = -100;
  let ringY = -100;
  let isHovered = false;
  let isHoveredRed = false;
  let isVisible = false;
  let animFrameId = null;

  // Track exact mouse position
  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    if (!isVisible) {
      isVisible = true;
      ring.style.opacity = '1';
      dot.style.opacity = '1';
      ringX = mouseX;
      ringY = mouseY;
    }
  });

  // Smooth animation loop using lerp (linear interpolation)
  function renderCursor() {
    // Lerp ring towards mouse with smooth damping factor
    const ease = 0.22;
    ringX += (mouseX - ringX) * ease;
    ringY += (mouseY - ringY) * ease;

    // Center ring based on current size
    const ringRadius = isHovered ? 23 : 14;
    ring.style.transform = `translate3d(${ringX - ringRadius}px, ${ringY - ringRadius}px, 0)`;

    // Center dot directly on mouse
    dot.style.transform = `translate3d(${mouseX - 2.5}px, ${mouseY - 2.5}px, 0)`;

    animFrameId = requestAnimationFrame(renderCursor);
  }

  animFrameId = requestAnimationFrame(renderCursor);

  // Mouse leave / enter window
  document.addEventListener('mouseleave', () => {
    isVisible = false;
    ring.style.opacity = '0';
    dot.style.opacity = '0';
  });

  document.addEventListener('mouseenter', () => {
    isVisible = true;
    ring.style.opacity = '1';
    dot.style.opacity = '1';
  });

  // Click squeeze effect
  window.addEventListener('mousedown', () => {
    ring.classList.add('cursor-active');
  });

  window.addEventListener('mouseup', () => {
    ring.classList.remove('cursor-active');
  });

  // Event delegation for interactive hover states across all cards, buttons, links
  document.addEventListener('mouseover', (e) => {
    const target = e.target;
    const interactive = target.closest('a, button, [data-route], .product-card-relay, .capability-card-dark, .blog-card-relay, .testimonial-card-relay, .filter-chip-dark, input, select, textarea, .contact-relay-card');

    if (interactive) {
      isHovered = true;
      ring.classList.add('cursor-hover');

      // Check if hovering over red-accented elements
      const isRed = interactive.classList.contains('btn-relay-red') || 
                    interactive.closest('.relay-product-badge') || 
                    interactive.getAttribute('data-preset') ||
                    interactive.classList.contains('accent-red');

      if (isRed) {
        isHoveredRed = true;
        ring.classList.add('cursor-hover-red');
      } else {
        isHoveredRed = false;
        ring.classList.remove('cursor-hover-red');
      }
    }
  });

  document.addEventListener('mouseout', (e) => {
    const target = e.target;
    const interactive = target.closest('a, button, [data-route], .product-card-relay, .capability-card-dark, .blog-card-relay, .testimonial-card-relay, .filter-chip-dark, input, select, textarea, .contact-relay-card');

    if (interactive) {
      isHovered = false;
      isHoveredRed = false;
      ring.classList.remove('cursor-hover');
      ring.classList.remove('cursor-hover-red');
    }
  });
}
