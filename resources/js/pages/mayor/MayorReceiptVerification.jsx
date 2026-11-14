// src/pages/mayor/MayorReceiptVerification.jsx
import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { mayorsOfficeAPI } from "../../services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Search, Receipt, CheckCircle, Loader2, AlertTriangle, Image as ImageIcon, 
  User, Truck, Clock, Building2, Info, FileText, RefreshCw, 
  ChevronRight, ChevronLeft, X, Zap, Scale
} from "lucide-react";
import { toast } from "react-hot-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// ============================================
// HELPERS
// ============================================
const formatDateShort = (date) => {
  if (!date) return "N/A";
  try { return format(new Date(date), "MMM dd, yyyy"); } catch { return "N/A"; }
};

const formatCurrency = (amount) => {
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount)) return "₱0.00";
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(numAmount);
};

const getReceiptImageUrls = (receipt) => {
    let url = receipt?.receipt_url || receipt?.receipt_photo_path || null;
    if (!url) return [];
    const baseUrl = window.location.origin;
    const urlsList = [];
    if (url.startsWith('http')) {
        urlsList.push(url);
        const filename = url.split('/').pop();
        if (filename) { urlsList.push(`${baseUrl}/receipts/${filename}`); urlsList.push(`${baseUrl}/storage/receipts/${filename}`); }
        return [...new Set(urlsList)];
    }
    const filename = url.split('/').pop();
    if (!filename) return [];
    urlsList.push(`${baseUrl}/receipts/${filename}`);
    urlsList.push(`${baseUrl}/storage/receipts/${filename}`);
    if (url.startsWith('/')) urlsList.push(`${baseUrl}${url}`);
    else if (!url.startsWith('receipts/') && !url.startsWith('storage/')) urlsList.push(`${baseUrl}/${url}`);
    else if (url.startsWith('receipts/')) urlsList.push(`${baseUrl}/${url}`);
    return [...new Set(urlsList)];
};

// ============================================
// COMPONENTS
// ============================================
const ReceiptImage = ({ receipt }) => {
    const [imageError, setImageError] = useState(false);
    const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
    const [imageLoaded, setImageLoaded] = useState(false);
    const urls = useMemo(() => getReceiptImageUrls(receipt), [receipt]);

    useEffect(() => { setImageError(false); setCurrentUrlIndex(0); setImageLoaded(false); }, [receipt]);

    if (urls.length === 0) return (
        <div className="w-full h-full min-h-[300px] flex flex-col items-center justify-center bg-[#0b101c] rounded-xl border border-slate-700">
            <ImageIcon className="h-10 w-10 text-slate-600 mb-2" />
            <p className="text-slate-400 text-sm">No receipt image</p>
        </div>
    );

    const currentUrl = urls[currentUrlIndex];
    const hasMoreUrls = currentUrlIndex < urls.length - 1;
    const handleImageError = () => { if (hasMoreUrls) setCurrentUrlIndex(prev => prev + 1); else setImageError(true); };

    if (imageError) return (
        <div className="w-full h-full min-h-[300px] flex flex-col items-center justify-center bg-[#0b101c] rounded-xl border border-slate-700">
            <AlertTriangle className="h-10 w-10 text-red-500 mb-2" />
            <p className="text-red-400 text-sm">Cannot load image</p>
        </div>
    );

    return (
        <div className="relative w-full h-full min-h-[300px] bg-[#0b101c] rounded-xl border border-slate-700 overflow-hidden flex items-center justify-center">
            {!imageLoaded && <Loader2 className="absolute h-8 w-8 text-blue-500 animate-spin" />}
            <img src={currentUrl} alt="Receipt" className={cn("max-w-full max-h-[400px] object-contain transition-opacity duration-300", imageLoaded ? "opacity-100" : "opacity-0")} onError={handleImageError} onLoad={() => setImageLoaded(true)} />
        </div>
    );
};

const StatusPill = ({ status, discrepancy }) => {
    if (status === "verified") return (<span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 w-fit"><CheckCircle className="h-3 w-3" /> Verified</span>);
    if (discrepancy) return (<span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 w-fit"><Scale className="h-3 w-3" /> With Discrepancy</span>);
    return (<span className="bg-orange-500/20 text-orange-400 border border-orange-500/30 px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 w-fit"><Clock className="h-3 w-3" /> Pending</span>);
};

// ============================================
// MAIN COMPONENT
// ============================================
const MayorReceiptVerification = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const [editData, setEditData] = useState({ invoice_number: "", unit_price: "", amount_on_receipt: "", remarks: "" });

  const { data: pendingReceipts = [], isLoading: loadingPending } = useQuery({
    queryKey: ["mayor-receipt-verification", "pending"],
    queryFn: async () => (await mayorsOfficeAPI.getReceiptsForVerification()).data?.data || [],
  });

  const { data: verifiedReceipts = [], isLoading: loadingVerified } = useQuery({
    queryKey: ["mayor-receipt-verification", "verified"],
    queryFn: async () => (await mayorsOfficeAPI.getVerifiedReceipts()).data?.data || [],
  });

  useAutoRefresh(["mayor-trip-updated", "new-notification", "trip-completed"], () => {
    queryClient.invalidateQueries({ queryKey: ["mayor-receipt-verification"] });
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ receiptId, data }) => await mayorsOfficeAPI.verifyReceipt(receiptId, data),
    onSuccess: () => {
      toast.success("Receipt processed successfully!");
      queryClient.invalidateQueries({ queryKey: ["mayor-receipt-verification"] });
      const nextPending = pendingReceipts.find(r => r.id !== selectedReceipt?.id);
      if (nextPending && activeTab === "pending") handleSelectReceipt(nextPending);
      else { setSelectedReceipt(null); setActiveTab("verified"); }
    },
    onError: (error) => toast.error(error.response?.data?.message || "Failed to verify receipt"),
  });

  const handleSelectReceipt = (receipt) => {
    setSelectedReceipt(receipt);
    setEditData({
      invoice_number: receipt.invoice_number || "",
      unit_price: receipt.unit_price || "",
      amount_on_receipt: receipt.amount || "",
      remarks: receipt.remarks || "",
    });
  };

  const handleInputChange = (field, value) => setEditData(prev => ({ ...prev, [field]: value }));

  const handleVerify = (isDiscrepancy = false) => {
    if (!editData.invoice_number) return toast.error("Invoice Number is required");
    if (!editData.amount_on_receipt) return toast.error("Amount is required");
    
    // Kung discrepancy, required ang remarks
    if (isDiscrepancy && !editData.remarks) return toast.error("Please provide remarks for the discrepancy.");

    verifyMutation.mutate({
      receiptId: selectedReceipt.id || selectedReceipt.fuel_receipt_id,
      data: {
        invoice_number: editData.invoice_number,
        unit_price: parseFloat(editData.unit_price) || null,
        amount_on_receipt: parseFloat(editData.amount_on_receipt) || 0,
        remarks: editData.remarks,
        status: isDiscrepancy ? 'discrepancy' : 'verified',
      }
    });
  };

  // ✅ FILTER LOGIC PARA SA TABS (Base sa Amount Difference)
  const filteredList = useMemo(() => {
    let list = [];
    
    if (activeTab === "pending") {
      list = pendingReceipts;
    } else if (activeTab === "verified") {
      // Verified tab: Verified status ug WALAY discrepancy (Variance = 0)
      list = verifiedReceipts.filter(r => 
        r.status === 'verified' && (parseFloat(r.amount) - parseFloat(r.amount_released) === 0)
      );
    } else if (activeTab === "discrepancy") {
      // Discrepancy tab: Verified status PERO NAAY discrepancy (Variance != 0) o kaha gi-flag as discrepancy
      list = verifiedReceipts.filter(r => 
        r.status === 'discrepancy' || (parseFloat(r.amount) - parseFloat(r.amount_released) !== 0)
      );
    }

    if (!searchTerm) return list;
    const q = searchTerm.toLowerCase();
    return list.filter(r => 
      r.ticket_number?.toLowerCase().includes(q) || r.plate_number?.toLowerCase().includes(q) || r.department_name?.toLowerCase().includes(q)
    );
  }, [activeTab, pendingReceipts, verifiedReceipts, searchTerm]);

  // ✅ COUNTS PARA SA TABS
  const counts = {
    pending: pendingReceipts.length,
    verified: verifiedReceipts.filter(r => r.status === 'verified' && (parseFloat(r.amount) - parseFloat(r.amount_released) === 0)).length,
    discrepancy: verifiedReceipts.filter(r => r.status === 'discrepancy' || (parseFloat(r.amount) - parseFloat(r.amount_released) !== 0)).length,
  };

  const releasedAmount = parseFloat(selectedReceipt?.amount_released) || 0;
  const receiptAmount = parseFloat(editData.amount_on_receipt) || 0;
  const difference = receiptAmount - releasedAmount;

  return (
    <div className="min-h-screen bg-[#090e1a] p-4 md:p-6 font-sans text-slate-200 flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.4)]"><Receipt className="h-8 w-8 text-white" /></div>
          <div>
            <h1 className="text-3xl font-bold text-white">Fuel Receipt Verification</h1>
            <p className="text-slate-400 mt-1">Review and encode fuel receipt details from submitted trip tickets.</p>
          </div>
        </div>
        <Button onClick={() => queryClient.invalidateQueries()} variant="outline" className="border-slate-700 bg-[#121829] hover:bg-slate-800 text-slate-300 rounded-xl h-10 px-4">
          <RefreshCw className={cn("h-4 w-4 mr-2", (loadingPending || loadingVerified) && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1">
        {/* LEFT PANEL: List */}
        <div className="w-full lg:w-[55%] flex flex-col gap-4">
          <div className="flex gap-2">
            <button onClick={() => setActiveTab("pending")} className={cn("flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border transition-all text-sm font-semibold", activeTab === "pending" ? "bg-blue-600 border-blue-500 text-white" : "bg-[#121829] border-slate-800 text-slate-400 hover:bg-[#1a2235]")}><Clock className="h-4 w-4" /> Pending ({counts.pending})</button>
            <button onClick={() => setActiveTab("verified")} className={cn("flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border transition-all text-sm font-semibold", activeTab === "verified" ? "bg-emerald-600 border-emerald-500 text-white" : "bg-[#121829] border-slate-800 text-slate-400 hover:bg-[#1a2235]")}><CheckCircle className="h-4 w-4" /> Verified ({counts.verified})</button>
            <button onClick={() => setActiveTab("discrepancy")} className={cn("flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border transition-all text-sm font-semibold", activeTab === "discrepancy" ? "bg-amber-600 border-amber-500 text-white" : "bg-[#121829] border-slate-800 text-slate-400 hover:bg-[#1a2235]")}><Scale className="h-4 w-4" /> With Discrepancy ({counts.discrepancy})</button>
          </div>

          <div className="bg-[#121829] border border-slate-800 rounded-2xl flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input placeholder="Search by Ticket No., Department, or Plate..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 bg-[#0b101c] border-slate-700 text-white h-10 rounded-xl" />
              </div>
            </div>
            
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-[#0b101c] text-slate-500">
                  {activeTab === "discrepancy" ? (
                    <tr>
                      <th className="px-4 py-3 font-medium">Trip Ticket No.</th>
                      <th className="px-4 py-3 font-medium">Department</th>
                      <th className="px-4 py-3 font-medium">Vehicle</th>
                      <th className="px-4 py-3 font-medium text-right">Amount Released</th>
                      <th className="px-4 py-3 font-medium text-right">Actual Paid</th>
                      <th className="px-4 py-3 font-medium text-right">Variance</th>
                    </tr>
                  ) : (
                    <tr>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Trip Ticket No.</th>
                      <th className="px-4 py-3 font-medium">Department</th>
                      <th className="px-4 py-3 font-medium">Vehicle</th>
                      <th className="px-4 py-3 font-medium">Purpose</th>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {filteredList.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-10 text-slate-500">No records found.</td></tr>
                  ) : filteredList.map((r) => {
                    const isSelected = selectedReceipt?.id === r.id || selectedReceipt?.fuel_receipt_id === r.fuel_receipt_id;
                    const variance = parseFloat(r.amount) - parseFloat(r.amount_released);
                    
                    return (
                      <tr key={r.id || r.fuel_receipt_id} onClick={() => handleSelectReceipt(r)} className={cn("cursor-pointer transition-colors", isSelected ? "bg-blue-600/20" : "hover:bg-[#1a2235]")}>
                        {activeTab === "discrepancy" ? (
                          <>
                            <td className="px-4 py-4 font-mono text-white">{r.ticket_number}</td>
                            <td className="px-4 py-4">{r.department_name}</td>
                            <td className="px-4 py-4">{r.plate_number}</td>
                            <td className="px-4 py-4 text-right">{formatCurrency(r.amount_released)}</td>
                            <td className="px-4 py-4 text-right text-amber-400 font-bold">{formatCurrency(r.amount)}</td>
                            <td className={cn("px-4 py-4 text-right font-bold", variance !== 0 ? "text-red-400" : "text-slate-400")}>
                              {formatCurrency(variance)}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-4 whitespace-nowrap">{formatDateShort(r.trip_date)}</td>
                            <td className="px-4 py-4 font-mono text-white">{r.ticket_number}</td>
                            <td className="px-4 py-4">{r.department_name}</td>
                            <td className="px-4 py-4">{r.plate_number}</td>
                            <td className="px-4 py-4 truncate max-w-[120px]" title={r.purpose}>{r.purpose || "N/A"}</td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Details */}
        <div className="w-full lg:w-[45%] bg-[#121829] border border-slate-800 rounded-2xl shadow-lg flex flex-col relative">
          {!selectedReceipt ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
              <FileText className="h-12 w-12 mb-3 opacity-50" />
              <p>Select a receipt from the list to view details.</p>
            </div>
          ) : (
            <>
              <div className="p-5 border-b border-slate-800 flex justify-between items-center">
                <h2 className="text-lg font-bold text-white flex items-center gap-2"><FileText className="h-5 w-5 text-blue-500" /> Receipt Details</h2>
                <StatusPill status={selectedReceipt.status} discrepancy={difference !== 0 && selectedReceipt.status === 'pending'} />
              </div>

              <div className="p-5 flex-1 overflow-y-auto space-y-5">
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-slate-500">Trip Ticket No.</span>
                    <span className="col-span-2 text-white font-mono">: {selectedReceipt.ticket_number}</span>
                    <span className="text-slate-500">Department</span>
                    <span className="col-span-2 text-white">: {selectedReceipt.department_name}</span>
                    <span className="text-slate-500">Vehicle</span>
                    <span className="col-span-2 text-white">: {selectedReceipt.plate_number}</span>
                    <span className="text-slate-500">Driver</span>
                    <span className="col-span-2 text-white flex items-center gap-2"><User className="h-3 w-3 text-slate-400"/> {selectedReceipt.driver_name || "N/A"}</span>
                    <span className="text-slate-500">Destination</span>
                    <span className="col-span-2 text-white flex items-center gap-2"><Truck className="h-3 w-3 text-slate-400"/> {selectedReceipt.destination || "N/A"}</span>
                    <span className="text-slate-500">Purpose</span>
                    <span className="col-span-2 text-white flex items-center gap-2"><Info className="h-3 w-3 text-slate-400"/> {selectedReceipt.purpose || "N/A"}</span>
                  </div>
                </div>

                <div className="relative rounded-xl border border-slate-700 overflow-hidden bg-[#0b101c]">
                  <ReceiptImage receipt={selectedReceipt} />
                  <button className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/80 rounded-lg text-white transition-colors"><ImageIcon className="h-4 w-4" /></button>
                </div>

                <div className="space-y-4 pt-2">
                  <h3 className="font-bold text-white flex items-center gap-2 text-sm"><FileText className="h-4 w-4 text-blue-500" /> Fuel Receipt Amounts</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-slate-400">Invoice Number <span className="text-red-500">*</span></Label>
                      <Input value={editData.invoice_number} onChange={(e) => handleInputChange('invoice_number', e.target.value)} className="bg-[#0b101c] border-slate-700 text-white mt-1 h-10" placeholder="e.g. 12345678" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-400">Unit Price (₱/L) <span className="text-red-500">*</span></Label>
                      <Input type="number" value={editData.unit_price} onChange={(e) => handleInputChange('unit_price', e.target.value)} className="bg-[#0b101c] border-slate-700 text-white mt-1 h-10" placeholder="0.00" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-slate-400">Amount Based on Receipt (₱) <span className="text-red-500">*</span></Label>
                      <Input type="number" value={editData.amount_on_receipt} onChange={(e) => handleInputChange('amount_on_receipt', e.target.value)} className="bg-[#0b101c] border-slate-700 text-white mt-1 h-10" placeholder="0.00" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-400">Amount Released</Label>
                      <div className="bg-blue-600/10 border border-blue-900/50 rounded-lg mt-1 h-10 px-3 flex items-center font-bold text-blue-400">{formatCurrency(releasedAmount)}</div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400 flex justify-between"><span>Difference</span></Label>
                    <div className={cn("mt-1 h-10 px-3 flex items-center font-bold rounded-lg border", difference !== 0 ? "bg-amber-600/10 border-amber-900/50 text-amber-400" : "bg-emerald-600/10 border-emerald-900/50 text-emerald-400")}>
                      {formatCurrency(difference)}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">Remarks (Optional)</Label>
                    <Textarea value={editData.remarks} onChange={(e) => handleInputChange('remarks', e.target.value)} className="bg-[#0b101c] border-slate-700 text-white mt-1 text-sm resize-none h-16" placeholder="e.g. Fuel amount higher than released amount." />
                  </div>
                </div>
              </div>

              <div className="p-5 border-t border-slate-800 flex gap-3">
                <Button onClick={() => handleVerify(false)} disabled={verifyMutation.isPending || selectedReceipt.status !== 'pending'} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 rounded-xl"><CheckCircle className="h-5 w-5 mr-2" /> Mark as Verified</Button>
                <Button onClick={() => handleVerify(true)} disabled={verifyMutation.isPending || selectedReceipt.status !== 'pending'} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold h-12 rounded-xl"><Scale className="h-5 w-5 mr-2" /> Mark as Verified (with Discrepancy)</Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MayorReceiptVerification;