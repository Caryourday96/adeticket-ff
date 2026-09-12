# Hosting a game

1. Open the main site, enter the host passphrase if configured, and name both teams.
2. Add and reorder members, then use the star to choose each captain.
3. Choose a question pack, winning target, shuffle setting, and steal-scoring preference.
4. Create the game. Open **Audience screen** and show the QR code or open the board on a TV.
5. Run each face-off: select who buzzed first, then click the matching answer or mark a miss.
6. Let the winning contestant play or pass. Continue in roster order.
7. After three strikes, take one final answer from the other team's captain. The server awards the bank.
8. Reveal remaining answers after settlement if desired, then advance.
9. After a team reaches the target, select two different members for Fast Money or skip the bonus.
10. For Fast Money, keep player two outside hearing until their turn. Read the first question, start the clock, and record answers using the question selector. Next/pass changes the current question without scoring. Return to passed questions before time expires.
11. End each timed turn and reveal scores one by one. The second player gets 25 seconds and cannot repeat the first player's answers.
12. Finish and celebrate. Saved games remain on the host desk.

## Correcting mistakes

Undo restores the prior state, including awarded points. Pause freezes gameplay and the Fast Money timer. Click a member in the lineup to correct the active turn during normal play. Edit rosters using the people icon; confirm the displayed note about removing the active member.

Shortcuts: **X** for a miss and **U** for undo, when not typing. All actions are also available as buttons.

## Devices

Only the host needs to sign in. Audience QR codes and links provide viewing access only. The audience screen supports fullscreen and shows the active contestant. On a small phone it scrolls naturally.

Use the network/public address in the host browser before sharing a QR code. A localhost URL is not reachable from a different device. On plain local HTTP, some browsers restrict clipboard, fullscreen, or UUID features; HTTPS deployment avoids these limitations.

## Rules preset

The default home-game preset uses a target of 300, multipliers of 1/1/2/3, and triple-point sudden death if needed. Successful steals include the stealing answer’s points, with the round multiplier applied. You can turn this off during setup. Previously saved games retain their chosen scoring rules. This is not advertised as a verified Nigerian official ruleset.

## Rehearsal and saved games

On the host desk, choose **Practise a round** or **Practise Fast Money**. Each creates a separate saved game with practice teams and a visible REHEARSAL label. The coach explains each phase. Open the normal phone buzzers, then use a simulated contestant button; suggestions let you practise judging correct answers and misses using the real scoring controls. Fast Money includes sample contestant responses, the real 20/25-second timers, passing, duplicates and reveals. Simulated buzzes exercise server rules, not real phone network latency.

The new-round and Fast Money rehearsal shortcuts create new practice games. They do not reset another game. Real phones can still join a rehearsal for a device test.

Saved games have **End game** and **Delete** controls. End keeps the score and history, stops the timer and awards no unfinished bank; Undo in the host dashboard can restore it. Delete permanently removes the selected game, its history and phone registrations after confirmation. Connected screens are notified. If the game has changed since the list loaded, refresh and retry. **Show all games** includes older sessions beyond the six recent games.

## Phone buzzer setup

Players open `/play/ROOM` from the host's Invite phones QR. They select a roster name and request approval. The host approves each registration and opens buzzers after reading the face-off question. Only the current face-off contestant from each team can buzz. Manual team buttons remain available as a fallback. Undo a mistaken buzz, then explicitly open buzzers again.

The first request received by the server wins; different network latency can affect the result. Keep phones awake on the player page. A localhost QR cannot work from another device: configure APP_ORIGIN to the reachable LAN address (or HTTPS deployment address), restart the server, and open the host at that address before sharing. The current passphrase-free local preview is for trusted rehearsal; configure HOST_PASSWORD before sharing host access.

Approval survives refresh and server restart. A restart locks buzzers. Removing a phone revokes its credential; roster name changes require removing and pairing that phone again. The audience QR remains viewing only.

## Required question groups

In game setup, select a minimum count beside each category in the chosen pack. Up to four questions can be required in total. These occupy the opening rounds in selection order. With shuffle enabled, questions within each category and the remaining queue are randomized without repeats. Changing packs clears the requirements.

Required rounds must finish before the game declares a champion. If a team reaches the target early, play continues through the required rounds; the higher-scoring team then wins. A tie continues play. With no required groups, the usual target-based finish remains in effect. Existing saved games retain their original schedule.

## Updated host desk

The private question and answer buttons appear before the audience preview. Scores, round bank, strikes, pause, and undo sit in the top toolbar. Audience preview, team roster controls, phone registrations, and manual buzzer fallback expand when needed.

Use number keys 1–8 to judge the corresponding ranked answer, X for a miss, and U for undo. Number shortcuts follow the displayed rank even when search filters the list. Shortcuts are ignored while typing, working in a modal, or holding a key down. Answer shortcuts obey the current phase and pause state. Search clears when the round changes.

## Phone status and Fast Money reliability

Phone registrations now show Screen active, App in background, or Offline / not responding separately from host approval. Status refreshes every five seconds; a phone is considered offline after 15 seconds without a heartbeat, so this is a recent-activity indicator rather than a guarantee of instant availability. Keep the player page visible during face-offs. Stale refresh responses cannot overwrite newer responses.

Fast Money now occupies the main host workspace. Select a board match to record it and move to the next unanswered question, or type an off-board response and press Enter. Pass skips to another unanswered question; numbered tabs allow corrections before time expires. Failed or duplicate answers stay on the current question. Recording all five answers ends the turn automatically. The server also ends expired turns even if the host page disconnects; paused turns remain paused. Host and audience clocks estimate server time through periodic synchronization.

The next roster improvement is stable player identities: editing roster names/order can still require phone pairing again. Real-phone latency testing and deployment setup remain outstanding.
