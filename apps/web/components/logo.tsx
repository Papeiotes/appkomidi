export function Logo({ word = true, className = "" }: { word?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="9" fill="#1b7f4a" />
        <path d="M16 6.5c2.2 2.4 3.2 3.8 3.2 5.6h-6.4c0-1.8 1-3.2 3.2-5.6z" fill="#d9f5e4" />
        <path d="M8 13.2h16v2.1H8z" fill="#ffffff" />
        <path d="M9.4 15.3h13.2l-1.3 9.2H10.7l-1.3-9.2z" fill="#ffffff" />
      </svg>
      {word ? <span className="text-lg font-semibold tracking-tight text-primary">APPkomidi</span> : null}
    </span>
  );
}
