// LG Roofing Materials — shared site behavior

// Toast notification — used by this file's contact-form handler and by
// estimate-ui.js's estimate-form handler, for a confirmation that's actually
// hard to miss (the old subtle inline text under the button wasn't cutting
// it for customers submitting real orders).
function showToast(message, { title = '', type = 'success', duration = 8000 } = {}) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    container.setAttribute('role', 'status');
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === 'error' ? '!' : '&check;'}</span>
    <div class="toast-body">
      ${title ? `<p class="toast-title"></p>` : ''}
      <p class="toast-message"></p>
    </div>
    <button type="button" class="toast-close" aria-label="Dismiss">&times;</button>
  `;
  if (title) toast.querySelector('.toast-title').textContent = title;
  toast.querySelector('.toast-message').textContent = message;
  container.appendChild(toast);

  const remove = () => {
    toast.classList.add('is-leaving');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };
  const timer = setTimeout(remove, duration);
  toast.querySelector('.toast-close').addEventListener('click', () => {
    clearTimeout(timer);
    remove();
  });
}
window.showToast = showToast;

document.addEventListener('DOMContentLoaded', () => {
  // Bot mitigation for the contact form below: a real visitor takes well
  // over this long to read the page and fill the form out.
  const pageLoadedAt = Date.now();
  const MIN_HUMAN_MS = 3000;

  // Header scroll shadow + hide-on-scroll-down / reveal-on-scroll-up (mobile)
  const header = document.getElementById('site-header');
  if (header) {
    let lastScrollY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      header.classList.toggle('scrolled', y > 8);

      const mobileMenuEl = document.getElementById('mobile-menu');
      const menuOpen = mobileMenuEl && mobileMenuEl.classList.contains('is-open');
      if (!menuOpen) {
        if (y > lastScrollY && y > header.offsetHeight) {
          header.classList.add('header-hidden');
        } else if (y < lastScrollY) {
          header.classList.remove('header-hidden');
        }
      }
      lastScrollY = y;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Mobile menu toggle
  const menuToggle = document.getElementById('menu-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener('click', () => {
      const isOpen = mobileMenu.classList.contains('is-open');
      mobileMenu.classList.toggle('is-open', !isOpen);
      mobileMenu.style.maxHeight = !isOpen ? mobileMenu.scrollHeight + 'px' : '0px';
      menuToggle.setAttribute('aria-expanded', String(!isOpen));
    });
  }

  // Reveal on scroll
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }

  // Reviews: hide the hand-picked fallback once the live Elfsight widget actually renders content
  const elfsightEl = document.querySelector('[class*="elfsight-app-"]');
  const reviewsFallback = document.getElementById('reviews-fallback');
  if (elfsightEl && reviewsFallback && !elfsightEl.className.includes('elfsight-app-YOUR-WIDGET-ID')) {
    const hideFallbackIfLoaded = () => {
      if (elfsightEl.childElementCount > 0) {
        reviewsFallback.style.display = 'none';
        elfsightObserver.disconnect();
      }
    };
    const elfsightObserver = new MutationObserver(hideFallbackIfLoaded);
    elfsightObserver.observe(elfsightEl, { childList: true });
    hideFallbackIfLoaded();
  }

  // Marquee: JS rAF scroller — pixel-perfect seamless loop, no CSS animation gap
  const marqueeTrack = document.querySelector('.marquee__track');
  if (marqueeTrack) {
    const marqueeEl = marqueeTrack.closest('.marquee');
    let pos = 0;
    let oneSetWidth = 0;
    let paused = false;
    let lastTs = null;
    const SPEED = 52; // px per second

    const measureSet = () => {
      const logos = marqueeTrack.querySelectorAll('.marquee__logo');
      const half = Math.floor(logos.length / 2);
      let w = 0;
      for (let i = 0; i < half; i++) {
        const el = logos[i];
        w += el.getBoundingClientRect().width +
             (parseFloat(getComputedStyle(el).marginRight) || 0);
      }
      oneSetWidth = w;
    };

    const tick = (ts) => {
      if (lastTs !== null && !paused && oneSetWidth > 0) {
        pos += SPEED * ((ts - lastTs) / 1000);
        if (pos >= oneSetWidth) pos -= oneSetWidth;
        marqueeTrack.style.transform = `translateX(-${pos}px)`;
      }
      lastTs = ts;
      requestAnimationFrame(tick);
    };

    if (marqueeEl) {
      marqueeEl.addEventListener('mouseenter', () => { paused = true; });
      marqueeEl.addEventListener('mouseleave', () => { paused = false; });
    }

    const imgs = Array.from(marqueeTrack.querySelectorAll('img'));
    Promise.all(imgs.map(img =>
      img.complete ? Promise.resolve() :
      new Promise(r => { img.onload = r; img.onerror = r; })
    )).then(() => {
      measureSet();
      requestAnimationFrame(tick);
    });

    window.addEventListener('resize', measureSet);
  }

  // Footer year
  const yearEl = document.getElementById('current-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Contact form -> Formspree
  const form = document.getElementById('contact-form');
  if (form) {
    const status = document.getElementById('form-status');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');

      // Bot gate: honeypot filled in, or submitted implausibly fast. Bots
      // get the same success response real users see — no signal is given
      // back that would teach a bot to adapt.
      const gotcha = form.querySelector('[name="_gotcha"]').value;
      const elapsed = Date.now() - pageLoadedAt;
      if (gotcha || elapsed < MIN_HUMAN_MS) {
        form.reset();
        status.textContent = "Thanks — your message has been sent. We'll get back to you shortly.";
        status.className = 'mt-4 text-sm font-medium text-[#DBA44C]';
        showToast("We'll get back to you shortly.", { title: 'Message Sent', type: 'success' });
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';
      try {
        const res = await fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          headers: { Accept: 'application/json' },
        });
        if (res.ok) {
          form.reset();
          status.textContent = "Thanks — your message has been sent. We'll get back to you shortly.";
          status.className = 'mt-4 text-sm font-medium text-[#DBA44C]';
          showToast("We'll get back to you shortly.", { title: 'Message Sent', type: 'success' });
        } else {
          throw new Error('Form submission failed');
        }
      } catch (err) {
        status.textContent = "Something went wrong sending your message. Please call us at (832) 430-0148 instead.";
        status.className = 'mt-4 text-sm font-medium text-red-400';
        showToast('Please call us at (832) 430-0148 instead.', { title: 'Something Went Wrong', type: 'error', duration: 10000 });
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Message';
      }
    });
  }
});
