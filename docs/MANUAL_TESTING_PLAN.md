# 🧪 UBORA MVP Manual Testing Plan

## 📋 Overview
This document provides a systematic manual testing plan for the UBORA MVP core functionalities.

**Testing Phase:** Phase 1 - Core Functional Flows  
**Testing Type:** Manual Testing  
**Status:** 🔄 In Progress  
**Date:** 2024-08-09

---

## 🎯 **TESTING OBJECTIVES**

### **Primary Goals:**
1. **Verify Core Functionality** - Ensure all MVP features work as expected
2. **Identify Critical Bugs** - Find issues that prevent basic usage
3. **Validate User Flows** - Test complete user journeys
4. **Document Issues** - Record all problems found for fixing

### **Success Criteria:**
- ✅ All core user flows work end-to-end
- ✅ No critical bugs that prevent basic usage
- ✅ All user roles can perform their intended actions
- ✅ File upload and processing works correctly
- ✅ AI chat functionality works as expected

---

## 🔐 **TEST 1: AUTHENTICATION FLOW**

### **Test 1.1: User Registration**
**Objective:** Test complete user registration process

**Steps to Test:**
1. **Navigate to registration page**
   - [ ] Open application in browser
   - [ ] Click "Register" or "Sign Up" button
   - [ ] Verify registration form loads

2. **Fill registration form**
   - [ ] Enter valid email address
   - [ ] Enter strong password (8+ characters)
   - [ ] Confirm password
   - [ ] Enter full name
   - [ ] Select role (Director/Employee)
   - [ ] Enter agency name (if Director)

3. **Submit registration**
   - [ ] Click "Register" button
   - [ ] Verify success message appears
   - [ ] Check if email verification is required
   - [ ] Verify user is redirected to appropriate dashboard

**Expected Results:**
- ✅ Registration form accepts valid data
- ✅ User account is created successfully
- ✅ User is redirected to correct dashboard based on role
- ✅ Email verification works (if implemented)

**Issues Found:**
- [ ] Issue 1: ________________
- [ ] Issue 2: ________________
- [ ] Issue 3: ________________

---

### **Test 1.2: User Login**
**Objective:** Test user login with valid and invalid credentials

**Steps to Test:**
1. **Valid Login**
   - [ ] Navigate to login page
   - [ ] Enter valid email and password
   - [ ] Click "Login" button
   - [ ] Verify successful login
   - [ ] Verify redirect to correct dashboard

2. **Invalid Login**
   - [ ] Enter invalid email
   - [ ] Enter invalid password
   - [ ] Click "Login" button
   - [ ] Verify error message appears
   - [ ] Verify user remains on login page

3. **Google OAuth Login**
   - [ ] Click "Login with Google" button
   - [ ] Complete Google authentication
   - [ ] Verify successful login
   - [ ] Verify redirect to dashboard

**Expected Results:**
- ✅ Valid credentials allow login
- ✅ Invalid credentials show appropriate error
- ✅ Google OAuth works correctly
- ✅ User is redirected to correct dashboard

**Issues Found:**
- [ ] Issue 1: ________________
- [ ] Issue 2: ________________
- [ ] Issue 3: ________________

---

### **Test 1.3: User Logout**
**Objective:** Test user logout functionality

**Steps to Test:**
1. **Logout Process**
   - [ ] Login to application
   - [ ] Click user menu/profile
   - [ ] Click "Logout" button
   - [ ] Verify logout confirmation (if any)
   - [ ] Verify redirect to login page
   - [ ] Verify session is cleared

**Expected Results:**
- ✅ Logout button is accessible
- ✅ Logout clears user session
- ✅ User is redirected to login page
- ✅ Cannot access protected pages after logout

**Issues Found:**
- [ ] Issue 1: ________________
- [ ] Issue 2: ________________

---

## 📝 **TEST 2: FORM MANAGEMENT (DIRECTOR)**

### **Test 2.1: Create New Form**
**Objective:** Test form creation functionality

**Steps to Test:**
1. **Access Form Builder**
   - [ ] Login as Director
   - [ ] Navigate to Forms section
   - [ ] Click "Create New Form" button
   - [ ] Verify form builder opens

2. **Build Form**
   - [ ] Add form title
   - [ ] Add form description
   - [ ] Add text field
   - [ ] Add number field
   - [ ] Add date field
   - [ ] Add file upload field
   - [ ] Add dropdown/select field
   - [ ] Set field as required/optional
   - [ ] Preview form

3. **Save Form**
   - [ ] Click "Save Form" button
   - [ ] Verify form is saved
   - [ ] Verify form appears in forms list
   - [ ] Verify form can be edited

**Expected Results:**
- ✅ Form builder loads correctly
- ✅ All field types can be added
- ✅ Form preview works
- ✅ Form saves successfully
- ✅ Form appears in forms list

**Issues Found:**
- [ ] Issue 1: ________________
- [ ] Issue 2: ________________
- [ ] Issue 3: ________________

---

### **Test 2.2: Edit Existing Form**
**Objective:** Test form editing functionality

**Steps to Test:**
1. **Access Form Editor**
   - [ ] Select existing form from list
   - [ ] Click "Edit" button
   - [ ] Verify form editor opens with current data

2. **Modify Form**
   - [ ] Change form title
   - [ ] Add new field
   - [ ] Remove existing field
   - [ ] Modify field properties
   - [ ] Preview changes

3. **Save Changes**
   - [ ] Click "Save Changes" button
   - [ ] Verify changes are saved
   - [ ] Verify form updates in list

**Expected Results:**
- ✅ Form editor loads with current data
- ✅ Changes can be made to form
- ✅ Changes save successfully
- ✅ Updated form appears in list

**Issues Found:**
- [ ] Issue 1: ________________
- [ ] Issue 2: ________________

---

### **Test 2.3: Assign Form to Employees**
**Objective:** Test form assignment functionality

**Steps to Test:**
1. **Select Form for Assignment**
   - [ ] Choose form from forms list
   - [ ] Click "Assign to Employees" button
   - [ ] Verify assignment interface opens

2. **Assign Form**
   - [ ] Select employees from list
   - [ ] Set assignment deadline (if applicable)
   - [ ] Add assignment notes (if applicable)
   - [ ] Click "Assign" button

3. **Verify Assignment**
   - [ ] Check employee notifications
   - [ ] Verify form appears in employee dashboard
   - [ ] Check assignment status

**Expected Results:**
- ✅ Assignment interface works
- ✅ Employees can be selected
- ✅ Assignment is successful
- ✅ Employees receive notifications
- ✅ Form appears in employee dashboard

**Issues Found:**
- [ ] Issue 1: ________________
- [ ] Issue 2: ________________

---

## 📋 **TEST 3: FORM SUBMISSION (EMPLOYEE)**

### **Test 3.1: Fill and Submit Form**
**Objective:** Test form filling and submission process

**Steps to Test:**
1. **Access Assigned Form**
   - [ ] Login as Employee
   - [ ] Navigate to assigned forms
   - [ ] Click on assigned form
   - [ ] Verify form loads correctly

2. **Fill Form Fields**
   - [ ] Enter text in text fields
   - [ ] Enter numbers in number fields
   - [ ] Select dates in date fields
   - [ ] Upload files in file fields
   - [ ] Select options in dropdown fields
   - [ ] Verify field validation works

3. **Submit Form**
   - [ ] Click "Submit" button
   - [ ] Verify submission confirmation
   - [ ] Check submission appears in history
   - [ ] Verify director receives notification

**Expected Results:**
- ✅ Form loads with all fields
- ✅ All field types work correctly
- ✅ Validation works for required fields
- ✅ Form submits successfully
- ✅ Submission is recorded
- ✅ Director is notified

**Issues Found:**
- [ ] Issue 1: ________________
- [ ] Issue 2: ________________
- [ ] Issue 3: ________________

---

### **Test 3.2: File Upload in Forms**
**Objective:** Test file upload functionality in forms

**Steps to Test:**
1. **Upload Different File Types**
   - [ ] Upload PDF file
   - [ ] Upload image file (JPG, PNG)
   - [ ] Upload document file (DOC, DOCX)
   - [ ] Verify file size limits
   - [ ] Test file type restrictions

2. **Verify File Processing**
   - [ ] Check if OCR processing works
   - [ ] Verify extracted text appears
   - [ ] Check file preview functionality
   - [ ] Verify file is stored correctly

**Expected Results:**
- ✅ All supported file types upload
- ✅ File size limits are enforced
- ✅ OCR processing works for images/PDFs
- ✅ Extracted text is displayed
- ✅ Files are stored securely

**Issues Found:**
- [ ] Issue 1: ________________
- [ ] Issue 2: ________________

---

## 📊 **TEST 4: DASHBOARD & ANALYTICS**

### **Test 4.1: Create Dashboard**
**Objective:** Test dashboard creation functionality

**Steps to Test:**
1. **Access Dashboard Builder**
   - [ ] Login as Director
   - [ ] Navigate to Dashboards section
   - [ ] Click "Create New Dashboard" button
   - [ ] Verify dashboard builder opens

2. **Build Dashboard**
   - [ ] Add dashboard title
   - [ ] Add dashboard description
   - [ ] Select forms for analytics
   - [ ] Add metrics (count, sum, average)
   - [ ] Add charts/graphs
   - [ ] Preview dashboard

3. **Save Dashboard**
   - [ ] Click "Save Dashboard" button
   - [ ] Verify dashboard is saved
   - [ ] Verify dashboard appears in list
   - [ ] Verify dashboard can be viewed

**Expected Results:**
- ✅ Dashboard builder loads correctly
- ✅ Forms can be selected for analytics
- ✅ Metrics can be added
- ✅ Charts/graphs can be created
- ✅ Dashboard saves successfully

**Issues Found:**
- [ ] Issue 1: ________________
- [ ] Issue 2: ________________
- [ ] Issue 3: ________________

---

### **Test 4.2: View Dashboard Analytics**
**Objective:** Test dashboard viewing and analytics

**Steps to Test:**
1. **Access Dashboard**
   - [ ] Select dashboard from list
   - [ ] Click "View Dashboard" button
   - [ ] Verify dashboard loads with data

2. **Verify Analytics**
   - [ ] Check metric calculations
   - [ ] Verify chart data accuracy
   - [ ] Test date range filters
   - [ ] Test form filters
   - [ ] Test employee filters

3. **Test Dashboard Features**
   - [ ] Test real-time updates
   - [ ] Test export functionality
   - [ ] Test dashboard sharing
   - [ ] Test dashboard editing

**Expected Results:**
- ✅ Dashboard loads with correct data
- ✅ Metrics are calculated correctly
- ✅ Charts display accurate data
- ✅ Filters work properly
- ✅ Real-time updates work

**Issues Found:**
- [ ] Issue 1: ________________
- [ ] Issue 2: ________________

---

## 📁 **TEST 5: FILE UPLOAD & OCR PROCESSING**

### **Test 5.1: PDF Text Extraction**
**Objective:** Test PDF text extraction functionality

**Steps to Test:**
1. **Upload PDF File**
   - [ ] Navigate to file upload area
   - [ ] Select PDF file
   - [ ] Click "Upload" button
   - [ ] Verify upload progress

2. **Verify OCR Processing**
   - [ ] Wait for processing to complete
   - [ ] Check extracted text appears
   - [ ] Verify text accuracy
   - [ ] Check for table extraction
   - [ ] Verify image extraction (if any)

3. **Test Different PDF Types**
   - [ ] Test text-based PDF
   - [ ] Test scanned PDF
   - [ ] Test PDF with tables
   - [ ] Test PDF with images
   - [ ] Test multi-page PDF

**Expected Results:**
- ✅ PDF uploads successfully
- ✅ OCR processing completes
- ✅ Text is extracted accurately
- ✅ Tables are preserved
- ✅ Images are processed

**Issues Found:**
- [ ] Issue 1: ________________
- [ ] Issue 2: ________________
- [ ] Issue 3: ________________

---

### **Test 5.2: Image Text Extraction**
**Objective:** Test image text extraction functionality

**Steps to Test:**
1. **Upload Image Files**
   - [ ] Upload JPG image
   - [ ] Upload PNG image
   - [ ] Upload handwritten text image
   - [ ] Upload printed text image
   - [ ] Upload low-quality image

2. **Verify OCR Results**
   - [ ] Check text extraction accuracy
   - [ ] Verify handwriting recognition
   - [ ] Check multi-language support
   - [ ] Verify image quality handling

**Expected Results:**
- ✅ All image types upload
- ✅ Text is extracted accurately
- ✅ Handwriting is recognized
- ✅ Multi-language text works
- ✅ Low-quality images are handled

**Issues Found:**
- [ ] Issue 1: ________________
- [ ] Issue 2: ________________

---

## 🤖 **TEST 6: AI CHAT & ANALYSIS**

### **Test 6.1: AI Chat Functionality**
**Objective:** Test AI chat and analysis features

**Steps to Test:**
1. **Access AI Chat**
   - [ ] Login as Director
   - [ ] Navigate to AI Chat section
   - [ ] Verify chat interface loads
   - [ ] Check conversation history

2. **Test Chat Features**
   - [ ] Send text message
   - [ ] Ask for data analysis
   - [ ] Request report generation
   - [ ] Test file analysis
   - [ ] Test multi-language chat

3. **Verify AI Responses**
   - [ ] Check response accuracy
   - [ ] Verify data analysis quality
   - [ ] Check report generation
   - [ ] Test context awareness
   - [ ] Verify token usage tracking

**Expected Results:**
- ✅ Chat interface works correctly
- ✅ AI responds to messages
- ✅ Data analysis is accurate
- ✅ Reports are generated
- ✅ Context is maintained

**Issues Found:**
- [ ] Issue 1: ________________
- [ ] Issue 2: ________________
- [ ] Issue 3: ________________

---

### **Test 6.2: Data Analysis Features**
**Objective:** Test AI data analysis capabilities

**Steps to Test:**
1. **Request Data Analysis**
   - [ ] Ask AI to analyze form data
   - [ ] Request trend analysis
   - [ ] Ask for statistical insights
   - [ ] Request predictive analysis
   - [ ] Test custom analysis requests

2. **Verify Analysis Quality**
   - [ ] Check analysis accuracy
   - [ ] Verify insights are relevant
   - [ ] Test different data sets
   - [ ] Check analysis formatting
   - [ ] Verify export functionality

**Expected Results:**
- ✅ AI analyzes data correctly
- ✅ Insights are relevant and accurate
- ✅ Analysis is well-formatted
- ✅ Export functionality works
- ✅ Different data sets are handled

**Issues Found:**
- [ ] Issue 1: ________________
- [ ] Issue 2: ________________

---

## 📱 **TEST 7: MOBILE & RESPONSIVE DESIGN**

### **Test 7.1: Mobile Responsiveness**
**Objective:** Test mobile device compatibility

**Steps to Test:**
1. **Test on Mobile Device**
   - [ ] Open app on mobile browser
   - [ ] Test login on mobile
   - [ ] Test form filling on mobile
   - [ ] Test file upload on mobile
   - [ ] Test dashboard viewing on mobile

2. **Test Touch Interactions**
   - [ ] Test touch navigation
   - [ ] Test form field interactions
   - [ ] Test button taps
   - [ ] Test scrolling
   - [ ] Test zoom functionality

**Expected Results:**
- ✅ App works on mobile devices
- ✅ Touch interactions work correctly
- ✅ Forms are mobile-friendly
- ✅ Navigation is intuitive
- ✅ Performance is acceptable

**Issues Found:**
- [ ] Issue 1: ________________
- [ ] Issue 2: ________________

---

## 📊 **TESTING SUMMARY**

### **Test Results Summary**
- **Total Tests:** 7 major test categories
- **Tests Completed:** ___ / 7
- **Critical Issues Found:** ___
- **High Priority Issues:** ___
- **Medium Priority Issues:** ___
- **Low Priority Issues:** ___

### **Overall Assessment**
- **Authentication Flow:** ✅ / ❌ / ⚠️
- **Form Management:** ✅ / ❌ / ⚠️
- **Form Submission:** ✅ / ❌ / ⚠️
- **Dashboard & Analytics:** ✅ / ❌ / ⚠️
- **File Upload & OCR:** ✅ / ❌ / ⚠️
- **AI Chat & Analysis:** ✅ / ❌ / ⚠️
- **Mobile Responsiveness:** ✅ / ❌ / ⚠️

### **Critical Issues to Fix**
1. **Issue 1:** ________________
2. **Issue 2:** ________________
3. **Issue 3:** ________________
4. **Issue 4:** ________________
5. **Issue 5:** ________________

### **Next Steps**
1. **Fix Critical Issues** - Address issues that prevent basic usage
2. **Fix High Priority Issues** - Address issues that affect user experience
3. **Retest Fixed Issues** - Verify fixes work correctly
4. **Move to Phase 2** - Begin integration testing

---

## 📝 **TESTING NOTES**

### **Environment Details**
- **Browser:** ________________
- **Device:** ________________
- **Screen Resolution:** ________________
- **Internet Connection:** ________________
- **Test Date:** ________________
- **Tester:** ________________

### **Additional Notes**
- **Note 1:** ________________
- **Note 2:** ________________
- **Note 3:** ________________

---

*This testing plan will be updated as tests are completed and issues are found.*


