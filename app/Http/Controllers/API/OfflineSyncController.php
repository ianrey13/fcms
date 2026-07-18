<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\OfflineQueue;
use App\Models\GpsPing;
use App\Models\TripTicket;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OfflineSyncController extends Controller
{
    /**
     * Sync offline data
     */
    public function sync(Request $request)
    {
        $request->validate([
            'queued_data' => 'required|array',
        ]);
        
        $driver = auth()->user()->driver;
        $results = [];
        
        foreach ($request->queued_data as $item) {
            try {
                DB::beginTransaction();
                
                switch ($item['action_type']) {
                    case 'gps_ping':
                        $results[] = $this->processGpsPing($driver, $item);
                        break;
                    case 'receipt_upload':
                        $results[] = $this->processReceiptUpload($driver, $item);
                        break;
                    case 'trip_start':
                        $results[] = $this->processTripStart($driver, $item);
                        break;
                    case 'trip_complete':
                        $results[] = $this->processTripComplete($driver, $item);
                        break;
                    default:
                        $results[] = ['id' => $item['id'] ?? null, 'status' => 'failed', 'reason' => 'Unknown action'];
                }
                
                DB::commit();
            } catch (\Exception $e) {
                DB::rollBack();
                $results[] = ['id' => $item['id'] ?? null, 'status' => 'failed', 'reason' => $e->getMessage()];
            }
        }
        
        return response()->json([
            'message' => 'Sync completed',
            'results' => $results,
            'processed' => count($results),
        ]);
    }
    
    /**
     * Queue data for offline sync
     */
    public function queueData(Request $request)
    {
        $request->validate([
            'action_type' => 'required|string',
            'trip_ticket_id' => 'required|exists:trip_ticket,trip_ticket_id',
            'payload' => 'required|array',
        ]);
        
        $driver = auth()->user()->driver;
        
        $queue = OfflineQueue::create([
            'driver_id' => $driver->driver_id,
            'trip_ticket_id' => $request->trip_ticket_id,
            'action_type' => $request->action_type,
            'payload' => $request->payload,
            'created_at' => now(),
            'retry_count' => 0,
        ]);
        
        return response()->json([
            'message' => 'Data queued successfully',
            'queue_id' => $queue->queue_id
        ]);
    }
    
    /**
     * Get pending sync count
     */
    public function getPendingCount(Request $request)
    {
        $driver = auth()->user()->driver;
        
        $count = OfflineQueue::where('driver_id', $driver->driver_id)
            ->whereNull('synced_at')
            ->count();
            
        return response()->json(['pending_count' => $count]);
    }
    
    /**
     * Process GPS ping
     */
    private function processGpsPing($driver, $data)
    {
        $trip = TripTicket::where('trip_ticket_id', $data['trip_ticket_id'])
            ->where('driver_id', $driver->driver_id)
            ->first();
            
        if (!$trip || $trip->status !== 'in_transit') {
            return ['id' => $data['id'] ?? null, 'status' => 'failed', 'reason' => 'No active trip'];
        }
        
        $fuelLog = $trip->gasSlip->fuelLog;
        
        GpsPing::create([
            'fuel_log_id' => $fuelLog->fuel_log_id,
            'latitude' => $data['payload']['latitude'],
            'longitude' => $data['payload']['longitude'],
            'accuracy' => $data['payload']['accuracy'] ?? null,
            'speed' => $data['payload']['speed'] ?? null,
            'altitude' => $data['payload']['altitude'] ?? null,
            'recorded_at' => $data['payload']['recorded_at'] ?? now(),
        ]);
        
        // Mark queue item as synced
        if (isset($data['queue_id'])) {
            OfflineQueue::where('queue_id', $data['queue_id'])->update(['synced_at' => now()]);
        }
        
        return ['id' => $data['id'] ?? null, 'status' => 'success'];
    }
    
    private function processReceiptUpload($driver, $data)
    {
        // Implementation
        return ['id' => $data['id'] ?? null, 'status' => 'success'];
    }
    
    private function processTripStart($driver, $data)
    {
        // Implementation
        return ['id' => $data['id'] ?? null, 'status' => 'success'];
    }
    
    private function processTripComplete($driver, $data)
    {
        // Implementation
        return ['id' => $data['id'] ?? null, 'status' => 'success'];
    }
}