class MusicPlayer {
    constructor() {
        this.audio = document.getElementById('audio');
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.progressBar = document.getElementById('progressBar');
        this.volumeBar = document.getElementById('volumeBar');
        this.currentTimeDisplay = document.getElementById('currentTime');
        this.durationDisplay = document.getElementById('duration');
        this.songTitle = document.getElementById('songTitle');
        this.artist = document.getElementById('artist');
        this.albumArt = document.getElementById('albumArt');
        this.currentLyric = document.getElementById('currentLyric');
        this.nextLyric = document.getElementById('nextLyric');
        this.futureLyric = document.getElementById('futureLyric');
        this.playlistSelect = document.getElementById('playlistSelect'); // Tambahkan ini

        this.currentSongIndex = 0;
        this.isPlaying = false;
        this.allPlaylists = {}; // Akan menyimpan semua playlist dari config
        this.playlist = []; // Playlist yang sedang aktif
        this.lyrics = [];
        this.currentLyricIndex = 0;

        this.init();
    }

    async init() {
        await this.loadConfig();
        this.setupEventListeners();
        // Memuat playlist default atau playlist pertama jika default tidak ada
        const defaultPlaylistName = this.allPlaylists.defaultPlaylist || Object.keys(this.allPlaylists.playlists)[0];
        if (defaultPlaylistName) {
            this.loadSpecificPlaylist(defaultPlaylistName);
        } else {
            console.error('No playlists found in config.');
        }
    }

    async loadConfig() {
        try {
            const response = await fetch('config.json');
            const config = await response.json();
            this.allPlaylists = config; // Simpan seluruh konfigurasi

            // Isi dropdown playlist
            const playlistNames = Object.keys(config.playlists);
            this.playlistSelect.innerHTML = ''; // Bersihkan opsi sebelumnya
            playlistNames.forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                this.playlistSelect.appendChild(option);
            });

            // Set playlist default di dropdown
            if (config.defaultPlaylist) {
                this.playlistSelect.value = config.defaultPlaylist;
            }

            // Set playlist title
            const playlistTitle = document.getElementById('playlistTitle');
            if (config.playlistName) { // Asumsi masih ada playlistName di root jika diperlukan
                playlistTitle.textContent = config.playlistName;
            } else if (config.defaultPlaylist) {
                playlistTitle.textContent = config.defaultPlaylist; // Gunakan nama playlist default
            }


        } catch (error) {
            console.error('Error loading config:', error);
        }
    }

    setupEventListeners() {
        this.playPauseBtn.addEventListener('click', () => this.togglePlay());
        this.prevBtn.addEventListener('click', () => this.playPrevious());
        this.nextBtn.addEventListener('click', () => this.playNext());

        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('loadedmetadata', () => this.updateDuration());
        this.audio.addEventListener('ended', () => this.playNext());

        this.progressBar.addEventListener('input', () => this.seek());
        this.volumeBar.addEventListener('input', () => this.setVolume());

        // Event listener untuk perubahan playlist
        this.playlistSelect.addEventListener('change', (event) => {
            this.loadSpecificPlaylist(event.target.value);
        });

        // Welcome panel start button
        const startButton = document.getElementById('startButton');
        const welcomePanel = document.getElementById('welcomePanel');

        startButton.addEventListener('click', () => {
            welcomePanel.classList.add('hidden');
            this.audio.play();
            this.isPlaying = true;
            this.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        });

        // Auto-play when clicking anywhere
        document.addEventListener('click', () => {
            if (!this.isPlaying && welcomePanel.classList.contains('hidden')) {
                this.audio.play();
                this.isPlaying = true;
                this.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
            }
        }, { once: true });
    }

    loadSpecificPlaylist(playlistName) {
        if (this.allPlaylists.playlists && this.allPlaylists.playlists[playlistName]) {
            this.playlist = this.allPlaylists.playlists[playlistName];
            this.currentSongIndex = 0;
            this.loadSong(this.currentSongIndex);

            // Update playlist title display
            const playlistTitle = document.getElementById('playlistTitle');
            playlistTitle.textContent = playlistName;
        } else {
            console.error(`Playlist "${playlistName}" not found.`);
        }
    }

    loadSong(index) {
        if (this.playlist.length === 0) {
            this.songTitle.textContent = 'No songs in playlist';
            this.artist.textContent = '';
            this.albumArt.src = 'placeholder.jpg';
            this.currentLyric.textContent = 'Lyrics not available';
            this.nextLyric.textContent = '';
            this.futureLyric.textContent = '';
            this.audio.src = ''; // Clear audio source
            return;
        }

        const song = this.playlist[index];
        this.audio.src = song.path;
        this.songTitle.textContent = song.title;
        this.artist.textContent = song.artist;
        this.albumArt.src = song.albumArt || 'placeholder.jpg';

        // Update background blur
        const backgroundBlur = document.getElementById('backgroundBlur');
        backgroundBlur.style.backgroundImage = `url(${song.albumArt || 'placeholder.jpg'})`;

        this.loadLyrics(song.lyricsPath);

        if (this.isPlaying) {
            this.audio.play();
        }
    }

    async loadLyrics(lyricsPath) {
        if (!lyricsPath) {
            this.lyrics = [];
            this.currentLyric.textContent = 'Lirik tidak tersedia'; // Pesan baru
            this.nextLyric.textContent = '';
            this.futureLyric.textContent = '';
            return;
        }

        try {
            const response = await fetch(lyricsPath);
            if (!response.ok) { // Check if response is not OK (e.g., 404 Not Found)
                throw new Error('Lyrics file not found or could not be loaded.');
            }
            const lrcText = await response.text();
            this.lyrics = this.parseLRC(lrcText);
            this.currentLyricIndex = 0;

            if (this.lyrics.length === 0) {
                this.currentLyric.textContent = 'Lirik tidak tersedia'; // Pesan baru
                this.nextLyric.textContent = '';
                this.futureLyric.textContent = '';
            }
        } catch (error) {
            console.error('Error loading lyrics:', error);
            this.lyrics = [];
            this.currentLyric.textContent = 'Lirik tidak tersedia'; // Pesan baru
            this.nextLyric.textContent = '';
            this.futureLyric.textContent = '';
        }
    }

    parseLRC(lrcText) {
        const lines = lrcText.split('\n');
        const lyrics = [];

        lines.forEach(line => {
            const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2})\](.*)/);
            if (match) {
                const minutes = parseInt(match[1]);
                const seconds = parseInt(match[2]);
                const milliseconds = parseInt(match[3]) * 10;
                const time = minutes * 60 + seconds + milliseconds / 1000;
                const text = match[4].trim();
                lyrics.push({ time, text });
            }
        });

        return lyrics.sort((a, b) => a.time - b.time);
    }

    updateLyrics() {
        if (this.lyrics.length === 0) {
            this.currentLyric.textContent = 'Lirik tidak tersedia'; // Pesan baru
            this.nextLyric.textContent = '';
            this.futureLyric.textContent = '';
            return;
        }

        const currentTime = this.audio.currentTime;

        // Find current lyric index
        let found = false;
        for (let i = 0; i < this.lyrics.length; i++) {
            if (currentTime < this.lyrics[i].time) {
                this.currentLyricIndex = Math.max(0, i - 1);
                found = true;
                break;
            }
        }
        if (!found && this.lyrics.length > 0) { // If audio has passed all lyrics
            this.currentLyricIndex = this.lyrics.length - 1;
        }


        // Update lyric display
        this.currentLyric.textContent = this.lyrics[this.currentLyricIndex]?.text || '';
        this.nextLyric.textContent = this.lyrics[this.currentLyricIndex + 1]?.text || '';
        this.futureLyric.textContent = this.lyrics[this.currentLyricIndex + 2]?.text || '';
    }

    togglePlay() {
        if (this.isPlaying) {
            this.audio.pause();
            this.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        } else {
            this.audio.play();
            this.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        }
        this.isPlaying = !this.isPlaying;
    }

    playPrevious() {
        if (this.playlist.length === 0) return;
        this.currentSongIndex = (this.currentSongIndex - 1 + this.playlist.length) % this.playlist.length;
        this.loadSong(this.currentSongIndex);
    }

    playNext() {
        if (this.playlist.length === 0) return;
        this.currentSongIndex = (this.currentSongIndex + 1) % this.playlist.length;
        this.loadSong(this.currentSongIndex);
    }

    updateProgress() {
        const progress = (this.audio.currentTime / this.audio.duration) * 100;
        this.progressBar.value = progress || 0;
        this.currentTimeDisplay.textContent = this.formatTime(this.audio.currentTime);
        this.updateLyrics();
    }

    updateDuration() {
        this.durationDisplay.textContent = this.formatTime(this.audio.duration);
    }

    seek() {
        const time = (this.progressBar.value / 100) * this.audio.duration;
        this.audio.currentTime = time;
    }

    setVolume() {
        this.audio.volume = this.volumeBar.value / 100;
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
}

// Initialize player when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MusicPlayer();
});