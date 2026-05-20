export default function PublicStoreLoading() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl animate-pulse">
        <div className="flex items-center justify-between border-b border-white/10 pb-5">
          <div className="h-10 w-40 rounded-full bg-white/10" />
          <div className="hidden h-10 w-32 rounded-full bg-white/10 sm:block" />
        </div>
        <div className="grid gap-8 py-16 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="h-4 w-36 rounded-full bg-white/10" />
            <div className="mt-6 h-16 w-full max-w-xl rounded-3xl bg-white/10" />
            <div className="mt-4 h-16 w-3/4 rounded-3xl bg-white/10" />
            <div className="mt-8 h-12 w-44 rounded-full bg-white/10" />
          </div>
          <div className="aspect-[4/5] rounded-[3rem] bg-white/10" />
        </div>
      </div>
    </main>
  );
}
