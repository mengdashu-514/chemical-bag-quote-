"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ApiClientError,
  fetchPublicMaterials,
  fetchPublicModels,
  fetchPublicQuote,
  fetchPublicSizes,
  type PublicMaterial,
  type PublicModel,
  type PublicQuote,
  type PublicSize,
} from "@/lib/public-api";

// =====================================================================
// 表单状态：三段联动 + 数量
// =====================================================================
//   - modelId 变 → 清空 size/material/quote，重新拉 sizes
//   - sizeId 变  → 清空 material/quote，重新拉 materials
//   - materialId 变 → 拉 quote
//   - quantity 变（已有 quote 时）→ 客户端本地算 totalPrice，避免每次输入都打接口
// PRD §C-9：切换上层后保留下层「同名/相同 ID」的选择 —— 这里仅在新列表里能找到旧 ID 时保留。

export function QuoteCalculator() {
  const [models, setModels] = useState<PublicModel[]>([]);
  const [sizes, setSizes] = useState<PublicSize[]>([]);
  const [materials, setMaterials] = useState<PublicMaterial[]>([]);

  const [modelId, setModelId] = useState<string>("");
  const [sizeId, setSizeId] = useState<string>("");
  const [materialId, setMaterialId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");

  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [loadingModels, setLoadingModels] = useState(true);
  const [loadingSizes, setLoadingSizes] = useState(false);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [copied, setCopied] = useState(false);

  // 1) 初始：拉所有上架型号
  useEffect(() => {
    let cancelled = false;
    fetchPublicModels()
      .then((list) => {
        if (cancelled) return;
        setModels(list);
      })
      .catch(() => {
        if (cancelled) return;
        setModels([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingModels(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 2) modelId 变 → 拉 sizes，并尝试保留下层选择
  useEffect(() => {
    if (!modelId) {
      setSizes([]);
      setSizeId("");
      return;
    }
    let cancelled = false;
    setLoadingSizes(true);
    fetchPublicSizes(modelId)
      .then((list) => {
        if (cancelled) return;
        setSizes(list);
        setSizeId((prev) => (list.some((s) => s.id === prev) ? prev : ""));
      })
      .catch(() => {
        if (cancelled) return;
        setSizes([]);
        setSizeId("");
      })
      .finally(() => {
        if (!cancelled) setLoadingSizes(false);
      });
    return () => {
      cancelled = true;
    };
  }, [modelId]);

  // 3) (modelId, sizeId) 变 → 拉 materials
  useEffect(() => {
    if (!modelId || !sizeId) {
      setMaterials([]);
      setMaterialId("");
      return;
    }
    let cancelled = false;
    setLoadingMaterials(true);
    fetchPublicMaterials(modelId, sizeId)
      .then((list) => {
        if (cancelled) return;
        setMaterials(list);
        setMaterialId((prev) => (list.some((m) => m.id === prev) ? prev : ""));
      })
      .catch(() => {
        if (cancelled) return;
        setMaterials([]);
        setMaterialId("");
      })
      .finally(() => {
        if (!cancelled) setLoadingMaterials(false);
      });
    return () => {
      cancelled = true;
    };
  }, [modelId, sizeId]);

  // 4) 三元组齐 → 拉 quote（不传 quantity，单价 + MOQ；总价前端本地算）
  useEffect(() => {
    if (!modelId || !sizeId || !materialId) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    let cancelled = false;
    setLoadingQuote(true);
    setQuoteError(null);
    fetchPublicQuote({ modelId, sizeId, materialId })
      .then((q) => {
        if (cancelled) return;
        setQuote(q);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setQuote(null);
        if (err instanceof ApiClientError && err.code === "NOT_FOUND") {
          setQuoteError("该组合暂未配置报价，请联系销售");
        } else if (err instanceof ApiClientError) {
          setQuoteError(err.message);
        } else {
          setQuoteError("未知错误");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingQuote(false);
      });
    return () => {
      cancelled = true;
    };
  }, [modelId, sizeId, materialId]);

  // 输入数量解析为 int；空串 / 非法 → undefined
  const parsedQuantity = useMemo<number | undefined>(() => {
    if (quantity.trim() === "") return undefined;
    const n = Number(quantity);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return undefined;
    return n;
  }, [quantity]);

  const totalPrice =
    quote && parsedQuantity !== undefined
      ? Number((quote.unitPrice * parsedQuantity).toFixed(2))
      : undefined;
  const belowMoq =
    quote && parsedQuantity !== undefined && quote.moq !== null
      ? parsedQuantity < quote.moq
      : false;

  // 复制报价文本：含选项中文名、单价、数量、总价、时间戳
  async function handleCopy() {
    if (!quote) return;
    const model = models.find((m) => m.id === quote.modelId);
    const size = sizes.find((s) => s.id === quote.sizeId);
    const material = materials.find((m) => m.id === quote.materialId);
    const lines = [
      "【化工包装袋报价】",
      `型号：${model ? `${model.code} ${model.name}` : quote.modelId}`,
      `尺寸：${size?.name ?? quote.sizeId}`,
      `材质：${material?.name ?? quote.materialId}`,
      `单价：${quote.unitPrice} ${quote.currency}`,
      ...(parsedQuantity !== undefined
        ? [
            `数量：${parsedQuantity}`,
            `总价：${totalPrice} ${quote.currency}`,
          ]
        : []),
      ...(quote.moq !== null ? [`起订量：${quote.moq}`] : []),
      ...(quote.remark ? [`备注：${quote.remark}`] : []),
      `报价时间：${new Date(quote.quotedAt).toLocaleString("zh-CN")}`,
    ];
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 老旧 WebView fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } finally {
        document.body.removeChild(ta);
      }
    }
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-5 px-4 py-6">
      <header className="space-y-1 text-center">
        <h1 className="text-xl font-semibold tracking-tight">化工包装袋报价</h1>
        <p className="text-sm text-muted-foreground">三步选完，立刻出价</p>
      </header>

      <div className="space-y-4 rounded-lg border bg-card p-4 shadow-sm">
        <Field label="型号">
          <Select
            value={modelId}
            onChange={(v) => setModelId(v)}
            disabled={loadingModels || models.length === 0}
            placeholder={loadingModels ? "加载中…" : "请选择型号"}
            options={models.map((m) => ({
              value: m.id,
              label: `${m.code} · ${m.name}`,
            }))}
          />
        </Field>

        <Field label="尺寸">
          <Select
            value={sizeId}
            onChange={(v) => setSizeId(v)}
            disabled={!modelId || loadingSizes}
            placeholder={
              !modelId
                ? "请先选择型号"
                : loadingSizes
                  ? "加载中…"
                  : sizes.length === 0
                    ? "该型号暂无可选尺寸"
                    : "请选择尺寸"
            }
            options={sizes.map((s) => ({ value: s.id, label: s.name }))}
          />
        </Field>

        <Field label="材质">
          <Select
            value={materialId}
            onChange={(v) => setMaterialId(v)}
            disabled={!sizeId || loadingMaterials}
            placeholder={
              !sizeId
                ? "请先选择尺寸"
                : loadingMaterials
                  ? "加载中…"
                  : materials.length === 0
                    ? "该组合暂无可选材质"
                    : "请选择材质"
            }
            options={materials.map((m) => ({ value: m.id, label: m.name }))}
          />
        </Field>

        <Field label="数量（可选）">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="留空则只看单价"
            className="h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none ring-offset-background focus:ring-2 focus:ring-ring"
          />
        </Field>
      </div>

      <ResultCard
        loading={loadingQuote}
        quote={quote}
        error={quoteError}
        quantity={parsedQuantity}
        totalPrice={totalPrice}
        belowMoq={belowMoq}
        onCopy={handleCopy}
        copied={copied}
      />
    </div>
  );
}

// =====================================================================
// 子组件
// =====================================================================

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none ring-offset-background focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function ResultCard({
  loading,
  quote,
  error,
  quantity,
  totalPrice,
  belowMoq,
  onCopy,
  copied,
}: {
  loading: boolean;
  quote: PublicQuote | null;
  error: string | null;
  quantity: number | undefined;
  totalPrice: number | undefined;
  belowMoq: boolean;
  onCopy: () => void;
  copied: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-4 text-center text-sm text-muted-foreground">
        正在查询报价…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-center text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="rounded-lg border bg-card p-4 text-center text-sm text-muted-foreground">
        请完成上方三项选择
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-baseline gap-2">
        <span className="text-sm text-muted-foreground">单价</span>
        <span className="text-2xl font-semibold tabular-nums">
          {quote.unitPrice}
        </span>
        <span className="text-sm text-muted-foreground">{quote.currency}</span>
      </div>

      {quantity !== undefined && totalPrice !== undefined && (
        <div className="flex items-baseline gap-2">
          <span className="text-sm text-muted-foreground">总价</span>
          <span className="text-xl font-semibold tabular-nums">
            {totalPrice}
          </span>
          <span className="text-sm text-muted-foreground">
            {quote.currency}
          </span>
          <span className="text-xs text-muted-foreground">
            （{quote.unitPrice} × {quantity}）
          </span>
        </div>
      )}

      {belowMoq && quote.moq !== null && (
        <p className="text-sm font-medium text-destructive">
          最小起订量为 {quote.moq}，当前数量低于起订量
        </p>
      )}

      {quote.moq !== null && !belowMoq && (
        <p className="text-xs text-muted-foreground">起订量：{quote.moq}</p>
      )}

      {quote.remark && (
        <p className="text-xs text-muted-foreground">备注：{quote.remark}</p>
      )}

      <button
        type="button"
        onClick={onCopy}
        className="h-11 w-full rounded-md bg-primary text-base font-medium text-primary-foreground transition-opacity active:opacity-80"
      >
        {copied ? "已复制" : "复制报价"}
      </button>
    </div>
  );
}
