document.addEventListener('alpine:init', () => {
    // Daftarkan komponen 'pomodoro' ke Alpine
    // Di HTML, kita panggil ini dengan x-data="pomodoro"
    Alpine.data('pomodoro', () => ({
        
        // == STATE (Data) ==
        modes: {}, // Pengaturan akan dimuat dari localStorage atau di-set di init().

        currentMode: 'work',
        totalSeconds: 0,
        initialTime: 0,       // Untuk menghitung persentase progress
        isRunning: false,
        timerInstance: null,
        pomodoroCount: 0,
        showSettings: false,  // Untuk menampilkan/menyembunyikan modal

        // Data untuk SVG Progress Circle
        radius: 45,
        circumference: 2 * Math.PI * 45, // 282.74...

        // == COMPUTED (Data Turunan) ==
        get progressOffset() {
            if (this.initialTime === 0) return this.circumference;
            const progressPercent = (this.totalSeconds / this.initialTime);
            return this.circumference * (1 - progressPercent);
        },

        // == METHODS (Fungsi) ==

        // Inisialisasi
        init() {
            // 1. Coba ambil pengaturan yang tersimpan
            const savedSettings = localStorage.getItem('pomodoroSettings');

            if (savedSettings) {
                // 2. Jika ada, pakai pengaturan itu
                console.log('Pengaturan ditemukan, memuat dari localStorage...');
                this.modes = JSON.parse(savedSettings);
            } else {
                // 3. Jika tidak ada, pakai pengaturan default
                console.log('Tidak ada pengaturan, memakai default.');
                this.modes = {
                    work: 25,
                    shortBreak: 5,
                    longBreak: 15
                };
            }

            // 4. Lanjutkan sisa inisialisasi seperti biasa
            this.totalSeconds = this.modes[this.currentMode] * 60;
            this.initialTime = this.totalSeconds;
        },

        // Satu tombol untuk Start/Pause
        toggleTimer() {
            if (this.isRunning) {
                this.pauseTimer();
            } else {
                // --- FIX: Minta izin & aktifkan audio HANYA saat user memulai timer ---
                // 1. Cek izin notifikasi. Jika 'default', minta izin.
                //    Browser modern hanya izinkan ini jika dipicu oleh aksi user (klik).
                if (Notification.permission === 'default') {
                    this.requestNotificationPermission();
                }

                // 2. Coba putar dan langsung pause-kan suara.
                //    Ini "membuka kunci" audio di banyak mobile browser.
                const sound = document.getElementById('alarm-sound');
                sound.play().catch(() => {}); // Abaikan error jika gagal
                sound.pause();

                this.startTimer();
            }
        },

        startTimer() {
            if (this.totalSeconds <= 0) return;
            this.isRunning = true;
            // Atur initialTime HANYA jika timer dimulai dari awal
            if (this.totalSeconds === this.modes[this.currentMode] * 60) {
                this.initialTime = this.totalSeconds;
            }
            this.timerInstance = setInterval(() => {
                this.tick();
            }, 1000);
        },

        pauseTimer() {
            this.isRunning = false;
            clearInterval(this.timerInstance);
        },

        tick() {
            if (this.totalSeconds <= 0) {
                this.pauseTimer();
                this.handleTimerEnd();
            } else {
                this.totalSeconds--;
            }
        },

        handleTimerEnd() {
            this.playSound();

            // Kirim notifikasi
            if (this.currentMode === 'work') {
                this.sendNotification('Waktu Kerja Selesai!', 'Saatnya istirahat sejenak. Kerja bagus!');
                this.pomodoroCount++;
                this.currentMode = (this.pomodoroCount % 4 === 0) ? 'longBreak' : 'shortBreak';
            } else {
                this.sendNotification('Istirahat Selesai!', 'Waktunya kembali fokus!');
                this.currentMode = 'work';
            }
            // Reset timer ke mode baru
            this.resetTimer();
            // Otomatis jalankan timer mode berikutnya (opsional, tapi UX bagus)
            this.startTimer(); 
        },

        switchMode(mode) {
            this.pauseTimer();
            this.currentMode = mode;
            this.resetTimer();
        },

        resetTimer() {
            this.totalSeconds = this.modes[this.currentMode] * 60;
            this.initialTime = this.totalSeconds; // Reset juga initialTime
        },

        // Fungsi baru untuk menerapkan pengaturan
        applySettings() {
            this.showSettings = false;

            // Kita gunakan JSON.stringify untuk mengubah Object JavaScript menjadi String
            localStorage.setItem('pomodoroSettings', JSON.stringify(this.modes));
            
            console.log('Pengaturan baru disimpan:', this.modes);

            // Update timer jika sedang tidak berjalan
            if (!this.isRunning) {
                this.resetTimer();
            }
        },

        // == HELPERS (Fungsi Bantu) ==
        displayMinutes() { return Math.floor(this.totalSeconds / 60); },
        displaySeconds() { return this.totalSeconds % 60; },
        format(num) { return String(num).padStart(2, '0'); },

        // Fungsi untuk update judul tab
        updateTitle() {
            document.title = `(${this.format(this.displayMinutes())}:${this.format(this.displaySeconds())}) Pomodoro - ${this.currentMode} | Tomaro`;
        },

        // Fungsi Notifikasi
        requestNotificationPermission() {
            console.log('Meminta izin notifikasi...');
            if (!("Notification" in window)) {
                console.error("Browser ini tidak mendukung notifikasi desktop.");
                return;
            };
            
            // Cek status saat ini
            console.log('Status Izin Saat Ini:', Notification.permission);

            if (Notification.permission !== "denied") {
                // Meminta izin ke pengguna
                Notification.requestPermission().then(permission => {
                    // Ini akan memberi tahu kita apa yang user pilih
                    console.log('Hasil Pilihan Izin Pengguna:', permission);
                });
            }
        },
        sendNotification(title, body) {
            console.log('Mencoba mengirim notifikasi...');
            // Cek status izin TEPAT SAAT mengirim
            if (Notification.permission === "granted") {
                console.log('Izin "granted". Mengirim notifikasi...');
                new Notification(title, {
                    body: body,
                    icon: 'https://cdn-icons-png.flaticon.com/512/1201/1201616.png'
                });
            } else {
                // Ini akan memberi tahu kita jika ada masalah
                console.warn('Gagal mengirim notifikasi. Status Izin:', Notification.permission);
            }
        },
        testNotification() {
            console.log('--- TES NOTIFIKASI DIKLIK ---');
            this.sendNotification('Tes Notifikasi Berhasil!', 'Jika kamu melihat ini, notifikasimu berfungsi dengan baik.');
        },
        playSound() {
            const sound = document.getElementById('alarm-sound');
            if (sound) {
                // Mengatasi masalah autoplay
                sound.play().catch(error => {
                    console.error('Gagal memutar suara (mungkin diblokir autoplay):', error);
                });
            }
        },
        testSound() {
            console.log('--- TES SUARA DIKLIK ---');
            this.playSound();
        },
    }));
});