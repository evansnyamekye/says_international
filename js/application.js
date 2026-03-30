
  const page1 = document.getElementById('page1');
  const page2 = document.getElementById('page2');
  const next1 = document.getElementById('next1');
  const back2 = document.getElementById('back2');

  next1.addEventListener('click', () => {
    if (validatePage1()) {
      page1.classList.remove('active');
      page2.classList.add('active');
    }
  });

  back2.addEventListener('click', () => {
    page2.classList.remove('active');
    page1.classList.add('active');
  });

  // Conditional fields
  const previouslyAppliedRadios = document.querySelectorAll('input[name="previouslyApplied"]');
  const previousYearField = document.getElementById('previousYearField');

  previouslyAppliedRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      previousYearField.style.display = radio.value === 'Yes' ? 'block' : 'none';
      if (radio.value === 'Yes') previousYearField.querySelector('input').required = true;
      else previousYearField.querySelector('input').required = false;
    });
  });

  const specifyRadios = document.querySelectorAll('input[name="specifyCondition"]');
  const specifyDetails = document.getElementById('specifyDetails');

  specifyRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      specifyDetails.style.display = radio.value === 'Yes' ? 'block' : 'none';
    });
  });

  // Validation for Page 1
  function validatePage1() {
    let isValid = true;
    document.querySelectorAll('#page1 .error').forEach(el => el.style.display = 'none');

    const fields = ['studentName', 'parentName', 'email', 'mobilePhone', 'gender', 'religion', 'nationality', 'grade'];
    fields.forEach(id => {
      const input = document.getElementById(id);
      if (!input.value.trim()) {
        document.getElementById(id + 'Error').style.display = 'block';
        isValid = false;
      }
    });

    // Email format
    const email = document.getElementById('email');
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email.value && !emailPattern.test(email.value)) {
      document.getElementById('emailError').textContent = 'Please enter a valid email address.';
      document.getElementById('emailError').style.display = 'block';
      isValid = false;
    }

    // Previous application
    if (!document.querySelector('#page1 input[name="previouslyApplied"]:checked')) {
      document.getElementById('previouslyAppliedError').style.display = 'block';
      isValid = false;
    }

    return isValid;
  }

  // Full form submission
  const form = document.getElementById('admissionForm');
  const successMessage = document.getElementById('successMessage');

  form.addEventListener('submit', function(e) {
    e.preventDefault();

    // Basic validation for required fields on page 2
    let isValid = true;
    const relativeName = document.getElementById('relativeName');
    const relativeTel = document.getElementById('relativeTel');

    if (!relativeName.value.trim()) {
      document.getElementById('relativeNameError').style.display = 'block';
      isValid = false;
    }
    if (!relativeTel.value.trim()) {
      document.getElementById('relativeTelError').style.display = 'block';
      isValid = false;
    }

    if (isValid) {
      form.style.display = 'none';
      successMessage.style.display = 'block';
      // In production: send all data via fetch()
    }
  })
