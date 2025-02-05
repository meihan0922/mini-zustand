// import { create } from "zustand";
import { create } from "../mini-zustand/react";
import { immer } from "zustand/middleware/immer";

interface BearState {
  bears: number;
  increase: (by?: number) => void;
  decrease: (by?: number) => void;
  reset: () => void;

  count: number;
  increaseCount: () => void;
}

const useBearStore = create<BearState>()(
  immer((set) => ({
    bears: 0,
    increase: (by = 1) =>
      set((d) => {
        d.bears += by;
      }),
    decrease: (by = 1) =>
      set((d) => {
        d.bears -= by;
      }),
    reset: () =>
      set((d) => {
        d.bears = 0;
      }),
    count: 100,
    increaseCount: () =>
      set((d) => {
        d.count += 1;
      }),
  }))
);

export default useBearStore;
