import { createRegistry } from '../../engine-core/registry.js';
import { useBrush, useShovel } from '../../logic.js';
import { updateLuoyangShovel } from '../../field-tools.js';

export const ITEM_REGISTRY = createRegistry('item', {
  'item.open-locked-cell': Object.freeze({ id: 'shovel', use: useShovel }),
  'item.rewrite-featured-hero-char': Object.freeze({ id: 'brush', use: useBrush }),
  'item.periodic-generator': Object.freeze({
    id: 'luoyang-shovel',
    update: updateLuoyangShovel,
  }),
});
