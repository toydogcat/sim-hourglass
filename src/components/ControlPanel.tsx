/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import { 
  Play, 
  Pause, 
  RotateCw, 
  Activity, 
  Info, 
  Settings, 
  Palette, 
  Layers, 
  Zap,
  Volume2,
  Compass,
  RefreshCw,
  Sliders,
  Sparkles
} from 'lucide-react';
import { 
  SAND_THEMES, 
  GLASS_TINTS, 
  PILLAR_MATERIALS, 
  SandColorId, 
  GlassTintId, 
  PillarMaterialId 
} from '../types';

interface ControlPanelProps {
  sandColorId: SandColorId;
  setSandColorId: (val: SandColorId) => void;
  glassTintId: GlassTintId;
  setGlassTintId: (val: GlassTintId) => void;
  pillarMaterialId: PillarMaterialId;
  setPillarMaterialId: (val: PillarMaterialId) => void;
  sandCount: number;
  setSandCount: (val: number) => void;
  flowMultiplier: number;
  setFlowMultiplier: (val: number) => void;
  gyroEnabled: boolean;
  setGyroEnabled: (val: boolean) => void;
  
  // Gravity/Tilt state for sliders
  tiltX: number; // degrees
  setTiltX: (val: number) => void;
  tiltZ: number; // degrees
  setTiltZ: (val: number) => void;

  // Actions
  onFlip: () => void;
  onShake: () => void;
  onExplode?: () => void;
  
  // Live stats from WebGL scene
  stats: {
    topPercentage: number;
    bottomPercentage: number;
    flowCount: number;
    elapsedSec: number;
    sensorAvailable: boolean;
    sensorReading: string;
  };
}

export default function ControlPanel({
  sandColorId,
  setSandColorId,
  glassTintId,
  setGlassTintId,
  pillarMaterialId,
  setPillarMaterialId,
  sandCount,
  setSandCount,
  flowMultiplier,
  setFlowMultiplier,
  setGyroEnabled,
  gyroEnabled,
  tiltX,
  setTiltX,
  tiltZ,
  setTiltZ,
  onFlip,
  onShake,
  onExplode,
  stats
}: ControlPanelProps) {

  // Dynamic sound trigger
  const playSlickSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.015, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } catch (e) {
      // Audio block ignore gracefully
    }
  };

  const handlePillarChange = (id: PillarMaterialId) => {
    setPillarMaterialId(id);
    playSlickSound();
  };

  const handleSandColorChange = (id: SandColorId) => {
    setSandColorId(id);
    playSlickSound();
  };

  const handleGlassTintChange = (id: GlassTintId) => {
    setGlassTintId(id);
    playSlickSound();
  };

  // Format elapsed time to beautiful MM:SS.SS
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    const fraction = Math.floor((totalSeconds % 1) * 100);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(fraction).padStart(2, '0')}`;
  };

  return (
    <div 
      className="w-full h-full flex flex-col gap-6 bg-[#0C0C0D] p-6 text-slate-300 overflow-y-auto select-none"
      id="control_panel_sidebar_container"
      style={{ scrollbarWidth: 'thin', scrollbarColor: '#222 #050505' }}
    >
      {/* App Header / Brand Logo */}
      <div className="border-b border-[#222222] pb-5 pt-1">
        <div className="logo font-mono text-[10px] uppercase tracking-[0.25em] text-[#555] mb-2 flex items-center justify-between">
          <span>CHRONOS // ENGINE</span>
          <span className="text-[8px] text-[#A1824A] uppercase tracking-widest font-sans font-bold">PHYSICS.ACTIVE</span>
        </div>
        <h1 className="text-xl font-light tracking-tight text-white mt-1">
          時光沙漏物理模擬器
        </h1>
        <p className="text-[10px] text-slate-500 font-mono tracking-wide mt-1 uppercase">
          GRANULAR SANDBOX SYSTEM v1.38
        </p>
      </div>

      {/* Right Stats Sidebar - Analytical Grid */}
      <div className="grid grid-cols-3 gap-2 border-b border-[#222222]/80 pb-5">
        <div className="stat-item flex flex-col">
          <span className="stat-value text-2xl font-extralight text-white font-mono tracking-tight">
            {sandCount.toLocaleString()}+
          </span>
          <span className="stat-label text-[9px] text-[#555] uppercase tracking-[0.15em] mt-1">
            Particles
          </span>
        </div>
        
        <div className="stat-item flex flex-col">
          <span className="stat-value text-2xl font-extralight text-white font-mono tracking-tight">
            {formatTime(stats.elapsedSec)}
          </span>
          <span className="stat-label text-[9px] text-[#555] uppercase tracking-[0.15em] mt-1">
            Elapsed Time
          </span>
        </div>

        <div className="stat-item flex flex-col">
          <span className="stat-value text-2xl font-extralight text-white font-mono tracking-tight">
            {flowMultiplier > 0 ? `${60 * flowMultiplier} FPS` : '0 FPS'}
          </span>
          <span className="stat-label text-[9px] text-[#555] uppercase tracking-[0.15em] mt-1">
            Sim Delta
          </span>
        </div>
      </div>

      {/* Live Physical Mass Balance */}
      <div className="flex flex-col gap-2.5 bg-[#080809] border border-[#222222] p-3.5 relative overflow-hidden">
        <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-widest text-[#555]">
          <span>Mass Balance Distribution</span>
          <span className="text-[#A1824A] font-bold">LIVE</span>
        </div>
        
        {/* Top Percent bar */}
        <div className="flex flex-col gap-1 mt-1">
          <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
            <span>UPPER BULB</span>
            <span className="text-white font-bold">{stats.topPercentage}%</span>
          </div>
          <div className="w-full bg-[#141416] h-1.5 overflow-hidden">
            <div 
              className="bg-[#A1824A]/80 h-full transition-all duration-300 shadow-[0_0_8px_rgba(161,130,74,0.3)]" 
              style={{ width: `${stats.topPercentage}%` }}
            />
          </div>
        </div>

        {/* Bottom Percent bar */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
            <span>LOWER BULB</span>
            <span className="text-white font-bold">{stats.bottomPercentage}%</span>
          </div>
          <div className="w-full bg-[#141416] h-1.5 overflow-hidden">
            <div 
              className="bg-[#A1824A]/50 h-full transition-all duration-300" 
              style={{ width: `${stats.bottomPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Physics Core Actions (Primary Luxury Square Buttons) */}
      <div className="flex flex-col gap-3">
        <button
          onClick={() => {
            playSlickSound();
            onFlip();
          }}
          className="btn-action w-full py-3.5 border border-[#A1824A] bg-transparent hover:bg-[#A1824A]/10 text-[#A1824A] text-center font-mono text-[11px] font-semibold uppercase tracking-[0.25em] transition-all cursor-pointer active:scale-[0.99] select-none"
          id="btn_flip_hourglass"
        >
          INVERT GRAVITY [F]
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              playSlickSound();
              onShake();
            }}
            className="w-full py-3 border border-[#222] bg-transparent hover:bg-[#222]/50 hover:border-[#444] text-slate-400 hover:text-slate-200 text-center font-mono text-[10px] font-medium uppercase tracking-[0.15em] transition-all cursor-pointer select-none"
            id="btn_shake_hourglass"
          >
            AGITATE [SHAKE]
          </button>

          <button
            onClick={() => {
              try {
                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(320, ctx.currentTime);
                osc.frequency.linearRampToValueAtTime(30, ctx.currentTime + 0.4);
                gain.gain.setValueAtTime(0.04, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.41);
              } catch (e) {}
              onExplode?.();
            }}
            className="w-full py-3 border border-red-900/40 hover:border-red-500 bg-transparent hover:bg-red-500/10 text-red-400 hover:text-red-200 text-center font-mono text-[10px] font-medium uppercase tracking-[0.15em] transition-all cursor-pointer select-none"
            id="btn_explode_hourglass"
          >
            EXPLODE [BOOM]
          </button>
        </div>
      </div>

      {/* Section: Sand Color Styles */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-semibold text-[#555] uppercase tracking-[0.2em] flex items-center gap-1.5">
          <Palette className="w-3.5 h-3.5 text-[#A1824A]" />
          Sand Matter Selection
        </span>
        <div className="grid grid-cols-3 gap-2">
          {SAND_THEMES.map((theme) => {
            const isSelected = sandColorId === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => handleSandColorChange(theme.id)}
                className={`py-3 px-1 border flex flex-col items-center gap-2 transition-all relative cursor-pointer select-none ${
                  isSelected
                    ? 'bg-[#111112] border-[#A1824A] text-white'
                    : 'bg-transparent border-[#222222] hover:border-[#444] hover:bg-[#070708] text-slate-400'
                }`}
                id={`btn_theme_select_${theme.id}`}
              >
                {/* Dot swatch preview */}
                <div 
                  className="w-4 h-4 rounded-full border border-white/10" 
                  style={{ 
                    background: `linear-gradient(135deg, ${theme.color} 0%, ${theme.ambient} 100%)`,
                    boxShadow: isSelected ? `0 0 10px ${theme.color}60` : 'none'
                  }}
                />
                <span className="text-[9px] font-mono uppercase tracking-wider truncate w-full text-center">
                  {theme.name.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section: Glass material and tints */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-semibold text-[#555] uppercase tracking-[0.2em] flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-[#A1824A]" />
          Vessel Material Optic
        </span>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {GLASS_TINTS.map((tint) => {
            const isSelected = glassTintId === tint.id;
            return (
              <button
                key={tint.id}
                onClick={() => handleGlassTintChange(tint.id)}
                className={`py-2 px-2.5 text-left border flex items-center gap-2 transition-all cursor-pointer select-none ${
                  isSelected
                    ? 'bg-[#111112] border-[#A1824A] text-white'
                    : 'bg-transparent border-[#222222] hover:border-[#444] text-slate-400'
                }`}
                id={`btn_tint_select_${tint.id}`}
              >
                <div 
                  className="w-2.5 h-2.5" 
                  style={{ backgroundColor: tint.color === '#ffffff' ? 'rgba(255,255,255,0.7)' : tint.color }}
                />
                <span className="text-[10px] font-mono uppercase tracking-wide truncate">{tint.name.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section: Pillars Frame Style */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-semibold text-[#555] uppercase tracking-[0.2em] flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-[#A1824A]" />
          Structural Frame Pillars
        </span>
        <div className="flex flex-col gap-1.5">
          {PILLAR_MATERIALS.map((mat) => {
            const isSelected = pillarMaterialId === mat.id;
            return (
              <button
                key={mat.id}
                onClick={() => handlePillarChange(mat.id)}
                className={`py-2 px-3 border flex items-center justify-between text-left transition-all cursor-pointer select-none ${
                  isSelected
                    ? 'bg-[#111112] border-[#A1824A] text-white'
                    : 'bg-transparent border-[#222222] hover:border-[#444] text-slate-400'
                }`}
                id={`btn_pillar_select_${mat.id}`}
              >
                <span className="text-[10px] font-mono uppercase tracking-wider">{mat.name.split(' ')[0]} Frame</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-2 border border-white/10" style={{ backgroundColor: mat.capColor }} title="CAPS" />
                  <div className="w-1 h-3" style={{ backgroundColor: mat.pillarColor }} title="PILLARS" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section: Sandbox Volume & Flow controls */}
      <div className="flex flex-col gap-3 bg-[#080809] border border-[#222222] p-4">
        <span className="text-[10px] font-semibold text-[#555] uppercase tracking-[0.2em] flex items-center gap-1.5">
          <Settings className="w-3.5 h-3.5 text-[#A1824A]" />
          Granular Mechanics Settings
        </span>

        {/* Sandcount setting */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 uppercase tracking-wider">
            <span>Sand Density</span>
            <span className="text-[#A1824A] font-bold">{sandCount} Qty</span>
          </div>
          <input
            type="range"
            min="1000"
            max="10000"
            step="500"
            value={sandCount}
            onChange={(e) => {
              setSandCount(parseInt(e.target.value));
              playSlickSound();
            }}
            className="w-full h-1 cursor-pointer"
            id="slider_sand_particles_count"
          />
        </div>

        {/* Speed multiplier */}
        <div className="flex flex-col gap-2 mt-1">
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 uppercase tracking-wider">
            <span>Viscous Velocity</span>
            <span className="text-[#A1824A] font-bold">
              {flowMultiplier === 0 ? 'SUSPENDED' : `${flowMultiplier}.00x`}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {[0, 1, 2, 4].map((multi) => (
              <button
                key={multi}
                onClick={() => {
                  setFlowMultiplier(multi);
                  playSlickSound();
                }}
                className={`py-1.5 text-[9px] font-bold font-mono transition-all cursor-pointer ${
                  flowMultiplier === multi
                    ? 'bg-[#A1824A] text-[#050505] font-bold'
                    : 'bg-transparent border border-[#222222] hover:border-[#444] text-slate-400'
                }`}
                id={`btn_flow_speed_${multi}`}
              >
                {multi === 0 ? 'HOLD' : `${multi}X`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Section: Gravity Tilt Lever */}
      <div className="flex flex-col gap-3.5 bg-[#080809] border border-[#222222] p-4">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-semibold text-[#555] uppercase tracking-[0.2em] flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-[#A1824A]" />
            Gravity Axis Levers
          </span>
          
          {/* Gyro toggle widget */}
          <button
            onClick={() => {
              setGyroEnabled(!gyroEnabled);
              playSlickSound();
            }}
            className={`py-1 px-2.5 border text-[9px] font-bold transition-all flex items-center gap-1.5 cursor-pointer rounded-none uppercase select-none ${
              gyroEnabled
                ? 'bg-[#A1824A] text-black border-[#A1824A] font-bold'
                : 'bg-transparent text-slate-400 border-[#222] hover:border-[#444]'
            }`}
            id="btn_toggle_gyro_sensor"
          >
            {gyroEnabled ? 'SENSOR ON' : 'SENSOR OFF'}
          </button>
        </div>

        {gyroEnabled ? (
          /* Gyro telemetry dashboard */
          <div className="flex flex-col gap-1.5 bg-black/25 p-2.5 border border-[#222]/60 text-[10px] font-mono leading-relaxed">
            <div className="flex justify-between items-center text-slate-500 uppercase tracking-wider">
              <span>Telemetry Feed:</span>
              <span className={stats.sensorAvailable ? 'text-emerald-400 font-bold' : 'text-[#A1824A]'}>
                {stats.sensorAvailable ? 'ACTIVE' : 'NOT DETECTED'}
              </span>
            </div>
            <div className="flex justify-between text-slate-500 uppercase tracking-wider">
              <span>Current G-Force:</span>
              <span className="text-slate-350">{stats.sensorReading}</span>
            </div>
            {!stats.sensorAvailable && (
              <p className="text-[9px] text-slate-500 italic mt-1 font-sans leading-relaxed">
                💡 Gyroscope telemetry requires mobile device support. Desktops can utilize gravity tilt sliders below.
              </p>
            )}
          </div>
        ) : (
          /* Manual sliders */
          <div className="flex flex-col gap-3">
            {/* Tilt X Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                <span>Core Pitch (X-Axis)</span>
                <span className="text-[#A1824A] font-bold">{Math.round(tiltX)}°</span>
              </div>
              <input
                type="range"
                min="-90"
                max="90"
                value={tiltX}
                onChange={(e) => {
                  setTiltX(parseFloat(e.target.value));
                }}
                className="w-full h-1 cursor-pointer"
                id="slider_gravity_tilt_x"
              />
            </div>

            {/* Tilt Z Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                <span>Core Roll (Z-Axis)</span>
                <span className="text-[#A1824A] font-bold">{Math.round(tiltZ)}°</span>
              </div>
              <input
                type="range"
                min="-90"
                max="90"
                value={tiltZ}
                onChange={(e) => {
                  setTiltZ(parseFloat(e.target.value));
                }}
                className="w-full h-1 cursor-pointer"
                id="slider_gravity_tilt_z"
              />
            </div>

            {/* Tilt quick buttons Swatch */}
            <div className="grid grid-cols-4 gap-1 pt-1">
              {[
                { name: 'VERTICAL', x: 0, z: 0 },
                { name: 'TILT L', x: 0, z: -35 },
                { name: 'TILT R', x: 0, z: 35 },
                { name: 'FLAT', x: 0, z: 85 },
              ].map((preset, index) => {
                const isActive = tiltX === preset.x && tiltZ === preset.z;
                return (
                  <button
                    key={index}
                    onClick={() => {
                      setTiltX(preset.x);
                      setTiltZ(preset.z);
                      playSlickSound();
                    }}
                    className={`py-1 text-[9px] font-bold font-mono transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#A1824A] text-black'
                        : 'bg-transparent border border-[#222222] hover:border-[#444] text-slate-400'
                    }`}
                    id={`btn_preset_tilt_${index}`}
                  >
                    {preset.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Flow distribution interactive graph requested by the theme */}
      <div className="stat-item mt-2 flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="stat-label text-[10px] text-[#555] uppercase tracking-[0.15em]">
            Flow Distribution (Granular density)
          </span>
          <span className="text-[9px] font-mono text-slate-500">
            {stats.flowCount > 0 ? 'AGITATED' : 'STABLE'}
          </span>
        </div>
        <div style={{ height: '70px', width: '100%', border: '1px solid #222222', display: 'flex', alignItems: 'flex-end', padding: '4px' }}>
           <div 
             className="w-1/5 bg-[#A1824A] transition-all duration-300" 
             style={{ 
               height: `${25 + (stats.flowCount > 0 ? (Math.sin(Date.now() / 200) * 15 + 15) : 5)}%`,
             }} 
           />
           <div 
             className="w-1/5 bg-[#A1824A] ml-1.5 transition-all duration-300" 
             style={{ 
               height: `${45 + (stats.flowCount > 0 ? (Math.cos(Date.now() / 250) * 20 + 10) : 10)}%`,
             }}
           />
           <div 
             className="w-1/5 bg-[#A1824A] ml-1.5 transition-all duration-300" 
             style={{ 
               height: `${35 + (stats.flowCount > 0 ? (Math.sin(Date.now() / 300) * 15 + 15) : 3)}%`,
             }}
           />
           <div 
             className="w-1/5 bg-[#A1824A] ml-1.5 transition-all duration-300" 
             style={{ 
               height: `${70 + (stats.flowCount > 0 ? (Math.cos(Date.now() / 150) * 25 + 5) : 15)}%`,
             }}
           />
           <div 
             className="w-1/5 bg-[#A1824A] ml-1.5 transition-all duration-300" 
             style={{ 
               height: `${55 + (stats.flowCount > 0 ? (Math.sin(Date.now() / 400) * 20 + 10) : 8)}%`,
             }}
           />
        </div>
      </div>

      {/* Footer info block */}
      <div className="text-[9px] text-[#555] font-mono uppercase tracking-wider mt-auto leading-relaxed border-t border-[#222222] pt-4 flex items-start gap-1.5 select-none">
        <Info className="w-3.5 h-3.5 text-[#A1824A] shrink-0" />
        <p className="leading-normal">
          Interactive WebGL elements: Drag rendering canvas to rotate system camera. Gravity is computed real-time.
        </p>
      </div>

    </div>
  );
}
