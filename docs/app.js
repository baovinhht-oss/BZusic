/**
 * BZusic - YouTube Music Inspired Web App
 * Frontend Core Engine
 */

(function () {
  'use strict';

  // ==========================================
  // Cloud Mode Detection
  // ==========================================
  const IS_CLOUD_MODE = Boolean(
    (typeof window !== 'undefined' && window.BZUSIC_CLOUD_BASE_URL) && (
      window.location.protocol === 'file:' ||
      window.location.hostname.includes('github.io') ||
      window.location.hostname.endsWith('.surge.sh') ||
      window.location.hostname.endsWith('.vercel.app') ||
      window.location.hostname.endsWith('.netlify.app') ||
      new URLSearchParams(window.location.search).get('cloud') === '1' ||
      (!['localhost', '127.0.0.1'].includes(window.location.hostname) && window.location.port !== '3000')
    )
  );

  // ==========================================
  // App State
  // ==========================================
  const state = {
    currentTrack: null,
    queue: [],
    originalQueue: [],
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
    lyricsAbortController: null,

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

    // Playlist view state (Apple Music Style)
    playlistFilterQuery: '',
    playlistSortMode: 'default',
    tempCoverData: null,

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

    // Playlist View Elements (Apple Music Style)
    el.currentPlaylistCoverWrap = document.getElementById('current-playlist-cover-wrap');
    el.currentPlaylistCover = document.getElementById('current-playlist-cover');
    el.currentPlaylistTitle = document.getElementById('current-playlist-title');
    el.currentPlaylistDesc = document.getElementById('current-playlist-desc');
    el.currentPlaylistMeta = document.getElementById('current-playlist-meta');
    el.btnEditPlaylistInline = document.getElementById('btn-edit-playlist-inline');
    el.btnPlayAllPlaylist = document.getElementById('btn-play-all-playlist');
    el.btnShuffleAllPlaylist = document.getElementById('btn-shuffle-all-playlist');
    el.btnPlaylistMore = document.getElementById('btn-playlist-more');
    el.playlistMoreDropdown = document.getElementById('playlist-more-dropdown');
    el.menuOptEditPlaylist = document.getElementById('menu-opt-edit-playlist');
    el.menuOptChangeCover = document.getElementById('menu-opt-change-cover');
    el.menuOptQueueAll = document.getElementById('menu-opt-queue-all');
    el.menuOptDeletePlaylist = document.getElementById('menu-opt-delete-playlist');
    el.playlistFilterInput = document.getElementById('playlist-filter-input');
    el.playlistFilterClear = document.getElementById('playlist-filter-clear');
    el.playlistFilterCount = document.getElementById('playlist-filter-count');
    el.playlistSortSelect = document.getElementById('playlist-sort-select');
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

    // Mobile Bottom Bar Controls
    el.playerMobileControls = document.getElementById('player-mobile-controls');
    el.btnMobilePlayPause = document.getElementById('btn-mobile-play-pause');
    el.iconMobilePlay = document.getElementById('icon-mobile-play');
    el.btnMobileNext = document.getElementById('btn-mobile-next');

    // Mobile Now Playing Controls
    el.npMobileControlsWrap = document.getElementById('np-mobile-controls-wrap');
    el.npMobileTimeCurrent = document.getElementById('np-mobile-time-current');
    el.npMobileTimeTotal = document.getElementById('np-mobile-time-total');
    el.npMobileSeekSlider = document.getElementById('np-mobile-seek-slider');
    el.btnNpShuffle = document.getElementById('btn-np-shuffle');
    el.btnNpPrev = document.getElementById('btn-np-prev');
    el.btnNpPlayPause = document.getElementById('btn-np-play-pause');
    el.iconNpPlayPause = document.getElementById('icon-np-play-pause');
    el.btnNpNext = document.getElementById('btn-np-next');
    el.btnNpRepeat = document.getElementById('btn-np-repeat');
    el.npRepeatBadge = document.getElementById('np-repeat-badge');

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

    // Modal: Edit Playlist Info
    el.modalEditPlaylist = document.getElementById('modal-edit-playlist');
    el.inputEditPlaylistName = document.getElementById('input-edit-playlist-name');
    el.inputEditPlaylistDesc = document.getElementById('input-edit-playlist-desc');
    el.btnCloseModalEdit = document.getElementById('btn-close-modal-edit');
    el.btnCancelModalEdit = document.getElementById('btn-cancel-modal-edit');
    el.btnSubmitModalEdit = document.getElementById('btn-submit-modal-edit');

    // Modal: Change Playlist Cover
    el.modalChangeCover = document.getElementById('modal-change-cover');
    el.btnCloseModalCover = document.getElementById('btn-close-modal-cover');
    el.btnCancelModalCover = document.getElementById('btn-cancel-modal-cover');
    el.btnSubmitModalCover = document.getElementById('btn-submit-modal-cover');
    el.coverModalPreviewImg = document.getElementById('cover-modal-preview-img');
    el.coverPreviewPlaceholder = document.getElementById('cover-preview-placeholder');
    el.tabCoverUpload = document.getElementById('tab-cover-upload');
    el.tabCoverUrl = document.getElementById('tab-cover-url');
    el.paneCoverUpload = document.getElementById('pane-cover-upload');
    el.paneCoverUrl = document.getElementById('pane-cover-url');
    el.inputCoverFile = document.getElementById('input-cover-file');
    el.btnBrowseCoverFile = document.getElementById('btn-browse-cover-file');
    el.inputCoverUrlVal = document.getElementById('input-cover-url-val');
    el.btnResetCoverCollage = document.getElementById('btn-reset-cover-collage');

    // Toast Container
    el.toastContainer = document.getElementById('toast-container');

    // Engine Badge
    el.localBadgeContainer = document.querySelector('.local-badge');
    el.localBadgeText = document.querySelector('.local-badge span:last-child');
    if (IS_CLOUD_MODE) {
      if (el.localBadgeText) el.localBadgeText.textContent = 'Cloud Ad-Free Engine';
      if (el.localBadgeContainer) el.localBadgeContainer.title = 'Cloud CDN & Supabase Storage, Ad-Free Engine';
    }
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
      el.greetingTitle.textContent = 'Good morning';
    } else if (hour >= 12 && hour < 18) {
      el.greetingTitle.textContent = 'Good afternoon';
    } else {
      el.greetingTitle.textContent = 'Good evening';
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

    // Search filter pills (All YouTube vs YouTube Music)
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
    const startSeeking = () => { state.isSeeking = true; };
    const stopSeeking = () => { state.isSeeking = false; };

    el.seekSlider.addEventListener('mousedown', startSeeking);
    el.seekSlider.addEventListener('touchstart', startSeeking, { passive: true });
    el.seekSlider.addEventListener('mouseup', stopSeeking);
    el.seekSlider.addEventListener('touchend', stopSeeking);
    el.seekSlider.addEventListener('touchcancel', stopSeeking);
    el.seekSlider.addEventListener('input', onSeekInput);
    el.seekSlider.addEventListener('change', onSeekChange);

    window.addEventListener('mouseup', stopSeeking);
    window.addEventListener('touchend', stopSeeking);
    window.addEventListener('touchcancel', stopSeeking);

    // Mobile Seek Slider inside Now Playing
    if (el.npMobileSeekSlider) {
      el.npMobileSeekSlider.addEventListener('mousedown', startSeeking);
      el.npMobileSeekSlider.addEventListener('touchstart', startSeeking, { passive: true });
      el.npMobileSeekSlider.addEventListener('mouseup', stopSeeking);
      el.npMobileSeekSlider.addEventListener('touchend', stopSeeking);
      el.npMobileSeekSlider.addEventListener('touchcancel', stopSeeking);
      el.npMobileSeekSlider.addEventListener('input', onSeekInput);
      el.npMobileSeekSlider.addEventListener('change', onSeekChange);
    }

    // Mobile Bottom Bar Quick Controls
    if (el.btnMobilePlayPause) {
      el.btnMobilePlayPause.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePlayPause();
      });
    }
    if (el.btnMobileNext) {
      el.btnMobileNext.addEventListener('click', (e) => {
        e.stopPropagation();
        playNextTrack();
      });
    }

    // Mobile Now Playing Controls
    if (el.btnNpShuffle) el.btnNpShuffle.addEventListener('click', toggleShuffle);
    if (el.btnNpPrev) el.btnNpPrev.addEventListener('click', playPreviousTrack);
    if (el.btnNpPlayPause) el.btnNpPlayPause.addEventListener('click', togglePlayPause);
    if (el.btnNpNext) el.btnNpNext.addEventListener('click', playNextTrack);
    if (el.btnNpRepeat) el.btnNpRepeat.addEventListener('click', cycleRepeatMode);

    // Volume Slider
    el.volumeSlider.addEventListener('input', onVolumeChange);
    el.btnVolumeToggle.addEventListener('click', toggleMute);

    // Now Playing Overlay Controls
    if (el.playerLeftTrigger) {
      el.playerLeftTrigger.addEventListener('click', (e) => {
        // Prevent toggle if clicking on the favorite button inside playerLeftTrigger
        if (e.target.closest('#btn-like-player')) {
          return;
        }
        toggleNowPlaying();
      });
    }

    if (el.btnToggleNowPlaying) {
      el.btnToggleNowPlaying.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleNowPlaying();
      });
    }

    if (el.topBtnNowPlaying) {
      el.topBtnNowPlaying.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleNowPlaying();
      });
    }

    if (el.btnCloseNowPlaying) {
      el.btnCloseNowPlaying.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeNowPlaying();
      });
    }

    // Direct event delegation fallback for Minimize button to guarantee click delivery
    document.addEventListener('click', (e) => {
      if (e.target.closest('#btn-close-now-playing')) {
        e.preventDefault();
        e.stopPropagation();
        closeNowPlaying();
      }
    });

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
        performSearch('Top Chill Hits');
      }
    });

    el.heroBtnHistory.addEventListener('click', () => switchView('history'));
    el.homeViewAllHistory.addEventListener('click', () => switchView('history'));

    // Liked & History view actions
    el.btnPlayAllLiked.addEventListener('click', () => {
      if (state.library.liked.length > 0) {
        playTracklist(state.library.liked, 0, false);
      } else {
        showToast('No favorite songs yet!');
      }
    });

    el.btnClearHistory.addEventListener('click', clearHistory);

    // Playlist view actions (Apple Music Style)
    if (el.btnPlayAllPlaylist) {
      el.btnPlayAllPlaylist.addEventListener('click', () => {
        const pl = state.library.playlists.find(p => p.id === state.activePlaylistId);
        if (pl && pl.songs.length > 0) {
          const list = getFilteredAndSortedPlaylistSongs();
          playTracklist(list.length > 0 ? list : pl.songs, 0, false);
        } else {
          showToast('Playlist is empty!');
        }
      });
    }

    if (el.btnShuffleAllPlaylist) {
      el.btnShuffleAllPlaylist.addEventListener('click', () => {
        const pl = state.library.playlists.find(p => p.id === state.activePlaylistId);
        if (pl && pl.songs.length > 0) {
          const list = getFilteredAndSortedPlaylistSongs();
          playTracklist(list.length > 0 ? list : pl.songs, 0, true);
        } else {
          showToast('Playlist is empty!');
        }
      });
    }

    if (el.currentPlaylistCoverWrap) {
      el.currentPlaylistCoverWrap.addEventListener('click', openChangeCoverModal);
    }
    if (el.btnEditPlaylistInline) {
      el.btnEditPlaylistInline.addEventListener('click', openEditPlaylistModal);
    }

    // Dropdown more menu
    if (el.btnPlaylistMore && el.playlistMoreDropdown) {
      el.btnPlaylistMore.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = el.playlistMoreDropdown.style.display === 'flex';
        el.playlistMoreDropdown.style.display = isOpen ? 'none' : 'flex';
      });

      document.addEventListener('click', (e) => {
        if (!e.target.closest('#playlist-more-menu-wrap')) {
          el.playlistMoreDropdown.style.display = 'none';
        }
      });
    }

    if (el.menuOptEditPlaylist) {
      el.menuOptEditPlaylist.addEventListener('click', () => {
        el.playlistMoreDropdown.style.display = 'none';
        openEditPlaylistModal();
      });
    }

    if (el.menuOptChangeCover) {
      el.menuOptChangeCover.addEventListener('click', () => {
        el.playlistMoreDropdown.style.display = 'none';
        openChangeCoverModal();
      });
    }

    if (el.menuOptQueueAll) {
      el.menuOptQueueAll.addEventListener('click', () => {
        el.playlistMoreDropdown.style.display = 'none';
        const pl = state.library.playlists.find(p => p.id === state.activePlaylistId);
        if (pl && pl.songs.length > 0) {
          state.queue.push(...pl.songs);
          renderQueueList();
          showToast(`Added ${pl.songs.length} song${pl.songs.length > 1 ? 's' : ''} to queue!`);
        } else {
          showToast('Playlist is empty!');
        }
      });
    }

    if (el.menuOptDeletePlaylist) {
      el.menuOptDeletePlaylist.addEventListener('click', () => {
        el.playlistMoreDropdown.style.display = 'none';
        deleteCurrentPlaylist();
      });
    }

    // Quick filter & sort events
    if (el.playlistFilterInput) {
      el.playlistFilterInput.addEventListener('input', () => {
        const q = el.playlistFilterInput.value.trim();
        state.playlistFilterQuery = q;
        if (el.playlistFilterClear) {
          el.playlistFilterClear.style.display = q ? 'block' : 'none';
        }
        renderPlaylistTracklist();
      });
    }

    if (el.playlistFilterClear) {
      el.playlistFilterClear.addEventListener('click', () => {
        el.playlistFilterInput.value = '';
        state.playlistFilterQuery = '';
        el.playlistFilterClear.style.display = 'none';
        el.playlistFilterInput.focus();
        renderPlaylistTracklist();
      });
    }

    if (el.playlistSortSelect) {
      el.playlistSortSelect.addEventListener('change', () => {
        state.playlistSortMode = el.playlistSortSelect.value;
        renderPlaylistTracklist();
      });
    }

    // Modal: Edit Playlist Events
    if (el.btnCloseModalEdit) el.btnCloseModalEdit.addEventListener('click', closeEditPlaylistModal);
    if (el.btnCancelModalEdit) el.btnCancelModalEdit.addEventListener('click', closeEditPlaylistModal);
    if (el.btnSubmitModalEdit) el.btnSubmitModalEdit.addEventListener('click', submitEditPlaylist);

    // Modal: Change Cover Events
    if (el.btnCloseModalCover) el.btnCloseModalCover.addEventListener('click', closeChangeCoverModal);
    if (el.btnCancelModalCover) el.btnCancelModalCover.addEventListener('click', closeChangeCoverModal);
    if (el.btnSubmitModalCover) el.btnSubmitModalCover.addEventListener('click', submitChangeCover);
    if (el.tabCoverUpload && el.tabCoverUrl) {
      el.tabCoverUpload.addEventListener('click', () => switchCoverTab('upload'));
      el.tabCoverUrl.addEventListener('click', () => switchCoverTab('url'));
    }
    if (el.btnBrowseCoverFile && el.inputCoverFile) {
      el.btnBrowseCoverFile.addEventListener('click', () => el.inputCoverFile.click());
      el.inputCoverFile.addEventListener('change', handleCoverFileSelected);
    }
    if (el.inputCoverUrlVal) {
      el.inputCoverUrlVal.addEventListener('input', () => {
        const url = el.inputCoverUrlVal.value.trim();
        state.tempCoverData = url || null;
        updateCoverModalPreview(state.tempCoverData);
      });
    }
    if (el.btnResetCoverCollage) {
      el.btnResetCoverCollage.addEventListener('click', () => {
        state.tempCoverData = null;
        el.inputCoverUrlVal.value = '';
        el.inputCoverFile.value = '';
        updateCoverModalPreview(null);
        showToast('Selected: 2x2 Smart Collage (click "Save Cover" to apply)');
      });
    }

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
    if (IS_CLOUD_MODE) {
      // 1. Instant load from local storage cache
      try {
        const cached = localStorage.getItem('bzmusic_cloud_library');
        if (cached) {
          state.library = JSON.parse(cached);
          updateLikedBadge();
        }
      } catch (e) {
        console.warn('[Cloud Mode] Error reading cached library:', e);
      }

      // 2. Fetch fresh library from Supabase Storage
      try {
        if (window.BZUSIC_CLOUD_BASE_URL) {
          const res = await fetch(`${window.BZUSIC_CLOUD_BASE_URL}/library.json?t=${Date.now()}`);
          if (res.ok) {
            const cloudData = await res.json();
            const localLiked = state.library.liked || [];
            const localHistory = state.library.history || [];
            const localPlaylists = state.library.playlists || [];

            const mergedLiked = [...(cloudData.liked || [])];
            const cloudLikedIds = new Set(mergedLiked.map(s => s.videoId));
            localLiked.forEach(s => {
              if (s && s.videoId && !cloudLikedIds.has(s.videoId)) mergedLiked.push(s);
            });

            const mergedPlaylists = (cloudData.playlists || []).map(pl => {
              const localPl = localPlaylists.find(p => p.id === pl.id);
              return localPl || pl;
            });
            const cloudPlIds = new Set(mergedPlaylists.map(p => p.id));
            localPlaylists.forEach(pl => {
              if (pl && pl.id && !cloudPlIds.has(pl.id)) mergedPlaylists.push(pl);
            });

            state.library = {
              liked: mergedLiked,
              playlists: mergedPlaylists,
              history: localHistory.length > 0 ? localHistory : (cloudData.history || [])
            };

            try {
              localStorage.setItem('bzmusic_cloud_library', JSON.stringify(state.library));
            } catch (e) {}
            updateLikedBadge();
          }
        }
      } catch (err) {
        console.warn('[Cloud Mode] Error fetching cloud library.json:', err);
      }
      return;
    }

    try {
      const res = await fetch('/api/library');
      if (res.ok) {
        state.library = await res.json();
        updateLikedBadge();
      }
    } catch (err) {
      console.error('Error loading library:', err);
    }
  }

  function updateLikedBadge() {
    const count = state.library.liked.length;
    el.likedCountBadge.textContent = count;
    el.likedMetaInfo.textContent = `${count} ${count === 1 ? 'song' : 'songs'} • ${IS_CLOUD_MODE ? 'Cloud Storage' : 'Local Storage'}`;
  }

  async function toggleLike(song) {
    if (!song || !song.videoId) return;

    if (IS_CLOUD_MODE) {
      if (!state.library.liked) state.library.liked = [];
      const idx = state.library.liked.findIndex(s => s.videoId === song.videoId);
      let isLiked = false;
      if (idx !== -1) {
        state.library.liked.splice(idx, 1);
        isLiked = false;
      } else {
        const enrichedSong = {
          ...song,
          audioUrl: song.audioUrl || (window.BZUSIC_CLOUD_BASE_URL ? `${window.BZUSIC_CLOUD_BASE_URL}/audio/${song.videoId}.m4a` : ''),
          lyricsUrl: song.lyricsUrl || (window.BZUSIC_CLOUD_BASE_URL ? `${window.BZUSIC_CLOUD_BASE_URL}/lyrics/${song.videoId}.lrc` : '')
        };
        state.library.liked.unshift(enrichedSong);
        isLiked = true;
      }

      try {
        localStorage.setItem('bzmusic_cloud_library', JSON.stringify(state.library));
      } catch (e) {}

      updateLikedBadge();

      const isCurrent = state.currentTrack && state.currentTrack.videoId === song.videoId;
      if (isCurrent) {
        updateLikeButtonUI(isLiked);
      }

      if (state.currentView === 'liked') {
        renderLikedSongsView();
      }

      showToast(isLiked ? 'Added to Favorites ❤️' : 'Removed from Favorites');
      return;
    }

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

        showToast(data.liked ? 'Added to Favorites ❤️' : 'Removed from Favorites');
      }
    } catch (err) {
      showToast('Unable to update Favorites');
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
      if (IS_CLOUD_MODE) {
        if (!state.library.history) state.library.history = [];
        state.library.history = state.library.history.filter(s => s.videoId !== song.videoId);
        const enrichedSong = {
          ...song,
          audioUrl: song.audioUrl || (window.BZUSIC_CLOUD_BASE_URL ? `${window.BZUSIC_CLOUD_BASE_URL}/audio/${song.videoId}.m4a` : ''),
          lyricsUrl: song.lyricsUrl || (window.BZUSIC_CLOUD_BASE_URL ? `${window.BZUSIC_CLOUD_BASE_URL}/lyrics/${song.videoId}.lrc` : ''),
          playedAt: new Date().toISOString()
        };
        state.library.history.unshift(enrichedSong);
        if (state.library.history.length > 100) {
          state.library.history = state.library.history.slice(0, 100);
        }
        try {
          localStorage.setItem('bzmusic_cloud_library', JSON.stringify(state.library));
        } catch (e) {}

        if (state.currentView === 'history') {
          renderHistoryView();
        }
        renderHomeHistoryPreview();
        return;
      }

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
    if (!confirm('Are you sure you want to clear your entire listening history?')) return;

    if (IS_CLOUD_MODE) {
      state.library.history = [];
      try {
        localStorage.setItem('bzmusic_cloud_library', JSON.stringify(state.library));
      } catch (e) {}
      renderHistoryView();
      renderHomeHistoryPreview();
      showToast('Listening history cleared');
      return;
    }

    try {
      const res = await fetch('/api/library/history', { method: 'DELETE' });
      if (res.ok) {
        state.library.history = [];
        renderHistoryView();
        renderHomeHistoryPreview();
        showToast('Listening history cleared');
      }
    } catch (err) {
      showToast('Unable to clear history');
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
      state.originalQueue = [...newQueue];
      state.queueIndex = indexInQueue >= 0 ? indexInQueue : state.queue.findIndex(s => s.videoId === song.videoId);
      if (state.queueIndex === -1) {
        state.queue.unshift(song);
        state.originalQueue.unshift(song);
        state.queueIndex = 0;
      }
      if (state.isShuffle && state.queue.length > 1) {
        const curIdx = state.queueIndex;
        const before = state.queue.slice(0, curIdx + 1);
        const after = state.queue.slice(curIdx + 1);
        for (let i = after.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [after[i], after[j]] = [after[j], after[i]];
        }
        state.queue = [...before, ...after];
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
    if (el.npMobileSeekSlider) {
      el.npMobileSeekSlider.value = 0;
      updateSliderBackground(el.npMobileSeekSlider, 0);
    }
    if (el.npMobileTimeCurrent) el.npMobileTimeCurrent.textContent = '0:00';

    updatePlayerUI(song);
    updateLikeButtonUI(isSongLiked(song.videoId));
    updateMediaSessionMetadata(song);
    updateAmbientGlow(song.thumbnail, song.videoId);

    // Set Audio Source to proxy endpoint or Cloud Storage
    const streamUrl = (IS_CLOUD_MODE || song.audioUrl)
      ? (song.audioUrl || (window.BZUSIC_CLOUD_BASE_URL ? `${window.BZUSIC_CLOUD_BASE_URL}/audio/${song.videoId}.m4a` : `/api/stream/${song.videoId}`))
      : `/api/stream/${song.videoId}`;
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
    fetchLyrics(song.title, song.artist, song.videoId);

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
    } else {
      state.isShuffle = false;
      el.btnShuffle.classList.remove('active');
    }

    playSong(listToPlay[startIdx], listToPlay, startIdx);
  }

  function togglePlayPause() {
    // If an error skip was scheduled, cancel it immediately when user interacts
    if (state.errorSkipTimer) {
      clearTimeout(state.errorSkipTimer);
      state.errorSkipTimer = null;
      showToast('Automatic skip paused');
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
        showToast('End of queue reached');
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
    if (el.btnNpShuffle) el.btnNpShuffle.classList.toggle('active', state.isShuffle);

    if (state.isShuffle) {
      // Save snapshot of original queue
      state.originalQueue = [...state.queue];
      if (state.queue.length > 1) {
        const curIdx = state.queueIndex >= 0 ? state.queueIndex : 0;
        const before = state.queue.slice(0, curIdx + 1);
        const after = state.queue.slice(curIdx + 1);
        // Fisher-Yates shuffle on tracks after current song
        for (let i = after.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [after[i], after[j]] = [after[j], after[i]];
        }
        state.queue = [...before, ...after];
        renderQueueList();
      }
    } else {
      // Restore original queue order while preserving current track
      if (state.originalQueue && state.originalQueue.length > 0) {
        const currentSong = state.currentTrack;
        state.queue = [...state.originalQueue];
        if (currentSong) {
          const newIdx = state.queue.findIndex(s => s.videoId === currentSong.videoId);
          if (newIdx !== -1) {
            state.queueIndex = newIdx;
          }
        }
        renderQueueList();
      }
    }

    showToast(state.isShuffle ? 'Shuffle on' : 'Shuffle off');
  }

  function cycleRepeatMode() {
    if (state.repeatMode === 'off') {
      state.repeatMode = 'all';
      el.btnRepeat.classList.add('active');
      el.repeatOneBadge.style.display = 'none';
      if (el.btnNpRepeat) el.btnNpRepeat.classList.add('active');
      if (el.npRepeatBadge) el.npRepeatBadge.style.display = 'none';
      showToast('Repeat all');
    } else if (state.repeatMode === 'all') {
      state.repeatMode = 'one';
      el.btnRepeat.classList.add('active');
      el.repeatOneBadge.style.display = 'block';
      if (el.btnNpRepeat) el.btnNpRepeat.classList.add('active');
      if (el.npRepeatBadge) el.npRepeatBadge.style.display = 'block';
      showToast('Repeat one');
    } else {
      state.repeatMode = 'off';
      el.btnRepeat.classList.remove('active');
      el.repeatOneBadge.style.display = 'none';
      if (el.btnNpRepeat) el.btnNpRepeat.classList.remove('active');
      if (el.npRepeatBadge) el.npRepeatBadge.style.display = 'none';
      showToast('Repeat off');
    }
  }

  async function fetchAndAppendUpNext(videoId, autoPlayImmediately = false) {
    if (IS_CLOUD_MODE) {
      const currentIds = new Set(state.queue.map(s => s.videoId));
      const pool = [];
      const addPool = (list) => {
        (list || []).forEach(s => {
          if (s && s.videoId && !currentIds.has(s.videoId)) {
            pool.push(s);
            currentIds.add(s.videoId);
          }
        });
      };
      (state.library.playlists || []).forEach(pl => addPool(pl.songs));
      addPool(state.library.liked);
      addPool(state.library.history);

      if (pool.length > 0) {
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        const recommendations = pool.slice(0, 5);
        state.queue.push(...recommendations);
        renderQueueList();

        if (autoPlayImmediately && state.queueIndex < state.queue.length - 1) {
          state.queueIndex++;
          playSong(state.queue[state.queueIndex]);
        }
      }
      return;
    }

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
      console.warn('Unable to load Up Next recommendations:', err);
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
    if (state.isNowPlayingOpen && state.activeTab === 'lyrics') {
      startKaraokeLoop();
    }
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
      // Stop player after 3 consecutive errors
      if (state.errorSkipTimer) {
        clearTimeout(state.errorSkipTimer);
        state.errorSkipTimer = null;
      }
      el.audio.pause();
      state.isPlaying = false;
      updatePlayPauseButtonUI(false);
      updateDocumentTitle('', '', false);
      showToast('⚠️ Playback stopped: Encountered 3 consecutive track errors. Please check your network or try another song.', 6000);
      return;
    }

    showToast(`Unable to stream this track (${state.consecutiveErrors}/3). Skipping to next track in 1.5s...`);
    
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

    const formattedCurrent = formatTime(current);
    el.currentTime.textContent = formattedCurrent;
    if (el.npMobileTimeCurrent) el.npMobileTimeCurrent.textContent = formattedCurrent;

    if (duration > 0) {
      const formattedTotal = formatTime(duration);
      el.totalDuration.textContent = formattedTotal;
      if (el.npMobileTimeTotal) el.npMobileTimeTotal.textContent = formattedTotal;

      const progressPercent = (current / duration) * 100;
      el.seekSlider.value = progressPercent;
      updateSliderBackground(el.seekSlider, progressPercent);

      if (el.npMobileSeekSlider) {
        el.npMobileSeekSlider.value = progressPercent;
        updateSliderBackground(el.npMobileSeekSlider, progressPercent);
      }
    }

    // Sync Lyrics line tracking
    syncLyricsTime(current);
  }

  function onSeekInput(e) {
    const slider = (e && e.target) ? e.target : el.seekSlider;
    const val = parseFloat(slider.value);
    el.seekSlider.value = val;
    updateSliderBackground(el.seekSlider, val);

    if (el.npMobileSeekSlider) {
      el.npMobileSeekSlider.value = val;
      updateSliderBackground(el.npMobileSeekSlider, val);
    }

    if (el.audio.duration) {
      const formatted = formatTime((val / 100) * el.audio.duration);
      el.currentTime.textContent = formatted;
      if (el.npMobileTimeCurrent) el.npMobileTimeCurrent.textContent = formatted;
    }
  }

  function onSeekChange(e) {
    state.isSeeking = false;
    const slider = (e && e.target) ? e.target : el.seekSlider;
    const val = parseFloat(slider.value);
    el.seekSlider.value = val;
    updateSliderBackground(el.seekSlider, val);

    if (el.npMobileSeekSlider) {
      el.npMobileSeekSlider.value = val;
      updateSliderBackground(el.npMobileSeekSlider, val);
    }

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
      if (el.playIcon) el.playIcon.style.display = 'none';
      if (el.pauseIcon) el.pauseIcon.style.display = 'block';
      if (el.iconMobilePlay) {
        el.iconMobilePlay.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
      }
      if (el.iconNpPlayPause) {
        el.iconNpPlayPause.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
      }
    } else {
      if (el.playIcon) el.playIcon.style.display = 'block';
      if (el.pauseIcon) el.pauseIcon.style.display = 'none';
      if (el.iconMobilePlay) {
        el.iconMobilePlay.innerHTML = '<path d="M8 5v14l11-7z"/>';
      }
      if (el.iconNpPlayPause) {
        el.iconNpPlayPause.innerHTML = '<path d="M8 5v14l11-7z"/>';
      }
    }
  }

  function updateDocumentTitle(title, artist, playing) {
    if (playing && title) {
      document.title = `▶ ${title} - ${artist} | BZusic`;
    } else {
      document.title = 'BZusic';
    }
  }

  function updateActiveSongRowHighlight(videoId) {
    document.querySelectorAll('.song-row').forEach(row => {
      const isThis = row.dataset.videoId === videoId;
      row.classList.toggle('playing', isThis);
    });
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

    // Update active row highlight across visible tables
    updateActiveSongRowHighlight(song.videoId);
  }

  // ==========================================
  // Ambient Glow Effect
  // ==========================================
  function updateAmbientGlow(thumbnailUrl, videoId) {
    if (!thumbnailUrl) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = thumbnailUrl;

    img.onload = () => {
      // Prevent race conditions when skipping songs rapidly
      if (videoId && state.currentTrack?.videoId !== videoId) return;

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
      if (videoId && state.currentTrack?.videoId !== videoId) return;
      el.ambientGlow.style.background = `radial-gradient(circle, rgba(255, 46, 46, 0.4) 0%, rgba(3, 3, 3, 0) 75%)`;
    };
  }

  // ==========================================
  // Lyrics Engine (Synced & Plain)
  // ==========================================
  async function fetchLyrics(title, artist, videoId) {
    if (state.lyricsAbortController) {
      try { state.lyricsAbortController.abort(); } catch (e) {}
    }
    state.lyricsAbortController = new AbortController();
    const signal = state.lyricsAbortController.signal;

    state.lyrics = null;
    state.activeLyricIndex = -1;
    el.lyricsContainer.innerHTML = '';
    el.lyricsEmpty.style.display = 'none';
    el.lyricsLoading.style.display = 'flex';

    if (IS_CLOUD_MODE) {
      try {
        // 1. Try fetching synced .lrc from Supabase Storage
        if (window.BZUSIC_CLOUD_BASE_URL && videoId) {
          try {
            const storageRes = await fetch(`${window.BZUSIC_CLOUD_BASE_URL}/lyrics/${videoId}.lrc`, { signal });
            if (storageRes.ok) {
              const lrcText = await storageRes.text();
              if (videoId && state.currentTrack?.videoId !== videoId) return;
              if (lrcText && lrcText.trim()) {
                el.lyricsLoading.style.display = 'none';
                const lines = parseLrc(lrcText);
                if (lines.length > 0) {
                  state.lyrics = { type: 'synced', lines };
                  renderSyncedLyrics(lines);
                  if (state.isNowPlayingOpen && state.activeTab === 'lyrics' && !el.audio.paused) {
                    startKaraokeLoop();
                  }
                  return;
                } else {
                  state.lyrics = { type: 'plain', text: lrcText };
                  renderPlainLyrics(lrcText);
                  return;
                }
              }
            }
          } catch (e) {
            if (e.name === 'AbortError') return;
          }
        }

        // 2. Direct client fallback from LRCLIB (CORS-enabled)
        const cleanTitle = (title || '').replace(/\([^)]*\)|\[[^\]]*\]/g, '').trim();
        const cleanArtist = (artist || '').split(/[,&xX]/)[0].trim();
        const lrcUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}`;
        const lrclibRes = await fetch(lrcUrl, { signal });

        if (videoId && state.currentTrack?.videoId !== videoId) return;
        el.lyricsLoading.style.display = 'none';

        if (lrclibRes.ok) {
          const data = await lrclibRes.json();
          if (videoId && state.currentTrack?.videoId !== videoId) return;

          if (data.syncedLyrics) {
            const lines = parseLrc(data.syncedLyrics);
            if (lines.length > 0) {
              state.lyrics = { type: 'synced', lines };
              renderSyncedLyrics(lines);
              if (state.isNowPlayingOpen && state.activeTab === 'lyrics' && !el.audio.paused) {
                startKaraokeLoop();
              }
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
        if (err.name === 'AbortError') return;
        if (videoId && state.currentTrack?.videoId !== videoId) return;
        el.lyricsLoading.style.display = 'none';
        el.lyricsEmpty.style.display = 'flex';
      }
      return;
    }

    try {
      const res = await fetch(`/api/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`, { signal });
      if (videoId && state.currentTrack?.videoId !== videoId) return;

      el.lyricsLoading.style.display = 'none';

      if (res.ok) {
        const data = await res.json();
        if (videoId && state.currentTrack?.videoId !== videoId) return;

        if (data.syncedLyrics) {
          const lines = parseLrc(data.syncedLyrics);
          if (lines.length > 0) {
            state.lyrics = { type: 'synced', lines };
            renderSyncedLyrics(lines);
            if (state.isNowPlayingOpen && state.activeTab === 'lyrics' && !el.audio.paused) {
              startKaraokeLoop();
            }
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
      if (err.name === 'AbortError') return;
      if (videoId && state.currentTrack?.videoId !== videoId) return;
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
          // Auto scroll to center if user is not actively scrolling (contained inside lyricsWrapper)
          if (!state.isUserScrollingLyrics && el.lyricsWrapper) {
            const wrapperRect = el.lyricsWrapper.getBoundingClientRect();
            const elemRect = elem.getBoundingClientRect();
            const relativeTop = elemRect.top - wrapperRect.top + el.lyricsWrapper.scrollTop;
            const targetScroll = relativeTop - (el.lyricsWrapper.clientHeight / 2) + (elem.clientHeight / 2);
            el.lyricsWrapper.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
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
    if (!state.isNowPlayingOpen || state.activeTab !== 'lyrics') {
      state.karaokeRafId = null;
      return;
    }
    function loop() {
      if (!el.audio.paused && state.lyrics && state.lyrics.type === 'synced' && state.isNowPlayingOpen && state.activeTab === 'lyrics') {
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
      el.npQueueList.innerHTML = '<div class="search-empty"><p>Queue is empty</p></div>';
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
    const modeLabel = state.searchMode === 'all' ? 'All YouTube' : 'YouTube Music';
    el.searchSubtitle.textContent = `Results for "${query}" (${IS_CLOUD_MODE ? 'Cloud Library' : modeLabel})`;
    el.searchResultsList.innerHTML = '';
    el.searchEmpty.style.display = 'none';
    el.searchLoading.style.display = 'flex';

    if (IS_CLOUD_MODE) {
      el.searchLoading.style.display = 'none';
      const q = query.toLowerCase().trim();
      const songMap = new Map();

      const collectMatches = (list) => {
        (list || []).forEach(s => {
          if (!s || !s.videoId || songMap.has(s.videoId)) return;
          const title = (s.title || '').toLowerCase();
          const artist = (s.artist || '').toLowerCase();
          const album = (s.album || '').toLowerCase();
          if (title.includes(q) || artist.includes(q) || album.includes(q)) {
            songMap.set(s.videoId, s);
          }
        });
      };

      (state.library.playlists || []).forEach(pl => collectMatches(pl.songs));
      collectMatches(state.library.liked);
      collectMatches(state.library.history);

      const results = Array.from(songMap.values());
      if (results.length > 0) {
        renderSongRows(el.searchResultsList, results, (song, idx) => {
          playSong(song, results, idx);
        });
      } else {
        el.searchEmpty.style.display = 'flex';
      }
      return;
    }

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

    // Automatically close Now Playing overlay when switching views
    if (state.isNowPlayingOpen) {
      closeNowPlaying();
    }

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

  // Helper to parse "m:ss" or "hh:mm:ss" or seconds number to seconds
  function parseDurationToSeconds(str) {
    if (!str) return 0;
    if (typeof str === 'number') return str;
    const parts = str.toString().trim().split(':').map(Number);
    if (parts.some(isNaN)) return 0;
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 1) {
      return parts[0];
    }
    return 0;
  }

  // Helper to format total seconds to human-readable string (e.g. "1 hr 25 min" or "48 min")
  function formatPlaylistDuration(totalSec) {
    if (!totalSec || totalSec <= 0) return '0 min';
    if (totalSec >= 3600) {
      const hours = Math.floor(totalSec / 3600);
      const mins = Math.round((totalSec % 3600) / 60);
      return `${hours} hr${mins > 0 ? ' ' + mins + ' min' : ''}`;
    }
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    if (mins > 0) {
      return `${mins} min${secs > 0 ? ' ' + secs + ' sec' : ''}`;
    }
    return `${secs} sec`;
  }

  // Render 2x2 collage or custom cover or single image or placeholder
  function renderCollageOrFallbackHTML(playlist) {
    if (!playlist) {
      return `
        <div class="playlist-cover-placeholder">
          <svg viewBox="0 0 24 24" width="60" height="60" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.6"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
        </div>
      `;
    }
    if (playlist.coverUrl) {
      return `<img class="cover-full-img" src="${escapeHtml(playlist.coverUrl)}" alt="${escapeHtml(playlist.name)}" />`;
    }
    const songs = playlist.songs || [];
    if (songs.length >= 4) {
      return `
        <div class="collage-grid">
          <img src="${escapeHtml(songs[0].thumbnail || 'favicon.svg')}" alt="" />
          <img src="${escapeHtml(songs[1].thumbnail || 'favicon.svg')}" alt="" />
          <img src="${escapeHtml(songs[2].thumbnail || 'favicon.svg')}" alt="" />
          <img src="${escapeHtml(songs[3].thumbnail || 'favicon.svg')}" alt="" />
        </div>
      `;
    }
    if (songs.length > 0 && songs[0].thumbnail) {
      return `<img class="cover-full-img" src="${escapeHtml(songs[0].thumbnail)}" alt="${escapeHtml(playlist.name)}" />`;
    }
    return `
      <div class="playlist-cover-placeholder">
        <svg viewBox="0 0 24 24" width="60" height="60" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.6"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
      </div>
    `;
  }

  function renderPlaylistCover(playlist) {
    if (!el.currentPlaylistCover) return;
    el.currentPlaylistCover.innerHTML = renderCollageOrFallbackHTML(playlist);
  }

  function getFilteredAndSortedPlaylistSongs() {
    const pl = state.library.playlists.find(p => p.id === state.activePlaylistId);
    if (!pl || !pl.songs) return [];

    let list = [...pl.songs];
    const q = (state.playlistFilterQuery || '').toLowerCase().trim();
    if (q) {
      list = list.filter(song => {
        const t = (song.title || '').toLowerCase();
        const a = (song.artist || '').toLowerCase();
        const alb = (song.album || '').toLowerCase();
        return t.includes(q) || a.includes(q) || alb.includes(q);
      });
    }

    switch (state.playlistSortMode) {
      case 'title_asc':
        list.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'en', { sensitivity: 'base' }));
        break;
      case 'title_desc':
        list.sort((a, b) => (b.title || '').localeCompare(a.title || '', 'en', { sensitivity: 'base' }));
        break;
      case 'artist_asc':
        list.sort((a, b) => (a.artist || '').localeCompare(b.artist || '', 'en', { sensitivity: 'base' }));
        break;
      case 'duration_desc':
        list.sort((a, b) => parseDurationToSeconds(b.duration) - parseDurationToSeconds(a.duration));
        break;
      case 'duration_asc':
        list.sort((a, b) => parseDurationToSeconds(a.duration) - parseDurationToSeconds(b.duration));
        break;
      case 'default':
      default:
        // Keep original playlist order
        break;
    }

    return list;
  }

  function renderPlaylistTracklist() {
    const songs = getFilteredAndSortedPlaylistSongs();
    const pl = state.library.playlists.find(p => p.id === state.activePlaylistId);
    const totalCount = pl ? pl.songs.length : 0;

    if (el.playlistFilterCount) {
      if (state.playlistFilterQuery) {
        el.playlistFilterCount.textContent = `Showing ${songs.length} of ${totalCount} songs`;
        el.playlistFilterCount.style.display = 'block';
      } else {
        el.playlistFilterCount.style.display = 'none';
      }
    }

    renderSongRows(el.playlistSongsList, songs, (song, idx) => {
      playSong(song, songs, idx);
    }, {
      showRemove: true,
      onRemove: (song) => removeSongFromPlaylist(state.activePlaylistId, song.videoId)
    });
  }

  function renderPlaylistView(playlistId) {
    const playlist = state.library.playlists.find(p => p.id === playlistId);
    if (!playlist) return;

    state.activePlaylistId = playlistId;
    switchView('playlist');

    // Reset toolbar filter input on view load
    state.playlistFilterQuery = '';
    if (el.playlistFilterInput) el.playlistFilterInput.value = '';
    if (el.playlistFilterClear) el.playlistFilterClear.style.display = 'none';

    el.currentPlaylistTitle.textContent = playlist.name;
    el.currentPlaylistDesc.textContent = playlist.description || 'Your personal playlist';

    // Calculate total duration
    const totalSec = (playlist.songs || []).reduce((acc, s) => acc + parseDurationToSeconds(s.duration), 0);
    const durFormatted = formatPlaylistDuration(totalSec);
    const songCount = (playlist.songs || []).length;
    el.currentPlaylistMeta.textContent = `${songCount} ${songCount === 1 ? 'song' : 'songs'} • ${durFormatted}`;

    // Render 2x2 collage or custom cover
    renderPlaylistCover(playlist);

    // Render tracklist with sort & filter
    renderPlaylistTracklist();
  }

  function renderHomeFeatured() {
    // Initial featured top songs (liked or default picks)
    const featured = state.library.liked.length >= 4 ? state.library.liked : [
      {
        videoId: '4NRXx6U8ABQ',
        title: 'Blinding Lights',
        artist: 'The Weeknd',
        album: 'After Hours',
        thumbnail: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg',
        duration: '3:20'
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
        videoId: '34Na4j8AVgA',
        title: 'Starboy (feat. Daft Punk)',
        artist: 'The Weeknd',
        album: 'Starboy',
        thumbnail: 'https://i.ytimg.com/vi/34Na4j8AVgA/hqdefault.jpg',
        duration: '3:50'
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
          <button class="song-card-play-btn" title="Play">
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
      container.innerHTML = '<div class="search-empty"><p>No songs found here.</p></div>';
      return;
    }

    const frag = document.createDocumentFragment();

    songs.forEach((song, idx) => {
      const isCurrent = state.currentTrack && state.currentTrack.videoId === song.videoId;
      const row = document.createElement('div');
      row.className = `song-row ${isCurrent ? 'playing' : ''}`;
      row.dataset.videoId = song.videoId;

      row.innerHTML = `
        <div class="song-row-idx">
          <span class="row-num">${idx + 1}</span>
          <span class="row-play-icon" title="Play">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </span>
          <div class="row-equalizer" title="Now Playing">
            <span class="eq-col eq-1"></span>
            <span class="eq-col eq-2"></span>
            <span class="eq-col eq-3"></span>
          </div>
        </div>
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
        <div class="song-row-album" title="${escapeHtml(song.album || '')}">${escapeHtml(song.album || '-')}</div>
        <div class="song-row-duration">${song.duration || '0:00'}</div>
        <div class="song-row-actions">
          <button class="icon-btn btn-row-like" title="Favorite">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="${isSongLiked(song.videoId) ? '#ff2e2e' : 'none'}" stroke="${isSongLiked(song.videoId) ? '#ff2e2e' : 'currentColor'}" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          </button>
          <button class="icon-btn btn-row-add-pl" title="Add to Playlist">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z"/></svg>
          </button>
          ${options.showRemove ? `
            <button class="icon-btn btn-row-remove" title="Remove from playlist" style="color: #fa233b;">
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
      btnLike.addEventListener('click', async (e) => {
        e.stopPropagation();
        await toggleLike(song);
        const liked = isSongLiked(song.videoId);
        const svg = btnLike.querySelector('svg');
        if (svg) {
          svg.setAttribute('fill', liked ? '#ff2e2e' : 'none');
          svg.setAttribute('stroke', liked ? '#ff2e2e' : 'currentColor');
        }
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
        if (state.isNowPlayingOpen) {
          closeNowPlaying();
        }
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
      showToast('Please enter a playlist name');
      el.inputPlaylistName.focus();
      return;
    }

    if (IS_CLOUD_MODE) {
      const newPl = {
        id: 'pl_' + Date.now(),
        name,
        description: desc,
        coverUrl: '',
        songs: [],
        createdAt: new Date().toISOString()
      };
      if (!state.library.playlists) state.library.playlists = [];
      state.library.playlists.unshift(newPl);
      try {
        localStorage.setItem('bzmusic_cloud_library', JSON.stringify(state.library));
      } catch (e) {}
      renderSidebarPlaylists();
      closeCreatePlaylistModal();
      showToast(`Playlist "${name}" created successfully!`);
      renderPlaylistView(newPl.id);
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
        showToast(`Playlist "${name}" created successfully!`);
        renderPlaylistView(data.playlist.id);
      }
    } catch (err) {
      showToast('Unable to create playlist');
    }
  }

  async function deleteCurrentPlaylist() {
    if (!state.activePlaylistId) return;
    const pl = state.library.playlists.find(p => p.id === state.activePlaylistId);
    if (!pl) return;

    if (!confirm(`Are you sure you want to delete playlist "${pl.name}"?`)) return;

    if (IS_CLOUD_MODE) {
      state.library.playlists = state.library.playlists.filter(p => p.id !== state.activePlaylistId);
      try {
        localStorage.setItem('bzmusic_cloud_library', JSON.stringify(state.library));
      } catch (e) {}
      renderSidebarPlaylists();
      switchView('home');
      showToast('Playlist deleted');
      return;
    }

    try {
      const res = await fetch(`/api/library/playlists/${state.activePlaylistId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        const data = await res.json();
        state.library.playlists = data.playlists;
        renderSidebarPlaylists();
        switchView('home');
        showToast('Playlist deleted');
      }
    } catch (err) {
      showToast('Unable to delete playlist');
    }
  }

  // ==========================================
  // Modal: Edit Playlist Info Handlers
  // ==========================================
  function openEditPlaylistModal() {
    if (!state.activePlaylistId) return;
    const pl = state.library.playlists.find(p => p.id === state.activePlaylistId);
    if (!pl) return;
    el.inputEditPlaylistName.value = pl.name || '';
    el.inputEditPlaylistDesc.value = pl.description || '';
    el.modalEditPlaylist.style.display = 'flex';
    el.inputEditPlaylistName.focus();
  }

  function closeEditPlaylistModal() {
    el.modalEditPlaylist.style.display = 'none';
  }

  async function submitEditPlaylist() {
    if (!state.activePlaylistId) return;
    const name = el.inputEditPlaylistName.value.trim();
    const desc = el.inputEditPlaylistDesc.value.trim();

    if (!name) {
      showToast('Please enter a playlist name');
      el.inputEditPlaylistName.focus();
      return;
    }

    if (IS_CLOUD_MODE) {
      const pl = state.library.playlists.find(p => p.id === state.activePlaylistId);
      if (pl) {
        pl.name = name;
        pl.description = desc;
        pl.updatedAt = new Date().toISOString();
        try {
          localStorage.setItem('bzmusic_cloud_library', JSON.stringify(state.library));
        } catch (e) {}
        renderSidebarPlaylists();
        renderPlaylistView(state.activePlaylistId);
        closeEditPlaylistModal();
        showToast('Playlist details updated!');
      }
      return;
    }

    try {
      const res = await fetch(`/api/library/playlists/${state.activePlaylistId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: desc })
      });

      if (res.ok) {
        const data = await res.json();
        const idx = state.library.playlists.findIndex(p => p.id === state.activePlaylistId);
        if (idx !== -1) {
          state.library.playlists[idx] = data.playlist;
        }
        renderSidebarPlaylists();
        renderPlaylistView(state.activePlaylistId);
        closeEditPlaylistModal();
        showToast('Playlist details updated!');
      } else {
        showToast('Unable to update playlist');
      }
    } catch (err) {
      showToast('Error updating playlist');
    }
  }

  // ==========================================
  // Modal: Change Playlist Cover Handlers
  // ==========================================
  function openChangeCoverModal() {
    if (!state.activePlaylistId) return;
    const pl = state.library.playlists.find(p => p.id === state.activePlaylistId);
    if (!pl) return;

    state.tempCoverData = pl.coverUrl || null;
    switchCoverTab('upload');
    if (el.inputCoverFile) el.inputCoverFile.value = '';
    if (el.inputCoverUrlVal) el.inputCoverUrlVal.value = pl.coverUrl || '';
    updateCoverModalPreview(state.tempCoverData);
    el.modalChangeCover.style.display = 'flex';
  }

  function closeChangeCoverModal() {
    el.modalChangeCover.style.display = 'none';
    state.tempCoverData = null;
  }

  function switchCoverTab(tab) {
    if (tab === 'upload') {
      if (el.tabCoverUpload) el.tabCoverUpload.classList.add('active');
      if (el.tabCoverUrl) el.tabCoverUrl.classList.remove('active');
      if (el.paneCoverUpload) el.paneCoverUpload.style.display = 'block';
      if (el.paneCoverUrl) el.paneCoverUrl.style.display = 'none';
    } else {
      if (el.tabCoverUrl) el.tabCoverUrl.classList.add('active');
      if (el.tabCoverUpload) el.tabCoverUpload.classList.remove('active');
      if (el.paneCoverUrl) el.paneCoverUrl.style.display = 'block';
      if (el.paneCoverUpload) el.paneCoverUpload.style.display = 'none';
    }
  }

  function handleCoverFileSelected(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      showToast('Image size must not exceed 15MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 600;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Compress to JPEG with 0.85 quality
          state.tempCoverData = canvas.toDataURL('image/jpeg', 0.85);
          updateCoverModalPreview(state.tempCoverData);
          showToast('Image uploaded and optimized! Click "Save Cover" to apply.');
        } catch (err) {
          console.error('[Cover Upload] Error compressing image:', err);
          state.tempCoverData = event.target.result;
          updateCoverModalPreview(state.tempCoverData);
          showToast('Image uploaded! Click "Save Cover" to apply.');
        }
      };
      img.onerror = () => {
        showToast('Invalid image file');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  function updateCoverModalPreview(urlOrData) {
    if (urlOrData) {
      if (el.coverModalPreviewImg) {
        el.coverModalPreviewImg.src = urlOrData;
        el.coverModalPreviewImg.style.display = 'block';
      }
      if (el.coverPreviewPlaceholder) {
        el.coverPreviewPlaceholder.style.display = 'none';
      }
    } else {
      if (el.coverModalPreviewImg) {
        el.coverModalPreviewImg.src = '';
        el.coverModalPreviewImg.style.display = 'none';
      }
      if (el.coverPreviewPlaceholder) {
        el.coverPreviewPlaceholder.style.display = 'flex';
      }
    }
  }

  async function submitChangeCover() {
    if (!state.activePlaylistId) return;

    if (IS_CLOUD_MODE) {
      const pl = state.library.playlists.find(p => p.id === state.activePlaylistId);
      if (pl) {
        pl.coverUrl = state.tempCoverData || '';
        try {
          localStorage.setItem('bzmusic_cloud_library', JSON.stringify(state.library));
        } catch (e) {}
        renderPlaylistView(state.activePlaylistId);
        closeChangeCoverModal();
        showToast('Playlist cover updated!');
      }
      return;
    }

    try {
      const res = await fetch(`/api/library/playlists/${state.activePlaylistId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverUrl: state.tempCoverData || '' })
      });

      if (res.ok) {
        const data = await res.json();
        const idx = state.library.playlists.findIndex(p => p.id === state.activePlaylistId);
        if (idx !== -1) {
          state.library.playlists[idx] = data.playlist;
        }
        renderPlaylistView(state.activePlaylistId);
        closeChangeCoverModal();
        showToast('Playlist cover updated!');
      } else {
        console.error(`[Cover Upload Failed] HTTP ${res.status}:`, res.statusText);
        showToast(`Unable to update cover (HTTP ${res.status})`);
      }
    } catch (err) {
      console.error('[Cover Upload Error]:', err);
      showToast('Error saving cover');
    }
  }

  function openAddToPlaylistModal(song) {
    state.pendingAddToPlaylistSong = song;
    el.addToPlaylistSongName.textContent = `Add "${song.title}" to:`;
    el.modalPlaylistsList.innerHTML = '';

    if (state.library.playlists.length === 0) {
      el.modalPlaylistsList.innerHTML = '<p class="modal-subtext">You have no playlists yet. Create one from the sidebar!</p>';
    } else {
      state.library.playlists.forEach(pl => {
        const btn = document.createElement('button');
        btn.className = 'modal-playlist-option';
        const alreadyIn = pl.songs.some(s => s.videoId === song.videoId);

        btn.innerHTML = `
          <span>${escapeHtml(pl.name)}</span>
          <span style="font-size: 0.78rem; color: ${alreadyIn ? '#10b981' : 'var(--text-dim)'};">
            ${alreadyIn ? '✓ Added' : '+ Add'}
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
    if (IS_CLOUD_MODE) {
      const pl = state.library.playlists.find(p => p.id === playlistId);
      if (pl) {
        if (!pl.songs) pl.songs = [];
        if (!pl.songs.some(s => s.videoId === song.videoId)) {
          const enrichedSong = {
            ...song,
            audioUrl: song.audioUrl || (window.BZUSIC_CLOUD_BASE_URL ? `${window.BZUSIC_CLOUD_BASE_URL}/audio/${song.videoId}.m4a` : ''),
            lyricsUrl: song.lyricsUrl || (window.BZUSIC_CLOUD_BASE_URL ? `${window.BZUSIC_CLOUD_BASE_URL}/lyrics/${song.videoId}.lrc` : '')
          };
          pl.songs.push(enrichedSong);
          try {
            localStorage.setItem('bzmusic_cloud_library', JSON.stringify(state.library));
          } catch (e) {}
        }
        renderSidebarPlaylists();
        closeAddToPlaylistModal();
        showToast(`Added to "${pl.name}"`);

        if (state.currentView === 'playlist' && state.activePlaylistId === playlistId) {
          renderPlaylistView(playlistId);
        }
      }
      return;
    }

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
        showToast(`Added to "${data.playlist.name}"`);

        if (state.currentView === 'playlist' && state.activePlaylistId === playlistId) {
          renderPlaylistView(playlistId);
        }
      }
    } catch (err) {
      showToast('Unable to add to playlist');
    }
  }

  async function removeSongFromPlaylist(playlistId, videoId) {
    if (IS_CLOUD_MODE) {
      const pl = state.library.playlists.find(p => p.id === playlistId);
      if (pl && pl.songs) {
        pl.songs = pl.songs.filter(s => s.videoId !== videoId);
        try {
          localStorage.setItem('bzmusic_cloud_library', JSON.stringify(state.library));
        } catch (e) {}
        renderSidebarPlaylists();
        renderPlaylistView(playlistId);
        showToast('Track removed from playlist');
      }
      return;
    }

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
        showToast('Track removed from playlist');
      }
    } catch (err) {
      showToast('Unable to remove track from playlist');
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
      if (confirm('Import is in progress. Are you sure you want to cancel?')) {
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
    el.textTracksPreview.textContent = 'Detected: 0 songs';

    el.fileDropzone.style.display = 'flex';
    el.fileSelectedInfo.style.display = 'none';
    el.importPlaylistSelectGroup.style.display = 'none';
    el.selectImportPlaylist.innerHTML = '';
    el.importProgressBox.style.display = 'none';
    el.importProgressBar.style.width = '0%';
    el.importStatusText.textContent = 'Preparing...';
    el.importPercent.textContent = '0%';
    el.importStatMatched.textContent = '0';
    el.importStatFailed.textContent = '0';

    el.btnStartImport.disabled = false;
    el.btnStartImport.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      <span>Start Import</span>
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
          showToast('Unsupported file format! Please select a .json or .csv file');
          return;
        }

        // Show file info
        el.importFileName.textContent = fileName;
        el.importFileTracksCount.textContent = `${importSelectedTracks.length} ${importSelectedTracks.length === 1 ? 'song' : 'songs'}`;
        el.fileDropzone.style.display = 'none';
        el.fileSelectedInfo.style.display = 'flex';
      } catch (err) {
        showToast('Error reading file: ' + err.message);
      }
    };
    reader.onerror = () => showToast('Unable to read file');
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
        opt.textContent = `${pl.name} (${pl.tracks.length} songs)`;
        el.selectImportPlaylist.appendChild(opt);
      });
      el.importPlaylistSelectGroup.style.display = 'block';
      el.selectImportPlaylist.onchange = () => {
        const selected = importParsedPlaylists[parseInt(el.selectImportPlaylist.value, 10)];
        if (selected) {
          importSelectedTracks = selected.tracks;
          el.inputImportName.value = selected.name;
          el.importFileTracksCount.textContent = `${selected.tracks.length} ${selected.tracks.length === 1 ? 'song' : 'songs'}`;
        }
      };
      importSelectedTracks = importParsedPlaylists[0].tracks;
      el.inputImportName.value = importParsedPlaylists[0].name;
    } else if (importParsedPlaylists.length === 1) {
      importSelectedTracks = importParsedPlaylists[0].tracks;
      el.inputImportName.value = importParsedPlaylists[0].name;
      el.importPlaylistSelectGroup.style.display = 'none';
    } else {
      throw new Error('No songs found in JSON file');
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
    if (lines.length === 0) throw new Error('CSV file is empty');

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

    if (tracks.length === 0) throw new Error('No songs could be extracted from CSV file');
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
    el.textTracksPreview.textContent = `Detected: ${lines.length} songs`;
  }

  async function handleStartImport() {
    if (isImporting) return;

    const name = el.inputImportName.value.trim();
    if (!name) {
      showToast('Please enter a Playlist name!');
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
      showToast(isFileTab ? 'Please select a valid .json or .csv file!' : 'Please enter at least one song in the text box!');
      return;
    }

    isImporting = true;
    el.btnStartImport.disabled = true;
    el.btnStartImport.innerHTML = `
      <div class="spinner" style="width: 16px; height: 16px; border-width: 2px;"></div>
      <span>Importing...</span>
    `;

    el.importProgressBox.style.display = 'block';
    el.importProgressBar.style.width = '0%';
    el.importPercent.textContent = '0%';
    el.importStatusText.textContent = `Processing ${tracksToImport.length} songs...`;
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
                el.importStatusText.textContent = `Searching [${data.current}/${data.total}]: ${data.trackLabel}`;
                el.importStatMatched.textContent = data.matchedCount;
                el.importStatFailed.textContent = data.failedCount;
              } else if (data.type === 'complete') {
                el.importProgressBar.style.width = '100%';
                el.importPercent.textContent = '100%';
                el.importStatusText.textContent = `Completed! Matched ${data.matchedCount}/${tracksToImport.length} songs.`;
                showToast(`Playlist "${data.playlist.name}" imported successfully! (${data.matchedCount} songs)`);

                state.library.playlists = data.playlists;
                renderSidebarPlaylists();

                setTimeout(() => {
                  closeImportModal();
                  renderPlaylistView(data.playlist.id);
                }, 1000);
                return;
              } else if (data.type === 'error') {
                showToast(`Import error: ${data.message}`);
              }
            } catch (jsonErr) {}
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        showToast('Import cancelled.');
      } else {
        showToast(`Error during import: ${err.message}`);
      }
    } finally {
      isImporting = false;
      el.btnStartImport.disabled = false;
      el.btnStartImport.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        <span>Start Import</span>
      `;
    }
  }

  // ==========================================
  // Now Playing Overlay Controls
  // ==========================================
  function openNowPlaying() {
    state.isNowPlayingOpen = true;
    el.nowPlayingOverlay.classList.add('active');
    if (el.playerLeftTrigger) {
      el.playerLeftTrigger.setAttribute('title', 'Collapse Now Playing');
    }
    if (state.activeTab === 'lyrics' && !el.audio.paused) {
      startKaraokeLoop();
    }
  }

  function closeNowPlaying() {
    state.isNowPlayingOpen = false;
    el.nowPlayingOverlay.classList.remove('active');
    if (el.playerLeftTrigger) {
      el.playerLeftTrigger.setAttribute('title', 'Expand Now Playing');
    }
    stopKaraokeLoop();
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

    if (tabName === 'lyrics') {
      if (!el.audio.paused && state.isNowPlayingOpen) {
        startKaraokeLoop();
      }
    } else {
      stopKaraokeLoop();
    }
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
    const isAnyModalOpen = () => {
      const modalElements = [
        el.modalCreatePlaylist,
        el.modalEditPlaylist,
        el.modalChangeCover,
        el.modalAddToPlaylist,
        el.modalImportPlaylist
      ];
      return modalElements.some(m => m && (m.style.display === 'flex' || m.style.display === 'block'));
    };

    const closeAllActiveModals = () => {
      if (typeof closeCreatePlaylistModal === 'function') closeCreatePlaylistModal();
      if (typeof closeEditPlaylistModal === 'function') closeEditPlaylistModal();
      if (typeof closeChangeCoverModal === 'function') closeChangeCoverModal();
      if (typeof closeAddToPlaylistModal === 'function') closeAddToPlaylistModal();
      if (typeof closeImportModal === 'function') closeImportModal();
    };

    // Handle Escape key: priority to closing modals first, then minimize Now Playing
    if (e.key === 'Escape' || e.code === 'Escape') {
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        document.activeElement.blur();
      }
      if (isAnyModalOpen()) {
        closeAllActiveModals();
      } else if (state.isNowPlayingOpen) {
        closeNowPlaying();
      }
      return;
    }

    // Ignore keyboard shortcuts if focus is inside text input or textarea
    const tag = document.activeElement ? document.activeElement.tagName : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
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
