import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { cn } from "../../lib/utils";

function Calendar({ className, classNames, showOutsideDays = true, ...props }) {
    return (
        <DayPicker
            showOutsideDays={showOutsideDays}
            className={cn("p-3", className)}
            classNames={{
                months: "flex flex-col sm:flex-row gap-2",
                month: "flex flex-col gap-4",
                caption:
                    "flex justify-center pt-1 relative items-center w-full",
                caption_label: "text-sm font-medium",
                nav: "flex items-center gap-1",
                nav_button:
                    "inline-flex items-center justify-center h-7 w-7 rounded-md border border-slate-200 bg-transparent p-0 opacity-60 hover:opacity-100 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-700",
                nav_button_previous: "absolute left-1",
                nav_button_next: "absolute right-1",
                table: "w-full border-collapse space-x-1",
                head_row: "flex",
                head_cell:
                    "text-slate-500 rounded-md w-8 font-normal text-[0.8rem]",
                row: "flex w-full mt-2",
                cell: cn(
                    "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-slate-100 dark:[&:has([aria-selected])]:bg-slate-700",
                ),
                day: cn(
                    "inline-flex items-center justify-center h-8 w-8 p-0 font-normal rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 aria-selected:opacity-100",
                ),
                day_selected:
                    "bg-blue-600 text-white hover:bg-blue-700 hover:text-white focus:bg-blue-600 focus:text-white",
                day_today:
                    "bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-white",
                day_outside: "text-slate-400 opacity-50",
                day_disabled: "text-slate-400 opacity-50",
                day_range_middle:
                    "aria-selected:bg-slate-100 aria-selected:text-slate-900 dark:aria-selected:bg-slate-700 dark:aria-selected:text-white",
                day_hidden: "invisible",
                ...classNames,
            }}
            components={{
                IconLeft: ({ className, ...props }) => (
                    <ChevronLeft
                        className={cn("h-4 w-4", className)}
                        {...props}
                    />
                ),
                IconRight: ({ className, ...props }) => (
                    <ChevronRight
                        className={cn("h-4 w-4", className)}
                        {...props}
                    />
                ),
            }}
            {...props}
        />
    );
}

export { Calendar };