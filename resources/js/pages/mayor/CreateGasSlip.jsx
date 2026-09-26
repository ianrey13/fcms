import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "react-hot-toast";
import {
  ArrowLeft,
  Fuel,
  MapPin,
  Truck,
  FileText,
  Loader2,
  RefreshCw,
} from "lucide-react";

import { mayorsOfficeAPI } from "../../services/api";

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm";

const cardCls =
  "bg-white dark:bg-slate-800/60 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6";

const sectionTitleCls =
  "text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2";

const labelCls =
  "block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5";

export default function CreateGasSlip() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    control_number: "",
    department_id: "",
    driver_id: "",
    vehicle_id: "",
    trip_date: format(new Date(), "yyyy-MM-dd"),
    destination: "",
    purpose: "",
    charge_to: "",
    passenger_name: "",
    amount_released: "",
    is_cross_department: false,
    cross_department_reason: "",
    charge_to_department_id: "",
  });

  const [errors, setErrors] = useState({});

  // -------- Data fetches (MO-scoped) --------
  const { data: departments = [] } = useQuery({
    queryKey: ["mo-departments-selector"],
    queryFn: async () => {
      const res = await mayorsOfficeAPI.getAllDepartmentsForSelector();
      return res.data?.data || [];
    },
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["mo-drivers-active"],
    queryFn: async () => {
      const res = await mayorsOfficeAPI.getActiveDrivers();
      return res.data?.data || [];
    },
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["mo-vehicles-available", form.department_id],
    queryFn: async () => {
      const res = await mayorsOfficeAPI.getAvailableVehicles({
        department_id: form.department_id,
      });
      return res.data?.data || [];
    },
    enabled: !!form.department_id,
  });

  // -------- Auto-generate control number on mount --------
  const {
    data: nextControl,
    isLoading: controlLoading,
    refetch: refetchControl,
  } = useQuery({
    queryKey: ["mo-next-control-number"],
    queryFn: async () => {
      const res = await mayorsOfficeAPI.getNextControlNumber();
      return res.data?.data?.control_number || "";
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  useEffect(() => {
    if (nextControl && !form.control_number) {
      setForm((f) => ({ ...f, control_number: nextControl }));
    }
  }, [nextControl]);

  const handleDepartmentChange = (deptId) => {
    const dept = departments.find(
      (d) => String(d.department_id) === String(deptId),
    );
    setForm((f) => ({
      ...f,
      department_id: deptId,
      charge_to: dept?.department_code || "",
      vehicle_id: "",
    }));
  };

  const mutation = useMutation({
    mutationFn: (payload) => mayorsOfficeAPI.createGasSlip(payload),
    onSuccess: (res) => {
      const data = res.data?.data || {};
      toast.success(`Gas Slip ${data.control_number} created`);
      queryClient.invalidateQueries({ queryKey: ["mo-pending-gas-slips"] });
      queryClient.invalidateQueries({ queryKey: ["mayor-approved-tickets"] });
      navigate("/mo/dashboard");
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to create Gas Slip");
    },
  });

  const validate = () => {
    const e = {};
    if (!form.control_number.trim())
      e.control_number = "Control number is required";
    if (!form.department_id) e.department_id = "Department is required";
    if (!form.driver_id) e.driver_id = "Driver is required";
    if (!form.vehicle_id) e.vehicle_id = "Vehicle is required";
    if (!form.trip_date) e.trip_date = "Trip date is required";
    if (!form.destination.trim()) e.destination = "Destination is required";
    if (!form.purpose.trim()) e.purpose = "Purpose is required";
    if (!form.charge_to.trim()) e.charge_to = "Charge to is required";
    if (!form.amount_released || Number(form.amount_released) <= 0)
      e.amount_released = "Amount must be greater than 0";
    if (form.is_cross_department && !form.cross_department_reason.trim())
      e.cross_department_reason = "Reason required for cross-department usage";
    if (
      form.is_cross_department &&
      form.charge_to_department_id &&
      String(form.charge_to_department_id) === String(form.department_id)
    )
      e.charge_to_department_id =
        "Must be different from the requesting department";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      control_number: form.control_number.trim(),
      department_id: Number(form.department_id),
      driver_id: Number(form.driver_id),
      vehicle_id: Number(form.vehicle_id),
      trip_date: form.trip_date,
      destination: form.destination.trim(),
      purpose: form.purpose.trim(),
      charge_to: form.charge_to.trim(),
      passenger_name: form.passenger_name.trim() || null,
      amount_released: Number(form.amount_released),
      is_cross_department: form.is_cross_department,
      cross_department_reason: form.is_cross_department
        ? form.cross_department_reason.trim()
        : null,
      charge_to_department_id: form.is_cross_department
        ? Number(form.charge_to_department_id)
        : null,
    };

    mutation.mutate(payload);
  };

  const submitDisabled = mutation.isPending;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 dark:from-emerald-700 dark:to-emerald-600 text-white">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-white/10 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Fuel className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Create Gas Slip</h1>
              <p className="text-sm text-white/80">
                Direct fuel issuance — GSO will complete the Trip Ticket
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Section: Control & Amount */}
        <div className={cardCls}>
          <h2 className={sectionTitleCls}>
            <FileText className="w-4 h-4" /> Control Number
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label="Control Number"
              hint="Auto-generated · shared sequence with Trip Tickets"
              error={errors.control_number}
            >
              <div className="relative">
                <input
                  type="text"
                  value={form.control_number}
                  onChange={(e) =>
                    setForm({ ...form, control_number: e.target.value })
                  }
                  placeholder={controlLoading ? "Generating…" : "2026-09-002"}
                  className={`${inputCls} pr-10 font-mono`}
                  disabled={controlLoading}
                />
                <button
                  type="button"
                  onClick={() => refetchControl()}
                  disabled={controlLoading}
                  title="Regenerate"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 transition"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${controlLoading ? "animate-spin" : ""}`}
                  />
                </button>
              </div>
            </Field>

            <Field label="Amount to Release (₱)" error={errors.amount_released}>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={form.amount_released}
                onChange={(e) =>
                  setForm({ ...form, amount_released: e.target.value })
                }
                placeholder="5000.00"
                className={inputCls}
              />
            </Field>
          </div>
        </div>

        {/* Section: Trip details */}
        <div className={cardCls}>
          <h2 className={sectionTitleCls}>
            <MapPin className="w-4 h-4" /> Trip Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Department" error={errors.department_id}>
              <select
                value={form.department_id}
                onChange={(e) => handleDepartmentChange(e.target.value)}
                className={inputCls}
              >
                <option value="">Select department…</option>
                {departments.map((d) => (
                  <option key={d.department_id} value={d.department_id}>
                    {d.department_name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Charge To" error={errors.charge_to}>
              <input
                type="text"
                value={form.charge_to}
                onChange={(e) =>
                  setForm({ ...form, charge_to: e.target.value })
                }
                placeholder="Auto-filled from department"
                className={inputCls}
              />
            </Field>

            <Field label="Trip Date" error={errors.trip_date}>
              <input
                type="date"
                value={form.trip_date}
                onChange={(e) =>
                  setForm({ ...form, trip_date: e.target.value })
                }
                className={inputCls}
              />
            </Field>

            <Field label="Destination" error={errors.destination}>
              <input
                type="text"
                value={form.destination}
                onChange={(e) =>
                  setForm({ ...form, destination: e.target.value })
                }
                placeholder="e.g. Cagayan de Oro City"
                className={inputCls}
              />
            </Field>

            <Field
              label="Purpose"
              error={errors.purpose}
              className="md:col-span-2"
            >
              <textarea
                rows={3}
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                placeholder="Official purpose of the trip"
                className={`${inputCls} resize-none`}
              />
            </Field>

            <Field label="Passenger Name (optional)">
              <input
                type="text"
                value={form.passenger_name}
                onChange={(e) =>
                  setForm({ ...form, passenger_name: e.target.value })
                }
                placeholder="If applicable"
                className={inputCls}
              />
            </Field>
          </div>
        </div>

        {/* Section: Driver & Vehicle */}
        <div className={cardCls}>
          <h2 className={sectionTitleCls}>
            <Truck className="w-4 h-4" /> Driver & Vehicle
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Driver" error={errors.driver_id}>
              <select
                value={form.driver_id}
                onChange={(e) =>
                  setForm({ ...form, driver_id: e.target.value })
                }
                className={inputCls}
              >
                <option value="">Select driver…</option>
                {drivers.map((d) => (
                  <option key={d.driver_id} value={d.driver_id}>
                    {d.full_name}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Vehicle"
              error={errors.vehicle_id}
              hint="Available vehicles for selected department"
            >
              <select
                value={form.vehicle_id}
                onChange={(e) =>
                  setForm({ ...form, vehicle_id: e.target.value })
                }
                className={inputCls}
                disabled={!form.department_id}
              >
                <option value="">
                  {form.department_id
                    ? "Select vehicle…"
                    : "Select a department first"}
                </option>
                {vehicles.map((v) => (
                  <option key={v.vehicle_id} value={v.vehicle_id}>
                    {v.plate_number} — {v.vehicle_model}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        {/* Section: Cross-department */}
        <div className={cardCls}>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={form.is_cross_department}
              onChange={(e) =>
                setForm({ ...form, is_cross_department: e.target.checked })
              }
              className="rounded border-slate-300 dark:border-slate-600"
            />
            Cross-department fuel usage (for recording only — no budget
            transfer)
          </label>

          {form.is_cross_department && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pl-6 border-l-2 border-emerald-200 dark:border-emerald-800">
              <Field
                label="Charge To Department"
                error={errors.charge_to_department_id}
              >
                <select
                  value={form.charge_to_department_id}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      charge_to_department_id: e.target.value,
                    })
                  }
                  className={inputCls}
                >
                  <option value="">Select department…</option>
                  {departments
                    .filter(
                      (d) =>
                        String(d.department_id) !== String(form.department_id),
                    )
                    .map((d) => (
                      <option key={d.department_id} value={d.department_id}>
                        {d.department_name}
                      </option>
                    ))}
                </select>
              </Field>

              <Field
                label="Reason"
                error={errors.cross_department_reason}
                className="md:col-span-2"
              >
                <input
                  type="text"
                  value={form.cross_department_reason}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      cross_department_reason: e.target.value,
                    })
                  }
                  placeholder="Reason for cross-department usage"
                  className={inputCls}
                />
              </Field>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitDisabled}
            className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition"
          >
            {submitDisabled && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitDisabled ? "Creating…" : "Create Gas Slip"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, hint, error, children, className = "" }) {
  return (
    <div className={className}>
      <label className={labelCls}>{label}</label>
      {children}
      {hint && !error && (
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          {hint}
        </p>
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}