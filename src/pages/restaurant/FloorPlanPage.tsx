import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Package, Plus, Trash2, Edit2, X } from 'lucide-react';

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

interface Restaurant {
  id: string;
  name: string;
}

const STATUS_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  vrij: { bg: 'hsl(142 76% 36%)', border: 'hsl(142 76% 46%)', label: 'Vrij' },
  bezet: { bg: 'hsl(0 72% 51%)', border: 'hsl(0 72% 61%)', label: 'Bezet' },
  rekening: { bg: 'hsl(38 92% 50%)', border: 'hsl(38 92% 60%)', label: 'Rekening' },
};

function ChairIndicators({ shape, seats, size }: { shape: string; seats: number; size: number }) {
  const chairs: JSX.Element[] = [];
  const chairSize = 10;

  if (shape === 'round') {
    const radius = size / 2 + 14;
    for (let i = 0; i < seats; i++) {
      const angle = (2 * Math.PI * i) / seats - Math.PI / 2;
      const cx = size / 2 + radius * Math.cos(angle);
      const cy = size / 2 + radius * Math.sin(angle);
      chairs.push(
        <rect key={i} x={cx - chairSize / 2} y={cy - chairSize / 2}
          width={chairSize} height={chairSize} rx={3}
          fill="hsl(var(--muted-foreground) / 0.4)" />
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
          width={chairSize} height={chairSize} rx={3}
          fill="hsl(var(--muted-foreground) / 0.4)" />
      );
    });
  }
  return <>{chairs}</>;
}

function TableShape({ table, onClick }: { table: TableItem; onClick: () => void }) {
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
          <circle cx={size / 2} cy={size / 2} r={size / 2}
            fill={colors.bg} stroke={colors.border} strokeWidth={2} />
        ) : (
          <rect x={0} y={0} width={size} height={size} rx={8}
            fill={colors.bg} stroke={colors.border} strokeWidth={2} />
        )}
        <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="central"
          fill="white" fontSize={table.seats <= 2 ? 16 : 20} fontWeight="bold">
          {table.table_number}
        </text>
      </svg>
    </motion.div>
  );
}

// --- Add/Edit Table Modal ---
function TableFormModal({ sectionId, restaurantId, existingTable, onClose, onSaved }: {
  sectionId: string | null;
  restaurantId: string;
  existingTable?: TableItem;
  onClose: () => void;
  onSaved: () => void;
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
      restaurant_id: restaurantId,
      floor_section_id: isTakeaway ? null : sectionId,
      table_number: tableNumber,
      seats: parseInt(seats) || 4,
      shape,
      position_x: parseFloat(posX) || 200,
      position_y: parseFloat(posY) || 200,
      is_takeaway: isTakeaway,
    };

    if (existingTable) {
      await supabase.from('tables').update(payload).eq('id', existingTable.id);
    } else {
      await supabase.from('tables').insert(payload);
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        onClick={e => e.stopPropagation()}
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">{existingTable ? 'Tafel bewerken' : 'Nieuwe tafel'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <input value={tableNumber} onChange={e => setTableNumber(e.target.value)} placeholder="Tafelnummer"
          className="w-full px-4 py-3 rounded-lg bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
        <div className="grid grid-cols-2 gap-3">
          <input type="number" value={seats} onChange={e => setSeats(e.target.value)} placeholder="Stoelen"
            className="px-4 py-3 rounded-lg bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
          <select value={shape} onChange={e => setShape(e.target.value)}
            className="px-4 py-3 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="square">Vierkant</option>
            <option value="round">Rond</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input type="number" value={posX} onChange={e => setPosX(e.target.value)} placeholder="Positie X"
            className="px-4 py-3 rounded-lg bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
          <input type="number" value={posY} onChange={e => setPosY(e.target.value)} placeholder="Positie Y"
            className="px-4 py-3 rounded-lg bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <input type="checkbox" checked={isTakeaway} onChange={e => setIsTakeaway(e.target.checked)}
            className="rounded border-border" />
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

// --- Add Section Modal ---
function SectionFormModal({ restaurantId, onClose, onSaved }: {
  restaurantId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name) return;
    setSaving(true);
    await supabase.from('floor_sections').insert({ restaurant_id: restaurantId, name, sort_order: 99 });
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        onClick={e => e.stopPropagation()}
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
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
  const { profile } = useAuth();
  const [sections, setSections] = useState<FloorSection[]>([]);
  const [tables, setTables] = useState<TableItem[]>([]);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<TableItem | null>(null);

  // Edit mode state
  const [showAddTable, setShowAddTable] = useState(false);
  const [editingTable, setEditingTable] = useState<TableItem | null>(null);
  const [showAddSection, setShowAddSection] = useState(false);

  // Superadmin: restaurant selector
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);

  const role = profile?.role;
  const canEdit = role === 'superadmin' || role === 'owner';

  // Determine which restaurant to show
  const effectiveRestaurantId = role === 'superadmin' ? selectedRestaurantId : profile?.restaurant_id;

  // Load restaurants for superadmin
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

    const [secRes, tabRes] = await Promise.all([
      supabase.from('floor_sections').select('*').eq('restaurant_id', effectiveRestaurantId).order('sort_order'),
      supabase.from('tables').select('*').eq('restaurant_id', effectiveRestaurantId),
    ]);

    const secs = (secRes.data || []) as FloorSection[];
    setSections(secs);
    setTables((tabRes.data || []) as TableItem[]);
    if (secs.length > 0) setActiveSection(prev => secs.find(s => s.id === prev) ? prev : secs[0].id);
    else setActiveSection(null);
    setLoading(false);
  }, [effectiveRestaurantId]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const updateTableStatus = async (tableId: string, newStatus: string) => {
    await supabase.from('tables').update({ status: newStatus }).eq('id', tableId);
    setTables(prev => prev.map(t => t.id === tableId ? { ...t, status: newStatus } : t));
    setSelectedTable(null);
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

  const takeawayTable = tables.find(t => t.is_takeaway);
  const sectionTables = tables.filter(t => !t.is_takeaway && t.floor_section_id === activeSection);

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

        {/* Superadmin restaurant selector */}
        {role === 'superadmin' && restaurants.length > 0 && (
          <select
            value={selectedRestaurantId || ''}
            onChange={e => setSelectedRestaurantId(e.target.value)}
            className="px-4 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {restaurants.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        )}

        {/* Section tabs */}
        <div className="flex gap-2">
          {sections.map(sec => (
            <div key={sec.id} className="flex items-center gap-1">
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setActiveSection(sec.id)}
                className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                  activeSection === sec.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
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

        {/* Edit actions */}
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
      <div className="flex gap-4 mb-4">
        {Object.entries(STATUS_COLORS).map(([key, val]) => (
          <div key={key} className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: val.bg }} />
            {val.label}
          </div>
        ))}
      </div>

      {/* Takeaway tile */}
      {takeawayTable && (
        <motion.div whileTap={{ scale: 0.97 }} onClick={() => setSelectedTable(takeawayTable)}
          className="mb-4 flex items-center gap-3 px-5 py-4 rounded-xl border cursor-pointer transition-colors"
          style={{
            backgroundColor: STATUS_COLORS[takeawayTable.status]?.bg + '22',
            borderColor: STATUS_COLORS[takeawayTable.status]?.bg + '55',
          }}>
          <Package className="w-6 h-6" style={{ color: STATUS_COLORS[takeawayTable.status]?.bg }} />
          <div>
            <span className="font-bold text-foreground text-lg">Afhaal</span>
            <span className="ml-3 text-sm" style={{ color: STATUS_COLORS[takeawayTable.status]?.bg }}>
              {STATUS_COLORS[takeawayTable.status]?.label}
            </span>
          </div>
        </motion.div>
      )}

      {/* Floor plan area */}
      <div className="flex-1 relative rounded-xl bg-[#111] border border-border overflow-hidden min-h-[400px]">
        {sectionTables.map(table => (
          <TableShape key={table.id} table={table} onClick={() => setSelectedTable(table)} />
        ))}
        {sectionTables.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
            Geen tafels in deze sectie
          </p>
        )}
      </div>

      {/* Table action modal */}
      {selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setSelectedTable(null)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            onClick={e => e.stopPropagation()}
            className="bg-card border border-border rounded-2xl p-6 w-full max-w-xs shadow-2xl">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xl font-bold text-foreground">Tafel {selectedTable.table_number}</h2>
              {canEdit && (
                <div className="flex gap-1">
                  <button onClick={() => { setEditingTable(selectedTable); setSelectedTable(null); }}
                    className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => { if (confirm('Tafel verwijderen?')) deleteTable(selectedTable.id); }}
                    className="p-1.5 rounded-lg hover:bg-destructive/20 text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              {selectedTable.seats} zitplaatsen · {selectedTable.shape === 'round' ? 'Rond' : 'Vierkant'}
            </p>

            <p className="text-xs text-muted-foreground mb-2">Status wijzigen:</p>
            <div className="space-y-2">
              {Object.entries(STATUS_COLORS).map(([key, val]) => (
                <motion.button key={key} whileTap={{ scale: 0.95 }}
                  onClick={() => updateTableStatus(selectedTable.id, key)}
                  className={`w-full py-3 rounded-lg text-sm font-bold text-white transition-opacity ${
                    selectedTable.status === key ? 'ring-2 ring-white/50' : 'opacity-80 hover:opacity-100'
                  }`} style={{ backgroundColor: val.bg }}>
                  {val.label}
                </motion.button>
              ))}
            </div>

            <button onClick={() => setSelectedTable(null)}
              className="w-full mt-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground bg-secondary hover:bg-secondary/80 transition-colors">
              Sluiten
            </button>
          </motion.div>
        </div>
      )}

      {/* Add/Edit table modal */}
      {(showAddTable || editingTable) && effectiveRestaurantId && (
        <TableFormModal
          sectionId={activeSection}
          restaurantId={effectiveRestaurantId}
          existingTable={editingTable || undefined}
          onClose={() => { setShowAddTable(false); setEditingTable(null); }}
          onSaved={fetchData}
        />
      )}

      {/* Add section modal */}
      {showAddSection && effectiveRestaurantId && (
        <SectionFormModal
          restaurantId={effectiveRestaurantId}
          onClose={() => setShowAddSection(false)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
}
