type SetStateInternal<T> = (
  partial: T | Partial<T> | ((state: T) => T | Partial<T>) | void,
  replace?: boolean | undefined
) => void;

interface StoreApi<T> {
  getState: () => T;
  setState: SetStateInternal<T>;
  // 參數是監聽改變後，需要執行的函式，返回取消訂閱的函式
  subscribe: (listener: (state: T, prevState: T) => void) => () => void;
  // 取消訂閱的函式
  destory: () => void;
  getInitialState: () => T;
}

export type StateCreator<T> = (
  setState: StoreApi<T>["setState"],
  getState: StoreApi<T>["getState"],
  store: StoreApi<T>
) => T;

// 「重載簽名」寫法
type CreateStore = {
  // 返回StoreApi<T>
  <T>(createState: StateCreator<T>): StoreApi<T>;
  // 返回一個新函數。這個新函數接受 createState，並返回 StoreApi<T>
  <T>(): (createState: StateCreator<T>) => StoreApi<T>;
};
type CreateStoreImpl = <T>(createImpl: StateCreator<T>) => StoreApi<T>;

/**
 * 這種寫法都要提供泛型，相較於上面的寫法，每次函數被調用時，泛型 T 都可以根據傳入的參數自動推導出來。
 * type CreateStoreImpl1<T> = (createImpl: StateCreator<T>) => StoreApi<T>;
 * 在使用 CreateStoreImpl1 時都要明確定義才行，很麻煩
 * const createStore: CreateStoreImpl1<{ count: number }> = (createImpl) => {
 *  return { getState: () => createImpl(() => {}) }; // 簡化實現
 * };
 * const createStore: CreateStoreImpl = (createImpl) => {
 *  return { getState: () => createImpl(() => {}) }; // 自動推導
 * };
 */

export const createStore = (<T>(createState: StateCreator<T>) => {
  return createState ? createStoreImpl(createState) : createStoreImpl;
}) as CreateStore;

const createStoreImpl: CreateStoreImpl = (createState) => {
  type Tstate = ReturnType<typeof createState>;
  type Listener = (statae: Tstate, prevState: Tstate) => void;
  let state: Tstate;
  const listeners: Set<Listener> = new Set();
  const getState: StoreApi<Tstate>["getState"] = () => {
    return state;
  };
  const setState: StoreApi<Tstate>["setState"] = (partial, replace) => {
    const prevState = state;
    const nextState =
      typeof partial === "function"
        ? (partial as (state: Tstate) => Tstate | Partial<Tstate>)(state)
        : partial;
    // 會做校驗，有沒有改變
    if (!Object.is(nextState, state)) {
      state =
        replace ?? typeof nextState !== "object"
          ? (nextState as Tstate)
          : (Object.assign({}, state, nextState) as Tstate); // 合併
      listeners.forEach((l) => l(state, prevState));
    }
  };
  const subscribe: StoreApi<Tstate>["subscribe"] = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const destory: StoreApi<Tstate>["destory"] = () => {
    listeners.clear();
  };

  const api = { getState, setState, subscribe, destory, getInitialState };
  const initialState = (state = createState(setState, getState, api));
  function getInitialState(): ReturnType<StoreApi<Tstate>["getInitialState"]> {
    return initialState;
  }

  return api;
};
