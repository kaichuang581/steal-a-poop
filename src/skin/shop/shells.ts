import { ICE_SHELL } from '../voxel/bomb';
import type { BombShell } from '../voxel/bomb';

/**
 * Each bomb skin's colours: its shaded to lit tones (deep, mid, pale, shine), the paler dusting on it, the lines through
 * it and its neck. The skins' own models (voxel/bombSkins.ts) are painted from these, and so are the pieces of shell a
 * burst throws, so Gold is gold and an Ember is a coal at the table and in the Trading Post's pictures alike.
 */
export const BOMB_SHELL: Record<string, BombShell> = {
  'bomb-ice': ICE_SHELL,
  'bomb-ember': { deep: '#241a16', mid: '#3a2c26', pale: '#54443b', shine: '#ff9a2a', frost: '#8a7f78', vein: '#ffd86a', neck: ['#4a3d36', '#2f2622'] },
  'bomb-mint': { deep: '#1f6e52', mid: '#2fa77a', pale: '#6fd3a8', shine: '#ffffff', frost: '#dcefe6', vein: '#e8475a', neck: ['#ffffff', '#e8475a'] },
  'bomb-plum': { deep: '#3a1a5e', mid: '#6a34a8', pale: '#9a62d6', shine: '#e6ccff', frost: '#c8a0f0', vein: '#4a2478', neck: ['#6b4a2a', '#4a321c'] },
  'bomb-gold': { deep: '#8a5e12', mid: '#c9981f', pale: '#f0c84a', shine: '#fff6c8', frost: '#fff0b0', vein: '#a87a1f', neck: ['#f0c84a', '#a87a1f'] },
  'bomb-diamond': { deep: '#7ac0ea', mid: '#b4e2fa', pale: '#dcf4ff', shine: '#ffffff', frost: '#ffffff', vein: '#8fd0f5', neck: ['#ffffff', '#b4e2fa'] },
  'bomb-brass': { deep: '#6e4c14', mid: '#b08428', pale: '#dcae40', shine: '#ffeaa8', frost: '#f4cc68', vein: '#7a5418', neck: ['#b08428', '#6e4c14'] },
  'bomb-aurora': { deep: '#141a4a', mid: '#232a78', pale: '#3a44a8', shine: '#5fffb0', frost: '#b48aff', vein: '#3fd6c8', neck: ['#9ff5d0', '#5fc8c0'] },
};
