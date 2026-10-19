import { useEffect, useState } from "react";
type Drafts = Record<number, string>;
const prefix = "ff-fast-draft:";
export function useFastDrafts(
  game: string,
  scope: string | undefined,
  player: number,
  active: boolean,
  recorded: boolean[],
) {
  const key = scope && active ? `${prefix}${game}:${scope}:${player}` : null;
  const recordedKey = recorded.map(Boolean).join(",");
  const [saved, setSaved] = useState<{ key: string | null; drafts: Drafts }>({
    key: null,
    drafts: {},
  });
  const [available, setAvailable] = useState(true);
  useEffect(() => {
    let drafts: Drafts = {};
    try {
      // Remove obsolete turns for this game; never restore them after Undo.
      for (const old of Object.keys(sessionStorage)) {
        if (old.startsWith(`${prefix}${game}:`) && old !== key) sessionStorage.removeItem(old);
      }
      const raw = key && sessionStorage.getItem(key);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && typeof data === "object") {
          for (let i = 0; i < 5; i++)
            if (typeof data[i] === "string") drafts[i] = data[i].slice(0, 200);
        }
      }
    } catch {
      setAvailable(false);
    }
    recorded.forEach((done, i) => {
      if (done) delete drafts[i];
    });
    setSaved({ key, drafts });
  }, [key, game, recordedKey]);
  const drafts = saved.key === key ? saved.drafts : {};
  function update(change: (old: Drafts) => Drafts) {
    const next = change(drafts);
    setSaved({ key, drafts: next });
    if (key)
      try {
        sessionStorage.setItem(key, JSON.stringify(next));
      } catch {
        setAvailable(false);
      }
  }
  return { drafts, update, recoverable: !!key && available };
}
