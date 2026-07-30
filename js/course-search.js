(function () {
    function normalizeText(value) {
        return value
            ? value
                .trim()
                .toLowerCase()
                .replace(/[_-]+/g, ' ')
                .replace(/\s+/g, ' ')
            : '';
    }

    function normalizeCampus(value) {
        return normalizeText(value).replace(/\s+block$/, '');
    }

    function normalizeLevel(value) {
        return normalizeText(value);
    }

    function normalizeInstructor(value) {
        return normalizeText(value);
    }

    function normalizeTerm(value) {
        return normalizeText(value);
    }

    function normalizeValue(name, value) {
        if (!value) {
            return '';
        }

        var trimmedValue = value.trim();

        if (!trimmedValue) {
            return '';
        }

        if (name === 'level' && trimmedValue.toLowerCase() === 'grade level') {
            return '';
        }

        if (name === 'campus' && trimmedValue.toLowerCase() === 'block or campus') {
            return '';
        }

        return trimmedValue;
    }

    function buildSearchParams(form) {
        var formData = new FormData(form);
        var params = new URLSearchParams();

        formData.forEach(function (value, key) {
            var normalizedValue = normalizeValue(key, value);

            if (normalizedValue) {
                params.set(key, normalizedValue);
            }
        });

        return params;
    }

    function setupHomepageSearch() {
        var form = document.querySelector('.gdlr-core-course-search-item .gdlr-core-course-form');

        if (!form) {
            return;
        }

        form.addEventListener('submit', function (event) {
            var params = buildSearchParams(form);
            var targetUrl = new URL('assessment-info.html', window.location.href);

            event.preventDefault();

            params.forEach(function (value, key) {
                targetUrl.searchParams.set(key, value);
            });

            window.location.href = targetUrl.toString();
        });
    }

    function createSummaryMessage(activeFilters, visibleCount, totalCount) {
        var filterParts = [];
        var labels = {
            'course-keywords': 'Subject Name',
            campus: 'Block or Campus',
            level: 'Class or Grade',
            instructor: 'Teacher',
            term: 'Term'
        };

        Object.keys(activeFilters).forEach(function (key) {
            filterParts.push(labels[key] + ': ' + activeFilters[key]);
        });

        if (!filterParts.length) {
            return '';
        }

        if (!visibleCount) {
            return 'No subjects matched the selected filters. Active filters: ' + filterParts.join(' | ');
        }

        return 'Showing ' + visibleCount + ' of ' + totalCount + ' subjects. Active filters: ' + filterParts.join(' | ');
    }

    function upsertSummaryMessage(firstTitleBlock, message) {
        var summaryElement = document.getElementById('says-course-search-summary');

        if (!summaryElement && firstTitleBlock && firstTitleBlock.parentNode) {
            summaryElement = document.createElement('p');
            summaryElement.setAttribute('id', 'says-course-search-summary');
            firstTitleBlock.parentNode.insertBefore(summaryElement, firstTitleBlock);
        }

        if (!summaryElement) {
            return;
        }

        if (!message) {
            summaryElement.remove();
            return;
        }

        summaryElement.textContent = message;
    }

    function collectActiveFilters() {
        var params = new URLSearchParams(window.location.search);
        var activeFilters = {};

        params.forEach(function (value, key) {
            var normalizedValue = normalizeValue(key, value);

            if (normalizedValue) {
                activeFilters[key] = normalizedValue;
            }
        });

        return activeFilters;
    }

    function recordMatchesFilters(record, activeFilters) {
        var searchableText = normalizeText(record.subjectName);

        if (activeFilters['course-keywords']) {
            var keywordTokens = normalizeText(activeFilters['course-keywords']).split(/\s+/).filter(Boolean);
            var hasAllKeywords = keywordTokens.every(function (token) {
                return searchableText.indexOf(token) !== -1;
            });

            if (!hasAllKeywords) {
                return false;
            }
        }

        if (activeFilters.campus && normalizeCampus(record.campus) !== normalizeCampus(activeFilters.campus)) {
            return false;
        }

        if (activeFilters.level && normalizeLevel(record.level) !== normalizeLevel(activeFilters.level)) {
            return false;
        }

        if (activeFilters.instructor && normalizeInstructor(record.teacher) !== normalizeInstructor(activeFilters.instructor)) {
            return false;
        }

        if (activeFilters.term && normalizeTerm(record.term) !== normalizeTerm(activeFilters.term)) {
            return false;
        }

        return true;
    }

    function createRecordMarkup(record) {
        return [
            '<div class="gdlr-core-course-item-list">',
            '<div class="gdlr-core-course-item-title gdlr-core-skin-title">Subject: ' + record.subjectName + '</div>',
            '<div class="gdlr-core-skin-caption">Category: ' + record.category + '</div>',
            '<div class="gdlr-core-skin-caption">Department: ' + record.department.replace(/_/g, ' ') + '</div>',
            '<div class="gdlr-core-skin-caption">Grade: ' + record.level + '</div>',
            '<div class="gdlr-core-skin-caption">Teacher: ' + record.teacher + '</div>',
            '<div class="gdlr-core-skin-caption">Term: ' + record.term + '</div>',
            '<div class="gdlr-core-skin-caption">Block: ' + record.campus + '</div>',
            '<div class="gdlr-core-skin-caption">Pass Mark: ' + record.passMark + '</div>',
            '<div class="gdlr-core-skin-caption">Class Score: ' + record.classScore + '</div>',
            '<div class="gdlr-core-skin-caption">Exam Score: ' + record.examScore + '</div>',
            '</div>'
        ].join('');
    }

    function renderRecordList(container, records) {
        container.innerHTML = records.map(createRecordMarkup).join('');
    }

    function toggleSectionVisibilityByCount(courseContainer, visibleCount) {
        var sectionWrapper = courseContainer.closest('.gdlr-core-pbf-element');
        var titleWrapper = sectionWrapper ? sectionWrapper.previousElementSibling : null;
        var shouldShow = visibleCount > 0;

        if (sectionWrapper) {
            sectionWrapper.hidden = !shouldShow;
        }

        if (titleWrapper && titleWrapper.querySelector('.gdlr-core-title-item')) {
            titleWrapper.hidden = !shouldShow;
        }
    }

    function renderAssessmentResults() {
        var records = window.SAYS_ASSESSMENT_RECORDS;
        var requiredContainer = document.getElementById('says-required-subjects');
        var additionalContainer = document.getElementById('says-additional-subjects');
        var emptyState = document.getElementById('says-no-subject-results');
        var firstTitleBlock = document.querySelector('.gdlr-core-title-item');
        var activeFilters;
        var filteredRecords;
        var requiredRecords;
        var additionalRecords;

        if (!records || !requiredContainer || !additionalContainer) {
            return false;
        }

        activeFilters = collectActiveFilters();
        filteredRecords = records.filter(function (record) {
            return recordMatchesFilters(record, activeFilters);
        });
        requiredRecords = filteredRecords.filter(function (record) {
            return record.category === 'required';
        });
        additionalRecords = filteredRecords.filter(function (record) {
            return record.category === 'additional';
        });

        renderRecordList(requiredContainer, requiredRecords);
        renderRecordList(additionalContainer, additionalRecords);

        toggleSectionVisibilityByCount(requiredContainer, requiredRecords.length);
        toggleSectionVisibilityByCount(additionalContainer, additionalRecords.length);

        if (emptyState) {
            emptyState.hidden = filteredRecords.length > 0;
        }

        upsertSummaryMessage(
            firstTitleBlock,
            createSummaryMessage(activeFilters, filteredRecords.length, records.length)
        );

        return true;
    }

    function matchesFilters(item, activeFilters) {
        var titleElement = item.querySelector('.gdlr-core-course-item-title');
        var courseTitle = titleElement ? titleElement.textContent.trim().toLowerCase() : '';
        var combinedText = courseTitle.trim();

        if (activeFilters['course-keywords']) {
            var keywordTokens = activeFilters['course-keywords'].toLowerCase().split(/\s+/).filter(Boolean);
            var hasAllKeywords = keywordTokens.every(function (token) {
                return combinedText.indexOf(token) !== -1;
            });

            if (!hasAllKeywords) {
                return false;
            }
        }

        return true;
    }

    function toggleSectionVisibility(courseContainer) {
        var sectionWrapper = courseContainer.closest('.gdlr-core-pbf-element');
        var titleWrapper = sectionWrapper ? sectionWrapper.previousElementSibling : null;
        var visibleItems = courseContainer.querySelectorAll('.gdlr-core-course-item-list:not([hidden])').length;
        var shouldShow = visibleItems > 0;

        if (sectionWrapper) {
            sectionWrapper.hidden = !shouldShow;
        }

        if (titleWrapper && titleWrapper.querySelector('.gdlr-core-title-item')) {
            titleWrapper.hidden = !shouldShow;
        }
    }

    function setupCourseListFiltering() {
        var courseContainers = document.querySelectorAll('.gdlr-core-course-item.gdlr-core-course-style-list');
        var activeFilters = collectActiveFilters();
        var firstTitleBlock = document.querySelector('.gdlr-core-title-item');
        var totalCount;
        var visibleCount = 0;

        if (renderAssessmentResults()) {
            return;
        }

        if (!courseContainers.length || !Object.keys(activeFilters).length) {
            return;
        }

        totalCount = document.querySelectorAll('.gdlr-core-course-item-list').length;

        courseContainers.forEach(function (container) {
            var items = container.querySelectorAll('.gdlr-core-course-item-list');

            items.forEach(function (item) {
                var isVisible = matchesFilters(item, activeFilters);

                item.hidden = !isVisible;

                if (isVisible) {
                    visibleCount += 1;
                }
            });

            toggleSectionVisibility(container);
        });

        if (!firstTitleBlock || !firstTitleBlock.parentNode) {
            return;
        }

        upsertSummaryMessage(firstTitleBlock, createSummaryMessage(activeFilters, visibleCount, totalCount));
    }

    document.addEventListener('DOMContentLoaded', function () {
        setupHomepageSearch();
        setupCourseListFiltering();
    });
}());