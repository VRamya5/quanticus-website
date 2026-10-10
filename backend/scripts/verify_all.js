const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('  RUNNING COMPLETE VERIFICATION SUITE');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

function assert(condition, name, details = '') {
  if (condition) {
    console.log(`  [PASS] ${name}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${name} ${details ? '- ' + details : ''}`);
    failed++;
  }
}

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/main.css', 'utf8');
const js = fs.readFileSync('js/app.js', 'utf8');

// 1. Check Navbar Work link
assert(html.includes('<a href="#work" class="nav-link">Work</a>'), 'Navbar contains Work link');
const navServicesIdx = html.indexOf('href="#services"');
const navWorkIdx = html.indexOf('href="#work"');
const navProcessIdx = html.indexOf('href="#process"');
assert(navServicesIdx !== -1 && navWorkIdx !== -1 && navProcessIdx !== -1 && navServicesIdx < navWorkIdx && navWorkIdx < navProcessIdx, 'Navbar Work link is positioned between Services and Process');

// 2. Check Work section restored
assert(html.includes('id="work"'), 'Work section (id="work") exists in index.html');
assert(html.includes('Curated Project Showcase'), 'Work section has Curated Project Showcase heading');
assert(html.includes('Capital Plus Trading App'), 'Work section has Capital Plus Trading App');
assert(html.includes('Portfolio Plus'), 'Work section has Portfolio Plus');
assert(html.includes('Custom HRMS'), 'Work section has Custom HRMS');
assert(html.includes('CRM Platform'), 'Work section has CRM Platform');

// 3. Check Clients section and footer clients link stay removed
assert(!html.includes('id="clients"'), 'Clients section is NOT restored (remains removed)');
assert(!html.includes('href="#clients"'), 'Footer Clients link is NOT restored (remains removed)');
assert(html.includes('<li><a href="#work" class="footer-link">Work</a></li>'), 'Footer contains Work link');

// 4. Check Task 2 - How We Work
assert(html.includes('From first chat to working software.'), 'Subtitle is exactly "From first chat to working software."');
assert(html.includes('We listen first. We learn what isn\'t working and what you need.'), 'UNDERSTAND text matches exact requirement');
assert(html.includes('We agree what to build and in what order, before any code is written.'), 'PLAN text matches exact requirement');
assert(html.includes('We build in small steps and show you progress as we go.'), 'BUILD text matches exact requirement');
assert(html.includes('We keep it running and improve it as your needs change.'), 'SUPPORT & EVOLVE text matches exact requirement');

// Check no number badges in How We Work cards
assert(!html.includes('process-step-num'), 'Number badges (01, 02, etc.) removed from How We Work');

// Check SVGs and icons
assert(html.includes('icon-understand') && html.includes('bubble-back') && html.includes('bubble-front') && html.includes('speech-dot'), 'Understand icon has speech bubbles and 3 dots');
assert(html.includes('icon-plan') && html.includes('plan-frame') && html.includes('plan-line') && html.includes('plan-tick'), 'Plan icon has checklist card, 3 lines, and 3 ticks');
assert(html.includes('icon-build') && html.includes('bracket-left') && html.includes('code-slash') && html.includes('cursor-blink'), 'Build icon has < />, slash, and blinking cursor');
assert(html.includes('icon-support') && html.includes('shield-body') && html.includes('shield-tick') && html.includes('shield-pulse-ring'), 'Support icon has shield, tick, and pulsing ring');
assert(html.includes('process-icon-tile" aria-hidden="true"'), 'Icon tiles have aria-hidden="true" for accessibility');

// 5. Check CSS for Work and How We Work
assert(css.includes('.work-grid'), 'CSS includes .work-grid');
assert(css.includes('.project-card'), 'CSS includes .project-card');
assert(css.includes('.mobile-phone-frame'), 'CSS includes .mobile-phone-frame');
assert(css.includes('.browser-web-frame'), 'CSS includes .browser-web-frame');
assert(css.includes('.process-icon-tile'), 'CSS includes .process-icon-tile (44px tile)');
assert(css.includes('typingDots'), 'CSS includes typingDots animation for speech bubble dots');
assert(css.includes('cursorBlink'), 'CSS includes cursorBlink animation for code cursor');
assert(css.includes('shieldPulse'), 'CSS includes shieldPulse animation for shield ring');
assert(css.includes('hoverDrawReplay'), 'CSS includes hover draw replay animation');
assert(css.includes('prefers-reduced-motion'), 'CSS respects prefers-reduced-motion');

// 6. Check JS Observer for Process
assert(js.includes('processSection') && js.includes('processJourney'), 'JS has observer for processJourney');
assert(js.includes('threshold: 0.3'), 'Process observer uses threshold 0.3');
assert(js.includes('processJourney.classList.add(\'is-visible\')'), 'Process observer adds is-visible on enter');
assert(js.includes('processJourney.classList.remove(\'is-visible\')'), 'Process observer removes is-visible on leave (replays every time)');

// 7. Verify rewound state: No contact form header block
assert(!html.includes('contact-form-header'), 'Contact form header block is removed');
assert(!html.includes('Send us an enquiry'), 'Contact form title "Send us an enquiry" is removed');

// 8. Verify rewound state: No logo-shine classes or keyframes
assert(!html.includes('logo-shine'), 'index.html contains no logo-shine class');
const adminHtml = fs.readFileSync('admin/index.html', 'utf8');
const adminCss = fs.readFileSync('admin/admin.css', 'utf8');
const adminJs = fs.readFileSync('admin/admin.js', 'utf8');

assert(!adminHtml.includes('logo-shine'), 'admin/index.html contains no logo-shine class');
assert(!css.includes('.logo-shine'), 'css/main.css contains no .logo-shine class');
assert(!adminCss.includes('.logo-shine'), 'admin/admin.css contains no .logo-shine class');
assert(!js.includes('tab-hidden'), 'js/app.js contains no tab-hidden logic');
assert(!adminJs.includes('tab-hidden'), 'admin/admin.js contains no tab-hidden logic');

console.log('\n================================================================');
console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================\n');

if (failed > 0) process.exit(1);

