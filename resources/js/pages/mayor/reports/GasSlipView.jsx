// src/pages/mayor/reports/GasSlipView.jsx
// Official LGU Laguindingan Gas Slip — used by MayorPending, MayorApproved, and anywhere else

import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import municipalLogo from "../../../assets/img/465557735_866766092283213_5502511239926698684_n.svg";
import bagongPilipinasLogo from "../../../assets/img/Bagong_Pilipinas_Logo.svg.png";

// Safe amount conversion
const safeAmount = (amount) => {
    if (typeof amount === "number") return amount;
    if (typeof amount === "string") return parseFloat(amount) || 0;
    return 0;
};

const GasSlipView = ({ ticket, onClose }) => {
    if (!ticket) return null;

    const driverName =
        ticket.driver_name || ticket.driver?.name || "N/A";
    const fuelType = (ticket.vehicle?.fuel_type || "Diesel").toUpperCase();
    const amount = safeAmount(ticket.amount_released);
    const liters = amount > 0 ? (amount / 58).toFixed(2) : "0.00";

    const gasSlipData = {
        control_number:
            ticket.ticket_number || ticket.trip_ticket_number || "N/A",
        driver_name: driverName,
        vehicle_plate:
            ticket.vehicle?.plate_number || ticket.vehicle_plate || "N/A",
        vehicle_model: ticket.vehicle?.vehicle_model || "",
        date: new Date(
            ticket.created_at || ticket.trip_date || Date.now()
        ).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
        }),
        purpose: (ticket.purpose || "Official Trip").toUpperCase(),
        destination: (ticket.destination || "N/A").toUpperCase(),
        fuel_type: fuelType,
        liters: liters + " L",
        amount: amount,
        mayor_name: "HON. ROY MACUA",
        department:
            ticket.department_name || ticket.department?.name || "N/A",
    };

    // ✅ FIXED: Print ONLY the gas slip content
    const handlePrint = () => {
        const printWindow = window.open("", "_blank", "width=600,height=800");
        if (!printWindow) {
            alert("Please allow popups for this site");
            return;
        }

        const content = document.getElementById("gas-slip-content").innerHTML;

        printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Gas Slip - ${gasSlipData.control_number}</title>
          <meta charset="UTF-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Times New Roman', 'Georgia', 'Serif';
              background: white;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              padding: 20px;
            }
            .gas-slip-container {
              width: 100%;
              max-width: 550px;
              background: white;
              margin: 0 auto;
              box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
            .header-banner {
              background: linear-gradient(135deg, #2d5a3f 0%, #4a7c59 50%, #2d5a3f 100%);
              padding: 12px 15px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-bottom: 2px solid #1a1a1a;
            }
            .logo-left, .logo-right {
              width: 55px;
              height: 55px;
              background: white;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
              border: 2px solid #ffd700;
            }
            .logo-left img, .logo-right img { width: 100%; height: 100%; object-fit: contain; }
            .header-text { text-align: center; flex: 1; color: white; }
            .header-text .republic { font-size: 9px; letter-spacing: 1px; margin-bottom: 2px; }
            .header-text .province { font-size: 10px; font-weight: bold; margin-bottom: 1px; }
            .header-text .municipality { font-size: 11px; font-weight: bold; margin-bottom: 1px; }
            .header-text .office { font-size: 10px; font-weight: bold; letter-spacing: 1px; }
            .title-box { background: #d4c5b5; border-bottom: 2px solid #1a1a1a; text-align: center; padding: 8px; }
            .title-box h1 { font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #1a1a1a; margin: 0; }
            .form-content { padding: 20px 25px; }
            .form-row { display: flex; align-items: flex-end; margin-bottom: 15px; gap: 10px; }
            .form-row.full { flex-direction: column; align-items: flex-start; }
            .form-label { font-size: 12px; font-weight: bold; color: #1a1a1a; min-width: 120px; text-transform: capitalize; }
            .form-line { flex: 1; border-bottom: 1px solid #1a1a1a; min-height: 20px; font-size: 12px; padding: 0 5px; text-align: center; font-weight: 600; }
            .form-line.full-width { width: 100%; margin-top: 5px; text-align: left; padding-left: 10px; }
            .two-col { display: flex; gap: 20px; width: 100%; }
            .two-col .col { flex: 1; display: flex; align-items: flex-end; gap: 8px; }
            .fuel-section { margin: 20px 0; }
            .fuel-header { display: flex; text-align: center; margin-bottom: 8px; }
            .fuel-header-col { flex: 1; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
            .fuel-row { display: flex; align-items: center; margin-bottom: 8px; }
            .fuel-type { flex: 1; font-size: 11px; font-style: italic; }
            .fuel-liters, .fuel-amount { flex: 1; border-bottom: 1px solid #1a1a1a; min-height: 18px; text-align: center; font-size: 11px; font-weight: 600; }
            .control-row { display: flex; align-items: center; margin-top: 15px; gap: 10px; }
            .control-number-box { flex: 1; border-bottom: 1px solid #1a1a1a; text-align: center; font-size: 12px; font-weight: bold; letter-spacing: 1px; padding: 2px 0; }
            .signature-section { margin-top: 30px; text-align: center; padding: 0 20px; }
            .signature-line { border-top: 1px solid #1a1a1a; width: 250px; margin: 0 auto 8px auto; padding-top: 8px; }
            .mayor-name { font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
            .mayor-title { font-size: 11px; font-style: italic; margin-top: 3px; }
            @media print {
              body { padding: 0; margin: 0; }
              .gas-slip-container { box-shadow: none; }
            }
          </style>
        </head>
        <body>
          ${content}
        </body>
      </html>
    `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-[550px] w-full max-h-[95vh] overflow-y-auto animate-scale-in">
                {/* Gas Slip Content — ID for print */}
                <div id="gas-slip-content">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-[#2d5a3f] via-[#4a7c59] to-[#2d5a3f] px-4 py-3 flex items-center justify-between border-b-2 border-gray-800">
                            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center overflow-hidden border-2 border-yellow-500 shadow-md">
                                <img
                                    src={municipalLogo}
                                    alt="Municipal Logo"
                                    className="w-full h-full object-contain p-1"
                                />
                            </div>
                            <div className="text-center flex-1 text-white">
                                <div className="text-[9px] tracking-wider mb-0.5">
                                    REPUBLIC OF THE PHILIPPINES
                                </div>
                                <div className="text-[10px] font-bold">
                                    PROVINCE OF MISAMIS ORIENTAL
                                </div>
                                <div className="text-[11px] font-bold">
                                    MUNICIPALITY OF LAGUINDINGAN
                                </div>
                                <div className="text-[10px] font-bold tracking-wider">
                                    GENERAL SERVICES OFFICE
                                </div>
                            </div>
                            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center overflow-hidden border-2 border-yellow-500 shadow-md">
                                <img
                                    src={bagongPilipinasLogo}
                                    alt="Bagong Pilipinas Logo"
                                    className="w-full h-full object-contain p-1"
                                />
                            </div>
                        </div>

                        {/* Title */}
                        <div className="bg-[#d4c5b5] dark:bg-amber-800/50 border-b-2 border-gray-800 text-center py-2">
                            <h1 className="text-2xl font-bold tracking-widest text-gray-800 dark:text-white">
                                GAS SLIP
                            </h1>
                        </div>

                        {/* Content */}
                        <div className="px-6 py-5 font-serif dark:text-slate-200">
                            <div className="flex items-end mb-4 gap-3">
                                <span className="text-sm font-bold text-gray-800 dark:text-slate-300 min-w-[120px]">
                                    Driver
                                </span>
                                <div className="flex-1 border-b border-gray-800 dark:border-slate-600 text-sm font-semibold text-center pb-0.5">
                                    {gasSlipData.driver_name}
                                </div>
                            </div>
                            <div className="flex gap-6 mb-4">
                                <div className="flex-1 flex items-end gap-2">
                                    <span className="text-sm font-bold text-gray-800 dark:text-slate-300 whitespace-nowrap">
                                        Vehicle/Plate #
                                    </span>
                                    <div className="flex-1 border-b border-gray-800 dark:border-slate-600 text-sm font-semibold text-center pb-0.5">
                                        {gasSlipData.vehicle_plate}
                                    </div>
                                </div>
                                <div className="flex-1 flex items-end gap-2">
                                    <span className="text-sm font-bold text-gray-800 dark:text-slate-300">
                                        Date
                                    </span>
                                    <div className="flex-1 border-b border-gray-800 dark:border-slate-600 text-sm font-semibold text-center pb-0.5">
                                        {gasSlipData.date}
                                    </div>
                                </div>
                            </div>
                            <div className="mb-4">
                                <span className="text-sm font-bold text-gray-800 dark:text-slate-300">
                                    Purpose
                                </span>
                                <div className="w-full border-b border-gray-800 dark:border-slate-600 text-sm font-semibold uppercase mt-1 pb-0.5 pl-2">
                                    {gasSlipData.purpose}
                                </div>
                            </div>
                            <div className="mb-5">
                                <span className="text-sm font-bold text-gray-800 dark:text-slate-300">
                                    Destination
                                </span>
                                <div className="w-full border-b border-gray-800 dark:border-slate-600 text-sm font-semibold uppercase mt-1 pb-0.5 pl-2">
                                    {gasSlipData.destination}
                                </div>
                            </div>
                            <div className="mb-4">
                                <div className="flex text-center mb-2">
                                    <div className="flex-1 text-sm font-bold uppercase tracking-wide text-gray-800 dark:text-slate-300">
                                        FUEL
                                    </div>
                                    <div className="flex-1 text-sm font-bold uppercase tracking-wide text-gray-800 dark:text-slate-300">
                                        LITERS
                                    </div>
                                    <div className="flex-1 text-sm font-bold uppercase tracking-wide text-gray-800 dark:text-slate-300">
                                        AMOUNT
                                    </div>
                                </div>
                                <div className="flex items-center mb-2">
                                    <div className="flex-1 text-sm italic text-gray-600 dark:text-slate-400">
                                        Premium/UNLEADED
                                    </div>
                                    <div className="flex-1 border-b border-gray-800 dark:border-slate-600 text-center text-sm font-semibold pb-0.5">
                                        {gasSlipData.fuel_type === "PREMIUM" ||
                                        gasSlipData.fuel_type === "UNLEADED"
                                            ? gasSlipData.liters
                                            : ""}
                                    </div>
                                    <div className="flex-1 border-b border-gray-800 dark:border-slate-600 text-center text-sm font-semibold pb-0.5 text-green-700 dark:text-green-400">
                                        {gasSlipData.fuel_type === "PREMIUM" ||
                                        gasSlipData.fuel_type === "UNLEADED"
                                            ? `₱${gasSlipData.amount.toLocaleString()}`
                                            : ""}
                                    </div>
                                </div>
                                <div className="flex items-center mb-2">
                                    <div className="flex-1 text-sm italic text-gray-600 dark:text-slate-400">
                                        Diesel
                                    </div>
                                    <div className="flex-1 border-b border-gray-800 dark:border-slate-600 text-center text-sm font-semibold pb-0.5">
                                        {gasSlipData.fuel_type === "DIESEL"
                                            ? gasSlipData.liters
                                            : ""}
                                    </div>
                                    <div className="flex-1 border-b border-gray-800 dark:border-slate-600 text-center text-sm font-semibold pb-0.5 text-green-700 dark:text-green-400">
                                        {gasSlipData.fuel_type === "DIESEL"
                                            ? `₱${gasSlipData.amount.toLocaleString()}`
                                            : ""}
                                    </div>
                                </div>
                                <div className="flex items-center mb-2">
                                    <div className="flex-1 text-sm italic text-gray-600 dark:text-slate-400">
                                        Engine Oil
                                    </div>
                                    <div className="flex-1 border-b border-gray-800 dark:border-slate-600 text-center text-sm pb-0.5">
                                        -
                                    </div>
                                    <div className="flex-1 border-b border-gray-800 dark:border-slate-600 text-center text-sm pb-0.5"></div>
                                </div>
                                <div className="flex items-center">
                                    <div className="flex-1 text-sm italic text-gray-600 dark:text-slate-400">
                                        Brake Fluid
                                    </div>
                                    <div className="flex-1 border-b border-gray-800 dark:border-slate-600 text-center text-sm pb-0.5">
                                        -
                                    </div>
                                    <div className="flex-1 border-b border-gray-800 dark:border-slate-600 text-center text-sm pb-0.5"></div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 mt-5">
                                <span className="text-sm font-bold text-gray-800 dark:text-slate-300">
                                    Control No.
                                </span>
                                <div className="flex-1 border-b border-gray-800 dark:border-slate-600 text-center text-sm font-bold tracking-wider pb-0.5">
                                    {gasSlipData.control_number}
                                </div>
                            </div>
                        </div>

                        {/* Signature */}
                        <div className="text-center pt-6 pb-8 px-8">
                            <div className="border-t border-gray-800 dark:border-slate-600 w-64 mx-auto pt-3 mb-2"></div>
                            <div className="text-sm font-bold uppercase tracking-wide text-gray-800 dark:text-white">
                                HON. ROY MACUA
                            </div>
                            <div className="text-xs italic text-gray-600 dark:text-slate-400 mt-1">
                                Municipal Mayor
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer buttons */}
                <div className="flex gap-3 p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="flex-1 dark:border-slate-700 dark:text-slate-300"
                    >
                        Close
                    </Button>
                    <Button
                        onClick={handlePrint}
                        className="flex-1 gap-2 bg-gradient-to-r from-[#2d5a3f] to-[#1e3d2a] hover:from-[#1e3d2a] hover:to-[#142a1d] text-white shadow-md"
                    >
                        <Printer className="h-4 w-4" /> Print Gas Slip
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default GasSlipView;