// src/components/reports/GasSlipView.jsx
import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, X, AlertTriangle, Truck, User, MapPin, Building2, Calendar, DollarSign } from "lucide-react";

const GasSlipView = ({ ticket, onClose }) => {
  const printRef = useRef();

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Gas Slip - ${ticket.ticket_number || ticket.trip_ticket_number}</title>
          <style>
            @page { margin: 20px; }
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            .gas-slip { max-width: 800px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 24px; }
            .header p { margin: 5px 0; color: #666; }
            .details { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
            .detail-item { padding: 8px; border-bottom: 1px solid #eee; }
            .detail-item .label { font-weight: bold; color: #555; }
            .amount { font-size: 24px; font-weight: bold; color: #059669; text-align: right; }
            .footer { text-align: center; margin-top: 30px; padding-top: 15px; border-top: 2px solid #000; font-size: 12px; color: #666; }
            .signature { display: flex; justify-content: space-between; margin-top: 30px; }
            .signature div { text-align: center; }
            .signature .line { border-top: 1px solid #000; width: 200px; margin: 10px auto 0; }
            .cross-dept { background: #fef3c7; border: 1px solid #f59e0b; padding: 10px; border-radius: 8px; margin: 15px 0; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatCurrency = (amount) => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount === 0) return "₱0.00";
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(numAmount);
  };

  const getDriverName = (ticket) => {
    return ticket.driver_name || ticket.driver?.name || ticket.driver?.user?.full_name || "N/A";
  };

  const isCrossDept = ticket.is_cross_department || false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Gas Slip</h2>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handlePrint}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              className="dark:border-slate-700 dark:text-slate-300"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Gas Slip Content */}
        <div ref={printRef} className="gas-slip p-4">
          <div className="text-center border-b-2 border-slate-200 dark:border-slate-700 pb-4 mb-4">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">FUEL GAS SLIP</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Republic of the Philippines - Laguindingan Municipality
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              General Services Office
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-2 border-b border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400">Ticket Number</p>
              <p className="font-semibold text-slate-800 dark:text-white">
                {ticket.ticket_number || ticket.trip_ticket_number}
              </p>
            </div>
            <div className="p-2 border-b border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400">Date</p>
              <p className="font-semibold text-slate-800 dark:text-white">
                {formatDate(ticket.trip_date)}
              </p>
            </div>
            <div className="p-2 border-b border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400">Driver</p>
              <p className="font-semibold text-slate-800 dark:text-white">
                {getDriverName(ticket)}
              </p>
            </div>
            <div className="p-2 border-b border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400">Vehicle</p>
              <p className="font-semibold text-slate-800 dark:text-white">
                {ticket.vehicle?.plate_number || "N/A"}
              </p>
            </div>
            <div className="p-2 border-b border-slate-200 dark:border-slate-700 col-span-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">Destination</p>
              <p className="font-semibold text-slate-800 dark:text-white">
                {ticket.destination || "N/A"}
              </p>
            </div>
            <div className="p-2 border-b border-slate-200 dark:border-slate-700 col-span-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">Department</p>
              <p className="font-semibold text-slate-800 dark:text-white">
                {ticket.department_name || ticket.department?.name || "N/A"}
              </p>
            </div>
          </div>

          <div className="text-center py-3 border-y-2 border-slate-200 dark:border-slate-700 my-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">Amount Released</p>
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(ticket.amount_released)}
            </p>
          </div>

          {isCrossDept && (
            <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-xl p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-orange-700 dark:text-orange-300">
                    Cross-Department Usage
                  </p>
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
                    {ticket.cross_department_reason || "Fuel used by another department"}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="text-center text-xs text-slate-400 dark:text-slate-500 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <p>This is a system-generated gas slip for official use only.</p>
            <p className="mt-1">Generated on {new Date().toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GasSlipView;