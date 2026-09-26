"""Run with: python3 -m unittest discover -s scripts/beyer"""
import unittest
import xml.etree.ElementTree as ET
from copy import deepcopy

from calibrate import LIBRARY, agreement, common, notes
from omr_import import write_out_repeats


def no_12():
    return write_out_repeats(ET.parse(LIBRARY / 'beyer_op101_no12.musicxml').getroot())


class Agreement(unittest.TestCase):
    def test_the_longest_common_subsequence(self):
        self.assertEqual(common('ABCBDAB', 'BDCABA'), 4)
        self.assertEqual(common('', 'AB'), 0)

    def test_a_piece_agrees_with_itself(self):
        expected = notes(no_12())

        total, read, agree, pitch = agreement(expected, notes(no_12()))

        self.assertEqual((read, agree, pitch), (total, total, total))

    def test_one_note_a_step_off_costs_one_note_of_pitch_and_nothing_else(self):
        recognised = no_12()
        next(recognised.iter('step')).text = 'D'

        total, read, agree, pitch = agreement(notes(no_12()), notes(recognised))

        self.assertEqual((read, total - agree, total - pitch), (total, 1, 1))

    def test_a_bar_the_recognition_plays_twice_counts_against_it(self):
        recognised = no_12()
        bar = deepcopy(recognised.find('part/measure'))
        recognised.find('part').append(bar)

        total, read, agree, pitch = agreement(notes(no_12()), notes(recognised))

        self.assertEqual(read, total + len(bar.findall('note/pitch')))
        self.assertEqual(pitch, total)


if __name__ == '__main__':
    unittest.main()
