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
// Hero Morphing Text
// ====================

(function () {
    const heroH2 = document.querySelector('.hero-text h2');
    if (!heroH2) return;

    const texts = [
        'Economics & Mathematical Modelling',
        'Machine Learning & Applied AI Skills',
        'Quantitative Finance & Analytics',
        'Full-Stack App Development',
    ];

    const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const INTERVAL = 10000;
    const STEP_MS  = 75;

    let idx = 0;
    let busy = false;

    function randChar() {
        return CHARS[Math.floor(Math.random() * CHARS.length)];
    }

    function esc(c) {
        return c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c;
    }

    // Build word-safe HTML from a char array — spaces become break points between .hero-word spans
    function toWordHTML(chars) {
        let html = '';
        let buf  = '';
        for (const ch of chars) {
            if (ch === ' ') {
                if (buf) { html += `<span class="hero-word">${buf}</span>`; buf = ''; }
                html += ' ';
            } else {
                buf += `<span>${esc(ch)}</span>`;
            }
        }
        if (buf) html += `<span class="hero-word">${buf}</span>`;
        return html;
    }

    function render(text, animate) {
        const cursor = '<span class="morphing-cursor" aria-hidden="true"></span>';
        let ci = 0;
        const wordSpans = text.split(' ').map(word => {
            const chars = word.split('').map(ch => {
                const delay = ci++ * 28;
                return animate
                    ? `<span class="morph-char" style="animation-delay:${delay}ms">${esc(ch)}</span>`
                    : `<span>${esc(ch)}</span>`;
            }).join('');
            ci++; // account for the space
            return `<span class="hero-word">${chars}</span>`;
        });
        heroH2.innerHTML = wordSpans.join(' ') + cursor;
    }

    function morphNext() {
        if (busy) return;
        busy = true;

        const cur = texts[idx];
        const ni  = (idx + 1) % texts.length;
        const nxt = texts[ni];
        const maxLen = Math.max(cur.length, nxt.length);
        let step = 0;

        (function tick() {
            if (step > maxLen) {
                idx = ni;
                render(nxt, true);
                busy = false;
                return;
            }
            const cursor = '<span class="morphing-cursor" aria-hidden="true"></span>';
            const chars = [];
            for (let i = 0; i < maxLen; i++) {
                if (i < step)            { if (nxt[i]) chars.push(nxt[i]); }
                else if (i < cur.length) { chars.push(Math.random() > 0.7 ? randChar() : cur[i]); }
            }
            heroH2.innerHTML = toWordHTML(chars) + cursor;
            step++;
            setTimeout(tick, STEP_MS);
        })();
    }

    // Hover glitch burst
    heroH2.addEventListener('mouseenter', () => {
        if (busy) return;
        const cur = texts[idx];
        let f = 0;
        (function glitch() {
            if (f++ >= 6) { render(cur, false); return; }
            const cursor = '<span class="morphing-cursor" aria-hidden="true"></span>';
            const chars = cur.split('').map(ch =>
                ch === ' ' ? ' ' : (Math.random() > 0.55 ? randChar() : ch)
            );
            heroH2.innerHTML = toWordHTML(chars) + cursor;
            setTimeout(glitch, 45);
        })();
    });

    render(texts[0], false);
    setInterval(morphNext, INTERVAL);
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
