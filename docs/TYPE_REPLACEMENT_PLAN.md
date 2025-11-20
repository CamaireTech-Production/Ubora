# Plan de Remplacement des Types `any`

## Vue d'ensemble

Ce document liste tous les `any` identifiés dans le codebase avec leur priorisation pour remplacement progressif.

**Total identifié:**
- Frontend (`apps/main/src`): 334 occurrences dans 102 fichiers
- Shared (`packages/shared/src`): 279 occurrences dans 59 fichiers
- **Total: 613 occurrences**

**Objectif:** Réduire à <50 `any` restants (uniquement types Firebase/Timestamp nécessaires)

---

## Priorisation

### 🔴 Priorité CRITIQUE (Sécurité + Fréquence élevée)

#### 1. `apps/main/src/types/index.ts` (14 occurrences)
**Impact:** Types de base utilisés partout dans l'application
**Risque:** Erreurs de type runtime, bugs silencieux

| Ligne | Type actuel | Remplacement proposé | Complexité |
|-------|-------------|---------------------|------------|
| 103 | `approvedAt?: any` | `Date \| Timestamp \| null` | Faible |
| 108 | `directorDashboardAccessGrantedAt?: any` | `Date \| Timestamp \| null` | Faible |
| 131 | `createdAt?: any` | `Date \| Timestamp` | Faible |
| 132 | `updatedAt?: any` | `Date \| Timestamp` | Faible |
| 141 | `grantedAt: any` | `Date \| Timestamp` | Faible |
| 900 | `timestamp: any` | `Date \| Timestamp` | Faible |
| 340 | `data: any[]` | `GraphDataPoint[]` (créer type) | Moyenne |
| 392 | `data?: any[]` | `PDFSectionData[]` (créer type) | Moyenne |
| 508 | `value: any \| any[]` | `string \| number \| boolean \| Date \| (string \| number \| boolean \| Date)[]` | Moyenne |
| 766 | `[key: string]: any` | `Record<string, unknown>` | Faible |
| 799 | `[key: string]: any` | `Record<string, unknown>` | Faible |
| 823 | `[key: string]: any` | `Record<string, unknown>` | Faible |
| 898 | `[key: string]: any` | `Record<string, unknown>` | Faible |
| 1092 | `[columnId: string]: any` | `Record<string, string \| number \| boolean \| Date>` | Moyenne |

**Action:** Créer helper `toDate()` pour conversion Timestamp → Date

---

#### 2. `apps/main/src/services/core/firebaseErrorHandler.ts` (13 occurrences)
**Impact:** Gestion d'erreurs critique pour robustesse
**Risque:** Erreurs non typées, debugging difficile

| Ligne | Type actuel | Remplacement proposé | Complexité |
|-------|-------------|---------------------|------------|
| 22 | `error: any` | `Error \| FirebaseError \| unknown` | Moyenne |
| 79 | `error: any` | `Error \| FirebaseError \| unknown` | Moyenne |
| 88 | `error: any` | `Error \| FirebaseError \| unknown` | Moyenne |
| 98 | `error: any` | `Error \| FirebaseError \| unknown` | Moyenne |
| 106 | `error: any` | `Error \| FirebaseError \| unknown` | Moyenne |
| 121 | `error: any` | `Error \| FirebaseError \| unknown` | Moyenne |
| 134 | `error: any` | `Error \| FirebaseError \| unknown` | Moyenne |
| 147 | `error: any` | `Error \| FirebaseError \| unknown` | Moyenne |
| 162 | `error: any` | `Error \| FirebaseError \| unknown` | Moyenne |
| 170 | `error: any` | `Error \| FirebaseError \| unknown` | Moyenne |
| 194 | `lastError: any` | `Error \| FirebaseError \| unknown` | Moyenne |

**Action:** Créer types `FirebaseError`, `ErrorWithCode`, utiliser type guards

---

#### 3. `apps/main/src/utils/core/ResponseParser.ts` (12 occurrences)
**Impact:** Parsing des réponses AI, utilisé fréquemment
**Risque:** Erreurs de parsing, données mal typées

| Ligne | Type actuel | Remplacement proposé | Complexité |
|-------|-------------|---------------------|------------|
| 76 | `multiFormatData: any` | `MultiFormatData` (interface) | Moyenne |
| 207 | `data: any` | `Partial<GraphData>` | Faible |
| 340 | `data: any` | `unknown` avec type guard | Moyenne |
| 364 | `item: any` | `unknown` avec type guard | Moyenne |
| 449 | `meta?: any` | `ChatMessageMeta` (interface) | Faible |
| 483 | `sections: any[]` | `PDFSection[]` (déjà défini) | Faible |
| 488 | `currentSection: any` | `Partial<PDFSection>` | Faible |

**Action:** Créer interfaces pour toutes les structures de données parsées

---

### 🟡 Priorité HAUTE (Fréquence élevée)

#### 4. `apps/main/src/services/core/fileUploadService.ts` (2 occurrences)
**Impact:** Upload de fichiers, utilisé souvent
**Risque:** Erreurs non typées

| Ligne | Type actuel | Remplacement proposé | Complexité |
|-------|-------------|---------------------|------------|
| 500 | `(error as any)?.code` | `ErrorWithCode` type | Faible |

**Action:** Créer type `ErrorWithCode` avec propriété `code?: string`

---

#### 5. `packages/shared/src/types/index.ts` (13 occurrences)
**Impact:** Types partagés, utilisés dans main et admin
**Risque:** Incohérences entre apps

Même structure que `apps/main/src/types/index.ts`

---

### 🟢 Priorité MOYENNE (Fréquence moyenne)

#### 6. Hooks UniversWizardProgress (5 occurrences)
**Fichiers:**
- `apps/main/src/hooks/univers/useUniversWizardProgress.ts`
- `packages/shared/src/hooks/useUniversWizardProgress.ts`

| Type actuel | Remplacement proposé |
|-------------|---------------------|
| `forms?: any[]` | `FormDefinition[]` |
| `dashboards?: any[]` | `DashboardDefinition[]` |
| `instructions?: any[]` | `InstructionDefinition[]` |
| `lists?: any[]` | `ListDefinition[]` |
| `reports?: any[]` | `ReportDefinition[]` |

**Action:** Utiliser types déjà définis dans `types/index.ts`

---

#### 7. Services avec metadata dynamiques
**Fichiers multiples avec `[key: string]: any`**

**Stratégie:** Remplacer par `Record<string, unknown>` puis typer progressivement les clés connues

---

### ⚪ Priorité BASSE (Fréquence faible ou tests)

#### 8. Fichiers de tests
**Stratégie:** Garder `any` dans les tests pour flexibilité, ou utiliser `unknown` avec type guards

#### 9. Utils avec types dynamiques
**Stratégie:** Typer progressivement selon usage

---

## Plan d'implémentation

### Étape 1: Créer helpers et types de base
1. Créer `toDate()` helper dans `packages/shared/src/utils/dateHelpers.ts`
2. Créer types `ErrorWithCode`, `FirebaseError` dans `packages/shared/src/types/errors.ts`
3. Créer interfaces pour parsing dans `apps/main/src/utils/core/ResponseParser.ts`

### Étape 2: Remplacer types critiques (Phase 4.2-4.5)
1. `types/index.ts` - Timestamps et metadata
2. `firebaseErrorHandler.ts` - Toutes les erreurs
3. `ResponseParser.ts` - Structures de données
4. `fileUploadService.ts` - Erreurs

### Étape 3: Remplacer types haute priorité (Phase 4.6)
1. UniversWizardProgress
2. ListRow
3. Metadata objects dans services

### Étape 4: Validation (Phase 4.7)
1. Compilation TypeScript sans erreur
2. Tests fonctionnels
3. Vérifier <50 `any` restants

---

## Types à créer

### Helpers
```typescript
// packages/shared/src/utils/dateHelpers.ts
export function toDate(value: Date | Timestamp | null | undefined): Date | null;
export function toTimestamp(value: Date | Timestamp | null | undefined): Timestamp | null;
```

### Types d'erreurs
```typescript
// packages/shared/src/types/errors.ts
export interface ErrorWithCode extends Error {
  code?: string;
}

export type FirebaseErrorType = Error | FirebaseError | ErrorWithCode | unknown;
```

### Types de données
```typescript
// Pour ResponseParser
interface MultiFormatData {
  graphData?: GraphData;
  tableData?: string;
  pdfContent?: string;
}

interface ChatMessageMeta {
  period?: string;
  usedEntries?: number;
  forms?: number;
  users?: number;
  tokensUsed?: number;
  model?: string;
  selectedFormat?: string | null;
  selectedFormats?: string[];
  selectedFormIds?: string[];
  selectedFormTitles?: string[];
}
```

---

## Métriques de progression

- **Avant:** 613 `any`
- **Objectif:** <50 `any`
- **Réduction cible:** 92%

**Checkpoints:**
- Après Phase 4.2-4.5: <200 `any` (types critiques)
- Après Phase 4.6: <100 `any` (types haute priorité)
- Après Phase 4.7: <50 `any` (validation finale)

---

## Notes importantes

1. **Timestamps Firestore:** Utiliser `Date | Timestamp` partout, convertir avec `toDate()` quand nécessaire
2. **Metadata dynamiques:** Commencer par `Record<string, unknown>`, typer progressivement les clés connues
3. **Tests:** Garder flexibilité dans les tests, utiliser `unknown` avec guards si nécessaire
4. **Rétrocompatibilité:** S'assurer que les changements ne cassent pas le code existant

