import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main id="main-content" className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        </div>
        <h1 className="font-display font-800 text-2xl text-forge mb-2">Access Denied</h1>
        <p className="text-mist text-sm mb-6">You don&apos;t have permission to view this page.</p>
        <Link href="/" className="bg-amber text-forge font-display font-700 px-5 py-2.5 rounded-lg text-sm hover:bg-amber-dark transition-colors">
          Go Home
        </Link>
      </div>
    </main>
  );
}
