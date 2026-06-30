const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/pages/CitizenDashboard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add import for IssueDetails
if (!content.includes("import IssueDetails")) {
  content = content.replace(
    "import IssueCard from './IssueCard';",
    "import IssueCard from './IssueCard';\nimport IssueDetails from './IssueDetails';"
  );
}

// 2. Replace the selectedIssue truthy branch
const startStr = "{selectedIssue ? (";
const startIndex = content.indexOf(startStr);
if (startIndex !== -1) {
  // Find the closing ") : (" for the selectedIssue block
  // It's located right before the activeTab checks
  const endStr = ") : (\n            <>\n              {/* My Reports Tab */}";
  const endIndex = content.indexOf(endStr);
  
  if (endIndex !== -1) {
    const replacement = `{selectedIssue ? (
            <IssueDetails 
              issueId={selectedIssue._id || selectedIssue} 
              user={user} 
              token={token} 
              onClose={() => setSelectedIssue(null)} 
              onSelectDuplicate={handleSelectIssue} 
            />
          `;
    content = content.substring(0, startIndex) + replacement + content.substring(endIndex);
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated CitizenDashboard.tsx with IssueDetails');
