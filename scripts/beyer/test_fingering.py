"""Run with: python3 -B -m unittest discover -s scripts/beyer"""
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

from fingering import add_fingering

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


if __name__ == '__main__':
    unittest.main()
