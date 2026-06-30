const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/pages/CitizenDashboard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add imports at the top
if (!content.includes("import ExploreIssues")) {
  content = content.replace(
    "import IssueCard from './IssueCard';",
    "import IssueCard from './IssueCard';\nimport ExploreIssues from './ExploreIssues';\nimport CommunityFeed from './CommunityFeed';"
  );
}

// 2. Replace Explore Issues Tab block
const exploreStartStr = "{/* Explore Issues Tab */}\n              {activeTab === 'explore-issues' && (";
const exploreStartIndex = content.indexOf(exploreStartStr);
if (exploreStartIndex !== -1) {
  // Find the end of this block by searching for the next tab
  const communityStartStr = "{/* Community Feed Tab */}";
  const communityStartIndex = content.indexOf(communityStartStr);
  
  if (communityStartIndex !== -1) {
    const exploreReplacement = `{/* Explore Issues Tab */}
              {activeTab === 'explore-issues' && (
                <ExploreIssues 
                  user={user} 
                  token={token} 
                  onViewDetails={handleSelectIssue} 
                  IssueCardComponent={IssueCard} 
                />
              )}\n\n              `;
    content = content.substring(0, exploreStartIndex) + exploreReplacement + content.substring(communityStartIndex);
  }
}

// 3. Replace Community Feed Tab block
const commStartStr = "{/* Community Feed Tab */}\n              {activeTab === 'community-feed' && (";
const commStartIndex = content.indexOf(commStartStr);
if (commStartIndex !== -1) {
  // Find the end by searching for the next tab
  const notificationsStartStr = "{/* Notifications Tab */}";
  const notificationsStartIndex = content.indexOf(notificationsStartStr);
  
  if (notificationsStartIndex !== -1) {
    const commReplacement = `{/* Community Feed Tab */}
              {activeTab === 'community-feed' && (
                <CommunityFeed 
                  user={user} 
                  token={token} 
                  onViewDetails={handleSelectIssue} 
                  IssueCardComponent={IssueCard} 
                />
              )}\n\n              `;
    content = content.substring(0, commStartIndex) + commReplacement + content.substring(notificationsStartIndex);
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated CitizenDashboard.tsx');
