 document.addEventListener('DOMContentLoaded', () => {
    const imageUrl = 'https://example.com/path-to-your-image.jpg'; // Replace with your dynamic image URL
    const imageLink = 'https://example.com/news-item'; // Replace with actual link

    const img = document.getElementById('dynamic-image');
    const link = document.getElementById('dynamic-image-link');

    img.src = imageUrl;
    link.href = imageLink;
  });

