(function () {
    var form = document.getElementById('says-contact-form');

    if (!form) {
        return;
    }

    var statusElement = document.getElementById('says-contact-form-status');
    var submitButton = form.querySelector('button[type="submit"]');
    var submitLabel = submitButton ? submitButton.querySelector('span') : null;
    var defaultButtonText = submitLabel ? submitLabel.textContent : 'Send';

    function setStatus(message, type) {
        if (!statusElement) {
            return;
        }

        statusElement.textContent = message || '';
        statusElement.className = 'says-contact-form-status';

        if (!message) {
            return;
        }

        statusElement.classList.add('is-visible');

        if (type === 'success') {
            statusElement.classList.add('is-success');
        } else if (type === 'error') {
            statusElement.classList.add('is-error');
        }
    }

    function setSubmitting(isSubmitting) {
        form.classList.toggle('is-submitting', isSubmitting);

        if (submitButton) {
            submitButton.disabled = isSubmitting;
        }

        if (submitLabel) {
            submitLabel.textContent = isSubmitting ? 'Sending...' : defaultButtonText;
        }
    }

    function getFieldValue(name) {
        var field = form.elements.namedItem(name);
        return field ? String(field.value || '').trim() : '';
    }

    function getApiUrl() {
        if (window.location.protocol === 'file:') {
            return null;
        }

        return '/api/contact-submit';
    }

    async function handleSubmit(event) {
        event.preventDefault();

        var apiUrl = getApiUrl();
        var payload = {
            name: getFieldValue('name'),
            email: getFieldValue('email'),
            message: getFieldValue('message'),
            source: window.location.pathname.split('/').pop() || 'contact.html'
        };

        if (!apiUrl) {
            setStatus('The contact form needs to be used from the deployed website or a local server, not directly from a file preview.', 'error');
            return;
        }

        if (!payload.name || !payload.email || !payload.message) {
            setStatus('Please complete your name, email address and message before sending.', 'error');
            return;
        }

        setSubmitting(true);
        setStatus('', '');

        try {
            var response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                },
                body: JSON.stringify(payload)
            });

            var data = {};

            try {
                data = await response.json();
            } catch (error) {
                data = {};
            }

            if (!response.ok) {
                throw new Error(data.error || 'Your message could not be sent. Please try again.');
            }

            form.reset();
            setStatus(data.message || 'Your message has been sent successfully.', 'success');
        } catch (error) {
            setStatus(error && error.message ? error.message : 'Your message could not be sent. Please try again.', 'error');
        } finally {
            setSubmitting(false);
        }
    }

    form.addEventListener('submit', handleSubmit);
})();