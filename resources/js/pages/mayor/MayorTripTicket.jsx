// src/pages/mayor/MayorTripTicket.jsx
import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { mayorsOfficeAPI, userAPI } from "../../services/api";
import { Button } from "@/components/ui/button";
import { Printer, X, Loader2, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";

// Import logos
import municipalLogo from "../../assets/img/465557735_866766092283213_5502511239926698684_n.svg";
import bagongPilipinasLogo from "../../assets/img/Bagong_Pilipinas_Logo.svg.png";

const PRINT_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Times New Roman', 'Georgia', 'Serif', Arial, sans-serif; font-size: 10px; color: #000; background: #fff; }
  .slip { width: 210mm; min-height: 297mm; padding: 0; }
  .no-print { display: none !important; }
  table { border-collapse: collapse; width: 100%; }
  td, th { padding: 2px 4px; }
  @media print {
    body { margin: 0; padding: 0; }
    .no-print { display: none; }
  }
`;

// ✅ Helper to format date properly
const formatDate = (dateString) => {
  if (!dateString) return "";
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : new Date(dateString);
    if (isNaN(date.getTime())) return "";
    return format(date, "MMMM d, yyyy");
  } catch (e) {
    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return format(date, "MMMM d, yyyy");
      }
    } catch (e2) {
      return "";
    }
    return "";
  }
};

const MayorTripTicket = ({ ticket: propTicket, onClose }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const printRef = useRef();
  const [ticket, setTicket] = useState(propTicket || null);
  const [loading, setLoading] = useState(!propTicket);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!propTicket && id) {
      fetchTicket();
    } else if (propTicket) {
      setTicket(propTicket);
    }
  }, [id, propTicket]);

  const fetchTicket = async () => {
    setLoading(true);
    setError(null);
    try {
      let data = null;
      let response = null;

      try {
        response = await mayorsOfficeAPI.getTicketById(id);
        data = response.data?.data || response.data;
        console.log("✅ Fetched via mayorsOfficeAPI:", data);
      } catch (firstError) {
        console.log("⚠️ mayorsOfficeAPI failed, trying fallback...");
        const { tripTicketAPI } = await import("../../services/api");
        response = await tripTicketAPI.getById(id);
        data = response.data?.data || response.data;
        console.log("✅ Fetched via tripTicketAPI fallback:", data);
      }

      if (!data) {
        throw new Error("No data returned from API");
      }

      console.log("=== MAYOR TRIP TICKET DATA ===");
      console.log("Full data:", data);
      console.log("Department:", data?.department);
      console.log("Head of Office:", data?.department?.head_of_office);

      setTicket(data);
    } catch (err) {
      console.error("❌ Failed to fetch ticket:", err);
      setError(err.response?.data?.message || err.message || "Failed to load trip ticket");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const win = window.open("", "_blank");
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Driver's Trip Ticket - ${ticket?.trip_ticket_number || ticket?.ticket_number || ""}</title>
          <meta charset="UTF-8">
          <style>${PRINT_STYLES}</style>
        </head>
        <body>${printRef.current.innerHTML}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      navigate(-1);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
        <p className="text-red-600 mb-4">{error || "Trip ticket not found"}</p>
        <Button onClick={handleClose}>Go Back</Button>
      </div>
    );
  }

  // Extract ticket data
  const ticketNumber = ticket.trip_ticket_number || ticket.ticket_number || "";
  
  const driverName = 
    ticket.driver?.user?.full_name ||
    (ticket.driver?.user?.first_name && ticket.driver?.user?.last_name 
      ? `${ticket.driver.user.first_name} ${ticket.driver.user.last_name}` 
      : "") ||
    ticket.driver?.full_name ||
    ticket.driver?.name ||
    ticket.driver_name ||
    "";
  
  const vehicleModel = ticket.vehicle?.vehicle_model || "";
  const plateNumber = ticket.vehicle?.plate_number || "";
  const vehicleInfo = `${vehicleModel} / ${plateNumber}`.trim();
  const passenger = ticket.passenger_name || "";
  const destination = ticket.destination || "";
  const purpose = ticket.purpose || "";
  
  const departmentName = ticket.department?.name || 
                         ticket.department?.department_name || 
                         ticket.department_name || 
                         ticket.charge_to || 
                         "";
  
  const headOfOffice = ticket.department?.head_of_office || 
                       ticket.head_of_office || 
                       "";
  
  const amountReleased = ticket.gas_slip?.amount_released || 
                         ticket.amount_released || 
                         0;

  const ticketDate = formatDate(ticket.created_at || ticket.trip_date);

  // Get Head Approval Data (for OIC indicator only)
  const headApproval = ticket.head_approval;
  let isOICAction = false;
  let oicName = "";

  if (headApproval) {
    isOICAction = headApproval.is_oic_action === true || headApproval.is_oic_action === 1;
    if (isOICAction && headApproval.approved_by?.full_name) {
      oicName = headApproval.approved_by.full_name;
    }
  }

  // Styles
  const styles = {
    container: {
      width: "100%",
      maxWidth: "800px",
      margin: "0 auto",
      border: "2px solid #000",
      fontFamily: "Times New Roman, Georgia, serif",
      fontSize: "10px",
      color: "#000",
      background: "#fff",
    },
    headerBanner: {
      background: "linear-gradient(135deg, #2d5a3f 0%, #4a7c59 50%, #2d5a3f 100%)",
      padding: "10px 15px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottom: "2px solid #1a1a1a",
    },
    logoCircle: {
      width: "60px",
      height: "60px",
      background: "white",
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      border: "2px solid #ffd700",
    },
    logoImage: {
      width: "100%",
      height: "100%",
      objectFit: "contain",
    },
    headerText: {
      textAlign: "center",
      flex: 1,
      color: "white",
    },
    republicText: {
      fontSize: "9px",
      letterSpacing: "1px",
      marginBottom: "2px",
    },
    provinceText: {
      fontSize: "10px",
      fontWeight: "bold",
    },
    municipalityText: {
      fontSize: "12px",
      fontWeight: "bold",
      margin: "2px 0",
    },
    gsoBadge: {
      fontSize: "10px",
      fontWeight: "bold",
      letterSpacing: "1px",
      background: "#1e3a6e",
      display: "inline-block",
      padding: "2px 12px",
      borderRadius: "2px",
    },
    emailText: {
      fontSize: "8px",
      marginTop: "3px",
      color: "#e0e0e0",
    },
    ticketBar: {
      display: "flex",
      justifyContent: "flex-end",
      alignItems: "center",
      borderBottom: "2px solid #000",
      padding: "4px 12px",
      gap: "10px",
      fontSize: "10px",
      background: "#f5f5f5",
    },
    section: {
      padding: "6px 12px",
    },
    sectionBorder: {
      borderBottom: "1.5px solid #000",
    },
    italicNote: {
      fontSize: "8.5px",
      fontStyle: "italic",
      marginBottom: "5px",
    },
    row: {
      display: "flex",
      alignItems: "flex-end",
      marginBottom: "4px",
    },
    rowNum: {
      minWidth: "18px",
      fontSize: "9.5px",
      padding: "3px 4px",
    },
    rowLabel: {
      minWidth: "210px",
      fontSize: "9.5px",
      padding: "3px 4px",
    },
    rowColon: {
      minWidth: "12px",
      fontSize: "9.5px",
      padding: "3px 4px",
    },
    rowValue: {
      flex: 1,
      borderBottom: "1px solid #000",
      fontSize: "9.5px",
      padding: "2px 4px",
    },
    twoColumnRow: {
      display: "flex",
      gap: 0,
    },
    leftColumn: {
      flex: 1,
      borderRight: "1px solid #000",
      paddingRight: "8px",
    },
    // ✅ FIXED: Head of Office Column with Signature Line (same as GSO)
    headOfficeColumn: {
      width: "160px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "8px 4px",
    },
    signatureLine: {
      borderTop: "1px solid #000",
      width: "140px",
      paddingTop: "2px",
      marginBottom: "2px",
    },
    headOfficeName: {
      fontSize: "9px",
      fontWeight: "bold",
      marginBottom: "2px",
    },
    headOfficeLabel: {
      fontSize: "7px",
      fontWeight: "normal",
      color: "#333",
    },
    fuelRow: {
      display: "flex",
      alignItems: "flex-end",
      marginBottom: "3px",
    },
    fuelSpacer: {
      minWidth: "30px",
    },
    fuelLabel: {
      minWidth: "200px",
      fontSize: "9.5px",
      padding: "3px 4px",
      paddingLeft: "12px",
    },
    fuelLabelBold: {
      minWidth: "200px",
      fontSize: "9.5px",
      padding: "3px 4px",
      paddingLeft: "12px",
      fontWeight: "bold",
    },
    fuelColon: {
      minWidth: "12px",
      fontSize: "9.5px",
      padding: "3px 4px",
    },
    fuelValue: {
      width: "72px",
      borderBottom: "1px solid #000",
      fontSize: "9.5px",
      padding: "2px 4px",
    },
    fuelValueBold: {
      width: "72px",
      borderBottom: "2px solid #000",
      fontSize: "9.5px",
      padding: "2px 4px",
    },
    fuelUnit: {
      marginLeft: "4px",
      fontSize: "9px",
      padding: "2px 4px",
      whiteSpace: "nowrap",
    },
    remarkBox: {
      borderTop: "1px solid #000",
      borderBottom: "1px solid #000",
      padding: "4px 12px",
    },
    remarkTitle: {
      fontWeight: "bold",
      fontSize: "10px",
      marginBottom: "3px",
    },
    remarkContent: {
      minHeight: "40px",
    },
    certificationBox: {
      padding: "10px 12px",
    },
    certText: {
      fontSize: "9.5px",
      marginBottom: "22px",
    },
    signatureBox: {
      textAlign: "center",
    },
    signatureLineDriver: {
      borderTop: "1px solid #000",
      width: "200px",
      paddingTop: "2px",
      fontSize: "9.5px",
    },
    signatureName: {
      fontSize: "8.5px",
      marginTop: "2px",
    },
    amountBox: {
      background: "#e8f5e9",
      padding: "6px 12px",
      borderTop: "1px solid #4caf50",
      textAlign: "center",
    },
    amountLabel: {
      fontWeight: "bold",
    },
    amountValue: {
      color: "#2e7d32",
      fontWeight: "bold",
      marginLeft: "8px",
    },
    footerBar: {
      background: "#f0f0f0",
      padding: "4px 12px",
      borderTop: "1px solid #ccc",
      display: "flex",
      justifyContent: "space-between",
      fontSize: "8px",
    },
    oilRow: {
      display: "flex",
      alignItems: "flex-end",
      marginBottom: "4px",
    },
    oilNum: {
      minWidth: "24px",
      fontSize: "9.5px",
      padding: "3px 4px",
    },
    oilLabel: {
      minWidth: "204px",
      fontSize: "9.5px",
      padding: "3px 4px",
    },
    oilColon: {
      minWidth: "12px",
      fontSize: "9.5px",
      padding: "3px 4px",
    },
    oilValue: {
      width: "72px",
      borderBottom: "1px solid #000",
      fontSize: "9.5px",
      padding: "2px 4px",
    },
  };

  const FieldRow = ({ num, label, value }) => (
    <div style={styles.row}>
      <span style={styles.rowNum}>{num}</span>
      <span style={styles.rowLabel}>{label}</span>
      <span style={styles.rowColon}>:</span>
      <span style={styles.rowValue}>
        {value || "_________________________"}
      </span>
    </div>
  );

  const FuelRow = ({ label, unit, bold }) => (
    <div style={styles.fuelRow}>
      <span style={styles.fuelSpacer}></span>
      <span style={bold ? styles.fuelLabelBold : styles.fuelLabel}>
        {label}
      </span>
      <span style={styles.fuelColon}>{bold ? "" : ":"}</span>
      <span style={bold ? styles.fuelValueBold : styles.fuelValue}></span>
      {unit && <span style={styles.fuelUnit}>{unit}</span>}
    </div>
  );

  const OilRow = ({ num, label, unit }) => (
    <div style={styles.oilRow}>
      <span style={styles.oilNum}>{num}</span>
      <span style={styles.oilLabel}>{label}</span>
      <span style={styles.oilColon}>:</span>
      <span style={styles.oilValue}></span>
      <span style={styles.fuelUnit}>{unit}</span>
    </div>
  );

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* Action bar */}
      <div className="no-print flex items-center justify-between mb-4 px-1">
        <div className="flex gap-2">
          <Button
            onClick={handlePrint}
            className="bg-blue-700 hover:bg-blue-800 text-white"
          >
            <Printer className="h-4 w-4 mr-2" />
            Print Ticket
          </Button>
        </div>
        <Button variant="outline" onClick={handleClose}>
          <X className="h-4 w-4 mr-2" />
          Close
        </Button>
      </div>

      {/* Printable Slip */}
      <div ref={printRef} style={styles.container}>
        {/* Header with Logos */}
        <div style={styles.headerBanner}>
          <div style={styles.logoCircle}>
            <img
              src={municipalLogo}
              alt="Municipal Logo"
              style={styles.logoImage}
              onError={(e) => {
                e.target.style.display = "none";
                e.target.parentElement.innerHTML = '<span style="font-size:8px;text-align:center;">MUN<br/>LOGO</span>';
              }}
            />
          </div>

          <div style={styles.headerText}>
            <div style={styles.republicText}>REPUBLIC OF THE PHILIPPINES</div>
            <div style={styles.provinceText}>PROVINCE OF MISAMIS ORIENTAL</div>
            <div style={styles.municipalityText}>
              MUNICIPALITY OF LAGUINDINGAN
            </div>
            <div style={styles.gsoBadge}>GENERAL SERVICES OFFICE</div>
            <div style={styles.emailText}>laguindingan.gso@gmail.com</div>
          </div>

          <div style={styles.logoCircle}>
            <img
              src={bagongPilipinasLogo}
              alt="Bagong Pilipinas Logo"
              style={styles.logoImage}
              onError={(e) => {
                e.target.style.display = "none";
                e.target.parentElement.innerHTML = '<span style="font-size:8px;text-align:center;">BP<br/>LOGO</span>';
              }}
            />
          </div>
        </div>

        {/* Ticket Number Bar */}
        <div style={styles.ticketBar}>
          <span style={{ fontWeight: "bold" }}>Date</span>
          <span
            style={{
              borderLeft: "1.5px solid #000",
              paddingLeft: "10px",
              marginRight: "11px",
              fontWeight: "bold",
            }}
          >
            {ticketDate || "___________"}
          </span>
        </div>
        <div style={styles.ticketBar}>
          <span style={{ fontWeight: "bold" }}>Trip Ticket #</span>
          <span
            style={{
              borderLeft: "1.5px solid #000",
              paddingLeft: "10px",
              fontWeight: "bold",
            }}
          >
            {ticketNumber}
          </span>
        </div>
    

        {/* Section 1: Administrative */}
        <div style={{ ...styles.section, ...styles.sectionBorder }}>
          <div style={styles.italicNote}>
            (To be filled up by the Administrative Official Authorizing the Travel)
          </div>

          <FieldRow num="1." label="Name of Driver" value={driverName || "N/A"} />
          <FieldRow
            num="2."
            label="Government Car used & Plate #"
            value={vehicleInfo}
          />
          <FieldRow
            num="3."
            label="Name of Authorized Passenger"
            value={passenger}
          />
          <FieldRow
            num="4."
            label="Place to be visited & Inspected"
            value={destination}
          />

          {/* ✅ FIXED: Fields 5 & 6 with HEAD OF OFFICE column - With Signature Line */}
          <div style={styles.twoColumnRow}>
            <div style={styles.leftColumn}>
              <FieldRow num="5." label="Purpose of Travel" value={purpose} />
              <FieldRow
                num="6."
                label="Charge to Project/Office"
                value={departmentName}
              />
            </div>
            <div style={styles.headOfficeColumn}>
              {/* ✅ Signature Line (for signature) */}
              <div style={styles.signatureLine}></div>
              
              {/* ✅ Full Name of Head of Office */}
              <div style={styles.headOfficeName}>
                {headOfOffice || "_________________________"}
              </div>
              
              {/* ✅ Label: Head of Office */}
              <div style={styles.headOfficeLabel}>
                Head of Office
              </div>
              
              {/* ✅ OIC indicator if applicable */}
              {isOICAction && oicName && (
                <div
                  style={{
                    fontSize: "6px",
                    fontWeight: "normal",
                    color: "#ff9800",
                    marginTop: "2px",
                  }}
                >
                  (OIC)
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Driver fills */}
        <div style={styles.section}>
          {[
            { num: "1.", label: "Time of Departure from the Office/Garage" },
            { num: "2.", label: "Time of Arrival (as of no. 4 above)" },
            { num: "3.", label: "Time of Departure (as of no. 4 above)" },
            { num: "4.", label: "Time of Arrival from the Office/Garage" },
          ].map(({ num, label }) => (
            <FieldRow key={num} num={num} label={label} value="" />
          ))}

          {/* Fuel */}
          <FuelRow label="a.) Balance in Tank" unit="liters" />
          <FuelRow label="b.) Issued from the Office Stock" unit="liters" />
          <FuelRow label="c.) Add Purchased" unit="liters" />
          <FuelRow label="TOTAL" unit="" bold />
          <FuelRow label="d.) Less used during trip" unit="liters" />
          <FuelRow label="e.) Balance in tank after trip" unit="liters" />

          {/* Oils & readings */}
          <OilRow num="5." label="Gear Oil Used" unit="liters/quart" />
          <OilRow num="6." label="Lubricant Oil Used" unit="liters" />
          <OilRow num="7." label="Grease Oil Used" unit="liters/quart" />
          <OilRow num="8." label="Speedometer reading if any" unit="km/s" />
          <OilRow num="9." label="Beginning of trip" unit="liters" />
          <OilRow num="10." label="Distance of Travel" unit="km/s" />
        </div>

        {/* Remark */}
        <div style={styles.remarkBox}>
          <div style={styles.remarkTitle}>REMARK:</div>
          <div style={styles.remarkContent}></div>
        </div>

        {/* Certification 1: Driver */}
        <div style={{ ...styles.certificationBox, borderBottom: "1px solid #ccc" }}>
          <div style={styles.certText}>
            I HEREBY CERTIFY for the correctness of the above statement records travel.
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", paddingRight: "20px" }}>
            <div style={styles.signatureBox}>
              {driverName && <div style={styles.signatureName}>{driverName}</div>}
              <div style={styles.signatureLineDriver}>Signature of Driver</div>
            </div>
          </div>
        </div>

        {/* Certification 2: Passenger */}
        <div style={styles.certificationBox}>
          <div style={styles.certText}>
            I HEREBY CERTIFY that I used the car on the Official Travel as stated above.
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", paddingRight: "20px" }}>
            <div style={styles.signatureBox}>
              {passenger && <div style={styles.signatureName}>{passenger}</div>}
              <div style={styles.signatureLineDriver}>Signature of Authorized Passenger</div>
            </div>
          </div>
        </div>

        {/* Amount Released */}
        {amountReleased > 0 && (
          <div style={styles.amountBox}>
            <span style={styles.amountLabel}>Amount Released:</span>
            <span style={styles.amountValue}>
              ₱{amountReleased.toLocaleString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MayorTripTicket;