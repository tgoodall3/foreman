import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-forge flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center gap-2 mb-8">
          <div className="w-10 h-10 bg-amber rounded flex items-center justify-center">
            <span className="font-display font-800 text-forge text-xl">F</span>
          </div>
          <span className="font-display font-800 text-white text-3xl tracking-wide">FOREMAN</span>
        </div>

        <p className="font-display font-800 text-amber text-7xl mb-4">404</p>
        <h1 className="font-display font-800 text-white text-2xl mb-2">Page not found</h1>
        <p className="text-mist text-sm mb-8">
          This page doesn&apos;t exist or may have been moved.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="bg-amber hover:bg-amber-dark text-forge font-display font-700 px-5 py-2.5 rounded-lg text-sm transition-colors"
          >
            Go home
          </Link>
          <Link
            href="/login"
            className="text-mist hover:text-white text-sm font-600 transition-colors"
          >
            Sign in →
          </Link>
        </div>
      </div>
    </main>
  );
}
