(function () {
  const lightbox = document.getElementById("outreach-lightbox");
  const lightboxImage = document.getElementById("lightbox-image");
  const lightboxCaption = document.getElementById("lightbox-caption");
  const lightboxCounter = document.getElementById("lightbox-counter");
  const closeButton = document.getElementById("lightbox-close");
  const previousButton = document.getElementById("lightbox-prev");
  const nextButton = document.getElementById("lightbox-next");
  var lastFocusedElement = null;
  var sectionImages = [];
  var currentImageIndex = 0;

  function showImage(index) {
    currentImageIndex = (index + sectionImages.length) % sectionImages.length;
    const button = sectionImages[currentImageIndex];
    const image = button.querySelector("img");
    lightboxImage.src = button.dataset.full;
    lightboxImage.alt = image.alt;
    lightboxCaption.textContent = button.dataset.caption;
    lightboxCounter.textContent =
      currentImageIndex + 1 + " of " + sectionImages.length;
    lightbox.setAttribute("aria-label", image.alt);
  }

  function closeLightbox() {
    lightbox.hidden = true;
    document.body.style.overflow = "";
    if (lastFocusedElement) lastFocusedElement.focus();
  }

  document.querySelectorAll(".photo-button").forEach(function (button) {
    button.addEventListener("click", function () {
      lastFocusedElement = button;
      sectionImages = Array.from(
        button.closest(".outreach-year").querySelectorAll(".photo-button"),
      );
      showImage(sectionImages.indexOf(button));
      lightbox.hidden = false;
      document.body.style.overflow = "hidden";
      closeButton.focus();
    });
  });

  previousButton.addEventListener("click", function () {
    showImage(currentImageIndex - 1);
  });
  nextButton.addEventListener("click", function () {
    showImage(currentImageIndex + 1);
  });
  closeButton.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", function (event) {
    if (event.target === lightbox) closeLightbox();
  });
  document.addEventListener("keydown", function (event) {
    if (lightbox.hidden) return;
    if (event.key === "Escape") closeLightbox();
    if (event.key === "ArrowLeft") showImage(currentImageIndex - 1);
    if (event.key === "ArrowRight") showImage(currentImageIndex + 1);
  });
})();
