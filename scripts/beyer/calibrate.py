"""How closely the recognised Peters pieces match the LilyPond transcriptions of the same numbers.

Both are compared as played - repeats written out - hand by hand, each note as its pitch and the time
from its onset to the next, aligned so that one dropped note is one error rather than every note after
it. A note agrees when both match, and the rate is over whichever side has more notes, so a note
the recognition adds counts as much as one it drops; the pitch column ignores rhythm. The LilyPond files'
Nos. 10 and 11 are not the pieces Peters numbers 10 and 11, so they are left out.

Usage: python3 scripts/beyer/calibrate.py IMPORTED 8 9 12 13 ...   (IMPORTED is omr_import.py's OUT)
"""
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

from fingering import events_by_hand
from lilypond_import import OUT as LIBRARY
from omr_import import write_out_repeats

SEMITONES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def midi(note):
    return 12 * (int(note.findtext('pitch/octave')) + 1) + SEMITONES[note.findtext('pitch/step')] + int(
        note.findtext('pitch/alter') or 0)


def notes(root):
    """{hand: [(pitch, quarters to the next onset)]}, chords lowest note first."""
    by_hand = {}
    for hand, events in events_by_hand(root).items():
        onsets = [onset for onset, _ in events] + [None]
        by_hand[hand] = [(pitch, None if after is None else after - onset)
                         for (onset, chord), after in zip(events, onsets[1:])
                         for pitch in sorted(map(midi, chord))]
    return by_hand


def common(a, b):
    """The length of the longest common subsequence."""
    row = [0] * (len(b) + 1)
    for x in a:
        diagonal, row[0] = 0, 0
        for j, y in enumerate(b, 1):
            diagonal, row[j] = row[j], diagonal + 1 if x == y else max(row[j], row[j - 1])
    return row[-1]


def agreement(expected, recognised):
    """[notes expected, notes read, the larger of the two, agreeing in pitch and rhythm, agreeing in pitch],
    summed over the hands, so that no hand's added notes offset another's dropped ones."""
    counts = [0] * 5
    for hand in expected:
        a, b = expected[hand], recognised[hand]
        pitches = [pitch for pitch, _ in a], [pitch for pitch, _ in b]
        for i, count in enumerate((len(a), len(b), max(len(a), len(b)), common(a, b), common(*pitches))):
            counts[i] += count
    return counts


def row(label, counts):
    expected, read, most, agree, pitch = counts
    return f'{label:>4} {expected:>6} {read:>6} {agree / most:>6.1%} {pitch / most:>6.1%}'


def main(imported, numbers):
    total = [0] * 5
    print(f"{'No.':>4} {'notes':>6} {'read':>6} {'agree':>6} {'pitch':>6}")
    for number in numbers:
        name = f'beyer_op101_no{number:02}.musicxml'
        counts = agreement(notes(write_out_repeats(ET.parse(LIBRARY / name).getroot())),
                           notes(ET.parse(Path(imported) / name).getroot()))
        total = [t + c for t, c in zip(total, counts)]
        print(row(str(number), counts))
    print(row('all', total))


if __name__ == '__main__':
    main(sys.argv[1], [int(n) for n in sys.argv[2:]])
