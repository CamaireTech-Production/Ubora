# Graph Field Validation Examples

## How the Smart Field Validation System Works

### **Problem Solved:**
Previously, users could select any field for Y-axis calculations, but mathematical operations (sum, average, min, max) would fail or produce incorrect results with non-numeric fields.

### **Solution Implemented:**
A comprehensive validation system that:
1. **Prevents invalid selections** by filtering available fields
2. **Shows clear error messages** when invalid combinations occur
3. **Provides helpful guidance** to users

---

## **Field Type Compatibility Matrix**

| Field Type | Count | Sum | Average | Min | Max | Unique |
|------------|-------|-----|---------|-----|-----|--------|
| **text** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **email** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **textarea** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **select** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **checkbox** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **date** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **file** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **number** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **calculated** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## **Real-World Examples**

### **Example 1: Employee Performance Dashboard**
**Scenario:** You want to show average performance ratings by department.

**Form Fields:**
- `department` (select): "Sales", "Marketing", "IT"
- `performance_rating` (number): 1-10 scale
- `employee_name` (text): "John Doe"

**Valid Configuration:**
- **X-axis:** `department` (field) - Groups by department
- **Y-axis:** `performance_rating` (field) with `average` calculation
- **Result:** Shows average rating for each department

**What happens if you try to use `employee_name` for Y-axis with `average`:**
- ❌ **Error:** "Le champ 'employee_name' (text) ne peut pas être utilisé pour la moyenne"
- 💡 **Suggestion:** "Seuls les champs numériques (number, calculated) supportent les opérations mathématiques"
- 🔧 **Solutions:**
  1. Use "Nombre de soumissions" to count employees
  2. Select a numeric field for calculations
  3. Change calculation type to "count" or "unique"

### **Example 2: Sales Analysis**
**Scenario:** You want to show total sales by product category.

**Form Fields:**
- `product_category` (select): "Electronics", "Clothing", "Books"
- `sales_amount` (number): Dollar amounts
- `customer_feedback` (textarea): Text feedback

**Valid Configuration:**
- **X-axis:** `product_category` (field)
- **Y-axis:** `sales_amount` (field) with `sum` calculation
- **Result:** Shows total sales for each category

**What happens if you try to use `customer_feedback` for Y-axis with `sum`:**
- ❌ **Error:** "Le champ 'customer_feedback' (textarea) ne peut pas être utilisé pour la somme"
- 💡 **Suggestion:** "Seuls les champs numériques (number, calculated) supportent les opérations mathématiques"

### **Example 3: Survey Response Analysis**
**Scenario:** You want to count responses by satisfaction level.

**Form Fields:**
- `satisfaction_level` (select): "Very Satisfied", "Satisfied", "Neutral", "Dissatisfied"
- `response_text` (textarea): Detailed feedback
- `rating` (number): 1-5 scale

**Valid Configurations:**
1. **Count responses by satisfaction:**
   - **X-axis:** `satisfaction_level` (field)
   - **Y-axis:** `count` (any field works)
   - **Result:** Number of responses per satisfaction level

2. **Average rating by satisfaction:**
   - **X-axis:** `satisfaction_level` (field)
   - **Y-axis:** `rating` (field) with `average` calculation
   - **Result:** Average rating for each satisfaction level

---

## **User Experience Improvements**

### **Before (Problematic):**
1. User selects text field for Y-axis
2. User chooses "sum" calculation
3. Graph shows incorrect data (0 or NaN)
4. User is confused about why it doesn't work

### **After (Smart Validation):**
1. User selects text field for Y-axis
2. System automatically filters out "sum", "average", "min", "max" options
3. Only "count" and "unique" are available
4. Clear help text explains why: "💡 Tous les champs sont disponibles pour le comptage"
5. If user somehow selects invalid combination, comprehensive error message appears

---

## **Error Message Examples**

### **For Text Fields with Sum:**
```
⚠️ Le champ "customer_name" (text) ne peut pas être utilisé pour la somme.

Seuls les champs numériques (number, calculated) supportent les opérations mathématiques.

Suggestions :
1. Utilisez "Nombre de soumissions" pour compter les réponses
2. Sélectionnez un champ numérique pour effectuer des calculs
3. Changez le type de calcul vers "count" ou "unique"
```

### **For Date Fields with Average:**
```
⚠️ Le champ "birth_date" (date) ne peut pas être utilisé pour la moyenne.

Seuls les champs numériques (number, calculated) supportent les opérations mathématiques.

Suggestions :
1. Utilisez "Nombre de soumissions" pour compter les réponses
2. Sélectionnez un champ numérique pour effectuer des calculs
3. Changez le type de calcul vers "count" ou "unique"
```

---

## **Help Text Examples**

### **For Numeric Calculations:**
```
💡 Seuls les champs numériques sont disponibles pour la somme
💡 Seuls les champs numériques sont disponibles pour la moyenne
💡 Seuls les champs numériques sont disponibles pour le minimum
💡 Seuls les champs numériques sont disponibles pour le maximum
```

### **For Count/Unique Calculations:**
```
💡 Tous les champs sont disponibles pour le comptage
💡 Tous les champs sont disponibles pour les valeurs uniques
```

---

## **Technical Implementation**

The validation system uses:
- **Field type checking:** `isNumericFieldType()`
- **Calculation validation:** `validateYAxisField()`
- **Field filtering:** `getValidYAxisFields()`
- **Error messaging:** `getFieldValidationErrorMessage()`

This ensures a smooth, intuitive user experience while preventing data integrity issues.
