import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import Navigation from './Navigation';
import './NEOAnalysis.css';

// Fix Leaflet default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  iconUrl: '/leaflet/marker-icon.png',
  shadowUrl: '/leaflet/marker-shadow.png',
});

// Custom impact marker
const impactIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxOCIgc3Ryb2tlPSIjZmYwMDAwIiBzdHJva2Utd2lkdGg9IjMiIGZpbGw9InJnYmEoMjU1LDAsMCwwLjIpIi8+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iNiIgZmlsbD0iI2ZmMDAwMCIvPjwvc3ZnPg==',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20]
});

function LocationMarker({ position, onPositionChange, isLocked }) {
  useMapEvents({
    click(e) {
      // Only allow changing location if NOT locked (before launch or after reset)
      if (!isLocked) {
        onPositionChange(e.latlng);
      }
    },
  });

  return position === null ? null : (
    <Marker position={position} icon={impactIcon}>
      <Popup>
        <div className="impact-popup">
          <strong>Impact Location</strong>
          <p>Lat: {position.lat.toFixed(4)}°</p>
          <p>Lng: {position.lng.toFixed(4)}°</p>
        </div>
      </Popup>
    </Marker>
  );
}

function SimulationPage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [asteroidData, setAsteroidData] = useState({
    diameter: 1000, // feet
    speed: 38000, // mph
    angle: 45, // degrees
    type: 'Rocky'
  });

  const [impactLocation, setImpactLocation] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [asteroidList, setAsteroidList] = useState([]);
  const [currentAsteroidIndex, setCurrentAsteroidIndex] = useState(0);
  const [selectedAsteroid, setSelectedAsteroid] = useState(null);
  const [loadingAsteroids, setLoadingAsteroids] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredAsteroids, setFilteredAsteroids] = useState([]);
  const mapRef = useRef(null);

  const densityMap = {
    'Rocky': 3000,
    'Comet': 1000,
    'Iron': 8000
  };

  // Page load animation
  useEffect(() => {
    setTimeout(() => setIsLoaded(true), 100);
  }, []);

  // Fetch NASA asteroids
  useEffect(() => {
    fetchAsteroids();
  }, []);

  // Filter asteroids based on search query
  useEffect(() => {
    if (asteroidList.length > 0) {
      if (searchQuery.trim() === '') {
        setFilteredAsteroids(asteroidList);
      } else {
        const filtered = asteroidList.filter(asteroid =>
          asteroid.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          asteroid.id.toString().includes(searchQuery)
        );
        setFilteredAsteroids(filtered);
        // Reset to first result when search changes
        if (filtered.length > 0) {
          setCurrentAsteroidIndex(0);
          setSelectedAsteroid(filtered[0]);
        }
      }
    }
  }, [searchQuery, asteroidList]);

  // Update asteroid data when selection changes
  useEffect(() => {
    if (asteroidList.length > 0 && selectedAsteroid) {
      console.log('Selected asteroid data:', selectedAsteroid);
      
      // Convert NASA data to simulation format
      // Backend returns diameter_km and diameter_max_km
      const diameterKm = selectedAsteroid.diameter_max_km || selectedAsteroid.diameter_km || 1;
      const diameterMeters = diameterKm * 1000; // km to m
      const diameterFeet = Math.round(diameterMeters * 3.28084); // m to ft
      
      // Backend returns velocity_kmps for km/s
      const velocityKmps = selectedAsteroid.velocity_kmps || 20; // Default 20 km/s
      const speedMph = Math.round(velocityKmps * 2236.94); // 1 km/s = 2236.94 mph
      
      console.log(`Converting: ${diameterKm} km → ${diameterFeet} ft, ${velocityKmps} km/s → ${speedMph} mph`);
      
      setAsteroidData({
        diameter: diameterFeet,
        speed: speedMph,
        angle: 45, // default angle
        type: selectedAsteroid.is_potentially_hazardous ? 'Iron' : 'Rocky' // hazardous = denser
      });
    }
  }, [selectedAsteroid, asteroidList]);

  const fetchAsteroids = async () => {
    try {
      setLoadingAsteroids(true);
      // Use dynamic API URL - works in both development and production
      const API_BASE_URL = process.env.REACT_APP_API_URL || window.location.origin;
      const apiUrl = API_BASE_URL.includes('localhost:3000') 
        ? 'http://localhost:8000/api/asteroids'
        : `${API_BASE_URL}/api/asteroids`;
      
      console.log('🔗 Fetching from:', apiUrl);
      
      const response = await axios.get(apiUrl, {
        params: {
          hazardous_only: false // Get all asteroids, not just hazardous
        },
        timeout: 30000 // 30 second timeout
      });
      
      console.log('NASA API Response:', response.data);
      
      // Parse response correctly - backend returns { element_count, asteroids: [] }
      if (response.data && response.data.asteroids && response.data.asteroids.length > 0) {
        const asteroidData = response.data.asteroids;
        setAsteroidList(asteroidData);
        setFilteredAsteroids(asteroidData);
        setSelectedAsteroid(asteroidData[0]); // Select first asteroid by default
        console.log('✅ Loaded', asteroidData.length, 'asteroids');
        console.log('First asteroid:', asteroidData[0]);
      } else {
        console.warn('⚠️ No asteroids found in response');
        // Show a user-friendly message
        alert('No asteroid data available at the moment. Please try again later or check your internet connection.');
      }
      setLoadingAsteroids(false);
    } catch (error) {
      console.error('❌ Error fetching asteroids:', error);
      console.error('Error details:', error.response?.data || error.message);
      
      // Show user-friendly error message
      if (error.code === 'ECONNABORTED') {
        alert('Request timeout. The NASA API is taking too long to respond. Please try again.');
      } else if (error.response) {
        alert(`API Error: ${error.response.status}. The asteroid data service is currently unavailable.`);
      } else if (error.request) {
        alert('Network error. Please check your internet connection and try again.');
      } else {
        alert('Failed to fetch asteroid data. Please try again later.');
      }
      
      setLoadingAsteroids(false);
      // Set loading to false even on error so UI doesn't hang
    }
  };

  const calculateImpactEffects = () => {
    const ft_to_m = 0.3048;
    const mph_to_ms = 0.44704;
    const megaton_J = 4.184e15;

    const d_m = asteroidData.diameter * ft_to_m;
    const r_m = d_m / 2;
    const v_ms = asteroidData.speed * mph_to_ms;
    const density = densityMap[asteroidData.type];

    // Mass calculation
    const volume = (4/3) * Math.PI * Math.pow(r_m, 3);
    const mass = density * volume;

    // Kinetic energy
    const E = 0.5 * mass * Math.pow(v_ms, 2);
    const E_megatons = E / megaton_J;

    // Crater diameter scaling
    const k = 1.8;
    const crater_m = k * Math.pow(d_m, 0.78) * Math.pow(v_ms, 0.44);
    const depth_m = crater_m * 0.3;

    // Additional effects
    const fireball_km = Math.pow(E_megatons, 0.4) * 0.5;
    const shockwave_km = Math.pow(E_megatons, 0.33) * 2;
    const seismic_magnitude = Math.log10(E) - 4.8;
    
    // Casualties calculation
    const vaporized = Math.floor(Math.PI * Math.pow(fireball_km * 1000, 2) * 0.1);
    const severe_injuries = Math.floor(Math.PI * Math.pow(shockwave_km * 1000, 2) * 0.05);
    const total_casualties = vaporized + severe_injuries;
    
    // Hazard assessment
    const thermal_radius_km = fireball_km * 1.5;
    const overpressure_radius_km = shockwave_km * 1.2;
    
    // Size comparison
    const asteroid_diameter_m = asteroidData.diameter * ft_to_m;

    return {
      mass_kg: mass,
      energy_megatons: E_megatons.toFixed(1),
      crater_miles: (crater_m / 1609.344).toFixed(2),
      crater_meters: crater_m.toFixed(0),
      crater_depth_meters: depth_m.toFixed(0),
      fireball_km: fireball_km.toFixed(2),
      shockwave_km: shockwave_km.toFixed(2),
      seismic_magnitude: seismic_magnitude.toFixed(1),
      vaporized: vaporized.toLocaleString(),
      severe_injuries: severe_injuries.toLocaleString(),
      total_casualties: total_casualties.toLocaleString(),
      thermal_radius_km: thermal_radius_km.toFixed(2),
      overpressure_radius_km: overpressure_radius_km.toFixed(2),
      asteroid_size_m: asteroid_diameter_m.toFixed(1),
      asteroid_size_ft: asteroidData.diameter.toLocaleString()
    };
  };

  const handleLaunch = async () => {
    if (!impactLocation || isLocked) return;

    setLoading(true);
    setIsLocked(true); // Lock the location immediately
    
    // Calculate effects
    const effects = calculateImpactEffects();
    
    // Zoom to impact location for dramatic effect
    if (mapRef.current) {
      mapRef.current.flyTo(impactLocation, 8, {
        duration: 1.5,
        easeLinearity: 0.5
      });
    }
    
    // Show results after animation
    setTimeout(() => {
      setResults(effects);
      setShowResults(true);
      setLoading(false);
    }, 2500);
  };

  const handleReset = () => {
    setShowResults(false);
    setResults(null);
    setImpactLocation(null);
    setIsLocked(false); // Unlock for new simulation
    
    // Reset map view
    if (mapRef.current) {
      mapRef.current.setView([20, 0], 2.5, {
        duration: 1.0
      });
    }
  };

  const cycleAsteroid = (direction) => {
    const activeList = filteredAsteroids.length > 0 ? filteredAsteroids : asteroidList;
    if (activeList.length === 0) return;
    
    const newIndex = direction === 'next' 
      ? (currentAsteroidIndex + 1) % activeList.length
      : (currentAsteroidIndex - 1 + activeList.length) % activeList.length;
    
    setCurrentAsteroidIndex(newIndex);
    setSelectedAsteroid(activeList[newIndex]);
  };

  return (
    <div className={`simulation-page ${isLoaded ? 'loaded' : ''}`}>
      {/* Universal Premium Navigation */}
      <Navigation />

      {/* Left side - Map */}
      <div className={`map-section ${isLoaded ? 'map-loaded' : ''}`}>
        <MapContainer
          center={[20, 0]}
          zoom={2.5}
          minZoom={2.5}
          maxZoom={18}
          className="impact-map"
          ref={mapRef}
          zoomControl={true}
          worldCopyJump={false}
          maxBounds={[[-90, -180], [90, 180]]}
          maxBoundsViscosity={1.0}
          continuousWorld={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            noWrap={true}
            bounds={[[-90, -180], [90, 180]]}
          />
          <LocationMarker 
            position={impactLocation} 
            onPositionChange={setImpactLocation}
            isLocked={isLocked}
          />
          
          {/* Impact zones with animation */}
          {results && impactLocation && (
            <>
              {/* Crater - Brown center */}
              <Circle 
                center={impactLocation} 
                radius={parseFloat(results.crater_meters)}
                pathOptions={{ 
                  color: '#5c3317',
                  fillColor: '#8b4513',
                  fillOpacity: 0.7,
                  weight: 3,
                  dashArray: '5, 5'
                }}
              />
              {/* Fireball Zone - Red */}
              <Circle 
                center={impactLocation} 
                radius={parseFloat(results.fireball_km) * 1000}
                pathOptions={{ 
                  color: '#ff0000',
                  fillColor: '#ff0000',
                  fillOpacity: 0.3,
                  weight: 2
                }}
              />
              {/* Shockwave Zone - Orange */}
              <Circle 
                center={impactLocation} 
                radius={parseFloat(results.shockwave_km) * 1000}
                pathOptions={{ 
                  color: '#ff8c00',
                  fillColor: '#ff8c00',
                  fillOpacity: 0.2,
                  weight: 2
                }}
              />
            </>
          )}
        </MapContainer>
      </div>

      {/* Right side - Control Panel */}
      <div className={`control-panel ${isLoaded ? 'panel-loaded' : ''}`}>
        {!showResults ? (
          <div className="editor-view">
            <h1 className="panel-title">ASTEROID LAUNCHER</h1>
            
            {/* Search Bar */}
            <div className="search-container">
              <div className="search-wrapper">
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search asteroids by name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={loadingAsteroids}
                />
                {searchQuery && (
                  <button className="search-clear" onClick={() => setSearchQuery('')}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                )}
              </div>
              {searchQuery && filteredAsteroids.length === 0 && (
                <p className="search-no-results">No asteroids found matching "{searchQuery}"</p>
              )}
              {searchQuery && filteredAsteroids.length > 0 && (
                <p className="search-results-count">Found {filteredAsteroids.length} asteroid{filteredAsteroids.length !== 1 ? 's' : ''}</p>
              )}
            </div>
            
            {/* Asteroid Selector */}
            <div className="asteroid-selector">
              <button className="selector-arrow" onClick={() => cycleAsteroid('prev')} disabled={loadingAsteroids}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
              
              <div className="asteroid-preview">
                {loadingAsteroids ? (
                  <div className="asteroid-loading">
                    <div className="loading-spinner"></div>
                    <span className="asteroid-label">Loading NASA Data...</span>
                  </div>
                ) : selectedAsteroid ? (
                  <>
                    <div className="asteroid-model-container">
                      <div className={`asteroid-fallback ${asteroidData.type.toLowerCase()}`}>
                        <div className="asteroid-texture"></div>
                        <div className="asteroid-craters">
                          <div className="crater crater-1"></div>
                          <div className="crater crater-2"></div>
                          <div className="crater crater-3"></div>
                        </div>
                      </div>
                      <div className="asteroid-glow"></div>
                    </div>
                    <span className="asteroid-label">{selectedAsteroid.name}</span>
                    <span className="asteroid-counter">{currentAsteroidIndex + 1} of {filteredAsteroids.length > 0 ? filteredAsteroids.length : asteroidList.length}</span>
                  </>
                ) : (
                  <span className="asteroid-label">No Data</span>
                )}
              </div>
              
              <button className="selector-arrow" onClick={() => cycleAsteroid('next')} disabled={loadingAsteroids}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Asteroid Info Display */}
            <div className="slider-section">
              <div className="slider-row">
                <div className="slider-label">
                  <svg className="label-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2"/>
                    <circle cx="10" cy="10" r="3" fill="currentColor"/>
                  </svg>
                  <span>DIAMETER</span>
                </div>
                <div className="info-display">
                  <span className="info-value">{asteroidData.diameter.toLocaleString()} ft</span>
                  {selectedAsteroid && (
                    <span className="info-range">({(selectedAsteroid.diameter_min_km * 1000).toFixed(0)}m - {(selectedAsteroid.diameter_max_km * 1000).toFixed(0)}m)</span>
                  )}
                </div>
              </div>

              <div className="slider-row">
                <div className="slider-label">
                  <svg className="label-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M11 2L4 12h6l-1 6 7-10h-6l1-6z" fill="currentColor"/>
                  </svg>
                  <span>VELOCITY</span>
                </div>
                <div className="info-display">
                  <span className="info-value">{asteroidData.speed.toLocaleString()} mph</span>
                  {selectedAsteroid && selectedAsteroid.velocity_kmps && (
                    <span className="info-range">({selectedAsteroid.velocity_kmps.toFixed(2)} km/s)</span>
                  )}
                </div>
              </div>

              <div className="slider-row">
                <div className="slider-label">
                  <svg className="label-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M14 6L6 14M14 6H8M14 6V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>CLOSE APPROACH</span>
                </div>
                <div className="info-display">
                  {selectedAsteroid && selectedAsteroid.close_approach_date ? (
                    <>
                      <span className="info-value">{new Date(selectedAsteroid.close_approach_date).toLocaleDateString()}</span>
                      <span className="info-range">Miss: {(selectedAsteroid.miss_distance_km / 384400).toFixed(2)} LD</span>
                    </>
                  ) : (
                    <span className="info-value">No approach data</span>
                  )}
                </div>
              </div>
              
              <div className="slider-row">
                <div className="slider-label">
                  <svg className="label-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="6" stroke="currentColor" strokeWidth="2"/>
                    <path d="M10 6V10L13 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <span>IMPACT ANGLE</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="90"
                  step="5"
                  value={asteroidData.angle}
                  onChange={(e) => setAsteroidData({...asteroidData, angle: parseInt(e.target.value)})}
                  className="slider"
                />
                <span className="slider-value">{asteroidData.angle}°</span>
              </div>
            </div>

            {/* Launch Button */}
            <button
              className={`launch-button ${!impactLocation || loading || isLocked ? 'disabled' : ''}`}
              onClick={handleLaunch}
              disabled={!impactLocation || loading || isLocked}
            >
              {loading ? 'CALCULATING IMPACT...' : 'LAUNCH ASTEROID'}
            </button>

            {!impactLocation && (
              <p className="hint-text">Click on the map to select an impact location</p>
            )}
          </div>
        ) : (
          <div className="results-view">
            <div className="results-header">
              <h2 className="crater-headline">
                {results.crater_miles}<br/>
                <span className="headline-unit">MILE WIDE CRATER</span>
              </h2>
              <p className="impact-summary">Complete impact analysis and affected zones</p>
            </div>

            <div className="results-list">
              {/* SECTION 1: IMPACT ZONES WITH ICONS */}
              <div className="results-section-title">PHYSICAL CHARACTERISTICS</div>
              
              {/* Asteroid Size */}
              <div className="result-item">
                <svg className="result-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="8" stroke="#9b59b6" strokeWidth="2" fill="none"/>
                  <circle cx="10" cy="10" r="4" fill="#9b59b6"/>
                </svg>
                <div className="result-text">
                  <div className="result-label">Asteroid Size</div>
                  <div className="result-value">
                    <span className="result-primary">{results.asteroid_size_ft} ft</span>
                    <span className="result-secondary">({results.asteroid_size_m} m diameter)</span>
                  </div>
                </div>
              </div>

              {/* Crater Details */}
              <div className="result-item">
                <svg className="result-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <ellipse cx="10" cy="10" rx="7" ry="3" fill="#8b4513" opacity="0.3"/>
                  <path d="M3 10Q10 16 17 10" stroke="#8b4513" strokeWidth="2" fill="none"/>
                  <line x1="10" y1="10" x2="10" y2="14" stroke="#8b4513" strokeWidth="2" strokeDasharray="2 1"/>
                </svg>
                <div className="result-text">
                  <div className="result-label">Crater Depth</div>
                  <div className="result-value">
                    <span className="result-primary">{results.crater_depth_meters} m</span>
                    <span className="result-secondary">({(results.crater_depth_meters * 3.28084).toFixed(0)} ft deep)</span>
                  </div>
                </div>
              </div>

              {/* Impact Energy */}
              <div className="result-item">
                <svg className="result-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 2L12 8L18 10L12 12L10 18L8 12L2 10L8 8L10 2Z" fill="#e74c3c"/>
                </svg>
                <div className="result-text">
                  <div className="result-label">Impact Energy</div>
                  <div className="result-value">
                    <span className="result-primary">{results.energy_megatons} MT</span>
                    <span className="result-secondary">(TNT equivalent)</span>
                  </div>
                </div>
              </div>

              <div className="results-section-title">AFFECTED ZONES</div>
              
              {/* Fireball Zone (Red) */}
              <div className="result-item">
                <svg className="result-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="8" fill="#ff0000" opacity="0.2"/>
                  <circle cx="10" cy="10" r="8" stroke="#ff0000" strokeWidth="2"/>
                </svg>
                <div className="result-text">
                  <div className="result-label">Fireball Zone <span className="zone-color">(Red)</span></div>
                  <div className="result-value">
                    <span className="result-primary">{results.fireball_km} km</span>
                    <span className="result-secondary">radius · Total vaporization</span>
                  </div>
                </div>
              </div>

              {/* Thermal Radiation Hazard */}
              <div className="result-item">
                <svg className="result-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 2C10 2 7 5 7 8C7 10 8.5 11.5 10 11.5C11.5 11.5 13 10 13 8C13 5 10 2 10 2Z" fill="#ff6b35"/>
                  <path d="M10 11.5C10 11.5 8 13.5 8 15C8 16.5 9 17.5 10 17.5C11 17.5 12 16.5 12 15C12 13.5 10 11.5 10 11.5Z" fill="#ff6b35"/>
                </svg>
                <div className="result-text">
                  <div className="result-label">Thermal Radiation</div>
                  <div className="result-value">
                    <span className="result-primary">{results.thermal_radius_km} km</span>
                    <span className="result-secondary">radius · 3rd degree burns</span>
                  </div>
                </div>
              </div>

              {/* Shockwave Zone (Orange) */}
              <div className="result-item">
                <svg className="result-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="8" fill="#ff8c00" opacity="0.2"/>
                  <circle cx="10" cy="10" r="8" stroke="#ff8c00" strokeWidth="2"/>
                  <circle cx="10" cy="10" r="4" stroke="#ff8c00" strokeWidth="1.5"/>
                </svg>
                <div className="result-text">
                  <div className="result-label">Shockwave Zone <span className="zone-color">(Orange)</span></div>
                  <div className="result-value">
                    <span className="result-primary">{results.shockwave_km} km</span>
                    <span className="result-secondary">radius · Building collapse</span>
                  </div>
                </div>
              </div>

              {/* SECTION 2: STATISTICS (NO ICONS) */}
              <div className="results-section-title">IMPACT STATISTICS</div>
              
              {/* Seismic Activity - No icon */}
              <div className="result-item-text">
                <div className="result-text">
                  <div className="result-label">Seismic Magnitude</div>
                  <div className="result-value">
                    <span className="result-primary">{results.seismic_magnitude}</span>
                    <span className="result-secondary">Richter scale</span>
                  </div>
                </div>
              </div>

              {/* Casualties - Text only */}
              <div className="result-item-text">
                <div className="result-text">
                  <div className="result-label">Instant Casualties</div>
                  <div className="result-value">
                    <span className="result-primary">{results.vaporized}</span>
                    <span className="result-secondary">vaporized instantly</span>
                  </div>
                </div>
              </div>

              <div className="result-item-text">
                <div className="result-text">
                  <div className="result-label">Severe Injuries</div>
                  <div className="result-value">
                    <span className="result-primary">{results.severe_injuries}</span>
                    <span className="result-secondary">critically injured</span>
                  </div>
                </div>
              </div>

              <div className="result-item-text">
                <div className="result-text">
                  <div className="result-label">Total Casualties</div>
                  <div className="result-value">
                    <span className="result-primary">{results.total_casualties}</span>
                    <span className="result-secondary">people affected</span>
                  </div>
                </div>
              </div>
            </div>

            <button className="reset-button" onClick={handleReset}>
              LAUNCH ANOTHER
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default SimulationPage;
