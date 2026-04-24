export default function Home() {
  return (
    <main className="container py-10">
      <div className="mx-auto max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold">化工包装袋报价系统</h1>
        <p className="text-muted-foreground">
          项目骨架已就绪，C 端报价计算器将在 Phase 4 实现。
        </p>
        <p className="text-sm text-muted-foreground">
          后台入口：<code className="rounded bg-muted px-2 py-1">/admin</code>
        </p>
      </div>
    </main>
  );
}
