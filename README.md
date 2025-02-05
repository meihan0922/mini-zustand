# mini-zustand

- zustand 是狀態管理庫，是可以排除 react 單獨使用的。
  - 需要額外搭配套件：redux - react-redux, mobX - mobx-react 才能在 react 當中使用。
  - recoil 則是 react 狀態管理庫，無法單獨使用。
- 相較於 redux

  1. redux 建立在 MVC 架構上，View 和 Model 獨立，把 dispatch action 作為 controller 。定義了資料流的方向。但 zustand 簡化了 controller，還是遵循著單向資料流。
  2. 效能問題: 在狀態更新過程中，Redux 可能導致不必要的重新渲染，這在大型應用中會成為性能瓶頸。

基本的文檔架構是：

- mini-zustand
  - index
  - react: 和 react 做連結
  - vanilla: 建立狀態倉庫，包含訂閱和取消訂閱，很類似 redux

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

另外補充，在[官網中的 TypeScript Usage 章節](https://www.npmjs.com/package/zustand#typescript-usage) 有提到：

Basic typescript usage doesn't require anything special except for writing `create<State>()(...)` instead of `create(...)...`

```ts
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import type {} from "@redux-devtools/extension"; // required for devtools typing

interface BearState {
  bears: number;
  increase: (by: number) => void;
}

const useBearStore = create<BearState>()(
  devtools(
    persist(
      (set) => ({
        bears: 0,
        increase: (by) => set((state) => ({ bears: state.bears + by })),
      }),
      {
        name: "bear-storage",
      }
    )
  )
);
```

`create` 如果沒有參數執行，會柯里化返回另一個創建狀態庫的函式。如果使用中間件並且更符合設計的話，應該要這樣寫 `create<BearState>()(...)`

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

const vanillaStore = createStore((set) => ...)
const { getState, setState, subscribe, getInitialState } = store

export  { vanillaStore };
```

```ts
// 使用
import { useStore } from "zustand";
import { vanillaStore } from "./vanillaStore";

const useBoundStore = (selector) => useStore(vanillaStore, selector);
```

### Slice Pattern

切片的使用可以使狀態管理模組化，更便於組織和擴張。

```ts
import { create } from "zustand";

const createBearSlice = (set) => ({
  bears: 0,
  increase: (by = 1) => set((state) => ({ bears: state.bears + by })),
  decrease: (by = 1) => set((state) => ({ bears: state.bears - by })),
  reset: () => set({ bears: 0 }),
});
const createCountSlice = (set) => ({
  count: 100,
  increaseCount: () => set((state) => ({ count: state.count + 1 })),
});

const useBoundStore = create<BearState>((...params) => ({
  ...createBearSlice(...params),
  ...createCountSlice(...params),
}));

export default useBoundStore;
```

## 實現

### vanilla - createStore

建立狀態倉庫，包含訂閱和取消訂閱，很類似 redux

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
  getInitialState: () => T;
}

// 參數為函式，函式內的參數：
export type StateCreator<T> = (
  setState: StoreApi<T>["setState"],
  getState: StoreApi<T>["getState"],
  store: StoreApi<T>
) => T;
```

定義 `createStore`， 基本是這樣使用：`const store = createStore((set) => ...)`，又或者是柯里化回傳建立狀態庫的函式 `createStoreImpl` ，供使用者在之後創建。

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

接著是 `setState`，可以局部更新，或是取代更新。這也是跟 redux 不同的地方！

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

建立好狀態倉庫後，要和 react 做連結。

### react - 實現 create

必須使用到 hooks - `useSyncExternalStore` 放入訂閱狀態庫和取得狀態庫。所以會執行上面的 `createStore` 函式。
而這個 `create` 也可能是需要安插中間件的，所以可單獨執行。
`create()` 返回值依然是函式，可以給使用者執行後，建立狀態倉庫。

```ts
import { StateCreator, StoreApi } from "zustand";
import { createStore } from "./vanilla";
import { useSyncExternalStore } from "react";

type Create = {
  <T>(createState: StateCreator<T>): UseBoundStore<StoreApi<T>>;
  <T>(): (createState: StateCreator<T>) => UseBoundStore<StoreApi<T>>;
};

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

// 可以想見 `createImpl` 就是執行 `createStore` 函式。
export const create = function <T>(createState: StateCreator<T>) {
  return createState ? createImpl(createState) : createImpl;
} as Create;

function createImpl<T>(createState: StateCreator<T>) {
  const api =
    typeof createState === "function" ? createStore(createState) : createState;

  // 連接上 react
  const useBoundStore = (selector?: any) => useStore(api, selector);
  return useBoundStore;
}

function useStore<Tstate, StateSlice>(
  api: WithReact<StoreApi<Tstate>>,
  selector: (state: Tstate) => StateSlice = api.getState as any
) {
  const slice = useSyncExternalStore(
    api.subscribe,
    api.getState,
    api.getServerState
  );
  return selector(slice);
}
```

#### selector 與 equalityFn

實際使用時，是加入 selector，

```ts
const bears = useBearStore((state) => state.bears);
// 相較於，下方不會優化 阻止渲染
const store = useBearStore();
const { bears } = store;
```

在源碼當中，`useStore` 其實是使用 `useSyncExternalStoreWithSelector` 來處理 `useStore`，他是基於
`useSyncExternalStore` 再封裝，處理 redux 和 zustand 的 selector 模式，
使用 `selector` 取得對應的狀態，並且訂閱狀態，緩存前值，如果有改變就呼叫 `subscribe`。
一開始源碼是寫 `useLayoutEffect` `useEffect` 需要去緩存 selector。
`useSyncExternalStore` 字面上雖然是寫 Sync ，但實際在是 HookPassive 的 flags，是非同步的執行，但“同步的更新”！

```ts
const snapshot = useSyncExternalStoreWithSelector(
  subscribe,
  getSnapshot, // getState
  getServerSnapshot, // getServerState
  selector, // useSelector 的第一個參數，取得狀態
  isEqual?, // useSelector 的第二個參數，用來判斷 selector 取得的狀態是否有改變
)
```

```ts
const bears = useBearStore(
  (state) => state.bears, // 第一個參數，取得狀態
  (a, b) => {
    // a, b 分別是新的 bears 和舊的 bears
    // 回傳是否一樣，來觸發 subscribe
    return true;
  } // 第二個參數，用來判斷 selector 取得的狀態是否有改變
);
```

### middlewares

和 redux 一樣，可以插入中間件。
這邊舉例: 插入 immer，直接修改狀態。

如同 redux，之所以可以使用中間件，是改變了 `store.dispatch`， zustand 要改變的是 `store.setState`。

> src/mini-zustand/middleware/immer.ts

```ts
import { StateCreator } from "../vanilla";
import { produce } from "immer";
type Immer = <T>(createState: StateCreator<T>) => StateCreator<T>;

export const immer: Immer = (createState) => (set, get, store) => {
  type T = ReturnType<typeof createState>;

  // src/mini-zustand/vanilla.ts 得到 set get store
  // const initialState = (state = createState(setState, getState, api));
  // 改變 zustand/vanilla 定義的 setState
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
```
