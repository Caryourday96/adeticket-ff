import type { ReactNode } from "react";
import { LayoutDashboard, Library, BookOpen, ArrowUpRight, Radio } from "lucide-react";
import { Brand } from "./Brand";
import { AlphaNotice } from "./AlphaNotice";
export function Layout({ children, active = "desk" }: { children: ReactNode; active?: string }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand-link" href="/" aria-label="Family Showdown home">
          <Brand />
        </a>
        <div className="nav-label">YOUR GAME NIGHT</div>
        <nav>
          <a className={active === "desk" ? "selected" : ""} href="/">
            <LayoutDashboard size={18} />
            Host desk
          </a>
          <a className={active === "library" ? "selected" : ""} href="/library">
            <Library size={18} />
            Question library
          </a>
          <a className={active === "surveys" ? "selected" : ""} href="/surveys">
            <BookOpen size={18} />
            Surveys
          </a>
          <a className={active === "rules" ? "selected" : ""} href="/rules">
            <BookOpen size={18} />
            How to play
          </a>
        </nav>
        <div className="sidebar-bottom">
          <div className="country-flags">
            <div className="flag" role="img" aria-label="Nigerian flag">
              <i />
              <i />
              <i />
            </div>
            <svg
              className="canadian-flag"
              viewBox="0 0 64 32"
              role="img"
              aria-label="Canadian flag"
            >
              <rect width="64" height="32" fill="#fff" />
              <path d="M0 0h16v32H0zM48 0h16v32H48z" fill="#d80621" />
              <path
                d="M32 4l3 6 3-2-1 8 4-4 1 3 5-1-2 5 2 1-9 6 1 3-6-1v4h-2v-4l-6 1 1-3-9-6 2-1-2-5 5 1 1-3 4 4-1-8 3 2z"
                transform="translate(3.2 0) scale(.9)"
                fill="#d80621"
              />
            </svg>
          </div>
          <p>A little competition.</p>
          <small>Made for your people.</small>
        </div>
      </aside>
      <div className="workspace">
        <AlphaNotice />
        <header className="topbar">
          <span>
            <Radio size={14} /> THE HOST'S CORNER
          </span>
          <a href="/play">
            Join as a player <ArrowUpRight size={15} />
          </a>
          <a href="/join">
            Join an audience screen <ArrowUpRight size={15} />
          </a>
        </header>
        {children}
        <footer className="footer">
          <a href="/privacy">Privacy and advertising</a>
          <span>FAMILY SHOWDOWN</span>
          <span>Sample game points · Unofficial home game</span>
        </footer>
      </div>
    </div>
  );
}
