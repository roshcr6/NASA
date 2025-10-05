/**
 * Real-Time Solar System with Live Asteroid Data
 * Enhanced 3D solar system simulation using Three.js and NASA API
 */

class LiveSolarSystem {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        
        // Solar system objects
        this.sun = null;
        this.planets = {};
        this.asteroids = {};
        this.orbits = {};
        this.labels = {}; // Store planet labels
        
        // Asteroid belt
        this.asteroidBelt = [];
        this.asteroidBeltLoaded = false;
        this.asteroidBeltVisible = false;
        
        // Animation and time
        this.animationId = null;
        this.isPlaying = true;
        this.simulationDate = new Date(); // Current simulation date - ALWAYS synced to real time
        this.timeMultiplier = 1; // Real-time: 1 second = 1 second (DEFAULT)
        this.lastFrameTime = Date.now();
        this.realTimeMode = true; // Always use real-time by default
        
        // Visual settings
        this.showOrbits = true;
        this.showLabels = true;
        this.followEarth = false;
        
        // Asteroid loading state
        this.asteroidsLoaded = false;
        
        // Selection and interaction
        this.selectedObject = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Camera focus tracking
        this.currentFocusedObject = null;
        
        // NASA API service
        this.nasaAPI = new NASAAPIService();
        
        // Planet data with real orbital parameters (simplified)
        this.planetData = {
            mercury: {
                name: 'Mercury',
                radius: 0.38,
                distance: 5.8,
                color: 0x8C7853,
                period: 0.24,
                rotationPeriod: 58.6, // Earth days for one rotation
                texture: null,
                icon: '☿️'
            },
            venus: {
                name: 'Venus',
                radius: 0.95,
                distance: 10.8,
                color: 0xFFB649,
                period: 0.62,
                rotationPeriod: 243.0, // Retrograde rotation
                texture: null,
                icon: '♀️'
            },
            earth: {
                name: 'Earth',
                radius: 1.0,
                distance: 15.0,
                color: 0x6B93D6,
                period: 1.0,
                rotationPeriod: 1.0, // 24 hours = 1 Earth day
                texture: null,
                icon: '🌍'
            },
            mars: {
                name: 'Mars',
                radius: 0.53,
                distance: 22.8,
                color: 0xCD5C5C,
                period: 1.88,
                rotationPeriod: 1.03, // 24.6 hours
                texture: null,
                icon: '♂️'
            },
            jupiter: {
                name: 'Jupiter',
                radius: 11.2,
                distance: 77.8,
                color: 0xD8CA9D,
                period: 11.9,
                rotationPeriod: 0.41, // 9.9 hours - very fast!
                texture: null,
                icon: '♃'
            },
            saturn: {
                name: 'Saturn',
                radius: 9.4,
                distance: 142.9,
                color: 0xFAD5A5,
                period: 29.4,
                rotationPeriod: 0.45, // 10.7 hours
                texture: null,
                icon: '♄'
            },
            uranus: {
                name: 'Uranus',
                radius: 4.0,
                distance: 287.1,
                color: 0x4FD0E3,
                period: 84.0,
                rotationPeriod: 0.72, // 17.2 hours
                texture: null,
                icon: '♅'
            },
            neptune: {
                name: 'Neptune',
                radius: 3.9,
                distance: 449.5,
                color: 0x4B70DD,
                period: 164.8,
                rotationPeriod: 0.67, // 16.1 hours
                texture: null,
                icon: '♆'
            }
        };
        
        this.init();
    }

    /**
     * Initialize the solar system
     */
    async init() {
        try {
            console.log('🚀 Starting Solar System initialization...');
            
            this.createScene();
            console.log('✅ Scene created');
            
            this.createLights();
            console.log('✅ Lights created');
            
            this.createSun();
            console.log('✅ Sun created');
            
            this.createPlanets();
            console.log('✅ Planets created');
            
            // Clean up any dummy objects below Earth
            this.cleanupOrphanedObjects();
            console.log('✅ Cleanup completed');
            
            this.createStarField();
            console.log('✅ Star field created');
            
            this.setupEventListeners();
            console.log('✅ Event listeners setup');
            
            // Load real Earth imagery from NASA EPIC
            console.log('📡 Loading Earth imagery...');
            await this.loadEarthImagery();
            console.log('✅ Earth imagery loaded');
            
            // DON'T load asteroids automatically - only when user clicks Asteroids tab
            // await this.loadAsteroidData();
            
            // Focus camera on Earth at startup
            this.focusOnEarth();
            console.log('✅ Camera focused on Earth');
            
            this.animate();
            console.log('✅ Animation started');
            
            console.log('🎉 Live Solar System initialized successfully!');
            console.log('💡 Click "Asteroids" tab to load Near-Earth Objects from NASA');
        } catch (error) {
            console.error('❌ ERROR during Solar System initialization:', error);
            console.error('Stack trace:', error.stack);
            throw error;
        }
    }

    /**
     * Create the main 3D scene
     */
    createScene() {
        // Scene
        this.scene = new THREE.Scene();
        // Background will be set by realistic star field texture

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            75, 
            window.innerWidth / window.innerHeight, 
            0.1, 
            10000
        );
        this.camera.position.set(50, 30, 50);

        // Renderer
        const canvas = document.getElementById('solar-system-canvas');
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: canvas, 
            antialias: true,
            alpha: true
        });
        
        // Fix WebGL zero-size errors - ensure canvas has valid dimensions
        const width = window.innerWidth || canvas.clientWidth || 800;
        const height = window.innerHeight || canvas.clientHeight || 600;
        
        if (width > 0 && height > 0) {
            this.renderer.setSize(width, height);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        } else {
            console.warn('⚠️ Canvas has zero size, using defaults');
            this.renderer.setSize(800, 600);
            this.renderer.setPixelRatio(1);
        }
        
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 1000;
        this.controls.maxPolarAngle = Math.PI;
        
        // Cancel auto-return to Earth when user manually adjusts camera
        this.controls.addEventListener('start', () => {
            if (this.cameraReturnTimeout) {
                clearTimeout(this.cameraReturnTimeout);
                this.cameraReturnTimeout = null;
                console.log('🎮 User camera control detected - auto-return cancelled');
            }
        });
    }

    /**
     * Create lighting
     */
    createLights() {
        // Sunlight (point light at sun position) - increased intensity for better visibility
        const sunLight = new THREE.PointLight(0xffffff, 4, 2500); // Increased from 3 to 4
        sunLight.position.set(0, 0, 0);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        this.scene.add(sunLight);

        // Ambient light for better visibility of textures
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5); // Increased from 0.3 to 0.5
        this.scene.add(ambientLight);
        
        // Hemisphere light for more realistic space lighting
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x080820, 0.3); // Increased from 0.2 to 0.3
        this.scene.add(hemiLight);
    }

    /**
     * Create the Sun
     */
    createSun() {
        const sunGeometry = new THREE.SphereGeometry(2, 64, 64); // Higher resolution for detail
        
        // Load high-quality Sun texture
        const textureLoader = new THREE.TextureLoader();
        const sunTexture = textureLoader.load('textures/sun.jpg');
        
        const sunMaterial = new THREE.MeshBasicMaterial({ 
            map: sunTexture,
            emissive: 0xffaa00,
            emissiveIntensity: 0.6, // Brighter glow
            emissiveMap: sunTexture // Use texture for emission too
        });
        
        this.sun = new THREE.Mesh(sunGeometry, sunMaterial);
        this.sun.name = 'Sun';
        this.sun.userData = {
            type: 'star',
            info: {
                title: 'The Sun',
                details: [
                    'Type: G-type main-sequence star (G2V)',
                    'Mass: 1.989 × 10³⁰ kg (333,000 Earth masses)',
                    'Diameter: 1,392,700 km (109 Earth diameters)',
                    'Surface Temperature: 5,778 K (5,505°C)',
                    'Core Temperature: 15 million K',
                    'Age: 4.6 billion years',
                    'Distance from Earth: 149.6 million km (1 AU)',
                    'Rotation Period: 25 days (equator), 35 days (poles)'
                ]
            }
        };
        
        this.scene.add(this.sun);

        // Enhanced Sun glow effect (corona)
        const glowGeometry = new THREE.SphereGeometry(3.5, 32, 32);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            transparent: true,
            opacity: 0.15,
            side: THREE.BackSide
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        this.sun.add(glow);
        
        console.log('☀️ Sun created with realistic texture');
    }

    /**
     * Create all planets
     */
    createPlanets() {
        Object.keys(this.planetData).forEach(planetKey => {
            this.createPlanet(planetKey, this.planetData[planetKey]);
        });
    }

    /**
     * Create a single planet
     */
    createPlanet(key, data) {
        // Planet geometry with higher detail - increase radius for better visibility
        const visibleRadius = data.radius * 1.5; // Make planets 50% larger for visibility
        const geometry = new THREE.SphereGeometry(visibleRadius, 128, 128); // Higher detail for smoother planets
        
        // Use MeshStandardMaterial for photorealistic appearance
        const material = new THREE.MeshStandardMaterial({ 
            color: 0xffffff, // White base to show true texture colors
            roughness: 0.9, // Rocky planets are rough
            metalness: 0.0, // No metallic sheen for natural look
            emissive: data.color,
            emissiveIntensity: 0.05 // Very subtle glow
        });
        
        // Adjust material properties per planet type
        if (key === 'jupiter' || key === 'saturn' || key === 'uranus' || key === 'neptune') {
            material.roughness = 0.5; // Gas giants are smoother
        }
        
        // Load real textures for planets
        this.loadPlanetTexture(key, material);
        
        const planet = new THREE.Mesh(geometry, material);
        planet.name = data.name;
        planet.userData = {
            type: 'planet',
            key: key,
            distance: data.distance,
            period: data.period,
            info: this.getPlanetInfo(key)
        };
        
        planet.castShadow = true;
        planet.receiveShadow = true;
        
        // Set initial position using accurate orbital mechanics
        const currentDate = new Date();
        const julianDate = this.nasaAPI.dateToJulian(currentDate);
        const position = this.nasaAPI.calculatePlanetaryPosition(key, julianDate);
        
        planet.position.set(
            position.x * 15,
            position.y * 15,
            position.z * 15
        );
        
        // Rotate Earth texture 180 degrees so India faces the Sun at 2 PM
        if (key === 'earth') {
            planet.rotation.y = Math.PI; // 180 degrees
        }
        
        this.planets[key] = planet;
        this.scene.add(planet);

        // Add rings for Saturn and Uranus
        if (key === 'saturn' || key === 'uranus') {
            this.createPlanetaryRings(planet, key, visibleRadius);
        }

        // Create elliptical orbit line based on real orbital elements
        if (this.showOrbits) {
            this.createEllipticalOrbit(key);
        }

        // Add planet label
        if (this.showLabels) {
            this.createLabel(planet, data.name);
        }
    }

    /**
     * Create rings for Saturn and Uranus
     */
    createPlanetaryRings(planet, planetKey, planetRadius) {
        let innerRadius, outerRadius, ringColor, ringOpacity, ringTexture;
        
        if (planetKey === 'saturn') {
            // Saturn's magnificent rings - realistic appearance with actual texture
            innerRadius = planetRadius * 1.2;
            outerRadius = planetRadius * 2.3;
            ringColor = 0xFFFFFF; // White base for texture
            ringOpacity = 1.0; // Full opacity, texture has alpha channel
            ringTexture = 'textures/saturn_ring.png'; // LOCAL high-quality ring texture with gaps!
        } else if (planetKey === 'uranus') {
            // Uranus's faint rings
            innerRadius = planetRadius * 1.5;
            outerRadius = planetRadius * 2.0;
            ringColor = 0x88AACC; // Bluish color
            ringOpacity = 0.3; // More transparent for Uranus
            ringTexture = null; // Simple color for Uranus (no detailed texture available)
        }
        
        // Create ring geometry
        const ringGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 128);
        
        // UV mapping for proper texture display
        const pos = ringGeometry.attributes.position;
        const v3 = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) {
            v3.fromBufferAttribute(pos, i);
            ringGeometry.attributes.uv.setXY(i, v3.length() < (innerRadius + outerRadius) / 2 ? 0 : 1, 1);
        }
        
        // Create ring material with realistic properties
        const ringMaterial = new THREE.MeshStandardMaterial({
            color: ringColor,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: ringOpacity,
            roughness: 0.95, // Rings are very matte
            metalness: 0.0,
            emissive: ringColor,
            emissiveIntensity: 0.02, // Subtle self-illumination
            alphaTest: 0.1 // Discard fully transparent pixels
        });
        
        // Load ring texture if available
        if (ringTexture) {
            const textureLoader = new THREE.TextureLoader();
            textureLoader.load(
                ringTexture,
                (texture) => {
                    ringMaterial.map = texture;
                    ringMaterial.alphaMap = texture; // Use same texture for alpha channel
                    ringMaterial.transparent = true;
                    ringMaterial.needsUpdate = true;
                    console.log(`✅ Loaded realistic ring texture for ${planetKey} with gaps and particles!`);
                },
                undefined,
                (error) => {
                    console.warn(`⚠️ Ring texture failed for ${planetKey}, using solid color`);
                }
            );
        }
        
        const rings = new THREE.Mesh(ringGeometry, ringMaterial);
        
        // Rotate rings to be horizontal (perpendicular to planet's axis)
        rings.rotation.x = Math.PI / 2;
        
        // Tilt Saturn's rings (26.7 degrees)
        if (planetKey === 'saturn') {
            rings.rotation.x = Math.PI / 2 - (26.7 * Math.PI / 180);
        }
        
        // Tilt Uranus's rings (97.7 degrees - Uranus is tilted on its side!)
        if (planetKey === 'uranus') {
            rings.rotation.x = Math.PI / 2 - (97.7 * Math.PI / 180);
        }
        
        // Add rings as child of planet so they move together
        planet.add(rings);
        
        console.log(`✅ Created rings for ${planetKey}`);
    }

    /**
     * Create orbit visualization
     */
    createOrbit(radius) {
        const orbitGeometry = new THREE.RingGeometry(radius - 0.1, radius + 0.1, 64);
        const orbitMaterial = new THREE.MeshBasicMaterial({
            color: 0x666666,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        
        const orbit = new THREE.Mesh(orbitGeometry, orbitMaterial);
        orbit.rotation.x = Math.PI / 2;
        orbit.name = 'orbit';
        
        this.scene.add(orbit);
    }
    
    /**
     * Create accurate elliptical orbit based on real orbital elements
     */
    createEllipticalOrbit(planetKey) {
        // Get orbital elements from NASA API
        const orbitPoints = [];
        const segments = 500; // Increased from 360 for smoother orbits
        
        // Calculate orbit points using actual orbital mechanics for ONE FULL ORBIT
        const planetPeriod = this.planetData[planetKey].period; // Years
        const periodMs = planetPeriod * 365.25 * 24 * 60 * 60 * 1000;
        
        for (let i = 0; i <= segments; i++) {
            const fraction = i / segments;
            // Calculate position over the planet's full orbital period
            const time = Date.now() + (fraction * periodMs);
            const julianDate = this.nasaAPI.dateToJulian(new Date(time));
            const position = this.nasaAPI.calculatePlanetaryPosition(planetKey, julianDate);
            
            orbitPoints.push(new THREE.Vector3(
                position.x * 15,
                position.y * 15,
                position.z * 15
            ));
        }
        
        const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
        
        // Get planet color for orbit line with brighter colors
        const planetColor = this.planetData[planetKey]?.color || 0x666666;
        const brighterColor = this.brightenColor(planetColor, 0.5);
        
        const orbitMaterial = new THREE.LineBasicMaterial({
            color: brighterColor,
            transparent: true,
            opacity: 0.85, // Increased for even better visibility
            linewidth: 3 // Increased line width
        });
        
        // Use LineLoop to ensure the orbit closes properly as a complete circle
        const orbit = new THREE.LineLoop(orbitGeometry, orbitMaterial);
        orbit.name = `${planetKey}_orbit`;
        this.scene.add(orbit);
    }

    /**
     * Brighten a color for better visibility
     */
    brightenColor(color, factor) {
        const r = ((color >> 16) & 0xFF) / 255;
        const g = ((color >> 8) & 0xFF) / 255;
        const b = (color & 0xFF) / 255;
        
        const newR = Math.min(255, Math.floor((r + factor) * 255));
        const newG = Math.min(255, Math.floor((g + factor) * 255));
        const newB = Math.min(255, Math.floor((b + factor) * 255));
        
        return (newR << 16) | (newG << 8) | newB;
    }

    /**
     * Create text label for objects using canvas sprite
     */
    createLabel(object, text) {
        // Create canvas for text with higher resolution
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512; // Increased resolution
        canvas.height = 128;
        
        // Draw text on canvas
        context.fillStyle = 'rgba(0, 0, 0, 0)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.font = 'Bold 48px Arial'; // Larger font
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // Add outline for readability
        context.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        context.lineWidth = 6;
        context.strokeText(text, canvas.width / 2, canvas.height / 2);
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        
        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        
        // Create sprite material
        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            sizeAttenuation: true // Scale with distance
        });
        
        // Create sprite
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(8, 2, 1); // Base scale
        
        // Position label above the planet
        sprite.position.copy(object.position);
        sprite.position.y += object.geometry.parameters.radius + 1.5;
        
        // Store reference to parent object and base scale
        sprite.userData.parent = object;
        sprite.userData.offset = new THREE.Vector3(0, object.geometry.parameters.radius + 1.5, 0);
        sprite.userData.baseScale = new THREE.Vector3(8, 2, 1);
        
        this.scene.add(sprite);
        
        // Store label for updates
        if (object.userData.key) {
            this.labels[object.userData.key] = sprite;
        }
    }

    /**
     * Create realistic starfield background with Milky Way galaxy texture
     */
    createStarField() {
        // Load high-resolution 8K Milky Way star field texture
        const textureLoader = new THREE.TextureLoader();
        const starTexture = textureLoader.load(
            'textures/starfield.jpg',
            () => {
                console.log('✨ Star field texture loaded successfully');
            },
            undefined,
            (error) => {
                console.error('❌ Error loading star field texture:', error);
            }
        );

        // Create a massive sphere to act as skybox (inside-out sphere)
        const skyboxGeometry = new THREE.SphereGeometry(8000, 64, 64);
        
        // Flip the sphere inside-out so we see the texture from inside
        skyboxGeometry.scale(-1, 1, 1);
        
        const skyboxMaterial = new THREE.MeshBasicMaterial({
            map: starTexture,
            side: THREE.FrontSide, // Use FrontSide with flipped geometry
            fog: false, // Don't apply fog to background
            depthWrite: false // Ensure it renders behind everything
        });

        const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
        skybox.name = 'starfield';
        skybox.renderOrder = -1; // Render first (behind everything)
        this.scene.add(skybox);
        
        console.log('🌌 Realistic Milky Way star field created');
    }

    /**
     * Clean up any orphaned test objects or asteroids below Earth
     */
    cleanupOrphanedObjects() {
        console.log('🧹 Scanning for orphaned objects below Earth...');
        const objectsToRemove = [];
        
        this.scene.children.forEach(child => {
            // Remove any sphere objects positioned below the ecliptic plane (y < -5)
            if (child.geometry && child.geometry.type === 'SphereGeometry' && child.position.y < -5) {
                // Skip planets and sun
                if (child !== this.sun && !Object.values(this.planets).includes(child)) {
                    console.log(`🧹 Found orphaned object at y=${child.position.y.toFixed(2)}, type=${child.userData?.type || 'unknown'}`);
                    objectsToRemove.push(child);
                }
            }
        });
        
        objectsToRemove.forEach(obj => {
            this.scene.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
        
        if (objectsToRemove.length > 0) {
            console.log(`🧹 Removed ${objectsToRemove.length} orphaned objects below Earth`);
        } else {
            console.log('✅ No orphaned objects found');
        }
    }

    /**
     * Load real asteroid data from NASA API
     */
    async loadAsteroidData() {
        try {
            // Don't reload if already loaded
            if (this.asteroidsLoaded) {
                console.log('✅ Asteroids already loaded');
                return;
            }
            
            console.log('� Loading Near-Earth Objects from NASA NEO API...');
            const asteroidData = await this.nasaAPI.getNEOFeed();
            
            console.log(`✅ Loaded ${asteroidData.length} Near-Earth Objects`);
            
            // Clear any existing asteroids first
            this.clearAllAsteroids();
            
            // Create 3D representations for asteroids with RED orbits
            let successCount = 0;
            let failCount = 0;
            
            // Store asteroids that successfully have orbits
            const asteroidsWithOrbits = [];
            
            console.log('📡 Fetching REAL orbital data for each asteroid from NASA (this takes ~30-60 seconds)...');
            
            for (let i = 0; i < asteroidData.length; i++) {
                const asteroid = asteroidData[i];
                try {
                    console.log(`[${i+1}/${asteroidData.length}] Fetching REAL data for ${asteroid.name}...`);
                    
                    // Fetch detailed data with orbital_data from NASA
                    const detailedData = await this.nasaAPI.getAsteroidDetails(asteroid.id);
                    
                    if (detailedData && detailedData.orbital_data) {
                        // Merge close approach data with REAL orbital data
                        const mergedData = {
                            ...asteroid,
                            orbital_data: detailedData.orbital_data
                        };
                        
                        const created = this.createAsteroid(mergedData, i);
                        if (created) {
                            successCount++;
                            // Store this asteroid since it has an orbit in 3D scene
                            asteroidsWithOrbits.push(mergedData);
                        } else {
                            failCount++;
                        }
                    } else {
                        console.warn(`⚠️ ${asteroid.name}: No orbital data from NASA API, skipping`);
                        failCount++;
                    }
                } catch (error) {
                    console.error(`❌ Failed to fetch ${asteroid.name}:`, error.message);
                    failCount++;
                }
            }
            
            // Store ONLY asteroids that have orbits in 3D scene
            this.loadedAsteroidData = asteroidsWithOrbits;
            
            console.log(`📦 Stored ${asteroidsWithOrbits.length} asteroids with orbital data`);
            
            // Clean up any orphaned test objects or asteroids below Earth
            console.log('🧹 Cleaning up orphaned objects...');
            const objectsToRemove = [];
            this.scene.children.forEach(child => {
                // Remove any sphere objects positioned below the ecliptic plane (y < -5)
                if (child.geometry && child.geometry.type === 'SphereGeometry' && child.position.y < -5) {
                    // Skip planets and sun
                    if (child !== this.sun && !Object.values(this.planets).includes(child)) {
                        objectsToRemove.push(child);
                    }
                }
            });
            
            objectsToRemove.forEach(obj => {
                this.scene.remove(obj);
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) obj.material.dispose();
            });
            
            if (objectsToRemove.length > 0) {
                console.log(`🧹 Removed ${objectsToRemove.length} orphaned objects below Earth`);
            }
            
            // Update UI with asteroid list (only asteroids with orbits)
            this.updateAsteroidUI(asteroidsWithOrbits);
            
            // Mark as loaded
            this.asteroidsLoaded = true;
            
            console.log(`\n🎉 ===== CREATION COMPLETE =====`);
            console.log(`✅ Success: ${successCount} asteroids`);
            console.log(`❌ Failed: ${failCount} asteroids`);
            console.log(`📊 In scene: ${Object.keys(this.asteroids).length} asteroids`);
            console.log(`🔴 Orbits: ${Object.keys(this.orbits).length}`);
            console.log(`================================\n`);
            
            // List first 10 asteroids
            if (successCount > 0) {
                console.log('� First 10 asteroids:');
                Object.values(this.asteroids).slice(0, 10).forEach((ast, i) => {
                    console.log(`  ${i+1}. ${ast.name}`);
                });
                if (successCount > 10) console.log(`  ... and ${successCount - 10} more`);
            }
            
        } catch (error) {
            console.error('❌ FATAL ERROR loading asteroids:', error);
            console.error('Stack:', error.stack);
        }
    }
    
    /**
     * Clear all existing asteroids and orbits
     */
    clearAllAsteroids() {
        // Remove asteroid meshes
        Object.values(this.asteroids).forEach(asteroid => {
            this.scene.remove(asteroid);
            if (asteroid.geometry) asteroid.geometry.dispose();
            if (asteroid.material) asteroid.material.dispose();
        });
        
        // Remove orbit lines
        Object.values(this.orbits).forEach(orbit => {
            this.scene.remove(orbit);
            if (orbit.geometry) orbit.geometry.dispose();
            if (orbit.material) orbit.material.dispose();
        });
        
        this.asteroids = {};
        this.orbits = {};
        
        console.log('🧹 Cleared all existing asteroids and orbits');
    }
    
    /**
     * Show all asteroid orbits (make them visible)
     */
    /**
     * Load real Earth imagery from NASA EPIC
     */
    async loadEarthImagery() {
        try {
            console.log('🌍 Attempting to load real Earth imagery from NASA EPIC...');
            const earthImagery = await this.nasaAPI.getEarthImagery();
            
            if (earthImagery && earthImagery.url) {
                console.log('✅ Earth imagery loaded:', earthImagery.date);
                
                // Load texture with CORS proxy if needed
                const textureLoader = new THREE.TextureLoader();
                textureLoader.setCrossOrigin('anonymous');
                
                textureLoader.load(
                    earthImagery.url,
                    (texture) => {
                        // Apply texture to Earth
                        if (this.planets.earth) {
                            this.planets.earth.material.map = texture;
                            this.planets.earth.material.color.setHex(0xffffff);
                            this.planets.earth.material.roughness = 0.9;
                            this.planets.earth.material.metalness = 0.1;
                            this.planets.earth.material.needsUpdate = true;
                            console.log('✅ Real Earth texture applied from NASA EPIC!');
                        }
                    },
                    undefined,
                    (error) => {
                        console.warn('⚠️ EPIC texture load failed, using fallback:', error.message);
                        this.loadFallbackEarthTexture();
                    }
                );
                
                this.earthImageryDate = earthImagery.date;
            } else {
                console.log('ℹ️ No EPIC data available, using fallback Earth texture');
                this.loadFallbackEarthTexture();
            }
        } catch (error) {
            console.warn('⚠️ NASA EPIC API unavailable (503 Service Unavailable)');
            console.log('ℹ️ Using fallback Earth texture instead');
            this.loadFallbackEarthTexture();
            // Don't throw error - continue with fallback
        }
    }
    
    /**
     * Load fallback Earth texture (high quality public domain)
     */
    loadFallbackEarthTexture() {
        console.log('🌍 Loading fallback Earth texture...');
        
        // Try multiple fallback sources
        const earthTextures = [
            'https://unpkg.com/three-globe@2.24.11/example/img/earth-blue-marble.jpg',
            'https://cdn.jsdelivr.net/npm/three-globe@2.24.11/example/img/earth-blue-marble.jpg'
        ];
        
        const textureLoader = new THREE.TextureLoader();
        textureLoader.setCrossOrigin('anonymous');
        
        this.tryLoadEarthTexture(earthTextures, 0, textureLoader);
    }
    
    /**
     * Try loading Earth texture from multiple sources
     */
    tryLoadEarthTexture(urls, index, textureLoader) {
        if (index >= urls.length) {
            // All sources failed, generate procedural Earth texture
            console.log('🎨 All Earth textures failed, generating procedural texture');
            this.createProceduralTexture('earth', this.planets.earth.material);
            return;
        }
        
        const url = urls[index];
        console.log(`Trying Earth texture source ${index + 1}/${urls.length}...`);
        
        textureLoader.load(
            url,
            (texture) => {
                if (this.planets.earth) {
                    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
                    this.planets.earth.material.map = texture;
                    this.planets.earth.material.color.setHex(0xffffff);
                    this.planets.earth.material.needsUpdate = true;
                    console.log(`✅ Fallback Earth texture applied (source ${index + 1})`);
                }
            },
            undefined,
            (error) => {
                console.warn(`Earth texture source ${index + 1} failed, trying next...`);
                this.tryLoadEarthTexture(urls, index + 1, textureLoader);
            }
        );
    }
    
    /**
     * Load realistic textures for planets
     */
    loadPlanetTexture(planetKey, material) {
        const textureLoader = new THREE.TextureLoader();
        textureLoader.setCrossOrigin('anonymous');
        
        // For Earth, use NASA EPIC API for real-time satellite imagery
        if (planetKey === 'earth') {
            this.loadEarthImagery(material);
            return;
        }
        
        // Try to get real NASA imagery from NASA Image Library API
        console.log(`🔍 Fetching real NASA imagery for ${planetKey}...`);
        this.nasaAPI.getRealPlanetTexture(planetKey).then(imageData => {
            if (imageData && imageData.url) {
                console.log(`📸 Loading NASA image for ${planetKey}: ${imageData.title}`);
                textureLoader.load(
                    imageData.url,
                    (texture) => {
                        texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
                        material.map = texture;
                        material.color.setHex(0xffffff);
                        material.needsUpdate = true;
                        console.log(`✅ Successfully loaded NASA image for ${planetKey}`);
                    },
                    undefined,
                    (error) => {
                        console.warn(`📸 NASA image failed for ${planetKey}, using procedural texture`);
                        this.createProceduralTexture(planetKey, material);
                    }
                );
            } else {
                console.log(`ℹ️ No NASA image found for ${planetKey}, generating procedural texture`);
                this.createProceduralTexture(planetKey, material);
            }
        }).catch(error => {
            console.warn(`⚠️ Error loading NASA texture for ${planetKey}:`, error.message || error);
            this.createProceduralTexture(planetKey, material);
        });
    }
    
    /**
     * Create procedural texture using canvas (always works, no CORS issues)
     */
    createProceduralTexture(planetKey, material, baseColorOverride = null) {
        console.log(`🎨 Generating procedural texture for ${planetKey}...`);
        
        // Planet colors
        const planetColors = {
            mercury: 0x8C7853,
            venus: 0xFFC649,
            mars: 0xCD5C5C,
            jupiter: 0xC88B3A,
            saturn: 0xFAD5A5,
            uranus: 0x4FD0E7,
            neptune: 0x4166F5
        };
        
        const baseColor = baseColorOverride || planetColors[planetKey] || 0xaaaaaa;
        
        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = 1024; // Higher resolution
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        
        // Create gradient for realistic sphere shading
        const gradient = ctx.createRadialGradient(
            canvas.width * 0.4, canvas.height * 0.4, 0,
            canvas.width * 0.5, canvas.height * 0.5, canvas.width * 0.6
        );
        
        // Convert hex color to rgb
        const r = (baseColor >> 16) & 255;
        const g = (baseColor >> 8) & 255;
        const b = baseColor & 255;
        
        gradient.addColorStop(0, `rgb(${Math.min(r + 60, 255)}, ${Math.min(g + 60, 255)}, ${Math.min(b + 60, 255)})`);
        gradient.addColorStop(0.5, `rgb(${r}, ${g}, ${b})`);
        gradient.addColorStop(1, `rgb(${Math.max(r - 80, 0)}, ${Math.max(g - 80, 0)}, ${Math.max(b - 80, 0)})`);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add texture detail based on planet type
        if (planetKey === 'jupiter' || planetKey === 'saturn') {
            // Add horizontal bands for gas giants
            ctx.globalAlpha = 0.3;
            for (let y = 0; y < canvas.height; y += 40 + Math.random() * 60) {
                const bandHeight = 20 + Math.random() * 40;
                ctx.fillStyle = Math.random() > 0.5 ? 
                    `rgb(${r + 20}, ${g + 20}, ${b + 20})` : 
                    `rgb(${r - 20}, ${g - 20}, ${b - 20})`;
                ctx.fillRect(0, y, canvas.width, bandHeight);
            }
            ctx.globalAlpha = 1.0;
        } else {
            // Add surface noise for rocky planets
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                const noise = (Math.random() - 0.5) * 30;
                data[i] = Math.max(0, Math.min(255, data[i] + noise));
                data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
                data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
            }
            ctx.putImageData(imageData, 0, 0);
        }
        
        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        material.map = texture;
        material.color.setHex(0xffffff);
        material.roughness = 0.8;
        material.metalness = 0.1;
        material.needsUpdate = true;
        
        console.log(`✅ Generated high-quality procedural texture for ${planetKey}`);
    }

    /**
     * Create 3D asteroid object
     */
    createAsteroid(asteroidData, index) {
        try {
            // Validate asteroid data
            if (!asteroidData || !asteroidData.id || !asteroidData.name) {
                console.warn('⚠️ Invalid asteroid data - missing id or name, skipping');
                return false;
            }
            
            // Scale asteroid size for visibility (more realistic)
            const size = Math.max(0.05, Math.min(asteroidData.diameter_km_avg * 0.5, 1.5));
            
            // Determine danger level based on distance and hazard status
            const missDistanceKm = asteroidData.miss_distance_km || asteroidData.close_approach_data?.[0]?.miss_distance?.kilometers;
            if (!missDistanceKm) {
                console.warn(`⚠️ ${asteroidData.name}: No miss distance data, skipping`);
                return false;
            }
            
            const isVeryClose = missDistanceKm < 1000000; // < 1 million km (Very dangerous)
            const isClose = missDistanceKm < 7480000; // < 0.05 AU (Close)
            const isModerate = missDistanceKm < 30000000; // < 0.2 AU (Moderate)
            const isPotentiallyHazardous = asteroidData.is_potentially_hazardous;
            
            // Color coding based on danger level
            let asteroidColor, orbitColor, dangerLevel;
            if (isPotentiallyHazardous && isVeryClose) {
                asteroidColor = 0xff0000; // Bright red - Very dangerous
                orbitColor = 0xff0000;
                dangerLevel = 'EXTREME';
            } else if (isPotentiallyHazardous || isClose) {
                asteroidColor = 0xff6666; // Red - Dangerous
                orbitColor = 0xff3333;
                dangerLevel = 'HIGH';
            } else if (isModerate) {
                asteroidColor = 0xffaa00; // Orange - Moderate risk
                orbitColor = 0xffaa00;
                dangerLevel = 'MODERATE';
            } else {
                asteroidColor = 0x00ff00; // Green - Safe
                orbitColor = 0x00ff00;
                dangerLevel = 'SAFE';
            }
            
            // Create irregular asteroid geometry
            const geometry = new THREE.IcosahedronGeometry(size, 1);
            
            // Randomize vertices for irregular shape
            const positions = geometry.attributes.position.array;
            for (let i = 0; i < positions.length; i += 3) {
                const vertex = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]);
                vertex.normalize();
                vertex.multiplyScalar(size * (0.8 + Math.random() * 0.4));
                positions[i] = vertex.x;
                positions[i + 1] = vertex.y;
                positions[i + 2] = vertex.z;
            }
            geometry.computeVertexNormals();
            
            // Better material for asteroids with color coding
            // Make asteroid mesh invisible - we only show orbits
            const material = new THREE.MeshStandardMaterial({ 
                color: asteroidColor,
                roughness: 0.9,
                metalness: 0.2,
                transparent: true,
                opacity: 0.0, // INVISIBLE - only orbits are shown
                emissive: asteroidColor,
                emissiveIntensity: isPotentiallyHazardous ? 0.3 : 0.1,
                visible: false // Completely hidden
            });
            
            const asteroid = new THREE.Mesh(geometry, material);
            asteroid.visible = false; // Make mesh invisible
            asteroid.name = asteroidData.name;
            asteroid.userData = {
                type: 'asteroid',
                nasaData: asteroidData,
                info: this.nasaAPI.formatAsteroidInfo(asteroidData),
                dangerLevel: dangerLevel,
                missDistance: missDistanceKm,
                orbitColor: orbitColor
            };
            
            // ONLY USE REAL NASA ORBITAL DATA - NO FAKE DATA!
            if (!asteroidData.orbital_data) {
                console.warn(`⚠️ ${asteroidData.name}: No real orbital data from NASA, skipping (no fake data allowed)`);
                return false;
            }
            
            // Extract REAL orbital elements from NASA
            const a = parseFloat(asteroidData.orbital_data.semi_major_axis);
            const e = parseFloat(asteroidData.orbital_data.eccentricity);
            const i = parseFloat(asteroidData.orbital_data.inclination) * Math.PI / 180;
            const Omega = parseFloat(asteroidData.orbital_data.ascending_node_longitude) * Math.PI / 180;
            const omega = parseFloat(asteroidData.orbital_data.perihelion_argument) * Math.PI / 180;
            const M = parseFloat(asteroidData.orbital_data.mean_anomaly) * Math.PI / 180;
            
            console.log(`✅ REAL NASA DATA for ${asteroidData.name}: a=${a.toFixed(3)} AU, e=${e.toFixed(3)}, i=${(i*180/Math.PI).toFixed(1)}°`);
            
            // Validate orbital elements
            if (isNaN(a) || a <= 0 || isNaN(e) || e < 0 || e >= 1) {
                console.warn(`⚠️ ${asteroidData.name}: Invalid orbital elements, skipping`);
                return false;
            }
            
            // Calculate position using Kepler's equation
            let E = M;
            for (let iter = 0; iter < 10; iter++) {
                E = M + e * Math.sin(E);
            }
            
            const nu = 2 * Math.atan2(
                Math.sqrt(1 + e) * Math.sin(E / 2),
                Math.sqrt(1 - e) * Math.cos(E / 2)
            );
            
            const r = a * (1 - e * Math.cos(E));
            
            // Position in orbital plane
            const xOrb = r * Math.cos(nu);
            const yOrb = r * Math.sin(nu);
            
            // Rotate to 3D space
            const cosOmega = Math.cos(omega);
            const sinOmega = Math.sin(omega);
            const cosOmegaBig = Math.cos(Omega);
            const sinOmegaBig = Math.sin(Omega);
            const cosI = Math.cos(i);
            const sinI = Math.sin(i);
            
            // Transform to 3D space - SAME COORDINATE SYSTEM AS PLANETS!
            // Ecliptic plane = XY plane, Z = perpendicular (matches planet coordinate system)
            const x3d = (cosOmega * cosOmegaBig - sinOmega * sinOmegaBig * cosI) * xOrb +
                       (-sinOmega * cosOmegaBig - cosOmega * sinOmegaBig * cosI) * yOrb;
            
            const y3d = (cosOmega * sinOmegaBig + sinOmega * cosOmegaBig * cosI) * xOrb +
                       (-sinOmega * sinOmegaBig + cosOmega * cosOmegaBig * cosI) * yOrb;
            
            const z3d = (sinOmega * sinI) * xOrb + (cosOmega * sinI) * yOrb;
            
            // Scale to scene units (1 AU = 15 units)
            asteroid.position.x = x3d * 15;
            asteroid.position.y = y3d * 15;  // Y is in ecliptic plane (like planets)
            asteroid.position.z = z3d * 15;  // Z is perpendicular to ecliptic
        
        // Random rotation for visual variety
        asteroid.rotation.x = Math.random() * Math.PI * 2;
        asteroid.rotation.y = Math.random() * Math.PI * 2;
        asteroid.rotation.z = Math.random() * Math.PI * 2;
        
        // Store orbital elements for orbit creation
        asteroid.userData.orbitalElements = { a, e, i, Omega, omega, M };
        
        this.asteroids[asteroidData.id] = asteroid;
        this.scene.add(asteroid);
        
        console.log(`🪨 ${asteroidData.name}: pos=(${asteroid.position.x.toFixed(1)}, ${asteroid.position.y.toFixed(1)}, ${asteroid.position.z.toFixed(1)})`);
        
        // Create elliptical orbit
        this.createSimpleOrbit(asteroid, asteroidData, a, e, i, Omega, omega);
        
        return true; // Success!
        
        } catch (error) {
            console.error(`❌ Error creating asteroid ${asteroidData?.name || 'unknown'}:`, error.message);
            return false; // Failed
        }
    }
    
    /**
     * Create elliptical orbit using orbital elements
     */
    createSimpleOrbit(asteroid, asteroidData, a, e, i, Omega, omega) {
        const orbitPoints = [];
        const segments = 180;
        
        console.log(`🛰️ ${asteroidData.name}: Creating orbit (a=${a.toFixed(3)} AU, e=${e.toFixed(3)})`);
        
        // Generate elliptical orbit points around the SUN
        for (let j = 0; j <= segments; j++) {
            const nu = (j / segments) * 2 * Math.PI; // True anomaly
            
            // Distance from sun (Kepler's first law)
            const r = a * (1 - e * e) / (1 + e * Math.cos(nu));
            
            // Position in orbital plane
            const xOrb = r * Math.cos(nu);
            const yOrb = r * Math.sin(nu);
            
            // Rotate to 3D space
            const cosOmega = Math.cos(omega);
            const sinOmega = Math.sin(omega);
            const cosOmegaBig = Math.cos(Omega);
            const sinOmegaBig = Math.sin(Omega);
            const cosI = Math.cos(i);
            const sinI = Math.sin(i);
            
            // Transform to 3D - SAME COORDINATE SYSTEM AS PLANETS!
            // Ecliptic plane = XY plane, Z = perpendicular
            const x3d = (cosOmega * cosOmegaBig - sinOmega * sinOmegaBig * cosI) * xOrb +
                       (-sinOmega * cosOmegaBig - cosOmega * sinOmegaBig * cosI) * yOrb;
            
            const y3d = (cosOmega * sinOmegaBig + sinOmega * cosOmegaBig * cosI) * xOrb +
                       (-sinOmega * sinOmegaBig + cosOmega * cosOmegaBig * cosI) * yOrb;
            
            const z3d = (sinOmega * sinI) * xOrb + (cosOmega * sinI) * yOrb;
            
            // Scale to scene units (1 AU = 15 units)
            orbitPoints.push(new THREE.Vector3(x3d * 15, y3d * 15, z3d * 15));
        }
        
        const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
        
        // Determine orbit color based on danger level
        let orbitColor;
        const dangerLevel = asteroid.userData.dangerLevel;
        
        if (dangerLevel === 'EXTREME' || dangerLevel === 'HIGH') {
            orbitColor = 0xff0000; // RED for high risk (extreme/high)
        } else if (dangerLevel === 'MODERATE') {
            orbitColor = 0xffff00; // YELLOW for moderate risk
        } else {
            orbitColor = 0x00ff00; // GREEN for safe
        }
        
        const orbitMaterial = new THREE.LineBasicMaterial({
            color: orbitColor,
            transparent: true,
            opacity: 0.6,
            linewidth: 2
        });
        
        const orbit = new THREE.Line(orbitGeometry, orbitMaterial);
        orbit.name = `asteroid_orbit_${asteroidData.id}`;
        orbit.visible = true; // Show all orbits by default
        orbit.userData = {
            type: 'asteroid_orbit',
            asteroidId: asteroidData.id,
            asteroidName: asteroidData.name,
            dangerLevel: asteroid.userData.dangerLevel,
            isHighlighted: false,
            normalColor: orbitColor, // Color based on danger level
            highlightColor: 0x0066ff, // BLUE for highlight
            normalOpacity: 0.6,
            highlightOpacity: 1.0
        };
        
        this.scene.add(orbit);
        asteroid.userData.orbitLine = orbit;
        this.orbits[asteroidData.id] = orbit;
        
        console.log(`✅ Orbit created for ${asteroidData.name} (${orbitPoints.length} points)`);
    }
    
    /**
     * Highlight specific asteroid and its orbit
     */
    highlightAsteroid(asteroidId) {
        // Reset all asteroids to normal state
        Object.values(this.asteroids).forEach(ast => {
            if (ast.userData.orbitLine) {
                ast.userData.orbitLine.material.opacity = ast.userData.orbitLine.userData.normalOpacity;
                ast.userData.orbitLine.material.linewidth = 3;
                ast.userData.orbitLine.userData.isHighlighted = false;
            }
            if (ast.material) {
                const isPotentiallyHazardous = ast.userData.nasaData?.is_potentially_hazardous;
                ast.material.emissiveIntensity = isPotentiallyHazardous ? 0.3 : 0.1;
            }
        });
        
        // Highlight selected asteroid
        const asteroid = this.asteroids[asteroidId];
        if (asteroid) {
            // Make orbit brighter and thicker
            if (asteroid.userData.orbitLine) {
                asteroid.userData.orbitLine.material.opacity = 1.0;
                asteroid.userData.orbitLine.material.linewidth = 5;
                asteroid.userData.orbitLine.userData.isHighlighted = true;
            }
            // Make asteroid glow more
            if (asteroid.material) {
                asteroid.material.emissiveIntensity = 0.7;
            }
            
            // Focus camera on asteroid
            this.focusOnObject(asteroid);
            
            console.log(`✨ Highlighted asteroid: ${asteroid.name} and its orbit`);
        }
    }

    /**
     * Update asteroid list in UI
     */
    updateAsteroidUI(asteroids) {
        console.log('\n🔍 ===== updateAsteroidUI CALLED =====');
        console.log(`📥 Displaying ${asteroids ? asteroids.length : 0} asteroids`);
        
        const asteroidList = document.getElementById('asteroid-list');
        if (!asteroidList) {
            console.error('❌ asteroid-list element not found!');
            return;
        }
        
        asteroidList.innerHTML = '';
        
        // Sort by danger level and distance
        asteroids.sort((a, b) => {
            const aDistance = a.miss_distance_km || a.close_approach_data?.[0]?.miss_distance?.kilometers || Infinity;
            const bDistance = b.miss_distance_km || b.close_approach_data?.[0]?.miss_distance?.kilometers || Infinity;
            
            // Prioritize hazardous asteroids
            if (a.is_potentially_hazardous && !b.is_potentially_hazardous) return -1;
            if (!a.is_potentially_hazardous && b.is_potentially_hazardous) return 1;
            
            // Then sort by distance
            return aDistance - bDistance;
        });
        
        // Show all asteroids
        asteroids.forEach(asteroid => {
            const missDistance = asteroid.miss_distance_km || asteroid.close_approach_data?.[0]?.miss_distance?.kilometers;
            const isVeryClose = missDistance < 1000000;
            const isClose = missDistance < 7480000;
            const isModerate = missDistance < 30000000;
            const isPotentiallyHazardous = asteroid.is_potentially_hazardous;
            
            // Determine danger level
            let dangerLevel, dangerColor, dangerIcon;
            if (isPotentiallyHazardous && isVeryClose) {
                dangerLevel = 'EXTREME'; // Match the filter system
                dangerColor = '#ff0000';
                dangerIcon = '🔴';
            } else if (isPotentiallyHazardous || isClose) {
                dangerLevel = 'HIGH'; // Match the filter system
                dangerColor = '#ff6666';
                dangerIcon = '🟠';
            } else if (isModerate) {
                dangerLevel = 'MODERATE';
                dangerColor = '#ffaa00';
                dangerIcon = '🟡';
            } else {
                dangerLevel = 'SAFE';
                dangerColor = '#00ff00';
                dangerIcon = '🟢';
            }
            
            const asteroidDiv = document.createElement('div');
            asteroidDiv.className = 'asteroid-item';
            asteroidDiv.dataset.danger = dangerLevel; // CRITICAL: Set data-danger for filtering!
            
            if (asteroid.is_potentially_hazardous) {
                asteroidDiv.classList.add('hazardous');
            }
            
            if (isClose) {
                asteroidDiv.classList.add('close-approach');
            }
            
            asteroidDiv.style.borderLeftColor = dangerColor;
            asteroidDiv.style.borderLeftWidth = '4px';
            
            const sizeCategory = asteroid.diameter_km_avg > 1 ? 'Large' : asteroid.diameter_km_avg > 0.1 ? 'Medium' : 'Small';
            
            // Check if this asteroid has an orbit in the 3D scene
            const hasOrbit = this.asteroids[asteroid.id] !== undefined;
            
            asteroidDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <div class="asteroid-name">${dangerIcon} ${asteroid.name.replace(/[()]/g, '')}</div>
                    <span style="background: ${dangerColor}; color: ${dangerLevel === 'SAFE' ? 'black' : 'white'}; padding: 3px 10px; border-radius: 12px; font-size: 0.7rem; font-weight: bold;">
                        ${dangerLevel}
                    </span>
                </div>
                <div class="asteroid-details" style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 0.85rem; margin-bottom: 4px;">
                    <span class="asteroid-size">📏 ${asteroid.diameter_km_avg.toFixed(3)} km</span>
                    <span>${sizeCategory} Object</span>
                    <span class="asteroid-velocity">⚡ ${asteroid.velocity_kmps.toFixed(1)} km/s</span>
                    <span class="asteroid-distance">📍 ${(missDistance / 1000).toFixed(0)}K km</span>
                </div>
                <div style="font-size: 0.75rem; color: #888; text-align: center; padding: 4px; background: rgba(255,255,255,0.05); border-radius: 4px;">
                    ${isPotentiallyHazardous ? '⚠️ Potentially Hazardous' : '✅ Non-Hazardous'} • ${hasOrbit ? '🎯 Click to highlight orbit' : '⚪ No orbit data'}
                </div>
            `;
            
            // Add hover effect
            asteroidDiv.style.cursor = hasOrbit ? 'pointer' : 'default';
            asteroidDiv.style.transition = 'all 0.2s ease';
            
            asteroidDiv.addEventListener('mouseenter', () => {
                if (hasOrbit) {
                    asteroidDiv.style.transform = 'translateX(5px)';
                    asteroidDiv.style.background = 'rgba(255,255,255,0.1)';
                }
            });
            
            asteroidDiv.addEventListener('mouseleave', () => {
                asteroidDiv.style.transform = 'translateX(0)';
                asteroidDiv.style.background = '';
            });
            
            // Only add click handler if asteroid has an orbit
            if (hasOrbit) {
                asteroidDiv.addEventListener('click', () => {
                    this.selectAsteroid(asteroid.id);
                });
            }
            
            asteroidList.appendChild(asteroidDiv);
        });
        
        console.log(`✅ Displayed ${asteroids.length} asteroids in the list`);
        console.log('===== updateAsteroidUI COMPLETE =====\n');
    }

    /**
     * Select and focus on an asteroid
     */
    selectAsteroid(asteroidId) {
        const asteroid = this.asteroids[asteroidId];
        if (asteroid) {
            // Highlight orbit in BLUE
            const orbit = this.orbits[asteroidId];
            if (orbit) {
                this.highlightOrbit(orbit);
            }
            
            this.selectedObject = asteroid;
            this.updateSelectedObjectInfo(asteroid.userData.info);
            
            console.log(`📍 Selected asteroid: ${asteroid.name}`);
        }
    }

    /**
     * Focus camera on Earth with professional top-angled view
     */
    focusOnEarth() {
        if (this.planets.earth) {
            const earth = this.planets.earth;
            const earthPosition = earth.position.clone();
            
            // Professional NASA-style top-angled view (bird's eye with slight tilt)
            const cameraDistance = 30; // Further back for better overview
            const elevationAngle = Math.PI / 3; // 60 degrees (more top-down)
            const azimuthAngle = Math.PI / 6; // 30 degrees rotation
            
            // Calculate position using spherical coordinates for smooth positioning
            const cameraPosition = new THREE.Vector3(
                earthPosition.x + cameraDistance * Math.sin(elevationAngle) * Math.cos(azimuthAngle),
                earthPosition.y + cameraDistance * Math.cos(elevationAngle), // Higher altitude
                earthPosition.z + cameraDistance * Math.sin(elevationAngle) * Math.sin(azimuthAngle)
            );
            
            this.camera.position.copy(cameraPosition);
            this.camera.lookAt(earthPosition);
            this.controls.target.copy(earthPosition);
            
            console.log('✅ Camera focused on Earth');
        }
    }

    /**
     * Professional NASA-style camera focus with smart auto-return logic
     */
    focusOnObject(object) {
        if (!object) return;
        
        // Clear any existing auto-return timeout
        if (this.cameraReturnTimeout) {
            clearTimeout(this.cameraReturnTimeout);
        }
        
        const targetPosition = object.position.clone();
        const objectName = object.name || object.userData?.planetKey || '';
        const isAsteroid = object.userData?.type === 'asteroid';
        const isSameObject = this.currentFocusedObject === object;
        
        // Update current focused object tracking
        this.currentFocusedObject = object;
        
        console.log(`🎯 Focusing on: ${objectName}${isAsteroid ? ' (Asteroid)' : ''}${isSameObject ? ' (Same object)' : ' (New object)'}`);
        
        // Calculate optimal camera distance based on object type (NASA professional standards)
        let cameraDistance = 20;
        if (objectName.includes('sun')) cameraDistance = 100; // Further back to see full corona
        else if (objectName.includes('jupiter')) cameraDistance = 100; // Much more zoomed out for Jupiter
        else if (objectName.includes('saturn')) cameraDistance = 120; // Extra zoom for ring system viewing
        else if (objectName.includes('uranus')) cameraDistance = 70; // More zoomed out for Uranus
        else if (objectName.includes('neptune')) cameraDistance = 70; // More zoomed out for Neptune
        else if (objectName.includes('earth')) cameraDistance = 25; // Comfortable Earth view
        else if (objectName.includes('mars')) cameraDistance = 20; // Good Mars view
        else if (objectName.includes('venus')) cameraDistance = 18;
        else if (objectName.includes('mercury')) cameraDistance = 15;
        else if (isAsteroid) cameraDistance = 10; // Slightly further for asteroids
        
        // Professional cinematic camera positioning (3/4 top view)
        const elevationAngle = Math.PI / 3; // 60 degrees from horizontal (top-down bias)
        const azimuthAngle = Math.PI / 4; // 45 degrees rotation for 3/4 view
        
        // Use spherical coordinates for smooth, professional positioning
        const horizontalRadius = cameraDistance * Math.sin(elevationAngle);
        const verticalHeight = cameraDistance * Math.cos(elevationAngle);
        
        const newCameraPosition = new THREE.Vector3(
            targetPosition.x + horizontalRadius * Math.cos(azimuthAngle),
            targetPosition.y + verticalHeight, // Higher for better top-down view
            targetPosition.z + horizontalRadius * Math.sin(azimuthAngle)
        );
        
        // Smooth professional camera transition
        this.animateCameraToTarget(newCameraPosition, targetPosition, () => {
            console.log(`📸 Camera focused on: ${objectName}`);
            
            // ⭐ SMART AUTO-RETURN LOGIC ⭐
            // Only set auto-return timeout if:
            // 1. Not focusing on Earth (Earth is home view)
            // 2. Not an asteroid (asteroids should stay focused)
            // 3. Not the same object (clicking same planet again shouldn't reset timer)
            if (!objectName.includes('earth') && !isAsteroid && !isSameObject) {
                console.log('⏰ Setting auto-return timer (8 seconds) - Different planet clicked');
                this.cameraReturnTimeout = setTimeout(() => {
                    console.log('🌍 Auto-returning to Earth view...');
                    if (this.planets.earth) {
                        this.focusOnObject(this.planets.earth);
                    }
                }, 8000);
            } else if (isSameObject) {
                console.log('✨ Same object clicked - keeping current view without auto-return');
            } else if (isAsteroid) {
                console.log('☄️ Asteroid focused - no auto-return');
            }
        });
    }

    /**
     * Professional camera animation with cubic easing (NASA-quality smoothness)
     */
    animateCameraToTarget(targetPosition, lookAtPosition, onComplete) {
        const startPosition = this.camera.position.clone();
        const startTarget = this.controls.target.clone();
        const startTime = Date.now();
        const duration = 2000; // 2 seconds smooth transition
        
        const animateStep = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Professional cubic ease-in-out (smooth acceleration and deceleration)
            const eased = progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;
            
            // Smoothly interpolate camera position
            this.camera.position.lerpVectors(startPosition, targetPosition, eased);
            
            // Smoothly interpolate OrbitControls target
            if (lookAtPosition) {
                this.controls.target.lerpVectors(startTarget, lookAtPosition, eased);
                this.controls.update();
            }
            
            if (progress < 1) {
                requestAnimationFrame(animateStep);
            } else if (onComplete) {
                onComplete();
            }
        };
        
        animateStep();
    }

    /**
     * Update orbital positions based on time
     */
    /**
     * Update orbital positions based on current simulation time
     */
    updateOrbitalPositions() {
        // Calculate Julian Date for accurate ephemeris
        const julianDate = this.nasaAPI.dateToJulian(this.simulationDate);
        
        // Calculate time difference in Earth days for rotation
        const referenceDate = new Date('2000-01-01T12:00:00Z'); // J2000 epoch
        const daysSinceEpoch = (this.simulationDate.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24);
        
        // Update planets with accurate orbital mechanics
        Object.keys(this.planets).forEach(planetKey => {
            const planet = this.planets[planetKey];
            const planetInfo = this.planetData[planetKey];
            
            // Use accurate planetary position calculation from NASA orbital elements
            const position = this.nasaAPI.calculatePlanetaryPosition(planetKey, julianDate);
            
            // Scale position for visualization (AU to scene units)
            planet.position.x = position.x * 15;
            planet.position.y = position.y * 15;
            planet.position.z = position.z * 15;
            
            // Calculate real-time rotation based on actual rotation period
            if (planetInfo && planetInfo.rotationPeriod) {
                // Calculate how many rotations have occurred since epoch
                const rotations = daysSinceEpoch / planetInfo.rotationPeriod;
                // Convert to radians (2π per rotation)
                planet.rotation.y = rotations * Math.PI * 2;
                
                // Venus rotates retrograde (backwards)
                if (planetKey === 'venus') {
                    planet.rotation.y = -planet.rotation.y;
                }
                
                // For Earth, add 180-degree rotation so India (78°E) faces the Sun at 2 PM
                if (planetKey === 'earth') {
                    planet.rotation.y += Math.PI; // Add 180 degrees
                }
            }
        });

        // Update asteroids with orbital mechanics
        Object.keys(this.asteroids).forEach(asteroidId => {
            const asteroid = this.asteroids[asteroidId];
            const nasaData = asteroid.userData.nasaData;
            
            // Calculate time difference in days for asteroid orbital calculation
            const timeDays = (this.simulationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
            
            // Use NASA API service for orbital calculation
            const position = this.nasaAPI.calculateOrbitalPosition(nasaData, timeDays);
            
            // Scale position for visualization
            asteroid.position.x = position.x * 15;
            asteroid.position.y = position.y * 15;
            asteroid.position.z = position.z * 15;
            
            // Rotate asteroid (random tumbling)
            asteroid.rotation.x += 0.02;
            asteroid.rotation.y += 0.01;
        });

        // Follow Earth camera mode
        if (this.followEarth && this.planets.earth) {
            const earth = this.planets.earth;
            const offset = new THREE.Vector3(10, 5, 10);
            const newPosition = earth.position.clone().add(offset);
            this.camera.position.lerp(newPosition, 0.02);
            this.controls.target.lerp(earth.position, 0.02);
        }
    }

    /**
     * Handle mouse interactions
     */
    setupEventListeners() {
        // Mouse click for object selection
        this.renderer.domElement.addEventListener('click', (event) => {
            this.onMouseClick(event);
        });

        // Window resize
        window.addEventListener('resize', () => {
            this.onWindowResize();
        });
    }

    /**
     * Handle mouse click for object selection
     */
    onMouseClick(event) {
        // Calculate mouse position in normalized device coordinates
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Raycast to find intersected objects
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Check for PLANET orbit clicks first
        const planetOrbitLines = [];
        ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'].forEach(key => {
            const orbitLine = this.scene.getObjectByName(`${key}_orbit`);
            if (orbitLine && orbitLine.visible) {
                planetOrbitLines.push(orbitLine);
            }
        });
        
        const planetOrbitIntersects = this.raycaster.intersectObjects(planetOrbitLines);
        if (planetOrbitIntersects.length > 0) {
            const clickedOrbit = planetOrbitIntersects[0].object;
            const planetKey = clickedOrbit.name.replace('_orbit', '');
            const planet = this.planets[planetKey];
            
            if (planet) {
                // Highlight planet orbit in blue
                this.highlightPlanetOrbit(planetKey);
                // Focus camera on planet
                this.focusOnObject(planet);
                // Show planet data
                const info = planet.userData.info || {
                    title: planet.name || planetKey.toUpperCase(),
                    details: [`Clicked on ${planetKey} orbit`]
                };
                this.updateSelectedObjectInfo(info);
                console.log(`🪐 Clicked on ${planetKey.toUpperCase()} orbit`);
                return;
            }
        }
        
        // Check for asteroid orbit clicks
        const asteroidOrbits = Object.values(this.orbits).filter(orbit => orbit.userData.type === 'asteroid_orbit' && orbit.visible);
        const orbitIntersects = this.raycaster.intersectObjects(asteroidOrbits);
        
        if (orbitIntersects.length > 0) {
            // Clicked on an asteroid orbit - highlight it
            const clickedOrbit = orbitIntersects[0].object;
            this.highlightOrbit(clickedOrbit);
            console.log(`🎯 Clicked on asteroid orbit: ${clickedOrbit.userData.asteroidName}`);
            return;
        }
        
        // Check for planet/asteroid object clicks
        const allObjects = [...Object.values(this.planets), ...Object.values(this.asteroids), this.sun];
        const intersects = this.raycaster.intersectObjects(allObjects);

        if (intersects.length > 0) {
            const selectedObject = intersects[0].object;
            this.selectedObject = selectedObject;
            
            // If it's a planet, highlight its orbit too
            const planetKey = selectedObject.userData?.planetKey;
            if (planetKey) {
                this.highlightPlanetOrbit(planetKey);
            }
            
            this.focusOnObject(selectedObject);
            
            // Update info display
            const info = selectedObject.userData.info || {
                title: selectedObject.name,
                details: ['No additional information available']
            };
            this.updateSelectedObjectInfo(info);
        }
    }
    
    /**
     * Highlight a planet's orbit in blue
     */
    highlightPlanetOrbit(planetKey) {
        const orbitLine = this.scene.getObjectByName(`${planetKey}_orbit`);
        if (!orbitLine) return;
        
        // Store original color if not already stored
        if (!orbitLine.userData.originalColor) {
            orbitLine.userData.originalColor = orbitLine.material.color.getHex();
            orbitLine.userData.originalOpacity = orbitLine.material.opacity;
        }
        
        // Reset all planet orbits to normal
        ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'].forEach(key => {
            const orbit = this.scene.getObjectByName(`${key}_orbit`);
            if (orbit && orbit.userData.originalColor) {
                orbit.material.color.setHex(orbit.userData.originalColor);
                orbit.material.opacity = orbit.userData.originalOpacity;
                orbit.material.needsUpdate = true;
            }
        });
        
        // Highlight selected planet orbit in BRIGHT BLUE
        orbitLine.material.color.setHex(0x00BFFF); // DeepSkyBlue
        orbitLine.material.opacity = 1.0;
        orbitLine.material.needsUpdate = true;
        
        console.log(`✨ ${planetKey.toUpperCase()} orbit highlighted in BLUE`);
        
        // Auto-restore after 8 seconds
        setTimeout(() => {
            if (orbitLine.userData.originalColor) {
                orbitLine.material.color.setHex(orbitLine.userData.originalColor);
                orbitLine.material.opacity = orbitLine.userData.originalOpacity;
                orbitLine.material.needsUpdate = true;
            }
        }, 8000);
    }
    
    /**
     * Highlight a specific orbit (turn it BLUE)
     */
    highlightOrbit(orbit) {
        // Un-highlight all other asteroid orbits (back to their original color)
        Object.values(this.orbits).forEach(o => {
            if (o.userData.type === 'asteroid_orbit' && o !== orbit) {
                o.material.color.setHex(o.userData.normalColor); // Restore original color (RED/YELLOW/GREEN)
                o.material.opacity = o.userData.normalOpacity; // 0.6
                o.material.needsUpdate = true;
                o.userData.isHighlighted = false;
            }
        });
        
        // Highlight the selected orbit (BLUE with glow)
        orbit.material.color.setHex(orbit.userData.highlightColor); // BLUE
        orbit.material.opacity = orbit.userData.highlightOpacity; // 1.0
        orbit.material.needsUpdate = true;
        orbit.userData.isHighlighted = true;
        
        console.log(`✨ Highlighted orbit: ${orbit.userData.asteroidName} in BLUE (camera stays in place)`);
        
        // Update info display WITHOUT moving camera
        const asteroidId = orbit.userData.asteroidId;
        const asteroid = this.asteroids[asteroidId];
        if (asteroid) {
            // Only update the info panel - NO camera movement
            this.updateSelectedObjectInfo(asteroid.userData.info);
            this.selectedObject = asteroid; // Update selected object for reference
        }
    }

    /**
     * Update selected object information display
     */
    updateSelectedObjectInfo(info) {
        const selectedObjectDiv = document.getElementById('selected-object');
        const objectName = selectedObjectDiv.querySelector('.object-name');
        const objectDetails = selectedObjectDiv.querySelector('.object-details');
        const knowMoreLink = document.getElementById('know-more-link');
        
        objectName.textContent = info.title || info.name || 'Unknown Object';
        objectDetails.innerHTML = (info.details || []).join('<br>');
        
        // Add NASA link if asteroid ID is available
        if (info.asteroidId) {
            const nasaUrl = `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${info.asteroidId}`;
            knowMoreLink.href = nasaUrl;
            knowMoreLink.style.display = 'block';
        } else {
            knowMoreLink.style.display = 'none';
        }
        
        selectedObjectDiv.style.display = 'block';
        
        // Hide after 15 seconds (increased for reading time)
        setTimeout(() => {
            selectedObjectDiv.style.display = 'none';
        }, 15000);
    }

    /**
     * Handle window resize
     */
    onWindowResize() {
        // Fix WebGL zero-size errors on resize
        const width = window.innerWidth || 800;
        const height = window.innerHeight || 600;
        
        if (width > 0 && height > 0) {
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        } else {
            console.warn('⚠️ Invalid window dimensions on resize');
        }
    }

    /**
     * Main animation loop
     */
    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());

        if (this.isPlaying) {
            if (this.realTimeMode) {
                // REAL-TIME MODE: Always sync to actual current time
                this.simulationDate = new Date();
            } else {
                // FAST-FORWARD MODE: Advance simulation time based on time multiplier
                const currentTime = Date.now();
                const deltaRealSeconds = (currentTime - this.lastFrameTime) / 1000;
                this.lastFrameTime = currentTime;
                
                // timeMultiplier = simulation seconds per real second
                const deltaSimulationMs = deltaRealSeconds * this.timeMultiplier * 1000;
                this.simulationDate = new Date(this.simulationDate.getTime() + deltaSimulationMs);
            }
            
            // Update orbital positions every frame with live NASA data
            this.updateOrbitalPositions();
        }

        // Update label positions and scale to follow planets
        if (this.showLabels) {
            Object.keys(this.labels).forEach(key => {
                const label = this.labels[key];
                const planet = this.planets[key];
                if (label && planet) {
                    // Position label above planet
                    label.position.copy(planet.position);
                    label.position.y += label.userData.offset.y;
                    
                    // Scale labels based on camera distance for constant screen size
                    const distance = this.camera.position.distanceTo(label.position);
                    const scaleFactor = distance / 50; // Adjust denominator to change label size
                    
                    if (label.userData.baseScale) {
                        label.scale.set(
                            label.userData.baseScale.x * scaleFactor,
                            label.userData.baseScale.y * scaleFactor,
                            1
                        );
                    }
                }
            });
        }

        // Animate asteroid belt rotation (slow tumbling)
        if (this.asteroidBelt && this.asteroidBelt.length > 0) {
            this.asteroidBelt.forEach(asteroid => {
                if (asteroid.userData.rotationSpeed) {
                    asteroid.rotation.x += asteroid.userData.rotationSpeed.x;
                    asteroid.rotation.y += asteroid.userData.rotationSpeed.y;
                    asteroid.rotation.z += asteroid.userData.rotationSpeed.z;
                }
            });
        }

        // Update controls
        this.controls.update();

        // Render scene
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Get planet information
     */
    getPlanetInfo(planetKey) {
        const planetInfo = {
            mercury: {
                title: 'Mercury',
                subtitle: 'The Swift Planet',
                details: [
                    '📏 Diameter: 4,879 km',
                    '🌡️ Temperature: -173°C to 427°C',
                    '⏱️ Day: 59 Earth days',
                    '🔄 Year: 88 Earth days',
                    '📍 Distance: 0.39 AU from Sun',
                    '🪨 Type: Terrestrial planet'
                ]
            },
            venus: {
                title: 'Venus',
                subtitle: 'The Morning Star',
                details: [
                    '📏 Diameter: 12,104 km',
                    '🌡️ Temperature: 462°C (hottest planet)',
                    '⏱️ Day: 243 Earth days',
                    '🔄 Year: 225 Earth days',
                    '📍 Distance: 0.72 AU from Sun',
                    '☁️ Atmosphere: 96% CO₂, thick clouds'
                ]
            },
            earth: {
                title: 'Earth',
                subtitle: 'Our Home Planet',
                details: [
                    '📏 Diameter: 12,756 km',
                    '🌡️ Temperature: -88°C to 58°C',
                    '⏱️ Day: 24 hours',
                    '🔄 Year: 365.25 days',
                    '📍 Distance: 1.00 AU from Sun',
                    '🌍 Only known planet with life'
                ]
            },
            mars: {
                title: 'Mars',
                subtitle: 'The Red Planet',
                details: [
                    '📏 Diameter: 6,792 km',
                    '🌡️ Temperature: -87°C to -5°C',
                    '⏱️ Day: 24.6 hours',
                    '🔄 Year: 687 Earth days',
                    '📍 Distance: 1.52 AU from Sun',
                    '🔴 Red color from iron oxide'
                ]
            },
            jupiter: {
                title: 'Jupiter',
                subtitle: 'The Gas Giant',
                details: [
                    '📏 Diameter: 142,984 km',
                    '🌡️ Temperature: -108°C',
                    '⏱️ Day: 9.9 hours',
                    '🔄 Year: 11.9 Earth years',
                    '📍 Distance: 5.20 AU from Sun',
                    '🌙 79+ known moons'
                ]
            },
            saturn: {
                title: 'Saturn',
                subtitle: 'The Ringed Planet',
                details: [
                    '📏 Diameter: 120,536 km',
                    '🌡️ Temperature: -139°C',
                    '⏱️ Day: 10.7 hours',
                    '🔄 Year: 29.4 Earth years',
                    '📍 Distance: 9.58 AU from Sun',
                    '💍 Spectacular ring system'
                ]
            },
            uranus: {
                title: 'Uranus',
                subtitle: 'The Ice Giant',
                details: [
                    '📏 Diameter: 51,118 km',
                    '🌡️ Temperature: -197°C',
                    '⏱️ Day: 17.2 hours',
                    '🔄 Year: 84 Earth years',
                    '📍 Distance: 19.18 AU from Sun',
                    '🔄 Rotates on its side'
                ]
            },
            neptune: {
                title: 'Neptune',
                subtitle: 'The Windy Planet',
                details: [
                    '📏 Diameter: 49,528 km',
                    '🌡️ Temperature: -201°C',
                    '⏱️ Day: 16.1 hours',
                    '🔄 Year: 164.8 Earth years',
                    '📍 Distance: 30.07 AU from Sun',
                    '💨 Fastest winds: 2,100 km/h'
                ]
            }
        };

        return planetInfo[planetKey] || {
            title: 'Unknown',
            details: ['No information available']
        };
    }

    /**
     * Control methods
     */
    toggleAnimation() {
        this.isPlaying = !this.isPlaying;
        if (this.isPlaying && !this.lastFrameTime) {
            this.lastFrameTime = Date.now();
        }
    }

    setTimeMultiplier(multiplier) {
        // multiplier in seconds per second
        // 1 = real-time, 86400 = 1 day per second
        if (multiplier === 1) {
            // Switch to real-time mode
            this.realTimeMode = true;
            this.simulationDate = new Date(); // Sync to NOW
        } else {
            // Switch to fast-forward mode
            this.realTimeMode = false;
            this.lastFrameTime = Date.now();
        }
        this.timeMultiplier = multiplier;
    }
    
    // NASA Eyes-style time navigation
    jumpToCurrentTime() {
        this.realTimeMode = true;
        this.simulationDate = new Date();
        this.lastFrameTime = Date.now();
        this.updateOrbitalPositions();
    }
    
    jumpToPreviousDay() {
        this.realTimeMode = false; // Switch to manual time control
        this.simulationDate = new Date(this.simulationDate.getTime() - 24 * 60 * 60 * 1000);
        this.lastFrameTime = Date.now();
        this.updateOrbitalPositions();
    }
    
    jumpToNextDay() {
        this.realTimeMode = false; // Switch to manual time control
        this.simulationDate = new Date(this.simulationDate.getTime() + 24 * 60 * 60 * 1000);
        this.lastFrameTime = Date.now();
        this.updateOrbitalPositions();
    }
    
    jumpToPreviousMonth() {
        this.realTimeMode = false;
        const date = new Date(this.simulationDate);
        date.setMonth(date.getMonth() - 1);
        this.simulationDate = date;
        this.lastFrameTime = Date.now();
        this.updateOrbitalPositions();
    }
    
    jumpToNextMonth() {
        this.realTimeMode = false;
        const date = new Date(this.simulationDate);
        date.setMonth(date.getMonth() + 1);
        this.simulationDate = date;
        this.lastFrameTime = Date.now();
        this.updateOrbitalPositions();
    }
    
    jumpToPreviousYear() {
        this.realTimeMode = false;
        const date = new Date(this.simulationDate);
        date.setFullYear(date.getFullYear() - 1);
        this.simulationDate = date;
        this.lastFrameTime = Date.now();
        this.updateOrbitalPositions();
    }
    
    jumpToNextYear() {
        this.realTimeMode = false;
        const date = new Date(this.simulationDate);
        date.setFullYear(date.getFullYear() + 1);
        this.simulationDate = date;
        this.lastFrameTime = Date.now();
        this.updateOrbitalPositions();
    }
    
    setSimulationDate(date) {
        this.simulationDate = new Date(date);
        this.updateOrbitalPositions();
    }
    
    getSimulationDate() {
        return this.simulationDate;
    }

    resetView() {
        this.camera.position.set(50, 30, 50);
        this.controls.target.set(0, 0, 0);
        this.selectedObject = null;
        document.getElementById('selected-object').style.display = 'none';
    }

    toggleOrbits() {
        this.showOrbits = !this.showOrbits;
        
        // Toggle planet orbits
        this.scene.children.forEach(child => {
            if (child.name && child.name.includes('_orbit')) {
                child.visible = this.showOrbits;
            }
        });
        
        // Toggle asteroid orbits
        Object.values(this.orbits).forEach(orbit => {
            orbit.visible = this.showOrbits;
        });
        
        console.log(`Orbits ${this.showOrbits ? 'shown' : 'hidden'}`);
    }
    
    /**
     * Show all asteroids and their orbits (called when Asteroids tab is clicked)
     */
    async showAsteroids() {
        console.log('\n� ========== SHOWING ASTEROID ORBITS ==========');
        
        if (!this.asteroidsLoaded) {
            console.log('⏳ Loading asteroid data from NASA...');
            await this.loadAsteroidData();
        }
        
        // Make ALL asteroid orbits visible in RED
        let visibleCount = 0;
        Object.values(this.orbits).forEach(orbit => {
            if (orbit.userData.type === 'asteroid_orbit') {
                orbit.visible = true;
                orbit.material.color.setHex(0xff0000); // RED
                orbit.material.opacity = 0.6;
                orbit.material.needsUpdate = true;
                visibleCount++;
            }
        });
        
        // Make asteroids visible too
        Object.values(this.asteroids).forEach(asteroid => {
            asteroid.visible = true;
        });
        
        console.log(`✅ Made ${visibleCount} color-coded asteroid orbits visible`);
        console.log('🔴 RED = High Risk, 🟡 YELLOW = Moderate Risk, 🟢 GREEN = Safe');
        console.log('💡 Click on any orbit or list item to highlight it in BLUE');
        console.log('==========================================\n');
        
        // Apply initial toggle filters (all should be active by default)
        // Trigger via event to app.js
        setTimeout(() => {
            const event = new CustomEvent('asteroids-loaded');
            window.dispatchEvent(event);
        }, 100);
    }

    /**
     * Load and display Main Asteroid Belt
     */
    async loadAsteroidBelt(count = 500) {
        if (this.asteroidBeltLoaded) {
            console.log('✅ Asteroid belt already loaded');
            this.showAsteroidBelt();
            return;
        }

        console.log(`🪨 Loading Main Asteroid Belt with ${count} asteroids...`);
        
        try {
            // Fetch real asteroid data from NASA
            const asteroidData = await this.nasaAPI.getMainBeltAsteroids(count);
            
            if (!asteroidData || asteroidData.length === 0) {
                console.error('❌ No asteroid belt data available');
                return;
            }

            console.log(`📊 Creating ${asteroidData.length} asteroid belt objects...`);
            
            // Create visual objects for each asteroid
            asteroidData.forEach((asteroidInfo, index) => {
                this.createAsteroidBeltObject(asteroidInfo, index);
            });

            // Add dust particles for enhanced realism
            this.createAsteroidDustParticles(2000);

            this.asteroidBeltLoaded = true;
            this.asteroidBeltVisible = true;
            console.log(`✅ Asteroid belt loaded with ${this.asteroidBelt.length} objects`);

            
        } catch (error) {
            console.error('❌ Error loading asteroid belt:', error);
        }
    }

    /**
     * Create a single asteroid belt object
     */
    createAsteroidBeltObject(asteroidInfo, index) {
        // Create realistic irregular rock shapes
        const size = 0.06 + Math.random() * 0.09; // Size range: 0.06-0.15
        
        // Mix of shapes for realism: spheres, irregular polyhedrons, and elongated rocks
        let geometry;
        const shapeType = Math.random();
        
        if (shapeType < 0.3) {
            // Spherical asteroids (30%)
            geometry = new THREE.SphereGeometry(size, 6, 6);
        } else if (shapeType < 0.6) {
            // Irregular rocky asteroids using dodecahedron (30%)
            geometry = new THREE.DodecahedronGeometry(size * 0.8);
            // Randomly deform vertices for irregularity
            const positions = geometry.attributes.position;
            for (let i = 0; i < positions.count; i++) {
                positions.setXYZ(
                    i,
                    positions.getX(i) * (0.7 + Math.random() * 0.6),
                    positions.getY(i) * (0.7 + Math.random() * 0.6),
                    positions.getZ(i) * (0.7 + Math.random() * 0.6)
                );
            }
            geometry.computeVertexNormals();
        } else {
            // Elongated/angular asteroids using icosahedron (40%)
            geometry = new THREE.IcosahedronGeometry(size * 0.9, 0);
            // Stretch along one axis for elongated look
            const stretchAxis = Math.floor(Math.random() * 3);
            const stretchFactor = 1.5 + Math.random() * 0.8;
            const positions = geometry.attributes.position;
            for (let i = 0; i < positions.count; i++) {
                if (stretchAxis === 0) {
                    positions.setX(i, positions.getX(i) * stretchFactor);
                } else if (stretchAxis === 1) {
                    positions.setY(i, positions.getY(i) * stretchFactor);
                } else {
                    positions.setZ(i, positions.getZ(i) * stretchFactor);
                }
            }
            geometry.computeVertexNormals();
        }
        
        // Realistic rocky colors based on asteroid composition
        // C-type (carbonaceous - dark): 75% of asteroids
        // S-type (silicate - lighter): 17% of asteroids  
        // M-type (metallic - grayish): 8% of asteroids
        let color;
        const asteroidType = Math.random();
        
        if (asteroidType < 0.75) {
            // C-type: Dark gray to black (carbonaceous)
            color = new THREE.Color(
                0.15 + Math.random() * 0.15,  // Red: 0.15-0.30
                0.12 + Math.random() * 0.13,  // Green: 0.12-0.25
                0.10 + Math.random() * 0.10   // Blue: 0.10-0.20
            );
        } else if (asteroidType < 0.92) {
            // S-type: Rocky brown-red (silicate)
            color = new THREE.Color(
                0.45 + Math.random() * 0.25,  // Red: 0.45-0.70
                0.35 + Math.random() * 0.20,  // Green: 0.35-0.55
                0.25 + Math.random() * 0.15   // Blue: 0.25-0.40
            );
        } else {
            // M-type: Metallic gray (metal-rich)
            color = new THREE.Color(
                0.50 + Math.random() * 0.20,  // Red: 0.50-0.70
                0.50 + Math.random() * 0.20,  // Green: 0.50-0.70
                0.52 + Math.random() * 0.18   // Blue: 0.52-0.70
            );
        }
        
        // Enhanced material with slight emissive glow for visibility
        const material = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.9 + Math.random() * 0.1,  // Very rough surface
            metalness: asteroidType > 0.92 ? 0.4 + Math.random() * 0.3 : 0.1,  // Metallic for M-type
            emissive: color,
            emissiveIntensity: 0.15,  // Slight glow for visibility in dark space
            flatShading: true  // Faceted look for rocky appearance
        });
        
        const asteroid = new THREE.Mesh(geometry, material);
        
        // Calculate position using orbital elements
        const position = this.calculateAsteroidPosition(asteroidInfo);
        asteroid.position.copy(position);
        
        // Random rotation for variety
        asteroid.rotation.x = Math.random() * Math.PI * 2;
        asteroid.rotation.y = Math.random() * Math.PI * 2;
        asteroid.rotation.z = Math.random() * Math.PI * 2;
        
        // Store rotation speed for animation (slow tumbling)
        asteroid.userData = {
            type: 'asteroid_belt',
            name: asteroidInfo.name,
            id: asteroidInfo.id,
            orbitalElements: asteroidInfo,
            isProcedural: asteroidInfo.isProcedural || false,
            rotationSpeed: {
                x: (Math.random() - 0.5) * 0.001,
                y: (Math.random() - 0.5) * 0.001,
                z: (Math.random() - 0.5) * 0.001
            }
        };
        
        this.scene.add(asteroid);
        this.asteroidBelt.push(asteroid);
    }

    /**
     * Create dust particles for asteroid belt realism
     */
    createAsteroidDustParticles(count = 2000) {
        console.log(`✨ Adding ${count} dust particles to asteroid belt...`);
        
        const particleGeometry = new THREE.BufferGeometry();
        const positions = [];
        const colors = [];
        
        for (let i = 0; i < count; i++) {
            // Random position in asteroid belt zone (2.1 - 3.3 AU)
            const radius = 2.1 + Math.random() * 1.2; // 2.1-3.3 AU
            const theta = Math.random() * Math.PI * 2;
            const phi = (Math.random() - 0.5) * 0.3; // Small vertical spread
            
            const x = radius * Math.cos(theta) * Math.cos(phi);
            const y = radius * Math.sin(phi) * 0.5; // Flatten vertically
            const z = radius * Math.sin(theta) * Math.cos(phi);
            
            positions.push(x, y, z);
            
            // Dust color: very subtle gray-brown
            const dustColor = new THREE.Color(0.3 + Math.random() * 0.2, 0.25 + Math.random() * 0.15, 0.2 + Math.random() * 0.1);
            colors.push(dustColor.r, dustColor.g, dustColor.b);
        }
        
        particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        particleGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        
        const particleMaterial = new THREE.PointsMaterial({
            size: 0.02,
            vertexColors: true,
            transparent: true,
            opacity: 0.4,
            sizeAttenuation: true,
            blending: THREE.AdditiveBlending
        });
        
        this.asteroidDust = new THREE.Points(particleGeometry, particleMaterial);
        this.asteroidDust.userData = { type: 'asteroid_dust' };
        this.scene.add(this.asteroidDust);
        this.asteroidBelt.push(this.asteroidDust); // Add to belt array for cleanup
        
        console.log('✨ Dust particles added');
    }

    /**
     * Calculate asteroid position from orbital elements
     */
    calculateAsteroidPosition(elements) {
        const { semiMajorAxis, eccentricity, inclination, longitudeAscendingNode, 
                argumentPerihelion, meanAnomaly } = elements;
        
        // Convert to radians
        const i = inclination * Math.PI / 180;
        const Omega = longitudeAscendingNode * Math.PI / 180;
        const omega = argumentPerihelion * Math.PI / 180;
        const M = meanAnomaly * Math.PI / 180;
        
        // Solve Kepler's equation for eccentric anomaly (simplified)
        let E = M;
        for (let iter = 0; iter < 5; iter++) {
            E = M + eccentricity * Math.sin(E);
        }
        
        // True anomaly
        const theta = 2 * Math.atan2(
            Math.sqrt(1 + eccentricity) * Math.sin(E / 2),
            Math.sqrt(1 - eccentricity) * Math.cos(E / 2)
        );
        
        // Distance from sun
        const r = semiMajorAxis * (1 - eccentricity * Math.cos(E));
        
        // Position in orbital plane
        const xOrb = r * Math.cos(theta);
        const yOrb = r * Math.sin(theta);
        
        // Rotate to 3D space
        const cosOmega = Math.cos(omega);
        const sinOmega = Math.sin(omega);
        const cosOmegaBig = Math.cos(Omega);
        const sinOmegaBig = Math.sin(Omega);
        const cosI = Math.cos(i);
        const sinI = Math.sin(i);
        
        const x3d = (cosOmega * cosOmegaBig - sinOmega * sinOmegaBig * cosI) * xOrb +
                   (-sinOmega * cosOmegaBig - cosOmega * sinOmegaBig * cosI) * yOrb;
        
        const y3d = (cosOmega * sinOmegaBig + sinOmega * cosOmegaBig * cosI) * xOrb +
                   (-sinOmega * sinOmegaBig + cosOmega * cosOmegaBig * cosI) * yOrb;
        
        const z3d = (sinOmega * sinI) * xOrb + (cosOmega * sinI) * yOrb;
        
        // Scale to scene units (1 AU = 15 units)
        return new THREE.Vector3(x3d * 15, y3d * 15, z3d * 15);
    }

    /**
     * Show asteroid belt
     */
    showAsteroidBelt() {
        console.log('👁️ Showing asteroid belt...');
        this.asteroidBelt.forEach(asteroid => {
            asteroid.visible = true;
        });
        this.asteroidBeltVisible = true;
    }

    /**
     * Hide asteroid belt
     */
    hideAsteroidBelt() {
        console.log('🙈 Hiding asteroid belt...');
        this.asteroidBelt.forEach(asteroid => {
            asteroid.visible = false;
        });
        this.asteroidBeltVisible = false;
    }

    /**
     * Hide all asteroids and their orbits (called when switching away from Asteroids tab)
     */
    hideAsteroids() {
        console.log('🧹 Hiding all asteroid orbits and objects...');
        
        let hiddenCount = 0;
        
        // Hide all asteroid orbits
        Object.values(this.orbits).forEach(orbit => {
            if (orbit.userData.type === 'asteroid_orbit') {
                orbit.visible = false;
                hiddenCount++;
            }
        });
        
        // Hide all asteroids
        Object.values(this.asteroids).forEach(asteroid => {
            asteroid.visible = false;
        });
        
        console.log(`✅ Hidden ${hiddenCount} asteroid orbits and all asteroid objects`);
    }

    toggleLabels() {
        this.showLabels = !this.showLabels;
        // Implementation would show/hide labels
    }

    setRealTimeMode(enabled) {
        this.realTimeMode = enabled;
        if (enabled) {
            this.currentTime = Date.now();
        }
    }

    setFollowEarth(enabled) {
        this.followEarth = enabled;
    }
}

// Export for use in app.js
window.LiveSolarSystem = LiveSolarSystem;