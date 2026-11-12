const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!reduceMotion && 'IntersectionObserver' in window) {
  let index = 0;
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }
  }, { rootMargin: '0px 0px -12% 0px' });

  for (const line of document.querySelectorAll('[data-word-reveal]')) {
    const words = line.textContent.trim().split(/\s+/);
    line.replaceChildren();
    for (const word of words) {
      const span = document.createElement('span');
      span.className = 'word';
      span.textContent = word;
      span.style.transitionDelay = `${index++ * 60}ms`;
      line.append(span, ' ');
      observer.observe(span);
    }
  }
}
