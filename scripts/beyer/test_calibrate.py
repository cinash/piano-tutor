"""Run with: python3 -m unittest discover -s scripts/beyer"""
import unittest
import xml.etree.ElementTree as ET

from calibrate import LIBRARY, agreement, common, notes, played


def no_12():
    return played(ET.parse(LIBRARY / 'beyer_op101_no12.musicxml').getroot())


class Agreement(unittest.TestCase):
    def test_the_longest_common_subsequence(self):
        self.assertEqual(common('ABCBDAB', 'BDCABA'), 4)
        self.assertEqual(common('', 'AB'), 0)

    def test_a_piece_agrees_with_itself(self):
        expected = notes(no_12())

        total, agree, pitch = agreement(expected, notes(no_12()))

        self.assertEqual((agree, pitch), (total, total))

    def test_one_note_a_step_off_costs_one_note_of_pitch_and_nothing_else(self):
        recognised = no_12()
        next(recognised.iter('step')).text = 'D'

        total, agree, pitch = agreement(notes(no_12()), notes(recognised))

        self.assertEqual((total - agree, total - pitch), (1, 1))


if __name__ == '__main__':
    unittest.main()
