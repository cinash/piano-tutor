"""Run with: python3 -m unittest discover -s scripts/beyer"""
import json
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

from fingering import add_fingering
from omr_import import MANIFEST, cut, derive, hands_off_the_diagram, measures_by_system, source, unfilled_measures, written_out
from test_fingering import bare, with_printed_digits


def note(step, octave, staff, duration=1, finger=None):
    fingering = f'<notations><technical><fingering>{finger}</fingering></technical></notations>' if finger else ''
    return (f'<note><pitch><step>{step}</step><octave>{octave}</octave></pitch><duration>{duration}</duration>'
            f'<voice>{staff}</voice><staff>{staff}</staff>{fingering}</note>')


def bar(step, divisions=1, finger=None):
    """A whole-note bar of 4/4: `step` in the right hand over a C in the left."""
    return note(step, 5, 1, 4 * divisions, finger) + f'<backup><duration>{4 * divisions}</duration></backup>' + note('C', 4, 2, 4 * divisions)


OPENING = ('<attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves>'
           '<clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>G</sign><line>2</line></clef></attributes>')


def movement(sheets, measures):
    fields = ''.join(f'<miscellaneous-field name="source-sheet-{sheet}">{systems}</miscellaneous-field>' for sheet, systems in sheets)
    return (f'<score-partwise><identification><miscellaneous>{fields}</miscellaneous></identification>'
            f'<part id="P1">{"".join(f"<measure>{m}</measure>" for m in measures)}</part></score-partwise>')


# Two movements over the export's sheets 1 and 2 - pp. 20 and 21 - the second starting mid-page.
EXPORT = {
    'pages.mvt1.xml': movement([(1, '1 2')], ['<print/>' + OPENING + bar('C', finger=1), '<print new-system="yes"/>' + bar('D')]),
    'pages.mvt2.xml': movement([(1, '3'), (2, '1')], [
        '<print/><attributes><divisions>2</divisions></attributes>' + bar('E', 2),
        '<print new-page="yes"/>' + bar('F', 2)]),
}
EDITION = {'edition': 'Edition Peters', 'imslp': 'IMSLP #81208', 'scan': {'sha256': '0' * 64}}


def steps(measures):
    return [m.findtext('note/pitch/step') for m in measures]


class Import(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        for name, text in EXPORT.items():
            (Path(directory.name) / name).write_text(text)
        self.found = measures_by_system(directory.name, 20)

    def test_a_piece_is_cut_by_its_systems_and_opens_with_the_attributes_in_force(self):
        measures = cut(self.found, [[20, 2, 3], [21, 1, 1]])

        self.assertEqual(steps(measures), ['D', 'E', 'F'])
        self.assertEqual([m.get('number') for m in measures], ['1', '2', '3'])
        opening = [el.tag + (el.get('number') or '') for el in measures[0].find('attributes')]
        self.assertEqual(opening, ['divisions', 'time', 'staves', 'clef1', 'clef2'])
        self.assertEqual(measures[0].findtext('attributes/divisions'), '1')
        self.assertEqual(measures[1].findtext('attributes/divisions'), '2')

    def test_a_system_the_export_does_not_have_stops_the_import(self):
        with self.assertRaisesRegex(ValueError, 'no system 2 on p. 21'):
            cut(self.found, [[21, 1, 2]])

    def test_the_source_keeps_the_teachers_part_and_the_derived_file_only_the_pupils(self):
        piece = {'kind': 'prima', 'pupil': [[20, 1, 2]], 'teacher': [[20, 3, 3], [21, 1, 1]]}

        printed = source(8, piece, self.found, EDITION)
        derived, unreachable = derive(printed, 'beyer_op101_no08.musicxml')

        self.assertEqual([steps(p.findall('measure')) for p in printed.findall('part')], [['C', 'D'], ['E', 'F']])
        self.assertIn("IMSLP #81208, scan SHA-256 0000000000000000), the pupil's part p. 20, the teacher's part pp. 20, 21",
                      printed.findtext('identification/rights'))
        self.assertEqual(len(derived.findall('part')), 1)
        self.assertEqual(len(derived.findall('part-list/score-part')), 1)
        self.assertEqual(unreachable, [])
        self.assertIsNone(derived.find('.//print'))
        fingers = [n.findtext('notations/technical/fingering') for n in derived.iter('note')]
        self.assertEqual(fingers, ['1', '5', '2', '5'])  # the printed 1 on C kept, the rest from the rule
        self.assertIn('derived from source/beyer_op101_no08.musicxml', derived.findtext('identification/rights'))


class WrittenOut(unittest.TestCase):
    def measures(self, *bars):
        return [ET.fromstring(f'<measure>{b}</measure>') for b in bars]

    def test_each_repeat_is_taken_once_and_its_signs_dropped(self):
        forward = '<barline location="left"><repeat direction="forward"/></barline>'
        backward = '<barline location="right"><repeat direction="backward"/></barline>'
        measures = self.measures(bar('C'), forward + bar('D'), bar('E') + backward, bar('F'), bar('G') + backward)

        played = written_out(measures)

        self.assertEqual(steps(played), ['C', 'D', 'E', 'D', 'E', 'F', 'G', 'F', 'G'])
        self.assertEqual([m.get('number') for m in played], [str(n) for n in range(1, 10)])
        self.assertIsNone(next((m for m in played if m.find('barline') is not None), None))

    def test_first_and_second_endings_stop_the_import(self):
        with self.assertRaisesRegex(ValueError, 'endings'):
            written_out(self.measures('<barline><ending number="1" type="start"/></barline>'))


class WhereToLook(unittest.TestCase):
    def test_bars_that_do_not_add_up_or_leave_a_staff_empty(self):
        part = ET.fromstring(f'<part><measure number="1">{OPENING}{bar("C")}</measure>'
                             f'<measure number="2">{note("D", 5, 1, 3)}<backup><duration>3</duration></backup>{note("C", 4, 2, 4)}</measure>'
                             f'<measure number="3">{note("E", 5, 1, 4)}</measure></part>')

        self.assertEqual(unfilled_measures(part), ['2', '3'])

    def test_no_8_starts_where_the_books_diagram_puts_the_hands_only_with_its_printed_digits(self):
        positions = json.loads(MANIFEST.read_text())['pieces']['8']['positions']
        anchored, rule_alone = with_printed_digits(8), bare(8)
        add_fingering(anchored)
        add_fingering(rule_alone)

        self.assertEqual(hands_off_the_diagram(anchored, positions), [])
        self.assertEqual(hands_off_the_diagram(rule_alone, positions), ['left'])


if __name__ == '__main__':
    unittest.main()
