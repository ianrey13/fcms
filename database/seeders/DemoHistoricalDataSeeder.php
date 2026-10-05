<?php
// database/seeders/DemoHistoricalDataSeeder.php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

class DemoHistoricalDataSeeder extends Seeder
{
    private const PREFIX      = 'DEMO-';
    private const TOTAL_TRIPS = 45;
    private const DAYS_BACK   = 60;
    private const SEED        = 20260929;

    private int $activeFy;
    private int $gsoUserId;
    private int $moUserId;
    private array $departments  = [];
    private array $drivers      = [];
    private array $vehicles     = [];
    private array $periodIds    = [];
    private array $destinations = [];
    private array $createdTripIds = [];

    public function run(): void
    {
        mt_srand(self::SEED);

        $this->banner('FCMS Demo Historical Data Seeder');

        if (!$this->resolveDependencies()) {
            $this->error('Missing dependencies. Aborting.');
            return;
        }

        if ($this->alreadySeeded()) {
            $this->warn('DEMO- trips already exist. Delete them first:');
            $this->warn('  php artisan tinker --execute=\'\App\Models\TripTicket::where("trip_ticket_number","like","DEMO-%")->delete();\'');
            return;
        }

        $this->loadDestinations();
        $this->loadOrCreatePeriods();

        DB::transaction(function () {
            $this->createHistoricalTrips();
            $this->createLiveTrip();
        });

        $this->writeAuditLogs();
        $this->writeNotifications();

        $this->summary();
    }

    // ============================================================
    // DEPENDENCY RESOLUTION — uses existing rows, no inserts
    // ============================================================

    private function resolveDependencies(): bool
    {
        // GSO user
        $gso = DB::table('users')
            ->where('role', 'gso_office')
            ->where('status', 'active')
            ->orderBy('user_id')
            ->first();
        if (!$gso) { $this->error('No active GSO user'); return false; }
        $this->gsoUserId = (int) $gso->user_id;

        // MO user
        $mo = DB::table('users')
            ->where('role', 'mayors_office')
            ->where('status', 'active')
            ->orderBy('user_id')
            ->first();
        if (!$mo) { $this->error('No active MO user'); return false; }
        $this->moUserId = (int) $mo->user_id;

        // Active fiscal year
        $fy = DB::table('fiscal_years')
            ->where('is_active', 1)
            ->orderByDesc('year')
            ->first();
        if (!$fy) { $this->error('No active fiscal year'); return false; }
        $this->activeFy = (int) $fy->year;

        // Departments
        $depts = DB::table('departments')
            ->where('is_active', 1)
            ->whereNotNull('department_code')
            ->get();
        if ($depts->isEmpty()) { $this->error('No active departments'); return false; }
        $this->departments = $depts->map(fn($d) => (array) $d)->toArray();

        // Drivers (via users)
        $drivers = DB::table('drivers')
            ->join('users', 'drivers.user_id', '=', 'users.user_id')
            ->where('drivers.status', 'active')
            ->where('users.status', 'active')
            ->select('drivers.driver_id', 'drivers.user_id', 'users.first_name', 'users.last_name')
            ->get();
        if ($drivers->isEmpty()) { $this->error('No active drivers'); return false; }
        $this->drivers = $drivers->map(fn($d) => (array) $d)->toArray();

        // Vehicles
        $vehicles = DB::table('vehicles')
            ->where('status', 'active')
            ->where('maintenance_flag', 0)
            ->get();
        if ($vehicles->isEmpty()) { $this->error('No active vehicles'); return false; }
        $this->vehicles = $vehicles->map(fn($v) => (array) $v)->toArray();

        $this->info(sprintf(
            'GSO=%d MO=%d depts=%d drivers=%d vehicles=%d FY=%d',
            $this->gsoUserId, $this->moUserId,
            count($this->departments), count($this->drivers),
            count($this->vehicles), $this->activeFy
        ));
        return true;
    }

    private function alreadySeeded(): bool
    {
        return DB::table('trip_ticket')
            ->where('trip_ticket_number', 'like', self::PREFIX . '%')
            ->exists();
    }

    // ============================================================
    // LOOKUPS
    // ============================================================

    private function loadDestinations(): void
    {
        // Real Laguindingan + nearby destinations
        $this->destinations = [
            ['name'=>'Poblacion, Laguindingan','lat'=>8.5731,'lng'=>124.4421,'km'=>2.1],
            ['name'=>'Gasi, Laguindingan',     'lat'=>8.5503,'lng'=>124.4380,'km'=>4.8],
            ['name'=>'Tubajon, Laguindingan',  'lat'=>8.5862,'lng'=>124.4527,'km'=>5.2],
            ['name'=>'Moog, Laguindingan',     'lat'=>8.5660,'lng'=>124.4310,'km'=>3.7],
            ['name'=>'Sinai, Laguindingan',    'lat'=>8.5580,'lng'=>124.4465,'km'=>4.1],
            ['name'=>'Liberty, Laguindingan',  'lat'=>8.5795,'lng'=>124.4380,'km'=>6.3],
            ['name'=>'Aromahon, Laguindingan', 'lat'=>8.5640,'lng'=>124.4520,'km'=>4.4],
            ['name'=>'Kibaghot, Laguindingan', 'lat'=>8.5560,'lng'=>124.4330,'km'=>5.5],
            ['name'=>'Lapad, Laguindingan',    'lat'=>8.5610,'lng'=>124.4405,'km'=>3.9],
            ['name'=>'Mauswagon, Laguindingan','lat'=>8.5920,'lng'=>124.4450,'km'=>6.8],
            ['name'=>'Sambulawan, Laguindingan','lat'=>8.5450,'lng'=>124.4300,'km'=>7.2],
            ['name'=>'Alubijid, Mis. Or.',     'lat'=>8.5703,'lng'=>124.4680,'km'=>7.5],
            ['name'=>'Gitagum, Mis. Or.',      'lat'=>8.5717,'lng'=>124.4080,'km'=>8.2],
            ['name'=>'El Salvador City',       'lat'=>8.5644,'lng'=>124.5140,'km'=>12.6],
            ['name'=>'Opol, Mis. Or.',         'lat'=>8.5220,'lng'=>124.5730,'km'=>18.4],
            ['name'=>'Cagayan de Oro City',    'lat'=>8.4822,'lng'=>124.6472,'km'=>36.2],
            ['name'=>'Laguindingan Airport',   'lat'=>8.6122,'lng'=>124.4575,'km'=>5.9],
        ];
        $this->info('Loaded ' . count($this->destinations) . ' destinations');
    }

    private function loadOrCreatePeriods(): void
    {
        // Use any active or most recent period per department
        $rows = DB::table('dept_budget_period')
            ->where('fiscal_year', $this->activeFy)
            ->orderByDesc('week_start')
            ->get();

        foreach ($rows as $r) {
            $did = (int) $r->department_id;
            if (!isset($this->periodIds[$did])) {
                $this->periodIds[$did] = (int) $r->period_id;
            }
        }

        // Create a period if department has none
        $weekStart = Carbon::now()->startOfWeek(Carbon::MONDAY)->toDateString();
        foreach ($this->departments as $dept) {
            $did = (int) $dept['department_id'];
            if (isset($this->periodIds[$did])) continue;

            $pid = DB::table('dept_budget_period')->insertGetId([
                'department_id'     => $did,
                'fiscal_year'       => $this->activeFy,
                'week_start'        => $weekStart,
                'allocated_amount'  => 10000.00,
                'remaining_balance' => 10000.00,
                'status'            => 'active',
                'created_at'        => Carbon::now(),
                'updated_at'        => Carbon::now(),
            ]);
            $this->periodIds[$did] = $pid;
        }

        $this->info('Resolved ' . count($this->periodIds) . ' budget periods');
    }

    // ============================================================
    // TRIP FACTORY
    // ============================================================

    private function createHistoricalTrips(): void
    {
        $distribution = [
            'closed'                 => 32,
            'pending_mayors_office'  => 4,
            'pending_gso_validation' => 3,
            'cancelled'              => 3,
            'funds_issued'           => 1,
            'acknowledged'           => 1,
        ];

        $n     = 0;
        $total = array_sum($distribution);

        foreach ($distribution as $status => $count) {
            for ($i = 0; $i < $count; $i++) {
                $n++;
                $this->buildTrip($status, $this->randomHistoricalDate(), $n, $total);
            }
        }
    }

    private function createLiveTrip(): void
    {
        $this->buildTrip('in_transit', Carbon::now()->subHours(2), 45, 45, true);
    }

    private function buildTrip(string $status, Carbon $date, int $n, int $total, bool $isLive = false): void
    {
        $dept    = $this->departments[array_rand($this->departments)];
        $deptId  = (int) $dept['department_id'];
        $driver  = $this->drivers[array_rand($this->drivers)];
        $vehicle = $this->vehicles[array_rand($this->vehicles)];
        $dest    = $this->destinations[array_rand($this->destinations)];

        $periodId = $this->periodIds[$deptId] ?? null;
        if (!$periodId) {
            $this->warn("No period for dept {$deptId}, skipping");
            return;
        }

        $tripNumber = self::PREFIX . $date->format('Y-m') . '-' . str_pad((string) $n, 4, '0', STR_PAD_LEFT);

        $estimatedKm   = round($dest['km'] * (0.95 + (mt_rand(0, 100) / 1000)), 2);
        $efficiency    = (float) ($vehicle['fuel_efficiency'] ?? 10.0);
        $estimatedFuel = $efficiency > 0 ? round($estimatedKm / $efficiency, 2) : 2.0;

        $ticketId = DB::table('trip_ticket')->insertGetId([
            'trip_ticket_number'          => $tripNumber,
            'department_id'               => $deptId,
            'submitted_by'                => $this->gsoUserId,
            'driver_id'                   => (int) $driver['driver_id'],
            'vehicle_id'                  => (int) $vehicle['vehicle_id'],
            'created_by_mo_user_id'       => null,
            'submitted_by_staff'          => true,
            'submitted_at'                => $date,
            'trip_date'                   => $date->toDateString(),
            'purpose'                     => $this->purposeFor($dest['name']),
            'destination'                 => $dest['name'],
            'charge_to'                   => $dept['department_code'],
            'passenger_name'              => null,
            'status'                      => $status,
            'trip_count'                  => 0,
            'closed_by'                   => $status === 'closed' ? $this->gsoUserId : null,
            'closed_at'                   => $status === 'closed' ? $date->copy()->addHours(6) : null,
            'cancelled_by'                => $status === 'cancelled' ? $this->moUserId : null,
            'cancelled_at'                => $status === 'cancelled' ? $date->copy()->addHours(1) : null,
            'cancellation_reason'         => $status === 'cancelled' ? 'Trip cancelled due to schedule conflict.' : null,
            'updated_at'                  => $date->copy()->addHours(6),
            'estimated_distance_km'       => $estimatedKm,
            'estimated_fuel_liters'       => $estimatedFuel,
            'actual_distance_km'          => null,
            'actual_fuel_used'            => null,
            'is_fuel_issued_without_trip' => false,
            'has_insufficient_budget'     => false,
            'budget_shortage'             => 0.00,
            'original_department_id'      => null,
        ]);

        $this->createdTripIds[] = $ticketId;

        // Vehicle snapshot
        DB::table('trip_vehicle_snapshot')->insert([
            'trip_ticket_id'    => $ticketId,
            'vehicle_status'    => $vehicle['status'] ?? 'active',
            'fuel_type'         => $vehicle['fuel_type'] ?? 'diesel',
            'snapshot_taken_at' => $date,
        ]);

        // Pending MO = no gas slip
        if ($status === 'pending_mayors_office') {
            $this->progress($n, $total, $tripNumber, $status);
            return;
        }

        // Gas slip
        $unitPrice      = $this->unitPrice($vehicle['fuel_type'] ?? 'diesel');
        $amountReleased = round($estimatedFuel * $unitPrice, 2);
        $budgetBefore   = 10000.00;
        $budgetAfter    = round($budgetBefore - $amountReleased, 2);

        $gasSlipId = DB::table('gas_slip')->insertGetId([
            'trip_ticket_id'         => $ticketId,
            'created_by'             => $this->moUserId,
            'amount_released'        => $amountReleased,
            'is_cross_department'    => false,
            'budget_before'          => $budgetBefore,
            'budget_after'           => $budgetAfter,
            'period_id'              => $periodId,
            'reconciliation_status'  => $status === 'closed' ? 'verified' : 'pending',
            'reconciled_by'          => $status === 'closed' ? $this->moUserId : null,
            'reconciled_at'          => $status === 'closed' ? $date->copy()->addHours(8) : null,
            'acknowledged_by'        => in_array($status, ['closed','in_transit','acknowledged','pending_gso_validation','funds_issued'])
                                        ? (int) $driver['user_id'] : null,
            'acknowledged_at'        => in_array($status, ['closed','in_transit','acknowledged','pending_gso_validation','funds_issued'])
                                        ? $date->copy()->addHours(1) : null,
            'created_at'             => $date->copy()->addHours(1),
            'updated_at'             => $date->copy()->addHours(8),
        ]);

        // Cancelled = no receipt
        if ($status === 'cancelled') {
            $this->progress($n, $total, $tripNumber, $status);
            return;
        }

        // Fuel receipt (no photo per earlier instruction)
        $liters     = round($estimatedFuel, 2);
        $amount     = round($liters * $unitPrice, 2);
        $isVerified = $status === 'closed';

        DB::table('fuel_receipt')->insert([
            'gas_slip_id'             => $gasSlipId,
            'invoice_number'          => 'INV-' . str_pad((string) mt_rand(1, 999999), 6, '0', STR_PAD_LEFT),
            'liters_availed'          => $liters,
            'amount_on_receipt'       => $amount,
            'unit_price'              => $unitPrice,
            'receipt_photo_path'      => null,
            'receipt_uploaded_at'     => $date->copy()->addHours(2),
            'verification_status'     => $isVerified ? 'verified' : 'pending',
            'verified_at'             => $isVerified ? $date->copy()->addHours(3) : null,
            'verified_by'             => $isVerified ? $this->moUserId : null,
            'trip_start_gps_lat'      => null,
            'trip_start_gps_lng'      => null,
            'trip_end_gps_lat'        => null,
            'trip_end_gps_lng'        => null,
            'trip_start_gps_accuracy' => null,
            'trip_started_at'         => null,
            'trip_ended_at'           => null,
            'trip_elapsed_minutes'    => null,
            'gps_distance_km'         => null,
            'created_at'              => $date->copy()->addHours(2),
            'updated_at'              => $date->copy()->addHours(8),
        ]);

        $moved = in_array($status, ['closed','pending_gso_validation','acknowledged','funds_issued','in_transit']);
        if (!$moved) {
            $this->progress($n, $total, $tripNumber, $status);
            return;
        }

        $this->createHistoryAndPings($ticketId, $date, $dest, $isLive, $estimatedKm);

        if ($status === 'closed') {
            $actualKm = round($estimatedKm * (1 + (mt_rand(-100, 100) / 1000)), 2);
            DB::table('trip_ticket')
                ->where('trip_ticket_id', $ticketId)
                ->update([
                    'actual_distance_km' => $actualKm,
                    'actual_fuel_used'   => round($actualKm / max($efficiency, 1), 2),
                    'trip_count'         => 1,
                ]);
        }

        $this->progress($n, $total, $tripNumber, $status);
    }

    private function createHistoryAndPings(int $ticketId, Carbon $date, array $dest, bool $isLive, float $estimatedKm): void
    {
        $originLat = 8.5731;
        $originLng = 124.4421;

        if ($isLive) {
            $startedAt     = Carbon::now()->subMinutes(30);
            $endedAt       = null;
            $historyStatus = 'in_progress';
            $pingEndTime   = Carbon::now()->subSeconds(30);
        } else {
            $startedAt     = $date->copy()->addHours(2);
            $endedAt       = $date->copy()->addHours(4);
            $historyStatus = 'completed';
            $pingEndTime   = $endedAt;
        }

        DB::table('trip_history')->insert([
            'trip_ticket_id' => $ticketId,
            'trip_number'    => 1,
            'start_lat'      => $originLat,
            'start_lng'      => $originLng,
            'started_at'     => $startedAt,
            'end_lat'        => $isLive ? null : $dest['lat'],
            'end_lng'        => $isLive ? null : $dest['lng'],
            'ended_at'       => $endedAt,
            'distance_km'    => $isLive ? 0 : $estimatedKm,
            'status'         => $historyStatus,
            'created_at'     => $startedAt,
            'updated_at'     => $endedAt ?? $startedAt,
        ]);

        $pingCount = mt_rand(20, 50);
        $duration  = $startedAt->diffInSeconds($pingEndTime);
        $step      = max(1, (int) floor($duration / $pingCount));

        $rows = [];
        for ($i = 0; $i <= $pingCount; $i++) {
            $t   = $i / $pingCount;
            $lat = $originLat + ($dest['lat'] - $originLat) * $t;
            $lng = $originLng + ($dest['lng'] - $originLng) * $t;
            $lat += (mt_rand(-100, 100) / 1000000);
            $lng += (mt_rand(-100, 100) / 1000000);

            $recorded = $startedAt->copy()->addSeconds($step * $i);

            $rows[] = [
                'trip_ticket_id'         => $ticketId,
                'latitude'               => round($lat, 7),
                'longitude'              => round($lng, 7),
                'accuracy_meters'        => mt_rand(300, 900) / 100,
                'speed_kmh'              => mt_rand(1500, 6000) / 100,
                'heading_degrees'        => mt_rand(0, 3599) / 10,
                'is_low_accuracy'        => false,
                'is_queued_upload'       => false,
                'has_mock_location_flag' => false,
                'recorded_at'            => $recorded,
                'received_at'            => $recorded->copy()->addSeconds(mt_rand(1, 5)),
            ];
        }

        foreach (array_chunk($rows, 50) as $chunk) {
            DB::table('gps_ping')->insert($chunk);
        }
    }

    // ============================================================
    // AUDIT + NOTIFICATIONS
    // ============================================================

    private function writeAuditLogs(): void
    {
        if (empty($this->createdTripIds)) return;

        $tickets = DB::table('trip_ticket')
            ->whereIn('trip_ticket_id', $this->createdTripIds)
            ->get();

        $rows = [];
        foreach ($tickets as $t) {
            $submitted = Carbon::parse($t->submitted_at);

            $rows[] = [
                'user_id'    => $this->gsoUserId,
                'action'     => 'created',
                'table_name' => 'trip_ticket',
                'record_id'  => $t->trip_ticket_id,
                'old_values' => null,
                'new_values' => json_encode(['status' => 'draft', 'number' => $t->trip_ticket_number]),
                'ip_address' => '127.0.0.1',
                'created_at' => $submitted,
            ];

            if ($t->status === 'closed') {
                $rows[] = [
                    'user_id'    => $this->moUserId,
                    'action'     => 'approved',
                    'table_name' => 'trip_ticket',
                    'record_id'  => $t->trip_ticket_id,
                    'old_values' => json_encode(['status' => 'pending_mayors_office']),
                    'new_values' => json_encode(['status' => 'funds_issued']),
                    'ip_address' => '127.0.0.1',
                    'created_at' => $submitted->copy()->addMinutes(45),
                ];
                $rows[] = [
                    'user_id'    => $this->gsoUserId,
                    'action'     => 'closed',
                    'table_name' => 'trip_ticket',
                    'record_id'  => $t->trip_ticket_id,
                    'old_values' => json_encode(['status' => 'completed']),
                    'new_values' => json_encode(['status' => 'closed']),
                    'ip_address' => '127.0.0.1',
                    'created_at' => $submitted->copy()->addHours(8),
                ];
            }

            if ($t->status === 'cancelled') {
                $rows[] = [
                    'user_id'    => $this->moUserId,
                    'action'     => 'cancelled',
                    'table_name' => 'trip_ticket',
                    'record_id'  => $t->trip_ticket_id,
                    'old_values' => json_encode(['status' => 'pending_mayors_office']),
                    'new_values' => json_encode(['status' => 'cancelled']),
                    'ip_address' => '127.0.0.1',
                    'created_at' => $submitted->copy()->addHours(1),
                ];
            }
        }

        foreach (array_chunk($rows, 100) as $chunk) {
            DB::table('audit_log')->insert($chunk);
        }
        $this->info('Wrote ' . count($rows) . ' audit log entries');
    }

    private function writeNotifications(): void
    {
        if (empty($this->createdTripIds)) return;

        $tickets = DB::table('trip_ticket')
            ->whereIn('trip_ticket_id', $this->createdTripIds)
            ->get();

        $rows = [];
        foreach ($tickets as $t) {
            $submitted    = Carbon::parse($t->submitted_at);
            $driverUserId = DB::table('drivers')->where('driver_id', $t->driver_id)->value('user_id');

            $rows[] = [
                'recipient_user_id' => $this->moUserId,
                'notification_type' => 'trip_submitted',
                'entity_type'       => 'trip_ticket',
                'entity_id'         => $t->trip_ticket_id,
                'message'           => "New trip {$t->trip_ticket_number} submitted for approval.",
                'channel'           => 'in_app',
                'is_read'           => $t->status !== 'pending_mayors_office',
                'created_at'        => $submitted,
                'read_at'           => $t->status !== 'pending_mayors_office' ? $submitted->copy()->addMinutes(30) : null,
            ];

            if ($t->status === 'closed' && $driverUserId) {
                $rows[] = [
                    'recipient_user_id' => $driverUserId,
                    'notification_type' => 'fund_released',
                    'entity_type'       => 'trip_ticket',
                    'entity_id'         => $t->trip_ticket_id,
                    'message'           => "Funds released for trip {$t->trip_ticket_number}.",
                    'channel'           => 'in_app',
                    'is_read'           => true,
                    'created_at'        => $submitted->copy()->addMinutes(45),
                    'read_at'           => $submitted->copy()->addMinutes(60),
                ];
                $rows[] = [
                    'recipient_user_id' => $driverUserId,
                    'notification_type' => 'trip_completed',
                    'entity_type'       => 'trip_ticket',
                    'entity_id'         => $t->trip_ticket_id,
                    'message'           => "Trip {$t->trip_ticket_number} completed.",
                    'channel'           => 'in_app',
                    'is_read'           => true,
                    'created_at'        => $submitted->copy()->addHours(4),
                    'read_at'           => $submitted->copy()->addHours(5),
                ];
            }
        }

        foreach (array_chunk($rows, 100) as $chunk) {
            DB::table('notifications')->insert($chunk);
        }
        $this->info('Wrote ' . count($rows) . ' notifications');
    }

    // ============================================================
    // HELPERS
    // ============================================================

    private function randomHistoricalDate(): Carbon
    {
        do {
            $daysAgo   = mt_rand(1, self::DAYS_BACK);
            $date      = Carbon::now()->subDays($daysAgo);
            $isWeekend = $date->isWeekend();
        } while ($isWeekend && mt_rand(1, 6) !== 1);

        return $date->copy()->setTime(mt_rand(7, 15), mt_rand(0, 59), 0);
    }

    private function unitPrice(string $fuelType): float
    {
        return match ($fuelType) {
            'diesel'   => mt_rand(5500, 6500) / 100,
            'gasoline' => mt_rand(6000, 7500) / 100,
            'premium'  => mt_rand(6500, 8500) / 100,
            default    => 60.00,
        };
    }

    private function purposeFor(string $dest): string
    {
        $purposes = [
            'Official meeting with LGU officials',
            'Delivery of documents to provincial office',
            'Inspection of infrastructure project',
            'Attendance to seminar/training',
            'Transport of supplies',
            'Emergency response coordination',
            'Field validation of reports',
            'Coordination with barangay officials',
            'Bank transaction and fund withdrawal',
            'Medical mission support',
        ];
        return $purposes[array_rand($purposes)];
    }

    // ============================================================
    // OUTPUT
    // ============================================================

    private function output(string $msg): void
    {
        $this->command?->line($msg);
    }

    private function banner(string $msg): void  { $this->output("\n=== {$msg} ===\n"); }
    private function info(string $msg): void    { $this->output("  [i] {$msg}"); }
    private function warn(string $msg): void    { $this->output("  [!] {$msg}"); }
    private function error(string $msg): void   { $this->output("  [x] {$msg}"); }
    private function progress(int $n, int $t, string $num, string $status): void
    {
        $this->output(sprintf("  [%2d/%2d] %s -- %s", $n, $t, $num, $status));
    }

    private function summary(): void
    {
        $this->output("\n=== Summary ===");
        $count = DB::table('trip_ticket')->where('trip_ticket_number', 'like', self::PREFIX . '%')->count();
        $live  = DB::table('trip_ticket')
            ->where('trip_ticket_number', 'like', self::PREFIX . '%')
            ->where('status', 'in_transit')
            ->value('trip_ticket_number');

        $this->info("Created {$count} trips");
        if ($live) $this->info("Live trip: {$live}");

        $this->output("\nWipe command:");
        $this->output('  php artisan tinker --execute=\'\App\Models\TripTicket::where("trip_ticket_number","like","DEMO-%")->delete();\'');
    }
}