import { useQuery, gql } from '@apollo/client';
import { logError } from '../../utils/logError';

// ─── GraphQL Query ────────────────────────────────────────────────────────────

const MENU_ITEMS_QUERY = gql`
  query MenuItems {
    menuItems {
      id
      label
      icon
      path
      parentId
      sortOrder
    }
  }
`;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FlatMenuItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  parentId: string | null;
  sortOrder: number;
}

export interface UseMenuResult {
  items: FlatMenuItem[];
  loading: boolean;
  error: string | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Fetches menu items from MongoDB via GraphQL.
 * Returns a flat array — callers must use buildTree() for parent-child nesting.
 */
export function useMenu(): UseMenuResult {
  const { data, loading, error } = useQuery<{ menuItems: FlatMenuItem[] }>(
    MENU_ITEMS_QUERY,
    { fetchPolicy: 'cache-first' }
  );

  if (error) {
    logError(error, 'useMenu.query');
  }

  return {
    items:   data?.menuItems ?? [],
    loading,
    error:   error?.message ?? null,
  };
}
