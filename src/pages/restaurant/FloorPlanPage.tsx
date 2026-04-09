import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Package } from 'lucide-react';

interface FloorSection {
  id: string;
  name: string;
  sort_order: number;
}

interface TableItem {
  id: string;
  floor_section_id: string | null;
  table_number: string;
  seats: number;
  shape: string;
  position_x: number;
  position_y: number;
  status: string;
  is_takeaway: boolean;
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
        <rect
          key={i}
          x={cx - chairSize / 2}
          y={cy - chairSize / 2}
          width={chairSize}
          height={chairSize}
          rx={3}
          fill="hsl(var(--muted-foreground) / 0.4)"
        />
      );
    }
  } else {
    // Square table: distribute chairs on 4 sides
    const positions: { x: number; y: number }[] = [];
    const seatsPerSide = Math.ceil(seats / 4);
    const sides = [
      // top
      (i: number, total: number) => ({ x: size / 2 + ((i - (total - 1) / 2) * 24), y: -16 }),
      // bottom
      (i: number, total: number) => ({ x: size / 2 + ((i - (total - 1) / 2) * 24), y: size + 16 }),
      // left
      (i: number, total: number) => ({ x: -16, y: size / 2 + ((i - (total - 1) / 2) * 24) }),
      // right
      (i: number, total: number) => ({ x: size + 16, y: size / 2 + ((i - (total - 1) / 2) * 24) }),
    ];

    let remaining = seats;
    for (let s = 0; s < 4 && remaining > 0; s++) {
      const count = Math.min(seatsPerSide, remaining);
      for (let i = 0; i < count; i++) {
        positions.push(sides[s](i, count));
      }
      remaining -= count;
    }

    positions.forEach((pos, i) => {
      chairs.push(
        <rect
          key={i}
          x={pos.x - chairSize / 2}
          y={pos.y - chairSize / 2}
          width={chairSize}
          height={chairSize}
          rx={3}
          fill="hsl(var(--muted-foreground) / 0.4)"
        />
      );
    });
  }

  return <>{chairs}</>;
}

function TableShape({ table, onClick }: { table: TableItem; onClick: () => void }) {
  const colors = STATUS_COLORS[table.status] || STATUS_COLORS.vrij;
  const size = table.seats <= 2 ? 70 : table.seats <= 4 ? 90 : 110;
  const svgSize = size + 40; // extra space for chairs

  return (
    <motion.div
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="cursor-pointer select-none"
      style={{
        position: 'absolute',
        left: table.position_x - svgSize / 2,
        top: table.position_y - svgSize / 2,
      }}
    >
      <svg width={svgSize} height={svgSize} viewBox={`${-20} ${-20} ${svgSize} ${svgSize}`}>
        <ChairIndicators shape={table.shape} seats={table.seats} size={size} />
        {table.shape === 'round' ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={size / 2}
            fill={colors.bg}
            stroke={colors.border}
            strokeWidth={2}
          />
        ) : (
          <rect
            x={0}
            y={0}
            width={size}
            height={size}
            rx={8}
            fill={colors.bg}
            stroke={colors.border}
            strokeWidth={2}
          />
        )}
        <text
          x={size / 2}
          y={size / 2 + 1}
          textAnchor="middle"
          dominantBaseline="central"
          fill="white"
          fontSize={table.seats <= 2 ? 16 : 20}
          fontWeight="bold"
        >
          {table.table_number}
        </text>
      </svg>
    </motion.div>
  );
}

export default function FloorPlanPage() {
  const { profile } = useAuth();
  const [sections, setSections] = useState<FloorSection[]>([]);
  const [tables, setTables] = useState<TableItem[]>([]);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<TableItem | null>(null);

  const restaurantId = profile?.restaurant_id;

  const fetchData = useCallback(async () => {
    if (!restaurantId) return;

    const [secRes, tabRes] = await Promise.all([
      supabase.from('floor_sections').select('*').eq('restaurant_id', restaurantId).order('sort_order'),
      supabase.from('tables').select('*').eq('restaurant_id', restaurantId),
    ]);

    const secs = (secRes.data || []) as FloorSection[];
    setSections(secs);
    setTables((tabRes.data || []) as TableItem[]);
    if (secs.length > 0 && !activeSection) setActiveSection(secs[0].id);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const updateTableStatus = async (tableId: string, newStatus: string) => {
    await supabase.from('tables').update({ status: newStatus }).eq('id', tableId);
    setTables(prev => prev.map(t => t.id === tableId ? { ...t, status: newStatus } : t));
    setSelectedTable(null);
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
      {/* Header with section tabs */}
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold text-foreground mr-4">Plattegrond</h1>
        <div className="flex gap-2">
          {sections.map(sec => (
            <motion.button
              key={sec.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveSection(sec.id)}
              className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                activeSection === sec.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {sec.name}
            </motion.button>
          ))}
        </div>
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
        <motion.div
          whileTap={{ scale: 0.97 }}
          onClick={() => setSelectedTable(takeawayTable)}
          className="mb-4 flex items-center gap-3 px-5 py-4 rounded-xl border cursor-pointer transition-colors"
          style={{
            backgroundColor: STATUS_COLORS[takeawayTable.status]?.bg + '22',
            borderColor: STATUS_COLORS[takeawayTable.status]?.bg + '55',
          }}
        >
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
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={e => e.stopPropagation()}
            className="bg-card border border-border rounded-2xl p-6 w-full max-w-xs shadow-2xl"
          >
            <h2 className="text-xl font-bold text-foreground mb-1">
              Tafel {selectedTable.table_number}
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              {selectedTable.seats} zitplaatsen · {selectedTable.shape === 'round' ? 'Rond' : 'Vierkant'}
            </p>

            <p className="text-xs text-muted-foreground mb-2">Status wijzigen:</p>
            <div className="space-y-2">
              {Object.entries(STATUS_COLORS).map(([key, val]) => (
                <motion.button
                  key={key}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => updateTableStatus(selectedTable.id, key)}
                  className={`w-full py-3 rounded-lg text-sm font-bold text-white transition-opacity ${
                    selectedTable.status === key ? 'ring-2 ring-white/50' : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: val.bg }}
                >
                  {val.label}
                </motion.button>
              ))}
            </div>

            <button
              onClick={() => setSelectedTable(null)}
              className="w-full mt-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground bg-secondary hover:bg-secondary/80 transition-colors"
            >
              Sluiten
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
