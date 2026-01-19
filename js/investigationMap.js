// wwwroot/js/leafletwrapper.js
let map;
let crimeHeatmap;
let patrolLayer;
let investigationMarkers = L.featureGroup();
let directionArrows = L.featureGroup();
let boundaryLayers = {};

// Extended Leaflet wrapper exports
let baseLayers = {};
let currentBaseLayer = 'osm';
let miniMapControl = null;
let drawControl;
let drawEnabled;
let drawnItems = L.featureGroup();

// Check if heatmap plugin is available
const heatmapAvailable = typeof L.heatLayer !== 'undefined';

// Initialize the map
export function initializeMap(elementId, centerLat, centerLng, zoomLevel) {
    map = L.map(elementId).setView([centerLat, centerLng], zoomLevel);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(map);

    // Initialize layer groups
    investigationMarkers.addTo(map);
    directionArrows.addTo(map);

    return map;
}

// Create map (from extended wrapper)
export function createMap(elementId, lat, lng, zoom) {
    map = L.map(elementId).setView([lat, lng], zoom);

    // Create base layers
    baseLayers.osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    baseLayers.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri, Maxar, Earthstar Geographics, and the GIS User Community'
    });

    // Add layer control
    L.control.layers({
        "OpenStreetMap": baseLayers.osm,
        "Satellite": baseLayers.satellite
    }).addTo(map);

    return map;
}

// Basic map functions
export function setMapType(mapType) {
    if (baseLayers[currentBaseLayer]) {
        map.removeLayer(baseLayers[currentBaseLayer]);
    }

    if (baseLayers[mapType]) {
        map.addLayer(baseLayers[mapType]);
        currentBaseLayer = mapType;
    }
}

export function addMarker(lat, lng, popupText) {
    const marker = L.marker([lat, lng]).addTo(map);
    if (popupText) marker.bindPopup(popupText).openPopup();
    return marker;
}

export function addCircle(lat, lng, radius, options = {}) {
    const circle = L.circle([lat, lng], {
        radius: radius,
        color: options.color || 'red',
        fillColor: options.fillColor || '#f03',
        fillOpacity: options.fillOpacity || 0.5,
        weight: options.weight || 2,
        ...options
    }).addTo(map);
    return circle;
}

export function addPolygon(latLngs, options = {}) {
    const polygon = L.polygon(latLngs, {
        color: options.color || 'blue',
        fillColor: options.fillColor || options.color || 'blue',
        fillOpacity: options.fillOpacity || 0.5,
        weight: options.weight || 2,
        ...options
    }).addTo(map);
    return polygon;
}

export function addPolyline(latLngs, options = {}) {
    const polyline = L.polyline(latLngs, {
        color: options.color || 'green',
        weight: options.weight || 3,
        ...options
    }).addTo(map);
    return polyline;
}

export function addStructure(latLngs, color = 'blue', borderWidth = 2, options = {}) {
    const structure = L.polygon(latLngs, {
        color: color,
        weight: borderWidth,
        fillColor: color,
        fillOpacity: options.fillOpacity || 0.5,
        opacity: options.opacity || 1.0,
        ...options
    }).addTo(map);

    return structure;
}

export function addRectangleStructure(bounds, color = 'blue', borderWidth = 2, options = {}) {
    const rectangle = L.rectangle(bounds, {
        color: color,
        weight: borderWidth,
        fillColor: color,
        fillOpacity: options.fillOpacity || 0.5,
        opacity: options.opacity || 1.0,
        ...options
    }).addTo(map);

    return rectangle;
}

export function addGeoJson(geoJsonData, options = {}) {
    const geoJsonLayer = L.geoJSON(geoJsonData, {
        style: options.style || { color: 'purple' },
        onEachFeature: options.onEachFeature,
        ...options
    }).addTo(map);
    return geoJsonLayer;
}

export function addGeoJsonWithPopup(geoJsonData, popupTemplate) {
    return L.geoJSON(geoJsonData, {
        onEachFeature: function (feature, layer) {
            if (feature.properties && popupTemplate) {
                let popupContent = popupTemplate;
                for (const prop in feature.properties) {
                    popupContent = popupContent.replace(`{${prop}}`, feature.properties[prop]);
                }
                layer.bindPopup(popupContent);
            }
        }
    }).addTo(map);
}

export function removeLayer(layer) {
    map.removeLayer(layer);
}

export function clearMap() {
    map.eachLayer(layer => {
        if (!layer._url && !baseLayers.osm && !baseLayers.satellite) {
            map.removeLayer(layer);
        }
    });
}

// Investigation-specific functions (define these BEFORE they're used in patrol routes)
export function addInvestigationLocation(lat, lng, title, description, type = 'crime-scene', color = '#ff0000') {
    const icon = createInvestigationIcon(type, color);

    const marker = L.marker([lat, lng], { icon: icon }).addTo(investigationMarkers);

    const popupContent = `
        <div class="investigation-popup">
            <h4>${title}</h4>
            <p>${description}</p>
            <div style="display: flex; justify-content: space-between; margin-top: 10px;">
                <span class="badge" style="background: ${color};">${type}</span>
                <small>${new Date().toLocaleString()}</small>
            </div>
        </div>
    `;

    marker.bindPopup(popupContent);

    marker.investigationData = {
        title,
        description,
        type,
        color,
        timestamp: new Date().toISOString()
    };

    return marker;
}

// Create directional arrow between points
export function addDirectionArrow(fromLat, fromLng, toLat, toLng, label = '', color = '#ff0000') {
    const fromPoint = L.latLng(fromLat, fromLng);
    const toPoint = L.latLng(toLat, toLng);

    // Calculate bearing for arrow direction
    const bearing = calculateBearing(fromLat, fromLng, toLat, toLng);

    // Create arrow line
    const arrow = L.polyline([fromPoint, toPoint], {
        color: color,
        weight: 3,
        opacity: 0.7,
        dashArray: '5, 5'
    }).addTo(directionArrows);

    // Add arrowhead
    const arrowhead = createArrowhead(toPoint, bearing, color, 12);
    arrowhead.addTo(directionArrows);

    // Add label if provided
    if (label) {
        const midPoint = calculateMidpoint(fromPoint, toPoint);
        const labelMarker = L.marker(midPoint, {
            icon: L.divIcon({
                className: 'direction-label',
                html: `
                    <div style="
                        background: white; 
                        padding: 2px 6px; 
                        border: 2px solid ${color};
                        border-radius: 4px; 
                        font-size: 10px;
                        font-weight: bold;
                        color: ${color};
                    ">${label}</div>
                `,
                iconSize: [null, null],
                iconAnchor: [0, 0]
            })
        }).addTo(directionArrows);
    }

    return { arrow, arrowhead, bearing };
}

// Add investigation zone (radius area)
export function addInvestigationZone(lat, lng, radius, label, color = '#ff0000') {
    const zone = L.circle([lat, lng], {
        radius: radius,
        color: color,
        fillColor: color,
        fillOpacity: 0.1,
        weight: 2
    }).addTo(map);

    const marker = L.marker([lat, lng], {
        icon: L.divIcon({
            className: 'zone-marker',
            html: `
                <div style="
                    background: ${color}; 
                    color: white; 
                    padding: 4px 8px; 
                    border-radius: 4px; 
                    font-size: 11px;
                    font-weight: bold;
                    border: 2px solid white;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                ">${label}</div>
            `,
            iconSize: [null, null],
            iconAnchor: [0, 0]
        })
    }).addTo(investigationMarkers);

    zone.bindPopup(`
        <div class="zone-popup">
            <h4>${label}</h4>
            <p>Investigation Zone</p>
            <p><strong>Radius:</strong> ${radius.toLocaleString()} meters</p>
        </div>
    `);

    return { zone, marker };
}

// Clear all investigation data
export function clearInvestigationData() {
    investigationMarkers.clearLayers();
    directionArrows.clearLayers();
}

// Heatmap functions
export function addCrimeHeatmap(heatmapData) {
    // Remove existing heatmap
    if (crimeHeatmap) {
        map.removeLayer(crimeHeatmap);
    }

    if (!heatmapAvailable) {
        console.warn('Leaflet.heat plugin not available. Using circle markers as fallback.');
        return addCrimeHeatmapFallback(heatmapData);
    }

    if (heatmapData && heatmapData.length > 0) {
        const points = heatmapData.map(point => [point.latitude, point.longitude, point.intensity || 1]);

        crimeHeatmap = L.heatLayer(points, {
            radius: 25,
            blur: 15,
            maxZoom: 17,
            gradient: {
                0.2: 'blue',
                0.4: 'cyan',
                0.6: 'lime',
                0.8: 'yellow',
                1.0: 'red'
            }
        }).addTo(map);

        return crimeHeatmap;
    }

    return null;
}

// Fallback function if heatmap plugin is not available
function addCrimeHeatmapFallback(heatmapData) {
    if (!heatmapData || heatmapData.length === 0) return null;

    const heatmapLayer = L.layerGroup().addTo(map);

    heatmapData.forEach(point => {
        const intensity = point.intensity || 1;
        const radius = Math.max(5, intensity * 10);
        const opacity = Math.min(0.7, intensity * 0.3);

        L.circle([point.latitude, point.longitude], {
            radius: radius,
            color: getHeatColor(intensity),
            fillColor: getHeatColor(intensity),
            fillOpacity: opacity,
            weight: 1
        }).addTo(heatmapLayer);
    });

    crimeHeatmap = heatmapLayer;
    return crimeHeatmap;
}

// Helper function for heatmap colors
function getHeatColor(intensity) {
    if (intensity >= 0.8) return '#ff0000'; // Red
    if (intensity >= 0.6) return '#ffff00'; // Yellow
    if (intensity >= 0.4) return '#00ff00'; // Green
    if (intensity >= 0.2) return '#00ffff'; // Cyan
    return '#0000ff'; // Blue
}

// Check if heatmap is available
export function isHeatmapAvailable() {
    return heatmapAvailable;
}

// Add patrol routes with investigation features (this comes AFTER addDirectionArrow is defined)
export function addPatrolRoutes(patrols) {
    // Remove existing patrol layer
    if (patrolLayer) {
        map.removeLayer(patrolLayer);
    }

    patrolLayer = L.layerGroup().addTo(map);

    patrols.forEach(patrol => {
        if (patrol.patrolPoints && patrol.patrolPoints.length > 0) {
            // Create patrol route line
            const routePoints = patrol.patrolPoints.map(point => [point.latitude, point.longitude]);
            const polyline = L.polyline(routePoints, {
                color: getStatusColor(patrol.status),
                weight: 4,
                opacity: 0.7,
                dashArray: patrol.status === 'Active' ? null : '5, 10'
            }).addTo(patrolLayer);

            // Add investigation markers for patrol points
            patrol.patrolPoints.forEach((point, index) => {
                if (point.activity !== 'Patrol') {
                    addInvestigationLocation(
                        point.latitude,
                        point.longitude,
                        `${patrol.officerName} - ${point.activity}`,
                        point.notes || `Patrol activity at ${new Date(point.timestamp).toLocaleString()}`,
                        getActivityType(point.activity),
                        getStatusColor(patrol.status)
                    );
                }
            });

            // Add directional arrows for patrol route
            if (routePoints.length > 1) {
                for (let i = 0; i < routePoints.length - 1; i++) {
                    addDirectionArrow(
                        routePoints[i][0], routePoints[i][1],
                        routePoints[i + 1][0], routePoints[i + 1][1],
                        i === 0 ? `Patrol: ${patrol.officerName}` : '',
                        getStatusColor(patrol.status)
                    );
                }
            }

            // Bind popup with patrol information
            polyline.bindPopup(`
                <div class="patrol-popup">
                    <h4>${patrol.officerName}</h4>
                    <p><strong>Status:</strong> ${patrol.status}</p>
                    <p><strong>Type:</strong> ${patrol.patrolType}</p>
                    <p><strong>Distance:</strong> ${patrol.distanceCovered} km</p>
                    <p><strong>Incidents:</strong> ${patrol.incidentsResponded}</p>
                </div>
            `);
        }
    });
}

// Drawing Tools with parameter support
export function initDrawTools(lineColor = '#3388ff', fillColor = '#3388ff', lineWeight = 2) {
    // Clear existing drawn items if any
    if (drawnItems) {
        map.removeLayer(drawnItems);
    }

    drawnItems = L.featureGroup().addTo(map);

    // Remove existing draw control if any
    if (drawControl) {
        map.removeControl(drawControl);
    }

    drawControl = new L.Control.Draw({
        position: 'topright',
        draw: {
            polygon: {
                shapeOptions: {
                    color: lineColor,
                    fillColor: fillColor,
                    weight: lineWeight,
                    fillOpacity: 0.2
                }
            },
            polyline: {
                shapeOptions: {
                    color: lineColor,
                    weight: lineWeight
                }
            },
            rectangle: {
                shapeOptions: {
                    color: lineColor,
                    fillColor: fillColor,
                    weight: lineWeight,
                    fillOpacity: 0.2
                }
            },
            circle: {
                shapeOptions: {
                    color: lineColor,
                    fillColor: fillColor,
                    weight: lineWeight,
                    fillOpacity: 0.2
                }
            },
            marker: {
                icon: L.icon({
                    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41]
                })
            }
        },
        edit: {
            featureGroup: drawnItems
        }
    }).addTo(map);

    drawEnabled = true;

    // Clear previous event listeners
    map.off(L.Draw.Event.CREATED);

    map.on(L.Draw.Event.CREATED, function (e) {
        const layer = e.layer;
        drawnItems.addLayer(layer);
    });
}

// Advanced configuration function
export function initDrawToolsAdvanced(options) {
    const defaultOptions = {
        lineColor: '#3388ff',
        fillColor: '#3388ff',
        lineWeight: 2,
        fillOpacity: 0.2,
        position: 'topright',
        enablePolygon: true,
        enablePolyline: true,
        enableRectangle: true,
        enableCircle: true,
        enableMarker: true
    };

    const config = { ...defaultOptions, ...options };

    // Clear existing
    if (drawnItems) {
        map.removeLayer(drawnItems);
    }
    drawnItems = L.featureGroup().addTo(map);

    if (drawControl) {
        map.removeControl(drawControl);
    }

    const drawConfig = {
        position: config.position,
        draw: {},
        edit: {
            featureGroup: drawnItems
        }
    };

    if (config.enablePolygon) {
        drawConfig.draw.polygon = {
            shapeOptions: {
                color: config.lineColor,
                fillColor: config.fillColor,
                weight: config.lineWeight,
                fillOpacity: config.fillOpacity
            }
        };
    }

    if (config.enablePolyline) {
        drawConfig.draw.polyline = {
            shapeOptions: {
                color: config.lineColor,
                weight: config.lineWeight
            }
        };
    }

    if (config.enableRectangle) {
        drawConfig.draw.rectangle = {
            shapeOptions: {
                color: config.lineColor,
                fillColor: config.fillColor,
                weight: config.lineWeight,
                fillOpacity: config.fillOpacity
            }
        };
    }

    if (config.enableCircle) {
        drawConfig.draw.circle = {
            shapeOptions: {
                color: config.lineColor,
                fillColor: config.fillColor,
                weight: config.lineWeight,
                fillOpacity: config.fillOpacity
            }
        };
    }

    if (config.enableMarker) {
        drawConfig.draw.marker = {
            icon: L.icon({
                iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41]
            })
        };
    }

    drawControl = new L.Control.Draw(drawConfig).addTo(map);

    drawEnabled = true;

    map.off(L.Draw.Event.CREATED);
    map.on(L.Draw.Event.CREATED, function (e) {
        const layer = e.layer;
        drawnItems.addLayer(layer);
    });
}

export function updateDrawToolsStyle(lineColor, fillColor, lineWeight, fillOpacity = 0.2) {
    // Reinitialize with new styles
    initDrawTools(lineColor, fillColor, lineWeight);
}

export function enableDrawing() {
    if (!drawControl) return;
    if (!drawEnabled) {
        drawControl.addTo(map);
        drawEnabled = true;
    }
}

export function disableDrawing() {
    if (!drawControl) return;
    if (drawEnabled) {
        drawControl.remove();
        drawEnabled = false;
    }
}

export function clearAllDrawn() {
    drawnItems.clearLayers();
}

export function getDrawnGeoJson() {
    return JSON.stringify(drawnItems.toGeoJSON());
}

export function addDrawnFromGeoJson(geoJson) {
    L.geoJSON(geoJson, {
        onEachFeature: function (feature, layer) {
            drawnItems.addLayer(layer);
        }
    });
}

// MiniMap functions
export function addMiniMap(miniMapLayerUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', options = {}) {
    // Remove existing miniMap if any
    if (miniMapControl) {
        map.removeControl(miniMapControl);
    }

    const defaultOptions = {
        toggleDisplay: true,
        position: 'bottomright',
        width: 150,
        height: 150,
        collapsedWidth: 19,
        collapsedHeight: 19,
        zoomLevelOffset: -5,
        zoomLevelFixed: false,
        centerFixed: false,
        zoomAnimation: true,
        autoToggleDisplay: false,
        minimized: false,
        strings: { hideText: 'Hide MiniMap', showText: 'Show MiniMap' }
    };

    const config = { ...defaultOptions, ...options };

    const mbAttr = '© OpenStreetMap contributors';
    const miniMapLayer = new L.TileLayer(miniMapLayerUrl, {
        minZoom: 0,
        maxZoom: 13,
        attribution: mbAttr
    });

    miniMapControl = new L.Control.MiniMap(miniMapLayer, config).addTo(map);
    return miniMapControl;
}

export function removeMiniMap() {
    if (miniMapControl) {
        map.removeControl(miniMapControl);
        miniMapControl = null;
    }
}

export function toggleMiniMap() {
    if (miniMapControl) {
        miniMapControl._toggleDisplay();
    }
}

// Map interaction functions
export function setupMapClick(dotNetReference) {
    map.on('click', function (e) {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        dotNetReference.invokeMethodAsync('OnMapClick', lat, lng);
    });
}

export function fitBounds(north, south, east, west) {
    const bounds = L.latLngBounds(
        L.latLng(south, west),
        L.latLng(north, east)
    );
    map.fitBounds(bounds);
}

export function setView(lat, lng, zoom) {
    map.setView([lat, lng], zoom);
}

// Boundary layer functions
export function addBoundaryLayer(boundaries, boundaryType) {
    // Remove existing boundary layer
    if (boundaryLayers[boundaryType]) {
        map.removeLayer(boundaryLayers[boundaryType]);
    }

    const boundaryLayer = L.layerGroup().addTo(map);
    boundaryLayers[boundaryType] = boundaryLayer;

    boundaries.forEach(boundary => {
        const circle = L.circle([boundary.centerLat, boundary.centerLng], {
            radius: boundary.type === 'Province' ? 50000 :
                boundary.type === 'District' ? 20000 :
                    boundary.type === 'Ward' ? 5000 : 1000,
            color: getRiskColor(boundary.riskScore),
            fillColor: getRiskColor(boundary.riskScore),
            fillOpacity: 0.2,
            weight: 2
        }).addTo(boundaryLayer);

        circle.bindPopup(`
            <div class="boundary-popup">
                <h4>${boundary.name}</h4>
                <p><strong>Type:</strong> ${boundary.type}</p>
                <p><strong>Crime Count:</strong> ${boundary.crimeCount}</p>
                <p><strong>Risk Score:</strong> ${boundary.riskScore}/100</p>
                <p><strong>Population:</strong> ${boundary.population?.toLocaleString()}</p>
            </div>
        `);
    });
}

export function removeBoundaryLayer(layerType) {
    if (boundaryLayers[layerType]) {
        map.removeLayer(boundaryLayers[layerType]);
        delete boundaryLayers[layerType];
    }
}

// Helper functions (private)
function createInvestigationIcon(type, color) {
    const iconColors = {
        'crime-scene': '#dc3545',
        'evidence': '#007bff',
        'witness': '#28a745',
        'suspect': '#ffc107',
        'patrol-stop': '#6f42c1',
        'incident': '#fd7e14'
    };

    const finalColor = iconColors[type] || color;

    return L.divIcon({
        className: `investigation-icon ${type}`,
        html: `
            <div style="
                background: ${finalColor};
                width: 20px;
                height: 20px;
                border: 3px solid white;
                border-radius: 50%;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            "></div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
}

function calculateBearing(fromLat, fromLng, toLat, toLng) {
    const φ1 = fromLat * Math.PI / 180;
    const φ2 = toLat * Math.PI / 180;
    const Δλ = (toLng - fromLng) * Math.PI / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);

    return (θ * 180 / Math.PI + 360) % 360;
}

function createArrowhead(point, bearing, color, size) {
    return L.marker(point, {
        icon: L.divIcon({
            className: 'arrowhead',
            html: `
                <div style="
                    width: 0; 
                    height: 0; 
                    border-left: ${size / 2}px solid transparent;
                    border-right: ${size / 2}px solid transparent;
                    border-bottom: ${size}px solid ${color};
                    transform: rotate(${bearing}deg);
                "></div>
            `,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2]
        })
    });
}

function calculateMidpoint(point1, point2) {
    return L.latLng(
        (point1.lat + point2.lat) / 2,
        (point1.lng + point2.lng) / 2
    );
}

function getStatusColor(status) {
    const colors = {
        'Active': '#28a745',
        'Completed': '#6c757d',
        'Investigating': '#ffc107',
        'Critical': '#dc3545'
    };
    return colors[status] || '#007bff';
}

function getActivityType(activity) {
    const types = {
        'Traffic Stop': 'patrol-stop',
        'Incident Response': 'incident',
        'Investigation': 'crime-scene'
    };
    return types[activity] || 'evidence';
}

function getRiskColor(riskScore) {
    if (riskScore >= 80) return '#dc3545';
    if (riskScore >= 60) return '#fd7e14';
    if (riskScore >= 40) return '#ffc107';
    if (riskScore >= 20) return '#28a745';
    return '#6c757d';
}