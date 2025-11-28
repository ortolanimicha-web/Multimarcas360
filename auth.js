// auth.js - Gestión de Sesión Unificada (Tienda Principal + Núcleo)

document.addEventListener('DOMContentLoaded', () => {
    // Verificar si el objeto auth de Firebase existe
    if (typeof auth === 'undefined') {
        console.error("Firebase Auth object is not available. Ensure Firebase SDKs are loaded and initialized correctly before auth.js.");
        return;
    }

    // ==========================================
    // 1. REFERENCIAS DOM (ELEMENTOS HTML)
    // ==========================================

    // --- UI Escritorio (Tienda Principal) ---
    const userLoggedOutDiv = document.getElementById('user-logged-out');
    const userLoggedInDiv = document.getElementById('user-logged-in');
    const userEmailSpan = document.getElementById('user-email');
    const logoutButton = document.getElementById('logout-button');
    const adminLinkDesktop = document.getElementById('admin-link-a');

    // --- UI Móvil (Hamburguesa - Tienda Principal) ---
    const userLoggedOutMobileLi = document.getElementById('user-logged-out-mobile');
    const userLoggedOutMobileRegisterLi = document.getElementById('user-logged-out-mobile-register');
    const userLoggedInMobileLi = document.getElementById('user-logged-in-mobile');
    const logoutButtonMobile = document.getElementById('logout-button-mobile');
    const userEmailSpanMobile = document.getElementById('user-email-mobile');

    // --- UI Electrónica Núcleo (NUEVO) ---
    const nucleoLoginLink = document.getElementById('nucleo-login-link');
    const nucleoAdminLink = document.getElementById('nucleo-admin-link'); // Link "Soy Admin"
    const nucleoUserEmail = document.getElementById('nucleo-user-email'); // Span para email
    const nucleoLogoutBtn = document.getElementById('nucleo-logout-btn'); // Botón Salir

    // --- Formularios (Login/Registro) ---
    const loginForm = document.getElementById('login-form');
    const loginEmailInput = document.getElementById('login-email');
    const loginPasswordInput = document.getElementById('login-password');
    const loginErrorP = document.getElementById('login-error');

    const registerForm = document.getElementById('register-form');
    const registerEmailInput = document.getElementById('register-email');
    const registerPasswordInput = document.getElementById('register-password');
    const registerErrorP = document.getElementById('register-error');

    // ==========================================
    // 2. LISTENER DE CAMBIO DE ESTADO (LOGIN/LOGOUT)
    // ==========================================
    
    auth.onAuthStateChanged(user => {
        if (user) {
            // ---------------------------
            // USUARIO LOGUEADO
            // ---------------------------
            console.log("Usuario logueado:", user.email || (user.isAnonymous ? "Anonimo" : "Desconocido"));

            // A) Actualizar UI Tienda Principal (Escritorio)
            if (userLoggedOutDiv) userLoggedOutDiv.style.display = 'none';
            if (userLoggedInDiv) userLoggedInDiv.style.display = 'flex';
            if (userEmailSpan) userEmailSpan.textContent = user.isAnonymous ? '' : user.email;

            // B) Actualizar UI Tienda Principal (Móvil)
            if (userLoggedOutMobileLi) userLoggedOutMobileLi.style.display = 'none';
            if (userLoggedOutMobileRegisterLi) userLoggedOutMobileRegisterLi.style.display = 'none';
            if (userLoggedInMobileLi) userLoggedInMobileLi.style.display = 'block';
            
            if (userEmailSpanMobile) {
                userEmailSpanMobile.textContent = user.isAnonymous ? '' : user.email;
                userEmailSpanMobile.style.display = user.isAnonymous ? 'none' : 'inline';
            }

            // C) Actualizar UI Electrónica Núcleo
            if (nucleoLoginLink) nucleoLoginLink.style.display = 'none'; // Ocultar "Iniciar Sesión"
            
            if (nucleoUserEmail) {
                nucleoUserEmail.textContent = user.isAnonymous ? '' : user.email;
                nucleoUserEmail.style.display = user.isAnonymous ? 'none' : 'inline';
            }
            
            if (nucleoLogoutBtn) nucleoLogoutBtn.style.display = 'inline-block'; // Mostrar "Salir"

            // D) Verificar Admin (Para ambos sitios)
            if (typeof ADMIN_EMAIL !== 'undefined' && !user.isAnonymous && user.email === ADMIN_EMAIL) {
                console.log("Admin user detected.");
                // Admin Principal
                if (adminLinkDesktop) adminLinkDesktop.style.display = 'inline';
                // Admin Núcleo
                if (nucleoAdminLink) nucleoAdminLink.style.display = 'inline';
            } else {
                if (adminLinkDesktop) adminLinkDesktop.style.display = 'none';
                if (nucleoAdminLink) nucleoAdminLink.style.display = 'none';
            }

        } else {
            // ---------------------------
            // USUARIO DESLOGUEADO
            // ---------------------------
            console.log("Estado: Deslogueado. Intentando inicio anónimo...");

            // Intentar inicio de sesión anónimo (Fallback)
            auth.signInAnonymously().catch((error) => {
                console.error("Error en inicio anónimo:", error);
            });

            // A) Resetear UI Tienda Principal (Escritorio)
            if (userLoggedOutDiv) userLoggedOutDiv.style.display = 'flex';
            if (userLoggedInDiv) userLoggedInDiv.style.display = 'none';
            if (userEmailSpan) userEmailSpan.textContent = '';
            if (adminLinkDesktop) adminLinkDesktop.style.display = 'none';

            // B) Resetear UI Tienda Principal (Móvil)
            if (userLoggedOutMobileLi) userLoggedOutMobileLi.style.display = 'block';
            if (userLoggedOutMobileRegisterLi) userLoggedOutMobileRegisterLi.style.display = 'block';
            if (userLoggedInMobileLi) userLoggedInMobileLi.style.display = 'none';
            if (userEmailSpanMobile) userEmailSpanMobile.style.display = 'none';

            // C) Resetear UI Electrónica Núcleo
            if (nucleoLoginLink) nucleoLoginLink.style.display = 'inline'; // Mostrar link Login
            if (nucleoUserEmail) {
                nucleoUserEmail.textContent = '';
                nucleoUserEmail.style.display = 'none';
            }
            if (nucleoLogoutBtn) nucleoLogoutBtn.style.display = 'none'; // Ocultar botón Salir
            if (nucleoAdminLink) nucleoAdminLink.style.display = 'none'; // Ocultar Admin
        }
    });

    // ==========================================
    // 3. MANEJADORES DE LOGOUT
    // ==========================================

    // Logout Tienda Principal (Escritorio)
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            auth.signOut().then(() => console.log('Logout escritorio OK'));
        });
    }

    // Logout Tienda Principal (Móvil)
    if (logoutButtonMobile) {
        logoutButtonMobile.addEventListener('click', () => {
            auth.signOut().then(() => console.log('Logout móvil OK'));
        });
    }

    // Logout Electrónica Núcleo (NUEVO)
    if (nucleoLogoutBtn) {
        nucleoLogoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            auth.signOut().then(() => {
                console.log('Logout desde Núcleo OK.');
                // Recargamos para limpiar estados visuales inmediatamente
                window.location.reload();
            }).catch((error) => console.error('Error logout Núcleo:', error));
        });
    }

    // ==========================================
    // 4. MANEJADORES DE LOGIN / REGISTRO
    // ==========================================

    // Login Form Handler
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = loginEmailInput.value;
            const password = loginPasswordInput.value;
            
            auth.signInWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    console.log('Login exitoso:', userCredential.user.email);
                    if (loginErrorP) loginErrorP.style.display = 'none';
                    
                    // Redirigir según de dónde vino (Historial) o ir al index
                    // Si estamos en login.html y venimos de nucleo, idealmente deberíamos volver
                    // Por simplicidad, aquí redirigimos a index o recargamos si es modal
                    if (document.referrer.includes('productos-nucleo.html')) {
                         window.location.href = 'productos-nucleo.html';
                    } else {
                         window.location.href = 'index.html';
                    }
                })
                .catch((error) => {
                    console.error('Error Login:', error.code, error.message);
                    if (loginErrorP) {
                        loginErrorP.textContent = getFriendlyAuthErrorMessage(error);
                        loginErrorP.style.display = 'block';
                    }
                });
        });
    }

    // Register Form Handler
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = registerEmailInput.value;
            const password = registerPasswordInput.value;
            
            if (password.length < 6) {
                 if (registerErrorP) {
                    registerErrorP.textContent = 'La contraseña debe tener al menos 6 caracteres.';
                    registerErrorP.style.display = 'block';
                 }
                return;
            }

            auth.createUserWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    console.log('Registro exitoso:', userCredential.user.email);
                     if (registerErrorP) registerErrorP.style.display = 'none';
                    window.location.href = 'index.html';
                })
                .catch((error) => {
                    console.error('Error Registro:', error.code, error.message);
                    if (registerErrorP) {
                        registerErrorP.textContent = getFriendlyAuthErrorMessage(error);
                        registerErrorP.style.display = 'block';
                    }
                });
        });
    }

    // Helper: Mensajes de error amigables
    function getFriendlyAuthErrorMessage(error) {
        switch (error.code) {
            case 'auth/user-not-found': return 'No se encontró usuario con ese correo.';
            case 'auth/wrong-password': return 'Contraseña incorrecta.';
            case 'auth/invalid-email': return 'Correo electrónico inválido.';
            case 'auth/email-already-in-use': return 'Este correo ya está registrado.';
            case 'auth/weak-password': return 'Contraseña muy débil (mínimo 6 caracteres).';
            default: return 'Error: ' + error.message;
        }
    }
// ==========================================
    // 5. LÓGICA ESPECÍFICA PARA LOGIN NÚCLEO
    // ==========================================

    const nucleoLoginForm = document.getElementById('nucleo-login-form');
    const nucleoRegisterForm = document.getElementById('nucleo-register-form');

    // Manejador LOGIN Núcleo
    if (nucleoLoginForm) {
        nucleoLoginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('nucleo-login-email').value;
            const password = document.getElementById('nucleo-login-password').value;
            const errorDiv = document.getElementById('nucleo-login-error');

            auth.signInWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    console.log('Login Núcleo exitoso:', userCredential.user.email);
                    if (errorDiv) errorDiv.style.display = 'none';
                    // Redirigir siempre a la tienda de Núcleo
                    window.location.href = 'productos-nucleo.html';
                })
                .catch((error) => {
                    console.error('Error Login Núcleo:', error);
                    if (errorDiv) {
                        errorDiv.textContent = getFriendlyAuthErrorMessage(error);
                        errorDiv.style.display = 'block';
                    }
                });
        });
    }

    // Manejador REGISTRO Núcleo
    if (nucleoRegisterForm) {
        nucleoRegisterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('nucleo-register-email').value;
            const password = document.getElementById('nucleo-register-password').value;
            const errorDiv = document.getElementById('nucleo-register-error');

            if (password.length < 6) {
                 if (errorDiv) {
                    errorDiv.textContent = 'La contraseña debe tener al menos 6 caracteres.';
                    errorDiv.style.display = 'block';
                 }
                return;
            }

            auth.createUserWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    console.log('Registro Núcleo exitoso:', userCredential.user.email);
                     if (errorDiv) errorDiv.style.display = 'none';
                    window.location.href = 'productos-nucleo.html';
                })
                .catch((error) => {
                    console.error('Error Registro Núcleo:', error);
                    if (errorDiv) {
                        errorDiv.textContent = getFriendlyAuthErrorMessage(error);
                        errorDiv.style.display = 'block';
                    }
                });
        });
    }
}); // Fin DOMContentLoaded