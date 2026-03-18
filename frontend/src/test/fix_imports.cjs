const fs = require('fs');
const path = require('path');

const baseDir = __dirname; // src/test

const fixes = [
  {
    dir: 'features/issue/activity',
    files: [
      'IssueActivityComposer.test.tsx',
      'IssueActivityPanel.test.tsx',
      'IssueActivityPanel.marker.integration.test.tsx',
      'IssueActivityRealtimeListener.test.tsx',
      'IssueActivityTimeline.test.tsx'
    ],
    alias: '@features/issue/activity'
  },
  {
    dir: 'features/issue/lib',
    files: ['formatIssueActivityEvent.unit.test.ts'],
    alias: '@features/issue/lib'
  },
  {
    dir: 'features/notification/api',
    files: ['notificationApi.test.ts'],
    alias: '@features/notification/api'
  },
  {
    dir: 'features/notification/lib',
    files: ['notifications.test.tsx', 'notificationsRealtime.test.ts'],
    alias: '@features/notification/lib'
  },
  {
    dir: 'features/notification/ui',
    files: [
      'NotificationDropdown.integration.test.tsx',
      'NotificationItem.test.tsx',
      'NotificationsRealtimeListener.test.tsx'
    ],
    alias: '@features/notification/ui'
  }
];

fixes.forEach(group => {
  const fullDir = path.join(baseDir, group.dir);
  
  group.files.forEach(filename => {
    const filePath = path.join(fullDir, filename);
    if (!fs.existsSync(filePath)) {
      console.log(`Skipping missing file: ${filePath}`);
      return;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 1. Fix direct relative imports to component files sitting right beside them previously
    content = content.replace(/from "\.\/([^"]+)"/g, `from "${group.alias}/$1"`);
    
    // 2. Fix depth to test tools (render / server)
    const renderDepth = group.dir.split('/').length; 
    let prefix = '../'.repeat(renderDepth);
    
    content = content.replace(/from "\.\.\/\.\.\/\.\.\/test\/render"/g, `from "${prefix}render"`);
    content = content.replace(/from "\.\.\/\.\.\/\.\.\/test\/mocks\/server"/g, `from "${prefix}mocks/server"`);
    
    fs.writeFileSync(filePath, content);
    console.log(`Updated imports for ${filename}`);
  });
});
