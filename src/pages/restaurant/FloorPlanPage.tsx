import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Plus, Trash2, Edit2, X, Clock, Monitor } from 'lucide-react';
import { usePosStore } from '@/stores/posStore';

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
}

interface Restaurant {
  id: string;
  name: string;
}

const STATUS_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  vrij: { bg: 'hsl(142 76% 36%)', border: 'hsl(142 76% 46%)', label: 'Vrij' },
  bezet: { bg: 'hsl(0 72% 51%)', border: 'hsl(0 72% 61%)', label: 'Bezet' },
  geleverd: { bg: 'hsl(142 76% 25%)', border: 'hsl(142 76% 35%)', label: 'Geleverd' },
  rekening: { bg: 'hsl(38 92% 50%)', border: 'hsl(38 92% 60%)', label: 'Rekening' },
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
  return <span className="flex items-center gap-1 text-xs font-mono"><Clock className="w-3 h-3" />{elapsed}</span>;
}

function ChairIndicators({ shape, seats, size }: { shape: string; seats: number; size: number }) {
  const chairs: JSX.Element[] = [];
  const chairSize = 10;
  if (shape === 'round') {
    const radius = size / 2 + 14;
    for (let i = 0; i < seats; i++) {
      const angle = (2 * Math.PI * i) / seats - Math.PI / 2;
      chairs.push(
        <rect key={i} x={size / 2 + radius * Math.cos(angle) - chairSize / 2} y={size / 2 + radius * Math.sin(angle) - chairSize / 2}
          width={chairSize} height={chairSize} rx={3} fill="hsl(var(--muted-foreground) / 0.4)" />
      );
    }
  } else {
    const positions: { x: number; y: number }[] = [];
    const seatsPerSide = Math.ceil(seats / 4);
    const sides = [
      (i: number, total: number) => ({ x: size / 2 + ((i - (total - 1) / 2) * 24), y: -16 }),
      (i: number, total: number) => ({ x: size / 2 + ((i - (total - 1) / 2) * 24), y: size + 16 }),
      (i: number, total: number) => ({ x: -16, y: size / 2 + ((i - (total - 1) / 2) * 24) }),
      (i: number, total: number) => ({ x: size + 16, y: size / 2 + ((i - (total - 1) / 2) * 24) }),
    ];
    let remaining = seats;
    for (let s = 0; s < 4 && remaining > 0; s++) {
      const count = Math.min(seatsPerSide, remaining);
      for (let i = 0; i < count; i++) positions.push(sides[s](i, count));
      remaining -= count;
    }
    positions.forEach((pos, i) => {
      chairs.push(
        <rect key={i} x={pos.x - chairSize / 2} y={pos.y - chairSize / 2}
          width={chairSize} height={chairSize} rx={3} fill="hsl(var(--muted-foreground) / 0.4)" />
      );
    });
  }
  return <>{chairs}</>;
}

function TableShape({ table, activeOrder, onClick }: { table: TableItem; activeOrder?: ActiveOrder; onClick: () => void }) {
  const colors = STATUS_COLORS[table.status] || STATUS_COLORS.vrij;
  const size = table.seats <= 2 ? 70 : table.seats <= 4 ? 90 : 110;
  const svgSize = size + 40;

  return (
    <motion.div whileTap={{ scale: 0.95 }} onClick={onClick}
      className="cursor-pointer select-none" style={{
        position: 'absolute',
        left: table.position_x - svgSize / 2,
        top: table.position_y - svgSize / 2,
      }}>
      <svg width={svgSize} height={svgSize} viewBox={`${-20} ${-20} ${svgSize} ${svgSize}`}>
        <ChairIndicators shape={table.shape} seats={table.seats} size={size} />
        {table.shape === 'round' ? (
          <circle cx={size / 2} cy={size / 2} r={size / 2} fill={colors.bg} stroke={colors.border} strokeWidth={2} />
        ) : (
          <rect x={0} y={0} width={size} height={size} rx={8} fill={colors.bg} stroke={colors.border} strokeWidth={2} />
        )}
        <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="central"
          fill="white" fontSize={table.seats <= 2 ? 16 : 20} fontWeight="bold">
          {table.table_number}
        </text>
      </svg>
      {activeOrder && table.status === 'bezet' && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-black/80 text-white px-2 py-0.5 rounded text-[10px] font-mono whitespace-nowrap">
          <TimeAgo since={activeOrder.created_at} />
        </div>
      )}
    </motion.div>
  );
}

// --- Table Form Modal ---
function TableFormModal({ sectionId, restaurantId, existingTable, onClose, onSaved }: {
  sectionId: string | null; restaurantId: string; existingTable?: TableItem; onClose: () => void; onSaved: () => void;
}) {
  const [tableNumber, setTableNumber] = useState(existingTable?.table_number || '');
  const [seats, setSeats] = useState(existingTable?.seats?.toString() || '4');
  const [shape, setShape] = useState(existingTable?.shape || 'square');
  const [posX, setPosX] = useState(existingTable?.position_x?.toString() || '200');
  const [posY, setPosY] = useState(existingTable?.position_y?.toString() || '200');
  const [isTakeaway, setIsTakeaway] = useState(existingTable?.is_takeaway || false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!tableNumber) return;
    setSaving(true);
    const payload = {
      restaurant_id: restaurantId, floor_section_id: isTakeaway ? null : sectionId,
      table_number: tableNumber, seats: parseInt(seats) || 4, shape,
      position_x: parseFloat(posX) || 200, position_y: parseFloat(posY) || 200, is_takeaway: isTakeaway,
    };
    if (existingTable) await supabase.from('tables').update(payload).eq('id', existingTable.id);
    else await supabase.from('tables').insert(payload);
    setSaving(false); onSaved(); onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        onClick={e => e.stopPropagation()} className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">{existingTable ? 'Tafel bewerken' : 'Nieuwe tafel'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <input value={tableNumber} onChange={e => setTableNumber(e.target.value)} placeholder="Tafelnummer"
          className="w-full px-4 py-3 rounded-lg bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
        <div className="grid grid-cols-2 gap-3">
          <input type="number" value={seats} onChange={e => setSeats(e.target.value)} placeholder="Stoelen"
            className="px-4 py-3 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
          <select value={shape} onChange={e => setShape(e.target.value)}
            className="px-4 py-3 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="square">Vierkant</option><option value="round">Rond</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input type="number" value={posX} onChange={e => setPosX(e.target.value)} placeholder="Positie X"
            className="px-4 py-3 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
          <input type="number" value={posY} onChange={e => setPosY(e.target.value)} placeholder="Positie Y"
            className="px-4 py-3 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <input type="checkbox" checked={isTakeaway} onChange={e => setIsTakeaway(e.target.checked)} className="rounded border-border" />
          Afhaal-tafel
        </label>
        <motion.button whileTap={{ scale: 0.95 }} onClick={handleSave} disabled={saving}
          className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50">
          {saving ? 'Opslaan...' : 'Opslaan'}
        </motion.button>
      </motion.div>
    </div>
  );
}

function SectionFormModal({ restaurantId, onClose, onSaved }: { restaurantId: string; onClose: () => void; onSaved: () => void; }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    if (!name) return; setSaving(true);
    await supabase.from('floor_sections').insert({ restaurant_id: restaurantId, name, sort_order: 99 });
    setSaving(false); onSaved(); onClose();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        onClick={e => e.stopPropagation()} className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
        <h2 className="text-lg font-bold text-foreground">Nieuwe sectie</h2>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Sectienaam (bijv. Terras)"
          className="w-full px-4 py-3 rounded-lg bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
        <motion.button whileTap={{ scale: 0.95 }} onClick={handleSave} disabled={saving}
          className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50">
          {saving ? 'Opslaan...' : 'Sectie toevoegen'}
        </motion.button>
      </motion.div>
    </div>
  );
}

// --- Main FloorPlanPage ---
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

  // Edit mode state
  const [showAddTable, setShowAddTable] = useState(false);
  const [editingTable, setEditingTable] = useState<TableItem | null>(null);
  const [showAddSection, setShowAddSection] = useState(false);

  // Superadmin: restaurant selector
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);

  // Afhaal order details
  const [afhaalOrderDetail, setAfhaalOrderDetail] = useState<ActiveOrder | null>(null);
  const [afhaalItems, setAfhaalItems] = useState<OrderItemDetail[]>([]);

  const role = profile?.role;
  const canEdit = role === 'superadmin' || role === 'owner';
  const effectiveRestaurantId = role === 'superadmin' ? selectedRestaurantId : profile?.restaurant_id;

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
        .eq('restaurant_id', effectiveRestaurantId)
        .gte('created_at', today)
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
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const updateTableStatus = async (tableId: string, newStatus: string) => {
    await supabase.from('tables').update({ status: newStatus }).eq('id', tableId);
    // If marking vrij, also mark associated orders as delivered
    if (newStatus === 'vrij') {
      const tableOrders = activeOrders.filter(o => o.table_id === tableId);
      for (const o of tableOrders) {
        await supabase.from('orders').update({ status: 'delivered' }).eq('id', o.id);
      }
    }
    setTables(prev => prev.map(t => t.id === tableId ? { ...t, status: newStatus } : t));
    setSelectedTable(null);
    fetchData();
  };

  const deleteTable = async (tableId: string) => {
    await supabase.from('tables').delete().eq('id', tableId);
    setTables(prev => prev.filter(t => t.id !== tableId));
    setSelectedTable(null);
  };

  const deleteSection = async (sectionId: string) => {
    await supabase.from('tables').delete().eq('floor_section_id', sectionId);
    await supabase.from('floor_sections').delete().eq('id', sectionId);
    fetchData();
  };

  const loadOrderItems = async (orderId: string) => {
    const { data } = await supabase.from('order_items').select('name_snapshot, quantity').eq('order_id', orderId);
    return (data || []) as OrderItemDetail[];
  };

  const handleTableClick = async (table: TableItem) => {
    if (table.is_takeaway) return;

    if (table.status === 'vrij') {
      // For staff: go to kassa to take order, for owner/admin: show edit options
      if (role === 'staff') {
        navigate('/restaurant/kassa');
      } else {
        setSelectedTable(table);
      }
    } else {
      // Show table details + order info
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

  const sectionTables = tables.filter(t => !t.is_takeaway && t.floor_section_id === activeSection);
  const afhaalOrders = activeOrders.filter(o => !o.table_id);
  const AFHAAL_SPOTS = 10;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h1 className="text-2xl font-bold text-foreground mr-4">Plattegrond</h1>

        {role === 'superadmin' && restaurants.length > 0 && (
          <select value={selectedRestaurantId || ''} onChange={e => setSelectedRestaurantId(e.target.value)}
            className="px-4 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary">
            {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}

        <div className="flex gap-2">
          {sections.map(sec => (
            <div key={sec.id} className="flex items-center gap-1">
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setActiveSection(sec.id)}
                className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                  activeSection === sec.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}>
                {sec.name}
              </motion.button>
              {canEdit && (
                <button onClick={() => { if (confirm(`Sectie "${sec.name}" en alle tafels verwijderen?`)) deleteSection(sec.id); }}
                  className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {canEdit && (
          <div className="flex gap-2 ml-auto">
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowAddSection(true)}
              className="px-4 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium flex items-center gap-1.5 hover:bg-secondary/80">
              <Plus className="w-4 h-4" /> Sectie
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowAddTable(true)}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Tafel
            </motion.button>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 flex-wrap items-center">
        {Object.entries(STATUS_COLORS).map(([key, val]) => (
          <div key={key} className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: val.bg }} /> {val.label}
          </div>
        ))}
      </div>

      {/* Floor plan area */}
      <div className="flex-1 relative rounded-xl bg-[#111] border border-border overflow-hidden min-h-[400px]">
        {/* Kassa — large block */}
        <div className="absolute top-4 right-4 z-10 w-28 h-20 rounded-xl border-2 border-primary/60 bg-card/90 flex flex-col items-center justify-center shadow-lg">
          <Monitor className="w-7 h-7 text-primary mb-1" />
          <span className="text-xs font-bold text-foreground">Kassa</span>
        </div>

        {/* Ingang — door style */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-10">
          <div className="relative w-24 h-10 flex items-end justify-center">
            {/* Wall gaps */}
            <div className="absolute bottom-0 left-0 w-2 h-full bg-border/60 rounded-t" />
            <div className="absolute bottom-0 right-0 w-2 h-full bg-border/60 rounded-t" />
            {/* Door arc */}
            <svg width="80" height="40" viewBox="0 0 80 40" className="absolute bottom-0 left-2">
              <path d="M 0 40 A 40 40 0 0 1 40 0" fill="none" stroke="hsl(var(--muted-foreground) / 0.3)" strokeWidth="1.5" strokeDasharray="4 2" />
              <line x1="0" y1="40" x2="40" y2="0" stroke="hsl(var(--muted-foreground) / 0.4)" strokeWidth="1.5" />
            </svg>
            <span className="relative z-10 text-[10px] font-bold text-muted-foreground mb-1 bg-[#111] px-1.5">Ingang</span>
          </div>
        </div>

        {sectionTables.map(table => (
          <TableShape key={table.id} table={table}
            activeOrder={activeOrders.find(o => o.table_id === table.id)}
            onClick={() => handleTableClick(table)} />
        ))}
        {sectionTables.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
            Geen tafels in deze sectie
          </p>
        )}
      </div>

      {/* Afhaal section */}
      <div className="mt-4 bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <Package className="w-4 h-4" /> Afhaal
        </h3>
        <div className="flex gap-3 flex-wrap">
          {Array.from({ length: AFHAAL_SPOTS }).map((_, i) => {
            const order = afhaalOrders[i];
            const isActive = !!order;
            return (
              <motion.button key={i} whileTap={{ scale: 0.9 }}
                onClick={() => { if (order) handleAfhaalClick(order); }}
                className="w-12 h-12 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 transition-colors"
                style={{
                  backgroundColor: isActive ? 'hsl(0 72% 51%)' : 'hsl(142 76% 36%)',
                  borderColor: isActive ? 'hsl(0 72% 61%)' : 'hsl(142 76% 46%)',
                  cursor: isActive ? 'pointer' : 'default',
                }}>
                {isActive ? `#${order.order_number}` : ''}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Table status modal */}
      <AnimatePresence>
        {selectedTable && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setSelectedTable(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-xs shadow-2xl">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-xl font-bold text-foreground">Tafel {selectedTable.table_number}</h2>
                {canEdit && (
                  <div className="flex gap-1">
                    <button onClick={() => { setEditingTable(selectedTable); setSelectedTable(null); }}
                      className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => { if (confirm('Tafel verwijderen?')) deleteTable(selectedTable.id); }}
                      className="p-1.5 rounded-lg hover:bg-destructive/20 text-destructive"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-3">{selectedTable.seats} zitplaatsen · {selectedTable.shape === 'round' ? 'Rond' : 'Vierkant'}</p>

              {/* Show active order info */}
              {(() => {
                const order = activeOrders.find(o => o.table_id === selectedTable.id);
                if (order) return (
                  <div className="mb-3 p-3 rounded-lg bg-secondary text-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-foreground">Bestelling #{order.order_number}</p>
                      <TimeAgo since={order.created_at} />
                    </div>
                    {orderDetails.length > 0 && (
                      <ul className="space-y-1">
                        {orderDetails.map((item, i) => (
                          <li key={i} className="flex justify-between text-xs text-foreground">
                            <span>{item.name_snapshot}</span>
                            <span className="text-muted-foreground">×{item.quantity}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {/* Add items button for staff */}
                    {role === 'staff' && (
                      <motion.button whileTap={{ scale: 0.95 }} onClick={() => {
                        store.clearOrder();
                        if (effectiveRestaurantId) store.setRestaurant(effectiveRestaurantId, '');
                        if (profile) store.setProfile(profile.id, profile.full_name || 'Gebruiker');
                        store.setTable(selectedTable.id, selectedTable.table_number);
                        store.setOrderType('dine_in');
                        setSelectedTable(null);
                        navigate('/restaurant/kassa');
                      }}
                        className="w-full py-2 rounded-lg bg-primary/20 text-primary font-bold text-xs">
                        + Items toevoegen
                      </motion.button>
                    )}
                  </div>
                );
                return null;
              })()}

              {/* Status buttons */}
              <p className="text-xs text-muted-foreground mb-2">Status wijzigen:</p>
              <div className="space-y-2">
                {selectedTable.status === 'bezet' && (
                  <>
                    <motion.button whileTap={{ scale: 0.95 }}
                      onClick={() => updateTableStatus(selectedTable.id, 'geleverd')}
                      className="w-full py-3 rounded-lg text-sm font-bold text-white"
                      style={{ backgroundColor: STATUS_COLORS.geleverd.bg }}>
                      🍽️ Bezorgd
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.95 }}
                      onClick={() => updateTableStatus(selectedTable.id, 'rekening')}
                      className="w-full py-3 rounded-lg text-sm font-bold text-white"
                      style={{ backgroundColor: STATUS_COLORS.rekening.bg }}>
                      💰 Rekening
                    </motion.button>
                  </>
                )}
                {(selectedTable.status === 'geleverd' || selectedTable.status === 'rekening') && (
                  <motion.button whileTap={{ scale: 0.95 }}
                    onClick={() => updateTableStatus(selectedTable.id, 'vrij')}
                    className="w-full py-3 rounded-lg text-sm font-bold text-white"
                    style={{ backgroundColor: STATUS_COLORS.vrij.bg }}>
                    ✅ Tafel vrijmaken
                  </motion.button>
                )}
                {selectedTable.status === 'vrij' && canEdit && (
                  <p className="text-xs text-muted-foreground text-center py-2">Tafel is vrij</p>
                )}
              </div>
              <button onClick={() => setSelectedTable(null)}
                className="w-full mt-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground bg-secondary hover:bg-secondary/80 transition-colors">
                Sluiten
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Afhaal order detail popup */}
      <AnimatePresence>
        {afhaalOrderDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setAfhaalOrderDetail(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-xs shadow-2xl space-y-4">
              <h2 className="text-lg font-bold text-foreground">Afhaal #{afhaalOrderDetail.order_number}</h2>
              <p className="text-sm text-muted-foreground"><TimeAgo since={afhaalOrderDetail.created_at} /></p>
              {afhaalItems.length > 0 && (
                <ul className="space-y-1 bg-secondary rounded-lg p-3">
                  {afhaalItems.map((item, i) => (
                    <li key={i} className="flex justify-between text-sm text-foreground">
                      <span>{item.name_snapshot}</span>
                      <span className="text-muted-foreground">×{item.quantity}</span>
                    </li>
                  ))}
                </ul>
              )}
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => markAfhaalCollected(afhaalOrderDetail.id)}
                className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-bold text-sm">
                ✅ Bestelling opgehaald
              </motion.button>
              <button onClick={() => setAfhaalOrderDetail(null)}
                className="w-full py-2 text-sm text-muted-foreground">Sluiten</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add/Edit table modal */}
      {(showAddTable || editingTable) && effectiveRestaurantId && (
        <TableFormModal sectionId={activeSection} restaurantId={effectiveRestaurantId}
          existingTable={editingTable || undefined}
          onClose={() => { setShowAddTable(false); setEditingTable(null); }} onSaved={fetchData} />
      )}
      {showAddSection && effectiveRestaurantId && (
        <SectionFormModal restaurantId={effectiveRestaurantId}
          onClose={() => setShowAddSection(false)} onSaved={fetchData} />
      )}
    </div>
  );
}
