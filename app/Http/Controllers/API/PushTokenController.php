<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class PushTokenController extends Controller
{
    /**
     * Save the current device's Expo push token for this user.
     * Called by mobile on login / app boot.
     */
    public function store(Request $request)
    {
        $request->validate([
            'token' => 'required|string|max:255',
            'platform' => 'nullable|string|in:ios,android,web',
        ]);

        try {
            $user = $request->user();

            $user->push_token = $request->token;
            $user->push_token_platform = $request->platform ?? 'unknown';
            $user->push_token_updated_at = now();
            $user->save();

            Log::info('📲 Push token saved', [
                'user_id' => $user->user_id,
                'platform' => $user->push_token_platform,
                'token_prefix' => substr($request->token, 0, 24) . '...',
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Push token saved',
            ]);
        } catch (\Exception $e) {
            Log::error('❌ Push token save error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to save push token',
            ], 500);
        }
    }

    /**
     * Clear this user's push token. Called on logout.
     */
    public function destroy(Request $request)
    {
        try {
            $user = $request->user();

            $user->push_token = null;
            $user->push_token_platform = null;
            $user->push_token_updated_at = null;
            $user->save();

            Log::info('📲 Push token cleared', ['user_id' => $user->user_id]);

            return response()->json([
                'success' => true,
                'message' => 'Push token cleared',
            ]);
        } catch (\Exception $e) {
            Log::error('❌ Push token clear error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to clear push token',
            ], 500);
        }
    }
}