export function PropLibraryPage() {
  return (
    <div className="px-10 py-8">
      <h1 className="font-display text-[28px] leading-none tracking-tight">道具</h1>
      <p className="text-muted-foreground mt-3 max-w-lg text-[13px] leading-6">
        衣服、物件、关键道具。以后会做成可被多个项目引用的资产，而不是每部片子各自复制一份。
      </p>
      <div className="bg-card/70 mt-10 max-w-xl rounded-[28px] border border-dashed border-white/12 p-8">
        <p className="text-[15px] font-medium">还没有独立道具库</p>
        <p className="text-muted-foreground mt-2 text-[13px] leading-6">
          现在先把项目、角色、场景用熟。道具会和角色、场景一样，做成提示词加参考素材的生成槽。
        </p>
      </div>
    </div>
  );
}
