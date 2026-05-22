const API = 'https://artisanslms.onrender.com/backend/index.php';

// Known valid TLDs — blocks common typos like .con, .cpm, .ocm
const KNOWN_TLDS = [
    'com', 'net', 'org', 'edu', 'gov', 'mil', 'int',
    'io', 'co', 'ai', 'app', 'dev', 'info', 'biz',
    'ph', 'us', 'uk', 'ca', 'au', 'de', 'fr', 'jp',
    'me', 'tv', 'online', 'site', 'tech', 'store', 'shop',
    'ac', 'sch', 'ngo', 'xyz', 'design', 'studio'
];

// Validates email format and checks TLD against known list
function isValidEmail(email) {
    // Structural check: proper characters, one @, dot in domain
    const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) return { valid: false, warning: false };

    const tld = email.split('.').pop().toLowerCase();
    const isKnownTLD = KNOWN_TLDS.includes(tld);

    return {
        valid: true,
        warning: !isKnownTLD, // Valid format but suspicious TLD
        tld: tld
    };
}

$(function () {
    // Populate department dropdown on registration page
    if ($('#department_id').length) {
        $.ajax({
            url: API,
            method: 'POST',
            xhrFields: { withCredentials: true },
            contentType: 'application/json',
            dataType: 'json',
            data: JSON.stringify({ route: 'auth', action: 'getDepartments' }),
            success: function (res) {
                if (res.status === 'success' && res.departments) {
                    const $select = $('#department_id');
                    $select.empty().append('<option value="" disabled selected>Select your department</option>');
                    res.departments.forEach(function (dept) {
                        $select.append(`<option value="${dept.department_id}">${dept.name}</option>`);
                    });
                }
            },
            error: function () {
                $('#department_id').html('<option value="" disabled selected>Failed to load departments</option>');
            }
        });
    }

    // Session check on Login/Register pages
    $.ajax({
        url: API,
        method: 'POST',
        xhrFields: { withCredentials: true },
        contentType: 'application/json',
        data: JSON.stringify({ route: 'auth', action: 'checkSession' }),
        dataType: 'json',
        success: function (res) {
            if (res.status === 'success' && res.logged_in) {
                window.location.href = res.redirect;
            }
        }
    });

    // --- Login ---
    $('#loginForm').submit(function (e) {
        e.preventDefault();
        $('#alertMsg').addClass('d-none').removeClass('alert-danger alert-success');
        $('#loginBtn').prop('disabled', true)
                      .html('<i class="fas fa-spinner fa-spin"></i> Authenticating...');

        $.ajax({
            url: API,
            method: 'POST',
            xhrFields: { withCredentials: true },
            contentType: 'application/json',
            dataType: 'json',
            data: JSON.stringify({
                route:    'auth',
                action:   'login',
                email:    $('#loginEmail').val(),
                password: $('#loginPassword').val()
            }),
            success: function (res) {
                if (res.status === 'success') {
                    window.location.href = res.redirect;
                } else {
                    $('#alertMsg').removeClass('d-none alert-success')
                                  .addClass('alert-danger')
                                  .text(res.message || 'Login failed. Please try again.');
                    $('#loginBtn').prop('disabled', false)
                                  .html('Sign In <i class="fas fa-arrow-right ms-2"></i>');
                }
            },
            error: function (xhr) {
                console.error('Login error:', xhr.responseText);
                $('#alertMsg').removeClass('d-none').addClass('alert-danger')
                              .text('Server error. Check console for details.');
                $('#loginBtn').prop('disabled', false)
                              .html('Sign In <i class="fas fa-arrow-right ms-2"></i>');
            }
        });
    });

    // --- Real-Time Email TLD Warning ---
    $('#regEmail').on('blur', function () {
        const email = $(this).val().trim();
        if (!email) return;

        const result = isValidEmail(email);
        const $warning = $('#emailWarning');

        if (!result.valid) {
            $warning.removeClass('d-none text-warning text-success')
                    .addClass('text-danger')
                    .html('<i class="fas fa-times me-1"></i> Please enter a valid email address.');
        } else if (result.warning) {
            $warning.removeClass('d-none text-danger text-success')
                    .addClass('text-warning')
                    .html(`<i class="fas fa-exclamation-triangle me-1"></i> ".${result.tld}" looks unusual — did you mean .com or .net?`);
        } else {
            $warning.removeClass('d-none text-danger text-warning')
                    .addClass('text-success')
                    .html('<i class="fas fa-check me-1"></i> Email looks good.');
        }

        $warning.removeClass('d-none');
    });

    // Clear warning while user is typing again
    $('#regEmail').on('input', function () {
        $('#emailWarning').addClass('d-none');
    });

    // --- Real-Time Password Strength Validation ---
    let isPasswordStrong = false;
    $('#regPassword').on('input', function () {
        const pass = $(this).val();

        const hasLength  = pass.length >= 8;
        const hasUpper   = /[A-Z]/.test(pass);
        const hasNumber  = /[0-9]/.test(pass);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pass);

        const toggleRule = (elementId, isValid, text) => {
            if (isValid) {
                $(`#${elementId}`).removeClass('text-danger').addClass('text-success')
                                  .html(`<i class="fas fa-check me-1"></i> ${text}`);
            } else {
                $(`#${elementId}`).removeClass('text-success').addClass('text-danger')
                                  .html(`<i class="fas fa-times me-1"></i> ${text}`);
            }
        };

        toggleRule('rule-length',  hasLength,  'At least 8 characters');
        toggleRule('rule-upper',   hasUpper,   'At least 1 uppercase letter');
        toggleRule('rule-number',  hasNumber,  'At least 1 number');
        toggleRule('rule-special', hasSpecial, 'At least 1 special character');

        isPasswordStrong = hasLength && hasUpper && hasNumber && hasSpecial;
    });

    // --- Register ---
    $('#registerForm').submit(function (e) {
        e.preventDefault();
        $('#alertMsg').addClass('d-none').removeClass('alert-danger alert-success alert-warning');

        const email    = $('#regEmail').val().trim();
        const password = $('#regPassword').val();
        const confirmPassword = $('#regConfirmPassword').val();

        // 1. Validate Email Format
        const emailCheck = isValidEmail(email);
        if (!emailCheck.valid) {
            $('#alertMsg').removeClass('d-none alert-success alert-warning')
                          .addClass('alert-danger')
                          .text('Please enter a valid email address.');
            return;
        }

        // 2. Block suspicious TLDs (e.g. .con instead of .com)
        if (emailCheck.warning) {
            $('#alertMsg').removeClass('d-none alert-success alert-danger')
                          .addClass('alert-warning')
                          .text(`".${emailCheck.tld}" doesn't look like a valid domain. Did you mean .com or .net?`);
            return;
        }

        // 3. Validate Password Strength
        if (!isPasswordStrong) {
            $('#alertMsg').removeClass('d-none alert-success alert-warning')
                          .addClass('alert-danger')
                          .text('Please ensure your password meets all strength requirements.');
            return;
        }

        // 4. Validate Passwords Match
        if (password !== confirmPassword) {
            $('#alertMsg').removeClass('d-none alert-success alert-warning')
                          .addClass('alert-danger')
                          .text('Passwords do not match!');
            return;
        }

        $('#regBtn').prop('disabled', true)
                    .html('<i class="fas fa-spinner fa-spin"></i> Creating Account...');

        $.ajax({
            url: API,
            method: 'POST',
            xhrFields: { withCredentials: true },
            contentType: 'application/json',
            dataType: 'json',
            data: JSON.stringify({
                route:         'auth',
                action:        'register',
                first_name:    $('#regFirstName').val(),
                last_name:     $('#regLastName').val(),
                dob:           $('#regDOB').val(),
                gender:        $('#regGender').val(),
                email:         email,
                password:      password,
                department_id: $('#department_id').val()
            }),
            success: function (res) {
                if (res.status === 'success') {
                    $('#alertMsg').removeClass('d-none alert-danger alert-warning')
                                  .addClass('alert-success')
                                  .text(res.message);

                    // Reset form and password rules UI
                    $('#registerForm').trigger('reset');
                    $('#regPassword').trigger('input');
                    $('#emailWarning').addClass('d-none');

                    setTimeout(() => {
                        window.location.href = '/client/pages/login.html';
                    }, 2000);
                } else {
                    $('#alertMsg').removeClass('d-none alert-success alert-warning')
                                  .addClass('alert-danger')
                                  .text(res.message || 'Registration failed.');
                    $('#regBtn').prop('disabled', false)
                                .html('Create Account <i class="fas fa-user-plus ms-2"></i>');
                }
            },
            error: function (xhr) {
                console.error('Register error:', xhr.responseText);
                $('#alertMsg').removeClass('d-none').addClass('alert-danger')
                              .text('An error occurred. Check console for details.');
                $('#regBtn').prop('disabled', false)
                            .html('Create Account <i class="fas fa-user-plus ms-2"></i>');
            }
        });
    });
});