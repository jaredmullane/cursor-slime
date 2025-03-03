import * as THREE from 'three';

// Game state
let redScore = 0;
let blueScore = 0;
let gameActive = false;
let selectedSlimeColor = null;
let computerSlimeColor = null;
let scene, camera, renderer;
let field, stadium;
let redSlime, blueSlime, ball;
let slimeVelocity, computerVelocity, ballVelocity;
let isJumping = false;
let computerIsJumping = false;
let flashLights = [];
let lastFlashTime = 0;
let crowdFaces = [];
let computerTactic = 0;
let mysteryBox = null;
let shouldSpawnBox = false;
let activeBalls = [];
let isMultiBallActive = false;

// Movement controls
const keys = {
    ArrowLeft: false,
    ArrowRight: false,
    ArrowUp: false,
    ArrowDown: false,
    Space: false
};

// Wait for the DOM to be fully loaded before initializing
window.addEventListener('load', () => {
    // Double check game over is hidden
    const gameOver = document.getElementById('game-over');
    if (gameOver) {
        gameOver.style.display = 'none';
        gameOver.classList.add('hidden');
    }
    
    // Initialize game components
    setTimeout(() => {
        initializeUI();
        initializeThreeJS();
        initializeGameObjects();
        initializeControls();
        animate();
    }, 100); // Small delay to ensure DOM is ready
});

function initializeUI() {
    // Ensure proper initial UI state
    const gameOverScreen = document.getElementById('game-over');
    const scoreboardScreen = document.getElementById('scoreboard');
    const characterSelectScreen = document.getElementById('character-select');

    if (gameOverScreen) {
        gameOverScreen.style.display = 'none';
        gameOverScreen.classList.add('hidden');
    }
    if (scoreboardScreen) scoreboardScreen.classList.add('hidden');
    if (characterSelectScreen) characterSelectScreen.classList.remove('hidden');

    // Character selection
    document.getElementById('red-slime').addEventListener('click', () => {
        selectedSlimeColor = 'red';
        document.getElementById('red-slime').classList.add('selected');
        document.getElementById('blue-slime').classList.remove('selected');
        document.getElementById('start-game').disabled = false;
    });

    document.getElementById('blue-slime').addEventListener('click', () => {
        selectedSlimeColor = 'blue';
        document.getElementById('blue-slime').classList.add('selected');
        document.getElementById('red-slime').classList.remove('selected');
        document.getElementById('start-game').disabled = false;
    });

    // Start game
    document.getElementById('start-game').addEventListener('click', () => {
        gameActive = true;
        redScore = 0;
        blueScore = 0;
        document.getElementById('character-select').classList.add('hidden');
        document.getElementById('scoreboard').classList.remove('hidden');
        document.getElementById('game-over').classList.add('hidden');
        document.querySelector('.red-score').textContent = '0';
        document.querySelector('.blue-score').textContent = '0';
        
        // Set up player and computer slimes
        const playerSlime = selectedSlimeColor === 'red' ? redSlime : blueSlime;
        const computerSlime = selectedSlimeColor === 'red' ? blueSlime : redSlime;
        computerSlimeColor = selectedSlimeColor === 'red' ? 'blue' : 'red';
        
        playerSlime.visible = true;
        computerSlime.visible = true;
        computerVelocity = new THREE.Vector3();
        
        resetPositions();
    });

    // Play again button
    document.getElementById('play-again').addEventListener('click', () => {
        redScore = 0;
        blueScore = 0;
        document.querySelector('.red-score').textContent = '0';
        document.querySelector('.blue-score').textContent = '0';
        document.getElementById('game-over').classList.add('hidden');
        document.getElementById('character-select').classList.remove('hidden');
        document.getElementById('scoreboard').classList.add('hidden');
        redSlime.visible = false;
        blueSlime.visible = false;
        selectedSlimeColor = null;
        document.getElementById('start-game').disabled = true;
        document.getElementById('red-slime').classList.remove('selected');
        document.getElementById('blue-slime').classList.remove('selected');
    });
}

function initializeThreeJS() {
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000033); // Dark blue background for retro feel
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: false }); // Disable antialiasing for retro look
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    
    // Enable layer-based rendering
    camera.layers.enable(0);
    camera.layers.enable(1);
    
    document.body.appendChild(renderer.domElement);

    // Retro-style lighting
    const ambientLight = new THREE.AmbientLight(0x9999ff, 0.4); // Blue-tinted ambient light
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xff00ff, 0.6); // Magenta directional light
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    camera.position.set(0, 12, 20);
    camera.lookAt(0, 0, 0);
}

function initializeGameObjects() {
    // Create pixelated field texture
    const fieldCanvas = document.createElement('canvas');
    const fieldSize = 64; // Small size for pixelated look
    fieldCanvas.width = fieldSize;
    fieldCanvas.height = fieldSize;
    const fieldCtx = fieldCanvas.getContext('2d');
    
    // Draw grid pattern
    fieldCtx.fillStyle = '#003300';
    fieldCtx.fillRect(0, 0, fieldSize, fieldSize);
    fieldCtx.strokeStyle = '#00ff00';
    fieldCtx.lineWidth = 1;
    
    // Draw grid lines
    for (let i = 0; i < fieldSize; i += 8) {
        fieldCtx.beginPath();
        fieldCtx.moveTo(i, 0);
        fieldCtx.lineTo(i, fieldSize);
        fieldCtx.stroke();
        fieldCtx.beginPath();
        fieldCtx.moveTo(0, i);
        fieldCtx.lineTo(fieldSize, i);
        fieldCtx.stroke();
    }
    
    const fieldTexture = new THREE.CanvasTexture(fieldCanvas);
    fieldTexture.wrapS = THREE.RepeatWrapping;
    fieldTexture.wrapT = THREE.RepeatWrapping;
    fieldTexture.repeat.set(8, 12);
    
    // Field with retro texture
    const fieldGeometry = new THREE.BoxGeometry(20, 0.5, 30);
    const fieldMaterial = new THREE.MeshBasicMaterial({ 
        map: fieldTexture,
        transparent: true,
        opacity: 0.8
    });
    field = new THREE.Mesh(fieldGeometry, fieldMaterial);
    field.receiveShadow = true;
    field.layers.set(1);
    scene.add(field);

    // Field lines with neon effect
    createFieldLines();

    // Retro stadium background
    const stadiumGeometry = new THREE.CylinderGeometry(25, 25, 15, 32, 1, true);
    const stadiumMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x000066,
        side: THREE.BackSide,
        emissive: 0x0000ff,
        emissiveIntensity: 0.2
    });
    stadium = new THREE.Mesh(stadiumGeometry, stadiumMaterial);
    stadium.position.y = 7;
    stadium.layers.set(0);
    scene.add(stadium);

    // Goals (using MeshBasicMaterial instead of MeshPhongMaterial)
    createGoal(15);
    createGoal(-15);

    // Slimes with more vibrant colors
    redSlime = createSlime(0xff0066); // Hot pink
    blueSlime = createSlime(0x00ffff); // Cyan
    redSlime.visible = false;
    blueSlime.visible = false;

    // Ball with retro texture
    const ballGeometry = new THREE.SphereGeometry(0.65, 16, 16); // Reduced segments for blockier look
    
    // Create pixelated checkered texture
    const textureSize = 128; // Increased for sharper pattern
    const canvas = document.createElement('canvas');
    canvas.width = textureSize;
    canvas.height = textureSize;
    const context = canvas.getContext('2d');
    const squareSize = textureSize / 8; // Smaller squares for better pattern

    // Fill background with pure white
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, textureSize, textureSize);

    // Draw pure black squares in checkered pattern
    context.fillStyle = '#000000';
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            if ((i + j) % 2 === 0) {
                context.fillRect(i * squareSize, j * squareSize, squareSize, squareSize);
            }
        }
    }

    const ballTexture = new THREE.CanvasTexture(canvas);
    ballTexture.magFilter = THREE.NearestFilter; // Pixelated filtering
    ballTexture.minFilter = THREE.NearestFilter;
    
    // Use MeshStandardMaterial for better physical accuracy
    const ballMaterial = new THREE.MeshStandardMaterial({ 
        map: ballTexture,
        roughness: 0.4,
        metalness: 0.0,
        emissive: 0x222222,
        emissiveIntensity: 0.2
    });
    
    ball = new THREE.Mesh(ballGeometry, ballMaterial);
    ball.castShadow = true;
    ball.position.y = 0.65;
    scene.add(ball);

    // Create crowd with retro colors
    const radius = 24;
    const totalObjects = 24;
    const crowdColors = [0xff00ff, 0x00ffff, 0xffff00, 0x00ff00]; // Retro color palette
    
    for (let i = 0; i < totalObjects; i++) {
        const angle = (i / totalObjects) * Math.PI * 2;
        const heightVariation = Math.random() * 4;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        
        const smiley = createSmileyFace(x, 5 + heightVariation, z, crowdColors[i % crowdColors.length]);
        smiley.lookAt(0, 7, 0);
        scene.add(smiley);
        crowdFaces.push(smiley);
    }

    // Physics properties
    slimeVelocity = new THREE.Vector3();
    ballVelocity = new THREE.Vector3();
}

function initializeControls() {
    window.addEventListener('keydown', (e) => {
        if (keys.hasOwnProperty(e.code)) {
            keys[e.code] = true;
        }
    });

    window.addEventListener('keyup', (e) => {
        if (keys.hasOwnProperty(e.code)) {
            keys[e.code] = false;
        }
    });

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// Helper functions
function createFieldLines() {
    const createFieldLine = (width, length, x, z) => {
        const lineGeometry = new THREE.PlaneGeometry(width, length);
        const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const line = new THREE.Mesh(lineGeometry, lineMaterial);
        line.rotation.x = -Math.PI / 2;
        line.position.set(x, 0.26, z);
        scene.add(line);
    };

    // Create center line
    createFieldLine(0.1, 30, 0, 0);

    // Create outer boundary lines
    createFieldLine(20, 0.1, 0, 15);  // Top line
    createFieldLine(20, 0.1, 0, -15); // Bottom line
    createFieldLine(0.1, 30, -10, 0); // Left line
    createFieldLine(0.1, 30, 10, 0);  // Right line

    // Create center circle
    const circleGeometry = new THREE.RingGeometry(4, 4.1, 32);
    const circleMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const circle = new THREE.Mesh(circleGeometry, circleMaterial);
    circle.rotation.x = -Math.PI / 2;
    circle.position.y = 0.26;
    scene.add(circle);
}

function createGoal(position) {
    const goalGroup = new THREE.Group();
    
    const postGeometry = new THREE.CylinderGeometry(0.1, 0.1, 3.75, 8);
    const crossbarGeometry = new THREE.CylinderGeometry(0.1, 0.1, 5, 8);
    const goalMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff }); // Changed to MeshBasicMaterial
    
    const leftPost = new THREE.Mesh(postGeometry, goalMaterial);
    leftPost.position.set(-2.5, 1.875, 0);
    leftPost.layers.set(1);
    
    const rightPost = new THREE.Mesh(postGeometry, goalMaterial);
    rightPost.position.set(2.5, 1.875, 0);
    rightPost.layers.set(1);
    
    const crossbar = new THREE.Mesh(crossbarGeometry, goalMaterial);
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(0, 3.75, 0);
    crossbar.layers.set(1);
    
    goalGroup.add(leftPost, rightPost, crossbar);
    goalGroup.position.z = position;
    goalGroup.layers.set(1);
    scene.add(goalGroup);
    return goalGroup;
}

function createSlime(color) {
    // Create slime group to hold body and face
    const slimeGroup = new THREE.Group();

    // Create the main slime body
    const slimeGeometry = new THREE.SphereGeometry(0.7, 32, 32);
    const slimeMaterial = new THREE.MeshBasicMaterial({ color }); // Changed to MeshBasicMaterial
    const slimeBody = new THREE.Mesh(slimeGeometry, slimeMaterial);
    slimeBody.scale.set(1, 0.8, 1); // Make it slightly oval
    slimeBody.castShadow = true;
    slimeBody.layers.set(1);

    // Create eyes
    const eyeGeometry = new THREE.CircleGeometry(0.1, 32);
    const eyeMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x000000,
        side: THREE.DoubleSide
    });
    
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.25, 0.2, 0.65);
    
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.25, 0.2, 0.65);

    // Create smile
    const smileRadius = 0.25;
    const smileWidth = 0.06;
    const smileGeometry = new THREE.TorusGeometry(smileRadius, smileWidth, 16, 32, Math.PI);
    const smileMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x000000,
        side: THREE.DoubleSide
    });
    const smile = new THREE.Mesh(smileGeometry, smileMaterial);
    smile.position.set(0, -0.05, 0.65);
    smile.rotation.x = Math.PI / 2;

    // Create surprised mouth (circle)
    const surprisedGeometry = new THREE.CircleGeometry(0.15, 32);
    const surprisedMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x000000,
        side: THREE.DoubleSide
    });
    const surprisedMouth = new THREE.Mesh(surprisedGeometry, surprisedMaterial);
    surprisedMouth.position.set(0, -0.05, 0.65);
    surprisedMouth.visible = false; // Hide initially

    // Create a face group to manage all facial features
    const faceGroup = new THREE.Group();
    faceGroup.add(leftEye);
    faceGroup.add(rightEye);
    faceGroup.add(smile);
    faceGroup.add(surprisedMouth);
    
    // Add body and face group to main group
    slimeGroup.add(slimeBody);
    slimeGroup.add(faceGroup);

    slimeGroup.position.y = 0.6;
    scene.add(slimeGroup);
    return slimeGroup;
}

function createSmileyFace(x, y, z) {
    const faceGroup = new THREE.Group();
    
    // Create face background with MeshBasicMaterial
    const faceGeometry = new THREE.CircleGeometry(1, 32);
    const faceMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00ff00,
        side: THREE.DoubleSide
    });
    const face = new THREE.Mesh(faceGeometry, faceMaterial);
    face.layers.set(1);
    
    // Create eyes
    const eyeGeometry = new THREE.CircleGeometry(0.15, 32);
    const eyeMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x000000,
        side: THREE.DoubleSide
    });
    
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.3, 0.2, 0.01);
    
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.3, 0.2, 0.01);
    
    // Create smile
    const smileGeometry = new THREE.TorusGeometry(0.4, 0.08, 16, 32, Math.PI);
    const smileMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x000000,
        side: THREE.DoubleSide
    });
    const smile = new THREE.Mesh(smileGeometry, smileMaterial);
    smile.position.set(0, -0.1, 0.01);
    smile.rotation.x = Math.PI / 2;
    
    // Create surprised mouth (circle)
    const surprisedGeometry = new THREE.CircleGeometry(0.2, 32);
    const surprisedMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x000000,
        side: THREE.DoubleSide
    });
    const surprisedMouth = new THREE.Mesh(surprisedGeometry, surprisedMaterial);
    surprisedMouth.position.set(0, -0.1, 0.01);
    surprisedMouth.visible = false;

    // Create X mouth
    const xMouthGroup = new THREE.Group();
    const lineGeometry = new THREE.PlaneGeometry(0.4, 0.08);
    const xMouthMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x000000,
        side: THREE.DoubleSide
    });
    
    const line1 = new THREE.Mesh(lineGeometry, xMouthMaterial);
    line1.position.set(0, -0.1, 0.01);
    line1.rotation.z = Math.PI / 4;
    
    const line2 = new THREE.Mesh(lineGeometry, xMouthMaterial);
    line2.position.set(0, -0.1, 0.01);
    line2.rotation.z = -Math.PI / 4;
    
    xMouthGroup.add(line1);
    xMouthGroup.add(line2);
    xMouthGroup.visible = false;
    
    faceGroup.add(face);
    faceGroup.add(leftEye);
    faceGroup.add(rightEye);
    faceGroup.add(smile);
    faceGroup.add(surprisedMouth);
    faceGroup.add(xMouthGroup);
    
    faceGroup.position.set(x, y, z);
    faceGroup.layers.set(1);

    // Add a property to track last expression change time
    faceGroup.lastExpressionChange = Date.now();
    faceGroup.currentExpression = 0;
    
    return faceGroup;
}

function createFlag(color, x, y, z) {
    const flagGroup = new THREE.Group();
    
    // Create flag pole
    const poleGeometry = new THREE.CylinderGeometry(0.05, 0.05, 6, 8);
    const poleMaterial = new THREE.MeshBasicMaterial({ color: 0x808080 });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.layers.set(1);
    
    // Create larger flag
    const flagGeometry = new THREE.PlaneGeometry(3, 1.5, 15, 8);
    const flagMaterial = new THREE.MeshBasicMaterial({ 
        color: color,
        side: THREE.DoubleSide
    });
    const flag = new THREE.Mesh(flagGeometry, flagMaterial);
    flag.position.set(1.5, 2, 0);
    flag.layers.set(1);
    
    // Store original vertices for wave animation
    flag.originalVertices = [];
    const vertices = flagGeometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
        flag.originalVertices.push({
            x: vertices[i],
            y: vertices[i + 1],
            z: vertices[i + 2]
        });
    }
    
    flagGroup.add(pole);
    flagGroup.add(flag);
    flagGroup.position.set(x, y, z);
    
    return flagGroup;
}

function createMysteryBox() {
    const boxGroup = new THREE.Group();
    
    // Create the box
    const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    const boxMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xFFD700,
        emissive: 0x666600,
        emissiveIntensity: 0.3,
        shininess: 100
    });
    const box = new THREE.Mesh(boxGeometry, boxMaterial);
    
    // Create question mark using a sprite
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', 32, 32);
    
    const questionMarkTexture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: questionMarkTexture });
    const questionMark = new THREE.Sprite(spriteMaterial);
    questionMark.scale.set(0.5, 0.5, 1);
    
    // Add question mark to all sides
    const sides = [
        { position: [0, 0, 0.51], rotation: [0, 0, 0] },
        { position: [0, 0, -0.51], rotation: [0, Math.PI, 0] },
        { position: [0.51, 0, 0], rotation: [0, Math.PI/2, 0] },
        { position: [-0.51, 0, 0], rotation: [0, -Math.PI/2, 0] }
    ];
    
    sides.forEach(side => {
        const questionMarkClone = questionMark.clone();
        questionMarkClone.position.set(...side.position);
        questionMarkClone.rotation.set(...side.rotation);
        boxGroup.add(questionMarkClone);
    });
    
    boxGroup.add(box);
    boxGroup.position.set(0, 1, 0);
    
    // Add floating animation
    boxGroup.userData.floatOffset = Math.random() * Math.PI * 2;
    boxGroup.userData.rotationSpeed = 0.02;
    
    return boxGroup;
}

function spawnMultipleBalls() {
    isMultiBallActive = true;
    const ballPositions = [
        { x: -2, z: 0 },
        { x: 2, z: 0 },
        { x: 0, z: 2 }
    ];
    
    ballPositions.forEach(pos => {
        const newBall = ball.clone();
        newBall.position.set(pos.x, 1, pos.z);
        scene.add(newBall);
        activeBalls.push({
            mesh: newBall,
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.2,
                0.3,
                (Math.random() - 0.5) * 0.2
            )
        });
    });
}

function resetPositions() {
    const playerSlime = selectedSlimeColor === 'red' ? redSlime : blueSlime;
    const computerSlime = selectedSlimeColor === 'red' ? blueSlime : redSlime;
    
    playerSlime.position.set(0, 0.5, 8);
    computerSlime.position.set(0, 0.5, -8);
    
    // Reset main ball
    ball.position.set(0, 0.65, 0);
    slimeVelocity.set(0, 0, 0);
    computerVelocity.set(0, 0, 0);
    ballVelocity.set(0, 0, 0);
    
    // Clear any extra balls
    activeBalls.forEach(ball => {
        scene.remove(ball.mesh);
    });
    activeBalls = [];
    isMultiBallActive = false;
    
    // Handle mystery box spawning
    if (shouldSpawnBox) {
        if (mysteryBox) scene.remove(mysteryBox);
        mysteryBox = createMysteryBox();
        mysteryBox.position.set(
            (Math.random() * 12 - 6),
            1,
            (Math.random() * 20 - 10)
        );
        scene.add(mysteryBox);
    }
    shouldSpawnBox = !shouldSpawnBox;
    
    computerTactic = Math.floor(Math.random() * 4);
}

function handleGameOver(winner) {
    gameActive = false;
    document.getElementById('game-over').classList.remove('hidden');
    document.querySelector('.winner-text').textContent = `${winner} wins!`;
    
    // Automatically return to character select after 3 seconds
    setTimeout(() => {
        document.getElementById('game-over').classList.add('hidden');
        document.getElementById('character-select').classList.remove('hidden');
        document.getElementById('scoreboard').classList.add('hidden');
        redSlime.visible = false;
        blueSlime.visible = false;
        selectedSlimeColor = null;
        document.getElementById('start-game').disabled = true;
        document.getElementById('red-slime').classList.remove('selected');
        document.getElementById('blue-slime').classList.remove('selected');
    }, 3000);
}

function createFlashEffect() {
    // Create multiple flashes at slightly different positions for a more dramatic effect
    for (let i = 0; i < 3; i++) {
        const flash = new THREE.PointLight(0xffffff, 0, 100);
        flash.intensity = 0;
        flash.layers.set(0); // Flash lights only affect layer 0 (stadium)
        
        // Random position around the stadium with some variation
        const angle = Math.random() * Math.PI * 2;
        const radius = 23 + Math.random() * 2;
        const height = Math.random() * 12 + 2;
        
        flash.position.set(
            Math.cos(angle) * radius,
            height,
            Math.sin(angle) * radius
        );
        
        scene.add(flash);
        flashLights.push({
            light: flash,
            startTime: Date.now() + i * 50,
            duration: 150 + Math.random() * 100 // Even shorter, more camera-like flashes
        });
    }
}

function updateFlashEffects() {
    const currentTime = Date.now();
    
    // Create new flashes more frequently
    if (currentTime - lastFlashTime > 500 && Math.random() < 0.4) {
        createFlashEffect();
        lastFlashTime = currentTime;
    }
    
    // Update existing flashes
    for (let i = flashLights.length - 1; i >= 0; i--) {
        const flash = flashLights[i];
        const elapsed = currentTime - flash.startTime;
        
        if (elapsed > flash.duration) {
            scene.remove(flash.light);
            flashLights.splice(i, 1);
        } else {
            const progress = elapsed / flash.duration;
            // Sharper flash curve for more camera-like effect
            const intensity = Math.pow(Math.sin(progress * Math.PI), 2);
            flash.light.intensity = 100 * intensity; // Brighter flashes
        }
    }
}

function updateComputerMovement() {
    const computerSlime = selectedSlimeColor === 'red' ? blueSlime : redSlime;
    const moveSpeed = 0.1; // Reduced from 0.15
    const playerGoalZ = selectedSlimeColor === 'red' ? 15 : -15;
    
    // Ensure computer slime exists and is visible
    if (!computerSlime || !computerSlime.visible) return;
    
    // Reset velocity if it's too high
    if (computerVelocity.length() > moveSpeed * 2.0) { // Reduced from 2.5
        computerVelocity.normalize().multiplyScalar(moveSpeed * 2.0);
    }
    
    // Predict ball trajectory more accurately
    const predictedBallPos = ball.position.clone();
    const predictionSteps = 8; // Reduced from 10 for less accurate prediction
    const tempVelocity = ballVelocity.clone();
    for (let i = 0; i < predictionSteps; i++) {
        tempVelocity.y -= 0.015;
        predictedBallPos.add(tempVelocity);
    }
    
    // Calculate optimal position based on current tactic and ball prediction
    let targetX = ball.position.x;
    let targetZ = ball.position.z;
    
    // Calculate distances and positions
    const distanceToGoal = Math.abs(ball.position.z - playerGoalZ);
    const distanceToBall = computerSlime.position.distanceTo(ball.position);
    const ballSpeed = ballVelocity.length();
    const isInDefensivePosition = Math.abs(computerSlime.position.z) > Math.abs(ball.position.z);
    
    switch(computerTactic) {
        case 0: // Strategic Positioning
            if (distanceToGoal < 8) {
                targetZ = ball.position.z - Math.sign(playerGoalZ) * 1.5; // Increased distance from 1.2
                targetX = predictedBallPos.x * 0.7; // Reduced from 0.8
            } else if (ballSpeed > 0.5) {
                targetZ = predictedBallPos.z - Math.sign(playerGoalZ) * 1.8; // Increased from 1.5
                targetX = predictedBallPos.x * 0.9;
            } else {
                targetZ = ball.position.z - Math.sign(playerGoalZ) * 2.0; // Increased from 1.8
                targetX = ball.position.x * 0.8;
            }
            break;
            
        case 1: // Aggressive Defense
            if (isInDefensivePosition) {
                targetZ = ball.position.z - Math.sign(playerGoalZ) * 1.3; // Increased from 1.0
                targetX = ball.position.x * 0.7;
            } else {
                targetZ = predictedBallPos.z - Math.sign(playerGoalZ) * 1.0;
                targetX = predictedBallPos.x * 0.9;
            }
            break;
            
        case 2: // Smart Interception
            if (ball.position.y > 1.0) {
                targetZ = predictedBallPos.z - Math.sign(playerGoalZ) * 1.5; // Increased from 1.2
                targetX = predictedBallPos.x * 0.8;
            } else {
                targetZ = ball.position.z - Math.sign(playerGoalZ) * 1.8; // Increased from 1.5
                targetX = ball.position.x * 0.9;
            }
            break;
            
        case 3: // Dynamic Adaptation
            if (distanceToGoal < 6) {
                targetZ = ball.position.z - Math.sign(playerGoalZ) * 2.0;
                targetX = ball.position.x * 0.6; // Reduced from 0.7
            } else if (ballSpeed > 0.8) {
                targetZ = predictedBallPos.z - Math.sign(playerGoalZ) * 1.5; // Increased from 1.2
                targetX = predictedBallPos.x * 0.9;
            } else {
                targetZ = ball.position.z - Math.sign(playerGoalZ) * 1.6;
                targetX = ball.position.x * 0.8;
            }
            break;
    }
    
    // Clamp target positions
    targetX = THREE.MathUtils.clamp(targetX, -9, 9);
    targetZ = THREE.MathUtils.clamp(targetZ, -14, 14);
    
    // Move towards target with improved acceleration
    const directionToTarget = new THREE.Vector3(
        targetX - computerSlime.position.x,
        0,
        targetZ - computerSlime.position.z
    ).normalize();
    
    // Smarter acceleration based on distance to target
    const distanceToTarget = Math.sqrt(
        Math.pow(targetX - computerSlime.position.x, 2) +
        Math.pow(targetZ - computerSlime.position.z, 2)
    );
    
    const acceleration = 0.08 * (distanceToTarget > 3 ? 1.2 : 0.8); // Reduced from 0.12
    computerVelocity.x += directionToTarget.x * acceleration;
    computerVelocity.z += directionToTarget.z * acceleration;
    
    // Improved jumping logic with lower height and better timing
    let shouldJump = false;
    
    if (!computerIsJumping) {
        const ballApproaching = ballVelocity.z * Math.sign(playerGoalZ) > 0;
        const ballInRange = distanceToBall < 2.2; // Reduced from 2.5
        const ballAtGoodHeight = ball.position.y > 0.4 && ball.position.y < 1.8; // Narrowed range
        const goodJumpingPosition = Math.abs(computerSlime.position.x - ball.position.x) < 1.2;
        
        shouldJump = ballInRange && ballAtGoodHeight && goodJumpingPosition &&
                    (ballApproaching || ball.position.y > 1.0);
                    
        // Add more randomness to reduce effectiveness
        shouldJump = shouldJump && Math.random() < 0.6; // Reduced from 0.7
    }
    
    if (shouldJump && !computerIsJumping) {
        computerVelocity.y = 0.22; // Reduced from 0.25
        computerIsJumping = true;
    }
    
    // Apply gravity with improved control
    computerVelocity.y = Math.max(computerVelocity.y - 0.015, -0.25);
    
    // Update position with improved collision handling
    const newPosition = computerSlime.position.clone().add(computerVelocity);
    if (newPosition.x >= -9 && newPosition.x <= 9 && 
        newPosition.z >= -14 && newPosition.z <= 14) {
        computerSlime.position.copy(newPosition);
    }
    
    // Ground collision
    if (computerSlime.position.y <= 0.6) {
        computerSlime.position.y = 0.6;
        computerVelocity.y = 0;
        computerIsJumping = false;
    }
    
    // Improved friction for better control
    computerVelocity.x *= 0.94; // Increased from 0.92 for more friction
    computerVelocity.z *= 0.94; // Increased from 0.92 for more friction
    if (Math.abs(computerVelocity.x) < 0.001) computerVelocity.x = 0;
    if (Math.abs(computerVelocity.z) < 0.001) computerVelocity.z = 0;
}

function animate() {
    requestAnimationFrame(animate);

    if (gameActive) {
        const playerSlime = selectedSlimeColor === 'red' ? redSlime : blueSlime;
        const computerSlime = selectedSlimeColor === 'red' ? blueSlime : redSlime;
        
        // Update slime face orientation
        playerSlime.children[1].lookAt(camera.position);
        computerSlime.children[1].lookAt(camera.position);

        // Update facial expressions based on jumping state
        const playerFace = playerSlime.children[1];
        playerFace.children[2].visible = !isJumping; // smile
        playerFace.children[3].visible = isJumping;  // surprised mouth

        const computerFace = computerSlime.children[1];
        computerFace.children[2].visible = !computerIsJumping; // smile
        computerFace.children[3].visible = computerIsJumping;  // surprised mouth

        // Slime movement
        const moveSpeed = 0.1; // Reduced from 0.15
        if (keys.ArrowLeft) slimeVelocity.x = -moveSpeed;
        if (keys.ArrowRight) slimeVelocity.x = moveSpeed;
        if (keys.ArrowUp) slimeVelocity.z = -moveSpeed;
        if (keys.ArrowDown) slimeVelocity.z = moveSpeed;
        if (keys.Space && !isJumping) {
            slimeVelocity.y = 0.25; // Reduced from 0.3
            isJumping = true;
        }

        // Apply gravity
        slimeVelocity.y -= 0.008; // Reduced from 0.01
        ballVelocity.y -= 0.015; // Reduced from 0.02

        // Store previous positions for collision resolution
        const prevPlayerPos = playerSlime.position.clone();
        const prevComputerPos = computerSlime.position.clone();

        // Update positions
        playerSlime.position.add(slimeVelocity);
        ball.position.add(ballVelocity);

        // Slime-to-slime collision detection and resolution
        const slimeCollisionDistance = 1.4; // Diameter of slime (2 * 0.7)
        const slimeDistance = playerSlime.position.distanceTo(computerSlime.position);
        
        if (slimeDistance < slimeCollisionDistance) {
            // Calculate collision normal
            const collisionNormal = new THREE.Vector3()
                .subVectors(playerSlime.position, computerSlime.position)
                .normalize();
            
            // Calculate relative velocity
            const relativeVelocity = new THREE.Vector3()
                .subVectors(slimeVelocity, computerVelocity);
            
            // Calculate impulse
            const restitution = 0.8; // Bounciness factor
            const impulseMagnitude = -(1 + restitution) * relativeVelocity.dot(collisionNormal) / 2;
            
            // Apply impulse to velocities
            const impulse = collisionNormal.multiplyScalar(impulseMagnitude);
            slimeVelocity.add(impulse);
            computerVelocity.sub(impulse);
            
            // Separate the slimes (prevent overlapping)
            const overlap = slimeCollisionDistance - slimeDistance;
            const separation = collisionNormal.multiplyScalar(overlap / 2);
            
            playerSlime.position.add(separation);
            computerSlime.position.sub(separation);
            
            // Add some vertical bounce for arcade feel
            if (!isJumping && !computerIsJumping) {
                slimeVelocity.y = 0.15;
                computerVelocity.y = 0.15;
                isJumping = true;
                computerIsJumping = true;
            }
            
            // Make faces surprised during collision
            playerFace.children[2].visible = false; // hide smile
            playerFace.children[3].visible = true;  // show surprised
            computerFace.children[2].visible = false;
            computerFace.children[3].visible = true;
        }

        // Ground collision
        if (playerSlime.position.y <= 0.6) {
            playerSlime.position.y = 0.6;
            slimeVelocity.y = 0;
            isJumping = false;
        }
        if (computerSlime.position.y <= 0.6) {
            computerSlime.position.y = 0.6;
            computerVelocity.y = 0;
            computerIsJumping = false;
        }
        if (ball.position.y <= 0.65) {
            ball.position.y = 0.65; // Set to exact minimum height
            const randomBounce = -0.4 * (0.9 + Math.random() * 0.2);
            const randomFriction = 0.95 * (0.95 + Math.random() * 0.1);
            ballVelocity.y *= randomBounce;
            ballVelocity.x *= randomFriction;
            ballVelocity.z *= randomFriction;
        }

        // Field boundaries with bouncing
        if (ball.position.x <= -9 || ball.position.x >= 9) {
            ball.position.x = THREE.MathUtils.clamp(ball.position.x, -9, 9);
            ballVelocity.x *= -0.7;
        }
        
        // Clamp slime positions to field boundaries
        playerSlime.position.x = THREE.MathUtils.clamp(playerSlime.position.x, -9, 9);
        playerSlime.position.z = THREE.MathUtils.clamp(playerSlime.position.z, -14, 14);
        computerSlime.position.x = THREE.MathUtils.clamp(computerSlime.position.x, -9, 9);
        computerSlime.position.z = THREE.MathUtils.clamp(computerSlime.position.z, -14, 14);

        // Goal detection
        if (Math.abs(ball.position.z) > 14) {
            if (Math.abs(ball.position.x) < 2.5) {
                if (ball.position.y < 3.75) {
                    if (ball.position.z > 0) {
                        redScore++;
                        document.querySelector('.red-score').textContent = redScore;
                    } else {
                        blueScore++;
                        document.querySelector('.blue-score').textContent = blueScore;
                    }
                    
                    if (redScore >= 10) {
                        handleGameOver('Red');
                    } else if (blueScore >= 10) {
                        handleGameOver('Blue');
                    } else {
                        resetPositions();
                    }
                } else {
                    ball.position.z = Math.sign(ball.position.z) * 14;
                    ballVelocity.z *= -1.2;
                    ballVelocity.y *= 0.8;
                }
            } else {
                ball.position.z = THREE.MathUtils.clamp(ball.position.z, -14, 14);
                ballVelocity.z *= -0.85;
            }
        }

        // Slime-ball collision with improved physics
        const slimeBallDistance = playerSlime.position.distanceTo(ball.position);
        if (slimeBallDistance < 0.9) {
            const direction = ball.position.clone().sub(playerSlime.position).normalize();
            // Add random variation to direction
            direction.x += (Math.random() - 0.5) * 0.3; // Reduced from 0.4
            direction.z += (Math.random() - 0.5) * 0.3; // Reduced from 0.4
            direction.normalize();
            
            // Random power multiplier
            const powerMultiplier = 0.2 + Math.random() * 0.1; // Reduced from 0.25 + 0.15
            ballVelocity.add(direction.multiplyScalar(powerMultiplier));
            
            // Random vertical bounce
            ballVelocity.y = 0.15 + Math.random() * 0.1; // Reduced from 0.2 + 0.15
            
            // Add slime velocity with random influence
            const velocityInfluence = 0.6 + Math.random() * 0.3; // Reduced from 0.8 + 0.4
            ballVelocity.add(slimeVelocity.clone().multiplyScalar(velocityInfluence));
            
            ball.rotation.x = ballVelocity.z * 0.4; // Reduced from 0.5
            ball.rotation.z = -ballVelocity.x * 0.4; // Reduced from 0.5
        }

        // Computer-ball collision with more aggressive hits
        const computerBallDistance = computerSlime.position.distanceTo(ball.position);
        if (computerBallDistance < 0.9) {
            const direction = ball.position.clone().sub(computerSlime.position).normalize();
            // Add random variation to direction
            direction.x += (Math.random() - 0.5) * 0.3; // Reduced from 0.4
            direction.z += (Math.random() - 0.5) * 0.3; // Reduced from 0.4
            direction.normalize();
            
            // Random power multiplier
            const powerMultiplier = 0.25 + Math.random() * 0.15; // Reduced from 0.3 + 0.2
            ballVelocity.add(direction.multiplyScalar(powerMultiplier));
            
            // Random vertical bounce
            ballVelocity.y = 0.2 + Math.random() * 0.1; // Reduced from 0.25 + 0.15
            
            // Add computer velocity with random influence
            const velocityInfluence = 0.8 + Math.random() * 0.3; // Reduced from 1.0 + 0.4
            ballVelocity.add(computerVelocity.clone().multiplyScalar(velocityInfluence));
            
            ball.rotation.x = ballVelocity.z * 0.4; // Reduced from 0.5
            ball.rotation.z = -ballVelocity.x * 0.4; // Reduced from 0.5
        }

        // Friction and air resistance
        slimeVelocity.x *= 0.85; // Increased friction from 0.9
        slimeVelocity.z *= 0.85; // Increased friction from 0.9
        ballVelocity.x *= 0.98; // Increased air resistance from 0.99
        ballVelocity.z *= 0.98; // Increased air resistance from 0.99

        // Ball rotation based on velocity
        ball.rotation.x += ballVelocity.z * 0.2;
        ball.rotation.z -= ballVelocity.x * 0.2;

        // Update computer movement
        updateComputerMovement();

        // Update crowd expressions
        const currentTime = Date.now();
        crowdFaces.forEach((face, index) => {
            if (currentTime - face.lastExpressionChange > 2000) {
                face.children[3].visible = false;
                face.children[4].visible = false;
                face.children[5].visible = false;
                
                const expression = Math.floor(Math.random() * 3);
                if (expression === 0) {
                    face.children[3].visible = true;
                } else if (expression === 1) {
                    face.children[4].visible = true;
                } else {
                    face.children[5].visible = true;
                }
                
                face.lastExpressionChange = currentTime;
            }
            
            face.position.y += Math.sin(Date.now() * 0.003 + index) * 0.001;
        });

        // Update flash effects
        updateFlashEffects();

        // Animate mystery box
        if (mysteryBox) {
            mysteryBox.rotation.y += mysteryBox.userData.rotationSpeed;
            mysteryBox.position.y = 1 + Math.sin(Date.now() * 0.003 + mysteryBox.userData.floatOffset) * 0.2;
        }

        // Mystery box collision detection
        if (mysteryBox) {
            const boxBounds = new THREE.Box3().setFromObject(mysteryBox);
            const ballBounds = new THREE.Box3().setFromObject(ball);
            const playerBounds = new THREE.Box3().setFromObject(playerSlime);
            const computerBounds = new THREE.Box3().setFromObject(computerSlime);
            
            if (boxBounds.intersectsBox(ballBounds) ||
                boxBounds.intersectsBox(playerBounds) ||
                boxBounds.intersectsBox(computerBounds)) {
                scene.remove(mysteryBox);
                mysteryBox = null;
                spawnMultipleBalls();
            }
        }

        // Update all active balls
        activeBalls.forEach(activeBall => {
            // Apply gravity
            activeBall.velocity.y -= 0.015;
            
            // Update position
            activeBall.mesh.position.add(activeBall.velocity);
            
            // Ground collision
            if (activeBall.mesh.position.y <= 0.65) {
                activeBall.mesh.position.y = 0.65;
                activeBall.velocity.y *= -0.4;
                activeBall.velocity.x *= 0.95;
                activeBall.velocity.z *= 0.95;
            }
            
            // Wall collisions
            if (activeBall.mesh.position.x <= -9 || activeBall.mesh.position.x >= 9) {
                activeBall.mesh.position.x = THREE.MathUtils.clamp(activeBall.mesh.position.x, -9, 9);
                activeBall.velocity.x *= -0.7;
            }
            
            // Slime collisions
            const playerBallDistance = playerSlime.position.distanceTo(activeBall.mesh.position);
            const computerBallDistance = computerSlime.position.distanceTo(activeBall.mesh.position);
            
            if (playerBallDistance < 0.9) {
                handleSlimeBallCollision(playerSlime, activeBall.mesh, activeBall.velocity, slimeVelocity);
            }
            if (computerBallDistance < 0.9) {
                handleSlimeBallCollision(computerSlime, activeBall.mesh, activeBall.velocity, computerVelocity);
            }
            
            // Goal detection for extra balls
            if (Math.abs(activeBall.mesh.position.z) > 14 && Math.abs(activeBall.mesh.position.x) < 2.5 && activeBall.mesh.position.y < 3.75) {
                if (activeBall.mesh.position.z > 0) {
                    redScore++;
                    document.querySelector('.red-score').textContent = redScore;
                } else {
                    blueScore++;
                    document.querySelector('.blue-score').textContent = blueScore;
                }
                
                // Clear all extra balls and return to normal game
                activeBalls.forEach(ball => {
                    scene.remove(ball.mesh);
                });
                activeBalls = [];
                isMultiBallActive = false;
                
                if (redScore >= 10) {
                    handleGameOver('Red');
                } else if (blueScore >= 10) {
                    handleGameOver('Blue');
                } else {
                    resetPositions();
                }
            }
        });
    }

    renderer.render(scene, camera);
}

function handleSlimeBallCollision(slime, collidingBall, ballVel, slimeVel) {
    const direction = collidingBall.position.clone().sub(slime.position).normalize();
    direction.x += (Math.random() - 0.5) * 0.3;
    direction.z += (Math.random() - 0.5) * 0.3;
    direction.normalize();
    
    const powerMultiplier = 0.2 + Math.random() * 0.1;
    ballVel.add(direction.multiplyScalar(powerMultiplier));
    
    ballVel.y = 0.15 + Math.random() * 0.1;
    
    const velocityInfluence = 0.6 + Math.random() * 0.3;
    ballVel.add(slimeVel.clone().multiplyScalar(velocityInfluence));
    
    collidingBall.rotation.x = ballVel.z * 0.4;
    collidingBall.rotation.z = -ballVel.x * 0.4;
} 
