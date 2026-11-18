'use client';
import { useState, useRef, useEffect } from 'react';
import { Terminal, Github, Smartphone, ArrowRight, ArrowLeft, Play, CheckCircle2, CircleDashed, Link as LinkIcon, FileCode, Check, Upload, History, Sun, Moon, Globe, Search, MoreVertical, Plus, Download, X, Edit2, Settings, Trash2, ShieldCheck, Zap, RefreshCw, Package, Rocket, ChevronRight, ExternalLink, Loader2 } from 'lucide-react';
import { addAppHistory, getAppHistory, updateAppHistory, deleteAppHistory, AppHistory, saveSetting, getSetting } from '@/lib/db';

const REPO_URL = 'https://github.com/dezzorigin/apk-builder';
const PACKAGE_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const REPO_RE = /^[a-zA-Z0-9._-]+$/;

// Pengguna sering mengetik URL tanpa skema ("example.com") — tambah https://.
const normalizeUrl = (v: string) => {
 const t = v.trim();
 if (!t) return t;
 return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};

const NinjaBLogo = ({ className = "w-10 h-10" }) => (
 <svg viewBox="0 0 200 200" className={className} aria-hidden="true">
 <path d="M 65 85 L 100 50 H 140 C 180 50, 180 95, 150 100 C 180 105, 180 150, 140 150 H 75 L 110 115 V 85 Z" fill="currentColor" />
 <path d="M 40 85 H 125 C 145 85, 145 115, 125 115 H 40 Z" fill="black" />
 <circle cx="90" cy="100" r="9" fill="currentColor" />
 <circle cx="120" cy="100" r="9" fill="currentColor" />
 </svg>
);

export default function BuilderApp() {
 const [showLanding, setShowLanding] = useState(true);
 const [showBuilder, setShowBuilder] = useState(false);
 const [step, setStep] = useState(1);
 const [theme, setTheme] = useState<'light' | 'dark'>('light');
 const [searchQuery, setSearchQuery] = useState('');
 const [showSearch, setShowSearch] = useState(false);

 // App Edit State
 const [editingAppId, setEditingAppId] = useState<string | null>(null);
 const [editAppName, setEditAppName] = useState('');
 const [editIconBase64, setEditIconBase64] = useState('');

 // App Form State
 const [appName, setAppName] = useState('');
 const [packageName, setPackageName] = useState('');
 const [url, setUrl] = useState('');
 const [iconBase64, setIconBase64] = useState('');

 // GitHub Form State
 const [githubUsername, setGithubUsername] = useState('');
 const [githubToken, setGithubToken] = useState('');
 const [repoName, setRepoName] = useState('');

 // Build State
 const [logs, setLogs] = useState<string[]>([]);
 const [isBuilding, setIsBuilding] = useState(false);
 const [buildDone, setBuildDone] = useState(false);
 const [buildError, setBuildError] = useState('');
 const [downloadUrl, setDownloadUrl] = useState('');
 const [actionsUrl, setActionsUrl] = useState('');
 const [runUrl, setRunUrl] = useState('');
 const [history, setHistory] = useState<AppHistory[]>([]);
 const [lastBuildId, setLastBuildId] = useState<string | null>(null);
 const [checkingArtifact, setCheckingArtifact] = useState(false);
 const [artifactStatus, setArtifactStatus] = useState('');
 const logsEndRef = useRef<HTMLDivElement>(null);

 // Settings State
 const [showSettings, setShowSettings] = useState(false);

 useEffect(() => {
 getAppHistory().then(setHistory);

 // Load settings
 getSetting('githubUsername').then(val => { if (val) setGithubUsername(val) });
 getSetting('githubToken').then(val => { if (val) setGithubToken(val) });

 // Register Service Worker for PWA
 if ('serviceWorker' in navigator) {
 navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW registration failed:', err));
 }
 }, []);

 useEffect(() => {
 logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
 }, [logs]);

 useEffect(() => {
 if (theme === 'dark') {
 document.documentElement.classList.add('dark');
 document.body.style.backgroundColor = '#000000';
 } else {
 document.documentElement.classList.remove('dark');
 document.body.style.backgroundColor = '#f8f9fa';
 }
 }, [theme]);

 const toggleTheme = () => {
 setTheme(prev => prev === 'light' ? 'dark' : 'light');
 };

 const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (file) {
 const reader = new FileReader();
 reader.onloadend = () => {
 setIconBase64(reader.result as string);
 };
 reader.readAsDataURL(file);
 }
 };

 const handleEditIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (file) {
 const reader = new FileReader();
 reader.onloadend = () => {
 setEditIconBase64(reader.result as string);
 };
 reader.readAsDataURL(file);
 }
 };

 const handleEditApp = async (id: string) => {
 try {
 await updateAppHistory(id, { appName: editAppName, iconBase64: editIconBase64 });
 setEditingAppId(null);
 getAppHistory().then(setHistory);
 } catch(err) {
 console.error(err);
 }
 };

 const handleDeleteApp = async (id: string) => {
 try {
 await deleteAppHistory(id);
 getAppHistory().then(setHistory);
 } catch(err) {
 console.error(err);
 }
 };

 const filteredHistory = history.filter(app => app.appName.toLowerCase().includes(searchQuery.toLowerCase()) || app.repoName.toLowerCase().includes(searchQuery.toLowerCase()));

 const packageValid = packageName.trim() === '' || PACKAGE_RE.test(packageName.trim());
 const urlValid = url.trim() === '' || /^https?:\/\//i.test(url.trim()) || /^[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(url.trim());
 const repoValid = repoName.trim() === '' || (REPO_RE.test(repoName.trim()) && repoName.trim().length <= 100);
 const step2Valid = !!githubUsername.trim() && !!githubToken.trim() && !!repoName.trim() && repoValid;

 const openBuilder = () => {
 setShowLanding(false);
 setShowBuilder(true);
 setStep(1);
 };

 const openDashboard = () => {
 setShowLanding(false);
 setShowBuilder(false);
 };

 const handleBuild = async () => {
 setIsBuilding(true);
 setBuildError('');
 setArtifactStatus('');
 setStep(3);
 // Log awal datang dari worker (SSE) — jangan preset di sini supaya
 // baris "> Initializing Build Environment..." tidak tampil dua kali.
 setLogs([]);
 setBuildDone(false);
 setDownloadUrl('');
 setActionsUrl('');
 setRunUrl('');
 setLastBuildId(null);

 try {
 const response = await fetch('/api/build', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 appName: appName || 'My Awesome App',
 packageName: packageName || 'com.my.app',
 url: normalizeUrl(url) || 'https://example.com',
 githubUsername,
 githubToken,
 repoName: repoName || 'my-apk-repo',
 iconBase64
 })
 });

 if (!response.body) throw new Error("No response body");

 const reader = response.body.getReader();
 const decoder = new TextDecoder();

 while (true) {
 const { done, value } = await reader.read();
 if (done) break;

 const chunk = decoder.decode(value);
 const lines = chunk.split('\n');

 for (const line of lines) {
 if (line.startsWith('data: ')) {
 try {
 const parsed = JSON.parse(line.slice(6));
 if (parsed.message) {
 setLogs(prev => [...prev, parsed.message]);
 }
 if (parsed.done) {
 setBuildDone(true);
 setIsBuilding(false);
 if (parsed.actionsUrl) setActionsUrl(parsed.actionsUrl);
 if (parsed.runUrl) setRunUrl(parsed.runUrl);
 const entry: AppHistory = {
 id: Date.now().toString(),
 appName: appName || 'My Awesome App',
 packageName: packageName || 'com.my.app',
 repoName: repoName || 'my-apk-repo',
 downloadUrl: parsed.downloadUrl || '',
 createdAt: Date.now(),
 iconBase64,
 status: parsed.downloadUrl ? 'ready' : 'building',
 actionsUrl: parsed.actionsUrl || '',
 runUrl: parsed.runUrl || '',
 };
 setLastBuildId(entry.id);
 addAppHistory(entry).then(() => {
 getAppHistory().then(setHistory);
 });
 if (parsed.downloadUrl) {
 setDownloadUrl(parsed.downloadUrl);
 // Automatically trigger download
 window.location.href = parsed.downloadUrl;
 }
 }
 if (parsed.error) {
 setBuildError(parsed.error);
 setLogs(prev => [...prev, `ERROR: ${parsed.error}`]);
 setIsBuilding(false);
 }
 } catch(e) {}
 }
 }
 }
 } catch(err: any) {
 setBuildError(err.message);
 setLogs(prev => [...prev, `ERROR: ${err.message}`]);
 setIsBuilding(false);
 }
 };

 // Cek apakah artifact APK sudah tersedia di run GitHub Actions terakhir.
 // Dipanggil dari panel step 3 setelah workflow di-dispatch.
 const checkArtifact = async () => {
 if (!githubUsername || !githubToken || !repoName) return;
 setCheckingArtifact(true);
 setArtifactStatus('Memeriksa GitHub Actions...');
 try {
 const q = new URLSearchParams({ user: githubUsername, repo: repoName, token: githubToken });
 const res = await fetch(`/api/artifact?${q.toString()}`);
 const data = await res.json();
 if (!data.success) {
 setArtifactStatus(`Gagal memeriksa: ${data.error || 'unknown error'}`);
 } else if (data.found) {
 setDownloadUrl(data.downloadUrl);
 setArtifactStatus(`APK siap — ${(data.artifact.sizeInBytes / 1024 / 1024).toFixed(1)} MB. Mengunduh...`);
 if (lastBuildId) {
 await updateAppHistory(lastBuildId, { downloadUrl: data.downloadUrl, status: 'ready' });
 getAppHistory().then(setHistory);
 }
 window.location.href = data.downloadUrl;
 } else if (data.status === 'completed' && data.conclusion && data.conclusion !== 'success') {
 setArtifactStatus(`Build GAGAL (${data.conclusion}). Lihat log di GitHub Actions.`);
 if (lastBuildId) {
 await updateAppHistory(lastBuildId, { status: 'failed' });
 getAppHistory().then(setHistory);
 }
 } else if (data.status === 'no-run') {
 setArtifactStatus('Belum ada run — workflow mungkin belum mulai.');
 } else {
 setArtifactStatus(`Build masih ${data.status === 'in_progress' ? 'berjalan' : data.status} — coba lagi sebentar lagi.`);
 }
 } catch (err: any) {
 setArtifactStatus(`Gagal memeriksa: ${err.message}`);
 } finally {
 setCheckingArtifact(false);
 }
 };

 if (showBuilder) {
 return (
 <main className={`min-h-screen ${theme === 'dark' ? 'bg-[#000000] text-white' : 'bg-[#fafafa] text-black'} font-sans p-4 md:p-8 transition-colors duration-300`}>
 <div className="max-w-4xl mx-auto pt-4 md:pt-8">
 {/* Header */}
 <div className="mb-10 flex items-center justify-between">
 <div className="flex items-center gap-4">
 <button onClick={() => setShowBuilder(false)} className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'hover:bg-[#111] text-gray-400 hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-black'}`} aria-label="Kembali ke My Apps">
 <ArrowLeft className="w-5 h-5" />
 </button>
 <div>
 <h1 className={`text-2xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Create New App</h1>
 <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Transform your web project into a native Android app.</p>
 </div>
 </div>
 </div>

 {/* Layout splits into two cols on md */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
 {/* Left Sidebar Steps */}
 <div className="md:col-span-1 space-y-8 relative hidden md:block mt-2">
 <div className={`absolute top-0 bottom-0 left-3.5 w-px ${theme === 'dark' ? 'bg-[#222]' : 'bg-gray-200'} -z-10`} />
 {[
 { num: 1, label: 'App Details', desc: 'Configure application metadata' },
 { num: 2, label: 'GitHub Setup', desc: 'Connect to GitHub Actions' },
 { num: 3, label: 'Build Process', desc: 'Compile and download APK' }
 ].map(s => (
 <div key={s.num} className={`flex items-start gap-4 ${step > s.num ? 'opacity-50' : step < s.num ? 'opacity-40' : 'opacity-100'} transition-opacity`}>
 <div className={`w-7 h-7 shrink-0 mt-0.5 rounded-full flex items-center justify-center text-xs font-medium border ${step >= s.num ? (theme === 'dark' ? 'bg-white text-black border-white' : 'bg-black text-white border-black') : (theme === 'dark' ? 'bg-[#000] text-gray-500 border-[#333]' : 'bg-[#fafafa] text-gray-400 border-gray-200')} transition-colors`}>
 {step > s.num ? <Check className="w-4 h-4" /> : s.num}
 </div>
 <div>
 <div className={`font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{s.label}</div>
 <div className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>{s.desc}</div>
 </div>
 </div>
 ))}
 </div>

 {/* Main Content Area */}
 <div className={`md:col-span-2 rounded-2xl border ${theme === 'dark' ? 'bg-[#0a0a0a] border-[#222]' : 'bg-white border-gray-200'} shadow-sm overflow-hidden flex flex-col`}>
 <div className="p-6 md:p-8 flex-1">
 {step === 1 && (
 <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
 <div>
 <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>App Name</label>
 <input
 type="text"
 className={`w-full px-4 py-3 rounded-xl border-none focus:outline-none focus:ring-2 transition-all ${theme === 'dark' ? 'bg-[#111] text-white focus:ring-white/20 placeholder:text-gray-600' : 'bg-gray-50 text-gray-900 focus:ring-black/5 placeholder:text-gray-400'}`}
 placeholder="My Awesome App"
 value={appName}
 onChange={(e) => setAppName(e.target.value)}
 />
 </div>
 <div>
 <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Package Name</label>
 <input
 type="text"
 className={`w-full px-4 py-3 rounded-xl border-none focus:outline-none focus:ring-2 transition-all ${theme === 'dark' ? 'bg-[#111] text-white focus:ring-white/20 placeholder:text-gray-600' : 'bg-gray-50 text-gray-900 focus:ring-black/5 placeholder:text-gray-400'}`}
 placeholder="com.my.app"
 value={packageName}
 onChange={(e) => setPackageName(e.target.value)}
 />
 {!packageValid && (
 <p className="text-[11px] mt-2 text-red-500">Format package salah — contoh yang benar: com.example.aplikasiku (huruf kecil, minimal dua segmen dipisah titik).</p>
 )}
 {packageValid && packageName.trim() !== '' && (
 <p className={`text-[11px] mt-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>Package name dipakai sebagai application ID Android.</p>
 )}
 </div>
 <div>
 <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>App Icon (Optional)</label>
 <div className="flex items-center gap-4">
 <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center overflow-hidden shrink-0 ${theme === 'dark' ? 'bg-[#111] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
 {iconBase64 ? (
 <img src={iconBase64} alt="Icon Preview" className="w-full h-full object-cover" />
 ) : (
 <Smartphone className={`w-6 h-6 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
 )}
 </div>
 <div className="flex-1">
 <label className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium border rounded-xl cursor-pointer transition-colors ${theme === 'dark' ? 'bg-[#111] border-[#333] text-gray-300 hover:bg-[#222]' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
 <Upload className="w-4 h-4" /> Upload Icon
 <input type="file" className="hidden" accept="image/png, image/jpeg" onChange={handleImageUpload} />
 </label>
 <p className={`text-[11px] mt-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>PNG atau JPG (maks. ~1 MB), dipakai sebagai ikon launcher.</p>
 </div>
 </div>
 </div>
 <div>
 <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Target URL</label>
 <input
 type="url"
 className={`w-full px-4 py-3 rounded-xl border-none focus:outline-none focus:ring-2 transition-all ${theme === 'dark' ? 'bg-[#111] text-white focus:ring-white/20 placeholder:text-gray-600' : 'bg-gray-50 text-gray-900 focus:ring-black/5 placeholder:text-gray-400'}`}
 placeholder="https://your-website.com"
 value={url}
 onChange={(e) => setUrl(e.target.value)}
 />
 <p className={`text-[11px] mt-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>Aplikasi akan membuka URL ini di dalam WebView. Skema https:// ditambahkan otomatis bila tidak ditulis.</p>
 </div>
 </div>
 )}

 {step === 2 && (
 <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
 <div>
 <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>GitHub Username</label>
 <div className="relative">
 <Github className={`w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
 <input
 type="text"
 className={`w-full pl-11 pr-4 py-3 rounded-xl border-none focus:outline-none focus:ring-2 transition-all ${theme === 'dark' ? 'bg-[#111] text-white focus:ring-white/20 placeholder:text-gray-600' : 'bg-gray-50 text-gray-900 focus:ring-black/5 placeholder:text-gray-400'}`}
 placeholder="octocat"
 value={githubUsername}
 onChange={(e) => setGithubUsername(e.target.value)}
 />
 </div>
 </div>
 <div>
 <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Personal Access Token</label>
 <input
 type="password"
 className={`w-full px-4 py-3 rounded-xl border-none focus:outline-none focus:ring-2 transition-all ${theme === 'dark' ? 'bg-[#111] text-white focus:ring-white/20 placeholder:text-gray-600' : 'bg-gray-50 text-gray-900 focus:ring-black/5 placeholder:text-gray-400'}`}
 placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
 value={githubToken}
 onChange={(e) => setGithubToken(e.target.value)}
 />
 <div className={`p-4 rounded-xl border mt-3 flex items-start gap-3 ${theme === 'dark' ? 'bg-[#111] border-[#333]' : 'bg-gray-50 border-gray-100'}`}>
 <ShieldCheck className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
 <p className={`text-xs leading-relaxed ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
 Requires <span className={`font-semibold px-1 py-0.5 rounded ${theme === 'dark' ? 'bg-[#222] text-gray-300' : 'bg-gray-200 text-black'}`}>repo</span> and <span className={`font-semibold px-1 py-0.5 rounded ${theme === 'dark' ? 'bg-[#222] text-gray-300' : 'bg-gray-200 text-black'}`}>workflow</span> permissions. Token dikirim langsung ke GitHub API dan <span className="font-semibold">tidak pernah disimpan di server</span> — hanya tersimpan di browser kamu (IndexedDB) bila kamu menyimpannya di Settings.
 </p>
 </div>
 <p className={`text-[11px] mt-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>Buat token di GitHub → Settings → Developer settings → Personal access tokens (classic). Revoke kapan saja dari halaman yang sama.</p>
 </div>
 <div>
 <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Repository Name</label>
 <input
 type="text"
 className={`w-full px-4 py-3 rounded-xl border-none focus:outline-none focus:ring-2 transition-all ${theme === 'dark' ? 'bg-[#111] text-white focus:ring-white/20 placeholder:text-gray-600' : 'bg-gray-50 text-gray-900 focus:ring-black/5 placeholder:text-gray-400'}`}
 placeholder="my-apk-repo"
 value={repoName}
 onChange={(e) => setRepoName(e.target.value)}
 />
 {!repoValid && (
 <p className="text-[11px] mt-2 text-red-500">Nama repo hanya boleh huruf, angka, titik, underscore, dan strip.</p>
 )}
 <p className={`text-[11px] mt-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>Repo privat baru dibuat bila belum ada; bila sudah ada, isinya dipakai ulang dan file proyek ditimpa.</p>
 </div>
 </div>
 )}

 {step === 3 && (
 <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
 <div className="bg-[#0a0a0a] rounded-2xl p-5 font-mono text-[12px] h-80 overflow-y-auto text-gray-300 shadow-inner border border-[#222]">
 <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[#222] sticky top-0 bg-[#0a0a0a] z-10">
 <div className="flex gap-1.5">
 <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></div>
 <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></div>
 <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></div>
 </div>
 <span className="font-medium text-gray-500 tracking-wider text-[10px] uppercase flex items-center gap-2 ml-2">
 <Terminal className="w-3 h-3" /> TERMINAL
 </span>
 </div>

 <div className="space-y-2 pb-4">
 {logs.map((log, i) => (
 <div key={i} className={`flex gap-3 leading-relaxed ${log.includes('ERROR') ? 'text-red-400' : log.includes('✓') ? 'text-green-400' : log.includes('>') ? 'text-blue-300' : 'text-gray-300'}`}>
 <span className="text-gray-600 select-none font-bold shrink-0">›</span> <span className="break-words">{log}</span>
 </div>
 ))}
 {isBuilding && (
 <div className="flex items-center gap-3 text-gray-400 mt-4 py-1">
 <span className="text-gray-600 font-bold">›</span> <CircleDashed className="w-4 h-4 animate-spin" /> <span className="animate-pulse">Processing...</span>
 </div>
 )}
 <div ref={logsEndRef} />
 </div>
 </div>

 {buildError && (
 <div className={`p-5 rounded-2xl flex items-start gap-4 ${theme === 'dark' ? 'bg-[#2f0a0a] border border-[#4f1a1a]' : 'bg-red-50 border border-red-100'}`}>
 <X className={`w-5 h-5 mt-0.5 shrink-0 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`} />
 <div>
 <h4 className={`font-semibold ${theme === 'dark' ? 'text-red-400' : 'text-red-900'}`}>Build gagal dimulai</h4>
 <p className={`text-sm mt-0.5 ${theme === 'dark' ? 'text-red-500' : 'text-red-700'}`}>{buildError}</p>
 </div>
 </div>
 )}

 {buildDone && downloadUrl && (
 <div className={`p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center gap-4 animate-in fade-in slide-in-from-bottom-2 ${theme === 'dark' ? 'bg-[#002f1a] border border-[#004f2d]' : 'bg-green-50 border border-green-100'}`}>
 <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${theme === 'dark' ? 'bg-[#004f2d]' : 'bg-green-100'}`}>
 <CheckCircle2 className={`w-5 h-5 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`} />
 </div>
 <div className="flex-1">
 <h4 className={`font-semibold ${theme === 'dark' ? 'text-green-400' : 'text-green-900'}`}>APK siap diunduh</h4>
 <p className={`text-sm mt-0.5 ${theme === 'dark' ? 'text-green-500' : 'text-green-700'}`}>
 APK berhasil dibangun GitHub Actions dan siap diunduh.
 </p>
 </div>
 <a
 href={downloadUrl}
 className="inline-flex items-center justify-center gap-2 text-sm font-medium px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap w-full sm:w-auto mt-2 sm:mt-0 shadow-sm bg-green-600 text-white hover:bg-green-700"
 >
 Download APK <Download className="w-4 h-4" />
 </a>
 </div>
 )}

 {buildDone && !downloadUrl && (
 <div className={`p-5 rounded-2xl animate-in fade-in slide-in-from-bottom-2 ${theme === 'dark' ? 'bg-[#0a1a2f] border border-[#1a3a5f]' : 'bg-blue-50 border border-blue-100'}`}>
 <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
 <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${theme === 'dark' ? 'bg-[#1a3a5f]' : 'bg-blue-100'}`}>
 <RefreshCw className={`w-5 h-5 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
 </div>
 <div className="flex-1">
 <h4 className={`font-semibold ${theme === 'dark' ? 'text-blue-400' : 'text-blue-900'}`}>Build berjalan di GitHub Actions</h4>
 <p className={`text-sm mt-0.5 ${theme === 'dark' ? 'text-blue-500' : 'text-blue-700'}`}>
 Proyek Cordova sudah di-push dan workflow sudah di-dispatch. Build APK di runner GitHub biasanya makan 2–5 menit — tekan “Cek APK” untuk melihat apakah artifact-nya sudah jadi.
 </p>
 {artifactStatus && (
 <p className={`text-sm mt-2 font-medium ${theme === 'dark' ? 'text-blue-300' : 'text-blue-800'}`}>{artifactStatus}</p>
 )}
 </div>
 </div>
 <div className="flex flex-col sm:flex-row gap-3 mt-4">
 <button
 onClick={checkArtifact}
 disabled={checkingArtifact}
 className="inline-flex items-center justify-center gap-2 text-sm font-medium px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap shadow-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
 >
 {checkingArtifact ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
 {checkingArtifact ? 'Memeriksa...' : 'Cek APK'}
 </button>
 {actionsUrl && (
 <a
 href={actionsUrl}
 target="_blank"
 rel="noreferrer"
 className={`inline-flex items-center justify-center gap-2 text-sm font-medium px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap shadow-sm ${theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-gray-900 text-white hover:bg-black'}`}
 >
 View Actions <ArrowRight className="w-4 h-4" />
 </a>
 )}
 </div>
 </div>
 )}
 </div>
 )}
 </div>

 {/* Footer Actions */}
 <div className={`p-4 md:px-8 border-t flex justify-between items-center bg-transparent ${theme === 'dark' ? 'border-[#222]' : 'border-gray-200'}`}>
 {step > 1 && step < 3 ? (
 <button
 onClick={() => setStep(step - 1)}
 className={`px-5 py-2.5 text-sm font-medium border rounded-xl flex items-center gap-2 transition-colors ${theme === 'dark' ? 'bg-[#111] border-[#333] text-gray-300 hover:bg-[#222]' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
 >
 <ArrowLeft className="w-4 h-4" /> Back
 </button>
 ) : <div />}

 {step === 1 ? (
 <button
 onClick={() => setStep(2)}
 disabled={!packageValid || !urlValid}
 className={`px-6 py-2.5 text-sm font-medium rounded-xl flex items-center gap-2 ml-auto transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}`}
 >
 Next <ArrowRight className="w-4 h-4" />
 </button>
 ) : step === 2 ? (
 <button
 onClick={() => {
 saveSetting('githubUsername', githubUsername);
 saveSetting('githubToken', githubToken);
 handleBuild();
 }}
 disabled={!step2Valid}
 className={`px-6 py-2.5 text-sm font-medium rounded-xl flex items-center gap-2 ml-auto transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}`}
 >
 <Play className="w-4 h-4" /> Start Build
 </button>
 ) : (buildDone || buildError) ? (
 <button
 onClick={() => {
 setStep(1);
 setLogs([]);
 setBuildDone(false);
 setBuildError('');
 setDownloadUrl('');
 setShowBuilder(false);
 }}
 disabled={isBuilding}
 className={`px-5 py-2.5 text-sm font-medium border rounded-xl flex items-center gap-2 ml-auto transition-colors disabled:opacity-50 ${theme === 'dark' ? 'bg-[#111] border-[#333] text-gray-300 hover:bg-[#222]' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
 >
 Close <X className="w-4 h-4" />
 </button>
 ) : null}
 </div>
 </div>
 </div>
 </div>
 </main>
 );
 }

 if (showLanding) {
 return (
 <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#000000] text-white' : 'bg-[#f8f9fa] text-gray-900'} font-sans transition-colors duration-300`}>
 {/* Navbar */}
 <header className={`sticky top-0 z-40 backdrop-blur border-b ${theme === 'dark' ? 'bg-black/80 border-[#222]' : 'bg-white/80 border-gray-200'}`}>
 <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
 <button onClick={() => setShowLanding(true)} className="flex items-center gap-2.5" aria-label="APK Builder — beranda">
 <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white'}`}>
 <NinjaBLogo className="w-5 h-5" />
 </span>
 <span className="text-lg font-bold tracking-tight">APK Builder</span>
 </button>
 <nav className={`hidden md:flex items-center gap-8 text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
 <a href="#fitur" className={theme === 'dark' ? 'hover:text-white' : 'hover:text-black'}>Fitur</a>
 <a href="#cara-kerja" className={theme === 'dark' ? 'hover:text-white' : 'hover:text-black'}>Cara Kerja</a>
 <a href="#keamanan" className={theme === 'dark' ? 'hover:text-white' : 'hover:text-black'}>Keamanan</a>
 </nav>
 <div className="flex items-center gap-2">
 <button onClick={toggleTheme} className={`p-2 rounded-full ${theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-[#111]' : 'text-gray-500 hover:text-black hover:bg-gray-100'}`} aria-label="Ganti tema">
 {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
 </button>
 <a href={REPO_URL} target="_blank" rel="noreferrer" className={`p-2 rounded-full ${theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-[#111]' : 'text-gray-500 hover:text-black hover:bg-gray-100'}`} aria-label="Lihat di GitHub">
 <Github className="w-5 h-5" />
 </a>
 <button onClick={openBuilder} className={`hidden sm:inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full shadow-sm ${theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}`}>
 <Rocket className="w-4 h-4" /> Mulai Build
 </button>
 </div>
 </div>
 </header>

 {/* Hero */}
 <section className="max-w-6xl mx-auto px-4 pt-16 pb-12 md:pt-24 md:pb-20 grid md:grid-cols-2 gap-12 items-center">
 <div>
 <p className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border ${theme === 'dark' ? 'border-[#333] bg-[#111] text-gray-300' : 'border-gray-200 bg-white text-gray-600'}`}>
 <Zap className="w-3.5 h-3.5" /> GitHub Actions + Cordova — tanpa Android Studio
 </p>
 <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.1] mt-5">
 Ubah website jadi aplikasi Android.
 </h1>
 <p className={`text-lg mt-5 leading-relaxed ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
 Masukkan nama aplikasi dan URL website kamu. APK Builder membuat proyek Cordova, mem-build-nya di GitHub Actions, dan memberikan kamu file APK-nya — semua dari browser.
 </p>
 <div className="flex flex-wrap gap-3 mt-8">
 <button onClick={openBuilder} className={`inline-flex items-center gap-2 px-6 py-3.5 font-semibold rounded-full shadow-sm ${theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}`}>
 <Play className="w-5 h-5" /> Buat APK Pertama
 </button>
 <button onClick={openDashboard} className={`inline-flex items-center gap-2 px-6 py-3.5 font-semibold rounded-full border ${theme === 'dark' ? 'border-[#333] text-gray-200 hover:bg-[#111]' : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'}`}>
 <History className="w-5 h-5" /> My Apps
 </button>
 </div>
 <p className={`text-sm mt-4 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
 Gratis &amp; open source — build berjalan di akun GitHub kamu sendiri.
 </p>
 </div>

 {/* Preview produk */}
 <div className={`rounded-3xl border overflow-hidden shadow-xl ${theme === 'dark' ? 'bg-[#0a0a0a] border-[#222]' : 'bg-white border-gray-200'}`}>
 <div className={`flex items-center gap-2 px-4 py-3 border-b ${theme === 'dark' ? 'border-[#222]' : 'border-gray-100'}`}>
 <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></div>
 <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></div>
 <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></div>
 <span className={`ml-2 text-xs font-medium flex items-center gap-1.5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}><Terminal className="w-3.5 h-3.5" /> apk-builder.pages.dev</span>
 </div>
 <div className="bg-[#0a0a0a] p-5 font-mono text-[12px] leading-relaxed text-gray-300">
 <p><span className="text-gray-600 font-bold">›</span> <span className="text-blue-300">&gt; Initializing Build Environment...</span></p>
 <p><span className="text-gray-600 font-bold">›</span> <span className="text-green-400">✓ Repository octocat/my-apk-repo created.</span></p>
 <p><span className="text-gray-600 font-bold">›</span> <span className="text-green-400">✓ Pushed config.xml</span></p>
 <p><span className="text-gray-600 font-bold">›</span> <span className="text-green-400">✓ Pushed .github/workflows/build-apk.yml</span></p>
 <p><span className="text-gray-600 font-bold">›</span> <span className="text-blue-300">&gt; Dispatching GitHub Actions workflow...</span></p>
 <p><span className="text-gray-600 font-bold">›</span> <span className="text-green-400">✓ Workflow dispatched.</span></p>
 <p className="text-gray-500 mt-2">Build berjalan di GitHub Actions — APK muncul sebagai artifact.</p>
 </div>
 <div className={`flex items-center gap-3 px-5 py-4 ${theme === 'dark' ? 'bg-[#111]' : 'bg-gray-50'}`}>
 <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${theme === 'dark' ? 'bg-[#222] text-white' : 'bg-black text-white'}`}>
 <Smartphone className="w-5 h-5" />
 </span>
 <div className="flex-1 min-w-0">
 <p className={`font-semibold text-sm truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>My Awesome App</p>
 <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>com.my.app · my-apk-repo</p>
 </div>
 <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${theme === 'dark' ? 'bg-[#002f1a] text-green-400' : 'bg-green-100 text-green-700'}`}>
 <CheckCircle2 className="w-3.5 h-3.5" /> APK siap
 </span>
 </div>
 </div>
 </section>

 {/* Fitur */}
 <section id="fitur" className="max-w-6xl mx-auto px-4 py-12 md:py-16">
 <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Kenapa APK Builder?</h2>
 <p className={`mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Semua yang dibutuhkan untuk mengubah website jadi APK — tanpa instalasi apa pun di laptop kamu.</p>
 <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
 {[
 { icon: Zap, title: 'Tanpa Android Studio', desc: 'Build berjalan di runner GitHub Actions. Laptop kamu tidak perlu JDK, SDK, atau emulator.' },
 { icon: Github, title: 'Repo kamu sendiri', desc: 'Proyek Cordova di-push ke repo GitHub kamu — privat, milik kamu, bisa dilihat dan diubah kapan saja.' },
 { icon: Terminal, title: 'Log build live', desc: 'Setiap langkah — buat repo, push file, dispatch workflow — tampil di terminal secara real-time.' },
 { icon: Smartphone, title: 'Ikon & nama sendiri', desc: 'Nama aplikasi, package name, dan ikon launcher kamu sendiri, bukan bawaan template.' },
 { icon: History, title: 'Riwayat di perangkat', desc: 'Semua aplikasi yang pernah kamu build tersimpan di browser (IndexedDB) — bisa dicari, diubah, dan diunduh ulang.' },
 { icon: ShieldCheck, title: 'Token tidak ke server', desc: 'Personal Access Token hanya diteruskan ke api.github.com. Server tidak menyimpan atau mencatat token kamu.' },
 ].map(f => (
 <div key={f.title} className={`p-6 rounded-3xl border ${theme === 'dark' ? 'border-[#222] bg-[#0a0a0a]' : 'border-gray-100 bg-white'}`}>
 <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-4 ${theme === 'dark' ? 'bg-[#111] text-white' : 'bg-gray-100 text-black'}`}>
 <f.icon className="w-5 h-5" />
 </div>
 <h3 className="font-semibold">{f.title}</h3>
 <p className={`text-sm mt-1.5 leading-relaxed ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{f.desc}</p>
 </div>
 ))}
 </div>
 </section>

 {/* Cara kerja */}
 <section id="cara-kerja" className="max-w-6xl mx-auto px-4 py-12 md:py-16">
 <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Cara kerja</h2>
 <p className={`mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Tiga langkah, lima menit — sebagian besar waktu dihabiskan menunggu runner GitHub.</p>
 <div className="grid md:grid-cols-3 gap-4 mt-8">
 {[
 { num: '1', icon: FileCode, title: 'Isi detail aplikasi', desc: 'Nama aplikasi, package name (mis. com.toko.aplikasiku), ikon, dan URL website yang mau dibungkus.' },
 { num: '2', icon: Github, title: 'Sambungkan GitHub', desc: 'Username, Personal Access Token (scope repo + workflow), dan nama repo. Repo privat baru dibuat bila belum ada.' },
 { num: '3', icon: Package, title: 'Build & unduh APK', desc: 'Workflow Cordova di-dispatch di GitHub Actions. Begitu run selesai, tekan “Cek APK” dan unduh file APK-nya.' },
 ].map(s => (
 <div key={s.num} className={`p-6 rounded-3xl border relative ${theme === 'dark' ? 'border-[#222] bg-[#0a0a0a]' : 'border-gray-100 bg-white'}`}>
 <span className={`absolute top-5 right-6 text-4xl font-bold ${theme === 'dark' ? 'text-[#222]' : 'text-gray-100'}`}>{s.num}</span>
 <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-4 ${theme === 'dark' ? 'bg-[#111] text-white' : 'bg-gray-100 text-black'}`}>
 <s.icon className="w-5 h-5" />
 </div>
 <h3 className="font-semibold">{s.title}</h3>
 <p className={`text-sm mt-1.5 leading-relaxed ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{s.desc}</p>
 </div>
 ))}
 </div>
 <p className={`text-sm mt-6 flex items-start gap-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
 <LinkIcon className="w-4 h-4 mt-0.5 shrink-0" />
 Yang dihasilkan adalah APK debug (debug-signed) — siap install untuk testing. Untuk rilis ke Play Store, APK perlu di-sign dengan keystore release (lihat docs/build-flow.md).
 </p>
 </section>

 {/* Keamanan */}
 <section id="keamanan" className="max-w-6xl mx-auto px-4 py-12 md:py-16">
 <div className={`p-8 rounded-3xl border ${theme === 'dark' ? 'border-[#222] bg-[#0a0a0a]' : 'border-gray-100 bg-white'}`}>
 <div className="flex items-start gap-4">
 <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${theme === 'dark' ? 'bg-[#111] text-white' : 'bg-gray-100 text-black'}`}>
 <ShieldCheck className="w-5 h-5" />
 </div>
 <div>
 <h2 className="text-xl font-bold tracking-tight">Token kamu, kendali kamu</h2>
 <p className={`text-sm mt-2 leading-relaxed max-w-2xl ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
 APK Builder butuh Personal Access Token GitHub untuk membuat repo dan men-dispatch workflow atas nama kamu. Token itu dikirim dari browser kamu langsung ke api.github.com dan tidak pernah disimpan di server ini. Di browser, token hanya tersimpan di IndexedDB perangkat kamu bila kamu menyimpannya di Settings — dan bisa dicabut kapan saja dari GitHub → Settings → Developer settings → Personal access tokens.
 </p>
 <a href={`${REPO_URL}/blob/main/docs/security.md`} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 text-sm font-medium mt-3 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
 Baca dokumen keamanan <ExternalLink className="w-4 h-4" />
 </a>
 </div>
 </div>
 </div>
 </section>

 {/* CTA band */}
 <section className="max-w-6xl mx-auto px-4 pb-16 md:pb-24">
 <div className={`rounded-3xl p-8 md:p-12 text-center ${theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white'}`}>
 <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Website kamu, jadi aplikasi hari ini.</h2>
 <p className={`mt-2 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`}>Siapkan Personal Access Token GitHub (scope repo + workflow), lalu mulai.</p>
 <button onClick={openBuilder} className={`inline-flex items-center gap-2 px-6 py-3.5 font-semibold rounded-full mt-6 shadow-sm ${theme === 'dark' ? 'bg-black text-white hover:bg-gray-800' : 'bg-white text-black hover:bg-gray-200'}`}>
 Buat APK Sekarang <ChevronRight className="w-5 h-5" />
 </button>
 </div>
 </section>

 {/* Footer */}
 <footer className={`border-t ${theme === 'dark' ? 'border-[#222]' : 'border-gray-200'}`}>
 <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
 <div className="flex items-center gap-2.5">
 <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white'}`}>
 <NinjaBLogo className="w-4 h-4" />
 </span>
 <span className="font-bold">APK Builder</span>
 <span className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>— website jadi APK lewat GitHub Actions + Cordova.</span>
 </div>
 <div className={`flex items-center gap-6 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
 <a href={`${REPO_URL}/tree/main/docs`} target="_blank" rel="noreferrer" className={theme === 'dark' ? 'hover:text-white' : 'hover:text-black'}>Dokumentasi</a>
 <a href={`${REPO_URL}/blob/main/PRD.md`} target="_blank" rel="noreferrer" className={theme === 'dark' ? 'hover:text-white' : 'hover:text-black'}>PRD</a>
 <a href={REPO_URL} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 ${theme === 'dark' ? 'hover:text-white' : 'hover:text-black'}`}>
 <Github className="w-4 h-4" /> GitHub
 </a>
 </div>
 </div>
 <div className={`text-center text-xs pb-6 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`}>
 MIT License — dikembangkan oleh dezzorigin (Nabil Aulia Dika).
 </div>
 </footer>
 </div>
 );
 }

 return (
 <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#000000] text-white' : 'bg-[#f8f9fa] text-gray-900'} font-sans pb-24 transition-colors duration-300`}>
 {/* Header */}
 <header className="flex items-center justify-between px-4 pt-6 pb-6 max-w-5xl mx-auto">
 <div className="flex items-center gap-3">
 <button onClick={() => setShowLanding(true)} className={`p-2 rounded-full ${theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-[#111]' : 'text-gray-500 hover:text-black hover:bg-gray-100'}`} aria-label="Kembali ke beranda">
 <ArrowLeft className="w-5 h-5" />
 </button>
 <div className={`w-10 h-10 ${theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white'} rounded-xl flex items-center justify-center shadow-sm transition-colors`}>
 <NinjaBLogo className="w-6 h-6" />
 </div>
 <h1 className="text-2xl font-bold tracking-tight">My Apps</h1>
 </div>
 <div className={`flex items-center gap-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
 <button onClick={() => setShowSettings(true)} className={`p-2 rounded-full ${theme === 'dark' ? 'hover:text-white hover:bg-[#111]' : 'hover:text-black hover:bg-gray-100'} transition-colors`} aria-label="Settings">
 <Settings className="w-5 h-5" />
 </button>
 <button onClick={toggleTheme} className={`p-2 rounded-full ${theme === 'dark' ? 'hover:text-white hover:bg-[#111]' : 'hover:text-black hover:bg-gray-100'} transition-colors`} aria-label="Ganti tema">
 {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
 </button>
 <button onClick={() => setShowSearch(!showSearch)} className={`p-2 rounded-full ${theme === 'dark' ? 'hover:text-white hover:bg-[#111]' : 'hover:text-black hover:bg-gray-100'} transition-colors`} aria-label="Cari aplikasi">
 <Search className="w-5 h-5" />
 </button>
 </div>
 </header>

 {showSearch && (
 <div className="px-4 max-w-5xl mx-auto mb-6 animate-in fade-in slide-in-from-top-2">
 <div className="relative">
 <Search className={`w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
 <input
 type="text"
 placeholder="Search apps..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className={`w-full pl-10 pr-4 py-2.5 rounded-xl border-none focus:outline-none focus:ring-2 ${theme === 'dark' ? 'bg-[#111] text-white focus:ring-white/10 placeholder:text-gray-600' : 'bg-white text-gray-900 focus:ring-black/5 placeholder:text-gray-400'} shadow-sm transition-colors`}
 />
 </div>
 </div>
 )}

 {/* Categories */}
 <div className="flex items-center gap-3 px-4 mb-8 overflow-x-auto no-scrollbar max-w-5xl mx-auto">
 <button className={`px-5 py-2 ${theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white'} rounded-full text-sm font-medium whitespace-nowrap shadow-sm transition-colors`}>All</button>
 <button className={`px-5 py-2 ${theme === 'dark' ? 'bg-[#111] text-gray-300 border-[#222] hover:bg-[#222]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'} rounded-full text-sm font-medium whitespace-nowrap border transition-colors`}>Uncategorized</button>
 <button className={`px-5 py-2 ${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-black'} text-sm font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors`}>
 <Plus className="w-4 h-4"/> Add Category
 </button>
 </div>

 {/* Grid */}
 <div className="px-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-5xl mx-auto">
 {filteredHistory.length > 0 ? filteredHistory.map(app => (
 <div key={app.id} className={`p-4 rounded-3xl border ${theme === 'dark' ? 'border-[#222] bg-[#0a0a0a] shadow-[0_2px_15px_rgba(255,255,255,0.02)] hover:shadow-[0_4px_25px_rgba(255,255,255,0.04)]' : 'border-gray-100 bg-white shadow-[0_2px_15px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_25px_rgba(0,0,0,0.04)]'} flex items-center gap-4 transition-all relative group`}>

 {editingAppId === app.id ? (
 <div className="flex-1 min-w-0 flex flex-col gap-3">
 <div className="flex items-center gap-3">
 <label className={`w-14 h-14 rounded-2xl ${theme === 'dark' ? 'bg-[#111] border-[#333]' : 'bg-gray-50 border-gray-200'} flex items-center justify-center overflow-hidden shrink-0 border cursor-pointer hover:opacity-80 transition-opacity`}>
 {editIconBase64 ? (
 <img src={editIconBase64} alt={app.appName} className="w-full h-full object-cover"/>
 ) : app.iconBase64 ? (
 <img src={app.iconBase64} alt={app.appName} className="w-full h-full object-cover"/>
 ) : (
 <Upload className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
 )}
 <input type="file" className="hidden" accept="image/png, image/jpeg" onChange={handleEditIconUpload} />
 </label>
 <div className="flex-1">
 <input
 type="text"
 value={editAppName}
 onChange={(e) => setEditAppName(e.target.value)}
 className={`w-full px-3 py-1.5 text-sm rounded-lg border-none focus:outline-none focus:ring-2 ${theme === 'dark' ? 'bg-[#111] text-white focus:ring-white/20' : 'bg-gray-100 text-gray-900 focus:ring-black/10'}`}
 placeholder="App Name"
 />
 </div>
 </div>
 <div className="flex items-center gap-2">
 <button onClick={() => handleEditApp(app.id)} className={`flex-1 py-1.5 text-xs font-medium rounded-lg ${theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'} transition-colors`}>Save</button>
 <button onClick={() => setEditingAppId(null)} className={`flex-1 py-1.5 text-xs font-medium rounded-lg ${theme === 'dark' ? 'bg-[#222] text-white hover:bg-[#333]' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'} transition-colors`}>Cancel</button>
 </div>
 </div>
 ) : (
 <>
 {/* Icon */}
 <div className={`w-14 h-14 rounded-2xl ${theme === 'dark' ? 'bg-[#111] border-[#222]' : 'bg-gray-50 border-gray-100'} flex items-center justify-center overflow-hidden shrink-0 border`}>
 {app.iconBase64 ? (
 <img src={app.iconBase64} alt={app.appName} className="w-full h-full object-cover"/>
 ) : (
 <NinjaBLogo className={`w-6 h-6 ${theme === 'dark' ? 'text-white' : 'text-black'}`} />
 )}
 </div>
 {/* Info */}
 <div className="flex-1 min-w-0">
 <h3 className={`font-semibold text-sm truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{app.appName}</h3>
 <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'} truncate mb-1.5`}>{app.repoName}</p>
 <div className="flex items-center gap-1.5 flex-wrap">
 <span className={`inline-flex items-center gap-1 px-2 py-0.5 ${theme === 'dark' ? 'bg-[#111] border-[#222] text-gray-400' : 'bg-gray-50 border-gray-100 text-gray-500'} border rounded-md text-[10px] font-medium`}>
 <Globe className="w-3 h-3" /> Web
 </span>
 {app.status === 'building' && (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 border border-amber-200 rounded-md text-[10px] font-medium">
 <Loader2 className="w-3 h-3 animate-spin" /> Building…
 </span>
 )}
 {app.status === 'ready' && (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 border border-green-200 rounded-md text-[10px] font-medium">
 <CheckCircle2 className="w-3 h-3" /> APK siap
 </span>
 )}
 {app.status === 'failed' && (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 border border-red-200 rounded-md text-[10px] font-medium">
 <X className="w-3 h-3" /> Build gagal
 </span>
 )}
 </div>
 </div>
 {/* Action */}
 <div className="shrink-0 flex flex-col items-end justify-between self-stretch py-0.5">
 <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
 <button
 onClick={() => {
 setEditingAppId(app.id);
 setEditAppName(app.appName);
 setEditIconBase64(app.iconBase64 || '');
 }}
 className={`${theme === 'dark' ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-black'}`}
 aria-label={`Ubah ${app.appName}`}
 >
 <Edit2 className="w-4 h-4" />
 </button>
 <button
 onClick={() => handleDeleteApp(app.id)}
 className={`${theme === 'dark' ? 'text-gray-500 hover:text-red-400' : 'text-gray-400 hover:text-red-600'}`}
 aria-label={`Hapus ${app.appName} dari riwayat`}
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 {app.downloadUrl ? (
 <a href={app.downloadUrl} className={`w-7 h-7 rounded-full ${theme === 'dark' ? 'bg-[#111] hover:bg-[#222] border-[#333]' : 'bg-gray-50 hover:bg-gray-100 border-gray-100'} flex items-center justify-center border transition-colors`} aria-label={`Unduh APK ${app.appName}`}>
 <Download className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`} />
 </a>
 ) : app.actionsUrl ? (
 <a href={app.actionsUrl} target="_blank" rel="noreferrer" className={`w-7 h-7 rounded-full ${theme === 'dark' ? 'bg-[#111] hover:bg-[#222] border-[#333]' : 'bg-gray-50 hover:bg-gray-100 border-gray-100'} flex items-center justify-center border transition-colors`} aria-label={`Lihat GitHub Actions ${app.appName}`}>
 <ExternalLink className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`} />
 </a>
 ) : null}
 </div>
 </>
 )}
 </div>
 )) : (
 <div className="col-span-full py-20 flex flex-col items-center justify-center text-center">
 <div className={`w-20 h-20 ${theme === 'dark' ? 'bg-[#111] border-[#222]' : 'bg-gray-50 border-gray-100'} rounded-3xl flex items-center justify-center mb-4 border`}>
 <Terminal className={`w-8 h-8 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-300'}`} />
 </div>
 <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'} mb-1`}>No Apps Yet</h3>
 <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'} max-w-sm`}>Tap the Create App button below to build your first Android application.</p>
 </div>
 )}
 </div>

 {/* Bottom Bar */}
 <div className={`fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t ${theme === 'dark' ? 'from-[#000000] via-[#000000]' : 'from-[#f8f9fa] via-[#f8f9fa]'} to-transparent flex justify-center pb-8 pointer-events-none`}>
 <button onClick={openBuilder} className={`pointer-events-auto flex items-center gap-2 px-6 py-3.5 ${theme === 'dark' ? 'bg-white text-black border-transparent hover:bg-gray-200' : 'bg-white border-gray-100 hover:border-gray-200 text-black'} font-semibold rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all transform hover:-translate-y-0.5`}>
 <Plus className="w-5 h-5" /> Create App
 </button>
 </div>

 {/* Settings Modal */}
 {showSettings && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
 <div className={`w-full max-w-md p-6 rounded-3xl shadow-2xl ${theme === 'dark' ? 'bg-[#0a0a0a] border border-[#222]' : 'bg-white border border-gray-100'} relative animate-in zoom-in-95 duration-200`}>
 <button onClick={() => setShowSettings(false)} className={`absolute top-4 right-4 p-2 rounded-full ${theme === 'dark' ? 'hover:bg-[#222] text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-black'} transition-colors`} aria-label="Tutup settings">
 <X className="w-5 h-5" />
 </button>
 <h2 className={`text-xl font-bold mb-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Settings</h2>
 <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Save your GitHub credentials to build apps. Token hanya tersimpan di browser ini (IndexedDB), tidak pernah dikirim ke server kami.</p>

 <div className="space-y-4 mb-6">
 <div>
 <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>GitHub Username</label>
 <input
 type="text"
 value={githubUsername}
 onChange={(e) => setGithubUsername(e.target.value)}
 className={`w-full px-4 py-3 rounded-xl border-none focus:outline-none focus:ring-2 transition-all ${theme === 'dark' ? 'bg-[#111] text-white focus:ring-white/20 placeholder:text-gray-600' : 'bg-gray-50 text-gray-900 focus:ring-black/5 placeholder:text-gray-400'}`}
 placeholder="octocat"
 />
 </div>
 <div>
 <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Personal Access Token</label>
 <input
 type="password"
 value={githubToken}
 onChange={(e) => setGithubToken(e.target.value)}
 className={`w-full px-4 py-3 rounded-xl border-none focus:outline-none focus:ring-2 transition-all ${theme === 'dark' ? 'bg-[#111] text-white focus:ring-white/20 placeholder:text-gray-600' : 'bg-gray-50 text-gray-900 focus:ring-black/5 placeholder:text-gray-400'}`}
 placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
 />
 </div>
 </div>

 <button
 onClick={() => {
 saveSetting('githubUsername', githubUsername);
 saveSetting('githubToken', githubToken);
 setShowSettings(false);
 }}
 className={`w-full py-3 rounded-xl font-medium transition-colors ${theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}`}
 >
 Save Credentials
 </button>
 </div>
 </div>
 )}
 </div>
 );
}
