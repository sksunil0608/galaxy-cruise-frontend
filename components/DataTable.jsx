"use client"

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"

import { Button } from "@/components/ui/button"
import {
  ChevronLeftIcon,
  ChevronRightIcon
} from "lucide-react"


export default function DataTable({ columns, data }) {

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel()
  })

  return (

    <div className="rounded-lg border bg-white">

      <Table>

        <TableHeader className="bg-muted/40">
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <TableHead key={header.id} className="font-semibold">
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>

          {table.getRowModel().rows.length ? (

            table.getRowModel().rows.map(row => (
              <TableRow
                key={row.id}
                className="hover:bg-muted/40 transition"
              >
                {row.getVisibleCells().map(cell => (
                  <TableCell key={cell.id}>
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext()
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))

          ) : (

            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="text-center py-12 text-muted-foreground"
              >
                No results found
              </TableCell>
            </TableRow>

          )}

        </TableBody>

      </Table>

      {/* Pagination */}

      <div className="flex items-center justify-between p-4 border-t">

        <span className="text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1}
        </span>

        <div className="flex gap-2">

          <Button
            variant="outline"
            size="icon"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeftIcon className="size-4"/>
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRightIcon className="size-4"/>
          </Button>

        </div>

      </div>

    </div>
  )
}