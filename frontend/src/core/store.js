import { create } from 'zustand'

export const useStore = create((set) => ({
  ticker: 'AAPL',
  timeframe: '3mo',
  watchlist: ['AAPL', 'TSLA', 'NVDA', 'SPY', 'MSFT'],

  setTicker: (ticker) => set({ ticker: ticker.toUpperCase() }),
  setTimeframe: (timeframe) => set({ timeframe }),
  addToWatchlist: (ticker) =>
    set((s) => ({
      watchlist: s.watchlist.includes(ticker.toUpperCase())
        ? s.watchlist
        : [...s.watchlist, ticker.toUpperCase()],
    })),
  removeFromWatchlist: (ticker) =>
    set((s) => ({ watchlist: s.watchlist.filter((t) => t !== ticker) })),
}))
