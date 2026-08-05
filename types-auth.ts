// Auth-related types — merge these into your existing src/types.ts

export interface ReferenceOption {
  id: number;
  name: string;
}

export interface ReferenceData {
  organisations: ReferenceOption[];
  schoolLevels: ReferenceOption[];
  recoveryColours: ReferenceOption[];
  recoverySubjects: ReferenceOption[];
}

export interface AuthUser {
  userId: number;
  fullName: string;
  username: string;
  schoolLevelId: number;
  orgId: number;
  xp: number;
  level: number;
  atoms: number;
  avatar: string | null;
}

export interface SignupPayload {
  fullName: string;
  schoolLevelId: number;
  orgId: number;
  username: string;
  pin: string;
  recoveryColourId: number;
  recoverySubjectId: number;
}
