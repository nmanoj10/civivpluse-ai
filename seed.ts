import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import connectDB, { closeDB } from './server/config/db';
import { User } from './server/modules/users/user.model';
import { CitizenScore } from './server/modules/users/citizenScore.model';
import { Issue } from './server/modules/issues/issue.model';
import { Department } from './server/modules/assignments/department.model';
import { Ward } from './server/modules/assignments/ward.model';
import { ManualReview } from './server/modules/admin/manualReview.model';
import { Resolution } from './server/modules/resolutions/resolution.model';
import { USER_ROLES, ISSUE_STATUS, SEVERITY_LEVELS, RESOLUTION_STATUS } from './server/config/constants';

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
    isVerified: true
  });

  const officer2 = await User.create({
    name: 'Officer Sarah (Water)',
    email: 'officer.sarah@civicpulse.ai',
    passwordHash,
    role: USER_ROLES.WARD_OFFICER,
    city: 'Metropolis',
    ward: 'Ward 2',
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
  await Issue.create({
    reportedBy: citizen1._id,
    title: 'Damaged sidewalk near Central Park',
    description: 'The concrete slabs have raised, causing a major tripping hazard for pedestrians.',
    reportedCategory: 'Road & Transport',
    predictedCategory: 'Road & Transport',
    location: {
      lat: 40.7128,
      lng: -74.0060,
      address: 'Central Park West',
      ward: 'Ward 1',
      city: 'Metropolis',
      geoJSON: { type: 'Point', coordinates: [-74.0060, 40.7128] }
    },
    status: ISSUE_STATUS.OPEN_FOR_COMMUNITY_VERIFICATION,
    trustScore: 70,
    severity: SEVERITY_LEVELS.LOW,
    priorityScore: 20
  });

  // 2. Issue: COMMUNITY_VERIFIED (Ready to be assigned/processed by system)
  await Issue.create({
    reportedBy: citizen3._id,
    title: 'Massive pothole on Main St',
    description: 'This pothole is ruining tires and causing accidents. Needs immediate fixing.',
    reportedCategory: 'Road & Transport',
    predictedCategory: 'Road & Transport',
    location: {
      lat: 40.7130,
      lng: -74.0070,
      address: 'Main St & 3rd Ave',
      ward: 'Ward 1',
      city: 'Metropolis',
      geoJSON: { type: 'Point', coordinates: [-74.0070, 40.7130] }
    },
    status: ISSUE_STATUS.COMMUNITY_VERIFIED,
    trustScore: 92,
    severity: SEVERITY_LEVELS.HIGH,
    priorityScore: 75
  });

  // 3. Issue: IN_PROGRESS (Officer is resolving it)
  await Issue.create({
    reportedBy: citizen2._id,
    title: 'Leaking fire hydrant',
    description: 'Water spraying everywhere since yesterday. Causing localized street flooding.',
    reportedCategory: 'Water & Sanitation',
    predictedCategory: 'Water & Sanitation',
    location: {
      lat: 40.7138,
      lng: -74.0050,
      address: '2nd Ave & B St',
      ward: 'Ward 2',
      city: 'Metropolis',
      geoJSON: { type: 'Point', coordinates: [-74.0050, 40.7138] }
    },
    status: ISSUE_STATUS.IN_PROGRESS,
    trustScore: 88,
    severity: SEVERITY_LEVELS.MEDIUM,
    priorityScore: 40,
    assignment: {
      departmentId: waterDept._id,
      officerId: officer2._id
    }
  });

  // 4. Issue: PENDING_CITIZEN_CONFIRMATION (Resolution submitted, awaiting confirmation)
  const issue4 = await Issue.create({
    reportedBy: citizen1._id,
    title: 'Broken streetlight on Elm St',
    description: 'The light is out completely, making the alley dark and unsafe at night.',
    reportedCategory: 'Road & Transport',
    predictedCategory: 'Road & Transport',
    location: {
      lat: 40.7115,
      lng: -74.0090,
      address: '456 Elm St',
      ward: 'Ward 1',
      city: 'Metropolis',
      geoJSON: { type: 'Point', coordinates: [-74.0090, 40.7115] }
    },
    status: ISSUE_STATUS.PENDING_CITIZEN_CONFIRMATION,
    trustScore: 95,
    severity: SEVERITY_LEVELS.MEDIUM,
    priorityScore: 50,
    assignment: {
      departmentId: roadsDept._id,
      officerId: officer1._id
    }
  });

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
      lat: 40.7150,
      lng: -74.0020,
      address: 'Warehouse Lane',
      ward: 'Ward 2',
      city: 'Metropolis',
      geoJSON: { type: 'Point', coordinates: [-74.0020, 40.7150] }
    },
    status: ISSUE_STATUS.NEEDS_MANUAL_REVIEW,
    trustScore: 45,
    severity: SEVERITY_LEVELS.HIGH,
    priorityScore: 60
  });

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
      lat: 40.7180,
      lng: -74.0010,
      address: 'Oak Dr',
      ward: 'Ward 1',
      city: 'Metropolis',
      geoJSON: { type: 'Point', coordinates: [-74.0010, 40.7180] }
    },
    status: ISSUE_STATUS.CLOSED_RESOLVED,
    trustScore: 90,
    severity: SEVERITY_LEVELS.MEDIUM,
    priorityScore: 35,
    assignment: {
      departmentId: waterDept._id,
      officerId: officer1._id
    }
  });

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
