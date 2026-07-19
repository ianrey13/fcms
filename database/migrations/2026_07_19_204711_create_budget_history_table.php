// database/migrations/2026_07_19_create_budget_history_table.php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateBudgetHistoryTable extends Migration
{
    public function up()
    {
        Schema::create('budget_history', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('department_id');
            $table->string('department_name');
            $table->string('action'); // created, added, reduced, updated, deleted, activated
            $table->decimal('previous_amount', 12, 2)->default(0);
            $table->decimal('added_amount', 12, 2)->default(0);
            $table->decimal('new_amount', 12, 2)->default(0);
            $table->string('reason')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('user_name')->nullable();
            $table->timestamps();
            
            // Indexes
            $table->index('department_id');
            $table->index('action');
            $table->index('created_at');
        });
    }

    public function down()
    {
        Schema::dropIfExists('budget_history');
    }
}