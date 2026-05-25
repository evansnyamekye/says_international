let currentStep = 1;
const totalSteps = 3;

const admissionForm = document.getElementById('admissionForm');
const submitMessage = document.getElementById('submitMessage');
const submitButton = document.getElementById('submitApplicationButton');



admissionForm.addEventListener('submit', async function(event) {
  event.preventDefault();
  await submitForm();
});

// ==========================
// STEP NAVIGATION
// ==========================

function nextStep() {

  if (!validateCurrentStep()) {
    return;
  }

  if (currentStep < totalSteps) {

    document
      .querySelector(`.step-${currentStep}`)
      .classList.remove('active');

    currentStep++;

    document
      .querySelector(`.step-${currentStep}`)
      .classList.add('active');

    updateProgress();

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }
}


function prevStep() {

  if (currentStep > 1) {

    document
      .querySelector(`.step-${currentStep}`)
      .classList.remove('active');

    currentStep--;

    document
      .querySelector(`.step-${currentStep}`)
      .classList.add('active');

    updateProgress();

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }
}


// ==========================
// PROGRESS BAR
// ==========================

function updateProgress() {

  const progress = (currentStep / totalSteps) * 100;

  document.getElementById('progressBar').style.width = progress + '%';
}


// ==========================
// VALIDATION
// ==========================

function validateCurrentStep() {

  const currentStepElement = document.querySelector(`.step-${currentStep}`);

  const requiredFields = currentStepElement.querySelectorAll(
    'input[required], select[required], textarea[required]'
  );

  let isValid = true;

  // Remove old validation
  currentStepElement.querySelectorAll('.is-invalid').forEach(field => {
    field.classList.remove('is-invalid');
  });


  requiredFields.forEach(field => {

    // File validation
    if (field.type === 'file') {

      if (field.files.length === 0) {
        field.classList.add('is-invalid');
        isValid = false;
      }

    } else {

      if (!field.value.trim()) {
        field.classList.add('is-invalid');
        isValid = false;
      }
    }
  });


  // Email validation
  const emailField = currentStepElement.querySelector('#email');

  if (emailField && emailField.value.trim()) {

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(emailField.value.trim())) {

      emailField.classList.add('is-invalid');
      isValid = false;
    }
  }


  // Scroll to invalid field
  if (!isValid) {

    const firstInvalid = currentStepElement.querySelector('.is-invalid');

    if (firstInvalid) {

      firstInvalid.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });

      firstInvalid.focus();
    }

    alert('Please complete all required fields correctly.');
  }

  return isValid;
}


// ==========================
// SUBMIT FORM
// ==========================

async function submitForm() {

  let allValid = true;

  // Validate all steps
  for (let step = 1; step <= totalSteps; step++) {

    const stepElement = document.querySelector(`.step-${step}`);

    const requiredFields = stepElement.querySelectorAll(
      'input[required], select[required], textarea[required]'
    );

    requiredFields.forEach(field => {

      field.classList.remove('is-invalid');

      if (field.type === 'file') {

        if (field.files.length === 0) {
          field.classList.add('is-invalid');
          allValid = false;
        }

      } else {

        if (!field.value.trim()) {
          field.classList.add('is-invalid');
          allValid = false;
        }
      }
    });
  }


  // Stop if invalid
  if (!allValid) {

    const firstInvalid = document.querySelector('.is-invalid');

    if (firstInvalid) {

      const stepElement = firstInvalid.closest('.step');

      const stepNumber = parseInt(
        stepElement.className.match(/step-(\d+)/)[1]
      );

      document
        .querySelector(`.step-${currentStep}`)
        .classList.remove('active');

      document
        .querySelector(`.step-${stepNumber}`)
        .classList.add('active');

      currentStep = stepNumber;

      updateProgress();

      firstInvalid.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });

      firstInvalid.focus();
    }

    alert('Please fill in all required fields.');
    return;
  }


  try {

    submitButton.disabled = true;
    submitButton.textContent = 'Uploading files...';

    if (!window.vercelBlobUpload) {
      throw new Error('Upload library not loaded. Please refresh the page and try again.');
    }

    const fileInputs = {
      birth_certificate: admissionForm.querySelector('input[name="birth_certificate"]'),
      passport_photo: admissionForm.querySelector('input[name="passport_photo"]'),
      report_cards: admissionForm.querySelector('input[name="report_cards"]'),
    };

    async function uploadOne(file, prefix) {
      const pathname = 'admissions/' + prefix + '/' + Date.now() + '-' + file.name;
      const blob = await window.vercelBlobUpload(pathname, file, {
        contentType: file.type || 'application/octet-stream',
        handleUploadUrl: '/api/admission-upload-token',
      });
      return blob.url;
    }

    let birthCertUrl = null;
    if (fileInputs.birth_certificate && fileInputs.birth_certificate.files.length > 0) {
      birthCertUrl = await uploadOne(fileInputs.birth_certificate.files[0], 'birth-certificates');
    }

    let passportUrl = null;
    if (fileInputs.passport_photo && fileInputs.passport_photo.files.length > 0) {
      passportUrl = await uploadOne(fileInputs.passport_photo.files[0], 'passport-photos');
    }

    const reportCardUrls = [];
    if (fileInputs.report_cards && fileInputs.report_cards.files.length > 0) {
      for (const file of fileInputs.report_cards.files) {
        reportCardUrls.push(await uploadOne(file, 'report-cards'));
      }
    }

    submitButton.textContent = 'Submitting...';

    const formData = new FormData(admissionForm);
    const payload = {};
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) continue;
      payload[key] = value;
    }
    payload.birth_certificate_url = birthCertUrl;
    payload.passport_photo_url = passportUrl;
    payload.report_card_urls = reportCardUrls;

    const response = await fetch('/api/admission-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      const detail = result && result.debug && result.debug.message ? ' — ' + result.debug.message : '';
      throw new Error((result.error || 'Submission failed') + detail);
    }


    setSubmitMessage(
      'Application submitted successfully.',
      'text-success'
    );

    resetApplicationForm();

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

  } catch (error) {

    setSubmitMessage(
      error.message || 'Submission failed.',
      'text-danger'
    );

  } finally {

    submitButton.disabled = false;
    submitButton.textContent = 'Submit Application';
  }
}


// ==========================
// MESSAGE DISPLAY
// ==========================

function setSubmitMessage(message, tone) {

  if (!submitMessage) return;

  submitMessage.textContent = message;

  submitMessage.className =
    'mt-3 text-center ' + (tone || 'text-muted');
}


// ==========================
// RESET FORM
// ==========================

function resetApplicationForm() {

  admissionForm.reset();

  document
    .querySelector(`.step-${currentStep}`)
    .classList.remove('active');

  currentStep = 1;

  document
    .querySelector('.step-1')
    .classList.add('active');

  document.getElementById('previousYearField').style.display = 'none';

  document.getElementById('specifyDetails').style.display = 'none';

  document.getElementById('previousYear').required = false;

  document.getElementById('conditionDetails').required = false;

  admissionForm.querySelectorAll('.is-invalid').forEach(field => {
    field.classList.remove('is-invalid');
  });

  updateProgress();
}


// ==========================
// CONDITIONAL FIELDS
// ==========================

// Previously applied
document
  .querySelectorAll('input[name="previouslyApplied"]')
  .forEach(radio => {

    radio.addEventListener('change', () => {

      const showField = radio.value === 'Yes';

      document.getElementById('previousYearField').style.display =
        showField ? 'block' : 'none';

      document.getElementById('previousYear').required =
        showField;
    });
  });


// Specify condition
document
  .querySelectorAll('input[name="specify_condition"]')
  .forEach(radio => {

    radio.addEventListener('change', () => {

      const showField = radio.value === 'Yes';

      document.getElementById('specifyDetails').style.display =
        showField ? 'block' : 'none';

      document.getElementById('conditionDetails').required =
        showField;
    });
  });


// ==========================
// INITIALIZE
// ==========================

updateProgress();


// ==========================
// GLOBAL FUNCTIONS
// ==========================

window.nextStep = nextStep;
window.prevStep = prevStep;
window.submitForm = submitForm;