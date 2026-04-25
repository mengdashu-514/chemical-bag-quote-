"use client";

import { useCallback } from "react";
import {
  AdminListView,
  FieldRow,
  inputCls,
  textareaCls,
} from "@/components/admin/admin-list-view";
import {
  type AdminModel,
  createModel,
  deleteModel,
  listModels,
  updateModel,
} from "@/lib/admin-api";

interface ModelForm {
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
}

const emptyForm: ModelForm = {
  code: "",
  name: "",
  description: "",
  isActive: true,
  sortOrder: 0,
};

export default function ModelsPage() {
  // 适配 AdminListView 的 fetcher 形态
  const fetcher = useCallback(
    (params: {
      page: number;
      pageSize: number;
      keyword?: string;
      isActive?: boolean;
    }) => listModels(params),
    [],
  );

  return (
    <AdminListView<AdminModel, ModelForm>
      title="型号管理"
      searchPlaceholder="按 code / name 搜索"
      fetcher={fetcher}
      emptyForm={emptyForm}
      toForm={(row) => ({
        code: row.code,
        name: row.name,
        description: row.description ?? "",
        isActive: row.isActive,
        sortOrder: row.sortOrder,
      })}
      onCreate={(form) =>
        createModel({
          code: form.code,
          name: form.name,
          description: form.description.trim() || null,
          isActive: form.isActive,
          sortOrder: form.sortOrder,
        })
      }
      onUpdate={(id, form) =>
        updateModel(id, {
          code: form.code,
          name: form.name,
          description: form.description.trim() || null,
          isActive: form.isActive,
          sortOrder: form.sortOrder,
        })
      }
      onDelete={deleteModel}
      deleteCascadeWarning="将级联删除该型号下的所有价格记录。"
      columns={[
        { header: "Code", render: (row) => row.code, className: "font-mono" },
        { header: "名称", render: (row) => row.name },
        {
          header: "描述",
          render: (row) => row.description ?? "-",
          className: "text-muted-foreground",
        },
        { header: "排序", render: (row) => row.sortOrder },
        {
          header: "状态",
          render: (row) => (row.isActive ? "上架" : "下架"),
        },
      ]}
      renderForm={(form, setForm) => (
        <>
          <FieldRow label="Code">
            <input
              required
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              className={inputCls}
            />
          </FieldRow>
          <FieldRow label="名称">
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputCls}
            />
          </FieldRow>
          <FieldRow label="描述">
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              className={textareaCls}
            />
          </FieldRow>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="排序（升序）">
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
                上架（C 端可见）
              </label>
            </FieldRow>
          </div>
        </>
      )}
    />
  );
}
