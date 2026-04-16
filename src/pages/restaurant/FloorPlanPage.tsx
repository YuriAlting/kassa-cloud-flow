import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Trash2, X, Clock, Monitor, Plus, Pencil, Save, RotateCcw, Leaf, Square, Circle } from 'lucide-react';
import { usePosStore } from '@/stores/posStore';
import {
  DndContext,
  useDraggable,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';

interface FloorSection {
  id: string;
  name: string;
  sort_order: number;
  restaurant_id: string;
}

interface TableItem {
  id: string;
  restaurant_id: string;
  floor_section_id: string | null;
  table_number: string;
  seats: number;
  shape: string;
  position_x: number;
  position_y: number;
  status: string;
  is_takeaway: boolean;
}

interface ActiveOrder {
  id: string;
  order_number: number;
  created_at: string;
  table_id: string | null;
}

interface OrderItemDetail {
  name_snapshot: string;
  quantity: number;
  unit_price: number;
}

interface Restaurant {
  id: string;
  name: string;
}

interface DecoElement {
  id: string;
  type: 'plant' | 'wall';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

const ACCENT = '#f59e0b';
const GRID_SIZE = 20;

// Indoor theme
const INDOOR = {
  floor: '#18120a',
  floorAlt: '#1d1510',
  wall: '#2c2218',
  wallStroke: '#3a2e20',
  chairFill: '#3d2e1a',
  chairStroke: '#5a4428',
  chairBack: '#4a3820',
  tableVrij: { fill: '#1e2e14', stroke: '#2a4018', shadow: '#0a1506' },
  tableBezet: { fill: '#2e1414', stroke: '#501818', shadow: '#150808' },
  tableGeleverd: { fill: '#2a2e14', stroke: '#404018', shadow: '#141508' },
};

// Terrace/outdoor theme
const OUTDOOR = {
  floor: '#2a2618',
  floorAlt: '#302c1e',
  wall: '#3a3020',
  wallStroke: '#4a3e28',
  chairFill: '#4a3c20',
  chairStroke: '#6a5830',
  chairBack: '#5a4828',
  tableVrij: { fill: '#253020', stroke: '#3a4828', shadow: '#101808' },
  tableBezet: { fill: '#302020', stroke: '#502828', shadow: '#180808' },
  tableGeleverd: { fill: '#2c2e18', stroke: '#484820', shadow: '#181808' },
};

function isOutdoor(sectionName: string) {
  const n = sectionName.toLowerCase();
  return n.includes('terras') || n.includes('buiten') || n.includes('tuin') || n.includes('outside') || n.includes('outdoor');
}

const STATUS_COLORS: Record<string, { dot: string; label: string }> = {
  vrij:     { dot: '#4ade80', label: 'Vrij' },
  bezet:    { dot: '#f87171', label: 'Bezet' },
  geleverd: { dot: ACCENT,   label: 'Geleverd' },
};

function TimeAgo({ since }: { since: string }) {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    const update = () => {
      const diff = Math.floor((Date.now() - new Date(since).getTime()) / 1000);
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      setElapsed(`${m}:${s.toString().padStart(2, '0')}`);
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [since]);
  return <span className="flex items-center gap-1 text-xs font-mono" style={{ color: ACCENT }}><Clock className="w-3 h-3" />{elapsed}</span>;
}

function renderChairs(cx: number, cy: number, shape: string, seats: number, tableW: number, tableH: number, theme: typeof INDOOR) {
  const chairs: JSX.Element[] = [];

  if (shape === 'round') {
    const radius = tableW / 2 + 16;
    for (let i = 0; i < seats; i++) {
      const angle = (2 * Math.PI * i) / seats - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      const rot = (angle * 180) / Math.PI + 90;
      chairs.push(
        <g key={i} transform={`rotate(${rot}, ${x}, ${y})`}>
          {/* Seat */}
          <rect x={x - 8} y={y - 5} width={16} height={10} rx={3}
            fill={theme.chairFill} stroke={theme.chairStroke} strokeWidth={0.8} />
          {/* Backrest */}
          <rect x={x - 7} y={y - 10} width={14} height={6} rx={2}
            fill={theme.chairBack} stroke={theme.chairStroke} strokeWidth={0.6} />
          {/* Seat detail line */}
          <line x1={x - 5} y1={y - 2} x2={x + 5} y2={y - 2} stroke={theme.chairStroke} strokeWidth={0.4} opacity={0.6} />
        </g>
      );
    }
  } else {
    const halfW = tableW / 2, halfH = tableH / 2;
    const perSide = Math.ceil(seats / 4);
    let remaining = seats;

    const topCount = Math.min(perSide, remaining); remaining -= topCount;
    const botCount = Math.min(perSide, remaining); remaining -= botCount;
    const leftCount = Math.min(perSide, remaining); remaining -= leftCount;
    const rightCount = Math.min(perSide, remaining);

    const gap = 20;

    const addChairs = (count: number, side: 'top'|'bottom'|'left'|'right', startIdx: number) => {
      for (let i = 0; i < count; i++) {
        const offset = (i - (count - 1) / 2) * gap;
        let x = cx, y = cy, rot = 0;
        if (side === 'top')    { x = cx + offset; y = cy - halfH - 14; rot = 0; }
        if (side === 'bottom') { x = cx + offset; y = cy + halfH + 14; rot = 180; }
        if (side === 'left')   { x = cx - halfW - 14; y = cy + offset; rot = -90; }
        if (side === 'right')  { x = cx + halfW + 14; y = cy + offset; rot = 90; }

        chairs.push(
          <g key={`${side}-${i}`} transform={`rotate(${rot}, ${x}, ${y})`}>
            <rect x={x - 8} y={y - 5} width={16} height={10} rx={3}
              fill={theme.chairFill} stroke={theme.chairStroke} strokeWidth={0.8} />
            <rect x={x - 7} y={y - 10} width={14} height={6} rx={2}
              fill={theme.chairBack} stroke={theme.chairStroke} strokeWidth={0.6} />
            <line x1={x - 5} y1={y - 2} x2={x + 5} y2={y - 2} stroke={theme.chairStroke} strokeWidth={0.4} opacity={0.6} />
          </g>
        );
      }
    };

    addChairs(topCount, 'top', 0);
    addChairs(botCount, 'bottom', topCount);
    addChairs(leftCount, 'left', topCount + botCount);
    addChairs(rightCount, 'right', topCount + botCount + leftCount);
  }
  return chairs;
}

function SVGTable({ table, selected, activeOrder, outdoor }: {
  table: TableItem; selected: boolean; activeOrder?: ActiveOrder; outdoor: boolean;
}) {
  const theme = outdoor ? OUTDOOR : INDOOR;
  const statusTheme = table.status === 'bezet' ? theme.tableBezet
    : table.status === 'geleverd' ? theme.tableGeleverd
    : theme.tableVrij;
  const dot = STATUS_COLORS[table.status]?.dot || STATUS_COLORS.vrij.dot;

  const isRound = table.shape === 'round';
  const w = table.seats <= 2 ? 56 : table.seats <= 4 ? 76 : 96;
  const h = isRound ? w : (table.seats <= 2 ? 56 : table.seats <= 4 ? 76 : 96);
  const cx = table.position_x;
  const cy = table.position_y;

  return (
    <g>
      {renderChairs(cx, cy, table.shape, table.seats, w, h, theme)}

      {/* Drop shadow */}
      {isRound ? (
        <circle cx={cx + 2} cy={cy + 3} r={w / 2} fill={statusTheme.shadow} opacity={0.6} />
      ) : (
        <rect x={cx - w / 2 + 2} y={cy - h / 2 + 3} width={w} height={h} rx={8}
          fill={statusTheme.shadow} opacity={0.6} />
      )}

      {/* Table surface */}
      {isRound ? (
        <>
          <circle cx={cx} cy={cy} r={w / 2} fill={statusTheme.fill}
            stroke={selected ? ACCENT : statusTheme.stroke}
            strokeWidth={selected ? 2.5 : 1.5} />
          {/* Wood grain rings */}
          <circle cx={cx} cy={cy} r={w / 2 - 6} fill="none" stroke={statusTheme.stroke} strokeWidth={0.5} opacity={0.4} />
          <circle cx={cx} cy={cy} r={w / 2 - 14} fill="none" stroke={statusTheme.stroke} strokeWidth={0.4} opacity={0.25} />
          {/* Center detail */}
          <circle cx={cx} cy={cy} r={4} fill={statusTheme.stroke} opacity={0.5} />
        </>
      ) : (
        <>
          <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={8}
            fill={statusTheme.fill}
            stroke={selected ? ACCENT : statusTheme.stroke}
            strokeWidth={selected ? 2.5 : 1.5} />
          {/* Wood grain lines */}
          <line x1={cx - w/2 + 8} y1={cy - h/2 + 4} x2={cx - w/2 + 8} y2={cy + h/2 - 4}
            stroke={statusTheme.stroke} strokeWidth={0.5} opacity={0.35} />
          <line x1={cx} y1={cy - h/2 + 4} x2={cx} y2={cy + h/2 - 4}
            stroke={statusTheme.stroke} strokeWidth={0.4} opacity={0.2} />
          <line x1={cx + w/2 - 8} y1={cy - h/2 + 4} x2={cx + w/2 - 8} y2={cy + h/2 - 4}
            stroke={statusTheme.stroke} strokeWidth={0.5} opacity={0.35} />
          {/* Inner border detail */}
          <rect x={cx - w/2 + 5} y={cy - h/2 + 5} width={w - 10} height={h - 10} rx={5}
            fill="none" stroke={statusTheme.stroke} strokeWidth={0.5} opacity={0.3} />
        </>
      )}

      {/* Status dot with glow */}
      <circle cx={cx + (isRound ? w/2 - 8 : w/2 - 10)} cy={cy - (isRound ? w/2 - 8 : h/2 - 10)}
        r={7} fill={dot} opacity={0.2} />
      <circle cx={cx + (isRound ? w/2 - 8 : w/2 - 10)} cy={cy - (isRound ? w/2 - 8 : h/2 - 10)}
        r={4} fill={dot} />

      {/* Outdoor table umbrella hint */}
      {outdoor && (
        <line x1={cx} y1={cy - h/2 - 5} x2={cx} y2={cy + h/2 + 5}
          stroke={OUTDOOR.chairStroke} strokeWidth={1} opacity={0.3} />
      )}

      {/* Table number */}
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
        fill="white" fontSize={15} fontWeight="700" fontFamily="Inter, sans-serif"
        style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
        {table.table_number}
      </text>

      {/* Timer */}
      {activeOrder && table.status === 'bezet' && (
        <foreignObject x={cx - 32} y={cy + (isRound ? w/2 : h/2) + 6} width={64} height={18}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <TimeAgo since={activeOrder.created_at} />
          </div>
        </foreignObject>
      )}
    </g>
  );
}

function SVGPlant({ x, y, outdoor }: { x: number; y: number; outdoor?: boolean }) {
  const potColor = outdoor ? '#4a3820' : '#3a2e18';
  const leafDark = outdoor ? '#1a4010' : '#143010';
  const leafMid = outdoor ? '#286020' : '#1e5018';
  const leafLight = outdoor ? '#3a8030' : '#2a6820';

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Pot */}
      <rect x={-7} y={6} width={14} height={10} rx={2} fill={potColor} stroke="#2a1e10" strokeWidth={0.5} />
      <rect x={-8} y={4} width={16} height={4} rx={1} fill={potColor} stroke="#2a1e10" strokeWidth={0.5} />
      {/* Soil */}
      <ellipse cx={0} cy={5} rx={7} ry={2} fill="#1a1008" opacity={0.6} />
      {/* Leaves */}
      <ellipse cx={0} cy={-8} rx={9} ry={12} fill={leafDark} opacity={0.9} />
      <ellipse cx={-6} cy={-4} rx={6} ry={9} fill={leafMid} opacity={0.8} transform="rotate(-20, -6, -4)" />
      <ellipse cx={6} cy={-5} rx={6} ry={9} fill={leafMid} opacity={0.8} transform="rotate(20, 6, -5)" />
      <ellipse cx={0} cy={-12} rx={5} ry={7} fill={leafLight} opacity={0.7} />
      <ellipse cx={-3} cy={-6} rx={3} ry={5} fill={leafLight} opacity={0.5} transform="rotate(-30, -3, -6)" />
      <ellipse cx={3} cy={-7} rx={3} ry={5} fill={leafLight} opacity={0.5} transform="rotate(30, 3, -7)" />
    </g>
  );
}

function SVGFloor({ width, height, outdoor }: { width: number; height: number; outdoor: boolean }) {
  if (outdoor) {
    // Patio stone pattern
    return (
      <g>
        <rect x={0} y={0} width={width} height={height} fill={OUTDOOR.floor} />
        {/* Stone tiles */}
        {Array.from({ length: Math.ceil(height / 60) }).map((_, row) =>
          Array.from({ length: Math.ceil(width / 80) }).map((_, col) => {
            const offset = row % 2 === 0 ? 0 : 40;
            return (
              <rect key={`${row}-${col}`}
                x={col * 80 + offset - 2} y={row * 60}
                width={78} height={58} rx={2}
                fill="none" stroke={OUTDOOR.floorAlt} strokeWidth={0.6} opacity={0.25} />
            );
          })
        )}
        {/* Subtle ambient light */}
        <radialGradient id="outdoor-light" cx="50%" cy="30%" r="60%">
          <stop offset="0%" stopColor="#fff8e1" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#fff8e1" stopOpacity="0" />
        </radialGradient>
        <rect x={0} y={0} width={width} height={height} fill="url(#outdoor-light)" />
      </g>
    );
  }
  return (
    <g>
      <rect x={0} y={0} width={width} height={height} fill={INDOOR.floor} />
      {/* Parquet wood planks */}
      {Array.from({ length: Math.ceil(height / 40) }).map((_, row) =>
        Array.from({ length: Math.ceil(width / 120) }).map((_, col) => {
          const offset = (row % 3) * 40;
          return (
            <rect key={`${row}-${col}`}
              x={col * 120 + (offset % 120)} y={row * 40}
              width={118} height={38} rx={1}
              fill="none" stroke={INDOOR.floorAlt} strokeWidth={0.5} opacity={0.2} />
          );
        })
      )}
      {/* Warm ambient glow center */}
      <radialGradient id="indoor-light" cx="50%" cy="40%" r="55%">
        <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.04" />
        <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
      </radialGradient>
      <rect x={0} y={0} width={width} height={height} fill="url(#indoor-light)" />
    </g>
  );
}

function SVGWalls({ width, height, outdoor }: { width: number; height: number; outdoor: boolean }) {
  const wallColor = outdoor ? OUTDOOR.wall : INDOOR.wall;
  const wallStroke = outdoor ? OUTDOOR.wallStroke : INDOOR.wallStroke;
  const wallW = 10;
  const doorW = 80;
  const doorX = width / 2 - doorW / 2;

  if (outdoor) {
    // Terrace: open railing/fence instead of solid walls
    return (
      <g>
        {/* Fence posts top */}
        {Array.from({ length: 12 }).map((_, i) => (
          <rect key={`top-${i}`} x={i * (width / 11) - 3} y={0} width={6} height={14} rx={2}
            fill={wallColor} stroke={wallStroke} strokeWidth={0.5} />
        ))}
        {/* Fence rail top */}
        <rect x={0} y={0} width={width} height={4} fill={wallColor} opacity={0.6} />
        <rect x={0} y={10} width={width} height={2} fill={wallColor} opacity={0.4} />
        {/* Left fence */}
        {Array.from({ length: 8 }).map((_, i) => (
          <rect key={`left-${i}`} x={0} y={i * (height / 7) - 3} width={14} height={6} rx={2}
            fill={wallColor} stroke={wallStroke} strokeWidth={0.5} />
        ))}
        <rect x={0} y={0} width={4} height={height} fill={wallColor} opacity={0.6} />
        {/* Right fence */}
        {Array.from({ length: 8 }).map((_, i) => (
          <rect key={`right-${i}`} x={width - 14} y={i * (height / 7) - 3} width={14} height={6} rx={2}
            fill={wallColor} stroke={wallStroke} strokeWidth={0.5} />
        ))}
        <rect x={width - 4} y={0} width={4} height={height} fill={wallColor} opacity={0.6} />
        {/* Bottom open (entrance to inside) */}
        <rect x={0} y={height - 4} width={doorX - 10} height={4} fill={wallColor} opacity={0.4} />
        <rect x={doorX + doorW + 10} y={height - 4} width={width - doorX - doorW - 10} height={4} fill={wallColor} opacity={0.4} />
        {/* Terras label */}
        <text x={width / 2} y={height - 12} textAnchor="middle" fontSize={11} fontWeight="700"
          fill="#8a7850" fontFamily="Inter, sans-serif" opacity={0.8}>
          ☀ Terras
        </text>
      </g>
    );
  }

  return (
    <g>
      {/* Wall shadows for depth */}
      <rect x={wallW} y={wallW} width={width - wallW * 2} height={6} fill="#000" opacity={0.15} />
      <rect x={wallW} y={wallW} width={6} height={height - wallW * 2} fill="#000" opacity={0.1} />

      {/* Top wall */}
      <rect x={0} y={0} width={width} height={wallW} fill={wallColor} />
      <rect x={0} y={0} width={width} height={2} fill={wallStroke} opacity={0.6} />
      {/* Left wall */}
      <rect x={0} y={0} width={wallW} height={height} fill={wallColor} />
      <rect x={0} y={0} width={2} height={height} fill={wallStroke} opacity={0.6} />
      {/* Right wall */}
      <rect x={width - wallW} y={0} width={wallW} height={height} fill={wallColor} />
      <rect x={width - 2} y={0} width={2} height={height} fill={wallStroke} opacity={0.6} />
      {/* Bottom wall with door gap */}
      <rect x={0} y={height - wallW} width={doorX} height={wallW} fill={wallColor} />
      <rect x={doorX + doorW} y={height - wallW} width={width - doorX - doorW} height={wallW} fill={wallColor} />
      <rect x={0} y={height - 2} width={doorX} height={2} fill={wallStroke} opacity={0.5} />
      <rect x={doorX + doorW} y={height - 2} width={width - doorX - doorW} height={2} fill={wallStroke} opacity={0.5} />

      {/* Door frame */}
      <rect x={doorX - 3} y={height - wallW - 2} width={6} height={wallW + 2} rx={1} fill={wallStroke} opacity={0.8} />
      <rect x={doorX + doorW - 3} y={height - wallW - 2} width={6} height={wallW + 2} rx={1} fill={wallStroke} opacity={0.8} />
      {/* Door arc */}
      <path d={`M ${doorX} ${height - wallW} A ${doorW / 2} ${doorW / 2} 0 0 1 ${doorX + doorW / 2} ${height - wallW - doorW / 2}`}
        fill="none" stroke={wallStroke} strokeWidth={1} strokeDasharray="5 3" opacity={0.4} />
      <line x1={doorX} y1={height - wallW} x2={doorX + doorW / 2} y2={height - wallW - doorW / 2}
        stroke={wallStroke} strokeWidth={1} opacity={0.5} />

      <text x={width / 2} y={height - wallW - 6} textAnchor="middle" fontSize={9} fontWeight="600"
        fill="#6b5a3a" fontFamily="Inter, sans-serif">
        Ingang
      </text>
    </g>
  );
}

function SVGKitchen({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g>
      {/* Shadow */}
      <rect x={x + 2} y={y + 2} width={w} height={h} rx={4} fill="#000" opacity={0.3} />
      {/* Body */}
      <rect x={x} y={y} width={w} height={h} rx={4} fill="#131210" stroke="#2a2018" strokeWidth={1.5} />
      {/* Top accent stripe */}
      <rect x={x} y={y} width={w} height={4} rx={2} fill="#2a2018" opacity={0.8} />
      {/* Burners */}
      <circle cx={x + 22} cy={y + 22} r={9} fill="#1e1c16" stroke="#3a3020" strokeWidth={1} />
      <circle cx={x + 22} cy={y + 22} r={5} fill="#252318" stroke="#f59e0b" strokeWidth={0.5} opacity={0.4} />
      <circle cx={x + 48} cy={y + 22} r={9} fill="#1e1c16" stroke="#3a3020" strokeWidth={1} />
      <circle cx={x + 48} cy={y + 22} r={5} fill="#252318" stroke="#f59e0b" strokeWidth={0.5} opacity={0.4} />
      {/* Pass window */}
      <rect x={x + 8} y={y + h - 6} width={w - 16} height={8} rx={2} fill={ACCENT} opacity={0.25} />
      <rect x={x + 8} y={y + h - 6} width={w - 16} height={2} rx={1} fill={ACCENT} opacity={0.4} />
      <text x={x + w / 2} y={y + 42} textAnchor="middle" fontSize={10} fontWeight="700"
        fill="#6b5a3a" fontFamily="Inter, sans-serif">
        Keuken
      </text>
      <text x={x + w / 2} y={y + h + 10} textAnchor="middle" fontSize={8} fill={ACCENT} opacity={0.5}
        fontFamily="Inter, sans-serif">
        doorgeefluk
      </text>
    </g>
  );
}

function SVGBar({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g>
      <rect x={x + 2} y={y + 2} width={w} height={h} rx={8} fill="#000" opacity={0.25} />
      {/* Bar counter */}
      <rect x={x} y={y} width={w} height={h} rx={8} fill="#1a1510" stroke="#3a2e18" strokeWidth={1.5} />
      {/* Counter top edge highlight */}
      <rect x={x + 2} y={y + 2} width={w - 4} height={4} rx={3} fill="#3a2e18" opacity={0.6} />
      {/* Bar stools suggestion */}
      {Array.from({ length: 4 }).map((_, i) => (
        <circle key={i} cx={x + 16 + i * 22} cy={y + h + 10} r={6}
          fill="#2a2018" stroke="#3a3020" strokeWidth={0.8} />
      ))}
      {/* Bottles silhouette */}
      <rect x={x + 10} y={y + 8} width={4} height={20} rx={2} fill="#2a2018" opacity={0.7} />
      <rect x={x + 18} y={y + 10} width={4} height={18} rx={2} fill="#2a2018" opacity={0.6} />
      <rect x={x + 26} y={y + 6} width={4} height={22} rx={2} fill="#2a2018" opacity={0.7} />
      <text x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle" fontSize={11} fontWeight="700"
        fill="#6b5a3a" fontFamily="Inter, sans-serif">
        Bar
      </text>
    </g>
  );
}

function SVGKassa({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x + 2} y={y + 2} width={90} height={62} rx={6} fill="#000" opacity={0.25} />
      <rect x={x} y={y} width={90} height={62} rx={6} fill="#131210" stroke={ACCENT} strokeWidth={1.5} opacity={0.9} />
      {/* Screen */}
      <rect x={x + 8} y={y + 6} width={74} height={36} rx={4} fill="#1a1810" stroke="#2a2618" strokeWidth={1} />
      <rect x={x + 10} y={y + 8} width={70} height={32} rx={3} fill="#0a0f08" opacity={0.8} />
      {/* Screen glow */}
      <rect x={x + 12} y={y + 10} width={30} height={3} rx={1} fill={ACCENT} opacity={0.3} />
      {/* Keyboard hint */}
      <rect x={x + 8} y={y + 48} width={74} height={10} rx={3} fill="#1a1810" stroke="#2a2618" strokeWidth={0.8} />
      {Array.from({ length: 8 }).map((_, i) => (
        <rect key={i} x={x + 11 + i * 9} y={y + 50} width={7} height={6} rx={1}
          fill="#252318" stroke="#3a3020" strokeWidth={0.4} />
      ))}
      <foreignObject x={x} y={y} width={90} height={62}>
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 2 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: ACCENT, opacity: 0.8 }}>KASSA</span>
        </div>
      </foreignObject>
    </g>
  );
}

function SVGWelcomeMat({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={4} fill="#2a2018" opacity={0.5} />
      {/* Mat pattern lines */}
      {Array.from({ length: 5 }).map((_, i) => (
        <line key={i} x1={x + 4} y1={y + 3 + i * 3} x2={x + w - 4} y2={y + 3 + i * 3}
          stroke="#3a3020" strokeWidth={0.5} opacity={0.4} />
      ))}
      <text x={x + w / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="central"
        fontSize={7} fill="#6b5a3a" fontFamily="Inter, sans-serif">
        welkom
      </text>
    </g>
  );
}

function DraggableTableOverlay({ table, selected, activeOrder, onClick, editMode }: {
  table: TableItem; selected: boolean; activeOrder?: ActiveOrder; onClick: () => void; editMode: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: table.id,
    disabled: !editMode,
  });
  const style: React.CSSProperties = {
    position: 'absolute',
    left: table.position_x - 70,
    top: table.position_y - 70,
    width: 140,
    height: 140,
    cursor: editMode ? 'grab' : 'pointer',
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    zIndex: transform ? 100 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...(editMode ? { ...listeners, ...attributes } : {})} onClick={onClick} />
  );
}

function PaymentPopup({ onPay, onClose }: { onPay: (method: string) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="rounded-2xl p-6 w-full max-w-xs shadow-2xl space-y-4"
        style={{ backgroundColor: '#1a1510', border: `1px solid #3a2e18` }}>
        <h2 className="text-lg font-bold text-center" style={{ color: '#e5e7eb' }}>Betaalwijze</h2>
        <div className="grid grid-cols-2 gap-3">
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => onPay('pin')}
            className="py-4 rounded-xl font-bold text-lg"
            style={{ backgroundColor: ACCENT, color: '#0f0d08' }}>
            💳 PIN
          </motion.button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => onPay('contant')}
            className="py-4 rounded-xl font-bold text-lg"
            style={{ backgroundColor: '#2a2018', color: '#e5e7eb' }}>
            💵 Cash
          </motion.button>
        </div>
        <button onClick={onClose} className="w-full py-2 text-sm" style={{ color: '#6b5a3a' }}>Annuleren</button>
      </motion.div>
    </div>
  );
}

function EditPanel({ table, onUpdate, onDelete, onClose }: {
  table: TableItem;
  onUpdate: (updates: Partial<TableItem>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [num, setNum] = useState(table.table_number);
  const [seats, setSeats] = useState(table.seats);
  const [shape, setShape] = useState(table.shape);

  return (
    <div className="w-64 shrink-0 p-4 space-y-4 border-r overflow-y-auto"
      style={{ backgroundColor: '#0f0d08', borderColor: '#2a2018' }}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold" style={{ color: '#e5e7eb' }}>Tafel bewerken</h3>
        <button onClick={onClose}><X className="w-4 h-4" style={{ color: '#6b5a3a' }} /></button>
      </div>
      <div className="space-y-3">
        <label className="block">
          <span className="text-xs font-medium" style={{ color: '#9ca3af' }}>Tafelnummer</span>
          <input value={num} onChange={e => setNum(e.target.value)} onBlur={() => onUpdate({ table_number: num })}
            className="w-full mt-1 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
            style={{ backgroundColor: '#1a1510', color: '#e5e7eb', border: '1px solid #3a2e18', '--tw-ring-color': ACCENT } as React.CSSProperties} />
        </label>
        <label className="block">
          <span className="text-xs font-medium" style={{ color: '#9ca3af' }}>Vorm</span>
          <div className="flex gap-2 mt-1">
            {['square', 'round'].map(s => (
              <button key={s} onClick={() => { setShape(s); onUpdate({ shape: s }); }}
                className="flex-1 py-2 rounded-lg text-xs font-bold transition-colors"
                style={{ backgroundColor: shape === s ? ACCENT : '#1a1510', color: shape === s ? '#0f0d08' : '#9ca3af' }}>
                {s === 'square' ? 'Vierkant' : 'Rond'}
              </button>
            ))}
          </div>
        </label>
        <label className="block">
          <span className="text-xs font-medium" style={{ color: '#9ca3af' }}>Stoelen ({seats})</span>
          <input type="range" min={2} max={8} value={seats}
            onChange={e => { const v = +e.target.value; setSeats(v); onUpdate({ seats: v }); }}
            className="w-full mt-1" style={{ accentColor: ACCENT }} />
        </label>
        <button onClick={onDelete}
          className="w-full py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2"
          style={{ backgroundColor: '#2e1414', color: '#f87171' }}>
          <Trash2 className="w-4 h-4" /> Verwijderen
        </button>
      </div>
    </div>
  );
}

export default function FloorPlanPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const store = usePosStore();

  const [sections, setSections] = useState<FloorSection[]>([]);
  const [tables, setTables] = useState<TableItem[]>([]);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<TableItem | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<ActiveOrder | null>(null);
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [orderDetails, setOrderDetails] = useState<OrderItemDetail[]>([]);

  const [editMode, setEditMode] = useState(false);
  const [editingTable, setEditingTable] = useState<TableItem | null>(null);
  const [preEditSnapshot, setPreEditSnapshot] = useState<TableItem[]>([]);
  const [snapToGrid, setSnapToGrid] = useState(true);

  const [decos, setDecos] = useState<DecoElement[]>([]);

  const [showPayment, setShowPayment] = useState(false);
  const [payingTableId, setPayingTableId] = useState<string | null>(null);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);

  const [afhaalOrderDetail, setAfhaalOrderDetail] = useState<ActiveOrder | null>(null);
  const [afhaalItems, setAfhaalItems] = useState<OrderItemDetail[]>([]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const CANVAS_W = 900;
  const CANVAS_H = 600;

  const role = profile?.role;
  const canEdit = role === 'superadmin' || role === 'owner';
  const effectiveRestaurantId = role === 'superadmin' ? selectedRestaurantId : profile?.restaurant_id;

  const activeSectionName = sections.find(s => s.id === activeSection)?.name || '';
  const outdoor = isOutdoor(activeSectionName);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    const key = `floor_decos_${effectiveRestaurantId}_${activeSection}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try { setDecos(JSON.parse(saved)); } catch { setDecos([]); }
    } else {
      setDecos([
        { id: 'p1', type: 'plant', x: 60, y: 60, width: 24, height: 24 },
        { id: 'p2', type: 'plant', x: 840, y: 60, width: 24, height: 24 },
        { id: 'p3', type: 'plant', x: 60, y: 540, width: 24, height: 24 },
        { id: 'p4', type: 'plant', x: 840, y: 540, width: 24, height: 24 },
      ]);
    }
  }, [effectiveRestaurantId, activeSection]);

  const saveDecos = (newDecos: DecoElement[]) => {
    setDecos(newDecos);
    const key = `floor_decos_${effectiveRestaurantId}_${activeSection}`;
    localStorage.setItem(key, JSON.stringify(newDecos));
  };

  useEffect(() => {
    if (role !== 'superadmin') return;
    supabase.from('restaurants').select('id, name').order('name').then(({ data }) => {
      const rests = data || [];
      setRestaurants(rests);
      if (rests.length > 0 && !selectedRestaurantId) setSelectedRestaurantId(rests[0].id);
    });
  }, [role]);

  const fetchData = useCallback(async () => {
    if (!effectiveRestaurantId) return;
    const today = new Date().toISOString().split('T')[0];
    const [secRes, tabRes, ordRes] = await Promise.all([
      supabase.from('floor_sections').select('*').eq('restaurant_id', effectiveRestaurantId).order('sort_order'),
      supabase.from('tables').select('*').eq('restaurant_id', effectiveRestaurantId),
      supabase.from('orders').select('id, order_number, created_at, table_id')
        .eq('restaurant_id', effectiveRestaurantId).gte('created_at', today)
        .in('status', ['pending', 'preparing', 'ready']),
    ]);
    const secs = (secRes.data || []) as FloorSection[];
    setSections(secs);
    setTables((tabRes.data || []) as TableItem[]);
    setActiveOrders((ordRes.data || []) as ActiveOrder[]);
    if (secs.length > 0) setActiveSection(prev => secs.find(s => s.id === prev) ? prev : secs[0].id);
    else setActiveSection(null);
    setLoading(false);
  }, [effectiveRestaurantId]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    const iv = setInterval(fetchData, 10000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const loadOrderItems = async (orderId: string) => {
    const { data } = await supabase.from('order_items').select('name_snapshot, quantity, unit_price').eq('order_id', orderId);
    return (data || []) as OrderItemDetail[];
  };

  const closeOrderAndFreeTable = async (orderId: string | null, tableId: string | null) => {
    if (orderId) await supabase.from('orders').update({ status: 'delivered' }).eq('id', orderId);
    if (tableId) await supabase.from('tables').update({ status: 'vrij' }).eq('id', tableId);
    setSelectedTable(null); setSelectedOrder(null);
    setShowPayment(false); setPayingTableId(null); setPayingOrderId(null);
    fetchData();
  };

  const goToKassaForTable = (table: TableItem) => {
    store.clearOrder();
    if (effectiveRestaurantId) store.setRestaurant(effectiveRestaurantId, '');
    if (profile) store.setProfile(profile.id, profile.full_name || 'Gebruiker');
    store.setTable(table.id, table.table_number);
    store.setOrderType('dine_in');
    setSelectedTable(null);
    navigate('/restaurant/kassa');
  };

  const goToKassaForTakeaway = () => {
    store.clearOrder();
    if (effectiveRestaurantId) store.setRestaurant(effectiveRestaurantId, '');
    if (profile) store.setProfile(profile.id, profile.full_name || 'Gebruiker');
    store.setTable(null, null);
    store.setOrderType('takeaway');
    navigate('/restaurant/kassa');
  };

  const handleTableClick = async (table: TableItem) => {
    if (table.is_takeaway || editMode) return;
    setSelectedTable(table);
    setSelectedOrder(null);
    if (table.status === 'vrij') { setOrderDetails([]); return; }
    const order = activeOrders.find(o => o.table_id === table.id)
      ?? (await supabase.from('orders').select('id, order_number, created_at, table_id')
        .eq('table_id', table.id).order('created_at', { ascending: false }).limit(1).maybeSingle()).data;
    if (order) {
      setSelectedOrder(order as ActiveOrder);
      setOrderDetails(await loadOrderItems(order.id));
    } else setOrderDetails([]);
  };

  const handleAfhaalClick = async (order: ActiveOrder) => {
    setAfhaalItems(await loadOrderItems(order.id));
    setAfhaalOrderDetail(order);
  };

  const markAfhaalCollected = async (orderId: string) => {
    await supabase.from('orders').update({ status: 'delivered' }).eq('id', orderId);
    setAfhaalOrderDetail(null);
    fetchData();
  };

  const handlePayment = async (_method: string) => {
    if (payingOrderId) await closeOrderAndFreeTable(payingOrderId, payingTableId);
  };

  const enterEditMode = () => { setPreEditSnapshot(JSON.parse(JSON.stringify(tables))); setEditMode(true); };
  const cancelEditMode = () => { setTables(preEditSnapshot); setEditMode(false); setEditingTable(null); };

  const saveEditMode = async () => {
    for (const t of tables.filter(t => !t.is_takeaway)) {
      await supabase.from('tables').update({
        position_x: t.position_x, position_y: t.position_y,
        seats: t.seats, shape: t.shape, table_number: t.table_number,
      }).eq('id', t.id);
    }
    setEditMode(false); setEditingTable(null); fetchData();
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    setTables(prev => prev.map(t => {
      if (t.id !== active.id) return t;
      let newX = t.position_x + delta.x;
      let newY = t.position_y + delta.y;
      if (snapToGrid) { newX = Math.round(newX / GRID_SIZE) * GRID_SIZE; newY = Math.round(newY / GRID_SIZE) * GRID_SIZE; }
      newX = Math.max(60, Math.min(CANVAS_W - 60, newX));
      newY = Math.max(60, Math.min(CANVAS_H - 60, newY));
      return { ...t, position_x: newX, position_y: newY };
    }));
  };

  const addNewTable = async (shape: string) => {
    if (!effectiveRestaurantId || !activeSection) return;
    const maxNum = tables.filter(t => !t.is_takeaway).reduce((max, t) => Math.max(max, parseInt(t.table_number) || 0), 0);
    await supabase.from('tables').insert({
      restaurant_id: effectiveRestaurantId, floor_section_id: activeSection,
      table_number: String(maxNum + 1), seats: 4, shape,
      position_x: 200 + Math.random() * 200, position_y: 200 + Math.random() * 100,
      status: 'vrij', is_takeaway: false,
    });
    fetchData();
  };

  const deleteTable = async (tableId: string) => {
    await supabase.from('tables').delete().eq('id', tableId);
    setEditingTable(null); fetchData();
  };

  const updateEditingTable = (updates: Partial<TableItem>) => {
    if (!editingTable) return;
    const updated = { ...editingTable, ...updates };
    setEditingTable(updated);
    setTables(prev => prev.map(t => t.id === updated.id ? updated : t));
  };

  const sectionTables = tables.filter(t => !t.is_takeaway && t.floor_section_id === activeSection);
  const afhaalOrders = activeOrders.filter(o => !o.table_id);
  const AFHAAL_SPOTS = 10;

  const modalBg = '#1a1510';
  const modalBorder = '#3a2e18';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ backgroundColor: '#0f0d08' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: ACCENT }} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: '#0f0d08' }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 flex-wrap border-b" style={{ borderColor: '#2a2018' }}>
        {editMode ? (
          <>
            <span className="text-sm font-bold px-3 py-1 rounded-lg" style={{ backgroundColor: ACCENT, color: '#0f0d08' }}>
              Bewerkingsmodus
            </span>
            <div className="flex-1" />
            <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: '#9ca3af' }}>
              <input type="checkbox" checked={snapToGrid} onChange={e => setSnapToGrid(e.target.checked)} style={{ accentColor: ACCENT }} />
              Snap to grid
            </label>
            <button onClick={cancelEditMode}
              className="px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5"
              style={{ backgroundColor: '#2a2018', color: '#e5e7eb' }}>
              <RotateCcw className="w-4 h-4" /> Annuleren
            </button>
            <button onClick={saveEditMode}
              className="px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5"
              style={{ backgroundColor: ACCENT, color: '#0f0d08' }}>
              <Save className="w-4 h-4" /> Opslaan
            </button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold" style={{ color: '#e5e7eb' }}>Plattegrond</h1>
            {role === 'superadmin' && restaurants.length > 0 && (
              <select value={selectedRestaurantId || ''} onChange={e => setSelectedRestaurantId(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-sm focus:outline-none"
                style={{ backgroundColor: '#1a1510', color: '#e5e7eb', border: '1px solid #3a2e18' }}>
                {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            )}
            <div className="flex-1" />
            <div className="flex gap-1.5">
              {sections.map(sec => {
                const isOut = isOutdoor(sec.name);
                return (
                  <button key={sec.id} onClick={() => setActiveSection(sec.id)}
                    className="px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-1.5"
                    style={{
                      backgroundColor: activeSection === sec.id ? (isOut ? '#8a6820' : ACCENT) : '#1a1510',
                      color: activeSection === sec.id ? '#0f0d08' : '#9ca3af',
                      border: activeSection !== sec.id ? `1px solid #2a2018` : 'none',
                    }}>
                    {isOut ? '☀' : '🏠'} {sec.name}
                  </button>
                );
              })}
            </div>
            {canEdit && (
              <button onClick={enterEditMode}
                className="px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5"
                style={{ backgroundColor: '#1a1510', color: ACCENT, border: `1px solid ${ACCENT}40` }}>
                <Pencil className="w-4 h-4" /> Bewerken
              </button>
            )}
          </>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {editMode && editingTable && (
          <EditPanel table={editingTable}
            onUpdate={updateEditingTable}
            onDelete={() => { if (confirm('Tafel verwijderen?')) deleteTable(editingTable.id); }}
            onClose={() => setEditingTable(null)} />
        )}

        <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
          {/* Legend */}
          <div className="flex gap-5 items-center">
            {Object.entries(STATUS_COLORS).map(([key, val]) => (
              <div key={key} className="flex items-center gap-2 text-xs" style={{ color: '#9ca3af' }}>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: val.dot }} />
                {val.label}
              </div>
            ))}
            {outdoor && (
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: '#2a2010', color: '#8a7040', border: '1px solid #3a3018' }}>
                ☀ Buiten terras
              </span>
            )}
          </div>

          {/* Canvas */}
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div ref={canvasRef} className="relative rounded-xl overflow-hidden mx-auto"
              style={{
                width: CANVAS_W, height: CANVAS_H, maxWidth: '100%',
                boxShadow: outdoor
                  ? '0 0 40px rgba(180,140,40,0.15), inset 0 0 0 1px rgba(180,140,40,0.1)'
                  : '0 0 40px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(60,46,24,0.3)',
              }}>
              <svg width={CANVAS_W} height={CANVAS_H} viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
                className="absolute inset-0">
                <defs>
                  <radialGradient id="indoor-light" cx="50%" cy="40%" r="55%">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.04" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                  </radialGradient>
                  <radialGradient id="outdoor-light" cx="50%" cy="30%" r="60%">
                    <stop offset="0%" stopColor="#fff8e1" stopOpacity="0.06" />
                    <stop offset="100%" stopColor="#fff8e1" stopOpacity="0" />
                  </radialGradient>
                </defs>

                <SVGFloor width={CANVAS_W} height={CANVAS_H} outdoor={outdoor} />

                {/* Grid in edit mode */}
                {editMode && snapToGrid && (
                  <g opacity={0.08}>
                    {Array.from({ length: Math.ceil(CANVAS_W / GRID_SIZE) }).map((_, i) => (
                      <line key={`gv${i}`} x1={i * GRID_SIZE} y1={0} x2={i * GRID_SIZE} y2={CANVAS_H} stroke="#fff" strokeWidth={0.5} />
                    ))}
                    {Array.from({ length: Math.ceil(CANVAS_H / GRID_SIZE) }).map((_, i) => (
                      <line key={`gh${i}`} x1={0} y1={i * GRID_SIZE} x2={CANVAS_W} y2={i * GRID_SIZE} stroke="#fff" strokeWidth={0.5} />
                    ))}
                  </g>
                )}

                <SVGWalls width={CANVAS_W} height={CANVAS_H} outdoor={outdoor} />
                {!outdoor && <SVGKitchen x={CANVAS_W - 158} y={8} w={150} h={64} />}
                {!outdoor && <SVGBar x={8} y={8} w={120} h={64} />}
                {!outdoor && <SVGKassa x={CANVAS_W - 108} y={CANVAS_H - 90} />}
                <SVGWelcomeMat x={CANVAS_W / 2 - 35} y={CANVAS_H - 36} w={70} h={22} />

                {decos.filter(d => d.type === 'plant').map(d => (
                  <SVGPlant key={d.id} x={d.x} y={d.y} outdoor={outdoor} />
                ))}

                {sectionTables.map(table => (
                  <SVGTable key={table.id} table={table}
                    selected={selectedTable?.id === table.id || editingTable?.id === table.id}
                    activeOrder={activeOrders.find(o => o.table_id === table.id)}
                    outdoor={outdoor} />
                ))}
              </svg>

              {sectionTables.map(table => (
                <DraggableTableOverlay key={`drag-${table.id}`} table={table} editMode={editMode}
                  selected={editingTable?.id === table.id}
                  activeOrder={activeOrders.find(o => o.table_id === table.id)}
                  onClick={() => { if (editMode) setEditingTable(table); else handleTableClick(table); }} />
              ))}

              {sectionTables.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center" style={{ color: '#6b5a3a' }}>
                  <p className="text-sm">Geen tafels in deze sectie</p>
                </div>
              )}
            </div>
          </DndContext>

          {editMode && (
            <div className="flex gap-3 justify-center py-2">
              {['square', 'round'].map(shape => (
                <button key={shape} onClick={() => addNewTable(shape)}
                  className="px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2"
                  style={{ backgroundColor: '#1a1510', color: '#e5e7eb', border: '1px solid #3a2e18' }}>
                  {shape === 'square' ? <Square className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                  + {shape === 'square' ? 'Vierkante' : 'Ronde'} tafel
                </button>
              ))}
              <button onClick={() => saveDecos([...decos, { id: `plant_${Date.now()}`, type: 'plant', x: 100 + Math.random() * 300, y: 100 + Math.random() * 200, width: 24, height: 24 }])}
                className="px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2"
                style={{ backgroundColor: '#1a1510', color: '#e5e7eb', border: '1px solid #3a2e18' }}>
                <Leaf className="w-4 h-4" /> + Plant
              </button>
            </div>
          )}

          {/* Afhaal */}
          <div className="rounded-xl p-4" style={{ backgroundColor: '#1a1510', border: '1px solid #3a2e18' }}>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: '#e5e7eb' }}>
              <Package className="w-4 h-4" style={{ color: ACCENT }} /> Afhaal / Online
            </h3>
            <div className="flex gap-3 flex-wrap">
              {Array.from({ length: AFHAAL_SPOTS }).map((_, i) => {
                const order = afhaalOrders[i];
                const isActive = !!order;
                return (
                  <motion.button key={i} whileTap={{ scale: 0.9 }}
                    onClick={() => { if (order) handleAfhaalClick(order); else goToKassaForTakeaway(); }}
                    className="w-12 h-12 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors"
                    style={{
                      backgroundColor: isActive ? '#2e1414' : '#142014',
                      borderColor: isActive ? '#f87171' : '#4ade80',
                      color: isActive ? '#f87171' : '#4ade80',
                    }}>
                    {isActive ? `#${order.order_number}` : <Plus className="w-4 h-4" />}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {selectedTable && !editMode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75"
            onClick={() => { setSelectedTable(null); setSelectedOrder(null); }}>
            <motion.div initial={{ scale: 0.92, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0, y: 10 }}
              onClick={e => e.stopPropagation()}
              className="rounded-2xl p-6 w-full max-w-sm shadow-2xl"
              style={{ backgroundColor: modalBg, border: `1px solid ${modalBorder}` }}>
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-xl font-bold" style={{ color: '#e5e7eb' }}>Tafel {selectedTable.table_number}</h2>
                <button onClick={() => { setSelectedTable(null); setSelectedOrder(null); }}>
                  <X className="w-5 h-5" style={{ color: '#6b5a3a' }} />
                </button>
              </div>
              <p className="text-sm mb-4" style={{ color: '#6b5a3a' }}>
                {selectedTable.seats} gasten · {selectedTable.shape === 'round' ? 'Rond' : 'Vierkant'}
                {selectedTable.status !== 'vrij' && (() => {
                  const ord = selectedOrder ?? activeOrders.find(o => o.table_id === selectedTable.id);
                  return ord ? <> · <TimeAgo since={ord.created_at} /></> : null;
                })()}
              </p>

              {selectedTable.status === 'vrij' && (
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => goToKassaForTable(selectedTable)}
                  className="w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2"
                  style={{ backgroundColor: ACCENT, color: '#0f0d08' }}>
                  <Monitor className="w-5 h-5" /> Open Kassa
                </motion.button>
              )}

              {(selectedTable.status === 'bezet' || selectedTable.status === 'geleverd') && (() => {
                const order = selectedOrder ?? activeOrders.find(o => o.table_id === selectedTable.id);
                return (
                  <div className="space-y-3">
                    {order && orderDetails.length > 0 && (
                      <div className="rounded-lg p-3 space-y-1.5" style={{ backgroundColor: '#0f0d08' }}>
                        <p className="text-xs font-bold" style={{ color: ACCENT }}>Bestelling #{order.order_number}</p>
                        {orderDetails.map((item, i) => (
                          <div key={i} className="flex justify-between text-xs" style={{ color: '#e5e7eb' }}>
                            <span>{item.name_snapshot}</span>
                            <span style={{ color: '#6b5a3a' }}>×{item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => goToKassaForTable(selectedTable)}
                      className="w-full py-3 rounded-xl font-bold text-sm"
                      style={{ backgroundColor: '#0f0d08', color: ACCENT, border: `1px solid ${ACCENT}40` }}>
                      + Meer bestellen
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.95 }}
                      onClick={() => { setPayingOrderId(order?.id || null); setPayingTableId(selectedTable.id); setSelectedTable(null); setShowPayment(true); }}
                      className="w-full py-3 rounded-xl font-bold text-sm"
                      style={{ backgroundColor: ACCENT, color: '#0f0d08' }}>
                      💰 {selectedTable.status === 'bezet' ? 'Afrekenen' : 'Betalen'}
                    </motion.button>
                  </div>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPayment && (
          <PaymentPopup onPay={handlePayment} onClose={() => { setShowPayment(false); setPayingOrderId(null); setPayingTableId(null); }} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {afhaalOrderDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75"
            onClick={() => setAfhaalOrderDetail(null)}>
            <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4"
              style={{ backgroundColor: modalBg, border: `1px solid ${modalBorder}` }}>
              <h2 className="text-lg font-bold" style={{ color: '#e5e7eb' }}>Afhaal #{afhaalOrderDetail.order_number}</h2>
              <p className="text-sm" style={{ color: '#6b5a3a' }}><TimeAgo since={afhaalOrderDetail.created_at} /></p>
              {afhaalItems.length > 0 && (
                <div className="rounded-lg p-3 space-y-1" style={{ backgroundColor: '#0f0d08' }}>
                  {afhaalItems.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm" style={{ color: '#e5e7eb' }}>
                      <span>{item.name_snapshot}</span>
                      <span style={{ color: '#6b5a3a' }}>×{item.quantity}</span>
                    </div>
                  ))}
                </div>
              )}
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => {
                store.clearOrder();
                if (effectiveRestaurantId) store.setRestaurant(effectiveRestaurantId, '');
                if (profile) store.setProfile(profile.id, profile.full_name || 'Gebruiker');
                store.setTable(null, null); store.setOrderType('takeaway');
                setAfhaalOrderDetail(null); navigate('/restaurant/kassa');
              }}
                className="w-full py-3 rounded-xl font-bold text-sm"
                style={{ backgroundColor: '#0f0d08', color: ACCENT, border: `1px solid ${ACCENT}40` }}>
                + Meer toevoegen
              </motion.button>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => markAfhaalCollected(afhaalOrderDetail.id)}
                className="w-full py-3 rounded-xl font-bold text-sm"
                style={{ backgroundColor: ACCENT, color: '#0f0d08' }}>
                ✅ Bestelling opgehaald
              </motion.button>
              <button onClick={() => setAfhaalOrderDetail(null)} className="w-full py-2 text-sm" style={{ color: '#6b5a3a' }}>
                Sluiten
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}