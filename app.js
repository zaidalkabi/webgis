/**
 * ProGeo WebGIS Workbench - Core JavaScript Engine
 * Clean, Unified Singleton Architecture
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

// --- 2. Application State & Core Engine ---
const AppState = {
    currentLang: 'en',
    map: null,
    baseMaps: {},
    drawnItems: null,
    uploadedRawData: null,

    // --- Core Initialization ---
    initAll() {
        this.initMap(); // تفعيل الخريطة أولاً لضمان وجود الكائن قبل الترجمة والتحجيم
        this.initLocalization();
        this.initSidebarTabs();
        this.initCoordinateFormController();
        this.initIngestionEngine();
        this.initEgressEngine();
    },

    // --- Localization ---
    initLocalization() {
        const langToggleBtn = document.getElementById('lang-toggle-btn');
        const langText = document.getElementById('lang-text');

        if (langToggleBtn) {
            langToggleBtn.addEventListener('click', () => {
                this.currentLang = this.currentLang === 'en' ? 'ar' : 'en';
                langText.textContent = this.currentLang === 'en' ? 'العربية' : 'English';
                this.applyLocalization();
            });
        }
        this.applyLocalization();
    },

    applyLocalization() {
        const htmlDoc = document.documentElement;
        htmlDoc.setAttribute('lang', this.currentLang);
        htmlDoc.setAttribute('dir', this.currentLang === 'ar' ? 'rtl' : 'ltr');

        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (translations[this.currentLang][key]) {
                element.textContent = translations[this.currentLang][key];
            }
        });

        if (this.map) {
            this.map.invalidateSize();
        }
    },

    // --- UI Tabs ---
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

    // --- Leaflet Map Setup ---
    initMap() {
        this.baseMaps = {
            "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap'
            }),
            "Satellite (Esri)": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Tiles © Esri'
            }),
            "Topographic": L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                maxZoom: 17,
                attribution: 'Map data: © OpenStreetMap'
            })
        };

        this.map = L.map('map', {
            center: [30.0444, 31.2357], 
            zoom: 6,
            layers: [this.baseMaps["OpenStreetMap"]],
            zoomControl: true
        });

        L.control.layers(this.baseMaps, null, { position: 'topright' }).addTo(this.map);
        this.drawnItems = L.featureGroup().addTo(this.map);

        this.map.pm.addControls({
            position: 'topleft',
            drawMarker: true,
            drawPolyline: true,
            drawRectangle: true,
            drawPolygon: true,
            drawCircle: true,
            editMode: true,
            dragMode: true,
            removalMode: true
        });

        this.map.on('pm:create', (e) => {
            const layer = e.layer;
            this.drawnItems.addLayer(layer);
            layer.bindPopup(`<b>Geometry Type:</b> ${e.shape}<br><b>ID:</b> ${L.stamp(layer)}`).openPopup();
        });
    },

    // --- Coordinate Calculators ---
    getUtmProjString(zone, hemisphere) {
        const southShift = (hemisphere.toLowerCase() === 's' || hemisphere.toLowerCase() === 'south') ? ' +south' : '';
        return `+proj=utm +zone=${zone}${southShift} +datum=WGS84 +units=m +no_defs`;
    },

    dmsToDd(degrees, minutes, seconds, direction) {
        let dd = parseFloat(degrees) + parseFloat(minutes) / 60 + parseFloat(seconds) / 3600;
        if (direction === 'S' || direction === 'W' || direction === 'غرب' || direction === 'جنوب') {
            dd = dd * -1;
        }
        return dd;
    },

    utmToWgs84(easting, northing, zone, hemisphere) {
        const utmProj = this.getUtmProjString(zone, hemisphere);
        const wgs84Proj = "+proj=longlat +datum=WGS84 +no_defs";
        const result = proj4(utmProj, wgs84Proj, [parseFloat(easting), parseFloat(northing)]);
        return { lat: result[1], lng: result[0] };
    },

    mgrsToWgs84(mgrsString) {
        try {
            const point = mgrs.toPoint(mgrsString.replace(/\s+/g, ''));
            return { lat: point[1], lng: point[0] };
        } catch (error) {
            alert("Invalid MGRS String Format. Example: 36RUU20148231");
            return null;
        }
    },

    // --- Manual Input Form ---
    initCoordinateFormController() {
        const selector = document.getElementById('coord-format-selector');
        const formContainer = document.getElementById('coordinate-input-form');

        if (!selector || !formContainer) return;

        selector.addEventListener('change', (e) => {
            this.renderDynamicFormFields(e.target.value, formContainer);
        });

        this.renderDynamicFormFields('DD', formContainer);
    },

    renderDynamicFormFields(format, container) {
        let htmlSchema = `
            <div class="tool-section">
                <label>Target Geometry Type</label>
                <select id="manual-geom-type" class="form-control" style="margin-bottom: 12px;">
                    <option value="Point">Point (النقاط)</option>
                    <option value="Line">Polyline (الخطوط)</option>
                    <option value="Polygon">Polygon (المضلعات)</option>
                    <option value="Circle">Circle (الدوائر)</option>
                </select>
            </div>
            <hr style="border:0; border-top:1px solid var(--border-color); margin: 12px 0;">
        `;

        switch(format) {
            case 'DD':
                htmlSchema += `
                    <div id="dynamic-coordinate-nodes">
                        <div class="coordinate-node-row" style="display:flex; gap:8px; margin-bottom:8px;">
                            <input type="number" step="any" placeholder="Latitude (Y)" class="form-control node-lat" required>
                            <input type="number" step="any" placeholder="Longitude (X)" class="form-control node-lng" required>
                        </div>
                    </div>
                `;
                break;
            case 'DMS':
                htmlSchema += `
                    <div id="dynamic-coordinate-nodes">
                        <div class="coordinate-node-row" style="border: 1px solid var(--border-color); padding: 8px; border-radius: 6px; margin-bottom:8px;">
                            <div style="display:flex; gap:4px; margin-bottom:4px;">
                                <input type="number" placeholder="Deg" class="form-control dms-lat-d" style="padding:4px;">
                                <input type="number" placeholder="Min" class="form-control dms-lat-m" style="padding:4px;">
                                <input type="number" step="any" placeholder="Sec" class="form-control dms-lat-s" style="padding:4px;">
                                <select class="form-control dms-lat-dir" style="padding:4px; width:65px;"><option>N</option><option>S</option></select>
                            </div>
                            <div style="display:flex; gap:4px;">
                                <input type="number" placeholder="Deg" class="form-control dms-lng-d" style="padding:4px;">
                                <input type="number" placeholder="Min" class="form-control dms-lng-m" style="padding:4px;">
                                <input type="number" step="any" placeholder="Sec" class="form-control dms-lng-s" style="padding:4px;">
                                <select class="form-control dms-lng-dir" style="padding:4px; width:65px;"><option>E</option><option>W</option></select>
                            </div>
                        </div>
                    </div>
                `;
                break;
            case 'UTM':
                htmlSchema += `
                    <div id="dynamic-coordinate-nodes">
                        <div class="coordinate-node-row" style="border:1px solid var(--border-color); padding:8px; border-radius:6px; margin-bottom:8px;">
                            <div style="display:flex; gap:8px; margin-bottom:6px;">
                                <input type="number" step="any" placeholder="Easting (X)" class="form-control utm-easting">
                                <input type="number" step="any" placeholder="Northing (Y)" class="form-control utm-northing">
                            </div>
                            <div style="display:flex; gap:8px;">
                                <input type="number" placeholder="Zone (1-60)" class="form-control utm-zone">
                                <select class="form-control utm-hemi"><option value="N">North (N)</option><option value="S">South (S)</option></select>
                            </div>
                        </div>
                    </div>
                `;
                break;
            case 'MGRS':
                htmlSchema += `
                    <div id="dynamic-coordinate-nodes">
                        <div class="coordinate-node-row" style="margin-bottom:8px;">
                            <input type="text" placeholder="e.g. 36RUU20148231" class="form-control mgrs-string">
                        </div>
                    </div>
                `;
                break;
        }

        htmlSchema += `
            <div id="node-modifier-actions" style="display:none; margin-bottom:12px; gap:8px;">
                <button type="button" id="add-node-row-btn" class="btn btn-secondary" style="flex:1; padding:6px; font-size:0.8rem;"><i class="fa-solid fa-plus"></i> Add Vertex</button>
            </div>
            <div id="circle-radius-section" style="display:none; margin-bottom:12px; gap:8px;">
                <input type="number" id="circle-radius-val" placeholder="Radius Value" class="form-control" style="flex:2;">
                <select id="circle-radius-unit" class="form-control" style="flex:1;">
                    <option value="m">Meters</option>
                    <option value="km">Kilometers</option>
                </select>
            </div>
            <button type="button" id="plot-manual-btn" class="btn btn-primary w-100"><i class="fa-solid fa-layer-group"></i> Construct Feature</button>
        `;

        container.innerHTML = htmlSchema;
        this.bindDynamicFormEvents();
    },

    bindDynamicFormEvents() {
        const geomSelector = document.getElementById('manual-geom-type');
        const nodeModifier = document.getElementById('node-modifier-actions');
        const circleSection = document.getElementById('circle-radius-section');
        const addNodeBtn = document.getElementById('add-node-row-btn');
        const plotBtn = document.getElementById('plot-manual-btn');

        if(!geomSelector) return;

        geomSelector.addEventListener('change', (e) => {
            const type = e.target.value;
            nodeModifier.style.display = (type === 'Line' || type === 'Polygon') ? 'flex' : 'none';
            circleSection.style.display = (type === 'Circle') ? 'flex' : 'none';
        });

        addNodeBtn.addEventListener('click', () => {
            const container = document.getElementById('dynamic-coordinate-nodes');
            const targetRow = container.querySelector('.coordinate-node-row');
            const clonedRow = targetRow.cloneNode(true);
            clonedRow.querySelectorAll('input').forEach(input => input.value = '');
            container.appendChild(clonedRow);
        });

        plotBtn.addEventListener('click', () => this.processFormCompilation());
    },

    processFormCompilation() {
        const format = document.getElementById('coord-format-selector').value;
        const geomType = document.getElementById('manual-geom-type').value;
        const rows = document.querySelectorAll('#dynamic-coordinate-nodes .coordinate-node-row');
        let targetCoordinates = []; 

        for (let row of rows) {
            let lat, lng;

            if (format === 'DD') {
                lat = parseFloat(row.querySelector('.node-lat').value);
                lng = parseFloat(row.querySelector('.node-lng').value);
            } 
            else if (format === 'DMS') {
                const dLat = row.querySelector('.dms-lat-d').value;
                const mLat = row.querySelector('.dms-lat-m').value;
                const sLat = row.querySelector('.dms-lat-s').value;
                const dirLat = row.querySelector('.dms-lat-dir').value;
                lat = this.dmsToDd(dLat, mLat, sLat, dirLat);

                const dLng = row.querySelector('.dms-lng-d').value;
                const mLng = row.querySelector('.dms-lng-m').value;
                const sLng = row.querySelector('.dms-lng-s').value;
                const dirLng = row.querySelector('.dms-lng-dir').value;
                lng = this.dmsToDd(dLng, mLng, sLng, dirLng);
            } 
            else if (format === 'UTM') {
                const easting = row.querySelector('.utm-easting').value;
                const northing = row.querySelector('.utm-northing').value;
                const zone = row.querySelector('.utm-zone').value;
                const hemi = row.querySelector('.utm-hemi').value;
                const converted = this.utmToWgs84(easting, northing, zone, hemi);
                lat = converted.lat;
                lng = converted.lng;
            } 
            else if (format === 'MGRS') {
                const mgrsString = row.querySelector('.mgrs-string').value;
                const converted = this.mgrsToWgs84(mgrsString);
                if (!converted) return;
                lat = converted.lat;
                lng = converted.lng;
            }

            if (isNaN(lat) || isNaN(lng)) {
                alert("Coordinate entry parse error. Verify input value structures.");
                return;
            }
            targetCoordinates.push([lat, lng]);
        }

        this.plotVectorToCanvas(geomType, targetCoordinates);
    },

    plotVectorToCanvas(geometryType, coords) {
        let vectorLayer;

        switch(geometryType) {
            case 'Point':
                vectorLayer = L.marker(coords[0]);
                break;
            case 'Line':
                if (coords.length < 2) { alert("Lines require at least 2 vertices."); return; }
                vectorLayer = L.polyline(coords);
                break;
            case 'Polygon':
                if (coords.length < 3) { alert("Polygons require at least 3 vertices."); return; }
                vectorLayer = L.polygon(coords);
                break;
            case 'Circle':
                const radiusInput = parseFloat(document.getElementById('circle-radius-val').value);
                const unit = document.getElementById('circle-radius-unit').value;
                if (isNaN(radiusInput) || radiusInput <= 0) { alert("Specify a valid positive circle radius."); return; }
                const finalRadiusInMeters = unit === 'km' ? radiusInput * 1000 : radiusInput;
                vectorLayer = L.circle(coords[0], { radius: finalRadiusInMeters });
                break;
        }

        if (vectorLayer) {
            this.drawnItems.addLayer(vectorLayer);
            this.map.flyTo(coords[0], Math.max(this.map.getZoom(), 13));
            vectorLayer.bindPopup(`<b>Manual Type:</b> ${geometryType}<br><b>ID:</b> ${L.stamp(vectorLayer)}`).openPopup();
        }
    },

    // --- Ingestion Engine (Import) ---
    initIngestionEngine() {
        const dropZone = document.getElementById('file-drop-zone');
        const fileInput = document.getElementById('file-input');

        if(!dropZone || !fileInput) return;

        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length) this.handleFilesProcessing(e.dataTransfer.files);
        });
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) this.handleFilesProcessing(e.target.files);
        });

        this.initModalListeners();
    },

    handleFilesProcessing(files) {
        Array.from(files).forEach(file => {
            const fileName = file.name;
            const extension = fileName.split('.').pop().toLowerCase();
            const reader = new FileReader();

            if (extension === 'geojson' || extension === 'json') {
                reader.onload = (e) => this.renderGeoJson(JSON.parse(e.target.result));
                reader.readAsText(file);
            } 
            else if (extension === 'kml') {
                reader.onload = (e) => {
                    const kmlDom = new DOMParser().parseFromString(e.target.result, 'text/xml');
                    const geojson = toGeoJSON.kml(kmlDom);
                    this.renderGeoJson(geojson);
                };
                reader.readAsText(file);
            } 
            else if (extension === 'gpx') {
                reader.onload = (e) => {
                    const gpxDom = new DOMParser().parseFromString(e.target.result, 'text/xml');
                    const geojson = toGeoJSON.gpx(gpxDom);
                    this.renderGeoJson(geojson);
                };
                reader.readAsText(file);
            } 
            else if (extension === 'zip') {
                reader.onload = (e) => {
                    shp(e.target.result).then((geojson) => {
                        this.renderGeoJson(geojson);
                    }).catch(err => alert("Error parsing shapefile ZIP container: " + err));
                };
                reader.readAsArrayBuffer(file);
            } 
            else if (extension === 'csv' || extension === 'xlsx' || extension === 'xls') {
                this.parseTabularFile(file, extension);
            }
        });
    },

    renderGeoJson(geojson) {
        const geojsonLayer = L.geoJSON(geojson, {
            onEachFeature: (feature, layer) => {
                let popupContent = `<strong>Layer Ingestion Properties</strong><hr style='margin:4px 0;'>`;
                if (feature.properties) {
                    Object.entries(feature.properties).forEach(([key, val]) => {
                        if (typeof val !== 'object') popupContent += `<b>${key}:</b> ${val}<br>`;
                    });
                }
                layer.bindPopup(popupContent);
                this.drawnItems.addLayer(layer);
            }
        });
        if (this.drawnItems.getLayers().length > 0) {
            this.map.fitBounds(geojsonLayer.getBounds());
        }
    },

    parseTabularFile(file, extension) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = e.target.result;
            let workbook;
            if (extension === 'csv') {
                workbook = XLSX.read(data, { type: 'string' });
            } else {
                workbook = XLSX.read(data, { type: 'array' });
            }
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
            
            if (rows.length === 0) { alert("Empty tabular dataset source uploaded."); return; }
            
            const headers = Object.keys(rows[0]);
            this.uploadedRawData = { headers, rows };
            this.launchTabularMappingModal();
        };

        if (extension === 'csv') reader.readAsText(file);
        else reader.readAsArrayBuffer(file);
    },

    launchTabularMappingModal() {
        const modal = document.getElementById('csv-mapping-modal');
        const formatSelector = document.getElementById('modal-coord-format');
        
        if(!modal || !formatSelector) return;
        modal.style.display = 'flex';
        formatSelector.onchange = () => this.renderModalDynamicFields(formatSelector.value);
        this.renderModalDynamicFields('DD');
    },

    renderModalDynamicFields(format) {
        const container = document.getElementById('modal-dynamic-mappings');
        const headers = this.uploadedRawData.headers;
        let selectOptions = headers.map(h => `<option value="${h}">${h}</option>`).join('');
        let html = '';

        if (format === 'DD') {
            html += `
                <label>Latitude (Y) Field</label>
                <select id="map-lat-col" class="form-control" style="margin-bottom:8px;">${selectOptions}</select>
                <label>Longitude (X) Field</label>
                <select id="map-lng-col" class="form-control">${selectOptions}</select>
            `;
        } else if (format === 'UTM') {
            html += `
                <label>Easting (X) Field</label>
                <select id="map-east-col" class="form-control" style="margin-bottom:8px;">${selectOptions}</select>
                <label>Northing (Y) Field</label>
                <select id="map-north-col" class="form-control" style="margin-bottom:12px;">${selectOptions}</select>
                <div style="display:flex; gap:8px;">
                    <div>
                        <label>UTM Zone</label>
                        <input type="number" id="map-utm-zone" class="form-control" placeholder="e.g. 36" value="36">
                    </div>
                    <div>
                        <label>Hemisphere</label>
                        <select id="map-utm-hemi" class="form-control"><option value="N">North</option><option value="S">South</option></select>
                    </div>
                </div>
            `;
        } else if (format === 'MGRS') {
            html += `
                <label>MGRS String Column</label>
                <select id="map-mgrs-col" class="form-control">${selectOptions}</select>
            `;
        }
        container.innerHTML = html;
    },

    initModalListeners() {
        const cancelBtn = document.getElementById('modal-cancel-btn');
        const importBtn = document.getElementById('modal-import-btn');

        if(cancelBtn) cancelBtn.onclick = () => document.getElementById('csv-mapping-modal').style.display = 'none';
        if(importBtn) importBtn.onclick = () => this.executeTabularGeocoding();
    },

    executeTabularGeocoding() {
        const format = document.getElementById('modal-coord-format').value;
        const { rows } = this.uploadedRawData;
        let featuresCreatedCount = 0;
        let boundsPoints = [];

        rows.forEach(row => {
            let lat, lng;

            if (format === 'DD') {
                const latKey = document.getElementById('map-lat-col').value;
                const lngKey = document.getElementById('map-lng-col').value;
                lat = parseFloat(row[latKey]);
                lng = parseFloat(row[lngKey]);
            } 
            else if (format === 'UTM') {
                const eastKey = document.getElementById('map-east-col').value;
                const northKey = document.getElementById('map-north-col').value;
                const zone = document.getElementById('map-utm-zone').value;
                const hemi = document.getElementById('map-utm-hemi').value;
                const converted = this.utmToWgs84(row[eastKey], row[northKey], zone, hemi);
                lat = converted.lat;
                lng = converted.lng;
            } 
            else if (format === 'MGRS') {
                const mgrsKey = document.getElementById('map-mgrs-col').value;
                const converted = this.mgrsToWgs84(row[mgrsKey]);
                if (converted) { lat = converted.lat; lng = converted.lng; }
            }

            if (!isNaN(lat) && !isNaN(lng)) {
                featuresCreatedCount++;
                const marker = L.marker([lat, lng]);
                
                let popupHtml = `<strong>Tabular Row Attributes</strong><hr style='margin:4px 0;'>`;
                Object.entries(row).forEach(([k, v]) => {
                    popupHtml += `<b>${k}:</b> ${v}<br>`;
                });
                marker.bindPopup(popupHtml);
                this.drawnItems.addLayer(marker);
                boundsPoints.push([lat, lng]);
            }
        });

        document.getElementById('csv-mapping-modal').style.display = 'none';
        
        if (boundsPoints.length > 0) {
            this.map.fitBounds(L.latLngBounds(boundsPoints));
            alert(`Ingestion complete. Plotted ${featuresCreatedCount} records.`);
        }
    },

    // --- Egress Engine (Export) ---
    initEgressEngine() {
        const exportBtn = document.getElementById('export-execute-btn');
        if(exportBtn) {
            exportBtn.addEventListener('click', () => {
                const format = document.getElementById('export-format-selector').value;
                this.executeLayerExport(format);
            });
        }
    },

    executeLayerExport(format) {
        if (this.drawnItems.getLayers().length === 0) {
            alert("No features found to export.");
            return;
        }

        const geojsonData = this.drawnItems.toGeoJSON();

        switch (format) {
            case 'geojson':
                this.triggerFileDownload(JSON.stringify(geojsonData, null, 2), 'exported_features.geojson', 'application/json');
                break;
            case 'kml':
                try {
                    this.triggerFileDownload(tokml(geojsonData), 'exported_features.kml', 'application/vnd.google-earth.kml+xml');
                } catch (err) { alert("KML creation error: " + err); }
                break;
            case 'gpx':
                try {
                    this.triggerFileDownload(togpx(geojsonData), 'exported_features.gpx', 'application/gpx+xml');
                } catch (err) { alert("GPX creation error: " + err); }
                break;
            case 'shp':
                try {
                    shpwrite.download(geojsonData, {
                        folder: 'exported_shapefiles',
                        types: { point: 'points', polygon: 'polygons', line: 'lines' }
                    });
                } catch (err) { alert("Shapefile creation error: " + err.message); }
                break;
        }
    },

    triggerFileDownload(content, filename, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
};

// --- 3. Single Execution Hook ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AppState.initAll());
} else {
    AppState.initAll();
}
}