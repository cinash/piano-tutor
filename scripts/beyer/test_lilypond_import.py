"""Run with: python3 -B -m unittest discover -s scripts/beyer"""
import unittest
import xml.etree.ElementTree as ET
from fractions import Fraction

from fingering import events_by_hand
from lilypond_import import OUT, to_musicxml
from test_fingering import HERE

GENERATED = {n: OUT / f'beyer_op101_no{n:02}.musicxml' for n in range(8, 32)}


def timeline(root):
    """{hand: [(onset, sorted (step, octave) pairs)]}"""
    return {
        hand: [(onset, sorted((n.findtext('pitch/step'), n.findtext('pitch/octave')) for n in notes))
               for onset, notes in events]
        for hand, events in events_by_hand(root).items()
    }


class GeneratedFiles(unittest.TestCase):
    def test_every_measure_is_full_on_both_staves(self):
        for number, path in GENERATED.items():
            root = ET.parse(path).getroot()
            divisions = int(root.findtext('.//divisions'))
            bar = Fraction(4 * int(root.findtext('.//beats')), int(root.findtext('.//beat-type')))
            for measure in root.iter('measure'):
                for staff in ('1', '2'):
                    with self.subTest(number=number, measure=measure.get('number'), staff=staff):
                        filled = sum(int(n.findtext('duration')) for n in measure.iter('note')
                                     if n.findtext('staff') == staff and n.find('chord') is None)
                        self.assertEqual(Fraction(filled, divisions), bar)

    def test_every_note_is_fingered(self):
        for number, path in GENERATED.items():
            with self.subTest(number=number):
                fingers = [n.findtext('notations/technical/fingering')
                           for n in ET.parse(path).getroot().iter('note') if n.find('pitch') is not None]
                self.assertTrue(fingers)
                self.assertTrue(all(f in ('1', '2', '3', '4', '5') for f in fingers))

    def test_nos_8_to_10_match_an_independent_transcription(self):
        for number in (8, 9, 10):
            with self.subTest(number=number):
                pdmx = ET.parse(HERE / f'fixtures/pdmx_beyer_no{number:02}.musicxml').getroot()
                self.assertEqual(timeline(ET.parse(GENERATED[number]).getroot()), timeline(pdmx))


class Reader(unittest.TestCase):
    def convert(self, upper, lower):
        return to_musicxml(f'\\relative c\' {{ {upper} }} \\relative c {{ {lower} }}', 0)

    def test_chords_ties_and_unfolded_repeats_stay_in_their_bars(self):
        root = self.convert("\\time 3/4 \\repeat unfold 2 { c4 d e | } g'2.~ | g |",
                            "\\time 3/4 <e g>2. | <e g> | c2.~ | c |")

        measures = root.findall('.//measure')
        self.assertEqual(len(measures), 4)
        lower = [(n.findtext('pitch/step') + n.findtext('pitch/octave'), n.find('chord') is not None)
                 for n in measures[0].iter('note') if n.findtext('staff') == '2']
        self.assertEqual(lower, [('E4', False), ('G4', True)])  # an octave above the source, as the book
        ties = [[t.get('type') for t in n.findall('tie')] for m in measures[2:] for n in m.iter('note')
                if n.findtext('staff') == '1']
        self.assertEqual(ties, [['start'], ['stop']])

    def test_a_misplaced_bar_check_stops_the_import(self):
        with self.assertRaisesRegex(ValueError, 'bar check'):
            self.convert('\\time 4/4 c4 d e |', '\\time 4/4 c1 |')


if __name__ == '__main__':
    unittest.main()
