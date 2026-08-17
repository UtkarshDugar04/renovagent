interface TradeOff {
  gained: string;
  sacrificed: string;
}

interface DesignOption {
  id: string;
  label: string;
  rationale: string;
  trade_offs: unknown;
  cost_band: { low: number; high: number; confidence: string } | null;
  sourcing_status: string;
  what_it_would_feel_like: string | null;
  status: string;
}

export function DesignOptionCard({ option }: { option: DesignOption }) {
  const tradeOffs = Array.isArray(option.trade_offs) ? (option.trade_offs as TradeOff[]) : [];

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold text-stone-900">{option.label}</h3>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
          {option.status === "validated" ? "Checked and viable" : "Proposed"}
        </span>
      </div>
      <p className="mb-3 text-sm text-stone-600">{option.rationale}</p>

      {option.what_it_would_feel_like && (
        <p className="mb-3 text-sm italic text-stone-500">{option.what_it_would_feel_like}</p>
      )}

      {tradeOffs.length > 0 && (
        <div className="mb-3 space-y-1">
          {tradeOffs.map((t, i) => (
            <p key={i} className="text-xs text-stone-500">
              <span className="font-medium text-stone-700">Gains:</span> {t.gained} ·{" "}
              <span className="font-medium text-stone-700">Costs:</span> {t.sacrificed}
            </p>
          ))}
        </div>
      )}

      {option.cost_band && (
        <p className="text-xs text-stone-400">
          Estimated ₹{option.cost_band.low.toLocaleString()}–₹{option.cost_band.high.toLocaleString()}
          {option.sourcing_status !== "grounded" && " (indicative, not yet vendor-confirmed)"}
        </p>
      )}
    </div>
  );
}
