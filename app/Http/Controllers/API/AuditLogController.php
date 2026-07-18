<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    /**
     * Get all audit logs with pagination
     */
    public function index(Request $request)
    {
        try {
            $query = AuditLog::with('user');

            // Filter by user
            if ($request->user_id) {
                $query->where('user_id', $request->user_id);
            }

            // Filter by action
            if ($request->action) {
                $query->where('action', $request->action);
            }

            // Filter by table
            if ($request->table_name) {
                $query->where('table_name', $request->table_name);
            }

            // Filter by date range
            if ($request->start_date && $request->end_date) {
                $query->whereBetween('created_at', [
                    $request->start_date,
                    $request->end_date
                ]);
            }

            // Search
            if ($request->search) {
                $search = '%' . $request->search . '%';
                $query->where(function($q) use ($search) {
                    $q->where('action', 'LIKE', $search)
                      ->orWhere('table_name', 'LIKE', $search)
                      ->orWhere('ip_address', 'LIKE', $search);
                });
            }

            $logs = $query->orderBy('created_at', 'desc')
                ->paginate($request->limit ?? 20);

            return response()->json([
                'success' => true,
                'data' => $logs->items(),
                'meta' => [
                    'current_page' => $logs->currentPage(),
                    'last_page' => $logs->lastPage(),
                    'total' => $logs->total(),
                    'per_page' => $logs->perPage(),
                ]
            ]);
        } catch (\Exception $e) {
            \Log::error('Audit log error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch audit logs'
            ], 500);
        }
    }

    /**
     * Get audit log summary statistics
     */
    public function getSummary(Request $request)
    {
        try {
            $summary = [
                'total_logs' => AuditLog::count(),
                'today' => AuditLog::whereDate('created_at', today())->count(),
                'this_week' => AuditLog::whereBetween('created_at', [
                    now()->startOfWeek(),
                    now()->endOfWeek()
                ])->count(),
                'this_month' => AuditLog::whereMonth('created_at', now()->month)->count(),
                'actions_breakdown' => AuditLog::select('action')
                    ->selectRaw('count(*) as count')
                    ->groupBy('action')
                    ->get()
                    ->map(function($item) {
                        return [
                            'action' => $item->action,
                            'count' => $item->count
                        ];
                    }),
                'recent_activity' => AuditLog::with('user')
                    ->orderBy('created_at', 'desc')
                    ->limit(10)
                    ->get()
                    ->map(function($log) {
                        return [
                            'log_id' => $log->log_id,
                            'action' => $log->action,
                            'table_name' => $log->table_name,
                            'user_name' => $log->user?->full_name ?? 'System',
                            'created_at' => $log->created_at,
                        ];
                    }),
            ];

            return response()->json([
                'success' => true,
                'data' => $summary
            ]);
        } catch (\Exception $e) {
            \Log::error('Audit summary error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch summary'
            ], 500);
        }
    }

    /**
     * Get audit logs for a specific model
     */
    public function getModelLogs(Request $request, $modelType, $modelId)
    {
        try {
            $logs = AuditLog::with('user')
                ->where('table_name', $modelType)
                ->where('record_id', $modelId)
                ->orderBy('created_at', 'desc')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $logs
            ]);
        } catch (\Exception $e) {
            \Log::error('Model logs error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch model logs'
            ], 500);
        }
    }
}