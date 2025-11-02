// wwwroot/js/leafletwrapper.js
let map;
let crimeHeatmap;
let patrolLayer;
let investigationMarkers = L.featureGroup();
let directionArrows = L.featureGroup();
let boundaryLayers = {};

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
}

// Add crime heatmap
export function addCrimeHeatmap(heatmapData) {
    // Remove existing heatmap
    if (crimeHeatmap) {
        map.removeLayer(crimeHeatmap);
    }

    if (heatmapData && heatmapData.length > 0) {
        const points = heatmapData.map(point => [point.latitude, point.longitude, point.intensity]);
        
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
    }
}

// Add patrol routes with investigation features
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

// Add investigation location with custom styling
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
    
    // Store investigation metadata
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

// Fit map to bounds
export function fitBounds(north, south, east, west) {
    const bounds = L.latLngBounds(
        L.latLng(south, west),
        L.latLng(north, east)
    );
    map.fitBounds(bounds);
}

// Set map view
export function setView(lat, lng, zoom) {
    map.setView([lat, lng], zoom);
}

// Add boundary layer for administrative areas
export function addBoundaryLayer(boundaries, boundaryType) {
    // Remove existing boundary layer
    if (boundaryLayers[boundaryType]) {
        map.removeLayer(boundaryLayers[boundaryType]);
    }

    const boundaryLayer = L.layerGroup().addTo(map);
    boundaryLayers[boundaryType] = boundaryLayer;

    boundaries.forEach(boundary => {
        // Create a simple circle for demonstration (in real app, use actual boundary coordinates)
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

// Remove specific layer
export function removeLayer(layerType) {
    if (boundaryLayers[layerType]) {
        map.removeLayer(boundaryLayers[layerType]);
        delete boundaryLayers[layerType];
    }
}

// Helper function to create investigation icons
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

// Calculate bearing between two points
function calculateBearing(fromLat, fromLng, toLat, toLng) {
    const φ1 = fromLat * Math.PI / 180;
    const φ2 = toLat * Math.PI / 180;
    const Δλ = (toLng - fromLng) * Math.PI / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);

    return (θ * 180 / Math.PI + 360) % 360;
}

// Create arrowhead marker
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

// Calculate midpoint between two points
function calculateMidpoint(point1, point2) {
    return L.latLng(
        (point1.lat + point2.lat) / 2,
        (point1.lng + point2.lng) / 2
    );
}

// Helper function to get status color
function getStatusColor(status) {
    const colors = {
        'Active': '#28a745',
        'Completed': '#6c757d',
        'Investigating': '#ffc107',
        'Critical': '#dc3545'
    };
    return colors[status] || '#007bff';
}

// Helper function to get activity type
function getActivityType(activity) {
    const types = {
        'Traffic Stop': 'patrol-stop',
        'Incident Response': 'incident',
        'Investigation': 'crime-scene'
    };
    return types[activity] || 'evidence';
}

// Helper function to get risk color
function getRiskColor(riskScore) {
    if (riskScore >= 80) return '#dc3545';
    if (riskScore >= 60) return '#fd7e14';
    if (riskScore >= 40) return '#ffc107';
    if (riskScore >= 20) return '#28a745';
    return '#6c757d';
}