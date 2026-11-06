"use client";

import { RefreshCw, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function HeaderActions() {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <Link href="/#upload" className={cn(buttonVariants({ className: "h-10 rounded-lg px-4" }))}>
        <Upload className="h-4 w-4" aria-hidden="true" />
        Upload
      </Link>
      <Button variant="ghost" size="icon" aria-label="Refresh documents" onClick={() => router.refresh()}>
        <RefreshCw className="h-[18px] w-[18px]" aria-hidden="true" />
      </Button>
      <ThemeToggle />
    </div>
  );
}
