// Remember to add Leaflet CSS and JavaScript to your main application's host page (e.g., index.html or _Host.cshtml).
// Example for index.html:
// <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
// <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>

window.leafletInterop = {
    map: null,
    markers: {},

    initMap: function (mapElementId, latitude, longitude, zoom) {
        if (this.map !== null) {
            this.map.remove();
        }
        this.map = L.map(mapElementId).setView([latitude, longitude], zoom);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.map);
    },

    updateMarkers: function (units) {
        if (this.map === null) {
            console.error("Map not initialized.");
            return;
        }

        // Clear existing markers that are no longer in the units list
        for (let unitId in this.markers) {
            if (!units.some(u => u.id === unitId)) {
                this.map.removeLayer(this.markers[unitId]);
                delete this.markers[unitId];
            }
        }

        units.forEach(unit => {
            if (unit.currentLatitude && unit.currentLongitude) {
                let latlng = [unit.currentLatitude, unit.currentLongitude];
                let popupContent = `<b>${unit.unitNumber} - ${unit.unitType}</b><br>` +
                                   `Officer: ${unit.assignedOfficer}<br>` +
                                   `Status: ${unit.status}<br>` +
                                   `Location: ${unit.currentLocation || 'N/A'}`;

                if (this.markers[unit.id]) {
                    // Update existing marker position and popup
                    this.markers[unit.id].setLatLng(latlng);
                    this.markers[unit.id].setPopupContent(popupContent);
                } else {
                    // Create new marker
                    let marker = L.marker(latlng).addTo(this.map);
                    marker.bindPopup(popupContent);
                    this.markers[unit.id] = marker;
                }
            }
        });
    },

    clearMarkers: function () {
        for (let unitId in this.markers) {
            this.map.removeLayer(this.markers[unitId]);
        }
        this.markers = {};
    },

    disposeMap: function () {
        if (this.map !== null) {
            this.map.remove();
            this.map = null;
            this.markers = {};
        }
    }
};