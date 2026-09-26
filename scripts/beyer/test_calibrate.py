"""Run with: python3 -m unittest discover -s scripts/beyer"""
import unittest
import xml.etree.ElementTree as ET
from copy import deepcopy

from calibrate import LIBRARY, agreement, common, notes, row
from omr_import import write_out_repeats


def no_12():
    return write_out_repeats(ET.parse(LIBRARY / 'beyer_op101_no12.musicxml').getroot())


class Agreement(unittest.TestCase):
    def test_the_longest_common_subsequence(self):
        self.assertEqual(common('ABCBDAB', 'BDCABA'), 4)
        self.assertEqual(common('', 'AB'), 0)

    def test_a_piece_agrees_with_itself(self):
        expected = notes(no_12())

        total, read, most, agree, pitch = agreement(expected, notes(no_12()))

        self.assertEqual((read, most, agree, pitch), (total, total, total, total))

    def test_one_note_a_step_off_costs_one_note_of_pitch_and_nothing_else(self):
        recognised = no_12()
        next(recognised.iter('step')).text = 'D'

        total, read, most, agree, pitch = agreement(notes(no_12()), notes(recognised))

        self.assertEqual((read, total - agree, total - pitch), (total, 1, 1))

    def test_a_bar_the_recognition_plays_twice_counts_against_it(self):
        recognised = no_12()
        bar = deepcopy(recognised.find('part/measure'))
        recognised.find('part').append(bar)

        total, read, most, agree, pitch = agreement(notes(no_12()), notes(recognised))

        self.assertEqual(most, read)
        self.assertEqual(read, total + len(bar.findall('note/pitch')))
        self.assertEqual(pitch, total)

    def test_notes_one_piece_adds_do_not_offset_notes_another_drops(self):
        added, dropped = no_12(), no_12()
        added.find('part').append(deepcopy(added.find('part/measure')))
        dropped.find('part').remove(dropped.find('part/measure'))

        both = [a + b for a, b in zip(agreement(notes(no_12()), notes(added)),
                                      agreement(notes(no_12()), notes(dropped)))]

        expected, read, most, agree, _ = both
        self.assertGreater(most, max(expected, read))
        self.assertIn(f'{agree / most:.1%}', row('all', both))


if __name__ == '__main__':
    unittest.main()
