// =============================================================================
// i18n: Indonesian (id) + English (en) translation tables
// Used by LanguageProvider context.
// =============================================================================

export type Language = 'id' | 'en';

export type TranslationKey =
  // App
  | 'app.name'
  | 'app.tagline'
  // Nav
  | 'nav.dashboard'
  | 'nav.scheduler'
  | 'nav.pir'
  | 'nav.logs'
  | 'nav.ai'
  | 'nav.ota'
  | 'nav.settings'
  // Common
  | 'common.save'
  | 'common.cancel'
  | 'common.delete'
  | 'common.edit'
  | 'common.reset'
  | 'common.confirm'
  | 'common.apply'
  | 'common.review'
  | 'common.dismiss'
  | 'common.refresh'
  | 'common.loading'
  | 'common.online'
  | 'common.offline'
  | 'common.mock_mode'
  | 'common.live_mode'
  | 'common.search'
  | 'common.export'
  | 'common.import'
  | 'common.close'
  | 'common.all'
  | 'common.none'
  | 'common.add'
  | 'common.remove'
  | 'common.enabled'
  | 'common.disabled'
  | 'common.today'
  | 'common.yes'
  | 'common.no'
  // Login
  | 'login.title'
  | 'login.subtitle'
  | 'login.username'
  | 'login.password'
  | 'login.submit'
  | 'login.error_invalid'
  | 'login.demo_creds'
  // Dashboard
  | 'dashboard.title'
  | 'dashboard.subtitle'
  | 'dashboard.relays_on'
  | 'dashboard.schedules_active'
  | 'dashboard.pir_triggers_today'
  | 'dashboard.errors_today'
  | 'dashboard.uptime'
  | 'dashboard.free_heap'
  | 'dashboard.cpu_load'
  | 'dashboard.flash_free'
  | 'dashboard.current_time'
  | 'dashboard.wifi_rssi'
  | 'dashboard.toggle_relay'
  | 'dashboard.mode_auto'
  | 'dashboard.mode_manual'
  | 'dashboard.source_manual'
  | 'dashboard.source_schedule'
  | 'dashboard.source_pir'
  | 'dashboard.source_off'
  // Scheduler
  | 'scheduler.title'
  | 'scheduler.subtitle'
  | 'scheduler.select_channel'
  | 'scheduler.add_schedule'
  | 'scheduler.on_time'
  | 'scheduler.off_time'
  | 'scheduler.days'
  | 'scheduler.every_day'
  | 'scheduler.mon' | 'scheduler.tue' | 'scheduler.wed' | 'scheduler.thu' | 'scheduler.fri' | 'scheduler.sat' | 'scheduler.sun'
  | 'scheduler.preview'
  | 'scheduler.max_reached'
  | 'scheduler.empty'
  // PIR
  | 'pir.title'
  | 'pir.subtitle'
  | 'pir.motion_detected'
  | 'pir.no_motion'
  | 'pir.warmup'
  | 'pir.stuck_alert'
  | 'pir.hold_time'
  | 'pir.last_motion'
  | 'pir.triggers_today'
  | 'pir.test_trigger'
  // Logs
  | 'logs.title'
  | 'logs.subtitle'
  | 'logs.filter_type'
  | 'logs.filter_channel'
  | 'logs.export_csv'
  | 'logs.empty'
  | 'logs.auto_refresh'
  // AI
  | 'ai.title'
  | 'ai.subtitle'
  | 'ai.disclaimer'
  | 'ai.category.habit'
  | 'ai.category.energy'
  | 'ai.category.fault'
  | 'ai.category.maintenance'
  | 'ai.category.pir'
  | 'ai.severity.info'
  | 'ai.severity.warning'
  | 'ai.severity.critical'
  | 'ai.last_updated'
  // OTA
  | 'ota.title'
  | 'ota.subtitle'
  | 'ota.current_version'
  | 'ota.latest_version'
  | 'ota.update_available'
  | 'ota.up_to_date'
  | 'ota.check_update'
  | 'ota.upload_binary'
  | 'ota.uploading'
  | 'ota.verifying'
  | 'ota.installing'
  | 'ota.rollback'
  | 'ota.signature_verified'
  | 'ota.history'
  | 'ota.warning_stable_power'
  // Settings
  | 'settings.title'
  | 'settings.subtitle'
  | 'settings.timezone'
  | 'settings.set_rtc'
  | 'settings.sync_now'
  | 'settings.change_password'
  | 'settings.current_password'
  | 'settings.new_password'
  | 'settings.confirm_password'
  | 'settings.password_strength'
  | 'settings.backup_restore'
  | 'settings.export_config'
  | 'settings.import_config'
  | 'settings.backup_to_gas'
  | 'settings.factory_reset'
  | 'settings.factory_reset_warning'
  | 'settings.factory_reset_prepare'
  | 'settings.factory_reset_confirm'
  | 'settings.factory_reset_token'
  // Toast
  | 'toast.saved'
  | 'toast.error'
  | 'toast.relay_on'
  | 'toast.relay_off'
  | 'toast.logout_success'
  | 'toast.password_changed'
  | 'toast.config_exported'
  | 'toast.config_imported'
  | 'toast.factory_reset_done'
  | 'toast.ota_started'
  | 'toast.ota_success'
  | 'toast.ota_failed'
  | 'ota.ota_failed'
  | 'toast.time_synced'
  | 'toast.rebooting'
  // Theme
  | 'theme.light'
  | 'theme.dark'
  | 'theme.system'
  | 'theme.toggle';

type Dict = Record<TranslationKey, string>;

const id: Dict = {
  'app.name': 'Timer Digital Relay v4.0',
  'app.tagline': 'Sistem Kontrol 12 Relay + 4 PIR berbasis ESP32',
  'nav.dashboard': 'Dashboard',
  'nav.scheduler': 'Jadwal',
  'nav.pir': 'Sensor PIR',
  'nav.logs': 'Log Aktivitas',
  'nav.ai': 'Insight AI',
  'nav.ota': 'OTA Firmware',
  'nav.settings': 'Pengaturan',
  'common.save': 'Simpan',
  'common.cancel': 'Batal',
  'common.delete': 'Hapus',
  'common.edit': 'Edit',
  'common.reset': 'Reset',
  'common.confirm': 'Konfirmasi',
  'common.apply': 'Terapkan',
  'common.review': 'Tinjau',
  'common.dismiss': 'Abaikan',
  'common.refresh': 'Segarkan',
  'common.loading': 'Memuat...',
  'common.online': 'Online',
  'common.offline': 'Offline',
  'common.mock_mode': 'Mode Demo (Mock API)',
  'common.live_mode': 'Mode Live (ESP32)',
  'common.search': 'Cari',
  'common.export': 'Ekspor',
  'common.import': 'Impor',
  'common.close': 'Tutup',
  'common.all': 'Semua',
  'common.none': 'Tidak ada',
  'common.add': 'Tambah',
  'common.remove': 'Hapus',
  'common.enabled': 'Aktif',
  'common.disabled': 'Nonaktif',
  'common.today': 'Hari ini',
  'common.yes': 'Ya',
  'common.no': 'Tidak',
  'login.title': 'Masuk ke Dashboard',
  'login.subtitle': 'Sistem Timer Digital Relay v4.0',
  'login.username': 'Nama Pengguna',
  'login.password': 'Kata Sandi',
  'login.submit': 'Masuk',
  'login.error_invalid': 'Nama pengguna atau kata sandi salah',
  'login.demo_creds': 'Akun demo: admin / admin123',
  'dashboard.title': 'Dashboard Relay',
  'dashboard.subtitle': 'Status real-time 12 channel relay',
  'dashboard.relays_on': 'Relay Aktif',
  'dashboard.schedules_active': 'Jadwal Aktif',
  'dashboard.pir_triggers_today': 'Trigger PIR Hari Ini',
  'dashboard.errors_today': 'Error Hari Ini',
  'dashboard.uptime': 'Uptime',
  'dashboard.free_heap': 'RAM Bebas',
  'dashboard.cpu_load': 'Beban CPU',
  'dashboard.flash_free': 'Flash Kosong',
  'dashboard.current_time': 'Waktu Sekarang',
  'dashboard.wifi_rssi': 'Sinyal WiFi',
  'dashboard.toggle_relay': 'Toggle Relay',
  'dashboard.mode_auto': 'Auto',
  'dashboard.mode_manual': 'Manual',
  'dashboard.source_manual': 'Manual',
  'dashboard.source_schedule': 'Jadwal',
  'dashboard.source_pir': 'PIR',
  'dashboard.source_off': 'Mati',
  'scheduler.title': 'Editor Jadwal',
  'scheduler.subtitle': 'Jadwal mingguan per channel (maks 4 per channel)',
  'scheduler.select_channel': 'Pilih Channel',
  'scheduler.add_schedule': 'Tambah Jadwal',
  'scheduler.on_time': 'Waktu ON',
  'scheduler.off_time': 'Waktu OFF',
  'scheduler.days': 'Hari Aktif',
  'scheduler.every_day': 'Setiap Hari',
  'scheduler.mon': 'Sen', 'scheduler.tue': 'Sel', 'scheduler.wed': 'Rab', 'scheduler.thu': 'Kam',
  'scheduler.fri': 'Jum', 'scheduler.sat': 'Sab', 'scheduler.sun': 'Min',
  'scheduler.preview': 'Pratinjau Mingguan',
  'scheduler.max_reached': 'Maksimal 4 jadwal per channel',
  'scheduler.empty': 'Belum ada jadwal. Tambahkan untuk mengotomatisasi.',
  'pir.title': 'Sensor PIR',
  'pir.subtitle': '4 sensor gerak HC-SR501 pada relay 9-12',
  'pir.motion_detected': 'Gerak Terdeteksi',
  'pir.no_motion': 'Tidak Ada Gerak',
  'pir.warmup': 'Warm-up',
  'pir.stuck_alert': 'Sensor Stuck!',
  'pir.hold_time': 'Hold Time',
  'pir.last_motion': 'Gerakan Terakhir',
  'pir.triggers_today': 'Trigger Hari Ini',
  'pir.test_trigger': 'Tes Trigger',
  'logs.title': 'Log Aktivitas',
  'logs.subtitle': 'Riwayat event relay, PIR, login, dan sistem',
  'logs.filter_type': 'Filter Tipe',
  'logs.filter_channel': 'Filter Channel',
  'logs.export_csv': 'Ekspor CSV',
  'logs.empty': 'Tidak ada log untuk filter ini',
  'logs.auto_refresh': 'Auto-refresh',
  'ai.title': 'Insight AI',
  'ai.subtitle': 'Rekomendasi advisory dari analisis pola penggunaan',
  'ai.disclaimer': 'AI hanya memberikan rekomendasi. Keputusan akhir tetap pada pengguna atau firmware.',
  'ai.category.habit': 'Analisis Kebiasaan',
  'ai.category.energy': 'Analisis Energi',
  'ai.category.fault': 'Deteksi Fault',
  'ai.category.maintenance': 'Predictive Maintenance',
  'ai.category.pir': 'Rekomendasi PIR',
  'ai.severity.info': 'Info',
  'ai.severity.warning': 'Peringatan',
  'ai.severity.critical': 'Kritis',
  'ai.last_updated': 'Diperbarui',
  'ota.title': 'Manajemen Firmware OTA',
  'ota.subtitle': 'Update over-the-air dari GitHub Release',
  'ota.current_version': 'Versi Terpasang',
  'ota.latest_version': 'Versi Terbaru',
  'ota.update_available': 'Update Tersedia',
  'ota.up_to_date': 'Sudah Terbaru',
  'ota.check_update': 'Cek Update',
  'ota.upload_binary': 'Upload Binary',
  'ota.uploading': 'Mengunggah...',
  'ota.verifying': 'Memverifikasi Signature...',
  'ota.installing': 'Menginstal...',
  'ota.rollback': 'Rollback',
  'ota.signature_verified': 'Signature Terverifikasi',
  'ota.history': 'Riwayat OTA',
  'ota.warning_stable_power': 'Pastikan daya stabil selama proses OTA. Jangan matikan perangkat.',
  'settings.title': 'Pengaturan',
  'settings.subtitle': 'Konfigurasi sistem, keamanan, dan backup',
  'settings.timezone': 'Zona Waktu',
  'settings.set_rtc': 'Atur Waktu RTC',
  'settings.sync_now': 'Sinkronkan Sekarang',
  'settings.change_password': 'Ganti Kata Sandi',
  'settings.current_password': 'Kata Sandi Lama',
  'settings.new_password': 'Kata Sandi Baru',
  'settings.confirm_password': 'Konfirmasi Kata Sandi',
  'settings.password_strength': 'Kekuatan Sandi',
  'settings.backup_restore': 'Backup & Restore',
  'settings.export_config': 'Ekspor Konfigurasi',
  'settings.import_config': 'Impor Konfigurasi',
  'settings.backup_to_gas': 'Backup ke Google Apps Script',
  'settings.factory_reset': 'Factory Reset',
  'settings.factory_reset_warning': 'Tindakan ini akan menghapus seluruh konfigurasi dan kembali ke pengaturan pabrik. Tidak dapat dibatalkan.',
  'settings.factory_reset_prepare': 'Siapkan Reset',
  'settings.factory_reset_confirm': 'Konfirmasi Reset',
  'settings.factory_reset_token': 'Token Reset',
  'toast.saved': 'Perubahan disimpan',
  'toast.error': 'Terjadi kesalahan',
  'toast.relay_on': 'Relay dinyalakan',
  'toast.relay_off': 'Relay dimatikan',
  'toast.logout_success': 'Berhasil keluar',
  'toast.password_changed': 'Kata sandi berhasil diubah',
  'toast.config_exported': 'Konfigurasi diekspor',
  'toast.config_imported': 'Konfigurasi diimpor',
  'toast.factory_reset_done': 'Factory reset berhasil. Sistem rebooting.',
  'toast.ota_started': 'OTA update dimulai',
  'toast.ota_success': 'OTA update berhasil',
  'toast.ota_failed': 'OTA update gagal',
  'ota.ota_failed': 'OTA Gagal',
  'toast.time_synced': 'Waktu RTC disinkronkan',
  'toast.rebooting': 'Sistem melakukan reboot...',
  'theme.light': 'Mode Terang',
  'theme.dark': 'Mode Gelap',
  'theme.system': 'Ikuti Sistem',
  'theme.toggle': 'Ganti Tema',
};

const en: Dict = {
  'app.name': 'Timer Digital Relay v4.0',
  'app.tagline': 'ESP32-based 12 Relay + 4 PIR Control System',
  'nav.dashboard': 'Dashboard',
  'nav.scheduler': 'Scheduler',
  'nav.pir': 'PIR Sensors',
  'nav.logs': 'Activity Log',
  'nav.ai': 'AI Insights',
  'nav.ota': 'Firmware OTA',
  'nav.settings': 'Settings',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.reset': 'Reset',
  'common.confirm': 'Confirm',
  'common.apply': 'Apply',
  'common.review': 'Review',
  'common.dismiss': 'Dismiss',
  'common.refresh': 'Refresh',
  'common.loading': 'Loading...',
  'common.online': 'Online',
  'common.offline': 'Offline',
  'common.mock_mode': 'Demo Mode (Mock API)',
  'common.live_mode': 'Live Mode (ESP32)',
  'common.search': 'Search',
  'common.export': 'Export',
  'common.import': 'Import',
  'common.close': 'Close',
  'common.all': 'All',
  'common.none': 'None',
  'common.add': 'Add',
  'common.remove': 'Remove',
  'common.enabled': 'Enabled',
  'common.disabled': 'Disabled',
  'common.today': 'Today',
  'common.yes': 'Yes',
  'common.no': 'No',
  'login.title': 'Sign In to Dashboard',
  'login.subtitle': 'Timer Digital Relay v4.0 System',
  'login.username': 'Username',
  'login.password': 'Password',
  'login.submit': 'Sign In',
  'login.error_invalid': 'Invalid username or password',
  'login.demo_creds': 'Demo credentials: admin / admin123',
  'dashboard.title': 'Relay Dashboard',
  'dashboard.subtitle': 'Real-time status of 12 relay channels',
  'dashboard.relays_on': 'Relays ON',
  'dashboard.schedules_active': 'Active Schedules',
  'dashboard.pir_triggers_today': 'PIR Triggers Today',
  'dashboard.errors_today': 'Errors Today',
  'dashboard.uptime': 'Uptime',
  'dashboard.free_heap': 'Free Heap',
  'dashboard.cpu_load': 'CPU Load',
  'dashboard.flash_free': 'Flash Free',
  'dashboard.current_time': 'Current Time',
  'dashboard.wifi_rssi': 'WiFi Signal',
  'dashboard.toggle_relay': 'Toggle Relay',
  'dashboard.mode_auto': 'Auto',
  'dashboard.mode_manual': 'Manual',
  'dashboard.source_manual': 'Manual',
  'dashboard.source_schedule': 'Schedule',
  'dashboard.source_pir': 'PIR',
  'dashboard.source_off': 'Off',
  'scheduler.title': 'Schedule Editor',
  'scheduler.subtitle': 'Weekly schedule per channel (max 4 per channel)',
  'scheduler.select_channel': 'Select Channel',
  'scheduler.add_schedule': 'Add Schedule',
  'scheduler.on_time': 'ON Time',
  'scheduler.off_time': 'OFF Time',
  'scheduler.days': 'Active Days',
  'scheduler.every_day': 'Every Day',
  'scheduler.mon': 'Mon', 'scheduler.tue': 'Tue', 'scheduler.wed': 'Wed', 'scheduler.thu': 'Thu',
  'scheduler.fri': 'Fri', 'scheduler.sat': 'Sat', 'scheduler.sun': 'Sun',
  'scheduler.preview': 'Weekly Preview',
  'scheduler.max_reached': 'Maximum 4 schedules per channel',
  'scheduler.empty': 'No schedules yet. Add one to automate.',
  'pir.title': 'PIR Sensors',
  'pir.subtitle': '4 HC-SR501 motion sensors on relays 9-12',
  'pir.motion_detected': 'Motion Detected',
  'pir.no_motion': 'No Motion',
  'pir.warmup': 'Warm-up',
  'pir.stuck_alert': 'Sensor Stuck!',
  'pir.hold_time': 'Hold Time',
  'pir.last_motion': 'Last Motion',
  'pir.triggers_today': 'Triggers Today',
  'pir.test_trigger': 'Test Trigger',
  'logs.title': 'Activity Log',
  'logs.subtitle': 'History of relay, PIR, login, and system events',
  'logs.filter_type': 'Filter Type',
  'logs.filter_channel': 'Filter Channel',
  'logs.export_csv': 'Export CSV',
  'logs.empty': 'No logs match this filter',
  'logs.auto_refresh': 'Auto-refresh',
  'ai.title': 'AI Insights',
  'ai.subtitle': 'Advisory recommendations from usage pattern analysis',
  'ai.disclaimer': 'AI provides recommendations only. Final decisions remain with the user or firmware.',
  'ai.category.habit': 'Habit Analysis',
  'ai.category.energy': 'Energy Analysis',
  'ai.category.fault': 'Fault Detection',
  'ai.category.maintenance': 'Predictive Maintenance',
  'ai.category.pir': 'PIR Recommendation',
  'ai.severity.info': 'Info',
  'ai.severity.warning': 'Warning',
  'ai.severity.critical': 'Critical',
  'ai.last_updated': 'Updated',
  'ota.title': 'Firmware OTA Management',
  'ota.subtitle': 'Over-the-air updates from GitHub Release',
  'ota.current_version': 'Installed Version',
  'ota.latest_version': 'Latest Version',
  'ota.update_available': 'Update Available',
  'ota.up_to_date': 'Up to Date',
  'ota.check_update': 'Check for Updates',
  'ota.upload_binary': 'Upload Binary',
  'ota.uploading': 'Uploading...',
  'ota.verifying': 'Verifying Signature...',
  'ota.installing': 'Installing...',
  'ota.rollback': 'Rollback',
  'ota.signature_verified': 'Signature Verified',
  'ota.history': 'OTA History',
  'ota.warning_stable_power': 'Ensure stable power during OTA. Do not turn off the device.',
  'settings.title': 'Settings',
  'settings.subtitle': 'System configuration, security, and backup',
  'settings.timezone': 'Timezone',
  'settings.set_rtc': 'Set RTC Time',
  'settings.sync_now': 'Sync Now',
  'settings.change_password': 'Change Password',
  'settings.current_password': 'Current Password',
  'settings.new_password': 'New Password',
  'settings.confirm_password': 'Confirm Password',
  'settings.password_strength': 'Password Strength',
  'settings.backup_restore': 'Backup & Restore',
  'settings.export_config': 'Export Config',
  'settings.import_config': 'Import Config',
  'settings.backup_to_gas': 'Backup to Google Apps Script',
  'settings.factory_reset': 'Factory Reset',
  'settings.factory_reset_warning': 'This action will erase all configuration and restore factory settings. Cannot be undone.',
  'settings.factory_reset_prepare': 'Prepare Reset',
  'settings.factory_reset_confirm': 'Confirm Reset',
  'settings.factory_reset_token': 'Reset Token',
  'toast.saved': 'Changes saved',
  'toast.error': 'An error occurred',
  'toast.relay_on': 'Relay turned ON',
  'toast.relay_off': 'Relay turned OFF',
  'toast.logout_success': 'Logged out successfully',
  'toast.password_changed': 'Password changed successfully',
  'toast.config_exported': 'Configuration exported',
  'toast.config_imported': 'Configuration imported',
  'toast.factory_reset_done': 'Factory reset complete. System rebooting.',
  'toast.ota_started': 'OTA update started',
  'toast.ota_success': 'OTA update successful',
  'toast.ota_failed': 'OTA update failed',
  'ota.ota_failed': 'OTA Failed',
  'toast.time_synced': 'RTC time synchronized',
  'toast.rebooting': 'System rebooting...',
  'theme.light': 'Light Mode',
  'theme.dark': 'Dark Mode',
  'theme.system': 'System',
  'theme.toggle': 'Toggle Theme',
};

export const translations: Record<Language, Dict> = { id, en };

export function detectLanguage(): Language {
  if (typeof navigator === 'undefined') return 'id';
  const lang = navigator.language.toLowerCase();
  return lang.startsWith('id') ? 'id' : 'en';
}
