"""How closely the recognised Peters pieces match the LilyPond transcriptions of the same numbers.

Both are compared as played - repeats written out - hand by hand, each note as its pitch and the time
from its onset to the next, aligned so that one dropped note is one error rather than every note after
it. A recognised note agrees when both match; the pitch column ignores rhythm. The LilyPond files'
Nos. 10 and 11 are not the pieces Peters numbers 10 and 11, so they are left out.

Usage: python3 scripts/beyer/calibrate.py IMPORTED 8 9 12 13 ...   (IMPORTED is omr_import.py's OUT)
"""
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

from fingering import events_by_hand
from lilypond_import import OUT as LIBRARY
from omr_import import written_out

SEMITONES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def played(root):
    part = root.find('part')
    measures = written_out(part.findall('measure'))
    for measure in part.findall('measure'):
        part.remove(measure)
    part.extend(measures)
    return root


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
    """(notes expected, agreeing in pitch and rhythm, agreeing in pitch) over both hands."""
    counts = [0, 0, 0]
    for hand in expected:
        a, b = expected[hand], recognised[hand]
        counts[0] += len(a)
        counts[1] += common(a, b)
        counts[2] += common([pitch for pitch, _ in a], [pitch for pitch, _ in b])
    return counts


def main(imported, numbers):
    total = [0, 0, 0]
    print(f"{'No.':>4} {'notes':>6} {'agree':>6} {'pitch':>6}")
    for number in numbers:
        name = f'beyer_op101_no{number:02}.musicxml'
        counts = agreement(notes(played(ET.parse(LIBRARY / name).getroot())),
                           notes(ET.parse(Path(imported) / name).getroot()))
        total = [t + c for t, c in zip(total, counts)]
        print(f'{number:>4} {counts[0]:>6} {counts[1] / counts[0]:>6.1%} {counts[2] / counts[0]:>6.1%}')
    print(f"{'all':>4} {total[0]:>6} {total[1] / total[0]:>6.1%} {total[2] / total[0]:>6.1%}")


if __name__ == '__main__':
    main(sys.argv[1], [int(n) for n in sys.argv[2:]])
