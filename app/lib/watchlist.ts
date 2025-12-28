/**
 * Watch List / Friend Groups functionality
 * Stores watched addresses in localStorage
 */

const WATCHLIST_KEY = "pact_watchlist";

export interface WatchlistEntry {
  address: string;
  nickname?: string;
  addedAt: number;
}

/**
 * Get all watched addresses
 */
export const getWatchlist = (): WatchlistEntry[] => {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(WATCHLIST_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Error reading watchlist:", error);
    return [];
  }
};

/**
 * Add address to watchlist
 */
export const addToWatchlist = (address: string, nickname?: string): void => {
  if (typeof window === "undefined") return;
  try {
    const watchlist = getWatchlist();
    // Check if already exists
    if (
      watchlist.some(
        (entry) => entry.address.toLowerCase() === address.toLowerCase()
      )
    ) {
      return;
    }
    watchlist.push({
      address,
      nickname,
      addedAt: Date.now(),
    });
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
  } catch (error) {
    console.error("Error adding to watchlist:", error);
  }
};

/**
 * Remove address from watchlist
 */
export const removeFromWatchlist = (address: string): void => {
  if (typeof window === "undefined") return;
  try {
    const watchlist = getWatchlist();
    const filtered = watchlist.filter(
      (entry) => entry.address.toLowerCase() !== address.toLowerCase()
    );
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error("Error removing from watchlist:", error);
  }
};

/**
 * Check if address is in watchlist
 */
export const isInWatchlist = (address: string): boolean => {
  const watchlist = getWatchlist();
  return watchlist.some(
    (entry) => entry.address.toLowerCase() === address.toLowerCase()
  );
};

/**
 * Update nickname for an address
 */
export const updateWatchlistNickname = (
  address: string,
  nickname: string
): void => {
  if (typeof window === "undefined") return;
  try {
    const watchlist = getWatchlist();
    const updated = watchlist.map((entry) =>
      entry.address.toLowerCase() === address.toLowerCase()
        ? { ...entry, nickname }
        : entry
    );
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Error updating watchlist nickname:", error);
  }
};
