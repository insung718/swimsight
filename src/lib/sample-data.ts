import type { Athlete, Goal, SwimResult, TeamMemberAnalytics } from "@/types/swim";

export const demoUserId = "demo-athlete";

export const sampleSwims: SwimResult[] = [
  {
    id: "swim-001",
    userId: demoUserId,
    date: "2025-02-15",
    event: "50 Freestyle",
    course: "LCM",
    timeSeconds: 28.4,
    meetName: "BIS Invitational"
  },
  {
    id: "swim-002",
    userId: demoUserId,
    date: "2025-05-20",
    event: "50 Freestyle",
    course: "LCM",
    timeSeconds: 27.72,
    meetName: "HCMC City Series"
  },
  {
    id: "swim-003",
    userId: demoUserId,
    date: "2025-09-11",
    event: "50 Freestyle",
    course: "LCM",
    timeSeconds: 26.64,
    meetName: "Dragon Sprint Classic"
  },
  {
    id: "swim-004",
    userId: demoUserId,
    date: "2026-03-16",
    event: "50 Freestyle",
    course: "LCM",
    timeSeconds: 25.56,
    meetName: "BIS HCMC Time Trial"
  },
  {
    id: "swim-005",
    userId: demoUserId,
    date: "2025-02-15",
    event: "50 Butterfly",
    course: "LCM",
    timeSeconds: 30.1,
    meetName: "BIS Invitational"
  },
  {
    id: "swim-006",
    userId: demoUserId,
    date: "2025-06-05",
    event: "50 Butterfly",
    course: "LCM",
    timeSeconds: 29.18,
    meetName: "Saigon Aquatics Cup"
  },
  {
    id: "swim-007",
    userId: demoUserId,
    date: "2025-11-08",
    event: "50 Butterfly",
    course: "LCM",
    timeSeconds: 28.06,
    meetName: "International Schools Meet"
  },
  {
    id: "swim-008",
    userId: demoUserId,
    date: "2026-03-16",
    event: "50 Butterfly",
    course: "LCM",
    timeSeconds: 27.46,
    meetName: "BIS HCMC Time Trial"
  },
  {
    id: "swim-009",
    userId: demoUserId,
    date: "2025-02-15",
    event: "100 Butterfly",
    course: "LCM",
    timeSeconds: 69.54,
    meetName: "BIS Invitational"
  },
  {
    id: "swim-010",
    userId: demoUserId,
    date: "2025-05-20",
    event: "100 Butterfly",
    course: "LCM",
    timeSeconds: 67.9,
    meetName: "HCMC City Series"
  },
  {
    id: "swim-011",
    userId: demoUserId,
    date: "2025-09-11",
    event: "100 Butterfly",
    course: "LCM",
    timeSeconds: 65.75,
    meetName: "Dragon Sprint Classic"
  },
  {
    id: "swim-012",
    userId: demoUserId,
    date: "2026-03-16",
    event: "100 Butterfly",
    course: "LCM",
    timeSeconds: 63.8,
    meetName: "BIS HCMC Time Trial"
  },
  {
    id: "swim-013",
    userId: demoUserId,
    date: "2025-04-04",
    event: "100 Freestyle",
    course: "LCM",
    timeSeconds: 62.4,
    meetName: "Spring Schools Relay"
  },
  {
    id: "swim-014",
    userId: demoUserId,
    date: "2025-10-18",
    event: "100 Freestyle",
    course: "LCM",
    timeSeconds: 59.9,
    meetName: "Autumn Sprint Meet"
  },
  {
    id: "swim-015",
    userId: demoUserId,
    date: "2026-02-21",
    event: "100 Freestyle",
    course: "LCM",
    timeSeconds: 58.72,
    meetName: "Mekong Open"
  },
  {
    id: "swim-016",
    userId: demoUserId,
    date: "2025-05-20",
    event: "200 Freestyle",
    course: "LCM",
    timeSeconds: 138.4,
    meetName: "HCMC City Series"
  },
  {
    id: "swim-017",
    userId: demoUserId,
    date: "2025-11-08",
    event: "200 Freestyle",
    course: "LCM",
    timeSeconds: 133.2,
    meetName: "International Schools Meet"
  },
  {
    id: "swim-018",
    userId: demoUserId,
    date: "2026-02-21",
    event: "200 Freestyle",
    course: "LCM",
    timeSeconds: 130.65,
    meetName: "Mekong Open"
  },
  {
    id: "swim-019",
    userId: demoUserId,
    date: "2025-06-05",
    event: "100 Backstroke",
    course: "LCM",
    timeSeconds: 72.3,
    meetName: "Saigon Aquatics Cup"
  },
  {
    id: "swim-020",
    userId: demoUserId,
    date: "2025-10-18",
    event: "100 Backstroke",
    course: "LCM",
    timeSeconds: 71.85,
    meetName: "Autumn Sprint Meet"
  },
  {
    id: "swim-021",
    userId: demoUserId,
    date: "2026-02-21",
    event: "100 Backstroke",
    course: "LCM",
    timeSeconds: 71.4,
    meetName: "Mekong Open"
  },
  {
    id: "swim-022",
    userId: demoUserId,
    date: "2025-04-04",
    event: "200 IM",
    course: "LCM",
    timeSeconds: 154.9,
    meetName: "Spring Schools Relay"
  },
  {
    id: "swim-023",
    userId: demoUserId,
    date: "2025-09-11",
    event: "200 IM",
    course: "LCM",
    timeSeconds: 151.1,
    meetName: "Dragon Sprint Classic"
  },
  {
    id: "swim-024",
    userId: demoUserId,
    date: "2026-02-21",
    event: "200 IM",
    course: "LCM",
    timeSeconds: 148.9,
    meetName: "Mekong Open"
  }
];

export const sampleGoals: Goal[] = [
  {
    id: "goal-001",
    userId: demoUserId,
    event: "100 Butterfly",
    targetTime: 59,
    targetDate: "2027-03-01"
  }
];

export const sampleAthletes: Athlete[] = [
  { id: "athlete-001", name: "InSung Park", age: 16, role: "Captain" },
  { id: "athlete-002", name: "Mina Tran", age: 15, role: "Athlete" },
  { id: "athlete-003", name: "Alex Nguyen", age: 14, role: "Athlete" },
  { id: "athlete-004", name: "Leo Kim", age: 17, role: "Athlete" }
];

export const sampleTeamAnalytics: TeamMemberAnalytics[] = [
  {
    id: "athlete-001",
    name: "InSung Park",
    age: 16,
    role: "Captain",
    primaryEvent: "100 Butterfly",
    swimPowerIndex: 87,
    totalImprovementPercent: 8.25,
    fastestEventTime: 25.56
  },
  {
    id: "athlete-002",
    name: "Mina Tran",
    age: 15,
    role: "Athlete",
    primaryEvent: "200 Freestyle",
    swimPowerIndex: 81,
    totalImprovementPercent: 6.9,
    fastestEventTime: 29.18
  },
  {
    id: "athlete-003",
    name: "Alex Nguyen",
    age: 14,
    role: "Athlete",
    primaryEvent: "50 Freestyle",
    swimPowerIndex: 76,
    totalImprovementPercent: 7.4,
    fastestEventTime: 26.02
  },
  {
    id: "athlete-004",
    name: "Leo Kim",
    age: 17,
    role: "Athlete",
    primaryEvent: "100 Backstroke",
    swimPowerIndex: 72,
    totalImprovementPercent: 4.1,
    fastestEventTime: 27.9
  }
];
