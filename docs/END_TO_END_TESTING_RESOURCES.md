# 🧪 End-to-End Testing Resources Guide

This document provides a comprehensive list of accounts, forms, and resources you should create in the UBORA application to test all functionalities end-to-end.

**Last Updated:** 2024-12-19  
**Purpose:** Complete test data setup for comprehensive functionality testing

---

## 📋 Table of Contents

1. [User Accounts](#user-accounts)
2. [Packages & Subscriptions](#packages--subscriptions)
3. [Lists](#lists)
4. [Forms](#forms)
5. [Dashboards](#dashboards)
6. [Univers Templates](#univers-templates)
7. [Scheduled Questions](#scheduled-questions)
8. [Reports](#reports)
9. [Form Entries (Submissions)](#form-entries-submissions)
10. [Testing Scenarios](#testing-scenarios)

---

## 👥 User Accounts

### 1. Admin Account
**Purpose:** Test admin panel functionality

- **Email:** `admin@ubora.test`
- **Password:** `Admin123!@#`
- **Role:** `admin`
- **Name:** Admin User
- **Agency:** N/A (admin doesn't belong to an agency)

**Test Scenarios:**
- User management
- System monitoring
- Analytics access
- Settings management

---

### 2. Director Accounts

#### Director 1 - Free Package
**Purpose:** Test free package limitations and features

- **Email:** `director1@ubora.test`
- **Password:** `Director123!@#`
- **Role:** `directeur`
- **Name:** Director Free
- **Agency:** Agency Free Test
- **Package:** `free`
- **Expected Limits:**
  - Max 2 forms
  - Max 1 dashboard
  - 25,000 monthly tokens
  - No file uploads
  - No Excel export

#### Director 2 - Starter Package
**Purpose:** Test starter package features

- **Email:** `director2@ubora.test`
- **Password:** `Director123!@#`
- **Role:** `directeur`
- **Name:** Director Starter
- **Agency:** Agency Starter Test
- **Package:** `starter`
- **Expected Limits:**
  - Max 4 forms
  - Max 2 dashboards
  - 100,000 monthly tokens
  - File uploads enabled
  - Programmed instructions enabled

#### Director 3 - Standard Package
**Purpose:** Test unlimited features

- **Email:** `director3@ubora.test`
- **Password:** `Director123!@#`
- **Role:** `directeur`
- **Name:** Director Standard
- **Agency:** Agency Standard Test
- **Package:** `standard`
- **Expected Limits:**
  - Unlimited forms
  - Unlimited dashboards
  - 300,000 monthly tokens
  - All features enabled

---

### 3. Employee Accounts

#### Employee 1 - Basic Access
**Purpose:** Test basic employee functionality

- **Email:** `employee1@ubora.test`
- **Password:** `Employee123!@#`
- **Role:** `employe`
- **Name:** Employee Basic
- **Agency:** Agency Starter Test (same as Director 2)
- **Is Approved:** `true`
- **Access Levels:** `[]` (no special access)
- **Director Dashboard Access:** `false`

#### Employee 2 - With Director Dashboard Access
**Purpose:** Test employee with elevated permissions

- **Email:** `employee2@ubora.test`
- **Password:** `Employee123!@#`
- **Role:** `employe`
- **Name:** Employee Advanced
- **Agency:** Agency Standard Test (same as Director 3)
- **Is Approved:** `true`
- **Access Levels:** `['l2_director_access']`
- **Director Dashboard Access:** `true`

#### Employee 3 - Pending Approval
**Purpose:** Test employee approval workflow

- **Email:** `employee3@ubora.test`
- **Password:** `Employee123!@#`
- **Role:** `employe`
- **Name:** Employee Pending
- **Agency:** Agency Standard Test
- **Is Approved:** `false`
- **Access Levels:** `[]`

#### Employee 4 - Validator Access
**Purpose:** Test validator permissions

- **Email:** `employee4@ubora.test`
- **Password:** `Employee123!@#`
- **Role:** `employe`
- **Name:** Employee Validator
- **Agency:** Agency Standard Test
- **Is Approved:** `true`
- **Access Levels:** `['l3_validator']`
- **Director Dashboard Access:** `true`

---

## 📦 Packages & Subscriptions

### Test Package Selections

1. **Free Package** (Director 1)
   - Select during registration
   - Test package limits enforcement
   - Test upgrade prompts

2. **Starter Package** (Director 2)
   - Select during registration
   - Test mid-tier features
   - Test form/dashboard limits

3. **Standard Package** (Director 3)
   - Select during registration
   - Test unlimited features
   - Test all premium features

### Subscription Sessions to Create

For each director, create a subscription session:

```javascript
{
  userId: "director_id",
  agencyId: "agency_id",
  packageType: "free" | "starter" | "standard",
  status: "active",
  startDate: new Date(),
  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  tokensUsed: 0,
  tokensAllocated: 25000 | 100000 | 300000,
  resources: {
    formsCreated: 0,
    dashboardsCreated: 0,
    usersCreated: 0
  }
}
```

---

## 📊 Lists

### List 1: Product Categories
**Purpose:** Test dropdown lists in forms

- **Name:** Product Categories
- **Description:** List of product categories for inventory forms
- **Columns:**
  - `id` (text): Category ID
  - `name` (text): Category Name
  - `description` (text): Category Description
- **Sample Rows:**
  ```json
  [
    { "id": "cat1", "name": "Electronics", "description": "Electronic products" },
    { "id": "cat2", "name": "Clothing", "description": "Apparel and accessories" },
    { "id": "cat3", "name": "Food & Beverages", "description": "Food items" },
    { "id": "cat4", "name": "Books", "description": "Books and publications" }
  ]
  ```

### List 2: Employee Roles
**Purpose:** Test employee role selection

- **Name:** Employee Roles
- **Description:** List of employee roles
- **Columns:**
  - `id` (text): Role ID
  - `title` (text): Role Title
  - `department` (text): Department
- **Sample Rows:**
  ```json
  [
    { "id": "role1", "title": "Manager", "department": "Operations" },
    { "id": "role2", "title": "Sales Associate", "department": "Sales" },
    { "id": "role3", "title": "Accountant", "department": "Finance" }
  ]
  ```

### List 3: Locations
**Purpose:** Test location-based data

- **Name:** Branch Locations
- **Description:** List of branch locations
- **Columns:**
  - `id` (text): Location ID
  - `name` (text): Location Name
  - `address` (text): Full Address
  - `city` (text): City
- **Sample Rows:**
  ```json
  [
    { "id": "loc1", "name": "Downtown Branch", "address": "123 Main St", "city": "Yaoundé" },
    { "id": "loc2", "name": "Airport Branch", "address": "456 Airport Rd", "city": "Douala" }
  ]
  ```

### List 4: Payment Methods
**Purpose:** Test payment method selection

- **Name:** Payment Methods
- **Description:** Available payment methods
- **Columns:**
  - `id` (text): Method ID
  - `method` (text): Payment Method Name
  - `enabled` (boolean): Is Enabled
- **Sample Rows:**
  ```json
  [
    { "id": "pm1", "method": "Mobile Money", "enabled": true },
    { "id": "pm2", "method": "Bank Transfer", "enabled": true },
    { "id": "pm3", "method": "Cash", "enabled": true }
  ]
  ```

---

## 📝 Forms

### Form 1: Basic Inventory Form
**Purpose:** Test basic form functionality with simple fields

- **Title:** Inventory Entry
- **Description:** Basic inventory tracking form
- **Created By:** Director 2 (Starter package)
- **Assigned To:** Employee 1, Employee 2
- **Fields:**
  1. Product Name (text, required)
  2. Quantity (number, required)
  3. Unit Price (number, required)
  4. Category (select, required) - Use List 1 (Product Categories)
  5. Notes (textarea, optional)
  6. Date Received (date, required)

**Test Scenarios:**
- Form submission
- Required field validation
- Number field validation
- List-based dropdown
- Date picker

### Form 2: Sales Report Form
**Purpose:** Test calculated fields and conditional logic

- **Title:** Daily Sales Report
- **Description:** Daily sales tracking with calculations
- **Created By:** Director 3 (Standard package)
- **Assigned To:** Employee 2, Employee 4
- **Fields:**
  1. Sales Date (date, required)
  2. Salesperson Name (text, required)
  3. Product Sold (text, required)
  4. Quantity Sold (number, required)
  5. Unit Price (number, required)
  6. Discount (%) (number, optional, default: 0)
  7. **Total Amount** (calculated, required)
     - Formula: `(Quantity Sold * Unit Price) * (1 - Discount / 100)`
     - Type: `multiply` with percentage
  8. Payment Method (select, required) - Use List 4 (Payment Methods)
  9. Customer Name (text, optional)
  10. **Show Customer Details** (checkbox, optional)
  11. Customer Email (email, conditional)
     - Show when: "Show Customer Details" is checked
  12. Customer Phone (text, conditional)
     - Show when: "Show Customer Details" is checked

**Test Scenarios:**
- Calculated field formulas
- Conditional field visibility
- Multiple conditional rules (AND/OR)
- Email field validation

### Form 3: Employee Attendance Form
**Purpose:** Test file uploads and time restrictions

- **Title:** Employee Attendance
- **Description:** Track employee attendance with photo proof
- **Created By:** Director 3 (Standard package - file uploads enabled)
- **Assigned To:** Employee 1, Employee 2, Employee 3, Employee 4
- **Time Restrictions:**
  - Start Time: `08:00`
  - End Time: `18:00`
  - Allowed Days: `[1, 2, 3, 4, 5]` (Monday to Friday)
- **Deadline:**
  - Date: Next day
  - Time: `09:00`
  - Reminder Intervals: `[60, 30, 15]` minutes before deadline
- **Fields:**
  1. Employee Name (text, required)
  2. Check-in Time (date, required)
  3. Check-out Time (date, optional)
  4. Location (select, required) - Use List 3 (Branch Locations)
  5. Photo Proof (file, required)
     - Accepted Types: `[".jpg", ".jpeg", ".png"]`
  6. Notes (textarea, optional)
  7. Overtime Hours (number, optional)

**Test Scenarios:**
- File upload functionality
- File type validation
- Time restrictions enforcement
- Deadline notifications
- OCR text extraction from images

### Form 4: Expense Report Form
**Purpose:** Test complex calculations and multiple file uploads

- **Title:** Monthly Expense Report
- **Description:** Track monthly expenses with receipts
- **Created By:** Director 3
- **Assigned To:** Employee 2, Employee 4
- **Fields:**
  1. Report Month (date, required)
  2. Employee Name (text, required)
  3. Department (select, required) - Use List 2 (Employee Roles) - display "department" column
  4. **Expense Items** (repeating section):
     - Item Description (text, required)
     - Amount (number, required)
     - Receipt (file, optional) - Accepted: `[".pdf", ".jpg", ".png"]`
  5. **Subtotal** (calculated)
     - Formula: `SUM(all Amount fields)`
     - Type: `sum`
  6. **Tax (15%)** (calculated)
     - Formula: `Subtotal * 0.15`
     - Type: `percentage`
  7. **Total** (calculated)
     - Formula: `Subtotal + Tax`
     - Type: `simple`
  8. Approval Status (select, required)
     - Options: `["Pending", "Approved", "Rejected"]`

**Test Scenarios:**
- Multiple file uploads
- PDF text extraction
- Complex calculation chains
- Sum calculations across multiple fields
- Percentage calculations

### Form 5: Customer Feedback Form
**Purpose:** Test all field types and validation

- **Title:** Customer Feedback
- **Description:** Collect customer feedback
- **Created By:** Director 2
- **Assigned To:** All employees
- **Fields:**
  1. Customer Name (text, required)
  2. Customer Email (email, required)
  3. Visit Date (date, required)
  4. Service Rating (select, required)
     - Options: `["Excellent", "Good", "Average", "Poor"]`
  5. Would Recommend (checkbox, required)
  6. Comments (textarea, required)
  7. Contact Phone (text, optional)
  8. Follow-up Required (checkbox, optional)
  9. Follow-up Date (date, conditional)
     - Show when: "Follow-up Required" is checked

**Test Scenarios:**
- All field types
- Email validation
- Checkbox handling
- Conditional date fields

### Form 6: Simple Form (Free Package)
**Purpose:** Test free package form limit

- **Title:** Simple Test Form
- **Description:** Basic form for free package testing
- **Created By:** Director 1 (Free package - max 2 forms)
- **Assigned To:** Employee 1
- **Fields:**
  1. Name (text, required)
  2. Value (number, required)

**Test Scenarios:**
- Form limit enforcement (should allow max 2 forms)
- Package restriction testing

---

## 📈 Dashboards

### Dashboard 1: Sales Analytics Dashboard
**Purpose:** Test basic metrics and value displays

- **Name:** Sales Analytics
- **Description:** Track sales performance
- **Created By:** Director 3
- **Metrics:**
  1. **Total Sales** (value)
     - Source: Form 2 (Sales Report)
     - Field: Total Amount (calculated)
     - Calculation: `sum`
  2. **Average Sale** (value)
     - Source: Form 2 (Sales Report)
     - Field: Total Amount
     - Calculation: `average`
  3. **Number of Sales** (value)
     - Source: Form 2 (Sales Report)
     - Field: Sales Date
     - Calculation: `count`
  4. **Top Product** (value)
     - Source: Form 2 (Sales Report)
     - Field: Product Sold
     - Calculation: `unique`

**Test Scenarios:**
- Value metric display
- Sum calculations
- Average calculations
- Count calculations
- Unique value extraction

### Dashboard 2: Sales Trends Dashboard
**Purpose:** Test graph metrics

- **Name:** Sales Trends
- **Description:** Visualize sales trends over time
- **Created By:** Director 3
- **Metrics:**
  1. **Sales Over Time** (graph)
     - Source: Form 2 (Sales Report)
     - X-Axis: Sales Date (date)
     - Y-Axis: Total Amount (sum)
     - Chart Type: `line`
  2. **Sales by Product** (graph)
     - Source: Form 2 (Sales Report)
     - X-Axis: Product Sold (field)
     - Y-Axis: Total Amount (sum)
     - Chart Type: `bar`
  3. **Daily Sales Volume** (graph)
     - Source: Form 2 (Sales Report)
     - X-Axis: Sales Date (time)
     - Y-Axis: count
     - Chart Type: `area`

**Test Scenarios:**
- Graph metric creation
- Line charts
- Bar charts
- Area charts
- Time-based X-axis
- Field-based X-axis

### Dashboard 3: Employee Performance Dashboard
**Purpose:** Test table metrics

- **Name:** Employee Performance
- **Description:** Track employee performance
- **Created By:** Director 3
- **Metrics:**
  1. **Employee Sales Table** (table)
     - Source: Form 2 (Sales Report)
     - Columns:
       - Salesperson Name
       - Total Sales (sum of Total Amount)
       - Number of Sales (count)
       - Average Sale (average of Total Amount)

**Test Scenarios:**
- Table metric creation
- Multiple column configurations
- Aggregated calculations in tables

### Dashboard 4: Computed Metrics Dashboard
**Purpose:** Test computed metrics with formulas

- **Name:** Financial Overview
- **Description:** Financial calculations using computed metrics
- **Created By:** Director 3
- **Metrics:**
  1. **Total Revenue** (value)
     - Source: Form 2 (Sales Report)
     - Field: Total Amount
     - Calculation: `sum`
  2. **Total Expenses** (value)
     - Source: Form 4 (Expense Report)
     - Field: Total (calculated)
     - Calculation: `sum`
  3. **Net Profit** (computed)
     - Formula: `Total Revenue - Total Expenses`
     - Depends On: [Total Revenue, Total Expenses]
  4. **Profit Margin** (computed)
     - Formula: `(Net Profit / Total Revenue) * 100`
     - Depends On: [Net Profit, Total Revenue]

**Test Scenarios:**
- Computed metric creation
- Formula dependencies
- Complex calculations
- Percentage computations

### Dashboard 5: Simple Dashboard (Free Package)
**Purpose:** Test free package dashboard limit

- **Name:** Basic Dashboard
- **Description:** Simple dashboard for free package
- **Created By:** Director 1 (Free package - max 1 dashboard)
- **Metrics:**
  1. **Total Entries** (value)
     - Source: Form 6 (Simple Form)
     - Field: Name
     - Calculation: `count`

**Test Scenarios:**
- Dashboard limit enforcement
- Package restriction testing

---

## 🌌 Univers Templates

### Univers 1: Retail Management Univers
**Purpose:** Test complete Univers template system

- **Name:** Retail Management System
- **Description:** Complete retail management template with forms, dashboards, lists, and reports
- **Created By:** Director 3
- **Is Marketplace:** `false` (agency-specific)
- **Definitions:**
  - **Forms:**
    1. Product Registration Form
    2. Sales Transaction Form
    3. Inventory Check Form
  - **Dashboards:**
    1. Sales Dashboard
    2. Inventory Dashboard
  - **Lists:**
    1. Product Categories (from List 1)
    2. Payment Methods (from List 4)
  - **Reports:**
    1. Monthly Sales Report
    2. Inventory Report

**Test Scenarios:**
- Univers creation
- Univers instantiation
- Template resource creation
- Univers marketplace (if published)

### Univers 2: HR Management Univers
**Purpose:** Test Univers with employee management

- **Name:** HR Management System
- **Description:** Human resources management template
- **Created By:** Director 3
- **Is Marketplace:** `true` (for marketplace testing)
- **Approval Status:** `pending` (test admin approval)
- **Definitions:**
  - **Forms:**
    1. Employee Registration
    2. Performance Review
    3. Leave Request
  - **Dashboards:**
    1. Employee Overview
  - **Lists:**
    1. Employee Roles (from List 2)
    2. Departments
  - **Reports:**
    1. Employee Report

**Test Scenarios:**
- Marketplace Univers creation
- Admin approval workflow
- Univers sharing across agencies

---

## ⏰ Scheduled Questions

### Scheduled Question 1: Daily Sales Summary
**Purpose:** Test scheduled question execution

- **Title:** Daily Sales Summary
- **Question:** "What were the total sales yesterday?"
- **User:** Director 3
- **Filters:**
  - Period: `yesterday`
  - Form ID: Form 2 (Sales Report)
  - User ID: `all`
- **Selected Format:** `text`
- **Scheduled At:** Today at 09:00
- **Frequency:** `daily`
- **Status:** `pending`

**Test Scenarios:**
- Scheduled question creation
- Daily execution
- Question execution
- Response storage

### Scheduled Question 2: Weekly Performance Report
**Purpose:** Test weekly scheduled questions

- **Title:** Weekly Performance Report
- **Question:** "Generate a weekly performance report for last week"
- **User:** Director 3
- **Filters:**
  - Period: `last_week`
  - Form IDs: [Form 2, Form 4]
  - User ID: `all`
- **Selected Formats:** `["text", "graph"]`
- **Scheduled At:** Next Monday at 08:00
- **Frequency:** `weekly`
- **Status:** `pending`

**Test Scenarios:**
- Weekly frequency
- Multiple format selection
- Multiple form filtering

### Scheduled Question 3: Monthly Financial Summary
**Purpose:** Test monthly scheduled questions

- **Title:** Monthly Financial Summary
- **Question:** "What is the financial summary for last month?"
- **User:** Director 3
- **Filters:**
  - Period: `last_month`
  - Form IDs: [Form 2, Form 4]
  - User ID: `all`
- **Selected Format:** `multi-format`
- **Scheduled At:** First day of next month at 09:00
- **Frequency:** `monthly`
- **Max Executions:** `12` (one year)
- **Status:** `pending`

**Test Scenarios:**
- Monthly frequency
- Max executions limit
- Multi-format responses

---

## 📄 Reports

### Report 1: Sales Report Template
**Purpose:** Test text-based report generation

- **Name:** Monthly Sales Report
- **Description:** Monthly sales summary report
- **Template Type:** `text`
- **Template Content:**
  ```
  MONTHLY SALES REPORT
  ====================
  
  Period: {{period}}
  Generated: {{generated_at}}
  
  SUMMARY
  -------
  Total Sales: {{total_sales}}
  Number of Transactions: {{transaction_count}}
  Average Sale: {{average_sale}}
  
  TOP PRODUCTS
  -----------
  {{top_products_table}}
  ```
- **Placeholders:**
  - `period` (text)
  - `generated_at` (date)
  - `total_sales` (number)
  - `transaction_count` (number)
  - `average_sale` (number)
  - `top_products_table` (table)
- **Mappings:**
  - `total_sales` → Form 2, Total Amount field, sum
  - `transaction_count` → Form 2, Sales Date field, count
  - `average_sale` → Form 2, Total Amount field, average
  - `top_products_table` → Form 2, Product Sold field, grouped

**Test Scenarios:**
- Text report creation
- Placeholder mapping
- Report generation
- PDF export

### Report 2: Expense Report Template
**Purpose:** Test PDF template reports

- **Name:** Expense Report
- **Description:** Monthly expense report with PDF template
- **Template Type:** `pdf`
- **Template File:** Upload a PDF template with placeholders
- **Placeholders:**
  - `employee_name` (text)
  - `month` (date)
  - `total_expenses` (number)
  - `expense_items` (table)
- **Mappings:**
  - `employee_name` → Form 4, Employee Name field
  - `month` → Form 4, Report Month field
  - `total_expenses` → Form 4, Total field, sum
  - `expense_items` → Form 4, all expense items

**Test Scenarios:**
- PDF template upload
- PDF placeholder detection
- PDF report generation
- File-based templates

---

## 📤 Form Entries (Submissions)

### Form Entry Set 1: Sales Report Submissions
**Purpose:** Test form submission and data collection

Create multiple submissions for **Form 2 (Sales Report)**:

1. **Submission 1:**
   - Sales Date: Yesterday
   - Salesperson: Employee 2
   - Product: "Laptop"
   - Quantity: 2
   - Unit Price: 50000
   - Discount: 10
   - Total Amount: 90000 (calculated)
   - Payment Method: "Mobile Money"

2. **Submission 2:**
   - Sales Date: Today
   - Salesperson: Employee 4
   - Product: "Phone"
   - Quantity: 5
   - Unit Price: 30000
   - Discount: 0
   - Total Amount: 150000
   - Payment Method: "Cash"

3. **Submission 3:**
   - Sales Date: Today
   - Salesperson: Employee 2
   - Product: "Laptop"
   - Quantity: 1
   - Unit Price: 50000
   - Discount: 5
   - Total Amount: 47500
   - Payment Method: "Bank Transfer"
   - Show Customer Details: checked
   - Customer Email: "customer@test.com"
   - Customer Phone: "+237 123456789"

**Test Scenarios:**
- Multiple submissions
- Calculated field values
- Conditional field data
- Data aggregation in dashboards

### Form Entry Set 2: Expense Report Submissions
**Purpose:** Test file uploads and complex calculations

Create submissions for **Form 4 (Expense Report)**:

1. **Submission 1:**
   - Report Month: Current month
   - Employee: Employee 2
   - Department: "Sales"
   - Expense Items:
     - Item 1: "Office Supplies", Amount: 50000, Receipt: [upload PDF]
     - Item 2: "Transport", Amount: 20000, Receipt: [upload image]
   - Subtotal: 70000 (calculated)
   - Tax: 10500 (calculated)
   - Total: 80500 (calculated)
   - Approval Status: "Pending"

2. **Submission 2:**
   - Report Month: Current month
   - Employee: Employee 4
   - Department: "Operations"
   - Expense Items:
     - Item 1: "Equipment", Amount: 150000, Receipt: [upload PDF]
   - Subtotal: 150000
   - Tax: 22500
   - Total: 172500
   - Approval Status: "Approved"

**Test Scenarios:**
- File upload in submissions
- Multiple file attachments
- PDF text extraction
- Complex calculation chains
- List-based field values

### Form Entry Set 3: Attendance Submissions
**Purpose:** Test time restrictions and file uploads

Create submissions for **Form 3 (Employee Attendance)**:

1. **Submission 1 (Valid):**
   - Employee: Employee 1
   - Check-in Time: Today 09:00
   - Check-out Time: Today 17:00
   - Location: "Downtown Branch"
   - Photo Proof: [upload image]
   - Notes: "Regular attendance"

2. **Submission 2 (Overtime):**
   - Employee: Employee 2
   - Check-in Time: Today 08:00
   - Check-out Time: Today 20:00
   - Location: "Airport Branch"
   - Photo Proof: [upload image]
   - Overtime Hours: 3
   - Notes: "Overtime work"

**Test Scenarios:**
- Time restriction validation
- Image upload
- OCR text extraction
- Date/time handling

---

## 🧪 Testing Scenarios

### Scenario 1: Complete User Journey - Director
1. Register as Director
2. Select package (Free/Starter/Standard)
3. Create agency
4. Create forms (test package limits)
5. Assign forms to employees
6. Create dashboards
7. Create lists
8. Create Univers template
9. Create scheduled questions
10. Create reports
11. View analytics
12. Export data

### Scenario 2: Complete User Journey - Employee
1. Register as Employee
2. Wait for director approval
3. View assigned forms
4. Submit forms (multiple times)
5. Upload files
6. View submission history
7. Test conditional fields
8. Test calculated fields

### Scenario 3: Package Limit Testing
1. Create forms up to package limit
2. Try to create form beyond limit (should fail)
3. Create dashboards up to package limit
4. Try to create dashboard beyond limit (should fail)
5. Test token usage tracking
6. Test feature access based on package

### Scenario 4: Advanced Features Testing
1. Create form with calculated fields
2. Create form with conditional logic
3. Create form with file uploads
4. Create dashboard with graphs
5. Create dashboard with computed metrics
6. Create Univers template
7. Instantiate Univers
8. Create scheduled questions
9. Generate reports

### Scenario 5: AI Chat Testing
1. Ask questions about form data
2. Request analysis of trends
3. Generate reports via chat
4. Test different response formats (text, graph, table, PDF)
5. Test scheduled question execution
6. Test conversation history

### Scenario 6: Notification Testing
1. Create form with deadline
2. Set reminder intervals
3. Test push notifications
4. Test email notifications
5. Test scheduled question notifications
6. Test metric reminder notifications

### Scenario 7: File Processing Testing
1. Upload images (test OCR)
2. Upload PDFs (test text extraction)
3. Test file type validation
4. Test file size limits
5. Test multiple file uploads
6. Test file download

### Scenario 8: Permission Testing
1. Test employee with basic access
2. Test employee with director dashboard access
3. Test employee with validator permissions
4. Test pending approval workflow
5. Test access level restrictions

---

## 📝 Quick Reference Checklist

### Accounts to Create
- [ ] 1 Admin account
- [ ] 3 Director accounts (Free, Starter, Standard packages)
- [ ] 4 Employee accounts (Basic, Advanced, Pending, Validator)

### Lists to Create
- [ ] Product Categories
- [ ] Employee Roles
- [ ] Branch Locations
- [ ] Payment Methods

### Forms to Create
- [ ] Basic Inventory Form
- [ ] Sales Report Form (with calculations)
- [ ] Employee Attendance Form (with file uploads)
- [ ] Expense Report Form (complex)
- [ ] Customer Feedback Form (all field types)
- [ ] Simple Form (for free package testing)

### Dashboards to Create
- [ ] Sales Analytics Dashboard (value metrics)
- [ ] Sales Trends Dashboard (graph metrics)
- [ ] Employee Performance Dashboard (table metrics)
- [ ] Financial Overview Dashboard (computed metrics)
- [ ] Basic Dashboard (for free package testing)

### Univers Templates to Create
- [ ] Retail Management Univers
- [ ] HR Management Univers

### Scheduled Questions to Create
- [ ] Daily Sales Summary
- [ ] Weekly Performance Report
- [ ] Monthly Financial Summary

### Reports to Create
- [ ] Monthly Sales Report (text template)
- [ ] Expense Report (PDF template)

### Form Submissions to Create
- [ ] Multiple Sales Report submissions
- [ ] Multiple Expense Report submissions
- [ ] Multiple Attendance submissions

---

## 🎯 Testing Priority

### High Priority (Core Functionality)
1. User registration and authentication
2. Package selection and limits
3. Form creation and submission
4. Dashboard creation and viewing
5. Basic AI chat functionality

### Medium Priority (Advanced Features)
1. Calculated fields
2. Conditional logic
3. File uploads and OCR
4. Graph metrics
5. Computed metrics
6. Scheduled questions

### Low Priority (Nice-to-Have)
1. Univers templates
2. Report generation
3. Advanced notifications
4. Marketplace features

---

## 📚 Additional Notes

1. **Package Limits:**
   - Free: 2 forms, 1 dashboard, 25k tokens
   - Starter: 4 forms, 2 dashboards, 100k tokens
   - Standard: Unlimited forms/dashboards, 300k tokens

2. **File Upload Requirements:**
   - Only available in Starter and Standard packages
   - Supported formats: PDF, JPG, PNG
   - OCR available for images and PDFs

3. **AI Chat Features:**
   - Available in all packages
   - Token limits vary by package
   - Multiple response formats supported

4. **Univers System:**
   - Can create agency-specific Univers
   - Can publish to marketplace (requires admin approval)
   - Instantiation creates all resources at once

5. **Testing Environment:**
   - Use test Firebase project
   - Use test payment methods
   - Monitor token usage
   - Check Firestore rules

---

**Happy Testing! 🚀**

