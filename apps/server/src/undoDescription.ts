import type { Command, GameState } from "@naija/contracts";
/** Host-only description; never includes hidden answer text. */
export function undoDescription(state: GameState, command: Command): string {
  switch (command.type) {
    case "pause":
      return state.paused ? "Resume game" : "Pause game";
    case "buzz":
      return `Select ${state.teams[command.team].name} as first buzzer`;
    case "answer":
      return "Judge an answer and its score";
    case "miss":
      return "Add a strike";
    case "choice":
      return command.pass ? "Pass the board" : "Play the board";
    case "next":
      return "Advance to the next round or results";
    case "showAll":
      return "Reveal remaining answers";
    case "endGame":
      return "End the game";
    case "openQuestion":
      return "Reveal the question";
    case "audienceTheme":
      return "Change audience theme";
    case "audienceSound":
      return command.enabled ? "Enable audience sound" : "Mute audience sound";
    case "setJoinLock":
      return command.locked ? "Lock new player joins" : "Allow new player joins";
    case "turn":
      return "Change the active contestant";
    case "faceoffPlayer":
      return "Change the face-off contestant";
    case "roster":
      return "Change team rosters";
    case "fastStart":
      return "Start Fast Money";
    case "fastClock":
      return "Start the Fast Money timer";
    case "fastDuration":
      return `Set Fast Money timer to ${command.seconds} seconds`;
    case "fastAnswer":
      return `Record Fast Money answer ${command.question + 1}`;
    case "fastEndTurn":
      return "End the Fast Money turn";
    case "fastReveal":
      return "Reveal a Fast Money answer";
    case "fastNextPlayer":
      return "Bring in Fast Money player two";
    default:
      return "Previous game action";
  }
}
