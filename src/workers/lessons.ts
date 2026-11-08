import { executeLesson } from "../lab/runtime.js";
import type { LabInput } from "../lab/types";
self.onmessage = ({
  data,
}: MessageEvent<{ input: LabInput; source: string; limit: number }>) => {
  try {
    self.postMessage({
      result: executeLesson(data.input, data.source, data.limit),
    });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
