"""A range of the Peters scan's pages as a PDF of their own, each page image copied unchanged.

Audiveris names a movement by its place in the book, and given -sheets on the whole scan it leaves
them unnumbered and writes each over the last; on the scan's title page it hangs. Recognising a PDF
of just the pages wanted avoids both. The scan is a flat PDF, one image per page, and this reads only
that shape.

Usage: python3 scripts/beyer/scan_pages.py SCAN.pdf FIRST LAST OUT.pdf
"""
import re
import sys


def pages(data):
    """[(media box, image object's dictionary and stream)] in page order."""
    offsets = {int(m.group(1)): m.end() for m in re.finditer(rb'(\d+) 0 obj', data)}

    def body(number):
        return data[offsets[number]:data.index(b'endobj', offsets[number])]

    def leaves(number):
        node = body(number)
        kids = re.search(rb'/Kids\s*\[([^\]]*)\]', node)
        if kids is None:
            yield node
        for kid in re.findall(rb'(\d+) 0 R', kids.group(1) if kids else b''):
            yield from leaves(int(kid))

    catalog = body(int(re.search(rb'/Root (\d+) 0 R', data).group(1)))
    for page in leaves(int(re.search(rb'/Pages (\d+) 0 R', catalog).group(1))):
        resources = re.search(rb'/Resources (\d+) 0 R', page)
        xobjects = re.search(rb'/XObject\s*<<(.*?)>>', body(int(resources.group(1))) if resources else page, re.S)
        image = body(int(re.search(rb'(\d+) 0 R', xobjects.group(1)).group(1)))
        yield (re.search(rb'/MediaBox\s*\[([^\]]*)\]', page).group(1),
               image[image.index(b'<<'):image.rindex(b'endstream') + len(b'endstream')])


def pdf(selected):
    out, offsets = bytearray(b'%PDF-1.4\n'), []

    def add(content):
        offsets.append(len(out))
        out.extend(b'%d 0 obj\n' % len(offsets) + content + b'\nendobj\n')

    add(b'<</Type/Catalog/Pages 2 0 R>>')
    kids = b' '.join(b'%d 0 R' % (5 + 3 * i) for i in range(len(selected)))
    add(b'<</Type/Pages/Count %d/Kids[%s]>>' % (len(selected), kids))
    for i, (box, image) in enumerate(selected):
        x0, y0, x1, y1 = map(float, box.split())
        draw = b'q %g 0 0 %g %g %g cm /Im0 Do Q' % (x1 - x0, y1 - y0, x0, y0)
        add(image)
        add(b'<</Length %d>>stream\n%s\nendstream' % (len(draw), draw))
        add(b'<</Type/Page/Parent 2 0 R/MediaBox[%s]/Resources<</XObject<</Im0 %d 0 R>>>>/Contents %d 0 R>>'
            % (box, 3 + 3 * i, 4 + 3 * i))
    xref = len(out)
    out.extend(b'xref\n0 %d\n0000000000 65535 f \n' % (len(offsets) + 1))
    out.extend(b''.join(b'%010d 00000 n \n' % offset for offset in offsets))
    out.extend(b'trailer\n<</Size %d/Root 1 0 R>>\nstartxref\n%d\n%%%%EOF\n' % (len(offsets) + 1, xref))
    return bytes(out)


if __name__ == '__main__':
    scan, first, last, target = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
    with open(scan, 'rb') as f:
        selected = list(pages(f.read()))[first - 1:last]
    with open(target, 'wb') as f:
        f.write(pdf(selected))
