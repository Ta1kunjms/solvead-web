export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-slate-100">
      <div className="max-w-md space-y-4 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/30 backdrop-blur">
        <p className="text-sm uppercase tracking-[0.3em] text-sky-300">SolveAd</p>
        <h1 className="text-3xl font-semibold text-white">You are offline</h1>
        <p className="text-sm leading-6 text-slate-300">
          Reconnect to load your levels, progress, and account data. If you already opened the app before,
          some screens may still work from cache.
        </p>
      </div>
    </main>
  );
}