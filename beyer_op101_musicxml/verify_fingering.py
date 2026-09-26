"""Verify Beyer Op. 101 MusicXML files carry fingering for both hands; delete the ones that do not."""
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


def local(tag):
    return tag.rsplit('}', 1)[-1]


def etude_number(path, root):
    texts = [path.stem] + [e.text or '' for e in root.iter() if local(e.tag) in ('work-title', 'movement-title', 'credit-words')]
    for t in texts:
        m = re.search(r'(?:No|Nr|Nro|N[º°])\.?\s*(\d{1,3})', t, re.I) or re.search(r'\b(\d{1,3})\b', t)
        if m:
            return int(m.group(1))
    return None


def fingering_per_hand(root):
    """Right hand = staff 1 of a two-staff part, or the first part; left hand = staff 2, or the second part."""
    counts = {'RH': 0, 'LH': 0}
    parts = [p for p in root if local(p.tag) == 'part']
    for i, part in enumerate(parts):
        for note in part.iter():
            if local(note.tag) != 'note':
                continue
            n = sum(1 for e in note.iter() if local(e.tag) == 'fingering' and (e.text or '').strip())
            if not n:
                continue
            staff = next((e.text for e in note if local(e.tag) == 'staff'), None)
            if staff is not None:
                hand = 'RH' if staff.strip() == '1' else 'LH'
            else:
                hand = 'RH' if i == 0 else 'LH'
            counts[hand] += n
    return counts


def main(directory):
    files = sorted(p for p in Path(directory).iterdir() if p.suffix in ('.musicxml', '.xml'))
    kept = []
    for path in files:
        root = ET.parse(path).getroot()
        num = etude_number(path, root)
        c = fingering_per_hand(root)
        ok = c['RH'] > 0 and c['LH'] > 0
        print(f"{path.name:45} No. {num!s:>4}  RH fingerings: {c['RH']:4}  LH fingerings: {c['LH']:4}  {'OK' if ok else 'REJECTED'}")
        if ok:
            kept.append(num)
        else:
            path.unlink()
    print(f"\nKept {len(kept)} of {len(files)}: etudes {sorted(n for n in kept if n is not None)}")


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'beyer_op101_musicxml')
