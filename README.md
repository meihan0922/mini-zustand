# mini-zustand

zustand 是狀態管理庫，是可以排除 react 單獨使用的。
redux, mobX 要搭配 react-redux, mobx-react 才能在 react 當中使用。
recoil 則是 react 狀態管理庫，無法單獨使用。

所以基本的文檔架構是：

- mini-zustand
  - index
  - react: 使用 `create`，結合 hooks
  - vanilla: 使用 `createStore`

## 基本使用

### 基本使用 - react

> src/store/useBearStore.ts

```ts
import { create } from "zustand";

interface BearState {
  bears: number;
  count: number;
  increase: (by?: number) => void;
  decrease: (by?: number) => void;
  reset: () => void;

  increaseCount: () => void;
}

const useBearStore = create<BearState>((set) => ({
  bears: 0,
  count: 100,
  increase: (by = 1) => set((state) => ({ bears: state.bears + by })),
  decrease: (by = 1) => set((state) => ({ bears: state.bears - by })),
  reset: () => set({ bears: 0 }),
  increaseCount: () => set((state) => ({ count: state.count + 1 })),
}));

export default useBearStore;
```

> src/pages/BearsPage.tsx

```ts
import useBearStore from "../store/useBearStore";

export default function BearsPage() {
  const { bears, count, increase, increaseCount, reset, decrease } =
    useBearStore();
  return (
    <div>
      <h3>BearsPage</h3>
      <button onClick={() => increase()}>increase: {bears}</button>
      <button onClick={() => decrease()}>decrease: {bears}</button>
      <button onClick={() => reset()}>reset</button>
      <button onClick={() => increaseCount()}>count: {count}</button>
    </div>
  );
}
```

### 基本使用 - vanilla

```ts
import { createStore } from 'zustand/vanilla'

const store = createStore((set) => ...)
const { getState, setState, subscribe, getInitialState } = store

export default store

// 使用
import { useStore } from 'zustand'
import { vanillaStore } from './vanillaStore'

const useBoundStore = (selector) => useStore(vanillaStore, selector)
```

## 實現

### vanilla - createStore

- 參數: 接受函式作為參數，並且此函式還有 set 和 get 作為參數。
- 回傳值: 有 `{ getState, setState, subscribe, destory }` 等方法。

```ts
type SetStateInternal<T> = (
  partial: T | Partial<T> | ((state: T) => T | Partial<T>),
  replace?: boolean | undefined
) => void;

interface StoreApi<T> {
  getState: () => T;
  // 傳入參數，可以是取代舊的狀態或是部分更新
  setState: SetStateInternal<T>;
  // 參數是監聽改變後，需要執行的函式，返回取消訂閱的函式
  subscribe: (listener: (state: T, prevState: T) => void) => () => void;
  // 取消訂閱的函式
  destory: () => void;
}

// 參數為函式，函式內的參數：
export type StateCreator<T> = (
  setState: StoreApi<T>["setState"],
  getState: StoreApi<T>["getState"],
  store: StoreApi<T>
) => T;
```

定義 `createStore`， 基本是這樣使用：`const store = createStore((set) => ...)`，又或者是回傳 `createStoreImpl` 也就是回傳建立狀態庫的函式，供使用者在之後創建。

```ts
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
  return { getState: () => createImpl(() => {}) }; // 簡化實現
};
```

實現 `createStore`，另外實現 `createStoreImpl`

```ts
export const createStore = (<T>(createState: StateCreator<T>) => {
  return createState ? createStoreImpl(createState) : createStoreImpl;
}) as CreateStore;
```

實現 `createStoreImpl`，先定義好回傳的函式和架構

```ts
const createStoreImpl: CreateStoreImpl = (createState) => {
  type Tstate = ReturnType<typeof createState>;
  let state: Tstate;

  const getState: StoreApi<Tstate>["getState"] = () => {};
  const setState: StoreApi<Tstate>["setState"] = () => {};
  const subscribe: StoreApi<Tstate>["subscribe"] = () => {};
  const destory: StoreApi<Tstate>["destory"] = () => {};

  const api = { getState, setState, subscribe, destory, getInitialState };
  // createState 接收 (set, get, store) 作為參數
  const initialState = (state = createState(setState, getState, api));
  function getInitialState(): ReturnType<StoreApi<Tstate>["getInitialState"]> {
    return initialState;
  }
  return api;
};
```

`getState` 最簡單

```ts
const getState: StoreApi<Tstate>["getState"] = () => {
  return state;
};
```

和 redux 很像，只是用 Set 物件來存放訂閱的函式

```ts
type Listener = (statae: Tstate, prevState: Tstate) => void;
const listeners: Set<Listener> = new Set();
const subscribe: StoreApi<Tstate>["subscribe"] = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const destory: StoreApi<Tstate>["destory"] = () => {
  listeners.clear();
};
```

接著是 `setState`，可以局部更新，或是取代更新：

```ts
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
```
