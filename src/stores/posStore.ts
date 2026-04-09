import { create } from 'zustand';

export interface OrderItem {
  id: string;
  menu_item_id: string;
  name_snapshot: string;
  unit_price: number;
  quantity: number;
  notitie?: string;
}

interface PosState {
  restaurantId: string | null;
  restaurantName: string | null;
  profileId: string | null;
  profileName: string | null;
  orderItems: OrderItem[];
  orderNotitie: string;
  korting: number;
  kortingType: 'percentage' | 'vast' | null;
  tableId: string | null;
  tableNumber: string | null;
  orderType: 'dine_in' | 'takeaway' | null;

  setRestaurant: (id: string, name: string) => void;
  setProfile: (id: string, name: string) => void;
  setTable: (tableId: string | null, tableNumber: string | null) => void;
  setOrderType: (type: 'dine_in' | 'takeaway' | null) => void;
  addItem: (product: { id: string; name: string; price: number }) => void;
  removeItem: (menuItemId: string) => void;
  updateItemQuantity: (menuItemId: string, delta: number) => void;
  setItemNotitie: (menuItemId: string, notitie: string) => void;
  setKorting: (korting: number, type: 'percentage' | 'vast' | null) => void;
  setOrderNotitie: (notitie: string) => void;
  clearOrder: () => void;
  getSubtotaal: () => number;
  getTotaal: () => number;
  logout: () => void;
}

export const usePosStore = create<PosState>((set, get) => ({
  restaurantId: null,
  restaurantName: null,
  profileId: null,
  profileName: null,
  orderItems: [],
  orderNotitie: '',
  korting: 0,
  kortingType: null,
  tableId: null,
  tableNumber: null,
  orderType: null,

  setRestaurant: (id, name) => set({ restaurantId: id, restaurantName: name }),
  setProfile: (id, name) => set({ profileId: id, profileName: name }),
  setTable: (tableId, tableNumber) => set({ tableId, tableNumber }),
  setOrderType: (type) => set({ orderType: type }),

  addItem: (product) => {
    const items = get().orderItems;
    const existing = items.find(i => i.menu_item_id === product.id);
    if (existing) {
      set({
        orderItems: items.map(i =>
          i.menu_item_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        ),
      });
    } else {
      set({
        orderItems: [
          ...items,
          {
            id: crypto.randomUUID(),
            menu_item_id: product.id,
            name_snapshot: product.name,
            unit_price: product.price,
            quantity: 1,
          },
        ],
      });
    }
  },

  removeItem: (menuItemId) =>
    set({ orderItems: get().orderItems.filter(i => i.menu_item_id !== menuItemId) }),

  updateItemQuantity: (menuItemId, delta) => {
    const items = get().orderItems;
    const item = items.find(i => i.menu_item_id === menuItemId);
    if (!item) return;
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      set({ orderItems: items.filter(i => i.menu_item_id !== menuItemId) });
    } else {
      set({
        orderItems: items.map(i =>
          i.menu_item_id === menuItemId ? { ...i, quantity: newQty } : i
        ),
      });
    }
  },

  setItemNotitie: (menuItemId, notitie) =>
    set({
      orderItems: get().orderItems.map(i =>
        i.menu_item_id === menuItemId ? { ...i, notitie } : i
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
      tableId: null,
      tableNumber: null,
      orderType: null,
    }),

  getSubtotaal: () =>
    get().orderItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0),

  getTotaal: () => {
    const sub = get().getSubtotaal();
    const { korting, kortingType } = get();
    if (kortingType === 'percentage') return sub * (1 - korting / 100);
    if (kortingType === 'vast') return Math.max(0, sub - korting);
    return sub;
  },

  logout: () =>
    set({
      profileId: null,
      profileName: null,
      orderItems: [],
      orderNotitie: '',
      korting: 0,
      kortingType: null,
      tableId: null,
      tableNumber: null,
      orderType: null,
    }),
}));
