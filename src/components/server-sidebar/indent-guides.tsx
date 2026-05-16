import { I } from "./constants";

export function IndentGuides({ indent }: { indent: number }) {
  const guides: number[] = [];
  // Draw guides at each nesting level (every 12px starting from the first nested level)
  for (let x = I.cat + 4; x < indent; x += 12) {
    guides.push(x);
  }
  return (
    <>
      {guides.map((x) => (
        <span key={x} className="sidebar-indent-guide" style={{ left: `${x}px` }} />
      ))}
    </>
  );
}
