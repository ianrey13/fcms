// src/pages/mayor/MayorTripTicketDetail.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { mayorsOfficeAPI } from '../../services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, ArrowLeft, Calendar, MapPin, User, Truck, DollarSign, 
  Printer, Building2, Fuel, Clock, CheckCircle, XCircle, 
  FileText, Receipt, AlertCircle, ChevronRight
} from 'lucide-react';
import municipalLogo from '../../assets/img/465557735_866766092283213_5502511239926698684_n.svg';
import bagongPilipinasLogo from '../../assets/img/Bagong_Pilipinas_Logo.svg.png';

const MayorTripTicketDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  useEffect(() => {
    fetchTicket();
  }, [id]);

  const fetchTicket = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await mayorsOfficeAPI.getTicketById(id);
      console.log('Ticket response:', response.data);
      const data = response.data?.data || response.data;
      setTicket(data);
    } catch (error) {
      console.error('Failed to fetch ticket:', error);
      setError(error.response?.data?.message || 'Failed to load ticket details');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Trip Ticket - ${ticket?.trip_ticket_number || ''}</title>
          <meta charset="UTF-8">
          <style>
            @page { size: portrait; margin: 0.5in; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Times New Roman', 'Georgia', 'Serif';
              background: white;
              font-size: 11px;
            }
            .trip-ticket-container {
              width: 100%;
              max-width: 800px;
              margin: 0 auto;
              background: white;
            }
            .header-banner {
              background: linear-gradient(135deg, #2d5a3f 0%, #4a7c59 50%, #2d5a3f 100%);
              padding: 10px 15px;
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
            .title-box { background: #d4c5b5; border-bottom: 2px solid #1a1a1a; text-align: center; padding: 6px; }
            .title-box h1 { font-size: 18px; font-weight: bold; letter-spacing: 3px; color: #1a1a1a; margin: 0; }
            .content { padding: 15px 20px; }
            .section { margin-bottom: 15px; }
            .section-title { font-weight: bold; font-size: 12px; border-bottom: 1px solid #000; margin-bottom: 8px; padding-bottom: 3px; }
            .row { display: flex; margin-bottom: 6px; }
            .label { width: 150px; font-weight: bold; }
            .value { flex: 1; border-bottom: 1px solid #ccc; padding-left: 5px; }
            .two-column { display: flex; gap: 20px; margin-bottom: 10px; }
            .column { flex: 1; }
            .amount-box { background: #e8f5e9; padding: 10px; text-align: center; border-radius: 5px; margin-top: 10px; }
            .amount-label { font-size: 11px; color: #2e7d32; }
            .amount-value { font-size: 18px; font-weight: bold; color: #2e7d32; }
            .approvals { display: flex; justify-content: space-between; margin-top: 15px; }
            .approval-item { text-align: center; flex: 1; }
            .signature-line { border-top: 1px solid #000; width: 150px; margin: 5px auto 0; padding-top: 3px; }
            .footer { margin-top: 20px; text-align: center; font-size: 8px; border-top: 1px solid #ccc; padding-top: 8px; }
            @media print { body { margin: 0; padding: 0; } .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="trip-ticket-container">
            <div class="header-banner">
              <div class="logo-left"><img src="${municipalLogo}" alt="Municipal Logo" /></div>
              <div class="header-text">
                <div class="republic">REPUBLIC OF THE PHILIPPINES</div>
                <div class="province">PROVINCE OF MISAMIS ORIENTAL</div>
                <div class="municipality">MUNICIPALITY OF LAGUINDINGAN</div>
                <div class="office">GENERAL SERVICES OFFICE</div>
              </div>
              <div class="logo-right"><img src="${bagongPilipinasLogo}" alt="Bagong Pilipinas Logo" /></div>
            </div>
            <div class="title-box"><h1>DRIVER'S TRIP TICKET</h1></div>
            <div class="content">
              <div class="section">
                <div class="section-title">TRIP INFORMATION</div>
                <div class="row"><div class="label">Trip Ticket #</div><div class="value">${ticket?.trip_ticket_number || ''}</div></div>
                <div class="row"><div class="label">Date</div><div class="value">${ticket?.trip_date ? new Date(ticket.trip_date).toLocaleDateString() : ''}</div></div>
                <div class="row"><div class="label">Destination</div><div class="value">${ticket?.destination || ''}</div></div>
                <div class="row"><div class="label">Purpose of Travel</div><div class="value">${ticket?.purpose || ''}</div></div>
                <div class="row"><div class="label">Charge to Project/Office</div><div class="value">${ticket?.charge_to || ''}</div></div>
              </div>
              <div class="section">
                <div class="section-title">ASSIGNMENT</div>
                <div class="row"><div class="label">Name of Driver</div><div class="value">${ticket?.driver?.user?.full_name || ticket?.driver?.full_name || 'N/A'}</div></div>
                <div class="row"><div class="label">Government Car Used & Plate #</div><div class="value">${ticket?.vehicle?.vehicle_model || ''} / ${ticket?.vehicle?.plate_number || ''}</div></div>
                <div class="row"><div class="label">Name of Authorized Passenger</div><div class="value">${ticket?.passenger_name || 'N/A'}</div></div>
              </div>
              ${ticket?.gas_slip?.amount_released > 0 ? `
              <div class="amount-box">
                <div class="amount-label">AMOUNT RELEASED</div>
                <div class="amount-value">₱${ticket.gas_slip.amount_released.toLocaleString()}</div>
              </div>
              ` : ''}
              <div class="approvals">
                <div class="approval-item"><div>Head of Office</div><div class="signature-line"></div><div style="font-size:9px; margin-top:3px;">${ticket?.latest_head_approval?.approved_by?.full_name || 'Pending'}</div></div>
                <div class="approval-item"><div>GSO Verified</div><div class="signature-line"></div><div style="font-size:9px; margin-top:3px;">${ticket?.latest_gso_verification?.verified_by?.full_name || 'Pending'}</div></div>
                <div class="approval-item"><div>Mayor's Office</div><div class="signature-line"></div><div style="font-size:9px; margin-top:3px;">${ticket?.latest_mo_review?.reviewed_by?.full_name || 'Pending'}</div></div>
              </div>
            </div>
            <div class="footer">
              <p>I HEREBY CERTIFY for the correctness of the above statement records travel.</p>
              <p>This trip ticket is valid only for the specified vehicle and driver.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const getStatusBadge = (status) => {
    const config = {
      funds_issued: { color: 'bg-emerald-500', label: 'Funds Issued', icon: CheckCircle },
      in_transit: { color: 'bg-blue-500', label: 'In Transit', icon: Truck },
      closed: { color: 'bg-slate-500', label: 'Closed', icon: CheckCircle },
      pending_reconciliation: { color: 'bg-amber-500', label: 'Pending Reconciliation', icon: Clock },
      with_mayors_office: { color: 'bg-orange-500', label: 'Pending Fund Release', icon: DollarSign },
      acknowledged: { color: 'bg-purple-500', label: 'Acknowledged', icon: FileText },
    };
    const c = config[status] || { color: 'bg-gray-500', label: status?.replace(/_/g, ' ') || 'Unknown', icon: AlertCircle };
    const Icon = c.icon;
    return (
      <Badge className={`${c.color} text-white px-3 py-1.5 rounded-full flex items-center gap-1.5`}>
        <Icon className="h-3 w-3" />
        {c.label}
      </Badge>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    if (!amount) return '₱0.00';
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-500 dark:text-red-400 mb-4">{error}</p>
        <Button onClick={() => navigate('/mo/approved')} className="mt-4">
          Back to Approved
        </Button>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">Trip ticket not found</p>
        <Button onClick={() => navigate('/mo/approved')} className="mt-4">
          Back to Approved
        </Button>
      </div>
    );
  }

  const driverName = ticket.driver?.user?.full_name || ticket.driver?.full_name || 'N/A';
  const vehicleInfo = `${ticket.vehicle?.vehicle_model || ''} / ${ticket.vehicle?.plate_number || ''}`.replace(/^\/ /, '').replace(/ \/$/, '');
  const fuelType = ticket.vehicle?.fuel_type ? ticket.vehicle.fuel_type.toUpperCase() : 'N/A';

  return (
    <div className="space-y-6 p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-900 dark:to-slate-800 min-h-screen transition-colors duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/mo/approved')} 
            className="gap-2 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
              Trip Ticket Details
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              View complete trip information and status
            </p>
          </div>
        </div>
        <div className="flex gap-3 no-print">
          <Button 
            variant="outline" 
            onClick={handlePrint} 
            className="gap-2 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Printer className="h-4 w-4" />
            Print Ticket
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Card */}
          <Card className="dark:bg-slate-800/80 dark:border-slate-700 overflow-hidden">
            <CardHeader className="border-b border-gray-100 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50">
              <div className="flex justify-between items-center">
                <CardTitle className="dark:text-white">Trip Information</CardTitle>
                {getStatusBadge(ticket.status)}
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-slate-400">Ticket Number</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{ticket.trip_ticket_number}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-slate-400">Trip Date</p>
                  <p className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    {formatDate(ticket.trip_date)}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-500 dark:text-slate-400">Destination</p>
                  <p className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    {ticket.destination}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-500 dark:text-slate-400">Purpose of Travel</p>
                  <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{ticket.purpose}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-500 dark:text-slate-400">Charge To</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{ticket.charge_to}</p>
                </div>
                {ticket.passenger_name && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-gray-500 dark:text-slate-400">Authorized Passenger</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{ticket.passenger_name}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Assignment Card */}
          <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardHeader className="border-b border-gray-100 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50">
              <CardTitle className="flex items-center gap-2 dark:text-white">
                <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-slate-400">Driver</p>
                  <p className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    {driverName}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-slate-400">Vehicle</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{vehicleInfo || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-slate-400">Plate Number</p>
                  <p className="font-mono text-gray-900 dark:text-white">{ticket.vehicle?.plate_number || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-slate-400">Fuel Type</p>
                  <p className="font-semibold text-blue-600 dark:text-blue-400">{fuelType}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Financial & Approvals */}
        <div className="space-y-6">
          {/* Amount Released Card */}
          {ticket.gas_slip?.amount_released > 0 && (
            <Card className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-slate-800 border-emerald-200 dark:border-emerald-800">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                  <DollarSign className="h-5 w-5" />
                  Financial Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">Amount Released</p>
                  <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">
                    {formatCurrency(ticket.gas_slip.amount_released)}
                  </p>
                  <p className="text-xs text-emerald-500 dark:text-emerald-500 mt-2">
                    Released on {formatDate(ticket.gas_slip.created_at)}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Approvals Card */}
          <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardHeader className="border-b border-gray-100 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50">
              <CardTitle className="flex items-center gap-2 dark:text-white">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                Approvals
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-slate-400">Head of Office</p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {ticket.latest_head_approval?.approved_by?.full_name || 'Pending'}
                    </p>
                  </div>
                  {ticket.latest_head_approval?.decision === 'approved' ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <Clock className="h-5 w-5 text-amber-500" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-slate-400">GSO Verification</p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {ticket.latest_gso_verification?.verified_by?.full_name || 'Pending'}
                    </p>
                  </div>
                  {ticket.latest_gso_verification?.decision === 'approved' ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <Clock className="h-5 w-5 text-amber-500" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-slate-400">Mayor's Office</p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {ticket.latest_mo_review?.reviewed_by?.full_name || 'Pending'}
                    </p>
                  </div>
                  {ticket.latest_mo_review?.decision === 'approved' ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <Clock className="h-5 w-5 text-amber-500" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Department Info Card */}
          <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardHeader className="border-b border-gray-100 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50">
              <CardTitle className="flex items-center gap-2 dark:text-white">
                <Building2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                Department
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="font-semibold text-gray-900 dark:text-white">{ticket.department_name || 'N/A'}</p>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                {ticket.department_code || ''}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Timeline Section */}
      <Card className="dark:bg-slate-800/80 dark:border-slate-700">
        <CardHeader className="border-b border-gray-100 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50">
          <CardTitle className="flex items-center gap-2 dark:text-white">
            <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Trip Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Trip Ticket Created</p>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  {formatDate(ticket.submitted_at)} by {ticket.submitted_by?.full_name || 'System'}
                </p>
              </div>
            </div>
            
            {ticket.latest_head_approval && (
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  ticket.latest_head_approval.decision === 'approved' 
                    ? 'bg-green-100 dark:bg-green-900/30' 
                    : 'bg-red-100 dark:bg-red-900/30'
                }`}>
                  {ticket.latest_head_approval.decision === 'approved' ? (
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Head of Office {ticket.latest_head_approval.decision === 'approved' ? 'Approved' : 'Action Taken'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    {formatDate(ticket.latest_head_approval.reviewed_at)} by {ticket.latest_head_approval.approved_by?.full_name}
                  </p>
                </div>
              </div>
            )}
            
            {ticket.latest_gso_verification && (
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  ticket.latest_gso_verification.decision === 'approved' 
                    ? 'bg-green-100 dark:bg-green-900/30' 
                    : 'bg-red-100 dark:bg-red-900/30'
                }`}>
                  {ticket.latest_gso_verification.decision === 'approved' ? (
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    GSO {ticket.latest_gso_verification.decision === 'approved' ? 'Verified' : 'Action Taken'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    {formatDate(ticket.latest_gso_verification.verified_at)} by {ticket.latest_gso_verification.verified_by?.full_name}
                  </p>
                </div>
              </div>
            )}
            
            {ticket.latest_mo_review && (
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  ticket.latest_mo_review.decision === 'approved' 
                    ? 'bg-green-100 dark:bg-green-900/30' 
                    : 'bg-red-100 dark:bg-red-900/30'
                }`}>
                  {ticket.latest_mo_review.decision === 'approved' ? (
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Mayor's Office {ticket.latest_mo_review.decision === 'approved' ? 'Approved' : 'Action Taken'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    {formatDate(ticket.latest_mo_review.reviewed_at)} by {ticket.latest_mo_review.reviewed_by?.full_name}
                  </p>
                </div>
              </div>
            )}
            
            {ticket.status === 'in_transit' && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Trip In Progress</p>
                  <p className="text-sm text-gray-500 dark:text-slate-400">Driver has started the trip</p>
                </div>
              </div>
            )}
            
            {ticket.status === 'closed' && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Trip Completed</p>
                  <p className="text-sm text-gray-500 dark:text-slate-400">Trip has been reconciled and closed</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MayorTripTicketDetail;