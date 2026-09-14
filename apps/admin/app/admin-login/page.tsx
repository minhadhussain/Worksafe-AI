import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, HardHat } from "lucide-react";

import { AdminLoginForm } from "@/components/admin-login-form";

export const metadata: Metadata = { title: "Admin Login" };

export default function AdminLoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <Image
        src="/industrial-workers.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        quality={90}
        className="object-cover object-[54%_42%]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,10,16,0.88)_0%,rgba(5,12,19,0.7)_28%,rgba(6,14,21,0.28)_58%,rgba(4,10,16,0.52)_100%),linear-gradient(0deg,rgba(8,14,20,0.94)_0%,rgba(8,14,20,0.72)_14%,rgba(8,14,20,0.36)_46%,rgba(8,14,20,0.9)_100%)]" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl items-center justify-center px-5 py-8 sm:px-8">
        <div className="w-full max-w-xl">
          <div className="mb-5 flex justify-center">
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground">
              <ArrowLeft className="size-4" aria-hidden="true" /> Back to landing page
            </Link>
          </div>

          <section className="rounded-[24px] border border-white/12 bg-[rgba(21,31,40,0.5)] p-6 text-center shadow-[0_12px_40px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-[20px] sm:p-8">
            <div className="mb-8 flex flex-col items-center">
              <span className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <HardHat className="size-7" aria-hidden="true" />
              </span>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-primary">Administrator access</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Sign in to VIGIL OS</h1>
            </div>

            <div className="rounded-[20px] border border-white/8 bg-black/10 p-5 text-left sm:p-6">
              <AdminLoginForm />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
