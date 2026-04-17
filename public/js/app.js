/**
 * AgroAnalytics - Smart Dashboard Logic
 * Archivo: app.js
 */

window.App = {
    map: null,
    markersLayer: null,
    rawData: [], // All data from JSON
    filteredData: [], // Currenly displayed data
    
    // Filters state
    filters: {
        estado: 'all',
        municipio: 'all',
        cultivo: null // Card-based filter
    },

    // UI Configuration
    MEXICO_CENTER: [23.6345, -102.5528],
    DEFAULT_ZOOM: 5,

    init: async function() {
        this.initClock();
        this.initMap();
        await this.loadData();
    },

    initClock: function() {
        const timeEl = document.getElementById('realtimeClock');
        const dateEl = document.getElementById('realtimeDate');
        
        const updateTick = () => {
            const now = new Date();
            timeEl.textContent = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
            dateEl.textContent = now.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        };
        updateTick();
        setInterval(updateTick, 1000);
    },

    initMap: function() {
        try {
            this.map = L.map('map', {
                zoomControl: false // Move zoom control strategy if needed, else auto
            }).setView(this.MEXICO_CENTER, this.DEFAULT_ZOOM);

            L.control.zoom({ position: 'bottomright' }).addTo(this.map);

            // Positron basemap (clean, grey-scale, premium feel)
            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
            }).addTo(this.map);

            this.markersLayer = L.layerGroup().addTo(this.map);
        } catch (e) {
            console.error("Error al inicializar el mapa:", e);
        }
    },

    loadData: async function() {
        try {
            // Strategy: Safe Resolver
            const response = await fetch('data/escuelas.json');
            if (!response.ok) throw new Error("Recurso no encontrado");
            this.rawData = await response.json();
            
            // Remove Loader
            const loader = document.getElementById('mapLoader');
            if (loader) loader.style.opacity = '0';
            setTimeout(() => loader && loader.remove(), 500);

            this.populateStateSelect();
            this.updateKPIs();
            this.applyFilters(); // Initial render

        } catch (err) {
            console.error("Fallo al cargar datos (Fall-safe activado):", err);
            document.getElementById('mapLoader').innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Error al cargar conexión (${err.message})`;
        }
    },

    populateStateSelect: function() {
        const stateSel = document.getElementById('stateSelect');
        const states = [...new Set(this.rawData.map(item => item.estado))]
                        .filter(e => e)
                        .sort();
        
        stateSel.innerHTML = '<option value="all">Todos los Estados</option>';
        states.forEach(st => {
            const opt = document.createElement('option');
            opt.value = st;
            opt.textContent = st;
            stateSel.appendChild(opt);
        });
    },

    onStateChange: function() {
        const stateStr = document.getElementById('stateSelect').value;
        this.filters.estado = stateStr;
        
        // Cascading filter: update municipios
        const muniSel = document.getElementById('muniSelect');
        muniSel.innerHTML = '<option value="all">Todos los Municipios</option>';
        this.filters.municipio = 'all';

        if (stateStr !== 'all') {
            // Fill municipos for state
            const munis = [...new Set(this.rawData
                .filter(i => i.estado === stateStr)
                .map(i => i.municipio))]
                .filter(m => m)
                .sort();
            
            munis.forEach(mu => {
                const opt = document.createElement('option');
                opt.value = mu;
                opt.textContent = mu;
                muniSel.appendChild(opt);
            });
        }
        
        this.applyFilters();
    },

    toggleCardFilter: function(cultivo) {
        // Toggle logic
        if (this.filters.cultivo === cultivo) {
            // Disable
            this.filters.cultivo = null;
        } else {
            // Enable (Single active mode)
            this.filters.cultivo = cultivo;
        }

        // Update UI styles
        document.querySelectorAll('.kpi-card').forEach(c => {
            if (c.getAttribute('data-filter') === this.filters.cultivo) {
                c.classList.add('active');
            } else {
                c.classList.remove('active');
            }
        });

        this.applyFilters();
    },

    resetFilters: function() {
        try {
            document.getElementById('stateSelect').value = 'all';
            document.getElementById('muniSelect').value = 'all';
            
            this.filters.estado = 'all';
            this.filters.municipio = 'all';
            this.filters.cultivo = null;

            document.querySelectorAll('.kpi-card').forEach(c => c.classList.remove('active'));

            this.onStateChange(); // Forces re-render and UI re-sync
        } catch(e){
            console.error(e);
        }
    },

    applyFilters: function() {
        if(!this.rawData || !this.map) return;

        // 1. Refresh filters from DOM just in case (Smart Filters)
        this.filters.municipio = document.getElementById('muniSelect').value;

        // 2. Perform filtering filtering
        this.filteredData = this.rawData.filter(item => {
            const matchState = this.filters.estado === 'all' || item.estado === this.filters.estado;
            const matchMuni = this.filters.municipio === 'all' || item.municipio === this.filters.municipio;
            
            let matchCultivo = true;
            if (this.filters.cultivo !== null) {
                const c = (item.cultivo || "").toUpperCase();
                if (this.filters.cultivo === 'MAIZ') matchCultivo = c.startsWith('MA');
                else if (this.filters.cultivo === 'CAFE') matchCultivo = c.startsWith('CAF');
                else matchCultivo = c.includes(this.filters.cultivo);
            }

            return matchState && matchMuni && matchCultivo;
        });

        // 3. Update DOM Totals
        document.getElementById('summaryTotal').textContent = this.filteredData.length.toLocaleString();

        // 4. Render map markers
        this.renderMap();
        
        // 5. Dynamic Smart zoom
        this.updateMapZoom();
    },

    updateKPIs: function() {
        // Count for KPI cards statically (base dataset) or dynamic based on other filters?
        // Skill request implies counting for initial view, so base dataset is fine.
        const counts = {
            'MAIZ': 0, 'CAFE': 0, 'MIEL': 0, 'MILPA': 0, 'LECHE': 0
        };

        this.rawData.forEach(item => {
            if (!item.cultivo) return;
            const c = item.cultivo.toUpperCase();
            if (c.startsWith('MA')) counts['MAIZ']++;
            else if (c.startsWith('CAF')) counts['CAFE']++;
            else if (c.startsWith('MIEL')) counts['MIEL']++;
            else if (c.startsWith('MILPA')) counts['MILPA']++;
            else if (c.startsWith('LECHE')) counts['LECHE']++;
        });

        document.getElementById('kpi-maiz').textContent = counts['MAIZ'].toLocaleString();
        document.getElementById('kpi-cafe').textContent = counts['CAFE'].toLocaleString();
        document.getElementById('kpi-miel').textContent = counts['MIEL'].toLocaleString();
        document.getElementById('kpi-milpa').textContent = counts['MILPA'].toLocaleString();
        document.getElementById('kpi-leche').textContent = counts['LECHE'].toLocaleString();
    },

    renderMap: function() {
        this.markersLayer.clearLayers();

        // Color mapping
        const getColor = (cult) => {
            if (!cult) return '#64748b';
            const c = cult.toUpperCase();
            if(c.startsWith('MA')) return '#F59E0B';
            if(c.startsWith('CAF')) return '#6F4E37';
            if(c.startsWith('MIEL')) return '#FBBF24';
            if(c.startsWith('MILPA')) return '#10B981';
            if(c.startsWith('LECHE')) return '#3B82F6';
            return '#64748b'; // Gray
        };

        this.filteredData.forEach(item => {
            const popupContent = `
                <h3>🌱 ${item.cultivo}</h3>
                <p><strong>Ubicación:</strong> ${item.municipio}, ${item.estado}</p>
                <p><strong>Técnico:</strong> <i class="fa-solid fa-user-tie"></i> ${item.tecnico}</p>
                <p><strong>ID Interno:</strong> #${item.id}</p>
            `;

            const marker = L.circleMarker([item.lat, item.lng], {
                radius: 6,
                fillColor: getColor(item.cultivo),
                color: '#ffffff',
                weight: 1,
                opacity: 1,
                fillOpacity: 0.8
            });

            marker.bindPopup(popupContent);
            this.markersLayer.addLayer(marker);
        });
    },

    updateMapZoom: function() {
        // Logic for Smart Geographic Filters zoom
        if (this.filters.estado === 'all') {
            this.map.flyTo(this.MEXICO_CENTER, this.DEFAULT_ZOOM, { duration: 1.5 });
            return;
        }

        if (this.filteredData.length === 0) return;

        // Calculate Average
        let sumLat = 0; let sumLng = 0;
        this.filteredData.forEach(i => {
            sumLat += i.lat;
            sumLng += i.lng;
        });
        const center = [sumLat / this.filteredData.length, sumLng / this.filteredData.length];
        
        let targetZoom = 7; // State level
        if (this.filters.municipio !== 'all') {
            targetZoom = 10; // Muni level
        }

        this.map.flyTo(center, targetZoom, { duration: 1.5 });
    }
};

// Start application
document.addEventListener('DOMContentLoaded', () => {
    window.App.init();
});
