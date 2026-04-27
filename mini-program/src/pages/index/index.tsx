import { useEffect, useState, useMemo, useCallback } from "react";
import { View, Text, Picker, Input, Button } from "@tarojs/components";
import Taro from "@tarojs/taro";
import {
  fetchPublicModels,
  fetchPublicSizes,
  fetchPublicMaterials,
  fetchPublicQuote,
  type PublicModel,
  type PublicSize,
  type PublicMaterial,
  type PublicQuote,
} from "../../services/api";
import "./index.scss";

export default function Index() {
  const [models, setModels] = useState<PublicModel[]>([]);
  const [sizes, setSizes] = useState<PublicSize[]>([]);
  const [materials, setMaterials] = useState<PublicMaterial[]>([]);

  const [modelIdx, setModelIdx] = useState(-1);
  const [sizeIdx, setSizeIdx] = useState(-1);
  const [materialIdx, setMaterialIdx] = useState(-1);
  const [quantity, setQuantity] = useState("");

  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 加载型号列表
  useEffect(() => {
    fetchPublicModels()
      .then(setModels)
      .catch(() => setModels([]));
  }, []);

  // 型号变化 → 加载尺寸
  useEffect(() => {
    if (modelIdx < 0) {
      setSizes([]);
      setSizeIdx(-1);
      return;
    }
    const modelId = models[modelIdx]?.id;
    if (!modelId) return;
    fetchPublicSizes(modelId)
      .then((list) => {
        setSizes(list);
        setSizeIdx(-1);
      })
      .catch(() => {
        setSizes([]);
        setSizeIdx(-1);
      });
  }, [modelIdx, models]);

  // 尺寸变化 → 加载材质
  useEffect(() => {
    if (modelIdx < 0 || sizeIdx < 0) {
      setMaterials([]);
      setMaterialIdx(-1);
      return;
    }
    const modelId = models[modelIdx]?.id;
    const sizeId = sizes[sizeIdx]?.id;
    if (!modelId || !sizeId) return;
    fetchPublicMaterials(modelId, sizeId)
      .then((list) => {
        setMaterials(list);
        setMaterialIdx(-1);
      })
      .catch(() => {
        setMaterials([]);
        setMaterialIdx(-1);
      });
  }, [modelIdx, sizeIdx, models, sizes]);

  // 三元组齐 → 查报价
  useEffect(() => {
    if (modelIdx < 0 || sizeIdx < 0 || materialIdx < 0) {
      setQuote(null);
      setError(null);
      return;
    }
    const modelId = models[modelIdx]?.id;
    const sizeId = sizes[sizeIdx]?.id;
    const materialId = materials[materialIdx]?.id;
    if (!modelId || !sizeId || !materialId) return;

    setLoading(true);
    setError(null);
    fetchPublicQuote({ modelId, sizeId, materialId })
      .then((q) => setQuote(q))
      .catch((err: unknown) => {
        setQuote(null);
        setError(err instanceof Error ? err.message : "查询失败");
      })
      .finally(() => setLoading(false));
  }, [modelIdx, sizeIdx, materialIdx, models, sizes, materials]);

  // 数量解析
  const parsedQty = useMemo<number | undefined>(() => {
    if (!quantity.trim()) return undefined;
    const n = Number(quantity);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return undefined;
    return n;
  }, [quantity]);

  const totalPrice =
    quote && parsedQty !== undefined
      ? Number((quote.unitPrice * parsedQty).toFixed(2))
      : undefined;
  const belowMoq =
    quote && parsedQty !== undefined && quote.moq !== null
      ? parsedQty < quote.moq
      : false;

  // 复制报价文本
  const handleCopy = useCallback(() => {
    if (!quote) return;
    const model = models[modelIdx];
    const size = sizes[sizeIdx];
    const material = materials[materialIdx];
    const lines = [
      "【化工包装袋报价】",
      `型号：${model ? `${model.code} ${model.name}` : ""}`,
      `尺寸：${size?.name ?? ""}`,
      `材质：${material?.name ?? ""}`,
      `单价：${quote.unitPrice} ${quote.currency}`,
      ...(parsedQty !== undefined
        ? [`数量：${parsedQty}`, `总价：${totalPrice} ${quote.currency}`]
        : []),
      ...(quote.moq !== null ? [`起订量：${quote.moq}`] : []),
      ...(quote.remark ? [`备注：${quote.remark}`] : []),
      `报价时间：${new Date(quote.quotedAt).toLocaleString("zh-CN")}`,
    ];
    Taro.setClipboardData({ data: lines.join("\n") });
  }, [quote, models, sizes, materials, modelIdx, sizeIdx, materialIdx, parsedQty, totalPrice]);

  return (
    <View className="page">
      <View className="header">
        <Text className="title">化工包装袋报价</Text>
        <Text className="subtitle">三步选完，立刻出价</Text>
      </View>

      <View className="card">
        {/* 型号选择 */}
        <View className="field">
          <Text className="label">型号</Text>
          <Picker
            mode="selector"
            range={models.map((m) => `${m.code} · ${m.name}`)}
            value={modelIdx >= 0 ? modelIdx : 0}
            onChange={(e) => setModelIdx(Number(e.detail.value))}
          >
            <View className="picker-display">
              <Text>
                {modelIdx >= 0
                  ? `${models[modelIdx].code} · ${models[modelIdx].name}`
                  : "请选择型号"}
              </Text>
            </View>
          </Picker>
        </View>

        {/* 尺寸选择 */}
        <View className="field">
          <Text className="label">尺寸</Text>
          <Picker
            mode="selector"
            range={sizes.map((s) => s.name)}
            value={sizeIdx >= 0 ? sizeIdx : 0}
            onChange={(e) => setSizeIdx(Number(e.detail.value))}
          >
            <View className="picker-display">
              <Text>
                {sizeIdx >= 0
                  ? sizes[sizeIdx].name
                  : modelIdx < 0
                    ? "请先选择型号"
                    : "请选择尺寸"}
              </Text>
            </View>
          </Picker>
        </View>

        {/* 材质选择 */}
        <View className="field">
          <Text className="label">材质</Text>
          <Picker
            mode="selector"
            range={materials.map((m) => m.name)}
            value={materialIdx >= 0 ? materialIdx : 0}
            onChange={(e) => setMaterialIdx(Number(e.detail.value))}
          >
            <View className="picker-display">
              <Text>
                {materialIdx >= 0
                  ? materials[materialIdx].name
                  : sizeIdx < 0
                    ? "请先选择尺寸"
                    : "请选择材质"}
              </Text>
            </View>
          </Picker>
        </View>

        {/* 数量 */}
        <View className="field">
          <Text className="label">数量（可选）</Text>
          <Input
            type="number"
            placeholder="留空则只看单价"
            value={quantity}
            onInput={(e) => setQuantity(e.detail.value)}
            className="input"
          />
        </View>
      </View>

      {/* 结果卡片 */}
      <View className="result-card">
        {loading && <Text className="hint">正在查询报价…</Text>}

        {error && <Text className="error-text">{error}</Text>}

        {!loading && !error && !quote && (
          <Text className="hint">请完成上方三项选择</Text>
        )}

        {quote && !loading && !error && (
          <>
            <View className="price-row">
              <Text className="price-label">单价</Text>
              <Text className="price-value">{quote.unitPrice}</Text>
              <Text className="price-unit">{quote.currency}</Text>
            </View>

            {parsedQty !== undefined && totalPrice !== undefined && (
              <View className="price-row">
                <Text className="price-label">总价</Text>
                <Text className="price-value-lg">{totalPrice}</Text>
                <Text className="price-unit">{quote.currency}</Text>
                <Text className="calc-hint">
                  （{quote.unitPrice} × {parsedQty}）
                </Text>
              </View>
            )}

            {belowMoq && quote.moq !== null && (
              <Text className="warning">
                最小起订量为 {quote.moq}，当前数量低于起订量
              </Text>
            )}

            {quote.moq !== null && !belowMoq && (
              <Text className="moq-text">起订量：{quote.moq}</Text>
            )}

            {quote.remark && (
              <Text className="remark-text">备注：{quote.remark}</Text>
            )}

            <Button className="copy-btn" onClick={handleCopy}>
              复制报价
            </Button>
          </>
        )}
      </View>
    </View>
  );
}
