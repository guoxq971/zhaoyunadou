export function createEquipmentItemsStateSlice({ config } = {}) {
  if (!config?.luoyangShovel) throw new TypeError('[equipment-items] config is required');
  return {
    shovels: config.startShovels,
    brushes: config.startBrushes,
    luoyang: {
      enabled: true,
      elapsed: 0,
      interval: config.luoyangShovel.interval,
      generated: 0,
      pending: false,
    },
    stats: { shovelsUsed: 0, brushUses: 0, luoyangGenerated: 0 },
  };
}
