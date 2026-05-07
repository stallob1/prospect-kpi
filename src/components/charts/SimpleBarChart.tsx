"use client";

import {
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type BarPoint = { name: string; value: number };

export function SimpleBarChart({ data }: { data: BarPoint[] }) {
  if (!data.length) {
    return (
      <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-surface-border text-sm text-slate-500">
        No bar data.
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RBarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a3544" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={{ stroke: "#2a3544" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip
            contentStyle={{
              background: "#111827",
              border: "1px solid #2a3544",
              borderRadius: 8,
            }}
            formatter={(v: number) => [`${v}`, ""]}
          />
          <Bar dataKey="value" fill="#22c55e" radius={[6, 6, 0, 0]} />
        </RBarChart>
      </ResponsiveContainer>
    </div>
  );
}
