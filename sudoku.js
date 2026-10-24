/**
 * Multiplayer Sudoku Race Engine & Realtime Synchronization
 * 100% Serverless, PeerJS & GitHub Pages Compatible
 */

(function () {
  'use strict';

  // --- SUDOKU CORE ENGINE & SOLVER ---
  const SudokuEngine = {
    // Preset certified puzzles (81 chars: 0 or . = empty)
    PRESETS: {
      easy: '003020600900305001001806400008102900700000008006708200002609500800203009005010300',
      medium: '200000006007001000000020000000040900000000050000000000100406000000000200000000074',
      hard: '020000000000600003074080000000003002080040010600500000000010780500009000000000040',
      expert: '100007090030020008009600500005300900010080002600004000300000010040000007007000300'
    },

    parseGrid(input) {
      if (typeof input !== 'string') return null;
      const cleaned = input.trim().replace(/[\r\n\s|+-]/g, '').replace(/\./g, '0');
      if (cleaned.length !== 81) return null;
      const grid = [];
      for (let i = 0; i < 81; i++) {
        const n = parseInt(cleaned[i], 10);
        if (isNaN(n) || n < 0 || n > 9) return null;
        grid.push(n);
      }
      return grid;
    },

    gridToString(grid) {
      return grid.map(v => (v > 0 ? v : '.')).join('');
    },

    isValidPlacement(grid, idx, num) {
      const row = Math.floor(idx / 9);
      const col = idx % 9;
      const boxRow = Math.floor(row / 3) * 3;
      const boxCol = Math.floor(col / 3) * 3;

      for (let c = 0; c < 9; c++) {
        const i = row * 9 + c;
        if (i !== idx && grid[i] === num) return false;
      }
      for (let r = 0; r < 9; r++) {
        const i = r * 9 + col;
        if (i !== idx && grid[i] === num) return false;
      }
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const i = (boxRow + r) * 9 + (boxCol + c);
          if (i !== idx && grid[i] === num) return false;
        }
      }
      return true;
    },

    findConflicts(grid) {
      const conflicts = new Set();
      for (let i = 0; i < 81; i++) {
        const val = grid[i];
        if (val > 0 && !this.isValidPlacement(grid, i, val)) {
          conflicts.add(i);
        }
      }
      return conflicts;
    },

    solve(grid) {
      const g = [...grid];
      function backtrack(idx) {
        while (idx < 81 && g[idx] !== 0) idx++;
        if (idx >= 81) return true;

        for (let num = 1; num <= 9; num++) {
          if (SudokuEngine.isValidPlacement(g, idx, num)) {
            g[idx] = num;
            if (backtrack(idx + 1)) return true;
            g[idx] = 0;
          }
        }
        return false;
      }
      return backtrack(0) ? g : null;
    },

    validatePuzzle(grid) {
      const conflicts = this.findConflicts(grid);
      if (conflicts.size > 0) {
        return { valid: false, reason: 'Puzzle contains conflicting clues.' };
      }
      const clueCount = grid.filter(v => v > 0).length;
      if (clueCount < 17) {
        return { valid: false, reason: 'At least 17 clues are required for a valid Sudoku.' };
      }
      const solution = this.solve(grid);
      if (!solution) {
        return { valid: false, reason: 'This puzzle has no valid solution.' };
      }
      return { valid: true, solution, clueCount };
    },

    isCompletedAndValid(grid, originalClues, targetSolution) {
      for (let i = 0; i < 81; i++) {
        if (!grid[i] || grid[i] === 0 || isNaN(grid[i])) return false;
        if (originalClues[i] > 0 && grid[i] !== originalClues[i]) return false;
      }
      // If targetSolution matches
      if (targetSolution) {
        let matches = true;
        for (let i = 0; i < 81; i++) {
          if (grid[i] !== targetSolution[i]) {
            matches = false;
            break;
          }
        }
        if (matches) return true;
      }
      // Check row, column, and 3x3 block uniqueness
      for (let r = 0; r < 9; r++) {
        const s = new Set();
        for (let c = 0; c < 9; c++) s.add(grid[r * 9 + c]);
        if (s.size !== 9) return false;
      }
      for (let c = 0; c < 9; c++) {
        const s = new Set();
        for (let r = 0; r < 9; r++) s.add(grid[r * 9 + c]);
        if (s.size !== 9) return false;
      }
      for (let br = 0; br < 3; br++) {
        for (let bc = 0; bc < 3; bc++) {
          const s = new Set();
          for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
              s.add(grid[(br * 3 + r) * 9 + (bc * 3 + c)]);
            }
          }
          if (s.size !== 9) return false;
        }
      }
      return true;
    }
  };

  // --- STATE MANAGEMENT ---
  const state = {
    isAdmin: false,
    roomId: null,
    puzzleString: SudokuEngine.PRESETS.medium,
    originalClues: [],
    solution: null,
    playerGrid: [],
    playerNotes: Array.from({ length: 81 }, () => new Set()),
    selectedCell: null,
    notesMode: false,
    timerSeconds: 0,
    timerInterval: null,
    raceStarted: false,
    raceFinished: false,
    myFinishTime: null,
    winnerAnnounced: null, // { winnerName, timeFormatted }
    history: [],
    connectedPlayers: {}, // { peerId: { name, filledCount, finished, timeFormatted } }
    peer: null,
    hostConn: null,
    myPlayerId: null,
    myPlayerName: '',
    liveMistakeHints: false,
    highlightConflicts: false
  };

  // --- DOM REFERENCES ---
  const dom = {};

  function cacheDom() {
    dom.navTraitorBtn = document.getElementById('navTraitorBtn');
    dom.navSudokuBtn = document.getElementById('navSudokuBtn');
    dom.gameTitle = document.querySelector('.game-title');
    dom.subtitle = document.querySelector('.subtitle');

    // Sections
    dom.traitorViews = [
      document.getElementById('hostSetupView'),
      document.getElementById('hostLobbyView'),
      document.getElementById('playerView')
    ];

    dom.sudokuSection = document.getElementById('sudokuSection');
    dom.sudokuAdminSetupView = document.getElementById('sudokuAdminSetupView');
    dom.sudokuHostLobbyView = document.getElementById('sudokuHostLobbyView');
    dom.sudokuPlayerJoinView = document.getElementById('sudokuPlayerJoinView');
    dom.sudokuGameView = document.getElementById('sudokuGameView');

    // Admin Setup
    dom.puzzleTextInput = document.getElementById('puzzleTextInput');
    dom.pasteClipboardBtn = document.getElementById('pasteClipboardBtn');
    dom.copyPuzzleBtn = document.getElementById('copyPuzzleBtn');
    dom.clearPuzzleBtn = document.getElementById('clearPuzzleBtn');
    dom.puzzleFileInput = document.getElementById('puzzleFileInput');
    dom.validatePuzzleBtn = document.getElementById('validatePuzzleBtn');
    dom.puzzleValidationStatus = document.getElementById('puzzleValidationStatus');
    dom.adminPreviewGrid = document.getElementById('adminPreviewGrid');
    dom.createSudokuRoomBtn = document.getElementById('createSudokuRoomBtn');
    dom.hostLiveMistakeToggle = document.getElementById('hostLiveMistakeToggle');

    // Host Lobby
    dom.sudokuHostRoomBadge = document.getElementById('sudokuHostRoomBadge');
    dom.sudokuHostWinnerCard = document.getElementById('sudokuHostWinnerCard');
    dom.sudokuHostWinnerText = document.getElementById('sudokuHostWinnerText');
    dom.sudokuHostQrCode = document.getElementById('sudokuHostQrCode');
    dom.sudokuCopyLinkBtn = document.getElementById('sudokuCopyLinkBtn');
    dom.sudokuWhatsappBtn = document.getElementById('sudokuWhatsappBtn');
    dom.sudokuHostStartRaceBtn = document.getElementById('sudokuHostStartRaceBtn');
    dom.sudokuHostPlayTooBtn = document.getElementById('sudokuHostPlayTooBtn');
    dom.sudokuHostPlayerList = document.getElementById('sudokuHostPlayerList');
    dom.sudokuHostPlayerCount = document.getElementById('sudokuHostPlayerCount');
    dom.sudokuHostResetBtn = document.getElementById('sudokuHostResetBtn');

    // Player Join
    dom.sudokuPlayerRoomBadge = document.getElementById('sudokuPlayerRoomBadge');
    dom.sudokuPlayerNameInput = document.getElementById('sudokuPlayerNameInput');
    dom.sudokuJoinRaceBtn = document.getElementById('sudokuJoinRaceBtn');
    dom.sudokuPlayerWaitingMsg = document.getElementById('sudokuPlayerWaitingMsg');

    // Game Board
    dom.sudokuTimer = document.getElementById('sudokuTimer');
    dom.sudokuFilledCount = document.getElementById('sudokuFilledCount');
    dom.sudokuFilledBar = document.getElementById('sudokuFilledBar');
    dom.sudokuRaceStatusBadge = document.getElementById('sudokuRaceStatusBadge');
    dom.sudokuGrid = document.getElementById('sudokuGrid');
    dom.sudokuNotesToggle = document.getElementById('sudokuNotesToggle');
    dom.sudokuEraseBtn = document.getElementById('sudokuEraseBtn');
    dom.sudokuUndoBtn = document.getElementById('sudokuUndoBtn');
    dom.sudokuCheckBtn = document.getElementById('sudokuCheckBtn');
    dom.sudokuConflictToggle = document.getElementById('sudokuConflictToggle');

    // Winner Banner & Modals
    dom.raceWinnerBanner = document.getElementById('raceWinnerBanner');
    dom.raceWinnerBannerText = document.getElementById('raceWinnerBannerText');
    dom.dismissBannerBtn = document.getElementById('dismissBannerBtn');
    dom.sudokuModalOverlay = document.getElementById('sudokuModalOverlay');
    dom.sudokuModalContent = document.getElementById('sudokuModalContent');
    dom.sudokuModalClose = document.getElementById('sudokuModalClose');
  }

  // --- INITIALIZATION ---
  function init() {
    cacheDom();
    setupModeNavigation();
    setupAdminSetupControls();
    setupHostLobbyControls();
    setupPlayerJoinControls();
    setupGameBoardControls();
    setupKeyboardListeners();

    // Check URL parameters for sudoku mode or room
    checkUrlParams();
  }

  // --- GAME MODE SWITCHER ---
  function setupModeNavigation() {
    dom.navTraitorBtn.addEventListener('click', () => switchMode('traitor'));
    dom.navSudokuBtn.addEventListener('click', () => switchMode('sudoku'));
  }

  function switchMode(mode) {
    if (mode === 'traitor') {
      dom.navTraitorBtn.classList.add('active');
      dom.navSudokuBtn.classList.remove('active');
      dom.gameTitle.textContent = 'THE TRAITOR';
      dom.subtitle.textContent = 'Trust no one. Deceive everyone.';
      dom.sudokuSection.style.display = 'none';

      // Restore active traitor view
      const activeTraitor = dom.traitorViews.find(v => v.classList.contains('active')) || dom.traitorViews[0];
      activeTraitor.classList.add('active');
    } else {
      dom.navSudokuBtn.classList.add('active');
      dom.navTraitorBtn.classList.remove('active');
      dom.gameTitle.textContent = 'SUDOKU RACE';
      dom.subtitle.textContent = 'Multiplayer speed challenge. First to solve wins!';
      dom.traitorViews.forEach(v => v.classList.remove('active'));
      dom.sudokuSection.style.display = 'block';

      // Default to admin setup if no view active
      if (!state.roomId && !dom.sudokuHostLobbyView.classList.contains('active') && !dom.sudokuGameView.classList.contains('active')) {
        switchSudokuView('sudokuAdminSetupView');
        loadPresetPuzzle('medium');
      }
    }
  }

  function switchSudokuView(viewId) {
    [dom.sudokuAdminSetupView, dom.sudokuHostLobbyView, dom.sudokuPlayerJoinView, dom.sudokuGameView].forEach(view => {
      if (view) view.style.display = (view.id === viewId) ? 'block' : 'none';
    });
  }

  // --- ADMIN SETUP ---
  function setupAdminSetupControls() {
    // Preset buttons
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        window.soundFx && window.soundFx.playClick();
        const difficulty = btn.dataset.preset;
        loadPresetPuzzle(difficulty);
      });
    });

    // Paste from Clipboard
    if (dom.pasteClipboardBtn) {
      dom.pasteClipboardBtn.addEventListener('click', async () => {
        window.soundFx && window.soundFx.playClick();
        try {
          if (navigator.clipboard && navigator.clipboard.readText) {
            const text = await navigator.clipboard.readText();
            if (text && text.trim()) {
              dom.puzzleTextInput.value = text.trim();
              validateAdminPuzzle(true);
              showToast('📋 Puzzle pasted from clipboard!');
              return;
            }
          }
          showToast('Clipboard is empty or access not allowed');
        } catch (err) {
          // Fallback if browser blocks readText without explicit permission prompt
          const fallbackText = prompt('Paste your 81-character puzzle string here:');
          if (fallbackText && fallbackText.trim()) {
            dom.puzzleTextInput.value = fallbackText.trim();
            validateAdminPuzzle(true);
            showToast('📋 Puzzle pasted!');
          }
        }
      });
    }

    // Copy Puzzle to Clipboard
    if (dom.copyPuzzleBtn) {
      dom.copyPuzzleBtn.addEventListener('click', async () => {
        window.soundFx && window.soundFx.playClick();
        const text = dom.puzzleTextInput.value.trim();
        if (!text) {
          showToast('No puzzle string to copy!');
          return;
        }
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            showToast('📄 Puzzle copied to clipboard!');
          } else {
            prompt('Copy puzzle string:', text);
          }
        } catch (e) {
          prompt('Copy puzzle string:', text);
        }
      });
    }

    // Clear Input
    if (dom.clearPuzzleBtn) {
      dom.clearPuzzleBtn.addEventListener('click', () => {
        window.soundFx && window.soundFx.playClick();
        dom.puzzleTextInput.value = '';
        validateAdminPuzzle(false);
        showToast('Input cleared');
      });
    }

    // File upload handler
    if (dom.puzzleFileInput) {
      dom.puzzleFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          dom.puzzleTextInput.value = event.target.result;
          validateAdminPuzzle();
        };
        reader.readAsText(file);
      });
    }

    if (dom.validatePuzzleBtn) {
      dom.validatePuzzleBtn.addEventListener('click', () => {
        window.soundFx && window.soundFx.playClick();
        validateAdminPuzzle();
      });
    }

    if (dom.createSudokuRoomBtn) {
      dom.createSudokuRoomBtn.addEventListener('click', () => {
        window.soundFx && window.soundFx.playClick();
        const result = validateAdminPuzzle();
        if (result.valid) {
          createSudokuRoom();
        } else {
          alert('Please provide a valid puzzle before creating the room:\n' + result.reason);
        }
      });
    }

    dom.puzzleTextInput.addEventListener('input', () => {
      // Light debounce validation
      clearTimeout(dom.puzzleTextInput._debounce);
      dom.puzzleTextInput._debounce = setTimeout(() => validateAdminPuzzle(false), 300);
    });
  }

  function loadPresetPuzzle(difficulty) {
    const puz = SudokuEngine.PRESETS[difficulty] || SudokuEngine.PRESETS.medium;
    dom.puzzleTextInput.value = puz;
    validateAdminPuzzle(true);
  }

  function validateAdminPuzzle(showAlerts = true) {
    const raw = dom.puzzleTextInput.value;
    const grid = SudokuEngine.parseGrid(raw);

    if (!grid) {
      dom.puzzleValidationStatus.className = 'status-msg status-error';
      dom.puzzleValidationStatus.textContent = '❌ Must contain exactly 81 characters (digits 1-9 or . / 0).';
      renderAdminPreview(null);
      return { valid: false, reason: 'Invalid puzzle input format' };
    }

    const check = SudokuEngine.validatePuzzle(grid);
    if (!check.valid) {
      dom.puzzleValidationStatus.className = 'status-msg status-error';
      dom.puzzleValidationStatus.textContent = '❌ ' + check.reason;
      renderAdminPreview(grid, SudokuEngine.findConflicts(grid));
      return check;
    }

    dom.puzzleValidationStatus.className = 'status-msg status-success';
    dom.puzzleValidationStatus.textContent = `✅ Valid puzzle! (${check.clueCount} clues, verified solvable)`;
    state.puzzleString = SudokuEngine.gridToString(grid);
    state.originalClues = [...grid];
    state.solution = check.solution;

    renderAdminPreview(grid);
    return { valid: true };
  }

  function renderAdminPreview(grid, conflicts = new Set()) {
    dom.adminPreviewGrid.innerHTML = '';
    if (!grid) {
      dom.adminPreviewGrid.innerHTML = '<div style="grid-column: span 9; text-align: center; color: var(--text-muted); padding: 20px;">Enter an 81-character puzzle above</div>';
      return;
    }

    grid.forEach((num, idx) => {
      const cell = document.createElement('div');
      cell.className = 'preview-cell' + (num > 0 ? ' has-number' : '') + (conflicts.has(idx) ? ' conflict' : '');
      cell.textContent = num > 0 ? num : '';
      dom.adminPreviewGrid.appendChild(cell);
    });
  }

  // --- HOST ROOM CREATION & LOBBY ---
  function createSudokuRoom() {
    state.isAdmin = true;
    state.roomId = 'SUDOKU-' + Math.floor(1000 + Math.random() * 9000);
    state.liveMistakeHints = dom.hostLiveMistakeToggle ? dom.hostLiveMistakeToggle.checked : false;
    state.highlightConflicts = state.liveMistakeHints;
    state.connectedPlayers = {};
    state.winnerAnnounced = null;
    state.raceStarted = false;
    state.raceFinished = false;

    switchSudokuView('sudokuHostLobbyView');
    dom.sudokuHostRoomBadge.textContent = `ROOM: ${state.roomId}`;
    if (dom.sudokuHostWinnerCard) dom.sudokuHostWinnerCard.style.display = 'none';
    renderSudokuQrCode();
    renderHostPlayerList();
    initSudokuHostPeer();
  }

  function getSudokuShareUrl() {
    const base = window.location.origin + window.location.pathname;
    const params = new URLSearchParams({
      mode: 'sudoku',
      room: state.roomId,
      puz: state.puzzleString,
      hints: state.liveMistakeHints ? '1' : '0'
    });
    return `${base}?${params.toString()}`;
  }

  function renderSudokuQrCode() {
    const url = getSudokuShareUrl();
    dom.sudokuHostQrCode.innerHTML = '';
    try {
      new QRCode(dom.sudokuHostQrCode, {
        text: url,
        width: 190,
        height: 190,
        colorDark: '#0c0d14',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    } catch (e) {
      console.warn('QR code render fallback:', e);
    }
  }

  function renderHostPlayerList() {
    dom.sudokuHostPlayerList.innerHTML = '';
    const players = Object.values(state.connectedPlayers);
    dom.sudokuHostPlayerCount.textContent = `${players.length} player${players.length === 1 ? '' : 's'} joined`;

    if (players.length === 0) {
      dom.sudokuHostPlayerList.innerHTML = '<li style="text-align: center; color: var(--text-muted); padding: 12px;">Waiting for players to join...</li>';
      return;
    }

    players.forEach(p => {
      const li = document.createElement('li');
      li.className = 'player-item';
      const pct = Math.round(((p.filledCount || 0) / 81) * 100);
      let statusHtml = `<span class="player-status ${p.finished ? 'ready' : 'waiting'}">
        ${p.finished ? (p.isWinner ? '🏆 WINNER (' + p.timeFormatted + ')' : '✓ Finished (' + p.timeFormatted + ')') : pct + '% filled'}
      </span>`;

      li.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <span>👤 <strong>${escapeHtml(p.name)}</strong></span>
          <div style="width: 120px; height: 5px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden;">
            <div style="width: ${pct}%; height: 100%; background: var(--innocent-color);"></div>
          </div>
        </div>
        ${statusHtml}
      `;
      dom.sudokuHostPlayerList.appendChild(li);
    });
  }

  function setupHostLobbyControls() {
    dom.sudokuCopyLinkBtn.addEventListener('click', () => {
      const url = getSudokuShareUrl();
      navigator.clipboard.writeText(url).then(() => {
        showToast('Sudoku Room link copied to clipboard!');
      }).catch(() => {
        prompt('Copy room link:', url);
      });
    });

    dom.sudokuWhatsappBtn.addEventListener('click', () => {
      const url = getSudokuShareUrl();
      const text = encodeURIComponent(`🧩 Join my Multiplayer Sudoku Race!\nClick here to play:\n${url}`);
      window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    });

    dom.sudokuHostStartRaceBtn.addEventListener('click', () => {
      window.soundFx && window.soundFx.playClick();
      broadcastSudokuStart();
      showToast('Sudoku Race Started! All players notified.');
    });

    dom.sudokuHostPlayTooBtn.addEventListener('click', () => {
      window.soundFx && window.soundFx.playClick();
      state.myPlayerName = 'Host (Admin)';
      if (!state.raceStarted) {
        broadcastSudokuStart();
      }
      startPlayerBoard();
    });

    dom.sudokuHostResetBtn.addEventListener('click', () => {
      if (confirm('End this room and setup a new puzzle?')) {
        if (state.peer) state.peer.destroy();
        switchSudokuView('sudokuAdminSetupView');
      }
    });
  }

  // --- HOST PEERJS SYNC ---
  function initSudokuHostPeer() {
    if (typeof Peer === 'undefined') return;

    try {
      const peerId = `sudoku-host-${state.roomId}`;
      if (state.peer) state.peer.destroy();

      state.peer = new Peer(peerId, { debug: 1 });
      state.connectedSockets = {};

      state.peer.on('open', () => {
        console.log('Sudoku Host Peer ready:', peerId);
      });

      state.peer.on('connection', (conn) => {
        state.connectedSockets[conn.peer] = conn;

        conn.on('data', (data) => {
          handleHostIncomingData(conn, data);
        });

        conn.on('close', () => {
          delete state.connectedSockets[conn.peer];
          delete state.connectedPlayers[conn.peer];
          renderHostPlayerList();
        });
      });
    } catch (err) {
      console.warn('Host peer init error:', err);
    }
  }

  function handleHostIncomingData(conn, data) {
    if (data.type === 'PLAYER_JOIN') {
      const playerId = data.playerId || conn.peer;
      const playerName = data.playerName || 'Player';
      state.connectedPlayers[playerId] = {
        name: playerName,
        filledCount: 0,
        finished: false,
        timeFormatted: null,
        isWinner: false
      };
      renderHostPlayerList();

      // Send puzzle and config info to joined player
      conn.send({
        type: 'ROOM_INFO',
        roomId: state.roomId,
        puzzleString: state.puzzleString,
        liveMistakeHints: state.liveMistakeHints,
        raceStarted: state.raceStarted,
        winnerAnnounced: state.winnerAnnounced
      });
    } else if (data.type === 'SUDOKU_PROGRESS') {
      const playerId = data.playerId || conn.peer;
      const p = state.connectedPlayers[playerId];
      if (p) {
        p.filledCount = data.filledCount;
        renderHostPlayerList();
      }
    } else if (data.type === 'SUDOKU_FINISH') {
      const playerId = data.playerId || conn.peer;
      const playerName = data.playerName || (state.connectedPlayers[playerId] ? state.connectedPlayers[playerId].name : 'Player');
      const timeFormatted = data.timeFormatted || '00:00';
      const isFirst = !state.winnerAnnounced;

      if (!state.connectedPlayers[playerId]) {
        state.connectedPlayers[playerId] = {
          name: playerName,
          filledCount: 81,
          finished: true,
          timeFormatted: timeFormatted,
          isWinner: isFirst
        };
      } else {
        const p = state.connectedPlayers[playerId];
        p.finished = true;
        p.timeFormatted = timeFormatted;
        p.isWinner = isFirst;
        p.filledCount = 81;
      }

      if (isFirst) {
        state.winnerAnnounced = {
          winnerName: playerName,
          timeFormatted: timeFormatted,
          winnerId: playerId
        };

        // 1. Notify the winner
        try {
          conn.send({
            type: 'YOU_WON',
            winnerName: playerName,
            timeFormatted: timeFormatted
          });
        } catch (e) {}

        // 2. Broadcast to all OTHER remote players
        Object.entries(state.connectedSockets).forEach(([pid, socket]) => {
          if (pid !== conn.peer) {
            try {
              socket.send({
                type: 'RACE_LOST_KEEP_PLAYING',
                winnerName: playerName,
                timeFormatted: timeFormatted
              });
            } catch (e) {}
          }
        });

        // 3. SHOW PROMINENT WINNER ANNOUNCEMENT ON HOST SCREEN!
        if (dom.sudokuHostWinnerCard && dom.sudokuHostWinnerText) {
          dom.sudokuHostWinnerText.innerHTML = `<strong>${escapeHtml(playerName)}</strong> finished 1st in <strong>${timeFormatted}</strong>!`;
          dom.sudokuHostWinnerCard.style.display = 'flex';
        }
        window.soundFx && window.soundFx.playVictory();
        showToast(`🏆 Race Won by ${playerName} in ${timeFormatted}!`);

        // If Host is also playing on the game board:
        if (dom.sudokuGameView && dom.sudokuGameView.style.display !== 'none') {
          onRaceLostNotification(playerName, timeFormatted);
        }
      } else {
        try {
          conn.send({
            type: 'PUZZLE_COMPLETED_LATER',
            timeFormatted: timeFormatted,
            winnerName: state.winnerAnnounced ? state.winnerAnnounced.winnerName : ''
          });
        } catch (e) {}
      }

      renderHostPlayerList();
    }
  }

  function broadcastSudokuStart() {
    state.raceStarted = true;
    if (state.peer && state.connectedSockets) {
      Object.values(state.connectedSockets).forEach(conn => {
        try {
          conn.send({
            type: 'START_RACE',
            puzzleString: state.puzzleString,
            liveMistakeHints: state.liveMistakeHints
          });
        } catch (e) {}
      });
    }
  }

  // --- PLAYER CLIENT LOGIC ---
  function setupPlayerJoinControls() {
    dom.sudokuJoinRaceBtn.addEventListener('click', () => {
      window.soundFx && window.soundFx.playClick();
      const name = dom.sudokuPlayerNameInput.value.trim() || `Solver ${Math.floor(10 + Math.random() * 89)}`;
      state.myPlayerName = name;
      localStorage.setItem('sudoku_player_name', name);

      if (state.hostConn && state.hostConn.open) {
        state.hostConn.send({
          type: 'PLAYER_JOIN',
          playerId: state.myPlayerId,
          playerName: name
        });
        dom.sudokuPlayerWaitingMsg.style.display = 'block';
        dom.sudokuJoinRaceBtn.style.display = 'none';
      } else {
        // Direct / Offline Start fallback
        startPlayerBoard();
      }
    });
  }

  function initPlayerPeer() {
    if (typeof Peer === 'undefined') return;

    try {
      const peer = new Peer({ debug: 1 });
      state.peer = peer;

      peer.on('open', () => {
        const hostPeerId = `sudoku-host-${state.roomId}`;
        const conn = peer.connect(hostPeerId, { reliable: true });
        state.hostConn = conn;

        conn.on('open', () => {
          console.log('Connected to Sudoku Host!');
          conn.send({
            type: 'PLAYER_JOIN',
            playerId: state.myPlayerId,
            playerName: state.myPlayerName || 'Player'
          });
        });

        conn.on('data', (data) => {
          handlePlayerIncomingData(data);
        });

        conn.on('error', (err) => {
          console.warn('Host connection error:', err);
        });
      });
    } catch (e) {
      console.warn('Player peer init error:', e);
    }
  }

  function handlePlayerIncomingData(data) {
    if (data.type === 'ROOM_INFO' || data.type === 'START_RACE') {
      if (typeof data.liveMistakeHints !== 'undefined') {
        state.liveMistakeHints = !!data.liveMistakeHints;
        state.highlightConflicts = state.liveMistakeHints;
      }
      if (data.puzzleString) {
        state.puzzleString = data.puzzleString;
        state.originalClues = SudokuEngine.parseGrid(data.puzzleString);
        state.solution = SudokuEngine.solve(state.originalClues);
      }
      if (data.raceStarted || data.type === 'START_RACE') {
        startPlayerBoard();
      }
      if (data.winnerAnnounced) {
        state.winnerAnnounced = data.winnerAnnounced;
      }
    } else if (data.type === 'RACE_LOST_KEEP_PLAYING') {
      // Core user requirement:
      // "Once er afinishes and has the correct answer others are show you lost but still could complete the puzzle"
      onRaceLostNotification(data.winnerName, data.timeFormatted);
    } else if (data.type === 'YOU_WON') {
      onVictoryNotification(data.timeFormatted);
    } else if (data.type === 'PUZZLE_COMPLETED_LATER') {
      onSubsequentCompletion(data.timeFormatted, data.winnerName);
    }
  }

  // --- GAME BOARD CONTROLS & RENDERING ---
  function startPlayerBoard() {
    switchSudokuView('sudokuGameView');
    state.raceStarted = true;
    state.raceFinished = false;

    // Live Mistake Hints: only display conflict button if enabled by host
    if (!state.liveMistakeHints) {
      state.highlightConflicts = false;
      if (dom.sudokuConflictToggle) dom.sudokuConflictToggle.style.display = 'none';
    } else {
      if (dom.sudokuConflictToggle) dom.sudokuConflictToggle.style.display = 'inline-flex';
    }

    // Parse puzzle
    const clues = SudokuEngine.parseGrid(state.puzzleString) || SudokuEngine.parseGrid(SudokuEngine.PRESETS.medium);
    state.originalClues = clues;
    state.playerGrid = [...clues];
    state.solution = SudokuEngine.solve(clues);
    state.playerNotes = Array.from({ length: 81 }, () => new Set());
    state.history = [];
    state.selectedCell = null;

    // Start live timer
    startTimer();

    // Render 9x9 grid & update bottom keypad disabled counts
    renderSudokuGrid();
    updateProgressDisplay();
    updateKeypadCounts();
  }

  function renderSudokuGrid() {
    dom.sudokuGrid.innerHTML = '';
    // Conflicts are ONLY computed and displayed if host explicitly enabled liveMistakeHints
    const conflicts = (state.liveMistakeHints && state.highlightConflicts) ? SudokuEngine.findConflicts(state.playerGrid) : new Set();

    for (let i = 0; i < 81; i++) {
      const cell = document.createElement('div');
      cell.className = 'sudoku-cell';
      cell.dataset.index = i;

      const isClue = state.originalClues[i] > 0;
      if (isClue) cell.classList.add('is-clue');

      // Grid thick borders for 3x3 blocks
      const row = Math.floor(i / 9);
      const col = i % 9;
      if (col % 3 === 0 && col !== 0) cell.classList.add('border-left-block');
      if (row % 3 === 0 && row !== 0) cell.classList.add('border-top-block');

      if (conflicts.has(i) && !isClue) {
        cell.classList.add('is-conflict');
      }

      if (state.selectedCell === i) {
        cell.classList.add('is-selected');
      } else if (state.selectedCell !== null) {
        const selRow = Math.floor(state.selectedCell / 9);
        const selCol = state.selectedCell % 9;
        const selBox = Math.floor(selRow / 3) * 3 + Math.floor(selCol / 3);
        const curBox = Math.floor(row / 3) * 3 + Math.floor(col / 3);

        if (row === selRow || col === selCol || curBox === selBox) {
          cell.classList.add('is-related');
        }

        const selVal = state.playerGrid[state.selectedCell];
        if (selVal > 0 && state.playerGrid[i] === selVal) {
          cell.classList.add('is-same-number');
        }
      }

      // Cell value or notes
      const val = state.playerGrid[i];
      if (val > 0) {
        const valSpan = document.createElement('span');
        valSpan.className = 'cell-value';
        valSpan.textContent = val;
        cell.appendChild(valSpan);
      } else {
        const notes = state.playerNotes[i];
        if (notes && notes.size > 0) {
          const notesGrid = document.createElement('div');
          notesGrid.className = 'notes-grid';
          for (let n = 1; n <= 9; n++) {
            const noteSpan = document.createElement('span');
            noteSpan.className = 'note-num';
            noteSpan.textContent = notes.has(n) ? n : '';
            notesGrid.appendChild(noteSpan);
          }
          cell.appendChild(notesGrid);
        }
      }

      cell.addEventListener('click', () => selectCell(i));
      dom.sudokuGrid.appendChild(cell);
    }
  }

  function selectCell(idx) {
    window.soundFx && window.soundFx.playCellClick();
    state.selectedCell = idx;
    renderSudokuGrid();
  }

  function setupGameBoardControls() {
    // Number buttons 1-9
    document.querySelectorAll('.num-key').forEach(btn => {
      btn.addEventListener('click', () => {
        const num = parseInt(btn.dataset.num, 10);
        handleNumberInput(num);
      });
    });

    // Notes toggle
    dom.sudokuNotesToggle.addEventListener('click', () => {
      window.soundFx && window.soundFx.playClick();
      state.notesMode = !state.notesMode;
      dom.sudokuNotesToggle.classList.toggle('active', state.notesMode);
    });

    // Erase button
    dom.sudokuEraseBtn.addEventListener('click', () => {
      handleErase();
    });

    // Undo button
    dom.sudokuUndoBtn.addEventListener('click', () => {
      handleUndo();
    });

    // Check / Submit button
    dom.sudokuCheckBtn.addEventListener('click', () => {
      checkPlayerSolution();
    });

    // Conflict highlight toggle
    dom.sudokuConflictToggle.addEventListener('click', () => {
      window.soundFx && window.soundFx.playClick();
      state.highlightConflicts = !state.highlightConflicts;
      dom.sudokuConflictToggle.classList.toggle('active', state.highlightConflicts);
      renderSudokuGrid();
    });

    // Banner dismiss
    dom.dismissBannerBtn.addEventListener('click', () => {
      dom.raceWinnerBanner.style.display = 'none';
    });

    // Modal close
    dom.sudokuModalClose.addEventListener('click', () => {
      closeModal();
    });
    dom.sudokuModalOverlay.addEventListener('click', (e) => {
      if (e.target === dom.sudokuModalOverlay) closeModal();
    });
  }

  function handleNumberInput(num) {
    if (state.selectedCell === null) return;
    const idx = state.selectedCell;

    // Clues cannot be changed
    if (state.originalClues[idx] > 0) return;

    if (state.notesMode) {
      // Toggle pencil note
      window.soundFx && window.soundFx.playCellClick();
      const notes = state.playerNotes[idx];
      if (notes.has(num)) {
        notes.delete(num);
      } else {
        notes.add(num);
      }
      renderSudokuGrid();
      return;
    }

    // Normal placement
    window.soundFx && window.soundFx.playNumberPlaced(num);
    state.history.push({
      idx,
      oldVal: state.playerGrid[idx],
      newVal: num,
      oldNotes: new Set(state.playerNotes[idx])
    });

    state.playerGrid[idx] = num;
    state.playerNotes[idx].clear();

    renderSudokuGrid();
    updateProgressDisplay();
    updateKeypadCounts();
    broadcastProgress();

    // Do NOT auto-validate on 81st number: let user review and hit Submit!
    const filledCount = state.playerGrid.filter(v => v > 0).length;
    if (filledCount === 81) {
      showToast('All 81 numbers entered! Click "Check / Submit Solution" when ready.');
    }
  }

  function handleErase() {
    if (state.selectedCell === null) return;
    const idx = state.selectedCell;
    if (state.originalClues[idx] > 0) return;

    window.soundFx && window.soundFx.playCellClick();
    state.history.push({
      idx,
      oldVal: state.playerGrid[idx],
      newVal: 0,
      oldNotes: new Set(state.playerNotes[idx])
    });

    state.playerGrid[idx] = 0;
    state.playerNotes[idx].clear();

    renderSudokuGrid();
    updateProgressDisplay();
    updateKeypadCounts();
    broadcastProgress();
  }

  function handleUndo() {
    if (state.history.length === 0) return;
    window.soundFx && window.soundFx.playCellClick();
    const action = state.history.pop();
    state.playerGrid[action.idx] = action.oldVal;
    state.playerNotes[action.idx] = action.oldNotes;
    state.selectedCell = action.idx;

    renderSudokuGrid();
    updateProgressDisplay();
    updateKeypadCounts();
    broadcastProgress();
  }

  function updateKeypadCounts() {
    const counts = {};
    for (let n = 1; n <= 9; n++) counts[n] = 0;
    let filledTotal = 0;

    for (let i = 0; i < 81; i++) {
      const val = state.playerGrid[i];
      if (val >= 1 && val <= 9) {
        counts[val]++;
        filledTotal++;
      }
    }

    document.querySelectorAll('.num-key').forEach(btn => {
      const num = parseInt(btn.dataset.num, 10);
      const count = counts[num] || 0;
      // Disable number button when all 9 numbers of this digit are entered
      if (count >= 9 || filledTotal === 81) {
        btn.classList.add('disabled');
        btn.setAttribute('disabled', 'true');
      } else {
        btn.classList.remove('disabled');
        btn.removeAttribute('disabled');
      }
    });

    if (filledTotal === 81) {
      dom.sudokuCheckBtn.classList.add('submit-ready-pulse');
    } else {
      dom.sudokuCheckBtn.classList.remove('submit-ready-pulse');
    }
  }

  function setupKeyboardListeners() {
    window.addEventListener('keydown', (e) => {
      // Only capture if game board is active
      if (!dom.sudokuGameView || dom.sudokuGameView.style.display === 'none') return;
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      const key = e.key;
      if (key >= '1' && key <= '9') {
        handleNumberInput(parseInt(key, 10));
      } else if (key === 'Backspace' || key === 'Delete') {
        handleErase();
      } else if (key.toLowerCase() === 'n') {
        state.notesMode = !state.notesMode;
        dom.sudokuNotesToggle.classList.toggle('active', state.notesMode);
      } else if (key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey)) {
        handleUndo();
      } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
        e.preventDefault();
        moveSelection(key);
      }
    });
  }

  function moveSelection(direction) {
    if (state.selectedCell === null) {
      state.selectedCell = 0;
      renderSudokuGrid();
      return;
    }
    let row = Math.floor(state.selectedCell / 9);
    let col = state.selectedCell % 9;

    if (direction === 'ArrowUp') row = (row + 8) % 9;
    if (direction === 'ArrowDown') row = (row + 1) % 9;
    if (direction === 'ArrowLeft') col = (col + 8) % 9;
    if (direction === 'ArrowRight') col = (col + 1) % 9;

    selectCell(row * 9 + col);
  }

  function updateProgressDisplay() {
    const filled = state.playerGrid.filter(v => v > 0).length;
    dom.sudokuFilledCount.textContent = `${filled} / 81`;
    const pct = Math.round((filled / 81) * 100);
    dom.sudokuFilledBar.style.width = `${pct}%`;
  }

  function broadcastProgress() {
    const filled = state.playerGrid.filter(v => v > 0).length;
    if (state.hostConn && state.hostConn.open) {
      state.hostConn.send({
        type: 'SUDOKU_PROGRESS',
        playerId: state.myPlayerId,
        filledCount: filled
      });
    } else if (state.isAdmin) {
      if (state.connectedPlayers['host']) {
        state.connectedPlayers['host'].filledCount = filled;
        renderHostPlayerList();
      }
    }
  }

  // --- TIMER ---
  function startTimer() {
    clearInterval(state.timerInterval);
    state.timerSeconds = 0;
    updateTimerText();

    state.timerInterval = setInterval(() => {
      state.timerSeconds++;
      updateTimerText();
    }, 1000);
  }

  function updateTimerText() {
    const m = Math.floor(state.timerSeconds / 60).toString().padStart(2, '0');
    const s = (state.timerSeconds % 60).toString().padStart(2, '0');
    dom.sudokuTimer.textContent = `${m}:${s}`;
  }

  function formatCurrentTime() {
    const m = Math.floor(state.timerSeconds / 60).toString().padStart(2, '0');
    const s = (state.timerSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  // --- CHECK / SUBMIT PUZZLE ---
  function checkPlayerSolution() {
    const isComplete = SudokuEngine.isCompletedAndValid(state.playerGrid, state.originalClues, state.solution);

    if (!isComplete) {
      window.soundFx && window.soundFx.playError();
      const emptyCount = state.playerGrid.filter(v => v === 0).length;
      if (emptyCount > 0) {
        showToast(`Keep going! ${emptyCount} cell${emptyCount === 1 ? '' : 's'} remaining.`);
      } else {
        if (!state.liveMistakeHints) {
          showToast('❌ Solution has incorrect numbers or duplicates. Check carefully and re-submit!');
        } else {
          showToast('There are conflicts or incorrect numbers. Check highlighted cells!');
          state.highlightConflicts = true;
          if (dom.sudokuConflictToggle) dom.sudokuConflictToggle.classList.add('active');
          renderSudokuGrid();
        }
      }
      return;
    }

    // Solved correctly!
    clearInterval(state.timerInterval);
    state.raceFinished = true;
    const timeFormatted = formatCurrentTime();

    if (state.isAdmin) {
      // Host playing locally
      const isFirst = !state.winnerAnnounced;
      if (isFirst) {
        state.winnerAnnounced = {
          winnerName: state.myPlayerName,
          timeFormatted,
          winnerId: 'host'
        };
        // Broadcast to players
        if (state.connectedSockets) {
          Object.values(state.connectedSockets).forEach(conn => {
            try {
              conn.send({
                type: 'RACE_LOST_KEEP_PLAYING',
                winnerName: state.myPlayerName,
                timeFormatted
              });
            } catch (e) {}
          });
        }
        if (dom.sudokuHostWinnerCard && dom.sudokuHostWinnerText) {
          dom.sudokuHostWinnerText.innerHTML = `<strong>Host</strong> finished 1st in <strong>${timeFormatted}</strong>!`;
          dom.sudokuHostWinnerCard.style.display = 'flex';
        }
        onVictoryNotification(timeFormatted);
      } else {
        onSubsequentCompletion(timeFormatted, state.winnerAnnounced ? state.winnerAnnounced.winnerName : '');
      }
    } else {
      let sent = false;
      if (state.hostConn && state.hostConn.open) {
        try {
          state.hostConn.send({
            type: 'SUDOKU_FINISH',
            playerId: state.myPlayerId,
            playerName: state.myPlayerName,
            timeFormatted
          });
          sent = true;
        } catch (e) {
          console.warn('Error sending finish to host:', e);
        }
      }

      // Reconnect fallback if connection was temporarily interrupted
      if (!sent && state.peer && state.roomId) {
        try {
          const retryConn = state.peer.connect(`sudoku-host-${state.roomId}`, { reliable: true });
          retryConn.on('open', () => {
            retryConn.send({
              type: 'SUDOKU_FINISH',
              playerId: state.myPlayerId,
              playerName: state.myPlayerName,
              timeFormatted
            });
          });
        } catch (e) {}
      }

      if (!sent && (!state.hostConn || !state.hostConn.open)) {
        onVictoryNotification(timeFormatted);
      }
    }
  }

  // --- NOTIFICATION HANDLERS (WINNER & "YOU LOST BUT KEEP PLAYING") ---

  function onVictoryNotification(timeFormatted) {
    window.soundFx && window.soundFx.playVictory();
    dom.sudokuRaceStatusBadge.textContent = '🏆 1st Place Winner!';
    dom.sudokuRaceStatusBadge.className = 'status-badge status-winner';

    showModal(`
      <div style="font-size: 3.5rem; margin-bottom: 8px;">🏆</div>
      <h2 style="font-family: 'Cinzel', serif; font-size: 1.8rem; color: var(--accent-gold); margin-bottom: 6px;">
        VICTORY!
      </h2>
      <p style="font-size: 1.1rem; font-weight: 600; margin-bottom: 12px;">
        You won the Sudoku Race!
      </p>
      <div style="background: rgba(246, 200, 96, 0.1); border: 1px solid rgba(246, 200, 96, 0.3); border-radius: var(--radius-md); padding: 14px; margin-bottom: 18px;">
        <span style="font-size: 0.9rem; color: var(--text-muted); display: block;">Finishing Time</span>
        <span style="font-size: 1.8rem; font-weight: 800; color: #fff;">${timeFormatted}</span>
      </div>
      <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 20px;">
        First to complete the puzzle with 100% accuracy.
      </p>
      <button class="btn btn-primary" onclick="window.SudokuApp.closeModal()">
        View Completed Board
      </button>
    `);
  }

  function onRaceLostNotification(winnerName, timeFormatted) {
    // Play gentle lost chime
    window.soundFx && window.soundFx.playRaceLost();

    // Update status badge
    dom.sudokuRaceStatusBadge.textContent = `🏁 Won by ${escapeHtml(winnerName)}`;
    dom.sudokuRaceStatusBadge.className = 'status-badge status-lost';

    // 1. Show sticky banner at top of puzzle
    dom.raceWinnerBannerText.innerHTML = `<strong>${escapeHtml(winnerName)}</strong> finished first in <strong>${timeFormatted}</strong>! You lost the race, but keep going to complete your puzzle!`;
    dom.raceWinnerBanner.style.display = 'flex';

    // 2. Show brief non-blocking modal alert with "Keep Solving"
    showModal(`
      <div style="font-size: 3rem; margin-bottom: 6px;">🏁</div>
      <h3 style="font-family: 'Cinzel', serif; font-size: 1.4rem; color: var(--traitor-color); margin-bottom: 6px;">
        RACE FINISHED!
      </h3>
      <p style="font-size: 1.05rem; margin-bottom: 10px;">
        <strong>${escapeHtml(winnerName)}</strong> won 1st place in <strong>${timeFormatted}</strong>.
      </p>
      <div style="background: rgba(255, 51, 102, 0.1); border: 1px solid rgba(255, 51, 102, 0.3); border-radius: var(--radius-md); padding: 12px; margin-bottom: 18px;">
        <p style="font-size: 0.95rem; color: var(--text-main);">
          ⚡ You lost the race, but you can still keep playing to complete your puzzle!
        </p>
      </div>
      <button class="btn btn-primary" onclick="window.SudokuApp.closeModal()">
        Keep Solving ➔
      </button>
    `);
  }

  function onSubsequentCompletion(timeFormatted, winnerName) {
    window.soundFx && window.soundFx.playPuzzleComplete();

    showModal(`
      <div style="font-size: 3.5rem; margin-bottom: 8px;">🎉</div>
      <h2 style="font-family: 'Cinzel', serif; font-size: 1.6rem; color: var(--innocent-color); margin-bottom: 6px;">
        PUZZLE COMPLETED!
      </h2>
      <p style="font-size: 1rem; color: var(--text-muted); margin-bottom: 14px;">
        Great job! You successfully finished the entire puzzle.
      </p>
      <div style="background: rgba(0, 242, 254, 0.1); border: 1px solid rgba(0, 242, 254, 0.3); border-radius: var(--radius-md); padding: 14px; margin-bottom: 18px;">
        <span style="font-size: 0.85rem; color: var(--text-muted); display: block;">Your Time</span>
        <span style="font-size: 1.6rem; font-weight: 800; color: #fff;">${timeFormatted}</span>
        ${winnerName ? `<span style="display: block; font-size: 0.85rem; color: var(--accent-gold); margin-top: 4px;">Winner: ${escapeHtml(winnerName)}</span>` : ''}
      </div>
      <button class="btn btn-primary" onclick="window.SudokuApp.closeModal()">
        Close
      </button>
    `);
  }

  // --- MODAL UTILS ---
  function showModal(html) {
    dom.sudokuModalContent.innerHTML = html;
    dom.sudokuModalOverlay.style.display = 'flex';
  }

  function closeModal() {
    dom.sudokuModalOverlay.style.display = 'none';
  }

  function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- URL PARAMS PARSING ---
  function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const room = urlParams.get('room');
    const puz = urlParams.get('puz');

    if (mode === 'sudoku' || (room && room.startsWith('SUDOKU-'))) {
      switchMode('sudoku');
      state.roomId = room;

      if (puz) {
        state.puzzleString = puz;
        state.originalClues = SudokuEngine.parseGrid(puz) || [];
      }

      const hintsParam = urlParams.get('hints');
      const strictParam = urlParams.get('strict');
      if (hintsParam !== null) {
        state.liveMistakeHints = hintsParam === '1';
        state.highlightConflicts = state.liveMistakeHints;
      } else if (strictParam !== null) {
        state.liveMistakeHints = strictParam !== '1';
        state.highlightConflicts = state.liveMistakeHints;
      }

      if (room) {
        // Player is joining a room
        switchSudokuView('sudokuPlayerJoinView');
        dom.sudokuPlayerRoomBadge.textContent = `ROOM: ${state.roomId}`;

        // Retrieve saved player name or id
        let pid = localStorage.getItem('sudoku_player_id');
        if (!pid) {
          pid = 'p_' + Math.random().toString(36).substring(2, 9);
          localStorage.setItem('sudoku_player_id', pid);
        }
        state.myPlayerId = pid;

        const savedName = localStorage.getItem('sudoku_player_name');
        if (savedName) dom.sudokuPlayerNameInput.value = savedName;

        initPlayerPeer();
      }
    }
  }

  // Expose global for modal clicks
  window.SudokuApp = {
    closeModal,
    switchMode
  };

  // Start on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
