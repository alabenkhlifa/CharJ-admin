import { tone as baseTone, type Category } from "./category";
import "./ui.css";

/** Key of 10px squares above a multi-series chart. */
export const ChartKey = ({ series }: { series: { name: string; tone: Category }[] }) => (
  <div className="ui-key">
    {series.map((s) => (
      <span key={s.name}>
        <i style={{ background: baseTone(s.tone) }} />
        {s.name}
      </span>
    ))}
  </div>
);
