"""Voxel grids for round things: fill cells by a rule, paint patterns, keep the surface, merge runs into boxes."""
N6 = ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1))


class Vox:
    def __init__(self):
        self.v = {}

    def set(self, x, y, z, c, part='shell'):
        self.v[(x, y, z)] = (c, part)

    def fill(self, bounds, inside, colour, part='shell'):
        (x0, x1), (y0, y1), (z0, z1) = bounds
        for x in range(x0, x1):
            for y in range(y0, y1):
                for z in range(z0, z1):
                    if inside(x + .5, y + .5, z + .5):
                        c = colour(x + .5, y + .5, z + .5) if callable(colour) else colour
                        self.v[(x, y, z)] = (c, part)

    def paint(self, pick, part=None):
        """pick(x, y, z, colour) -> new colour or None, for every cell already filled."""
        for k, (c, p) in list(self.v.items()):
            n = pick(k[0] + .5, k[1] + .5, k[2] + .5, c)
            if n:
                self.v[k] = (n, part or p)

    def boxes(self):
        s = {k: v for k, v in self.v.items() if any((k[0] + a, k[1] + b, k[2] + c) not in self.v for a, b, c in N6)}
        runs = []
        for (y, z) in sorted({(k[1], k[2]) for k in s}):
            xs = sorted(k[0] for k in s if k[1] == y and k[2] == z)
            i = 0
            while i < len(xs):
                j = i
                while j + 1 < len(xs) and xs[j + 1] == xs[j] + 1 and s[(xs[j + 1], y, z)] == s[(xs[i], y, z)]:
                    j += 1
                runs.append((xs[i], xs[j] + 1, y, z, s[(xs[i], y, z)]))
                i = j + 1
        runs.sort(key=lambda r: (r[0], r[1], r[3], r[4], r[2]))
        out, i = [], 0
        while i < len(runs):
            x0, x1, y, z, val = runs[i]
            j = i
            while j + 1 < len(runs) and runs[j + 1][:2] == (x0, x1) and runs[j + 1][3] == z and runs[j + 1][4] == val and runs[j + 1][2] == runs[j][2] + 1:
                j += 1
            out.append((x0, y, z, x1, runs[j][2] + 1, z + 1, val[0], val[1]))
            i = j + 1
        return out

    def into(self, model, name=''):
        """A part written 'detail:rivet' becomes part 'detail' with the name 'rivet', so motifs keep their names."""
        for (x0, y0, z0, x1, y1, z1, c, part) in self.boxes():
            p, _, n = part.partition(':')
            model.b(x0, y0, z0, x1, y1, z1, c, n or name or p, p)
