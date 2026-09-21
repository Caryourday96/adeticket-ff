import type { ReactNode } from "react";
import { LayoutDashboard, Library, BookOpen, ArrowUpRight, Radio } from "lucide-react";
import { Brand } from "./Brand";
export function Layout({ children, active = "desk" }: { children: ReactNode; active?: string }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand-link" href="/" aria-label="Naija Family Showdown home">
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
          <div className="flag">
            <i />
            <i />
            <i />
          </div>
          <p>
            A little competition.
            <br />A whole lot of Naija.
          </p>
          <small>Made for your people.</small>
        </div>
      </aside>
      <div className="workspace">
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
          <span>NAIJA FAMILY SHOWDOWN</span>
          <span>Sample game points · Unofficial home game</span>
        </footer>
      </div>
    </div>
  );
}
