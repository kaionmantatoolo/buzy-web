import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Route } from '@/lib/types';

const MAX_FAVORITES = 5;

// Stored favorite (minimal data to identify a route)
interface StoredFavorite {
  routeNumber: string;
  bound: string;
  serviceType: string;
  company: string;
}

interface FavoritesState {
  // Stored favorite identifiers
  favorites: StoredFavorite[];
  
  // Actions
  addFavorite: (route: Route) => boolean;
  removeFavorite: (route: Route) => void;
  isFavorite: (route: Route) => boolean;
  clearAllFavorites: () => void;
  canAddMore: () => boolean;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: [],
      
      addFavorite: (route: Route) => {
        const { favorites, isFavorite, canAddMore } = get();
        
        // Check if already a favorite
        if (isFavorite(route)) {
          return false;
        }
        
        // Check limit
        if (!canAddMore()) {
          return false;
        }
        
        const newFavorite: StoredFavorite = {
          routeNumber: route.routeNumber,
          bound: route.bound,
          serviceType: route.serviceType,
          company: route.company,
        };
        
        set({ favorites: [...favorites, newFavorite] });
        return true;
      },
      
      removeFavorite: (route: Route) => {
        const { favorites } = get();
        
        const filtered = favorites.filter(fav => 
          !(fav.routeNumber === route.routeNumber &&
            fav.bound === route.bound &&
            fav.serviceType === route.serviceType &&
            fav.company === route.company)
        );
        
        set({ favorites: filtered });
      },
      
      isFavorite: (route: Route) => {
        const { favorites } = get();
        
        return favorites.some(fav =>
          fav.routeNumber === route.routeNumber &&
          fav.bound === route.bound &&
          fav.serviceType === route.serviceType &&
          fav.company === route.company
        );
      },
      
      clearAllFavorites: () => {
        set({ favorites: [] });
      },
      
      canAddMore: () => {
        return get().favorites.length < MAX_FAVORITES;
      },
    }),
    {
      name: 'buzy-favorites',
    }
  )
);

// Helper to get favorite routes from full route list
export function getFavoriteRoutes(allRoutes: Route[], favorites: StoredFavorite[]): Route[] {
  return favorites
    .map(fav => 
      allRoutes.find(route =>
        route.routeNumber === fav.routeNumber &&
        route.bound === fav.bound &&
        route.serviceType === fav.serviceType &&
        route.company === fav.company
      )
    )
    .filter((route): route is Route => route !== undefined);
}
