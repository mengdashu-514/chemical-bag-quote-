"use client";

import { useCallback } from "react";
import {
  AdminListView,
  FieldRow,
  inputCls,
} from "@/components/admin/admin-list-view";
import {
  type AdminUser,
  createUser,
  deleteUser,
  listUsers,
  updateUser,
} from "@/lib/admin-api";
import type { Role } from "@/lib/roles";

interface UserForm {
  username: string;
  password: string;
  displayName: string;
  role: Role;
  isActive: boolean;
}

const emptyForm: UserForm = {
  username: "",
  password: "",
  displayName: "",
  role: "STAFF",
  isActive: true,
};

export function UsersAdmin({ currentUserId }: { currentUserId: string }) {
  const fetcher = useCallback(
    (params: {
      page: number;
      pageSize: number;
      keyword?: string;
      isActive?: boolean;
    }) => listUsers(params),
    [],
  );

  return (
    <AdminListView<AdminUser, UserForm>
      title="后台账号"
      searchPlaceholder="按用户名 / 显示名搜索"
      fetcher={fetcher}
      emptyForm={emptyForm}
      toForm={(row) => ({
        username: row.username,
        password: "",
        displayName: row.displayName ?? "",
        role: row.role,
        isActive: row.isActive,
      })}
      onCreate={(form) =>
        createUser({
          username: form.username,
          password: form.password,
          displayName: form.displayName.trim() || null,
          role: form.role,
        })
      }
      onUpdate={(id, form) =>
        // 后端 PATCH 只接受这三个字段；username / password 不开放
        updateUser(id, {
          displayName: form.displayName.trim() || null,
          role: form.role,
          isActive: form.isActive,
        })
      }
      onDelete={deleteUser}
      dangerAction={{
        rowLabel: "停用",
        confirmTitle: "确认停用？",
        confirmCta: "确认停用",
        submittingCta: "停用中…",
        intro: "该账号将被停用（软删除），下次登录会被拦截：",
        warning: "已签发的 cookie 仍会通过 /api/auth/me 校验，所以会自动失效。",
      }}
      columns={[
        {
          header: "用户名",
          render: (row) => (
            <span className="font-mono">
              {row.username}
              {row.id === currentUserId && (
                <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  当前
                </span>
              )}
            </span>
          ),
        },
        { header: "显示名", render: (row) => row.displayName ?? "-" },
        {
          header: "角色",
          render: (row) => (
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
              {row.role}
            </span>
          ),
        },
        {
          header: "上次登录",
          render: (row) =>
            row.lastLoginAt
              ? new Date(row.lastLoginAt).toLocaleString("zh-CN")
              : "-",
          className: "text-muted-foreground tabular-nums",
        },
        {
          header: "状态",
          render: (row) => (row.isActive ? "启用" : "已停用"),
        },
      ]}
      renderForm={(form, setForm, mode) => (
        <>
          <FieldRow
            label="用户名"
            hint={mode === "edit" ? "用户名不可修改" : "字母数字与 . _ -，3~64 位"}
          >
            <input
              required
              minLength={3}
              maxLength={64}
              // HTML pattern 属性在 Chrome 120+ 走 RegExp `v` flag，规则比默认的 `u` 严：
              // 字符类里的字面 `-` 必须显式转义为 `\-`。JSX 普通 string attribute 不解析 JS 转义
              // （`"\\-"` 字面是两个反斜杠+减号），所以这里用 `{...}` 走 JS 表达式，求值后是 `\-`。
              pattern={"[a-zA-Z0-9._\\-]+"}
              disabled={mode === "edit"}
              value={form.username}
              onChange={(e) =>
                setForm((f) => ({ ...f, username: e.target.value }))
              }
              className={`${inputCls} disabled:cursor-not-allowed disabled:opacity-60`}
            />
          </FieldRow>

          {mode === "create" && (
            <FieldRow label="初始密码" hint="≥ 8 位；首次登录后请提示用户改密">
              <input
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
                className={inputCls}
                autoComplete="new-password"
              />
            </FieldRow>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="显示名">
              <input
                value={form.displayName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, displayName: e.target.value }))
                }
                className={inputCls}
              />
            </FieldRow>
            <FieldRow label="角色">
              <select
                value={form.role}
                onChange={(e) =>
                  setForm((f) => ({ ...f, role: e.target.value as Role }))
                }
                className={inputCls}
              >
                <option value="STAFF">STAFF（销售/运营）</option>
                <option value="ADMIN">ADMIN（可管理账号）</option>
              </select>
            </FieldRow>
          </div>

          {mode === "edit" && (
            <FieldRow label="状态">
              <label className="flex h-9 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, isActive: e.target.checked }))
                  }
                />
                启用
              </label>
            </FieldRow>
          )}
        </>
      )}
    />
  );
}
