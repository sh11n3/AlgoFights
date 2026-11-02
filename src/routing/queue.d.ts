export interface Queue {
  push(node: number, priority: number): void;
  pop(): { node: number; priority: number } | null;
  peek(): { node: number; priority: number } | null;
}
export function createQueue(): Queue;
