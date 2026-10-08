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
  // Only returned by /api/me (the signed-in user's own profile).
  orgName?: string;
  schoolLevelName?: string;
  createdAt?: string;
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
