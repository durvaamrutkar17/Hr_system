export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_REGEX = /^\d{10}$/;
export const NAME_REGEX = /^[A-Za-z][A-Za-z\s'-]{1,49}$/;

// Validates the shared fields used by the Register and Add Employee forms.
export const validateEmployeeForm = (form) => {
  const errors = {};

  if (!form.firstName.trim()) errors.firstName = 'First name is required';
  else if (!NAME_REGEX.test(form.firstName.trim())) errors.firstName = 'Enter a valid first name';

  if (!form.lastName.trim()) errors.lastName = 'Last name is required';
  else if (!NAME_REGEX.test(form.lastName.trim())) errors.lastName = 'Enter a valid last name';

  if (!form.email.trim()) errors.email = 'Email is required';
  else if (!EMAIL_REGEX.test(form.email.trim())) errors.email = 'Enter a valid email address';

  if (!form.password) errors.password = 'Password is required';
  else if (form.password.length < 6) errors.password = 'Password must be at least 6 characters';

  if (!form.phone.trim()) errors.phone = 'Phone number is required';
  else if (!PHONE_REGEX.test(form.phone.trim())) errors.phone = 'Enter a valid 10-digit phone number';

  if (!form.designation.trim()) errors.designation = 'Designation is required';

  if (!form.department) errors.department = 'Department is required';

  if (!form.dateOfJoining) {
    errors.dateOfJoining = 'Date of joining is required';
  } else {
    const doj = new Date(form.dateOfJoining);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    if (doj > endOfToday) errors.dateOfJoining = 'Date of joining cannot be in the future';
  }

  return errors;
};
