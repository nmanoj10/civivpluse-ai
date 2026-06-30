const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/pages/CitizenDashboard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('import IssueDetails')) {
  content = content.replace(
    "import React, { useState, useEffect, useCallback } from 'react';",
    "import React, { useState, useEffect, useCallback } from 'react';\nimport IssueDetails from './IssueDetails';\nimport ExploreIssues from './ExploreIssues';\nimport CommunityFeed from './CommunityFeed';"
  );
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully added imports to CitizenDashboard.tsx');
} else {
  console.log('Imports already exist');
}
