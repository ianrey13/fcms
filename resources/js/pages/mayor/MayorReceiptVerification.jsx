// src/pages/mayor/MayorReceiptVerification.jsx
import React, { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { mayorsOfficeAPI } from "../../services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Receipt,
  CheckCircle,
  Loader2,
  RefreshCw,
  Eye,
  Image as ImageIcon,
  User,
  Truck,
  Fuel,
  DollarSign,
  Clock,
  Building2,
  Edit,
  X,
  AlertCircle,
  Calculator,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { format } from "date-fns";

const MayorReceiptVerification = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    invoice_number: "",
    amount_on_receipt: "",
    unit_price: "",
    liters_availed: "",
  });

  // Fetch receipts for verification
  const { 
    data: receipts = [], 
    isLoading, 
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["mayor-receipt-verification"],
    queryFn: async () => {
      const response = await mayorsOfficeAPI.getReceiptsForVerification();
      return response.data?.data || [];
    },
  });

  // Verify receipt mutation
  const verifyMutation = useMutation({
  mutationFn: async ({ receiptId, data }) => {
    const response = await mayorsOfficeAPI.verifyReceipt(receiptId, data);
    return response.data;
  },
  onSuccess: () => {
    toast.success("Receipt verified and updated successfully!");
    queryClient.invalidateQueries({ queryKey: ["mayor-receipt-verification"] });
    setShowReceiptModal(false);
    setSelectedReceipt(null);
    setIsEditing(false);
  },
  onError: (error) => {
    console.error('❌ Verify error:', error);
    console.error('❌ Error response:', error.response);
    
    // ✅ Parse error message properly
    let message = "Failed to verify receipt";
    
    if (error.response?.data?.errors) {
      // Handle validation errors
      const errors = error.response.data.errors;
      if (typeof errors === 'object') {
        const errorMessages = Object.values(errors).flat().join('\n');
        message = errorMessages;
      }
    } else if (error.response?.data?.message) {
      message = error.response.data.message;
    }
    
    toast.error(message);
  },
});


  const handleRefresh = () => {
    refetch();
    toast.success("Receipts refreshed");
  };

  const openReceiptModal = (receipt) => {
    setSelectedReceipt(receipt);
    setEditData({
      invoice_number: receipt.invoice_number || "",
      amount_on_receipt: receipt.amount || "",
      unit_price: receipt.unit_price || "",
      liters_availed: receipt.liters || "",
    });
    setIsEditing(false);
    setShowReceiptModal(true);
  };

  const handleEditToggle = () => {
    if (isEditing) {
      // Cancel edit - revert to original values
      setEditData({
        invoice_number: selectedReceipt?.invoice_number || "",
        amount_on_receipt: selectedReceipt?.amount || "",
        unit_price: selectedReceipt?.unit_price || "",
        liters_availed: selectedReceipt?.liters || "",
      });
    }
    setIsEditing(!isEditing);
  };

  // ✅ Auto-calculate liters when amount or unit price changes
  const handleInputChange = useCallback((field, value) => {
    // If clearing the field, just update and return
    if (value === '' || value === null || value === undefined) {
      setEditData(prev => ({ ...prev, [field]: '' }));
      return;
    }

    const updatedData = { ...editData, [field]: value };
    
    // If amount or unit price changes, recalculate liters
    if (field === 'amount_on_receipt' || field === 'unit_price') {
      const amount = parseFloat(field === 'amount_on_receipt' ? value : updatedData.amount_on_receipt);
      const unitPrice = parseFloat(field === 'unit_price' ? value : updatedData.unit_price);
      
      if (!isNaN(amount) && !isNaN(unitPrice) && amount > 0 && unitPrice > 0) {
        const calculatedLiters = amount / unitPrice;
        updatedData.liters_availed = calculatedLiters.toFixed(2);
      }
    }
    
    setEditData(updatedData);
  }, [editData]);

const handleVerify = () => {
  // ✅ Parse values with proper handling
  const amount = parseFloat(editData.amount_on_receipt) || 0;
  const unitPrice = parseFloat(editData.unit_price) || 0;
  const liters = parseFloat(editData.liters_availed) || 0;

  // ✅ Validate with clear messages
  if (!editData.amount_on_receipt || amount <= 0) {
    toast.error("Please enter a valid amount");
    return;
  }
  if (!editData.unit_price || unitPrice <= 0) {
    toast.error("Please enter a valid unit price");
    return;
  }
  if (!editData.liters_availed || liters <= 0) {
    toast.error("Liters calculation failed. Please check amount and unit price.");
    return;
  }

  // ✅ Log the data being sent
  const payload = {
    invoice_number: editData.invoice_number || null,
    amount_on_receipt: amount,
    unit_price: unitPrice,
    liters_availed: liters,
  };
  
  console.log('📤 Verifying receipt with data:', payload);

  // ✅ Call API with correct parameters
  verifyMutation.mutate({
    receiptId: selectedReceipt.id || selectedReceipt.fuel_receipt_id,
    data: payload,
  });
};
  const filteredReceipts = receipts.filter((receipt) => {
    const search = searchTerm.toLowerCase();
    return (
      receipt.ticket_number?.toLowerCase().includes(search) ||
      receipt.driver_name?.toLowerCase().includes(search) ||
      receipt.plate_number?.toLowerCase().includes(search) ||
      receipt.department_name?.toLowerCase().includes(search)
    );
  });

  const pendingCount = receipts.filter(r => r.status !== "verified").length;
  const verifiedCount = receipts.filter(r => r.status === "verified").length;

  const getStatusBadge = (status) => {
    if (status === "verified") {
      return <Badge className="bg-green-500 text-white">Verified</Badge>;
    }
    if (status === "discrepancy") {
      return <Badge className="bg-red-500 text-white">Discrepancy</Badge>;
    }
    return <Badge className="bg-yellow-500 text-white">Pending</Badge>;
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    return format(new Date(date), "MMM dd, yyyy hh:mm a");
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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
            Receipt Verification
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Verify and edit driver uploaded fuel receipts
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={isFetching}
          className="dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Total Receipts</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-white">{receipts.length}</p>
              </div>
              <Receipt className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Pending Verification</p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{pendingCount}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Verified</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{verifiedCount}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by ticket number, driver, plate, or department..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
        />
      </div>

      {/* Receipts Table */}
      <Card className="dark:bg-slate-800/80 dark:border-slate-700 overflow-hidden">
        <CardHeader className="border-b dark:border-slate-700">
          <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
            <Receipt className="h-5 w-5 text-green-500" />
            Fuel Receipts for Verification
            <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">
              ({filteredReceipts.length} {filteredReceipts.length === 1 ? 'receipt' : 'receipts'})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredReceipts.length === 0 ? (
            <div className="text-center py-16">
              <Receipt className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400">No receipts found</p>
              {searchTerm && (
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Try adjusting your search</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket #</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Liters</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReceipts.map((receipt, index) => (
                    <TableRow 
                      key={receipt.id || receipt.fuel_receipt_id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors animate-fade-in"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <TableCell className="font-mono font-semibold text-slate-900 dark:text-white">
                        {receipt.ticket_number}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3 text-slate-400" />
                          <span className="text-slate-700 dark:text-slate-300">{receipt.driver_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Truck className="h-3 w-3 text-slate-400" />
                          <span className="text-slate-700 dark:text-slate-300">{receipt.plate_number}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3 w-3 text-slate-400" />
                          <span className="text-slate-700 dark:text-slate-300">{receipt.department_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-slate-700 dark:text-slate-300">
                        {receipt.liters} L
                      </TableCell>
                      <TableCell className="font-semibold text-green-600 dark:text-green-400">
                        {formatCurrency(receipt.amount)}
                      </TableCell>
                      <TableCell>{getStatusBadge(receipt.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openReceiptModal(receipt)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-950/30 h-8 w-8 p-0"
                            title="View & Edit Receipt"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {receipt.status !== "verified" && (
                            <Button
                              size="sm"
                              onClick={() => {
                                // Quick verify without editing
                                const quickData = {
                                  invoice_number: receipt.invoice_number || null,
                                  amount_on_receipt: parseFloat(receipt.amount) || 0,
                                  unit_price: parseFloat(receipt.unit_price) || 0,
                                  liters_availed: parseFloat(receipt.liters) || 0,
                                };
                                verifyMutation.mutate({
                                  receiptId: receipt.id || receipt.fuel_receipt_id,
                                  data: quickData,
                                });
                              }}
                              className="bg-green-600 hover:bg-green-700 text-white"
                              disabled={verifyMutation.isPending}
                            >
                              {verifyMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                              ) : (
                                <CheckCircle className="h-4 w-4 mr-1" />
                              )}
                              Verify
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Receipt Detail Modal with Edit Fields */}
      <Dialog open={showReceiptModal} onOpenChange={setShowReceiptModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto dark:bg-slate-800 dark:border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-slate-900 dark:text-white">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-green-600" />
                Fuel Receipt Details
              </div>
              {selectedReceipt?.status !== "verified" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEditToggle}
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  {isEditing ? (
                    <>
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </>
                  ) : (
                    <>
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </>
                  )}
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedReceipt && (
            <div className="space-y-4">
              {/* Receipt Image */}
              {selectedReceipt.receipt_url ? (
                <div className="border rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900/50">
                  <img
                    src={selectedReceipt.receipt_url}
                    alt="Fuel Receipt"
                    className="w-full max-h-64 object-contain"
                    onError={(e) => {
                      e.target.src = "/placeholder-receipt.png";
                      e.target.alt = "Receipt image not available";
                    }}
                  />
                </div>
              ) : (
                <div className="border rounded-xl p-8 text-center bg-slate-50 dark:bg-slate-900/50">
                  <ImageIcon className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-500 dark:text-slate-400">No receipt image uploaded</p>
                </div>
              )}

              {/* Receipt Details Grid with Edit Fields */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                {/* Ticket Number - Read Only */}
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Ticket Number</p>
                  <p className="font-medium text-slate-900 dark:text-white">{selectedReceipt.ticket_number}</p>
                </div>

                {/* Driver - Read Only */}
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Driver</p>
                  <p className="font-medium text-slate-900 dark:text-white">{selectedReceipt.driver_name}</p>
                </div>

                {/* Vehicle - Read Only */}
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Vehicle</p>
                  <p className="font-medium text-slate-900 dark:text-white">{selectedReceipt.plate_number}</p>
                </div>

                {/* Department - Read Only */}
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Department</p>
                  <p className="font-medium text-slate-900 dark:text-white">{selectedReceipt.department_name}</p>
                </div>

                {/* Fuel Type - Read Only */}
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Fuel Type</p>
                  <p className="font-medium text-slate-900 dark:text-white">{selectedReceipt.fuel_type || "N/A"}</p>
                </div>

                {/* Trip Date - Read Only */}
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Trip Date</p>
                  <p className="font-medium text-slate-900 dark:text-white">{formatDate(selectedReceipt.trip_date)}</p>
                </div>

                {/* Invoice Number - Editable */}
                <div className="col-span-1">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Invoice Number</p>
                  {isEditing ? (
                    <Input
                      value={editData.invoice_number}
                      onChange={(e) => handleInputChange('invoice_number', e.target.value)}
                      className="mt-1 dark:bg-slate-900 dark:border-slate-700"
                      placeholder="Enter invoice number"
                    />
                  ) : (
                    <p className="font-medium text-slate-900 dark:text-white">
                      {editData.invoice_number || selectedReceipt.invoice_number || "N/A"}
                    </p>
                  )}
                </div>

                {/* ✅ AMOUNT - Editable (Manual Entry) */}
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Amount (₱)</p>
                  {isEditing ? (
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">₱</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editData.amount_on_receipt}
                        onChange={(e) => handleInputChange('amount_on_receipt', e.target.value)}
                        className="pl-7 dark:bg-slate-900 dark:border-slate-700"
                        placeholder="0.00"
                      />
                    </div>
                  ) : (
                    <p className="font-semibold text-green-600 dark:text-green-400">
                      {formatCurrency(editData.amount_on_receipt || selectedReceipt.amount)}
                    </p>
                  )}
                </div>

                {/* ✅ UNIT PRICE - Editable (Manual Entry) */}
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Unit Price (₱/L)</p>
                  {isEditing ? (
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">₱</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editData.unit_price}
                        onChange={(e) => handleInputChange('unit_price', e.target.value)}
                        className="pl-7 dark:bg-slate-900 dark:border-slate-700"
                        placeholder="0.00"
                      />
                    </div>
                  ) : (
                    <p className="font-medium text-slate-900 dark:text-white">
                      {formatCurrency(editData.unit_price || selectedReceipt.unit_price)}
                    </p>
                  )}
                </div>

                {/* ✅ LITERS - Auto-Calculated */}
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Liters (L)
                    {isEditing && (
                      <span className="ml-1 text-blue-500">
                        <Calculator className="h-3 w-3 inline" />
                      </span>
                    )}
                  </p>
                  {isEditing ? (
                    <>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editData.liters_availed}
                        className="mt-1 dark:bg-slate-900 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                        placeholder="Auto-calculated"
                        disabled={true}
                      />
                      {editData.amount_on_receipt && editData.unit_price && (
                        <p className="text-xs text-slate-400 mt-1">
                          Calculated: {formatCurrency(parseFloat(editData.amount_on_receipt) / parseFloat(editData.unit_price))} L
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="font-medium text-slate-900 dark:text-white">
                      {editData.liters_availed || selectedReceipt.liters} L
                    </p>
                  )}
                </div>
              </div>

              {/* Distance Details - Read Only */}
              {selectedReceipt.gps_distance_km && (
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4">
                  <h4 className="text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">Distance Details</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Method</p>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {selectedReceipt.distance_calculation_method || "N/A"}
                      </p>
                    </div>
                    {selectedReceipt.gps_distance_km && (
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">GPS Distance</p>
                        <p className="font-medium text-slate-900 dark:text-white">{selectedReceipt.gps_distance_km} km</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Status & Actions */}
              <div className="flex flex-wrap items-center justify-between pt-4 border-t dark:border-slate-700 gap-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Status:</p>
                  {getStatusBadge(selectedReceipt.status)}
                  {isEditing && (
                    <Badge variant="outline" className="border-blue-500 text-blue-600 dark:text-blue-400">
                      <Edit className="h-3 w-3 mr-1" />
                      Editing
                    </Badge>
                  )}
                </div>

                <div className="flex gap-2">
                  {isEditing && (
                    <Button
                      variant="outline"
                      onClick={handleEditToggle}
                      className="dark:border-slate-600"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  )}
                  
                  {selectedReceipt.status !== "verified" && (
                    <Button
                      onClick={handleVerify}
                      className="bg-green-600 hover:bg-green-700"
                      disabled={verifyMutation.isPending}
                    >
                      {verifyMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          {isEditing ? 'Saving & Verifying...' : 'Verifying...'}
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          {isEditing ? 'Save & Verify' : 'Verify Receipt'}
                        </>
                      )}
                    </Button>
                  )}
                  
                  {selectedReceipt.status === "verified" && (
                    <Button variant="outline" disabled className="dark:border-slate-700 dark:text-slate-400">
                      <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                      Already Verified
                    </Button>
                  )}
                </div>
              </div>

              {/* Edit Help Text */}
              {isEditing && (
                <div className="text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg">
                  <AlertCircle className="h-4 w-4 inline mr-1 text-blue-500" />
                  Enter the <strong>Amount (₱)</strong> and <strong>Unit Price (₱/L)</strong>. 
                  Liters will be auto-calculated using: <strong>Liters = Amount ÷ Unit Price</strong>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MayorReceiptVerification;