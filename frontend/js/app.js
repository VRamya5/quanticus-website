/**
 * Quanticus Software Solutions - Core Application Logic
 * Modern, clean, accessible UI interactions, modal controllers, and scroll animations
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Header Scroll Shadow & ScrollSpy Setup
  const header = document.querySelector('.site-header');
  const navLinks = document.querySelectorAll('.nav-menu .nav-link');
  const sections = document.querySelectorAll('section[id]');

  function updateHeader() {
    if (window.scrollY > 20) {
      header?.classList.add('scrolled');
    } else {
      header?.classList.remove('scrolled');
    }
  }

  function updateActiveNav() {
    const scrollPosition = window.scrollY + 140; // Offset for fixed navbar

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;
      const sectionId = section.getAttribute('id');

      if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
        for (let j = 0; j < navLinks.length; j++) {
          const link = navLinks[j];
          const href = link.getAttribute('href');
          if (href === `#${sectionId}` || (sectionId === 'process' && href === '#how-we-work')) {
            link.classList.add('active');
          } else {
            link.classList.remove('active');
          }
        }
        break;
      }
    }
  }

  let isScrollTicking = false;
  function handleScroll() {
    if (!isScrollTicking) {
      requestAnimationFrame(() => {
        updateHeader();
        updateActiveNav();
        isScrollTicking = false;
      });
      isScrollTicking = true;
    }
  }

  window.addEventListener('scroll', handleScroll, { passive: true });
  updateHeader();
  updateActiveNav();

  // 2. Mobile Navigation Menu Toggle Controller
  const mobileToggle = document.getElementById('mobileNavToggle');
  const navMenu = document.getElementById('mainNavMenu');

  if (mobileToggle && navMenu) {
    const closeMenu = () => {
      mobileToggle.setAttribute('aria-expanded', 'false');
      navMenu.classList.remove('open');
    };

    const openMenu = () => {
      mobileToggle.setAttribute('aria-expanded', 'true');
      navMenu.classList.add('open');
    };

    mobileToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isExpanded = mobileToggle.getAttribute('aria-expanded') === 'true';
      if (isExpanded) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    // Close when tapping a nav link or CTA button
    navMenu.querySelectorAll('.nav-link, .nav-cta-btn').forEach((link) => {
      link.addEventListener('click', () => {
        closeMenu();
      });
    });

    // Close when clicking/tapping outside
    document.addEventListener('click', (e) => {
      if (navMenu.classList.contains('open') && !navMenu.contains(e.target) && !mobileToggle.contains(e.target)) {
        closeMenu();
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navMenu.classList.contains('open')) {
        closeMenu();
        mobileToggle.focus();
      }
    });

    // Close when resized above the mobile breakpoint
    const mobileBreakpoint = window.matchMedia('(max-width: 768px)');
    const handleBreakpointChange = (e) => {
      if (!e.matches && navMenu.classList.contains('open')) {
        closeMenu();
      }
    };
    if (mobileBreakpoint.addEventListener) {
      mobileBreakpoint.addEventListener('change', handleBreakpointChange);
    } else if (mobileBreakpoint.addListener) {
      mobileBreakpoint.addListener(handleBreakpointChange);
    }
  }

  // 4. Scroll Reveal Observer - Replay Entrance Animations Every Time Section Enters Viewport
  const revealElements = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
      } else {
        // Reset animation state when leaving viewport so it replays upon next entry
        entry.target.classList.remove('is-visible');
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
  });

  revealElements.forEach((el) => revealObserver.observe(el));

  // 4.01 Work Section Project Marquee Controller
  const workSection = document.getElementById('work');
  const workMarqueeContainer = document.getElementById('workMarqueeContainer');
  const workMarqueeTrack = document.getElementById('workMarqueeTrack');

  if (workMarqueeContainer && workMarqueeTrack) {
    // Dynamic duration calculation: speed of ~40px per second based on content width (half track width)
    const updateMarqueeDuration = () => {
      const halfWidth = workMarqueeTrack.scrollWidth / 2;
      if (halfWidth > 0) {
        const speed = 40; // 40px per second
        const duration = (halfWidth / speed).toFixed(2);
        workMarqueeContainer.style.setProperty('--marquee-duration', `${duration}s`);
      }
    };

    updateMarqueeDuration();
    window.addEventListener('load', updateMarqueeDuration, { once: true });
    window.addEventListener('resize', () => {
      requestAnimationFrame(updateMarqueeDuration);
    }, { passive: true });

    // Mobile touch pause: pause while user is actively touching the marquee
    workMarqueeTrack.addEventListener('touchstart', () => {
      workMarqueeTrack.classList.add('is-touching');
    }, { passive: true });

    const clearTouch = () => {
      workMarqueeTrack.classList.remove('is-touching');
    };
    workMarqueeTrack.addEventListener('touchend', clearTouch, { passive: true });
    workMarqueeTrack.addEventListener('touchcancel', clearTouch, { passive: true });

    // Pause when section is off-screen via IntersectionObserver
    if ('IntersectionObserver' in window && workSection) {
      const workOffscreenObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            workMarqueeContainer.classList.remove('is-offscreen');
          } else {
            workMarqueeContainer.classList.add('is-offscreen');
          }
        });
      }, {
        threshold: 0
      });
      workOffscreenObserver.observe(workSection);
    }

    // Pause when tab is hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        workMarqueeContainer.classList.add('is-tab-hidden');
      } else {
        workMarqueeContainer.classList.remove('is-tab-hidden');
      }
    });
  }

  // 4.1 Process / How We Work Section Sequential Scroll Animation Observer
  const processSection = document.getElementById('process');
  const processJourney = document.querySelector('.process-journey');

  if (processSection && processJourney) {
    let lastProcessScrollY = window.scrollY;
    let processScrollDirection = 'down';

    window.addEventListener('scroll', () => {
      const currentY = window.scrollY;
      if (currentY < lastProcessScrollY) {
        processScrollDirection = 'up';
      } else if (currentY > lastProcessScrollY) {
        processScrollDirection = 'down';
      }
      lastProcessScrollY = currentY;
    }, { passive: true });

    // Immediate start if section is already partly or mostly on screen on load/jump
    const checkImmediateVisibility = () => {
      const rect = processSection.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      if (rect.top < vh * 1.3 && rect.bottom > -vh * 0.3) {
        if (processScrollDirection === 'up') {
          processJourney.classList.add('scroll-up-entry');
        }
        processJourney.classList.add('is-visible');
      }
    };
    checkImmediateVisibility();

    // 1. Enter Observer: 30% top/bottom expanded margin, threshold 0
    // Starts animation while section is still just off-screen in both scroll directions
    const processEnterObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          if (processScrollDirection === 'up') {
            processJourney.classList.add('scroll-up-entry');
          } else {
            processJourney.classList.remove('scroll-up-entry');
          }
          processJourney.classList.add('is-visible');
        }
      });
    }, {
      rootMargin: '30% 0px 30% 0px',
      threshold: 0
    });

    processEnterObserver.observe(processSection);

    // 2. Reset Observer (Hysteresis): 100% expanded margin, threshold 0
    // Only resets when section is more than 1 full viewport height away from screen
    const processResetObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          processJourney.classList.remove('is-visible');
          processJourney.classList.remove('scroll-up-entry');
        }
      });
    }, {
      rootMargin: '100% 0px 100% 0px',
      threshold: 0
    });

    processResetObserver.observe(processSection);
  }

  // 5. Animated Number Counter for Stats Section
  const statNumbers = document.querySelectorAll('.stat-number[data-target]');
  let hasAnimatedStats = false;

  const statsContainer = document.querySelector('.stats-cards-grid');
  if (statsContainer) {
    const statsObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !hasAnimatedStats) {
          hasAnimatedStats = true;
          statNumbers.forEach((numEl) => {
            const target = parseInt(numEl.getAttribute('data-target'), 10);
            const prefix = numEl.getAttribute('data-prefix') || '';
            const suffix = numEl.getAttribute('data-suffix') || '';
            const duration = 1200; // ms
            const start = target > 1000 ? target - 30 : 0;
            const startTime = performance.now();

            function updateCounter(currentTime) {
              const elapsed = currentTime - startTime;
              const progress = Math.min(elapsed / duration, 1);
              // Ease out quad
              const easeProgress = 1 - (1 - progress) * (1 - progress);
              const currentVal = Math.floor(start + (target - start) * easeProgress);

              numEl.textContent = `${prefix}${currentVal}${suffix}`;

              if (progress < 1) {
                requestAnimationFrame(updateCounter);
              } else {
                numEl.textContent = `${prefix}${target}${suffix}`;
              }
            }
            requestAnimationFrame(updateCounter);
          });
        }
      });
    }, { threshold: 0.25 });

    statsObserver.observe(statsContainer);
  }

  // 6. Modal System (Career Application Modal)
  function getScrollbarWidth() {
    return window.innerWidth - document.documentElement.clientWidth;
  }

  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    const scrollbarWidth = getScrollbarWidth();
    if (scrollbarWidth > 0) {
      document.body.style.setProperty('--scrollbar-compensation', `${scrollbarWidth}px`);
    }
    document.body.classList.add('modal-open');
    modal.classList.add('is-active');
    modal.setAttribute('aria-hidden', 'false');

    // Focus first interactive element in modal
    const focusable = modal.querySelector('input:not([type="hidden"]), textarea, button:not([data-close-modal])');
    if (focusable) {
      setTimeout(() => focusable.focus(), 100);
    }
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('is-active');
    modal.setAttribute('aria-hidden', 'true');

    // Check if any other modal is active
    const activeModals = document.querySelectorAll('.modal-backdrop.is-active');
    if (activeModals.length === 0) {
      document.body.classList.remove('modal-open');
      document.body.style.removeProperty('--scrollbar-compensation');
    }
  }

  function closeAllModals() {
    document.querySelectorAll('.modal-backdrop.is-active').forEach((modal) => {
      closeModal(modal);
    });
  }

  // Open Career Modal helper
  function triggerCareerModal(roleName, roleId) {
    const roleTextEl = document.getElementById('careerModalRoleText');
    const roleHiddenInput = document.getElementById('careerSelectedRole');
    const roleIdHiddenInput = document.getElementById('careerSelectedRoleId');
    
    if (roleTextEl) roleTextEl.textContent = roleName || 'Role';
    if (roleHiddenInput) roleHiddenInput.value = roleName || '';
    if (roleIdHiddenInput) roleIdHiddenInput.value = roleId || '';

    openModal('careerModal');
  }

  // Career Modal Triggers (delegated to support dynamically rendered cards)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-open-career-modal]');
    if (btn) {
      e.preventDefault();
      const roleName = btn.getAttribute('data-open-career-modal') || 'Software Developer';
      const roleId = btn.getAttribute('data-role-id') || '';
      triggerCareerModal(roleName, roleId);
    }
  });

  // Close Button Handlers
  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-backdrop');
      closeModal(modal);
    });
  });

  // Click Outside Backdrop to Close
  document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        closeModal(backdrop);
      }
    });
  });

  // Escape Key to Close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'Esc') {
      closeAllModals();
    }
  });

  // Resume File Upload Custom Preview
  const careerResumeInput = document.getElementById('careerResume');
  const fileUploadPrompt = document.getElementById('fileUploadPrompt');
  const fileNameDisplay = document.getElementById('fileNameDisplay');
  const resumeUploadBox = document.getElementById('resumeUploadBox');

  if (careerResumeInput && fileNameDisplay && fileUploadPrompt) {
    careerResumeInput.addEventListener('change', () => {
      if (careerResumeInput.files && careerResumeInput.files.length > 0) {
        const file = careerResumeInput.files[0];
        const fileSizeMb = (file.size / (1024 * 1024)).toFixed(2);
        fileNameDisplay.textContent = `✓ ${file.name} (${fileSizeMb} MB)`;
        fileNameDisplay.style.display = 'block';
        fileUploadPrompt.textContent = 'Selected resume:';
      } else {
        fileNameDisplay.style.display = 'none';
        fileUploadPrompt.textContent = 'Click to browse or drag & drop resume';
      }
    });

    if (resumeUploadBox) {
      ['dragenter', 'dragover'].forEach(eventName => {
        resumeUploadBox.addEventListener(eventName, (e) => {
          e.preventDefault();
          resumeUploadBox.classList.add('drag-over');
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        resumeUploadBox.addEventListener(eventName, (e) => {
          e.preventDefault();
          resumeUploadBox.classList.remove('drag-over');
        });
      });
    }
  }

  // Free-plan friendliness helper: Shows wake-up message after 4s, retries once on network failure
  async function fetchWithWakeupNotice(url, options = {}, onWakeupNotice = null) {
    let timer = null;
    let didNotify = false;

    if (typeof onWakeupNotice === 'function') {
      timer = setTimeout(() => {
        didNotify = true;
        onWakeupNotice(true, 'Waking up our server, this can take up to a minute...');
      }, 4000);
    }

    const doFetch = async () => {
      const res = await fetch(url, options);
      return res;
    };

    try {
      let response;
      try {
        response = await doFetch();
      } catch (firstErr) {
        // Retry once after a brief delay
        await new Promise((r) => setTimeout(r, 1500));
        response = await doFetch();
      }

      if (timer) clearTimeout(timer);
      if (didNotify && typeof onWakeupNotice === 'function') {
        onWakeupNotice(false);
      }
      return response;
    } catch (err) {
      if (timer) clearTimeout(timer);
      if (didNotify && typeof onWakeupNotice === 'function') {
        onWakeupNotice(false);
      }
      throw err;
    }
  }

  // 6.1 Dynamic Careers Data Loading from Public API
  const careersGrid = document.querySelector('.careers-grid');

  async function loadCareersFromAPI() {
    if (!careersGrid) return;
    try {
      const res = await fetchWithWakeupNotice('/api/roles');
      if (!res.ok) return;
      const data = await res.json();
      if (!data.success || !Array.isArray(data.roles) || data.roles.length === 0) return;

      // Clear existing static fallback cards and render dynamic cards
      careersGrid.innerHTML = '';

      data.roles.forEach((role, idx) => {
        const card = document.createElement('article');
        const isOpen = role.status === 'open';
        const delayClass = idx % 4 === 0 ? '' : `reveal-delay-${idx % 4}`;
        card.className = `career-card ${isOpen ? 'available' : ''} reveal ${delayClass}`.trim();

        // Top info
        const topDiv = document.createElement('div');
        topDiv.className = 'career-card-top';

        const roleInfo = document.createElement('div');
        roleInfo.className = 'career-role-info';

        const titleEl = document.createElement('h3');
        titleEl.className = 'career-role-title';
        titleEl.textContent = role.title;

        const deptEl = document.createElement('span');
        deptEl.className = 'career-role-type';
        deptEl.textContent = role.department;

        roleInfo.appendChild(titleEl);
        roleInfo.appendChild(deptEl);

        const badgeDiv = document.createElement('div');
        badgeDiv.className = `status-badge ${isOpen ? 'available' : 'no-openings'}`;
        badgeDiv.innerHTML = `
          <span class="status-dot"></span>
          <span>${isOpen ? 'Currently Available' : 'Currently No Openings'}</span>
        `;

        topDiv.appendChild(roleInfo);
        topDiv.appendChild(badgeDiv);

        // Description
        const descEl = document.createElement('p');
        descEl.className = 'career-desc';
        descEl.textContent = role.description;

        // Footer
        const footerDiv = document.createElement('div');
        footerDiv.className = 'career-card-footer';

        const tagEl = document.createElement('span');
        tagEl.className = 'tag-badge';
        tagEl.textContent = role.tag;

        let actionBtn;
        if (isOpen) {
          actionBtn = document.createElement('button');
          actionBtn.type = 'button';
          actionBtn.className = 'btn btn-primary btn-apply-action';
          actionBtn.setAttribute('data-open-career-modal', role.title);
          actionBtn.setAttribute('data-role-id', role.id);
          actionBtn.innerHTML = '<span>Apply Now</span>';
        } else {
          actionBtn = document.createElement('button');
          actionBtn.type = 'button';
          actionBtn.className = 'btn btn-closed-action';
          actionBtn.disabled = true;
          actionBtn.innerHTML = '<span>No Openings</span>';
        }

        footerDiv.appendChild(tagEl);
        footerDiv.appendChild(actionBtn);

        card.appendChild(topDiv);
        card.appendChild(descEl);
        card.appendChild(footerDiv);

        careersGrid.appendChild(card);

        // Replay scroll reveal observer on newly created card
        revealObserver.observe(card);
      });
    } catch {
      // If server is unavailable, static fallback markup remains intact
    }
  }

  loadCareersFromAPI();

  // 7. Career Application Modal Form Submission Handler (Connected to Express API)
  const careerModalForm = document.getElementById('careerModalForm');
  const careerStatusMsg = document.getElementById('careerStatusMsg');

  if (careerModalForm && careerStatusMsg) {
    careerModalForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('careerName')?.value.trim();
      const email = document.getElementById('careerEmail')?.value.trim();
      const phone = document.getElementById('careerPhone')?.value.trim();
      const roleName = document.getElementById('careerSelectedRole')?.value;
      const roleId = document.getElementById('careerSelectedRoleId')?.value;
      const coverMessage = document.getElementById('careerCoverMessage')?.value.trim();
      const resumeFile = careerResumeInput?.files?.[0];
      const honeypot = document.getElementById('careerCompanyFaxHoneypot')?.value;
      const submitBtn = document.getElementById('careerSubmitBtn');

      if (!name || !email || !phone) {
        careerStatusMsg.textContent = 'Please complete all required fields.';
        careerStatusMsg.className = 'form-status-msg error';
        careerStatusMsg.style.display = 'block';
        return;
      }

      if (!resumeFile) {
        careerStatusMsg.textContent = 'Please attach your resume in PDF or DOCX format.';
        careerStatusMsg.className = 'form-status-msg error';
        careerStatusMsg.style.display = 'block';
        return;
      }

      // Check 4MB limit client-side
      if (resumeFile.size > 4 * 1024 * 1024) {
        careerStatusMsg.textContent = 'File size exceeds 4MB limit. Please upload a smaller file.';
        careerStatusMsg.className = 'form-status-msg error';
        careerStatusMsg.style.display = 'block';
        return;
      }

      submitBtn.disabled = true;
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<span>Submitting application...</span>';
      careerStatusMsg.style.display = 'none';

      const formData = new FormData();
      formData.append('fullName', name);
      formData.append('email', email);
      formData.append('phone', phone);
      formData.append('roleTitle', roleName);
      if (roleId) formData.append('roleId', roleId);
      if (coverMessage) formData.append('coverMessage', coverMessage);
      formData.append('resume', resumeFile);
      if (honeypot) formData.append('company_fax', honeypot);

      try {
        const response = await fetchWithWakeupNotice(
          '/api/applications',
          {
            method: 'POST',
            body: formData
          },
          (isWaking, msg) => {
            if (isWaking) {
              careerStatusMsg.textContent = msg;
              careerStatusMsg.className = 'form-status-msg info';
              careerStatusMsg.style.display = 'block';
            }
          }
        );

        const data = await response.json();

        if (response.ok && data.success) {
          careerModalForm.reset();
          if (fileNameDisplay) fileNameDisplay.style.display = 'none';
          if (fileUploadPrompt) fileUploadPrompt.textContent = 'Click to browse or drag & drop resume';

          const refText = data.ref_code ? `<br><span style="display:inline-block;margin-top:4px;font-size:0.875rem;">Your reference: <strong>${data.ref_code}</strong>. Please keep it for future correspondence.</span>` : '';
          careerStatusMsg.innerHTML = `<strong>Application Submitted!</strong> Thank you for your interest in Quanticus. We will review your profile.${refText}`;
          careerStatusMsg.className = 'form-status-msg success';
          careerStatusMsg.style.display = 'block';

          setTimeout(() => {
            careerStatusMsg.style.display = 'none';
            closeModal(document.getElementById('careerModal'));
          }, 6000);
        } else {
          careerStatusMsg.textContent = data.error || 'Failed to submit application. Please check your details and try again.';
          careerStatusMsg.className = 'form-status-msg error';
          careerStatusMsg.style.display = 'block';
        }
      } catch {
        careerStatusMsg.textContent = 'Unable to connect to the server right now. Please try again or email us directly.';
        careerStatusMsg.className = 'form-status-msg error';
        careerStatusMsg.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }

  // 8. Interactive Contact Conversation Form in Section (Connected to Express API)
  const contactForm = document.getElementById('contactForm');
  const formStatus = document.getElementById('formStatusMsg');

  if (contactForm && formStatus) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const nameInput = document.getElementById('contactName');
      const emailInput = document.getElementById('contactEmail');
      const requirementInput = document.getElementById('contactRequirement');
      const messageInput = document.getElementById('contactMessage');
      const honeypotInput = document.getElementById('contactWebsiteHoneypot');
      const submitBtn = document.getElementById('submitBtn');

      const fullName = nameInput?.value.trim();
      const email = emailInput?.value.trim();
      const requirementArea = requirementInput?.options[requirementInput.selectedIndex]?.text || requirementInput?.value;
      const message = messageInput?.value.trim();
      const honeypot = honeypotInput?.value;

      if (!fullName || !email || !message) {
        formStatus.textContent = 'Please fill out all required fields to continue.';
        formStatus.className = 'form-status-msg error';
        formStatus.style.display = 'block';
        return;
      }

      submitBtn.disabled = true;
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<span>Sending message...</span>';
      formStatus.style.display = 'none';

      try {
        const response = await fetchWithWakeupNotice(
          '/api/contact',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              fullName,
              email,
              requirementArea,
              message,
              website: honeypot
            })
          },
          (isWaking, msg) => {
            if (isWaking) {
              formStatus.textContent = msg;
              formStatus.className = 'form-status-msg info';
              formStatus.style.display = 'block';
            }
          }
        );

        const data = await response.json();

        if (response.ok && data.success) {
          contactForm.reset();
          const refText = data.ref_code ? `<br><span style="display:inline-block;margin-top:4px;font-size:0.875rem;">Your reference: <strong>${data.ref_code}</strong>. Please keep it for future correspondence.</span>` : '';
          formStatus.innerHTML = `<strong>Message Received!</strong> Thank you for reaching out. We will connect with you shortly.${refText}`;
          formStatus.className = 'form-status-msg success';
          formStatus.style.display = 'block';

          setTimeout(() => {
            formStatus.style.display = 'none';
          }, 10000);
        } else {
          formStatus.textContent = data.error || 'Failed to send message. Please check your information and try again.';
          formStatus.className = 'form-status-msg error';
          formStatus.style.display = 'block';
        }
      } catch {
        formStatus.textContent = 'Unable to send message right now. Please try again or email us directly at support@quanticustech.com.';
        formStatus.className = 'form-status-msg error';
        formStatus.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }

  // 9. Back To Top Action
  const backToTopBtn = document.getElementById('backToTopBtn');
  if (backToTopBtn) {
    backToTopBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  // =========================================================================
  // 10. HERO SECTION: LIVING DOT FIELD (2D CANVAS) & CINEMATIC MOTION
  // =========================================================================
  const ENABLE_DOTFIELD = true;

  // Living Dot Field Tunables & Constants
  const DOTFIELD_CONFIG = {
    spacingDesktop: 28,        // Grid spacing on desktop (px)
    spacingMobile: 34,         // Grid spacing on tablet/mobile (px)
    spacingLowEnd: 40,         // Grid spacing on low-end hardware (px)
    baseRadius: 1.4,           // Base dot radius (px)
    waveSpeed1: 0.00085,       // Primary undulating wave speed
    waveSpeed2: 0.00110,       // Secondary crossing wave speed
    waveSpeed3: 0.00065,       // Harmonic diagonal wave speed
    lensRadius: 180,           // Cursor & wandering focal lens radius (px)
    lensMaxPush: 16,           // Maximum displacement push away from lens focal point (px)
    lensIdleTimeoutMs: 3000,   // Idle time before autonomous wandering focal light begins (ms)
    loadRippleSpeed: 720,      // Expand speed of the initial load ring (px/s)
    loadRippleWidth: 140,      // Ring thickness of the load ripple (px)
    clickRippleSpeed: 600,     // Expand speed of user click ripples (px/s)
    clickRippleWidth: 120,     // Ring thickness of user click ripples (px)
    maxClickRipples: 3,        // Maximum concurrent user click ripples
    textZoneFeather: 45        // Feathered edge margin for text zone opacity reduction (px)
  };

  const heroSection = document.querySelector('.hero-section');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isFinePointer = window.matchMedia('(pointer: fine)').matches;

  if (heroSection) {
    // Trigger page-load entrance animation
    requestAnimationFrame(() => {
      heroSection.classList.add('is-loaded');
    });

    let isHeroInView = true;
    let dotfieldRafId = null;
    let hasLoadRipplePlayed = false; // In-memory flag: plays ONLY ONCE per page load

    const dotCanvas = document.getElementById('heroDotFieldCanvas');

    if (dotCanvas && ENABLE_DOTFIELD && !prefersReducedMotion) {
      const ctx = dotCanvas.getContext('2d', { alpha: true });
      let canvasW = 0, canvasH = 0;
      let dpr = 1;
      let grid = [];
      let textBounds = { left: 0, top: 0, right: 0, bottom: 0, cx: 0, cy: 0 };
      const contentBlock = heroSection.querySelector('.hero-content-block');

      // Hardware capabilities detection
      const isLowEnd = typeof navigator !== 'undefined' &&
        ((navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
         (navigator.deviceMemory && navigator.deviceMemory <= 4));
      const isMobileScreen = window.innerWidth <= 768;
      const throttlePerformance = isLowEnd || isMobileScreen;
      const effectiveSpacing = throttlePerformance ? 42 : DOTFIELD_CONFIG.spacingDesktop;
      const targetFps = throttlePerformance ? 30 : 60;
      const frameInterval = 1000 / targetFps;
      let lastFrameTime = 0;

      // Lens Focal Point Tracking (Cursor & Autonomous Wandering)
      let targetMouseX = -9999, targetMouseY = -9999;
      let currentMouseX = -9999, currentMouseY = -9999;
      let isPointerInside = false;
      let lastPointerTime = performance.now();
      let wanderActive = !isFinePointer; // On touch devices, wander is always active

      // Ripples Store
      let ripples = [];

      // Precomputed Color/Alpha Batch Buckets (Site Royal Blue to Pale Sky Blue)
      // Bucket 0..6 gives 7 discreet draw calls per frame instead of hundreds
      const COLOR_BUCKETS = [
        'rgba(147, 197, 253, 0.20)', // Pale Sky (Low Wave)
        'rgba(147, 197, 253, 0.32)', // Pale Sky (Mid-Low)
        'rgba(96, 165, 250, 0.44)',  // Medium Sky Blue
        'rgba(59, 130, 246, 0.56)',  // Vibrant Sky Blue
        'rgba(37, 99, 235, 0.68)',   // Site Action Blue
        'rgba(29, 78, 216, 0.80)',   // Site Royal Blue (Crest)
        'rgba(29, 78, 216, 0.94)'    // Highlight Crest / Lens Flare
      ];
      const numBuckets = COLOR_BUCKETS.length;
      let buckets = Array.from({ length: numBuckets }, () => []);

      function updateLayout() {
        const rect = heroSection.getBoundingClientRect();
        dpr = throttlePerformance ? 1 : Math.min(window.devicePixelRatio || 1, 2);
        canvasW = rect.width;
        canvasH = rect.height;
        dotCanvas.width = Math.floor(canvasW * dpr);
        dotCanvas.height = Math.floor(canvasH * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        if (contentBlock) {
          const cRect = contentBlock.getBoundingClientRect();
          textBounds.left = cRect.left - rect.left;
          textBounds.top = cRect.top - rect.top;
          textBounds.right = textBounds.left + cRect.width;
          textBounds.bottom = textBounds.top + cRect.height;
          textBounds.cx = (textBounds.left + textBounds.right) / 2;
          textBounds.cy = (textBounds.top + textBounds.bottom) / 2;
        } else {
          textBounds.cx = canvasW / 2;
          textBounds.cy = canvasH / 2;
        }

        // Build precomputed grid points
        grid = [];
        const spacing = effectiveSpacing;
        const cols = Math.ceil(canvasW / spacing) + 2;
        const rows = Math.ceil(canvasH / spacing) + 2;
        const startX = (canvasW - (cols - 1) * spacing) / 2;
        const startY = (canvasH - (rows - 1) * spacing) / 2;

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            grid.push({
              x: startX + c * spacing,
              y: startY + r * spacing,
              col: c,
              row: r
            });
          }
        }
      }

      updateLayout();
      const resizeObserver = new ResizeObserver(updateLayout);
      resizeObserver.observe(heroSection);
      window.addEventListener('resize', updateLayout, { passive: true });

      // Start Load Ripple (Once per page load)
      if (!hasLoadRipplePlayed && isHeroInView) {
        hasLoadRipplePlayed = true;
        // Stagger load ripple to start right alongside text entrance
        setTimeout(() => {
          const maxDim = Math.hypot(canvasW, canvasH) + DOTFIELD_CONFIG.loadRippleWidth;
          ripples.push({
            x: textBounds.cx,
            y: textBounds.cy,
            startTime: performance.now(),
            speed: DOTFIELD_CONFIG.loadRippleSpeed,
            width: DOTFIELD_CONFIG.loadRippleWidth,
            maxRadius: maxDim,
            intensity: 1.0,
            isLoadRipple: true
          });
        }, 120);
      } else {
        hasLoadRipplePlayed = true;
      }

      // Pointer event listeners for Lens & Click Ripples
      if (isFinePointer) {
        heroSection.addEventListener('mousemove', (e) => {
          const rect = heroSection.getBoundingClientRect();
          targetMouseX = e.clientX - rect.left;
          targetMouseY = e.clientY - rect.top;
          isPointerInside = true;
          wanderActive = false;
          lastPointerTime = performance.now();
        }, { passive: true });

        heroSection.addEventListener('mouseleave', () => {
          isPointerInside = false;
        }, { passive: true });
      }

      // User Click / Tap Ripple (spawns up to 3 ripples, ignores clicks on interactive buttons/links)
      heroSection.addEventListener('pointerdown', (e) => {
        if (e.target.closest('a, button, input, textarea, [role="button"]')) return;
        const rect = heroSection.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        const maxDim = Math.hypot(canvasW, canvasH) + DOTFIELD_CONFIG.clickRippleWidth;

        // Limit concurrent click ripples
        const activeClickRipples = ripples.filter(r => !r.isLoadRipple);
        if (activeClickRipples.length >= DOTFIELD_CONFIG.maxClickRipples) {
          const oldestIdx = ripples.findIndex(r => !r.isLoadRipple);
          if (oldestIdx !== -1) ripples.splice(oldestIdx, 1);
        }

        ripples.push({
          x: clickX,
          y: clickY,
          startTime: performance.now(),
          speed: DOTFIELD_CONFIG.clickRippleSpeed,
          width: DOTFIELD_CONFIG.clickRippleWidth,
          maxRadius: maxDim,
          intensity: 0.85,
          isLoadRipple: false
        });
      });

      // Main Render Animation Loop
      function renderDotField(now) {
        dotfieldRafId = null;
        if (!isHeroInView || document.hidden) return;

        // Frame rate throttling for low-end and mobile devices (capped at 30fps)
        if (throttlePerformance) {
          const elapsed = now - lastFrameTime;
          if (elapsed < frameInterval) {
            dotfieldRafId = requestAnimationFrame(renderDotField);
            return;
          }
          lastFrameTime = now - (elapsed % frameInterval);
        }

        ctx.clearRect(0, 0, canvasW, canvasH);

        // Update Lens focal position
        const dt = 0.016;
        const timeSec = now * 0.001;

        if (isFinePointer) {
          if (now - lastPointerTime > DOTFIELD_CONFIG.lensIdleTimeoutMs) {
            wanderActive = true;
          }

          if (isPointerInside) {
            // Smooth lerp toward mouse
            currentMouseX += (targetMouseX - currentMouseX) * (1 - Math.exp(-12 * dt));
            currentMouseY += (targetMouseY - currentMouseY) * (1 - Math.exp(-12 * dt));
          } else {
            // Mouse left canvas
            if (!wanderActive) {
              currentMouseX += (-9999 - currentMouseX) * 0.1;
              currentMouseY += (-9999 - currentMouseY) * 0.1;
            }
          }
        }

        let focalX = currentMouseX;
        let focalY = currentMouseY;
        let hasActiveLens = (isPointerInside && currentMouseX > -500);

        if (wanderActive || !isFinePointer) {
          // Autonomous organic Lissajous light wandering
          const wx = canvasW * 0.5 + Math.sin(timeSec * 0.42) * (canvasW * 0.36) + Math.cos(timeSec * 0.21) * (canvasW * 0.12);
          const wy = canvasH * 0.5 + Math.cos(timeSec * 0.34) * (canvasH * 0.30) + Math.sin(timeSec * 0.17) * (canvasH * 0.08);

          if (!hasActiveLens) {
            focalX = wx;
            focalY = wy;
            hasActiveLens = true;
          } else {
            // Smoothly blend if returning from mouse
            focalX += (wx - focalX) * 0.05;
            focalY += (wy - focalY) * 0.05;
          }
        }

        // Update & prune ripples
        for (let i = ripples.length - 1; i >= 0; i--) {
          const r = ripples[i];
          const ageSec = (now - r.startTime) * 0.001;
          r.currentRadius = ageSec * r.speed;
          if (r.currentRadius > r.maxRadius) {
            ripples.splice(i, 1);
          }
        }

        // Reset batch buckets
        for (let b = 0; b < numBuckets; b++) {
          buckets[b].length = 0;
        }

        const { baseRadius, waveSpeed1, waveSpeed2, waveSpeed3, lensRadius, lensMaxPush, textZoneFeather } = DOTFIELD_CONFIG;
        const gridLen = grid.length;
        const numRipples = ripples.length;

        for (let i = 0; i < gridLen; i++) {
          const pt = grid[i];
          const px = pt.x;
          const py = pt.y;

          // 1. Overlapping sine waves for organic fluid height field
          const w1 = Math.sin(pt.col * 0.18 + pt.row * 0.12 + now * waveSpeed1);
          const w2 = Math.sin(pt.col * 0.14 - pt.row * 0.20 + now * waveSpeed2);
          const w3 = Math.cos((pt.col + pt.row) * 0.16 + now * waveSpeed3);
          let rawHeight = (w1 + w2 + w3) / 3; // -1..1
          let h = (rawHeight + 1) * 0.5; // normalized 0..1

          let radius = baseRadius + h * 1.6; // 1.4 to 3.0px
          let dispX = 0;
          let dispY = -h * 4.5; // subtle 3D wave lift

          // 2. Ripple expansions
          for (let j = 0; j < numRipples; j++) {
            const rip = ripples[j];
            const distFromCenter = Math.hypot(px - rip.x, py - rip.y);
            const distFromRing = Math.abs(distFromCenter - rip.currentRadius);

            if (distFromRing < rip.width * 0.5) {
              const ringFactor = Math.cos((distFromRing / (rip.width * 0.5)) * (Math.PI * 0.5)) * rip.intensity;
              h += ringFactor * 0.50;
              radius += ringFactor * 1.5;
            }
          }

          // 3. Cursor / Wandering Lens
          if (hasActiveLens) {
            const lensDx = px - focalX;
            const lensDy = py - focalY;
            const lensDist = Math.hypot(lensDx, lensDy);

            if (lensDist < lensRadius) {
              const lensFactor = Math.pow(1 - lensDist / lensRadius, 1.8);
              h += lensFactor * 0.65;
              radius += lensFactor * 1.5;

              // Gentle radial displacement push
              if (lensDist > 1) {
                const push = lensFactor * lensMaxPush;
                dispX += (lensDx / lensDist) * push;
                dispY += (lensDy / lensDist) * push;
              }
            }
          }

          // 4. Text Zone Opacity & Radius Protection
          if (textBounds.right > 0) {
            const dx = Math.max(0, Math.max(textBounds.left - px, px - textBounds.right));
            const dy = Math.max(0, Math.max(textBounds.top - py, py - textBounds.bottom));
            const distToText = Math.hypot(dx, dy);

            if (distToText < textZoneFeather) {
              const feather = distToText / textZoneFeather;
              const textScale = 0.50 + 0.50 * feather;
              h *= textScale;
              radius = Math.max(1.0, radius * textScale);
            }
          }

          // Clamp values
          h = Math.max(0, Math.min(0.999, h));
          radius = Math.max(1.0, Math.min(4.5, radius));

          // Place dot into quantized bucket
          const bucketIndex = Math.min(numBuckets - 1, Math.floor(h * numBuckets));
          buckets[bucketIndex].push(px + dispX, py + dispY, radius);
        }

        // Draw batched buckets
        for (let b = 0; b < numBuckets; b++) {
          const arr = buckets[b];
          const count = arr.length;
          if (count === 0) continue;

          ctx.fillStyle = COLOR_BUCKETS[b];
          ctx.beginPath();
          for (let k = 0; k < count; k += 3) {
            const x = arr[k];
            const y = arr[k + 1];
            const r = arr[k + 2];
            ctx.moveTo(x + r, y);
            ctx.arc(x, y, r, 0, Math.PI * 2);
          }
          ctx.fill();
        }

        dotfieldRafId = requestAnimationFrame(renderDotField);
      }

      function startDotfieldAnimation() {
        if (!dotfieldRafId && isHeroInView && !document.hidden) {
          dotfieldRafId = requestAnimationFrame(renderDotField);
        }
      }

      function stopDotfieldAnimation() {
        if (dotfieldRafId) {
          cancelAnimationFrame(dotfieldRafId);
          dotfieldRafId = null;
        }
      }

      startDotfieldAnimation();

      // Pause when hero is out of view (IntersectionObserver)
      const heroObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          isHeroInView = entry.isIntersecting;
          if (isHeroInView) {
            startDotfieldAnimation();
          } else {
            stopDotfieldAnimation();
          }
        });
      }, { threshold: 0.05 });

      heroObserver.observe(heroSection);

      // Pause when document tab is hidden
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          stopDotfieldAnimation();
        } else {
          startDotfieldAnimation();
        }
      });
    } else {
      // Fallback for prefers-reduced-motion or disabled canvas
      heroSection.classList.add('fallback-static-dots');
    }
  }

  // 11. About Section Timeline Scroll-Triggered Replay Observer
  const aboutTimeline = document.getElementById('aboutTimeline');
  if (aboutTimeline) {
    const timelineObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          aboutTimeline.classList.add('is-visible');
        } else {
          // Reset when leaving viewport so it replays upon next scroll entry
          aboutTimeline.classList.remove('is-visible');
        }
      });
    }, {
      threshold: 0.3,
      rootMargin: '0px 0px -40px 0px'
    });

    timelineObserver.observe(aboutTimeline);
  }

  // 12. Directors Accordion Controller (Data-Driven from GET /api/directors + Fallback + Replay Observer)
  const directorsSection = document.getElementById('directors');
  const dirAccordion = document.getElementById('directorsAccordion');

  function getDirectorInitials(name) {
    if (!name) return 'DK';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  const mobileQuery = window.matchMedia('(max-width: 767.98px)');
  let currentDirObserver = null;

  function setupDirectorsMode() {
    if (!dirAccordion) return;
    const isMobile = mobileQuery.matches;
    const wrappers = dirAccordion.querySelectorAll('.dir-panel-wrapper');

    wrappers.forEach((wrapper) => {
      // Remove any leftover state or inline styles from other mode
      wrapper.classList.remove('is-expanded');
      const panel = wrapper.querySelector('.dir-panel');
      if (panel) {
        panel.removeAttribute('aria-expanded');
        if (isMobile) {
          panel.removeAttribute('role');
          panel.removeAttribute('tabindex');
        } else {
          panel.setAttribute('role', 'button');
          panel.setAttribute('tabindex', '0');
        }
      }
    });
  }

  // Listen for breakpoint changes to switch cleanly between mobile grid and desktop accordion
  if (mobileQuery.addEventListener) {
    mobileQuery.addEventListener('change', setupDirectorsMode);
  } else if (mobileQuery.addListener) {
    mobileQuery.addListener(setupDirectorsMode);
  }

  function bindDirectorsAccordion() {
    if (!directorsSection || !dirAccordion) return;

    setupDirectorsMode();

    // Disconnect previous observer if any
    if (currentDirObserver) {
      currentDirObserver.disconnect();
    }

    // IntersectionObserver for entrance animation replay (Replays on Every Viewport Entry)
    currentDirObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          dirAccordion.classList.add('is-visible');
        } else {
          // Reset when leaving viewport so it replays upon next scroll entry
          dirAccordion.classList.remove('is-visible');
        }
      });
    }, {
      threshold: 0.2,
      rootMargin: '0px 0px -30px 0px'
    });

    currentDirObserver.observe(directorsSection);
  }

  function renderDynamicDirectors(directorsList) {
    if (!dirAccordion) return;
    if (!Array.isArray(directorsList) || directorsList.length === 0) return;

    dirAccordion.innerHTML = '';

    directorsList.forEach((director, index) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'dir-panel-wrapper';
      wrapper.style.setProperty('--dir-index', index);

      const panel = document.createElement('article');
      panel.className = 'dir-panel';
      panel.setAttribute('aria-label', `${director.name}, ${director.role}`);

      // Visual stage
      const visual = document.createElement('div');
      visual.className = 'dir-visual';

      if (director.photo_url) {
        const img = document.createElement('img');
        img.src = director.photo_url;
        img.alt = director.name;
        img.className = 'dir-img';
        img.width = 400;
        img.height = 400;
        img.loading = 'lazy';
        visual.appendChild(img);
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'dir-avatar-placeholder';

        placeholder.innerHTML = `
          <svg class="dir-silhouette-svg" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="40" cy="28" r="14" fill="currentColor" fill-opacity="0.12" stroke="currentColor" stroke-width="2" />
            <path d="M16 68c0-13.255 10.745-24 24-24s24 10.745 24 24" fill="currentColor" fill-opacity="0.12" stroke="currentColor" stroke-width="2" />
          </svg>
        `;

        const badge = document.createElement('span');
        badge.className = 'dir-initials-badge';
        badge.textContent = getDirectorInitials(director.name);
        placeholder.appendChild(badge);

        visual.appendChild(placeholder);
      }

      const overlay = document.createElement('div');
      overlay.className = 'dir-overlay-blur';
      overlay.setAttribute('aria-hidden', 'true');

      const scrim = document.createElement('div');
      scrim.className = 'dir-scrim';
      scrim.setAttribute('aria-hidden', 'true');

      // Content
      const content = document.createElement('div');
      content.className = 'dir-content';

      const textGroup = document.createElement('div');
      textGroup.className = 'dir-text-group';

      const nameEl = document.createElement('h3');
      nameEl.className = 'dir-name';
      nameEl.textContent = director.name;

      const roleEl = document.createElement('div');
      roleEl.className = 'dir-role';
      roleEl.textContent = director.role;

      textGroup.appendChild(nameEl);
      textGroup.appendChild(roleEl);

      const toggleIcon = document.createElement('div');
      toggleIcon.className = 'dir-toggle-icon';
      toggleIcon.setAttribute('aria-hidden', 'true');
      toggleIcon.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      `;

      content.appendChild(textGroup);
      content.appendChild(toggleIcon);

      panel.appendChild(visual);
      panel.appendChild(overlay);
      panel.appendChild(scrim);
      panel.appendChild(content);

      wrapper.appendChild(panel);
      dirAccordion.appendChild(wrapper);
    });

    bindDirectorsAccordion();
  }

  // Initial binding on fallback markup
  bindDirectorsAccordion();

  // Asynchronously fetch dynamic directors from public API with retry support
  if (dirAccordion) {
    fetchWithWakeupNotice('/api/directors')
      .then((res) => {
        if (!res.ok) throw new Error('API returned status ' + res.status);
        return res.json();
      })
      .then((data) => {
        if (data.success && Array.isArray(data.directors) && data.directors.length > 0) {
          renderDynamicDirectors(data.directors);
        }
      })
      .catch((err) => {
        console.warn('Could not load dynamic directors; keeping fallback:', err.message);
      });
  }
});




