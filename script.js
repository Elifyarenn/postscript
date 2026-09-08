// Reveal sections as they enter the viewport; hero elements rise on load.
document.addEventListener("DOMContentLoaded", function () {
  var revealables = document.querySelectorAll(
    ".hero-copy, .hero-categories, .section-title, .view-all, .card, .feature-block, .footer-logo, .footer-links, .footer-social"
  );

  revealables.forEach(function (element) {
    element.classList.add("reveal");
  });

  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealables.forEach(function (element) {
      observer.observe(element);
    });
  } else {
    revealables.forEach(function (element) {
      element.classList.add("is-visible");
    });
  }
});