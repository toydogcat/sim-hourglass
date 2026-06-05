/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SandColorId = 'gold' | 'crimson' | 'ocean' | 'emerald' | 'cosmic' | 'dusty_pink';

export interface SandTheme {
  id: SandColorId;
  name: string;
  color: string;       // Primary color hex
  glitter: string;     // Sparkle highlight color hex
  ambient: string;     // Unlit/shadow sand color hex
  glow: string;        // Light emission color
}

export const SAND_THEMES: SandTheme[] = [
  {
    id: 'gold',
    name: '時光古金 (Chronos Gold)',
    color: '#A1824A',
    glitter: '#f5e2bf',
    ambient: '#4a371c',
    glow: '#A1824A',
  },
  {
    id: 'crimson',
    name: '緋紅晶砂 (Crimson Crystal)',
    color: '#ef4444',
    glitter: '#fca5a5',
    ambient: '#991b1b',
    glow: '#f87171',
  },
  {
    id: 'ocean',
    name: '深海瑩砂 (Ocean Sapphire)',
    color: '#0ea5e9',
    glitter: '#7dd3fc',
    ambient: '#075985',
    glow: '#38bdf8',
  },
  {
    id: 'emerald',
    name: '翡翠玉砂 (Emerald Jade)',
    color: '#10b981',
    glitter: '#6ee7b7',
    ambient: '#065f46',
    glow: '#34d399',
  },
  {
    id: 'cosmic',
    name: '星雲極光 (Cosmic Twilight)',
    color: '#a855f7',
    glitter: '#dbeafe',
    ambient: '#581c87',
    glow: '#c084fc',
  },
  {
    id: 'dusty_pink',
    name: '落櫻粉砂 (Cherry Blossom)',
    color: '#f472b6',
    glitter: '#ffe4e6',
    ambient: '#9d174d',
    glow: '#f472b6',
  },
];

export type GlassTintId = 'clear' | 'amber' | 'smoked' | 'sapphire' | 'rose';

export interface GlassTint {
  id: GlassTintId;
  name: string;
  color: string;
  transmission: number;
  roughness: number;
  ior: number;
}

export const GLASS_TINTS: GlassTint[] = [
  {
    id: 'clear',
    name: '純淨無色玻璃 (Ultra Clear)',
    color: '#ffffff',
    transmission: 0.98,
    roughness: 0.05,
    ior: 1.52,
  },
  {
    id: 'amber',
    name: '古典琥珀玻璃 (Vintage Amber)',
    color: '#f59e0b',
    transmission: 0.85,
    roughness: 0.08,
    ior: 1.55,
  },
  {
    id: 'smoked',
    name: '微煙燻黑玻璃 (Smoked Obsidian)',
    color: '#4b5563',
    transmission: 0.75,
    roughness: 0.12,
    ior: 1.48,
  },
  {
    id: 'sapphire',
    name: '高貴藍寶玻璃 (Sapphire Cobalt)',
    color: '#1d4ed8',
    transmission: 0.80,
    roughness: 0.06,
    ior: 1.54,
  },
  {
    id: 'rose',
    name: '落日玫瑰玻璃 (Sunset Rose)',
    color: '#fda4af',
    transmission: 0.90,
    roughness: 0.07,
    ior: 1.53,
  },
];

export type PillarMaterialId = 'brass' | 'chrome' | 'mahogany' | 'obsidian';

export interface PillarMaterial {
  id: PillarMaterialId;
  name: string;
  pillarColor: string;
  capColor: string;
  roughness: number;
  metalness: number;
}

export const PILLAR_MATERIALS: PillarMaterial[] = [
  {
    id: 'brass',
    name: '黃銅木造典藏 (Classic Brass & Wood)',
    pillarColor: '#d4af37', // Gold metal pillars
    capColor: '#3e2723',    // Dark wood top/bottom caps
    roughness: 0.3,
    metalness: 0.9,
  },
  {
    id: 'chrome',
    name: '北歐現代鋼鉻 (Nordic Steel & Chrome)',
    pillarColor: '#cccccc', // Chrome pillars
    capColor: '#1e293b',    // Slate dark caps
    roughness: 0.1,
    metalness: 0.95,
  },
  {
    id: 'mahogany',
    name: '皇室紅木奢華 (Royal Wood & Gold)',
    pillarColor: '#c084fc', // Golden pillars
    capColor: '#450a0a',    // Red-brown Mahogany mahogany caps
    roughness: 0.2,
    metalness: 0.8,
  },
  {
    id: 'obsidian',
    name: '深淵曜石極簡 (Midnight Obsidian)',
    pillarColor: '#334155', // Slate dark metal pillars
    capColor: '#090d16',    // Jet black obsidian caps
    roughness: 0.4,
    metalness: 0.7,
  },
];
