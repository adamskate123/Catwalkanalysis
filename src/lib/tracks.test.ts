// Movement tracks: packing, time in place and group maps. Synthetic positions.

import { describe, expect, it } from 'vitest'
import { groupOccupancy, mergeTrackSets, occupancy, packEvents, unpackEvents, type TrackSet } from './tracks'

const set = { xBeams: 16, yBeams: 16 }
const at = (x: number, y: number) => (y - 1) * 16 + (x - 1)

describe('packed tracks', () => {
  it('round-trips times, positions and rearing', () => {
    const events: [number, number, number, boolean][] = [
      [0, 1, 1, false],
      [7, 16, 16, false],
      [7, 16, 16, true],
      [11999, 8, 3, false],
    ]
    const p = packEvents(events)
    expect(p.n).toBe(4)
    const ev = unpackEvents({ secs: 1200, intervalSecs: 300, ...p })
    expect([...ev.t]).toEqual([0, 7, 7, 11999])
    expect([...ev.x]).toEqual([1, 16, 16, 8])
    expect([...ev.y]).toEqual([1, 16, 16, 3])
    expect([...ev.rear]).toEqual([0, 0, 1, 0])
  })
})

describe('time in place', () => {
  const ev = unpackEvents({
    secs: 30,
    intervalSecs: 300,
    ...packEvents([
      [0, 1, 1, false],
      [100, 2, 1, false],
      [150, 2, 1, true], // rearing does not move the animal
      [200, 2, 2, false],
    ]),
  })

  it('counts the time from each move to the next, the last position to the end', () => {
    const occ = occupancy(ev, set, 30)
    expect(occ[at(1, 1)]).toBe(10)
    expect(occ[at(2, 1)]).toBe(10)
    expect(occ[at(2, 2)]).toBe(10)
    expect(occ.reduce((a, b) => a + b, 0)).toBe(30)
    // Up to 15 s only
    const part = occupancy(ev, set, 30, 150)
    expect(part[at(2, 1)]).toBe(5)
    expect(part.reduce((a, b) => a + b, 0)).toBe(15)
  })

  it('averages animals as % of their own time, so each counts once', () => {
    const a = new Float64Array(256)
    a[0] = 30 // all of a 30 s run in one place
    const b = new Float64Array(256)
    b[0] = 300
    b[1] = 900 // a 20-min run, a quarter of it in the same place
    const g = groupOccupancy([a, b])!
    expect(g[0]).toBeCloseTo((100 + 25) / 2, 10)
    expect(g[1]).toBeCloseTo(75 / 2, 10)
    expect(groupOccupancy([])).toBeNull()
  })
})

describe('track sets', () => {
  it('merges files, a later run replacing an earlier one', () => {
    const base = (data: string): TrackSet => ({ version: 1, beamCm: 2.5, xBeams: 16, yBeams: 16, centre: [], runs: { 'S1 · chamber 1': { secs: 1, intervalSecs: 1, n: 0, data } } })
    const m = mergeTrackSets([base('a'), undefined, { ...base('b'), runs: { ...base('b').runs, 'S2 · chamber 1': base('c').runs['S1 · chamber 1'] } }])!
    expect(Object.keys(m.runs).sort()).toEqual(['S1 · chamber 1', 'S2 · chamber 1'])
    expect(m.runs['S1 · chamber 1'].data).toBe('b')
    expect(mergeTrackSets([undefined])).toBeUndefined()
  })
})
