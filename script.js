// Cek pengaturan "kurangi animasi" dari perangkat pengguna
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Intersection Observer for fade-up animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            // Cukup dianimasikan sekali
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));

// Accordion FAQ: hanya satu jawaban yang terbuka dalam satu waktu
function toggleAccordion(button) {
    const item = button.closest('.faq-item');
    const isOpen = item.classList.contains('is-open');

    // Close others
    document.querySelectorAll('.faq-item').forEach(other => {
        other.classList.remove('is-open');
        other.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
        other.querySelector('.faq-answer').style.maxHeight = null;
    });

    if (!isOpen) {
        const answer = item.querySelector('.faq-answer');
        item.classList.add('is-open');
        button.setAttribute('aria-expanded', 'true');
        answer.style.maxHeight = answer.scrollHeight + 'px';
    }
}

// Parallax halus untuk gambar di bagian About.
// Pergeseran dihitung dari posisi bingkai terhadap tengah layar dan dibatasi
// 4% tinggi bingkai (gambar di-scale 1.1 di style.css), jadi tidak ada celah kosong.
const parallaxImgs = document.querySelectorAll('.zoom-img img');

function updateParallax() {
    if (prefersReducedMotion) return;
    parallaxImgs.forEach(img => {
        const rect = img.parentElement.getBoundingClientRect();
        const maxShift = rect.height * 0.04;
        const distance = rect.top + rect.height / 2 - window.innerHeight / 2;
        const shift = Math.max(-maxShift, Math.min(maxShift, -distance * 0.05));
        img.style.setProperty('--parallax-y', `${shift}px`);
    });
}

// Active Navigation on Scroll
const navItems = document.querySelectorAll('.nav-item');
const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
// Hanya section yang punya menu di navbar yang menentukan menu aktif
const sections = Array.from(document.querySelectorAll('section[id]'))
    .filter(section => document.querySelector(`.nav-item[href="#${section.id}"]`));

function updateActiveNav() {
    let current = sections.length ? sections[0].id : '';

    sections.forEach(section => {
        // Make the trigger point slightly lower down the screen
        if (window.scrollY >= section.offsetTop - window.innerHeight / 3) {
            current = section.id;
        }
    });

    // Di ujung bawah halaman, aktifkan menu terakhir (Kontak)
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    if (atBottom && sections.length) current = sections[sections.length - 1].id;

    [...navItems, ...mobileNavItems].forEach(item => {
        item.classList.toggle('is-active', item.getAttribute('href') === `#${current}`);
    });
}

// Navbar lebih solid saat halaman di-scroll + garis progres di atas layar
const mainNav = document.getElementById('mainNav');
const scrollProgress = document.getElementById('scrollProgress');

function updateScrollUI() {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const progress = maxScroll > 0 ? Math.min(window.scrollY / maxScroll, 1) : 0;
    if (scrollProgress) scrollProgress.style.transform = `scaleX(${progress})`;
    if (mainNav) mainNav.classList.toggle('nav-scrolled', window.scrollY > 40);
}

// Semua efek scroll dijalankan paling banyak sekali per frame
let scrollTicking = false;

function onScroll() {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
        updateParallax();
        updateActiveNav();
        updateScrollUI();
        scrollTicking = false;
    });
}

window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll);
onScroll();

// Mobile Menu Toggle
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileMenu = document.getElementById('mobileMenu');

function setMobileMenu(open) {
    mobileMenu.classList.toggle('max-h-0', !open);
    mobileMenu.classList.toggle('opacity-0', !open);
    ['max-h-[400px]', 'opacity-100', 'pb-md', 'pt-sm'].forEach(cls => mobileMenu.classList.toggle(cls, open));
    mobileMenuBtn.querySelector('span').innerText = open ? 'close' : 'menu';
    mobileMenuBtn.setAttribute('aria-expanded', String(open));
    mobileMenuBtn.setAttribute('aria-label', open ? 'Tutup menu' : 'Buka menu');
    mainNav.classList.toggle('rounded-full', !open);
    mainNav.classList.toggle('rounded-3xl', open);
}

if (mobileMenuBtn && mobileMenu && mainNav) {
    mobileMenuBtn.addEventListener('click', () => {
        setMobileMenu(mobileMenu.classList.contains('max-h-0'));
    });

    // Close menu when clicking a link
    mobileNavItems.forEach(item => {
        item.addEventListener('click', () => setMobileMenu(false));
    });
}

// Dynamic Products View Logic (Sliding Carousel & Grid)
const productGrid = document.getElementById('productGrid');
const productCards = Array.from(document.querySelectorAll('.product-card'));
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const toggleViewBtn = document.getElementById('toggleViewBtn');
const toggleViewText = document.getElementById('toggleViewText');
const toggleViewIcon = document.getElementById('toggleViewIcon');
const carouselDots = document.getElementById('carouselDots');

let isExpanded = false;
let currentGridPage = 0;
let isAnimating = false;

// Jarak antar kartu dibaca langsung dari CSS (gap-lg), jadi tidak perlu angka tetap
function getCardGap() {
    return parseFloat(getComputedStyle(productGrid).columnGap) || 0;
}

// Jumlah kartu per halaman di mode grid: 8 di desktop (4x2, semua produk), 4 di tablet (2x2)
function getGridPageSize() {
    return window.innerWidth >= 1024 ? 8 : 4;
}

// Munculkan kartu perlahan, lalu kembalikan transform & transisi ke CSS
// supaya efek hover terangkat (.hover-lift) tetap berfungsi
function fadeInCard(card, delay) {
    card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    setTimeout(() => {
        card.style.opacity = '';
        card.style.transform = '';
        setTimeout(() => {
            if (card.style.opacity === '') card.style.transition = '';
        }, 600);
    }, delay);
}

function renderProducts(isToggling = false) {
    if (isAnimating) return;

    const wrapper = document.getElementById('productWrapper');
    let oldHeight = 0;
    if (isToggling) {
        oldHeight = wrapper.offsetHeight;
        wrapper.style.height = oldHeight + 'px';
    }

    if (!isExpanded) {
        // CAROUSEL VIEW
        // pt-3 & pb-8 memberi ruang untuk kartu yang terangkat dan bayangannya
        productGrid.className = 'flex overflow-x-auto snap-x snap-mandatory hide-scrollbar gap-lg pt-3 pb-8';
        productGrid.style.scrollBehavior = 'smooth';

        productCards.forEach((card) => {
            card.classList.remove('hidden');
            card.style.display = 'block';
            // Hapus style inline dari mode grid agar efek hover (.hover-lift) tetap jalan
            card.style.opacity = '';
            card.style.transform = '';
            card.style.transition = '';
            card.classList.add('carousel-card', 'snap-start', 'shrink-0');
        });

        if (productCards.length > 3) {
            prevBtn.classList.remove('hidden');
            nextBtn.classList.remove('hidden');
            // Start at the beginning, so left arrow is dimmed
            prevBtn.style.opacity = '0.3';
            prevBtn.style.pointerEvents = 'none';
            nextBtn.style.opacity = '1';
            nextBtn.style.pointerEvents = 'auto';
            if (carouselDots) {
                carouselDots.classList.remove('hidden');
                setupDots();
            }
        } else {
            prevBtn.classList.add('hidden');
            nextBtn.classList.add('hidden');
            if (carouselDots) carouselDots.classList.add('hidden');
        }

        if (isToggling) {
            wrapper.style.height = 'auto';
            const newHeight = wrapper.offsetHeight;
            wrapper.style.height = oldHeight + 'px';
            void wrapper.offsetHeight;
            wrapper.style.height = newHeight + 'px';
            setTimeout(() => { wrapper.style.height = 'auto'; }, 700);
        }

    } else {
        // GRID VIEW
        isAnimating = true;
        productGrid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-lg pt-3 pb-8';
        productGrid.style.scrollBehavior = 'auto';

        const pageSize = getGridPageSize();
        const totalPages = Math.ceil(productCards.length / pageSize);
        if (currentGridPage >= totalPages) currentGridPage = totalPages > 0 ? totalPages - 1 : 0;
        if (currentGridPage < 0) currentGridPage = 0;

        const startIndex = currentGridPage * pageSize;
        const endIndex = startIndex + pageSize;

        // If toggling, instantly layout so height calculates correctly
        if (isToggling) {
            productCards.forEach((card, index) => {
                card.classList.remove('carousel-card', 'snap-start', 'shrink-0');
                if (index >= startIndex && index < endIndex) {
                    card.classList.remove('hidden');
                    card.style.display = 'block';
                    // We'll fade these in below
                    card.style.opacity = '0';
                    card.style.transform = 'translateY(10px)';
                } else {
                    card.style.display = 'none';
                }
            });

            wrapper.style.height = 'auto';
            const newHeight = wrapper.offsetHeight;
            wrapper.style.height = oldHeight + 'px';
            void wrapper.offsetHeight;
            wrapper.style.height = newHeight + 'px';
            setTimeout(() => { wrapper.style.height = 'auto'; }, 700);

            // Now fade in
            productCards.forEach((card, index) => {
                if (index >= startIndex && index < endIndex) {
                    fadeInCard(card, 50 * (index - startIndex));
                }
            });

            updateArrows(totalPages);
            setTimeout(() => { isAnimating = false; }, 700);
            return;
        }

        // Standard Pagination Fade (Not Toggling)
        let hasVisible = false;
        productCards.forEach((card, index) => {
            if (card.style.display !== 'none' && (index < startIndex || index >= endIndex)) {
                card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                card.style.opacity = '0';
                card.style.transform = 'translateY(10px)';
                hasVisible = true;
            }
        });

        const waitTime = hasVisible ? 300 : 0;

        setTimeout(() => {
            productCards.forEach((card, index) => {
                if (index >= startIndex && index < endIndex) {
                    if (card.style.display === 'none' || card.classList.contains('hidden')) {
                        card.classList.remove('hidden');
                        card.style.display = 'block';
                        card.style.transition = 'none';
                        card.style.opacity = '0';
                        card.style.transform = 'translateY(10px)';
                        void card.offsetWidth;
                    }
                    fadeInCard(card, 50 * (index - startIndex));
                } else {
                    card.style.display = 'none';
                }
            });

            updateArrows(totalPages);
            setTimeout(() => { isAnimating = false; }, 600);
        }, waitTime);
    }
}

function updateArrows(totalPages) {
    if (totalPages > 1) {
        prevBtn.classList.remove('hidden');
        nextBtn.classList.remove('hidden');
        prevBtn.style.opacity = currentGridPage === 0 ? '0.3' : '1';
        nextBtn.style.opacity = currentGridPage === totalPages - 1 ? '0.3' : '1';
        prevBtn.style.pointerEvents = currentGridPage === 0 ? 'none' : 'auto';
        nextBtn.style.pointerEvents = currentGridPage === totalPages - 1 ? 'none' : 'auto';

        // Show grid page dots
        if (carouselDots) {
            carouselDots.classList.remove('hidden');
            carouselDots.innerHTML = '';
            for (let i = 0; i < totalPages; i++) {
                const dot = document.createElement('button');
                dot.setAttribute('aria-label', `Halaman produk ${i + 1}`);
                dot.className = i === currentGridPage
                    ? 'h-2.5 rounded-full bg-primary transition-all w-8'
                    : 'w-2.5 h-2.5 rounded-full bg-primary/30 hover:bg-primary/60 transition-all';
                dot.addEventListener('click', () => {
                    if (isAnimating) return;
                    currentGridPage = i;
                    renderProducts();
                });
                carouselDots.appendChild(dot);
            }
        }
    } else {
        prevBtn.classList.add('hidden');
        nextBtn.classList.add('hidden');
        if (carouselDots) carouselDots.classList.add('hidden');
    }
}

if (toggleViewBtn) {
    toggleViewBtn.addEventListener('click', () => {
        if (isAnimating) return;
        isExpanded = !isExpanded;

        if (isExpanded) {
            currentGridPage = 0; // Reset to page 1 on expand
            toggleViewText.innerText = "Tampilkan Lebih Sedikit";
            toggleViewIcon.innerText = "keyboard_arrow_up";
            toggleViewIcon.classList.remove('group-hover:translate-y-0.5');
            toggleViewIcon.classList.add('group-hover:-translate-y-0.5');
        } else {
            productGrid.scrollLeft = 0; // Reset scroll on collapse
            toggleViewText.innerText = "Tampilkan Lebih Banyak";
            toggleViewIcon.innerText = "keyboard_arrow_down";
            toggleViewIcon.classList.add('group-hover:translate-y-0.5');
            toggleViewIcon.classList.remove('group-hover:-translate-y-0.5');
        }

        renderProducts(true);
    });
}

if (prevBtn && nextBtn) {
    prevBtn.addEventListener('click', () => {
        if (isAnimating) return;
        if (!isExpanded) {
            // Scroll left by 1 card
            const cardWidth = productCards[0].offsetWidth;
            const gap = getCardGap();
            productGrid.scrollBy({ left: -(cardWidth + gap), behavior: 'smooth' });
        } else {
            if (currentGridPage > 0) {
                currentGridPage--;
                renderProducts();
            }
        }
    });

    nextBtn.addEventListener('click', () => {
        if (isAnimating) return;
        if (!isExpanded) {
            // Scroll right by 1 card
            const cardWidth = productCards[0].offsetWidth;
            const gap = getCardGap();
            productGrid.scrollBy({ left: cardWidth + gap, behavior: 'smooth' });
        } else {
            const totalPages = Math.ceil(productCards.length / getGridPageSize());
            if (currentGridPage < totalPages - 1) {
                currentGridPage++;
                renderProducts();
            }
        }
    });
}

// Initial render
renderProducts();

// Carousel Dots Logic
function getVisibleCardsCount() {
    if (productCards.length === 0) return 1;
    const cardWidth = productCards[0].offsetWidth;
    if (cardWidth === 0) return 1; // Fallback
    const gap = getCardGap();
    const containerWidth = productGrid.clientWidth;

    // If a single card takes up most of the container, we're in mobile view
    if (cardWidth >= containerWidth * 0.8) return 1;

    return Math.max(1, Math.floor((containerWidth + gap) / (cardWidth + gap)));
}

function setupDots() {
    if (!carouselDots || isExpanded) return;

    // We use setTimeout to ensure CSS layout has finished assigning widths
    setTimeout(() => {
        carouselDots.innerHTML = '';
        const visibleCount = getVisibleCardsCount();
        let totalDots = productCards.length - visibleCount + 1;
        if (totalDots < 1) totalDots = 1;

        const cardWidth = productCards[0].offsetWidth;
        const gap = getCardGap();
        let activeIndex = Math.round(productGrid.scrollLeft / (cardWidth + gap));
        if (activeIndex > totalDots - 1) activeIndex = totalDots - 1;

        for (let i = 0; i < totalDots; i++) {
            const dot = document.createElement('button');
            dot.setAttribute('aria-label', `Geser ke produk ${i + 1}`);

            dot.className = i === activeIndex
                ? 'h-2.5 rounded-full bg-primary transition-all w-8'
                : 'w-2.5 h-2.5 rounded-full bg-primary/30 hover:bg-primary/60 transition-all';

            dot.addEventListener('click', () => {
                // Read current card width at click time for accuracy
                const currentCardWidth = productCards[0].offsetWidth;
                const currentGap = getCardGap();
                productGrid.scrollTo({ left: i * (currentCardWidth + currentGap), behavior: 'smooth' });
            });
            carouselDots.appendChild(dot);
        }
    }, 150);
}

function updateDots() {
    if (isExpanded || !carouselDots) return;

    const cardWidth = productCards[0].offsetWidth;
    if (cardWidth === 0) return;
    const gap = getCardGap();

    const visibleCount = getVisibleCardsCount();
    let totalDots = productCards.length - visibleCount + 1;
    if (totalDots < 1) totalDots = 1;

    let activeIndex = Math.round(productGrid.scrollLeft / (cardWidth + gap));
    if (activeIndex < 0) activeIndex = 0;
    if (activeIndex >= totalDots) activeIndex = totalDots - 1;

    const maxScroll = productGrid.scrollWidth - productGrid.clientWidth;
    // If scrolled to the very end, highlight the last dot
    if (Math.abs(productGrid.scrollLeft - maxScroll) < 10) {
        activeIndex = totalDots - 1;
    }

    const dots = carouselDots.querySelectorAll('button');
    // If dot count changed unexpectedly (e.g. rotation), re-setup
    if (dots.length !== totalDots && dots.length > 0) {
        setupDots();
        return;
    }

    dots.forEach((dot, index) => {
        if (index === activeIndex) {
            dot.className = 'h-2.5 rounded-full bg-primary transition-all w-8';
        } else {
            dot.className = 'w-2.5 h-2.5 rounded-full bg-primary/30 hover:bg-primary/60 transition-all';
        }
    });

    // Update carousel arrow opacity based on scroll position
    const atStart = productGrid.scrollLeft <= 5;
    const atEnd = Math.abs(productGrid.scrollLeft - maxScroll) < 10;
    prevBtn.style.opacity = atStart ? '0.3' : '1';
    prevBtn.style.pointerEvents = atStart ? 'none' : 'auto';
    nextBtn.style.opacity = atEnd ? '0.3' : '1';
    nextBtn.style.pointerEvents = atEnd ? 'none' : 'auto';
}

productGrid.addEventListener('scroll', updateDots);
window.addEventListener('resize', () => {
    if (!isExpanded) setupDots();
});

// Hero Slideshow: foto berganti dengan efek memudar (crossfade)
const heroSlides = document.querySelectorAll('#heroSlideshow .hero-slide');
const heroIndicators = document.querySelectorAll('#heroIndicators button');
let currentSlide = 0;

if (heroSlides.length > 1 && heroIndicators.length === heroSlides.length) {
    const totalSlides = heroSlides.length;

    const updateSlide = (index) => {
        currentSlide = index;
        heroSlides.forEach((slide, i) => slide.classList.toggle('is-active', i === currentSlide));

        // Perbarui tampilan titik indikator
        heroIndicators.forEach((dot, i) => {
            if (i === currentSlide) {
                dot.className = "h-2.5 rounded-full bg-primary transition-all w-8";
            } else {
                dot.className = "w-2.5 h-2.5 rounded-full bg-primary/30 hover:bg-primary/60 transition-all";
            }
        });
    };

    // Ganti foto otomatis setiap 4.5 detik (tidak berjalan jika "kurangi animasi" aktif)
    const startAutoplay = () => prefersReducedMotion ? null : setInterval(() => {
        updateSlide((currentSlide + 1) % totalSlides);
    }, 4500);

    let slideInterval = startAutoplay();

    // Bisa klik titik indikatornya juga
    heroIndicators.forEach((dot, i) => {
        dot.addEventListener('click', () => {
            updateSlide(i);
            // Reset interval agar tidak langsung berganti setelah diklik
            clearInterval(slideInterval);
            slideInterval = startAutoplay();
        });
    });
}

// Lightbox Galeri: klik foto untuk melihat ukuran besar
const galleryItems = Array.from(document.querySelectorAll('.gallery-item'));
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxCaption = document.getElementById('lightboxCaption');
let lightboxIndex = 0;
let lastFocusedEl = null;

function showLightboxImage(index) {
    // Berputar: setelah foto terakhir kembali ke foto pertama
    lightboxIndex = (index + galleryItems.length) % galleryItems.length;
    const img = galleryItems[lightboxIndex].querySelector('img');
    lightboxImg.src = img.src;
    lightboxImg.alt = img.alt;
    lightboxCaption.textContent = `${img.alt} · ${lightboxIndex + 1} / ${galleryItems.length}`;
}

function openLightbox(index) {
    lastFocusedEl = document.activeElement;
    showLightboxImage(index);
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    // Kunci scroll halaman selama lightbox terbuka
    document.documentElement.style.overflow = 'hidden';
    lightbox.querySelector('.lightbox-close').focus();
}

function closeLightbox() {
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
    if (lastFocusedEl) lastFocusedEl.focus();
}

if (lightbox && galleryItems.length) {
    galleryItems.forEach((item, i) => item.addEventListener('click', () => openLightbox(i)));

    lightbox.addEventListener('click', (e) => {
        const action = e.target.closest('[data-lightbox]')?.dataset.lightbox;
        if (action === 'close' || e.target === lightbox) closeLightbox();
        else if (action === 'prev') showLightboxImage(lightboxIndex - 1);
        else if (action === 'next') showLightboxImage(lightboxIndex + 1);
    });

    document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('is-open')) return;
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') showLightboxImage(lightboxIndex - 1);
        if (e.key === 'ArrowRight') showLightboxImage(lightboxIndex + 1);
    });

    // Geser (swipe) kiri/kanan di layar sentuh
    let touchStartX = 0;
    lightbox.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].clientX;
    }, { passive: true });
    lightbox.addEventListener('touchend', (e) => {
        const deltaX = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(deltaX) > 50) showLightboxImage(lightboxIndex + (deltaX < 0 ? 1 : -1));
    });
}

// Tahun di footer selalu mengikuti tahun sekarang
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();
