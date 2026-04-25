"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AdminApiError,
  type AdminMaterial,
  type AdminModel,
  type AdminPrice,
  type AdminSize,
  type Paginated,
  batchTogglePrices,
  createPrice,
  deletePrice,
  listMaterials,
  listModels,
  listPrices,
  listSizes,
  updatePrice,
} from "@/lib/admin-api";
import { FieldRow, inputCls } from "@/components/admin/admin-list-view";

// 价格管理：与 models/sizes/materials 不同 —— 多了三元组筛选、行勾选与批量上下架，
// 以及"编辑时三元组只读"的特殊规则（API 规范 §3.4），所以不复用 AdminListView。

type ActiveFilter = "all" | "active" | "inactive";

interface PriceForm {
  modelId: string;
  sizeId: string;
  materialId: string;
  unitPrice: string; // 用 string 承载输入，提交前 parseFloat
  currency: string;
  moq: string;
  remark: string;
  isActive: boolean;
}

const emptyForm: PriceForm = {
  modelId: "",
  sizeId: "",
  materialId: "",
  unitPrice: "",
  currency: "CNY",
  moq: "",
  remark: "",
  isActive: true,
};

export default function PricesPage() {
  // 基础库（用于筛选/弹窗下拉）
  const [models, setModels] = useState<AdminModel[]>([]);
  const [sizes, setSizes] = useState<AdminSize[]>([]);
  const [materials, setMaterials] = useState<AdminMaterial[]>([]);

  // 列表状态
  const [data, setData] = useState<Paginated<AdminPrice> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [filterModel, setFilterModel] = useState("");
  const [filterSize, setFilterSize] = useState("");
  const [filterMaterial, setFilterMaterial] = useState("");
  const [filterActive, setFilterActive] = useState<ActiveFilter>("all");
  const [reloadTick, setReloadTick] = useState(0);

  // 行选 + 批量
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  // 弹窗
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminPrice | null>(null);
  const [form, setForm] = useState<PriceForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // 删除确认
  const [deleting, setDeleting] = useState<AdminPrice | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // 一次性把基础库全量拉来（pageSize=100 暂时够用；将来若超出再做远端搜索）
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listModels({ pageSize: 100 }),
      listSizes({ pageSize: 100 }),
      listMaterials({ pageSize: 100 }),
    ])
      .then(([m, s, mat]) => {
        if (cancelled) return;
        setModels(m.items);
        setSizes(s.items);
        setMaterials(mat.items);
      })
      .catch(() => {
        // 基础库失败时不阻塞列表展示，只是下拉为空
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 列表加载
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listPrices({
      page,
      pageSize,
      modelId: filterModel || undefined,
      sizeId: filterSize || undefined,
      materialId: filterMaterial || undefined,
      isActive:
        filterActive === "all" ? undefined : filterActive === "active",
    })
      .then((d) => {
        if (cancelled) return;
        setData(d);
        // 翻页/筛选后清掉跨页选择，避免对不可见行做批量
        setSelected(new Set());
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, filterModel, filterSize, filterMaterial, filterActive, reloadTick]);

  function reload() {
    setReloadTick((t) => t + 1);
  }

  function clearFilters() {
    setFilterModel("");
    setFilterSize("");
    setFilterMaterial("");
    setFilterActive("all");
    setPage(1);
  }

  function openCreate() {
    setForm(emptyForm);
    setSubmitError(null);
    setCreating(true);
  }

  function openEdit(row: AdminPrice) {
    setForm({
      modelId: row.modelId,
      sizeId: row.sizeId,
      materialId: row.materialId,
      unitPrice: String(row.unitPrice),
      currency: row.currency,
      moq: row.moq !== null ? String(row.moq) : "",
      remark: row.remark ?? "",
      isActive: row.isActive,
    });
    setSubmitError(null);
    setEditing(row);
  }

  function closeDialog() {
    setCreating(false);
    setEditing(null);
    setSubmitError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    const unitPriceNum = Number(form.unitPrice);
    if (!Number.isFinite(unitPriceNum) || unitPriceNum <= 0) {
      setSubmitError("单价必须是正数");
      setSubmitting(false);
      return;
    }
    const moqTrim = form.moq.trim();
    let moqValue: number | null = null;
    if (moqTrim !== "") {
      const n = Number(moqTrim);
      if (!Number.isInteger(n) || n <= 0) {
        setSubmitError("起订量必须是正整数");
        setSubmitting(false);
        return;
      }
      moqValue = n;
    }

    try {
      if (editing) {
        // PATCH 不允许改三元组（API 规范 §3.4），故只提交可变字段
        await updatePrice(editing.id, {
          unitPrice: unitPriceNum,
          currency: form.currency,
          moq: moqValue,
          remark: form.remark.trim() || null,
          isActive: form.isActive,
        });
      } else {
        if (!form.modelId || !form.sizeId || !form.materialId) {
          setSubmitError("请选择型号、尺寸和材质");
          setSubmitting(false);
          return;
        }
        await createPrice({
          modelId: form.modelId,
          sizeId: form.sizeId,
          materialId: form.materialId,
          unitPrice: unitPriceNum,
          currency: form.currency,
          moq: moqValue,
          remark: form.remark.trim() || null,
          isActive: form.isActive,
        });
      }
      closeDialog();
      reload();
    } catch (err) {
      if (err instanceof AdminApiError && err.code === "DUPLICATE_PRICE") {
        setSubmitError("该 (型号, 尺寸, 材质) 组合已存在价格，请直接编辑现有记录");
      } else if (err instanceof AdminApiError) {
        setSubmitError(err.message);
      } else {
        setSubmitError("保存失败");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeleteSubmitting(true);
    setDeleteError(null);
    try {
      await deletePrice(deleting.id);
      setDeleting(null);
      reload();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setDeleteSubmitting(false);
    }
  }

  async function handleBatchToggle(isActive: boolean) {
    if (selected.size === 0) return;
    setBatchSubmitting(true);
    setBatchError(null);
    try {
      const res = await batchTogglePrices({
        ids: Array.from(selected),
        isActive,
      });
      setSelected(new Set());
      reload();
      // 命中数 < 选中数 时给个提示（被别的客户端先删掉了）
      if (res.updated < selected.size) {
        setBatchError(
          `批量更新完成，但仅 ${res.updated} / ${selected.size} 条命中。其他记录可能已被删除。`,
        );
      }
    } catch (err) {
      setBatchError(err instanceof Error ? err.message : "批量操作失败");
    } finally {
      setBatchSubmitting(false);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  const allOnPageSelected =
    data !== null &&
    data.items.length > 0 &&
    data.items.every((row) => selected.has(row.id));

  function togglePageAll(checked: boolean) {
    if (!data) return;
    const next = new Set(selected);
    for (const row of data.items) {
      if (checked) next.add(row.id);
      else next.delete(row.id);
    }
    setSelected(next);
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  // 编辑时锁定的"型号 · 尺寸 · 材质"展示
  const editingTriple = useMemo(() => {
    if (!editing) return null;
    return `${editing.model.code} · ${editing.size.name} · ${editing.material.name}`;
  }, [editing]);

  const filtersDirty =
    filterModel !== "" ||
    filterSize !== "" ||
    filterMaterial !== "" ||
    filterActive !== "all";

  return (
    <div className="space-y-4">
      {/* 顶栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">价格管理</h1>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          新增价格
        </button>
      </div>

      {/* 筛选 */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filterModel}
          onChange={(e) => {
            setFilterModel(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">全部型号</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.code} · {m.name}
            </option>
          ))}
        </select>
        <select
          value={filterSize}
          onChange={(e) => {
            setFilterSize(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">全部尺寸</option>
          {sizes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={filterMaterial}
          onChange={(e) => {
            setFilterMaterial(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">全部材质</option>
          {materials.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <select
          value={filterActive}
          onChange={(e) => {
            setFilterActive(e.target.value as ActiveFilter);
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="all">全部状态</option>
          <option value="active">仅上架</option>
          <option value="inactive">仅下架</option>
        </select>
        {filtersDirty && (
          <button
            type="button"
            onClick={clearFilters}
            className="h-9 rounded-md px-3 text-sm text-muted-foreground hover:text-foreground"
          >
            清空
          </button>
        )}
      </div>

      {/* 批量栏 */}
      <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
        <span className="text-muted-foreground">
          已选 {selected.size} 条
          {selected.size > 0 ? "（仅当前页可见行）" : ""}
        </span>
        <button
          type="button"
          onClick={() => handleBatchToggle(true)}
          disabled={selected.size === 0 || batchSubmitting}
          className="ml-auto rounded-md border px-3 py-1 text-xs hover:bg-card disabled:opacity-50"
        >
          批量上架
        </button>
        <button
          type="button"
          onClick={() => handleBatchToggle(false)}
          disabled={selected.size === 0 || batchSubmitting}
          className="rounded-md border px-3 py-1 text-xs hover:bg-card disabled:opacity-50"
        >
          批量下架
        </button>
      </div>
      {batchError && (
        <p className="text-sm text-destructive" role="alert">
          {batchError}
        </p>
      )}

      {/* 列表 */}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="全选当前页"
                  checked={allOnPageSelected}
                  onChange={(e) => togglePageAll(e.target.checked)}
                />
              </th>
              <th className="px-4 py-2">型号</th>
              <th className="px-4 py-2">尺寸</th>
              <th className="px-4 py-2">材质</th>
              <th className="px-4 py-2 text-right">单价</th>
              <th className="px-4 py-2 text-right">起订量</th>
              <th className="px-4 py-2">备注</th>
              <th className="px-4 py-2">状态</th>
              <th className="px-4 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && (!data || data.items.length === 0) && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-6 text-center text-muted-foreground"
                >
                  加载中…
                </td>
              </tr>
            )}
            {!loading && data && data.items.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-6 text-center text-muted-foreground"
                >
                  暂无数据
                </td>
              </tr>
            )}
            {data?.items.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="选择"
                    checked={selected.has(row.id)}
                    onChange={(e) => toggleOne(row.id, e.target.checked)}
                  />
                </td>
                <td className="px-4 py-2">
                  <span className="font-mono">{row.model.code}</span>
                  <span className="ml-1 text-muted-foreground">
                    {row.model.name}
                  </span>
                </td>
                <td className="px-4 py-2">{row.size.name}</td>
                <td className="px-4 py-2">{row.material.name}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {row.unitPrice} {row.currency}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {row.moq ?? "-"}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {row.remark ?? "-"}
                </td>
                <td className="px-4 py-2">
                  {row.isActive ? "上架" : "下架"}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleting(row);
                        setDeleteError(null);
                      }}
                      className="rounded-md border border-destructive/40 px-2.5 py-1 text-xs text-destructive hover:bg-destructive/10"
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {/* 分页 */}
      {data && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            共 {data.total} 条，第 {data.page} / {totalPages} 页
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              上一页
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </div>
      )}

      {/* 新增 / 编辑 */}
      {(creating || editing) && (
        <Modal
          title={editing ? "编辑价格" : "新增价格"}
          onClose={closeDialog}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {editing ? (
              <FieldRow label="型号 · 尺寸 · 材质（不可修改）">
                <div className="rounded-md bg-muted px-3 py-2 text-sm">
                  {editingTriple}
                </div>
              </FieldRow>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <FieldRow label="型号">
                  <select
                    required
                    value={form.modelId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, modelId: e.target.value }))
                    }
                    className={inputCls}
                  >
                    <option value="">请选择</option>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.code} · {m.name}
                      </option>
                    ))}
                  </select>
                </FieldRow>
                <FieldRow label="尺寸">
                  <select
                    required
                    value={form.sizeId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, sizeId: e.target.value }))
                    }
                    className={inputCls}
                  >
                    <option value="">请选择</option>
                    {sizes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </FieldRow>
                <FieldRow label="材质">
                  <select
                    required
                    value={form.materialId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, materialId: e.target.value }))
                    }
                    className={inputCls}
                  >
                    <option value="">请选择</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </FieldRow>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <FieldRow label="单价">
                <input
                  type="number"
                  step="any"
                  required
                  value={form.unitPrice}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, unitPrice: e.target.value }))
                  }
                  className={inputCls}
                />
              </FieldRow>
              <FieldRow label="币种">
                <input
                  required
                  maxLength={3}
                  value={form.currency}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      currency: e.target.value.toUpperCase(),
                    }))
                  }
                  className={inputCls}
                />
              </FieldRow>
              <FieldRow label="起订量（可空）">
                <input
                  type="number"
                  value={form.moq}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, moq: e.target.value }))
                  }
                  className={inputCls}
                />
              </FieldRow>
            </div>

            <FieldRow label="备注">
              <input
                value={form.remark}
                onChange={(e) =>
                  setForm((f) => ({ ...f, remark: e.target.value }))
                }
                className={inputCls}
              />
            </FieldRow>

            <FieldRow label="状态">
              <label className="flex h-9 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, isActive: e.target.checked }))
                  }
                />
                上架（C 端可见）
              </label>
            </FieldRow>

            {submitError && (
              <p className="text-sm text-destructive" role="alert">
                {submitError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {submitting ? "保存中…" : "保存"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 删除确认 */}
      {deleting && (
        <Modal title="确认删除？" onClose={() => setDeleting(null)}>
          <div className="space-y-3 text-sm">
            <p>该价格将被永久删除：</p>
            <p className="rounded-md bg-muted px-3 py-2 font-medium">
              {deleting.model.code} · {deleting.size.name} ·{" "}
              {deleting.material.name}
            </p>
            {deleteError && (
              <p className="text-sm text-destructive" role="alert">
                {deleteError}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteSubmitting}
                className="rounded-md bg-destructive px-4 py-1.5 text-sm font-medium text-destructive-foreground disabled:opacity-60"
              >
                {deleteSubmitting ? "删除中…" : "确认删除"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// =====================================================================
// 本页用的 Modal —— admin-list-view.tsx 里的 Modal 是私有的，
// 抽到这里时怕引入循环依赖；重新写一份很轻量。
// =====================================================================

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl space-y-4 rounded-lg border bg-card p-5 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
