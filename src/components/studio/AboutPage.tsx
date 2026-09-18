import { ExternalLink } from "lucide-react";
import {
  GITHUB_URL,
  LOGO_SRC,
  PRODUCT_NAME_EN,
  PRODUCT_NAME_ZH,
  PRODUCT_TAGLINE,
} from "@/lib/brand";

export function AboutPage() {
  return (
    <div className="px-10 py-10">
      <div className="max-w-3xl">
        <img
          src={LOGO_SRC}
          alt={PRODUCT_NAME_ZH}
          className="w-[min(72vw,28rem)] max-w-full object-contain drop-shadow-[0_24px_60px_rgb(0_0_0_/_0.65)]"
        />
        <h1 className="font-display mt-8 text-[40px] leading-none tracking-tight">{PRODUCT_NAME_ZH}</h1>
        <p className="text-muted-foreground mt-3 text-base tracking-wide">{PRODUCT_NAME_EN}</p>

        <p className="text-muted-foreground mt-6 max-w-xl text-sm leading-6">{PRODUCT_TAGLINE}</p>

        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="text-brand hover:text-brand/90 mt-6 inline-flex items-center gap-2 text-sm font-medium transition-colors"
        >
          GitHub · {PRODUCT_NAME_EN}
          <ExternalLink className="size-3.5 opacity-80" aria-hidden />
        </a>

        <section className="mt-10 space-y-3">
          <h2 className="font-display text-lg tracking-tight">数据与隐私</h2>
          <ul className="text-muted-foreground list-disc space-y-2 pl-5 text-sm leading-6">
            <li>项目、分镜与资产默认保存在本机浏览器（IndexedDB），不依赖云端用户库。</li>
            <li>AI 连接密钥（BYOK）只存在本机，不会写入项目备份 ZIP。</li>
            <li>导出 / 导入由你主动触发；把备份交给谁，由你自己决定。</li>
            <li>当前产品说明是普通语言告知，不是法律意见书；正式隐私政策可后续替换。</li>
          </ul>
        </section>

      </div>
    </div>
  );
}
