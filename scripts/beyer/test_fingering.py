"""Run with: python3 -m unittest discover -s scripts/beyer"""
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

from fingering import add_fingering
from lilypond_import import OUT

HERE = Path(__file__).parent
# Human-fingered transcriptions from the PDMX dataset (MuseScore uploads, CC0): Nos. 8-10 finger
# the right hand only, No. 38 (committed with the data) fingers both hands.
HUMAN_FINGERED = [HERE / f'fixtures/pdmx_beyer_no{n:02}.musicxml' for n in (8, 9, 10)] + [
    HERE.parent.parent / 'beyer_op101_musicxml/beyer_op101_no38.musicxml',
]


class ReproducesHumanFingering(unittest.TestCase):
    def test_every_human_fingered_note_gets_the_same_finger(self):
        for path in HUMAN_FINGERED:
            with self.subTest(path.name):
                root = ET.parse(path).getroot()
                human = {}
                for note in root.iter('note'):
                    technical = note.find('notations/technical')
                    if technical is not None and technical.find('fingering') is not None:
                        human[note] = technical.findtext('fingering').strip()
                        technical.remove(technical.find('fingering'))
                self.assertTrue(human)

                add_fingering(root)
                computed = {note: note.findtext('notations/technical/fingering') for note in human}
                self.assertEqual(computed, human)

    def test_a_passage_narrower_than_a_fifth_starts_from_its_lowest_note(self):
        notes = ''.join(
            f'<note><pitch><step>{step}</step><octave>4</octave></pitch><duration>1</duration>'
            f'<staff>{staff}</staff></note>'
            for staff in (1, 2) for step in 'CDE')
        root = ET.fromstring(f'<score-partwise><part><measure>{notes}</measure></part></score-partwise>')

        add_fingering(root)

        fingers = [note.findtext('notations/technical/fingering') for note in root.iter('note')]
        self.assertEqual(fingers, ['1', '2', '3', '5', '4', '3'])


# The digits Edition Peters prints over Nos. 8 and 9 (p. 21), by bar, for its notes in document
# order - right hand then left - None where the book prints nothing.
PRINTED = {
    8: {'1': [1, 3, 1, 3, 2], '2': [5, None, None, None, 2], '9': [5, 2], '10': [3, 1]},
    9: {'1': [1, 3, 3, 3], '2': [3, 2, 1, 3], '3': [2], '4': [5], '17': [2], '18': [5], '19': [1], '20': [3]},
}


def bare(number):
    """The LilyPond No. 8 or 9 without its computed fingering."""
    root = ET.parse(OUT / f'beyer_op101_no{number:02}.musicxml').getroot()
    for technical in root.iter('technical'):
        technical.remove(technical.find('fingering'))
    return root


def with_printed_digits(number):
    """The LilyPond No. 8 or 9 fingered only where the book prints a digit."""
    root = bare(number)
    for measure in root.iter('measure'):
        for note, digit in zip(measure.iter('note'), PRINTED[number].get(measure.get('number'), [])):
            if digit is not None:
                ET.SubElement(note.find('notations/technical'), 'fingering').text = str(digit)
    return root


def fingers(root, staff=None):
    return [n.findtext('notations/technical/fingering') for n in root.iter('note')
            if staff is None or n.findtext('staff') == staff]


def scale_with(printed):
    """The right hand's C5-C6 scale, with fingers printed on the notes named: {index: finger}."""
    notes = ''.join(
        f'<note><pitch><step>{step}</step><octave>{octave}</octave></pitch><duration>1</duration><staff>1</staff>'
        + (f'<notations><technical><fingering>{printed[i]}</fingering></technical></notations>' if i in printed else '')
        + '</note>'
        for i, (step, octave) in enumerate(zip('CDEFGABC', '55555556')))
    return ET.fromstring(f'<score-partwise><part><measure>{notes}</measure></part></score-partwise>')


class PrintedFingersAreAnchors(unittest.TestCase):
    def test_the_left_hand_g_takes_the_books_finger_throughout(self):
        for number, finger in ((8, '2'), (9, '3')):
            with self.subTest(number=number):
                root = with_printed_digits(number)
                printed = fingers(root)

                self.assertEqual(add_fingering(root), [])

                self.assertTrue(all(after == before for before, after in zip(printed, fingers(root)) if before))
                self.assertEqual(set(fingers(root, '2')), {finger})

    def test_without_the_digits_the_rule_puts_the_little_finger_there(self):
        for number in (8, 9):
            with self.subTest(number=number):
                root = bare(number)

                add_fingering(root)

                self.assertEqual(set(fingers(root, '2')), {'5'})

    def test_a_thumb_passed_under_where_the_book_prints_it_is_followed(self):
        root = scale_with({0: 1, 3: 1})

        self.assertEqual(add_fingering(root), [])

        self.assertEqual(fingers(root), ['1', '2', '3', '1', '2', '3', '4', '5'])

    def test_a_move_the_book_does_not_print_is_returned_rather_than_guessed(self):
        root = scale_with({0: 1})
        notes = list(root.iter('note'))

        self.assertEqual(add_fingering(root), notes[5:])

        self.assertEqual(fingers(root), ['1', '2', '3', '4', '5', None, None, None])

    def test_notes_no_window_reaches_are_returned_unfingered(self):
        # a sixth in the right hand, and a C printed 1 beside an E printed 2 in the left
        root = ET.fromstring(
            '<score-partwise><part><measure>'
            '<note><pitch><step>C</step><octave>5</octave></pitch><duration>1</duration><staff>1</staff></note>'
            '<note><chord/><pitch><step>A</step><octave>5</octave></pitch><duration>1</duration><staff>1</staff></note>'
            '<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><staff>2</staff>'
            '<notations><technical><fingering>1</fingering></technical></notations></note>'
            '<note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><staff>2</staff>'
            '<notations><technical><fingering>2</fingering></technical></notations></note>'
            '<note><chord/><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><staff>2</staff></note>'
            '</measure></part></score-partwise>')
        notes = list(root.iter('note'))

        self.assertEqual(add_fingering(root), [notes[0], notes[1], notes[4]])

        self.assertEqual(fingers(root), [None, None, '1', '2', None])


if __name__ == '__main__':
    unittest.main()
