"""Beyer Op. 101 from Audiveris 5.11.0's recognition of the Edition Peters scan, as source and derived MusicXML.

Recognise a range of the scan's pages - cut out first, because given -sheets Audiveris exports every
movement under one name - then import the pieces in it by their Peters numbers:

    python3 scripts/beyer/scan_pages.py SCAN.pdf 20 29 pages.pdf
    audiveris -batch -transcribe -export -output EXPORT \\
        -constant org.audiveris.omr.sheet.BookManager.useCompression=false -- pages.pdf
    python3 scripts/beyer/omr_import.py EXPORT 20 OUT 8 9 12

Audiveris exports one file per movement, naming the sheets and systems it came from, and starts a
movement at an indented system - which it misses under a heading, running pieces together. So a piece
is cut from the export by the systems manifest.json names for it, not by movement.

OUT/source/ gets the piece as printed: the pupil's part, the teacher's after it for a duet, repeat signs,
and only the digits the book prints. It is the file a proofreader corrects. OUT/ gets the file the app
loads, derived from it: the pupil's part alone, repeats written out, every note fingered by
fingering.py around the printed digits. What a proofreader should look at is printed as it goes.
"""
import argparse
import json
import xml.etree.ElementTree as ET
from copy import deepcopy
from fractions import Fraction
from pathlib import Path

from fingering import add_fingering, events_by_hand, windows_for

MANIFEST = Path(__file__).resolve().parents[2] / 'beyer_op101_musicxml/manifest.json'
SOFTWARE = ('Audiveris 5.11.0', "piano-tutor's scripts/beyer/omr_import.py")
ATTRIBUTES = ('divisions', 'key', 'time', 'staves', 'clef')  # the ones a cut carries, in schema order
HANDS = {'right': 'RH', 'left': 'LH'}


def systems_of(movement, first_page):
    """[((page, system), measure)] for an Audiveris movement, from its source-sheet fields."""
    systems = [(first_page + int(field.get('name').rsplit('-', 1)[1]) - 1, int(system))
               for field in movement.iter('miscellaneous-field') if field.get('name').startswith('source-sheet-')
               for system in field.text.split()]
    placed, index = [], -1
    for measure in movement.iter('measure'):
        layout = measure.find('print')
        if index < 0 or layout is not None and 'yes' in (layout.get('new-system'), layout.get('new-page')):
            index += 1
        placed.append((systems[index], measure))
    return placed


def measures_by_system(export, first_page):
    """{(page, system): [(measure, {(attribute, number): element} in force at it)]}"""
    found = {}
    for path in sorted(Path(export).glob('*.mvt*.xml')):
        state = {}
        for system, measure in systems_of(ET.parse(path).getroot(), first_page):
            for element in measure.findall('attributes/*'):
                if element.tag in ATTRIBUTES:
                    state[element.tag, element.get('number') or ''] = element
            found.setdefault(system, []).append((measure, dict(state)))
    return found


def cut(found, ranges):
    """Copies of the measures of the systems named, numbered from 1, the first carrying every attribute in force."""
    picked = []
    for page, first, last in ranges:
        for system in range(first, last + 1):
            if (page, system) not in found:
                raise ValueError(f'the export has no system {system} on p. {page}')
            picked += found[page, system]
    measures = [deepcopy(measure) for measure, _ in picked]
    opening = measures[0]
    for old in opening.findall('attributes'):
        opening.remove(old)
    attributes = ET.Element('attributes')
    in_force = picked[0][1]
    attributes.extend(deepcopy(in_force[key]) for key in sorted(in_force, key=lambda k: (ATTRIBUTES.index(k[0]), k[1])))
    opening.insert(1 if len(opening) and opening[0].tag == 'print' else 0, attributes)
    for number, measure in enumerate(measures, 1):
        measure.set('number', str(number))
    return measures


def pages(ranges):
    numbers = sorted({page for page, _, _ in ranges})
    return ('p. ' if len(numbers) == 1 else 'pp. ') + ', '.join(map(str, numbers))


def source(number, piece, found, manifest):
    """The piece as the edition prints it: the pupil's part, then the teacher's for a duet."""
    parts = [('Prima' if 'teacher' in piece else 'Piano', piece['pupil'])]
    if 'teacher' in piece:
        parts.append(('Seconda', piece['teacher']))
    teacher = f", the teacher's part {pages(piece['teacher'])}" if 'teacher' in piece else ''
    rights = (
        'Ferdinand Beyer, Vorschule im Klavierspiel, Op. 101, first published 1850 (Mainz: Schott): public '
        f"domain. Notes recognised with Audiveris 5.11.0 from {manifest['edition']} ({manifest['imslp']}, "
        f"scan SHA-256 {manifest['scan']['sha256'][:16]}), the pupil's part {pages(piece['pupil'])}{teacher}; "
        'Peters numbering. Not yet proofread against the scan. The source file carries only the fingering '
        'digits the edition prints.'
    )
    root = ET.Element('score-partwise', version='4.0')
    ET.SubElement(ET.SubElement(root, 'work'), 'work-title').text = f'Beyer Op. 101 No. {number}'
    identification = ET.SubElement(root, 'identification')
    ET.SubElement(identification, 'creator', type='composer').text = 'Ferdinand Beyer'
    ET.SubElement(identification, 'rights').text = rights
    encoding = ET.SubElement(identification, 'encoding')
    for software in SOFTWARE:
        ET.SubElement(encoding, 'software').text = software
    part_list = ET.SubElement(root, 'part-list')
    for i, (name, _) in enumerate(parts, 1):
        ET.SubElement(ET.SubElement(part_list, 'score-part', id=f'P{i}'), 'part-name').text = name
    for i, (_, ranges) in enumerate(parts, 1):
        ET.SubElement(root, 'part', id=f'P{i}').extend(cut(found, ranges))
    return root


def written_out(measures):
    """Copies of the measures in playing order, each repeat taken once, without repeat signs or layout."""
    played, start, i, taken = [], 0, 0, set()
    while i < len(measures):
        measure = measures[i]
        if measure.find('barline/ending') is not None:
            raise ValueError(f"measure {measure.get('number')}: first and second endings are not supported")
        if measure.find("barline/repeat[@direction='forward']") is not None:
            start = i
        played.append(deepcopy(measure))
        backward = measure.find("barline/repeat[@direction='backward']") is not None
        if backward and i not in taken:
            taken.add(i)
            i = start
        else:
            start = i + 1 if backward else start
            i += 1
    for number, measure in enumerate(played, 1):
        measure.set('number', str(number))
        for element in measure.findall('print') + [b for b in measure.findall('barline') if b.find('repeat') is not None]:
            measure.remove(element)
    return played


def derive(source_root, name):
    """What the app loads: the pupil's part alone, repeats written out, fingered around the printed digits."""
    root = deepcopy(source_root)
    for part in root.findall('part')[1:]:
        root.remove(part)
    part_list = root.find('part-list')
    for score_part in part_list.findall('score-part')[1:]:
        part_list.remove(score_part)
    part = root.find('part')
    measures = written_out(part.findall('measure'))
    for measure in part.findall('measure'):
        part.remove(measure)
    part.extend(measures)
    root.find('identification/rights').text += (
        f" This file is derived from source/{name}: its pupil's part with the repeats written out, and every "
        "finger the source does not carry was generated by piano-tutor's scripts/beyer/fingering.py."
    )
    return root, add_fingering(root)


def unfilled_measures(part):
    """The numbers of the measures in which a voice does not add up to the time signature, or a staff is empty."""
    divisions, bar, staves, unfilled = 1, None, 1, []
    for measure in part.iter('measure'):
        for attributes in measure.findall('attributes'):
            divisions = int(attributes.findtext('divisions') or divisions)
            staves = int(attributes.findtext('staves') or staves)
            if attributes.find('time') is not None:
                bar = Fraction(4 * int(attributes.findtext('time/beats')), int(attributes.findtext('time/beat-type')))
        filled = {}
        for element in measure:
            if element.tag in ('note', 'forward') and element.find('chord') is None and element.find('grace') is None:
                voice = element.findtext('voice')
                filled[voice] = filled.get(voice, 0) + Fraction(int(element.findtext('duration')), divisions)
        played_on = {note.findtext('staff') or '1' for note in measure.iter('note')}
        if len(played_on) < staves or any(total != bar for total in filled.values()):
            unfilled.append(measure.get('number'))
    return unfilled


def diagram_notes(position):
    return [ET.fromstring(f'<note><pitch><step>{pitch[0]}</step><octave>{pitch[1:]}</octave></pitch>'
                          f'<notations><technical><fingering>{finger}</fingering></technical></notations></note>')
            for pitch, finger in position.items()]


def hands_off_the_diagram(root, positions):
    """The hands whose first onset sits in another window than the book's hand-position diagram."""
    onsets = events_by_hand(root)
    return [hand for hand, position in positions.items()
            if not onsets[HANDS[hand]]
            or windows_for(onsets[HANDS[hand]][0][1], HANDS[hand]) != windows_for(diagram_notes(position), HANDS[hand])]


def write(root, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    ET.indent(root)
    ET.ElementTree(root).write(path, encoding='UTF-8', xml_declaration=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('export', help="Audiveris's export directory")
    parser.add_argument('first_page', type=int, help="the scan's page number of the export's first sheet")
    parser.add_argument('out', type=Path, help='where to write the derived files; sources go to OUT/source/')
    parser.add_argument('numbers', type=int, nargs='+', help='Peters numbers, as manifest.json lists them')
    args = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text())
    found = measures_by_system(args.export, args.first_page)
    for number in args.numbers:
        piece = manifest['pieces'][str(number)]
        name = f'beyer_op101_no{number:02}.musicxml'
        printed = source(number, piece, found, manifest)
        derived, unreachable = derive(printed, name)
        write(printed, args.out / 'source' / name)
        write(derived, args.out / name)
        measure_of = {note: measure.get('number') for measure in derived.iter('measure') for note in measure.iter('note')}
        print(f'No. {number}')
        for label, found_there in (
                ('bars that do not add up (source)', unfilled_measures(printed.find('part'))),
                ('bars with notes no five-finger window reaches (derived)', sorted({measure_of[n] for n in unreachable}, key=int)),
                ("hands not where the book's diagram puts them", hands_off_the_diagram(derived, piece.get('positions', {})))):
            if found_there:
                print(f"  {label}: {', '.join(found_there)}")


if __name__ == '__main__':
    main()
