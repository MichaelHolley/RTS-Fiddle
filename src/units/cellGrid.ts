/**
 * Points bucketed by square grid cell, so neighbour searches only visit nearby cells. Cells hash into a table sized
 * by point count rather than map area, so a bigger map costs nothing per tick.
 */
export interface CellGrid {
  cellSize: number
  bucketHead: Int32Array
  nextInBucket: Int32Array
  columns: Int32Array
  rows: Int32Array
}

export function createCellGrid(cellSize: number, capacity: number): CellGrid {
  return {
    cellSize,
    bucketHead: new Int32Array(2 ** Math.ceil(Math.log2(capacity * 2))),
    nextInBucket: new Int32Array(capacity),
    columns: new Int32Array(capacity),
    rows: new Int32Array(capacity),
  }
}

export function cellBucket(grid: CellGrid, column: number, row: number): number {
  return (Math.imul(column, 73856093) ^ Math.imul(row, 19349663)) & (grid.bucketHead.length - 1)
}

/** Buckets the first `count` points; walk a cell with `bucketHead`/`nextInBucket`, skipping points whose cell differs. */
export function fillCellGrid(grid: CellGrid, xs: Float32Array, zs: Float32Array, count: number): void {
  const { cellSize, bucketHead, nextInBucket, columns, rows } = grid
  bucketHead.fill(-1)
  for (let i = 0; i < count; i++) {
    columns[i] = Math.floor(xs[i] / cellSize)
    rows[i] = Math.floor(zs[i] / cellSize)
    const b = cellBucket(grid, columns[i], rows[i])
    nextInBucket[i] = bucketHead[b]
    bucketHead[b] = i
  }
}
