// src/components/layout/Sidebar.jsx
import React, { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
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
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// Sub-menu component for expandable items
const SubMenuItem = ({ item, isOpen, isMobile, setIsMobile }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const location = useLocation();

  // Check if any sub-item is active
  const isAnySubActive = item.submenu?.some(sub => location.pathname === sub.href);

  // Auto-expand if a sub-item is active
  useEffect(() => {
    if (isAnySubActive) {
      setIsExpanded(true);
    }
  }, [isAnySubActive]);

  if (!item.submenu) {
    return (
      <NavLink
        to={item.href}
        onClick={() => isMobile && setIsMobile(false)}
        className={({ isActive }) =>
          cn(
            "group flex items-center rounded-xl transition-all duration-200",
            "hover:bg-slate-100 dark:hover:bg-slate-800",
            isActive
              ? "bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30 text-blue-700 dark:text-blue-400"
              : "text-slate-600 dark:text-slate-400",
            isOpen ? "px-3 py-2 space-x-3" : "justify-center p-2",
          )
        }
      >
        <item.icon className={cn("h-5 w-5 flex-shrink-0", !isOpen && "mx-auto")} />
        {isOpen && <span className="text-sm font-medium">{item.name}</span>}
      </NavLink>
    );
  }

  return (
    <div>
      <button
        onClick={() => isOpen && setIsExpanded(!isExpanded)}
        className={cn(
          "group flex items-center w-full rounded-xl transition-all duration-200",
          "hover:bg-slate-100 dark:hover:bg-slate-800",
          isAnySubActive
            ? "bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30 text-blue-700 dark:text-blue-400"
            : "text-slate-600 dark:text-slate-400",
          isOpen ? "px-3 py-2 space-x-3" : "justify-center p-2",
        )}
      >
        <item.icon className={cn("h-5 w-5 flex-shrink-0", !isOpen && "mx-auto")} />
        {isOpen && (
          <>
            <span className="flex-1 text-left text-sm font-medium">{item.name}</span>
            <ChevronRight
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                isExpanded && "rotate-90"
              )}
            />
          </>
        )}
      </button>
      {isOpen && isExpanded && (
        <div className="ml-6 mt-1 space-y-1 border-l-2 border-slate-200 dark:border-slate-700 pl-3">
          {item.submenu.map((sub) => {
            const SubIcon = sub.icon || FileText;
            return (
              <NavLink
                key={sub.name}
                to={sub.href}
                onClick={() => isMobile && setIsMobile(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center rounded-lg py-1.5 px-3 text-sm transition-all duration-200",
                    "hover:bg-slate-100 dark:hover:bg-slate-800",
                    isActive
                      ? "text-blue-700 dark:text-blue-400 font-medium"
                      : "text-slate-600 dark:text-slate-400",
                  )
                }
              >
                <SubIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                <span>{sub.name}</span>
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

  const getDashboardHref = () => {
    if (user?.role === "gso_office") return "/gso/dashboard";
    if (user?.role === "mayors_office") return "/mo/dashboard";
    if (user?.role === "driver") return "/driver/dashboard";
    return "/dashboard";
  };

  useEffect(() => {
    const checkScreenSize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setIsOpen(false);
      } else {
        setIsOpen(true);
      }
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, [setIsOpen]);

  useEffect(() => {
    if (isMobile) {
      setIsOpen(false);
    }
  }, [location, isMobile, setIsOpen]);

  const getNavigationItems = () => {
    const roleSpecificItems = {
      gso_office: [
        { name: "Dashboard", href: "/gso/dashboard", icon: LayoutDashboard },
        { name: "Live Tracking", href: "/gso/live-tracking", icon: Satellite },
        { name: "Fuel Receipts", href: "/gso/fuel-receipts", icon: Receipt },
        {
          name: "Reports",
          icon: FileBarChart,
          submenu: [
            { name: "Fuel Receipts", href: "/gso/reports", icon: Receipt },
            { name: "Weekly Monitoring", href: "/gso/reports/weekly-monitoring", icon: Calendar },
            { name: "Fuel Without Trip", href: "/gso/reports/fuel-without-trip", icon: AlertTriangle },
          ],
        },
        {
          name: "Administration",
          icon: Settings,
          submenu: [
            { name: "Departments", href: "/admin/departments", icon: Building2 },
            { name: "Users", href: "/admin/users", icon: Users },
            { name: "Vehicles", href: "/admin/vehicles", icon: Car },
            { name: "System Settings", href: "/admin/settings", icon: Settings },
                 {
  name: "Calendar Year",
  icon: Calendar,
  href: "/gso/annual-budget",
  roles: ["gso_office"],
},
          ],
        },
   
      ],
      mayors_office: [
  { name: "Dashboard", href: "/mo/dashboard", icon: LayoutDashboard },
  {
    name: "Fund Management",
    icon: Banknote,
    submenu: [
      { name: "Pending Fund Release", href: "/mo/pending", icon: Clock },
      { name: "Funds Released", href: "/mo/approved", icon: CheckCircle },
      { name: "Receipt Verification", href: "/mo/receipt-verification", icon: Receipt },
    ],
  },
  {
    name: "Budget Management",
    icon: Wallet,
    submenu: [
      { name: "Budget Allocation", href: "/mo/budget-allocation", icon: DollarSign },
      { name: "Budget History", href: "/mo/budget-history", icon: History },
      { name: "Weekly Tracking", href: "/mo/weekly-tracking", icon: CalendarRange },
    ],
  },
  {
    name: "Reports",
    icon: FileBarChart,
    submenu: [
      { name: "Weekly Monitoring", href: "/mo/reports/weekly-monitoring", icon: Calendar },
      { name: "Fuel Without Trip", href: "/mo/reports/fuel-without-trip", icon: AlertTriangle },
      { name: "Fuel Receipts", href: "/mo/reports", icon: Receipt },
    ],
  },
],
      driver: [
        { name: "Dashboard", href: "/driver/dashboard", icon: LayoutDashboard },
        { name: "My Trips", href: "/driver/trips", icon: Truck },
        { name: "Active Trip", href: "/driver/active", icon: Fuel },
        { name: "Trip History", href: "/driver/history", icon: Calendar },
        { name: "Fuel Logs", href: "/driver/fuel-logs", icon: Receipt },
        { name: "Reports", href: "/driver/reports", icon: FileBarChart },
      ],
    };

    return roleSpecificItems[user?.role] || [];
  };

  const navigation = getNavigationItems();

  const handleLogout = () => {
    logout();
  };

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

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
        className="fixed top-4 left-4 z-50 shadow-lg md:hidden bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Desktop Toggle Button */}
      {!isOpen && !isMobile && (
        <Button
          variant="outline"
          size="icon"
          onClick={toggleSidebar}
          className="fixed top-20 left-4 z-50 shadow-lg rounded-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}

      {/* Overlay for mobile */}
      {isOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 z-40",
          "transition-all duration-300 ease-in-out shadow-xl",
          "flex flex-col",
          isOpen ? "w-64" : "w-16",
          isMobile && !isOpen && "-translate-x-full",
        )}
      >
        {/* Toggle button inside sidebar */}
        {!isMobile && isOpen && (
          <Button
            variant="outline"
            size="icon"
            onClick={toggleSidebar}
            className="absolute -right-3 top-20 rounded-full shadow-md z-50 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}

        {/* Logo Section */}
        <div
          className={cn(
            "flex items-center h-16 border-b border-slate-200 dark:border-slate-700",
            isOpen ? "justify-start px-4" : "justify-center",
          )}
        >
          <div className="flex items-center space-x-2">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-2 rounded-xl shadow-md">
              <Fuel className="h-6 w-6 text-white" />
            </div>
            {isOpen && (
              <div className="text-left">
                <span className="text-lg font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                  FCMS
                </span>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 -mt-1">
                  Laguindingan
                </p>
              </div>
            )}
          </div>
        </div>

        {/* User Info Section */}
        <div
          className={cn(
            "p-3 border-b border-slate-200 dark:border-slate-700",
            !isOpen && "flex justify-center",
          )}
        >
          <div
            className={cn(
              "flex items-center",
              isOpen ? "space-x-3" : "flex-col",
            )}
          >
            <div className="relative">
              <Avatar className="h-10 w-10 border-2 border-blue-500/30">
                <AvatarFallback className="bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-white dark:border-slate-900" />
            </div>
            {isOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-slate-800 dark:text-slate-200">
                  {user?.full_name || user?.first_name || user?.email}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {user?.role_label}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1">
          <div className="space-y-1 p-2">
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

        <Separator className="bg-slate-200 dark:bg-slate-700" />

        {/* Footer - Logout */}
        <div className={cn("p-3", !isOpen && "flex justify-center")}>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className={cn(
              "group w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all",
              isOpen ? "justify-start px-3" : "justify-center p-2",
            )}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {isOpen && <span className="ml-3 text-sm font-medium">Logout</span>}
          </Button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;