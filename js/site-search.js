(function () {
    var MAX_RESULTS = 6;

    function injectStyles() {
        if (document.getElementById('sis-search-results-style')) return;

        var style = document.createElement('style');
        style.id = 'sis-search-results-style';
        style.textContent = [
            '.says-top-search-cell { position: relative; }',
            '.sis-search-results { display: none; position: absolute; top: 100%; left: 0; right: 0; margin-top: 6px; background: #ffffff; border-radius: 10px; box-shadow: 0 20px 45px rgba(16, 39, 88, 0.18); overflow: hidden; z-index: 10002; text-align: left; }',
            '.sis-search-results.is-open { display: block; }',
            '.sis-search-results a { display: block; padding: 12px 16px; color: #102758; font-size: 14px; font-weight: 600; text-decoration: none; border-bottom: 1px solid rgba(16,39,88,0.08); font-family: Poppins, Arial, sans-serif; }',
            '.sis-search-results a:last-child { border-bottom: none; }',
            '.sis-search-results a:hover, .sis-search-results a.is-active { background: #eef3fb; }',
            '.sis-search-results .sis-search-empty { padding: 12px 16px; color: #6c757d; font-size: 14px; font-family: Poppins, Arial, sans-serif; }'
        ].join('\n');
        document.head.appendChild(style);
    }

    function normalize(value) {
        return String(value || '').toLowerCase().trim();
    }

    function scorePage(page, query) {
        var title = normalize(page.title);
        var keywords = normalize(page.keywords);

        if (!query) return 0;
        if (title === query) return 100;
        if (title.indexOf(query) === 0) return 80;
        if (title.indexOf(query) !== -1) return 60;
        if (keywords.indexOf(query) !== -1) return 40;

        var words = query.split(/\s+/).filter(Boolean);
        if (words.length > 1) {
            var haystack = title + ' ' + keywords;
            var allWordsFound = words.every(function (word) {
                return haystack.indexOf(word) !== -1;
            });
            if (allWordsFound) return 30;
        }

        return 0;
    }

    function getMatches(query) {
        var pages = window.SAYS_SITE_PAGES || [];
        var normalizedQuery = normalize(query);

        if (!normalizedQuery) return [];

        return pages
            .map(function (page) {
                return { page: page, score: scorePage(page, normalizedQuery) };
            })
            .filter(function (entry) {
                return entry.score > 0;
            })
            .sort(function (a, b) {
                return b.score - a.score;
            })
            .slice(0, MAX_RESULTS)
            .map(function (entry) {
                return entry.page;
            });
    }

    function setupSearchForm(form) {
        var input = form.querySelector('.search-field');
        var cell = form.closest('.says-top-search-cell') || form.parentElement;

        if (!input || !cell) return;

        var resultsBox = document.createElement('div');
        resultsBox.className = 'sis-search-results';
        cell.appendChild(resultsBox);

        var activeIndex = -1;

        function closeResults() {
            resultsBox.classList.remove('is-open');
            resultsBox.innerHTML = '';
            activeIndex = -1;
        }

        function renderResults(matches) {
            resultsBox.innerHTML = '';

            if (!matches.length) {
                var empty = document.createElement('div');
                empty.className = 'sis-search-empty';
                empty.textContent = 'No pages found.';
                resultsBox.appendChild(empty);
                resultsBox.classList.add('is-open');
                return;
            }

            matches.forEach(function (page) {
                var link = document.createElement('a');
                link.href = page.url;
                link.textContent = page.title;
                resultsBox.appendChild(link);
            });

            resultsBox.classList.add('is-open');
        }

        function updateActiveHighlight() {
            var links = resultsBox.querySelectorAll('a');
            links.forEach(function (link, index) {
                link.classList.toggle('is-active', index === activeIndex);
            });
        }

        input.addEventListener('input', function () {
            activeIndex = -1;
            var matches = getMatches(input.value);

            if (!input.value.trim()) {
                closeResults();
                return;
            }

            renderResults(matches);
        });

        input.addEventListener('keydown', function (event) {
            var links = resultsBox.querySelectorAll('a');

            if (event.key === 'ArrowDown' && links.length) {
                event.preventDefault();
                activeIndex = (activeIndex + 1) % links.length;
                updateActiveHighlight();
            } else if (event.key === 'ArrowUp' && links.length) {
                event.preventDefault();
                activeIndex = (activeIndex - 1 + links.length) % links.length;
                updateActiveHighlight();
            } else if (event.key === 'Escape') {
                closeResults();
            }
        });

        input.addEventListener('blur', function () {
            window.setTimeout(closeResults, 150);
        });

        form.addEventListener('submit', function (event) {
            event.preventDefault();

            var links = resultsBox.querySelectorAll('a');

            if (activeIndex >= 0 && links[activeIndex]) {
                window.location.href = links[activeIndex].getAttribute('href');
                return;
            }

            var matches = getMatches(input.value);

            if (matches.length) {
                window.location.href = matches[0].url;
            }
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        if (!window.SAYS_SITE_PAGES) return;

        injectStyles();

        document.querySelectorAll('.search-form').forEach(function (form) {
            setupSearchForm(form);
        });
    });
})();
