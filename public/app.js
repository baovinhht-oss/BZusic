/**
 * BZusic - YouTube Music Inspired Web App
 * Frontend Core Engine
 */

(function () {
  'use strict';

  // ==========================================
  // App State
  // ==========================================
  const state = {
    currentTrack: null,
    queue: [],
    queueIndex: -1,
    isPlaying: false,
    isShuffle: false,
    repeatMode: 'off', // 'off' | 'all' | 'one'
    autoplay: true,
    volume: 0.9,
    isMuted: false,
    previousVolume: 0.9,
    isSeeking: false,

    library: {
      liked: [],
      playlists: [],
      history: []
    },

    lyrics: null, // { type: 'synced'|'plain', lines: [...] }
    activeLyricIndex: -1,

    currentView: 'home',
    activePlaylistId: null,
    isNowPlayingOpen: false,
    activeTab: 'upnext',
    trackHistoryTimeout: null,
    pendingAddToPlaylistSong: null,

    // Search & lyrics state
    searchMode: 'all',
    isUserScrollingLyrics: false,
    userScrollTimeout: null,
    karaokeRafId: null,

    // Error recovery & control
    consecutiveErrors: 0,
    errorSkipTimer: null
  };

  // DOM Elements Cache
  const el = {};

  // ==========================================
  // Initialization
  // ==========================================
  document.addEventListener('DOMContentLoaded', () => {
    cacheDomElements();
    loadStoredSettings();
    bindEvents();
    fetchLibrary().then(() => {
      renderSidebarPlaylists();
      renderHomeFeatured();
    });
  });

  function cacheDomElements() {
    // Audio
    el.audio = document.getElementById('audio-player');

    // Sidebar & Navigation
    el.sidebar = document.getElementById('sidebar');
    el.navHome = document.getElementById('nav-home');
    el.navLiked = document.getElementById('nav-liked');
    el.navHistory = document.getElementById('nav-history');
    el.likedCountBadge = document.getElementById('liked-count-badge');
    el.sidebarPlaylistsList = document.getElementById('sidebar-playlists-list');
    el.btnCreatePlaylistTrigger = document.getElementById('btn-create-playlist-trigger');
    el.mobileSidebarToggle = document.getElementById('mobile-sidebar-toggle');
    el.mobileSidebarClose = document.getElementById('mobile-sidebar-close');
    el.brandLogo = document.getElementById('brand-logo');

    // Top Bar & Search
    el.searchInput = document.getElementById('search-input');
    el.searchClearBtn = document.getElementById('search-clear-btn');
    el.topBtnNowPlaying = document.getElementById('top-btn-now-playing');

    // Views
    el.views = {
      home: document.getElementById('view-home'),
      search: document.getElementById('view-search'),
      liked: document.getElementById('view-liked'),
      history: document.getElementById('view-history'),
      playlist: document.getElementById('view-playlist')
    };

    // Home View Elements
    el.greetingTitle = document.getElementById('greeting-title');
    el.heroBtnRandom = document.getElementById('hero-btn-random');
    el.heroBtnHistory = document.getElementById('hero-btn-history');
    el.homeFeaturedGrid = document.getElementById('home-featured-grid');
    el.homeHistoryBlock = document.getElementById('home-history-block');
    el.homeHistoryList = document.getElementById('home-history-list');
    el.homeViewAllHistory = document.getElementById('home-view-all-history');

    // Search View Elements
    el.searchSubtitle = document.getElementById('search-subtitle');
    el.searchLoading = document.getElementById('search-loading');
    el.searchEmpty = document.getElementById('search-empty');
    el.searchResultsList = document.getElementById('search-results-list');

    // Liked View Elements
    el.likedMetaInfo = document.getElementById('liked-meta-info');
    el.btnPlayAllLiked = document.getElementById('btn-play-all-liked');
    el.likedSongsList = document.getElementById('liked-songs-list');

    // History View Elements
    el.historySongsList = document.getElementById('history-songs-list');
    el.btnClearHistory = document.getElementById('btn-clear-history');

    // Playlist View Elements
    el.currentPlaylistTitle = document.getElementById('current-playlist-title');
    el.currentPlaylistDesc = document.getElementById('current-playlist-desc');
    el.currentPlaylistMeta = document.getElementById('current-playlist-meta');
    el.btnPlayAllPlaylist = document.getElementById('btn-play-all-playlist');
    el.btnDeletePlaylist = document.getElementById('btn-delete-playlist');
    el.playlistSongsList = document.getElementById('playlist-songs-list');

    // Now Playing Overlay Elements
    el.nowPlayingOverlay = document.getElementById('now-playing-overlay');
    el.ambientGlow = document.getElementById('ambient-glow');
    el.btnCloseNowPlaying = document.getElementById('btn-close-now-playing');
    el.npCoverImg = document.getElementById('np-cover-img');
    el.npTrackTitle = document.getElementById('np-track-title');
    el.npTrackArtist = document.getElementById('np-track-artist');
    el.npTrackAlbum = document.getElementById('np-track-album');
    el.btnLikeNp = document.getElementById('btn-like-np');
    el.btnAddToPlaylistNp = document.getElementById('btn-add-to-playlist-np');

    // Now Playing Tabs
    el.tabBtnUpNext = document.getElementById('tab-btn-upnext');
    el.tabBtnLyrics = document.getElementById('tab-btn-lyrics');
    el.tabPaneUpNext = document.getElementById('tab-pane-upnext');
    el.tabPaneLyrics = document.getElementById('tab-pane-lyrics');
    el.autoplayToggleCheckbox = document.getElementById('autoplay-toggle-checkbox');
    el.npQueueList = document.getElementById('np-queue-list');
    el.lyricsContainer = document.getElementById('lyrics-container');
    el.lyricsLoading = document.getElementById('lyrics-loading');
    el.lyricsEmpty = document.getElementById('lyrics-empty');
    el.lyricsWrapper = document.getElementById('lyrics-wrapper');

    // Bottom Player Bar Elements
    el.playerBar = document.getElementById('player-bar');
    el.playerLeftTrigger = document.getElementById('player-left-trigger');
    el.playerThumb = document.getElementById('player-thumb');
    el.playerTitle = document.getElementById('player-title');
    el.playerArtist = document.getElementById('player-artist');
    el.btnLikePlayer = document.getElementById('btn-like-player');

    el.btnShuffle = document.getElementById('btn-shuffle');
    el.btnPrev = document.getElementById('btn-prev');
    el.btnPlayPause = document.getElementById('btn-play-pause');
    el.playIcon = document.getElementById('play-icon');
    el.pauseIcon = document.getElementById('pause-icon');
    el.btnNext = document.getElementById('btn-next');
    el.btnRepeat = document.getElementById('btn-repeat');
    el.repeatOneBadge = document.getElementById('repeat-one-badge');

    el.currentTime = document.getElementById('current-time');
    el.totalDuration = document.getElementById('total-duration');
    el.seekSlider = document.getElementById('seek-slider');
    el.seekSliderFill = document.getElementById('seek-slider-fill');

    el.btnVolumeToggle = document.getElementById('btn-volume-toggle');
    el.volHigh = document.getElementById('vol-high');
    el.volMuted = document.getElementById('vol-muted');
    el.volumeSlider = document.getElementById('volume-slider');
    el.volumeSliderFill = document.getElementById('volume-slider-fill');
    el.btnToggleNowPlaying = document.getElementById('btn-toggle-now-playing');

    // Modals
    el.modalCreatePlaylist = document.getElementById('modal-create-playlist');
    el.inputPlaylistName = document.getElementById('input-playlist-name');
    el.inputPlaylistDesc = document.getElementById('input-playlist-desc');
    el.btnCloseModalCreate = document.getElementById('btn-close-modal-create');
    el.btnCancelModalCreate = document.getElementById('btn-cancel-modal-create');
    el.btnSubmitModalCreate = document.getElementById('btn-submit-modal-create');

    el.modalAddToPlaylist = document.getElementById('modal-add-to-playlist');
    el.addToPlaylistSongName = document.getElementById('add-to-playlist-song-name');
    el.modalPlaylistsList = document.getElementById('modal-playlists-list');
    el.btnCloseModalAdd = document.getElementById('btn-close-modal-add');
    el.btnCancelModalAdd = document.getElementById('btn-cancel-modal-add');

    // Search Filter Pills
    el.searchFilterAll = document.getElementById('search-filter-all');
    el.searchFilterMusic = document.getElementById('search-filter-music');

    // Import Playlist Modal Elements
    el.btnImportPlaylistTrigger = document.getElementById('btn-import-playlist-trigger');
    el.modalImportPlaylist = document.getElementById('modal-import-playlist');
    el.btnCloseModalImport = document.getElementById('btn-close-modal-import');
    el.btnCancelModalImport = document.getElementById('btn-cancel-modal-import');
    el.btnStartImport = document.getElementById('btn-start-import');
    el.inputImportName = document.getElementById('input-import-name');
    el.inputImportDesc = document.getElementById('input-import-desc');
    el.tabBtnImportFile = document.getElementById('tab-btn-import-file');
    el.tabBtnImportText = document.getElementById('tab-btn-import-text');
    el.paneImportFile = document.getElementById('pane-import-file');
    el.paneImportText = document.getElementById('pane-import-text');
    el.fileDropzone = document.getElementById('file-dropzone');
    el.inputImportFile = document.getElementById('input-import-file');
    el.dropzoneBrowseLink = document.getElementById('dropzone-browse-link');
    el.fileSelectedInfo = document.getElementById('file-selected-info');
    el.importFileName = document.getElementById('import-file-name');
    el.importFileTracksCount = document.getElementById('import-file-tracks-count');
    el.btnRemoveSelectedFile = document.getElementById('btn-remove-selected-file');
    el.importPlaylistSelectGroup = document.getElementById('import-playlist-select-group');
    el.selectImportPlaylist = document.getElementById('select-import-playlist');
    el.textareaImportText = document.getElementById('textarea-import-text');
    el.textTracksPreview = document.getElementById('text-tracks-preview');
    el.importProgressBox = document.getElementById('import-progress-box');
    el.importProgressBar = document.getElementById('import-progress-bar');
    el.importStatusText = document.getElementById('import-status-text');
    el.importPercent = document.getElementById('import-percent');
    el.importStatMatched = document.getElementById('import-stat-matched');
    el.importStatFailed = document.getElementById('import-stat-failed');

    // Toast Container
    el.toastContainer = document.getElementById('toast-container');
  }

  // Function to update filled slider track color with linear-gradient
  function updateSliderBackground(sliderEl, percent, accentColor = 'var(--accent-red, #ff2e2e)', bgColor = '#3f3f3f') {
    if (!sliderEl) return;
    const p = Math.max(0, Math.min(100, percent));
    sliderEl.style.background = `linear-gradient(to right, ${accentColor} 0%, ${accentColor} ${p}%, ${bgColor} ${p}%, ${bgColor} 100%)`;
  }

  function loadStoredSettings() {
    const savedVol = localStorage.getItem('bzmusic_volume');
    if (savedVol !== null) {
      state.volume = parseFloat(savedVol);
      if (isNaN(state.volume)) state.volume = 0.9;
    }
    el.audio.volume = state.volume;
    el.volumeSlider.value = state.volume;
    updateSliderBackground(el.volumeSlider, state.volume * 100);
    updateSliderBackground(el.seekSlider, 0);

    const savedAutoplay = localStorage.getItem('bzmusic_autoplay');
    if (savedAutoplay !== null) {
      state.autoplay = savedAutoplay === 'true';
      el.autoplayToggleCheckbox.checked = state.autoplay;
    }

    // Dynamic greeting based on hour
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      el.greetingTitle.textContent = 'Chào buổi sáng!';
    } else if (hour >= 12 && hour < 18) {
      el.greetingTitle.textContent = 'Chào buổi chiều!';
    } else {
      el.greetingTitle.textContent = 'Chào buổi tối!';
    }
  }

  // ==========================================
  // Event Bindings
  // ==========================================
  function bindEvents() {
    // Navigation
    el.navHome.addEventListener('click', () => switchView('home'));
    el.navLiked.addEventListener('click', () => switchView('liked'));
    el.navHistory.addEventListener('click', () => switchView('history'));
    el.brandLogo.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('home');
    });

    // Mobile Sidebar
    el.mobileSidebarToggle.addEventListener('click', () => el.sidebar.classList.add('mobile-open'));
    el.mobileSidebarClose.addEventListener('click', () => el.sidebar.classList.remove('mobile-open'));

    // Search with 400ms debounce
    let searchDebounce = null;
    el.searchInput.addEventListener('input', () => {
      const q = el.searchInput.value.trim();
      el.searchClearBtn.style.display = q ? 'block' : 'none';

      clearTimeout(searchDebounce);
      if (q.length >= 2) {
        searchDebounce = setTimeout(() => {
          performSearch(q);
        }, 400);
      }
    });

    el.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(searchDebounce);
        const q = el.searchInput.value.trim();
        if (q) performSearch(q);
      }
    });

    el.searchClearBtn.addEventListener('click', () => {
      el.searchInput.value = '';
      el.searchClearBtn.style.display = 'none';
      el.searchInput.focus();
    });

    // Detect direct YouTube link on paste
    el.searchInput.addEventListener('paste', () => {
      setTimeout(() => {
        const q = el.searchInput.value.trim();
        const ytUrlRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|music\.youtube\.com\/watch\?v=)([^"&?\/\s]{11})/i;
        if (ytUrlRegex.test(q)) {
          clearTimeout(searchDebounce);
          performSearch(q);
        }
      }, 50);
    });

    // Search filter pills (Tất cả YouTube vs YouTube Music)
    if (el.searchFilterAll && el.searchFilterMusic) {
      el.searchFilterAll.addEventListener('click', () => setSearchMode('all'));
      el.searchFilterMusic.addEventListener('click', () => setSearchMode('music'));
    }

    // Lyrics User Manual Scroll Detection (pauses auto-scroll for 3s)
    if (el.lyricsWrapper) {
      const handleUserLyricsScroll = () => {
        state.isUserScrollingLyrics = true;
        if (state.userScrollTimeout) clearTimeout(state.userScrollTimeout);
        state.userScrollTimeout = setTimeout(() => {
          state.isUserScrollingLyrics = false;
        }, 3000);
      };
      el.lyricsWrapper.addEventListener('wheel', handleUserLyricsScroll, { passive: true });
      el.lyricsWrapper.addEventListener('touchmove', handleUserLyricsScroll, { passive: true });
    }

    // Audio Player Controls
    el.btnPlayPause.addEventListener('click', togglePlayPause);
    el.btnPrev.addEventListener('click', playPreviousTrack);
    el.btnNext.addEventListener('click', playNextTrack);
    el.btnShuffle.addEventListener('click', toggleShuffle);
    el.btnRepeat.addEventListener('click', cycleRepeatMode);

    // Audio Element Events
    el.audio.addEventListener('timeupdate', onTimeUpdate);
    el.audio.addEventListener('play', onAudioPlay);
    el.audio.addEventListener('pause', onAudioPause);
    el.audio.addEventListener('ended', onAudioEnded);
    el.audio.addEventListener('error', onAudioError);
    el.audio.addEventListener('waiting', () => {
      // Buffer wait
    });

    // Seek Slider
    el.seekSlider.addEventListener('mousedown', () => { state.isSeeking = true; });
    el.seekSlider.addEventListener('touchstart', () => { state.isSeeking = true; });
    el.seekSlider.addEventListener('input', onSeekInput);
    el.seekSlider.addEventListener('change', onSeekChange);

    // Volume Slider
    el.volumeSlider.addEventListener('input', onVolumeChange);
    el.btnVolumeToggle.addEventListener('click', toggleMute);

    // Now Playing Overlay Controls
    el.playerLeftTrigger.addEventListener('click', openNowPlaying);
    el.btnToggleNowPlaying.addEventListener('click', toggleNowPlaying);
    el.topBtnNowPlaying.addEventListener('click', toggleNowPlaying);
    el.btnCloseNowPlaying.addEventListener('click', closeNowPlaying);

    // Now Playing Tabs
    el.tabBtnUpNext.addEventListener('click', () => switchNowPlayingTab('upnext'));
    el.tabBtnLyrics.addEventListener('click', () => switchNowPlayingTab('lyrics'));
    el.autoplayToggleCheckbox.addEventListener('change', (e) => {
      state.autoplay = e.target.checked;
      localStorage.setItem('bzmusic_autoplay', state.autoplay);
    });

    // Likes
    el.btnLikePlayer.addEventListener('click', toggleLikeCurrentTrack);
    el.btnLikeNp.addEventListener('click', toggleLikeCurrentTrack);

    // Add to Playlist trigger from Now Playing
    el.btnAddToPlaylistNp.addEventListener('click', () => {
      if (state.currentTrack) {
        openAddToPlaylistModal(state.currentTrack);
      }
    });

    // Hero buttons
    el.heroBtnRandom.addEventListener('click', () => {
      if (state.library.liked.length > 0) {
        playTracklist(state.library.liked, 0, true);
      } else {
        performSearch('Nhạc Việt Nam Vibe Chill');
      }
    });

    el.heroBtnHistory.addEventListener('click', () => switchView('history'));
    el.homeViewAllHistory.addEventListener('click', () => switchView('history'));

    // Liked & History view actions
    el.btnPlayAllLiked.addEventListener('click', () => {
      if (state.library.liked.length > 0) {
        playTracklist(state.library.liked, 0, false);
      } else {
        showToast('Chưa có bài hát yêu thích nào!');
      }
    });

    el.btnClearHistory.addEventListener('click', clearHistory);

    // Playlist view actions
    el.btnPlayAllPlaylist.addEventListener('click', () => {
      const pl = state.library.playlists.find(p => p.id === state.activePlaylistId);
      if (pl && pl.songs.length > 0) {
        playTracklist(pl.songs, 0, false);
      } else {
        showToast('Playlist chưa có bài hát nào!');
      }
    });

    el.btnDeletePlaylist.addEventListener('click', deleteCurrentPlaylist);

    // Modal: Create Playlist
    el.btnCreatePlaylistTrigger.addEventListener('click', openCreatePlaylistModal);
    el.btnCloseModalCreate.addEventListener('click', closeCreatePlaylistModal);
    el.btnCancelModalCreate.addEventListener('click', closeCreatePlaylistModal);
    el.btnSubmitModalCreate.addEventListener('click', submitCreatePlaylist);

    // Modal: Add to Playlist
    el.btnCloseModalAdd.addEventListener('click', closeAddToPlaylistModal);
    el.btnCancelModalAdd.addEventListener('click', closeAddToPlaylistModal);

    // Modal: Import Playlist
    if (el.btnImportPlaylistTrigger) {
      el.btnImportPlaylistTrigger.addEventListener('click', openImportModal);
    }
    if (el.btnCloseModalImport) {
      el.btnCloseModalImport.addEventListener('click', closeImportModal);
    }
    if (el.btnCancelModalImport) {
      el.btnCancelModalImport.addEventListener('click', closeImportModal);
    }
    if (el.btnStartImport) {
      el.btnStartImport.addEventListener('click', handleStartImport);
    }
    if (el.tabBtnImportFile && el.tabBtnImportText) {
      el.tabBtnImportFile.addEventListener('click', () => switchImportTab('file'));
      el.tabBtnImportText.addEventListener('click', () => switchImportTab('text'));
    }
    if (el.fileDropzone) {
      el.fileDropzone.addEventListener('click', () => el.inputImportFile.click());
      el.fileDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        el.fileDropzone.classList.add('dragover');
      });
      el.fileDropzone.addEventListener('dragleave', () => {
        el.fileDropzone.classList.remove('dragover');
      });
      el.fileDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        el.fileDropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          processImportFile(e.dataTransfer.files[0]);
        }
      });
    }
    if (el.inputImportFile) {
      el.inputImportFile.addEventListener('change', handleFileSelected);
    }
    if (el.btnRemoveSelectedFile) {
      el.btnRemoveSelectedFile.addEventListener('click', clearSelectedFile);
    }
    if (el.textareaImportText) {
      el.textareaImportText.addEventListener('input', updateTextImportPreview);
    }

    // Keyboard Shortcuts
    window.addEventListener('keydown', handleGlobalKeydown);

    // Setup Media Session API
    setupMediaSession();
  }

  // ==========================================
  // API Calls & Library Management
  // ==========================================
  async function fetchLibrary() {
    try {
      const res = await fetch('/api/library');
      if (res.ok) {
        state.library = await res.json();
        updateLikedBadge();
      }
    } catch (err) {
      console.error('Lỗi khi tải thư viện:', err);
    }
  }

  function updateLikedBadge() {
    const count = state.library.liked.length;
    el.likedCountBadge.textContent = count;
    el.likedMetaInfo.textContent = `${count} bài hát • Lưu trữ cục bộ`;
  }

  async function toggleLike(song) {
    if (!song || !song.videoId) return;

    try {
      const res = await fetch('/api/library/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(song)
      });

      if (res.ok) {
        const data = await res.json();
        state.library.liked = data.likedSongs;
        updateLikedBadge();

        const isCurrent = state.currentTrack && state.currentTrack.videoId === song.videoId;
        if (isCurrent) {
          updateLikeButtonUI(data.liked);
        }

        if (state.currentView === 'liked') {
          renderLikedSongsView();
        }

        showToast(data.liked ? 'Đã thêm vào Bài hát yêu thích ❤️' : 'Đã xóa khỏi Bài hát yêu thích');
      }
    } catch (err) {
      showToast('Không thể cập nhật yêu thích');
    }
  }

  function toggleLikeCurrentTrack() {
    if (state.currentTrack) {
      toggleLike(state.currentTrack);
    }
  }

  function updateLikeButtonUI(isLiked) {
    if (isLiked) {
      el.btnLikePlayer.classList.add('liked');
      el.btnLikeNp.classList.add('liked');
    } else {
      el.btnLikePlayer.classList.remove('liked');
      el.btnLikeNp.classList.remove('liked');
    }
  }

  function isSongLiked(videoId) {
    return state.library.liked.some(s => s.videoId === videoId);
  }

  function recordPlayHistory(song) {
    clearTimeout(state.trackHistoryTimeout);
    // Record history after user has listened for at least 4 seconds
    state.trackHistoryTimeout = setTimeout(async () => {
      try {
        const res = await fetch('/api/library/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(song)
        });
        if (res.ok) {
          const data = await res.json();
          state.library.history = data.history;
          if (state.currentView === 'history') {
            renderHistoryView();
          }
          renderHomeHistoryPreview();
        }
      } catch (err) {
        // Silently fail for history logging
      }
    }, 4000);
  }

  async function clearHistory() {
    if (!confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử nghe nhạc?')) return;

    try {
      const res = await fetch('/api/library/history', { method: 'DELETE' });
      if (res.ok) {
        state.library.history = [];
        renderHistoryView();
        renderHomeHistoryPreview();
        showToast('Đã xóa toàn bộ lịch sử');
      }
    } catch (err) {
      showToast('Không thể xóa lịch sử');
    }
  }

  // ==========================================
  // Playback Control & Queue Engine
  // ==========================================
  async function playSong(song, newQueue = null, indexInQueue = -1) {
    if (!song || !song.videoId) return;

    // Clear any pending error skip timer
    if (state.errorSkipTimer) {
      clearTimeout(state.errorSkipTimer);
      state.errorSkipTimer = null;
    }

    state.currentTrack = song;

    if (newQueue) {
      state.queue = [...newQueue];
      state.queueIndex = indexInQueue >= 0 ? indexInQueue : state.queue.findIndex(s => s.videoId === song.videoId);
      if (state.queueIndex === -1) {
        state.queue.unshift(song);
        state.queueIndex = 0;
      }
    } else {
      // If song not in current queue, add it right after current song
      const existingIdx = state.queue.findIndex(s => s.videoId === song.videoId);
      if (existingIdx !== -1) {
        state.queueIndex = existingIdx;
      } else {
        if (state.queueIndex >= 0 && state.queueIndex < state.queue.length) {
          state.queue.splice(state.queueIndex + 1, 0, song);
          state.queueIndex++;
        } else {
          state.queue.push(song);
          state.queueIndex = state.queue.length - 1;
        }
      }
    }

    // Reset seekbar on new song load
    el.seekSlider.value = 0;
    el.currentTime.textContent = '0:00';
    updateSliderBackground(el.seekSlider, 0);

    updatePlayerUI(song);
    updateLikeButtonUI(isSongLiked(song.videoId));
    updateMediaSessionMetadata(song);
    updateAmbientGlow(song.thumbnail);

    // Set Audio Source to proxy endpoint
    const streamUrl = `/api/stream/${song.videoId}`;
    el.audio.src = streamUrl;

    try {
      await el.audio.play();
      state.isPlaying = true;
      state.consecutiveErrors = 0; // Reset error counter on successful playback initiation
      updatePlayPauseButtonUI(true);
      updateDocumentTitle(song.title, song.artist, true);
      recordPlayHistory(song);
    } catch (err) {
      console.warn('[BZusic Player] Playback error or autoplay blocked:', err.message);
      // Wait for user gesture or retry
    }

    // Refresh Queue UI and fetch Up Next / Lyrics
    renderQueueList();
    fetchLyrics(song.title, song.artist);

    // If queue is near end (fewer than 3 upcoming tracks), fetch Up Next to append
    if (state.autoplay && (state.queue.length - state.queueIndex) <= 3) {
      fetchAndAppendUpNext(song.videoId);
    }
  }

  function playTracklist(tracklist, startIndex = 0, shuffle = false) {
    if (!tracklist || tracklist.length === 0) return;

    let listToPlay = [...tracklist];
    let startIdx = startIndex;

    if (shuffle) {
      state.isShuffle = true;
      el.btnShuffle.classList.add('active');
      // Fisher-Yates shuffle
      for (let i = listToPlay.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [listToPlay[i], listToPlay[j]] = [listToPlay[j], listToPlay[i]];
      }
      startIdx = 0;
    }

    playSong(listToPlay[startIdx], listToPlay, startIdx);
  }

  function togglePlayPause() {
    // If an error skip was scheduled, cancel it immediately when user interacts
    if (state.errorSkipTimer) {
      clearTimeout(state.errorSkipTimer);
      state.errorSkipTimer = null;
      showToast('Đã dừng chuyển bài tự động');
    }
    state.consecutiveErrors = 0;

    if (!state.currentTrack) {
      if (state.library.liked.length > 0) {
        playTracklist(state.library.liked, 0, false);
      }
      return;
    }

    if (el.audio.paused) {
      el.audio.play().catch(e => console.error(e));
    } else {
      el.audio.pause();
    }
  }

  function playNextTrack() {
    if (state.errorSkipTimer) {
      clearTimeout(state.errorSkipTimer);
      state.errorSkipTimer = null;
    }

    if (state.queue.length === 0) return;

    if (state.repeatMode === 'one') {
      el.audio.currentTime = 0;
      el.audio.play();
      return;
    }

    if (state.queueIndex < state.queue.length - 1) {
      state.queueIndex++;
      playSong(state.queue[state.queueIndex]);
    } else {
      if (state.repeatMode === 'all') {
        state.queueIndex = 0;
        playSong(state.queue[0]);
      } else if (state.autoplay && state.currentTrack) {
        // Fetch fresh Up Next and continue playing
        fetchAndAppendUpNext(state.currentTrack.videoId, true);
      } else {
        showToast('Đã hết danh sách bài hát trong hàng đợi');
      }
    }
  }

  function playPreviousTrack() {
    if (state.errorSkipTimer) {
      clearTimeout(state.errorSkipTimer);
      state.errorSkipTimer = null;
    }

    if (state.queue.length === 0) return;

    // If song played for > 3 seconds, replay it from start
    if (el.audio.currentTime > 3) {
      el.audio.currentTime = 0;
      return;
    }

    if (state.queueIndex > 0) {
      state.queueIndex--;
      playSong(state.queue[state.queueIndex]);
    } else {
      el.audio.currentTime = 0;
    }
  }

  function toggleShuffle() {
    state.isShuffle = !state.isShuffle;
    el.btnShuffle.classList.toggle('active', state.isShuffle);
    showToast(state.isShuffle ? 'Đã bật chế độ phát ngẫu nhiên' : 'Đã tắt chế độ phát ngẫu nhiên');
  }

  function cycleRepeatMode() {
    if (state.repeatMode === 'off') {
      state.repeatMode = 'all';
      el.btnRepeat.classList.add('active');
      el.repeatOneBadge.style.display = 'none';
      showToast('Lặp lại danh sách');
    } else if (state.repeatMode === 'all') {
      state.repeatMode = 'one';
      el.btnRepeat.classList.add('active');
      el.repeatOneBadge.style.display = 'block';
      showToast('Lặp lại 1 bài hát');
    } else {
      state.repeatMode = 'off';
      el.btnRepeat.classList.remove('active');
      el.repeatOneBadge.style.display = 'none';
      showToast('Tắt lặp lại');
    }
  }

  async function fetchAndAppendUpNext(videoId, autoPlayImmediately = false) {
    try {
      const res = await fetch(`/api/upnext/${videoId}`);
      if (res.ok) {
        const data = await res.json();
        const newTracks = data.tracks || [];

        // Deduplicate against existing queue
        const currentIds = new Set(state.queue.map(s => s.videoId));
        const filtered = newTracks.filter(s => !currentIds.has(s.videoId));

        if (filtered.length > 0) {
          state.queue.push(...filtered);
          renderQueueList();

          if (autoPlayImmediately && state.queueIndex < state.queue.length - 1) {
            state.queueIndex++;
            playSong(state.queue[state.queueIndex]);
          }
        }
      }
    } catch (err) {
      console.warn('Không thể nạp gợi ý Up Next:', err);
    }
  }

  // ==========================================
  // Audio Element Event Handlers
  // ==========================================
  function onAudioPlay() {
    state.isPlaying = true;
    state.consecutiveErrors = 0; // Reset error count on successful playback
    if (state.errorSkipTimer) {
      clearTimeout(state.errorSkipTimer);
      state.errorSkipTimer = null;
    }
    updatePlayPauseButtonUI(true);
    startKaraokeLoop();
    if (state.currentTrack) {
      updateDocumentTitle(state.currentTrack.title, state.currentTrack.artist, true);
    }
    if (navigator.mediaSession) {
      navigator.mediaSession.playbackState = 'playing';
    }
  }

  function onAudioPause() {
    state.isPlaying = false;
    stopKaraokeLoop();
    updatePlayPauseButtonUI(false);
    updateDocumentTitle('', '', false);
    if (navigator.mediaSession) {
      navigator.mediaSession.playbackState = 'paused';
    }
  }

  function onAudioEnded() {
    playNextTrack();
  }

  function onAudioError(e) {
    console.error('[BZusic Audio Error]:', e);
    state.consecutiveErrors++;

    if (state.consecutiveErrors >= 3) {
      // Dừng hẳn trình phát sau 3 bài lỗi liên tiếp
      if (state.errorSkipTimer) {
        clearTimeout(state.errorSkipTimer);
        state.errorSkipTimer = null;
      }
      el.audio.pause();
      state.isPlaying = false;
      updatePlayPauseButtonUI(false);
      updateDocumentTitle('', '', false);
      showToast('⚠️ Đã dừng phát: Gặp lỗi liên tiếp 3 bài hát. Vui lòng kiểm tra lại kết nối mạng hoặc thử bài khác.', 6000);
      return;
    }

    showToast(`Không thể phát bài hát này (${state.consecutiveErrors}/3). Đang tự động chuyển bài tiếp theo sau 1.5s...`);
    
    if (state.errorSkipTimer) {
      clearTimeout(state.errorSkipTimer);
    }
    state.errorSkipTimer = setTimeout(() => {
      state.errorSkipTimer = null;
      playNextTrack();
    }, 1500);
  }

  function onTimeUpdate() {
    if (state.isSeeking) return;

    const current = el.audio.currentTime || 0;
    const duration = el.audio.duration || 0;

    el.currentTime.textContent = formatTime(current);

    if (duration > 0) {
      el.totalDuration.textContent = formatTime(duration);
      const progressPercent = (current / duration) * 100;
      el.seekSlider.value = progressPercent;
      updateSliderBackground(el.seekSlider, progressPercent);
    }

    // Sync Lyrics line tracking
    syncLyricsTime(current);
  }

  function onSeekInput() {
    const val = parseFloat(el.seekSlider.value);
    updateSliderBackground(el.seekSlider, val);
    if (el.audio.duration) {
      el.currentTime.textContent = formatTime((val / 100) * el.audio.duration);
    }
  }

  function onSeekChange() {
    state.isSeeking = false;
    const val = parseFloat(el.seekSlider.value);
    updateSliderBackground(el.seekSlider, val);
    if (el.audio.duration) {
      el.audio.currentTime = (val / 100) * el.audio.duration;
    }
  }

  function onVolumeChange() {
    const vol = parseFloat(el.volumeSlider.value);
    state.volume = vol;
    state.isMuted = vol === 0;
    el.audio.volume = vol;
    updateSliderBackground(el.volumeSlider, vol * 100);
    localStorage.setItem('bzmusic_volume', vol);
    updateVolumeIconUI(state.isMuted);
  }

  function toggleMute() {
    if (state.isMuted) {
      // Unmute
      state.isMuted = false;
      const restoreVol = state.previousVolume > 0 ? state.previousVolume : 0.8;
      state.volume = restoreVol;
      el.audio.volume = restoreVol;
      el.volumeSlider.value = restoreVol;
      updateSliderBackground(el.volumeSlider, restoreVol * 100);
      updateVolumeIconUI(false);
    } else {
      // Mute
      state.isMuted = true;
      state.previousVolume = state.volume;
      state.volume = 0;
      el.audio.volume = 0;
      el.volumeSlider.value = 0;
      updateSliderBackground(el.volumeSlider, 0);
      updateVolumeIconUI(true);
    }
  }

  function updateVolumeIconUI(muted) {
    if (muted) {
      el.volHigh.style.display = 'none';
      el.volMuted.style.display = 'block';
    } else {
      el.volHigh.style.display = 'block';
      el.volMuted.style.display = 'none';
    }
  }

  function updatePlayPauseButtonUI(playing) {
    if (playing) {
      el.playIcon.style.display = 'none';
      el.pauseIcon.style.display = 'block';
    } else {
      el.playIcon.style.display = 'block';
      el.pauseIcon.style.display = 'none';
    }
  }

  function updateDocumentTitle(title, artist, playing) {
    if (playing && title) {
      document.title = `▶ ${title} - ${artist} | BZusic`;
    } else {
      document.title = 'BZusic';
    }
  }

  function updatePlayerUI(song) {
    // Bottom bar
    el.playerThumb.src = song.thumbnail || 'favicon.svg';
    el.playerTitle.textContent = song.title;
    el.playerArtist.textContent = song.artist;
    el.totalDuration.textContent = song.duration || '0:00';

    // Now Playing view
    el.npCoverImg.src = song.thumbnail || 'favicon.svg';
    el.npTrackTitle.textContent = song.title;
    el.npTrackArtist.textContent = song.artist;
    el.npTrackAlbum.textContent = song.album || '';
  }

  // ==========================================
  // Ambient Glow Effect
  // ==========================================
  function updateAmbientGlow(thumbnailUrl) {
    if (!thumbnailUrl) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = thumbnailUrl;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 10;
        canvas.height = 10;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 10, 10);
        const data = ctx.getImageData(0, 0, 10, 10).data;

        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          // Exclude extremely dark or near black pixels
          if (data[i] > 30 || data[i+1] > 30 || data[i+2] > 30) {
            r += data[i];
            g += data[i+1];
            b += data[i+2];
            count++;
          }
        }

        if (count > 0) {
          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);
        } else {
          r = 255; g = 46; b = 46;
        }

        el.ambientGlow.style.background = `radial-gradient(circle, rgba(${r}, ${g}, ${b}, 0.45) 0%, rgba(3, 3, 3, 0) 75%)`;
      } catch (e) {
        // Fallback default glow
        el.ambientGlow.style.background = `radial-gradient(circle, rgba(255, 46, 46, 0.4) 0%, rgba(3, 3, 3, 0) 75%)`;
      }
    };

    img.onerror = () => {
      el.ambientGlow.style.background = `radial-gradient(circle, rgba(255, 46, 46, 0.4) 0%, rgba(3, 3, 3, 0) 75%)`;
    };
  }

  // ==========================================
  // Lyrics Engine (Synced & Plain)
  // ==========================================
  async function fetchLyrics(title, artist) {
    state.lyrics = null;
    state.activeLyricIndex = -1;
    el.lyricsContainer.innerHTML = '';
    el.lyricsEmpty.style.display = 'none';
    el.lyricsLoading.style.display = 'flex';

    try {
      const res = await fetch(`/api/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`);
      el.lyricsLoading.style.display = 'none';

      if (res.ok) {
        const data = await res.json();
        if (data.syncedLyrics) {
          const lines = parseLrc(data.syncedLyrics);
          if (lines.length > 0) {
            state.lyrics = { type: 'synced', lines };
            renderSyncedLyrics(lines);
            return;
          }
        }

        if (data.plainLyrics) {
          state.lyrics = { type: 'plain', text: data.plainLyrics };
          renderPlainLyrics(data.plainLyrics);
          return;
        }
      }

      el.lyricsEmpty.style.display = 'flex';
    } catch (err) {
      el.lyricsLoading.style.display = 'none';
      el.lyricsEmpty.style.display = 'flex';
    }
  }

  function parseTimeTag(str) {
    const m = str.match(/(\d{1,2}):(\d{2})\.?(\d{1,3})?/);
    if (!m) return null;
    const min = parseInt(m[1], 10);
    const sec = parseInt(m[2], 10);
    const ms = m[3] ? parseInt(m[3].padEnd(3, '0').slice(0, 3), 10) : 0;
    return min * 60 + sec + ms / 1000;
  }

  function parseLrc(lrcText) {
    const lines = [];
    const rawLines = lrcText.split(/\r?\n/);
    const lineTimeRegex = /^\[(\d{1,2}:\d{2}(?:\.\d{1,3})?)\]/;
    const wordTimeRegex = /<(\d{1,2}:\d{2}(?:\.\d{1,3})?)>([^<]*)/g;

    for (let i = 0; i < rawLines.length; i++) {
      const raw = rawLines[i].trim();
      if (!raw) continue;

      let lineTime = null;
      let content = raw;

      const lineMatch = raw.match(lineTimeRegex);
      if (lineMatch) {
        lineTime = parseTimeTag(lineMatch[1]);
        content = raw.replace(lineTimeRegex, '').trim();
      }

      // Check for Enhanced word tokens: <mm:ss.xx>word
      const words = [];
      let match;
      while ((match = wordTimeRegex.exec(content)) !== null) {
        const wTime = parseTimeTag(match[1]);
        const wText = match[2];
        if (wTime !== null && wText) {
          words.push({ time: wTime, text: wText });
        }
      }

      // Completely remove all <...> and [...] tags so they never appear on screen
      const cleanText = content.replace(/<[^>]*>/g, '').replace(/\[[^\]]*\]/g, '').trim();
      if (!cleanText && words.length === 0) continue;

      if (lineTime === null && words.length > 0) {
        lineTime = words[0].time;
      }
      if (lineTime === null) continue;

      // Assign word end times
      for (let w = 0; w < words.length; w++) {
        const nextWord = words[w + 1];
        words[w].endTime = nextWord ? nextWord.time : (words[w].time + 0.8);
      }

      lines.push({
        time: lineTime,
        text: cleanText,
        words: words.length > 0 ? words : null,
        isEnhanced: words.length > 0
      });
    }

    return lines.sort((a, b) => a.time - b.time);
  }

  function renderSyncedLyrics(lines) {
    el.lyricsContainer.innerHTML = '';
    const frag = document.createDocumentFragment();

    lines.forEach((line, idx) => {
      const div = document.createElement('div');
      div.className = `lyric-line${line.isEnhanced ? ' enhanced' : ''}`;
      div.dataset.index = idx;
      div.dataset.time = line.time;

      if (line.isEnhanced && line.words) {
        line.words.forEach((w) => {
          const span = document.createElement('span');
          span.className = 'lyric-word';
          span.dataset.start = w.time;
          span.dataset.end = w.endTime;
          span.textContent = w.text;
          span.addEventListener('click', (e) => {
            e.stopPropagation();
            el.audio.currentTime = w.time;
            if (el.audio.paused) el.audio.play();
          });
          div.appendChild(span);
        });
      } else {
        div.textContent = line.text;
      }

      div.addEventListener('click', () => {
        el.audio.currentTime = line.time;
        if (el.audio.paused) el.audio.play();
      });

      frag.appendChild(div);
    });

    el.lyricsContainer.appendChild(frag);
  }

  function renderPlainLyrics(text) {
    el.lyricsContainer.innerHTML = '';
    const p = document.createElement('div');
    p.className = 'lyric-plain-text';
    p.textContent = text;
    el.lyricsContainer.appendChild(p);
  }

  function syncLyricsTime(currentTime) {
    if (!state.lyrics || state.lyrics.type !== 'synced' || !state.lyrics.lines.length) return;

    const lines = state.lyrics.lines;
    let foundIndex = -1;

    for (let i = lines.length - 1; i >= 0; i--) {
      if (currentTime >= lines[i].time - 0.25) {
        foundIndex = i;
        break;
      }
    }

    if (foundIndex !== state.activeLyricIndex && foundIndex !== -1) {
      state.activeLyricIndex = foundIndex;

      // Update UI active line
      const allLines = el.lyricsContainer.querySelectorAll('.lyric-line');
      allLines.forEach((elem, idx) => {
        if (idx === foundIndex) {
          elem.classList.add('active');
          // Auto scroll to center if user is not actively scrolling
          if (!state.isUserScrollingLyrics) {
            elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } else {
          elem.classList.remove('active');
          const words = elem.querySelectorAll('.lyric-word');
          words.forEach(w => w.classList.remove('active', 'sung'));
        }
      });
    }

    // Update word-level karaoke for active line in Enhanced LRC
    if (state.activeLyricIndex >= 0) {
      const activeLineElem = el.lyricsContainer.querySelector(`.lyric-line[data-index="${state.activeLyricIndex}"]`);
      if (activeLineElem && activeLineElem.classList.contains('enhanced')) {
        const words = activeLineElem.querySelectorAll('.lyric-word');
        words.forEach(span => {
          const start = parseFloat(span.dataset.start);
          const end = parseFloat(span.dataset.end);
          if (currentTime >= end) {
            span.classList.add('sung');
            span.classList.remove('active');
          } else if (currentTime >= start) {
            span.classList.add('active');
            span.classList.remove('sung');
          } else {
            span.classList.remove('active', 'sung');
          }
        });
      }
    }
  }

  function startKaraokeLoop() {
    if (state.karaokeRafId) cancelAnimationFrame(state.karaokeRafId);
    function loop() {
      if (!el.audio.paused && state.lyrics && state.lyrics.type === 'synced') {
        syncLyricsTime(el.audio.currentTime || 0);
        state.karaokeRafId = requestAnimationFrame(loop);
      } else {
        state.karaokeRafId = null;
      }
    }
    state.karaokeRafId = requestAnimationFrame(loop);
  }

  function stopKaraokeLoop() {
    if (state.karaokeRafId) {
      cancelAnimationFrame(state.karaokeRafId);
      state.karaokeRafId = null;
    }
  }

  // ==========================================
  // Queue & Up Next Rendering
  // ==========================================
  function renderQueueList() {
    el.npQueueList.innerHTML = '';
    if (state.queue.length === 0) {
      el.npQueueList.innerHTML = '<div class="search-empty"><p>Hàng đợi trống</p></div>';
      return;
    }

    const frag = document.createDocumentFragment();

    state.queue.forEach((song, idx) => {
      const isCurrent = idx === state.queueIndex;
      const row = document.createElement('div');
      row.className = `song-row ${isCurrent ? 'playing' : ''}`;

      row.innerHTML = `
        <div class="song-row-idx">
          ${isCurrent ? `
            <div class="sound-wave">
              <span></span><span></span><span></span><span></span>
            </div>
          ` : (idx + 1)}
        </div>
        <div class="song-row-thumb-wrap">
          <img class="song-row-thumb" src="${song.thumbnail || 'favicon.svg'}" alt="${escapeHtml(song.title)}" loading="lazy">
        </div>
        <div class="song-row-info">
          <div class="song-row-title">${escapeHtml(song.title)}</div>
          <div class="song-row-artist">${escapeHtml(song.artist)}</div>
        </div>
        <div class="song-row-duration">${song.duration || '0:00'}</div>
      `;

      row.addEventListener('click', () => {
        state.queueIndex = idx;
        playSong(song);
      });

      frag.appendChild(row);
    });

    el.npQueueList.appendChild(frag);
  }

  // ==========================================
  // Search Execution & Modes
  // ==========================================
  function setSearchMode(mode) {
    state.searchMode = mode;
    if (el.searchFilterAll) el.searchFilterAll.classList.toggle('active', mode === 'all');
    if (el.searchFilterMusic) el.searchFilterMusic.classList.toggle('active', mode === 'music');
    const q = el.searchInput.value.trim();
    if (q) performSearch(q);
  }

  async function performSearch(query) {
    if (!query) return;

    switchView('search');
    const modeLabel = state.searchMode === 'all' ? 'Tất cả YouTube' : 'YouTube Music';
    el.searchSubtitle.textContent = `Kết quả cho "${query}" (${modeLabel})`;
    el.searchResultsList.innerHTML = '';
    el.searchEmpty.style.display = 'none';
    el.searchLoading.style.display = 'flex';

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&mode=${state.searchMode}`);
      el.searchLoading.style.display = 'none';

      if (res.ok) {
        const data = await res.json();
        const results = data.results || [];
        if (results.length > 0) {
          renderSongRows(el.searchResultsList, results, (song, idx) => {
            playSong(song, results, idx);
          });
        } else {
          el.searchEmpty.style.display = 'flex';
        }
      } else {
        el.searchEmpty.style.display = 'flex';
      }
    } catch (err) {
      el.searchLoading.style.display = 'none';
      el.searchEmpty.style.display = 'flex';
    }
  }

  // ==========================================
  // Views Rendering
  // ==========================================
  function switchView(viewName) {
    state.currentView = viewName;

    // Update Sidebar Navigation highlights
    el.navHome.classList.toggle('active', viewName === 'home');
    el.navLiked.classList.toggle('active', viewName === 'liked');
    el.navHistory.classList.toggle('active', viewName === 'history');

    // Update playlist sidebar items active status
    const allPlItems = el.sidebarPlaylistsList.querySelectorAll('.playlist-sidebar-item');
    allPlItems.forEach(item => {
      item.classList.toggle('active', viewName === 'playlist' && item.dataset.id === state.activePlaylistId);
    });

    // Hide all views, show active view
    for (const key in el.views) {
      if (el.views[key]) {
        el.views[key].classList.toggle('active', key === viewName);
      }
    }

    // Close mobile drawer if open
    el.sidebar.classList.remove('mobile-open');

    // Render specific view data
    if (viewName === 'liked') {
      renderLikedSongsView();
    } else if (viewName === 'history') {
      renderHistoryView();
    }
  }

  function renderLikedSongsView() {
    updateLikedBadge();
    renderSongRows(el.likedSongsList, state.library.liked, (song, idx) => {
      playSong(song, state.library.liked, idx);
    });
  }

  function renderHistoryView() {
    renderSongRows(el.historySongsList, state.library.history, (song, idx) => {
      playSong(song, state.library.history, idx);
    });
  }

  function renderPlaylistView(playlistId) {
    const playlist = state.library.playlists.find(p => p.id === playlistId);
    if (!playlist) return;

    state.activePlaylistId = playlistId;
    switchView('playlist');

    el.currentPlaylistTitle.textContent = playlist.name;
    el.currentPlaylistDesc.textContent = playlist.description || 'Danh sách phát cá nhân của bạn';
    el.currentPlaylistMeta.textContent = `${playlist.songs.length} bài hát`;

    renderSongRows(el.playlistSongsList, playlist.songs, (song, idx) => {
      playSong(song, playlist.songs, idx);
    }, {
      showRemove: true,
      onRemove: (song) => removeSongFromPlaylist(playlistId, song.videoId)
    });
  }

  function renderHomeFeatured() {
    // Initial featured top songs (liked or default picks)
    const featured = state.library.liked.length >= 4 ? state.library.liked : [
      {
        videoId: 'qHpE45b4INk',
        title: 'Nơi Này Có Anh',
        artist: 'Sơn Tùng M-TP',
        album: 'Nơi Này Có Anh',
        thumbnail: 'https://yt3.googleusercontent.com/guPkUMfq6XoStEBVJwwWMD5dttVFgi0OXpzHZ0hvPD0kWxdVkrMbMCBNRDZlUy_N953vMI_r-6x1X_IEWQ=w544-h544-l90-rj',
        duration: '4:21'
      },
      {
        videoId: 'nugmZqIP0uk',
        title: 'See You Again (feat. Charlie Puth)',
        artist: 'Wiz Khalifa',
        album: 'Nine Track Mind',
        thumbnail: 'https://yt3.googleusercontent.com/TlXKDSRGrj0ogqmGbzyGvZrsT9T0F6xgV-2-3pelbzRms0cODdb-ndDg6SpFzkHYMb4NMMMW957wmrObfw=w544-h544-l90-rj',
        duration: '3:50'
      },
      {
        videoId: 'bNp9pn0ni3I',
        title: 'Chúng Ta Của Hiện Tại',
        artist: 'Sơn Tùng M-TP',
        album: 'Chúng Ta Của Hiện Tại',
        thumbnail: 'https://yt3.googleusercontent.com/R96C4cCNuVOuaKpo8AfoM2ienXSOY3rhljcOi2_7Cg1KnjyZ3hr1X_A5Z8G5vOg645yG6P8txcu1r5kI=w544-h544-l90-rj',
        duration: '5:02'
      },
      {
        videoId: 'dQw4w9WgXcQ',
        title: 'Never Gonna Give You Up',
        artist: 'Rick Astley',
        album: 'Whenever You Need Somebody',
        thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        duration: '3:33'
      }
    ];

    el.homeFeaturedGrid.innerHTML = '';
    featured.forEach((song, idx) => {
      const card = document.createElement('div');
      card.className = 'song-card';
      card.innerHTML = `
        <div class="song-card-thumb-wrap">
          <img class="song-card-thumb" src="${song.thumbnail}" alt="${escapeHtml(song.title)}" loading="lazy">
          <button class="song-card-play-btn" title="Phát bài hát">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </button>
        </div>
        <div class="song-card-title" title="${escapeHtml(song.title)}">${escapeHtml(song.title)}</div>
        <div class="song-card-artist">${escapeHtml(song.artist)}</div>
      `;

      card.addEventListener('click', () => {
        playSong(song, featured, idx);
      });

      el.homeFeaturedGrid.appendChild(card);
    });

    renderHomeHistoryPreview();
  }

  function renderHomeHistoryPreview() {
    if (state.library.history.length > 0) {
      el.homeHistoryBlock.style.display = 'block';
      const recent = state.library.history.slice(0, 4);
      renderSongRows(el.homeHistoryList, recent, (song, idx) => {
        playSong(song, state.library.history, idx);
      });
    } else {
      el.homeHistoryBlock.style.display = 'none';
    }
  }

  // ==========================================
  // Generic Song Row Component
  // ==========================================
  function renderSongRows(container, songs, onPlayClick, options = {}) {
    container.innerHTML = '';
    if (!songs || songs.length === 0) {
      container.innerHTML = '<div class="search-empty"><p>Chưa có bài hát nào ở đây.</p></div>';
      return;
    }

    const frag = document.createDocumentFragment();

    songs.forEach((song, idx) => {
      const isCurrent = state.currentTrack && state.currentTrack.videoId === song.videoId;
      const row = document.createElement('div');
      row.className = `song-row ${isCurrent ? 'playing' : ''}`;

      row.innerHTML = `
        <div class="song-row-idx">${idx + 1}</div>
        <div class="song-row-thumb-wrap">
          <img class="song-row-thumb" src="${song.thumbnail || 'favicon.svg'}" alt="${escapeHtml(song.title)}" loading="lazy">
          <div class="song-row-play-overlay">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
        <div class="song-row-info">
          <div class="song-row-title">${escapeHtml(song.title)}</div>
          <div class="song-row-artist">${escapeHtml(song.artist)}</div>
        </div>
        ${song.album ? `<div class="song-row-album">${escapeHtml(song.album)}</div>` : ''}
        <div class="song-row-duration">${song.duration || '0:00'}</div>
        <div class="song-row-actions">
          <button class="icon-btn btn-row-like" title="Thích bài hát">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="${isSongLiked(song.videoId) ? '#ff2e2e' : 'none'}" stroke="${isSongLiked(song.videoId) ? '#ff2e2e' : 'currentColor'}" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          </button>
          <button class="icon-btn btn-row-add-pl" title="Thêm vào Playlist">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z"/></svg>
          </button>
          ${options.showRemove ? `
            <button class="icon-btn btn-row-remove" title="Xóa khỏi playlist" style="color: #ef4444;">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          ` : ''}
        </div>
      `;

      // Play on row click
      row.addEventListener('click', (e) => {
        if (e.target.closest('.song-row-actions')) return;
        onPlayClick(song, idx);
      });

      // Actions
      const btnLike = row.querySelector('.btn-row-like');
      btnLike.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleLike(song);
        const liked = isSongLiked(song.videoId);
        const svg = btnLike.querySelector('svg');
        svg.setAttribute('fill', liked ? '#ff2e2e' : 'none');
        svg.setAttribute('stroke', liked ? '#ff2e2e' : 'currentColor');
      });

      const btnAddPl = row.querySelector('.btn-row-add-pl');
      btnAddPl.addEventListener('click', (e) => {
        e.stopPropagation();
        openAddToPlaylistModal(song);
      });

      if (options.showRemove) {
        const btnRemove = row.querySelector('.btn-row-remove');
        btnRemove.addEventListener('click', (e) => {
          e.stopPropagation();
          options.onRemove(song);
        });
      }

      frag.appendChild(row);
    });

    container.appendChild(frag);
  }

  // ==========================================
  // Playlist Management
  // ==========================================
  function renderSidebarPlaylists() {
    el.sidebarPlaylistsList.innerHTML = '';
    const playlists = state.library.playlists;

    playlists.forEach(pl => {
      const btn = document.createElement('button');
      btn.className = 'playlist-sidebar-item';
      btn.dataset.id = pl.id;
      btn.innerHTML = `
        <span>${escapeHtml(pl.name)}</span>
        <span style="font-size: 0.72rem; color: var(--text-dim);">${pl.songs.length}</span>
      `;

      btn.addEventListener('click', () => {
        renderPlaylistView(pl.id);
      });

      el.sidebarPlaylistsList.appendChild(btn);
    });
  }

  function openCreatePlaylistModal() {
    el.inputPlaylistName.value = '';
    el.inputPlaylistDesc.value = '';
    el.modalCreatePlaylist.style.display = 'flex';
    el.inputPlaylistName.focus();
  }

  function closeCreatePlaylistModal() {
    el.modalCreatePlaylist.style.display = 'none';
  }

  async function submitCreatePlaylist() {
    const name = el.inputPlaylistName.value.trim();
    const desc = el.inputPlaylistDesc.value.trim();

    if (!name) {
      showToast('Vui lòng nhập tên danh sách phát');
      el.inputPlaylistName.focus();
      return;
    }

    try {
      const res = await fetch('/api/library/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: desc })
      });

      if (res.ok) {
        const data = await res.json();
        state.library.playlists = data.playlists;
        renderSidebarPlaylists();
        closeCreatePlaylistModal();
        showToast(`Đã tạo playlist "${name}" thành công!`);
        renderPlaylistView(data.playlist.id);
      }
    } catch (err) {
      showToast('Không thể tạo danh sách phát');
    }
  }

  async function deleteCurrentPlaylist() {
    if (!state.activePlaylistId) return;
    const pl = state.library.playlists.find(p => p.id === state.activePlaylistId);
    if (!pl) return;

    if (!confirm(`Bạn có chắc muốn xóa playlist "${pl.name}"?`)) return;

    try {
      const res = await fetch(`/api/library/playlists/${state.activePlaylistId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        const data = await res.json();
        state.library.playlists = data.playlists;
        renderSidebarPlaylists();
        switchView('home');
        showToast('Đã xóa playlist');
      }
    } catch (err) {
      showToast('Không thể xóa playlist');
    }
  }

  function openAddToPlaylistModal(song) {
    state.pendingAddToPlaylistSong = song;
    el.addToPlaylistSongName.textContent = `Thêm bài hát "${song.title}" vào:`;
    el.modalPlaylistsList.innerHTML = '';

    if (state.library.playlists.length === 0) {
      el.modalPlaylistsList.innerHTML = '<p class="modal-subtext">Bạn chưa có playlist nào. Hãy tạo mới ở thanh bên trái!</p>';
    } else {
      state.library.playlists.forEach(pl => {
        const btn = document.createElement('button');
        btn.className = 'modal-playlist-option';
        const alreadyIn = pl.songs.some(s => s.videoId === song.videoId);

        btn.innerHTML = `
          <span>${escapeHtml(pl.name)}</span>
          <span style="font-size: 0.78rem; color: ${alreadyIn ? '#10b981' : 'var(--text-dim)'};">
            ${alreadyIn ? '✓ Đã có' : '+ Thêm'}
          </span>
        `;

        btn.addEventListener('click', () => {
          addSongToPlaylist(pl.id, song);
        });

        el.modalPlaylistsList.appendChild(btn);
      });
    }

    el.modalAddToPlaylist.style.display = 'flex';
  }

  function closeAddToPlaylistModal() {
    el.modalAddToPlaylist.style.display = 'none';
    state.pendingAddToPlaylistSong = null;
  }

  async function addSongToPlaylist(playlistId, song) {
    try {
      const res = await fetch(`/api/library/playlists/${playlistId}/songs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(song)
      });

      if (res.ok) {
        const data = await res.json();
        // Update local playlist state
        const idx = state.library.playlists.findIndex(p => p.id === playlistId);
        if (idx !== -1) {
          state.library.playlists[idx] = data.playlist;
        }
        renderSidebarPlaylists();
        closeAddToPlaylistModal();
        showToast(`Đã thêm vào "${data.playlist.name}"`);

        if (state.currentView === 'playlist' && state.activePlaylistId === playlistId) {
          renderPlaylistView(playlistId);
        }
      }
    } catch (err) {
      showToast('Không thể thêm vào danh sách phát');
    }
  }

  async function removeSongFromPlaylist(playlistId, videoId) {
    try {
      const res = await fetch(`/api/library/playlists/${playlistId}/songs/${videoId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        const data = await res.json();
        const idx = state.library.playlists.findIndex(p => p.id === playlistId);
        if (idx !== -1) {
          state.library.playlists[idx] = data.playlist;
        }
        renderSidebarPlaylists();
        renderPlaylistView(playlistId);
        showToast('Đã xóa bài hát khỏi playlist');
      }
    } catch (err) {
      showToast('Không thể xóa bài hát khỏi playlist');
    }
  }

  // ==========================================
  // Import Playlist Logic (Apple Music / CSV / Text)
  // ==========================================
  let importSelectedTracks = [];
  let importParsedPlaylists = [];
  let isImporting = false;
  let importAbortController = null;

  function openImportModal() {
    el.modalImportPlaylist.style.display = 'flex';
    resetImportModal();
    el.inputImportName.focus();
  }

  function closeImportModal() {
    if (isImporting) {
      if (confirm('Quá trình nhập playlist đang diễn ra. Bạn có chắc muốn dừng lại?')) {
        if (importAbortController) {
          importAbortController.abort();
        }
        isImporting = false;
      } else {
        return;
      }
    }
    el.modalImportPlaylist.style.display = 'none';
    resetImportModal();
  }

  function resetImportModal() {
    importSelectedTracks = [];
    importParsedPlaylists = [];
    isImporting = false;
    importAbortController = null;

    el.inputImportName.value = '';
    el.inputImportDesc.value = '';
    el.inputImportFile.value = '';
    el.textareaImportText.value = '';
    el.textTracksPreview.textContent = 'Đã nhận diện: 0 bài';

    el.fileDropzone.style.display = 'flex';
    el.fileSelectedInfo.style.display = 'none';
    el.importPlaylistSelectGroup.style.display = 'none';
    el.selectImportPlaylist.innerHTML = '';
    el.importProgressBox.style.display = 'none';
    el.importProgressBar.style.width = '0%';
    el.importStatusText.textContent = 'Đang chuẩn bị...';
    el.importPercent.textContent = '0%';
    el.importStatMatched.textContent = '0';
    el.importStatFailed.textContent = '0';

    el.btnStartImport.disabled = false;
    el.btnStartImport.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      <span>Bắt đầu Import</span>
    `;

    switchImportTab('file');
  }

  function switchImportTab(tab) {
    el.tabBtnImportFile.classList.toggle('active', tab === 'file');
    el.tabBtnImportText.classList.toggle('active', tab === 'text');
    el.paneImportFile.style.display = tab === 'file' ? 'block' : 'none';
    el.paneImportText.style.display = tab === 'text' ? 'block' : 'none';
  }

  function handleFileSelected(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    processImportFile(file);
  }

  function clearSelectedFile() {
    el.inputImportFile.value = '';
    importSelectedTracks = [];
    importParsedPlaylists = [];
    el.fileDropzone.style.display = 'flex';
    el.fileSelectedInfo.style.display = 'none';
    el.importPlaylistSelectGroup.style.display = 'none';
    el.selectImportPlaylist.innerHTML = '';
  }

  function processImportFile(file) {
    const fileName = file.name;
    const baseName = fileName.replace(/\.[^/.]+$/, '');
    if (!el.inputImportName.value.trim()) {
      el.inputImportName.value = baseName;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target.result;
        if (fileName.toLowerCase().endsWith('.json')) {
          parseImportJson(content, baseName);
        } else if (fileName.toLowerCase().endsWith('.csv')) {
          parseImportCsv(content, baseName);
        } else {
          showToast('Định dạng file không hỗ trợ! Vui lòng chọn file .json hoặc .csv');
          return;
        }

        // Show file info
        el.importFileName.textContent = fileName;
        el.importFileTracksCount.textContent = `${importSelectedTracks.length} bài hát`;
        el.fileDropzone.style.display = 'none';
        el.fileSelectedInfo.style.display = 'flex';
      } catch (err) {
        showToast('Lỗi khi đọc file: ' + err.message);
      }
    };
    reader.onerror = () => showToast('Không thể đọc file');
    reader.readAsText(file);
  }

  function parseImportJson(jsonStr, defaultName) {
    const data = JSON.parse(jsonStr);
    importParsedPlaylists = [];

    if (data.playlists && Array.isArray(data.playlists)) {
      data.playlists.forEach((pl, idx) => {
        const plName = pl.name || `Playlist ${idx + 1}`;
        const tracks = extractTracksFromItems(pl.items || pl.tracks || pl.songs || []);
        if (tracks.length > 0) {
          importParsedPlaylists.push({ name: plName, tracks });
        }
      });
    } else if (data.Playlists && Array.isArray(data.Playlists)) {
      data.Playlists.forEach((pl, idx) => {
        const plName = pl.Name || `Playlist ${idx + 1}`;
        const tracks = extractTracksFromItems(pl.Tracks || pl.Items || pl.songs || []);
        if (tracks.length > 0) {
          importParsedPlaylists.push({ name: plName, tracks });
        }
      });
    } else if (Array.isArray(data)) {
      const tracks = extractTracksFromItems(data);
      importParsedPlaylists.push({ name: defaultName, tracks });
    } else if (data.tracks || data.items || data.songs) {
      const plName = data.name || data.title || defaultName;
      const tracks = extractTracksFromItems(data.tracks || data.items || data.songs);
      importParsedPlaylists.push({ name: plName, tracks });
    }

    if (importParsedPlaylists.length > 1) {
      el.selectImportPlaylist.innerHTML = '';
      importParsedPlaylists.forEach((pl, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = `${pl.name} (${pl.tracks.length} bài)`;
        el.selectImportPlaylist.appendChild(opt);
      });
      el.importPlaylistSelectGroup.style.display = 'block';
      el.selectImportPlaylist.onchange = () => {
        const selected = importParsedPlaylists[parseInt(el.selectImportPlaylist.value, 10)];
        if (selected) {
          importSelectedTracks = selected.tracks;
          el.inputImportName.value = selected.name;
          el.importFileTracksCount.textContent = `${selected.tracks.length} bài hát`;
        }
      };
      importSelectedTracks = importParsedPlaylists[0].tracks;
      el.inputImportName.value = importParsedPlaylists[0].name;
    } else if (importParsedPlaylists.length === 1) {
      importSelectedTracks = importParsedPlaylists[0].tracks;
      el.inputImportName.value = importParsedPlaylists[0].name;
      el.importPlaylistSelectGroup.style.display = 'none';
    } else {
      throw new Error('Không tìm thấy bài hát nào trong file JSON');
    }
  }

  function extractTracksFromItems(items) {
    if (!Array.isArray(items)) return [];
    return items.map(item => {
      if (typeof item === 'string') {
        return parseTrackString(item);
      }
      const title = item.name || item.title || item.trackName || item['Track Name'] || item['Song Name'] || '';
      const artist = item.artist || item.artistName || item['Artist Name'] || item.composer || item.performer || '';
      if (!title) return null;
      return { title: title.trim(), artist: artist.trim() };
    }).filter(Boolean);
  }

  function parseImportCsv(csvStr, defaultName) {
    const lines = csvStr.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) throw new Error('File CSV trống');

    function splitCsvLine(line) {
      const result = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          inQuotes = !inQuotes;
        } else if (c === ',' && !inQuotes) {
          result.push(cur.trim().replace(/^"|"$/g, ''));
          cur = '';
        } else {
          cur += c;
        }
      }
      result.push(cur.trim().replace(/^"|"$/g, ''));
      return result;
    }

    const header = splitCsvLine(lines[0]).map(h => h.toLowerCase());
    let titleIdx = header.findIndex(h => h.includes('track') || h.includes('title') || h.includes('name') || h.includes('song'));
    let artistIdx = header.findIndex(h => h.includes('artist') || h.includes('performer') || h.includes('creator'));

    const startIdx = (titleIdx !== -1 || artistIdx !== -1) ? 1 : 0;
    if (titleIdx === -1) titleIdx = 0;
    if (artistIdx === -1) artistIdx = 1;

    const tracks = [];
    for (let i = startIdx; i < lines.length; i++) {
      const cols = splitCsvLine(lines[i]);
      const title = cols[titleIdx] || '';
      const artist = cols[artistIdx] || '';
      if (title.trim()) {
        tracks.push({ title: title.trim(), artist: artist.trim() });
      }
    }

    if (tracks.length === 0) throw new Error('Không trích xuất được bài hát nào từ file CSV');
    importSelectedTracks = tracks;
    if (!el.inputImportName.value.trim()) {
      el.inputImportName.value = defaultName;
    }
  }

  function parseTrackString(str) {
    const s = str.trim();
    if (s.includes(' - ')) {
      const parts = s.split(' - ');
      return { title: parts[0].trim(), artist: parts.slice(1).join(' - ').trim() };
    } else if (s.includes(' – ')) {
      const parts = s.split(' – ');
      return { title: parts[0].trim(), artist: parts.slice(1).join(' – ').trim() };
    }
    return { title: s, artist: '' };
  }

  function updateTextImportPreview() {
    const text = el.textareaImportText.value;
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    el.textTracksPreview.textContent = `Đã nhận diện: ${lines.length} bài`;
  }

  async function handleStartImport() {
    if (isImporting) return;

    const name = el.inputImportName.value.trim();
    if (!name) {
      showToast('Vui lòng nhập tên Playlist!');
      el.inputImportName.focus();
      return;
    }

    const isFileTab = el.tabBtnImportFile.classList.contains('active');
    let tracksToImport = [];

    if (isFileTab) {
      tracksToImport = importSelectedTracks;
    } else {
      const rawText = el.textareaImportText.value;
      const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      tracksToImport = lines.map(parseTrackString);
    }

    if (tracksToImport.length === 0) {
      showToast(isFileTab ? 'Vui lòng chọn file .json hoặc .csv hợp lệ!' : 'Vui lòng nhập ít nhất một bài hát vào khung text!');
      return;
    }

    isImporting = true;
    el.btnStartImport.disabled = true;
    el.btnStartImport.innerHTML = `
      <div class="spinner" style="width: 16px; height: 16px; border-width: 2px;"></div>
      <span>Đang nhập...</span>
    `;

    el.importProgressBox.style.display = 'block';
    el.importProgressBar.style.width = '0%';
    el.importPercent.textContent = '0%';
    el.importStatusText.textContent = `Bắt đầu xử lý ${tracksToImport.length} bài hát...`;
    el.importStatMatched.textContent = '0';
    el.importStatFailed.textContent = '0';

    importAbortController = new AbortController();

    try {
      const response = await fetch('/api/library/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: el.inputImportDesc.value.trim(),
          tracks: tracksToImport
        }),
        signal: importAbortController.signal
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop();

        for (const ev of events) {
          const line = ev.trim();
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'progress') {
                const percent = Math.round((data.current / data.total) * 100);
                el.importProgressBar.style.width = `${percent}%`;
                el.importPercent.textContent = `${percent}%`;
                el.importStatusText.textContent = `Đang tìm [${data.current}/${data.total}]: ${data.trackLabel}`;
                el.importStatMatched.textContent = data.matchedCount;
                el.importStatFailed.textContent = data.failedCount;
              } else if (data.type === 'complete') {
                el.importProgressBar.style.width = '100%';
                el.importPercent.textContent = '100%';
                el.importStatusText.textContent = `Hoàn tất! Khớp ${data.matchedCount}/${tracksToImport.length} bài hát.`;
                showToast(`Đã tạo playlist "${data.playlist.name}" thành công! (${data.matchedCount} bài)`);

                state.library.playlists = data.playlists;
                renderSidebarPlaylists();

                setTimeout(() => {
                  closeImportModal();
                  renderPlaylistView(data.playlist.id);
                }, 1000);
                return;
              } else if (data.type === 'error') {
                showToast(`Lỗi nhập playlist: ${data.message}`);
              }
            } catch (jsonErr) {}
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        showToast('Đã dừng tiến trình import.');
      } else {
        showToast(`Lỗi trong quá trình import: ${err.message}`);
      }
    } finally {
      isImporting = false;
      el.btnStartImport.disabled = false;
      el.btnStartImport.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        <span>Bắt đầu Import</span>
      `;
    }
  }

  // ==========================================
  // Now Playing Overlay Controls
  // ==========================================
  function openNowPlaying() {
    state.isNowPlayingOpen = true;
    el.nowPlayingOverlay.classList.add('active');
  }

  function closeNowPlaying() {
    state.isNowPlayingOpen = false;
    el.nowPlayingOverlay.classList.remove('active');
  }

  function toggleNowPlaying() {
    if (state.isNowPlayingOpen) {
      closeNowPlaying();
    } else {
      openNowPlaying();
    }
  }

  function switchNowPlayingTab(tabName) {
    state.activeTab = tabName;
    el.tabBtnUpNext.classList.toggle('active', tabName === 'upnext');
    el.tabBtnLyrics.classList.toggle('active', tabName === 'lyrics');

    el.tabPaneUpNext.classList.toggle('active', tabName === 'upnext');
    el.tabPaneLyrics.classList.toggle('active', tabName === 'lyrics');
  }

  // ==========================================
  // Media Session API Setup
  // ==========================================
  function setupMediaSession() {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => {
        el.audio.play();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        el.audio.pause();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        playPreviousTrack();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        playNextTrack();
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime && el.audio.duration) {
          el.audio.currentTime = details.seekTime;
        }
      });
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const skip = details.seekOffset || 5;
        el.audio.currentTime = Math.max(el.audio.currentTime - skip, 0);
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const skip = details.seekOffset || 5;
        if (el.audio.duration) {
          el.audio.currentTime = Math.min(el.audio.currentTime + skip, el.audio.duration);
        }
      });
    }
  }

  function updateMediaSessionMetadata(song) {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title,
        artist: song.artist,
        album: song.album || 'BZusic',
        artwork: [
          { src: song.thumbnail || 'favicon.svg', sizes: '512x512', type: 'image/jpeg' }
        ]
      });
    }
  }

  // ==========================================
  // Keyboard Shortcuts
  // ==========================================
  function handleGlobalKeydown(e) {
    // Ignore keyboard shortcuts if focus is inside text input or textarea
    const tag = document.activeElement ? document.activeElement.tagName : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      if (e.key === 'Escape') {
        document.activeElement.blur();
      }
      return;
    }

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        togglePlayPause();
        break;

      case 'ArrowLeft':
        e.preventDefault();
        if (el.audio.currentTime !== undefined) {
          el.audio.currentTime = Math.max(0, el.audio.currentTime - 5);
          if (el.audio.duration) {
            const p = (el.audio.currentTime / el.audio.duration) * 100;
            el.seekSlider.value = p;
            updateSliderBackground(el.seekSlider, p);
          }
        }
        break;

      case 'ArrowRight':
        e.preventDefault();
        if (el.audio.duration) {
          el.audio.currentTime = Math.min(el.audio.duration, el.audio.currentTime + 5);
          const p = (el.audio.currentTime / el.audio.duration) * 100;
          el.seekSlider.value = p;
          updateSliderBackground(el.seekSlider, p);
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        state.volume = Math.min(1, state.volume + 0.1);
        el.audio.volume = state.volume;
        el.volumeSlider.value = state.volume;
        updateSliderBackground(el.volumeSlider, state.volume * 100);
        localStorage.setItem('bzmusic_volume', state.volume);
        updateVolumeIconUI(false);
        break;

      case 'ArrowDown':
        e.preventDefault();
        state.volume = Math.max(0, state.volume - 0.1);
        el.audio.volume = state.volume;
        el.volumeSlider.value = state.volume;
        updateSliderBackground(el.volumeSlider, state.volume * 100);
        localStorage.setItem('bzmusic_volume', state.volume);
        updateVolumeIconUI(state.volume === 0);
        break;

      case 'KeyM':
        toggleMute();
        break;

      case 'KeyL':
        toggleLikeCurrentTrack();
        break;

      case 'KeyJ':
        playPreviousTrack();
        break;

      case 'KeyK':
        playNextTrack();
        break;

      case 'KeyS':
        toggleShuffle();
        break;

      case 'KeyR':
        cycleRepeatMode();
        break;

      case 'Escape':
        if (state.isNowPlayingOpen) {
          closeNowPlaying();
        }
        closeCreatePlaylistModal();
        closeAddToPlaylistModal();
        break;
    }
  }

  // ==========================================
  // Toast Notifications
  // ==========================================
  function showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    el.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      toast.addEventListener('animationend', () => {
        toast.remove();
      });
    }, duration);
  }

  // ==========================================
  // Utilities
  // ==========================================
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();
