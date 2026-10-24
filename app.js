/**
 * The Traitor Party Game - Core Application Logic
 * 100% Serverless & GitHub Pages Compatible
 */

(function () {
  'use strict';

  // --- STATE ---
  let gameState = {
    isHost: false,
    roomId: null,
    totalPlayers: 3,
    traitorCount: 1,
    innocentCount: 2,
    roundNumber: 1,
    roleDeck: [],
    assignedPlayers: {}, // { playerId: { name, role, slotIndex, claimedAt } }
    myPlayerId: null,
    myPlayerName: '',
    myRole: null,
    peer: null,
    hostConn: null,
    seedData: null,
  };

  // --- DOM ELEMENTS ---
  const views = {
    hostSetup: document.getElementById('hostSetupView'),
    hostLobby: document.getElementById('hostLobbyView'),
    player: document.getElementById('playerView'),
  };

  // Host Setup Elements
  const playerCountVal = document.getElementById('playerCountVal');
  const traitorCountVal = document.getElementById('traitorCountVal');
  const summaryTraitorCount = document.getElementById('summaryTraitorCount');
  const summaryInnocentCount = document.getElementById('summaryInnocentCount');
  const decPlayersBtn = document.getElementById('decPlayers');
  const incPlayersBtn = document.getElementById('incPlayers');
  const decTraitorsBtn = document.getElementById('decTraitors');
  const incTraitorsBtn = document.getElementById('incTraitors');
  const createGameBtn = document.getElementById('createGameBtn');

  // Host Lobby Elements
  const hostRoomCodeBadge = document.getElementById('hostRoomCodeBadge');
  const hostQrCodeContainer = document.getElementById('hostQrCode');
  const hostClaimStatus = document.getElementById('hostClaimStatus');
  const hostPlayerList = document.getElementById('hostPlayerList');
  const copyLinkBtn = document.getElementById('copyLinkBtn');
  const whatsappShareBtn = document.getElementById('whatsappShareBtn');
  const hostNextRoundBtn = document.getElementById('hostNextRoundBtn');
  const hostResetBtn = document.getElementById('hostResetBtn');
  const networkStatusBadge = document.getElementById('networkStatusBadge');

  // Player Elements
  const playerRoomBadge = document.getElementById('playerRoomBadge');
  const playerSubheading = document.getElementById('playerSubheading');
  const playerJoinSection = document.getElementById('playerJoinSection');
  const playerNameInput = document.getElementById('playerNameInput');
  const claimRoleBtn = document.getElementById('claimRoleBtn');
  const slotPickerContainer = document.getElementById('slotPickerContainer');
  const slotPickerGrid = document.getElementById('slotPickerGrid');
  const playerCardSection = document.getElementById('playerCardSection');
  const secretCard = document.getElementById('secretCard');
  const revealedCardBack = document.getElementById('revealedCardBack');
  const roleIcon = document.getElementById('roleIcon');
  const roleTitle = document.getElementById('roleTitle');
  const roleDescription = document.getElementById('roleDescription');
  const toggleRevealBtn = document.getElementById('toggleRevealBtn');
  const hideNowBtn = document.getElementById('hideNowBtn');
  const autoHideBadge = document.getElementById('autoHideBadge');
  const holdProgressFill = document.getElementById('holdProgressFill');
  const leaveRoomBtn = document.getElementById('leaveRoomBtn');
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const toast = document.getElementById('toast');

  let autoHideTimer = null;
  let autoHideSeconds = 10;
  let isCardRevealed = false;
  let qrCodeInstance = null;
  let holdInterval = null;

  // --- INITIALIZATION ---
  function init() {
    setupSoundToggle();
    setupHostSetupControls();
    setupPlayerControls();
    checkUrlForRoom();
  }

  // --- VIEW ROUTING ---
  function switchView(viewName) {
    Object.values(views).forEach(v => v.classList.remove('active'));
    if (views[viewName]) {
      views[viewName].classList.add('active');
    }
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }

  // --- AUDIO CONTROLS ---
  function setupSoundToggle() {
    soundToggleBtn.addEventListener('click', () => {
      if (window.soundFx) {
        const isMuted = window.soundFx.toggleMute();
        soundToggleBtn.textContent = isMuted ? '🔇' : '🔊';
        soundToggleBtn.setAttribute('title', isMuted ? 'Unmute Sound' : 'Mute Sound');
      }
    });
  }

  // --- HOST SETUP LOGIC ---
  function updateSetupDisplay() {
    playerCountVal.textContent = gameState.totalPlayers;
    traitorCountVal.textContent = gameState.traitorCount;

    // Validate traitors
    if (gameState.traitorCount >= gameState.totalPlayers) {
      gameState.traitorCount = Math.max(1, gameState.totalPlayers - 1);
      traitorCountVal.textContent = gameState.traitorCount;
    }

    gameState.innocentCount = gameState.totalPlayers - gameState.traitorCount;
    summaryTraitorCount.textContent = gameState.traitorCount;
    summaryInnocentCount.textContent = gameState.innocentCount;
  }

  function setupHostSetupControls() {
    decPlayersBtn.addEventListener('click', () => {
      window.soundFx && window.soundFx.playClick();
      if (gameState.totalPlayers > 3) {
        gameState.totalPlayers--;
        updateSetupDisplay();
      }
    });

    incPlayersBtn.addEventListener('click', () => {
      window.soundFx && window.soundFx.playClick();
      if (gameState.totalPlayers < 30) {
        gameState.totalPlayers++;
        updateSetupDisplay();
      }
    });

    decTraitorsBtn.addEventListener('click', () => {
      window.soundFx && window.soundFx.playClick();
      if (gameState.traitorCount > 1) {
        gameState.traitorCount--;
        updateSetupDisplay();
      }
    });

    incTraitorsBtn.addEventListener('click', () => {
      window.soundFx && window.soundFx.playClick();
      if (gameState.traitorCount < gameState.totalPlayers - 1) {
        gameState.traitorCount++;
        updateSetupDisplay();
      }
    });

    createGameBtn.addEventListener('click', () => {
      window.soundFx && window.soundFx.playClick();
      createGameRoom();
    });

    copyLinkBtn.addEventListener('click', () => {
      const shareUrl = getShareableRoomUrl();
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast('Room link copied to clipboard!');
      }).catch(() => {
        prompt('Copy this room link:', shareUrl);
      });
    });

    whatsappShareBtn.addEventListener('click', () => {
      const shareUrl = getShareableRoomUrl();
      const text = encodeURIComponent(`🕵️ Join my Traitor game room!\nClick here to claim your secret role:\n${shareUrl}`);
      window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    });

    hostNextRoundBtn.addEventListener('click', () => {
      window.soundFx && window.soundFx.playClick();
      startNextRound();
    });

    hostResetBtn.addEventListener('click', () => {
      window.soundFx && window.soundFx.playClick();
      if (confirm('Are you sure you want to end this game and start fresh?')) {
        location.href = location.pathname;
      }
    });
  }

  // --- SEEDED RANDOM & DECK SHUFFLING ---
  function generateDeck(total, traitors) {
    const deck = [];
    for (let i = 0; i < traitors; i++) {
      deck.push('TRAITOR');
    }
    for (let i = 0; i < total - traitors; i++) {
      deck.push('INNOCENT');
    }
    // Fisher-Yates shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  // Simple deterministic PRNG for standalone hash/slot mode
  function mulberry32(a) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function generateSeededDeck(total, traitors, seedNum) {
    const deck = [];
    for (let i = 0; i < traitors; i++) deck.push('TRAITOR');
    for (let i = 0; i < total - traitors; i++) deck.push('INNOCENT');
    const prng = mulberry32(seedNum);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(prng() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  function hashSeed(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  // --- CREATE GAME ROOM (HOST) ---
  function createGameRoom() {
    gameState.isHost = true;
    gameState.roomId = 'TR' + Math.floor(1000 + Math.random() * 9000);
    gameState.seed = Math.floor(100000 + Math.random() * 900000);
    gameState.roundNumber = 1;
    gameState.roleDeck = generateDeck(gameState.totalPlayers, gameState.traitorCount);
    gameState.assignedPlayers = {};

    switchView('hostLobby');
    hostRoomCodeBadge.textContent = `ROOM: ${gameState.roomId}`;
    renderHostPlayerList();
    renderQrCode();
    initHostPeer();
  }

  function startNextRound() {
    gameState.roundNumber++;
    gameState.roleDeck = generateDeck(gameState.totalPlayers, gameState.traitorCount);
    gameState.seed = Math.floor(100000 + Math.random() * 900000);
    gameState.assignedPlayers = {};

    renderHostPlayerList();
    renderQrCode();

    // Broadcast reset to all connected peers
    if (gameState.peer && gameState.connectedSockets) {
      Object.values(gameState.connectedSockets).forEach(conn => {
        try {
          conn.send({
            type: 'ROUND_RESET',
            roundNumber: gameState.roundNumber,
            seed: gameState.seed,
          });
        } catch (e) {}
      });
    }
    showToast(`Round ${gameState.roundNumber} started! Roles reshuffled.`);
  }

  function getShareableRoomUrl() {
    const base = window.location.origin + window.location.pathname;
    const params = new URLSearchParams({
      room: gameState.roomId,
      p: gameState.totalPlayers,
      t: gameState.traitorCount,
      r: gameState.roundNumber,
      s: gameState.seed,
    });
    return `${base}?${params.toString()}`;
  }

  function renderQrCode() {
    const url = getShareableRoomUrl();
    hostQrCodeContainer.innerHTML = '';
    try {
      qrCodeInstance = new QRCode(hostQrCodeContainer, {
        text: url,
        width: 190,
        height: 190,
        colorDark: '#0c0d14',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M,
      });
    } catch (e) {
      console.warn('QR code render fallback', e);
    }
  }

  function renderHostPlayerList() {
    hostPlayerList.innerHTML = '';
    const claimedCount = Object.keys(gameState.assignedPlayers).length;
    hostClaimStatus.textContent = `${claimedCount} of ${gameState.totalPlayers} roles claimed`;

    for (let i = 0; i < gameState.totalPlayers; i++) {
      const li = document.createElement('li');
      li.className = 'player-item';

      const playerKey = Object.keys(gameState.assignedPlayers)[i];
      if (playerKey) {
        const p = gameState.assignedPlayers[playerKey];
        li.innerHTML = `
          <span>👤 <strong>${escapeHtml(p.name)}</strong> (Slot ${i + 1})</span>
          <span class="player-status ready">✓ Role Claimed</span>
        `;
      } else {
        li.innerHTML = `
          <span style="color: var(--text-muted);">Slot ${i + 1}</span>
          <span class="player-status waiting">Waiting...</span>
        `;
      }
      hostPlayerList.appendChild(li);
    }
  }

  // --- HOST PEERJS NETWORKING ---
  function initHostPeer() {
    if (typeof Peer === 'undefined') {
      networkStatusBadge.textContent = '⚡ Direct Seed Mode';
      return;
    }

    try {
      const peerId = `traitor-host-${gameState.roomId}`;
      if (gameState.peer) {
        gameState.peer.destroy();
      }

      gameState.peer = new Peer(peerId, {
        debug: 1,
      });

      gameState.connectedSockets = {};

      gameState.peer.on('open', (id) => {
        networkStatusBadge.textContent = '🟢 Live Sync Ready';
      });

      gameState.peer.on('connection', (conn) => {
        gameState.connectedSockets[conn.peer] = conn;

        conn.on('data', (data) => {
          handleHostIncomingMessage(conn, data);
        });

        conn.on('close', () => {
          delete gameState.connectedSockets[conn.peer];
        });
      });

      gameState.peer.on('error', (err) => {
        console.warn('PeerJS host error, fallback active:', err);
        networkStatusBadge.textContent = '⚡ Direct URL Mode';
      });
    } catch (err) {
      console.warn('Peer init error:', err);
    }
  }

  function handleHostIncomingMessage(conn, data) {
    if (data.type === 'CLAIM_ROLE') {
      const playerId = data.playerId || conn.peer;
      const playerName = data.playerName || 'Player';

      // Check if player already has an assigned role this round
      if (gameState.assignedPlayers[playerId]) {
        conn.send({
          type: 'ROLE_ASSIGNED',
          role: gameState.assignedPlayers[playerId].role,
          name: gameState.assignedPlayers[playerId].name,
          slotIndex: gameState.assignedPlayers[playerId].slotIndex,
          roundNumber: gameState.roundNumber,
        });
        return;
      }

      // Check if room is full
      const currentAssigned = Object.keys(gameState.assignedPlayers).length;
      if (currentAssigned >= gameState.totalPlayers) {
        conn.send({
          type: 'ROOM_FULL',
          message: 'All player slots in this game have already been claimed!',
        });
        return;
      }

      // Draw next available role from the shuffled deck
      const assignedRole = gameState.roleDeck[currentAssigned];
      gameState.assignedPlayers[playerId] = {
        name: playerName,
        role: assignedRole,
        slotIndex: currentAssigned + 1,
        claimedAt: Date.now(),
      };

      renderHostPlayerList();

      conn.send({
        type: 'ROLE_ASSIGNED',
        role: assignedRole,
        name: playerName,
        slotIndex: currentAssigned + 1,
        roundNumber: gameState.roundNumber,
      });
    }
  }

  // --- PLAYER CLIENT LOGIC ---
  function checkUrlForRoom() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    const modeParam = urlParams.get('mode');

    if (modeParam === 'sudoku' || (roomParam && roomParam.startsWith('SUDOKU-'))) {
      // Sudoku mode is handled by sudoku.js
      return;
    }

    if (roomParam) {
      // User is joining as a player
      gameState.roomId = roomParam;
      gameState.totalPlayers = parseInt(urlParams.get('p')) || 3;
      gameState.traitorCount = parseInt(urlParams.get('t')) || 1;
      gameState.roundNumber = parseInt(urlParams.get('r')) || 1;
      gameState.seed = parseInt(urlParams.get('s')) || hashSeed(roomParam);

      setupPlayerSession();
    }
  }

  function setupPlayerSession() {
    switchView('player');
    playerRoomBadge.textContent = `ROOM: ${gameState.roomId}`;

    // Generate or retrieve persistent player ID
    let savedPlayerId = localStorage.getItem('traitor_player_id');
    if (!savedPlayerId) {
      savedPlayerId = 'p_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('traitor_player_id', savedPlayerId);
    }
    gameState.myPlayerId = savedPlayerId;

    const savedName = localStorage.getItem('traitor_player_name');
    if (savedName) {
      playerNameInput.value = savedName;
    }

    // Check if player has already claimed a role for this room & round in localStorage
    const storageKey = `traitor_role_${gameState.roomId}_r${gameState.roundNumber}`;
    const storedRoleData = localStorage.getItem(storageKey);

    if (storedRoleData) {
      try {
        const parsed = JSON.parse(storedRoleData);
        displayAssignedRole(parsed.role, parsed.name);
        return;
      } catch (e) {}
    }

    // Render slot picker fallback
    renderSlotPickerGrid();

    // Connect to host via PeerJS if available
    initPlayerPeer();
  }

  function renderSlotPickerGrid() {
    slotPickerGrid.innerHTML = '';
    for (let i = 1; i <= gameState.totalPlayers; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'slot-btn';
      btn.dataset.slot = i;
      btn.innerHTML = `<span>👤 Slot ${i}</span>`;
      btn.addEventListener('click', () => {
        window.soundFx && window.soundFx.playClick();
        document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        gameState.selectedSlot = i;
      });
      slotPickerGrid.appendChild(btn);
    }
  }

  function initPlayerPeer() {
    if (typeof Peer === 'undefined') {
      slotPickerContainer.style.display = 'block';
      return;
    }

    try {
      const peer = new Peer({ debug: 1 });
      gameState.peer = peer;

      peer.on('open', () => {
        const hostPeerId = `traitor-host-${gameState.roomId}`;
        const conn = peer.connect(hostPeerId, { reliable: true });
        gameState.hostConn = conn;

        conn.on('open', () => {
          playerSubheading.textContent = '🟢 Connected to host. Claim your role!';
          slotPickerContainer.style.display = 'none';
        });

        conn.on('data', (data) => {
          handlePlayerIncomingMessage(data);
        });

        conn.on('error', (err) => {
          console.warn('Connection to host failed, enabling slot mode:', err);
          slotPickerContainer.style.display = 'block';
        });
      });

      peer.on('error', (err) => {
        console.warn('Player peer error, enabling slot fallback:', err);
        slotPickerContainer.style.display = 'block';
      });

      // 4-second timeout to display slot picker if host peer is unreachable
      setTimeout(() => {
        if (!gameState.hostConn || !gameState.hostConn.open) {
          slotPickerContainer.style.display = 'block';
        }
      }, 4000);

    } catch (e) {
      slotPickerContainer.style.display = 'block';
    }
  }

  function handlePlayerIncomingMessage(data) {
    if (data.type === 'ROLE_ASSIGNED') {
      saveAndDisplayRole(data.role, data.name);
    } else if (data.type === 'ROOM_FULL') {
      showToast(data.message);
      alert(data.message);
    } else if (data.type === 'ROUND_RESET') {
      gameState.roundNumber = data.roundNumber;
      gameState.seed = data.seed;
      resetPlayerCardView();
      showToast(`Next Round Started! Claim your new role.`);
    }
  }

  function setupPlayerControls() {
    claimRoleBtn.addEventListener('click', () => {
      window.soundFx && window.soundFx.playClick();
      const name = playerNameInput.value.trim() || `Player ${Math.floor(1 + Math.random() * 99)}`;
      localStorage.setItem('traitor_player_name', name);
      gameState.myPlayerName = name;

      if (gameState.hostConn && gameState.hostConn.open) {
        gameState.hostConn.send({
          type: 'CLAIM_ROLE',
          playerId: gameState.myPlayerId,
          playerName: name,
        });
      } else {
        // Deterministic Seed & Slot Fallback
        const slot = gameState.selectedSlot || 1;
        const deterministicDeck = generateSeededDeck(gameState.totalPlayers, gameState.traitorCount, gameState.seed);
        const assignedRole = deterministicDeck[(slot - 1) % deterministicDeck.length];
        saveAndDisplayRole(assignedRole, name);
      }
    });

    toggleRevealBtn.addEventListener('click', () => {
      toggleCardFlip();
    });

    hideNowBtn.addEventListener('click', () => {
      hideCard();
    });

    leaveRoomBtn.addEventListener('click', () => {
      if (confirm('Leave this room and return to main screen?')) {
        window.location.href = window.location.pathname;
      }
    });

    // Tap / Hold Card interaction
    setupHoldToReveal();
  }

  function setupHoldToReveal() {
    let holdStartTime = 0;
    const requiredHoldMs = 500;

    function startHold(e) {
      if (isCardRevealed) return;
      holdStartTime = Date.now();
      window.soundFx && window.soundFx.init();

      holdInterval = setInterval(() => {
        const elapsed = Date.now() - holdStartTime;
        const progress = Math.min(1, elapsed / requiredHoldMs);
        holdProgressFill.style.width = `${progress * 100}%`;

        if (progress >= 1) {
          clearInterval(holdInterval);
          revealCard();
        }
      }, 30);
    }

    function cancelHold() {
      if (holdInterval) {
        clearInterval(holdInterval);
        holdInterval = null;
      }
      holdProgressFill.style.width = '0%';
    }

    secretCard.addEventListener('mousedown', startHold);
    secretCard.addEventListener('mouseup', cancelHold);
    secretCard.addEventListener('mouseleave', cancelHold);

    secretCard.addEventListener('touchstart', startHold, { passive: true });
    secretCard.addEventListener('touchend', cancelHold);
    secretCard.addEventListener('touchcancel', cancelHold);
  }

  function saveAndDisplayRole(role, name) {
    gameState.myRole = role;
    gameState.myPlayerName = name;

    const storageKey = `traitor_role_${gameState.roomId}_r${gameState.roundNumber}`;
    localStorage.setItem(storageKey, JSON.stringify({ role, name }));

    displayAssignedRole(role, name);
  }

  function displayAssignedRole(role, name) {
    playerJoinSection.style.display = 'none';
    playerCardSection.style.display = 'block';

    revealedCardBack.className = 'card-face card-face-back ' + (role === 'TRAITOR' ? 'traitor' : 'innocent');

    if (role === 'TRAITOR') {
      roleIcon.textContent = '🗡️';
      roleTitle.textContent = 'YOU ARE THE TRAITOR';
      roleDescription.innerHTML = `
        You are the <strong>secret assassin</strong>.<br>
        Blend in with the innocents, sow discord, and deceive everyone without getting discovered!
      `;
    } else {
      roleIcon.textContent = '🛡️';
      roleTitle.textContent = 'YOU ARE INNOCENT';
      roleDescription.innerHTML = `
        You are a <strong>loyal citizen</strong>.<br>
        Work with your fellow innocents, complete your goals, and uncover the Traitor before you are eliminated!
      `;
    }

    playerSubheading.textContent = `Player: ${escapeHtml(name)}`;
  }

  function toggleCardFlip() {
    if (isCardRevealed) {
      hideCard();
    } else {
      revealCard();
    }
  }

  function revealCard() {
    isCardRevealed = true;
    secretCard.classList.add('flipped');
    toggleRevealBtn.textContent = '🔒 Hide Secret Role';
    hideNowBtn.style.display = 'inline-flex';

    window.soundFx && window.soundFx.playFlip();

    if (gameState.myRole === 'TRAITOR') {
      setTimeout(() => window.soundFx && window.soundFx.playTraitorSting(), 200);
    } else {
      setTimeout(() => window.soundFx && window.soundFx.playInnocentChime(), 200);
    }

    // Auto-hide countdown
    startAutoHideTimer();
  }

  function hideCard() {
    isCardRevealed = false;
    secretCard.classList.remove('flipped');
    toggleRevealBtn.textContent = '👁️ Tap to Reveal Role';
    hideNowBtn.style.display = 'none';
    holdProgressFill.style.width = '0%';
    window.soundFx && window.soundFx.playFlip();
    clearAutoHideTimer();
  }

  function startAutoHideTimer() {
    clearAutoHideTimer();
    autoHideSeconds = 10;
    autoHideBadge.textContent = `Auto-hiding in ${autoHideSeconds}s`;

    autoHideTimer = setInterval(() => {
      autoHideSeconds--;
      if (autoHideSeconds <= 0) {
        hideCard();
      } else {
        autoHideBadge.textContent = `Auto-hiding in ${autoHideSeconds}s`;
      }
    }, 1000);
  }

  function clearAutoHideTimer() {
    if (autoHideTimer) {
      clearInterval(autoHideTimer);
      autoHideTimer = null;
    }
  }

  function resetPlayerCardView() {
    hideCard();
    playerCardSection.style.display = 'none';
    playerJoinSection.style.display = 'block';
  }

  // --- HELPERS ---
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Start app on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
