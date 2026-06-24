// ====================
// Section Snap Scrolling
// Intercepts wheel/touch events while the user is in the hero or about section
// and smoothly snaps to the next (or previous) section.
// Snap duration scales inversely with scroll velocity — a quick flick snaps
// faster than a single slow tick.
// ====================

(function () {
    // Expose footer height as a CSS variable so the mobile portfolio section
    // can subtract it from the viewport height calculation.
    const footerEl = document.querySelector('.footer');
    function syncFooterHeight() {
        if (!footerEl) return;
        document.documentElement.style.setProperty('--footer-total-h', footerEl.offsetHeight + 'px');
    }
    syncFooterHeight();
    window.addEventListener('resize', syncFooterHeight);

    const snapIds = ['home', 'about', 'portfolio'];
    const snapEls = snapIds.map(id => document.getElementById(id)).filter(Boolean);
    if (snapEls.length < 2) return;

    let isSnapping = false;

    const getHeaderH = () =>
        parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 72;

    const getCurrentIdx = () => {
        const y = window.scrollY;
        for (let i = snapEls.length - 1; i >= 0; i--) {
            if (y >= snapEls[i].offsetTop - getHeaderH() - 80) return i;
        }
        return 0;
    };

    // hero (0) + about (1): locked in both directions.
    // portfolio (2): locked for upward scroll only (one flick returns to about).
    const isLocked = (idx, dir) =>
        idx === 0 || idx === 1 || (idx === 2 && dir === -1);

    function easeOutExpo(t) {
        return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    }

    function snapToY(targetY, durationMs) {
        const startY = window.scrollY;
        const dist   = targetY - startY;
        if (Math.abs(dist) < 5) { isSnapping = false; return; }

        const t0 = performance.now();
        const step = (now) => {
            const t = Math.min((now - t0) / durationMs, 1);
            window.scrollTo(0, startY + dist * easeOutExpo(t));
            if (t < 1) requestAnimationFrame(step);
            else       isSnapping = false;
        };
        requestAnimationFrame(step);
    }

    function triggerSnap(direction, rawDelta) {
        const idx = getCurrentIdx();
        if (!isLocked(idx, direction)) return;
        const nextIdx = idx + direction;
        if (nextIdx < 0 || nextIdx >= snapEls.length) return;

        const speedFactor = Math.min(Math.abs(rawDelta) / 30, 5);
        const duration    = Math.max(320, 820 - speedFactor * 100);

        isSnapping = true;

        const nextEl = snapEls[nextIdx];
        // Snapping down to portfolio: land at page bottom so the footer is visible.
        const maxScrollY = document.documentElement.scrollHeight - window.innerHeight;
        const targetY = (nextEl.id === 'portfolio' && direction === 1)
            ? maxScrollY
            : Math.max(0, nextEl.offsetTop - getHeaderH());

        snapToY(targetY, duration);
    }

    // Check if an event target is inside the scrollable portfolio tab list.
    // If so, let it scroll natively rather than triggering a section snap.
    const isInsideScrollableTabs = (el) => {
        const tabsContainer = document.querySelector('.portfolio-tabs');
        if (!tabsContainer || window.innerWidth > 768) return false;
        return tabsContainer.contains(el) && tabsContainer.scrollHeight > tabsContainer.clientHeight;
    };

    let touchInsideTabs = false;

    window.addEventListener('wheel', (e) => {
        if (isInsideScrollableTabs(e.target)) return; // let the tab list scroll
        const dir = e.deltaY > 0 ? 1 : -1;
        if (!isLocked(getCurrentIdx(), dir)) return;
        e.preventDefault();
        if (isSnapping) return;
        triggerSnap(dir, e.deltaY);
    }, { passive: false });

    let touchStartY = 0;
    let touchDir    = 0; // direction determined early so touchmove can gate iOS scroll

    window.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
        touchDir    = 0;
        touchInsideTabs = isInsideScrollableTabs(e.target);
    }, { passive: true });

    // Non-passive so we can preventDefault — this is the key iOS fix.
    // iOS starts its momentum scroll during touchmove; blocking it here lets
    // our custom snapToY animation be the only scroll that runs.
    window.addEventListener('touchmove', (e) => {
        if (touchInsideTabs) return; // let the tab list scroll natively
        const delta = touchStartY - e.touches[0].clientY;
        if (Math.abs(delta) < 5) return; // ignore jitter
        touchDir = delta > 0 ? 1 : -1;
        if (isLocked(getCurrentIdx(), touchDir)) {
            e.preventDefault(); // stop iOS native scroll in locked sections
        }
    }, { passive: false });

    window.addEventListener('touchend', (e) => {
        if (touchInsideTabs) { touchInsideTabs = false; return; }
        if (isSnapping) return;
        const delta = touchStartY - e.changedTouches[0].clientY;
        if (Math.abs(delta) < 30) return;
        const dir = delta > 0 ? 1 : -1;
        if (!isLocked(getCurrentIdx(), dir)) return;
        triggerSnap(dir, Math.abs(delta) * 2);
    }, { passive: true });
})();

// ====================
// Logo Carousel — driven by logos.json
// 1. Fetches 3_images/Software logos/logos.json to get the file list.
// 2. Builds <span.logo-item><img></span> elements in the track.
// 3. Waits for all images to load (so scrollWidth is accurate).
// 4. Clones the set until the track overfills the viewport, then starts
//    the CSS animation using the exact measured pixel value.
//
// To add a logo: drop the SVG into the folder, run `npm run sync`.
// ====================

(function () {
    const track = document.querySelector('.logo-carousel-track');
    if (!track) return;

    const BASE = '3_images/Software%20logos/';
    const MANIFEST = BASE + 'logos.json';

    function buildItems(logos) {
        logos.forEach(({ file, alt }) => {
            const span = document.createElement('span');
            span.className = 'logo-item';
            const img = document.createElement('img');
            img.src = BASE + encodeURIComponent(file);
            img.alt = alt || '';
            img.loading = 'eager';
            span.appendChild(img);
            track.appendChild(span);
        });
    }

    function waitForImages(callback) {
        const imgs = Array.from(track.querySelectorAll('img'));
        let remaining = imgs.length;
        if (remaining === 0) { requestAnimationFrame(callback); return; }
        imgs.forEach(img => {
            const done = () => { if (--remaining === 0) requestAnimationFrame(callback); };
            if (img.complete) { done(); }
            else {
                img.addEventListener('load',  done, { once: true });
                img.addEventListener('error', done, { once: true });
            }
        });
    }

    function init() {
        const originalItems = Array.from(track.children);
        const gap = 42; // must match CSS gap

        const setWidth = track.scrollWidth + gap;
        if (setWidth <= gap) return;

        while (track.scrollWidth < window.innerWidth + setWidth * 2) {
            originalItems.forEach(item => {
                const clone = item.cloneNode(true);
                clone.setAttribute('aria-hidden', 'true');
                clone.querySelector('img').alt = '';
                track.appendChild(clone);
            });
        }

        track.style.setProperty('--carousel-set-width', setWidth + 'px');
        track.classList.add('is-ready');
    }

    fetch(MANIFEST)
        .then(r => r.json())
        .then(logos => {
            buildItems(logos);
            waitForImages(init);
        })
        .catch(err => console.warn('Logo carousel: could not load logos.json', err));
})();

// ====================
// Header Scroll State
// ====================

(function () {
    const header = document.querySelector('.header');
    if (!header) return;
    const THRESHOLD = 20;
    const update = () => {
        header.classList.toggle('is-scrolled', window.scrollY > THRESHOLD);
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
})();

// ====================
// Scroll Progress Bar
// ====================

(function () {
    const bar = document.getElementById('scroll-progress-bar');
    if (!bar) return;

    // Lerp state — smoothly interpolates toward the real scroll fraction
    // to produce the spring-like feel from the original motion/react component.
    let current = 0;
    let target = 0;
    let rafId = null;
    const LERP = 0.12; // lower = more lag / spring feel; range 0.05–0.25

    const getScrollFraction = () => {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        return docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0;
    };

    const tick = () => {
        current += (target - current) * LERP;
        bar.style.transform = `scaleX(${current})`;

        // Keep animating until settled (within 0.1% of target)
        if (Math.abs(target - current) > 0.001) {
            rafId = requestAnimationFrame(tick);
        } else {
            current = target;
            bar.style.transform = `scaleX(${current})`;
            rafId = null;
        }
    };

    window.addEventListener('scroll', () => {
        target = getScrollFraction();
        if (rafId === null) {
            rafId = requestAnimationFrame(tick);
        }
    }, { passive: true });

    // Initialise on load (page may already be scrolled on refresh)
    target = getScrollFraction();
    current = target;
    bar.style.transform = `scaleX(${current})`;
})();

// ====================
// Smooth Scrolling
// ====================

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const pageHeader = document.querySelector('.header');
            const headerHeight = pageHeader ? pageHeader.offsetHeight : 0;
            const viewportHeight = window.innerHeight;
            const targetHeight = target.offsetHeight;
            const targetTop = target.getBoundingClientRect().top + window.pageYOffset;
            const availableHeight = Math.max(viewportHeight - headerHeight, 0);

            let scrollTop;

            if (targetHeight <= availableHeight) {
                // Center section in the visible area under the fixed header.
                const extraSpace = (availableHeight - targetHeight) / 2;
                scrollTop = targetTop - headerHeight - extraSpace;
            } else {
                // Align section top with bottom edge of the fixed header.
                scrollTop = targetTop - headerHeight;
            }

            window.scrollTo({
                top: Math.max(scrollTop, 0),
                behavior: 'smooth'
            });

            const navToggle = document.querySelector('.nav-toggle');
            const navTogglePath = document.querySelector('.nav-toggle-icon path');
            if (pageHeader && pageHeader.classList.contains('menu-open')) {
                pageHeader.classList.remove('menu-open');
                if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
                if (navTogglePath) navTogglePath.setAttribute('d', 'M5 9H13H19M5 15H19');
            }
        }
    });
});

// ====================
// Mobile Navigation Toggle
// ====================

const headerEl = document.querySelector('.header');
const navToggle = document.querySelector('.nav-toggle');
const navTogglePath = document.querySelector('.nav-toggle-icon path');
const portfolioSection = document.querySelector('.portfolio');
const footerSection = document.querySelector('.footer');

const getViewportHeight = () => {
    if (window.visualViewport && typeof window.visualViewport.height === 'number') {
        return window.visualViewport.height;
    }

    return window.innerHeight;
};

const getRootPxVar = (variableName) => {
    const rawValue = getComputedStyle(document.documentElement).getPropertyValue(variableName);
    const parsedValue = Number.parseFloat(rawValue);
    return Number.isFinite(parsedValue) ? parsedValue : 0;
};

const syncHeaderHeightVar = () => {
    const header = document.querySelector('.header');
    if (!header) return;
    document.documentElement.style.setProperty('--header-height', `${header.offsetHeight}px`);
};

const syncSectionGapVar = () => {
    if (!portfolioSection || !footerSection) return;

    const headerHeight = headerEl ? headerEl.offsetHeight : 0;
    const availableHeight = Math.max(getViewportHeight() - headerHeight, 0);
    const portfolioHeight = portfolioSection.offsetHeight;
    const footerHeight = footerSection.offsetHeight;
    const minSectionGap = getRootPxVar('--section-gap-min');
    const portfolioBottomBias = getRootPxVar('--portfolio-bottom-bias');

    // Keep the footer below the portfolio while letting the portfolio settle
    // just above the visible center line, so the portfolio is dominant at
    // page bottom while the footer still reads as the page ending.
    const centeredGap = (availableHeight / 2) - footerHeight - (portfolioHeight / 2);
    const bottomFocusedGap = centeredGap + (footerHeight / 2) + portfolioBottomBias;
    const sectionGap = Math.max(Math.round(bottomFocusedGap), Math.round(minSectionGap));

    document.documentElement.style.setProperty('--section-gap', `${sectionGap}px`);
};

let layoutSyncFrame = null;
const requestLayoutSync = () => {
    if (layoutSyncFrame !== null) {
        cancelAnimationFrame(layoutSyncFrame);
    }

    layoutSyncFrame = requestAnimationFrame(() => {
        layoutSyncFrame = null;
        syncHeaderHeightVar();
        syncSectionGapVar();
    });
};

requestLayoutSync();
window.addEventListener('load', requestLayoutSync);
window.addEventListener('resize', requestLayoutSync);

if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', requestLayoutSync);
}

if (typeof ResizeObserver !== 'undefined') {
    const layoutObserver = new ResizeObserver(() => {
        requestLayoutSync();
    });

    [headerEl, portfolioSection, footerSection].filter(Boolean).forEach((element) => {
        layoutObserver.observe(element);
    });
}

if (headerEl && navToggle && navTogglePath) {
    const closedPath = 'M5 9H13H19M5 15H19';
    const openPath = 'M6 6L18 18M18 6L6 18';

    navToggle.addEventListener('click', () => {
        const isOpen = headerEl.classList.toggle('menu-open');
        navToggle.setAttribute('aria-expanded', String(isOpen));
        navTogglePath.setAttribute('d', isOpen ? openPath : closedPath);
        requestLayoutSync();
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768 && headerEl.classList.contains('menu-open')) {
            headerEl.classList.remove('menu-open');
            navToggle.setAttribute('aria-expanded', 'false');
            navTogglePath.setAttribute('d', closedPath);
            requestLayoutSync();
        }
    });
}

// ====================
// Active Navigation Highlighting (with debounce)
// ====================

let navHighlightRAF = null;

window.addEventListener('scroll', function () {
    if (navHighlightRAF) return;

    navHighlightRAF = requestAnimationFrame(() => {
        const sections = document.querySelectorAll('section');
        const navLinks = document.querySelectorAll('.nav a');

        let current = '';

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;

            if (pageYOffset >= sectionTop - 200) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href').slice(1) === current) {
                link.classList.add('active');
            }
        });

        navHighlightRAF = null;
    });
}, { passive: true });

// ====================
// Page Load Animation
// ====================

window.addEventListener('load', function () {
    document.body.style.opacity = '1';
});

// ====================
// GSAP Scroll Animations
// ====================

if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);

    // Hero content — fade up on load
    gsap.from('.hero-content', {
        opacity: 0,
        y: 40,
        duration: 1,
        ease: 'power3.out',
        delay: 0.2,
    });

    // About section — fade up on scroll
    gsap.from('.about h2', {
        scrollTrigger: { trigger: '.about', start: 'top 85%', toggleActions: 'play none none none' },
        opacity: 0,
        y: 30,
        duration: 0.7,
        ease: 'power2.out',
    });

    gsap.from('.about p', {
        scrollTrigger: { trigger: '.about', start: 'top 80%', toggleActions: 'play none none none' },
        opacity: 0,
        y: 30,
        duration: 0.7,
        delay: 0.15,
        ease: 'power2.out',
    });

    // Portfolio section — fade up caption
    gsap.from('.portfolio-caption', {
        scrollTrigger: { trigger: '.portfolio', start: 'top 85%', toggleActions: 'play none none none' },
        opacity: 0,
        y: 30,
        duration: 0.7,
        ease: 'power2.out',
    });

    gsap.from('.portfolio-img-col', {
        scrollTrigger: { trigger: '.portfolio', start: 'top 75%', toggleActions: 'play none none none' },
        opacity: 0,
        x: 40,
        duration: 1,
        delay: 0.2,
        ease: 'power2.out',
    });

    gsap.from('.portfolio-text-col', {
        scrollTrigger: { trigger: '.portfolio', start: 'top 80%', toggleActions: 'play none none none' },
        opacity: 0,
        x: -30,
        duration: 0.9,
        ease: 'power2.out',
    });

    // Footer — subtle fade in
    gsap.from('.footer-content', {
        scrollTrigger: { trigger: '.footer', start: 'top 95%', toggleActions: 'play none none none' },
        immediateRender: false,
        opacity: 0,
        y: 20,
        duration: 0.6,
        ease: 'power2.out',
    });
}

// ====================
// Portfolio — VerticalTabs
// ====================

(function () {
    const tabs   = Array.from(document.querySelectorAll('.portfolio-tab'));
    const images = Array.from(document.querySelectorAll('.portfolio-img-wrap'));
    const tabsEl = document.querySelector('.portfolio-tabs');

    if (!tabs.length || !images.length) return;

    let current    = 0;
    let isAnimating = false;

    // Update the CSS variable that drives the green track line length
    function updateTrackLine() {
        if (!tabsEl || !tabs[current]) return;
        const h = tabs[current].offsetTop + tabs[current].offsetHeight;
        tabsEl.style.setProperty('--track-height', `${h}px`);
    }

    function goTo(nextIndex, dir) {
        if (isAnimating || nextIndex === current) return;
        isAnimating = true;

        const prevIndex = current;
        current = nextIndex;

        tabs[prevIndex].classList.remove('is-active');
        tabs[nextIndex].classList.add('is-active');
        updateTrackLine();

        // Snap next image to entry position (no transition)
        images[nextIndex].style.transition = 'none';
        images[nextIndex].style.transform  = dir > 0 ? 'translateY(100%)' : 'translateY(-100%)';
        images[nextIndex].style.opacity    = '0';
        void images[nextIndex].offsetHeight; // force reflow
        images[nextIndex].style.transition = '';

        requestAnimationFrame(() => {
            images[prevIndex].style.transform   = dir > 0 ? 'translateY(-100%)' : 'translateY(100%)';
            images[prevIndex].style.opacity      = '0';
            images[prevIndex].style.pointerEvents = 'none';

            images[nextIndex].style.transform   = 'translateY(0)';
            images[nextIndex].style.opacity      = '1';
            images[nextIndex].style.pointerEvents = 'auto';
        });

        setTimeout(() => { isAnimating = false; }, 750);
    }

    tabs.forEach((tab, i) => {
        tab.addEventListener('click', (e) => {
            if (e.target.closest('a')) return;
            goTo(i, i >= current ? 1 : -1);
        });
    });

    // Re-measure whenever tab heights change (expand/collapse animations, resize, etc.)
    new ResizeObserver(updateTrackLine).observe(tabsEl);

    // Init
    images[0].style.transform   = 'translateY(0)';
    images[0].style.opacity      = '1';
    images[0].style.pointerEvents = 'auto';

    requestAnimationFrame(updateTrackLine);
})();


// ====================
// Liquid Morphing Text
// Ports the blur/threshold animation from the React liquid-text component.
// Two spans crossfade with per-frame blur, combined with an SVG feColorMatrix
// threshold on the parent that snaps semi-transparent blurred edges into
// crisp liquid-looking transitions.
// ====================

(function () {
    const texts = [
        'Economics & Mathematical Modelling',
        'Machine Learning & Applied AI Skills',
        'Quantitative Finance & Analytics',
        'Full-Stack App Development',
    ];

    const MORPH_TIME    = 1.5;  // seconds for one crossfade
    const COOLDOWN_TIME = 5;    // seconds of hold between morphs

    const el1 = document.getElementById('lt-text1');
    const el2 = document.getElementById('lt-text2');
    if (!el1 || !el2) return;

    const h2El = el1.closest('h2');

    let textIndex = 0;
    let morph     = 0;
    let cooldown  = COOLDOWN_TIME;
    let lastTime  = Date.now();

    // Apply per-frame blur + opacity to both spans.
    // fraction 0 → el1 fully visible, el2 invisible
    // fraction 1 → el1 invisible,      el2 fully visible
    function setStyles(fraction) {
        el2.style.filter  = `blur(${Math.min(8 / fraction - 8, 100)}px)`;
        el2.style.opacity = `${Math.pow(fraction, 0.4) * 100}%`;

        const inv = 1 - fraction;
        el1.style.filter  = `blur(${Math.min(8 / inv - 8, 100)}px)`;
        el1.style.opacity = `${Math.pow(inv, 0.4) * 100}%`;

        el1.textContent = texts[textIndex % texts.length];
        el2.textContent = texts[(textIndex + 1) % texts.length];
    }

    function doMorph() {
        morph    -= cooldown;  // absorb any overshoot from the cooldown timer
        cooldown  = 0;

        // Re-enable the SVG threshold filter only while morphing
        if (h2El) h2El.style.filter = 'url(#threshold)';

        let fraction = morph / MORPH_TIME;
        if (fraction > 1) {
            cooldown = COOLDOWN_TIME;
            fraction = 1;
        }

        setStyles(fraction);

        if (fraction === 1) textIndex++;
    }

    // During the hold period: lock el2 visible, el1 hidden, no blur.
    // Remove the threshold filter so font anti-aliasing renders normally.
    function doCooldown() {
        morph = 0;
        if (h2El) h2El.style.filter = 'none';
        el2.style.filter  = 'none';
        el2.style.opacity = '100%';
        el1.style.filter  = 'none';
        el1.style.opacity = '0%';
    }

    // Initialise: show the first string immediately in el2.
    el1.textContent   = texts[0];
    el2.textContent   = texts[0];
    el2.style.opacity = '100%';
    el2.style.filter  = 'none';
    el1.style.opacity = '0%';
    el1.style.filter  = 'none';

    (function animate() {
        requestAnimationFrame(animate);
        const now = Date.now();
        const dt  = (now - lastTime) / 1000;
        lastTime  = now;
        cooldown -= dt;
        if (cooldown <= 0) doMorph();
        else doCooldown();
    })();
})();

// Email Copy Functionality
const emailCopyBtn = document.getElementById('emailCopyBtn');
if (emailCopyBtn) {
    emailCopyBtn.addEventListener('click', async function() {
        const email = 'maxdelaporte2003@gmail.com';
        const copyWithFallback = () => {
            const tempInput = document.createElement('textarea');
            tempInput.value = email;
            tempInput.setAttribute('readonly', '');
            tempInput.style.position = 'fixed';
            tempInput.style.opacity = '0';
            document.body.appendChild(tempInput);
            tempInput.select();
            tempInput.setSelectionRange(0, tempInput.value.length);
            const copied = document.execCommand('copy');
            document.body.removeChild(tempInput);
            return copied;
        };

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(email);
            } else if (!copyWithFallback()) {
                throw new Error('Clipboard API unavailable and fallback copy failed.');
            }

            const originalTitle = this.title;
            this.title = 'Email copied!';
            setTimeout(() => {
                this.title = originalTitle;
            }, 2000);

        } catch (err) {
            alert('Could not copy email automatically. Please copy: ' + email);
            console.error('Failed to copy email:', err);
        }
    });
}
