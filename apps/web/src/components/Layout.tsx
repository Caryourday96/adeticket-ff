import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Library,
  BookOpen,
  ArrowUpRight,
  Radio,
  LogOut,
  Users,
} from "lucide-react";
import { Brand } from "./Brand";
import { AlphaNotice } from "./AlphaNotice";
import { useAccount } from "../pages/Account";
import { api, groupHref, selectedGroup } from "../lib/api";
export function Layout({
  children,
  active = "desk",
  groupId: gameGroup,
}: {
  children: ReactNode;
  active?: string;
  groupId?: string;
}) {
  const session = useAccount();
  const multiTenant = !!session?.multiTenant;
  const groupId = gameGroup ?? selectedGroup();
  const scopedHref = (path: string) => groupHref(path, groupId);
  const group = session?.groups?.find((item) => item.id === groupId);
  const canPrepare = !multiTenant || (!!group && !group.suspended && group.role !== "host");
  const globalLibrary = multiTenant && groupId === "global" && session?.user?.superAdmin;
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  return (
    <div className={`app-shell${multiTenant ? " multi-tenant" : ""}`}>
      <aside className="sidebar">
        <a
          className="brand-link"
          href={multiTenant ? "/dashboard" : "/"}
          aria-label="Friends Showdown home"
        >
          <Brand />
        </a>
        <div className="nav-label">YOUR GAME NIGHT</div>
        <nav>
          {multiTenant && (
            <a className={active === "platform" ? "selected" : ""} href={scopedHref("/dashboard")}>
              <Users size={18} />
              Groups and access
            </a>
          )}
          {canPrepare && (
            <a
              className={active === "desk" ? "selected" : ""}
              href={multiTenant ? scopedHref("/?setup=yes") : "/"}
            >
              <LayoutDashboard size={18} />
              Host desk
            </a>
          )}
          {(canPrepare || globalLibrary) && (
            <a className={active === "library" ? "selected" : ""} href={scopedHref("/library")}>
              <Library size={18} />
              Question library
            </a>
          )}
          {canPrepare && (
            <a className={active === "surveys" ? "selected" : ""} href={scopedHref("/surveys")}>
              <BookOpen size={18} />
              Surveys
            </a>
          )}
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
            <Radio size={14} />{" "}
            {multiTenant
              ? (group?.name ?? (globalLibrary ? "SHARED QUESTION LIBRARY" : "YOUR GROUPS"))
              : "THE HOST'S CORNER"}
          </span>
          <a href="/play">
            Join as a player <ArrowUpRight size={15} />
          </a>
          <a href="/join">
            Join an audience screen <ArrowUpRight size={15} />
          </a>
          {session?.authenticated && (
            <button
              className="button small account-signout"
              disabled={signingOut}
              onClick={async () => {
                setSigningOut(true);
                setLogoutError("");
                try {
                  await api("/logout", {});
                  location.assign("/");
                } catch (error) {
                  setLogoutError((error as Error).message);
                  setSigningOut(false);
                }
              }}
            >
              <LogOut size={15} />
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          )}
        </header>
        {multiTenant && (
          <div className="account-context">
            <span>{session.user?.email}</span>
            <span>
              {group
                ? `${group.name} · ${group.role === "owner" ? "Super admin" : group.role === "admin" ? "Group admin" : "Game host"}`
                : globalLibrary
                  ? "Shared library · Super admin"
                  : "Choose a group to manage its games"}
            </span>
          </div>
        )}
        {logoutError && (
          <p className="error account-context" role="alert">
            Sign-out was not confirmed. {logoutError}
          </p>
        )}
        {children}
        <footer className="footer">
          <a href="/privacy">Privacy and advertising</a>
          <span>FRIENDS SHOWDOWN</span>
          <span>Sample game points · Unofficial home game</span>
        </footer>
      </div>
    </div>
  );
}
