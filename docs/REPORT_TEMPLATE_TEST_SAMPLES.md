# Report Template Test Samples

## How the Report Template System Works

### Simple Flow Explanation

When you create a report, you have 3 options for entering your template:

#### **Option 1: Text Editor (Éditeur de texte)**

**How it works:**
1. **You type** in a rich text editor (like Microsoft Word)
   - You can use formatting: bold, italic, headings, colors, lists, etc.
   - The text is stored as HTML in the system

2. **Placeholder detection happens automatically:**
   - As you type, the system watches for `{{placeholder}}` patterns
   - Example: If you type `Le total est {{totalVentes}}`
   - The system finds `{{totalVentes}}` and creates a placeholder object

3. **The system extracts placeholders:**
   - It looks through your HTML content
   - Finds all text that matches the pattern `{{something}}`
   - Creates a list of unique placeholders
   - Shows them in the "Placeholders détectés" section

4. **You map placeholders:**
   - Click "Mapper" on each placeholder
   - Choose which form field or dashboard metric it should use
   - Save the mapping

**What gets saved:**
- The full HTML content of your template
- List of placeholders found
- Mappings connecting placeholders to data sources

---

#### **Option 2: PDF Document**

**How it works:**
1. **You upload a PDF file:**
   - Click "Sélectionner un fichier PDF"
   - Choose your PDF document
   - The file uploads and shows progress

2. **Text extraction happens automatically:**
   - The system uses `PDFTextExtractionService` to read your PDF
   - It extracts all text from the PDF
   - Cleans up the text (removes extra spaces, fixes line breaks)

3. **Placeholder detection:**
   - The system scans the extracted text
   - Finds all `{{placeholder}}` patterns
   - Creates placeholder objects just like with the text editor

4. **You can see the extracted text:**
   - A preview shows the first 1000 characters of extracted text
   - This helps you verify the extraction worked correctly

5. **You map placeholders:**
   - Same as text editor - click "Mapper" and choose data sources

**What gets saved:**
- The PDF file (stored in Firebase Storage)
- The extracted text (for reference)
- List of placeholders found in the extracted text
- Mappings connecting placeholders to data sources

---

#### **Option 3: Word Document**

**How it works:**
1. **You upload a Word file (.doc or .docx):**
   - Click "Sélectionner un fichier Word"
   - Choose your Word document
   - The file uploads

2. **Note:** Currently, Word file text extraction is not fully implemented
   - The file is stored for future use
   - For now, you would need to manually type the content or use PDF instead

3. **Future implementation:**
   - Similar to PDF - extract text from Word
   - Find placeholders in extracted text
   - Map placeholders to data sources

**What gets saved:**
- The Word file (stored in Firebase Storage)
- List of placeholders (once text extraction is implemented)
- Mappings connecting placeholders to data sources

---

## How Placeholder Detection Works

### The Pattern Matching

The system looks for this pattern: `{{placeholderName}}`

**Rules:**
- Must have double curly braces: `{{` and `}}`
- The name inside can be anything: `{{nomClient}}`, `{{total}}`, `{{dateRapport}}`
- Spaces are allowed and ignored: `{{total}}` or `{{ total }}` both work
- Case-sensitive: `{{Total}}` and `{{total}}` are different placeholders
- Duplicates are removed: If you use `{{total}}` 3 times in your template, it creates 1 placeholder (you map it once)
- Valid examples: `{{nom}}`, `{{ nom }}`, `{{nomClient}}`, `{{total_ventes}}`
- Invalid examples: `{nom}` (single braces), `{{nom}` (missing closing brace), `{{}}` (empty)

### Example Flow

**Step 1 - You type/create content:**
```
Rapport Mensuel

Client: {{nomClient}}
Date: {{dateRapport}}
Total des ventes: {{totalVentes}}
Moyenne quotidienne: {{moyenneQuotidienne}}
```

**Step 2 - System detects placeholders:**
- Finds: `{{nomClient}}`
- Finds: `{{dateRapport}}`
- Finds: `{{totalVentes}}`
- Finds: `{{moyenneQuotidienne}}`

**Step 3 - System creates placeholder objects:**
- Each placeholder gets a unique ID
- Each has a position number in the document
- Each is ready to be mapped

**Step 4 - You map each placeholder:**
- Click "Mapper" on `{{nomClient}}`
- Choose: Source = Form, Form = "Formulaire Clients", Field = "Nom"
- Save the mapping

**Step 5 - When report is generated:**
- System finds `{{nomClient}}` in template
- Looks up the mapping
- Finds the actual data from the form
- Replaces `{{nomClient}}` with the real name (e.g., "John Doe")

---

## Test Samples

Use these samples to test the report template system. Copy and paste them into the editor, PDF, or Word document.

### Sample 1: Simple Sales Report

**Use this for:**
- Testing basic placeholder detection
- Testing form field mappings
- Simple report structure

**Text to use:**

```
RAPPORT DE VENTES MENSUEL

Période: {{periodeRapport}}
Date de génération: {{dateGeneration}}

RÉSUMÉ DES VENTES
-----------------

Total des ventes: {{totalVentes}} FCFA
Nombre de transactions: {{nombreTransactions}}
Moyenne par transaction: {{moyenneTransaction}} FCFA

VENTES PAR CATÉGORIE
----------------------

Ventes Électroniques: {{ventesElectroniques}} FCFA
Ventes Alimentaires: {{ventesAlimentaires}} FCFA
Ventes Vêtements: {{ventesVetements}} FCFA

TOP PRODUITS
------------

Produit 1: {{produit1Nom}} - {{produit1Ventes}} FCFA
Produit 2: {{produit2Nom}} - {{produit2Ventes}} FCFA
Produit 3: {{produit3Nom}} - {{produit3Ventes}} FCFA

STATISTIQUES
------------

Client le plus actif: {{clientActif}}
Jour le plus rentable: {{jourRentable}}
Heure de pointe: {{heurePointe}}

Généré par: {{nomUtilisateur}}
Agence: {{nomAgence}}
```

**Placeholders to expect (8 unique):**
1. `{{periodeRapport}}`
2. `{{dateGeneration}}`
3. `{{totalVentes}}`
4. `{{nombreTransactions}}`
5. `{{moyenneTransaction}}`
6. `{{ventesElectroniques}}`
7. `{{ventesAlimentaires}}`
8. `{{ventesVetements}}`
9. `{{produit1Nom}}`
10. `{{produit1Ventes}}`
11. `{{produit2Nom}}`
12. `{{produit2Ventes}}`
13. `{{produit3Nom}}`
14. `{{produit3Ventes}}`
15. `{{clientActif}}`
16. `{{jourRentable}}`
17. `{{heurePointe}}`
18. `{{nomUtilisateur}}`
19. `{{nomAgence}}`

---

### Sample 2: Client Management Report

**Use this for:**
- Testing multiple form fields
- Testing dashboard metrics
- Mixing different data sources

**Text to use:**

```
RAPPORT DE GESTION DES CLIENTS
==============================

INFORMATIONS GÉNÉRALES
----------------------

Nom du client: {{nomClient}}
Email: {{emailClient}}
Téléphone: {{telephoneClient}}
Adresse: {{adresseClient}}
Date d'inscription: {{dateInscription}}

STATISTIQUES CLIENT
-------------------

Total des commandes: {{totalCommandes}}
Montant total dépensé: {{montantTotal}} FCFA
Commande moyenne: {{commandeMoyenne}} FCFA
Dernière commande: {{derniereCommande}}

ACTIVITÉ RÉCENTE
----------------

Commandes ce mois: {{commandesMois}} 
Commandes ce trimestre: {{commandesTrimestre}}
Commandes cette année: {{commandesAnnee}}

STATUT
------

Type de client: {{typeClient}}
Niveau de fidélité: {{niveauFidelite}}
Statut actuel: {{statutClient}}

RÉFÉRENCES
----------

ID Client: {{idClient}}
Numéro de compte: {{numeroCompte}}
Responsable commercial: {{responsableCommercial}}

Date du rapport: {{dateRapport}}
```

**Placeholders to expect (19 unique):**
1. `{{nomClient}}`
2. `{{emailClient}}`
3. `{{telephoneClient}}`
4. `{{adresseClient}}`
5. `{{dateInscription}}`
6. `{{totalCommandes}}`
7. `{{montantTotal}}`
8. `{{commandeMoyenne}}`
9. `{{derniereCommande}}`
10. `{{commandesMois}}`
11. `{{commandesTrimestre}}`
12. `{{commandesAnnee}}`
13. `{{typeClient}}`
14. `{{niveauFidelite}}`
15. `{{statutClient}}`
16. `{{idClient}}`
17. `{{numeroCompte}}`
18. `{{responsableCommercial}}`
19. `{{dateRapport}}`

---

### Sample 3: Financial Summary Report

**Use this for:**
- Testing calculations (sum, average, count)
- Testing dashboard metrics
- Complex report structure

**Text to use:**

```
RAPPORT FINANCIER MENSUEL
==========================

PERFORMANCE FINANCIÈRE
----------------------

Revenus totaux: {{revenusTotaux}} FCFA
Dépenses totales: {{depensesTotales}} FCFA
Bénéfice net: {{beneficeNet}} FCFA
Marge bénéficiaire: {{margeBeneficiaire}}%

REVENUS PAR SOURCE
-------------------

Ventes produits: {{revenusProduits}} FCFA
Services: {{revenusServices}} FCFA
Abonnements: {{revenusAbonnements}} FCFA
Autres: {{revenusAutres}} FCFA

DÉPENSES PAR CATÉGORIE
----------------------

Salaires: {{depensesSalaires}} FCFA
Frais opérationnels: {{depensesOperationnels}} FCFA
Marketing: {{depensesMarketing}} FCFA
Infrastructure: {{depensesInfrastructure}} FCFA

INDICATEURS CLÉS
-----------------

Croissance mensuelle: {{croissanceMensuelle}}%
Nombre de clients: {{nombreClients}}
Taux de rétention: {{tauxRetention}}%
Satisfaction client: {{satisfactionClient}}/10

COMPARAISON
-----------

Mois précédent: {{moisPrecedent}} FCFA
Mois actuel: {{moisActuel}} FCFA
Évolution: {{evolution}}%

PRÉVISIONS
----------

Projection prochain mois: {{projectionProchainMois}} FCFA
Objectif trimestriel: {{objectifTrimestriel}} FCFA
Progression vers objectif: {{progressionObjectif}}%

Rapport généré le {{dateGeneration}} par {{nomUtilisateur}}
```

**Placeholders to expect (22 unique):**
1. `{{revenusTotaux}}`
2. `{{depensesTotales}}`
3. `{{beneficeNet}}`
4. `{{margeBeneficiaire}}`
5. `{{revenusProduits}}`
6. `{{revenusServices}}`
7. `{{revenusAbonnements}}`
8. `{{revenusAutres}}`
9. `{{depensesSalaires}}`
10. `{{depensesOperationnels}}`
11. `{{depensesMarketing}}`
12. `{{depensesInfrastructure}}`
13. `{{croissanceMensuelle}}`
14. `{{nombreClients}}`
15. `{{tauxRetention}}`
16. `{{satisfactionClient}}`
17. `{{moisPrecedent}}`
18. `{{moisActuel}}`
19. `{{evolution}}`
20. `{{projectionProchainMois}}`
21. `{{objectifTrimestriel}}`
22. `{{progressionObjectif}}`
23. `{{dateGeneration}}`
24. `{{nomUtilisateur}}`

---

### Sample 4: Minimal Test (Quick Testing)

**Use this for:**
- Quick placeholder detection test
- Testing basic functionality
- Minimal template

**Text to use:**

```
Test Report

Nom: {{nom}}
Total: {{total}}
Date: {{date}}
```

**Placeholders to expect (3 unique):**
1. `{{nom}}`
2. `{{total}}`
3. `{{date}}`

---

## How to Use These Samples

### For Text Editor:
1. Copy any sample text above
2. Paste it into the rich text editor
3. You can format it (make headings bold, add colors, etc.)
4. The system will automatically detect placeholders
5. Check the "Placeholders détectés" section to see them listed

### For PDF:
1. Create a PDF document
2. Paste any sample text into the PDF
3. Save the PDF
4. Upload it using the file uploader
5. The system will extract text and find placeholders automatically

### For Word Document:
1. Create a Word document (.doc or .docx)
2. Paste any sample text into the Word document
3. Save the Word file
4. Upload it using the file uploader
5. (Note: Full text extraction for Word is pending implementation)

---

## Tips for Testing

1. **Start simple:** Use Sample 4 first to verify basic functionality

2. **Test placeholder detection:**
   - Type placeholders correctly: `{{nom}}` ✅
   - Spaces are fine: `{{ nom }}` ✅ (system removes spaces)
   - Don't forget double braces: `{nom}` ❌ won't work
   - Must close properly: `{{nom}` ❌ won't work
   - Check for case sensitivity: `{{Nom}}` ≠ `{{nom}}` (these are 2 different placeholders)

3. **Test mapping:**
   - Try mapping to different form fields
   - Try mapping to dashboard metrics
   - Test with different calculation types (sum, average, count)

4. **Test formatting:**
   - In the text editor, try different formatting (bold, headings, colors)
   - Verify placeholders still work after formatting
   - Check that placeholders are preserved when you save

5. **Test file upload:**
   - Try uploading a simple PDF with placeholders
   - Verify the extracted text shows all placeholders
   - Check that placeholder detection works from PDF text

---

## Common Issues and Solutions

### Issue: Placeholders not detected

**Solution:**
- Make sure you use double curly braces: `{{placeholder}}`
- Check for typos in the placeholder name
- Verify the text/PDF contains actual `{{}}` characters (not styled differently)

### Issue: Placeholders detected but can't map

**Solution:**
- Make sure you have at least one form or dashboard created
- Check that the form/dashboard has fields or metrics
- Try refreshing the page

### Issue: Formatting lost when saving

**Solution:**
- In text editor, formatting is saved as HTML
- PDF/Word files preserve formatting in the original file
- When generating reports, formatting may need to be reapplied

---

## Notes

- **Placeholder syntax is case-sensitive:** `{{Total}}` and `{{total}}` are different
- **Placeholders must be unique:** If you use `{{total}}` 10 times, it creates 1 placeholder to map
- **HTML in text editor:** The rich text editor stores content as HTML, but placeholders still work
- **PDF text extraction:** Uses PDF.js library to read PDF content
- **Word extraction:** Currently stores file only, full text extraction coming soon

