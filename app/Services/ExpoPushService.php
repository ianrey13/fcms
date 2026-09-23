<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ExpoPushService
{
    private const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

    /**
     * Send a push notification via Expo Push Service.
     *
     * @param  string  $token   ExponentPushToken[...]
     * @param  string  $title
     * @param  string  $body
     * @param  array   $data    Payload for tap navigation
     * @return bool
     */
    public function send(string $token, string $title, string $body, array $data = []): bool
    {
        if (empty($token) || !str_starts_with($token, 'ExponentPushToken')) {
            Log::warning('Invalid Expo push token', ['token' => substr($token, 0, 20)]);
            return false;
        }

        try {
            $payload = [
                'to' => $token,
                'title' => $title,
                'body' => $body,
                'sound' => 'default',
                'priority' => 'high',
                'channelId' => 'fcms-trips', // Android channel — must match client registration
                'data' => $data,
            ];

            $response = Http::withHeaders([
                'Accept' => 'application/json',
                'Accept-Encoding' => 'gzip, deflate',
                'Content-Type' => 'application/json',
            ])->timeout(10)->post(self::EXPO_PUSH_URL, $payload);

            $body = $response->json();

            // Expo returns { data: { status: "ok" | "error", ... } }
            $status = $body['data']['status'] ?? 'unknown';

            if ($status === 'ok') {
                Log::info('📤 Push sent', [
                    'token_prefix' => substr($token, 0, 20) . '...',
                    'title' => $title,
                ]);
                return true;
            }

            // Handle DeviceNotRegistered — token is dead, clean it up
            if ($status === 'error') {
                $errorCode = $body['data']['details']['error'] ?? null;

                Log::warning('⚠️ Push failed', [
                    'token_prefix' => substr($token, 0, 20) . '...',
                    'error' => $errorCode,
                    'message' => $body['data']['message'] ?? null,
                ]);

                if ($errorCode === 'DeviceNotRegistered') {
                    // Token is stale — null it so we stop sending
                    User::where('push_token', $token)->update([
                        'push_token' => null,
                        'push_token_platform' => null,
                        'push_token_updated_at' => now(),
                    ]);
                    Log::info('🧹 Cleared stale push token');
                }

                return false;
            }

            return false;
        } catch (\Exception $e) {
            Log::error('❌ Expo push exception: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Send push to a specific user (looks up their token).
     */
    public function sendToUser(int $userId, string $title, string $body, array $data = []): bool
    {
        $user = User::find($userId);
        if (!$user || !$user->push_token) {
            return false;
        }

        return $this->send($user->push_token, $title, $body, $data);
    }
}