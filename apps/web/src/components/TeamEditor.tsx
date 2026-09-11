import { Plus, Trash2, ArrowUp, ArrowDown, Star } from "lucide-react";
import type { Team } from "@naija/contracts";
export function TeamEditor({
  team,
  index,
  onChange,
}: {
  team: Team;
  index: number;
  onChange: (t: Team) => void;
}) {
  const update = (member: number, value: string) =>
    onChange({ ...team, members: team.members.map((m, i) => (i === member ? value : m)) });
  const move = (i: number, d: number) => {
    const members = [...team.members];
    [members[i], members[i + d]] = [members[i + d], members[i]];
    onChange({
      ...team,
      members,
      captain: team.captain === i ? i + d : team.captain === i + d ? i : team.captain,
    });
  };
  return (
    <section className="team-editor">
      <div className="section-eyebrow">
        <span className={"team-dot team-" + index} />
        {index === 0 ? "TEAM ONE" : "TEAM TWO"}
      </div>
      <label>
        Team name
        <input
          maxLength={100}
          value={team.name}
          onChange={(e) => onChange({ ...team, name: e.target.value })}
          placeholder={index === 0 ? "The Jollof Squad" : "The Suya Crew"}
        />
      </label>
      <div className="roster-heading">
        <span>Team members</span>
        <small>★ selects the captain</small>
      </div>
      <div className="roster-list">
        {team.members.map((m, i) => (
          <div className="roster-row" key={i}>
            <span className="member-number">{String(i + 1).padStart(2, "0")}</span>
            <input
              aria-label={"Team " + (index + 1) + " member " + (i + 1)}
              maxLength={100}
              value={m}
              onChange={(e) => update(i, e.target.value)}
              placeholder="Member name"
            />
            <button
              type="button"
              className={"icon-button " + (team.captain === i ? "gold" : "")}
              aria-label={"Make member " + (i + 1) + " captain"}
              onClick={() => onChange({ ...team, captain: i })}
            >
              <Star size={15} fill={team.captain === i ? "currentColor" : "none"} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Move member up"
              disabled={i === 0}
              onClick={() => move(i, -1)}
            >
              <ArrowUp size={13} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Move member down"
              disabled={i === team.members.length - 1}
              onClick={() => move(i, 1)}
            >
              <ArrowDown size={13} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Remove member"
              disabled={team.members.length === 1}
              onClick={() =>
                onChange({
                  ...team,
                  members: team.members.filter((_, n) => n !== i),
                  captain:
                    team.captain === i ? 0 : team.captain > i ? team.captain - 1 : team.captain,
                })
              }
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="text-button"
        disabled={team.members.length >= 12}
        onClick={() => onChange({ ...team, members: [...team.members, ""] })}
      >
        <Plus size={16} />
        Add member
      </button>
    </section>
  );
}
