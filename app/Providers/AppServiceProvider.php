<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\URL;
use App\Services\OpenRouteService;
use App\Services\FallbackLocationService;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Register FallbackLocationService as a singleton
        $this->app->singleton(FallbackLocationService::class, function ($app) {
            return new FallbackLocationService();
        });

        // Register OpenRouteService with FallbackLocationService dependency
        $this->app->singleton(OpenRouteService::class, function ($app) {
            return new OpenRouteService(
                $app->make(FallbackLocationService::class)
            );
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Force HTTPS in production
        if (config('app.env') === 'production') {
            URL::forceScheme('https');
        }
    }
}