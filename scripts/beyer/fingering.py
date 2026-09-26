"""Five-finger-position fingering, the way Beyer's Op. 101 fingers its early pieces.

Each hand rests over five adjacent white-key steps, and a note's finger is its step inside that
window: the right hand counts 1 from the bottom, the left hand 5. A Viterbi pass picks the window
for every onset so that the hand moves as rarely as possible, and by as little as possible when it
has to. A finger already on a note - one the book prints - is kept, and fixes the window at that
onset. An onset no window fits - a chord wider than a fifth, or printed fingers no one window
agrees with - leaves its other notes unfingered, and they are returned rather than guessed.

Usage: python3 scripts/beyer/fingering.py IN.musicxml OUT.musicxml
"""
import sys
import xml.etree.ElementTree as ET
from fractions import Fraction

STEPS = 'CDEFGAB'
SHIFT = 10  # cost of moving the hand at all
PER_STEP = 1  # extra cost per step it moves


def diatonic(note):
    pitch = note.find('pitch')
    return 7 * int(pitch.findtext('octave')) + STEPS.index(pitch.findtext('step'))


def events_by_hand(root):
    """{'RH' | 'LH': [(onset in quarters, [pitched notes sounding then])]} in time order."""
    hands = {'RH': {}, 'LH': {}}
    for part in root.iter('part'):
        divisions, offset = 1, Fraction(0)
        for measure in part.iter('measure'):
            cursor = last = length = Fraction(0)
            for el in measure:
                if el.tag == 'attributes' and el.findtext('divisions'):
                    divisions = int(el.findtext('divisions'))
                elif el.tag in ('backup', 'forward'):
                    step = Fraction(int(el.findtext('duration')), divisions)
                    cursor += step if el.tag == 'forward' else -step
                elif el.tag == 'note' and el.find('grace') is None:
                    chord = el.find('chord') is not None
                    onset = last if chord else cursor
                    if not chord:
                        last = cursor
                        cursor += Fraction(int(el.findtext('duration')), divisions)
                    length = max(length, cursor)
                    if el.find('pitch') is not None:
                        hand = 'LH' if el.findtext('staff') == '2' else 'RH'
                        hands[hand].setdefault(offset + onset, []).append(el)
            offset += length
    return {hand: sorted(events.items()) for hand, events in hands.items()}


def printed_finger(note):
    text = note.findtext('notations/technical/fingering')
    return int(text) if text else None


def windows_for(notes, hand):
    """The windows that hold every note of an onset and put each printed finger on its note."""
    steps = [diatonic(note) for note in notes]
    windows = set(range(max(steps) - 4, min(steps) + 1))
    for note, step in zip(notes, steps):
        finger = printed_finger(note)
        if finger is not None:
            windows &= {step - finger + 1 if hand == 'RH' else step - 5 + finger}
    return sorted(windows)


def choose_windows(onsets):
    """[(the windows an onset may use, its lowest step)] -> the lowest step of the window for each."""
    move = lambda a, b: 0 if a == b else SHIFT + PER_STEP * abs(a - b)
    # tie-break: the window's bottom finger on the lowest note played
    fit = lambda b, low: 0.01 * abs(low - b)
    windows, low = onsets[0]
    cost = {b: fit(b, low) for b in windows}
    back = []
    for windows, low in onsets[1:]:
        came_from = {b: min(cost, key=lambda a: cost[a] + move(a, b)) for b in windows}
        cost = {b: cost[a] + move(a, b) + fit(b, low) for b, a in came_from.items()}
        back.append(came_from)
    b = min(cost, key=cost.get)
    path = [b]
    for came_from in reversed(back):
        b = came_from[b]
        path.append(b)
    return path[::-1]


def find_or_add(parent, tag):
    found = parent.find(tag)
    return found if found is not None else ET.SubElement(parent, tag)


def add_fingering(root):
    """Fingers every pitched note that has no finger yet; returns the notes no window reaches."""
    unreachable = []
    for hand, events in events_by_hand(root).items():
        onsets = [(notes, windows_for(notes, hand)) for _, notes in events]
        reachable = [(notes, windows) for notes, windows in onsets if windows]
        unreachable += [note for notes, windows in onsets if not windows
                        for note in notes if printed_finger(note) is None]
        if not reachable:
            continue
        path = choose_windows([(windows, min(map(diatonic, notes))) for notes, windows in reachable])
        for (notes, _), base in zip(reachable, path):
            for note in notes:
                if printed_finger(note) is None:
                    step = diatonic(note) - base
                    finger = step + 1 if hand == 'RH' else 5 - step
                    technical = find_or_add(find_or_add(note, 'notations'), 'technical')
                    find_or_add(technical, 'fingering').text = str(finger)
    return unreachable


if __name__ == '__main__':
    tree = ET.parse(sys.argv[1])
    unreachable = add_fingering(tree.getroot())
    if unreachable:
        print(f'{len(unreachable)} notes fit no five-finger window and are left unfingered', file=sys.stderr)
    tree.write(sys.argv[2], encoding='UTF-8', xml_declaration=True)
