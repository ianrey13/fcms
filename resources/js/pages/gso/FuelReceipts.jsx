// src/pages/gso/FuelReceipts.jsx
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { gsoAPI } from "../../services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Eye, Receipt, Loader2, Image, Calendar, MapPin, User, Truck, Fuel,RefreshCw, } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { toast } from "react-hot-toast";

const FuelReceipts = () => {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedReceipt, setSelectedReceipt] = useState(null);
    const [showReceiptDialog, setShowReceiptDialog] = useState(false);

    const { data: receipts = [], isLoading, refetch } = useQuery({
        queryKey: ["gso-fuel-receipts"],
        queryFn: async () => {
            const response = await gsoAPI.getFuelReceipts();
            return response.data?.data || [];
        },
    });

    const filteredReceipts = receipts.filter((receipt) =>
        receipt.ticket_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        receipt.plate_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        receipt.driver_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusBadge = (status) => {
        const config = {
            pending: { color: "bg-yellow-500", label: "Pending" },
            verified: { color: "bg-green-500", label: "Verified" },
            discrepancy: { color: "bg-red-500", label: "Discrepancy" },
        };
        const c = config[status] || config.pending;
        return <Badge className={`${c.color} text-white`}>{c.label}</Badge>;
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP',
            minimumFractionDigits: 2
        }).format(amount || 0);
    };

    const formatDate = (date) => {
        if (!date) return "N/A";
        return format(new Date(date), "MMM dd, yyyy hh:mm a");
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
                        Fuel Receipts
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        View and manage driver uploaded fuel receipts
                    </p>
                </div>
                <Button onClick={() => refetch()} variant="outline" className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                </Button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                    placeholder="Search by ticket number, plate number, or driver name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                />
            </div>

            {/* Receipts Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Receipt className="h-5 w-5" />
                        All Fuel Receipts ({filteredReceipts.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {filteredReceipts.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <Receipt className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                            <p>No fuel receipts found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Ticket</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Vehicle</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Driver</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Liters</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Amount</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {filteredReceipts.map((receipt) => (
                                        <tr key={receipt.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                            <td className="px-4 py-3 font-medium">{receipt.ticket_number}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{receipt.plate_number}</span>
                                                    <span className="text-xs text-slate-500">{receipt.vehicle_model}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">{receipt.driver_name}</td>
                                            <td className="px-4 py-3">{receipt.liters} L</td>
                                            <td className="px-4 py-3 font-medium">{formatCurrency(receipt.amount)}</td>
                                            <td className="px-4 py-3">{getStatusBadge(receipt.status)}</td>
                                            <td className="px-4 py-3">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        setSelectedReceipt(receipt);
                                                        setShowReceiptDialog(true);
                                                    }}
                                                    className="text-blue-600 hover:bg-blue-50"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Receipt Detail Dialog */}
            <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Receipt className="h-5 w-5" />
                            Fuel Receipt Details
                        </DialogTitle>
                    </DialogHeader>
                    
                    {selectedReceipt && (
                        <div className="space-y-4">
                            {/* Receipt Image */}
                            {selectedReceipt.receipt_url && (
                                <div className="border rounded-lg overflow-hidden">
                                    <img 
                                        src={selectedReceipt.receipt_url} 
                                        alt="Fuel Receipt"
                                        className="w-full max-h-64 object-contain bg-gray-50"
                                    />
                                </div>
                            )}

                            {/* Receipt Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-slate-500">Ticket Number</p>
                                    <p className="font-medium">{selectedReceipt.ticket_number}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">Status</p>
                                    <p>{getStatusBadge(selectedReceipt.status)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">Vehicle</p>
                                    <p className="font-medium">{selectedReceipt.plate_number}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">Driver</p>
                                    <p className="font-medium">{selectedReceipt.driver_name}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">Liters Loaded</p>
                                    <p className="font-medium">{selectedReceipt.liters} L</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">Amount</p>
                                    <p className="font-medium">{formatCurrency(selectedReceipt.amount)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">Trip Date</p>
                                    <p className="font-medium">{formatDate(selectedReceipt.trip_date)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">Uploaded</p>
                                    <p className="font-medium">{formatDate(selectedReceipt.uploaded_at)}</p>
                                </div>
                            </div>

                            {/* Odometer/GPS Details */}
                            {(selectedReceipt.odometer_start || selectedReceipt.odometer_end || selectedReceipt.gps_distance_km) && (
                                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
                                    <h4 className="font-medium mb-2">Distance Details</h4>
                                    <div className="grid grid-cols-3 gap-4 text-sm">
                                        <div>
                                            <p className="text-slate-500">Method</p>
                                            <p className="font-medium">{selectedReceipt.distance_calculation_method || 'N/A'}</p>
                                        </div>
                                        {selectedReceipt.odometer_start && (
                                            <div>
                                                <p className="text-slate-500">Odometer Start</p>
                                                <p className="font-medium">{selectedReceipt.odometer_start} km</p>
                                            </div>
                                        )}
                                        {selectedReceipt.odometer_end && (
                                            <div>
                                                <p className="text-slate-500">Odometer End</p>
                                                <p className="font-medium">{selectedReceipt.odometer_end} km</p>
                                            </div>
                                        )}
                                        {selectedReceipt.gps_distance_km && (
                                            <div>
                                                <p className="text-slate-500">GPS Distance</p>
                                                <p className="font-medium">{selectedReceipt.gps_distance_km} km</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default FuelReceipts;