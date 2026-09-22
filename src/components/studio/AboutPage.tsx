import { ExternalLink, Heart, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  GITHUB_URL,
  LOGO_LOCKUP_SRC,
  PRODUCT_NAME_EN,
  PRODUCT_NAME_ZH,
  PRODUCT_TAGLINE,
} from "@/lib/brand";

export function AboutPage() {
  return (
    <div className="px-5 py-8 sm:px-10 sm:py-10">
      <div className="max-w-3xl">
        <h1 className="sr-only">关于{PRODUCT_NAME_ZH}</h1>
        <img
          src={LOGO_LOCKUP_SRC}
          alt={`${PRODUCT_NAME_ZH} ${PRODUCT_NAME_EN}`}
          className="w-[min(72vw,28rem)] max-w-full rounded-2xl bg-black object-contain drop-shadow-[0_24px_60px_rgb(0_0_0_/_0.65)]"
        />
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

        <section className="mt-10 border-y py-8" aria-labelledby="support-heading">
          <div className="flex items-center gap-2">
            <Heart className="size-4 text-muted-foreground" aria-hidden />
            <h2 id="support-heading" className="font-display text-lg tracking-tight">支持小光点</h2>
          </div>
          <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-6">
            如果小光点帮你完成了创作，欢迎请开发者喝杯咖啡，支持项目继续打磨。感谢每一份使用、反馈与支持。
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild>
              <a href="https://afdian.com/a/ROYIANS" target="_blank" rel="noopener noreferrer">
                在爱发电支持
                <ExternalLink aria-hidden />
              </a>
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline"><QrCode aria-hidden />微信赞赏码</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>感谢支持小光点</DialogTitle>
                  <DialogDescription>使用微信扫一扫，或保存图片后在微信中识别赞赏码。</DialogDescription>
                </DialogHeader>
                <img
                  src="/brand/sponsor-wechat.jpg"
                  alt="不完美小孩的微信赞赏码"
                  width={1152}
                  height={1152}
                  className="h-auto w-full rounded-md"
                />
                <Button asChild variant="outline">
                  <a href="/brand/sponsor-wechat.jpg" download="小光点-微信赞赏码.jpg">保存赞赏码</a>
                </Button>
              </DialogContent>
            </Dialog>
          </div>
        </section>

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
