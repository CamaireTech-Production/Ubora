import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const STORAGE_KEY = "director:lastPath";

// Liste blanche des routes Directeur à restaurer
const ALLOWED_DIRECTOR_PATHS = [
  "/directeur/chat",
  "/directeur/dashboard",
  // ajoute ici d'autres routes directeur si existantes
];

function isAllowedDirectorPath(pathname: string) {
  return ALLOWED_DIRECTOR_PATHS.some((p) =>
    pathname === p || pathname.startsWith(p + "/")
  );
}

/**
 * Sauvegarde la route courante dans sessionStorage pour les Directeurs.
 */
export function useSaveDirectorLastPath() {
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (user?.role === "directeur" && isAllowedDirectorPath(location.pathname)) {
      sessionStorage.setItem(STORAGE_KEY, location.pathname + location.search + location.hash);
    }
    // Ne rien sauvegarder pour les autres rôles ou routes non autorisées
  }, [user?.role, location.pathname, location.search, location.hash]);
}

/**
 * À utiliser une fois au démarrage de l'app (après auth prête) pour restaurer la route.
 */
export function useRestoreDirectorLastPath() {
  const { user, firebaseUser, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const restoredRef = useRef(false);

  useEffect(() => {
    // Attendre que l'auth soit prête
    if (isLoading || typeof firebaseUser === "undefined") return;
    if (restoredRef.current) return;

    // Restaurer seulement pour Directeur
    if (user?.role === "directeur") {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      const currentFullPath = location.pathname + location.search + location.hash;

      // Si on a un chemin sauvegardé, qu'il est autorisé, et qu'on n'y est pas déjà
      if (saved && isAllowedDirectorPath(saved) && saved !== currentFullPath) {
        restoredRef.current = true; // éviter boucles
        navigate(saved, { replace: true });
        return;
      }
    }

    // Si rien à restaurer, marquer comme fait pour éviter re-exécutions
    restoredRef.current = true;
  }, [user?.role, isLoading, firebaseUser, navigate, location.pathname, location.search, location.hash]);
}