export default function BottomBar() {
  return (
    <footer className="fixed bottom-0 left-0 w-full z-50 px-6 pb-8 pointer-events-none">
      <div className="max-w-screen-xl mx-auto flex justify-center">
        <button className="bg-[#00E5FF] text-[#0B0E11] w-full max-w-md py-4 flex items-center justify-center gap-2 pointer-events-auto font-headline font-bold shadow-[0_-8px_24px_rgba(0,229,255,0.2)] uppercase tracking-widest active:scale-[0.99] transition-all hover:brightness-110">
          <span className="material-symbols-outlined">share</span>
          Share View
        </button>
      </div>
    </footer>
  );
}
