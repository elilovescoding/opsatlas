export type Role = 'VIEWER' | 'OPERATOR' | 'ADMIN';
export type Environment = 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';
export type HealthState = 'UNKNOWN' | 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';
export type HealthTarget = 'NONE' | 'DEMO_API' | 'DEMO_QUEUE' | 'DEMO_STORAGE';
export type IncidentStatus = 'INVESTIGATING' | 'IDENTIFIED' | 'MONITORING' | 'RESOLVED';
export type Severity = 'SEV1' | 'SEV2' | 'SEV3' | 'SEV4';
export type DeploymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'ROLLED_BACK';
export interface User {
  id: string;
  email: string;
  displayName: string;
  role: Role;
}
export interface Slice<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
  pages: number;
}
export interface Service {
  id: string;
  name: string;
  description: string;
  environment: Environment;
  owner: string;
  archived: boolean;
  publicVisible: boolean;
  demo: boolean;
  healthTarget: HealthTarget;
  healthState: HealthState;
  responseMs: number | null;
  checkedAt: string | null;
  createdAt: string;
}
export interface Deployment {
  id: string;
  serviceId: string;
  version: string;
  environment: Environment;
  status: DeploymentStatus;
  notes: string;
  createdAt: string;
}
export interface Incident {
  id: string;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  serviceIds: string[];
  assignee: string;
  deploymentId: string | null;
  rootCause: string;
  resolution: string;
  createdAt: string;
  resolvedAt: string | null;
}
export interface IncidentUpdate {
  id: string;
  message: string;
  status: IncidentStatus;
  author: string;
  createdAt: string;
}
export interface HealthResult {
  id: string;
  state: HealthState;
  responseMs: number;
  httpStatus: number | null;
  checkedAt: string;
}
export interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  resourceId: string | null;
  detail: string;
  createdAt: string;
}
export interface Dashboard {
  generatedAt: string;
  demonstration: boolean;
  services: { total: number; healthy: number; unhealthy: number; unknown: number; stale: number };
  incidents: { active: number; resolved: number; mttr_minutes: number | null };
  latency: { time: string; ms: number; samples: number }[];
  trends: { day: string; opened: number }[];
  runtime: { health_samples_24h: number; failed_samples_24h: number };
}
export interface PublicStatus {
  generatedAt: string;
  demonstration: boolean;
  services: {
    id: string;
    name: string;
    environment: Environment;
    demo: boolean;
    state: HealthState;
    checkedAt: string | null;
  }[];
}
