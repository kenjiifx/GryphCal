export type Weekday =
  | "SU"
  | "MO"
  | "TU"
  | "WE"
  | "TH"
  | "FR"
  | "SA";

export interface Term {
  id: string;
  code: string;
  name: string;
  startDate?: string;
  endDate?: string;
}

export interface CourseSummary {
  id: string;
  code: string;
  title: string;
  subjectCode: string;
  number: string;
  matchingSectionIds: string[];
}

export interface Meeting {
  type: string;
  typeLabel: string;
  days: Weekday[];
  startTime?: string;
  endTime?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  isOnline: boolean;
  isTBA: boolean;
}

export interface Section {
  id: string;
  displayName: string;
  number: string;
  instructor?: string;
  deliveryMethod?: string;
  meetings: Meeting[];
}

export interface Course {
  term: string;
  id: string;
  code: string;
  title: string;
  description?: string;
  sections: Section[];
}

export interface SelectedSection {
  term: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  section: Section;
}

export interface CourseProvider {
  getTerms(): Promise<Term[]>;
  searchCourses(term: string, query: string): Promise<CourseSummary[]>;
  getCourseSections(term: string, courseCode: string): Promise<Course>;
}
