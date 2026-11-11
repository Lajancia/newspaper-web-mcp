"use client";

import { useSyncExternalStore, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getPaper, subscribe, type PaperState } from "@/lib/newspaper-store";
import { registerAll } from "@/lib/webmcp-register";

function usePaper(): PaperState {
  return useSyncExternalStore(subscribe, getPaper, getPaper);
}

export default function Newspaper() {
  const paper = usePaper();

  useEffect(() => {
    registerAll();
  }, []);

  const filled = paper.headlines.length + paper.stories.length + paper.tasks.length;

  return (
    <div className="min-h-screen bg-[#faf9f6] text-[#111111]">
      {/* Masthead */}
      <header className="relative border-b-2 border-black pt-8 pb-4">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <p className="font-label-caps text-xs tracking-[0.35em] uppercase text-[#444748]">
            Agent-Filled Edition · Serverless · WebMCP
          </p>
          <h1 className="font-headline-lg text-5xl font-bold tracking-tight mt-2">
            TARA&apos;s Daily
          </h1>
          <div className="mt-3 flex items-center justify-center gap-3 text-sm text-[#444748]">
            <span className="font-body-news">
              {paper.date
                ? new Date(paper.date + "T00:00:00").toLocaleDateString("ko-KR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    weekday: "long",
                  })
                : "발행일 미정 — agent가 set_date 호출"}
            </span>
            <Separator orientation="vertical" className="h-4" />
            <Badge
              variant={filled > 0 ? "default" : "outline"}
              className="rounded-none font-label-caps tracking-wider"
            >
              {filled > 0 ? `${filled}건 게재됨` : "빈 신문 — agent 대기 중"}
            </Badge>
          </div>
        </div>
        {/* PDF export — browser print-to-PDF preserves the broadsheet layout */}
        <button
          type="button"
          onClick={() => window.print()}
          className="no-print absolute right-4 top-4 border border-black/40 px-3 py-1 font-label-caps text-xs tracking-wider uppercase text-[#444748] hover:bg-[#efeeec] hover:text-[#111111] transition-colors cursor-pointer"
        >
          PDF로 저장
        </button>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-8">
        {/* News section */}
        <section>
          <h2 className="font-headline-lg text-2xl font-bold border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
            <span className="inline-block w-1.5 h-5 bg-secondary" />
            관심 뉴스
          </h2>

          {paper.headlines.length === 0 && paper.stories.length === 0 ? (
            <p className="font-body-news text-[#747878] text-lg italic">
              agent가 add_headline / add_story 를 호출하면 이곳이 채워집니다.
            </p>
          ) : null}

          {paper.headlines.map((h, i) => (
            <article key={`h${i}`} className="mb-6">
              <h3 className="font-headline-lg text-3xl font-bold leading-snug">
                {h.url ? (
                  <a href={h.url} target="_blank" rel="noreferrer" className="hover:underline">
                    {h.title}
                  </a>
                ) : (
                  h.title
                )}
              </h3>
              {h.summary ? (
                <p className="font-body-news text-[#111111] mt-1 leading-relaxed">{h.summary}</p>
              ) : null}
              {h.source ? (
                <p className="text-xs text-[#444748] mt-1 font-label-caps tracking-wider">— {h.source}</p>
              ) : null}
              <Separator className="my-4" />
            </article>
          ))}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {paper.stories.map((s, i) => (
              <article key={`s${i}`} className="border-t border-black/20 pt-3">
                <h4 className="font-headline-lg text-lg font-semibold">
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noreferrer" className="hover:underline">
                      {s.title}
                    </a>
                  ) : (
                    s.title
                  )}
                </h4>
                <p className="font-body-news text-sm text-[#111111] mt-1 leading-relaxed">{s.body}</p>
                {s.source ? <p className="text-xs text-[#444748] mt-1 font-label-caps tracking-wider">— {s.source}</p> : null}
              </article>
            ))}
          </div>
        </section>

        {/* Sidebar: tasks */}
        <aside>
          <h2 className="font-headline-lg text-2xl font-bold border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
            <span className="inline-block w-1.5 h-5 bg-secondary" />
            오늘 할일
          </h2>
          {paper.tasks.length === 0 ? (
            <p className="font-body-news text-[#747878] italic">
              agent가 add_task 를 호출하면 채워집니다.
            </p>
          ) : (
            <ul className="space-y-3">
              {paper.tasks.map((t, i) => (
                <li key={`t${i}`} className="font-body-news text-[15px] flex gap-2">
                  <span className="text-[#747878]">◇</span>
                  <span>
                    {t.text}
                    {t.due ? <span className="text-[#444748] text-xs ml-1 font-label-caps">({t.due})</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </main>

      <footer className="border-t border-black/20 mt-4 py-6 text-center text-xs text-[#444748] font-body-news">
        데이터는 이 탭의 메모리에만 존재합니다 · 서버 저장 없음 · 새로고침 시 빈 신문
      </footer>
    </div>
  );
}
