export type LabValue = number | string | boolean | null;
export interface LabArray {
  name: string;
  values: LabValue[];
  kind?: "nodes" | "colors";
  axis?: "position";
}
export interface LabMatrix {
  name: string;
  kind?: "nodes";
  values: LabValue[][];
  active?: number[];
  sources?: number[][];
}
export interface LabState {
  current?: number;
  edge?: number;
  colors?: number[];
  groups?: number[];
  selected?: number[];
  rejected?: number[];
  arrays?: LabArray[];
  matrices?: LabMatrix[];
  queue?: number[];
  stack?: number[];
  order?: number[];
  heap?: number[][];
  transpose?: boolean;
  string?: {
    i?: number;
    j?: number;
    offset?: number;
    length?: number;
    result?: string;
    marks?: number[][];
    edits?: string[];
    phase?: "pattern";
  };
}
export interface LabFrame {
  message: string;
  state: LabState;
}
export interface LabResult {
  frames: LabFrame[];
  result: string;
  limited: boolean;
  milliseconds: number;
}
export interface LessonOptions {
  power?: number;
  colorCount?: number;
  hamiltonCycle?: boolean;
  anchor?: number;
  third?: string;
}
export interface LabInput {
  kind: "graph" | "string";
  nodes: Array<{ id: number; label: string; x: number; y: number }>;
  edges: Array<{ from: number; to: number; weight: number }>;
  directed: boolean;
  start: number;
  target: number;
  mode: "source" | "target" | "all";
  s: string;
  t: string;
  options?: LessonOptions;
}
export interface Lesson {
  id: string;
  name: string;
  category: string;
  kind: "graph" | "string";
  introduction: string;
  prerequisites: string;
  formulas: string[];
  explanation: string;
  complexity: string;
  source: string;
  java: string;
  pseudocode: string;
}
export type LessonEntry = Omit<Lesson, "source" | "java" | "kind"> & {
  run: Function;
  kind?: Lesson["kind"];
};
