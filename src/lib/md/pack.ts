import { useEffect, useState } from "react";
import type { AlbumChart } from "./album";

type Pack = { charts: AlbumChart[]; current: string };

let pack: Pack = { charts: [], current: "" };
const listeners = new Set<() => void>();

export function setAlbumCharts(charts: AlbumChart[], current: string) {
  pack = { charts, current };
  listeners.forEach((listener) => listener());
}

export function currentChartName(): string {
  return pack.current || "map2.bms";
}

export function useAlbumCharts(): Pack {
  const [state, setState] = useState(pack);
  useEffect(() => {
    const listener = () => setState(pack);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return state;
}
