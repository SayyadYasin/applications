export const metadata = { title: 'Offline' };

export default function Offline() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="text-5xl" aria-hidden>📡</div>
      <h1 className="text-xl font-bold text-brand">You are offline</h1>
      <p className="text-gray-600">TownServices needs a connection to load this page. Check your network and try again.</p>
      <a href="/" className="rounded-xl bg-brand px-5 py-3 font-semibold text-white">Retry</a>
    </main>
  );
}
