// src/pages/mayor/BudgetAssistanceWidget.jsx

import React, { useState, useEffect } from 'react';
import { mayorsOfficeAPI } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Bell, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BudgetAssistanceWidget = () => {
  const [pendingRequests, setPendingRequests] = useState(0);
  const [totalShortage, setTotalShortage] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPendingCount();
    // Refresh every 30 seconds
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchPendingCount = async () => {
    try {
      const response = await mayorsOfficeAPI.getBudgetAssistanceRequests();
      const requests = response.data.data || [];
      const pending = requests.filter(r => r.status === 'pending' || !r.status);
      setPendingRequests(pending.length);
      
      const shortage = pending.reduce((sum, r) => sum + (r.shortage || 0), 0);
      setTotalShortage(shortage);
    } catch (error) {
      console.error('Failed to fetch pending requests:', error);
    }
  };

  if (pendingRequests === 0) {
    return null;
  }

  return (
    <Card className="border-yellow-200 bg-yellow-50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-yellow-800">
          <AlertTriangle className="h-5 w-5" />
          Budget Assistance Required
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-sm text-yellow-700">
            <span className="font-bold">{pendingRequests}</span> department(s) need budget assistance
          </p>
          <p className="text-sm text-yellow-700">
            Total shortage: <span className="font-bold">₱{totalShortage.toLocaleString()}</span>
          </p>
          <Button 
            onClick={() => navigate('/mo/budget-assistance')}
            className="w-full bg-yellow-600 hover:bg-yellow-700"
          >
            <Bell className="h-4 w-4 mr-2" />
            Review Requests
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default BudgetAssistanceWidget;