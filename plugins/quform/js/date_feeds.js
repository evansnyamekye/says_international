document.addEventListener('DOMContentLoaded', () => {
    const dateEl = document.getElementById('dynamic-date');
    const now = new Date();

    // Format: July 16, 2025, 9:34 PM
    const options = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    };

    dateEl.textContent = now.toLocaleString('en-US', options);
  });

