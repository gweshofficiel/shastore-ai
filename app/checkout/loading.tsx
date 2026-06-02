export default function CheckoutLoading() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950 sm:px-6 lg:px-8">
      <section className="mx-auto grid max-w-6xl gap-6">
        <div className="animate-pulse rounded-[2rem] bg-slate-900 p-6 shadow-2xl lg:p-8">
          <div className="h-3 w-32 rounded-full bg-white/20" />
          <div className="mt-5 h-12 w-full max-w-lg rounded-3xl bg-white/20" />
          <div className="mt-4 h-4 w-2/3 rounded-full bg-white/15" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="animate-pulse rounded-[2rem] border border-slate-200 bg-white p-6">
            <div className="h-5 w-40 rounded-full bg-slate-200" />
            <div className="mt-5 grid gap-3">
              <div className="h-12 rounded-2xl bg-slate-100" />
              <div className="h-12 rounded-2xl bg-slate-100" />
              <div className="h-12 rounded-2xl bg-slate-100" />
            </div>
          </div>
          <div className="animate-pulse rounded-[2rem] border border-slate-200 bg-white p-6">
            <div className="h-5 w-32 rounded-full bg-slate-200" />
            <div className="mt-5 h-28 rounded-3xl bg-slate-100" />
          </div>
        </div>
      </section>
    </main>
  );
}
