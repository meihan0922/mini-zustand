import { StateCreator } from "../vanilla";
import { produce } from "immer";
type Immer = <T>(createState: StateCreator<T>) => StateCreator<T>;

export const immer: Immer = (createState) => (set, get, store) => {
  type T = ReturnType<typeof createState>;

  // src/mini-zustand/vanilla.ts
  // const initialState = (state = createState(setState, getState, api));
  // 就像是 redux 中間件去改變 store.dispatch 一樣
  // 這邊也是改變 zustand/vanilla 定義的 setState
  store.setState = (partial, replace, ...p) => {
    const nextState = (
      typeof partial === "function"
        ? produce(partial as any) // 沒有執行 partial(state) 只是再包一層
        : partial
    ) as (state: T) => T | Partial<T> | T;
    return set(nextState, replace, ...p);
  };
  return createState(store.setState, get, store);
};
