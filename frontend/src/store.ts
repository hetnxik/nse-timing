import { create } from "zustand";
import { StockData, ScreenResult } from "./api";

type ScreenerFilters = {
  minScore: number;
  minRsi: number;
  maxRsi: number;
  regime: string;
};

interface StoreState {
  currentStock: StockData | null;
  setCurrentStock: (stock: StockData | null) => void;

  watchlist: string[];
  addToWatchlist: (ticker: string) => void;
  removeFromWatchlist: (ticker: string) => void;

  compareList: string[];
  addToCompare: (ticker: string) => void;
  removeFromCompare: (ticker: string) => void;
  clearCompare: () => void;

  screenerResults: ScreenResult[];
  setScreenerResults: (results: ScreenResult[]) => void;

  screenerFilters: ScreenerFilters;
  setScreenerFilters: (filters: Partial<ScreenerFilters>) => void;

  loading: boolean;
  setLoading: (loading: boolean) => void;

  error: string | null;
  setError: (error: string | null) => void;
}

export const useStore = create<StoreState>((set, get) => ({
  currentStock: null,
  setCurrentStock: (stock) => set({ currentStock: stock }),

  watchlist: JSON.parse(localStorage.getItem("watchlist") || "[]"),
  addToWatchlist: (ticker) => {
    const current = get().watchlist;
    if (!current.includes(ticker)) {
      const updated = [...current, ticker];
      localStorage.setItem("watchlist", JSON.stringify(updated));
      set({ watchlist: updated });
    }
  },
  removeFromWatchlist: (ticker) => {
    const current = get().watchlist;
    const updated = current.filter((t) => t !== ticker);
    localStorage.setItem("watchlist", JSON.stringify(updated));
    set({ watchlist: updated });
  },

  compareList: [],
  addToCompare: (ticker) => {
    const current = get().compareList;
    if (!current.includes(ticker) && current.length < 4) {
      set({ compareList: [...current, ticker] });
    }
  },
  removeFromCompare: (ticker) => {
    const current = get().compareList;
    set({ compareList: current.filter((t) => t !== ticker) });
  },
  clearCompare: () => set({ compareList: [] }),

  screenerResults: [],
  setScreenerResults: (results) => set({ screenerResults: results }),

  screenerFilters: {
    minScore: 60,
    minRsi: 0,
    maxRsi: 100,
    regime: "any",
  },
  setScreenerFilters: (filters: Partial<ScreenerFilters>) =>
    set((state) => ({
      screenerFilters: { ...state.screenerFilters, ...filters },
    })),

  loading: false,
  setLoading: (loading) => set({ loading }),

  error: null,
  setError: (error) => set({ error }),
}));
