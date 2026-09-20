# Manual checks

Things to verify by hand with the real Yamaha P-145. Keep this list to about ten items;
update it at the end of each step.

1. Plug the piano in via USB, open `http://localhost:5173` in Chrome **on the host**
   (not a LAN/tailnet address — Web MIDI needs a secure context), and confirm it appears
   in the "Piano" device dropdown.
2. Select it from the dropdown and confirm the status line reads "Connected: <device
   name>".
3. Play a single note and confirm the matching on-screen key highlights, and un-highlights
   when you release it. Then switch the keyboard to 88 keys and confirm it still tracks
   the right key, and that the on-screen keyboard now matches the P-145 under your hands.
   With nothing held, confirm the keys the app is waiting for are visibly marked, and that
   playing one of them leaves it marked until the whole chord is played. On a chord that
   uses both hands, confirm the hand colours match the hand you actually play each note
   with.
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
   the wrap point. Finally, mid-piece, press "Restart" and confirm playback returns to
   the first note with the piano still connected and the loop range unchanged. Then
   select "Left hand", play a short loop through, and confirm the right hand's notes are
   neither shown nor waited for; switch back to "Both hands" and confirm the attempt
   restarted and the full texture came back.
10. After a real practice session, close the tab and reopen
    `http://localhost:5173`; confirm the attempt is listed under "Attempts" and that
    its notes, wrong notes, accuracy and range read as a fair account of what was
    played. Then click "Download progress", open the deployed tailnet copy, import the
    downloaded file there, and confirm the history arrives intact.
11. Open the app beside your printed copy of Cicha Noc and read the staff against it:
    the same piece, the same key and time signature (no sharps or flats, 6/8), both
    hands' staves — treble over bass — and the same notes in the same bars. Nothing
    automated can do this: the e2e suite can only tell that _something_ was engraved.
