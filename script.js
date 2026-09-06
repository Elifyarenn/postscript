// Wait until the HTML is fully parsed before touching the elements
document.addEventListener("DOMContentLoaded", function () {

  // The elements we want to reveal, in the order they should appear
  const elements = document.querySelectorAll(
    ".label, .title, .divider, .message, .footer"
  );

  // Reveal each element one after another (150ms between them)
  elements.forEach(function (element, index) {
    setTimeout(function () {
      element.classList.add("is-visible"); // the CSS transition does the animation
    }, 150 * index);
  });

});
