"use client";

import React, { useRef, useState } from "react";
import { Shield, Zap, Share2, Check, Sparkles } from "lucide-react";

type TabRole = "client" | "broker" | "vendor";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<TabRole>("broker");
  const [copiedRole, setCopiedRole] = useState<TabRole | null>(null);

  const clientFrameRef = useRef<HTMLIFrameElement>(null);
  const vendorFrameRef = useRef<HTMLIFrameElement>(null);

  const triggerScenario = (role: "client" | "vendor", text: string) => {
    const frame =
      role === "client" ? clientFrameRef.current : vendorFrameRef.current;
    frame?.contentWindow?.postMessage(
      { type: "DEAL_GLASS_INJECT", role, text },
      "*"
    );
    setActiveTab("broker");
  };

  const copyRoleLink = async (role: TabRole) => {
    const url = `${window.location.origin}/room?role=${role}`;
    await navigator.clipboard.writeText(url);
    setCopiedRole(role);
    setTimeout(() => setCopiedRole(null), 1800);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Navigation & Demo Control Bar */}
      <header className="px-4 py-3 border-b border-slate-800 bg-slate-900/95 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 via-amber-400 to-purple-500 flex items-center justify-center shadow-lg">
            <Shield className="w-4 h-4 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-white">
                Deal Glass
              </h1>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Nexconn Live SDK
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Asymmetric Multi-Party Chat • Zero-Leak Dual-Channel Relay
            </p>
          </div>
        </div>

        {/* 1-Click Judge Demo Scenarios */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() =>
              triggerScenario(
                "client",
                "Hey, call me at 9876543210 or email raj@acme.com. Since I'm paying ₹50,000 for Acme, please deliver by Friday!"
              )
            }
            className="text-xs px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold flex items-center gap-1.5 transition shadow"
          >
            <Zap className="w-3.5 h-3.5" /> Demo: Budget + Phone Leak
          </button>

          <button
            onClick={() =>
              triggerScenario(
                "client",
                "Please finalize the landing page design by Friday so we can review."
              )
            }
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium flex items-center gap-1.5 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-400" /> Demo: Auto Deadline Shift
          </button>

          {/* Shareable Multi-Device Links */}
          <div className="hidden lg:flex items-center gap-1 pl-2 border-l border-slate-800">
            <Share2 className="w-3.5 h-3.5 text-slate-500 mr-1" />
            {(["client", "broker", "vendor"] as const).map((r) => (
              <button
                key={r}
                onClick={() => copyRoleLink(r)}
                className="text-[11px] px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/80 capitalize flex items-center gap-1"
                title={`Copy standalone ${r} link`}
              >
                {copiedRole === r ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : null}
                {r}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Mobile Tab Switcher (visible below md screens) */}
      <div className="md:hidden grid grid-cols-3 border-b border-slate-800 bg-slate-900 shrink-0">
        {(["client", "broker", "vendor"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-2.5 text-xs font-semibold capitalize border-b-2 transition ${
              activeTab === tab
                ? tab === "client"
                  ? "border-blue-500 text-blue-300 bg-slate-800/50"
                  : tab === "broker"
                  ? "border-amber-500 text-amber-300 bg-slate-800/50"
                  : "border-purple-500 text-purple-300 bg-slate-800/50"
                : "border-transparent text-slate-400"
            }`}
          >
            {tab === "broker" ? "Broker Hub" : tab}
          </button>
        ))}
      </div>

      {/* 3-Pane Live Workspace (keeps all 3 iframes mounted on mobile too!) */}
      <main className="flex-1 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800 min-h-0">
        <div
          className={`${
            activeTab === "client" ? "flex" : "hidden"
          } md:flex flex-col min-h-0`}
        >
          <iframe
            ref={clientFrameRef}
            src="/room?role=client"
            className="w-full h-full border-0"
            title="Client Pane"
          />
        </div>

        <div
          className={`${
            activeTab === "broker" ? "flex" : "hidden"
          } md:flex flex-col min-h-0`}
        >
          <iframe
            src="/room?role=broker"
            className="w-full h-full border-0"
            title="Broker Control Room"
          />
        </div>

        <div
          className={`${
            activeTab === "vendor" ? "flex" : "hidden"
          } md:flex flex-col min-h-0`}
        >
          <iframe
            ref={vendorFrameRef}
            src="/room?role=vendor"
            className="w-full h-full border-0"
            title="Vendor Pane"
          />
        </div>
      </main>
    </div>
  );
}