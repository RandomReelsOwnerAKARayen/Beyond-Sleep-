#!/usr/bin/env python3
"""Builds Mechanics/levels.js from rectangle descriptions (easier to keep consistent than hand-typed ASCII).

Usage:  python3 tools/levels.py            (writes Mechanics/levels.js)
        python3 tools/levels.py -v         (also prints every map)
Then check that every room can still be finished:  node tools/solve.js [room ids...]
"""
import json, os, sys

COLS, ROWS = 40, 23
rooms = []


class Room:
    def __init__(self, id, ch, name, exit, **extra):
        self.g = [['.'] * COLS for _ in range(ROWS)]
        self.d = dict(id=id, ch=ch, name=name, exit=exit, **extra)
        rooms.append(self)

    def rect(self, x0, y0, x1, y1, c='#'):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.g[y][x] = c
        return self

    def put(self, x, y, c):
        self.g[y][x] = c
        return self

    def pit(self, x0, x1, row=20):
        """Spike pit: spikes on `row`, solid below."""
        self.rect(x0, row, x1, row, '^')
        self.rect(x0, row + 1, x1, ROWS - 1)
        return self

    def box(self, top=True, left=True, right=True, bottom=False):
        if top: self.rect(0, 0, COLS - 1, 0)
        if left: self.rect(0, 0, 0, ROWS - 1)
        if right: self.rect(COLS - 1, 0, COLS - 1, ROWS - 1)
        if bottom: self.rect(0, ROWS - 1, COLS - 1, ROWS - 1)
        return self

    def out(self):
        d = dict(self.d)
        d['map'] = [''.join(r) for r in self.g]
        return d


# ---------------- Chapter 1: The Waiting Room (no dash until 1-5) ----------------
r = Room('1-1', 1, 'Awakening', 'right',
         props=[['lamp', 6, 1], ['lamp', 18, 1], ['lamp', 30, 1], ['chairs', 4, 18], ['plant', 1, 18],
                ['clock', 9, 13], ['poster', 23, 9], ['vending', 35, 12], ['window', 13, 5], ['window', 27, 4]],
         look=[[5, 18, 'chairs'], [9, 18, 'clock'], [35, 12, 'vending']])
r.box().rect(39, 10, 39, 12, '.')
r.rect(0, 19, 9, 22).pit(10, 14).rect(15, 17, 17, 22).pit(18, 21).rect(22, 15, 26, 22).pit(27, 30).rect(31, 13, 39, 22)
r.put(3, 18, 'P')

r = Room('1-2', 1, 'The Long Wall', 'right',
         props=[['lamp', 8, 1], ['lamp', 22, 1], ['sign_number', 5, 18], ['plant', 16, 18], ['chairs', 9, 18],
                ['window', 3, 6], ['cooler', 23, 18], ['plant', 31, 6]],
         look=[[5, 18, 'number'], [23, 18, 'cooler']])
r.box().rect(39, 3, 39, 6, '.')
r.rect(0, 19, 25, 22).rect(26, 7, 39, 22).rect(18, 14, 21, 18).rect(12, 12, 14, 12)
r.put(13, 11, 'M').put(3, 18, 'P')

r = Room('1-3', 1, 'Number Zero', 'right', echo='walt',
         props=[['lamp', 5, 1], ['lamp', 20, 1], ['lamp', 33, 1], ['chairs', 1, 18], ['tv', 25, 4],
                ['chairs', 26, 12], ['plant', 36, 10], ['window', 15, 6]],
         look=[[25, 12, 'tv'], [2, 18, 'chairs']])
r.box().rect(39, 8, 39, 10, '.')
r.rect(0, 19, 7, 22).pit(8, 12).rect(13, 19, 17, 22).rect(18, 17, 22, 22).pit(23, 25).rect(26, 13, 30, 22).pit(31, 33)
r.rect(34, 11, 39, 22).rect(11, 6, 12, 15)
r.put(11, 4, 'M').put(20, 16, 'N').put(3, 18, 'P')

r = Room('1-4', 1, 'Night Shift', 'top',
         props=[['lamp', 4, 4], ['lamp', 34, 4], ['drawing', 3, 13], ['picnic', 2, 18], ['window', 22, 15], ['window', 6, 7]],
         look=[[3, 18, 'drawing']])
r.box().rect(13, 0, 18, 3, '.').rect(0, 1, 12, 3).rect(19, 1, 38, 3)
r.rect(0, 19, 5, 22).rect(6, 19, 38, 19, '^').rect(6, 20, 38, 22)
r.rect(8, 17, 12, 17).rect(16, 15, 20, 15).rect(24, 13, 28, 13).rect(32, 11, 36, 11).rect(24, 8, 28, 8).rect(16, 6, 20, 6)
r.put(38, 6, 'M').put(2, 18, 'P')

r = Room('1-5', 1, 'The Door With No Handle', 'right',
         props=[['door', 3, 18], ['lamp', 12, 1], ['lamp', 30, 1], ['chairs', 9, 15], ['plant', 16, 15], ['window', 22, 3]],
         look=[[3, 18, 'door']])
r.box().rect(39, 1, 39, 10, '.')
r.rect(0, 19, 7, 22).rect(8, 16, 17, 22).pit(18, 27).rect(28, 19, 39, 22).rect(37, 11, 38, 18).rect(29, 8, 33, 8)
r.put(31, 7, 'M').put(14, 15, 'G').put(3, 18, 'P')

# ---------------- Chapter 2: The Falling City (dash, crystals, crumble) ----------------
r = Room('2-1', 2, 'Rooftops', 'right',
         props=[['antenna', 2, 14], ['ac', 5, 14], ['watertower', 15, 11], ['lamppost', 36, 13], ['chimney', 32, 13]],
         look=[[5, 14, 'ac']])
r.rect(0, 15, 8, 22).rect(14, 12, 18, 22).rect(30, 14, 39, 22)
r.put(24, 8, 'D').put(22, 3, 'M').put(3, 14, 'P')

r = Room('2-2', 2, 'Crumbling Tower', 'top',
         props=[['pipe', 3, 2], ['pipe', 36, 2], ['lamp2', 6, 18], ['crate', 2, 18], ['billboard', 33, 15]],
         look=[[33, 18, 'billboard']])
r.box().rect(17, 0, 22, 0, '.')
r.rect(0, 20, 39, 22).rect(12, 19, 38, 19, '^')
r.rect(8, 17, 11, 17, 'C').rect(15, 14, 18, 14, 'C').rect(22, 11, 25, 11, 'C').rect(14, 8, 17, 8, 'C').rect(20, 5, 23, 5, 'C')
r.rect(32, 9, 35, 9).put(34, 8, 'M').put(29, 12, 'D').put(3, 19, 'P')

r = Room('2-3', 2, 'The Girl on the Ledge', 'right', echo='juno',
         props=[['antenna', 1, 15], ['ac', 36, 12], ['laundry', 15, 14], ['lamppost', 33, 12]],
         look=[[36, 12, 'ac']])
r.rect(0, 16, 5, 22).rect(14, 15, 18, 22).rect(31, 13, 39, 22)
r.put(23, 13, 'D').put(28, 10, 'D').put(23, 6, 'M').put(16, 14, 'N').put(2, 15, 'P')

r = Room('2-4', 2, 'Updraft', 'top',
         props=[['antenna', 7, 18], ['ac', 26, 11], ['chimney', 33, 6], ['phone', 22, 3]],
         look=[[22, 3, 'phone']])
r.rect(2, 19, 9, 22).rect(13, 16, 17, 16).rect(25, 12, 29, 12).rect(31, 7, 35, 7).rect(20, 4, 24, 4).rect(6, 7, 9, 7)
r.put(21, 11, 'D').put(14, 5, 'D').put(7, 6, 'M').put(4, 18, 'P')

r = Room('2-5', 2, 'The Spade Gate', 'right',
         props=[['antenna', 4, 16], ['watertower', 19, 13], ['lamppost', 33, 12], ['bench', 36, 12]],
         look=[[36, 12, 'bench']])
r.rect(0, 17, 6, 22).rect(10, 15, 14, 15, 'C').rect(18, 14, 22, 22).rect(31, 13, 39, 22)
r.put(27, 10, 'D').put(12, 9, 'D').put(12, 4, 'M').put(35, 12, 'G').put(2, 16, 'P')

# ---------------- Chapter 3: The Library of Lost Days (springs) ----------------
r = Room('3-1', 3, 'Shelves', 'top',
         props=[['candle', 5, 6], ['bookpile', 12, 11], ['readlamp', 30, 19], ['globe', 34, 19], ['ladder', 37, 5], ['bookpile', 25, 19]],
         look=[[30, 19, 'desk'], [34, 19, 'globe']])
r.box().rect(22, 0, 27, 0, '.')
r.rect(0, 20, 39, 22).rect(20, 4, 21, 16).rect(4, 7, 7, 7).rect(11, 12, 16, 12)
r.put(8, 19, 'S').put(5, 6, 'M').put(3, 19, 'P')

r = Room('3-2', 3, 'The Reading Room', 'right', echo='hester',
         props=[['candle', 20, 8], ['lectern', 24, 8], ['bookpile', 2, 17], ['readlamp', 10, 14], ['candle', 29, 13]],
         look=[[24, 8, 'lectern']])
r.box().rect(39, 2, 39, 8, '.')
r.rect(0, 18, 6, 22).pit(7, 14, 21).rect(15, 18, 19, 22).pit(20, 30, 21).rect(31, 9, 39, 22).rect(19, 9, 24, 9).rect(9, 15, 11, 15, 'C')
r.put(17, 17, 'S').put(26, 13, 'D').put(28, 14, 'M').put(22, 8, 'N').put(3, 17, 'P')

r = Room('3-3', 3, 'Overdue', 'top',
         props=[['candle', 33, 19], ['bookpile', 36, 19], ['ladder', 2, 6], ['candle', 15, 9], ['readlamp', 30, 5]],
         cameos=[['juno', 16, 9]], look=[[36, 19, 'returns']])
r.box().rect(1, 0, 6, 0, '.')
r.rect(0, 20, 39, 22).rect(7, 19, 30, 19, '^').rect(25, 17, 27, 18).rect(14, 10, 19, 10).rect(1, 5, 7, 5).rect(28, 6, 32, 6)
r.put(26, 16, 'S').put(10, 8, 'D').put(30, 5, 'M').put(34, 19, 'P')

r = Room('3-4', 3, 'The Torn Pages', 'right',
         props=[['candle', 2, 17], ['bookpile', 35, 13], ['readlamp', 37, 13], ['torn', 20, 8]],
         look=[[20, 8, 'torn']])
r.box(right=False)
r.rect(0, 18, 6, 22).pit(7, 32).rect(11, 17, 12, 22).rect(18, 9, 22, 9, 'C').rect(33, 14, 39, 22)
r.put(12, 16, 'S').put(27, 12, 'D').put(20, 4, 'M').put(2, 17, 'P')

r = Room('3-5', 3, 'The Diamond Gate', 'top',
         props=[['candle', 8, 19], ['bookpile', 30, 19], ['globe', 34, 19], ['readlamp', 4, 19]],
         look=[[30, 19, 'shelf']])
r.rect(0, 0, 15, 15).rect(22, 0, 39, 15).rect(22, 5, 28, 7, '.').rect(16, 11, 16, 11)
r.rect(0, 16, 0, 22).rect(39, 16, 39, 22).rect(0, 20, 39, 22)
r.put(26, 6, 'M').put(17, 19, 'G').put(3, 19, 'P')

# ---------------- Chapter 4: The Heart of The Between (the Hollow) ----------------
r = Room('4-1', 4, 'Unraveling', 'right', echo='pip',
         props=[['monitor', 3, 14], ['iv', 15, 13], ['vein', 34, 11]],
         look=[[3, 14, 'monitor']])
r.rect(0, 16, 4, 22).rect(7, 16, 12, 16, 'C').rect(15, 14, 18, 22).rect(34, 12, 39, 22).pit(5, 14, 21).pit(19, 33, 21)
r.put(23, 12, 'D').put(29, 11, 'D').put(26, 6, 'M').put(17, 13, 'N').put(2, 15, 'P')

r = Room('4-2', 4, 'The Hollow', 'right', chaser=True,
         props=[['monitor', 4, 16], ['vein', 13, 14], ['iv', 37, 12]],
         look=[])
r.rect(0, 17, 7, 22).rect(11, 15, 15, 22).rect(19, 17, 22, 22).rect(26, 15, 29, 15, 'C').rect(34, 13, 39, 22)
r.put(31, 10, 'D').put(24, 8, 'M').put(2, 16, 'P')

r = Room('4-3', 4, 'Flatline', 'top', chaser=True,
         props=[['monitor', 2, 19], ['iv', 10, 15], ['vein', 30, 8]], cameos=[['walt', 4, 9]],
         look=[])
r.box().rect(30, 0, 35, 0, '.')
r.rect(0, 20, 39, 22).rect(8, 19, 38, 19, '^').rect(8, 16, 12, 16).rect(17, 13, 21, 13).rect(28, 9, 32, 9)
r.rect(26, 5, 29, 5).rect(1, 10, 5, 10)
r.put(25, 11, 'D').put(13, 9, 'D').put(2, 9, 'M').put(3, 19, 'P')

r = Room('4-4', 4, 'Last Ascent', 'top', chaser=True,
         props=[['monitor', 5, 18], ['vein', 22, 7]],
         look=[])
r.box().rect(15, 0, 24, 0, '.')
r.rect(0, 20, 39, 22).rect(12, 19, 38, 19, '^').rect(33, 5, 37, 5).rect(22, 7, 27, 7).rect(12, 11, 17, 11, 'C')
r.put(22, 6, 'S').put(10, 19, 'S').put(19, 9, 'D').put(35, 4, 'M').put(3, 19, 'P')

r = Room('4-5', 4, 'The Heart', 'none',
         props=[['bed', 18, 19], ['monitor', 23, 19], ['iv', 15, 19], ['vein', 6, 8], ['vein', 33, 10]],
         look=[[18, 19, 'bed']])
r.box().rect(0, 20, 39, 22)
r.put(27, 19, 'G').put(3, 19, 'P')

# ---------------- Epilogue: Morning ----------------
r = Room('5-1', 5, 'Morning', 'none',
         props=[['tree', 6, 18], ['lamppost', 12, 18], ['bench', 15, 18], ['tree', 22, 17], ['bush', 27, 17],
                ['hospital', 33, 17], ['bird', 9, 6], ['bird', 26, 4]],
         cameos=[['walt', 16, 18], ['juno', 21, 16], ['hester', 25, 16], ['pip', 28, 16]],
         look=[])
r.rect(0, 19, 39, 22).rect(19, 17, 39, 18)
r.put(35, 16, 'O').put(2, 18, 'P')

out = [r.out() for r in rooms]
for d in out:
    assert len(d['map']) == ROWS and all(len(row) == COLS for row in d['map']), d['id']
    assert sum(row.count('P') for row in d['map']) == 1, d['id']

js = ("'use strict';\n"
      "// Room data, generated. Legend: # solid, ^ v spikes, P spawn, D dash crystal, M memory, S spring,\n"
      "// C crumble block, N echo (see room.echo), G Remi, O Mom. 40x23 tiles of 8px.\n"
      "// props: [kind, col, row] decoration; look: [col, row, key] things you can examine (STORY[id].look[key]).\n"
      "const ROOMS = " + json.dumps(out, indent=1) + ";\n")
out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'Mechanics', 'levels.js')
open(out_path, 'w').write(js)
if '-v' in sys.argv:
    for d in out:
        print(d['id'], d['name'])
        print('\n'.join(d['map']))
