import { createContext } from 'react';

/** Context for relationship dropdown hover highlighting.
 *  The value is a callback that accepts an encoded relationship string ("base:offset")
 *  or null to clear the highlight. */
export const RelationshipHighlightContext = createContext<(encoded: string | null) => void>(() => {});
