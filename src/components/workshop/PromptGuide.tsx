"use client";

import { Button, Drawer, Modal } from "antd";

import { useMediaQuery } from "@/lib/use-media-query";

import { Mode } from "./constants";

type Example = { bad: string; good: string };

/** 每种模式的写法公式、前后对比和小技巧，都是静态内容，不调接口。 */
const GUIDES: Record<
  Mode,
  {
    formula: { part: string; example: string }[];
    examples: Example[];
    tips: string[];
  }
> = {
  [Mode.Generate]: {
    formula: [
      { part: "主体", example: "一只橘猫" },
      { part: "场景", example: "趴在洒满阳光的窗台上" },
      { part: "构图", example: "侧面特写" },
      { part: "光线", example: "温暖的午后侧光" },
      { part: "风格", example: "写实摄影，浅景深" },
      { part: "画面文字", example: "顶部写着「午后」" },
    ],
    examples: [
      {
        bad: "一只猫",
        good: "一只橘猫趴在洒满阳光的窗台上，侧面特写，温暖的午后侧光，写实摄影风格，背景是虚化的绿植",
      },
      {
        bad: "咖啡店海报，好看一点",
        good: "一张竖版咖啡店开业海报，中间是一杯冒着热气的拿铁，背景是温暖的木质吧台，暖棕色调，扁平插画风格，顶部用白色粗体写着「GRAND OPENING」",
      },
      {
        bad: "高清，杰作，8K，未来城市",
        good: "黄昏时分的未来城市天际线，高楼之间穿梭着悬浮列车，天空是橙紫色渐变，霓虹灯刚刚亮起，电影感广角构图",
      },
    ],
    tips: [
      "写具体的画面描述，别写「高清、杰作、8K」这类空词，模型不靠它们出好图。",
      "主体放在最前面，再依次补场景、构图、光线和风格。",
      "要出现在图里的文字用引号括起来，并写清位置、颜色和字体风格。",
      "风格只选一种，写实摄影和卡通插画混在一起容易四不像。",
      "写完不满意，点「✨ 优化提示词」让 AI 帮你润色。",
    ],
  },
  [Mode.Edit]: {
    formula: [
      { part: "改哪里", example: "人物的衣服" },
      { part: "改成什么样", example: "换成红色丝绸旗袍" },
      { part: "保留什么", example: "面部、发型和姿态保持不变" },
    ],
    examples: [
      {
        bad: "换件衣服",
        good: "把人物的衣服换成红色丝绸旗袍，带金色刺绣花纹，人物的面部、发型、姿态和背景保持不变",
      },
      {
        bad: "背景好看点",
        good: "把背景换成黄昏时分的海边沙滩，天空是橙粉色晚霞，人物和光线方向保持不变",
      },
      {
        bad: "合成一下",
        good: "把图1中人物穿的外套换到图2的人物身上，图2人物的面部、姿态和背景保持不变",
      },
    ],
    tips: [
      "先说改哪里，再说改成什么样，颜色、材质、位置写得越具体越好。",
      "一定要写清楚保留什么，比如「面部、姿态、构图保持不变」，否则整张图可能都会变。",
      "多张参考图时用「图1」「图2」指代，写清每张图提供什么。",
      "一次只改一两处，改动太多时可以分几次编辑。",
      "写完不满意，点「✨ 优化提示词」让 AI 帮你润色。",
    ],
  },
};

const NEGATIVE_EXAMPLES: Example[] = [
  { bad: "不要杂乱的背景", good: "干净的纯白色背景" },
  { bad: "不要太暗", good: "明亮柔和的自然光" },
  { bad: "不要出现别人", good: "画面中只有一个人" },
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-sand-800 dark:text-sand-200">
      {children}
    </h3>
  );
}

function GuideContent({
  mode,
  onUse,
}: {
  mode: Mode;
  onUse: (prompt: string) => void;
}) {
  const guide = GUIDES[mode];

  return (
    <div className="flex flex-col gap-5 pt-1 text-sm leading-relaxed text-sand-700 dark:text-sand-300">
      <section className="flex flex-col gap-2">
        <SectionTitle>1. 照着这个顺序写</SectionTitle>
        <div className="flex flex-wrap items-center gap-1.5">
          {guide.formula.map((item, i) => (
            <span key={item.part} className="inline-flex items-center gap-1.5">
              {i > 0 && <span className="text-sand-400">+</span>}
              <span className="rounded-lg border border-clay-200 bg-clay-50/70 px-2 py-1 text-xs dark:border-clay-500/40 dark:bg-clay-500/10">
                <span className="font-medium text-clay-700 dark:text-clay-300">
                  {item.part}
                </span>
                <span className="text-sand-500 dark:text-sand-400">
                  {" "}
                  {item.example}
                </span>
              </span>
            </span>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle>2. 看看前后对比</SectionTitle>
        <ul className="flex flex-col gap-2">
          {guide.examples.map((example) => (
            <li
              key={example.bad}
              className="flex flex-col gap-1.5 rounded-xl border border-sand-200 bg-white/60 p-3 text-xs dark:border-sand-700 dark:bg-sand-900/50"
            >
              <p className="text-sand-500 line-through decoration-red-400/70 dark:text-sand-400">
                ❌ {example.bad}
              </p>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sand-800 dark:text-sand-200">
                  ✅ {example.good}
                </p>
                <button
                  type="button"
                  onClick={() => onUse(example.good)}
                  className="shrink-0 rounded-md border border-clay-200 px-2 py-1 text-[11px] text-clay-700 transition hover:bg-clay-50 dark:border-clay-500/40 dark:text-clay-300 dark:hover:bg-clay-500/10"
                >
                  用这个
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle>3. 几个小技巧</SectionTitle>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-xs">
          {guide.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle>4. 想排除某些东西？</SectionTitle>
        <p className="text-xs">
          有些绘图工具有单独的「负面提示词」输入框，专门填「不要出现什么」。本站用的
          gpt-image 系列没有这个参数，直接写「不要
          xxx」模型理解得不稳定，有时反而会把 xxx 画出来。更好的办法是
          <strong>换成正面描述</strong>：
        </p>
        <ul className="flex flex-col gap-1 text-xs">
          {NEGATIVE_EXAMPLES.map((example) => (
            <li key={example.bad}>
              <span className="text-sand-500 line-through decoration-red-400/70 dark:text-sand-400">
                {example.bad}
              </span>
              <span className="mx-1.5 text-sand-400">→</span>
              <span className="text-sand-800 dark:text-sand-200">
                {example.good}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-sand-500 dark:text-sand-400">
          实在要排除，就写成完整的句子，比如「画面中不出现任何文字或水印」。出图后还有多余的东西，可以切到编辑模式，写「去掉右下角的水印，其余保持不变」。
        </p>
      </section>
    </div>
  );
}

/** 「不知道怎么写？」弹窗：按当前模式给出写法公式、前后对比、小技巧和负面提示词科普。 */
export function PromptGuide({
  open,
  mode,
  onClose,
  onUse,
}: {
  open: boolean;
  mode: Mode;
  onClose: () => void;
  onUse: (prompt: string) => void;
}) {
  const isMobile = useMediaQuery("(max-width: 640px)");
  if (!open) return null;

  const title = mode === Mode.Edit ? "编辑提示词怎么写？" : "提示词怎么写？";
  const content = (
    <GuideContent
      mode={mode}
      onUse={(prompt) => {
        onUse(prompt);
        onClose();
      }}
    />
  );
  const footer = (
    <Button type="primary" onClick={onClose}>
      知道了
    </Button>
  );

  if (isMobile) {
    return (
      <Drawer
        title={title}
        open
        placement="bottom"
        height="min(720px, 88vh)"
        onClose={onClose}
        styles={{ body: { paddingBottom: 16, overflowY: "auto" } }}
        footer={<div className="flex justify-end">{footer}</div>}
      >
        {content}
      </Drawer>
    );
  }

  return (
    <Modal
      title={title}
      open
      centered
      width={600}
      onCancel={onClose}
      footer={footer}
    >
      {content}
    </Modal>
  );
}
