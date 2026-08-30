"use client";

import { useState, useTransition } from "react";
import { ThumbsUp, ThumbsDown, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { submitDesignFeedback } from "@/app/(homeowner)/design/actions";

interface TradeOff {
  gained: string;
  sacrificed: string;
}

interface DesignOptionImage {
  id: string;
  url: string;
  angle: string | null;
}

interface SourcedProduct {
  id: string;
  vendor_name: string;
  product_name: string;
  product_url: string | null;
  price: number | null;
  currency: string;
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
  images?: DesignOptionImage[];
  sourcedProducts?: SourcedProduct[];
}

const SUB_ELEMENTS = ["layout", "materials", "colour", "storage", "lighting", "cost"] as const;

export function DesignOptionCard({
  option,
  projectId,
}: {
  option: DesignOption;
  projectId: string;
}) {
  const tradeOffs = Array.isArray(option.trade_offs) ? (option.trade_offs as TradeOff[]) : [];
  const [comment, setComment] = useState("");
  const [subElement, setSubElement] = useState<string | undefined>(undefined);
  const [submitted, setSubmitted] = useState<"like" | "dislike" | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(sentiment: "like" | "dislike") {
    startTransition(async () => {
      await submitDesignFeedback(option.id, projectId, sentiment, comment.trim(), subElement);
      setSubmitted(sentiment);
      setComment("");
    });
  }

  return (
    <Card className={option.status === "rejected" ? "opacity-50" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{option.label}</CardTitle>
          <Badge className="shrink-0 border-accent/30 bg-accent/10 text-accent">
            {option.status === "validated"
              ? "Checked and viable"
              : option.status === "rejected"
              ? "You passed on this"
              : "Proposed"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {option.images && option.images.length > 0 && (
          <div className="flex gap-2 overflow-x-auto">
            {option.images.map((img) => (
              <figure key={img.id} className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL */}
                <img
                  src={img.url}
                  alt={img.angle ?? option.label}
                  className="h-32 w-44 rounded-lg border border-border object-cover"
                />
                {img.angle && (
                  <figcaption className="mt-1 text-[10px] text-muted-foreground">{img.angle}</figcaption>
                )}
              </figure>
            ))}
          </div>
        )}

        <p className="text-sm text-muted-foreground">{option.rationale}</p>

        {option.what_it_would_feel_like && (
          <p className="text-sm italic text-foreground/70">{option.what_it_would_feel_like}</p>
        )}

        {tradeOffs.length > 0 && (
          <div className="space-y-1">
            {tradeOffs.map((t, i) => (
              <p key={i} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80">Gains:</span> {t.gained} ·{" "}
                <span className="font-medium text-foreground/80">Costs:</span> {t.sacrificed}
              </p>
            ))}
          </div>
        )}

        {option.cost_band && (
          <p className="text-xs text-muted-foreground">
            Estimated ₹{option.cost_band.low.toLocaleString()}–₹{option.cost_band.high.toLocaleString()}
            {option.sourcing_status !== "grounded" && " (indicative, not yet vendor-confirmed)"}
          </p>
        )}

        {option.sourcedProducts && option.sourcedProducts.length > 0 && (
          <div className="space-y-1 border-t border-border pt-2">
            <p className="text-xs font-medium text-foreground/80">Sourced from</p>
            {option.sourcedProducts.map((p) => (
              <div key={p.id} className="text-xs text-muted-foreground">
                <span className="text-foreground/90">{p.vendor_name}</span>
                {" · "}
                {p.product_url ? (
                  <a href={p.product_url} target="_blank" rel="noreferrer" className="text-accent underline">
                    {p.product_name}
                  </a>
                ) : (
                  <span>{p.product_name}</span>
                )}
                {p.price != null && (
                  <span className="ml-1">
                    — {p.currency} {p.price.toLocaleString("en-IN")}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-border pt-3">
          {isPending ? (
            <p className="text-xs text-muted-foreground">Recording your feedback…</p>
          ) : submitted ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CircleCheck className="h-3.5 w-3.5 text-accent" />
              Feedback recorded — this shapes what comes next.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                {SUB_ELEMENTS.map((el) => (
                  <button
                    key={el}
                    onClick={() => setSubElement((prev) => (prev === el ? undefined : el))}
                    className={`rounded-full px-2 py-0.5 text-xs transition-colors ${
                      subElement === el
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {el}
                  </button>
                ))}
              </div>
              <Input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={subElement ? `What about the ${subElement}?` : "Anything specific? (optional)"}
                className="h-8 text-xs"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={isPending}
                  onClick={() => submit("like")}
                  className="flex-1"
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                  Like this
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => submit("dislike")}
                  className="flex-1"
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                  Not this one
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
