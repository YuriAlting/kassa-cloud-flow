import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Trash2, Edit2, X, Clock, Monitor, Plus, Pencil, Save, RotateCcw, Leaf, Square, Circle } from 'lucide-react';
import { usePosStore } from '@/stores/posStore';
import {
  DndContext,
  useDraggable,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';

/* ═══════════════════════════════════════
   Types
   ═══════════════════════════════════════ */

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

// Decorative element stored in localStorage
interface DecoElement {
  id: string;
  type: 'plant' | 'wall';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

/* ═══════════════════════════════════════
   Constants
   ═══════════════════════════════════════ */

const FLOOR_BG = '#1a2018';
const CANVAS_BG = '#0f1410';
const WALL_COLOR = '#2a3528';
const ACCENT = '#f59e0b';

const STATUS_COLORS: Record<string, { fill: string; stroke: string; dot: string; label: string }> = {
  vrij:     { fill: '#1e3a1e', stroke: '#2d5a2d', dot: '#22c55e', label: 'Vrij' },
  bezet:    { fill: '#3a1e1e', stroke: '#5a2d2d', dot: '#ef4444', label: 'Bezet' },
  geleverd: { fill: '#2a3a1e', stroke: '#3a5a2d', dot: ACCENT,   label: 'Geleverd' },
};

const GRID_SIZE = 20;

/* ═══════════════════════════════════════
   Small helper components
   ═══════════════════════════════════════ */

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
  return <span className="flex items-center gap-1 text-xs font-mono text-amber-400"><Clock className="w-3 h-3" />{elapsed}</span>;
}

/* ═══════════════════════════════════════
   SVG Furniture Renderers (static layer)
   ═══════════════════════════════════════ */

function renderChairs(cx: number, cy: number, shape: string, seats: number, tableW: number, tableH: number) {
  const chairs: JSX.Element[] = [];
  const cw = 14, ch = 10, gap = 4, r = 3;

  if (shape === 'round') {
    const radius = tableW / 2 + 14;
    for (let i = 0; i < seats; i++) {
      const angle = (2 * Math.PI * i) / seats - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      chairs.push(
        <rect key={i} x={x - cw / 2} y={y - ch / 2} width={cw} height={ch} rx={r}
          fill="#3a4a38" stroke="#4a5a48" strokeWidth={0.5}
          transform={`rotate(${(angle * 180) / Math.PI + 90}, ${x}, ${y})`} />
      );
    }
  } else {
    // Distribute chairs around rectangle edges
    const halfW = tableW / 2, halfH = tableH / 2;
    const perSide = Math.ceil(seats / 4);
    let remaining = seats;
    const sides: { dx: number; dy: number; rot: number }[][] = [
      // top
      Array.from({ length: Math.min(perSide, remaining) }, (_, i) => {
        const spread = Math.min(perSide, remaining);
        const offset = (i - (spread - 1) / 2) * (cw + gap);
        return { dx: offset, dy: -(halfH + ch / 2 + 4), rot: 0 };
      }),
      // bottom
      [],
      // left
      [],
      // right
      [],
    ];
    remaining -= sides[0].length;
    sides[1] = Array.from({ length: Math.min(perSide, remaining) }, (_, i) => {
      const spread = Math.min(perSide, remaining);
      const offset = (i - (spread - 1) / 2) * (cw + gap);
      return { dx: offset, dy: halfH + ch / 2 + 4, rot: 0 };
    });
    remaining -= sides[1].length;
    sides[2] = Array.from({ length: Math.min(perSide, remaining) }, (_, i) => {
      const spread = Math.min(perSide, remaining);
      const offset = (i - (spread - 1) / 2) * (ch + gap);
      return { dx: -(halfW + ch / 2 + 4), dy: offset, rot: 90 };
    });
    remaining -= sides[2].length;
    sides[3] = Array.from({ length: Math.min(perSide, remaining) }, (_, i) => {
      const spread = Math.min(perSide, remaining);
      const offset = (i - (spread - 1) / 2) * (ch + gap);
      return { dx: halfW + ch / 2 + 4, dy: offset, rot: 90 };
    });

    let idx = 0;
    sides.flat().forEach(pos => {
      const x = cx + pos.dx;
      const y = cy + pos.dy;
      chairs.push(
        <rect key={idx++} x={x - cw / 2} y={y - ch / 2} width={cw} height={ch} rx={r}
          fill="#3a4a38" stroke="#4a5a48" strokeWidth={0.5}
          transform={`rotate(${pos.rot}, ${x}, ${y})`} />
      );
    });
  }
  return chairs;
}

function SVGTable({ table, selected, activeOrder }: { table: TableItem; selected: boolean; activeOrder?: ActiveOrder }) {
  const colors = STATUS_COLORS[table.status] || STATUS_COLORS.vrij;
  const isRound = table.shape === 'round';
  const w = table.seats <= 2 ? 60 : table.seats <= 4 ? 80 : 100;
  const h = isRound ? w : (table.seats <= 2 ? 60 : table.seats <= 4 ? 80 : 100);
  const cx = table.position_x;
  const cy = table.position_y;

  return (
    <g>
      {/* Chairs */}
      {renderChairs(cx, cy, table.shape, table.seats, w, h)}
      {/* Table surface */}
      {isRound ? (
        <circle cx={cx} cy={cy} r={w / 2} fill={colors.fill} stroke={selected ? ACCENT : colors.stroke}
          strokeWidth={selected ? 3 : 1.5} strokeDasharray={selected ? '6 3' : 'none'} />
      ) : (
        <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={6}
          fill={colors.fill} stroke={selected ? ACCENT : colors.stroke}
          strokeWidth={selected ? 3 : 1.5} strokeDasharray={selected ? '6 3' : 'none'} />
      )}
      {/* Status dot */}
      <circle cx={cx + (isRound ? w / 2 - 10 : w / 2 - 12)} cy={cy - (isRound ? w / 2 - 10 : h / 2 - 12)}
        r={5} fill={colors.dot} />
      {/* Table number */}
      <text x={cx} y={cy + 2} textAnchor="middle" dominantBaseline="central"
        fill="white" fontSize={16} fontWeight="700" fontFamily="Inter, sans-serif">
        {table.table_number}
      </text>
      {/* Timer for bezet */}
      {activeOrder && table.status === 'bezet' && (
        <foreignObject x={cx - 30} y={cy + (isRound ? w / 2 : h / 2) + 4} width={60} height={20}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <TimeAgo since={activeOrder.created_at} />
          </div>
        </foreignObject>
      )}
    </g>
  );
}

function SVGPlant({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <circle r={12} fill="#1a3018" stroke="#2a4028" strokeWidth={1} />
      <circle r={5} fill="#2a5028" />
      <circle r={3} cx={-4} cy={-3} fill="#2a5028" opacity={0.7} />
      <circle r={3} cx={4} cy={-2} fill="#2a5028" opacity={0.7} />
    </g>
  );
}

function SVGWalls({ width, height }: { width: number; height: number }) {
  const wallW = 8;
  const doorW = 80;
  const doorX = width / 2 - doorW / 2;
  return (
    <g>
      {/* Top wall */}
      <rect x={0} y={0} width={width} height={wallW} fill={WALL_COLOR} />
      {/* Left wall */}
      <rect x={0} y={0} width={wallW} height={height} fill={WALL_COLOR} />
      {/* Right wall */}
      <rect x={width - wallW} y={0} width={wallW} height={height} fill={WALL_COLOR} />
      {/* Bottom wall with entrance gap */}
      <rect x={0} y={height - wallW} width={doorX} height={wallW} fill={WALL_COLOR} />
      <rect x={doorX + doorW} y={height - wallW} width={width - doorX - doorW} height={wallW} fill={WALL_COLOR} />
      {/* Door arc */}
      <path d={`M ${doorX} ${height - wallW} A ${doorW / 2} ${doorW / 2} 0 0 1 ${doorX + doorW / 2} ${height - wallW - doorW / 2}`}
        fill="none" stroke={WALL_COLOR} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.5} />
      {/* Door line */}
      <line x1={doorX} y1={height - wallW} x2={doorX + doorW / 2} y2={height - wallW - doorW / 2}
        stroke={WALL_COLOR} strokeWidth={1.5} opacity={0.6} />
      {/* Ingang label */}
      <text x={width / 2} y={height - wallW - 4} textAnchor="middle" fontSize={10} fontWeight="600"
        fill="#6b7b68" fontFamily="Inter, sans-serif">
        Ingang
      </text>
    </g>
  );
}

function SVGKitchen({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={4} fill="#1a1a18" stroke={WALL_COLOR} strokeWidth={2} />
      <text x={x + w / 2} y={y + h / 2 - 6} textAnchor="middle" dominantBaseline="central"
        fill="#6b7b68" fontSize={11} fontWeight="700" fontFamily="Inter, sans-serif">
        Keuken
      </text>
      {/* Pass window */}
      <rect x={x + 10} y={y + h - 4} width={w - 20} height={6} rx={2} fill={ACCENT} opacity={0.3} />
      <text x={x + w / 2} y={y + h + 8} textAnchor="middle" fontSize={8} fill={ACCENT} opacity={0.6}
        fontFamily="Inter, sans-serif">
        pass
      </text>
    </g>
  );
}

function SVGBar({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} fill="#1e1e1a" stroke={WALL_COLOR} strokeWidth={2} />
      <text x={x + w / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="central"
        fill="#6b7b68" fontSize={11} fontWeight="700" fontFamily="Inter, sans-serif">
        Bar
      </text>
    </g>
  );
}

function SVGKassa({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width={90} height={60} rx={6} fill="#1a1a18" stroke={ACCENT} strokeWidth={2} opacity={0.8} />
      <foreignObject x={x} y={y} width={90} height={60}>
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Monitor style={{ width: 22, height: 22, color: ACCENT }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT, marginTop: 2 }}>Kassa</span>
        </div>
      </foreignObject>
    </g>
  );
}

function SVGWelcomeMat({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={3} fill="#2a3528" opacity={0.4} />
      <text x={x + w / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="central"
        fontSize={8} fill="#6b7b68" fontFamily="Inter, sans-serif">
        welkom
      </text>
    </g>
  );
}

/* ═══════════════════════════════════════
   Draggable Table Wrapper (edit mode)
   ═══════════════════════════════════════ */

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
    <div ref={setNodeRef} style={style} {...(editMode ? { ...listeners, ...attributes } : {})} onClick={onClick}>
      {/* transparent click area — SVG table is rendered on canvas below */}
    </div>
  );
}

/* ═══════════════════════════════════════
   Payment Popup
   ═══════════════════════════════════════ */

function PaymentPopup({ onPay, onClose }: { onPay: (method: string) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="rounded-2xl p-6 w-full max-w-xs shadow-2xl space-y-4"
        style={{ backgroundColor: '#1a2018', border: '1px solid #2a3528' }}>
        <h2 className="text-lg font-bold text-center" style={{ color: '#e5e7eb' }}>Betaalwijze</h2>
        <div className="grid grid-cols-2 gap-3">
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => onPay('pin')}
            className="py-4 rounded-xl font-bold text-lg"
            style={{ backgroundColor: ACCENT, color: '#0f1410' }}>
            💳 PIN
          </motion.button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => onPay('contant')}
            className="py-4 rounded-xl font-bold text-lg"
            style={{ backgroundColor: '#2a3528', color: '#e5e7eb' }}>
            💵 Cash
          </motion.button>
        </div>
        <button onClick={onClose} className="w-full py-2 text-sm" style={{ color: '#6b7b68' }}>Annuleren</button>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════
   Edit Panel (left sidebar in edit mode)
   ═══════════════════════════════════════ */

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
    <div className="w-64 shrink-0 p-4 space-y-4 border-r overflow-y-auto" style={{ backgroundColor: '#0f1410', borderColor: '#2a3528' }}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold" style={{ color: '#e5e7eb' }}>Tafel bewerken</h3>
        <button onClick={onClose}><X className="w-4 h-4" style={{ color: '#6b7b68' }} /></button>
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="text-xs font-medium" style={{ color: '#9ca3af' }}>Tafelnummer</span>
          <input value={num} onChange={e => setNum(e.target.value)} onBlur={() => onUpdate({ table_number: num })}
            className="w-full mt-1 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
            style={{ backgroundColor: '#1a2018', color: '#e5e7eb', borderColor: '#2a3528', '--tw-ring-color': ACCENT } as React.CSSProperties} />
        </label>

        <label className="block">
          <span className="text-xs font-medium" style={{ color: '#9ca3af' }}>Vorm</span>
          <div className="flex gap-2 mt-1">
            {['square', 'round'].map(s => (
              <button key={s} onClick={() => { setShape(s); onUpdate({ shape: s }); }}
                className="flex-1 py-2 rounded-lg text-xs font-bold transition-colors"
                style={{
                  backgroundColor: shape === s ? ACCENT : '#1a2018',
                  color: shape === s ? '#0f1410' : '#9ca3af',
                }}>
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
          className="w-full py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors"
          style={{ backgroundColor: '#3a1e1e', color: '#ef4444' }}>
          <Trash2 className="w-4 h-4" /> Verwijderen
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   Main FloorPlanPage
   ═══════════════════════════════════════ */

export default function FloorPlanPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const store = usePosStore();

  const [sections, setSections] = useState<FloorSection[]>([]);
  const [tables, setTables] = useState<TableItem[]>([]);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<TableItem | null>(null);
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [orderDetails, setOrderDetails] = useState<OrderItemDetail[]>([]);

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [editingTable, setEditingTable] = useState<TableItem | null>(null);
  const [preEditSnapshot, setPreEditSnapshot] = useState<TableItem[]>([]);
  const [snapToGrid, setSnapToGrid] = useState(true);

  // Decorative elements (localStorage)
  const [decos, setDecos] = useState<DecoElement[]>([]);

  // Payment popup
  const [showPayment, setShowPayment] = useState(false);
  const [payingTableId, setPayingTableId] = useState<string | null>(null);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);

  // Superadmin
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);

  // Afhaal
  const [afhaalOrderDetail, setAfhaalOrderDetail] = useState<ActiveOrder | null>(null);
  const [afhaalItems, setAfhaalItems] = useState<OrderItemDetail[]>([]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const CANVAS_W = 900;
  const CANVAS_H = 600;

  const role = profile?.role;
  const canEdit = role === 'superadmin' || role === 'owner';
  const effectiveRestaurantId = role === 'superadmin' ? selectedRestaurantId : profile?.restaurant_id;

  // DnD sensors
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Load localStorage decos
  useEffect(() => {
    const key = `floor_decos_${effectiveRestaurantId}_${activeSection}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try { setDecos(JSON.parse(saved)); } catch { setDecos([]); }
    } else {
      // Default plants
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

  // Superadmin restaurant list
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

  // ─── Actions ───
  const loadOrderItems = async (orderId: string) => {
    const { data } = await supabase.from('order_items').select('name_snapshot, quantity, unit_price').eq('order_id', orderId);
    return (data || []) as OrderItemDetail[];
  };

  const closeOrderAndFreeTable = async (orderId: string, tableId: string | null) => {
    await supabase.from('orders').update({ status: 'delivered' }).eq('id', orderId);
    if (tableId) {
      await supabase.from('tables').update({ status: 'vrij' }).eq('id', tableId);
    }
    setSelectedTable(null);
    setShowPayment(false);
    setPayingTableId(null);
    setPayingOrderId(null);
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
    if (editMode) {
      setEditingTable(table);
      return;
    }
    if (table.status === 'vrij') {
      setOrderDetails([]);
      setSelectedTable(table);
    } else {
      const order = activeOrders.find(o => o.table_id === table.id);
      if (order) {
        const items = await loadOrderItems(order.id);
        setOrderDetails(items);
      } else {
        setOrderDetails([]);
      }
      setSelectedTable(table);
    }
  };

  const handleAfhaalClick = async (order: ActiveOrder) => {
    const items = await loadOrderItems(order.id);
    setAfhaalItems(items);
    setAfhaalOrderDetail(order);
  };

  const markAfhaalCollected = async (orderId: string) => {
    await supabase.from('orders').update({ status: 'delivered' }).eq('id', orderId);
    setAfhaalOrderDetail(null);
    fetchData();
  };

  const handlePayment = async (_method: string) => {
    if (payingOrderId) {
      await closeOrderAndFreeTable(payingOrderId, payingTableId);
    }
  };

  // ─── Edit Mode ───
  const enterEditMode = () => {
    setPreEditSnapshot(JSON.parse(JSON.stringify(tables)));
    setEditMode(true);
  };

  const cancelEditMode = () => {
    setTables(preEditSnapshot);
    setEditMode(false);
    setEditingTable(null);
  };

  const saveEditMode = async () => {
    // Save all table positions to DB
    const sectionTbls = tables.filter(t => !t.is_takeaway);
    for (const t of sectionTbls) {
      await supabase.from('tables').update({
        position_x: t.position_x,
        position_y: t.position_y,
        seats: t.seats,
        shape: t.shape,
        table_number: t.table_number,
      }).eq('id', t.id);
    }
    setEditMode(false);
    setEditingTable(null);
    fetchData();
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    setTables(prev => prev.map(t => {
      if (t.id !== active.id) return t;
      let newX = t.position_x + delta.x;
      let newY = t.position_y + delta.y;
      if (snapToGrid) {
        newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
        newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
      }
      // Clamp
      newX = Math.max(40, Math.min(CANVAS_W - 40, newX));
      newY = Math.max(40, Math.min(CANVAS_H - 40, newY));
      return { ...t, position_x: newX, position_y: newY };
    }));
  };

  const addNewTable = async (shape: string) => {
    if (!effectiveRestaurantId || !activeSection) return;
    const maxNum = tables.filter(t => !t.is_takeaway).reduce((max, t) => Math.max(max, parseInt(t.table_number) || 0), 0);
    const newTable = {
      restaurant_id: effectiveRestaurantId,
      floor_section_id: activeSection,
      table_number: String(maxNum + 1),
      seats: 4,
      shape,
      position_x: 200 + Math.random() * 200,
      position_y: 200 + Math.random() * 100,
      status: 'vrij',
      is_takeaway: false,
    };
    await supabase.from('tables').insert(newTable);
    fetchData();
  };

  const deleteTable = async (tableId: string) => {
    await supabase.from('tables').delete().eq('id', tableId);
    setEditingTable(null);
    fetchData();
  };

  const updateEditingTable = (updates: Partial<TableItem>) => {
    if (!editingTable) return;
    const updated = { ...editingTable, ...updates };
    setEditingTable(updated);
    setTables(prev => prev.map(t => t.id === updated.id ? updated : t));
  };

  // ─── Render ───
  const sectionTables = tables.filter(t => !t.is_takeaway && t.floor_section_id === activeSection);
  const afhaalOrders = activeOrders.filter(o => !o.table_id);
  const AFHAAL_SPOTS = 10;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ backgroundColor: CANVAS_BG }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: ACCENT }} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: CANVAS_BG }}>
      {/* Header bar */}
      <div className="px-4 py-3 flex items-center gap-3 flex-wrap border-b" style={{ borderColor: '#2a3528' }}>
        {editMode ? (
          <>
            <span className="text-sm font-bold px-3 py-1 rounded-lg" style={{ backgroundColor: ACCENT, color: '#0f1410' }}>
              Bewerkingsmodus
            </span>
            <div className="flex-1" />
            <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: '#9ca3af' }}>
              <input type="checkbox" checked={snapToGrid} onChange={e => setSnapToGrid(e.target.checked)}
                style={{ accentColor: ACCENT }} />
              Snap to grid
            </label>
            <button onClick={cancelEditMode}
              className="px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5"
              style={{ backgroundColor: '#2a3528', color: '#e5e7eb' }}>
              <RotateCcw className="w-4 h-4" /> Annuleren
            </button>
            <button onClick={saveEditMode}
              className="px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5"
              style={{ backgroundColor: ACCENT, color: '#0f1410' }}>
              <Save className="w-4 h-4" /> Opslaan
            </button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold" style={{ color: '#e5e7eb' }}>Plattegrond</h1>
            {role === 'superadmin' && restaurants.length > 0 && (
              <select value={selectedRestaurantId || ''} onChange={e => setSelectedRestaurantId(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-sm focus:outline-none"
                style={{ backgroundColor: '#1a2018', color: '#e5e7eb', border: '1px solid #2a3528' }}>
                {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            )}
            <div className="flex-1" />
            {/* Zone tabs */}
            <div className="flex gap-1.5">
              {sections.map(sec => (
                <button key={sec.id} onClick={() => setActiveSection(sec.id)}
                  className="px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                  style={{
                    backgroundColor: activeSection === sec.id ? ACCENT : '#1a2018',
                    color: activeSection === sec.id ? '#0f1410' : '#9ca3af',
                  }}>
                  {sec.name}
                </button>
              ))}
            </div>
            {canEdit && (
              <button onClick={enterEditMode}
                className="px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-colors"
                style={{ backgroundColor: '#1a2018', color: ACCENT, border: `1px solid ${ACCENT}40` }}>
                <Pencil className="w-4 h-4" /> Bewerken
              </button>
            )}
          </>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Edit panel */}
        {editMode && editingTable && (
          <EditPanel table={editingTable}
            onUpdate={updateEditingTable}
            onDelete={() => { if (confirm('Tafel verwijderen?')) deleteTable(editingTable.id); }}
            onClose={() => setEditingTable(null)} />
        )}

        {/* Main canvas area */}
        <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
          {/* Legend */}
          <div className="flex gap-5 items-center">
            {Object.entries(STATUS_COLORS).map(([key, val]) => (
              <div key={key} className="flex items-center gap-2 text-xs" style={{ color: '#9ca3af' }}>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: val.dot }} />
                {val.label}
              </div>
            ))}
          </div>

          {/* SVG Canvas */}
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div ref={canvasRef} className="relative rounded-xl overflow-hidden mx-auto"
              style={{ width: CANVAS_W, height: CANVAS_H, maxWidth: '100%' }}>
              {/* SVG static layer */}
              <svg width={CANVAS_W} height={CANVAS_H} viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
                className="absolute inset-0"
                style={{ backgroundColor: FLOOR_BG }}>
                {/* Grid in edit mode */}
                {editMode && snapToGrid && (
                  <g opacity={0.1}>
                    {Array.from({ length: Math.ceil(CANVAS_W / GRID_SIZE) }).map((_, i) => (
                      <line key={`gv${i}`} x1={i * GRID_SIZE} y1={0} x2={i * GRID_SIZE} y2={CANVAS_H} stroke="#fff" strokeWidth={0.5} />
                    ))}
                    {Array.from({ length: Math.ceil(CANVAS_H / GRID_SIZE) }).map((_, i) => (
                      <line key={`gh${i}`} x1={0} y1={i * GRID_SIZE} x2={CANVAS_W} y2={i * GRID_SIZE} stroke="#fff" strokeWidth={0.5} />
                    ))}
                  </g>
                )}

                <SVGWalls width={CANVAS_W} height={CANVAS_H} />
                <SVGKitchen x={CANVAS_W - 158} y={8} w={150} h={70} />
                <SVGBar x={8} y={8} w={120} h={60} />
                <SVGKassa x={CANVAS_W - 108} y={CANVAS_H - 90} />
                <SVGWelcomeMat x={CANVAS_W / 2 - 30} y={CANVAS_H - 38} w={60} h={22} />

                {/* Plants */}
                {decos.filter(d => d.type === 'plant').map(d => (
                  <SVGPlant key={d.id} x={d.x} y={d.y} />
                ))}

                {/* Tables (SVG layer) */}
                {sectionTables.map(table => (
                  <SVGTable key={table.id} table={table}
                    selected={selectedTable?.id === table.id || editingTable?.id === table.id}
                    activeOrder={activeOrders.find(o => o.table_id === table.id)} />
                ))}
              </svg>

              {/* Draggable overlay divs (for click + drag) */}
              {sectionTables.map(table => (
                <DraggableTableOverlay key={`drag-${table.id}`} table={table} editMode={editMode}
                  selected={editingTable?.id === table.id}
                  activeOrder={activeOrders.find(o => o.table_id === table.id)}
                  onClick={() => {
                    if (editMode) setEditingTable(table);
                    else handleTableClick(table);
                  }} />
              ))}

              {sectionTables.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center" style={{ color: '#6b7b68' }}>
                  <p className="text-sm">Geen tafels in deze sectie</p>
                </div>
              )}
            </div>
          </DndContext>

          {/* Edit mode: bottom toolbar */}
          {editMode && (
            <div className="flex gap-3 justify-center py-2">
              <button onClick={() => addNewTable('square')}
                className="px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
                style={{ backgroundColor: '#1a2018', color: '#e5e7eb', border: '1px solid #2a3528' }}>
                <Square className="w-4 h-4" /> + Vierkante tafel
              </button>
              <button onClick={() => addNewTable('round')}
                className="px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
                style={{ backgroundColor: '#1a2018', color: '#e5e7eb', border: '1px solid #2a3528' }}>
                <Circle className="w-4 h-4" /> + Ronde tafel
              </button>
              <button onClick={() => {
                const newPlant: DecoElement = {
                  id: `plant_${Date.now()}`, type: 'plant',
                  x: 100 + Math.random() * 300, y: 100 + Math.random() * 200,
                  width: 24, height: 24,
                };
                saveDecos([...decos, newPlant]);
              }}
                className="px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
                style={{ backgroundColor: '#1a2018', color: '#e5e7eb', border: '1px solid #2a3528' }}>
                <Leaf className="w-4 h-4" /> + Plant
              </button>
            </div>
          )}

          {/* Afhaal section */}
          <div className="rounded-xl p-4" style={{ backgroundColor: '#1a2018', border: '1px solid #2a3528' }}>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: '#e5e7eb' }}>
              <Package className="w-4 h-4" style={{ color: ACCENT }} /> Afhaal
            </h3>
            <div className="flex gap-3 flex-wrap">
              {Array.from({ length: AFHAAL_SPOTS }).map((_, i) => {
                const order = afhaalOrders[i];
                const isActive = !!order;
                return (
                  <motion.button key={i} whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      if (order) handleAfhaalClick(order);
                      else goToKassaForTakeaway();
                    }}
                    className="w-12 h-12 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors cursor-pointer"
                    style={{
                      backgroundColor: isActive ? '#3a1e1e' : '#1e3a1e',
                      borderColor: isActive ? '#ef4444' : '#2d5a2d',
                      color: isActive ? '#ef4444' : '#22c55e',
                    }}>
                    {isActive ? `#${order.order_number}` : <Plus className="w-4 h-4" />}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ─── MODALS ─── */}

      {/* Table popup (view mode) */}
      <AnimatePresence>
        {selectedTable && !editMode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setSelectedTable(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="rounded-2xl p-6 w-full max-w-sm shadow-2xl"
              style={{ backgroundColor: '#1a2018', border: '1px solid #2a3528' }}>

              <div className="flex items-center justify-between mb-1">
                <h2 className="text-xl font-bold" style={{ color: '#e5e7eb' }}>Tafel {selectedTable.table_number}</h2>
                <button onClick={() => setSelectedTable(null)}><X className="w-5 h-5" style={{ color: '#6b7b68' }} /></button>
              </div>
              <p className="text-sm mb-4" style={{ color: '#6b7b68' }}>
                {selectedTable.seats} gasten · {selectedTable.shape === 'round' ? 'Rond' : 'Vierkant'}
                {selectedTable.status !== 'vrij' && (() => {
                  const ord = activeOrders.find(o => o.table_id === selectedTable.id);
                  return ord ? <> · <TimeAgo since={ord.created_at} /></> : null;
                })()}
              </p>

              {/* FREE */}
              {selectedTable.status === 'vrij' && (
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => goToKassaForTable(selectedTable)}
                  className="w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2"
                  style={{ backgroundColor: ACCENT, color: '#0f1410' }}>
                  <Monitor className="w-5 h-5" /> Open Kassa
                </motion.button>
              )}

              {/* BEZET */}
              {selectedTable.status === 'bezet' && (() => {
                const order = activeOrders.find(o => o.table_id === selectedTable.id);
                return (
                  <div className="space-y-3">
                    {order && orderDetails.length > 0 && (
                      <div className="rounded-lg p-3 space-y-1.5" style={{ backgroundColor: '#0f1410' }}>
                        <p className="text-xs font-bold" style={{ color: ACCENT }}>Bestelling #{order.order_number}</p>
                        {orderDetails.map((item, i) => (
                          <div key={i} className="flex justify-between text-xs" style={{ color: '#e5e7eb' }}>
                            <span>{item.name_snapshot}</span>
                            <span style={{ color: '#6b7b68' }}>×{item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => goToKassaForTable(selectedTable)}
                      className="w-full py-3 rounded-xl font-bold text-sm"
                      style={{ backgroundColor: '#0f1410', color: ACCENT, border: `1px solid ${ACCENT}40` }}>
                      + Meer bestellen
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        if (order) {
                          setPayingOrderId(order.id);
                          setPayingTableId(selectedTable.id);
                          setSelectedTable(null);
                          setShowPayment(true);
                        }
                      }}
                      className="w-full py-3 rounded-xl font-bold text-sm"
                      style={{ backgroundColor: ACCENT, color: '#0f1410' }}>
                      💰 Afrekenen
                    </motion.button>
                  </div>
                );
              })()}

              {/* GELEVERD */}
              {selectedTable.status === 'geleverd' && (() => {
                const order = activeOrders.find(o => o.table_id === selectedTable.id);
                return (
                  <div className="space-y-3">
                    {order && orderDetails.length > 0 && (
                      <div className="rounded-lg p-3 space-y-1.5" style={{ backgroundColor: '#0f1410' }}>
                        <p className="text-xs font-bold" style={{ color: ACCENT }}>Bestelling #{order.order_number}</p>
                        {orderDetails.map((item, i) => (
                          <div key={i} className="flex justify-between text-xs" style={{ color: '#e5e7eb' }}>
                            <span>{item.name_snapshot}</span>
                            <span style={{ color: '#6b7b68' }}>×{item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => {
                      goToKassaForTable(selectedTable);
                    }}
                      className="w-full py-3 rounded-xl font-bold text-sm"
                      style={{ backgroundColor: '#0f1410', color: ACCENT, border: `1px solid ${ACCENT}40` }}>
                      + Meer bestellen
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        if (order) {
                          setPayingOrderId(order.id);
                          setPayingTableId(selectedTable.id);
                          setSelectedTable(null);
                          setShowPayment(true);
                        }
                      }}
                      className="w-full py-3 rounded-xl font-bold text-sm"
                      style={{ backgroundColor: ACCENT, color: '#0f1410' }}>
                      💰 Betalen
                    </motion.button>
                  </div>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payment popup */}
      <AnimatePresence>
        {showPayment && (
          <PaymentPopup onPay={handlePayment} onClose={() => { setShowPayment(false); setPayingOrderId(null); setPayingTableId(null); }} />
        )}
      </AnimatePresence>

      {/* Afhaal detail popup */}
      <AnimatePresence>
        {afhaalOrderDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setAfhaalOrderDetail(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4"
              style={{ backgroundColor: '#1a2018', border: '1px solid #2a3528' }}>
              <h2 className="text-lg font-bold" style={{ color: '#e5e7eb' }}>Afhaal #{afhaalOrderDetail.order_number}</h2>
              <p className="text-sm" style={{ color: '#6b7b68' }}><TimeAgo since={afhaalOrderDetail.created_at} /></p>
              {afhaalItems.length > 0 && (
                <div className="rounded-lg p-3 space-y-1" style={{ backgroundColor: '#0f1410' }}>
                  {afhaalItems.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm" style={{ color: '#e5e7eb' }}>
                      <span>{item.name_snapshot}</span>
                      <span style={{ color: '#6b7b68' }}>×{item.quantity}</span>
                    </div>
                  ))}
                </div>
              )}
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => {
                store.clearOrder();
                if (effectiveRestaurantId) store.setRestaurant(effectiveRestaurantId, '');
                if (profile) store.setProfile(profile.id, profile.full_name || 'Gebruiker');
                store.setTable(null, null);
                store.setOrderType('takeaway');
                setAfhaalOrderDetail(null);
                navigate('/restaurant/kassa');
              }}
                className="w-full py-3 rounded-xl font-bold text-sm"
                style={{ backgroundColor: '#0f1410', color: ACCENT, border: `1px solid ${ACCENT}40` }}>
                + Meer toevoegen
              </motion.button>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => markAfhaalCollected(afhaalOrderDetail.id)}
                className="w-full py-3 rounded-xl font-bold text-sm"
                style={{ backgroundColor: ACCENT, color: '#0f1410' }}>
                ✅ Bestelling opgehaald
              </motion.button>
              <button onClick={() => setAfhaalOrderDetail(null)}
                className="w-full py-2 text-sm" style={{ color: '#6b7b68' }}>Sluiten</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
