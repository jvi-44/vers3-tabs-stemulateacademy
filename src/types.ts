export type LessonType = 'video' | 'quiz' | 'summary' | 'activity' | 'simulation';

export interface STEMbot {
  name: string;
  role: string;
  discipline: 'Science' | 'Technology' | 'Engineering' | 'Mathematics';
  avatar: string;
  color: string;
  hobbies: string[];
  funFact: string;
  interests: string[];
}

export interface SimulationData {
  type: 'slider' | 'drag-drop';
  title: string;
  description: string;
  options: any;
}

export interface LessonContent {
  id: string;
  type: LessonType;
  title: string;
  duration?: string;
  xp: number;
  completed: boolean;
  videoUrl?: string;
  quizQuestions?: {
    question: string;
    options: string[];
    correctAnswer: number;
  }[];
  summaryText?: string;
  simulation?: SimulationData;
  topics?: {
    subject: string;
    description: string;
    level: string; // e.g. "Primary 3-4"
  }[];
}

export interface TopicTag {
  id: string;
  label: string;
  subject: 'Science' | 'Technology' | 'Engineering' | 'Mathematics';
}

export interface Module {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  progress: number;
  contents: LessonContent[];
  tags: TopicTag[];
}

export interface Course {
  id: string;
  title: string;
  icon: string;
  color: string;
  modules: Module[];
  locked?: boolean;
}

export interface User {
  username: string;
  avatar: string;
  xp: number;
  level: number;
  badges: Badge[];
  atoms: number;
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  earnedAt?: string;
}

export interface GalleryPost {
  id: string;
  username: string;
  avatar: string;
  imageUrl: string;
  caption: string;
  likes: number;
  tags: string[];
}

export interface LeaderboardEntry {
  id: string;
  username: string;
  avatar: string;
  xp: number;
  rank: number;
}

export interface Card {
  id: string;
  name: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  category: 'scientist' | 'phenomenon' | 'funfact';
  imageUrl: string;
  description: string;
  fact?: string;
}

export interface CardPack {
  id: string;
  name: string;
  cost: number;
  cardsCount: number;
  description: string;
}