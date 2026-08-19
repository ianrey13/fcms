<?php

use App\Http\Controllers\API\AuthController;
use App\Http\Controllers\API\TripTicketController;
use App\Http\Controllers\API\NotificationController;
use App\Http\Controllers\API\BudgetController;
use App\Http\Controllers\API\UserController;
use App\Http\Controllers\API\DepartmentController;
use App\Http\Controllers\API\VehicleController;
use App\Http\Controllers\API\SettingsController;
use App\Http\Controllers\API\BudgetPolicyController;
use App\Http\Controllers\API\DriverController;
use App\Http\Controllers\API\GsoController;
use App\Http\Controllers\API\MayorsOfficeController;
use App\Http\Controllers\API\ReportsController;
use App\Http\Controllers\API\GpsPingController;
use App\Http\Controllers\API\LocationController;
use Illuminate\Support\Facades\Broadcast;
use App\Http\Controllers\API\AuditLogController;
use App\Http\Controllers\API\AnnualBudgetController;
use App\Http\Controllers\API\FiscalYearController;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// ============ PUBLIC ROUTES ============
Route::prefix('auth')->group(function () {
    Route::post('login', [AuthController::class, 'login']);
    Route::post('forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('reset-password', [AuthController::class, 'resetPassword']);
});

Route::prefix('location')->group(function () {
    Route::get('/search', [LocationController::class, 'search']);
    Route::get('/distance', [LocationController::class, 'calculateDistance']);
    Route::get('/geocode', [LocationController::class, 'geocode']);
    Route::get('/barangays', [LocationController::class, 'getBarangays']);
    Route::get('/municipalities', [LocationController::class, 'getMunicipalities']);
});

Route::get('/public/fuel-prices', function () {
    return response()->json([
        'diesel' => \App\Models\SystemSetting::where('setting_key', 'diesel_price_per_liter')->first()?->setting_value ?? 50.00,
        'premium' => \App\Models\SystemSetting::where('setting_key', 'premium_price_per_liter')->first()?->setting_value ?? 65.00,
        'regular' => \App\Models\SystemSetting::where('setting_key', 'regular_price_per_liter')->first()?->setting_value ?? 55.00,
    ]);
});

// ============ BROADCASTING AUTH ROUTE ============
Route::post('/broadcasting/auth', function (Request $request) {
    return Broadcast::auth($request);
})->middleware('auth:sanctum');

// ============ PROTECTED ROUTES ============
Route::middleware('auth:sanctum')->group(function () {

    // Auth
    Route::prefix('auth')->group(function () {
        Route::get('me', [AuthController::class, 'me']);
        Route::post('logout', [AuthController::class, 'logout']);
        Route::post('change-password', [AuthController::class, 'changePassword']);
        Route::post('update-profile', [AuthController::class, 'updateProfile']);
    });

    // ============ REPORTS ============
    Route::prefix('reports')->group(function () {
        Route::get('trips', [ReportsController::class, 'getTripReport']);
        Route::get('trips/export/{format}', [ReportsController::class, 'exportTripReport']);
        Route::get('fuel', [ReportsController::class, 'getFuelReport']);
        Route::get('fuel/export/{format}', [ReportsController::class, 'exportFuelReport']);
        Route::get('budget', [ReportsController::class, 'getBudgetReport']);
        Route::get('budget/export/{format}', [ReportsController::class, 'exportBudgetReport']);
        Route::get('vehicles', [ReportsController::class, 'getVehicleReport']);
        Route::get('summary', [ReportsController::class, 'getReportSummary']);
        Route::get('fuel-consumption', [ReportsController::class, 'getFuelConsumptionReport']);
        Route::get('fuel-consumption/export/{format}', [ReportsController::class, 'exportFuelConsumptionReport']);
        Route::get('fuel-receipts', [ReportsController::class, 'getFuelReceiptReport']);
        Route::get('fuel-receipts/export/{format}', [ReportsController::class, 'exportFuelReceiptReport']);
        Route::get('weekly-monitoring', [ReportsController::class, 'getWeeklyMonitoring']);
        Route::get('fuel-without-trip', [ReportsController::class, 'getFuelWithoutTrip']);
        Route::get('weekly-monitoring/export/{format}', [ReportsController::class, 'exportWeeklyMonitoring']);
    });

    // ============ GSO ADMIN ============
    Route::middleware(['role:gso_office'])->prefix('admin')->group(function () {
        // Users
        Route::apiResource('users', UserController::class);
        Route::patch('users/{id}/status', [UserController::class, 'updateStatus']);
        Route::post('users/{id}/reset-password', [UserController::class, 'resetPassword']);
        Route::patch('users/{id}/department', [UserController::class, 'updateDepartment']);
        Route::post('users/{id}/signature', [UserController::class, 'uploadSignature']);
        Route::get('users/{id}/signature', [UserController::class, 'getSignature']);
        Route::delete('users/{id}/signature', [UserController::class, 'deleteSignature']);

        // Vehicles
        Route::apiResource('vehicles', VehicleController::class);
        Route::patch('vehicles/{id}/status', [VehicleController::class, 'updateStatus']);
        Route::patch('vehicles/{id}/maintenance', [VehicleController::class, 'updateMaintenance']);
        Route::patch('vehicles/{id}/odometer-status', [VehicleController::class, 'updateOdometerStatus']);

        // Departments
        Route::get('departments', [DepartmentController::class, 'index']);
        Route::get('departments/active', [DepartmentController::class, 'getActiveDepartments']);
        Route::get('departments/selector', [DepartmentController::class, 'getAllForSelector']);
        Route::get('departments/{id}', [DepartmentController::class, 'show']);
        Route::post('departments', [DepartmentController::class, 'store']);
        Route::put('departments/{id}', [DepartmentController::class, 'update']);
        Route::delete('departments/{id}', [DepartmentController::class, 'destroy']);
        Route::patch('departments/{id}/toggle-status', [DepartmentController::class, 'toggleStatus']);

        // Drivers
        Route::apiResource('drivers', DriverController::class);
        Route::get('drivers/active', [DriverController::class, 'getActiveDrivers']);
        Route::patch('drivers/{id}/status', [DriverController::class, 'updateStatus']);

        // Settings
        Route::get('settings', [SettingsController::class, 'index']);
        Route::get('settings/{key}', [SettingsController::class, 'show']);
        Route::put('settings/{key}', [SettingsController::class, 'update']);
        Route::post('settings/bulk', [SettingsController::class, 'bulkUpdate']);

        // Budget Policies
        Route::get('budget-policies', [BudgetPolicyController::class, 'index']);
        Route::get('budget-policies/{departmentId}', [BudgetPolicyController::class, 'show']);
        Route::post('budget-policies', [BudgetPolicyController::class, 'store']);
        Route::put('budget-policies/{departmentId}', [BudgetPolicyController::class, 'update']);
        Route::delete('budget-policies/{departmentId}', [BudgetPolicyController::class, 'destroy']);
        Route::get('budget-status', [BudgetPolicyController::class, 'getBudgetStatus']);
        Route::get('budget-event-logs', [BudgetPolicyController::class, 'getEventLogs']);
        Route::post('budget-policies/force-activate', [BudgetPolicyController::class, 'forceActivate']);
        Route::post('budget-policies/run-weekly-reset', [BudgetPolicyController::class, 'runWeeklyReset']);
        Route::get('budget-summary', [BudgetController::class, 'getBudgetSummary']);

        // Fuel Receipts
        Route::get('fuel-receipts', [GsoController::class, 'getFuelReceipts']);
        Route::get('fuel-receipts/{id}', [GsoController::class, 'getFuelReceipt']);
        Route::post('fuel-receipts/record', [GsoController::class, 'recordReceipt']);
        Route::get('completed-trips', [GsoController::class, 'getCompletedTrips']);

        // Audit Logs
        Route::get('audit-logs', [AuditLogController::class, 'index']);
        Route::get('audit-logs/summary', [AuditLogController::class, 'getSummary']);
        Route::get('audit-logs/model/{modelType}/{modelId}', [AuditLogController::class, 'getModelLogs']);

        // Fiscal Year Management
        Route::prefix('fiscal-years')->group(function () {
            Route::get('/', [FiscalYearController::class, 'index']);
            Route::post('/', [FiscalYearController::class, 'store']);
            Route::patch('/{id}/toggle', [FiscalYearController::class, 'toggleStatus']);
            Route::delete('/{id}', [FiscalYearController::class, 'destroy']);
        });

        // Annual Budget
        Route::prefix('annual-budgets')->group(function () {
            Route::get('/', [AnnualBudgetController::class, 'index']);
            Route::get('/years', [AnnualBudgetController::class, 'getYears']);
            Route::get('/summary', [AnnualBudgetController::class, 'getSummary']);
            Route::get('/departments-without-budget', [AnnualBudgetController::class, 'getDepartmentsWithoutBudget']);
            Route::delete('/{id}', [AnnualBudgetController::class, 'destroy']);
        });
    });

    // ============ GSO ============
    Route::middleware(['role:gso_office'])->prefix('gso')->group(function () {
        Route::get('dashboard', [GsoController::class, 'getDashboard']);
        Route::get('pending', [GsoController::class, 'getPendingTickets']);
        Route::get('returned', [GsoController::class, 'getReturnedTickets']);
        Route::get('all-trips', [GsoController::class, 'getAllTrips']);
        Route::get('pending-reconciliation', [GsoController::class, 'getPendingReconciliation']);
        Route::get('tickets/{id}', [GsoController::class, 'show']);
        Route::get('reports', [GsoController::class, 'getReports']);
        Route::get('users/{id}/signature', [UserController::class, 'getSignatureForGso']);
        Route::post('create-trip', [TripTicketController::class, 'gsoCreate']);
        Route::post('tickets/{id}/reconcile', [GsoController::class, 'reconcileTrip']);
        Route::get('budget-overview', [GsoController::class, 'getBudgetOverview']);
        Route::get('/vehicles/available', [TripTicketController::class, 'getAvailableVehicles']);
        Route::get('pending-validation', [GsoController::class, 'getPendingValidation']);
        Route::post('tickets/{id}/validate', [GsoController::class, 'validateTrip']);
        Route::get('fiscal-years', [FiscalYearController::class, 'index']);
        Route::get('tickets/{id}/history', [GsoController::class, 'getTripHistory']);
        
        // ✅ GSO GPS Live Tracking
        Route::get('live-tracking', [GpsPingController::class, 'getActiveTrips']);
        Route::get('trip/{id}/location', [GpsPingController::class, 'getTripWithLocations']);
    });

    // ============ MAYOR'S OFFICE ============
    Route::middleware(['role:mayors_office'])->prefix('mayors-office')->group(function () {
        // Dashboard
        Route::get('dashboard', [MayorsOfficeController::class, 'getDashboard']);

        // Tickets
        Route::get('pending', [MayorsOfficeController::class, 'getPendingTickets']);
        Route::get('approved', [MayorsOfficeController::class, 'getApprovedTickets']);
        Route::get('tickets/{id}', [MayorsOfficeController::class, 'show']);
        Route::post('tickets/{id}/approve', [MayorsOfficeController::class, 'approveTicket']);
        Route::post('tickets/{id}/reject', [MayorsOfficeController::class, 'rejectTicket']);

        // Budget Overview
        Route::get('budget-overview', [MayorsOfficeController::class, 'getBudgetOverview']);
        Route::get('departments/{id}/budget', [MayorsOfficeController::class, 'getDepartmentBudget']);
        Route::get('departments/all-with-budget', [MayorsOfficeController::class, 'getAllDepartmentsWithBudget']);
        Route::get('departments/selector', [MayorsOfficeController::class, 'getAllDepartmentsForSelector']);

        // Budget Assistance
        Route::get('budget-assistance/requests', [MayorsOfficeController::class, 'getBudgetAssistanceRequests']);
        Route::get('budget-assistance/request/{requestId}', [MayorsOfficeController::class, 'getBudgetAssistanceRequest']);
        Route::post('budget-assistance/create-ticket', [MayorsOfficeController::class, 'createMoFundedTicket']);
        Route::delete('budget-assistance/request/{requestId}', [MayorsOfficeController::class, 'removeMORequest']);
        Route::get('departments/all', [DepartmentController::class, 'getAllDepartmentsForMO']);

        // Budget Policies
        Route::get('budget-policies', [BudgetPolicyController::class, 'index']);
        Route::get('budget-policies/{departmentId}', [BudgetPolicyController::class, 'show']);
        Route::post('budget-policies', [BudgetPolicyController::class, 'store']);
        Route::put('budget-policies/{departmentId}', [BudgetPolicyController::class, 'update']);
        Route::delete('budget-policies/{departmentId}', [BudgetPolicyController::class, 'destroy']);

        Route::get('budget-periods', [BudgetPolicyController::class, 'getPeriods']);
        Route::post('budget-periods/force-activate', [BudgetPolicyController::class, 'forceActivate']);

        // Budget History
        Route::get('budget-history', [BudgetPolicyController::class, 'getBudgetHistory']);
        Route::get('budget-summary', [BudgetPolicyController::class, 'getBudgetSummary']);

        // Receipt Verification
        Route::get('/receipts/for-verification', [MayorsOfficeController::class, 'getReceiptsForVerification']);
        Route::post('/receipts/{id}/verify', [MayorsOfficeController::class, 'verifyReceipt']);

        // Cross-Department Usage
        Route::get('cross-department-usage', [MayorsOfficeController::class, 'getCrossDepartmentUsage']);
        Route::get('cross-department-usage/{id}', [MayorsOfficeController::class, 'getCrossDepartmentUsageDetails']);

        // Weekly Budget Management
        Route::put('/budget/weekly/{departmentId}', [BudgetPolicyController::class, 'updateWeeklyAllocation']);
        Route::post('/budget/process-surplus/{departmentId}', [BudgetPolicyController::class, 'processSurplus']);
        Route::get('/budget/surplus-history', [BudgetPolicyController::class, 'getSurplusHistory']);

        // Fiscal Years - View only
        Route::get('fiscal-years', [FiscalYearController::class, 'index']);
        Route::get('fiscal-years/active', [FiscalYearController::class, 'getActiveYears']);

        // Annual Budget
        Route::prefix('annual-budgets')->group(function () {
            Route::get('/year/{year}', [AnnualBudgetController::class, 'getByFiscalYear']);
            Route::post('/', [AnnualBudgetController::class, 'store']);
            Route::post('/add', [AnnualBudgetController::class, 'addBudget']);
            Route::post('/bulk', [AnnualBudgetController::class, 'bulkUpdate']);
            Route::put('/{id}', [AnnualBudgetController::class, 'update']);
            Route::get('/{departmentId}', [AnnualBudgetController::class, 'show']);
        });
    });

    // ============ DRIVER ============
    Route::middleware(['role:driver'])->prefix('driver')->group(function () {
        Route::get('dashboard', [DriverController::class, 'mobileDashboard']);
        Route::get('profile', [DriverController::class, 'getProfile']);
        Route::post('profile/update', [DriverController::class, 'updateProfile']);
        Route::get('stats', [DriverController::class, 'getStats']);

        Route::get('trips', [DriverController::class, 'getTrips']);
        Route::get('trips/active', [DriverController::class, 'getActiveTrip']);
        Route::get('trips/history', [DriverController::class, 'getTripHistory']);
        Route::get('trips/{id}/details', [DriverController::class, 'getTripDetails']);

        Route::post('trips/{id}/acknowledge', [DriverController::class, 'acknowledgeFunds']);
        Route::post('trips/{id}/start', [DriverController::class, 'startTrip']);
        Route::post('trips/{id}/complete', [DriverController::class, 'completeTrip']);
        Route::get('trips/{id}/gas-slip', [DriverController::class, 'getGasSlip']);

        Route::post('trips/{id}/receipt', [DriverController::class, 'uploadReceipt']);
        Route::get('trips/{id}/receipt', [DriverController::class, 'getReceiptStatus']);
        Route::post('trips/{id}/receipt/acknowledge', [DriverController::class, 'acknowledgeReceipt']);

        // ✅ GPS Routes - Driver specific
        Route::post('gps/start', [GpsPingController::class, 'startTracking']);
        Route::post('gps/stop', [GpsPingController::class, 'stopTracking']);
        Route::post('gps/ping', [GpsPingController::class, 'store']);
        Route::post('gps/batch', [GpsPingController::class, 'storeBatch']);
        
        // ✅ NEW: Driver can check their own trip location data
        Route::get('gps/trips/{id}/pings', [GpsPingController::class, 'getPings']);
        Route::get('gps/trips/{id}/latest', [GpsPingController::class, 'getLatestPing']);
        Route::get('gps/trips/{id}/track', [GpsPingController::class, 'getTrack']);
        Route::get('gps/trips/{id}/summary', [GpsPingController::class, 'getTripSummary']);
        Route::get('gps/trips/{id}/distance', [GpsPingController::class, 'calculateDistance']);
        
        // ✅ NEW: Driver can check deviation
        Route::post('gps/check-deviation', [GpsPingController::class, 'checkDeviation']);

        Route::get('notifications', [NotificationController::class, 'driverNotifications']);
        Route::get('notifications/unread-count', [NotificationController::class, 'unreadCount']);
        Route::post('notifications/{id}/read', [NotificationController::class, 'markAsRead']);
        Route::post('notifications/read-all', [NotificationController::class, 'markAllAsRead']);

        Route::post('sync/offline', [OfflineSyncController::class, 'sync']);
        Route::post('sync/queue', [OfflineSyncController::class, 'queueData']);
        Route::get('sync/pending', [OfflineSyncController::class, 'getPendingCount']);

        Route::get('vehicles/available', [VehicleController::class, 'getAvailableVehicles']);
        Route::get('departments/budget/current', [BudgetController::class, 'getCurrentDepartmentBudget']);
        Route::get('fuel-prices', [DriverController::class, 'getFuelPrices']);

        Route::get('reports/trips', [ReportsController::class, 'getTripReport']);
        Route::get('reports/fuel', [ReportsController::class, 'getFuelReport']);
        Route::get('reports/summary', [ReportsController::class, 'getReportSummary']);
        Route::get('trips/{id}/history', [DriverController::class, 'getTripHistory']);
        Route::get('trips/history/all', [DriverController::class, 'getAllTripHistory']);
        Route::get('trips/{id}/history', [DriverController::class, 'getTripHistoryByTicket']);
    });

    // ============ GPS (General Access - Authenticated Users) ============
    Route::prefix('gps')->group(function () {
        // POST endpoints
        Route::post('pings', [GpsPingController::class, 'store']);
        Route::post('pings/batch', [GpsPingController::class, 'storeBatch']);
        
        // GET endpoints - accessible by authenticated users with proper authorization
        Route::get('trips/{id}/route', [GpsPingController::class, 'getTripRoute']);
        Route::get('trips/{id}/track', [GpsPingController::class, 'getTrack']);
        Route::get('trips/{id}/pings', [GpsPingController::class, 'getPings']);
        Route::get('trips/{id}/latest', [GpsPingController::class, 'getLatestPing']);
        Route::get('trips/{id}/summary', [GpsPingController::class, 'getTripSummary']);
        Route::get('trips/{id}/distance', [GpsPingController::class, 'calculateDistance']);
        Route::get('trips/{id}/locations', [GpsPingController::class, 'getTripWithLocations']);
        
        // ✅ NEW: Geofencing / Deviation check
        Route::post('check-deviation', [GpsPingController::class, 'checkDeviation']);
        
        // Active trips - GSO only
        Route::get('active-trips', [GpsPingController::class, 'getActiveTrips'])
            ->middleware(['role:gso_office']);
        
        // Delete - GSO only
        Route::delete('trips/{id}/pings', [GpsPingController::class, 'deletePings'])
            ->middleware(['role:gso_office']);
    });

    // ============ NOTIFICATIONS ============
    Route::prefix('notifications')->group(function () {
        Route::get('/', [NotificationController::class, 'index']);
        Route::get('/unread-count', [NotificationController::class, 'unreadCount']);
        Route::post('/{id}/read', [NotificationController::class, 'markAsRead']);
        Route::post('/mark-all-read', [NotificationController::class, 'markAllAsRead']);
        Route::post('/send', [NotificationController::class, 'store']);
        Route::post('/test', [NotificationController::class, 'testBroadcast']);
    });
});