const API = 'https://artisanslms.onrender.com/backend/index.php';

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
        method: 'POST', // Changed to POST to match your controller setup
        xhrFields: { withCredentials: true },
        contentType: 'application/json',
        data: JSON.stringify({ route: 'auth', action: 'checkSession' }), // Use checkSession
        dataType: 'json',
        success: function (res) {
            if (res.status === 'success' && res.logged_in) {
                // If already logged in, move to the dashboard
                window.location.href = res.redirect;
            }
        }
    });

    // Login
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

  // Register
    $('#registerForm').submit(function (e) {
        e.preventDefault();
        $('#alertMsg').addClass('d-none').removeClass('alert-danger alert-success');

        const password        = $('#regPassword').val();
        const confirmPassword = $('#regConfirmPassword').val();

        if (password !== confirmPassword) {
            $('#alertMsg').removeClass('d-none alert-success')
                          .addClass('alert-danger').text('Passwords do not match!');
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
                email:         $('#regEmail').val(),
                password:      password,
                department_id: $('#department_id').val() // <-- Added this line
            }),
            success: function (res) {
                if (res.status === 'success') {
                    $('#alertMsg').removeClass('d-none alert-danger')
                                  .addClass('alert-success').text(res.message);
                    $('#registerForm').trigger('reset');
                    setTimeout(() => {
                        window.location.href = '/client/pages/login.html';
                    }, 2000);
                } else {
                    $('#alertMsg').removeClass('d-none alert-success')
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