export function StyleLibraryPage() {
  return (
    <div className="px-10 py-8">
      <h1 className="font-display text-[28px] leading-none tracking-tight">视觉风格</h1>
      <p className="text-muted-foreground mt-3 max-w-lg text-[13px] leading-6">
        画风、光色、镜头气质。和角色、场景一样，以后每个风格也是一套生成槽：提示词、参考图、参考视频，封面只是最终样张。
      </p>
      <div className="bg-card/70 mt-10 max-w-xl rounded-[28px] border border-dashed border-white/12 p-8">
        <div className="flex gap-2">
          {["#111111", "#2A2A2A", "#5CE1B5", "#A7F3D0"].map((color) => (
            <span
              key={color}
              className="h-16 flex-1 rounded-2xl shadow-inner"
              style={{ background: color }}
            />
          ))}
        </div>
        <p className="mt-5 text-[15px] font-medium">还没有独立风格库</p>
        <p className="text-muted-foreground mt-2 text-[13px] leading-6">
          现在先把项目、角色、场景用熟。风格会做成可被多个项目引用的视觉圣经，避免每部片子重新发明光色。
        </p>
      </div>
    </div>
  );
}
