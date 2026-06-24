/**
 * ProGeo WebGIS Workbench - Core JavaScript Engine
 * Architectural Design: Vanilla ES6+ Modular Singleton State
 */

// --- 1. Internationalization Dictionary (i18n) ---
const translations = {
    en: {
        appTitle: "ProGeo WebGIS",
        tabCreate: "Create",
        tabImport: "Import",
        tabExport: "Export",
        geometryHeading: "Vector Geometry Creation",
        geometryDesc: "Select a tool from the map or input exact coordinates below.",
        coordFormat: "Coordinate Format",
        selectFeatureHint: "Select geometry type to begin manual input.",
        importHeading: "Spatial Ingestion",
        dragDropText: "Drag & Drop files here or click to browse",
        exportHeading: "Data Egress",
        selectExportLayer: "Select Layer to Export",
        drawnFeatures: "Custom Drawn Features",
        exportFormat: "Target Format",
        btnExport: "Export Layer"
    },
    ar: {
        appTitle: "برو-جيوجرافيك WebGIS",
        tabCreate: "إنشاء الرفع",
        tabImport: "استيراد بيانات",
        tabExport: "تصدير البيانات",
        geometryHeading: "إنشاء الأشكال الهندسية (Vector)",
        geometryDesc: "اختر أداة الرسم من الخريطة أو أدخل الإحداثيات الدقيقة أدناه.",
        coordFormat: "نظام الإحداثيات",
        selectFeatureHint: "اختر نوع الشكل الهندسي لبدء إدخال البيانات يدوياً.",
        importHeading: "استيراد البيانات المكانية",
        dragDropText: "قم بسحب وإفلات الملفات هنا أو انقر للتصفح",
        exportHeading: "تصدير وإخراج البيانات",
        selectExportLayer: "اختر الطبقة للتصدير",
        drawnFeatures: "العناصر المرسومة يدوياً",
        exportFormat: "صيغة التصدير المستهدفة",
        btnExport: "تصدير الطبقة"
    }
};

// --- 2. Application State Management ---
const AppState = {
    currentLang: 'en',
    map: null,
    baseMaps: {},
    drawnItems: null,
    
    // Initialize Localization
    initLocalization() {
        const langToggleBtn = document.getElementById('lang-toggle-btn');
        const langText = document.getElementById('lang-text');

        langToggleBtn.addEventListener('click', () => {
            this.currentLang = this.currentLang === 'en' ? 'ar' : 'en';
            langText.textContent = this.currentLang === 'en' ? 'العربية' : 'English';
            this.applyLocalization();
        });

        this.applyLocalization();
    },

    applyLocalization() {
        const htmlDoc = document.documentElement;
        htmlDoc.setAttribute('lang', this.currentLang);
        htmlDoc.setAttribute('dir', this.currentLang === 'ar' ? 'rtl' : 'ltr');

        // Update DOM elements matching data-i18n attributes
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (translations[this.currentLang][key]) {
                element.textContent = translations[this.currentLang][key];
            }
        });

        // Dynamic update of Map scale and controls text position if needed
        if (this.map) {
            this.map.invalidateSize();
        }
    },

    // Initialize UI Sidebar Tab Controls
    initSidebarTabs() {
        const tabs = document.querySelectorAll('.sidebar-tabs .tab-btn');
        const panels = document.querySelectorAll('.sidebar-body .tab-panel');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                panels.forEach(p => p.classList.remove('active'));

                tab.classList.add('active');
                const targetPanel = document.getElementById(tab.getAttribute('data-tab'));
                if (targetPanel) targetPanel.classList.add('active');
            });
        });
    },

    // Initialize Map Viewport, Tile Providers, and Editing Tools
    initMap() {
        // 1. Define the 5 professional-grade core basemaps
        this.baseMaps = {
            "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap contributors'
            }),
            "Satellite (Esri)": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            }),
            "Topographic": L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                maxZoom: 17,
                attribution: 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)'
            }),
            "Street Map": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Tiles © Esri — Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012'
            }),
            "Light Gray Canvas": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
                maxZoom: 16,
                attribution: 'Tiles © Esri — Esri, DeLorme, NAVTEQ'
            })
        };

        // 2. Map Instantiation with default view over standard Global Scale
        this.map = L.map('map', {
            center: [30.0444, 31.2357], // Default centered near Cairo / MENA crossroads
            zoom: 6,
            layers: [this.baseMaps["OpenStreetMap"]],
            zoomControl: true
        });

        // Add Layer Control Component Switcher
        L.control.layers(this.baseMaps, null, { position: 'topright' }).addTo(this.map);

        // 3. Setup Vector Layers Storage Group for features
        this.drawnItems = L.featureGroup().addTo(this.map);

        // 4. Initialize Leaflet-Geoman Drawing Controls
        this.map.pm.addControls({
            position: 'topleft',
            drawMarker: true,
            drawCircleMarker: false,
            drawPolyline: true,
            drawRectangle: true,
            drawPolygon: true,
            drawCircle: true,
            editMode: true,
            dragMode: true,
            cutPolygon: false,
            removalMode: true
        });

        // 5. Global Event Listener Hooks for Drawn Elements
        this.map.on('pm:create', (e) => {
            const layer = e.layer;
            const shape = e.shape; // Marker, Line, Polygon, Circle, Rectangle

            // Append newly drawn item to global container
            this.drawnItems.addLayer(layer);

            // Setup a basic clean GIS metadata identification pop-up window
            layer.bindPopup(`<b>Geometry Type:</b> ${shape}<br><b>ID:</b> ${L.stamp(layer)}`).openPopup();
            
            console.log(`Successfully mapped feature type: ${shape}, Leaflet internal stamp: ${L.stamp(layer)}`);
        });
    }
};

// --- 3. Dynamic Application Lifecycle Initialization Hook ---
document.addEventListener('DOMContentLoaded', () => {
    AppState.initLocalization();
    AppState.initSidebarTabs();
    AppState.initMap();
});