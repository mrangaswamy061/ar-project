window.addEventListener('load', async () => {
    const loader = document.getElementById('loader');
    const errorOverlay = document.getElementById('error-overlay');
    const successOverlay = document.getElementById('success-overlay');
    const locationName = document.getElementById('location-name');
    const navMenu = document.getElementById('nav-menu');
    const htmlInstructionBar = document.getElementById('html-instruction-bar');
    const htmlInstructionText = document.getElementById('html-instruction-text');
    
    // AR Navigation elements
    const arrowModel = document.getElementById('arrow-model');
    const navInstruction = document.getElementById('nav-instruction');
    
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
    let targetHeading = 0;
    let isNavigating = false;
    let navigationConfig = {}; // Stores fetched dynamic configurations

    // Fetch dynamic configurations without blocking the UI
    async function fetchNavigationData() {
        try {
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
            const API_BASE = isLocal ? 'http://localhost:5000' : '';
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

    // Initially hide dev sandbox overlay until AR mode is active
    if (devSandbox) devSandbox.style.display = 'none';

    // ==========================================
    // MODE SELECTION INTERFACE CONTROLS
    // ==========================================
    modeVideoCard.addEventListener('click', () => {
        currentMode = 'video';
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
        modeSelectionOverlay.classList.add('hidden');
        globalBackBtn.classList.remove('hidden');
        globalModeBadge.classList.remove('hidden');
        globalModeBadge.innerText = "Live AR Navigation 🧭";
        globalModeBadge.style.borderColor = "var(--success)";
        globalModeBadge.style.color = "#6ee7b7";
        
        // Show developer sandbox for simulating markers
        if (devSandbox) devSandbox.style.display = 'flex';

        // Bypasses camera scanning overlays, show menu directly
        loader.classList.add('hidden');
        errorOverlay.classList.add('hidden');
        successOverlay.classList.add('hidden');
        navMenu.classList.remove('hidden');
    });

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
        
        // 3. Clear active nav buttons highlights
        navButtons.forEach(b => b.classList.remove('active'));
        
        // 4. Hide 3D AR elements
        arrowModel.setAttribute('position', '0 -9999 0');
        navInstruction.setAttribute('position', '0 -9999 0');
        const hudNavGroup = document.getElementById('hud-nav-group');
        if (hudNavGroup) hudNavGroup.setAttribute('visible', 'false');
        
        // 5. Hide simulated PC sandbox elements
        const simArrowModel = document.getElementById('sim-arrow-model');
        const simNavInstruction = document.getElementById('sim-nav-instruction');
        if (simArrowModel) simArrowModel.setAttribute('position', '0 -9999 -150');
        if (simNavInstruction) simNavInstruction.setAttribute('position', '0 -9999 -150');
        
        // 6. Reset compass states
        isNavigating = false;
        
        // 7. Hide back button, badge, and dev sandbox
        globalBackBtn.classList.add('hidden');
        globalModeBadge.classList.add('hidden');
        if (devSandbox) devSandbox.style.display = 'none';
        
        // Reset Dev Simulation Buttons if active
        simLostBtn.classList.add('hidden');
        simFoundBtn.classList.remove('hidden');
        
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
            videoDirections.innerHTML = arrowStraight;
        } 
        else if (t >= 15 && t < 22) {
            videoDirections.innerHTML = arrowLeft;
        } 
        else if (t >= 22 && t < 46) {
            videoDirections.innerHTML = arrowStraight;
        } 
        else if (t >= 46 && t < 52) {
            videoDirections.innerHTML = arrowRight;
        } 
        else if (t >= 52 && t < 68) {
            videoDirections.innerHTML = arrowStraight;
        } 
        else if (t >= 68 && t < 101) {
            videoDirections.innerHTML = arrowDown;
        }
        else if (t >= 101 && t < 111) {
            videoDirections.innerHTML = arrowStraight;
        }
        else if (t >= 111 && t < 114) {
            videoDirections.innerHTML = arrowRight;
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

        // If we are actively navigating, check distance to destination
        if (isNavigating && currentMode === 'ar' && activeDestination) {
            const destConfig = navigationConfig[activeDestination];
            if (destConfig && destConfig.lat && destConfig.lng) {
                // Calculate distance using Haversine formula
                const distance = calculateDistance(
                    e.detail.position.latitude, 
                    e.detail.position.longitude,
                    destConfig.lat,
                    destConfig.lng
                );
                
                // Calculate bearing to update the compass direction text
                targetHeading = calculateBearing(
                    e.detail.position.latitude, 
                    e.detail.position.longitude,
                    destConfig.lat,
                    destConfig.lng
                );
                
                const hudDistance = document.getElementById('hud-nav-distance');
                if (hudDistance) hudDistance.setAttribute('value', `${Math.round(distance)}m`);
                
                // If within 10 meters, show Arrival screen!
                if (distance < 10) {
                    htmlInstructionBar.classList.add('hidden');
                    const destRoomSpan = document.getElementById('dest-room-name');
                    if (destRoomSpan) destRoomSpan.innerText = destConfig.name;
                    destinationOverlay.classList.remove('hidden');
                    // Stop navigation to prevent spamming
                    isNavigating = false;
                }
            }
        }
    });

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
        
        destContainer.innerHTML = '';
        
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
    }

    function logTelemetry(destinationName, mode) {
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
        const API_BASE = isLocal ? 'http://localhost:5000' : '';
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

        const instructionText = destConfig.instructions;
        navInstruction.setAttribute('position', '0 250 0');
        navInstruction.setAttribute('value', instructionText);

        // Display in the standard HTML instruction bar for easy desktop testing
        htmlInstructionText.innerText = instructionText;
        htmlInstructionBar.classList.remove('hidden');

        // Set up compass navigation target heading
        const rotationStr = destConfig.ar_rot || "0 0 0";
        // Parse the Y-axis rotation (index 1) for left/right turns
        const yRot = parseInt(rotationStr.split(" ")[1]) || 0;
        
        // Map A-Frame y-axis rotation to compass angles (0 to 360)
        targetHeading = (yRot + 360) % 360;
        initialHeading = null; // recalibrate starting point
        isNavigating = true;

        // Request mobile sensors permission
        requestOrientationPermission();

        // ==========================================
        // VIDEO DIRECTIONS FLOW
        // ==========================================
        if (currentMode === 'video') {
            // Hide the AR arrow just in case
            arrowModel.setAttribute('position', '0 -9999 0'); 
            navInstruction.setAttribute('position', '0 -9999 0');
            
            // Track selected destination
            activeDestination = destConfig.id;
            
            // Update final room name dynamically
            const roomName = destConfig.name;
            const destRoomSpan = document.getElementById('dest-room-name');
            if (destRoomSpan) destRoomSpan.innerText = roomName;
            
            // Show the standard Fullscreen HTML video player!
            videoOverlay.classList.remove('hidden');
            htmlVideoPlayer.currentTime = 0; // reset video playback to start
            htmlVideoPlayer.play().catch(e => console.error("Video Play Error:", e));
        } 
        // ==========================================
        // LIVE AR NAVIGATION FLOW
        // ==========================================
        else {
            htmlVideoPlayer.pause();
            videoOverlay.classList.add('hidden');
            activeDestination = destConfig.id;
            
            const destPin = document.getElementById('destination-pin');
            if (destPin) {
                // Set the exact GPS coordinates of the destination
                const lat = destConfig.lat || 0;
                const lng = destConfig.lng || 0;
                destPin.setAttribute('gps-entity-place', `latitude: ${lat}; longitude: ${lng};`);
                destPin.setAttribute('visible', 'true');
            }
            
            const hudNavGroup = document.getElementById('hud-nav-group');
            if (hudNavGroup) hudNavGroup.setAttribute('visible', 'true');
            
            // Show the "Simulate Arrival" button in sandbox
            simArriveBtn.classList.remove('hidden');
        }

        // Apply simulation arrow animation (for PC sandbox testing mode)
        const simArrowModel = document.getElementById('sim-arrow-model');
        const simNavInstruction = document.getElementById('sim-nav-instruction');
        
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
    }

    // ==========================================
    // MOBILE DEVICE ORIENTATION (COMPASS) ROUTING
    // ==========================================
    function requestOrientationPermission() {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(permissionState => {
                    if (permissionState === 'granted') {
                        window.addEventListener('deviceorientation', handleOrientation, true);
                    }
                })
                .catch(console.error);
        } else {
            window.addEventListener('deviceorientation', handleOrientation, true);
        }
    }

    function handleOrientation(event) {
        if (!isNavigating || event.alpha === null) return;

        if (initialHeading === null) {
            initialHeading = event.alpha;
        }

        // Relative heading of the device camera (0 to 360)
        let relativeHeading = (event.alpha - initialHeading + 360) % 360;

        // Calculate angular difference between relativeHeading and targetHeading
        let diff = Math.abs(relativeHeading - targetHeading);
        if (diff > 180) diff = 360 - diff;
        
        let turnAngle = (targetHeading - relativeHeading + 360) % 360;
        
        // Dynamically rotate the HUD arrow based on compass (much more reliable than GPS look-at)
        const hudNavArrow = document.getElementById('hud-nav-arrow');
        if (hudNavArrow) {
            hudNavArrow.setAttribute('rotation', `0 ${-turnAngle} 0`);
        }

        // If user deviates by more than 60 degrees from correct navigation direction
        if (diff > 60) {
            // Show Wrong Direction overlay
            errorOverlay.classList.remove('hidden');
            const errTitle = document.getElementById('error-title');
            const errDesc = document.getElementById('error-desc');
            
            if (errTitle) errTitle.innerText = "Wrong Direction! 🔄";
            if (errDesc) {
                let directionWord = "turn around";
                if (turnAngle > 20 && turnAngle <= 160) directionWord = "turn RIGHT";
                else if (turnAngle >= 200 && turnAngle < 340) directionWord = "turn LEFT";
                errDesc.innerText = `You are facing the wrong way. Please ${directionWord} to face the destination.`;
            }
            
            // Hide normal navigation overlays
            htmlInstructionBar.classList.add('hidden');
        } else {
            // Facing the correct direction! Restore HUD
            errorOverlay.classList.add('hidden');
            htmlInstructionBar.classList.remove('hidden');
        }
    }

    // ==========================================
    // DEVELOPER SANDBOX SIMULATION LOGIC
    // ==========================================
    const simFoundBtn = document.getElementById('sim-found-btn');
    const simLostBtn = document.getElementById('sim-lost-btn');
    const simArriveBtn = document.getElementById('sim-arrive-btn');

    simFoundBtn.addEventListener('click', () => {
        isLocationIdentified = true;

        // Simulate markerFound
        loader.classList.add('hidden');
        locationName.innerText = "GPS Connected (Simulated)";
        
        if (currentMode === 'ar') {
            errorOverlay.classList.add('hidden');
            // successOverlay is no longer shown to avoid blocking UX
            simFoundBtn.classList.add('hidden');
            simLostBtn.classList.remove('hidden');
        }
    });

    simArriveBtn.addEventListener('click', () => {
        if (isNavigating && currentMode === 'ar' && activeDestination) {
            const destConfig = navigationConfig[activeDestination];
            htmlInstructionBar.classList.add('hidden');
            const destRoomSpan = document.getElementById('dest-room-name');
            if (destRoomSpan) destRoomSpan.innerText = destConfig.name || 'Destination';
            destinationOverlay.classList.remove('hidden');
            isNavigating = false;
        }
    });

    simLostBtn.addEventListener('click', () => {
        isLocationIdentified = false;

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
        const destPin = document.getElementById('destination-pin');
        if (destPin) destPin.setAttribute('visible', 'false');
        const hudNavGroup = document.getElementById('hud-nav-group');
        if (hudNavGroup) hudNavGroup.setAttribute('visible', 'false');

        // Hide simulated AR elements
        const simArrowModel = document.getElementById('sim-arrow-model');
        const simNavInstruction = document.getElementById('sim-nav-instruction');
        if (simArrowModel) simArrowModel.setAttribute('position', '0 -9999 -150');
        if (simNavInstruction) simNavInstruction.setAttribute('position', '0 -9999 -150');

        simLostBtn.classList.add('hidden');
        simFoundBtn.classList.remove('hidden');
    });
});
