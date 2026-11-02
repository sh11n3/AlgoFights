class Heap {
  values = [];
  push(node, priority) {
    const item = [node, priority];
    this.values.push(item);
    let i = this.values.length - 1;
    while (i) {
      const p = (i - 1) >> 1;
      if (this.values[p][1] <= priority) break;
      this.values[i] = this.values[p];
      i = p;
    }
    this.values[i] = item;
  }
  pop() {
    const first = this.values[0],
      last = this.values.pop();
    if (!this.values.length) return first;
    let i = 0;
    while (true) {
      let c = i * 2 + 1;
      if (c >= this.values.length) break;
      if (
        c + 1 < this.values.length &&
        this.values[c + 1][1] < this.values[c][1]
      )
        c++;
      if (this.values[c][1] >= last[1]) break;
      this.values[i] = this.values[c];
      i = c;
    }
    this.values[i] = last;
    return first;
  }
  peek() {
    return this.values[0];
  }
}

export function createQueue() {
  const heap = new Heap();
  const entry = (item) => (item ? { node: item[0], priority: item[1] } : null);
  return Object.freeze({
    push(node, priority) {
      if (!Number.isInteger(node) || !Number.isFinite(priority))
        throw new Error(
          "queue.push erwartet eine Knoten-ID und eine endliche Priorität.",
        );
      heap.push(node, priority);
    },
    pop: () => entry(heap.pop()),
    peek: () => entry(heap.peek()),
  });
}
