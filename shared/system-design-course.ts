export type DesignStepKind = 'PROBLEM' | 'CONCEPT' | 'CASE' | 'RECAP';

export type DesignFlight = {
  a: string;
  b: string;
  kind: 'req' | 'res' | 'hs';
  delay: number;
  dur: number;
  label?: string;
};

export type DesignStep = {
  name: string;
  kind: DesignStepKind;
  title: string;
  body: string[];
  key: string;
  add?: string[];
  focus?: string[];
  alert?: string[];
  flights?: DesignFlight[];
  metrics?: Record<string, number>;
  note?: string;
  loop?: boolean;
  unitNote?: boolean;
};

export type DesignNode = { id: string; type: string; x: number; y: number; label?: string; icn?: string };
export type DesignScene = { nodes: DesignNode[]; edges: [string, string][] };
export type DesignMetric = { id: string; label: string; icn: string; unit: string };
export type DesignLesson = {
  minutes: number;
  outcomes: string[];
  metrics: DesignMetric[];
  scene: DesignScene;
  steps: DesignStep[];
};

export type DesignCourseModule = {
  num: string;
  title: string;
  color: string;
  lessons: (Omit<DesignLesson, 'scene'> & {
    id: string;
    title: string;
    level: 'Beginner' | 'Intermediate' | 'Advanced';
    summary: string;
    scene: string;
  })[];
};
