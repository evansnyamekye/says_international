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
    submitButton.textContent = 'Submitting...';

    const response = await fetch('/api/admission-submit', {
      method: 'POST',
      body: new FormData(admissionForm)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Submission failed');
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