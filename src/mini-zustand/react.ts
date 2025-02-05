import { StoreApi, create as zustandCreate } from "zustand";
import { createStore } from "./vanilla";
import useSyncExternalStoreExports from "use-sync-external-store/shim/with-selector";
const { useSyncExternalStoreWithSelector } = useSyncExternalStoreExports;

type CreateType = ReturnType<typeof zustandCreate>;

// type Create = {
//   <T>(createState: StateCreator<T>): UseBoundStore<StoreApi<T>>;
//   <T>(): (createState: StateCreator<T>) => UseBoundStore<StoreApi<T>>;
// };

// infer 能從類型結構中推導出部分類型信息，在實現泛型工具類型（如提取函數返回類型、提取 Promise 結果類型等）時非常有用。
// 這裡的 infer T 的作用是從 S 的結構中提取出 getState 方法返回的類型，並將其賦值給 T
type ExtractState<S> = S extends {
  getState: () => infer T;
}
  ? T
  : never; // 不可能發生的情況

// 取得 "getState" | "subscribe" 方法
type ReadonlyStoreApi<T> = Pick<StoreApi<T>, "getState" | "subscribe">;
// 加入 getServerState 方法
type WithReact<S extends ReadonlyStoreApi<unknown>> = S & {
  getServerState?: () => ExtractState<S>;
};

// 可以直接返回狀態或是一個選擇器函數來返回部分狀態
export type UseBoundStore<S extends WithReact<ReadonlyStoreApi<unknown>>> = {
  (): ExtractState<S>; // 直接返回 store.getState() 整個狀態
  <U>(
    selector: (state: ExtractState<S>) => U, // 接受一個選擇器函數，從狀態中提取特定數據
    equals?: (a: U, b: U) => boolean
  ): U; // 返回選擇器提取的部分狀態
} & S; // 把 S 的屬性混入 UseBoundStore
// 這樣，UseBoundStore 不僅是一個函數，它還擁有 S 的所有屬性。
// 例如，S 本身可能包含一些方法（如 getState、setState 等），這些方法會被直接附加到 UseBoundStore 上。

export const create = function (createState) {
  return createState ? createImpl(createState) : createImpl;
} as CreateType;

function createImpl(createState) {
  const api =
    typeof createState === "function" ? createStore(createState) : createState;

  // 連接上 react
  const useBoundStore = (selector?: any) => useStore(api, selector);
  return useBoundStore;
}

function useStore<Tstate, StateSlice>(
  api: WithReact<StoreApi<Tstate>>,
  selector: (state: Tstate) => StateSlice = api.getState as any,
  equalityFn?: (a: StateSlice, b: StateSlice) => boolean
) {
  const slice = useSyncExternalStoreWithSelector(
    api.subscribe,
    api.getState,
    api.getServerState || api.getState,
    selector,
    equalityFn
  );
  return slice;
}
