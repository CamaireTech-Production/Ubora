import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@ubora/shared/firebaseConfig';

interface EmailValidationResult {
  isValid: boolean;
  isChecking: boolean;
  exists: boolean;
  error?: string;
  hasError?: boolean; // Indique si la vérification a échoué
}

export const useEmailValidation = (email: string, debounceMs: number = 500) => {
  const [validation, setValidation] = useState<EmailValidationResult>({
    isValid: false,
    isChecking: false,
    exists: false,
    hasError: false
  });

  const validateEmail = useCallback(async (emailToCheck: string) => {
    if (!emailToCheck || emailToCheck.trim() === '') {
      setValidation({
        isValid: false,
        isChecking: false,
        exists: false,
        hasError: false
      });
      return;
    }

    // Validation basique du format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailToCheck)) {
      setValidation({
        isValid: false,
        isChecking: false,
        exists: false,
        hasError: false,
        error: 'Format d\'email invalide'
      });
      return;
    }

    setValidation(prev => ({ ...prev, isChecking: true }));

    try {
      // Vérifier si l'email existe déjà dans Firestore
      const normalizedEmail = emailToCheck.trim().toLowerCase();
      const usersQuery = query(
        collection(db, 'users'),
        where('email', '==', normalizedEmail)
      );
      
      const usersSnapshot = await getDocs(usersQuery);
      
      // Vérifier que les documents trouvés correspondent vraiment à cet email (double vérification)
      let exists = false;
      if (!usersSnapshot.empty) {
        // Normaliser les emails des documents trouvés et comparer
        const matchingDocs = usersSnapshot.docs.filter(doc => {
          const docEmail = doc.data().email;
          const normalizedDocEmail = docEmail ? docEmail.trim().toLowerCase() : '';
          return normalizedDocEmail === normalizedEmail;
        });
        exists = matchingDocs.length > 0;
      }

      setValidation({
        isValid: true,
        isChecking: false,
        exists,
        hasError: false,
        error: exists ? 'Cet email est déjà utilisé' : undefined
      });
    } catch (error: any) {
      // En cas d'erreur, marquer comme "en vérification" pour éviter les faux positifs
      console.warn('⚠️ Could not check email availability:', error);
      
      // Si c'est une erreur de permission ou réseau, on ne peut pas vérifier
      // Dans ce cas, on ne marque PAS comme disponible pour éviter les faux positifs
      const isPermissionError = error?.code === 'permission-denied' || 
                                 error?.message?.includes('permission');
      
      // En cas d'erreur, on marque comme "erreur" pour ne pas afficher "Email disponible"
      // La vérification finale dans register() sera plus fiable
      setValidation({
        isValid: false, // Ne pas valider si on a eu une erreur
        isChecking: false,
        exists: false,
        hasError: true, // Marquer qu'il y a eu une erreur
        error: 'Impossible de vérifier la disponibilité. La vérification se fera lors de la création.'
      });
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      validateEmail(email);
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [email, debounceMs, validateEmail]);

  return validation;
};

