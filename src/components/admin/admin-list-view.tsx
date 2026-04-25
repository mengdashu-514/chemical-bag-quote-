"use client";

import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useEffect,
  useState,
} from "react";
import { AdminApiError, type Paginated } from "@/lib/admin-api";
import { cn } from "@/lib/utils";

// =====================================================================
// 共用列表视图：分页 + keyword + isActive 过滤 + 新增/编辑/删除 Dialog。
//   pages 只需注入：列定义、表单字段与状态映射、CRUD 函数。
//   - TRow：列表里一行的形态（必带 id, isActive, updatedAt 这类字段）
//   - TForm：弹窗里录入 / 编辑的字段集合
// =====================================================================

interface BaseRow {
  id: string;
  isActive: boolean;
  updatedAt: string;
}

export interface ColumnDef<TRow> {
  header: string;
  render: (row: TRow) => ReactNode;
  className?: string;
}

export interface AdminListViewProps<TRow extends BaseRow, TForm> {
  title: string;
  searchPlaceholder?: string;
  columns: Array<ColumnDef<TRow>>;
  // 默认/编辑表单初值
  emptyForm: TForm;
  toForm: (row: TRow) => TForm;
  renderForm: (
    form: TForm,
    setForm: Dispatch<SetStateAction<TForm>>,
  ) => ReactNode;

  // 后端调用
  fetcher: (params: {
    page: number;
    pageSize: number;
    keyword?: string;
    isActive?: boolean;
  }) => Promise<Paginated<TRow>>;
  onCreate: (form: TForm) => Promise<unknown>;
  onUpdate: (id: string, form: TForm) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;

  // 删除二次确认时的额外强提示文案（如"将级联删除 N 条相关价格"）
  deleteCascadeWarning?: string;
}

type ActiveFilter = "all" | "active" | "inactive";

export function AdminListView<TRow extends BaseRow, TForm>({
  title,
  searchPlaceholder = "搜索关键字",
  columns,
  emptyForm,
  toForm,
  renderForm,
  fetcher,
  onCreate,
  onUpdate,
  onDelete,
  deleteCascadeWarning,
}: AdminListViewProps<TRow, TForm>) {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState(""); // 已经触发的搜索词
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");

  const [data, setData] = useState<Paginated<TRow> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  // 弹窗状态
  const [editing, setEditing] = useState<TRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<TForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // 删除确认
  const [deleting, setDeleting] = useState<TRow | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // 列表加载
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetcher({
      page,
      pageSize,
      keyword: keyword.trim() || undefined,
      isActive:
        activeFilter === "all"
          ? undefined
          : activeFilter === "active",
    })
      .then((d) => {
        if (cancelled) return;
        setData(d);
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
  }, [fetcher, page, keyword, activeFilter, reloadTick]);

  function reload() {
    setReloadTick((t) => t + 1);
  }

  function openCreate() {
    setForm(emptyForm);
    setSubmitError(null);
    setCreating(true);
  }

  function openEdit(row: TRow) {
    setForm(toForm(row));
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
    try {
      if (editing) {
        await onUpdate(editing.id, form);
      } else {
        await onCreate(form);
      }
      closeDialog();
      reload();
    } catch (err) {
      setSubmitError(formatErr(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeleteSubmitting(true);
    setDeleteError(null);
    try {
      await onDelete(deleting.id);
      setDeleting(null);
      reload();
    } catch (err) {
      setDeleteError(formatErr(err));
    } finally {
      setDeleteSubmitting(false);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <div className="space-y-4">
      {/* 顶栏：标题 + 操作 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{title}</h1>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          新增
        </button>
      </div>

      {/* 过滤栏 */}
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setKeyword(keywordInput);
          setPage(1);
        }}
      >
        <input
          type="text"
          value={keywordInput}
          onChange={(e) => setKeywordInput(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-9 w-64 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          className="h-9 rounded-md border px-3 text-sm hover:bg-muted"
        >
          搜索
        </button>
        <select
          value={activeFilter}
          onChange={(e) => {
            setActiveFilter(e.target.value as ActiveFilter);
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="all">全部状态</option>
          <option value="active">仅上架</option>
          <option value="inactive">仅下架</option>
        </select>
        {(keyword || activeFilter !== "all") && (
          <button
            type="button"
            onClick={() => {
              setKeyword("");
              setKeywordInput("");
              setActiveFilter("all");
              setPage(1);
            }}
            className="h-9 rounded-md px-3 text-sm text-muted-foreground hover:text-foreground"
          >
            清空
          </button>
        )}
      </form>

      {/* 列表 */}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              {columns.map((col) => (
                <th key={col.header} className={cn("px-4 py-2", col.className)}>
                  {col.header}
                </th>
              ))}
              <th className="px-4 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && (!data || data.items.length === 0) && (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-4 py-6 text-center text-muted-foreground"
                >
                  加载中…
                </td>
              </tr>
            )}
            {!loading && data && data.items.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-4 py-6 text-center text-muted-foreground"
                >
                  暂无数据
                </td>
              </tr>
            )}
            {data?.items.map((row) => (
              <tr key={row.id} className="border-t">
                {columns.map((col) => (
                  <td
                    key={col.header}
                    className={cn("px-4 py-2 align-top", col.className)}
                  >
                    {col.render(row)}
                  </td>
                ))}
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

      {/* 新增 / 编辑 弹窗 */}
      {(creating || editing) && (
        <Modal title={editing ? "编辑" : "新增"} onClose={closeDialog}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {renderForm(form, setForm)}
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
            <p>该记录将被永久删除：</p>
            <p className="rounded-md bg-muted px-3 py-2 font-medium">
              {columns[0]?.render(deleting)}
            </p>
            {deleteCascadeWarning && (
              <p className="text-destructive">{deleteCascadeWarning}</p>
            )}
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
// 极简 Modal：fixed 定位 + 背景蒙层 + Esc 关闭
// =====================================================================

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
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
        className="w-full max-w-lg space-y-4 rounded-lg border bg-card p-5 shadow-xl"
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

function formatErr(err: unknown): string {
  if (err instanceof AdminApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "未知错误";
}

// =====================================================================
// 表单字段小部件：让具体页面写得更短
// =====================================================================

export function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

export const textareaCls =
  "min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
