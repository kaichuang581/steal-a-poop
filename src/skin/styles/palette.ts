import type { Hour, Season } from '../model/types';

/** Scene palette per hour (canvas colours; the same hues as the --sky-* tokens). sunPos is a fraction of the canvas. */
export interface ScenePalette {
  skyTop: string; skyMid: string; horizon: string; sun: string; sunPos: [number, number]; sunR: number;
  far: string; mid: string; near: string; ground: string; grass: string[];
  cloud: string; cloudShade: string; leaf: string[];
  fog: number; flies: number; stars: number;
}

export const PAL: Record<Hour, ScenePalette> = {
  dawn: { skyTop: '#9FB7D6', skyMid: '#F3C9B5', horizon: '#FBE3C2', sun: '#FFD9A0', sunPos: [0.52, 0.5], sunR: 0.09,
    far: '#B9C4D2', mid: '#8DA98A', near: '#6E9765', ground: '#5E8A55', grass: ['#7FA85C', '#9BBC6A', '#6B9550'],
    cloud: 'rgba(255,241,230,0.92)', cloudShade: 'rgba(214,190,200,0.55)', leaf: ['#7AA35B', '#95B86A', '#5F8A49'],
    fog: 0.38, flies: 0.25, stars: 0 },
  day: { skyTop: '#78B4E6', skyMid: '#BFE1F3', horizon: '#F1EBD3', sun: '#FFF1C2', sunPos: [0.44, 0.15], sunR: 0.075,
    far: '#A9C6C0', mid: '#79AE78', near: '#5C9B58', ground: '#4F8A4C', grass: ['#86C063', '#A3D074', '#6EAA52'],
    cloud: 'rgba(255,255,255,0.95)', cloudShade: 'rgba(205,220,235,0.65)', leaf: ['#6FA84F', '#8BC46A', '#55903F'],
    fog: 0.18, flies: 0, stars: 0 },
  dusk: { skyTop: '#5E5A94', skyMid: '#D08AA2', horizon: '#F7C08F', sun: '#FFB36B', sunPos: [0.32, 0.55], sunR: 0.1,
    far: '#8E7FA3', mid: '#6E7F7A', near: '#4E6B55', ground: '#3F5C47', grass: ['#5E8352', '#7A9A5E', '#4B6E45'],
    cloud: 'rgba(255,205,190,0.9)', cloudShade: 'rgba(150,110,150,0.55)', leaf: ['#6B8A4E', '#8A9B5A', '#4D6E42'],
    fog: 0.26, flies: 0.7, stars: 0.35 },
  night: { skyTop: '#101B3A', skyMid: '#273B66', horizon: '#4A5F8A', sun: '#F4ECCF', sunPos: [0.56, 0.16], sunR: 0.045,
    far: '#3B4A6B', mid: '#2F4A4A', near: '#263F38', ground: '#1F3630', grass: ['#2F5240', '#3A6148', '#25443A'],
    cloud: 'rgba(120,135,175,0.45)', cloudShade: 'rgba(60,70,110,0.45)', leaf: ['#2F5240', '#3A6148', '#25443A'],
    fog: 0.22, flies: 1, stars: 1 },
};

/** Tree crown colours by season; summer uses the hour's own leaf colours. */
export const SEASON_LEAF: Record<Exclude<Season, 'summer'>, string[]> = {
  spring: ['#F4C6CF', '#EBA9B8', '#9BBC6A'],
  autumn: ['#E3A35B', '#C9753E', '#D9B45A'],
  winter: ['#E8EEF2', '#D6E0E8', '#C3CFD8'],
};

export const WATER = ['#6F9CC0', '#8DB6D2'];
export const SNOW = '#F4F7FA';
export const WARM_WOOD = '#8C5A2E';
export const LANTERN = '#F2A444';
