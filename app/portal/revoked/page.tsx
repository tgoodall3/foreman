export default function PortalRevokedPage() {
  return (
    <main className="min-h-screen bg-forge flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-10 h-10 bg-amber rounded flex items-center justify-center">
              <span className="font-display font-800 text-forge text-xl">F</span>
            </div>
            <span className="font-display font-800 text-white text-3xl tracking-wide">FOREMAN</span>
          </div>
        </div>

        <div className="bg-forge-light border border-steel rounded-xl p-6 text-center">
          <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h1 className="font-display font-700 text-white text-xl mb-2">Portal access revoked</h1>
          <p className="text-mist text-sm leading-relaxed">
            Your portal access has been deactivated by your contractor. Contact them directly if you believe this is a mistake.
          </p>
        </div>
      </div>
    </main>
  );
}
