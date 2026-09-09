// src/components/layout/Sidebar.jsx
import React, { useState, useEffect } from "react";
import { href, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
    LayoutDashboard,
    FileText,
    Truck,
    Users,
    Building2,
    Fuel,
    DollarSign,
    Settings,
    LogOut,
    Menu,
    BarChart3,
    Calendar,
    Car,
    ClipboardList,
    Receipt,
    AlertCircle,
    Clock,
    CheckCircle,
    ChevronLeft,
    ChevronRight,
    FileBarChart,
    CreditCard,
    HandCoins,
    PlusCircle,
    RefreshCw,
    Eye,
    AlertTriangle,
    Satellite,
    TrendingUp,
    TrendingDown,
    Coins,
    Banknote,
    Wallet,
    PiggyBank,
    Landmark,
    CalendarRange,
    History,
    Target,
    PieChart,
    MapPin,
    Navigation,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const SubMenuItem = ({ item, isOpen, isMobile, setIsMobile }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const location = useLocation();
    const isAnySubActive = item.submenu?.some(
        (sub) => location.pathname === sub.href,
    );

    useEffect(() => {
        if (isAnySubActive) setIsExpanded(true);
    }, [isAnySubActive]);

    if (!item.submenu) {
        return (
            <NavLink
                to={item.href}
                onClick={() => isMobile && setIsMobile(false)}
                className={({ isActive }) =>
                    cn(
                        "group flex items-center rounded-xl transition-all duration-200 relative",
                        "hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:scale-[1.02] active:scale-[0.98]",
                        isActive
                            ? "bg-gradient-to-r from-blue-500/10 to-blue-600/5 dark:from-blue-500/20 dark:to-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold shadow-sm shadow-blue-500/5"
                            : "text-slate-600 dark:text-slate-400",
                        isOpen ? "px-3 py-2.5 gap-3" : "justify-center p-2.5",
                        isActive &&
                            isOpen &&
                            "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-8 before:w-[3px] before:rounded-r-full before:bg-gradient-to-b before:from-blue-500 before:to-blue-600 before:shadow-lg before:shadow-blue-500/30",
                    )
                }
            >
                {({ isActive }) => (
                    <>
                        <div
                            className={cn(
                                "relative flex items-center justify-center",
                                isActive &&
                                    "after:absolute after:inset-0 after:bg-blue-500/10 after:rounded-lg after:scale-75 after:opacity-0 group-hover:after:opacity-100 after:transition-all",
                            )}
                        >
                            <item.icon
                                className={cn(
                                    "h-[18px] w-[18px] flex-shrink-0 transition-all duration-200",
                                    isActive
                                        ? "text-blue-500 drop-shadow-[0_2px_4px_rgba(59,130,246,0.3)]"
                                        : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300",
                                )}
                            />
                        </div>
                        {isOpen && (
                            <span
                                className={cn(
                                    "text-sm transition-all duration-200",
                                    isActive &&
                                        "bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent",
                                )}
                            >
                                {item.name}
                            </span>
                        )}
                    </>
                )}
            </NavLink>
        );
    }

    return (
        <div>
            <button
                onClick={() => isOpen && setIsExpanded(!isExpanded)}
                className={cn(
                    "group flex items-center w-full rounded-xl transition-all duration-200 relative",
                    "hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:scale-[1.02] active:scale-[0.98]",
                    isAnySubActive
                        ? "bg-gradient-to-r from-blue-500/10 to-blue-600/5 dark:from-blue-500/20 dark:to-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold shadow-sm shadow-blue-500/5"
                        : "text-slate-600 dark:text-slate-400",
                    isOpen ? "px-3 py-2.5 gap-3" : "justify-center p-2.5",
                    isAnySubActive &&
                        isOpen &&
                        "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-8 before:w-[3px] before:rounded-r-full before:bg-gradient-to-b before:from-blue-500 before:to-blue-600 before:shadow-lg before:shadow-blue-500/30",
                )}
            >
                <div
                    className={cn(
                        "relative flex items-center justify-center",
                        isAnySubActive &&
                            "after:absolute after:inset-0 after:bg-blue-500/10 after:rounded-lg after:scale-75 after:opacity-0 group-hover:after:opacity-100 after:transition-all",
                    )}
                >
                    <item.icon
                        className={cn(
                            "h-[18px] w-[18px] flex-shrink-0 transition-all duration-200",
                            isAnySubActive
                                ? "text-blue-500 drop-shadow-[0_2px_4px_rgba(59,130,246,0.3)]"
                                : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300",
                        )}
                    />
                </div>
                {isOpen && (
                    <>
                        <span
                            className={cn(
                                "flex-1 text-left text-sm transition-all duration-200",
                                isAnySubActive &&
                                    "bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent",
                            )}
                        >
                            {item.name}
                        </span>
                        <ChevronRight
                            className={cn(
                                "h-3.5 w-3.5 text-slate-400 transition-all duration-300",
                                isExpanded && "rotate-90 text-blue-500",
                            )}
                        />
                    </>
                )}
            </button>
            {isOpen && isExpanded && (
                <div className="ml-5 mt-1 space-y-0.5 border-l-2 border-blue-500/20 dark:border-blue-500/30 pl-3 animate-slide-down">
                    {item.submenu.map((sub) => {
                        const SubIcon = sub.icon || FileText;
                        return (
                            <NavLink
                                key={sub.name}
                                to={sub.href}
                                onClick={() => isMobile && setIsMobile(false)}
                                className={({ isActive }) =>
                                    cn(
                                        "flex items-center rounded-lg py-2 px-3 text-sm transition-all duration-200",
                                        "hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:translate-x-1",
                                        isActive
                                            ? "text-blue-600 dark:text-blue-400 font-semibold bg-blue-50/50 dark:bg-blue-950/20"
                                            : "text-slate-500 dark:text-slate-500",
                                    )
                                }
                            >
                                <SubIcon
                                    className={cn(
                                        "h-3.5 w-3.5 mr-2.5 flex-shrink-0 transition-all duration-200",
                                        "group-hover:scale-110",
                                    )}
                                />
                                <span className="transition-all duration-200">
                                    {sub.name}
                                </span>
                            </NavLink>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const Sidebar = ({ isOpen, setIsOpen }) => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkScreenSize = () => {
            const mobile = window.innerWidth < 1024;
            setIsMobile(mobile);
            setIsOpen(!mobile);
        };
        checkScreenSize();
        window.addEventListener("resize", checkScreenSize);
        return () => window.removeEventListener("resize", checkScreenSize);
    }, [setIsOpen]);

    useEffect(() => {
        if (isMobile) setIsOpen(false);
    }, [location, isMobile, setIsOpen]);

    const getNavigationItems = () => {
        const roleSpecificItems = {
            gso_office: [
                {
                    name: "Dashboard",
                    href: "/gso/dashboard",
                    icon: LayoutDashboard,
                },
                // { 
                //     name: "All Trips",
                //      href: "/gso/all-trips", 
                //      icon: FileText
                //      },
                // {
                //     name: "Trip History",
                //     href: "/gso/trip-history",
                //     icon: History,
                // },
                {
                    name: "Live Tracking",
                    href: "/gso/live-tracking",
                    icon: Satellite,
                },
                {
                    name: "Fuel Receipts",
                    href: "/gso/fuel-receipts",
                    icon: Receipt,
                },
                 {
                            name: "Fuel Consumption Report",
                            href: "/gso/reports",
                            icon: Receipt,
                        },
            
                {
                    name: "Administration",
                    icon: Settings,
                    submenu: [
                        {
                            name: "Departments",
                            href: "/admin/departments",
                            icon: Building2,
                        },
                        { name: "Users", href: "/admin/users", icon: Users },
                        {
                            name: "Vehicles",
                            href: "/admin/vehicles",
                            icon: Car,
                        },
                        {
                            name: "System Settings",
                            href: "/admin/settings",
                            icon: Settings,
                        },
                        {
                            name: "Calendar Year",
                            href: "/gso/annual-budget",
                            icon: Calendar,
                        },
                    ],
                },
                // ✅ NEW: Trip History - Separate item (not a submenu)
            ],
            mayors_office: [
                {
                    name: "Dashboard",
                    href: "/mo/dashboard",
                    icon: LayoutDashboard,
                },
                {
                    name: "Fund Management",
                    icon: Banknote,
                    submenu: [
                        {
                            name: "Pending Fund Release",
                            href: "/mo/pending",
                            icon: Clock,
                        },
                        {
                            name: "Funds Released",
                            href: "/mo/approved",
                            icon: CheckCircle,
                        },
                        {
                            name: "Receipt Verification",
                            href: "/mo/receipt-verification",
                            icon: Receipt,
                        },
                        // {
                        //     name: "Fund Release History",
                        //     href: "/mo/fund-release-history",
                        //     icon: DollarSign,
                        // },
                    ],
                },
                {
                    name: "Budget Management",
                    icon: Wallet,
                    submenu: [
                        {
                            name: "Budget Allocation",
                            href: "/mo/budget-allocation",
                            icon: DollarSign,
                        },
                        {
                            name: "Budget History",
                            href: "/mo/budget-history",
                            icon: History,
                        },
                        {
                            name: "Weekly Tracking",
                            href: "/mo/weekly-tracking",
                            icon: CalendarRange,
                        },
                    ],
                },
                 {
                            name: "Fuel Reports",
                            href: "/mo/reports",
                            icon: Receipt,
                        },
               
            ],
            driver: [
                {
                    name: "Dashboard",
                    href: "/driver/dashboard",
                    icon: LayoutDashboard,
                },
                { name: "My Trips", href: "/driver/trips", icon: Truck },
                { name: "Active Trip", href: "/driver/active", icon: Fuel },
                {
                    name: "Trip History",
                    href: "/driver/history",
                    icon: Calendar,
                },
                { name: "Fuel Logs", href: "/driver/fuel-logs", icon: Receipt },
                {
                    name: "Reports",
                    href: "/driver/reports",
                    icon: FileBarChart,
                },
            ],
        };
        return roleSpecificItems[user?.role] || [];
    };

    const navigation = getNavigationItems();

    const handleLogout = () => logout();

    const toggleSidebar = () => setIsOpen(!isOpen);

    const getUserInitials = () => {
        const firstName = user?.first_name?.charAt(0) || "";
        const lastName = user?.last_name?.charAt(0) || "";
        return `${firstName}${lastName}`.toUpperCase();
    };

    return (
        <>
            {/* Mobile Menu Button */}
            <Button
                variant="default"
                size="icon"
                onClick={toggleSidebar}
                className="fixed top-4 left-4 z-50 shadow-lg shadow-blue-500/30 lg:hidden bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 rounded-xl h-10 w-10 transition-all duration-200 hover:scale-105 active:scale-95"
            >
                <Menu className="h-5 w-5" />
            </Button>

            {/* Desktop Toggle Button */}
            {!isOpen && !isMobile && (
                <Button
                    variant="outline"
                    size="icon"
                    onClick={toggleSidebar}
                    className="fixed top-24 left-[72px] z-50 shadow-lg shadow-blue-500/10 rounded-full h-8 w-8 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 hover:scale-110 active:scale-95 hover:shadow-blue-500/20"
                >
                    <ChevronRight className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                </Button>
            )}

            {/* Mobile Overlay */}
            {isOpen && isMobile && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed top-0 left-0 h-full bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-r border-slate-200/60 dark:border-slate-800/60 z-40",
                    "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-2xl shadow-black/10 dark:shadow-black/40",
                    "flex flex-col",
                    isOpen ? "w-[280px]" : "w-[72px]",
                    isMobile && !isOpen && "-translate-x-full",
                )}
            >
                {/* Collapse Button */}
                {!isMobile && isOpen && (
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={toggleSidebar}
                        className="absolute -right-3.5 top-24 rounded-full shadow-lg shadow-blue-500/10 z-50 h-7 w-7 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 hover:scale-110 active:scale-95 hover:shadow-blue-500/20"
                    >
                        <ChevronLeft className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                    </Button>
                )}

                {/* Logo */}
                <div
                    className={cn(
                        "flex items-center h-16 border-b border-slate-200/60 dark:border-slate-800/60",
                        isOpen ? "justify-start px-5" : "justify-center px-2",
                    )}
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-2 rounded-xl shadow-lg shadow-blue-500/30 flex-shrink-0 relative group">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl" />
                            <Fuel className="h-5 w-5 text-white relative z-10" />
                        </div>
                        {isOpen && (
                            <div className="text-left overflow-hidden">
                                <span className="text-lg font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent tracking-tight block leading-tight">
                                    FCMS
                                </span>
                                <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 tracking-[0.15em] uppercase">
                                    Laguindingan
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* User Profile */}
                <div
                    className={cn(
                        "border-b border-slate-200/60 dark:border-slate-800/60",
                        isOpen ? "p-4" : "p-3 flex justify-center",
                    )}
                >
                    <div
                        className={cn(
                            "flex items-center",
                            isOpen ? "gap-3" : "flex-col",
                        )}
                    >
                        <div className="relative flex-shrink-0 group">
                            <Avatar className="h-10 w-10 ring-2 ring-slate-200/60 dark:ring-slate-700/60 transition-all duration-200 group-hover:ring-blue-500/50">
                                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-500/30">
                                    {getUserInitials()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-950 shadow-sm shadow-emerald-500/30 animate-pulse-soft" />
                        </div>
                        {isOpen && (
                            <div className="flex-1 min-w-0 overflow-hidden">
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate leading-tight">
                                    {user?.full_name ||
                                        `${user?.first_name} ${user?.last_name}` ||
                                        user?.email}
                                </p>
                                <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 truncate mt-0.5">
                                    {user?.role_label}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Navigation */}
                <ScrollArea className="flex-1 px-2.5 py-4">
                    <div className="space-y-1">
                        {navigation.map((item) => (
                            <SubMenuItem
                                key={item.name}
                                item={item}
                                isOpen={isOpen}
                                isMobile={isMobile}
                                setIsMobile={setIsMobile}
                            />
                        ))}
                    </div>
                </ScrollArea>

                <Separator className="bg-slate-200/60 dark:bg-slate-800/60 mx-3 w-auto" />

                {/* Logout */}
                <div className={cn("p-3", !isOpen && "flex justify-center")}>
                    <Button
                        variant="ghost"
                        onClick={handleLogout}
                        className={cn(
                            "group w-full text-red-500 hover:text-red-600 hover:bg-red-50/80 dark:hover:bg-red-950/30 rounded-xl transition-all duration-200 font-medium",
                            "hover:scale-[1.02] active:scale-[0.98]",
                            isOpen
                                ? "justify-start px-3 py-2.5 gap-3"
                                : "justify-center p-2.5 h-auto",
                        )}
                    >
                        <LogOut
                            className={cn(
                                "h-[18px] w-[18px] flex-shrink-0 transition-transform duration-200",
                                "group-hover:-translate-x-0.5",
                            )}
                        />
                        {isOpen && (
                            <span className="text-sm transition-all duration-200 group-hover:translate-x-0.5">
                                Logout
                            </span>
                        )}
                    </Button>
                </div>

                {/* Sidebar Gradient Overlay */}
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white/80 to-transparent dark:from-slate-950/80 pointer-events-none" />
            </aside>
        </>
    );
};

export default Sidebar;
