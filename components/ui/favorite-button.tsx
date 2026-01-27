'use client';

import { useState } from 'react';
import { IconButton, Snackbar } from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import { Route } from '@/lib/types';
import { useFavoritesStore } from '@/lib/stores';
import { useTranslation } from '@/lib/i18n';

interface FavoriteButtonProps {
  route: Route;
  size?: 'small' | 'medium' | 'large';
}

export function FavoriteButton({ route, size = 'medium' }: FavoriteButtonProps) {
  const { t } = useTranslation();
  const { isFavorite, addFavorite, removeFavorite, canAddMore } = useFavoritesStore();
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const favorite = isFavorite(route);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (favorite) {
      removeFavorite(route);
      setSnackbarMessage(t('removedFromFavorites', route.routeNumber));
    } else {
      if (!canAddMore()) {
        setSnackbarMessage(t('favoriteLimitReached'));
        return;
      }
      const added = addFavorite(route);
      if (added) {
        setSnackbarMessage(t('addedToFavorites', route.routeNumber));
      }
    }
  };

  return (
    <>
      <IconButton
        onClick={handleClick}
        size={size}
        aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
        sx={{
          color: favorite ? 'error.main' : 'action.active',
        }}
      >
        {favorite ? <FavoriteIcon /> : <FavoriteBorderIcon />}
      </IconButton>
      
      <Snackbar
        open={!!snackbarMessage}
        autoHideDuration={2000}
        onClose={() => setSnackbarMessage(null)}
        message={snackbarMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: { xs: 90, sm: 24 } }}
      />
    </>
  );
}
