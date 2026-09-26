"""Five-finger-position fingering, the way Beyer's Op. 101 fingers its early pieces.

Each hand rests over five adjacent white-key steps, and a note's finger is its step inside that
window: the right hand counts 1 from the bottom, the left hand 5. A Viterbi pass picks the window
for every onset so that the hand moves as rarely as possible, and by as little as possible when it
has to. A chord wider than a fifth fits no window and raises.

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


def choose_windows(events):
    """The lowest step of the five-step window for each event."""
    spans = [(min(map(diatonic, notes)), max(map(diatonic, notes))) for notes in events]
    if any(high - low > 4 for low, high in spans):
        raise ValueError('a chord wider than a fifth fits no five-finger window')
    bases = range(min(low for low, _ in spans) - 4, max(high for _, high in spans) + 1)
    move = lambda a, b: 0 if a == b else SHIFT + PER_STEP * abs(a - b)
    cost = {b: 0 for b in bases}
    back = []
    for low, high in spans:
        new, came_from = {}, {}
        for b in bases:
            if not b <= low <= high <= b + 4:
                new[b] = float('inf')
                continue
            prev = min(bases, key=lambda a: cost[a] + move(a, b))
            # tie-break: the window's bottom finger on the lowest note played
            new[b] = cost[prev] + move(prev, b) + 0.01 * abs(low - b)
            came_from[b] = prev
        back.append(came_from)
        cost = new
    b = min(bases, key=lambda a: cost[a])
    path = []
    for came_from in reversed(back):
        path.append(b)
        b = came_from[b]
    return path[::-1]


def child(parent, tag):
    found = parent.find(tag)
    return found if found is not None else ET.SubElement(parent, tag)


def add_fingering(root):
    """Sets <technical><fingering> on every pitched note."""
    for hand, events in events_by_hand(root).items():
        if not events:
            continue
        chords = [notes for _, notes in events]
        for notes, base in zip(chords, choose_windows(chords)):
            for note in notes:
                step = diatonic(note) - base
                finger = step + 1 if hand == 'RH' else 5 - step
                child(child(child(note, 'notations'), 'technical'), 'fingering').text = str(finger)


if __name__ == '__main__':
    tree = ET.parse(sys.argv[1])
    add_fingering(tree.getroot())
    tree.write(sys.argv[2], encoding='UTF-8', xml_declaration=True)
