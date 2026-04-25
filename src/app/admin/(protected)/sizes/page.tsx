"use client";

import { useCallback } from "react";
import {
  AdminListView,
  FieldRow,
  inputCls,
} from "@/components/admin/admin-list-view";
import {
  type AdminSize,
  createSize,
  deleteSize,
  listSizes,
  updateSize,
} from "@/lib/admin-api";

interface SizeForm {
  name: string;
  // 输入框用 string，提交时再 parse；空串 → null
  width: string;
  height: string;
  gusset: string;
  unit: string;
  isActive: boolean;
  sortOrder: number;
}

const emptyForm: SizeForm = {
  name: "",
  width: "",
  height: "",
  gusset: "",
  unit: "mm",
  isActive: true,
  sortOrder: 0,
};

function parseNullableNumber(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export default function SizesPage() {
  const fetcher = useCallback(
    (params: {
      page: number;
      pageSize: number;
      keyword?: string;
      isActive?: boolean;
    }) => listSizes(params),
    [],
  );

  return (
    <AdminListView<AdminSize, SizeForm>
      title="尺寸管理"
      searchPlaceholder="按名称搜索"
      fetcher={fetcher}
      emptyForm={emptyForm}
      toForm={(row) => ({
        name: row.name,
        width: row.width !== null ? String(row.width) : "",
        height: row.height !== null ? String(row.height) : "",
        gusset: row.gusset !== null ? String(row.gusset) : "",
        unit: row.unit,
        isActive: row.isActive,
        sortOrder: row.sortOrder,
      })}
      onCreate={(form) =>
        createSize({
          name: form.name,
          width: parseNullableNumber(form.width),
          height: parseNullableNumber(form.height),
          gusset: parseNullableNumber(form.gusset),
          unit: form.unit,
          isActive: form.isActive,
          sortOrder: form.sortOrder,
        })
      }
      onUpdate={(id, form) =>
        updateSize(id, {
          name: form.name,
          width: parseNullableNumber(form.width),
          height: parseNullableNumber(form.height),
          gusset: parseNullableNumber(form.gusset),
          unit: form.unit,
          isActive: form.isActive,
          sortOrder: form.sortOrder,
        })
      }
      onDelete={deleteSize}
      deleteCascadeWarning="将级联删除涉及该尺寸的所有价格记录。"
      columns={[
        { header: "名称", render: (row) => row.name },
        {
          header: "宽 × 高 × 折",
          render: (row) =>
            [row.width, row.height, row.gusset]
              .map((v) => (v !== null ? v : "-"))
              .join(" × "),
          className: "tabular-nums",
        },
        { header: "单位", render: (row) => row.unit },
        { header: "排序", render: (row) => row.sortOrder },
        {
          header: "状态",
          render: (row) => (row.isActive ? "上架" : "下架"),
        },
      ]}
      renderForm={(form, setForm) => (
        <>
          <FieldRow label="名称">
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputCls}
            />
          </FieldRow>
          <div className="grid grid-cols-3 gap-3">
            <FieldRow label="宽">
              <input
                type="number"
                step="any"
                value={form.width}
                onChange={(e) =>
                  setForm((f) => ({ ...f, width: e.target.value }))
                }
                className={inputCls}
              />
            </FieldRow>
            <FieldRow label="高">
              <input
                type="number"
                step="any"
                value={form.height}
                onChange={(e) =>
                  setForm((f) => ({ ...f, height: e.target.value }))
                }
                className={inputCls}
              />
            </FieldRow>
            <FieldRow label="折边">
              <input
                type="number"
                step="any"
                value={form.gusset}
                onChange={(e) =>
                  setForm((f) => ({ ...f, gusset: e.target.value }))
                }
                className={inputCls}
              />
            </FieldRow>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <FieldRow label="单位">
              <input
                value={form.unit}
                onChange={(e) =>
                  setForm((f) => ({ ...f, unit: e.target.value }))
                }
                className={inputCls}
              />
            </FieldRow>
            <FieldRow label="排序">
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    sortOrder: Number(e.target.value) || 0,
                  }))
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
                上架
              </label>
            </FieldRow>
          </div>
        </>
      )}
    />
  );
}
