# 🚀 UBORA Features Implementation Plan

## 📋 Overview

This document presents the 5 main features to implement, ranked by increasing complexity for optimal implementation within the day.

---

## 🎯 1. 🟢 SIMPLEST - Package System and Access Control

### **Description**
Implementation of a package system that determines which features are accessible based on the director's subscribed plan. The system will check the active package and hide/show features accordingly. A minimal admin dashboard will allow manual activation/deactivation of certain features, or a configuration file will define features by package to facilitate changes without major infrastructure modifications.

### **Current State**
- ✅ Package structure defined in `PACKAGES.md`
- ❌ No package-based access control system
- ❌ No `package` field in the `User` interface

### **Complexity: LOW** ⭐⭐
**Estimated time: 2-3 hours**

### **Implementation**
1. **Add package field to User interface**
   ```typescript
   export interface User {
     // ... existing fields
     package: 'starter' | 'standard' | 'premium' | 'custom';
     packageFeatures?: string[]; // Activated features
   }
   ```

2. **Create feature configuration file**
   ```typescript
   // src/config/packageFeatures.ts
   export const PACKAGE_FEATURES = {
     starter: ['basic_forms', 'basic_dashboard', 'basic_metrics'],
     standard: ['unlimited_forms', 'unlimited_dashboards', 'advanced_metrics'],
     premium: ['custom_branding', 'advanced_ai', 'priority_support'],
     custom: ['all_features']
   };
   ```

3. **Create access control hooks**
   ```typescript
   // src/hooks/usePackageAccess.ts
   export const usePackageAccess = (feature: string) => {
     const { user } = useAuth();
     return hasPackageAccess(user?.package, feature);
   };
   ```

4. **Modify components to hide/show based on package**
   - Add conditions in components
   - Hide buttons/features not available

---

## 🎯 2. 🟡 SIMPLE - Chart Generation for Dashboards

### **Description**
Chart and table generation system for custom dashboards. Metrics can generate charts based on elements chosen by the director from their form fields.

### **Current State**
- ✅ Basic metrics system functional
- ✅ Simple card display of metrics
- ❌ No charts generated

### **Complexity: LOW TO MEDIUM** ⭐⭐⭐
**Estimated time: 3-4 hours**

### **Implementation**
1. **Install chart library**
   ```bash
   npm add recharts
   ```

2. **Extend DashboardMetric interface**
   ```typescript
   export interface DashboardMetric {
     // ... existing fields
     chartType?: 'bar' | 'line' | 'pie' | 'area';
     chartConfig?: {
       xAxis?: string;
       yAxis?: string;
       colors?: string[];
     };
   }
   ```

3. **Create chart components**
   ```typescript
   // src/components/charts/MetricChart.tsx
   export const MetricChart: React.FC<{ metric: DashboardMetric; data: any[] }> = ({ metric, data }) => {
     // Conditional rendering based on chart type
   };
   ```

4. **Modify DashboardDisplay to include charts**
   - Add chart configuration options
   - Integrate chart components

---

## 🎯 3. 🟡 MEDIUM - Calculated Fields in Forms

### **Description**
Implementation of calculated fields in forms that update automatically based on other fields in the same form or constants. Support for all available mathematical operations. Calculated fields update in real-time during input.

### **Current State**
- ✅ Robust dynamic forms system
- ✅ Basic field types supported
- ❌ No calculated fields implemented

### **Complexity: MEDIUM** ⭐⭐⭐⭐
**Estimated time: 4-5 hours**

### **Implementation**
1. **Extend FormField interface**
   ```typescript
   export interface FormField {
     // ... existing fields
     type: 'text' | 'number' | 'email' | 'textarea' | 'select' | 'checkbox' | 'date' | 'file' | 'calculated';
     calculationFormula?: string; // Ex: "field1 + field2 * 0.2"
     dependsOn?: string[]; // IDs of fields this field depends on
   }
   ```

2. **Create expression calculation engine**
   ```typescript
   // src/utils/ExpressionCalculator.ts
   export class ExpressionCalculator {
     static evaluate(formula: string, values: Record<string, any>): number {
       // Parse and evaluate mathematical expressions
     }
   }
   ```

3. **Modify DynamicForm to handle calculated fields**
   - Add real-time recalculation logic
   - Handle dependencies between fields
   - Update values automatically

4. **Add formula configuration interface**
   - Formula editor in FormBuilder
   - Formula validation
   - Result preview

---

## 🎯 4. 🔴 COMPLEX - Advanced Metrics with Custom Calculations

### **Description**
Extension of the metrics system to include fixed metrics and custom calculated metrics. Calculations can combine 2 or more form fields or combine fields with constants. Support for mathematical operations (addition, multiplication, subtraction, etc.), statistical metrics (max, min, average, percentages), and complex filters. Use of custom short codes for each field to facilitate operations and make the system user-friendly for directors.

### **Current State**
- ✅ Basic metrics system with simple calculations
- ✅ Support for calculation types: count, sum, average, min, max, unique
- ❌ No multi-field calculations
- ❌ No complex filters
- ❌ No short codes for fields

### **Complexity: HIGH** ⭐⭐⭐⭐⭐
**Estimated time: 6-8 hours**

### **Implementation**
1. **Refactor DashboardMetric interface**
   ```typescript
   export interface DashboardMetric {
     // ... existing fields
     calculationType: 'count' | 'sum' | 'average' | 'min' | 'max' | 'unique' | 'custom';
     customFormula?: string; // Ex: "SUM(field1) + AVG(field2) * 0.1"
     fieldCodes?: Record<string, string>; // Short codes for fields
     filters?: MetricFilter[];
     multiField?: boolean;
     fields?: string[]; // IDs of involved fields
   }
   ```

2. **Create advanced mathematical expression system**
   ```typescript
   // src/utils/AdvancedMetricCalculator.ts
   export class AdvancedMetricCalculator {
     static calculateCustomMetric(metric: DashboardMetric, formEntries: FormEntry[]): MetricResult {
       // Support for complex formulas
       // Filter management
       // Multi-field calculations
     }
   }
   ```

3. **Develop visual formula editor**
   - Drag-and-drop interface for formulas
   - Field code autocompletion
   - Real-time validation

4. **Implement short code system**
   - Automatic code generation
   - Code management interface
   - Integrated documentation

---

## 🎯 5. 🔴 MOST COMPLEX - Role Management Based on Access Levels

### **Description**
Advanced role management system where a director can assign custom roles to employees with access levels (L1, L2, L3, etc.). Each level determines specific permissions (form creation, validation of other employees, etc.). An employee can have their base role plus additional access levels. Possibility to create custom access levels.

### **Current State**
- ✅ Basic role system (director/employee)
- ✅ Firestore rules for basic roles
- ✅ Basic access control components
- ❌ No access levels
- ❌ No custom roles

### **Complexity: VERY HIGH** ⭐⭐⭐⭐⭐⭐
**Estimated time: 8-10 hours**

### **Implementation**
1. **Completely refactor User interface**
   ```typescript
   export interface User {
     // ... existing fields
     role: 'directeur' | 'employe';
     accessLevels: AccessLevel[];
     customRoles: CustomRole[];
     permissions: Permission[];
   }
   
   export interface AccessLevel {
     id: string;
     name: string;
     level: number; // L1, L2, L3, etc.
     permissions: string[];
   }
   
   export interface CustomRole {
     id: string;
     name: string;
     description: string;
     permissions: string[];
     createdBy: string;
   }
   ```

2. **Refactor all Firestore rules**
   - Complex rules based on access levels
   - Granular permission verification
   - Custom role management

3. **Create granular permission system**
   ```typescript
   // src/utils/PermissionManager.ts
   export class PermissionManager {
     static hasPermission(user: User, permission: string): boolean {
       // Permission verification based on levels
     }
   }
   ```

4. **Develop role management interface**
   - Custom role creation
   - Access level assignment
   - Permission management

5. **Update all access control components**
   - ProtectedRoute refactoring
   - Navigation component updates
   - Permission management in UI

---

## 📊 Complexity Summary

| Feature | Complexity | Time | Priority | Impact |
|---|---|---|---|---|
| **Package System** | ⭐⭐ | 2-3h | 🔥 High | Immediate |
| **Charts** | ⭐⭐⭐ | 3-4h | 🔥 High | UX |
| **Calculated Fields** | ⭐⭐⭐⭐ | 4-5h | 🔶 Medium | Functional |
| **Advanced Metrics** | ⭐⭐⭐⭐⭐ | 6-8h | 🔶 Medium | Premium |
| **Advanced Roles** | ⭐⭐⭐⭐⭐⭐ | 8-10h | 🔸 Low | Infrastructure |

---

## 🚀 Recommended Implementation Strategy

### **Phase 1 (Morning - 4-6h)**
1. ✅ **Package System** - Immediate impact, foundation for other features
2. ✅ **Charts** - Improves existing user experience

### **Phase 2 (Afternoon - 4-6h)**
3. ✅ **Calculated Fields** - Adds value to forms
4. 🔄 **Advanced Metrics** - Start implementation (part 1)

### **Phase 3 (If time available)**
5. 🔄 **Advanced Metrics** - Finalize (part 2)
6. 🔄 **Advanced Roles** - Start if possible

---

## ⚠️ Important Notes

- **Complexities are based on analysis of existing code**
- **Package system is the foundation for all other features**
- **Charts can be implemented in parallel with package system**
- **Advanced roles require major refactoring and can be postponed**
- **Each feature is independent and can be tested separately**

---

## 🎯 Day's Objective

**Realistic:** Implement the first 3 features (Packages + Charts + Calculated Fields)  
**Optimistic:** Add Advanced Metrics  
**Ideal:** Start Advanced Roles

**Total estimated: 9-12 hours of development**
