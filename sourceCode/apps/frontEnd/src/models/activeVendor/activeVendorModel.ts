export type AssignmentStatus = 'New' | 'Accepted' | 'In Progress' | 'Completed' | 'Declined';

export interface VendorAssignment {
  assignmentId: string;
  claimNumber:  string;
  companyName:  string;
  service:      string;
  serviceId:    string;
  assignedDate: string;
  dueDate:      string;
  status:       AssignmentStatus;
  startedAt:    string;
  completedAt:  string;
  notes:        string;
}

export interface ClientPerf {
  companyName: string;
  total:       number;
  completed:   number;
  slaHit:      number;
  avgCycle:    number;
  score:       number | null;
}

export interface ServicePerf {
  service:   string;
  serviceId: string;
  volume:    number;
  slaHit:    number;
  avgCycle:  number;
  score:     number | null;
}

export interface VendorPerformance {
  overallScore:          number;
  panelMedian:           number;
  totalAssignments:      number;
  completedAssignments:  number;
  inProgressAssignments: number;
  activeAssignments:     number;
  slaCompliance:         number;
  avgCycleTime:          number;
  byClient:              ClientPerf[];
  byService:             ServicePerf[];
  requalDue:             string | null;
}
