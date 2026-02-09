export const metadata = {
  title: 'Verify Commitment | IKPA',
  description: 'Verify a commitment as a referee',
};

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-sm">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">IK</span>
          </div>
          <span className="text-white font-semibold tracking-tight">IKPA</span>
          <span className="text-xs text-slate-400 ml-1">Referee Verification</span>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-lg mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
