const fs = require('fs');
const path = require('path');

// Mapping des anciens chemins vers les nouveaux chemins
const importMappings = [
  // UI Components
  { from: /from ['"]\.\.\/components\/Button['"]/g, to: "from '../components/ui/Button'" },
  { from: /from ['"]\.\.\/components\/Card['"]/g, to: "from '../components/ui/Card'" },
  { from: /from ['"]\.\.\/components\/Input['"]/g, to: "from '../components/ui/Input'" },
  { from: /from ['"]\.\.\/components\/Textarea['"]/g, to: "from '../components/ui/Textarea'" },
  { from: /from ['"]\.\.\/components\/Select['"]/g, to: "from '../components/ui/Select'" },
  { from: /from ['"]\.\.\/components\/Pagination['"]/g, to: "from '../components/ui/Pagination'" },
  { from: /from ['"]\.\.\/components\/Toast['"]/g, to: "from '../components/ui/Toast'" },
  
  // Layout Components
  { from: /from ['"]\.\.\/components\/Layout['"]/g, to: "from '../components/layout/Layout'" },
  { from: /from ['"]\.\.\/components\/Footer['"]/g, to: "from '../components/layout/Footer'" },
  { from: /from ['"]\.\.\/components\/ImpersonationHeader['"]/g, to: "from '../components/layout/ImpersonationHeader'" },
  
  // Core Components
  { from: /from ['"]\.\.\/components\/ErrorBoundary['"]/g, to: "from '../components/core/ErrorBoundary'" },
  { from: /from ['"]\.\.\/components\/ProtectedRoute['"]/g, to: "from '../components/core/ProtectedRoute'" },
  { from: /from ['"]\.\.\/components\/WelcomeScreen['"]/g, to: "from '../components/core/WelcomeScreen'" },
  { from: /from ['"]\.\.\/components\/LoadingGuard['"]/g, to: "from '../components/loading/LoadingGuard'" },
  
  // Modals
  { from: /from ['"]\.\.\/components\/ConfirmationModal['"]/g, to: "from '../components/modals/ConfirmationModal'" },
  { from: /from ['"]\.\.\/components\/AccessDeniedModal['"]/g, to: "from '../components/modals/AccessDeniedModal'" },
  { from: /from ['"]\.\.\/components\/ComingSoonModal['"]/g, to: "from '../components/modals/ComingSoonModal'" },
  { from: /from ['"]\.\.\/components\/LimitReachedModal['"]/g, to: "from '../components/modals/LimitReachedModal'" },
  { from: /from ['"]\.\.\/components\/LogoutConfirmationModal['"]/g, to: "from '../components/modals/LogoutConfirmationModal'" },
  
  // Domain Components - Forms
  { from: /from ['"]\.\.\/components\/FormBuilder['"]/g, to: "from '../components/forms/FormBuilder'" },
  { from: /from ['"]\.\.\/components\/FormEditor['"]/g, to: "from '../components/forms/FormEditor'" },
  { from: /from ['"]\.\.\/components\/DynamicForm['"]/g, to: "from '../components/forms/DynamicForm'" },
  
  // Domain Components - Dashboard
  { from: /from ['"]\.\.\/components\/DashboardBuilder['"]/g, to: "from '../components/dashboard/DashboardBuilder'" },
  { from: /from ['"]\.\.\/components\/DashboardDisplay['"]/g, to: "from '../components/dashboard/DashboardDisplay'" },
  
  // Domain Components - Univers
  { from: /from ['"]\.\.\/components\/UniversBadge['"]/g, to: "from '../components/univers/UniversBadge'" },
  { from: /from ['"]\.\.\/components\/UniversCard['"]/g, to: "from '../components/univers/UniversCard'" },
  { from: /from ['"]\.\.\/components\/UniversList['"]/g, to: "from '../components/univers/UniversList'" },
  
  // Domain Components - Payments
  { from: /from ['"]\.\.\/components\/PayAsYouGoModal['"]/g, to: "from '../components/payments/PayAsYouGoModal'" },
  { from: /from ['"]\.\.\/components\/PaymentModal['"]/g, to: "from '../components/payments/PaymentModal'" },
  
  // Domain Components - Employees
  { from: /from ['"]\.\.\/components\/PendingApprovals['"]/g, to: "from '../components/employees/PendingApprovals'" },
  { from: /from ['"]\.\.\/components\/EmployeeManagement['"]/g, to: "from '../components/employees/EmployeeManagement'" },
  
  // Services
  { from: /from ['"]\.\.\/services\/tableDataService['"]/g, to: "from '../services/core/tableDataService'" },
  { from: /from ['"]\.\.\/services\/tokenCounter['"]/g, to: "from '../services/core/tokenCounter'" },
  
  // Hooks
  { from: /from ['"]\.\.\/hooks\/usePackageAccess['"]/g, to: "from '../hooks/packages/usePackageAccess'" },
  
  // Utils
  { from: /from ['"]\.\.\/utils\/MetricCalculator['"]/g, to: "from '../utils/forms/MetricCalculator'" },
];

function updateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let updated = false;
  
  importMappings.forEach(mapping => {
    if (mapping.from.test(content)) {
      content = content.replace(mapping.from, mapping.to);
      updated = true;
    }
  });
  
  if (updated) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

function walkDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !filePath.includes('node_modules') && !filePath.includes('.git')) {
      walkDir(filePath, fileList);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Mettre à jour tous les fichiers
const srcDir = path.join(__dirname);
const files = walkDir(srcDir);

console.log(`Found ${files.length} files to check...`);
files.forEach(updateFile);
console.log('Done!');

