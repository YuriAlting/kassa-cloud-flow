import { create } from 'zustand';

export interface OrderItem {
  id: string;
  product_id: string;
  naam: string;
  prijs: number;
  aantal: number;
  notitie?: string;
}

interface PosState {
  restaurantId: string | null;
  restaurantNaam: string | null;
  medewerkerId: string | null;
  medewerkerNaam: string | null;
  selectedTafelId: string | null;
  selectedTafelNaam: string | null;
  orderItems: OrderItem[];
  orderNotitie: string;
  korting: number;
  kortingType: 'percentage' | 'vast' | null;

  setRestaurant: (id: string, naam: string) => void;
  setMedewerker: (id: string, naam: string) => void;
  setTafel: (id: string | null, naam: string | null) => void;
  addItem: (product: { id: string; naam: string; prijs: number }) => void;
  removeItem: (productId: string) => void;
  updateItemQuantity: (productId: string, delta: number) => void;
  setItemNotitie: (productId: string, notitie: string) => void;
  setKorting: (korting: number, type: 'percentage' | 'vast' | null) => void;
  setOrderNotitie: (notitie: string) => void;
  clearOrder: () => void;
  getSubtotaal: () => number;
  getTotaal: () => number;
  logout: () => void;
}

export const usePosStore = create<PosState>((set, get) => ({
  restaurantId: null,
  restaurantNaam: null,
  medewerkerId: null,
  medewerkerNaam: null,
  selectedTafelId: null,
  selectedTafelNaam: null,
  orderItems: [],
  orderNotitie: '',
  korting: 0,
  kortingType: null,

  setRestaurant: (id, naam) => set({ restaurantId: id, restaurantNaam: naam }),
  setMedewerker: (id, naam) => set({ medewerkerId: id, medewerkerNaam: naam }),
  setTafel: (id, naam) => set({ selectedTafelId: id, selectedTafelNaam: naam }),

  addItem: (product) => {
    const items = get().orderItems;
    const existing = items.find(i => i.product_id === product.id);
    if (existing) {
      set({
        orderItems: items.map(i =>
          i.product_id === product.id ? { ...i, aantal: i.aantal + 1 } : i
        ),
      });
    } else {
      set({
        orderItems: [
          ...items,
          {
            id: crypto.randomUUID(),
            product_id: product.id,
            naam: product.naam,
            prijs: product.prijs,
            aantal: 1,
          },
        ],
      });
    }
  },

  removeItem: (productId) =>
    set({ orderItems: get().orderItems.filter(i => i.product_id !== productId) }),

  updateItemQuantity: (productId, delta) => {
    const items = get().orderItems;
    const item = items.find(i => i.product_id === productId);
    if (!item) return;
    const newQty = item.aantal + delta;
    if (newQty <= 0) {
      set({ orderItems: items.filter(i => i.product_id !== productId) });
    } else {
      set({
        orderItems: items.map(i =>
          i.product_id === productId ? { ...i, aantal: newQty } : i
        ),
      });
    }
  },

  setItemNotitie: (productId, notitie) =>
    set({
      orderItems: get().orderItems.map(i =>
        i.product_id === productId ? { ...i, notitie } : i
      ),
    }),

  setKorting: (korting, type) => set({ korting, kortingType: type }),
  setOrderNotitie: (notitie) => set({ orderNotitie: notitie }),

  clearOrder: () =>
    set({
      orderItems: [],
      orderNotitie: '',
      korting: 0,
      kortingType: null,
      selectedTafelId: null,
      selectedTafelNaam: null,
    }),

  getSubtotaal: () =>
    get().orderItems.reduce((sum, i) => sum + i.prijs * i.aantal, 0),

  getTotaal: () => {
    const sub = get().getSubtotaal();
    const { korting, kortingType } = get();
    if (kortingType === 'percentage') return sub * (1 - korting / 100);
    if (kortingType === 'vast') return Math.max(0, sub - korting);
    return sub;
  },

  logout: () =>
    set({
      medewerkerId: null,
      medewerkerNaam: null,
      selectedTafelId: null,
      selectedTafelNaam: null,
      orderItems: [],
      orderNotitie: '',
      korting: 0,
      kortingType: null,
    }),
}));
