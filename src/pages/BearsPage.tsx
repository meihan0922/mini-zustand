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
