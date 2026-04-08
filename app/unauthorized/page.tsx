import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main id="main-content" className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-4xl mb-4">🔒</p>
        <h1 className="font-display font-800 text-2xl text-forge mb-2">Access Denied</h1>
        <p className="text-mist text-sm mb-6">You don&apos;t have permission to view this page.</p>
        <Link href="/" className="bg-amber text-forge font-display font-700 px-5 py-2.5 rounded-lg text-sm hover:bg-amber-dark transition-colors">
          Go Home
        </Link>
      </div>
    </main>
  );
}
