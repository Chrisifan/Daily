interface ResolveDisplayStartSlotInput {
  compressedStartSlot: number;
  previousDisplayEndSlot: number;
  previousCompressedEndSlot: number;
  overlapsPrevious: boolean;
}

export function resolveDisplayStartSlot({
  compressedStartSlot,
  previousDisplayEndSlot,
  previousCompressedEndSlot,
  overlapsPrevious,
}: ResolveDisplayStartSlotInput): number {
  if (overlapsPrevious) {
    return previousDisplayEndSlot;
  }

  const previousOverflowSlots = Math.max(
    previousDisplayEndSlot - previousCompressedEndSlot,
    0
  );

  return Math.max(compressedStartSlot + previousOverflowSlots, previousDisplayEndSlot);
}
