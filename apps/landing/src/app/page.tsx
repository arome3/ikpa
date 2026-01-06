export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-primary-500 to-primary-700">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">Ikpa</h1>
        <p className="text-xl md:text-2xl text-primary-100 mb-4 max-w-2xl">
          AI-Powered Personal Finance Co-Pilot for Young Africans
        </p>
        <p className="text-lg text-primary-200 mb-12 max-w-xl">
          See your money clearly. Understand it deeply. Plan it wisely.
        </p>

        {/* Waitlist Form Placeholder */}
        <div className="w-full max-w-md">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-4 py-3 rounded-lg text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button className="px-6 py-3 bg-accent text-white font-semibold rounded-lg hover:bg-accent/90 transition-colors">
              Join Waitlist
            </button>
          </div>
          <p className="text-sm text-primary-200 mt-3">
            Join 1,000+ Africans waiting for financial clarity
          </p>
        </div>
      </section>
    </main>
  );
}
