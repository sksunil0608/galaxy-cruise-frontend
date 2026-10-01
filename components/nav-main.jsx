"use client"

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"

export function NavMain({ items }) {
  return (
    <SidebarMenu className="gap-1">
      {items.map((item) => (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton
            render={<a href={item.url} />}
            className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
              item.active
                ? "bg-slate-900 text-white shadow-sm shadow-slate-900/20 hover:bg-slate-800 hover:text-white dark:bg-slate-100 dark:text-slate-900"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100"
            }`}
          >
            <span className={`transition-transform duration-200 group-hover:scale-110 ${item.active ? "text-sky-400" : "text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white"}`}>
              {item.icon}
            </span>
            <span className="truncate">{item.title}</span>
            {item.active && (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}