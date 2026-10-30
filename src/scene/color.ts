export const linear = (channel: number): number => channel ** 2.2

export function linearHex(hex: number): [number, number, number, number] {
  return [linear((hex >> 16) / 255), linear(((hex >> 8) & 0xff) / 255), linear((hex & 0xff) / 255), 1]
}
