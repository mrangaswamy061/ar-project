window.addEventListener('load', async () => {
    // Setup Trusted Types policy to prevent security blocking in environments that enforce it
    let htmlPolicy = { createHTML: (val) => val };
    if (window.trustedTypes && window.trustedTypes.createPolicy) {
        htmlPolicy = window.trustedTypes.createPolicy('default', {
            createHTML: (string) => string
        });
    }

    const loader = document.getElementById('loader');
    const errorOverlay = document.getElementById('error-overlay');
    const successOverlay = document.getElementById('success-overlay');
    const locationName = document.getElementById('location-name');
    const navMenu = document.getElementById('nav-menu');
    const htmlInstructionBar = document.getElementById('html-instruction-bar');
    const htmlInstructionText = document.getElementById('html-instruction-text');
    
    // AR Navigation element getters (resolved dynamically since scene is lazy-loaded)
    const getArrowModel = () => document.getElementById('arrow-model');
    const getNavInstruction = () => document.getElementById('nav-instruction');
    const getDestPin = () => document.getElementById('destination-pin');
    const getHudNavGroup = () => document.getElementById('hud-nav-group');
    const getHudNavArrow = () => document.getElementById('hud-nav-arrow');
    const getHudDistance = () => document.getElementById('hud-nav-distance');
    const getSimArrowModel = () => document.getElementById('sim-arrow-model');
    const getSimNavInstruction = () => document.getElementById('sim-nav-instruction');

    let arSceneElement = null;

    function initARScene() {
        if (arSceneElement) return; // already initialized

        const container = document.getElementById('ar-scene-container');
        if (!container) return;

        // Create the scene element
        const sceneHtml = `
            <a-scene
                vr-mode-ui="enabled: false"
                renderer="logarithmicDepthBuffer: true; antialias: true; alpha: true;"
                embedded
                arjs="sourceType: webcam; debugUIEnabled: false;">

                <a-entity id="sim-arrow-model" rotation="90 0 0" position="0 -9999 -150" scale="0.5 0.5 0.5">
                    <a-cone color="#10B981" radius-bottom="30" radius-top="0" height="60" position="0 150 0" rotation="-90 0 0"></a-cone>
                    <a-cylinder color="#10B981" radius="15" height="100" position="0 50 0" rotation="-90 0 0"></a-cylinder>
                </a-entity>
                
                <a-text 
                    id="sim-nav-instruction"
                    value="Select a destination" 
                    color="#ffffff" 
                    scale="4 4 4" 
                    position="0 -9999 -150"
                    align="center">
                </a-text>

                <a-entity 
                    id="destination-pin" 
                    gps-entity-place="latitude: 0; longitude: 0;"
                    visible="false">
                    
                    <a-entity id="arrow-model" rotation="0 0 0" position="0 0 0">
                        <a-cone color="#10B981" radius-bottom="30" radius-top="0" height="60" position="0 150 0" rotation="-90 0 0"></a-cone>
                        <a-cylinder color="#10B981" radius="15" height="100" position="0 50 0" rotation="-90 0 0"></a-cylinder>
                    </a-entity>
                    
                    <a-text 
                        id="nav-instruction"
                        value="Destination" 
                        color="#ffffff" 
                        scale="150 150 150" 
                        position="0 250 0"
                        align="center"
                        rotation="-90 0 0"
                        look-at="[gps-camera]">
                    </a-text>
                </a-entity>
                
                <a-camera gps-camera="minAccuracy: 10000; gpsMinDistance: 1;" rotation-reader>
                    <a-entity id="hud-nav-group" position="0 -0.3 -1.5" visible="false">
                        <a-entity id="hud-nav-arrow" compass-arrow>
                            <a-cone color="#10B981" radius-bottom="0.08" radius-top="0" height="0.3" rotation="90 0 0" position="0 0 -0.15"></a-cone>
                            <a-cylinder color="#10B981" radius="0.04" height="0.3" rotation="90 0 0" position="0 0 0.15"></a-cylinder>
                        </a-entity>
                        <a-text id="hud-nav-distance" value="" align="center" color="#ffffff" position="0 -0.4 0" scale="0.5 0.5 0.5" font="kelsonsans"></a-text>
                    </a-entity>
                </a-camera>
            </a-scene>
        `;

        container.innerHTML = htmlPolicy.createHTML(sceneHtml);
        arSceneElement = container.querySelector('a-scene');
    }

    function destroyARScene() {
        if (!arSceneElement) return;

        // Stop the camera tracks explicitly to turn off camera indicator light immediately
        const video = document.querySelector('video');
        if (video && video.srcObject) {
            const stream = video.srcObject;
            const tracks = stream.getTracks();
            tracks.forEach(track => track.stop());
            video.srcObject = null;
        }

        // Clean up DOM
        const container = document.getElementById('ar-scene-container');
        if (container) {
            container.innerHTML = htmlPolicy.createHTML('');
        }
        arSceneElement = null;

        // Also clean up any dynamic overlay classes
        const cameraErrorOverlay = document.getElementById('camera-error-overlay');
        if (cameraErrorOverlay) {
            cameraErrorOverlay.classList.add('hidden');
        }
    }
    
    // HTML Fullscreen Video elements
    const videoOverlay = document.getElementById('video-overlay');
    const htmlVideoPlayer = document.getElementById('html-video-player');
    const closeVideoBtn = document.getElementById('close-video-btn');
    const videoDirections = document.getElementById('video-directions-text');
    const destinationOverlay = document.getElementById('destination-overlay');

    // New Global Floating Controls & Mode Selection Bindings
    const modeSelectionOverlay = document.getElementById('mode-selection-overlay');
    const modeVideoCard = document.getElementById('mode-video-card');
    const modeArCard = document.getElementById('mode-ar-card');
    const globalBackBtn = document.getElementById('global-back-btn');
    const globalModeBadge = document.getElementById('global-mode-badge');
    const devSandbox = document.getElementById('dev-sandbox');

    // State Variables
    let currentMode = null; // 'video' or 'ar'
    let isLocationIdentified = false;
    let activeDestination = 'bca_classroom';
    let initialHeading = null;
    let lastGpsPosition = null;
    let watchId = null;
    let pollIntervalId = null;
    let simWalkIntervalId = null;

    // Handle AR.js Camera Permission Errors gracefully!
    window.addEventListener('camera-error', (err) => {
        console.error("Camera denied or failed:", err);
        const errorOverlay = document.getElementById('camera-error-overlay');
        if (errorOverlay) {
            errorOverlay.classList.remove('hidden');
        }
    });
    let targetHeading = 0;
    let isNavigating = false;
    
    // Default fallback configurations to guarantee the destination list renders instantly
    let navigationConfig = {
        "bca_classroom": {
            "id": "bca_classroom",
            "name": "1st Year BCA Classroom",
            "type": "video",
            "video_time": 75.0,
            "ar_rot": "0 90 0",
            "instructions": "Turn Left for 1st Year BCA Classroom",
            "lat": 13.336847,
            "lng": 77.130151
        },
        "staff_room": {
            "id": "staff_room",
            "name": "Staff Room",
            "type": "video",
            "video_time": 82.0,
            "ar_rot": "0 90 0",
            "instructions": "Turn Left, then Right for Staff Room",
            "lat": 13.336857,
            "lng": 77.130140
        },
        "meeting_room": {
            "id": "meeting_room",
            "name": "Meeting Room",
            "type": "video",
            "video_time": 95.0,
            "ar_rot": "0 0 0",
            "instructions": "Go Straight & Down Stairs for Meeting Room",
            "lat": 13.336920,
            "lng": 77.130192
        },
        "academic_director": {
            "id": "academic_director",
            "name": "Academic Director",
            "type": "video",
            "video_time": 116.0,
            "ar_rot": "0 0 0",
            "instructions": "Go Straight, Down Stairs & Turn Right for Academic Director",
            "lat": 13.337035,
            "lng": 77.130228
        }
    };

    // Render fallback destinations instantly
    renderDynamicDestinations();

    // Fetch dynamic configurations without blocking the UI
    async function fetchNavigationData() {
        try {
            const API_BASE = ''; // Always empty to let Vite proxy prevent Mixed Content blocks
            const response = await fetch(`${API_BASE}/api/navigation-config`);
            if (response.ok) {
                const configData = await response.json();
                configData.destinations.forEach(dest => {
                    navigationConfig[dest.id] = dest;
                });
                renderDynamicDestinations();
            } else {
                console.error('Failed to load dynamic config');
            }
        } catch (err) {
            console.error('API Error:', err);
        }
    }
    
    fetchNavigationData();
    restoreSession();

    // Initially hide dev sandbox overlay until AR mode is active
    if (devSandbox) devSandbox.style.display = 'none';

    // ==========================================
    // RESTORE STATE FROM LOCALSTORAGE (Accidental refresh / reload)
    // ==========================================
    function restoreSession() {
        const savedMode = localStorage.getItem('nav_currentMode');
        if (savedMode) {
            currentMode = savedMode;
            modeSelectionOverlay.classList.add('hidden');
            globalBackBtn.classList.remove('hidden');
            globalModeBadge.classList.remove('hidden');
            
            if (currentMode === 'video') {
                globalModeBadge.innerText = "Video Walkthrough 📹";
                globalModeBadge.style.borderColor = "var(--primary)";
                globalModeBadge.style.color = "#a5b4fc";
                if (devSandbox) devSandbox.style.display = 'none';
                loader.classList.add('hidden');
                errorOverlay.classList.add('hidden');
                successOverlay.classList.add('hidden');
                navMenu.classList.remove('hidden');
            } else if (currentMode === 'ar') {
                globalModeBadge.innerText = "Live AR Navigation 🧭";
                globalModeBadge.style.borderColor = "var(--success)";
                globalModeBadge.style.color = "#6ee7b7";
                
                // Show loader while we wait for location
                loader.classList.remove('hidden');
                const loaderTitle = loader.querySelector('h2');
                const loaderDesc = loader.querySelector('p');
                if (loaderTitle) loaderTitle.innerText = "Reconnecting GPS & Camera...";
                if (loaderDesc) loaderDesc.innerText = "Restoring your active navigation session.";

                initARScene();
                startARTracking();
            }
        }
    }

    // ==========================================
    // MODE SELECTION INTERFACE CONTROLS
    // ==========================================
    modeVideoCard.addEventListener('click', () => {
        currentMode = 'video';
        localStorage.setItem('nav_currentMode', 'video');
        modeSelectionOverlay.classList.add('hidden');
        globalBackBtn.classList.remove('hidden');
        globalModeBadge.classList.remove('hidden');
        globalModeBadge.innerText = "Video Walkthrough 📹";
        globalModeBadge.style.borderColor = "var(--primary)";
        globalModeBadge.style.color = "#a5b4fc";
        
        // Hide dev sandbox for video walkthrough
        if (devSandbox) devSandbox.style.display = 'none';

        // Bypasses camera/location scanning requirements
        loader.classList.add('hidden');
        errorOverlay.classList.add('hidden');
        successOverlay.classList.add('hidden');
        
        // Directly display the destination select menu
        navMenu.classList.remove('hidden');
    });

    modeArCard.addEventListener('click', () => {
        currentMode = 'ar';
        localStorage.setItem('nav_currentMode', 'ar');
        modeSelectionOverlay.classList.add('hidden');
        globalBackBtn.classList.remove('hidden');
        globalModeBadge.classList.remove('hidden');
        globalModeBadge.innerText = "Live AR Navigation 🧭";
        globalModeBadge.style.borderColor = "var(--success)";
        globalModeBadge.style.color = "#6ee7b7";
        
        // Show loader overlay while requesting permission
        loader.classList.remove('hidden');
        const loaderTitle = loader.querySelector('h2');
        const loaderDesc = loader.querySelector('p');
        if (loaderTitle) loaderTitle.innerText = "Connecting GPS & Camera...";
        if (loaderDesc) loaderDesc.innerText = "Please allow location and camera access if prompted.";

        // Initialize dynamic AR scene
        initARScene();
        
        startARTracking();
    });

    function startARTracking() {
        // Request DeviceOrientation permission on iOS
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(response => {
                    if (response === 'granted') {
                        window.addEventListener('deviceorientation', () => {}, true);
                    }
                })
                .catch(console.error);
        }

        // Show developer sandbox for simulating markers
        if (devSandbox) devSandbox.style.display = 'flex';

        // Start watching geolocation
        if (navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(
                (position) => {
                    const firstTime = !lastGpsPosition;
                    lastGpsPosition = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    };

                    // Trigger location identified state
                    isLocationIdentified = true;
                    
                    // Dispatch CustomEvent to let A-Frame/AR.js update itself
                    const gpsEvent = new CustomEvent('gps-camera-update-position', {
                        detail: {
                            position: lastGpsPosition
                        }
                    });
                    window.dispatchEvent(gpsEvent);

                    if (firstTime) {
                        // Hide loader
                        loader.classList.add('hidden');
                        errorOverlay.classList.add('hidden');
                        
                        // If we are restoring an existing active session, go straight to navMenu without Success overlay delay
                        const savedDest = localStorage.getItem('nav_activeDestination');
                        const savedNavigating = localStorage.getItem('nav_isNavigating') === 'true';
                        if (savedDest && savedNavigating) {
                            navMenu.classList.remove('hidden');
                        } else {
                            successOverlay.classList.remove('hidden');
                            setTimeout(() => {
                                successOverlay.classList.add('hidden');
                                navMenu.classList.remove('hidden');
                            }, 2000);
                        }
                    }
                },
                (err) => {
                    console.error("GPS Watch Error:", err);
                    loader.classList.add('hidden');
                    successOverlay.classList.add('hidden');
                    errorOverlay.classList.remove('hidden');
                    
                    const errTitle = document.getElementById('error-title');
                    const errDesc = document.getElementById('error-desc');
                    if (err.code === err.PERMISSION_DENIED) {
                        if (errTitle) errTitle.innerText = "Location Blocked 🛰️";
                        if (errDesc) errDesc.innerText = "Please enable location services and grant permission to proceed.";
                    } else {
                        if (errTitle) errTitle.innerText = "GPS Error ❌";
                        if (errDesc) errDesc.innerText = "Unable to retrieve your location. Make sure GPS is enabled.";
                    }
                },
                {
                    enableHighAccuracy: true,
                    maximumAge: 0,
                    timeout: 15000
                }
            );

            // Periodically force-refresh location data to prevent watchPosition freezing on mobile browsers
            pollIntervalId = setInterval(() => {
                if (isNavigating && currentMode === 'ar') {
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            lastGpsPosition = {
                                latitude: position.coords.latitude,
                                longitude: position.coords.longitude
                            };
                            updateNavigationUI();
                        },
                        (err) => console.warn("GPS Poll Warning:", err),
                        {
                            enableHighAccuracy: true,
                            maximumAge: 0,
                            timeout: 2500
                        }
                    );
                }
            }, 2500);
        } else {
            loader.classList.add('hidden');
            errorOverlay.classList.remove('hidden');
            const errTitle = document.getElementById('error-title');
            const errDesc = document.getElementById('error-desc');
            if (errTitle) errTitle.innerText = "GPS Unsupported ❌";
            if (errDesc) errDesc.innerText = "Your browser or device does not support GPS navigation.";
        }
    }

    globalBackBtn.addEventListener('click', () => {
        // 1. Pause video walkthroughs and hide video
        htmlVideoPlayer.pause();
        videoOverlay.classList.add('hidden');
        destinationOverlay.classList.add('hidden');
        
        // 2. Hide navigation options and overlays
        navMenu.classList.add('hidden');
        successOverlay.classList.add('hidden');
        errorOverlay.classList.add('hidden');
        htmlInstructionBar.classList.add('hidden');
        
        // 3. Clear active nav buttons highlights (Fixed ReferenceError by querying directly)
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        
        // 4. Reset compass states
        isNavigating = false;
        
        // 5. Hide back button, badge, and dev sandbox
        globalBackBtn.classList.add('hidden');
        globalModeBadge.classList.add('hidden');
        if (devSandbox) devSandbox.style.display = 'none';
        
        // Reset Dev Simulation Buttons if active
        simLostBtn.classList.add('hidden');
        simFoundBtn.classList.remove('hidden');
        
        // 6. Clear GPS watch, polling interval, and reset states
        if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
        }
        if (pollIntervalId !== null) {
            clearInterval(pollIntervalId);
            pollIntervalId = null;
        }
        if (simWalkIntervalId !== null) {
            clearInterval(simWalkIntervalId);
            simWalkIntervalId = null;
        }
        lastGpsPosition = null;
        isLocationIdentified = false;

        // Clear saved session parameters from localStorage
        localStorage.removeItem('nav_currentMode');
        localStorage.removeItem('nav_activeDestination');
        localStorage.removeItem('nav_isNavigating');

        // 7. Destroy dynamic AR scene (stops webcam and releases resources)
        destroyARScene();
        
        currentMode = null;
        modeSelectionOverlay.classList.remove('hidden');
    });

    // ==========================================
    // DYNAMIC FLOOR VIDEO DIRECTIONS SUBTITLES
    // ==========================================
    htmlVideoPlayer.addEventListener('timeupdate', () => {
        const t = htmlVideoPlayer.currentTime;
        
        const arrowStraight = `
            <svg class="nav-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width: 250px; height: 250px;"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
            <div style="color: white; font-family: Outfit; font-size: 2rem; text-shadow: 2px 2px 10px black; margin-top: -30px;">Go Straight</div>
        `;
        const arrowLeft = `
            <svg class="nav-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width: 250px; height: 250px;"><polyline points="9 14 4 9 9 4"></polyline><path d="M20 20v-7a4 4 0 0 0-4-4H4"></path></svg>
            <div style="color: white; font-family: Outfit; font-size: 2rem; text-shadow: 2px 2px 10px black; margin-top: -30px;">Turn Left</div>
        `;
        const arrowRight = `
            <svg class="nav-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width: 250px; height: 250px;"><polyline points="15 14 20 9 15 4"></polyline><path d="M4 20v-7a4 4 0 0 1 4-4h12"></path></svg>
            <div style="color: white; font-family: Outfit; font-size: 2rem; text-shadow: 2px 2px 10px black; margin-top: -30px;">Turn Right</div>
        `;
        const arrowDown = `
            <svg class="nav-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width: 250px; height: 250px;"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
            <div style="color: white; font-family: Outfit; font-size: 2rem; text-shadow: 2px 2px 10px black; margin-top: -30px;">Go Down Stairs</div>
        `;
        const arrowAround = `
            <svg class="nav-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width: 250px; height: 250px;"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg>
            <div style="color: white; font-family: Outfit; font-size: 2rem; text-shadow: 2px 2px 10px black; margin-top: -30px;">Turn Around</div>
        `;
        
        // Destination Timestamps & Arrival Checkers
        const currentDestConfig = navigationConfig[activeDestination];
        if (currentDestConfig && currentDestConfig.video_time && t >= currentDestConfig.video_time) {
            htmlVideoPlayer.pause();
            videoDirections.classList.add('hidden');
            destinationOverlay.classList.remove('hidden');
            return;
        }

        // Display correct dynamic arrow indicator based on time and destination
        destinationOverlay.classList.add('hidden');
        videoDirections.classList.remove('hidden');
        
        // Single unified timeline matching all camera turns in the walk video
        if (t >= 0 && t < 15) {
            videoDirections.innerHTML = htmlPolicy.createHTML(arrowStraight);
        } 
        else if (t >= 15 && t < 22) {
            videoDirections.innerHTML = htmlPolicy.createHTML(arrowLeft);
        } 
        else if (t >= 22 && t < 46) {
            videoDirections.innerHTML = htmlPolicy.createHTML(arrowStraight);
        } 
        else if (t >= 46 && t < 52) {
            videoDirections.innerHTML = htmlPolicy.createHTML(arrowRight);
        } 
        else if (t >= 52 && t < 68) {
            videoDirections.innerHTML = htmlPolicy.createHTML(arrowStraight);
        } 
        else if (t >= 68 && t < 101) {
            videoDirections.innerHTML = htmlPolicy.createHTML(arrowDown);
        }
        else if (t >= 101 && t < 111) {
            videoDirections.innerHTML = htmlPolicy.createHTML(arrowStraight);
        }
        else if (t >= 111 && t < 114) {
            videoDirections.innerHTML = htmlPolicy.createHTML(arrowRight);
        }
    });

    // Close Video Event
    closeVideoBtn.addEventListener('click', () => {
        htmlVideoPlayer.pause();
        videoOverlay.classList.add('hidden');
    });

    const arjsLoader = document.querySelector('.arjs-loader');
    if (arjsLoader) arjsLoader.style.display = 'none';

    window.addEventListener('gps-camera-update-position', async (e) => {
        loader.classList.add('hidden');
        isLocationIdentified = true;
        lastGpsPosition = e.detail.position;

        updateNavigationUI();
    });

    function updateNavigationUI() {
        // If we are actively navigating, check distance to destination
        if (isNavigating && currentMode === 'ar' && activeDestination && lastGpsPosition) {
            const destConfig = navigationConfig[activeDestination];
            if (destConfig && destConfig.lat && destConfig.lng) {
                // Calculate distance using Haversine formula
                const distance = calculateDistance(
                    lastGpsPosition.latitude, 
                    lastGpsPosition.longitude,
                    destConfig.lat,
                    destConfig.lng
                );
                
                // Calculate bearing to update the compass direction text
                targetHeading = calculateBearing(
                    lastGpsPosition.latitude, 
                    lastGpsPosition.longitude,
                    destConfig.lat,
                    destConfig.lng
                );
                window.targetHeading = targetHeading;
                
                const hudDistance = getHudDistance();
                if (hudDistance) hudDistance.setAttribute('value', `${Math.round(distance)}m`);
                
                // Dynamically update textual instruction using GPS
                const directionsText = destConfig.instructions ? `${destConfig.instructions}\n` : '';
                htmlInstructionText.innerText = `${directionsText}Distance: ${Math.round(distance)}m`;
                
                // Show the HUD arrow since we now have GPS lock
                const hudNavArrow = getHudNavArrow();
                if (hudNavArrow) hudNavArrow.setAttribute('visible', 'true');

                // Update 3D AR floating text above the destination pin
                const navInstruction = getNavInstruction();
                if (navInstruction) {
                    navInstruction.setAttribute('value', `${destConfig.name}\n${Math.round(distance)}m`);
                }
                
                // If within 10 meters, show Arrival screen!
                if (distance < 10) {
                    htmlInstructionBar.classList.add('hidden');
                    const destRoomSpan = document.getElementById('dest-room-name');
                    if (destRoomSpan) destRoomSpan.innerText = destConfig.name;
                    destinationOverlay.classList.remove('hidden');
                    // Stop navigation to prevent spamming
                    isNavigating = false;
                    localStorage.removeItem('nav_isNavigating');
                    localStorage.removeItem('nav_activeDestination');
                }
            }
        }
    }

    // Haversine distance formula (returns distance in meters)
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth radius in meters
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lon2-lon1) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }

    // Calculate initial bearing from point A to point B
    function calculateBearing(lat1, lon1, lat2, lon2) {
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δλ = (lon2-lon1) * Math.PI/180;

        const y = Math.sin(Δλ) * Math.cos(φ2);
        const x = Math.cos(φ1)*Math.sin(φ2) - Math.sin(φ1)*Math.cos(φ2)*Math.cos(Δλ);
        const θ = Math.atan2(y, x);

        return (θ * 180/Math.PI + 360) % 360;
    }

    // ==========================================
    // DYNAMIC DESTINATION RENDERING
    // ==========================================
    function renderDynamicDestinations() {
        const destContainer = document.getElementById('dynamic-destinations');
        if (!destContainer) return;
        
        destContainer.innerHTML = htmlPolicy.createHTML('');
        
        Object.keys(navigationConfig).forEach(destId => {
            const dest = navigationConfig[destId];
            const btn = document.createElement('button');
            btn.className = 'nav-btn arrow-btn';
            btn.setAttribute('data-dest', dest.id);
            btn.setAttribute('data-rot', dest.ar_rot || "0 0 0");
            btn.setAttribute('data-text', dest.instructions);
            btn.innerText = dest.name;
            destContainer.appendChild(btn);
            
            // Attach dynamic listener
            btn.addEventListener('click', () => handleDestinationSelect(btn, dest));
        });

        // Restore active selection after rendering destinations if saved in localStorage
        const savedDest = localStorage.getItem('nav_activeDestination');
        const savedNavigating = localStorage.getItem('nav_isNavigating') === 'true';
        if (savedDest && savedNavigating) {
            const activeBtn = destContainer.querySelector(`[data-dest="${savedDest}"]`);
            if (activeBtn) {
                // Programmatically trigger selection
                activeBtn.click();
            }
        }
    }

    function logTelemetry(destinationName, mode) {
        const API_BASE = ''; // Use Vite proxy to avoid mixed content block
        fetch(`${API_BASE}/api/telemetry/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                destination: destinationName,
                mode: mode,
                device: navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop',
                timestamp: new Date().toISOString()
            })
        }).catch(err => console.error("Telemetry error", err));
    }

    // Handle Route Selection
    function handleDestinationSelect(btn, destConfig) {
        const instructionText = destConfig.instructions || '';
        const yRot = destConfig.ar_rot ? destConfig.ar_rot.split(' ')[1] : '0';

        // UI Toggle
        const allBtns = document.querySelectorAll('.nav-btn');
        allBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Hide the destination list so the user can see the AR directions clearly
        const navMenu = document.getElementById('nav-menu');
        if (navMenu) {
            navMenu.classList.add('hidden');
        }

        // Log to backend analytics dashboard
        logTelemetry(destConfig.name, currentMode);

        // We do not use static instruction text anymore, we use GPS!
        htmlInstructionText.innerText = "Acquiring GPS Signal to calculate route...";
        htmlInstructionText.style.color = "white";
        htmlInstructionBar.classList.remove('hidden');

        // Save active destination selection state to localStorage
        localStorage.setItem('nav_activeDestination', destConfig.id);
        localStorage.setItem('nav_isNavigating', 'true');

        // Add timeout warning if GPS takes too long (10 seconds)
        let gpsTimeout = setTimeout(() => {
            if (targetHeading === null) {
                htmlInstructionText.innerHTML = htmlPolicy.createHTML(`GPS Signal is weak or stuck. <button id="force-sim-btn" style="background:#10B981; border:none; padding:5px 10px; border-radius:5px; color:white; font-family:'Outfit'; cursor:pointer; margin-left:10px;">Click to Force Simulation</button>`);
                document.getElementById('force-sim-btn')?.addEventListener('click', () => {
                    document.getElementById('sim-found-btn')?.click();
                });
            }
        }, 10000);

        // FAST FETCH: Grab a quick, low-accuracy Wi-Fi/Cell location to instantly unblock the UI!
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    // Inject this rough coordinate immediately so the user doesn't wait
                    if (targetHeading === null) {
                        const fastGpsEvent = new CustomEvent('gps-camera-update-position', {
                            detail: {
                                position: {
                                    latitude: position.coords.latitude,
                                    longitude: position.coords.longitude
                                }
                            }
                        });
                        window.dispatchEvent(fastGpsEvent);
                    }
                }, 
                (err) => {
                    if (err.code === err.PERMISSION_DENIED) {
                        htmlInstructionText.innerText = "⚠️ Location permission denied! Please allow GPS in browser.";
                        htmlInstructionText.style.color = "#ef4444";
                    }
                },
                // maximumAge: Infinity and enableHighAccuracy: false ensures INSTANT results
                { enableHighAccuracy: false, maximumAge: Infinity, timeout: 5000 }
            );
        }

        // Target heading will be calculated dynamically via GPS
        targetHeading = null;
        window.targetHeading = null;
        initialHeading = null; // recalibrate starting point
        isNavigating = true;

        // Hide HUD arrow until GPS locks
        const hudNavArrow = getHudNavArrow();
        if (hudNavArrow) hudNavArrow.setAttribute('visible', 'false');

        // (Permissions for compass are now handled natively by A-Frame's look-at component)

        // ==========================================
        // VIDEO DIRECTIONS FLOW
        // ==========================================
        if (currentMode === 'video') {
            // Hide the AR arrow just in case
            getArrowModel()?.setAttribute('position', '0 -9999 0'); 
            getNavInstruction()?.setAttribute('position', '0 -9999 0');
            
            // Track selected destination
            activeDestination = destConfig.id;
            
            // Update final room name dynamically
            const roomName = destConfig.name;
            const destRoomSpan = document.getElementById('dest-room-name');
            if (destRoomSpan) destRoomSpan.innerText = roomName;
            
            // Show the standard Fullscreen HTML video player!
            videoOverlay.classList.remove('hidden');
            htmlVideoPlayer.currentTime = 0; // reset video playback to start
            
            htmlVideoPlayer.play().catch(e => {
                console.warn("Autoplay blocked by iOS. Exposing manual play controls.", e);
                // If iOS strictly blocks autoplay, expose the native play button
                htmlVideoPlayer.setAttribute('controls', 'true');
            });
        } 
        // ==========================================
        // LIVE AR NAVIGATION FLOW
        // ==========================================
        else {
            htmlVideoPlayer.pause();
            videoOverlay.classList.add('hidden');
            activeDestination = destConfig.id;
            
            const destPin = getDestPin();
            if (destPin) {
                // Set the exact GPS coordinates of the destination
                const lat = destConfig.lat || 0;
                const lng = destConfig.lng || 0;
                destPin.setAttribute('gps-entity-place', `latitude: ${lat}; longitude: ${lng};`);
                destPin.setAttribute('visible', 'true');
            }
            
            const hudNavGroup = getHudNavGroup();
            if (hudNavGroup) hudNavGroup.setAttribute('visible', 'true');
            
            // Show the "Simulate Arrival" button in sandbox
            simArriveBtn.classList.remove('hidden');
        }

        // Apply simulation arrow animation (for PC sandbox testing mode)
        const simArrowModel = getSimArrowModel();
        const simNavInstruction = getSimNavInstruction();
        
        if (simArrowModel && simNavInstruction) {
            // If we are currently in simulation mode (Simulate Location Found has been clicked and is hidden)
            if (simFoundBtn.classList.contains('hidden')) { 
                simArrowModel.setAttribute('position', '0 -20 -150'); // move in front of camera view
                simNavInstruction.setAttribute('position', '0 60 -150');
                simNavInstruction.setAttribute('value', instructionText);
                
                // Use the parsed Y rotation directly in the simulation
                // arrow parent is rotated 90 on X to lie flat on A-Frame's default X-Z ground plane.
                const simRotation = `90 ${yRot} 0`;
                simArrowModel.setAttribute('animation', `property: rotation; to: ${simRotation}; dur: 800; easing: easeInOutQuad`);
            }
        }

        // Immediately compute direction and distance if GPS coordinate is already available
        if (lastGpsPosition) {
            updateNavigationUI();
        }
    }

    // ==========================================
    // DEVELOPER SANDBOX SIMULATION LOGIC
    // ==========================================
    const simFoundBtn = document.getElementById('sim-found-btn');
    const simLostBtn = document.getElementById('sim-lost-btn');
    const simArriveBtn = document.getElementById('sim-arrive-btn');

    simFoundBtn.addEventListener('click', () => {
        // Clear any existing walk simulator
        if (simWalkIntervalId) {
            clearInterval(simWalkIntervalId);
            simWalkIntervalId = null;
        }

        let simLat = 13.336820;
        let simLng = 77.130120;

        // Helper function to dispatch GPS update
        const dispatchSimGps = (lat, lng) => {
            const fakeGpsEvent = new CustomEvent('gps-camera-update-position', {
                detail: {
                    position: {
                        latitude: lat,
                        longitude: lng
                    }
                }
            });
            window.dispatchEvent(fakeGpsEvent);
        };

        // Dispatch initial simulated position
        dispatchSimGps(simLat, simLng);

        // Simulate markerFound UI logic
        loader.classList.add('hidden');
        locationName.innerText = "GPS Connected (Simulated)";
        
        if (currentMode === 'ar') {
            errorOverlay.classList.add('hidden');
            simFoundBtn.classList.add('hidden');
            simLostBtn.classList.remove('hidden');
        }

        // Start simulated walk towards destination
        simWalkIntervalId = setInterval(() => {
            if (isNavigating && activeDestination) {
                const destConfig = navigationConfig[activeDestination];
                if (destConfig && destConfig.lat && destConfig.lng) {
                    // Move simulated coordinate closer to destination on each tick
                    const diffLat = destConfig.lat - simLat;
                    const diffLng = destConfig.lng - simLng;
                    
                    // If very close, snap to destination
                    if (Math.abs(diffLat) < 0.000005 && Math.abs(diffLng) < 0.000005) {
                        simLat = destConfig.lat;
                        simLng = destConfig.lng;
                        clearInterval(simWalkIntervalId);
                        simWalkIntervalId = null;
                    } else {
                        // Move 15% closer
                        simLat += diffLat * 0.15;
                        simLng += diffLng * 0.15;
                    }
                    
                    dispatchSimGps(simLat, simLng);
                }
            }
        }, 1500);
    });

    simArriveBtn.addEventListener('click', () => {
        if (simWalkIntervalId) {
            clearInterval(simWalkIntervalId);
            simWalkIntervalId = null;
        }
        if (isNavigating && currentMode === 'ar' && activeDestination) {
            const destConfig = navigationConfig[activeDestination];
            htmlInstructionBar.classList.add('hidden');
            const destRoomSpan = document.getElementById('dest-room-name');
            if (destRoomSpan) destRoomSpan.innerText = destConfig.name || 'Destination';
            destinationOverlay.classList.remove('hidden');
            isNavigating = false;
            localStorage.removeItem('nav_isNavigating');
            localStorage.removeItem('nav_activeDestination');
        }
    });

    simLostBtn.addEventListener('click', () => {
        isLocationIdentified = false;

        // Clear simulated walk
        if (simWalkIntervalId) {
            clearInterval(simWalkIntervalId);
            simWalkIntervalId = null;
        }

        if (currentMode === 'ar') {
            // Do not hide the nav menu when GPS is lost, let user still select
            // Just show the error overlay to warn them
            errorOverlay.classList.remove('hidden');
            htmlInstructionBar.classList.add('hidden');

            const errTitle = document.getElementById('error-title');
            const errDesc = document.getElementById('error-desc');
            if (errTitle) errTitle.innerText = "GPS Signal Lost! ❌";
            if (errDesc) errDesc.innerText = "Please step outside or wait a moment while we re-acquire your GPS coordinates.";
        }

        isNavigating = false;

        // Hide AR elements
        const destPin = getDestPin();
        if (destPin) destPin.setAttribute('visible', 'false');
        const hudNavGroup = getHudNavGroup();
        if (hudNavGroup) hudNavGroup.setAttribute('visible', 'false');

        // Hide simulated AR elements
        const simArrowModel = getSimArrowModel();
        const simNavInstruction = getSimNavInstruction();
        if (simArrowModel) simArrowModel.setAttribute('position', '0 -9999 -150');
        if (simNavInstruction) simNavInstruction.setAttribute('position', '0 -9999 -150');

        simLostBtn.classList.add('hidden');
        simFoundBtn.classList.remove('hidden');
    });
});
