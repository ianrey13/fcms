// src/hooks/useEditTicketData.js
import { useState, useEffect } from 'react';

export const useEditTicketData = (isEditMode, editTicketId, departmentName) => {
  const [isResubmitMode, setIsResubmitMode] = useState(false);
  const [editFormData, setEditFormData] = useState(null);

  useEffect(() => {
    if (isEditMode && editTicketId) {
      const savedData = sessionStorage.getItem('edit_ticket_data');
      if (savedData) {
        try {
          const ticketData = JSON.parse(savedData);
          setIsResubmitMode(true);

          setEditFormData({
            driver_id: ticketData.driver_id || "",
            vehicle_id: ticketData.vehicle_id || "",
            trip_date: ticketData.trip_date || "",
            destination: ticketData.destination || "",
            purpose: ticketData.purpose || "",
            charge_to: ticketData.charge_to || departmentName,
            passenger_name: ticketData.passenger_name || "",
            estimated_fuel_liters: ticketData.estimated_fuel_liters || "",
            estimated_distance_km: ticketData.estimated_distance_km || "",
          });

          // Clear session storage after loading
          sessionStorage.removeItem('edit_ticket_data');
          
          // Optional: Show a toast notification
          setTimeout(() => {
            const toast = require('react-hot-toast').toast;
            toast.info(
              "Editing returned ticket. Please make corrections and resubmit.",
              { duration: 5000 }
            );
          }, 100);
        } catch (error) {
          console.error("Error loading edit data:", error);
        }
      }
    }
  }, [isEditMode, editTicketId, departmentName]);

  return { isResubmitMode, editFormData };
};