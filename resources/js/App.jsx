// src/App.jsx
import React, { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import Layout from "./components/layout/Layout";

// ============ PUBLIC PAGES (NO LAZY LOADING NEEDED) ============
import Login from "./pages/Login";
import Unauthorized from "./pages/Unauthorized";

// ============ GSO PAGES (LAZY LOADED) ============
const GsoDashboard = lazy(() => import("./pages/gso/GsoDashboard"));
const GsoCreateTrip = lazy(() => import("./pages/gso/GsoCreateTrip"));
const GsoAllTrips = lazy(() => import("./pages/gso/GsoAllTrips"));
const GsoPendingMO = lazy(() => import("./pages/gso/GsoPendingMO"));
const GsoReconciliation = lazy(() => import("./pages/gso/GsoReconciliation"));
const GsoReturned = lazy(() => import("./pages/gso/GsoReturned"));
const GsoReports = lazy(() => import("./pages/gso/GsoReports"));
const GsoTripTicket = lazy(() => import("./pages/gso/GsoTripTicket"));
const FuelReceipts = lazy(() => import("./pages/gso/FuelReceipts"));
const CompletedTrips = lazy(() => import("./pages/gso/CompletedTrips"));
const LiveTracking = lazy(() => import("./pages/gso/LiveTracking"));
const SystemSettings = lazy(() => import("./pages/gso/SystemSettings"));
const AnnualBudget = lazy(()=>import('./pages/gso/FiscalYearManagement'));


// ============ GSO REPORT PAGES (NEW) ============
const WeeklyMonitoring = lazy(
    () => import("./pages/gso/reports/WeeklyMonitoring"),
);
const FuelWithoutTripReport = lazy(
    () => import("./pages/gso/reports/FuelWithoutTripReport"),
);

// ============ GSO ADMIN (Departments) ============
const DepartmentManagement = lazy(
    () => import("./pages/gso/departments/DepartmentManagement"),
);
const AddDepartment = lazy(
    () => import("./pages/gso/departments/AddDepartment"),
);
const EditDepartment = lazy(
    () => import("./pages/gso/departments/EditDepartment"),
);

// ============ GSO ADMIN (Users) ============
const UserManagement = lazy(() => import("./pages/gso/users/UserManagement"));
const AddUser = lazy(() => import("./pages/gso/users/AddUser"));
const EditUser = lazy(() => import("./pages/gso/users/EditUser"));



// ============ GSO ADMIN (Vehicles) ============
const VehicleManagement = lazy(
    () => import("./pages/gso/vehicles/VehicleManagement"),
);
const AddVehicle = lazy(() => import("./pages/gso/vehicles/AddVehicle"));
const EditVehicle = lazy(() => import("./pages/gso/vehicles/EditVehicle"));

// ============ MAYOR PAGES ============
const MayorDashboard = lazy(() => import("./pages/mayor/MayorDashboard"));
const MayorPending = lazy(() => import("./pages/mayor/MayorPending"));
const MayorApproved = lazy(() => import("./pages/mayor/MayorApproved"));
const MayorFundIssuance = lazy(() => import("./pages/mayor/MayorFundIssuance"));
const MayorBudgetAssistance = lazy(
    () => import("./pages/mayor/BudgetAssistance"),
);
const MayorBudget = lazy(() => import("./pages/mayor/MayorBudget"));
const MayorReports = lazy(() => import("./pages/mayor/MayorReports"));
const MayorTripTicketDetail = lazy(
    () => import("./pages/mayor/MayorTripTicketDetail"),
);
const BudgetPolicies = lazy(() => import("./pages/mayor/BudgetPolicies"));
const MayorReceiptVerification = lazy(
    () => import("./pages/mayor/MayorReceiptVerification"),
);
const MayorTripTicket = lazy(() => import("./pages/mayor/MayorTripTicket"));

import BudgetAllocation from "./pages/mayor/budget/BudgetAllocation";
import BudgetHistory from "./pages/mayor/budget/BudgetHistory";
import WeeklyTracking from "./pages/mayor/budget/WeeklyTracking";

// ============ MAYOR REPORT PAGES (NEW) ============
const MayorWeeklyMonitoring = lazy(
    () => import("./pages/mayor/reports/WeeklyMonitoring"),
);
const MayorFuelWithoutTripReport = lazy(
    () => import("./pages/mayor/reports/FuelWithoutTripReport"),
);

// ============ STAFF PAGES ============
const StaffDashboard = lazy(() => import("./pages/staff/StaffDashboard"));
const StaffTrips = lazy(() => import("./pages/staff/StaffTrips"));
const StaffReports = lazy(() => import("./pages/staff/StaffReports"));

// ============ SHARED PAGES ============
const Reports = lazy(() => import("./pages/admin/Reports"));
const Profile = lazy(() => import("./pages/admin/Profile"));
const Help = lazy(() => import("./pages/admin/WorkInProgress"));

// ============ LOADING COMPONENT ============
const PageLoader = () => (
    <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
        </div>
    </div>
);

function App() {
    return (
        <Suspense fallback={<PageLoader />}>
            <Routes>
                {/* Public Route */}
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<Navigate to="/login" replace />} />

                {/* ============================================================ */}
                {/* ============ GSO ROUTES ============ */}
                {/* ============================================================ */}

                <Route
                    path="/gso/dashboard"
                    element={
                        <ProtectedRoute allowedRoles={["gso_office"]}>
                            <Layout>
                                <GsoDashboard />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/gso/create-trip"
                    element={
                        <ProtectedRoute allowedRoles={["gso_office"]}>
                            <Layout>
                                <GsoCreateTrip />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/gso/all-trips"
                    element={
                        <ProtectedRoute allowedRoles={["gso_office"]}>
                            <Layout>
                                <GsoAllTrips />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/gso/pending-mo"
                    element={
                        <ProtectedRoute allowedRoles={["gso_office"]}>
                            <Layout>
                                <GsoPendingMO />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/gso/reconciliation"
                    element={
                        <ProtectedRoute allowedRoles={["gso_office"]}>
                            <Layout>
                                <GsoReconciliation />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/gso/returned"
                    element={
                        <ProtectedRoute allowedRoles={["gso_office"]}>
                            <Layout>
                                <GsoReturned />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/gso/reports"
                    element={
                        <ProtectedRoute allowedRoles={["gso_office"]}>
                            <Layout>
                                <GsoReports />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/gso/tickets/:id"
                    element={
                        <ProtectedRoute allowedRoles={["gso_office"]}>
                            <Layout>
                                <GsoTripTicket />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/gso/fuel-receipts"
                    element={
                        <ProtectedRoute allowedRoles={["gso_office"]}>
                            <Layout>
                                <FuelReceipts />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/gso/completed-trips"
                    element={
                        <ProtectedRoute allowedRoles={["gso_office"]}>
                            <Layout>
                                <CompletedTrips />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/gso/live-tracking"
                    element={
                        <ProtectedRoute allowedRoles={["gso_office"]}>
                            <Layout>
                                <LiveTracking />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                {/* ============================================================ */}
                {/* ============ GSO REPORT ROUTES (NEW) ============ */}
                {/* ============================================================ */}

                <Route
                    path="/gso/reports/weekly-monitoring"
                    element={
                        <ProtectedRoute allowedRoles={["gso_office"]}>
                            <Layout>
                                <WeeklyMonitoring />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/gso/reports/fuel-without-trip"
                    element={
                        <ProtectedRoute allowedRoles={["gso_office"]}>
                            <Layout>
                                <FuelWithoutTripReport />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
  path="/gso/annual-budget"
  element={
    <ProtectedRoute allowedRoles={["gso_office"]}>
      <Layout>
        <AnnualBudget />
      </Layout>
    </ProtectedRoute>
  }
/>

                {/* ============================================================ */}
                {/* ============ GSO ADMIN ROUTES ============ */}
                {/* ============================================================ */}

                <Route
                    path="/admin/departments"
                    element={
                        <ProtectedRoute allowedRoles={["gso_office"]}>
                            <Layout>
                                <DepartmentManagement />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/admin/departments/add"
                    element={
                        <ProtectedRoute allowedRoles={["gso_office"]}>
                            <Layout>
                                <AddDepartment />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/admin/departments/edit/:id"
                    element={
                        <ProtectedRoute allowedRoles={["gso_office"]}>
                            <Layout>
                                <EditDepartment />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/admin/users"
                    element={
                        <ProtectedRoute allowedRoles={["gso_office"]}>
                            <Layout>
                                <UserManagement />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/admin/users/add"
                    element={
                        <ProtectedRoute allowedRoles={["gso_office"]}>
                            <Layout>
                                <AddUser />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/admin/users/edit/:id"
                    element={
                        <ProtectedRoute allowedRoles={["gso_office"]}>
                            <Layout>
                                <EditUser />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/admin/vehicles"
                    element={
                        <ProtectedRoute allowedRoles={["gso_office"]}>
                            <Layout>
                                <VehicleManagement />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/admin/vehicles/add"
                    element={
                        <ProtectedRoute allowedRoles={["gso_office"]}>
                            <Layout>
                                <AddVehicle />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/admin/vehicles/edit/:id"
                    element={
                        <ProtectedRoute allowedRoles={["gso_office"]}>
                            <Layout>
                                <EditVehicle />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/admin/settings"
                    element={
                        <ProtectedRoute allowedRoles={["gso_office"]}>
                            <Layout>
                                <SystemSettings />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/admin/budget-policies"
                    element={
                        <ProtectedRoute allowedRoles={["gso_office"]}>
                            <Layout>
                                <BudgetPolicies />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/admin/reports"
                    element={
                        <ProtectedRoute allowedRoles={["gso_office"]}>
                            <Layout>
                                <Reports />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                {/* ============================================================ */}
                {/* ============ STAFF ROUTES ============ */}
                {/* ============================================================ */}

                <Route
                    path="/driver/dashboard"
                    element={
                        <ProtectedRoute allowedRoles={["driver"]}>
                            <Layout>
                                <StaffDashboard />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/driver/trips"
                    element={
                        <ProtectedRoute allowedRoles={["driver"]}>
                            <Layout>
                                <StaffTrips />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/driver/reports"
                    element={
                        <ProtectedRoute allowedRoles={["driver"]}>
                            <Layout>
                                <StaffReports />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                {/* ============================================================ */}
                {/* ============ MAYOR'S OFFICE ROUTES ============ */}
                {/* ============================================================ */}

                <Route
                    path="/mo/dashboard"
                    element={
                        <ProtectedRoute allowedRoles={["mayors_office"]}>
                            <Layout>
                                <MayorDashboard />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/mo/pending"
                    element={
                        <ProtectedRoute allowedRoles={["mayors_office"]}>
                            <Layout>
                                <MayorPending />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/mo/approved"
                    element={
                        <ProtectedRoute allowedRoles={["mayors_office"]}>
                            <Layout>
                                <MayorApproved />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/mo/fund-issuance"
                    element={
                        <ProtectedRoute allowedRoles={["mayors_office"]}>
                            <Layout>
                                <MayorFundIssuance />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/mo/budget-assistance"
                    element={
                        <ProtectedRoute allowedRoles={["mayors_office"]}>
                            <Layout>
                                <MayorBudgetAssistance />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/mo/budget"
                    element={
                        <ProtectedRoute allowedRoles={["mayors_office"]}>
                            <Layout>
                                <MayorBudget />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/mo/budget-allocation"
                    element={
                        <ProtectedRoute allowedRoles={["mayors_office"]}>
                            <Layout>
                                <BudgetAllocation />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/mo/budget-history"
                    element={
                        <ProtectedRoute allowedRoles={["mayors_office"]}>
                            <Layout>
                                <BudgetHistory />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/mo/weekly-tracking"
                    element={
                        <ProtectedRoute allowedRoles={["mayors_office"]}>
                            <Layout>
                                <WeeklyTracking />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/mo/reports"
                    element={
                        <ProtectedRoute allowedRoles={["mayors_office"]}>
                            <Layout>
                                <MayorReports />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/mo/tickets/:id"
                    element={
                        <ProtectedRoute allowedRoles={["mayors_office"]}>
                            <Layout>
                                <MayorTripTicketDetail />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/mayor/trip-ticket/:id"
                    element={
                        <ProtectedRoute allowedRoles={["mayors_office"]}>
                            <Layout>
                                <MayorTripTicket />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/mo/budget-policies"
                    element={
                        <ProtectedRoute allowedRoles={["mayors_office"]}>
                            <Layout>
                                <BudgetPolicies />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/mo/receipt-verification"
                    element={
                        <ProtectedRoute allowedRoles={["mayors_office"]}>
                            <Layout>
                                <MayorReceiptVerification />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                {/* ============================================================ */}
                {/* ============ MAYOR'S OFFICE REPORT ROUTES (NEW) ============ */}
                {/* ============================================================ */}

                <Route
                    path="/mo/reports/weekly-monitoring"
                    element={
                        <ProtectedRoute allowedRoles={["mayors_office"]}>
                            <Layout>
                                <MayorWeeklyMonitoring />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/mo/reports/fuel-without-trip"
                    element={
                        <ProtectedRoute allowedRoles={["mayors_office"]}>
                            <Layout>
                                <MayorFuelWithoutTripReport />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                {/* ============================================================ */}
                {/* ============ SHARED ROUTES ============ */}
                {/* ============================================================ */}

                <Route
                    path="/profile"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <Profile />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/help"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <Help />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                {/* ============================================================ */}
                {/* ============ ERROR ROUTES ============ */}
                {/* ============================================================ */}

                <Route path="/unauthorized" element={<Unauthorized />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        </Suspense>
    );
}

export default App;
