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
                month: "flex flex-col gap-4 relative",
                month_caption:
                    "flex justify-center pt-1 relative items-center w-full h-8",
                caption_label: "text-sm font-medium",
                nav: "flex items-center gap-1",
                button_previous:
                    "inline-flex items-center justify-center h-7 w-7 rounded-md border border-slate-200 bg-transparent p-0 opacity-60 hover:opacity-100 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-700 absolute left-1 top-0",
                button_next:
                    "inline-flex items-center justify-center h-7 w-7 rounded-md border border-slate-200 bg-transparent p-0 opacity-60 hover:opacity-100 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-700 absolute right-1 top-0",
                month_grid: "w-full border-collapse space-x-1",
                weekdays: "flex",
                weekday:
                    "text-slate-500 rounded-md w-8 font-normal text-[0.8rem] text-center",
                week: "flex w-full mt-2",
                day: cn(
                    "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
                ),
                day_button: cn(
                    "inline-flex items-center justify-center h-8 w-8 p-0 font-normal rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 aria-selected:opacity-100",
                ),
                selected:
                    "bg-blue-600 text-white hover:bg-blue-700 hover:text-white focus:bg-blue-600 focus:text-white rounded-md",
                today:
                    "bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-white rounded-md",
                outside: "text-slate-400 opacity-50",
                disabled: "text-slate-400 opacity-50",
                range_middle:
                    "aria-selected:bg-slate-100 aria-selected:text-slate-900 dark:aria-selected:bg-slate-700 dark:aria-selected:text-white",
                hidden: "invisible",
                ...classNames,
            }}
            components={{
                Chevron: ({ orientation, className, ...rest }) => {
                    const Icon =
                        orientation === "left" ? ChevronLeft : ChevronRight;
                    return (
                        <Icon className={cn("h-4 w-4", className)} {...rest} />
                    );
                },
            }}
            {...props}
        />
    );
}

export { Calendar };