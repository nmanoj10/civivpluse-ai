import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import connectDB, { closeDB } from './server/config/db';
import { User } from './server/modules/users/user.model';
import { CitizenScore } from './server/modules/users/citizenScore.model';
import { Issue } from './server/modules/issues/issue.model';
import { MasterIssue } from './server/modules/issues/masterIssue.model';
import { Department } from './server/modules/assignments/department.model';
import { Ward } from './server/modules/assignments/ward.model';
import { ManualReview } from './server/modules/admin/manualReview.model';
import { Resolution } from './server/modules/resolutions/resolution.model';
import { USER_ROLES, ISSUE_STATUS, SEVERITY_LEVELS, RESOLUTION_STATUS } from './server/config/constants';

// Helper: create a MasterIssue and link the Issue to it
const createMasterIssueFor = async (issue: any) => {
  const master = await MasterIssue.create({
    title: issue.title,
    description: issue.description,
    category: issue.reportedCategory || issue.predictedCategory || 'Other',
    location: issue.location,
    supporterCount: 1,
    reportCount: 1,
    duplicateCount: 0,
    evidenceCount: 0,
    verificationCount: 0,
    priorityScore: issue.priorityScore || 0,
    trustScore: issue.trustScore || 0,
    status: 'Open'
  });
  await Issue.findByIdAndUpdate(issue._id, { masterIssueId: master._id });
};

export async function seed() {
  console.log('Clearing old database collections...');
  await User.deleteMany({});
  await CitizenScore.deleteMany({});
  await Issue.deleteMany({});
  await Department.deleteMany({});
  await Ward.deleteMany({});
  await ManualReview.deleteMany({});
  await Resolution.deleteMany({});

  console.log('Generating password hash...');
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password123', salt);

  console.log('Creating Admin Account...');
  const admin = await User.create({
    name: 'Admin Moderator',
    email: 'admin@civicpulse.ai',
    passwordHash,
    role: USER_ROLES.ADMIN,
    isVerified: true
  });

  console.log('Creating Departments...');
  const roadsDept = await Department.create({
    name: 'Roads & Transport Department',
    issueCategoriesHandled: ['Road & Transport'],
    city: 'Metropolis'
  });

  const waterDept = await Department.create({
    name: 'Water & Sanitation Board',
    issueCategoriesHandled: ['Water & Sanitation'],
    city: 'Metropolis'
  });

  const wasteDept = await Department.create({
    name: 'Solid Waste Management',
    issueCategoriesHandled: ['Waste Management'],
    city: 'Metropolis'
  });

  console.log('Creating Officers & Wards...');
  const officer1 = await User.create({
    name: 'Officer John (Roads)',
    email: 'officer.john@civicpulse.ai',
    passwordHash,
    role: USER_ROLES.WARD_OFFICER,
    city: 'Metropolis',
    ward: 'Ward 1',
    department: 'Road Maintenance',
    isVerified: true
  });

  const officer2 = await User.create({
    name: 'Officer Sarah (Water)',
    email: 'officer.sarah@civicpulse.ai',
    passwordHash,
    role: USER_ROLES.WARD_OFFICER,
    city: 'Metropolis',
    ward: 'Ward 2',
    department: 'Water Supply',
    isVerified: true
  });

  await Ward.create({
    wardName: 'Ward 1',
    wardCode: 'W01',
    city: 'Metropolis',
    officers: [officer1._id]
  });

  await Ward.create({
    wardName: 'Ward 2',
    wardCode: 'W02',
    city: 'Metropolis',
    officers: [officer2._id]
  });

  console.log('Creating Citizens & Reputation Profiles...');
  const citizen1 = await User.create({
    name: 'Alice Citizen',
    email: 'alice@example.com',
    passwordHash,
    role: USER_ROLES.CITIZEN,
    city: 'Metropolis',
    ward: 'Ward 1',
    isVerified: true
  });
  await CitizenScore.create({ userId: citizen1._id, trustScore: 85, contributionPoints: 240, level: 2 });

  const citizen2 = await User.create({
    name: 'Bob Resident',
    email: 'bob@example.com',
    passwordHash,
    role: USER_ROLES.CITIZEN,
    city: 'Metropolis',
    ward: 'Ward 2',
    isVerified: true
  });
  await CitizenScore.create({ userId: citizen2._id, trustScore: 60, contributionPoints: 50, level: 1 });

  const citizen3 = await User.create({
    name: 'Charlie Active',
    email: 'charlie@example.com',
    passwordHash,
    role: USER_ROLES.CITIZEN,
    city: 'Metropolis',
    ward: 'Ward 1',
    isVerified: true
  });
  await CitizenScore.create({ userId: citizen3._id, trustScore: 95, contributionPoints: 400, level: 3 });

  console.log('Creating Multi-Stage Sample Issues...');

  // 1. Issue: OPEN_FOR_COMMUNITY_VERIFICATION (Needs votes from other citizens)
  const issue1 = await Issue.create({
    reportedBy: citizen1._id,
    title: 'Damaged sidewalk near Central Park',
    description: 'The concrete slabs have raised, causing a major tripping hazard for pedestrians.',
    reportedCategory: 'Road & Transport',
    predictedCategory: 'Road & Transport',
    location: {
      lat: 12.9716,
      lng: 77.5946,
      address: 'MG Road, Central Park West',
      ward: 'Ward 1',
      city: 'Metropolis',
      geoJSON: { type: 'Point', coordinates: [77.5946, 12.9716] }
    },
    status: ISSUE_STATUS.OPEN_FOR_COMMUNITY_VERIFICATION,
    trustScore: 70,
    severity: SEVERITY_LEVELS.LOW,
    priorityScore: 20,
    supportCount: 1,
    rejectCount: 0,
    assignedOfficer: officer1._id,
    assignedDepartment: roadsDept._id,
    assignment: {
      departmentId: roadsDept._id,
      wardId: (await Ward.findOne({ wardName: 'Ward 1' }))?._id,
      officerId: officer1._id
    },
    assignedAt: new Date()
  });
  await createMasterIssueFor(issue1);

  // 2. Issue: COMMUNITY_VERIFIED (Ready to be assigned/processed by system)
  const issue2 = await Issue.create({
    reportedBy: citizen3._id,
    title: 'Massive pothole on Main St',
    description: 'This pothole is ruining tires and causing accidents. Needs immediate fixing.',
    reportedCategory: 'Road & Transport',
    predictedCategory: 'Road & Transport',
    location: {
      lat: 12.9720,
      lng: 77.5950,
      address: 'Main St & 3rd Ave, Ward 1',
      ward: 'Ward 1',
      city: 'Metropolis',
      geoJSON: { type: 'Point', coordinates: [77.5950, 12.9720] }
    },
    status: ISSUE_STATUS.COMMUNITY_VERIFIED,
    trustScore: 92,
    severity: SEVERITY_LEVELS.HIGH,
    priorityScore: 75,
    supportCount: 4,
    rejectCount: 0,
    assignedOfficer: officer1._id,
    assignedDepartment: roadsDept._id,
    assignment: {
      departmentId: roadsDept._id,
      wardId: (await Ward.findOne({ wardName: 'Ward 1' }))?._id,
      officerId: officer1._id
    },
    assignedAt: new Date()
  });
  await createMasterIssueFor(issue2);

  // 3. Issue: IN_PROGRESS (Officer is resolving it)
  const issue3 = await Issue.create({
    reportedBy: citizen2._id,
    title: 'Leaking fire hydrant',
    description: 'Water spraying everywhere since yesterday. Causing localized street flooding.',
    reportedCategory: 'Water & Sanitation',
    predictedCategory: 'Water & Sanitation',
    location: {
      lat: 12.9738,
      lng: 77.5950,
      address: '2nd Ave & B St, Ward 2',
      ward: 'Ward 2',
      city: 'Metropolis',
      geoJSON: { type: 'Point', coordinates: [77.5950, 12.9738] }
    },
    status: ISSUE_STATUS.IN_PROGRESS,
    trustScore: 88,
    severity: SEVERITY_LEVELS.MEDIUM,
    priorityScore: 40,
    supportCount: 3,
    rejectCount: 0,
    assignment: {
      departmentId: waterDept._id,
      officerId: officer2._id
    },
    assignedOfficer: officer2._id,
    assignedDepartment: waterDept._id,
    assignedAt: new Date(Date.now() - 86400000)
  });
  await createMasterIssueFor(issue3);

  // 4. Issue: PENDING_CITIZEN_CONFIRMATION (Resolution submitted, awaiting confirmation)
  const issue4 = await Issue.create({
    reportedBy: citizen1._id,
    title: 'Broken streetlight on Elm St',
    description: 'The light is out completely, making the alley dark and unsafe at night.',
    reportedCategory: 'Road & Transport',
    predictedCategory: 'Road & Transport',
    location: {
      lat: 12.9715,
      lng: 77.5940,
      address: '456 Elm St, Ward 1',
      ward: 'Ward 1',
      city: 'Metropolis',
      geoJSON: { type: 'Point', coordinates: [77.5940, 12.9715] }
    },
    status: ISSUE_STATUS.PENDING_CITIZEN_CONFIRMATION,
    trustScore: 95,
    severity: SEVERITY_LEVELS.MEDIUM,
    priorityScore: 50,
    supportCount: 2,
    rejectCount: 0,
    assignment: {
      departmentId: roadsDept._id,
      officerId: officer1._id
    },
    assignedOfficer: officer1._id,
    assignedDepartment: roadsDept._id,
    assignedAt: new Date(Date.now() - 172800000)
  });
  await createMasterIssueFor(issue4);

  await Resolution.create({
    issueId: issue4._id,
    officerId: officer1._id,
    departmentId: roadsDept._id,
    wardId: await Ward.findOne({ wardName: 'Ward 1' }).then(w => w?._id),
    resolutionStatus: RESOLUTION_STATUS.SUBMITTED,
    workSummary: 'Replaced the blown bulb and updated the photocell unit.',
    internalNotes: 'Standard maintenance task completed.',
    estimatedCost: 150,
    contractorDetails: 'Internal Municipal Crew',
    resolvedAt: new Date(Date.now() - 3600000),
    submittedAt: new Date(Date.now() - 3600000)
  });

  // 5. Issue: NEEDS_MANUAL_REVIEW (Awaiting Admin action in the moderation queue)
  const flaggedIssue = await Issue.create({
    reportedBy: citizen2._id,
    title: 'Suspected duplicate garbage dump report',
    description: 'Illegal dumping has occurred behind the old warehouse.',
    reportedCategory: 'Waste Management',
    predictedCategory: 'Waste Management',
    location: {
      lat: 12.9750,
      lng: 77.5960,
      address: 'Warehouse Lane, Ward 2',
      ward: 'Ward 2',
      city: 'Metropolis',
      geoJSON: { type: 'Point', coordinates: [77.5960, 12.9750] }
    },
    status: ISSUE_STATUS.NEEDS_MANUAL_REVIEW,
    trustScore: 45,
    severity: SEVERITY_LEVELS.HIGH,
    priorityScore: 60,
    supportCount: 0,
    rejectCount: 2
  });
  await createMasterIssueFor(flaggedIssue);

  // Create corresponding ManualReview document
  await ManualReview.create({
    issueId: flaggedIssue._id,
    reason: 'AI detected high similarity with nearby garbage reports and flagged low user trust rating.',
    flags: ['DUPLICATE_POTENTIAL', 'LOW_TRUST_SCORE'],
    reviewStatus: 'PENDING'
  });

  // 6. Issue: CLOSED_RESOLVED (Historical issue)
  const issue6 = await Issue.create({
    reportedBy: citizen3._id,
    title: 'Clogged storm drain on Oak Dr',
    description: 'Leaves and debris are blocking the drain inlet, causing massive puddles.',
    reportedCategory: 'Water & Sanitation',
    predictedCategory: 'Water & Sanitation',
    location: {
      lat: 12.9780,
      lng: 77.6000,
      address: 'Oak Dr, Ward 1',
      ward: 'Ward 1',
      city: 'Metropolis',
      geoJSON: { type: 'Point', coordinates: [77.6000, 12.9780] }
    },
    status: ISSUE_STATUS.CLOSED_RESOLVED,
    trustScore: 90,
    severity: SEVERITY_LEVELS.MEDIUM,
    priorityScore: 35,
    supportCount: 3,
    rejectCount: 0,
    assignment: {
      departmentId: waterDept._id,
      officerId: officer1._id
    },
    assignedOfficer: officer1._id,
    assignedDepartment: waterDept._id,
    assignedAt: new Date(Date.now() - 172800000)
  });
  await createMasterIssueFor(issue6);

  await Resolution.create({
    issueId: issue6._id,
    officerId: officer1._id,
    departmentId: waterDept._id,
    wardId: await Ward.findOne({ wardName: 'Ward 1' }).then(w => w?._id),
    resolutionStatus: RESOLUTION_STATUS.ACCEPTED,
    workSummary: 'Cleared storm drain line using vacuum truck.',
    estimatedCost: 350,
    contractorDetails: 'Hydro-Clean Inc.',
    resolvedAt: new Date(Date.now() - 86400000),
    submittedAt: new Date(Date.now() - 86400000)
  });

  console.log('Database seeded successfully with rich multi-stage data!');
}

const isMain = process.argv[1] && (process.argv[1].endsWith('seed.ts') || process.argv[1].endsWith('seed.js') || process.argv[1].endsWith('seed.cjs'));

if (isMain) {
  connectDB().then(() => seed()).then(() => closeDB()).then(() => process.exit(0)).catch(console.error);
}
