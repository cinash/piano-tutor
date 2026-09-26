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
   With nothing held, confirm the keys the app is waiting for are visibly marked. The
   hands take this arrangement's melody in turn, so confirm the marked key's colour
   follows the hand you are meant to play it with — the right hand in bars 1-2, the left
   in its echo in bars 3-4, marked to the left of where the right hand played bars 1-2.
   Bar 19 is the one place both hands play at once: confirm its C5 and C3 are marked in
   different colours, and that playing one leaves it marked until the other follows.
4. Play a quick run of notes and judge whether the on-screen response feels immediate —
   no perceptible lag between key press and highlight.
5. Unplug the USB cable while connected; confirm the app doesn't crash and the status
   returns to "Not connected".
6. Reconnect the cable and re-select the device from the dropdown; confirm it works
   again.
7. Click "Use computer keyboard" and confirm the mapped keys (Z X C V B N M and the row
   above, Q W E R T Y U I O P and the bracket beside it) light up the correct on-screen
   keys.
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
   restarted and the full texture came back. Then press "Listen" and confirm the piano
   itself plays Cicha Noc while the on-screen keys light up in time with it — expect a
   thinner texture than the printed music, since one event sounds at a time (see
   `DECISIONS.md`). Set "Speed" to 50% and say whether it is slow enough for a child to
   follow along, then to 150% and confirm repeated notes are still heard as separate
   notes rather than as one smeared note. Change the speed while the demo plays, and say
   whether a child is confused that it is only heard from the next "Listen".
   Press "Stop" mid-piece and confirm the instrument falls silent at once, with no note
   left sounding, and that "Attempts" gained nothing from the demonstration. With the piano
   selected in the dropdown the demo plays out of the output of that same name, and
   `Midi Through` sitting in the port list beside the two `Digital Piano` ports no longer
   stops any of it. Watch the staff while it plays: the green cursor should move along
   with the demo and be on the bar being played, and "Stop" should put it back on the note
   practice was waiting for.
10. After a real practice session, close the tab and reopen
    `http://localhost:5173`; confirm the attempt is listed under "Attempts" and that
    its notes, wrong notes, accuracy and range read as a fair account of what was
    played. Then click "Download progress", open the deployed tailnet copy, import the
    downloaded file there, and confirm the history arrives intact.
11. Open the app beside your own copy of Cicha Noc and read the staff against it: the
    same key and time signature (no sharps or flats, 3/4), both hands' staves — treble
    over bass — and the same notes, with the same fingerings, in the same bars. Bars 9-12
    are written out twice rather than carrying a repeat sign, so your bars 13-18 are the
    app's 17-22. The file differs from your ABC in three ways, on purpose, so that the
    left hand plays below the right as a beginner arrangement writes it: the left hand is
    in bass clef rather than treble, an octave lower, and its fingering in bars 19-22 reads
    5 / 1 3 / 1 2 4 / 5, a left-hand C position, where your ABC had right-hand fingering.
    Say whether the lower echo sounds right and whether that fingering sits well under the
    hand. Nothing automated can do this: the e2e suite can only tell that _something_ was
    engraved.
    Then play a few bars on the real piano and read the cursor the same way: it should
    sit on the note you are being asked for, still sit on the right one several bars
    later rather than having slipped a note, and go back to the beginning on Restart and
    at every wrap of the loop. The staff should be one line, none of it cut off at the
    bottom, and the cursor should settle about a third of the way across while the music
    glides past it, with several notes always visible ahead. Say whether the marker's
    hop-then-slide on each note reads well or whether an instant jump would be calmer, and
    whether the glide trails the cursor visibly when Listen plays at 150%.
    Then tick "Hide the finger queue" and confirm the staff and the on-screen keyboard
    are both visible at once without scrolling — which is the whole point of the control
    — that playing the piece still behaves exactly as it did with the queue showing, and
    that closing the tab and reopening `http://localhost:5173` brings it back still
    hidden.

Close the browser tab before using `amidi` or `aplaymidi` on the host, and quit those
before going back to the browser: a page holding a Web MIDI port locks the ALSA device,
and whichever side comes second reports `Device or resource busy`.
