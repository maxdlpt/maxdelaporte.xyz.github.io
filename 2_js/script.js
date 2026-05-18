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
// Contact Form Handling
// ====================

const contactForm = document.querySelector('.contact-form');

if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
        e.preventDefault();
        
        // Get form values
        const name = this.querySelector('input[type="text"]').value;
        const email = this.querySelector('input[type="email"]').value;
        const message = this.querySelector('textarea').value;
        
        // Simple validation
        if (name.trim() === '' || email.trim() === '' || message.trim() === '') {
            alert('Please fill out all fields');
            return;
        }
        
        // Here you would typically send the form data to a server
        console.log('Form submitted:', { name, email, message });
        alert('Thank you for your message! I\'ll get back to you soon.');
        
        // Reset form
        this.reset();
    });
}

// ==================== 
// Active Navigation Highlighting
// ====================

window.addEventListener('scroll', function () {
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
});

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

    // Portfolio section — fade up heading, then carousel
    gsap.from('.portfolio h2', {
        scrollTrigger: { trigger: '.portfolio', start: 'top 85%', toggleActions: 'play none none none' },
        opacity: 0,
        y: 30,
        duration: 0.7,
        ease: 'power2.out',
    });

    gsap.from('.portfolio-carousel', {
        scrollTrigger: { trigger: '.portfolio', start: 'top 75%', toggleActions: 'play none none none' },
        opacity: 0,
        y: 40,
        duration: 0.8,
        delay: 0.2,
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
// Carousel Navigation
// ====================

const carousel = document.getElementById('carousel');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

if (carousel) {
    let items = Array.from(document.querySelectorAll('.portfolio-item'));
    let isAnimating = false;

    function updateStack() {
        items.forEach((item, index) => {
            item.className = 'portfolio-item';

            if (index === 0) item.classList.add('active');
            if (index === 1) item.classList.add('stack-1');
            if (index === 2) item.classList.add('stack-2');
            if (index === 3) item.classList.add('stack-3');
        });
    }

    function nextSlide() {
        if (isAnimating) return;
        isAnimating = true;

        const first = items[0];

        first.classList.add('exit-up');

        setTimeout(() => {
            first.classList.remove('exit-up');
            items.push(items.shift()); // move first to back
            updateStack();
            isAnimating = false;
        }, 600);
    }

    function prevSlide() {
        if (isAnimating) return;
        isAnimating = true;

        const last = items[items.length - 1];

        // Move last to front in array
        items.unshift(items.pop());

        updateStack();

        const newFirst = items[0];

        newFirst.classList.add('enter-down');

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                newFirst.classList.remove('enter-down');
                isAnimating = false;
            });
        });
    }

    nextBtn.addEventListener('click', nextSlide);
    prevBtn.addEventListener('click', prevSlide);

    updateStack();
}
const syncPortfolioCardHeights = (swiperInstance) => {
    const swiperEl = document.querySelector('.mySwiper');
    const slides = Array.from(document.querySelectorAll('.mySwiper .swiper-slide'));

    if (!swiperEl || slides.length === 0) return;

    slides.forEach((slide) => {
        slide.style.height = 'auto';
    });

    const maxHeight = Math.max(...slides.map((slide) => slide.scrollHeight));
    if (!Number.isFinite(maxHeight) || maxHeight <= 0) return;

    slides.forEach((slide) => {
        slide.style.height = `${maxHeight}px`;
    });
    swiperEl.style.height = `${maxHeight}px`;

    if (swiperInstance && typeof swiperInstance.update === 'function') {
        swiperInstance.update();
    }
};

if (typeof Swiper !== "undefined" && document.querySelector(".mySwiper")) {
    const swiper = new Swiper(".mySwiper", {
        effect: "cards",
        grabCursor: true,
        loop: false,
        rewind: true,
        watchOverflow: false,
        navigation: {
            nextEl: ".portfolio-next",
            prevEl: ".portfolio-prev",
        },
    });

    const refreshCardHeights = () => {
        requestAnimationFrame(() => {
            syncPortfolioCardHeights(swiper);
            requestLayoutSync();
        });
    };

    refreshCardHeights();
    window.addEventListener('resize', refreshCardHeights);
    window.addEventListener('load', refreshCardHeights);
    swiper.on('slideChangeTransitionEnd', refreshCardHeights);
    swiper.on('resize', refreshCardHeights);

    document.querySelectorAll('.mySwiper .swiper-slide img').forEach((img) => {
        if (img.complete) {
            refreshCardHeights();
        } else {
            img.addEventListener('load', refreshCardHeights, { once: true });
        }
    });
} else {
    console.warn("Swiper library or container not found; carousel was not initialized.");
}


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
