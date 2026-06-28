"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { CHAPTER0_IMAGES } from "@/game/assets";

export default function ProloguePage() {
  const router = useRouter();

  const handleEnter = () => {
    localStorage.setItem("eden_prologue_acknowledged", "true");
    router.push("/game");
  };

  return (
    <div className="eden-game eden-game--prologue">
      <div className="eden-bg eden-prologue-bg">
        <Image
          src={CHAPTER0_IMAGES.secondEdenPrologueBackground}
          alt="第二伊甸园"
          fill
          priority
          sizes="100vw"
          style={{ objectFit: "cover" }}
        />
        <div className="eden-prologue-bg-drift" />
        <div className="eden-prologue-light-veil" />
        <div className="eden-prologue-frame eden-prologue-frame--left" />
        <div className="eden-prologue-frame eden-prologue-frame--right" />
        <div className="eden-prologue-particles" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>

      <main className="eden-prologue-main">
        <section className="eden-prologue-panel" aria-labelledby="prologue-title">
          <p className="home-subtitle">第二伊甸园 · 复刻前记录</p>
          <h1 id="prologue-title" className="eden-prologue-title">关于这座园</h1>

          <div className="eden-prologue-copy">
            <p>《EDEN》是一部虚构的科幻叙事作品。</p>

            <p>
              本作借用了园、树、河流、禁令与选择等古老神话意象，重新构建了一座名为“第二伊甸园”的叙事空间。
            </p>

            <p>
              游戏中的人物、事件顺序与对话内容，均服务于原创世界观与互动体验，不构成对任何宗教信仰、经典文本或现实群体的解释、评价或替代。
            </p>

            <p>
              在这里，伊甸园不是被还原的历史。<br />
              它是一场关于服从、好奇、语言与自我判断的虚构观测。
            </p>
          </div>

          <button className="eden-btn eden-btn--primary eden-prologue-enter" onClick={handleEnter}>
            进入复刻记录
          </button>
          <p className="eden-prologue-note">继续即表示你已了解本作的虚构设定。</p>
        </section>
      </main>
    </div>
  );
}
