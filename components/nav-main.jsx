"use client"

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"

export function NavMain({ items }) {
  return (
    <SidebarMenu>

      {items.map((item) => (

        <SidebarMenuItem key={item.title}>

          <SidebarMenuButton
            asChild
            className={
              item.active
                ? "bg-black text-white hover:bg-black p-5 rounded-lg"
                : "hover:bg-muted"
            }
          >

            <a href={item.url} className="flex items-center gap-2">

              {item.icon}

              <span>{item.title}</span>

            </a>

          </SidebarMenuButton>

        </SidebarMenuItem>

      ))}

    </SidebarMenu>
  )
}