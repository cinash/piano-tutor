# Manual checks

Things to verify by hand with the real Yamaha P-145. Keep this list under ten items;
update it at the end of each step.

1. Plug the piano in via USB, open `http://localhost:5173` in Chrome **on the host**
   (not a LAN/tailnet address — Web MIDI needs a secure context), and confirm it appears
   in the "Piano" device dropdown.
2. Select it from the dropdown and confirm the status line reads "Connected: <device
   name>".
3. Play a single note and confirm the matching on-screen key highlights, and un-highlights
   when you release it.
4. Play a quick run of notes and judge whether the on-screen response feels immediate —
   no perceptible lag between key press and highlight.
5. Unplug the USB cable while connected; confirm the app doesn't crash and the status
   returns to "Not connected".
6. Reconnect the cable and re-select the device from the dropdown; confirm it works
   again.
7. Click "Use computer keyboard" and confirm the mapped keys (Z X C V B N M and the row
   above, Q W E R T Y U) light up the correct on-screen keys.
8. Click "Start recording", play a short phrase, click "Stop recording & download", and
   confirm a `recording-*.json` file downloads containing the notes you played.
9. Play Cicha Noc through on the real piano and confirm the falling-note view and
   wait-mode behavior feel right — in particular, that a wrong note visibly does not
   advance the queue, and that waiting for the next note has no timeout. Then select a
   short loop range, play through it several times, and confirm it wraps back to the
   range's start correctly each time without losing that same "no timeout" behavior at
   the wrap point.
