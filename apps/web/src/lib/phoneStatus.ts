import type { HostBuzzers, HostState } from "@naija/contracts";

export function phoneStatus(s: HostState, data: HostBuzzers, fresh: boolean) {
  return ([0, 1] as const).map((team) => {
    const name = s.teams[team].members[s.turns[team]];
    const player = data.players.find(
      (p) => p.team === team && p.member === s.turns[team] && p.name === name,
    );
    let message = "Ready when buzzers open";
    let ready = false;
    if (!fresh) message = "Connection status unavailable";
    else if (!player) message = "No phone registered";
    else if (!player.approved) message = "Needs host approval";
    else if (player.onStage === false) message = "Not on stage";
    else if (player.connection === "offline") message = "Phone offline — reopen the game";
    else if (player.connection === "away") message = "App in background — return to the game";
    else if (s.paused) message = "Game paused";
    else if (s.phase !== "faceoff" || s.face.first !== null)
      message = "Waiting for the next face-off";
    else if (data.armed) {
      message = "Can buzz now";
      ready = true;
    }
    return { team, name: name ?? "Choose a player", message, ready };
  });
}
