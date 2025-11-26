// --- Función Auxiliar: Calcular Precio con Promos ---
function getPriceForQuantity(basePrice, quantity, promos) {
    let finalPrice = basePrice;
    
    if (promos && Array.isArray(promos) && promos.length > 0) {
        // Ordenamos las promos de mayor cantidad a menor para encontrar la escala correcta
        const sortedPromos = [...promos].sort((a, b) => b.quantity - a.quantity);
        
        // Buscamos la primera promo que cumpla con la cantidad
        const applicablePromo = sortedPromos.find(p => quantity >= p.quantity);
        
        if (applicablePromo) {
            finalPrice = applicablePromo.unitPrice;
        }
    }
    return finalPrice;
}
// ==========================================================
// === LÓGICA DEL CARRITO Y CARGA/ADMIN DE PRODUCTOS (app.js) ===
// ==========================================================
// v1.25 - Corregido Admin Table (Popularidad y Acciones)

// Variable global para el intervalo del carrusel principal
let heroCarouselInterval = null;

// Variable global para el intervalo del carrusel Oportunidad MK
let oportunidadCarouselInterval = null;

// --- Funciones Helpers para LocalStorage ---
function getCarritoFromStorage() {
    try {
        const carritoJSON = localStorage.getItem('carrito');
        return carritoJSON ? JSON.parse(carritoJSON) : [];
    } catch (e) {
        console.error("Error leyendo carrito de LocalStorage:", e);
        return []; // Devolver vacío en caso de error
    }
}
function saveCarritoToStorage(carrito) {
     try {
        localStorage.setItem('carrito', JSON.stringify(carrito));
    } catch (e) {
         console.error("Error guardando carrito en LocalStorage:", e);
    }
}

// --- LÓGICA DE INICIO ---
document.addEventListener('DOMContentLoaded', () => {
    
    // === NUEVO: INICIALIZAR CARRITO LATERAL INMEDIATAMENTE ===
    // Lo ponemos aquí para que funcione al instante, sin esperar a Firebase
    setupSideCart(); 
    // =========================================================

    console.log("DOM Cargado. Esperando inicialización de Firebase...");
    let checkFirebaseInterval = setInterval(() => {
        if (typeof db !== 'undefined' && typeof auth !== 'undefined' && typeof ADMIN_EMAIL !== 'undefined') {
            clearInterval(checkFirebaseInterval); 
            console.log("Firebase y config OK detectados. Inicializando lógica de la página...");
            try {
                 initializePageLogic(); 
            } catch(e) {
                console.error("Error CRÍTICO durante initializePageLogic:", e);
                 displayError(document.querySelector('main'), "Error fatal al inicializar la página.");
            }
        }
    }, 150); 

    setTimeout(() => {
        if (typeof db === 'undefined' || typeof auth === 'undefined') {
            clearInterval(checkFirebaseInterval);
            console.error("Firebase no se inicializó después de 5 segundos.");
            displayError(document.querySelector('main'), "Error: No se pudo conectar a los servicios de Firebase.");
        }
    }, 5000); 

}); // Fin DOMContentLoaded


// --- Función separada para la lógica de inicialización de página ---
function initializePageLogic()
 {
    
    // === NUEVO: Inicializar Carrito Lateral en TODAS las páginas ===
    setupSideCart(); 
    // ==============================================================

    // Lógica Común
    if (typeof actualizarContadorCarrito === 'function') {
        actualizarContadorCarrito();
    }
    setupSearchForm();
    setupHamburgerMenu();

    // Lógica Específica
    const pathname = window.location.pathname; 
    const pathParts = pathname.split('/').filter(part => part !== '');
    const rawPageName = pathParts.length > 0 ? pathParts[pathParts.length - 1] : 'index';
    const currentPage = rawPageName.replace('.html', '');

    console.log("Página actual detectada (normalizada):", currentPage); 

    try {
        const catalogoContainerCliente = document.getElementById('catalogo-container');
        
        // === ACTUALIZACIÓN PARA NÚCLEO (SEPARADO) ===
        // Detectamos si estamos en alguna de las páginas de categoría GENÉRICAS
        const isCategoryPage = catalogoContainerCliente &&
                                (currentPage === 'productos-marykay' ||
                                 currentPage === 'productos-biogreen' ||
                                 currentPage === 'productos-arbell' ||
                                 currentPage === 'productos-nexo'); 

        if (isCategoryPage) {
            let brand = null;
            if (currentPage === 'productos-marykay') brand = 'marykay';
            else if (currentPage === 'productos-biogreen') brand = 'biogreen';
            else if (currentPage === 'productos-arbell') brand = 'arbell';
            else if (currentPage === 'productos-nexo') brand = 'nexo';

            if (brand) {
                console.log(`Cargando catálogo por categorías para: ${brand}`);
                auth.onAuthStateChanged(user => {
                    if (user) {
                        console.log("Auth listo para catálogo por categorías, iniciando...");
                        loadIntermediateBanner(brand);
                        iniciarCatalogoPorCategorias(brand, catalogoContainerCliente);
                    }
                });
            }
        }
        
        // === LÓGICA ESPECÍFICA PARA ELECTRÓNICA NÚCLEO ===
        else if (currentPage === 'productos-nucleo') {
            console.log("Ejecutando lógica específica para Electrónica Núcleo...");
            setupNucleoLogic(); 
        }

        // Páginas de Catálogo Productos Cliente (SOLO Novedades ahora)
        else if (catalogoContainerCliente && currentPage !== 'admin' && currentPage.startsWith('productos-')) {
            const productosContainerCliente = document.getElementById('productos-container') || catalogoContainerCliente;
            
            let brandFilter = null;
            if (currentPage === 'productos-novedades') brandFilter = 'novedades';

            if (brandFilter) {
                console.log("Cargando productos cliente (vista plana) para marca:", brandFilter);
                 auth.onAuthStateChanged(user => {
                     if (user) {
                         console.log("Auth listo para productos cliente (plano), cargando...");
                         cargarProductosCliente(brandFilter, productosContainerCliente);
                     }
                 });
            } else if (!isCategoryPage && currentPage !== 'productos-nucleo') { 
                 console.warn("No se pudo determinar la marca para filtrar productos en:", pathname);
            }
        }
        // PÁGINA UNIVERSAL DE CATEGORÍA NÚCLEO
else if (currentPage === 'categoria-nucleo' || document.getElementById('dynamic-cat-title')) {
            console.log("✅ Página de Categoría Universal detectada (por ID o Nombre).");
            
            const params = new URLSearchParams(window.location.search);
            const catId = params.get('id');
            const container = document.getElementById('catalogo-container');
            const titleH1 = document.getElementById('dynamic-cat-title');
            
            // Verificamos si loadUniversalCategoryLogic existe antes de llamarla
            if (typeof loadUniversalCategoryLogic === 'function') {
                if (catId) {
                    // Si hay ID en la URL, cargamos los productos
                    loadUniversalCategoryLogic(catId);
                } else {
                    // Si NO hay ID (abriste el archivo directo), mostramos aviso
                    console.warn("No se detectó ID en la URL");
                    if(titleH1) titleH1.textContent = "Bienvenido al Catálogo";
                    if(container) {
                        container.innerHTML = `
                            <div style="text-align:center; padding: 40px;">
                                <i class="fas fa-search" style="font-size: 3rem; color: #6f42c1; margin-bottom: 15px;"></i>
                                <h3>Selecciona una categoría para empezar</h3>
                                <p>Para ver productos, debes elegir una categoría desde el menú principal.</p>
                                <a href="productos-nucleo.html" class="nucleo-btn" style="margin-top:20px; display:inline-block; background:#6f42c1; color:white;">Ir al Menú</a>
                            </div>
                        `;
                    }
                }
            } else {
                console.error("Error: La función loadUniversalCategoryLogic no está definida.");
            }
        }
        // Página de Admin General
        else if (currentPage === 'admin') {
             console.log("Ejecutando lógica para admin.html.");
             auth.onAuthStateChanged(user => {
                if (user && user.email === ADMIN_EMAIL) {
                    console.log("Admin verificado en admin.html.");
                    Promise.all([
                         loadCategoriesAdmin(),
                         cargarProductosAdmin(),
                         loadHomepageSettingsAdmin(), 
                         loadCategoryBannersAdmin(),
                         loadPageImagesAdmin()
                    ]).then(() => {
                         setupAddProductForm();
                         setupHomepageSettingsForm(); 
                         setupCategoryForm();
                         setupCategoryBannersForm();
                         setupPageImagesForm();
                         console.log("Componentes de admin inicializados.");
                    }).catch(adminInitError => {
                         console.error("Error al inicializar componentes de admin:", adminInitError);
                         displayError(document.querySelector('.admin-container'), "Error al cargar datos del panel.");
                    });
                } else if (user) {
                     console.warn('Acceso denegado a admin.html (onAuthStateChanged no es admin):', user.email || user.uid);
                     const adminMain = document.querySelector('.admin-container');
                     if (adminMain) adminMain.innerHTML = '<h2>Acceso Denegado</h2><p>Debes ser administrador.</p>';
                } else {
                     console.warn('Acceso denegado a admin.html (onAuthStateChanged no hay usuario). Redirigiendo a login...');
                     window.location.href = 'login.html'; 
                }
            });
        }
        // Página de Admin Núcleo
        else if (currentPage === 'admin-nucleo') {
             console.log("Ejecutando lógica para admin-nucleo.html.");
             if (typeof initializeNucleoAdminPage === 'function') {
                 initializeNucleoAdminPage();
             }
        }

        // Página del Carrito
        else if (currentPage === 'carrito') {
            console.log("Ejecutando lógica para carrito.html");
            const contenedorCarritoHTML = document.getElementById('carrito-container');
            if (contenedorCarritoHTML) {
                renderizarCarrito();
            } else { console.warn("Contenedor del carrito no encontrado."); }
        }
        // Página de Búsqueda
        else if (currentPage === 'busqueda') {
            console.log("Ejecutando lógica para busqueda.html");
             auth.onAuthStateChanged(user => {
                if (user) {
                    console.log("Auth listo en busqueda.html, ejecutando búsqueda...");
                    executeSearchPageQuery();
                }
             });
        }
        
        // Página de Detalle de Producto
        else if (currentPage === 'producto-detalle') {
            console.log("Ejecutando lógica para producto-detalle.html");
            const params = new URLSearchParams(window.location.search);
            const productId = params.get('id'); 
            
            if (!productId) {
                 console.error("No se proporcionó ID de producto en la URL.");
                 displayError(document.querySelector('.detalle-producto-container'), "Error: No se especificó ningún producto.");
                 const loadingMsg = document.querySelector('.detalle-producto-container .loading-message');
                 if(loadingMsg) loadingMsg.style.display = 'none';
                 return;
            }
            
            auth.onAuthStateChanged(user => {
                if (user) {
                    console.log(`Auth listo en detalle.html, cargando producto ID: ${productId}`);
                    loadProductDetails(productId); 
                }
             });
        }
// --- NUEVO: Página Detalle Núcleo (PEGA ESTO AQUÍ) ---
        else if (currentPage === 'nucleo-detalle') {
            console.log("Ejecutando lógica para nucleo-detalle.html");
            const params = new URLSearchParams(window.location.search);
            const productId = params.get('id');
            
            if (productId) {
                // Llamamos a la nueva función de carga específica
                loadNucleoProductDetailsPage(productId);
            } else {
                console.error("No ID provided for Nucleo detail");
            }
        }
        // Página de Inicio
        else if (currentPage === 'inicio') {
            console.log("Ejecutando lógica para inicio.html");
             auth.onAuthStateChanged(user => {
                if (user) {
                    console.log("Auth listo en inicio.html, cargando carrusel...");
                    loadAndStartHeroCarousel();
                } else {
                    console.warn("Auth.onAuthStateChanged en inicio.html: Usuario aún no disponible. Mostrando fallback.");
                    showStaticHeroContent(); 
                }
             });
        }
        // Página Oportunidad MK
        else if (currentPage === 'oportunidad-mk') {
             console.log("Ejecutando lógica para oportunidad-mk.html");
             startOportunidadCarousel();
        }
        // Página Quiero Ser Consultora
        else if (currentPage === 'quiero-ser-consultora') {
             console.log("Ejecutando lógica para quiero-ser-consultora.html");
             auth.onAuthStateChanged(user => {
                 if (user) {
                     console.log("Auth listo en Consultora, cargando imagen...");
                     loadConsultoraImage(); 
                 } else {
                     console.warn("Auth aún no listo para cargar imagen de Consultora.");
                 }
             });
        }
        // Lógica para la página de Línea de Color
        else if (currentPage === 'linea-de-color-marykay') {
            console.log("Ejecutando lógica para linea-de-color-marykay.html");
            auth.onAuthStateChanged(user => {
                if (user) {
                    console.log("Auth listo para la página de Línea de Color.");
                }
            });
        }
        // Página Mayorista
        else if (currentPage === 'mayorista')
            
             {
            console.log("Ejecutando lógica para Mayorista...");
            setupMayoristaLogic();
            setupMayoristaSearchForm();
        }
        // Página de RESULTADOS Búsqueda Mayorista (NUEVO)
        else if (currentPage === 'mayorista-busqueda') {
            console.log("Ejecutando búsqueda mayorista...");
            setupMayoristaSearchForm(); // Permitir buscar de nuevo
            
            const params = new URLSearchParams(window.location.search);
            const query = params.get('q');
            
            if(query) {
                executeMayoristaSearch(query);
            } else {
                document.getElementById('mayorista-search-results').innerHTML = '<p class="mensaje-vacio">Escribe algo para buscar.</p>';
            }
        }
        else if (currentPage === 'mayorista-detalle') {
            console.log("Ejecutando lógica para Detalle Mayorista...");
            const params = new URLSearchParams(window.location.search);
            const productId = params.get('id');
            
            if (productId) {
                // Esta función debe estar definida al final de tu archivo app.js
                loadMayoristaProductDetails(productId);
            } else {
                console.error("No se encontró ID de producto en la URL");
                document.getElementById('may-loading').textContent = "Error: Falta el ID del producto.";
            }
        }
        
        
        else {
            console.log("Página no requiere lógica especial:", currentPage);
        }
    } catch (pageLogicError) {
         console.error(`Error en lógica de ${currentPage}:`, pageLogicError);
         displayError(document.querySelector('main'), "Ocurrió un error inesperado.");
    }
}

// --- Helper para mostrar errores ---
function displayError(container, message) {
    if (!container) {
        console.error("Contenedor no válido para mostrar error:", message);
        return;
    }
    let errorElement = container.querySelector('.app-error-message');
    if (!errorElement) {
        errorElement = document.createElement('p');
        errorElement.className = 'error-message app-error-message'; 
        errorElement.style.color = 'red';
        errorElement.style.fontWeight = 'bold';
        errorElement.style.textAlign = 'center';
        errorElement.style.padding = '1rem';
        const heading = container.querySelector('h2, h3, h4');
        if (heading && heading.nextSibling) {
             container.insertBefore(errorElement, heading.nextSibling);
        } else {
             container.prepend(errorElement); 
        }
    }
    const loadingMsg = container.querySelector('.loading-message');
    if (loadingMsg) loadingMsg.style.display = 'none';

    errorElement.textContent = message + " Revisa la consola (F12) para detalles.";
    console.error("Mensaje de error mostrado:", message); 
}

// --- Helper para contenido estático del banner ---
function showStaticHeroContent() {
     const heroBannerElement = document.querySelector('.hero-banner');
     if (heroBannerElement) {
         const slidesContainer = heroBannerElement.querySelector('.hero-carousel-slides');
         if (slidesContainer) slidesContainer.innerHTML = ''; 
         const staticContent = heroBannerElement.querySelector('.hero-content');
         if (staticContent) {
             staticContent.style.opacity = '1';
             staticContent.style.display = 'block';
         }
         heroBannerElement.style.backgroundImage = '';
         console.log("Mostrando contenido estático del banner (Fallback).");
     } else {
          console.warn("Elemento .hero-banner no encontrado para fallback.");
     }
}

// --- Carrusel Principal (index.html / inicio.html) ---
async function loadAndStartHeroCarousel() {
    const heroBannerElement = document.querySelector('.hero-banner');
    if (!heroBannerElement) { console.warn('Elemento .hero-banner no encontrado.'); return; }

    try {
        const configDocRef = db.collection('config').doc('homepage');
        console.log("Intentando leer config carrusel de:", configDocRef.path);
        const docSnap = await configDocRef.get();

        let imageUrls = [];

        if (docSnap.exists) {
            const data = docSnap.data();
            console.log("Datos leídos para carrusel:", data);
            if (data && data.heroImageUrls && Array.isArray(data.heroImageUrls) && data.heroImageUrls.length > 0) {
                imageUrls = data.heroImageUrls.filter(url => typeof url === 'string' && url.trim() !== '' && (url.startsWith('http://') || url.startsWith('https://')));
                console.log(`Encontradas ${imageUrls.length} URLs válidas.`);
            } else { console.log("Doc existe pero sin 'heroImageUrls' válidas."); }
        } else { console.log('Doc de config carrusel no existe en', configDocRef.path); }

        if (imageUrls.length === 0) {
            console.log('No hay URLs de Firestore. Usando fallback estático/CSS.');
            showStaticHeroContent(); return;
        }

        let slidesHTML = '';
        imageUrls.forEach((url, index) => {
            slidesHTML += `<div class="hero-slide ${index === 0 ? 'active' : ''}" style="background-image: url('${url}');"></div>`;
        });
        const existingContentHTML = heroBannerElement.querySelector('.hero-content')?.outerHTML || `
            <div class="hero-content" style="opacity: 1;">
                <h2>El producto del mes</h2>
                <p>Descubre la nueva línea que revolucionará tu rutina.</p>
                <a href="productos-novedades.html" class="hero-boton">Ver Productos</a>
            </div>`;

         heroBannerElement.innerHTML = `<div class="hero-carousel-slides">${slidesHTML}</div>${existingContentHTML}`;
         console.log("HTML del carrusel construido.");
         heroBannerElement.style.backgroundImage = 'none';

        startHeroCarousel();

    } catch (error) {
        console.error("Error GRAVE al cargar/construir carrusel: ", error);
        displayError(heroBannerElement, "Error al cargar el banner principal. Verifica los permisos de lectura.");
        showStaticHeroContent();
    }
}
function startHeroCarousel() {
    const slidesContainer = document.querySelector('.hero-carousel-slides');
    if (!slidesContainer) { console.log("No se encontró '.hero-carousel-slides'."); return; }
    const slides = slidesContainer.querySelectorAll('.hero-slide');
    if (slides.length <= 1) { console.log("Carrusel con <= 1 slide."); if(slides.length === 1 && !slides[0].classList.contains('active')) slides[0].classList.add('active'); return; }

    let currentIndex = 0;
    const intervalTime = 5000;
    console.log(`Iniciando carrusel principal (${slides.length} slides, ${intervalTime}ms).`);

    if (heroCarouselInterval) { console.log("Limpiando intervalo anterior carrusel principal."); clearInterval(heroCarouselInterval); }

    slides.forEach((slide, index) => slide.classList.toggle('active', index === 0));

    heroCarouselInterval = setInterval(() => {
        if(document.hidden) return; 
        slides[currentIndex].classList.remove('active');
        currentIndex = (currentIndex + 1) % slides.length;
        slides[currentIndex].classList.add('active');
    }, intervalTime);
}

// --- Carrusel Oportunidad MK ---
function startOportunidadCarousel() {
    const slidesContainer = document.querySelector('.oportunidad-mk-slides');
    if (!slidesContainer) { console.log("No se encontró '.oportunidad-mk-slides'."); return; }
    const slides = slidesContainer.querySelectorAll('.oportunidad-mk-slide');
    if (slides.length <= 1) { console.log("Carrusel Oportunidad con <= 1 slide."); if(slides.length === 1 && !slides[0].classList.contains('active')) slides[0].classList.add('active'); return; }

    let currentIndex = 0;
    const intervalTime = 4000;
    console.log(`Iniciando carrusel Oportunidad MK (${slides.length} slides, ${intervalTime}ms).`);

    if (oportunidadCarouselInterval) { console.log("Limpiando intervalo anterior carrusel Oportunidad."); clearInterval(oportunidadCarouselInterval); }

    slides.forEach((slide, index) => slide.classList.toggle('active', index === 0));

    oportunidadCarouselInterval = setInterval(() => {
        if(document.hidden) return;
        slides[currentIndex].classList.remove('active');
        currentIndex = (currentIndex + 1) % slides.length;
        slides[currentIndex].classList.add('active');
    }, intervalTime);
}

// --- Lógica de Banners Intermedios ---
async function loadCategoryBannersAdmin() {
    const inputs = {
        marykay: document.getElementById('banner-url-marykay'),
        biogreen: document.getElementById('banner-url-biogreen'),
        arbell: document.getElementById('banner-url-arbell'),
        nexo: document.getElementById('banner-url-nexo')
    };
    const validInputs = {};
    for(const key in inputs) {
        if(inputs[key]) validInputs[key] = inputs[key];
    }

    if (Object.keys(validInputs).length === 0) {
        return Promise.resolve();
    }

    const bannersDocRef = db.collection('config').doc('categoryBanners');
    try {
        console.log("Admin: Cargando URLs de banners de categorías desde:", bannersDocRef.path);
        const docSnap = await bannersDocRef.get();
        if (docSnap.exists) {
            const data = docSnap.data();
            console.log("Admin: Datos de banners encontrados:", data);
            for (const brand in validInputs) {
                validInputs[brand].value = data[brand] || '';
            }
            console.log("Admin: URLs de banners cargadas en el formulario.");
        } else {
            console.log("Admin: Documento de config/categoryBanners no existe. Inputs estarán vacíos.");
        }
        return Promise.resolve();
    } catch (error) {
        console.error("Admin: Error cargando URLs de banners de categorías:", error);
        displayError(document.getElementById('manage-banners-container'), "Error al cargar URLs de banners.");
        return Promise.reject(error);
    }
}
function setupCategoryBannersForm() {
    const form = document.getElementById('category-banners-form');
    const feedback = document.getElementById('category-banners-feedback');
    const button = document.getElementById('save-category-banners-button');
    const inputs = {
        marykay: document.getElementById('banner-url-marykay'),
        biogreen: document.getElementById('banner-url-biogreen'),
        arbell: document.getElementById('banner-url-arbell'),
        nexo: document.getElementById('banner-url-nexo')
    };
    
    const validInputs = {};
    for (const key in inputs) {
        if (inputs[key]) validInputs[key] = inputs[key];
    }

    if (!form || !feedback || !button || Object.keys(validInputs).length === 0) {
        console.warn('Elementos del formulario de banners de categoría no encontrados para listeners (o incompletos).');
        return;
    }
    
    const bannersDocRef = db.collection('config').doc('categoryBanners');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        feedback.style.display = 'none';
        button.disabled = true;
        button.textContent = 'Guardando...';
        const bannerData = {};
        let hasError = false;
        
        for (const brand in validInputs) {
            const url = validInputs[brand].value.trim();
            if (url && !(url.startsWith('http://') || url.startsWith('https://'))) {
                 showFeedback(`URL inválida para ${brand}. Debe empezar con http:// o https:// (o dejar vacío).`, 'error', feedback, button);
                 hasError = true;
                 break;
            }
            bannerData[brand] = url;
        }
        if (hasError) {
             button.textContent = 'Guardar Cambios de Banners';
             button.disabled = false;
             return;
        }
        console.log("Admin: Guardando URLs de banners en:", bannersDocRef.path, bannerData);
        try {
            await bannersDocRef.set(bannerData, { merge: true });
            showFeedback('¡URLs de banners actualizadas!', 'success', feedback, button, true);
            console.log("Admin: URLs de banners guardadas OK.");
            button.textContent = 'Guardar Cambios de Banners';
        } catch (error) {
            console.error('Admin: Error guardando URLs de banners: ', error);
            showFeedback('Error al guardar. Revisa consola (F12). ¿Tienes permisos de escritura en config?', 'error', feedback, button);
            button.textContent = 'Guardar Cambios de Banners';
        } finally {
            button.disabled = false;
        }
    });
}
async function loadIntermediateBanner(brand) {
    const bannerContainer = document.querySelector('.banner-intermedio');
    if (!bannerContainer) {
        console.log(`No se encontró contenedor .banner-intermedio en la página de ${brand}.`);
        return;
    }
    bannerContainer.innerHTML = '';
    const bannersDocRef = db.collection('config').doc('categoryBanners');
    try {
        console.log(`Cliente (${brand}): Buscando URL de banner en:`, bannersDocRef.path);
        const docSnap = await bannersDocRef.get();
        let bannerUrl = null;
        if (docSnap.exists) {
            const data = docSnap.data();
            bannerUrl = data[brand];
            console.log(`Cliente (${brand}): URL encontrada: ${bannerUrl || 'Ninguna'}`);
        } else {
            console.log(`Cliente (${brand}): Documento config/categoryBanners no encontrado.`);
        }
        if (bannerUrl && (bannerUrl.startsWith('http://') || bannerUrl.startsWith('https://'))) {
            const img = document.createElement('img');
            img.src = bannerUrl;
            img.alt = `Banner ${brand}`;
            img.onerror = () => {
                console.warn(`Error al cargar la imagen del banner para ${brand} desde ${bannerUrl}`);
                bannerContainer.style.display = 'none';
            };
            bannerContainer.appendChild(img);
            bannerContainer.style.display = 'block';
        } else {
            console.log(`Cliente (${brand}): No hay URL de banner válida, ocultando contenedor.`);
            bannerContainer.style.display = 'none';
        }
    } catch (error) {
        console.error(`Cliente (${brand}): Error al cargar banner intermedio:`, error);
        bannerContainer.style.display = 'none';
    }
}

// --- Lógica para Imágenes de Páginas Estáticas ---
async function loadPageImagesAdmin() {
    const inputs = {
        consultora: document.getElementById('page-image-consultora')
    };
    if (!Object.values(inputs).every(input => input)) {
        console.warn('Alguno de los inputs de URL de imagen de página no se encontró en admin.html.');
        return Promise.reject("Missing page image URL inputs");
    }
    const pageImagesDocRef = db.collection('config').doc('pageImages');
    try {
        console.log("Admin: Cargando URLs de imágenes de páginas desde:", pageImagesDocRef.path);
        const docSnap = await pageImagesDocRef.get();
        if (docSnap.exists) {
            const data = docSnap.data();
            console.log("Admin: Datos de imágenes de página encontrados:", data);
            for (const pageKey in inputs) {
                inputs[pageKey].value = data[pageKey] || '';
            }
            console.log("Admin: URLs de imágenes de página cargadas en el formulario.");
        } else {
            console.log("Admin: Documento de config/pageImages no existe. Inputs estarán vacíos.");
        }
        return Promise.resolve();
    } catch (error) {
        console.error("Admin: Error cargando URLs de imágenes de página:", error);
        displayError(document.getElementById('manage-page-images-container'), "Error al cargar URLs de imágenes.");
        return Promise.reject(error);
    }
}
function setupPageImagesForm() {
    const form = document.getElementById('page-images-form');
    const feedback = document.getElementById('page-images-feedback');
    const button = document.getElementById('save-page-images-button');
    const inputs = {
        consultora: document.getElementById('page-image-consultora')
    };
    if (!form || !feedback || !button || !Object.values(inputs).every(input => input)) {
        console.warn('Elementos del formulario de imágenes de página no encontrados para listeners.');
        return;
    }
    const pageImagesDocRef = db.collection('config').doc('pageImages');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        feedback.style.display = 'none';
        button.disabled = true;
        button.textContent = 'Guardando...';
        const imageData = {};
        let hasError = false;
        for (const pageKey in inputs) {
            const url = inputs[pageKey].value.trim();
            if (url && !(url.startsWith('http://') || url.startsWith('https://'))) {
                 showFeedback(`URL inválida para ${pageKey}. Debe empezar con http:// o https:// (o dejar vacío).`, 'error', feedback, button);
                 hasError = true;
                 break;
            }
            imageData[pageKey] = url;
        }
        if (hasError) {
             button.textContent = 'Guardar Cambios de Imágenes';
             button.disabled = false;
             return;
        }
        console.log("Admin: Guardando URLs de imágenes de página en:", pageImagesDocRef.path, imageData);
        try {
            await pageImagesDocRef.set(imageData);
            showFeedback('¡URLs de imágenes de página actualizadas!', 'success', feedback, button, true);
            console.log("Admin: URLs de imágenes de página guardadas OK.");
            button.textContent = 'Guardar Cambios de Imágenes';
        } catch (error) {
            console.error('Admin: Error guardando URLs de imágenes de página: ', error);
            showFeedback('Error al guardar. Revisa consola (F12). ¿Tienes permisos de escritura en config?', 'error', feedback, button);
            button.textContent = 'Guardar Cambios de Imágenes';
        } finally {
            button.disabled = false;
        }
    });
}
async function loadConsultoraImage() {
    const imgElement = document.getElementById('consultora-main-image');
    if (!imgElement) {
        console.log('No se encontró elemento img#consultora-main-image.');
        return; 
    }

    const pageImagesDocRef = db.collection('config').doc('pageImages');
    try {
        console.log("Cliente (Consultora): Buscando URL de imagen en:", pageImagesDocRef.path);
        const docSnap = await pageImagesDocRef.get();
        let imageUrl = null;
        if (docSnap.exists) {
            const data = docSnap.data();
            imageUrl = data['consultora']; 
            console.log(`Cliente (Consultora): URL encontrada: ${imageUrl || 'Ninguna'}`);
        } else {
            console.log("Cliente (Consultora): Documento config/pageImages no encontrado.");
        }

        if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
            imgElement.src = imageUrl; 
            imgElement.onerror = () => { 
                 console.warn(`Error al cargar la imagen de Consultora desde ${imageUrl}`);
            };
        } else {
            console.log("Cliente (Consultora): No hay URL válida, se usará la imagen por defecto del HTML.");
        }
    } catch (error) {
        console.error("Cliente (Consultora): Error al cargar imagen principal:", error);
    }
}

// --- Lógica de Admin (Homepage Settings) ---
async function loadHomepageSettingsAdmin() {
    const textarea = document.getElementById('hero-image-urls');
    if (!textarea) {
        console.warn('Textarea "hero-image-urls" no encontrado en admin.html.');
        return Promise.reject("Missing textarea");
    }
    const configDocRef = db.collection('config').doc('homepage');
    try {
        console.log("Admin: Cargando URLs del carrusel principal desde:", configDocRef.path);
        const docSnap = await configDocRef.get();
        if (docSnap.exists) {
            const data = docSnap.data();
            if (data && data.heroImageUrls && Array.isArray(data.heroImageUrls)) {
                textarea.value = data.heroImageUrls.join('\n');
                console.log("Admin: URLs del carrusel cargadas en el formulario.");
            } else {
                 console.log("Admin: Documento 'homepage' existe pero sin URLs.");
                 textarea.value = '';
            }
        } else {
            console.log("Admin: Documento de config/homepage no existe. Textarea estará vacío.");
            textarea.value = '';
        }
        return Promise.resolve();
    } catch (error) {
        console.error("Admin: Error cargando URLs del carrusel principal:", error);
        displayError(document.getElementById('homepage-settings-container'), "Error al cargar URLs del carrusel.");
        return Promise.reject(error);
    }
}
function setupHomepageSettingsForm() {
    const form = document.getElementById('homepage-settings-form');
    const textarea = document.getElementById('hero-image-urls');
    const feedback = document.getElementById('homepage-feedback');
    const button = document.getElementById('save-hero-banner-button');

    if (!form || !textarea || !feedback || !button) {
        console.warn('Elementos del formulario de Homepage no encontrados para listeners.');
        return;
    }

    const configDocRef = db.collection('config').doc('homepage');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        feedback.style.display = 'none';
        button.disabled = true;
        button.textContent = 'Guardando...';

        const urlsString = textarea.value.trim();
        const urls = urlsString.split('\n')
                              .map(url => url.trim())
                              .filter(url => url !== '' && (url.startsWith('http://') || url.startsWith('https://')));

        if (urls.length === 0 && urlsString !== '') {
             showFeedback('No se encontraron URLs válidas. Asegúrate que empiecen con http:// o https:// y que haya una por línea.', 'error', feedback, button);
             button.textContent = 'Guardar Cambios del Carrusel';
             button.disabled = false;
             return;
        }
        console.log("Admin: Guardando URLs del carrusel en:", configDocRef.path, urls);
        try {
            await configDocRef.set({ heroImageUrls: urls }, { merge: true });
            showFeedback('¡URLs del carrusel actualizadas!', 'success', feedback, button, true);
            console.log("Admin: URLs del carrusel guardadas OK.");
        } catch (error) {
            console.error('Admin: Error guardando URLs del carrusel: ', error);
            showFeedback('Error al guardar. Revisa consola (F12). ¿Tienes permisos de escritura en config?', 'error', feedback, button);
        } finally {
            button.textContent = 'Guardar Cambios del Carrusel';
            button.disabled = false;
        }
    });
}

// --- Lógica de Admin (Categorías) ---
async function updateParentCategoryDropdown(selectedBrand, categoryToSelect = null) {
    const parentSelect = document.getElementById('category-parent');
    if (!parentSelect) {
        console.error("Dropdown 'category-parent' no encontrado.");
        return;
    }
    parentSelect.innerHTML = '<option value="">-- Cargando... --</option>';
    parentSelect.disabled = true;

    if (!selectedBrand) {
        parentSelect.innerHTML = '<option value="">-- Selecciona Marca Primero --</option>';
        return;
    }

    try {
        console.log(`Buscando categorías padre para: ${selectedBrand}`);
        const querySnapshot = await db.collection('categories')
                                    .where('brand', '==', selectedBrand)
                                    .where('parentId', '==', null) 
                                    .orderBy('name')
                                    .get();
        
        parentSelect.innerHTML = '<option value="">-- Ninguna (Categoría Principal) --</option>'; 
        
        querySnapshot.forEach(doc => {
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = doc.data().name;
            if (categoryToSelect && doc.id === categoryToSelect) {
                option.selected = true;
            }
            parentSelect.appendChild(option);
        });
        parentSelect.disabled = false;
    } catch (error) {
        console.error("Error cargando categorías padre:", error);
        parentSelect.innerHTML = '<option value="">-- Error al cargar --</option>';
        console.error("Posiblemente falte un índice de Firestore para la consulta de categorías padre.");
        console.error("Índice requerido: categories | brand (ASC) | parentId (ASC) | name (ASC)");
    }
}
async function loadCategoriesAdmin() {
    const tableBody = document.getElementById('categories-table-body');
    const loadingMsg = document.getElementById('loading-categories-admin');
    if (!tableBody || !loadingMsg) { console.error("Elementos tabla categorías no encontrados."); return Promise.reject("Missing table elements"); }
    loadingMsg.style.display = 'block'; loadingMsg.textContent = 'Cargando categorías...'; tableBody.innerHTML = '';
    
    try {
        const categoriesRef = db.collection('categories');
        
        const allCategoriesSnap = await categoriesRef.get();
        const categoryNameMap = new Map();
        allCategoriesSnap.forEach(doc => {
            categoryNameMap.set(doc.id, doc.data().name);
        });

        console.log("Admin: Leyendo categorías de:", categoriesRef.path);
        const querySnapshot = await categoriesRef.orderBy('brand').orderBy('name').get();

        loadingMsg.style.display = 'none';
        if (querySnapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay categorías creadas.</td></tr>'; return Promise.resolve();
        }
        
        querySnapshot.forEach(doc => {
            const category = doc.data(); const categoryId = doc.id;
            const name = category.name || 'N/D'; const brand = category.brand || 'N/D';
            const imageUrl = category.imageUrl || 'https://via.placeholder.com/60?text=No+Img';
            
            const parentId = category.parentId;
            const parentName = parentId ? (categoryNameMap.get(parentId) || 'ID: ' + parentId) : '--';

            const row = document.createElement('tr');
            row.setAttribute('data-category-id', categoryId);
            row.innerHTML = `
                <td><img src="${imageUrl}" alt="${name}" class="admin-table-thumbnail" onerror="this.onerror=null; this.src='https://via.placeholder.com/60?text=Err';"></td>
                <td>${name}</td>
                <td>${brand}</td>
                <td>${parentName}</td>
                <td><button class="edit-category-btn admin-button edit-button" data-id="${categoryId}">Editar</button><button class="delete-category-btn admin-button cancel-button" data-id="${categoryId}">Eliminar</button></td>
            `;
            tableBody.appendChild(row);
        });
        addCategoryButtonListeners();
        console.log(`Admin: ${querySnapshot.size} categorías cargadas.`);
        return Promise.resolve();
    } catch (error) {
        console.error("Error GRAVE al cargar categorías admin: ", error);
        displayError(document.getElementById('list-categories-container'), 'Error al cargar categorías. Verifica permisos e ÍNDICES (link en consola F12).');
        if(loadingMsg) loadingMsg.style.display = 'none';
        return Promise.reject(error);
    }
}
function setupCategoryForm() {
    const form = document.getElementById('category-form');
     const nameInput = document.getElementById('category-name');
     const brandSelect = document.getElementById('category-brand');
     const imageUrlInput = document.getElementById('category-image-url');
     const feedbackElement = document.getElementById('category-feedback');
     const submitButton = document.getElementById('submit-category-button');
     const cancelButton = document.getElementById('cancel-edit-category-button');
     const formTitle = document.getElementById('category-form-title');
     const editCategoryIdInput = document.getElementById('edit-category-id');
     
     const parentSelect = document.getElementById('category-parent');

    if (!form || !nameInput || !brandSelect || !imageUrlInput || !parentSelect) { console.error("Elementos form categoría no encontrados."); return; }
    
    brandSelect.addEventListener('change', () => {
        updateParentCategoryDropdown(brandSelect.value);
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        feedbackElement.style.display = 'none';
        submitButton.disabled = true;
        const categoryName = nameInput.value.trim();
        const categoryBrand = brandSelect.value;
        const categoryImageUrl = imageUrlInput.value.trim();
        const editingId = editCategoryIdInput.value;
        
        const parentId = parentSelect.value;

        submitButton.textContent = editingId ? 'Actualizando...' : 'Agregando...';
        if (!categoryName || !categoryBrand) {
            showFeedback('Nombre y Marca son obligatorios.', 'error', feedbackElement, submitButton);
            submitButton.textContent = editingId ? 'Actualizar Categoría' : 'Agregar Categoría';
            submitButton.disabled = false; return;
        }
        
        const categoryData = { 
            name: categoryName, 
            brand: categoryBrand, 
            imageUrl: categoryImageUrl || '',
            parentId: parentId || null 
        };
        
        const categoriesRef = db.collection('categories');
        console.log("Admin: Guardando categoría en:", categoriesRef.path, categoryData);
        try {
            let actionPromise;
            if (editingId) {
                console.log("Actualizando categoría ID:", editingId);
                actionPromise = categoriesRef.doc(editingId).update(categoryData);
            } else {
                 console.log("Agregando nueva categoría");
                actionPromise = categoriesRef.add(categoryData);
            }
            await actionPromise;
            showFeedback(editingId ? '¡Categoría actualizada!' : '¡Categoría agregada!', 'success', feedbackElement, submitButton, true);
            console.log("Admin: Categoría guardada OK.");
            if (editingId) cancelEditCategory();
            else { 
                form.reset(); 
                parentSelect.innerHTML = '<option value="">-- Selecciona Marca Primero --</option>';
                parentSelect.disabled = true;
                submitButton.textContent = 'Agregar Categoría'; 
            }
            await loadCategoriesAdmin();
            const productBrandSelect = document.getElementById('product-brand');
            if (productBrandSelect.value === categoryBrand) {
                 await updateCategoryDropdown(categoryBrand);
            }
            if (editingId) {
                await updateProductsWithCategoryData(editingId, categoryData.name, categoryData.imageUrl);
            }
        } catch (error) {
            console.error("Admin: Error guardando categoría:", error);
            showFeedback('Error al guardar. Revisa consola (F12). ¿Tienes permisos?', 'error', feedbackElement, submitButton);
            submitButton.textContent = editingId ? 'Actualizar Categoría' : 'Agregar Categoría';
        } finally { submitButton.disabled = false; }
    });
    cancelButton.addEventListener('click', cancelEditCategory);
}
async function startEditCategory(categoryId) {
    console.log("Iniciando edición de categoría ID:", categoryId);
     const form = document.getElementById('category-form');
     const nameInput = document.getElementById('category-name');
     const brandSelect = document.getElementById('category-brand');
     const imageUrlInput = document.getElementById('category-image-url');
     const feedbackElement = document.getElementById('category-feedback');
     const submitButton = document.getElementById('submit-category-button');
     const cancelButton = document.getElementById('cancel-edit-category-button');
     const formTitle = document.getElementById('category-form-title');
     const editCategoryIdInput = document.getElementById('edit-category-id');
     
     const parentSelect = document.getElementById('category-parent');

    feedbackElement.style.display = 'none';
    try {
        const categoryRef = db.collection('categories').doc(categoryId);
        console.log("Editando categoría, leyendo de:", categoryRef.path);
        const docSnap = await categoryRef.get();
        if (docSnap.exists) {
            const category = docSnap.data();
            console.log("Datos categoría para editar:", category);
            nameInput.value = category.name || '';
            brandSelect.value = category.brand || '';
            imageUrlInput.value = category.imageUrl || '';
            editCategoryIdInput.value = categoryId;

            await updateParentCategoryDropdown(category.brand, category.parentId);

            formTitle.textContent = 'Editar Categoría';
            submitButton.textContent = 'Actualizar Categoría';
            submitButton.classList.remove('add-button'); submitButton.classList.add('edit-button');
            cancelButton.style.display = 'inline-block';
            form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            console.error("No se encontró la categoría para editar ID:", categoryId);
            alert("Error: No se encontró la categoría seleccionada.");
        }
    } catch (error) {
        console.error("Error al obtener datos de categoría para editar:", error);
        alert("Error al cargar los datos de la categoría.");
    }
}
function cancelEditCategory() {
    console.log("Cancelando edición de categoría");
    const form = document.getElementById('category-form');
    const imageUrlInput = document.getElementById('category-image-url');
    const feedbackElement = document.getElementById('category-feedback');
    const submitButton = document.getElementById('submit-category-button');
    const cancelButton = document.getElementById('cancel-edit-category-button');
    const formTitle = document.getElementById('category-form-title');
    const editCategoryIdInput = document.getElementById('edit-category-id');
    
    const parentSelect = document.getElementById('category-parent');

    form.reset();
    editCategoryIdInput.value = '';
    if(imageUrlInput) imageUrlInput.value = '';

    if(parentSelect) {
        parentSelect.innerHTML = '<option value="">-- Selecciona Marca Primero --</option>';
        parentSelect.disabled = true;
    }

    formTitle.textContent = 'Agregar Nueva Categoría';
    submitButton.textContent = 'Agregar Categoría';
    submitButton.classList.remove('edit-button');
    submitButton.classList.add('add-button');
    cancelButton.style.display = 'none';
    feedbackElement.style.display = 'none';
    submitButton.disabled = false;
}
function addCategoryButtonListeners() {
    const tableBody = document.getElementById('categories-table-body');
    if (!tableBody) return;
    tableBody.removeEventListener('click', handleCategoryTableClick); 
    tableBody.addEventListener('click', handleCategoryTableClick);
}
async function handleCategoryTableClick(e) {
    const target = e.target;
    if (!target.matches('.edit-category-btn, .delete-category-btn')) return;
    const categoryId = target.dataset.id;
    if (!categoryId) return;
    if (target.classList.contains('edit-category-btn')) {
        startEditCategory(categoryId);
    } else if (target.classList.contains('delete-category-btn')) {
        const row = target.closest('tr');
        const categoryName = row?.querySelector('td:nth-child(2)')?.textContent || 'esta categoría';
        
        const childCategoryCheck = await db.collection('categories').where('parentId', '==', categoryId).limit(1).get();
        if (!childCategoryCheck.empty) {
            alert(`No se puede eliminar la categoría "${categoryName}" porque es una Categoría Padre (ej: de "${childCategoryCheck.docs[0].data().name}"). Primero elimina o reasigna sus subcategorías.`);
            return;
        }

        const productCheck = await db.collection('products').where('categoryId', '==', categoryId).limit(1).get();
        if (!productCheck.empty) {
            alert(`No se puede eliminar la categoría "${categoryName}" porque todavía hay productos (ej: "${productCheck.docs[0].data().name}") usándola.`);
            return;
        }
        
        if (confirm(`¿Eliminar categoría "${categoryName}"?\n¡Esto NO se puede deshacer!`)) {
            try {
                const categoryRef = db.collection('categories').doc(categoryId);
                console.log("Eliminando categoría:", categoryRef.path);
                await categoryRef.delete();
                console.log("Categoría eliminada OK:", categoryId);
                await loadCategoriesAdmin();
                alert(`Categoría "${categoryName}" eliminado.`);
                const productBrandSelect = document.getElementById('product-brand');
                const deletedCategoryBrand = row?.querySelector('td:nth-child(3)')?.textContent;
                 if(productBrandSelect.value && productBrandSelect.value === deletedCategoryBrand) {
                     await updateCategoryDropdown(productBrandSelect.value);
                 }
            } catch (error) {
                console.error("Admin: Error al eliminar categoría:", error);
                alert("Error al eliminar. Revisa consola (F12). ¿Tienes permisos?");
            }
        }
    }
}
async function updateProductsWithCategoryData(categoryId, newCategoryName, newCategoryImageUrl) {
    if (!categoryId) return;
    console.log(`Buscando productos con categoryId ${categoryId} para actualizar...`);
    const productsToUpdate = await db.collection('products').where('categoryId', '==', categoryId).get();
    if (productsToUpdate.empty) {
        console.log("No se encontraron productos para actualizar.");
        return;
    }
    console.log(`Actualizando ${productsToUpdate.size} productos...`);
    const batch = db.batch();
    productsToUpdate.forEach(doc => {
        const productRef = db.collection('products').doc(doc.id);
        batch.update(productRef, {
            categoryName: newCategoryName,
            categoryImageUrl: newCategoryImageUrl || ''
        });
    });
    try {
        await batch.commit();
        console.log("¡Productos actualizados exitosamente!");
        if (window.location.pathname.includes('admin.html')) {
            await cargarProductosAdmin();
        }
    } catch (error) {
        console.error("Error al actualizar productos en lote:", error);
        alert("Error al actualizar los productos asociados a esta categoría. Revisa la consola.");
    }
}

// --- Lógica de Admin (Productos) ---
// *****************************************************************
// *** MODIFICADO v1.25: Corrección de columnas en tabla admin ***
// *****************************************************************
async function cargarProductosAdmin() {
    const tableBody = document.getElementById('products-table-body');
    const loadingMsg = document.getElementById('loading-products-admin');
    
    if (!tableBody || !loadingMsg) { 
        console.error("Elementos tabla productos admin no encontrados."); 
        return Promise.reject("Missing table elements"); 
    }
    
    loadingMsg.style.display = 'block'; 
    loadingMsg.textContent = 'Cargando...'; 
    tableBody.innerHTML = '';
    
    try {
        console.log("Admin: Leyendo todos los productos...");
        const querySnapshot = await db.collection('products')
                                    .orderBy('brand')
                                    .orderBy('name')
                                    .get();
        loadingMsg.style.display = 'none';
        const productDocs = querySnapshot.docs.filter(doc => !doc.id.startsWith('--config-'));
        
        if (productDocs.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;">No hay productos agregados.</td></tr>'; 
            return Promise.resolve();
        }
        
        console.log(`Admin: ${productDocs.length} productos encontrados.`);
        
        productDocs.forEach(doc => {
            const product = doc.data(); 
            const productId = doc.id;
            
            const name = product.name || 'N/D';
            const brand = product.brand || 'N/D';
            const categoryName = product.categoryName || 'N/A';
            const price = typeof product.price === 'number' ? product.price.toFixed(2) : '0.00';
            
            // Lógica Precio Mayorista Visual
            let wholesaleDisplay = 'Auto (30%)';
            if (product.wholesalePrice && !isNaN(parseFloat(product.wholesalePrice))) {
                wholesaleDisplay = `$${parseFloat(product.wholesalePrice).toFixed(2)}`;
            }

            // Popularidad
            const popularidad = product.salesCount || 0;
            
            // Imagen
            const imageUrl = (product.imageUrls && product.imageUrls[0]) ? product.imageUrls[0] : (product.imageUrl || 'https://via.placeholder.com/60?text=No+Img');
            
            // Descripción
            let descriptionPreview = 'Sin detalles';
            if(product.detailSections && product.detailSections.length > 0) {
                descriptionPreview = product.detailSections[0].title + ": " + product.detailSections[0].content.substring(0, 30) + "...";
            } else if (product.description) { 
                descriptionPreview = product.description.substring(0, 30) + "...";
            }

            const row = document.createElement('tr');
            row.setAttribute('data-product-id', productId);
            
            // Generar HTML con el orden CORRECTO de las 9 columnas y ESTILO INLINE para forzar ancho de botones
            row.innerHTML = `
                <td><img src="${imageUrl}" alt="${name}" class="admin-table-thumbnail" onerror="this.onerror=null; this.src='https://via.placeholder.com/60?text=Err';"></td>
                <td>${name}</td>
                <td>${brand}</td>
                <td>${categoryName}</td>
                <td>$${price}</td>
                <td>${wholesaleDisplay}</td>
                <td style="text-align:center; font-weight:bold; font-size: 1.1em; color: #007bff;">${popularidad}</td>
                <td style="font-size: 0.85rem; color:#666;">${descriptionPreview}</td>
                <td style="white-space: nowrap; min-width: 160px; text-align:center;"> <div style="display: flex; gap: 5px; justify-content: center;">
                        <button class="edit-btn admin-button edit-button" data-id="${productId}" style="margin:0; padding: 5px 10px;">Editar</button>
                        <button class="delete-btn admin-button cancel-button" data-id="${productId}" style="margin:0; padding: 5px 10px;">Eliminar</button>
                    </div>
                </td>
            `;
            tableBody.appendChild(row);
        });
        
        addAdminButtonListeners();
        return Promise.resolve();
    } catch (error) {
        console.error("Error GRAVE cargando productos en admin: ", error);
        displayError(document.getElementById('list-products-container'), 'Error al cargar lista de productos. Verifica ÍNDICES (link en consola F12).');
        if (loadingMsg) loadingMsg.style.display = 'none';
        return Promise.reject(error);
    }
}
function setupAddProductForm() {
    const form = document.getElementById('add-product-form');
     const brandSelect = document.getElementById('product-brand');
    const categorySelect = document.getElementById('product-category');
     const feedbackElement = document.getElementById('add-product-feedback');
     const submitButton = document.getElementById('submit-product-button');
     const editProductIdInput = document.getElementById('edit-product-id');
     const cancelButton = document.getElementById('cancel-edit-button');
     const formTitle = document.getElementById('form-title');
    
    const addSectionBtn = document.getElementById('add-section-btn');
    const detailSectionsContainer = document.getElementById('detail-sections-container');
    
    if (addSectionBtn && detailSectionsContainer) {
        addSectionBtn.addEventListener('click', () => {
             addDetailSection('', ''); 
        });
    }

    const addDetailSection = (title, content) => {
         const sectionId = `section-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
         const newSectionDiv = document.createElement('div');
         newSectionDiv.className = 'detail-section-group';
         newSectionDiv.setAttribute('data-section-id', sectionId);
         newSectionDiv.innerHTML = `
            <div class="form-row">
                <div class="form-group" style="flex-grow: 1;">
                    <label for="title-${sectionId}">Título Sección (Ej: Beneficios, Uso):</label>
                    <input type="text" id="title-${sectionId}" class="section-title-input" value="${title}" placeholder="Beneficios">
                </div>
                <button type="button" class="admin-button cancel-button remove-section-btn" style="align-self: flex-end; margin-left: 10px;">Eliminar</button>
            </div>
            <div class="form-group">
                <label for="content-${sectionId}">Contenido (Descripción):</label>
                <textarea id="content-${sectionId}" class="section-content-input" rows="4" placeholder="Detalle de los beneficios...">${content}</textarea>
            </div>
         `;
         detailSectionsContainer.appendChild(newSectionDiv);
         newSectionDiv.querySelector('.remove-section-btn').addEventListener('click', (e) => {
             e.target.closest('.detail-section-group').remove();
         });
    };
    
    window.adminProductForm = { addDetailSection }; 
    
    if (!form || !brandSelect || !categorySelect) { console.error("Elementos form producto no encontrados."); return; }
    
    brandSelect.addEventListener('change', async () => {
        console.log("Marca cambiada a:", brandSelect.value);
        await updateCategoryDropdown(brandSelect.value);
    });
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        feedbackElement.style.display = 'none';
        submitButton.disabled = true;
        const isEditing = editProductIdInput.value !== '';
        submitButton.textContent = isEditing ? 'Actualizando...' : 'Agregando...';
        
        const name = document.getElementById('product-name').value.trim();
        const subtitle = document.getElementById('product-subtitle').value.trim();
        const brand = brandSelect.value;
        const categoryId = categorySelect.value;
        const selectedCategoryOption = categorySelect.options[categorySelect.selectedIndex];
        const categoryName = selectedCategoryOption?.textContent || '';
        const categoryImageUrl = selectedCategoryOption?.dataset.imageUrl || '';
        const priceString = document.getElementById('product-price').value;
        const imageUrlsString = document.getElementById('product-image-urls').value.trim();
        // --- NUEVO: Capturar la fecha ---
const createdAtInput = document.getElementById('product-created-at');
let createdAtTimestamp = Date.now(); // Por defecto: ahora mismo

if (createdAtInput.value) {
    // Convertir la fecha seleccionada en el input a Timestamp (número)
    createdAtTimestamp = new Date(createdAtInput.value).getTime();
}
// --------------------------------
        
        const detailSections = [];
        const sectionGroups = detailSectionsContainer.querySelectorAll('.detail-section-group');
        sectionGroups.forEach(group => {
            const title = group.querySelector('.section-title-input').value.trim();
            const content = group.querySelector('.section-content-input').value.trim();
            if (title && content) { 
                detailSections.push({ title, content });
            }
        });

        const restoreButtonText = () => { submitButton.textContent = isEditing ? 'Actualizar Producto' : 'Agregar Producto'; };
        
        if (!name || !brand || !categoryId || priceString === '' || !imageUrlsString) { showFeedback('Nombre, Marca, Categoría, Precio y URLs son obligatorios.', 'error', feedbackElement, submitButton); restoreButtonText(); submitButton.disabled = false; return; }
        if (categoryId.startsWith('--')) { showFeedback('Selecciona una categoría válida.', 'error', feedbackElement, submitButton); restoreButtonText(); submitButton.disabled = false; return; }
        
        const price = parseFloat(priceString);
        if (isNaN(price) || price < 0) { showFeedback('Precio inválido.', 'error', feedbackElement, submitButton); restoreButtonText(); submitButton.disabled = false; return; }
        
        const urls = imageUrlsString.split('\n').map(url => url.trim()).filter(url => url !== '' && (url.startsWith('http://') || url.startsWith('https://')));
        if (urls.length === 0) { showFeedback('Ingresa al menos una URL válida (http:// o https://).', 'error', feedbackElement, submitButton); restoreButtonText(); submitButton.disabled = false; return; }

        const productData = {
    name,
    subtitle: subtitle, 
    brand,
    categoryId,
    categoryName: categoryName.startsWith('--') ? '' : categoryName,
    categoryImageUrl: categoryImageUrl,
    price,
    imageUrls: urls,
    imageUrl: urls[0] || '', 
    detailSections: detailSections,
    
    // --- NUEVO: Guardamos la fecha para el ordenamiento ---
    createdAtNumerico: createdAtTimestamp, 
    createdAt: new Date(createdAtTimestamp) // Guardamos también formato fecha por si acaso
    // -----------------------------------------------------
};
        
        console.log("Admin: Guardando producto:", productData);
        
        try {
            let actionPromise;
            if (isEditing) {
                const productId = editProductIdInput.value;
                console.log("Actualizando producto ID:", productId);
                actionPromise = db.collection('products').doc(productId).update(productData);
            } else {
                 console.log("Agregando nuevo producto");
                actionPromise = db.collection('products').add(productData);
            }
            await actionPromise;
            showFeedback(isEditing ? '¡Producto actualizado!' : '¡Producto agregado!', 'success', feedbackElement, submitButton, true);
            console.log("Admin: Producto guardado OK.");
            if (isEditing) cancelEditProduct();
            else {
                form.reset();
                detailSectionsContainer.innerHTML = ''; 
                categorySelect.innerHTML = '<option value="">-- Selecciona Marca Primero --</option>';
                categorySelect.disabled = true;
                submitButton.textContent = 'Agregar Producto';
            }
            await cargarProductosAdmin();
        } catch (error) {
            console.error("Admin: Error guardando/actualizando producto:", error);
            showFeedback('Error al guardar. Revisa consola (F12). ¿Tienes permisos?', 'error', feedbackElement, submitButton);
            restoreButtonText();
        } finally { submitButton.disabled = false; }
    });
    
    cancelButton.addEventListener('click', cancelEditProduct);
}
async function updateCategoryDropdown(selectedBrand, categoryToSelect = null) {
    const categorySelect = document.getElementById('product-category');
    const categoryLoadingMsg = document.getElementById('category-loading-msg');
    if (!categorySelect || !categoryLoadingMsg) { console.error("Dropdown categoría o msg loading no encontrado."); return; }
    categorySelect.innerHTML = '<option value="">-- Cargando... --</option>';
    categorySelect.disabled = true;
    categoryLoadingMsg.style.display = 'inline';
    console.log("Actualizando dropdown categorías para marca:", selectedBrand);
    if (!selectedBrand) {
        categorySelect.innerHTML = '<option value="">-- Selecciona Marca Primero --</option>';
        categorySelect.disabled = true;
        categoryLoadingMsg.style.display = 'none';
        console.log("Dropdown reseteado (sin marca).");
        return;
    }
    try {
        const categoriesRef = db.collection('categories');
        console.log("Consultando categorías en:", categoriesRef.path, "para marca:", selectedBrand);
        
        const querySnapshot = await categoriesRef.where('brand', '==', selectedBrand).get();

        categorySelect.innerHTML = '';
        if (querySnapshot.empty) {
            console.log("No se encontraron categorías para", selectedBrand);
            categorySelect.innerHTML = '<option value="--no-category--">-- No hay categorías (crea una primero) --</option>';
            categorySelect.disabled = true;
        } else {
             console.log(`${querySnapshot.size} categorías encontradas para ${selectedBrand}`);
            categorySelect.innerHTML = '<option value="">-- Selecciona Categoría --</option>';
            const categories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            const categoryMap = new Map();
            const topLevel = [];
            categories.forEach(c => {
                if (c.parentId === null) {
                    topLevel.push(c);
                }
                categoryMap.set(c.id, c);
            });
            
            topLevel.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

            topLevel.forEach(parent => {
                const parentOption = document.createElement('option');
                parentOption.value = parent.id;
                parentOption.textContent = parent.name;
                parentOption.dataset.imageUrl = parent.imageUrl || '';
                if (categoryToSelect && parent.id === categoryToSelect) {
                    parentOption.selected = true;
                }
                categorySelect.appendChild(parentOption);
                
                categories.filter(c => c.parentId === parent.id)
                          .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                          .forEach(child => {
                              const childOption = document.createElement('option');
                              childOption.value = child.id;
                              childOption.textContent = `  ↳ ${child.name}`; // Indentación
                              childOption.dataset.imageUrl = child.imageUrl || '';
                              if (categoryToSelect && child.id === categoryToSelect) {
                                  childOption.selected = true;
                              }
                              categorySelect.appendChild(childOption);
                          });
            });
            
             categories.filter(c => c.parentId !== null && !categoryMap.has(c.parentId))
                       .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                       .forEach(orphan => {
                            const orphanOption = document.createElement('option');
                            orphanOption.value = orphan.id;
                            orphanOption.textContent = `? ${orphan.name}`; // Marcar como huérfana
                            orphanOption.dataset.imageUrl = orphan.imageUrl || '';
                            if (categoryToSelect && orphan.id === categoryToSelect) {
                                orphanOption.selected = true;
                            }
                            categorySelect.appendChild(orphanOption);
                       });

            categorySelect.disabled = false;
        }
    } catch (error) {
        console.error(`Error GRAVE al cargar categorías para ${selectedBrand}:`, error);
        categorySelect.innerHTML = '<option value="--error--">-- Error al cargar --</option>';
        categorySelect.disabled = true;
        displayError(document.getElementById('add-product-form'), "Error al cargar las categorías. Verifica ÍNDICES (link en consola F12).");
    } finally {
         categoryLoadingMsg.style.display = 'none';
    }
}
async function startEditProduct(productId) {
    console.log("Iniciando edición de producto ID:", productId);
     const form = document.getElementById('add-product-form');
     const brandSelect = document.getElementById('product-brand');
     const categorySelect = document.getElementById('product-category');
     const feedbackElement = document.getElementById('add-product-feedback');
     const submitButton = document.getElementById('submit-product-button');
     const cancelButton = document.getElementById('cancel-edit-button');
     const formTitle = document.getElementById('form-title');
     const editProductIdInput = document.getElementById('edit-product-id');
     const detailSectionsContainer = document.getElementById('detail-sections-container');
     
    feedbackElement.style.display = 'none';
    form.reset();
    detailSectionsContainer.innerHTML = ''; 
    categorySelect.innerHTML = '<option value="">-- Selecciona Marca Primero --</option>';
    categorySelect.disabled = true;

    try {
        const docRef = db.collection('products').doc(productId);
        console.log("Editando producto, leyendo de:", docRef.path);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            const product = docSnap.data();
            console.log("Datos cargados para editar:", product);
            
            document.getElementById('product-name').value = product.name || '';
            document.getElementById('product-subtitle').value = product.subtitle || '';
            brandSelect.value = product.brand || '';
            document.getElementById('product-price').value = product.price || 0;
            document.getElementById('product-image-urls').value = (product.imageUrls || []).join('\n');
            // --- NUEVO: Cargar la fecha existente en el input ---
const createdAtInput = document.getElementById('product-created-at');
if (product.createdAtNumerico) {
    // Crear fecha desde el timestamp guardado
    const date = new Date(product.createdAtNumerico);
    
    // Ajuste para que el input datetime-local lo lea correctamente (formato YYYY-MM-DDTHH:MM)
    // Esto ajusta la zona horaria local para que no se reste tiempo al visualizar
    const offset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date - offset)).toISOString().slice(0, 16);
    
    createdAtInput.value = localISOTime;
} else {
    createdAtInput.value = '';
}
// ----------------------------------------------------
            
            if (product.detailSections && Array.isArray(product.detailSections)) {
                 product.detailSections.forEach(section => {
                     if(window.adminProductForm && typeof window.adminProductForm.addDetailSection === 'function') {
                         window.adminProductForm.addDetailSection(section.title, section.content);
                     }
                 });
            } else if (product.description) { 
                 console.log("Detectado campo 'description' antiguo. Migrando a sección 'Detalles'.");
                 if(window.adminProductForm && typeof window.adminProductForm.addDetailSection === 'function') {
                    window.adminProductForm.addDetailSection('Detalles', product.description);
                 }
            }

            if (product.brand) {
                 console.log("Marca detectada:", product.brand, ". Intentando cargar y preseleccionar categoría ID:", product.categoryId);
                await updateCategoryDropdown(product.brand, product.categoryId);
            } else {
                 console.warn("Producto sin marca definida, no se puede cargar categoría.");
            }
            
            editProductIdInput.value = productId;
            formTitle.textContent = 'Editar Producto';
            submitButton.textContent = 'Actualizar Producto';
            submitButton.classList.remove('add-button'); submitButton.classList.add('edit-button');
            cancelButton.style.display = 'inline-block';
            form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            console.error("No se encontró el producto para editar ID:", productId);
            alert("Error: No se encontró el producto seleccionado.");
            cancelEditProduct();
        }
    } catch (error) {
        console.error("Error al obtener datos del producto para editar:", error);
        alert("Error al cargar los datos del producto.");
        cancelEditProduct();
    }
}
function cancelEditProduct() {
    console.log("Cancelando edición de producto");
    const form = document.getElementById('add-product-form');
    const categorySelect = document.getElementById('product-category');
    const feedbackElement = document.getElementById('add-product-feedback');
    const submitButton = document.getElementById('submit-product-button');
    const cancelButton = document.getElementById('cancel-edit-button');
    const formTitle = document.getElementById('form-title');
    const editProductIdInput = document.getElementById('edit-product-id');
    const detailSectionsContainer = document.getElementById('detail-sections-container');
    
    form.reset();
    if(detailSectionsContainer) detailSectionsContainer.innerHTML = ''; 
    editProductIdInput.value = '';
    formTitle.textContent = 'Agregar Nuevo Producto';
    submitButton.textContent = 'Agregar Producto';
    submitButton.classList.remove('edit-button');
    submitButton.classList.add('add-button');
    cancelButton.style.display = 'none';
    feedbackElement.style.display = 'none';
    submitButton.disabled = false;
    categorySelect.innerHTML = '<option value="">-- Selecciona Marca Primero --</option>';
    categorySelect.disabled = true;
}
function showFeedback(message, type, element, button, autoHide = false) {
    if (!element || !button) return;
    element.textContent = message;
    element.className = `feedback-message ${type}`;
    element.style.display = 'block';
    button.disabled = false;
    if (autoHide) {
        setTimeout(() => {
            element.style.display = 'none';
        }, 3000);
    }
}
function addAdminButtonListeners() {
    const tableBody = document.getElementById('products-table-body');
    if (!tableBody) return;
    tableBody.removeEventListener('click', handleAdminTableClick);
    tableBody.addEventListener('click', handleAdminTableClick);
}
async function handleAdminTableClick(e) {
    const target = e.target;
    if (!target.matches('.edit-btn, .delete-btn')) return;
    const productId = target.dataset.id;
    if (!productId) return;
    if (target.classList.contains('edit-btn')) {
        startEditProduct(productId);
    } else if (target.classList.contains('delete-btn')) {
        const row = target.closest('tr');
        const productName = row?.querySelector('td:nth-child(2)')?.textContent || 'este producto';
        if (confirm(`¿Estás seguro de que quieres eliminar "${productName}"?\n¡Esto NO se puede deshacer!`)) {
            try {
                console.log("Eliminando producto ID:", productId);
                await db.collection('products').doc(productId).delete();
                console.log("Producto eliminado OK");
                await cargarProductosAdmin();
                alert(`Producto "${productName}" eliminado.`);
                cancelEditProduct();
            } catch (error) {
                console.error("Error al eliminar producto:", error);
                alert("Error al eliminar el producto. Revisa la consola (F12).");
            }
        }
    }
}

// --- Función para renderizar una tarjeta de producto ---
function createProductCard(producto, productId) {
    const name = producto.name || 'Producto Sin Nombre';
    const price = typeof producto.price === 'number' ? producto.price.toFixed(2) : 'N/A';
    
    // --- LÓGICA DE STOCK ---
    const isNoStock = producto.noStock === true;
    const btnDisabled = isNoStock ? 'disabled' : '';
    const btnText = isNoStock ? 'Sin Stock' : 'Agregar';
    const overlayHTML = isNoStock ? '<div class="stock-overlay"><span class="stock-label">SIN STOCK</span></div>' : '';
    // -----------------------

    const imageUrls = Array.isArray(producto.imageUrls) && producto.imageUrls.length > 0
                      ? producto.imageUrls
                      : [producto.imageUrl || 'https://via.placeholder.com/150?text=No+Image'];
    const categoryName = producto.categoryName || '';
    const categoryImageUrl = producto.categoryImageUrl || '';

    let imagesHTML = '';
    imageUrls.forEach((url, index) => {
        imagesHTML += `<img src="${url}" alt="${name}" class="carousel-image ${index === 0 ? 'active' : ''}" onerror="this.onerror=null; this.src='https://via.placeholder.com/150?text=Error+Img';">`;
    });

    let categoryHeaderHTML = '';
    if (categoryName) {
        categoryHeaderHTML = `
            <div class="producto-categoria-header">
                ${categoryImageUrl ? `<img src="${categoryImageUrl}" alt="Icono ${categoryName}" class="producto-categoria-imagen" onerror="this.style.display='none';">` : ''}
                <p class="producto-categoria">${categoryName}</p>
            </div>
        `;
    }
    
    const card = document.createElement('div');
    card.className = 'tarjeta-producto';
    card.dataset.productId = productId;
    card.dataset.brand = producto.brand || '';
    
    // Insertamos el overlayHTML dentro del carrusel y configuramos el botón
    card.innerHTML = `
        <div class="product-carousel">
            ${overlayHTML}
            ${imagesHTML}
            ${imageUrls.length > 1 ? '<button class="carousel-button prev">&lt;</button><button class="carousel-button next">&gt;</button>' : ''}
        </div>
        <div class="producto-info">
            ${categoryHeaderHTML}
            <a href="producto-detalle.html?id=${productId}" class="producto-nombre-link">
                <h3 class="producto-nombre">${name}</h3>
            </a>
            <p class="producto-precio">$${price}</p>

            <div class="producto-acciones">
                <label for="cantidad-${productId}">Cant:</label>
                <input type="number" id="cantidad-${productId}" class="producto-cantidad" value="1" min="1" ${btnDisabled}>
                <button class="boton-agregar" data-id="${productId}" ${btnDisabled}>${btnText}</button>
            </div>
        </div>
    `;
    return card;
}
// Exponer la función globalmente
window.createProductCard = createProductCard;


// --- Lógica de Catálogo por Categorías (Cliente) ---
function iniciarCatalogoPorCategorias(marca, container) {
    if (!container) return;
    
    mostrarCategoriasPorMarca(marca, container);

    container.addEventListener('click', (e) => {
        
        const categoriaCard = e.target.closest('.tarjeta-categoria');
        if (categoriaCard) {
            const categoryId = categoriaCard.dataset.categoryId;
            const categoryName = categoriaCard.dataset.categoryName;

            // Redirección especial para "Línea de Color Mary Kay"
            const currentPage = window.location.pathname.split('/').pop().replace('.html', '');
            if (currentPage === 'productos-marykay' && categoryName.trim().toLowerCase() === 'línea de color mary kay') {
                console.log("Redirigiendo a página especial de Línea de Color...");
                window.location.href = 'linea-de-color-marykay.html';
                return; 
            }

            if (categoryId) {
                mostrarSubCategoriasOProductos(marca, categoryId, categoryName, container);
            }
            return; 
        }

        const volverBtn = e.target.closest('#catalogo-volver-btn');
        if (volverBtn) {
            mostrarCategoriasPorMarca(marca, container);
            return; 
        }
    });
}
async function mostrarCategoriasPorMarca(marca, container) {
    const loadingMsg = container.querySelector('.loading-message');
    const header = document.getElementById('catalogo-header');
    const title = container.querySelector('h2');
    
    container.querySelectorAll('.tarjeta-producto, .tarjeta-categoria, .app-error-message, .mensaje-vacio, #catalogo-volver-btn').forEach(el => el.remove());
    if (loadingMsg) { loadingMsg.textContent = 'Cargando categorías...'; loadingMsg.style.display = 'block'; }
    if (header) header.innerHTML = ''; 
    
    if (title) { 
        if (marca === 'marykay') title.textContent = 'Catálogo Mary Kay';
        else if (marca === 'biogreen') title.textContent = 'Catálogo Biogreen';
        else if (marca === 'arbell') title.textContent = 'Catálogo Arbell';
        else if (marca === 'nexo') title.textContent = 'Catálogo Nexo (Indumentaria)';
        else title.textContent = `Catálogo ${marca.charAt(0).toUpperCase() + marca.slice(1)}`;
    }

    try {
        console.log(`Cliente (${marca}): Consultando categorías PRINCIPALES...`);
        const querySnapshot = await db.collection('categories')
                                    .where('brand', '==', marca)
                                    .where('parentId', '==', null) 
                                    .orderBy('name')
                                    .get();
        
        console.log(`Cliente (${marca}): Consulta completada. Documentos encontrados: ${querySnapshot.size}`);
        if (loadingMsg) loadingMsg.style.display = 'none';

        if (querySnapshot.empty) {
            console.log(`Cliente (${marca}): No se encontraron categorías principales en Firestore.`);
            console.log(`Cliente (${marca}): No hay categorías principales. Buscando productos huerfanos...`);
            await mostrarProductosHuerfanos(marca, container);
            return;
        }

        console.log(`Cliente (${marca}): ${querySnapshot.size} categorías principales encontradas. Procesando...`);
        let categoriesHTML = '';
        querySnapshot.forEach(doc => {
            const categoria = doc.data();
            const id = doc.id;
            const imageUrl = categoria.imageUrl || 'https://via.placeholder.com/150?text=Sin+Imagen';
            const name = categoria.name || 'Categoría sin nombre';
            categoriesHTML += `
                <div class="tarjeta-categoria" data-category-id="${id}" data-category-name="${name}">
                    <img src="${imageUrl}" alt="${name}" onerror="this.onerror=null; this.src='https://via.placeholder.com/150?text=Error+Img';">
                    <h3>${name}</h3>
                </div>
            `;
        });
        title.insertAdjacentHTML('afterend', categoriesHTML);
        
    } catch (error) {
        console.error(`Cliente (${marca}): ¡Error en la consulta Firestore!`, error);
        displayError(container, `Error al cargar categorías de ${marca}. Revisa ÍNDICES (link en consola F12).`);
        console.error("¡REVISA ESTO! Necesitas un índice en Firestore: categories | brand (ASC) | parentId (ASC) | name (ASC)");
        if (loadingMsg) loadingMsg.style.display = 'none';
    }
}
async function mostrarProductosHuerfanos(marca, container) {
    const loadingMsg = container.querySelector('.loading-message');
    try {
        const querySnapshot = await db.collection('products')
                                    .where('brand', '==', marca)
                                    .orderBy('name')
                                    .get();
        if (loadingMsg) loadingMsg.style.display = 'none';
        const productDocs = querySnapshot.docs.filter(doc => !doc.id.startsWith('--config-')); 

        if (productDocs.length === 0) {
            container.insertAdjacentHTML('beforeend', '<p class="mensaje-vacio">No hay categorías ni productos disponibles para esta marca.</p>');
            return;
        }

        console.log(`Cliente (fallback): ${productDocs.length} productos encontrados.`);
        productDocs.forEach((doc) => {
             const producto = doc.data(); const productId = doc.id;
             const card = createProductCard(producto, productId);
             container.appendChild(card);
        });
        setupCarousels(container); 
    } catch (error) {
         console.error(`Error GRAVE cargando productos cliente ${marca}: `, error);
        displayError(container, `Error al cargar productos de ${marca}. Revisa ÍNDICES (link en consola F12).`);
        if (loadingMsg) loadingMsg.style.display = 'none';
    }
}
async function mostrarSubCategoriasOProductos(marca, parentId, parentName, container) {
    const loadingMsg = container.querySelector('.loading-message');
    const header = document.getElementById('catalogo-header');
    const title = container.querySelector('h2'); 

    container.querySelectorAll('.tarjeta-categoria, .tarjeta-producto, .app-error-message, .mensaje-vacio').forEach(el => el.remove());
    if (loadingMsg) { loadingMsg.textContent = 'Cargando...'; loadingMsg.style.display = 'block'; }

    if (title) title.textContent = parentName; 
    if (header) { 
        header.innerHTML = '<button id="catalogo-volver-btn" class="admin-button cancel-button">‹‹ Volver a Categorías Principales</button>';
    }

    try {
        console.log(`Cliente: Buscando sub-categorías de: ${parentId}`);
        const subCatQuery = await db.collection('categories')
                                  .where('parentId', '==', parentId)
                                  .orderBy('name')
                                  .get();
        
        if (loadingMsg) loadingMsg.style.display = 'none';

        if (!subCatQuery.empty) {
            console.log(`Encontradas ${subCatQuery.size} sub-categorías.`);
            let categoriesHTML = '';
            subCatQuery.forEach(doc => {
                const categoria = doc.data();
                const id = doc.id;
                const imageUrl = categoria.imageUrl || 'https://via.placeholder.com/150?text=Sin+Imagen';
                const name = categoria.name || 'Categoría sin nombre';
                categoriesHTML += `
                    <div class="tarjeta-categoria" data-category-id="${id}" data-category-name="${name}">
                        <img src="${imageUrl}" alt="${name}" onerror="this.onerror=null; this.src='https://via.placeholder.com/150?text=Error+Img';">
                        <h3>${name}</h3>
                    </div>
                `;
            });
            title.insertAdjacentHTML('afterend', categoriesHTML);
        } else {
            console.log(`No hay sub-categorías. Buscando productos para: ${parentId}`);
            await mostrarProductosPorCategoria(marca, parentId, parentName, container);
        }

    } catch (error) {
        console.error(`Error GRAVE buscando sub-categorías o productos: `, error);
        displayError(container, `Error al cargar. Revisa los ÍNDICES (link en consola F12).`);
        console.error("¡REVISA ESTO! Necesitas un índice en Firestore: categories | parentId (ASC) | name (ASC)");
        if (loadingMsg) loadingMsg.style.display = 'none';
    }
}
async function mostrarProductosPorCategoria(marca, categoryId, categoryName, container) {
    const loadingMsg = container.querySelector('.loading-message');
    const header = document.getElementById('catalogo-header');
    const title = container.querySelector('h2'); 

    container.querySelectorAll('.tarjeta-categoria, .tarjeta-producto, .app-error-message, .mensaje-vacio').forEach(el => el.remove());
    if (loadingMsg) { loadingMsg.textContent = 'Cargando productos...'; loadingMsg.style.display = 'block'; }

    if (title) title.textContent = categoryName; 
    if (header) { 
        header.innerHTML = '<button id="catalogo-volver-btn" class="admin-button cancel-button">‹‹ Volver a Categorías Principales</button>';
    }

    try {
        console.log(`Cliente: Buscando productos marca=${marca} y categoriaId=${categoryId}...`);
        const querySnapshot = await db.collection('products')
                                    .where('brand', '==', marca)
                                    .where('categoryId', '==', categoryId)
                                    .orderBy('name')
                                    .get();
        if (loadingMsg) loadingMsg.style.display = 'none';
        const productDocs = querySnapshot.docs.filter(doc => !doc.id.startsWith('--config-')); 

        if (productDocs.length === 0) {
             title.insertAdjacentHTML('afterend', '<p class="mensaje-vacio">No hay productos disponibles en esta categoría.</p>');
            return;
        }

        console.log(`Cliente: ${productDocs.length} productos encontrados.`);
        productDocs.forEach((doc) => {
             const producto = doc.data(); const productId = doc.id;
             const card = createProductCard(producto, productId);
             // Insertar la tarjeta después del título
             title.insertAdjacentElement('afterend', card);
        });
        // Revertir el orden si se insertaron al revés (insertAdjacent afterend)
        const productCards = container.querySelectorAll('.tarjeta-producto');
        if(productCards.length > 1) {
             const parent = productCards[0].parentNode;
             const reversedCards = Array.from(productCards).reverse();
             reversedCards.forEach(card => parent.appendChild(card));
        }
        setupCarousels(container); 
    } catch (error) {
        console.error(`Error GRAVE cargando productos por categoría ${categoryId}: `, error);
        if(title) {
            displayError(title.parentElement, `Error al cargar productos. Revisa los ÍNDICES (link en consola F12).`);
        } else {
             displayError(container, `Error al cargar productos. Revisa los ÍNDICES (link en consola F12).`);
        }
        if (loadingMsg) loadingMsg.style.display = 'none';
    }
}


// --- Carga Plana de Productos (Cliente - para Novedades) ---
async function cargarProductosCliente(marca, container) {
    if (!container) { console.error("Contenedor de productos no proporcionado a cargarProductosCliente"); return; }
    let loadingMsg = container.querySelector('.loading-message');
    if (!loadingMsg) { 
        loadingMsg = document.createElement('p');
        loadingMsg.className = 'loading-message';
        container.prepend(loadingMsg); 
    }
    loadingMsg.textContent = 'Cargando productos...'; loadingMsg.style.display = 'block';
    container.querySelectorAll('.tarjeta-producto, .mensaje-vacio, .app-error-message').forEach(el => el.remove());

    try {
        console.log(`Cliente (plano): Buscando productos marca=${marca}...`);
        const querySnapshot = await db.collection('products')
                                    .where('brand', '==', marca)
                                    .orderBy('name')
                                    .get();
        if (loadingMsg) loadingMsg.style.display = 'none';
        const productDocs = querySnapshot.docs.filter(doc => !doc.id.startsWith('--config-'));

        if (productDocs.length === 0) {
            container.insertAdjacentHTML('beforeend', '<p class="mensaje-vacio">No hay productos disponibles.</p>');
            return;
        }
        console.log(`Cliente (plano): ${productDocs.length} productos encontrados.`);
        productDocs.forEach((doc) => {
             const producto = doc.data(); const productId = doc.id;
             const card = createProductCard(producto, productId);
             container.appendChild(card);
        });
        setupCarousels(container); 
    } catch (error) {
        console.error(`Error GRAVE cargando productos cliente ${marca}: `, error);
        displayError(container, `Error al cargar productos de ${marca}. Revisa ÍNDICES (link en consola F12).`);
        if (loadingMsg) loadingMsg.style.display = 'none';
    }
}

// --- Carruseles de Productos ---
function setupCarousels(scopeElement = document) {
     if (!scopeElement) scopeElement = document; 
     const carousels = scopeElement.querySelectorAll('.product-carousel');
    carousels.forEach(carousel => {
        const images = carousel.querySelectorAll('.carousel-image');
        const prevButton = carousel.querySelector('.carousel-button.prev');
        const nextButton = carousel.querySelector('.carousel-button.next');
        let currentIndex = 0;

        if (images.length <= 1) { 
             if (prevButton) prevButton.style.display = 'none';
             if (nextButton) nextButton.style.display = 'none';
             if (images.length === 1 && !images[0].classList.contains('active')) {
                 images[0].classList.add('active'); 
             }
             return; 
        }
        if (prevButton) prevButton.style.display = 'block';
        if (nextButton) nextButton.style.display = 'block';

        function showImage(index) {
             images.forEach((img, i) => img.classList.toggle('active', i === index));
        }

        const newPrev = prevButton?.cloneNode(true);
        const newNext = nextButton?.cloneNode(true);

        if (newPrev && prevButton) {
            carousel.replaceChild(newPrev, prevButton);
            newPrev.addEventListener('click', () => {
                currentIndex = (currentIndex - 1 + images.length) % images.length;
                showImage(currentIndex);
            });
        }
         if (newNext && nextButton) {
            carousel.replaceChild(newNext, nextButton);
            newNext.addEventListener('click', () => {
                currentIndex = (currentIndex + 1) % images.length;
                showImage(currentIndex);
            });
        }
        showImage(currentIndex); 
    });
}
window.setupCarousels = setupCarousels;


// --- LISTENER PARA CLIC EN TARJETA (NAVEGACIÓN) ---
document.body.addEventListener('click', handleCardClick);

function handleCardClick(e) {
    const card = e.target.closest('.tarjeta-producto');
    if (!card) {
        return;
    }
    const isInteractive = e.target.closest('button, a, input, label');
    
    if (isInteractive) {
        return;
    }
    const productId = card.dataset.productId;
    const brand = card.dataset.brand; // Leemos la marca que guardamos antes

    if (productId) {
        if (brand === 'nucleo') {
            // Si es Núcleo, vamos al nuevo diseño oscuro
            console.log("Navegando a detalle NÚCLEO:", productId);
            window.location.href = `nucleo-detalle.html?id=${productId}`;
        } else {
            // Si es cualquier otra marca, vamos al diseño estándar
            console.log("Navegando a detalle ESTÁNDAR:", productId);
            window.location.href = `producto-detalle.html?id=${productId}`;
        }
    }
}


// --- LÓGICA DEL CARRITO (CORREGIDA) ---
function addItemToCart(item, buttonElement, qtyInputElement = null) {
    if (!item || !buttonElement) return;

    // 1. Obtener carrito actual
    let carrito = getCarritoFromStorage();

    // 2. VALIDACIÓN DE TIPO (Mayorista vs Minorista)
    if (carrito.length > 0) {
        // Si el producto en el carrito no tiene 'tipo', asumimos que es 'minorista' (para compatibilidad)
        const tipoExistente = carrito[0].tipo || 'minorista'; 
        const tipoNuevo = item.tipo || 'minorista';

        if (tipoExistente !== tipoNuevo) {
            const confirmacion = confirm(
                `⚠️ CONFLICTO DE PEDIDO ⚠️\n\n` +
                `Tu carrito actual es ${tipoExistente.toUpperCase()}.\n` +
                `No puedes mezclar con productos ${tipoNuevo.toUpperCase()}S.\n\n` +
                `¿Deseas VACIAR el carrito actual para agregar este producto?`
            );

            if (confirmacion) {
                carrito = []; // Vaciamos memoria
                saveCarritoToStorage([]); // Vaciamos localStorage
                actualizarContadorCarrito();
                renderizarCarrito(); // Refrescamos visualmente si estamos en carrito.html
                if (typeof renderSideCart === 'function') renderSideCart(); // Refrescamos carrito lateral
            } else {
                return; // Cancelamos la acción
            }
        }
    }

    console.log(`Agregando al carrito (${item.tipo || 'minorista'}):`, item);
    
    // 3. Lógica de agregado normal
    const itemExistenteIndex = carrito.findIndex(i => i.id === item.id);

    if (itemExistenteIndex > -1) { 
        carrito[itemExistenteIndex].cantidad += item.cantidad;
    } else { 
        carrito.push(item);
    }

    saveCarritoToStorage(carrito);
    actualizarContadorCarrito(); 

    // 4. Feedback Visual
    if (typeof openSideCart === 'function') openSideCart();

    const textoOriginal = buttonElement.textContent;
    buttonElement.textContent = '¡Agregado!';
    buttonElement.style.backgroundColor = '#28a745'; 
    buttonElement.style.color = 'white';
    buttonElement.disabled = true; 

    setTimeout(() => { 
        buttonElement.textContent = textoOriginal; // Restaurar texto original
        if (buttonElement.classList.contains('btn-mayorista')) {
             buttonElement.style.backgroundColor = '#333'; 
             buttonElement.style.color = '#d4af37';
        } else {
             buttonElement.style.backgroundColor = ''; 
             buttonElement.style.color = '';
        }
        buttonElement.disabled = false;
        if (qtyInputElement) qtyInputElement.value = 1; 
    }, 1500);
}

// --- Función para sumar popularidad al producto en Firebase (AHORA ESTÁ AFUERA Y VISIBLE) ---
function registrarInteraccionProducto(productId) {
    if (!productId) return;
    
    // Usamos 'salesCount' como el campo para medir popularidad
    const productRef = db.collection('products').doc(productId);

    // increment(1) es atómico: cuenta correctamente aunque haya muchos clics simultáneos
    productRef.update({
        salesCount: firebase.firestore.FieldValue.increment(1)
    }).then(() => {
        console.log(`Popularidad +1 para producto ID: ${productId}`);
    }).catch((error) => {
        console.error("Error sumando popularidad:", error);
    });
}
document.body.addEventListener('click', handleAddToCartClick);

function handleAddToCartClick(e) {
    if (!e.target.classList.contains('boton-agregar')) { 
        return; 
    } 
    const tarjeta = e.target.closest('.tarjeta-producto');
    if (!tarjeta) {
        return;
    }
    
    e.preventDefault(); 
    e.stopPropagation(); 

    const boton = e.target;
    const productId = boton.dataset.id;

    if (!productId) {
         console.warn("No se encontró ID de producto para el botón.");
         return;
    }

    const nombre = tarjeta.querySelector('.producto-nombre')?.textContent || 'Producto';
    const precioString = tarjeta.querySelector('.producto-precio')?.textContent.replace('$', '') || '0';
    const precio = parseFloat(precioString);
    const inputCantidad = tarjeta.querySelector('.producto-cantidad');
    const cantidad = inputCantidad ? parseInt(inputCantidad.value, 10) : 1;
    const imagenElement = tarjeta.querySelector('.carousel-image.active') || tarjeta.querySelector('.carousel-image');
    const imagenSrc = imagenElement ? imagenElement.src : 'https://via.placeholder.com/80'; 

    if (isNaN(precio) || precio < 0) { console.warn("Precio inválido:", precioString); return; }
    if (isNaN(cantidad) || cantidad <= 0) {
        alert("Por favor, ingresa una cantidad válida.");
        if (inputCantidad) inputCantidad.value = 1; 
        return;
     }

    const item = { 
        id: productId, 
        nombre: nombre, 
        precio: precio, 
        cantidad: cantidad, 
        imagen: imagenSrc,
        tipo: 'minorista' // <--- ETIQUETA NUEVA
    };
    
    addItemToCart(item, boton, inputCantidad);
    registrarInteraccionProducto(productId);
}

async function loadProductDetails(productId) {
    const container = document.getElementById('detalle-producto-wrapper');
    const loadingMsg = document.querySelector('.detalle-producto-container .loading-message');
    
    if (!container || !loadingMsg) {
        console.error("No se encontraron los elementos de la página de detalle.");
        return;
    }

    const imgGrande = document.getElementById('detalle-img-grande');
    const thumbnailsContainer = document.getElementById('detalle-thumbnails');
    const categoriaEl = document.getElementById('detalle-categoria');
    const nombreEl = document.getElementById('detalle-nombre');
    const subtituloEl = document.getElementById('detalle-subtitulo');
    const precioEl = document.getElementById('detalle-precio');
    const cantidadInput = document.getElementById('detalle-cantidad');
    const agregarBtn = document.getElementById('detalle-agregar-btn');
    
    const volverBtn = document.getElementById('detalle-volver-btn');
    const acordeonContainer = document.getElementById('detalle-acordeon-container');

    function getIconForTitle(title) {
        if (!title) return '•';
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.includes('beneficio')) {
            return '😊'; 
        }
        if (lowerTitle.includes('aplicación') || lowerTitle.includes('uso')) {
            return '✓'; 
        }
        if (lowerTitle.includes('ingrediente') || lowerTitle.includes('funcione')) {
            return '⚙️'; 
        }
        return '•'; 
    }

    try {
        console.log(`Buscando producto con ID: ${productId}...`);
        const docRef = db.collection('products').doc(productId);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            console.error(`Producto con ID ${productId} no encontrado.`);
            displayError(document.querySelector('.detalle-producto-container'), "Error: Producto no encontrado.");
            loadingMsg.style.display = 'none';
            return;
        }

        const product = docSnap.data();
        console.log("Producto encontrado:", product.name);

        document.title = `${product.name} - Mi Tienda`; 
        nombreEl.textContent = product.name;
        categoriaEl.textContent = product.categoryName || 'Sin Categoría';
        
        if (subtituloEl && product.subtitle) {
            subtituloEl.textContent = product.subtitle;
            subtituloEl.style.display = 'block';
        } else if (subtituloEl) {
            subtituloEl.style.display = 'none'; 
        }

        precioEl.textContent = `$${product.price.toFixed(2)}`;
        
        if (volverBtn) {
             volverBtn.href = "javascript:history.back()";
             volverBtn.textContent = "« Volver a la Lista";
             volverBtn.style.display = 'inline-block';
        }

        const detailSections = product.detailSections || [];
        if (detailSections.length === 0 && product.description) { 
            detailSections.push({ title: "Detalles", content: product.description });
        }

        if (acordeonContainer) {
            acordeonContainer.innerHTML = ''; 
            if (detailSections.length > 0) {
                
                const accordionBox = document.createElement('div');
                accordionBox.className = 'detalle-acordeon-links-box';

                detailSections.forEach((section, index) => {
                    const item = document.createElement('div');
                    item.className = 'acordeon-item-new'; 
                    
                    item.innerHTML = `
                        <button class="acordeon-header-new">
                            <span class="acordeon-icono-new">${getIconForTitle(section.title)}</span>
                            <span class="acordeon-titulo-new">${section.title}</span>
                            <span class="acordeon-arrow-new">›</span>
                        </button>
                        <div class="acordeon-contenido-new">
                            <p>${section.content.replace(/\n/g, '<br>')}</p>
                        </div>
                    `;
                    accordionBox.appendChild(item);
                });
                acordeonContainer.appendChild(accordionBox);

                acordeonContainer.addEventListener('click', (e) => {
                    const header = e.target.closest('.acordeon-header-new');
                    if (!header) return; 
                    
                    const item = header.parentElement;
                    const isActive = item.classList.contains('active');

                    acordeonContainer.querySelectorAll('.acordeon-item-new').forEach(i => i.classList.remove('active'));
                    
                    if (!isActive) {
                        item.classList.add('active');
                    }
                });

            } else {
                 acordeonContainer.innerHTML = '<p>No hay detalles adicionales disponibles para este producto.</p>';
            }
        }

        const imageUrls = Array.isArray(product.imageUrls) && product.imageUrls.length > 0
                          ? product.imageUrls
                          : ['https://via.placeholder.com/500?text=No+Image'];
        
        imgGrande.src = imageUrls[0]; 
        imgGrande.alt = product.name;
        thumbnailsContainer.innerHTML = ''; 

        if (imageUrls.length > 1) {
            imageUrls.forEach((url, index) => {
                const thumb = document.createElement('img');
                thumb.src = url;
                thumb.alt = `${product.name} (miniatura ${index + 1})`;
                thumb.className = 'detalle-thumb';
                if (index === 0) {
                    thumb.classList.add('active'); 
                }
                
                thumb.addEventListener('click', () => {
                    imgGrande.src = url;
                    thumbnailsContainer.querySelectorAll('.detalle-thumb').forEach(t => t.classList.remove('active'));
                    thumb.classList.add('active');
                });
                
                thumbnailsContainer.appendChild(thumb);
            });
        }

        agregarBtn.dataset.id = productId; 
        
        agregarBtn.addEventListener('click', () => {
            const cantidad = parseInt(cantidadInput.value, 10);
            if (isNaN(cantidad) || cantidad <= 0) {
                alert("Por favor, ingresa una cantidad válida.");
                cantidadInput.value = 1;
                return;
            }
            
            const item = {
                id: productId,
                nombre: product.name,
                precio: product.price,
                cantidad: cantidad,
                imagen: imageUrls[0],
                tipo: 'minorista' // <--- ETIQUETA NUEVA
            };
            
            addItemToCart(item, agregarBtn, cantidadInput);
        });

        loadingMsg.style.display = 'none';
        container.style.display = 'grid'; 

    } catch (error) {
        console.error(`Error GRAVE al cargar producto ${productId}:`, error);
        displayError(document.querySelector('.detalle-producto-container'), "Error al cargar el producto. Revisa la consola.");
        loadingMsg.style.display = 'none';
    }
}


// --- Lógica del Carrito (Página carrito.html) ---
function renderizarCarrito() {
    const container = document.getElementById('carrito-container');
    const totalContainer = document.getElementById('carrito-total-container');
    const btnFinalizar = document.getElementById('finalizar-compra');
    const btnVaciar = document.getElementById('vaciar-carrito');

    if (!container || !totalContainer || !btnFinalizar || !btnVaciar) {
        console.error("Elementos de la página del carrito no encontrados.");
        return;
    }

    const carrito = getCarritoFromStorage();
    container.innerHTML = ''; 
    totalContainer.innerHTML = ''; 

    if (carrito.length === 0) {
        container.innerHTML = '<p class="carrito-vacio">Tu carrito está vacío.</p>';
        btnFinalizar.style.display = 'none'; 
        btnVaciar.style.display = 'none';
        return;
    }

    let total = 0;
    carrito.forEach(item => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        container.innerHTML += `
            <div class="carrito-item" data-id="${item.id}">
                <img src="${item.imagen}" alt="${item.nombre}" onerror="this.onerror=null; this.src='https://via.placeholder.com/80?text=Img';">
                <div class="carrito-item-info">
                    <h4>${item.nombre}</h4>
                    <p>Cantidad: ${item.cantidad}</p>
                    <p>Precio: $${item.precio.toFixed(2)}</p>
                    <p>Subtotal: $${subtotal.toFixed(2)}</p>
                </div>
                <button class="boton-eliminar" data-id="${item.id}">Eliminar</button>
            </div>
        `;
    });

    totalContainer.innerHTML = `<p class="carrito-total">Total: $${total.toFixed(2)}</p>`; 
    btnFinalizar.style.display = 'inline-block'; 
    btnVaciar.style.display = 'inline-block';
    addListenersPaginaCarrito(); 
}
function addListenersPaginaCarrito() {
    removeListenersPaginaCarrito(); 
    document.getElementById('carrito-container')?.addEventListener('click', handleEliminarItemCarrito);
    document.getElementById('finalizar-compra')?.addEventListener('click', handleFinalizarCompra);
    document.getElementById('vaciar-carrito')?.addEventListener('click', handleVaciarCarrito);
}
function removeListenersPaginaCarrito() {
    document.getElementById('carrito-container')?.removeEventListener('click', handleEliminarItemCarrito);
    document.getElementById('finalizar-compra')?.removeEventListener('click', handleFinalizarCompra);
    document.getElementById('vaciar-carrito')?.removeEventListener('click', handleVaciarCarrito);
}
function handleFinalizarCompra() {
    const carrito = getCarritoFromStorage();
    if (carrito.length === 0) return;

    let mensaje = "¡Hola! Quisiera hacer el siguiente pedido:\n\n";
    let total = 0;
    
    carrito.forEach(item => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        
        mensaje += `*Producto:* ${item.nombre}\n`;
        mensaje += `*Cant:* ${item.cantidad} x $${item.precio.toFixed(2)}\n`;
        
        // --- AQUÍ AGREGAMOS LA NOTA AL MENSAJE ---
        if (item.nota && item.nota.trim() !== "") {
            mensaje += `*Nota:* ${item.nota}\n`;
        }
        // -----------------------------------------
        
        mensaje += `*Subtotal:* $${subtotal.toFixed(2)}\n`;
        mensaje += `-------------------------\n`;
    });
    
    mensaje += `\n*TOTAL DEL PEDIDO: $${total.toFixed(2)}*`;

    // Reemplaza con tu número real
    const numeroWhatsApp = "5493571618367"; 
    const mensajeCodificado = encodeURIComponent(mensaje);
    const urlWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${mensajeCodificado}`;
    window.open(urlWhatsApp, '_blank'); 
}
function handleVaciarCarrito() {
    if (confirm("¿Estás seguro de que quieres vaciar el carrito?")) {
        saveCarritoToStorage([]); 
        actualizarContadorCarrito(); 
        renderizarCarrito(); 
    }
}
function handleEliminarItemCarrito(e) {
    if (!e.target.classList.contains('boton-eliminar')) { return; } 
    const itemId = e.target.dataset.id;
    let carrito = getCarritoFromStorage();
    carrito = carrito.filter(item => item.id !== itemId); 
    saveCarritoToStorage(carrito);
    actualizarContadorCarrito();
    renderizarCarrito(); 
}
function actualizarContadorCarrito() {
    const carrito = getCarritoFromStorage();
    const totalItems = carrito.reduce((total, item) => total + item.cantidad, 0); 
    const cartLink = document.querySelector('.cart-link');
    if (cartLink) {
        cartLink.textContent = totalItems > 0 ? `🛒 Carrito (${totalItems})` : '🛒 Carrito';
    }
}

// --- Lógica de Búsqueda ---
function setupSearchForm() {
    const searchFormDesktop = document.getElementById('search-form');
    const searchInputDesktop = document.getElementById('search-input');
    const searchFormMobileLi = document.getElementById('search-form-nav'); 
    const searchFormMobile = searchFormMobileLi?.querySelector('form'); 
    const searchInputMobile = document.getElementById('search-input-nav');

    if (window.location.pathname.includes('busqueda')) {
        const params = new URLSearchParams(window.location.search);
        const query = params.get('q');
        if (query) {
            const decodedQuery = decodeURIComponent(query);
            if(searchInputDesktop) searchInputDesktop.value = decodedQuery;
            if(searchInputMobile) searchInputMobile.value = decodedQuery;
        }
    }

    const handleSearchSubmit = (searchTerm) => {
        if (searchTerm) {
            window.location.href = `busqueda.html?q=${encodeURIComponent(searchTerm)}`; 
        }
    };

    if (searchFormDesktop && searchInputDesktop) {
        searchFormDesktop.addEventListener('submit', (e) => {
            e.preventDefault();
            const searchTerm = searchInputDesktop.value.trim();
            handleSearchSubmit(searchTerm);
        });
    } else {
        console.warn("Desktop search form elements not found.");
    }

    if (searchFormMobile && searchInputMobile) {
        searchFormMobile.addEventListener('submit', (e) => {
            e.preventDefault();
            const searchTerm = searchInputMobile.value.trim();
            handleSearchSubmit(searchTerm);
        });
    } else {
         const pathname = window.location.pathname;
         if (!pathname.includes('login') && !pathname.includes('registro')) {
             console.warn("Mobile search form elements not found inside .nav-links.");
         }
    }
}
async function executeSearchPageQuery() {
    const resultsContainer = document.getElementById('search-results-list');
    const titleElement = document.getElementById('search-results-title');
    if (!resultsContainer || !titleElement) { console.error("Contenedores de resultados de búsqueda no encontrados en busqueda.html."); return; }

    const params = new URLSearchParams(window.location.search);
    const searchTerm = params.get('q'); 

    if (!searchTerm) { 
        titleElement.textContent = 'Búsqueda Inválida';
        resultsContainer.innerHTML = '<p class="error-message">No se proporcionó un término de búsqueda.</p>';
        return;
    }

    const searchTermLower = decodeURIComponent(searchTerm).toLowerCase();
    titleElement.textContent = `Resultados para: "${decodeURIComponent(searchTerm)}"`;
    resultsContainer.innerHTML = '<p class="loading-message">Buscando productos...</p>';

    try {
        const productsRef = db.collection('products');
        const querySnapshot = await productsRef.get();

        const matches = [];
        querySnapshot.forEach(doc => {
            if (doc.id.startsWith('--config-')) return; 
            const product = doc.data();
            const name = product.name ? product.name.toLowerCase() : '';
            
            let description = '';
            if(product.detailSections && Array.isArray(product.detailSections)) {
                 description = product.detailSections.map(s => s.content).join(' ').toLowerCase();
            } else if (product.description) { 
                 description = product.description.toLowerCase();
            }

            if (name.includes(searchTermLower) || description.includes(searchTermLower)) {
                 matches.push({ id: doc.id, ...product });
            }
        });

        matches.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        if (matches.length === 0) { 
            resultsContainer.innerHTML = '<p class="mensaje-vacio">No se encontraron productos que coincidan con tu búsqueda.</p>';
        } else { 
            matches.forEach(product => { 
                const card = createProductCard(product, product.id);
                resultsContainer.appendChild(card);
            });
            setupCarousels(resultsContainer); 
        }
    } catch (error) {
        console.error("Error durante la búsqueda en busqueda.html:", error);
        displayError(resultsContainer, "Ocurrió un error al buscar productos.");
    }
}

// --- Manejador para botones "Mostrar/Ocultar detalles" ---
document.body.addEventListener('click', function(event) {
    if (event.target.classList.contains('toggle-details-btn')) {
        const button = event.target;
        const detailsContainer = button.nextElementSibling; 

        if (detailsContainer && detailsContainer.classList.contains('producto-detalles')) {
            detailsContainer.classList.toggle('detalles-visibles');
            if (detailsContainer.classList.contains('detalles-visibles')) {
                button.textContent = 'Ocultar detalles';
            } else {
                button.textContent = 'Mostrar detalles';
            }
        } else {
            console.warn("No se encontró el contenedor de detalles (.producto-detalles) inmediatamente después del botón:", button);
        }
    }
});


// --- Lógica del Menú Hamburguesa ---
function setupHamburgerMenu() {
    const hamburgerBtn = document.querySelector('.hamburger-menu');
    const navLinksMenu = document.querySelector('.nav-links'); 

    if (hamburgerBtn && navLinksMenu) {
        hamburgerBtn.addEventListener('click', () => {
            console.log("Clic en Hamburguesa");
            hamburgerBtn.classList.toggle('active');
            navLinksMenu.classList.toggle('active');
        });
    } else {
        const pathname = window.location.pathname;
        if (!pathname.includes('login') && !pathname.includes('registro')) {
            console.warn("No se encontró '.hamburger-menu' o '.nav-links'. El menú móvil no funcionará.");
        }
    }
}

// ==========================================================
// === LÓGICA DEL SIDE CART (CARRITO LATERAL) ===
// ==========================================================

function setupSideCart() {
    // 1. Inyectar el HTML del carrito lateral si no existe
    if (!document.getElementById('side-cart')) {
        const cartHTML = `
            <div id="side-cart-overlay" class="cart-overlay"></div>
            <div id="side-cart" class="side-cart">
                <div class="side-cart-header">
                    <h2>Mi Pedido</h2>
                    <button id="close-side-cart" class="close-cart-btn">&times;</button>
                </div>
                <div id="side-cart-items" class="side-cart-body">
                    </div>
                <div class="side-cart-footer">
                    <div class="side-cart-total">
                        <span>Total:</span>
                        <span id="side-cart-total-price">$0.00</span>
                    </div>
                    <button id="btn-side-checkout" class="side-cart-btn btn-whatsapp">Finalizar Pedido (WhatsApp)</button>
                    <button id="btn-side-clear" class="side-cart-btn btn-view-cart">Vaciar Carrito</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', cartHTML);
    }

    // 2. Añadir Listeners para abrir/cerrar
    const overlay = document.getElementById('side-cart-overlay');
    const sideCart = document.getElementById('side-cart');
    const closeBtn = document.getElementById('close-side-cart');
    const checkoutBtn = document.getElementById('btn-side-checkout');
    const clearBtn = document.getElementById('btn-side-clear');

    // Listener para botones de "Carrito" en el Navbar (Desktop y Mobile)
    const cartLinks = document.querySelectorAll('.cart-link');
    cartLinks.forEach(link => {
        // Clonamos y reemplazamos para eliminar listeners viejos que llevaban a carrito.html
        const newLink = link.cloneNode(true);
        link.parentNode.replaceChild(newLink, link);
        
        newLink.addEventListener('click', (e) => {
            e.preventDefault(); // EVITA ir a carrito.html
            openSideCart();
        });
    });

    // Cerrar carrito
    if(closeBtn) closeBtn.addEventListener('click', closeSideCart);
    if(overlay) overlay.addEventListener('click', closeSideCart);

    // Acciones del footer
    if(checkoutBtn) checkoutBtn.addEventListener('click', handleFinalizarCompra); // Reutilizamos tu función existente
    if(clearBtn) clearBtn.addEventListener('click', () => {
        if(confirm('¿Vaciar carrito?')) {
            saveCarritoToStorage([]);
            renderSideCart();
            actualizarContadorCarrito();
        }
    });
}

function openSideCart() {
    const sideCart = document.getElementById('side-cart');
    const overlay = document.getElementById('side-cart-overlay');
    if(sideCart && overlay) {
        sideCart.classList.add('open');
        overlay.classList.add('open');
        renderSideCart(); // Renderizar al abrir para asegurar datos frescos
    }
}

function closeSideCart() {
    const sideCart = document.getElementById('side-cart');
    const overlay = document.getElementById('side-cart-overlay');
    if(sideCart && overlay) {
        sideCart.classList.remove('open');
        overlay.classList.remove('open');
    }
}

function renderSideCart() {
    const itemsContainer = document.getElementById('side-cart-items');
    const totalLabel = document.getElementById('side-cart-total-price');
    const carrito = getCarritoFromStorage();
    
    if(!itemsContainer || !totalLabel) return;

    itemsContainer.innerHTML = '';
    let total = 0;

    if (carrito.length === 0) {
        itemsContainer.innerHTML = '<p style="text-align:center; color:#777; margin-top:20px;">Tu carrito está vacío.</p>';
        totalLabel.textContent = '$0.00';
        return;
    }

    carrito.forEach(item => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;

        // Verificamos si hay nota para mostrarla
        const notaHTML = item.nota ? `<span class="cart-item-user-note">📝: ${item.nota}</span>` : '';
        const btnNotaTexto = item.nota ? 'Editar Nota' : 'Nota';
        const btnNotaIcon = item.nota ? 'fa-edit' : 'fa-pen';

        itemsContainer.innerHTML += `
            <div class="side-cart-item">
                <img src="${item.imagen}" alt="${item.nombre}" onerror="this.src='https://via.placeholder.com/60?text=Img'">
                
                <div class="side-cart-item-info">
                    <h4>${item.nombre}</h4>
                    <p>${item.cantidad} x $${item.precio.toFixed(2)}</p>
                    ${notaHTML}
                </div>

                <div class="side-cart-actions">
                    <button class="side-cart-note-btn" onclick="addNoteToItem('${item.id}')" title="Agregar especificación">
                        <i class="fas ${btnNotaIcon}"></i> ${btnNotaTexto}
                    </button>
                    <button class="side-cart-remove" onclick="removeItemFromSideCart('${item.id}')">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </div>
            </div>
        `;
    });

    totalLabel.textContent = `$${total.toFixed(2)}`;
}
// --- Función para agregar/editar nota en el carrito ---
window.addNoteToItem = function(id) {
    let carrito = getCarritoFromStorage();
    const itemIndex = carrito.findIndex(i => i.id === id);
    
    if (itemIndex > -1) {
        // Pedimos la nota al usuario (muestra la actual si existe)
        const notaActual = carrito[itemIndex].nota || "";
        const nuevaNota = prompt("Escribe detalles (color, talle, etc):", notaActual);
        
        // Si el usuario no canceló (null), guardamos
        if (nuevaNota !== null) {
            carrito[itemIndex].nota = nuevaNota.trim();
            saveCarritoToStorage(carrito);
            renderSideCart(); // Refrescamos el carrito lateral
            
            // Si estás en la página carrito.html, refrescamos también
            if (document.getElementById('carrito-container')) {
                renderizarCarrito();
            }
        }
    }
};
// Función global para eliminar desde el Side Cart (necesaria para el onclick inline)
window.removeItemFromSideCart = function(id) {
    let carrito = getCarritoFromStorage();
    carrito = carrito.filter(item => item.id !== id);
    saveCarritoToStorage(carrito);
    renderSideCart();
    actualizarContadorCarrito();
    
    // Si estamos en carrito.html, también refrescamos esa vista
    const contenedorCarritoHTML = document.getElementById('carrito-container');
    if (contenedorCarritoHTML) {
        renderizarCarrito();
    }
};

// ==========================================================
// === LÓGICA DEL ADMIN EXCLUSIVO NÚCLEO (admin-nucleo.html) ===
// ==========================================================
async function loadNucleoStock() {
    const tbody = document.getElementById('nucleo-stock-body');
    const loading = document.getElementById('loading-stock');
    
    if(!tbody) return;
    
    tbody.innerHTML = '';
    if(loading) loading.style.display = 'block';

    try {
        const snap = await db.collection('products')
            .where('brand', '==', 'nucleo') 
            .get();
            
        if(loading) loading.style.display = 'none';

        if(snap.empty) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">No hay productos Núcleo cargados.</td></tr>';
            return;
        }

        snap.forEach(doc => {
            const p = doc.data();
            // Detectar si tiene stock o no (false = tiene stock, true = sin stock)
            const isNoStock = p.noStock === true;

            // Configuración visual
            const stockBtnClass = isNoStock ? 'btn-stock-off' : 'btn-stock-on';
            const stockIcon = isNoStock ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-check"></i>';
            const stockTitle = isNoStock ? 'Producto Sin Stock (Click para Activar)' : 'Producto En Stock (Click para Pausar)';
            
            // Overlay visual para la imagen
            const imgOverlay = isNoStock 
                ? '<div style="position:absolute; inset:0; background:rgba(200,0,0,0.5); color:white; font-size:10px; display:flex; justify-content:center; align-items:center; font-weight:bold;">SIN STOCK</div>' 
                : '';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div style="position:relative; width:50px; height:50px;">
                        <img src="${p.imageUrl}" style="width:100%; height:100%; object-fit:cover;">
                        ${imgOverlay}
                    </div>
                </td>
                <td>${p.name}</td>
                <td>${p.categoryName}</td>
                <td>$${p.price}</td>
                <td>
                    <div style="display:flex; gap:5px;">
                        <button class="action-btn btn-edit" onclick="editNucleoProduct('${doc.id}')" title="Editar"><i class="fas fa-pen"></i></button>
                        
                        <button class="action-btn ${stockBtnClass}" onclick="toggleNucleoStock('${doc.id}', ${isNoStock})" title="${stockTitle}">
                            ${stockIcon}
                        </button>

                        <button class="action-btn btn-delete" onclick="deleteNucleoProduct('${doc.id}')" title="Eliminar"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Error cargando stock:", error);
        if(loading) loading.textContent = "Error al cargar.";
    }
}
// ==========================================
// EN app.js - Agrega esta nueva función
// ==========================================

window.toggleNucleoStock = async (id, currentStatus) => {
    // currentStatus: true si NO hay stock, false si SI hay stock.
    // Invertimos el valor.
    const newStatus = !currentStatus; 

    try {
        // Actualizamos Firebase
        await db.collection('products').doc(id).update({
            noStock: newStatus
        });
        
        // Recargamos la tabla para ver el cambio
        loadNucleoStock(); 
    } catch (error) {
        console.error("Error cambiando estado de stock:", error);
        alert("Error al actualizar el stock.");
    }
};
// NUEVA FUNCIÓN: Pégala justo debajo de la función anterior
window.toggleNucleoStock = async (id, currentStatus) => {
    try {
        // Invertimos el estado: si estaba sin stock (true), pasa a con stock (false)
        await db.collection('products').doc(id).update({
            noStock: !currentStatus
        });
        loadNucleoStock(); // Recargar tabla
    } catch (error) {
        alert("Error al actualizar stock: " + error.message);
    }
};
// --- Funciones Auxiliares Admin Núcleo ---

async function loadNucleoAdminCategories() {
    const select = document.getElementById('nucleo-prod-category');
    const tbody = document.getElementById('nucleo-cat-table-body');
    
    if(!select || !tbody) return;

    // Indicador visual de carga
    select.innerHTML = '<option value="">Cargando...</option>';
    // Limpiamos la tabla visualmente mientras carga
    tbody.innerHTML = '<tr><td colspan="2" style="text-align:center">Cargando datos...</td></tr>';

    try {
        // Intentamos pedir los datos
        const snap = await db.collection('categories')
            .where('brand', '==', 'nucleo')
            .orderBy('name')
            .get();

        // Si llegamos aquí, la conexión funcionó
        select.innerHTML = '<option value="">-- Selecciona Categoría --</option>';
        tbody.innerHTML = ''; // Limpiamos mensaje de carga

        if (snap.empty) {
         tbody.innerHTML = '<tr><td colspan="2" style="text-align:center">No hay categorías creadas.</td></tr>';
         select.innerHTML = '<option value="">-- No hay categorías --</option>'; 
         return;
        }

        snap.forEach(doc => {
            const data = doc.data();
            
            // 1. Llenar Select del Formulario
            const opt = document.createElement('option');
            opt.value = doc.id;
            opt.textContent = data.name;
            opt.dataset.name = data.name;
            opt.dataset.img = data.imageUrl || '';
            select.appendChild(opt);

            // 2. Llenar Tabla
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${data.name}</td>
                <td>
                    <div style="display:flex; gap:5px;">
                        <button class="action-btn btn-edit" onclick="editNucleoCategory('${doc.id}')" title="Editar"><i class="fas fa-pen"></i></button>
                        <button class="action-btn btn-delete" onclick="deleteNucleoCategory('${doc.id}')" title="Eliminar"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Error cargando categorías:", error);
        // Esto debería cambiar el texto de "Cargando..." a "Error..."
        select.innerHTML = '<option value="">Error (Ver Consola F12)</option>';
        tbody.innerHTML = `<tr><td colspan="2" style="color:red; text-align:center">Error de conexión o falta Índice.<br>Revisa la consola con F12.</td></tr>`;
    }
}

window.deleteNucleoCategory = async (id) => {
    if(confirm("¿Borrar categoría? Esto no borra los productos asociados.")) {
        await db.collection('categories').doc(id).delete();
        loadNucleoAdminCategories();
    }
};
// --- Función para agregar fila visual de Promo ---
function addNucleoPromoRow(qty = '', price = '') {
    const container = document.getElementById('nucleo-promos-container');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'promo-row';
    div.innerHTML = `
        <input type="number" placeholder="Cant." class="nucleo-input promo-qty-input" style="flex:1;" value="${qty}">
        <input type="number" placeholder="$ Precio Unitario" class="nucleo-input promo-price-input" style="flex:2;" value="${price}">
        <button type="button" class="btn-remove-row" onclick="this.parentElement.remove()" title="Borrar fila">X</button>
    `;
    container.appendChild(div);
}
async function handleNucleoProductSubmit(e) {
    e.preventDefault();
    
    const idInput = document.getElementById('nucleo-edit-id');
    const name = document.getElementById('nucleo-prod-name').value.trim();
    const price = parseFloat(document.getElementById('nucleo-prod-price').value);
    const wholesaleInput = document.getElementById('nucleo-prod-wholesale').value;
    const wholesalePrice = wholesaleInput ? parseFloat(wholesaleInput) : null;
    
    // Fecha
    const dateInput = document.getElementById('nucleo-prod-date');
    let createdAtTimestamp = Date.now(); 
    if (dateInput.value) {
        createdAtTimestamp = new Date(dateInput.value).getTime();
    }

    // === NUEVO: LEER PROMOS DEL HTML ===
    const promoRows = document.querySelectorAll('.promo-row');
    const promos = [];
    promoRows.forEach(row => {
        const q = parseInt(row.querySelector('.promo-qty-input').value);
        const p = parseFloat(row.querySelector('.promo-price-input').value);
        if (q > 0 && p > 0) {
            promos.push({ quantity: q, unitPrice: p });
        }
    });
    // Ordenar de menor cantidad a mayor cantidad
    promos.sort((a, b) => a.quantity - b.quantity);
    // ===================================

    const catSelect = document.getElementById('nucleo-prod-category');
    const imgText = document.getElementById('nucleo-prod-imgs').value.trim();
    const desc = document.getElementById('nucleo-prod-desc').value.trim();
    const feedback = document.getElementById('feedback-prod');

    const catId = catSelect.value;
    const catName = catSelect.options[catSelect.selectedIndex].text;
    const catImg = catSelect.options[catSelect.selectedIndex].dataset.img;

    if(!name || !price || !catId || !imgText) {
        alert("Completa los campos obligatorios.");
        return;
    }

    const urls = imgText.split('\n').map(u => u.trim()).filter(u => u);
    
    const productData = {
        name: name,
        price: price,
        wholesalePrice: wholesalePrice,
        brand: 'nucleo',
        categoryId: catId,
        categoryName: catName,
        categoryImageUrl: catImg || '',
        imageUrls: urls,
        imageUrl: urls[0],
        description: desc,
        detailSections: desc ? [{title: 'Detalles', content: desc}] : [],
        
        quantityPromos: promos, // <--- GUARDAMOS EL ARRAY AQUÍ
        
        createdAtNumerico: createdAtTimestamp,
        createdAt: new Date(createdAtTimestamp)
    };

    try {
        if(idInput.value) {
            await db.collection('products').doc(idInput.value).update(productData);
            feedback.textContent = "¡Producto Actualizado!";
        } else {
            await db.collection('products').add(productData);
            feedback.textContent = "¡Producto Agregado!";
        }

        feedback.className = 'feedback-msg feedback-success';
        feedback.style.display = 'block';
        resetNucleoForm();
        loadNucleoStock();
        setTimeout(() => feedback.style.display = 'none', 3000);

    } catch (error) {
        console.error(error);
        feedback.textContent = "Error al guardar.";
        feedback.className = 'feedback-msg feedback-error';
        feedback.style.display = 'block';
    }
}

window.editNucleoProduct = async (id) => {
    const doc = await db.collection('products').doc(id).get();
    if(!doc.exists) return;
    const p = doc.data();

    // Rellenar campos simples
    document.getElementById('nucleo-edit-id').value = id;
    document.getElementById('nucleo-prod-name').value = p.name;
    document.getElementById('nucleo-prod-price').value = p.price;
    document.getElementById('nucleo-prod-wholesale').value = p.wholesalePrice || ''; 
    document.getElementById('nucleo-prod-category').value = p.categoryId;
    document.getElementById('nucleo-prod-imgs').value = (p.imageUrls || [p.imageUrl]).join('\n');
    document.getElementById('nucleo-prod-desc').value = p.description || (p.detailSections?.[0]?.content) || '';
    
    // === NUEVO: DIBUJAR LAS PROMOS SI EXISTEN ===
    const container = document.getElementById('nucleo-promos-container');
    if(container) {
        container.innerHTML = ''; // Limpiar lo que hubiera antes
        if (p.quantityPromos && Array.isArray(p.quantityPromos)) {
            p.quantityPromos.forEach(promo => {
                addNucleoPromoRow(promo.quantity, promo.unitPrice);
            });
        }
    }
    // ============================================

    // Fecha
    const dateInput = document.getElementById('nucleo-prod-date');
    if (p.createdAtNumerico) {
        const date = new Date(p.createdAtNumerico);
        const offset = date.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(date - offset)).toISOString().slice(0, 16);
        dateInput.value = localISOTime;
    } else {
        dateInput.value = '';
    }

    document.getElementById('btn-save-prod').textContent = "Actualizar Producto";
    document.getElementById('btn-cancel-prod').style.display = 'inline-block';
    
    window.scrollTo({top: 0, behavior: 'smooth'});
};

window.deleteNucleoProduct = async (id) => {
    if(confirm("¿Eliminar este producto de Núcleo permanentemente?")) {
        await db.collection('products').doc(id).delete();
        loadNucleoStock();
    }
};

function resetNucleoForm() {
    document.getElementById('nucleo-product-form').reset();
    document.getElementById('nucleo-edit-id').value = '';
    
    // Limpiar promos
    const container = document.getElementById('nucleo-promos-container');
    if(container) container.innerHTML = '';

    document.getElementById('btn-save-prod').textContent = "Guardar Producto";
    document.getElementById('btn-cancel-prod').style.display = 'none';
}

// ==========================================================
// === LÓGICA ESPECÍFICA PARA ELECTRÓNICA NÚCLEO (SIDEBAR) ===
// ==========================================================

function setupNucleoLogic() {
    const sidebar = document.getElementById('nucleo-sidebar-container');
    const overlay = document.getElementById('nucleo-sidebar-overlay');
    const openBtn = document.getElementById('btn-open-sidebar'); // El botón "Ver Catálogo"
    const closeBtn = document.getElementById('close-nucleo-sidebar');
    const productContainer = document.getElementById('catalogo-container');
    const categoryListContainer = document.getElementById('nucleo-category-list');
    const btnVerTodo = document.getElementById('btn-ver-todo-nucleo');

    // 1. FUNCIONES DE APERTURA/CIERRE
    function openSidebar() {
        sidebar.classList.add('active');
        overlay.classList.add('active');
    }

    function closeSidebar() {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    }

    // Listeners para abrir/cerrar
    if (openBtn) openBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openSidebar();
    });
    
    if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
    if (overlay) overlay.addEventListener('click', closeSidebar);

    // 2. CARGAR CATEGORÍAS EN EL SIDEBAR
    async function loadNucleoCategories() {
        console.log("Cargando categorías Núcleo...");
        const selectElement = document.getElementById('nucleo-category-select');
        const sidebarList = document.getElementById('nucleo-category-list'); // Corregido ID según tu HTML

        // Limpiar opciones anteriores
        if (selectElement) selectElement.innerHTML = '<option value="">Seleccione Categoría</option>';
        if (sidebarList) sidebarList.innerHTML = '';

        try {
            // Ordenamos alfabéticamente para que se vea mejor
            const snapshot = await db.collection('categories')
                .where('brand', '==', 'nucleo')
                .orderBy('name') 
                .get();

            if (snapshot.empty) {
                if (sidebarList) sidebarList.innerHTML = '<li style="padding:10px;">No hay categorías.</li>';
                return;
            }

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const categoryId = doc.id;

                // A. Llenar el <select> del formulario de Admin (si existe en la página)
                if (selectElement) {
                    const option = document.createElement('option');
                    option.value = categoryId;
                    option.textContent = data.name;
                    // Guardamos datos extra para usar al guardar producto
                    option.dataset.img = data.imageUrl || ''; 
                    selectElement.appendChild(option);
                }

                // B. Llenar el menú lateral de navegación con ENLACE DIRECTO
                if (sidebarList) {
                    const li = document.createElement('li');
                    // Al hacer clic, recarga la página con el parámetro catId
                    li.innerHTML = `
                        <a href="categoria-nucleo.html?id=${categoryId}" class="nucleo-cat-link">
                            <img src="${data.imageUrl || 'https://via.placeholder.com/30'}" alt="icon" style="width:30px; height:30px; border-radius:50%; margin-right:10px;">
                            ${data.name}
                        </a>`;
                    sidebarList.appendChild(li);
                }
            });
            console.log(`Categorías Núcleo cargadas: ${snapshot.docs.length}`);
        } catch (error) {
            console.error("Error al cargar categorías Núcleo:", error);
            if (sidebarList) sidebarList.innerHTML = '<li style="color:red; padding:10px;">Error al cargar.</li>';
        }
    }
function getUrlParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// --- 6. Lógica de Carga y Filtrado de Productos por Categoría (Núcleo) ---
async function loadNucleoProductsFiltered() {
    const productsContainer = document.getElementById('catalogo-container');
    if (!productsContainer) return;

    // Elementos del DOM
    const landingHero = document.getElementById('nucleo-landing-hero');
    const categoryBannerContainer = document.getElementById('category-banner-container');
    const categoryBannerImg = document.getElementById('category-banner-img');
    const categoryBannerTitle = document.getElementById('category-banner-title');
    const sectionTitleH3 = document.querySelector('.section-title-bar h3');
    const sectionTitleP = document.querySelector('.section-title-bar p');

    // Obtener ID de la URL (?catId=xyz)
    const urlParams = new URLSearchParams(window.location.search);
    const categoryId = urlParams.get('catId');

    // Loader
    productsContainer.innerHTML = '<div class="loading-spinner"><i class="fas fa-circle-notch fa-spin"></i> Cargando tecnología...</div>';

    // Query Base
    let productsRef = db.collection('products').where('brand', '==', 'nucleo');

    // === ESCENARIO A: ESTAMOS VIENDO UNA CATEGORÍA ===
    if (categoryId) {
        console.log("Cargando categoría ID:", categoryId);

        try {
            // 1. Obtener datos de la categoría para pintar el Banner
            const catDoc = await db.collection('categories').doc(categoryId).get();
            
            if (catDoc.exists) {
                const catData = catDoc.data();
                
                // Ocultar Banner de Inicio
                if (landingHero) landingHero.style.display = 'none'; 
                
                // Mostrar Banner de Categoría
                if (categoryBannerContainer) {
                    categoryBannerContainer.style.display = 'block'; 
                    
                    // AQUI ESTA LA MAGIA: Usamos la imagen de banner del Admin
                    // Si no tiene banner grande, usa el icono pequeño, si no, una por defecto.
                    const bannerSrc = catData.bannerImageUrl || catData.imageUrl || 'https://via.placeholder.com/1200x300?text=Tecnologia';
                    
                    if (categoryBannerImg) categoryBannerImg.src = bannerSrc;
                    if (categoryBannerTitle) categoryBannerTitle.textContent = catData.name;
                }

                // Ajustar títulos inferiores
                if (sectionTitleH3) sectionTitleH3.style.display = 'none'; // Ocultamos el título repetido
                if (sectionTitleP) sectionTitleP.textContent = `Explorando: ${catData.name}`;

            } else {
                console.warn("Categoría no encontrada.");
            }

            // 2. Filtrar la consulta de productos
            productsRef = productsRef.where('categoryId', '==', categoryId);

        } catch (error) {
            console.error("Error obteniendo categoría:", error);
        }

    } 
    // === ESCENARIO B: ESTAMOS EN EL INICIO (SIN FILTRO) ===
    else {
        // Mostrar Banner de Inicio normal y ocultar el de categoría
        if (landingHero) landingHero.style.display = 'flex';
        if (categoryBannerContainer) categoryBannerContainer.style.display = 'none';
        
        if (sectionTitleH3) {
            sectionTitleH3.style.display = 'block';
            sectionTitleH3.textContent = "¡Lleva tu negocio a otro nivel!";
        }
    }

    // 3. EJECUTAR LA CONSULTA Y DIBUJAR PRODUCTOS
    try {
        const snapshot = await productsRef.get(); 
        productsContainer.innerHTML = ''; 

        if (snapshot.empty) {
            productsContainer.innerHTML = `
                <div style="text-align:center; width:100%; padding:50px; grid-column: 1 / -1;">
                    <h3 style="color:#666;">No hay productos en esta sección todavía.</h3>
                    <a href="productos-nucleo.html" class="nucleo-btn" style="margin-top:15px;">Ver Todo</a>
                </div>`;
            return;
        }

        snapshot.docs.forEach(doc => {
            const card = window.createProductCard(doc.data(), doc.id);
            productsContainer.appendChild(card);
        });

        if(window.setupCarousels) window.setupCarousels(productsContainer);

    } catch (error) {
        console.error("Error cargando productos:", error);
        productsContainer.innerHTML = '<p>Error de conexión.</p>';
    }
}
// Listener para "Ver Todo el Stock" dentro del sidebar
    if (btnVerTodo) {
        btnVerTodo.addEventListener('click', () => {
            // Redirigir a la misma página sin parámetros para ver todo
            window.location.href = 'productos-nucleo.html';
        });
    }

    // 3. CARGAR PRODUCTOS (FILTRADOS O TODOS)
    async function loadNucleoProducts(categoryId = null, categoryName = 'Todo el Stock') {
        if (!productContainer) return;

        productContainer.innerHTML = '<div class="loading-spinner"><i class="fas fa-circle-notch fa-spin"></i> Cargando productos...</div>';
        
        // Actualizar título si existe un elemento para ello (opcional)
        const sectionTitle = document.querySelector('.section-title-bar h3');
        if(sectionTitle) sectionTitle.textContent = categoryName;

        try {
            let query = db.collection('products').where('brand', '==', 'nucleo');

            if (categoryId) {
                query = query.where('categoryId', '==', categoryId);
            }
            
            // Ordenar por nombre
            query = query.orderBy('name');

            const snap = await query.get();
            productContainer.innerHTML = '';

            if (snap.empty) {
                productContainer.innerHTML = '<p style="text-align:center; width:100%; padding:40px;">No se encontraron productos en esta sección.</p>';
                return;
            }

            snap.forEach(doc => {
                const prod = doc.data();
                // Usamos tu función global existente para crear la tarjeta
                const card = window.createProductCard(prod, doc.id);
                productContainer.appendChild(card);
            });
            
            // Inicializar carruseles de imágenes para las nuevas tarjetas
            if(window.setupCarousels) window.setupCarousels(productContainer);

        } catch (error) {
            console.error("Error cargando productos Núcleo:", error);
            productContainer.innerHTML = `<p style="color:red; text-align:center;">Error al cargar productos. Revisa la consola.<br>${error.message}</p>`;
        }
    }

    // Listener para "Ver Todo el Stock" dentro del sidebar
    if (btnVerTodo) {
        btnVerTodo.addEventListener('click', () => {
            loadNucleoProducts(null, 'Todo el Stock');
            closeSidebar();
        });
    }

    // --- INICIALIZACIÓN ---
    // Cargar categorías en el sidebar
    loadNucleoCategories();
    // Cargar todos los productos al entrar a la página
    loadNucleoProducts();
}
// ==========================================================
// === LÓGICA ZONA MAYORISTA (FINAL - CON ORDEN POR FECHA) ===
// ==========================================================

async function setupMayoristaLogic() {
    const container = document.getElementById('mayorista-container');
    const filterButtons = document.querySelectorAll('.btn-filtro');
    const sortSelect = document.getElementById('sort-mayorista');
    
    // --- Referencia a botones de vista ---
    const viewButtons = document.querySelectorAll('.btn-view');

    if (!container) return;

    // Recuperar vista guardada o usar 'grid' por defecto
    let currentViewMode = localStorage.getItem('mayoristaViewMode') || 'grid';
    
    // Función para aplicar la vista (Grilla, Lista, etc.)
    const applyViewMode = (mode) => {
        container.classList.remove('view-list', 'view-grid', 'view-feed');
        container.classList.add(`view-${mode}`);
        
        // Actualizar botones visualmente
        viewButtons.forEach(btn => {
            if(btn.dataset.view === mode) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        localStorage.setItem('mayoristaViewMode', mode);
        currentViewMode = mode;
    };

    // Aplicar vista inicial
    applyViewMode(currentViewMode);

    // Listeners para los botones de vista
    viewButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            applyViewMode(btn.dataset.view);
        });
    });

    // Variables de estado
    let currentBrandFilter = 'all';
    let currentSortOrder = 'default';
    let allProductsCache = [];

    // Mostrar mensaje de carga inicial
    container.innerHTML = '<div class="loading-message" style="width:100%; text-align:center; padding:50px; color:#777;"><i class="fas fa-spinner fa-spin"></i> Cargando catálogo mayorista...</div>';

    try {
        // 1. Cargar todos los productos de Firestore
        const snapshot = await db.collection('products').get();
        
        allProductsCache = []; // Limpiar cache antes de llenar

        snapshot.forEach(doc => {
            if (doc.id.startsWith('--config-')) return;
            
            const data = doc.data();
            
            // --- Cálculo de Precio Mayorista ---
            const precioLista = parseFloat(data.price || 0);
            let precioMayorista = parseFloat(data.wholesalePrice);
            
            // Si no hay precio mayorista definido, aplicar 30% de descuento automático
            if (!precioMayorista || isNaN(precioMayorista)) {
                precioMayorista = precioLista * 0.70; 
            }

            // Guardamos en caché
            allProductsCache.push({ 
                id: doc.id, 
                ...data, 
                precioLista: precioLista,
                precioCalculadoMayorista: precioMayorista,
                createdAtNumerico: data.createdAtNumerico || 0, // Para ordenar por fecha
                salesCount: data.salesCount || 0 // Para ordenar por populares
            });
        });

        // 2. Función de Renderizado (Filtra -> Ordena -> Dibuja)
        const applyFiltersAndRender = () => {
            container.innerHTML = '';
            
            // A) FILTRADO POR MARCA
            let filtered = (currentBrandFilter === 'all') 
                ? [...allProductsCache] 
                : allProductsCache.filter(p => p.brand === currentBrandFilter);

            // B) ORDENAMIENTO
            switch (currentSortOrder) {
                case 'price-asc': // Precio: Menor a Mayor
                    filtered.sort((a, b) => a.precioCalculadoMayorista - b.precioCalculadoMayorista);
                    break;
                case 'price-desc': // Precio: Mayor a Menor
                    filtered.sort((a, b) => b.precioCalculadoMayorista - a.precioCalculadoMayorista);
                    break;
                case 'az': // Nombre: A - Z
                    filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                    break;
                case 'za': // Nombre: Z - A
                    filtered.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
                    break;
                case 'newest': // MÁS NUEVOS
                    filtered.sort((a, b) => b.createdAtNumerico - a.createdAtNumerico);
                    break;
                case 'oldest': // MÁS VIEJOS
                    filtered.sort((a, b) => a.createdAtNumerico - b.createdAtNumerico);
                    break;
                case 'best-seller': // MÁS VENDIDOS
                    filtered.sort((a, b) => b.salesCount - a.salesCount);
                    break;
                default:
                    // Orden por defecto (destacado/orden de carga)
                    break;
            }

            // C) RENDERIZADO EN EL DOM
            if (filtered.length === 0) {
                container.innerHTML = '<p class="mensaje-vacio" style="width:100%; text-align:center; padding: 40px;">No hay productos disponibles con estos criterios.</p>';
                return;
            }

            filtered.forEach(prod => {
                const imageUrl = (prod.imageUrls && prod.imageUrls.length > 0) ? prod.imageUrls[0] : (prod.imageUrl || 'https://via.placeholder.com/150');

                // --- LÓGICA STOCK ---
                const isNoStock = prod.noStock === true;
                
                // Configuración Botón y Badge
                const stockBadgeHTML = isNoStock ? '<div class="mayorista-stock-badge">SIN STOCK</div>' : '';
                const btnText = isNoStock ? 'Reservar' : 'Agregar';
                const btnClass = isNoStock ? 'btn-mayorista-reserva' : 'btn-mayorista';
                const nombreParaCarrito = isNoStock ? `(RESERVA) ${prod.name}` : `${prod.name} (Mayorista)`;
                const precioParaCarrito = isNoStock ? 0 : prod.precioCalculadoMayorista; // Reserva vale $0

                // Badge de descuento
                let badgeHTML = '';
                if (prod.precioLista > 0 && prod.precioCalculadoMayorista < prod.precioLista) {
                    const porcentajeOff = Math.round(((prod.precioLista - prod.precioCalculadoMayorista) / prod.precioLista) * 100);
                    if (porcentajeOff > 0) {
                        badgeHTML = `<div class="discount-badge">-${porcentajeOff}% OFF</div>`;
                    }
                }
                // 1. GENERAR HTML DE PROMOS
let promosHTML = '';

// Verificamos si tiene promos guardadas
if (prod.quantityPromos && Array.isArray(prod.quantityPromos) && prod.quantityPromos.length > 0) {
    promosHTML = '<div class="promo-mini-list">';
    
    prod.quantityPromos.forEach(p => {
        // === CÁLCULO DEL PORCENTAJE PARA LA LISTA ===
        let percentOff = 0;
        // Usamos prod.precioLista que viene de la base de datos
        if (prod.precioLista && prod.precioLista > 0) {
            percentOff = Math.round(((prod.precioLista - p.unitPrice) / prod.precioLista) * 100);
        }

        // Creamos el HTML incluyendo el badge si hay descuento
        promosHTML += `
            <div class="promo-mini-item">
                <span>Llevando <strong>${p.quantity}+</strong></span>
                <div style="display:flex; align-items:center; gap:6px;">
                    ${percentOff > 0 ? `<span class="promo-percent-tag">-${percentOff}%</span>` : ''}
                    <strong>$${p.unitPrice.toFixed(2)}</strong>
                </div>
            </div>`;
    });
    promosHTML += '</div>';
} else {
    // Espacio vacío para mantener alineación
    promosHTML = '<div style="height:5px;"></div>';
}
                // Crear tarjeta HTML
                const card = document.createElement('div');
                card.className = 'tarjeta-producto';
                
                // Navegación al detalle
                card.onclick = (e) => {
                    if (e.target.classList.contains('boton-agregar') || e.target.tagName === 'INPUT' || e.target.tagName === 'LABEL') return;
                    window.location.href = `mayorista-detalle.html?id=${prod.id}`;
                };
                
                card.innerHTML = `
    <div class="product-carousel">
        <img src="${imageUrl}" class="carousel-image active" style="object-fit:contain; opacity: ${isNoStock ? '0.5' : '1'};">
        ${badgeHTML}
        ${stockBadgeHTML}
    </div>
    <div class="producto-info">
        <div class="producto-categoria-header">
            <span class="mayorista-badge">${prod.brand || 'General'}</span>
        </div>
        <h3 class="producto-nombre">${prod.name}</h3>
        
        <div style="margin-bottom: 5px;">
            <span class="precio-regular-tachado">$${prod.precioLista.toFixed(2)}</span>
            <span class="precio-mayorista-final">$${prod.precioCalculadoMayorista.toFixed(2)}</span>
        </div>

        ${promosHTML}

        <div class="producto-acciones">
            <label>Cant:</label>
            <input type="number" class="producto-cantidad" value="1" min="1">
            <button class="boton-agregar ${btnClass}" 
                data-id="${prod.id}" 
                data-price="${precioParaCarrito}" 
                data-name="${nombreParaCarrito}">
                ${btnText}
            </button>
        </div>
    </div>
`;
                
                // Listener Botón Agregar
                const btn = card.querySelector('.boton-agregar');
                const input = card.querySelector('input');
                
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const item = {
                        id: prod.id,
                        nombre: btn.dataset.name,
                        precio: parseFloat(btn.dataset.price),
                        cantidad: parseInt(input.value) || 1,
                        imagen: imageUrl,
                        tipo: 'mayorista'
                    };
                    addItemToCart(item, btn, input);
                    if(isNoStock) alert("Producto agregado como RESERVA ($0).");
                });

                container.appendChild(card);
            });
        };

        // 3. ACTIVAR LOS LISTENERS DE FILTROS (ESTO FALTABA)
        if (filterButtons) {
            filterButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    // Quitar clase active de todos
                    filterButtons.forEach(b => b.classList.remove('active'));
                    // Poner active al actual
                    btn.classList.add('active');
                    // Actualizar filtro y renderizar
                    currentBrandFilter = btn.dataset.filter;
                    applyFiltersAndRender();
                });
            });
        }

        // 4. ACTIVAR EL LISTENER DE ORDENAMIENTO (ESTO FALTABA)
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                currentSortOrder = e.target.value;
                applyFiltersAndRender();
            });
        }

        // 5. EJECUTAR EL PRIMER RENDER (ESTO FALTABA)
        applyFiltersAndRender();

    } catch (error) {
        console.error("Error cargando mayorista:", error);
        container.innerHTML = '<p class="error-message">Error al cargar catálogo. Intenta recargar la página.</p>';
    }
}
// ==========================================================
// === LÓGICA DETALLE MAYORISTA (ACTUALIZADA CON AHORRO $) ===
// ==========================================================
async function loadMayoristaProductDetails(productId) {
    const loading = document.getElementById('may-loading');
    const content = document.getElementById('may-content');
    const badgeContainer = document.getElementById('may-discount-badge');
    const thumbnailsContainer = document.getElementById('may-thumbnails');
    const mainImage = document.getElementById('may-img-grande');
    const ahorroTextContainer = document.getElementById('may-ahorro');
    const imgContainer = document.querySelector('.may-image-container'); // Para el badge de stock

    try {
        const doc = await db.collection('products').doc(productId).get();
        if (!doc.exists) {
            loading.innerHTML = '<p style="color:red;">Producto no encontrado.</p>';
            return;
        }
        const prod = doc.data();

        // --- LÓGICA STOCK ---
        const isNoStock = prod.noStock === true;

        // 1. Precios
        const precioLista = parseFloat(prod.price || 0);
        let precioMayorista = parseFloat(prod.wholesalePrice);
        
        if (!precioMayorista || isNaN(precioMayorista)) {
            precioMayorista = precioLista * 0.70; 
        }

        const diferenciaAhorro = precioLista - precioMayorista;

        // Porcentaje OFF
        let porcentajeOff = 0;
        badgeContainer.innerHTML = '';
        if (precioLista > 0 && precioMayorista < precioLista) {
            porcentajeOff = Math.round(((precioLista - precioMayorista) / precioLista) * 100);
            if (porcentajeOff > 0) {
                badgeContainer.innerHTML = `<div class="discount-badge-detail">-${porcentajeOff}% OFF</div>`;
            }
            if (ahorroTextContainer) {
                ahorroTextContainer.textContent = `Ahorrás: $${diferenciaAhorro.toFixed(2)}`;
                ahorroTextContainer.style.display = 'block';
            }
        } else {
            if (ahorroTextContainer) ahorroTextContainer.style.display = 'none';
        }

        // --- VISUALIZACIÓN STOCK (Badge en Foto Grande) ---
        // Limpiar badge anterior si existe
        const oldStockBadge = imgContainer.querySelector('.mayorista-detail-stock-overlay');
        if(oldStockBadge) oldStockBadge.remove();

        if (isNoStock) {
            const stockBadge = document.createElement('div');
            stockBadge.className = 'mayorista-detail-stock-overlay';
            stockBadge.innerHTML = '<i class="fas fa-exclamation-triangle"></i> SIN STOCK';
            imgContainer.appendChild(stockBadge);
            mainImage.style.opacity = '0.6'; // Oscurecer un poco la imagen
        } else {
            mainImage.style.opacity = '1';
        }

        // Textos
        document.getElementById('may-categoria').textContent = (prod.brand || 'General') + (prod.categoryName ? ' / ' + prod.categoryName : '');
        document.getElementById('may-titulo').textContent = prod.name;
        document.getElementById('may-precio-lista').textContent = "Precio Lista: $" + precioLista.toFixed(2);
        document.getElementById('may-precio-final').innerHTML = "$" + precioMayorista.toFixed(2) + ' <span style="font-size:1rem; font-weight:normal; color:#555;">(Mayorista Base)</span>';

        // === NUEVO: INYECTAR TABLA DE PROMOS CON PORCENTAJE ===
const preciosBox = document.querySelector('.may-precios-box');
const oldTable = document.querySelector('.promo-table-container');
if (oldTable) oldTable.remove();

if (prod.quantityPromos && prod.quantityPromos.length > 0) {
    const tableDiv = document.createElement('div');
    tableDiv.className = 'promo-table-container';
    
    let rows = '';
    prod.quantityPromos.forEach(p => {
        
        // CÁLCULO DEL PORCENTAJE
        let percentOff = 0;
        // Nota: en esta función la variable 'precioLista' ya fue definida al principio
        if (precioLista > 0) {
            percentOff = Math.round(((precioLista - p.unitPrice) / precioLista) * 100);
        }

        rows += `
            <tr>
                <td>Llevando <strong>${p.quantity}</strong> o más</td>
                <td style="text-align:center;">
                    ${percentOff > 0 ? `<span class="badge-ahorro-detalle">-${percentOff}% OFF</span>` : '-'}
                </td>
                <td class="promo-highlight">$${p.unitPrice.toFixed(2)} c/u</td>
            </tr>
        `;
    });

    // Agregamos una columna extra en el header de la tabla
    tableDiv.innerHTML = `
        <div class="promo-table-title"><i class="fas fa-tags"></i> Descuentos por Cantidad</div>
        <table class="promo-table">
            <thead>
                <tr style="background:#f9f9f9; font-size:0.8rem; color:#777;">
                    <th style="padding:5px 15px;">Cantidad</th>
                    <th style="padding:5px 15px; text-align:center;">Ahorro Real</th>
                    <th style="padding:5px 15px;">Precio Final</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
    preciosBox.parentNode.insertBefore(tableDiv, preciosBox.nextSibling);
}
        // 2. Imágenes
        const urls = (prod.imageUrls && prod.imageUrls.length > 0) ? prod.imageUrls : (prod.imageUrl ? [prod.imageUrl] : []);
        mainImage.src = urls.length > 0 ? urls[0] : 'https://via.placeholder.com/500?text=Sin+Imagen';

        thumbnailsContainer.innerHTML = '';
        if (urls.length > 1) {
            urls.forEach((url, index) => {
                const thumb = document.createElement('img');
                thumb.src = url;
                thumb.className = `may-thumb ${index === 0 ? 'active' : ''}`;
                
                thumb.addEventListener('click', () => {
                    mainImage.src = url;
                    document.querySelectorAll('.may-thumb').forEach(t => t.classList.remove('active'));
                    thumb.classList.add('active');
                });
                thumbnailsContainer.appendChild(thumb);
            });
        }

        // 3. Botón Agregar / Reservar
        const btnAgregar = document.getElementById('may-btn-agregar');
        const inputCant = document.getElementById('may-cantidad');
        const newBtn = btnAgregar.cloneNode(true); // Clonar para limpiar listeners viejos
        btnAgregar.parentNode.replaceChild(newBtn, btnAgregar);

        // Configurar Botón según stock
        if (isNoStock) {
            newBtn.textContent = "PEDIR RESERVA (SIN CARGO)";
            newBtn.classList.add('btn-mayorista-reserva');
            newBtn.style.backgroundColor = '#fd7e14'; // Naranja forzado por si acaso
            newBtn.style.borderColor = '#fd7e14';
            newBtn.style.color = '#fff';
        } else {
            newBtn.textContent = "AGREGAR AL PEDIDO";
            newBtn.classList.remove('btn-mayorista-reserva');
            newBtn.style.backgroundColor = ''; // Volver al CSS original
            newBtn.style.borderColor = '';
            newBtn.style.color = '';
        }

        newBtn.addEventListener('click', () => {
            const qty = parseInt(inputCant.value) || 1;
            
            // Calculamos precio dinámico
            const finalUnitPrice = getPriceForQuantity(precioMayorista, qty, prod.quantityPromos);

            const item = {
                id: doc.id,
                nombre: isNoStock ? `(RESERVA) ${prod.name} (Mayorista)` : `${prod.name} (Mayorista)`,
                precio: isNoStock ? 0 : finalUnitPrice, // Usamos el precio calculado
                cantidad: qty,
                imagen: urls.length > 0 ? urls[0] : 'https://via.placeholder.com/150',
                tipo: 'mayorista'
            };
            
            addItemToCart(item, newBtn, inputCant);

            if (!isNoStock && finalUnitPrice < precioMayorista) {
                alert(`¡Promo aplicada! Precio unitario: $${finalUnitPrice}`);
            }
            if(isNoStock) {
                alert("Producto agregado como RESERVA ($0).");
            }
        });

        // 4. Descripción (Acordeón)
        const acordeonDiv = document.getElementById('may-acordeon');
        let descHtml = '';
        const sections = prod.detailSections && prod.detailSections.length > 0 
                         ? prod.detailSections 
                         : (prod.description ? [{title: "Descripción del Producto", content: prod.description}] : []);

        if (sections.length === 0) {
             descHtml = '<p style="padding:20px; color:#777;">Sin descripción detallada disponible.</p>';
        } else {
            sections.forEach((sec, index) => {
                descHtml += `
                    <div class="may-acordeon-item ${index === 0 ? 'active' : ''}">
                        <button class="may-acordeon-header" onclick="this.parentElement.classList.toggle('active')">
                            ${sec.title} 
                            <i class="fas fa-chevron-down" style="font-size:0.8rem; margin-top:5px;"></i>
                        </button>
                        <div class="may-acordeon-content">
                            <div style="padding:0 0 20px 0; line-height:1.6; color:#444;">${sec.content.replace(/\n/g, '<br>')}</div>
                        </div>
                    </div>
                `;
            });
        }
        acordeonDiv.innerHTML = descHtml;

        loading.style.display = 'none';
        content.style.display = 'grid';

    } catch (error) {
        console.error("Error cargando detalle mayorista:", error);
        loading.innerHTML = '<p style="color:red;">Error al cargar los datos del producto.</p>';
    }
}
// ==========================================================
// === LÓGICA DE CARGA PARA DETALLE NÚCLEO (NUEVO) ===
// ==========================================================
async function loadNucleoProductDetailsPage(productId) {
    const loading = document.getElementById('nucleo-loading');
    const content = document.getElementById('nucleo-content');
    
    try {
        const doc = await db.collection('products').doc(productId).get();
        if (!doc.exists) {
            if(loading) loading.innerHTML = "Producto no encontrado.";
            return;
        }
        const p = doc.data();
        
        // DETECTAR SI HAY STOCK
        const isNoStock = p.noStock === true;

        // 1. Rellenar Textos Básicos
        document.title = `${p.name} - Electrónica Núcleo`;
        if(document.getElementById('nucleo-title')) document.getElementById('nucleo-title').textContent = p.name;
        if(document.getElementById('nucleo-category')) document.getElementById('nucleo-category').textContent = p.categoryName || 'Tecnología';
        
        // Precio visual (siempre muestra el precio real, aunque al carrito vaya con $0)
        if(document.getElementById('nucleo-price')) document.getElementById('nucleo-price').textContent = `$${p.price.toFixed(2)}`;
        
        // 2. Rellenar Descripción
        const descDiv = document.getElementById('nucleo-desc');
        if (descDiv) {
            let descHTML = '';
            if(p.detailSections && p.detailSections.length > 0) {
                p.detailSections.forEach(sec => {
                    descHTML += `<div style="margin-bottom:15px;">
                                    <strong style="color:#333; display:block; margin-bottom:5px;">${sec.title}</strong> 
                                    ${sec.content}
                                 </div>`;
                });
            } else {
                descHTML = `<p>${p.description || 'Sin descripción detallada.'}</p>`;
            }
            descDiv.innerHTML = descHTML;
        }

        // 3. Manejo de Imágenes
        const mainImg = document.getElementById('nucleo-img-main');
        const thumbBox = document.getElementById('nucleo-thumbnails');
        const urls = (p.imageUrls && p.imageUrls.length > 0) ? p.imageUrls : [p.imageUrl];

        if(mainImg) mainImg.src = urls[0]; 

        // --- LÓGICA VISUAL SIN STOCK (Badge sobre la imagen) ---
        const imgWrapper = document.querySelector('.nucleo-img-wrapper');
        // Limpiar badges anteriores si hubiera
        const oldBadge = document.querySelector('.nucleo-detail-stock-badge');
        if(oldBadge) oldBadge.remove();

        if (isNoStock && imgWrapper) {
            imgWrapper.style.position = 'relative'; // Necesario para posicionar el badge
            const badge = document.createElement('div');
            badge.className = 'nucleo-detail-stock-badge';
            badge.innerHTML = '<i class="fas fa-exclamation-triangle"></i> SIN STOCK';
            imgWrapper.appendChild(badge);
        }
        // -------------------------------------------------------

        if (thumbBox) {
            thumbBox.innerHTML = '';
            if (urls.length > 1) {
                urls.forEach((url, idx) => {
                    const img = document.createElement('img');
                    img.src = url;
                    img.className = `nucleo-thumb ${idx === 0 ? 'active' : ''}`;
                    img.onclick = () => {
                        mainImg.src = url;
                        document.querySelectorAll('.nucleo-thumb').forEach(t => t.classList.remove('active'));
                        img.classList.add('active');
                    };
                    thumbBox.appendChild(img);
                });
            }
        }

        // 4. Configurar Botón "Agregar" o "Reservar"
        const btnAdd = document.getElementById('nucleo-btn-add');
        const qtyInput = document.getElementById('nucleo-qty');

        if (btnAdd) {
            // Resetear clases por si acaso
            btnAdd.className = 'nucleo-btn-add';

            if (isNoStock) {
                // CAMBIOS SI NO HAY STOCK
                btnAdd.innerHTML = '<i class="fas fa-clock"></i> Pedir Reserva';
                btnAdd.classList.add('btn-reserve'); // Clase naranja nueva
            } else {
                // NORMAL
                btnAdd.innerHTML = '<i class="fas fa-cart-plus"></i> Agregar al Pedido';
            }

            btnAdd.onclick = () => {
                // LÓGICA DEL CARRITO
                const item = {
                    id: doc.id,
                    // Si es reserva, cambiamos el nombre para que sea evidente
                    nombre: isNoStock ? `(RESERVA) ${p.name}` : p.name,
                    // Si es reserva, precio es 0. Si no, precio real.
                    precio: isNoStock ? 0 : p.price,
                    cantidad: parseInt(qtyInput.value) || 1,
                    imagen: urls[0],
                    tipo: 'minorista'
                };
                
                addItemToCart(item, btnAdd, qtyInput);
                
                // Feedback extra opcional si es reserva
                if(isNoStock) {
                    alert("Producto agregado como RESERVA ($0). Coordinaremos el pago cuando ingrese stock.");
                }
            };
        }

        // 5. Mostrar la interfaz final
        if(loading) loading.style.display = 'none';
        if(content) content.style.display = 'grid'; 

    } catch (error) {
        console.error("Error cargando detalle Núcleo:", error);
        if(loading) loading.innerHTML = "Error al cargar datos del producto. Intenta recargar.";
    }
}
// ==========================================================
// === LÓGICA DE BÚSQUEDA MAYORISTA (NUEVO)               ===
// ==========================================================

// 1. Configurar el evento submit del formulario
function setupMayoristaSearchForm() {
    const form = document.getElementById('form-busqueda-mayorista');
    const input = document.getElementById('input-busqueda-mayorista');

    if (form && input) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const term = input.value.trim();
            if (term) {
                // Redirigir a la página de resultados con el parámetro q
                window.location.href = `mayorista-busqueda.html?q=${encodeURIComponent(term)}`;
            }
        });
    }
}

// 2. Ejecutar la búsqueda y renderizar (Estilo Mayorista)
async function executeMayoristaSearch(searchTerm) {
    const container = document.getElementById('mayorista-search-results');
    const titleDisplay = document.getElementById('search-term-display');
    
    if(!container) return;

    // Actualizar título
    if(titleDisplay) titleDisplay.textContent = `Resultados para: "${searchTerm}"`;

    try {
        const searchTermLower = searchTerm.toLowerCase();
        
        // Obtenemos TODOS los productos (igual que en mayorista.html para poder filtrar en cliente)
        // Nota: Si tienes miles de productos, convendría un índice de búsqueda en backend, 
        // pero para Firebase básico esto es lo estándar.
        const snapshot = await db.collection('products').get();

        const matches = [];

        snapshot.forEach(doc => {
            if (doc.id.startsWith('--config-')) return;
            const data = doc.data();
            
            const name = data.name ? data.name.toLowerCase() : '';
            const brand = data.brand ? data.brand.toLowerCase() : '';
            // Buscar también en descripción si existe
            let description = '';
            if(data.detailSections && data.detailSections.length > 0) {
                 description = data.detailSections.map(s => s.content).join(' ').toLowerCase();
            } else if (data.description) { 
                 description = data.description.toLowerCase();
            }

            // Lógica de coincidencia
            if (name.includes(searchTermLower) || brand.includes(searchTermLower) || description.includes(searchTermLower)) {
                
                // CALCULAR PRECIO MAYORISTA (Lógica idéntica a mayorista.html)
                const precioLista = parseFloat(data.price || 0);
                let precioMayorista = parseFloat(data.wholesalePrice);
                
                if (!precioMayorista || isNaN(precioMayorista)) {
                    precioMayorista = precioLista * 0.70; // 30% OFF automático
                }

                matches.push({
                    id: doc.id,
                    ...data,
                    precioLista: precioLista,
                    precioMayoristaCalculado: precioMayorista
                });
            }
        });

        container.innerHTML = '';

        if (matches.length === 0) {
            container.innerHTML = `
                <div class="mensaje-vacio" style="text-align:center; padding: 40px;">
                    <h3>No encontramos coincidencias</h3>
                    <p>Intenta con otra palabra clave o marca.</p>
                </div>`;
            return;
        }

        // Renderizar Tarjetas (Estilo Dorado)
        matches.forEach(prod => {
            const imageUrl = (prod.imageUrls && prod.imageUrls.length > 0) ? prod.imageUrls[0] : (prod.imageUrl || 'https://via.placeholder.com/150');
            
            // 1. GENERAR HTML DE PROMOS
let promosHTML = '';

if (prod.quantityPromos && Array.isArray(prod.quantityPromos) && prod.quantityPromos.length > 0) {
    promosHTML = '<div class="promo-mini-list">';
    prod.quantityPromos.forEach(p => {
        
        // CÁLCULO DEL PORCENTAJE (Precio Lista vs Precio Promo)
        let percentOff = 0;
        if (prod.precioLista > 0) {
            percentOff = Math.round(((prod.precioLista - p.unitPrice) / prod.precioLista) * 100);
        }

        // HTML actualizado con el badge de porcentaje
        promosHTML += `
            <div class="promo-mini-item">
                <span>Llevando <strong>${p.quantity}+</strong></span>
                <div style="display:flex; align-items:center; gap:6px;">
                    ${percentOff > 0 ? `<span class="promo-percent-tag">-${percentOff}%</span>` : ''}
                    <strong>$${p.unitPrice.toFixed(2)}</strong>
                </div>
            </div>`;
    });
    promosHTML += '</div>';
} else {
    promosHTML = '<div style="height:5px;"></div>';
}
            // Crear tarjeta HTML
            const card = document.createElement('div');
            card.className = 'tarjeta-producto';
            
            // Navegación al detalle
            card.onclick = (e) => {
                if (e.target.classList.contains('boton-agregar') || e.target.tagName === 'INPUT' || e.target.tagName === 'LABEL') return;
                window.location.href = `mayorista-detalle.html?id=${prod.id}`;
            };
            
            card.innerHTML = `
                <div class="product-carousel">
                    <img src="${imageUrl}" class="carousel-image active" style="object-fit:contain; opacity: ${isNoStock ? '0.5' : '1'};">
                    ${badgeHTML}
                    ${stockBadgeHTML}
                </div>
                <div class="producto-info">
                    <div class="producto-categoria-header">
                        <span class="mayorista-badge">${prod.brand || 'General'}</span>
                    </div>
                    <h3 class="producto-nombre">${prod.name}</h3>
                    
                    <div style="margin-bottom: 5px;">
                        <span class="precio-regular-tachado">$${prod.precioLista.toFixed(2)}</span>
                        <span class="precio-mayorista-final">$${prod.precioCalculadoMayorista.toFixed(2)}</span>
                    </div>

                    ${promosHTML}

                    <div class="producto-acciones">
                        <label>Cant:</label>
                        <input type="number" class="producto-cantidad" value="1" min="1">
                        <button class="boton-agregar ${btnClass}" 
                            data-id="${prod.id}" 
                            data-name="${nombreParaCarrito}">
                            ${btnText}
                        </button>
                    </div>
                </div>
            `;
            
            // Listener Botón Agregar (¡ACTUALIZADO PARA PROMOS!)
            const btn = card.querySelector('.boton-agregar');
            const input = card.querySelector('input');
            
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const qty = parseInt(input.value) || 1;
                
                // Calculamos el precio real (Base Mayorista vs Promo por Cantidad)
                const finalUnitPrice = getPriceForQuantity(prod.precioCalculadoMayorista, qty, prod.quantityPromos);

                const item = {
                    id: prod.id,
                    nombre: btn.dataset.name,
                    precio: isNoStock ? 0 : parseFloat(finalUnitPrice), // Si es reserva $0, sino precio calculado
                    cantidad: qty,
                    imagen: imageUrl,
                    tipo: 'mayorista'
                };
                
                addItemToCart(item, btn, input);
                
                // Aviso extra si aplicó promo
                if (!isNoStock && finalUnitPrice < prod.precioCalculadoMayorista) {
                    alert(`¡Promo aplicada! Precio unitario reducido a $${finalUnitPrice}`);
                }
                if(isNoStock) alert("Producto agregado como RESERVA ($0).");
            });

            container.appendChild(card);
        });

    } catch (error) {
        console.error("Error búsqueda mayorista:", error);
        container.innerHTML = '<p class="error-message">Error al realizar la búsqueda.</p>';
    }
}
// ==========================================================
// === LÓGICA DE CATEGORÍA NÚCLEO (CARGA DE DATOS) ===
// ==========================================================

// Variable global para el caché de esta página
let nucleoProductsCache = []; 

async function loadUniversalCategoryLogic(categoryId) {
    console.log("🚀 Iniciando carga de categoría ID:", categoryId);

    const titleH1 = document.getElementById('dynamic-cat-title');
    const descP = document.getElementById('dynamic-cat-desc');
    const container = document.getElementById('catalogo-container');
    const resultsCount = document.getElementById('nucleo-results-count');
    const hero = document.getElementById('dynamic-hero');

    // ======================================================
    // === NUEVO: LÓGICA PARA CAMBIAR DE VISTA (LISTA/GRILLA) ===
    // ======================================================
    const viewButtons = document.querySelectorAll('.btn-view-nucleo');
    
    if(viewButtons.length > 0 && container) {
        viewButtons.forEach(btn => {
            // Clonamos el botón para eliminar listeners viejos si se recarga la función
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const targetBtn = e.currentTarget; // Aseguramos agarrar el botón, no el icono

                // 1. Visual: Cambiar botón activo
                document.querySelectorAll('.btn-view-nucleo').forEach(b => b.classList.remove('active'));
                targetBtn.classList.add('active');

                // 2. Lógica: Cambiar clase del contenedor
                const viewMode = targetBtn.dataset.view; // 'grid', 'list', o 'feed'
                
                // Quitamos todas las clases de vista posibles
                container.classList.remove('view-grid', 'view-list', 'view-feed');
                
                // Agregamos la seleccionada
                container.classList.add(`view-${viewMode}`);
                console.log("Vista cambiada a:", viewMode);
            });
        });
    }

    // Cambiamos el mensaje para confirmar que JS tomó el control
    if(container) container.innerHTML = '<div class="loading-spinner"><i class="fas fa-circle-notch fa-spin"></i> Buscando productos...</div>';
    try {
        // 1. CARGAR INFO DE LA CATEGORÍA
        const catDoc = await db.collection('categories').doc(categoryId).get();
        if (catDoc.exists) {
            const data = catDoc.data();
            if(titleH1) titleH1.textContent = data.name;
            if(descP) descP.textContent = `Explora nuestra selección de ${data.name}`;
            
            // Imagen de fondo del banner
            const bannerUrl = data.bannerImageUrl || data.imageUrl;
            if (hero && bannerUrl) {
                hero.style.backgroundImage = `url('${bannerUrl}')`;
            }
        } else {
            if(titleH1) titleH1.textContent = "Categoría Desconocida";
        }

        // 2. CARGAR PRODUCTOS
        // Pedimos TODOS los de la marca nucleo y filtramos por ID de categoría
        const snapshot = await db.collection('products')
            .where('brand', '==', 'nucleo')
            .get();

        nucleoProductsCache = []; 

        snapshot.forEach(doc => {
            const p = doc.data();
            // Comparamos IDs como texto para evitar errores
            if (p.categoryId && String(p.categoryId) === String(categoryId)) {
                nucleoProductsCache.push({
                    id: doc.id,
                    ...p,
                    searchName: (p.name || '').toLowerCase(),
                    price: parseFloat(p.price || 0)
                });
            }
        });

        if (nucleoProductsCache.length === 0) {
            container.innerHTML = `
                <div style="grid-column:1/-1; text-align:center; padding:40px;">
                    <i class="fas fa-box-open" style="font-size:3rem; color:#ddd; margin-bottom:15px;"></i>
                    <h3 style="color:#666;">Aún no hay productos aquí.</h3>
                    <a href="productos-nucleo.html" class="nucleo-btn" style="margin-top:15px; display:inline-block; background:#6f42c1; color:white;">Ver todo el stock</a>
                </div>`;
            if(resultsCount) resultsCount.textContent = "0 Productos";
            return;
        }

        renderNucleoCategoryProducts(container, resultsCount);

    } catch (error) {
        console.error("Error cargando categoría:", error);
        if(container) container.innerHTML = `<p class="error-msg">Error: ${error.message}</p>`;
    }
}

// Función auxiliar para renderizar y filtrar
function renderNucleoCategoryProducts(container, resultsCount) {
    const searchInput = document.getElementById('nucleo-cat-search-input');
    const sortSelect = document.getElementById('nucleo-cat-sort');
    
    container.innerHTML = '';
    
    // Filtros
    const term = searchInput ? searchInput.value.trim().toLowerCase() : '';
    let filtered = nucleoProductsCache.filter(p => p.searchName.includes(term));

    // Ordenamiento
    const sortMode = sortSelect ? sortSelect.value : 'default';
    if (sortMode === 'price-asc') filtered.sort((a, b) => a.price - b.price);
    else if (sortMode === 'price-desc') filtered.sort((a, b) => b.price - a.price);
    else if (sortMode === 'az') filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    else if (sortMode === 'za') filtered.sort((a, b) => (b.name || '').localeCompare(a.name || ''));

    if(resultsCount) resultsCount.textContent = `${filtered.length} Productos`;

    if (filtered.length === 0) {
        container.innerHTML = '<div style="padding:30px; width:100%; text-align:center;">No hay coincidencias.</div>';
        return;
    }

    filtered.forEach(prod => {
        const card = window.createProductCard(prod, prod.id);
        container.appendChild(card);
    });
    
    // Activar carruseles
    if (window.setupCarousels) window.setupCarousels(container);

    // Listeners (solo una vez)
    const searchForm = document.getElementById('nucleo-cat-search-form');
    if (searchForm && !searchForm.dataset.listening) {
        searchForm.dataset.listening = "true";
        searchForm.addEventListener('submit', (e) => { e.preventDefault(); renderNucleoCategoryProducts(container, resultsCount); });
        if(searchInput) searchInput.addEventListener('input', () => renderNucleoCategoryProducts(container, resultsCount));
    }
    if (sortSelect && !sortSelect.dataset.listening) {
        sortSelect.dataset.listening = "true";
        sortSelect.addEventListener('change', () => renderNucleoCategoryProducts(container, resultsCount));
    }
}// ==========================================================
// === INICIALIZACIÓN Y LÓGICA DEL ADMIN NÚCLEO ===
// ==========================================================

function initializeNucleoAdminPage() {
    console.log("🔧 Inicializando Panel de Administración Núcleo...");

    // 1. Cargar datos iniciales
    loadNucleoAdminCategories();
    loadNucleoStock();

    // 2. Configurar Listener para Crear Categoría
    const catForm = document.getElementById('nucleo-category-form');
    if (catForm) {
        // Clonamos para evitar listeners duplicados si se recarga
        const newCatForm = catForm.cloneNode(true);
        catForm.parentNode.replaceChild(newCatForm, catForm);
        
        newCatForm.addEventListener('submit', handleNucleoCategorySubmit);
    }

    // 3. Configurar Listener para Crear/Editar Producto
    const prodForm = document.getElementById('nucleo-product-form');
    if (prodForm) {
        const newProdForm = prodForm.cloneNode(true);
        prodForm.parentNode.replaceChild(newProdForm, prodForm);
        
        newProdForm.addEventListener('submit', handleNucleoProductSubmit);
    }

    // 4. Botón para agregar fila de Promo
    const btnAddPromo = document.getElementById('btn-add-promo-row');
    if (btnAddPromo) {
        // Limpiamos listener anterior clonando
        const newBtn = btnAddPromo.cloneNode(true);
        btnAddPromo.parentNode.replaceChild(newBtn, btnAddPromo);
        newBtn.addEventListener('click', () => addNucleoPromoRow());
    }
    
    // 5. Botón Cancelar Edición
    const btnCancel = document.getElementById('btn-cancel-prod');
    if(btnCancel) {
        btnCancel.addEventListener('click', resetNucleoForm);
    }

    // 6. Botón Logout específico de esta página
    const btnLogout = document.getElementById('logout-btn-nucleo');
    if(btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            auth.signOut().then(() => window.location.href = 'productos-nucleo.html');
        });
    }
}

// --- Función para GUARDAR CATEGORÍA (Faltaba esta lógica) ---
const btnCancelCat = document.getElementById('btn-cancel-cat');
    if(btnCancelCat) {
        btnCancelCat.addEventListener('click', window.resetNucleoCategoryForm);
    }
async function handleNucleoCategorySubmit(e) {
    e.preventDefault();
    
    const idInput = document.getElementById('nucleo-cat-edit-id'); // El campo oculto
    const nameInput = document.getElementById('nucleo-cat-name');
    const imgInput = document.getElementById('nucleo-cat-img');
    const bannerInput = document.getElementById('nucleo-cat-banner-img');
    const feedback = document.getElementById('feedback-cat');
    const btnSave = document.getElementById('btn-save-cat');

    const name = nameInput.value.trim();
    const imgUrl = imgInput.value.trim();
    const bannerUrl = bannerInput.value.trim();
    const editId = idInput.value; // ID si estamos editando

    if (!name) return alert("El nombre es obligatorio");

    const originalText = btnSave.textContent;
    btnSave.textContent = "Guardando...";
    btnSave.disabled = true;

    try {
        const catData = {
            name: name,
            imageUrl: imgUrl,
            bannerImageUrl: bannerUrl,
            brand: 'nucleo'
        };

        if (editId) {
            // === MODO EDICIÓN ===
            await db.collection('categories').doc(editId).update(catData);
            feedback.textContent = "¡Categoría Actualizada!";
        } else {
            // === MODO CREACIÓN ===
            await db.collection('categories').add(catData);
            feedback.textContent = "¡Categoría Creada!";
        }

        // Mostrar mensaje éxito
        feedback.className = "feedback-msg feedback-success";
        feedback.style.display = "block";
        setTimeout(() => feedback.style.display = 'none', 3000);
        
        // Resetear todo
        window.resetNucleoCategoryForm(); 
        loadNucleoAdminCategories(); // Recargar tabla

    } catch (error) {
        console.error("Error guardando categoría:", error);
        alert("Error al guardar: " + error.message);
    } finally {
        btnSave.textContent = originalText;
        if(editId) btnSave.textContent = "Actualizar Categoría"; // Mantener texto si falló
        else btnSave.textContent = "Crear Categoría";
        
        btnSave.disabled = false;
    }
}
window.editNucleoCategory = async (id) => {
    try {
        const doc = await db.collection('categories').doc(id).get();
        if(!doc.exists) return;
        const data = doc.data();

        // Llenar inputs
        document.getElementById('nucleo-cat-edit-id').value = id;
        document.getElementById('nucleo-cat-name').value = data.name;
        document.getElementById('nucleo-cat-img').value = data.imageUrl || '';
        document.getElementById('nucleo-cat-banner-img').value = data.bannerImageUrl || '';

        // Cambiar estado visual de botones
        const btnSave = document.getElementById('btn-save-cat');
        const btnCancel = document.getElementById('btn-cancel-cat');
        
        if(btnSave) btnSave.textContent = "Actualizar Categoría";
        if(btnCancel) btnCancel.style.display = 'inline-block';

        // Scroll hacia arriba para ver el formulario
        document.getElementById('nucleo-category-form').scrollIntoView({ behavior: 'smooth' });

    } catch (error) {
        console.error("Error al cargar categoría:", error);
    }
};

// === FUNCIÓN PARA CANCELAR EDICIÓN ===
window.resetNucleoCategoryForm = () => {
    document.getElementById('nucleo-category-form').reset();
    document.getElementById('nucleo-cat-edit-id').value = '';
    
    const btnSave = document.getElementById('btn-save-cat');
    const btnCancel = document.getElementById('btn-cancel-cat');
    
    if(btnSave) btnSave.textContent = "Crear Categoría";
    if(btnCancel) btnCancel.style.display = 'none';
};