(function () {
  if (window.__sisRevealLoaded) return;
  window.__sisRevealLoaded = true;

  function isHomePage() {
    var path = window.location.pathname || '';
    return path === '/' || /\/index\.html?$/i.test(path);
  }

  function disableAnimations() {
    if (document.body) {
      document.body.classList.add('sis-animations-disabled');
    }
    if (document.documentElement) {
      document.documentElement.classList.add('sis-animations-disabled');
    }

    if (!document.getElementById('sis-animations-disabled-style')) {
      var style = document.createElement('style');
      style.id = 'sis-animations-disabled-style';
      style.textContent = [
        'body.sis-animations-disabled *,',
        'body.sis-animations-disabled *::before,',
        'body.sis-animations-disabled *::after,',
        'html.sis-animations-disabled *,',
        'html.sis-animations-disabled *::before,',
        'html.sis-animations-disabled *::after {',
        '  animation: none !important;',
        '  -webkit-animation: none !important;',
        '  transition: none !important;',
        '  -webkit-transition: none !important;',
        '}',
        'body.sis-animations-disabled .sis-reveal,',
        'body.sis-animations-disabled .sis-reveal-pop,',
        'body.sis-animations-disabled [data-gdlr-animation],',
        'body.sis-animations-disabled .gdlr-core-animate-init,',
        'body.sis-animations-disabled .gdlr-core-item-list,',
        'body.sis-animations-disabled .gdlr-core-animate {',
        '  opacity: 1 !important;',
        '  transform: none !important;',
        '  -webkit-transform: none !important;',
        '}'
      ].join('\n');
      document.head.appendChild(style);
    }
  }

  function init() {
    if (!isHomePage()) {
      disableAnimations();
      return;
    }

    var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function addClass(selector, cls) {
      var nodes = document.querySelectorAll(selector);
      for (var i = 0; i < nodes.length; i++) {
        if (!nodes[i].classList.contains(cls)) {
          nodes[i].classList.add(cls);
        }
      }
    }

    addClass('.gdlr-core-pbf-element', 'sis-reveal');
    addClass('.gdlr-core-feature-box-item', 'sis-reveal-pop');

    var targets = document.querySelectorAll('.sis-reveal, .sis-reveal-pop');
    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      targets.forEach(function (el) {
        el.classList.add('is-visible');
      });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.15,
      rootMargin: '0px 0px -10% 0px'
    });

    targets.forEach(function (el) {
      observer.observe(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
