import { shallowRef } from "vue";
import { readExample, type Example } from "./examples";
export const lectureSelection = shallowRef<Example>();
export function useInLecture(example: Example) {
  lectureSelection.value = readExample(example);
  location.hash = "vorlesung";
}
