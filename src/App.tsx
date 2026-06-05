/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Compass,
  RotateCw,
  Zap,
  HelpCircle,
  X,
  Volume2,
  Info,
  ChevronRight,
  Hexagon,
  Sparkles
} from 'lucide-react';
import HourglassCanvas from './components/HourglassCanvas';
import ControlPanel from './components/ControlPanel';
import { SandColorId, GlassTintId, PillarMaterialId } from './types';

export default function App() {
  // Configuration states
  const [sandColorId, setSandColorId] = useState<SandColorId>('gold');
  const [glassTintId, setGlassTintId] = useState<GlassTintId>('clear');
  const [pillarMaterialId, setPillarMaterialId] = useState<PillarMaterialId>('brass');
  const [sandCount, setSandCount] = useState<number>(4500);
  const [flowMultiplier, setFlowMultiplier] = useState<number>(1);
  const [gyroEnabled, setGyroEnabled] = useState<boolean>(false);
  
  // Custom manual slider tilts
  const [tiltX, setTiltX] = useState<number>(0);
  const [tiltZ, setTiltZ] = useState<number>(0);

  // System triggers for canvas
  const [triggerFlip, setTriggerFlip] = useState<boolean>(false);
  const [triggerShake, setTriggerShake] = useState<boolean>(false);
  const [triggerExplode, setTriggerExplode] = useState<boolean>(false);

  // Stats reports from WebGL canvas
  const [stats, setStats] = useState({
    topPercentage: 100,
    bottomPercentage: 0,
    flowCount: 0,
    elapsedSec: 0,
    sensorAvailable: false,
    sensorReading: '無連線訊號',
  });

  // Modal display toggles
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [iosPermissionRequested, setIosPermissionRequested] = useState<boolean>(false);

  // Iframe Scroll & Vercount Sync
  useEffect(() => {
    let lastScrollY = 0;
    const scrollThreshold = 8;
    
    const handleScroll = () => {
      const currentScrollY = window.scrollY || document.documentElement.scrollTop;
      if (Math.abs(currentScrollY - lastScrollY) < scrollThreshold && currentScrollY > 10) return;
      const direction = currentScrollY > lastScrollY ? 'down' : 'up';
      
      window.parent.postMessage({
        type: 'iframe_scroll',
        scrollY: currentScrollY,
        direction: direction
      }, '*');
      
      lastScrollY = currentScrollY;
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Initial Vercount fetch if available
    if ((window as any).vercount && typeof (window as any).vercount.fetch === 'function') {
      (window as any).vercount.fetch();
    }

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Actions
  const handleFlip = () => {
    setTriggerFlip(true);
  };

  const handleShake = () => {
    setTriggerShake(true);
  };

  const handleEnableGyro = async () => {
    setGyroEnabled(true);
    setIosPermissionRequested(true);
    // Request permission explicitly in iOS Safari structures
    if (
      typeof window !== 'undefined' &&
      typeof (DeviceOrientationEvent as any).requestPermission === 'function'
    ) {
      try {
        const permissionState = await (DeviceOrientationEvent as any).requestPermission();
        if (permissionState === 'granted') {
          console.log('Mobile Gyroscope permission granted!');
        } else {
          alert('陀螺儀權限已被阻擋，系統將切換回滑輪手動調整重力。');
          setGyroEnabled(false);
        }
      } catch (error) {
        console.error('DeviceOrientation permission request error:', error);
      }
    }
  };

  return (
    <div className="min-h-screen text-slate-200 flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden relative" id="app_root_viewport_wrapper">
      
      {/* Elegant Dark Background (pitch-black with subtle spotlight from the center) */}
      <div className="absolute inset-0 bg-[#050505] z-0" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(15,15,16,0.85)_0%,rgba(5,5,5,1)_100%)] pointer-events-none" />
      
      {/* Decorative subtle ambient soft gold stardust aura */}
      <div className="absolute inset-0 bg-[radial-gradient(#A1824A_1px,transparent_1px)] [background-size:32px_32px] opacity-10 pointer-events-none" />

      {/* Primary Layout Card */}
      <div className="w-full max-w-6xl flex flex-col lg:flex-row h-[94vh] lg:h-[86vh] rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-[#222222] bg-[#0c0c0d] relative z-10" id="main_app_card_grid">
        
        {/* Left pane: Immerge 3D sandbox Canvas */}
        <div className="flex-1 min-h-[40vh] lg:h-full relative flex items-center justify-center bg-[#070708] border-b lg:border-b-0 lg:border-r border-[#222222] overflow-hidden" id="left_pane_canvas_viewport">
          
          {/* Virtual desk horizon highlight shadow */}
          <div className="absolute inset-x-0 bottom-0 h-40 bg-[radial-gradient(ellipse_at_bottom,rgba(161,130,74,0.02)_0%,transparent_70%)] pointer-events-none" />
          
          {/* Top telemetry heads-up line */}
          <div className="absolute top-5 left-5 right-5 flex justify-between items-center pointer-events-none z-20">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#A1824A] animate-pulse" />
              <span className="text-[10px] font-mono text-[#555] uppercase tracking-[0.2em] leading-none">
                RTX // PHYSICAL_ACCEL_ON
              </span>
            </div>
            
            <button 
              onClick={() => setShowHelp(true)}
              className="p-1.5 rounded-lg bg-black/40 hover:bg-[#A1824A]/10 active:bg-[#A1824A]/20 text-slate-500 hover:text-[#A1824A] transition-all border border-[#222] pointer-events-auto cursor-pointer"
              title="查看操作說明"
              id="btn_open_help_modal"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>

          {/* Central Canvas Container */}
          <div className="w-full h-full relative flex items-center justify-center">
            <HourglassCanvas
              sandColorId={sandColorId}
              glassTintId={glassTintId}
              pillarMaterialId={pillarMaterialId}
              sandCount={sandCount}
              flowMultiplier={flowMultiplier}
              gyroEnabled={gyroEnabled}
              tiltX={tiltX}
              tiltZ={tiltZ}
              onStatsUpdate={setStats}
              triggerFlip={triggerFlip}
              onFlipComplete={() => setTriggerFlip(false)}
              triggerShake={triggerShake}
              onShakeComplete={() => setTriggerShake(false)}
              triggerExplode={triggerExplode}
              onExplodeComplete={() => setTriggerExplode(false)}
            />

            {/* Quick action helper tooltip */}
            <div className="absolute bottom-5 inset-x-5 flex justify-center text-center pointer-events-none z-20">
              <span className="text-[10px] sm:text-xs text-[#555] font-sans tracking-[0.1em] uppercase">
                💡 手指/滑鼠拖曳旋轉 3D 沙漏 | 使用方向盤般傾斜即可引流沙粒
              </span>
            </div>
          </div>
        </div>

        {/* Right pane: Control Panel (sidebar settings) */}
        <div className="w-full lg:w-[410px] h-[54vh] lg:h-full shrink-0 relative bg-[#0c0c0d]" id="right_pane_control_dashboard">
          <ControlPanel
            sandColorId={sandColorId}
            setSandColorId={setSandColorId}
            glassTintId={glassTintId}
            setGlassTintId={setGlassTintId}
            pillarMaterialId={pillarMaterialId}
            setPillarMaterialId={setPillarMaterialId}
            sandCount={sandCount}
            setSandCount={setSandCount}
            flowMultiplier={flowMultiplier}
            setFlowMultiplier={setFlowMultiplier}
            gyroEnabled={gyroEnabled}
            setGyroEnabled={setGyroEnabled}
            tiltX={tiltX}
            setTiltX={setTiltX}
            tiltZ={tiltZ}
            setTiltZ={setTiltZ}
            onFlip={handleFlip}
            onShake={handleShake}
            onExplode={() => setTriggerExplode(true)}
            stats={stats}
          />
        </div>
      </div>

      {/* --- Help Dialog Modal Overlay --- */}
      <AnimatePresence>
        {showHelp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md" id="help_modal_overlay">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0C0C0D] border border-[#222222] rounded-xl max-w-md w-full p-6 shadow-2xl relative"
            >
              <button
                onClick={() => setShowHelp(false)}
                className="absolute top-4 right-4 p-1 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white transition-all cursor-pointer"
                id="btn_close_help_modal"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 mb-4 border-b border-[#222]/60 pb-3">
                <Compass className="w-5 h-5 text-[#A1824A] mr-1" />
                <h3 className="text-sm uppercase tracking-[0.2em] text-[#A1824A] font-bold">沙漏交互物理說明</h3>
              </div>

              <div className="space-y-4 text-xs text-slate-450 leading-relaxed font-sans">
                <div>
                  <h4 className="text-slate-200 font-semibold mb-1 flex items-center gap-1 uppercase tracking-wider">
                    <ChevronRight className="w-4 h-4 text-[#A1824A]" />
                    1. 3D 空間視角旋轉
                  </h4>
                  <p className="pl-5 text-slate-400">
                    在沙漏畫面上按下並拖曳滑鼠 (或點觸滑動螢幕)，即可 360° 轉動沙漏角度。
                    流沙會隨着您的視角姿態，朝著畫面的「真實物理下方向」滑落堆積。
                  </p>
                </div>

                <div>
                  <h4 className="text-slate-200 font-semibold mb-1 flex items-center gap-1 uppercase tracking-wider">
                    <ChevronRight className="w-4 h-4 text-[#A1824A]" />
                    2. 重力感應 (陀螺儀)
                  </h4>
                  <p className="pl-5 text-slate-400">
                    將重力感應打開，並使用手機/平板瀏覽。此時直接倾斜手機，流沙的速度、角度、堆疊斜率皆會完美跟隨實體力學響應！
                  </p>
                </div>

                <div>
                  <h4 className="text-slate-200 font-semibold mb-1 flex items-center gap-1 uppercase tracking-wider">
                    <ChevronRight className="w-4 h-4 text-[#A1824A]" />
                    3. 電腦與手動控制重力
                  </h4>
                  <p className="pl-5 text-slate-400">
                    若使用桌機玩耍，請將重力感應關閉。此時，面板將解鎖兩個「前後/左右傾斜度」調整滑桿，這能讓您模擬任何特定倾角！
                  </p>
                </div>

                <div>
                  <h4 className="text-slate-200 font-semibold mb-1 flex items-center gap-1 uppercase tracking-wider">
                    <ChevronRight className="w-4 h-4 text-[#A1824A]" />
                    4. 急速翻轉與激盪
                  </h4>
                  <p className="pl-5 text-slate-400">
                    當沙粒全部流光時，按下「翻轉 180°」即可觸發完美的旋轉翻面效果，並重新開始物理計時與流沙；按下「搖晃」則可提供高頻擾動震散沙柱！
                  </p>
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowHelp(false)}
                className="w-full mt-6 py-3 border border-[#A1824A] bg-transparent hover:bg-[#A1824A]/10 text-[#A1824A] uppercase tracking-[0.2em] text-[11px] font-bold rounded-none transition-all cursor-pointer"
                id="btn_close_help_action"
              >
                CLOSE // ENTER ENGINE
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Orientation Permission Trigger Prompt */}
      {gyroEnabled && !stats.sensorAvailable && !iosPermissionRequested && (
        <div className="absolute inset-x-0 bottom-6 px-4 z-40 flex justify-center pointer-events-none">
          <div className="bg-[#0C0C0D] border border-[#222222] shadow-2xl rounded-xl p-3.5 max-w-sm w-full flex items-center justify-between gap-4 pointer-events-auto">
            <div className="flex items-start gap-2 text-[11px]">
              <Compass className="w-4 h-4 text-[#A1824A] shrink-0 mt-0.5 animate-spin-slow" />
              <div>
                <h5 className="font-semibold text-slate-200 uppercase tracking-wider">Enable Gyro Sensor?</h5>
                <p className="text-slate-500 mt-0.5">需要權限許可方可讀取物理重力加速度與流動連動。</p>
              </div>
            </div>
            <button
              onClick={handleEnableGyro}
              className="py-1.5 px-3 bg-[#A1824A] hover:bg-[#A1824A]/90 text-black uppercase tracking-wider font-bold text-[10px] shrink-0 transition-all cursor-pointer"
              id="btn_request_orientation_permission_toast"
            >
              ENABLE
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
