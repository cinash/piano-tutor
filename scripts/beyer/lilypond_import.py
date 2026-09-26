r"""Beyer Op. 101 Nos. 8-31 from Nathanael Meister's LilyPond engraving, as fingered MusicXML.

Reads only the LilyPond those 24 files use - \relative notes, rests, chords, ties, \repeat volta and
unfold, bar checks - and stops on anything else. Slurs, staccato and tempo words are not carried
over. The engraving sits an octave below the Edition Peters score (ed. Ruthardt, plate 8033) and puts
the left hand in bass clef; the book has both hands in treble clef an octave higher, and so does the
output. Fingering comes from fingering.py.

Usage: python3 scripts/beyer/lilypond_import.py   (fetches the sources, writes beyer_op101_musicxml/)
"""
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass, replace
from fractions import Fraction
from math import lcm
from pathlib import Path

from fingering import add_fingering

REPO = 'nathanaelmeister/Piano_-_First_two_hand_exercises'
COMMIT = '2e3550b4a4a7623925a91360e4fb1f60cdd94429'
OUT = Path(__file__).resolve().parents[2] / 'beyer_op101_musicxml'
RIGHTS = (
    'Ferdinand Beyer, Vorschule im Klavierspiel, Op. 101 (1851): public domain. Notes from Nathanael '
    "Meister's LilyPond engraving First two hand Exercises (github.com/" + REPO + ', commit '
    + COMMIT[:7] + "; (c) Heart & Trust Music Engraving, 'Educational copying welcome', no open "
    'licence), raised an octave with both hands in treble clef as the Edition Peters score (ed. '
    'Ruthardt, plate 8033) prints them; Peters numbers two other pieces 10 and 11. Fingering '
    "computed by piano-tutor's scripts/beyer/fingering.py, not copied from the book."
)
STEPS = 'cdefgab'
TYPES = {'1': 'whole', '2': 'half', '4': 'quarter', '8': 'eighth', '16': '16th'}
TOKEN = re.compile(r'''\\[a-zA-Z]+|"[^"]*"|\d+/\d+|\d+\.*|[a-zA-Z]+[',]*|-\.|\S''')


@dataclass
class Event:
    onset: Fraction  # quarters from the start
    length: Fraction  # quarters
    type: str
    dots: int
    pitches: list  # diatonic numbers, 7 * octave + step; empty for a rest
    tied_from: set  # pitches the previous event tied into this one
    tied: bool = False


class StaffReader:
    """One \\relative block, read into Events."""

    def __init__(self, tokens, start, ref):
        self.tokens, self.i, self.ref = tokens, start, ref
        self.pos, self.type, self.dots, self.length = Fraction(0), 'quarter', 0, Fraction(1)
        self.events, self.repeats, self.time = [], [], None

    def take(self):
        self.i += 1
        return self.tokens[self.i - 1]

    def block(self):
        while (token := self.take()) != '}':
            self.item(token)

    def item(self, token):
        if token == '\\repeat':
            kind, times = self.take(), int(self.take())
            assert self.take() == '{'
            start, first = self.pos, len(self.events)
            self.block()
            if kind == 'volta':
                self.repeats.append((start, self.pos))
            elif kind == 'unfold':
                span, body = self.pos - start, self.events[first:]
                self.events += [replace(e, onset=e.onset + k * span) for k in range(1, times) for e in body]
                self.pos = start + times * span
            else:
                raise ValueError(f'unsupported \\repeat {kind}')
        elif token == '\\time':
            beats, beat_type = map(int, self.take().split('/'))
            self.time = (beats, beat_type)
        elif token == '\\key':
            if (self.take(), self.take()) != ('c', '\\major'):
                raise ValueError('only C major is supported')
        elif token in ('\\clef', '\\tempo', '\\bar'):
            self.take()
        elif token in ('\\numericTimeSignature', '\\break', '(', ')', '-.', '_'):
            pass
        elif token == '|':
            beats, beat_type = self.time
            if self.pos % Fraction(4 * beats, beat_type):
                raise ValueError(f'bar check failed at quarter {self.pos}')
        elif token == '~':
            self.events[-1].tied = True
        elif token == '<':
            chord = [self.relative(self.take(), self.ref)]
            while (token := self.take()) != '>':
                chord.append(self.relative(token, chord[-1]))
            self.ref = chord[0]
            self.add(chord)
        elif token in ('r', 'R'):
            self.add([])
        else:
            self.ref = self.relative(token, self.ref)
            self.add([self.ref])

    @staticmethod
    def relative(token, ref):
        if not re.fullmatch(r"[a-g][',]*", token):
            raise ValueError(f'unsupported LilyPond: {token}')
        nearest = ref + (STEPS.index(token[0]) - ref % 7 + 3) % 7 - 3  # within a fourth
        return nearest + 7 * (token.count("'") - token.count(','))

    def add(self, pitches):
        if re.fullmatch(r'\d+\.*', self.tokens[self.i]):
            duration = self.take()
            self.type, self.dots = TYPES[duration.rstrip('.')], duration.count('.')
            self.length = Fraction(4, int(duration.rstrip('.'))) * (2 - Fraction(1, 2 ** self.dots))
        before = self.events[-1] if self.events else None
        tied_from = set(before.pitches) if before and before.tied else set()
        self.events.append(Event(self.pos, self.length, self.type, self.dots, pitches, tied_from))
        self.pos += self.length


def read_staves(text):
    tokens = TOKEN.findall(re.sub(r'\\markup\s*\{[^{}]*\}', '', re.sub(r'%.*', '', text)))
    staves = []
    for i, token in enumerate(tokens):
        if token == '\\relative':
            ref = tokens[i + 1]
            assert tokens[i + 2] == '{'
            reader = StaffReader(tokens, i + 3, 7 * (3 + ref.count("'") - ref.count(',')) + STEPS.index(ref[0]))
            reader.block()
            staves.append(reader)
    return staves


def to_musicxml(text, number):
    upper, lower = read_staves(text)
    beats, beat_type = upper.time
    bar = Fraction(4 * beats, beat_type)
    if lower.time != upper.time or upper.pos != lower.pos or upper.pos % bar:
        raise ValueError('staves differ in length or time, or end mid-bar')
    divisions = lcm(*(e.length.denominator for e in upper.events + lower.events))

    root = ET.Element('score-partwise', version='4.0')
    ET.SubElement(ET.SubElement(root, 'work'), 'work-title').text = f'Beyer Op. 101 No. {number}'
    identification = ET.SubElement(root, 'identification')
    ET.SubElement(identification, 'creator', type='composer').text = 'Ferdinand Beyer'
    ET.SubElement(identification, 'rights').text = RIGHTS
    ET.SubElement(ET.SubElement(ET.SubElement(root, 'part-list'), 'score-part', id='P1'), 'part-name').text = 'Piano'
    part = ET.SubElement(root, 'part', id='P1')

    for m in range(int(upper.pos / bar)):
        start, end = m * bar, (m + 1) * bar
        measure = ET.SubElement(part, 'measure', number=str(m + 1))
        if m == 0:
            measure.append(attributes(divisions, beats, beat_type))
        if any(s == start for s, _ in upper.repeats) and m > 0:
            barline(measure, 'left', 'forward')
        for staff, reader in ((1, upper), (2, lower)):
            if staff == 2:
                ET.SubElement(ET.SubElement(measure, 'backup'), 'duration').text = str(int(bar * divisions))
            write_staff(measure, staff, [e for e in reader.events if start <= e.onset < end], end, divisions)
        if any(e == end for _, e in upper.repeats):
            barline(measure, 'right', 'backward')
    return root


def attributes(divisions, beats, beat_type):
    el = ET.Element('attributes')
    ET.SubElement(el, 'divisions').text = str(divisions)
    ET.SubElement(ET.SubElement(el, 'key'), 'fifths').text = '0'
    time = ET.SubElement(el, 'time')
    ET.SubElement(time, 'beats').text = str(beats)
    ET.SubElement(time, 'beat-type').text = str(beat_type)
    ET.SubElement(el, 'staves').text = '2'
    for staff in ('1', '2'):
        clef = ET.SubElement(el, 'clef', number=staff)
        ET.SubElement(clef, 'sign').text = 'G'
        ET.SubElement(clef, 'line').text = '2'
    return el


def barline(measure, location, direction):
    ET.SubElement(ET.SubElement(measure, 'barline', location=location), 'repeat', direction=direction)


def write_staff(measure, staff, events, end, divisions):
    for event in events:
        if event.onset + event.length > end:
            raise ValueError(f'a note crosses the barline at quarter {end}')
        for i, pitch in enumerate(event.pitches or [None]):
            note = ET.SubElement(measure, 'note')
            if i:
                ET.SubElement(note, 'chord')
            if pitch is None:
                ET.SubElement(note, 'rest')
            else:
                el = ET.SubElement(note, 'pitch')
                ET.SubElement(el, 'step').text = STEPS[pitch % 7].upper()
                ET.SubElement(el, 'octave').text = str(pitch // 7 + 1)  # +1: the Peters octave
            ET.SubElement(note, 'duration').text = str(int(event.length * divisions))
            ties = (['stop'] if pitch in event.tied_from else []) + (['start'] if event.tied else [])
            for tie in ties:
                ET.SubElement(note, 'tie', type=tie)
            ET.SubElement(note, 'voice').text = str(staff)
            ET.SubElement(note, 'type').text = event.type
            for _ in range(event.dots):
                ET.SubElement(note, 'dot')
            ET.SubElement(note, 'staff').text = str(staff)
            if ties:
                notations = ET.SubElement(note, 'notations')
                for tie in ties:
                    ET.SubElement(notations, 'tied', type=tie)


def fetch(path):
    with urllib.request.urlopen(f'https://raw.githubusercontent.com/{REPO}/{COMMIT}/{path}') as response:
        return response.read().decode()


def main():
    with urllib.request.urlopen(f'https://api.github.com/repos/{REPO}/git/trees/{COMMIT}?recursive=1') as response:
        paths = [entry['path'] for entry in json.load(response)['tree']]
    for path in paths:
        match = re.fullmatch(r'input-files/\d+_Beyer_Ferdinand_-_Op_101_-_Nr_(\d+)\.ily', path)
        if match:
            number = int(match.group(1))
            root = to_musicxml(fetch(path), number)
            add_fingering(root)
            ET.indent(root)
            ET.ElementTree(root).write(OUT / f'beyer_op101_no{number:02}.musicxml', encoding='UTF-8', xml_declaration=True)
            print(f'No. {number}')


if __name__ == '__main__':
    main()
