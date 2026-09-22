# Google Cast setup

The host's **Cast to TV** button launches a custom receiver at
`https://ff.kayodeadetunji.com/cast`.
It sends only a six-character room code. The TV opens the public audience feed directly
from Azure; host credentials, hidden answers and commands are never sent over Cast.
The existing audience board, scores, Fast Money timer and reconnect behavior are reused.

## Activation

1. Sign in at [Google Cast SDK Developer Console](https://cast.google.com/publish/).
   Google documents a $5 developer account registration fee; review the checkout before paying.
2. Add a **Custom Receiver** application named **Family Showdown**.
3. Set the receiver URL to `https://ff.kayodeadetunji.com/cast`.
   Leave audio-only device support off. Use the game website as the Web Sender URL.
4. Copy the application ID into Azure App Service **adeticket-ff → Environment variables**
   as `CAST_APP_ID`, then Apply. This ID is public configuration, not a password.
   No frontend rebuild is necessary; the host loads it through `/api/config`.
5. For an unpublished receiver, register the test TV/Cast device in the console.
   Follow Google's waiting/restart instructions. Publish the receiver after testing
   to make it available beyond registered devices.
6. Refresh the host dashboard in desktop Chrome, with the computer and TV on the same
   Wi-Fi, open **Audience** sharing and click **Cast to TV**. Choose a Google Cast-compatible display.

This web sender targets desktop Chrome. Safari/iPhone casting is not supported by this
implementation; native iOS sender support would be a separate feature. Apple TV and
AirPlay-only TVs are not Google Cast receivers.

## Behavior and verification

- No configured ID: the dashboard explains that TV casting awaits activation.
- SDK/browser/network failure: an explanatory message appears; hosting still works.
- Rejoining a Cast session resends the current room; changing rooms remounts the audience
  screen to avoid showing the prior game's answers while loading.
- **Stop casting** closes the TV receiver, without ending the game.
- The receiver accepts only room-selection messages, never arbitrary URLs or host actions.
- SDK media players are not loaded: this receiver renders a live board, not video.
- The receiver attempts to enable original game sound effects automatically. Device autoplay restrictions may prevent sound; a visible warning then appears. Use TV volume/mute controls. Confirm audio on real hardware before game night.

Automated checks cover message validation, public runtime configuration and SDK loading.
Hardware acceptance is still required: launch on the registered TV, reveal answers,
run a steal and Fast Money, reconnect the TV, change rooms, and stop casting.
Check the TV console for CSP/network errors and the board for overscan/clipping.
Do not describe device discovery or hardware casting as verified until this passes.

References: [registration](https://developers.google.com/cast/docs/registration),
[web sender](https://developers.google.com/cast/docs/web_sender/integrate),
[receiver options](https://developers.google.com/cast/docs/reference/web_receiver/cast.framework.CastReceiverOptions).

Production receiver ID: `0AF8BA4D` (public). The Azure deployment workflow applies this setting. To change or disable it, update that workflow; a portal-only change will be overwritten by the next deployment. Hardware acceptance is still pending.
