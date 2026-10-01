export function eventReadiness(input: {
  audienceConnections: number | null;
  boardConfirmed: boolean;
  soundEnabled: boolean;
  soundConfirmed: boolean;
  silentEvent: boolean;
  spokenAnswers: boolean;
  buzzerConnected: boolean;
  stagedTeams: number;
}) {
  return {
    display:
      input.audienceConnections !== null && input.audienceConnections > 0 && input.boardConfirmed,
    audio: input.silentEvent || (input.soundEnabled && input.soundConfirmed),
    contestants: input.spokenAnswers || (input.buzzerConnected && input.stagedTeams === 2),
  };
}
