"use client";

import { useCallback } from "react";
import {
  AdminListView,
  FieldRow,
  inputCls,
  textareaCls,
} from "@/components/admin/admin-list-view";
import {
  type AdminMaterial,
  createMaterial,
  deleteMaterial,
  listMaterials,
  updateMaterial,
} from "@/lib/admin-api";

interface MaterialForm {
  name: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
}

const emptyForm: MaterialForm = {
  name: "",
  description: "",
  isActive: true,
  sortOrder: 0,
};

export default function MaterialsPage() {
  const fetcher = useCallback(
    (params: {
      page: number;
      pageSize: number;
      keyword?: string;
      isActive?: boolean;
    }) => listMaterials(params),
    [],
  );

  return (
    <AdminListView<AdminMaterial, MaterialForm>
      title="材质管理"
      searchPlaceholder="按名称搜索"
      fetcher={fetcher}
      emptyForm={emptyForm}
      toForm={(row) => ({
        name: row.name,
        description: row.description ?? "",
        isActive: row.isActive,
        sortOrder: row.sortOrder,
      })}
      onCreate={(form) =>
        createMaterial({
          name: form.name,
          description: form.description.trim() || null,
          isActive: form.isActive,
          sortOrder: form.sortOrder,
        })
      }
      onUpdate={(id, form) =>
        updateMaterial(id, {
          name: form.name,
          description: form.description.trim() || null,
          isActive: form.isActive,
          sortOrder: form.sortOrder,
        })
      }
      onDelete={deleteMaterial}
      deleteCascadeWarning="将级联删除涉及该材质的所有价格记录。"
      columns={[
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
